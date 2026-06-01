"""Build dos 2 gráficos macro abaixo do hero IFIX (Panorama FIIs).

Output: data/fii_macro_charts.json

Gráfico 1 — P/VP histórico mensal (mediana + banda P25/P75):
  - Universo dinâmico: top 25 FIIs mais líquidos de cada categoria (tijolo / papel)
    em cada mês de referência (liquidez = média móvel 21d de price × volume).
  - "Tijolo" = segmentos {Logística, Lajes, Shoppings, Renda urbana, Residencial,
    Hospitalar, Hotelaria, Educacional, Agro}.
  - "Papel" = segmento "Papel".
  - P/VP por FII no mês = preço fim-de-mês (yfinance) / VP por cota (CVM Informe
    Mensal). Sanity filter [0.3, 3.0].

Gráfico 2 — Prêmio NTN-B vs DY tijolo (diário):
  - DY anualizado mediana top 25 tijolo (dividendos 12m / preço) — frequência diária.
  - Yield real NTN-B mais longa disponível em cada dia — backfill via Tesouro Direto
    CSV histórico (Tesouro Transparente).
  - Prêmio (pp) = DY_tijolo - NTNB_yield.

Fontes:
  - CVM Informe Mensal FII (inf_mensal_fii_{ano}.zip) — VP/cota, Segmento, ISIN.
  - yfinance — preço, volume, dividendos histórico 5y.
  - B3 GetPortfolioDay — universo IFIX (107 FIIs).
  - Tesouro Direto CSV — yield NTN-B histórico daily.
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import re
import sys
import zipfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
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
TD_CSV_URL = (
    "https://www.tesourotransparente.gov.br/ckan/dataset/"
    "df56aa42-484a-4a59-8184-7676580c81e3/resource/"
    "796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv"
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

TIJOLO_SEGS = {
    "Logística", "Lajes", "Shoppings", "Renda urbana", "Residencial",
    "Hospitalar", "Hotelaria", "Educacional", "Agro", "Varejo",
}
PAPEL_SEGS = {"Papel"}

LOOKBACK_YEARS = 5
TOP_N = 25


def _s(v) -> str:
    if v is None:
        return ""
    if isinstance(v, float) and pd.isna(v):
        return ""
    return str(v).strip()


# ---------------------------------------------------------------------------
# B3 — Composição do IFIX
# ---------------------------------------------------------------------------

def fetch_ifix_universe() -> List[str]:
    r = requests.get(B3_IFIX_URL, headers=UA, timeout=30)
    r.raise_for_status()
    data = r.json()
    return [(row.get("cod") or "").strip() for row in data.get("results", []) if row.get("cod")]


# ---------------------------------------------------------------------------
# CVM — Informe Mensal FII (multi-ano)
# ---------------------------------------------------------------------------

def fetch_cvm_inf_mensal_year(year: int) -> Optional[pd.DataFrame]:
    """Baixa um ano e retorna df agrupado por (CNPJ, Data_Referencia) com VP, segmento, ISIN."""
    url = CVM_INF_MENSAL_URL.format(ano=year)
    try:
        r = requests.get(url, headers=UA, timeout=60)
        if r.status_code != 200:
            return None
        geral = None
        comp = None
        with zipfile.ZipFile(io.BytesIO(r.content)) as zf:
            for name in zf.namelist():
                lower = name.lower()
                if "geral" in lower:
                    with zf.open(name) as fh:
                        geral = pd.read_csv(fh, sep=";", encoding="latin1", dtype=str, low_memory=False)
                elif "complemento" in lower:
                    with zf.open(name) as fh:
                        comp = pd.read_csv(fh, sep=";", encoding="latin1", dtype=str, low_memory=False)
        if geral is None or comp is None:
            return None
        # Merge
        merged = comp.merge(
            geral[["CNPJ_Fundo_Classe", "Data_Referencia", "Codigo_ISIN", "Segmento_Atuacao", "Nome_Fundo_Classe"]],
            on=["CNPJ_Fundo_Classe", "Data_Referencia"],
            how="left",
        )
        merged["year"] = year
        return merged
    except Exception as e:
        print(f"[cvm] FAIL year={year}: {e}", file=sys.stderr)
        return None


def build_cvm_history(years: List[int]) -> pd.DataFrame:
    """Concatena Informe Mensal de vários anos. Resultado: 1 linha por (CNPJ, mes).
    Colunas: cnpj, data_ref, vp_per_cota, pl, isin_root (4 letras), segment."""
    dfs = []
    for y in years:
        print(f"[cvm] baixando ano {y}...")
        df = fetch_cvm_inf_mensal_year(y)
        if df is not None:
            print(f"[cvm]   rows={len(df)}")
            dfs.append(df)
    if not dfs:
        return pd.DataFrame()
    all_df = pd.concat(dfs, ignore_index=True)
    # Latest version per (cnpj, data_ref)
    all_df["Data_Referencia"] = pd.to_datetime(all_df["Data_Referencia"], errors="coerce")
    all_df = all_df.dropna(subset=["Data_Referencia", "CNPJ_Fundo_Classe"])
    all_df["Versao"] = pd.to_numeric(all_df.get("Versao", "1"), errors="coerce").fillna(1)
    all_df = all_df.sort_values(["CNPJ_Fundo_Classe", "Data_Referencia", "Versao"])
    all_df = all_df.drop_duplicates(["CNPJ_Fundo_Classe", "Data_Referencia"], keep="last")

    out = pd.DataFrame({
        "cnpj": all_df["CNPJ_Fundo_Classe"],
        "data_ref": all_df["Data_Referencia"],
        "vp_per_cota": pd.to_numeric(all_df.get("Valor_Patrimonial_Cotas"), errors="coerce"),
        "pl": pd.to_numeric(all_df.get("Patrimonio_Liquido"), errors="coerce"),
        "isin": all_df.get("Codigo_ISIN", "").astype(str),
        "segment_cvm": all_df.get("Segmento_Atuacao", "").astype(str),
    })
    # ISIN root (4 letras pra mapeamento ticker)
    out["isin_root"] = out["isin"].str.extract(r"BR(\w{4})CTF", expand=False)
    return out


# ---------------------------------------------------------------------------
# yfinance — preço, volume, dividendos 5y por ticker (batch)
# ---------------------------------------------------------------------------

def fetch_yf_history_batch(tickers: List[str]) -> Tuple[Dict[str, pd.DataFrame], Dict[str, pd.Series]]:
    """Baixa price+volume diário 5y pra cada ticker + dividendos.

    Retorna:
      hist[ticker] = DataFrame com Close, Volume (index datetime).
      divs[ticker] = Series (index datetime, values dividendo R$).
    """
    hist: Dict[str, pd.DataFrame] = {}
    divs: Dict[str, pd.Series] = {}
    for i, t in enumerate(tickers):
        yf_t = f"{t}.SA"
        if i % 20 == 0:
            print(f"[yf] {i}/{len(tickers)} batch — {t}...")
        try:
            tk = yf.Ticker(yf_t)
            h = tk.history(period=f"{LOOKBACK_YEARS}y", auto_adjust=False)
            if h is None or h.empty:
                continue
            h = h[["Close", "Volume"]].copy()
            h.index = pd.to_datetime(h.index).tz_localize(None).normalize()
            h["Close"] = pd.to_numeric(h["Close"], errors="coerce")
            h["Volume"] = pd.to_numeric(h["Volume"], errors="coerce")
            h = h.dropna(subset=["Close"])
            hist[t] = h

            d = tk.dividends
            if d is not None and not d.empty:
                d.index = pd.to_datetime(d.index).tz_localize(None).normalize()
                divs[t] = pd.to_numeric(d, errors="coerce").dropna()
        except Exception as e:
            print(f"[yf] FAIL {yf_t}: {e}", file=sys.stderr)
    return hist, divs


# ---------------------------------------------------------------------------
# Tesouro Direto — NTN-B histórico
# ---------------------------------------------------------------------------

def fetch_td_ntnb_principal() -> pd.DataFrame:
    """Baixa Tesouro Transparente CSV e extrai 'Tesouro IPCA+' (NTN-B Principal, zero cupom).
    Retorna df com colunas: date, vencimento, yield (Taxa Compra Manha em %)."""
    print("[td] baixando Tesouro Transparente CSV (~14 MB)...")
    r = requests.get(TD_CSV_URL, headers=UA, timeout=120)
    r.raise_for_status()
    df = pd.read_csv(io.BytesIO(r.content), sep=";", encoding="latin1", dtype=str, low_memory=False)
    df = df[df["Tipo Titulo"] == "Tesouro IPCA+"].copy()
    df["date"] = pd.to_datetime(df["Data Base"], format="%d/%m/%Y", errors="coerce")
    df["vencimento"] = pd.to_datetime(df["Data Vencimento"], format="%d/%m/%Y", errors="coerce")
    df["yield"] = pd.to_numeric(df["Taxa Compra Manha"].str.replace(",", "."), errors="coerce")
    df = df.dropna(subset=["date", "vencimento", "yield"])
    return df[["date", "vencimento", "yield"]].copy()


def build_ntnb_longest_series(td_df: pd.DataFrame, start: pd.Timestamp) -> pd.DataFrame:
    """Pra cada dia, seleciona o NTN-B Principal com vencimento mais longo e retorna seu yield.
    Retorna df com date, ntnb_yield (%), ntnb_venc (yyyy)."""
    td_df = td_df.loc[td_df["date"] >= start].copy()
    # Por dia, escolher o vencimento máximo (mais longo)
    td_df = td_df.sort_values(["date", "vencimento"]).drop_duplicates("date", keep="last")
    return pd.DataFrame({
        "date": td_df["date"].values,
        "ntnb_yield": td_df["yield"].values,
        "ntnb_venc_year": td_df["vencimento"].dt.year.values,
    }).sort_values("date").reset_index(drop=True)


# ---------------------------------------------------------------------------
# Pipeline principal
# ---------------------------------------------------------------------------

def build_payload() -> Dict:
    today = pd.Timestamp.today().normalize()
    start = today - pd.Timedelta(days=int(LOOKBACK_YEARS * 365.25))

    # 1) Universo IFIX
    print("[macro] Fetch universo IFIX (B3)...")
    universo = fetch_ifix_universe()
    print(f"[macro] {len(universo)} tickers no IFIX")

    # 2) yfinance hist + dividendos
    print(f"[macro] Baixando histórico yfinance 5y pros {len(universo)} tickers...")
    hist, divs = fetch_yf_history_batch(universo)
    print(f"[macro]   {len(hist)} tickers com hist, {len(divs)} com dividendos")

    # 3) CVM (Informe Mensal de 2020 até ano corrente)
    years = list(range(today.year - LOOKBACK_YEARS - 1, today.year + 1))
    print(f"[macro] Anos CVM a baixar: {years}")
    cvm = build_cvm_history(years)
    print(f"[macro] CVM history rows: {len(cvm)}")

    # ISIN root -> CNPJ (latest)
    cvm_sorted = cvm.sort_values(["isin_root", "data_ref"])
    isin_to_cnpj: Dict[str, str] = {}
    for root, grp in cvm_sorted.groupby("isin_root"):
        if pd.notna(root) and root:
            # Primeiro CNPJ que apareceu com esse ISIN root
            isin_to_cnpj[root] = grp["cnpj"].iloc[0]

    # Map ticker -> cnpj
    ticker_to_cnpj: Dict[str, str] = {}
    for t in universo:
        root = t[:4]
        if root in isin_to_cnpj:
            ticker_to_cnpj[t] = isin_to_cnpj[root]

    print(f"[macro] Ticker->CNPJ map: {len(ticker_to_cnpj)} de {len(universo)}")

    # Index CVM por (cnpj, month_end)
    cvm["month_end"] = (cvm["data_ref"] + pd.offsets.MonthEnd(0)).dt.normalize()
    cvm_by_cnpj_month = cvm.set_index(["cnpj", "month_end"])[["vp_per_cota", "pl", "segment_cvm"]].to_dict("index")

    # Segmento final por ticker (override + CVM latest)
    def get_segment(ticker: str, cnpj: Optional[str]) -> str:
        cvm_seg = "Outros"
        if cnpj:
            # Pega o segmento CVM mais recente
            mask = cvm["cnpj"] == cnpj
            sub = cvm[mask]
            if not sub.empty:
                raw = _s(sub.iloc[-1]["segment_cvm"])
                cvm_seg = SEGMENT_LABEL_MAP.get(raw, raw or "Outros")
        return override_segment(ticker, cvm_seg)

    ticker_segment = {t: get_segment(t, ticker_to_cnpj.get(t)) for t in universo}
    print(f"[macro] Segmentos: tijolo={sum(1 for s in ticker_segment.values() if s in TIJOLO_SEGS)}, papel={sum(1 for s in ticker_segment.values() if s in PAPEL_SEGS)}")

    # 4) Tesouro Direto — NTN-B
    print("[macro] Baixando Tesouro Direto CSV...")
    td_df = fetch_td_ntnb_principal()
    ntnb_series = build_ntnb_longest_series(td_df, start)
    print(f"[macro] NTN-B history: {len(ntnb_series)} obs, range {ntnb_series['date'].min().date()} -> {ntnb_series['date'].max().date()}")

    # ----------------------------
    # GRÁFICO 1 — P/VP histórico mensal (top 25 dinâmico por categoria)
    # ----------------------------
    print("[macro] Calculando P/VP histórico mensal...")

    # Para cada ticker, calcular liquidez 21d daily (price × volume)
    # E pegar preço fim de mês.
    liquidity_monthly: Dict[str, pd.Series] = {}
    price_monthly: Dict[str, pd.Series] = {}
    for t, h in hist.items():
        liq21 = (h["Close"] * h["Volume"]).rolling(21).mean()
        # Resample para fim de mês
        liq_m = liq21.resample("ME").last()
        liquidity_monthly[t] = liq_m
        price_monthly[t] = h["Close"].resample("ME").last()

    # Construir lista de meses entre start e today
    months = pd.date_range(start=start.to_period("M").to_timestamp("M"),
                            end=today.to_period("M").to_timestamp("M"), freq="ME")

    def percentile(arr, q):
        arr = [a for a in arr if a is not None and not (isinstance(a, float) and pd.isna(a))]
        if not arr:
            return None
        return round(float(np.percentile(arr, q)), 4)

    pvp_history: Dict[str, List[Dict]] = {"tijolo": [], "papel": []}

    for m in months:
        # Coleta liquidez do mês pra cada ticker, separa por categoria
        cat_liq: Dict[str, List[Tuple[str, float]]] = {"tijolo": [], "papel": []}
        for t in universo:
            seg = ticker_segment.get(t, "Outros")
            if seg in TIJOLO_SEGS:
                cat = "tijolo"
            elif seg in PAPEL_SEGS:
                cat = "papel"
            else:
                continue
            liq_s = liquidity_monthly.get(t)
            if liq_s is None or m not in liq_s.index:
                continue
            liq_val = liq_s.loc[m]
            if pd.notna(liq_val) and liq_val > 0:
                cat_liq[cat].append((t, float(liq_val)))

        for cat in ("tijolo", "papel"):
            ranked = sorted(cat_liq[cat], key=lambda x: -x[1])[:TOP_N]
            pvps = []
            for t, _ in ranked:
                # Preço fim de mês
                px_s = price_monthly.get(t)
                if px_s is None or m not in px_s.index:
                    continue
                px = px_s.loc[m]
                if pd.isna(px) or px <= 0:
                    continue
                # VP por cota: lookup CVM (cnpj, month_end)
                cnpj = ticker_to_cnpj.get(t)
                if not cnpj:
                    continue
                vp_row = cvm_by_cnpj_month.get((cnpj, m))
                if not vp_row:
                    continue
                vp = vp_row.get("vp_per_cota")
                if vp is None or pd.isna(vp) or vp <= 0:
                    continue
                cand = float(px) / float(vp)
                if 0.3 <= cand <= 3.0:
                    pvps.append(cand)
            if pvps:
                pvp_history[cat].append({
                    "date": m.strftime("%Y-%m-%d"),
                    "n": len(pvps),
                    "median": round(float(np.median(pvps)), 4),
                    "p25": percentile(pvps, 25),
                    "p75": percentile(pvps, 75),
                })

    print(f"[macro] P/VP tijolo: {len(pvp_history['tijolo'])} pts, papel: {len(pvp_history['papel'])} pts")

    # ----------------------------
    # GRÁFICO 2 — Prêmio NTN-B vs DY tijolo (diário)
    # ----------------------------
    print("[macro] Calculando prêmio NTN-B vs DY tijolo (diário)...")

    # Pré-calcular DY 12m diário pra cada ticker tijolo
    # DY[t][d] = soma_dividendos[d-365 : d] / preço[d] * 100
    dy_daily: Dict[str, pd.Series] = {}
    for t in universo:
        if ticker_segment.get(t) not in TIJOLO_SEGS:
            continue
        h = hist.get(t)
        if h is None:
            continue
        d_series = divs.get(t)
        if d_series is None or d_series.empty:
            # Sem dividendos: DY=0
            dy = pd.Series(0.0, index=h.index, name=t)
        else:
            # Rolling sum 365 dias
            div_aligned = d_series.reindex(h.index, fill_value=0.0)
            sum365 = div_aligned.rolling("365D").sum()
            dy = (sum365 / h["Close"]) * 100.0
        dy.index = pd.to_datetime(dy.index)
        dy_daily[t] = dy

    # Liquidez diária pra cada ticker
    liq_daily: Dict[str, pd.Series] = {}
    for t in universo:
        if ticker_segment.get(t) not in TIJOLO_SEGS:
            continue
        h = hist.get(t)
        if h is None:
            continue
        liq_daily[t] = (h["Close"] * h["Volume"]).rolling(21).mean()

    # Pra cada dia útil do range, seleciona top 25 tijolo por liquidez 21d e tira mediana do DY
    all_dates = sorted({d for t, s in dy_daily.items() for d in s.index})
    all_dates = [d for d in all_dates if d >= start]

    # Restringir ao range do NTN-B (precisamos do yield real pra calcular o prêmio)
    ntnb_dict = dict(zip(ntnb_series["date"], ntnb_series["ntnb_yield"]))
    ntnb_venc_dict = dict(zip(ntnb_series["date"], ntnb_series["ntnb_venc_year"]))

    # Forward-fill o NTN-B (TD não publica em todo dia útil de mercado, ex sextas?)
    ntnb_full = ntnb_series.set_index("date").sort_index().reindex(
        pd.date_range(start, today, freq="B")
    ).ffill()

    premio_history: List[Dict] = []
    for d in all_dates:
        if d not in ntnb_full.index or pd.isna(ntnb_full.loc[d, "ntnb_yield"]):
            continue
        # Calcula ranking top-25 tijolo nesse dia (por liquidez 21d)
        ranking = []
        for t, ls in liq_daily.items():
            if d in ls.index:
                lv = ls.loc[d]
                if pd.notna(lv) and lv > 0:
                    ranking.append((t, float(lv)))
        ranking.sort(key=lambda x: -x[1])
        top = [t for t, _ in ranking[:TOP_N]]
        dys = []
        for t in top:
            dy_s = dy_daily[t]
            if d in dy_s.index:
                v = dy_s.loc[d]
                if pd.notna(v) and v > 0 and v < 30:  # filtro outlier DY > 30%
                    dys.append(float(v))
        # Exige mínimo de 15 FIIs com 12m de dividendos pra ponto ser confiável
        # (no início do período muitos FIIs ainda não tinham 12m de pagamentos).
        if len(dys) < 15:
            continue
        dy_med = float(np.median(dys))
        ntnb_yld = float(ntnb_full.loc[d, "ntnb_yield"])
        venc = ntnb_full.loc[d, "ntnb_venc_year"]
        premio_history.append({
            "date": d.strftime("%Y-%m-%d"),
            "dy_tijolo_pct": round(dy_med, 2),
            "ntnb_yield_pct": round(ntnb_yld, 2),
            "premio_pp": round(dy_med - ntnb_yld, 2),
            "ntnb_venc": int(venc) if pd.notna(venc) else None,
            "n_tijolo": len(dys),
        })

    print(f"[macro] Prêmio história: {len(premio_history)} pts")

    return {
        "status": "ok",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "lookback_years": LOOKBACK_YEARS,
        "top_n": TOP_N,
        "pvp_history": pvp_history,
        "premio_history": premio_history,
        "_meta": {
            "ifix_universe": len(universo),
            "yf_hist_loaded": len(hist),
            "ticker_to_cnpj": len(ticker_to_cnpj),
            "ntnb_obs": len(ntnb_series),
            "segments": {
                "tijolo": sum(1 for s in ticker_segment.values() if s in TIJOLO_SEGS),
                "papel": sum(1 for s in ticker_segment.values() if s in PAPEL_SEGS),
                "outros": sum(1 for s in ticker_segment.values() if s not in TIJOLO_SEGS and s not in PAPEL_SEGS),
            },
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
    out_path = out_dir / "fii_macro_charts.json"
    out_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(f"[macro] Escreveu {out_path} ({out_path.stat().st_size:,} bytes)")

    if args.upload:
        maybe_upload_json(out_path, "data/fii_macro_charts.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
