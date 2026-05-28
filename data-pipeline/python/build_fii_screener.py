"""Build do JSON do Screener de FIIs pro painel /mercado/brasil/fundos-imobiliarios.

Output: data/fii_screener.json (consumido por src/lib/painel-fii.ts -> FiiScreenerData).

Estratégia:
  - Universo: composição IFIX (B3 indexProxy GetPortfolioDay).
    ~107 FIIs com peso > 0 — garante liquidez mínima do screener Onda 1.
  - Mapping ticker -> CNPJ: ISIN do CVM (formato BR<4LETRAS_TICKER>CTF<N>).
    Cobertura tipicamente >80% dos FIIs do IFIX.
  - Para cada FII:
      * yfinance(ticker.SA): preço, volume médio 21d, dividendos 12m.
      * CVM inf_mensal_complemento: PL, VP/cota -> P/VP = price / vp_cota.
      * CVM inf_mensal_geral: Segmento_Atuacao.
  - DY 12m = soma de dividendos 12m / preço atual * 100.
  - Quando o mapping CNPJ falha, P/VP, PL e segmento ficam null
    (UI mostra "—"; aceita Onda 1 graceful degrade).
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
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd
import requests
import yfinance as yf

sys.path.append(str(Path(__file__).parent))
from shared.blob_upload import maybe_upload_json  # noqa: E402


UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0", "Accept": "*/*"}
B3_IFIX_URL = (
    "https://sistemaswebb3-listados.b3.com.br/indexProxy/indexCall/GetPortfolioDay/"
    + base64.b64encode(b'{"index":"IFIX","language":"pt-br"}').decode()
)
CVM_INF_MENSAL_URL = (
    "https://dados.cvm.gov.br/dados/FII/DOC/INF_MENSAL/DADOS/inf_mensal_fii_{ano}.zip"
)


# ---------------------------------------------------------------------------
# Mapeamento de segmentos CVM -> rótulos editoriais consistentes
# (CVM publica: Multicategoria, Outros, Logística, Residencial, Shoppings,
#  Escritórios, Hospital, Varejo, Hotel, Educacional, Lajes Corporativas)
# ---------------------------------------------------------------------------
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


# ---------------------------------------------------------------------------
# B3 — Composição do IFIX
# ---------------------------------------------------------------------------

def fetch_ifix_composition() -> List[Dict]:
    """Retorna lista de dicts {ticker, asset_name, weight_pct}."""
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
        items.append({
            "ticker": cod,
            "asset_name": (row.get("asset") or "").strip(),
            "weight_pct": weight,
        })
    return items


# ---------------------------------------------------------------------------
# CVM — Informe Mensal FII
# ---------------------------------------------------------------------------

def fetch_cvm_inf_mensal(year: int) -> Dict[str, pd.DataFrame]:
    """Baixa o ZIP do informe mensal FII de um ano e devolve dataframes {geral, complemento}."""
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
                # CVM publica em latin1 com separador ;
                out[key] = pd.read_csv(fh, sep=";", encoding="latin1", dtype=str, low_memory=False)
    return out


def latest_per_cnpj(df: pd.DataFrame, date_col: str = "Data_Referencia") -> pd.DataFrame:
    """Mantém apenas o registro mais recente por CNPJ_Fundo_Classe."""
    if df is None or df.empty:
        return df
    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
    df = df.dropna(subset=[date_col, "CNPJ_Fundo_Classe"])
    df = df.sort_values(date_col).drop_duplicates("CNPJ_Fundo_Classe", keep="last")
    return df


def _s(v) -> str:
    """Safe-str: cobre NaN/None/floats/etc."""
    if v is None:
        return ""
    if isinstance(v, float) and pd.isna(v):
        return ""
    return str(v).strip()


def build_isin_to_cnpj(geral_last: pd.DataFrame) -> Dict[str, str]:
    """Mapeia 4-letras do ISIN (BR<XXXX>CTF<N>) -> CNPJ."""
    out: Dict[str, str] = {}
    for _, row in geral_last.iterrows():
        isin = _s(row.get("Codigo_ISIN"))
        cnpj = _s(row.get("CNPJ_Fundo_Classe"))
        m = re.match(r"BR(\w{4})CTF", isin)
        if m and cnpj:
            root = m.group(1)
            # Se houver conflito (raro), preserva o primeiro
            if root not in out:
                out[root] = cnpj
    return out


# ---------------------------------------------------------------------------
# yfinance — preço, volume, dividendos
# ---------------------------------------------------------------------------

def fetch_yf_metrics(ticker: str) -> Dict[str, Optional[float]]:
    """Retorna preço atual, data, volume médio 21d e DY 12m via yfinance.

    Retorna dict com possíveis Nones (graceful) — pra qualquer falha de rede ou ausência.
    """
    yf_ticker = f"{ticker}.SA"
    out: Dict[str, Optional[float]] = {
        "price": None,
        "price_date": None,
        "liquidity_avg_21d": None,
        "div_sum_12m": None,
    }
    try:
        tk = yf.Ticker(yf_ticker)
        hist = tk.history(period="3mo", auto_adjust=False)
        if hist is not None and not hist.empty:
            last_close = float(hist["Close"].iloc[-1])
            last_date = hist.index[-1].strftime("%Y-%m-%d")
            out["price"] = last_close
            out["price_date"] = last_date
            # Volume médio 21d em BRL (preço * volume cotas)
            vol = pd.to_numeric(hist["Volume"], errors="coerce").dropna()
            px = pd.to_numeric(hist["Close"], errors="coerce").dropna()
            if len(vol) >= 5:
                last_n = min(21, len(vol))
                v = (vol.tail(last_n) * px.tail(last_n)).mean()
                out["liquidity_avg_21d"] = float(v) if pd.notna(v) else None
        # Dividendos 12m
        try:
            divs = tk.dividends
            if divs is not None and not divs.empty:
                cutoff = pd.Timestamp.now(tz=divs.index.tz) - pd.Timedelta(days=365)
                d12 = divs.loc[divs.index >= cutoff]
                out["div_sum_12m"] = float(d12.sum()) if not d12.empty else 0.0
        except Exception:
            pass
    except Exception as e:
        print(f"[yf] FAIL {yf_ticker}: {e}", file=sys.stderr)
    return out


# ---------------------------------------------------------------------------
# Build payload
# ---------------------------------------------------------------------------

def build_payload() -> Dict:
    print("[fii_screener] Fetch IFIX composição (B3)...")
    universo = fetch_ifix_composition()
    print(f"[fii_screener] IFIX universe: {len(universo)} FIIs")

    print("[fii_screener] Fetch CVM inf_mensal (ano atual)...")
    today = date.today()
    cvm = fetch_cvm_inf_mensal(today.year)
    if "geral" not in cvm or "complemento" not in cvm:
        print("[fii_screener] CVM ano atual vazio — tentando ano anterior", file=sys.stderr)
        cvm = fetch_cvm_inf_mensal(today.year - 1)

    geral_last = latest_per_cnpj(cvm.get("geral", pd.DataFrame()))
    comp_last = latest_per_cnpj(cvm.get("complemento", pd.DataFrame()))
    print(f"[fii_screener] CVM geral_last: {len(geral_last)} | complemento_last: {len(comp_last)}")

    # Index por CNPJ
    geral_by_cnpj = geral_last.set_index("CNPJ_Fundo_Classe").to_dict("index")
    comp_by_cnpj = comp_last.set_index("CNPJ_Fundo_Classe").to_dict("index")

    # Map ISIN(4-letras) -> CNPJ
    isin_to_cnpj = build_isin_to_cnpj(geral_last)
    print(f"[fii_screener] Mapping ticker_root->CNPJ via ISIN: {len(isin_to_cnpj)}")

    rows: List[Dict] = []
    matched_cnpj = 0
    for item in universo:
        ticker = item["ticker"]  # ex: HGLG11
        root = ticker[:4] if len(ticker) >= 4 else None
        cnpj = isin_to_cnpj.get(root) if root else None

        # CVM data
        segment = None
        pl = None
        pl_ref_date = None
        pvp = None
        pvp_ref_date = None
        name_cvm = None
        if cnpj:
            matched_cnpj += 1
            g = geral_by_cnpj.get(cnpj, {})
            c = comp_by_cnpj.get(cnpj, {})
            seg_raw = _s(g.get("Segmento_Atuacao"))
            segment = SEGMENT_LABEL_MAP.get(seg_raw, seg_raw or None)
            name_cvm = _s(g.get("Nome_Fundo_Classe")) or None
            try:
                pl_raw = _s(c.get("Patrimonio_Liquido"))
                pl = float(pl_raw) if pl_raw else None
                if pl is None or pd.isna(pl) or pl == 0:
                    pl = None
                else:
                    dt = c.get("Data_Referencia")
                    pl_ref_date = dt.strftime("%Y-%m-%d") if hasattr(dt, "strftime") else (str(dt)[:10] if dt else None)
            except Exception:
                pl = None
            try:
                vp_raw = _s(c.get("Valor_Patrimonial_Cotas"))
                vp = float(vp_raw) if vp_raw else None
                if vp and not pd.isna(vp) and vp > 0:
                    pvp = vp  # guarda VP, divide por price depois
                    pvp_ref_date = pl_ref_date
            except Exception:
                pvp = None

        # yfinance — preço, volume, dividendos
        yf_data = fetch_yf_metrics(ticker)
        price = yf_data["price"]
        price_date = yf_data["price_date"]
        liq = yf_data["liquidity_avg_21d"]
        div12m = yf_data["div_sum_12m"]

        # DY 12m
        dy_12m_pct = None
        if price and price > 0 and div12m is not None:
            dy_12m_pct = round(div12m / price * 100.0, 2)

        # P/VP final — sanity filter pra cobrir inconsistências de escala da CVM
        # (alguns fundos reportam VP/cota em lotes, gerando outliers <0.1 ou >5).
        pvp_final = None
        if pvp and price and price > 0:
            candidate = price / pvp
            if 0.3 <= candidate <= 3.0:
                pvp_final = round(candidate, 3)
            else:
                pvp_ref_date = None  # rejeita também a data de ref pra não confundir

        # Nome curto: usar ticker como fallback do asset name B3
        name = item["asset_name"] or name_cvm or ticker

        rows.append({
            "ticker": ticker,
            "cnpj": cnpj,
            "name": name,
            "segment": segment or "Outros",
            "price": round(price, 2) if price else None,
            "price_date": price_date,
            "dy_12m_pct": dy_12m_pct,
            "pvp": pvp_final,
            "pvp_ref_date": pvp_ref_date,
            "pl": round(pl, 2) if pl else None,
            "pl_ref_date": pl_ref_date,
            "liquidity_avg_21d": round(liq, 2) if liq else None,
            "ifix_weight_pct": round(item["weight_pct"], 4),
            "in_ifix": True,
        })

    # Segmentos únicos ordenados (sem nulls, com "Outros" no fim)
    segments = sorted({r["segment"] for r in rows if r["segment"] and r["segment"] != "Outros"})
    if any(r["segment"] == "Outros" for r in rows):
        segments.append("Outros")

    print(f"[fii_screener] Total rows={len(rows)}, matched CNPJ={matched_cnpj}/{len(rows)}")

    return {
        "status": "ok",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_in_ifix": len(rows),
        "total_rows": len(rows),
        "rows": rows,
        "segments": segments,
        "_meta": {
            "matched_cnpj": matched_cnpj,
            "universe_source": "B3 indexProxy GetPortfolioDay (IFIX)",
            "cvm_year": today.year,
        },
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default="data-pipeline/out")
    ap.add_argument("--upload", action="store_true")
    args = ap.parse_args()

    payload = build_payload()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "fii_screener.json"
    out_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(f"[fii_screener] Escreveu {out_path} ({out_path.stat().st_size:,} bytes)")

    if payload.get("status") == "error":
        return 1
    if args.upload:
        maybe_upload_json(out_path, "data/fii_screener.json")
    else:
        print("[fii_screener] --upload NÃO setado; apenas salvou local.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
