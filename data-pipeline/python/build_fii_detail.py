"""Build do JSON consolidado das páginas individuais de cada FII.

Output: data/fii_details.json (estrutura FiiDetailsData de src/lib/painel-fii.ts).

Universo: composição IFIX (107 FIIs) — mesmo do screener. Para cada ticker:
  - Hero: cotação, var dia, máx/mín 12m, DY 12m, último rendimento R$,
    PL e P/VP (CVM Informe Mensal).
  - Série diária de cotação ~5 anos (yfinance) pra alimentar TimeWindowToggle.
  - Indicadores: VP/cota, P/VP, nº cotistas (CVM complemento),
    DY CAGR 3a, Valor CAGR 3a, participação IFIX.
  - Ficha: CNPJ, nome completo, administrador + CNPJ admin, segmento.
  - Dividendos: histórico completo via yfinance.dividends, com data_com
    e estimativa de data de pagamento (~10 dias úteis depois).

Fontes:
  - B3 GetPortfolioDay (universo + peso IFIX)
  - CVM inf_mensal_fii_geral/complemento (CNPJ, admin, PL, VP, cotistas, segmento)
  - yfinance (cotação histórica, dividendos, último preço)
  - Override curado de segmento (fii_segments_override.py)
"""
from __future__ import annotations

import argparse
import base64
import csv
import io
import json
import re
import sys
import zipfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import pandas as pd
import requests
import yfinance as yf

sys.path.append(str(Path(__file__).parent))
from fii_segments_override import override_segment  # noqa: E402
from shared.blob_upload import maybe_upload_json  # noqa: E402


UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0", "Accept": "*/*"}
B3_IFIX_URL = (
    "https://sistemaswebb3-listados.b3.com.br/indexProxy/indexCall/GetPortfolioDay/"
    + base64.b64encode(b'{"index":"IFIX","language":"pt-br"}').decode()
)
CVM_INF_MENSAL_URL = (
    "https://dados.cvm.gov.br/dados/FII/DOC/INF_MENSAL/DADOS/inf_mensal_fii_{ano}.zip"
)


SEGMENT_LABEL_MAP: Dict[str, str] = {
    "Logística": "Logística",
    "Logistica": "Logística",
    "Shoppings": "Shoppings",
    "Escritórios": "Lajes",
    "Escritorios": "Lajes",
    "Lajes Corporativas": "Lajes",
    "Hospital": "Hospitalar",
    "Hotel": "Hotelaria",
    "Educacional": "Educacional",
    "Varejo": "Varejo",
    "Residencial": "Residencial",
    "Multicategoria": "Híbrido",
    "Outros": "Outros",
}


def _s(v) -> str:
    if v is None:
        return ""
    if isinstance(v, float) and pd.isna(v):
        return ""
    return str(v).strip()


# ---------------------------------------------------------------------------
# Fetchers (reuso do screener — copiados pra evitar cross-import)
# ---------------------------------------------------------------------------

def fetch_ifix_composition() -> List[Dict]:
    r = requests.get(B3_IFIX_URL, headers=UA, timeout=30)
    r.raise_for_status()
    data = r.json()
    items = []
    for row in data.get("results", []):
        cod = (row.get("cod") or "").strip()
        if not cod:
            continue
        try:
            weight = float((row.get("part") or "0").replace(",", "."))
        except ValueError:
            weight = 0.0
        items.append({"ticker": cod, "asset_name": (row.get("asset") or "").strip(), "weight_pct": weight})
    return items


def fetch_cvm_inf_mensal(year: int) -> Dict[str, pd.DataFrame]:
    url = CVM_INF_MENSAL_URL.format(ano=year)
    r = requests.get(url, headers=UA, timeout=60)
    r.raise_for_status()
    out = {}
    with zipfile.ZipFile(io.BytesIO(r.content)) as zf:
        for name in zf.namelist():
            lower = name.lower()
            if "geral" in lower:
                key = "geral"
            elif "complemento" in lower:
                key = "complemento"
            else:
                continue
            with zf.open(name) as fh:
                out[key] = pd.read_csv(fh, sep=";", encoding="latin1", dtype=str, low_memory=False)
    return out


def latest_per_cnpj(df: pd.DataFrame, date_col: str = "Data_Referencia") -> pd.DataFrame:
    if df is None or df.empty:
        return df
    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
    df = df.dropna(subset=[date_col, "CNPJ_Fundo_Classe"])
    df = df.sort_values(date_col).drop_duplicates("CNPJ_Fundo_Classe", keep="last")
    return df


def build_isin_to_cnpj(geral_last: pd.DataFrame) -> Dict[str, str]:
    out: Dict[str, str] = {}
    for _, row in geral_last.iterrows():
        isin = _s(row.get("Codigo_ISIN"))
        cnpj = _s(row.get("CNPJ_Fundo_Classe"))
        m = re.match(r"BR(\w{4})CTF", isin)
        if m and cnpj and m.group(1) not in out:
            out[m.group(1)] = cnpj
    return out


# ---------------------------------------------------------------------------
# Helpers de cálculo (CAGR, etc)
# ---------------------------------------------------------------------------

def cagr(initial: float, final: float, years: float) -> Optional[float]:
    """CAGR percent. None se inválido."""
    if initial is None or final is None or initial <= 0 or final <= 0 or years <= 0:
        return None
    try:
        return ((final / initial) ** (1.0 / years) - 1.0) * 100.0
    except (ValueError, OverflowError):
        return None


def annual_dividends(divs: pd.Series) -> Dict[int, float]:
    """Soma anual dos dividendos por ano (índice ano)."""
    if divs is None or divs.empty:
        return {}
    s = divs.copy()
    s.index = pd.to_datetime(s.index).tz_localize(None) if s.index.tz else pd.to_datetime(s.index)
    by_year = s.groupby(s.index.year).sum()
    return {int(y): float(v) for y, v in by_year.items()}


def dy_cagr_3y(divs: pd.Series) -> Optional[float]:
    """CAGR da soma anual de dividendos nos últimos 3 anos cheios."""
    by_year = annual_dividends(divs)
    if not by_year:
        return None
    current = max(by_year.keys())
    # Usa o último ano cheio anterior (current-1) como T0+3 e (current-4) como T0
    end_year = current - 1
    start_year = end_year - 3
    if start_year not in by_year or end_year not in by_year:
        return None
    return cagr(by_year[start_year], by_year[end_year], 3.0)


def valor_cagr_3y(close_series: pd.Series) -> Optional[float]:
    """CAGR da cotação últimos 3 anos (price-only)."""
    if close_series is None or close_series.empty:
        return None
    last_date = close_series.index[-1]
    three_y_ago = last_date - pd.Timedelta(days=int(3 * 365.25))
    win = close_series.loc[close_series.index >= three_y_ago]
    if win.empty or len(win) < 100:
        return None
    return cagr(float(win.iloc[0]), float(win.iloc[-1]), 3.0)


def fetch_yf_detail(ticker: str) -> Dict:
    """Pega tudo que precisamos pra hero, série e dividendos de um FII."""
    yf_ticker = f"{ticker}.SA"
    out: Dict = {
        "price": None, "price_date": None, "change_pct_1d": None,
        "max_12m": None, "min_12m": None,
        "div_sum_12m": None, "last_dividend_brl": None, "last_dividend_date": None,
        "series_daily": [],  # list of {date, close}
        "dividends": [],     # list of {data_com, pagamento, valor}
        "dy_cagr_3y_pct": None, "valor_cagr_3y_pct": None,
    }
    try:
        tk = yf.Ticker(yf_ticker)
        hist = tk.history(period="5y", auto_adjust=False)
        if hist is None or hist.empty:
            return out

        close = pd.to_numeric(hist["Close"], errors="coerce").dropna()
        if close.empty:
            return out
        close.index = pd.to_datetime(close.index).tz_localize(None).normalize()

        out["price"] = float(close.iloc[-1])
        out["price_date"] = close.index[-1].strftime("%Y-%m-%d")
        if len(close) >= 2:
            prev = float(close.iloc[-2])
            if prev > 0:
                out["change_pct_1d"] = round((out["price"] - prev) / prev * 100.0, 2)

        last_date = close.index[-1]
        one_year_ago = last_date - pd.Timedelta(days=365)
        win = close.loc[close.index >= one_year_ago]
        if not win.empty:
            out["max_12m"] = round(float(win.max()), 2)
            out["min_12m"] = round(float(win.min()), 2)

        # Série diária (~5a)
        out["series_daily"] = [
            {"date": d.strftime("%Y-%m-%d"), "close": round(float(v), 2)} for d, v in close.items()
        ]

        # Dividendos
        divs = tk.dividends
        if divs is not None and not divs.empty:
            d_naive = divs.copy()
            d_naive.index = pd.to_datetime(d_naive.index).tz_localize(None).normalize()
            # Últimos 12m
            cutoff = last_date - pd.Timedelta(days=365)
            d12 = d_naive.loc[d_naive.index >= cutoff]
            out["div_sum_12m"] = round(float(d12.sum()), 4) if not d12.empty else 0.0
            # Último
            out["last_dividend_brl"] = round(float(d_naive.iloc[-1]), 4)
            out["last_dividend_date"] = d_naive.index[-1].strftime("%Y-%m-%d")
            # Tabela completa (recente -> antigo, com data pagamento estimada =~ 10 dias úteis)
            for dt, val in d_naive.sort_index(ascending=False).items():
                payment = (dt + pd.Timedelta(days=14)).strftime("%Y-%m-%d")
                out["dividends"].append({
                    "data_com": dt.strftime("%Y-%m-%d"),
                    "pagamento": payment,
                    "valor": round(float(val), 4),
                })
            # CAGRs
            out["dy_cagr_3y_pct"] = dy_cagr_3y(d_naive)
            out["valor_cagr_3y_pct"] = valor_cagr_3y(close)
    except Exception as e:
        print(f"[yf detail] FAIL {yf_ticker}: {e}", file=sys.stderr)
    return out


# ---------------------------------------------------------------------------
# Build payload
# ---------------------------------------------------------------------------

def build_payload() -> Dict:
    print("[fii_detail] Fetch IFIX composição (B3)...")
    universo = fetch_ifix_composition()
    print(f"[fii_detail] IFIX universe: {len(universo)} FIIs")

    print("[fii_detail] Fetch CVM inf_mensal...")
    today = date.today()
    try:
        cvm = fetch_cvm_inf_mensal(today.year)
        if "geral" not in cvm or "complemento" not in cvm:
            raise RuntimeError("incomplete")
    except Exception:
        cvm = fetch_cvm_inf_mensal(today.year - 1)

    geral_last = latest_per_cnpj(cvm.get("geral", pd.DataFrame()))
    comp_last = latest_per_cnpj(cvm.get("complemento", pd.DataFrame()))
    print(f"[fii_detail] CVM geral_last: {len(geral_last)} | complemento_last: {len(comp_last)}")

    geral_by_cnpj = geral_last.set_index("CNPJ_Fundo_Classe").to_dict("index")
    comp_by_cnpj = comp_last.set_index("CNPJ_Fundo_Classe").to_dict("index")
    isin_to_cnpj = build_isin_to_cnpj(geral_last)

    by_ticker: Dict[str, Dict] = {}
    for i, item in enumerate(universo):
        ticker = item["ticker"]
        if i % 20 == 0:
            print(f"[fii_detail] {i}/{len(universo)} processando {ticker}...")
        root = ticker[:4] if len(ticker) >= 4 else None
        cnpj = isin_to_cnpj.get(root) if root else None

        # CVM data
        full_name = None
        admin_name = None
        admin_cnpj = None
        cvm_segment = "Outros"
        pl = None
        pl_ref_date = None
        vp_per_cota = None
        num_cotistas = None
        ifix_pl = None
        if cnpj:
            g = geral_by_cnpj.get(cnpj, {})
            c = comp_by_cnpj.get(cnpj, {})
            full_name = _s(g.get("Nome_Fundo_Classe")) or None
            admin_name = _s(g.get("Nome_Administrador")) or None
            admin_cnpj = _s(g.get("CNPJ_Administrador")) or None
            seg_raw = _s(g.get("Segmento_Atuacao"))
            cvm_segment = SEGMENT_LABEL_MAP.get(seg_raw, seg_raw or "Outros")
            try:
                pl_raw = _s(c.get("Patrimonio_Liquido"))
                pl = float(pl_raw) if pl_raw else None
                if pl and not pd.isna(pl) and pl > 0:
                    dt = c.get("Data_Referencia")
                    pl_ref_date = dt.strftime("%Y-%m-%d") if hasattr(dt, "strftime") else (str(dt)[:10] if dt else None)
                else:
                    pl = None
            except Exception:
                pl = None
            try:
                vp_raw = _s(c.get("Valor_Patrimonial_Cotas"))
                vp_per_cota = float(vp_raw) if vp_raw else None
                if vp_per_cota and (pd.isna(vp_per_cota) or vp_per_cota <= 0):
                    vp_per_cota = None
            except Exception:
                vp_per_cota = None
            try:
                nc_raw = _s(c.get("Total_Numero_Cotistas"))
                num_cotistas = int(float(nc_raw)) if nc_raw else None
            except Exception:
                num_cotistas = None

        segment = override_segment(ticker, cvm_segment)

        # yfinance — pesado, faz por último
        yf_data = fetch_yf_detail(ticker)
        price = yf_data["price"]

        # P/VP final com sanity
        pvp_final = None
        pvp_warning = False
        pvp_ref_date = pl_ref_date
        if vp_per_cota and price:
            cand = price / vp_per_cota
            if 0.3 <= cand <= 3.0:
                pvp_final = round(cand, 3)
                pvp_warning = pvp_final < 0.7
            else:
                pvp_ref_date = None

        # DY 12m
        dy_12m_pct = None
        if price and price > 0 and yf_data["div_sum_12m"] is not None:
            dy_12m_pct = round(yf_data["div_sum_12m"] / price * 100.0, 2)
        dy_atypical = bool(dy_12m_pct is not None and dy_12m_pct > 18.0)

        entry = {
            "ticker": ticker,
            "name": item["asset_name"] or full_name or ticker,
            "hero": {
                "dy_12m_pct": dy_12m_pct,
                "last_dividend_brl": yf_data["last_dividend_brl"],
                "last_dividend_date": yf_data["last_dividend_date"],
                "pl": round(pl, 2) if pl else None,
                "pl_ref_date": pl_ref_date,
                "pvp": pvp_final,
                "pvp_ref_date": pvp_ref_date,
                "price": round(price, 2) if price else None,
                "price_date": yf_data["price_date"],
                "change_pct_1d": yf_data["change_pct_1d"],
                "max_12m": yf_data["max_12m"],
                "min_12m": yf_data["min_12m"],
            },
            "indicators": {
                "vp_per_cota": round(vp_per_cota, 4) if vp_per_cota else None,
                "pvp": pvp_final,
                "num_cotistas": num_cotistas,
                "dy_cagr_3y_pct": round(yf_data["dy_cagr_3y_pct"], 2) if yf_data["dy_cagr_3y_pct"] is not None else None,
                "valor_cagr_3y_pct": round(yf_data["valor_cagr_3y_pct"], 2) if yf_data["valor_cagr_3y_pct"] is not None else None,
                "ifix_weight_pct": round(item["weight_pct"], 4),
            },
            "ficha": {
                "cnpj": cnpj,
                "full_name": full_name,
                "admin_name": admin_name,
                "admin_cnpj": admin_cnpj,
                "segment": segment,
            },
            "price_series_daily": yf_data["series_daily"],
            "dividends": yf_data["dividends"],
            "dy_atypical": dy_atypical,
            "pvp_warning": pvp_warning,
        }
        by_ticker[ticker] = entry

    print(f"[fii_detail] Total entries: {len(by_ticker)}")

    return {
        "status": "ok",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total": len(by_ticker),
        "by_ticker": by_ticker,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default="data-pipeline/out")
    ap.add_argument("--upload", action="store_true")
    args = ap.parse_args()

    payload = build_payload()
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "fii_details.json"
    out_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(f"[fii_detail] Escreveu {out_path} ({out_path.stat().st_size:,} bytes)")

    if args.upload:
        maybe_upload_json(out_path, "data/fii_details.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
