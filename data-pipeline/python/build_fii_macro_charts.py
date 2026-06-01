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
# Buffer de histórico extra (anos antes do start visualizado) pra garantir que o
# rolling 365D de dividendos esteja COMPLETO já no primeiro ponto da janela.
# Sem isso, os primeiros 12 meses ficam com soma parcial → DY artificialmente baixo.
HISTORY_BUFFER_YEARS = 2
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
        # Rendimento mensal CVM (rendimento_distribuido / PL anterior, em decimal —
        # 0.007 = 0.7% no mês). Histórico completo, fonte oficial. yfinance.dividends
        # tem buraco histórico em FIIs (HGLG só retorna 2017 + 2022+ pulando 2018-2021).
        "dy_pct_mes": pd.to_numeric(all_df.get("Percentual_Dividend_Yield_Mes"), errors="coerce"),
        # Amortização separada — não inflar DY com devolução de capital.
        "amort_pct_mes": pd.to_numeric(all_df.get("Percentual_Amortizacao_Cotas_Mes"), errors="coerce"),
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
    # Baixa LOOKBACK + BUFFER anos pra ter rolling 365D completo desde o início da janela visível.
    history_period = f"{LOOKBACK_YEARS + HISTORY_BUFFER_YEARS}y"
    for i, t in enumerate(tickers):
        yf_t = f"{t}.SA"
        if i % 20 == 0:
            print(f"[yf] {i}/{len(tickers)} batch — {t}... (period={history_period})")
        try:
            tk = yf.Ticker(yf_t)
            h = tk.history(period=history_period, auto_adjust=False)
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

    # 3) CVM (Informe Mensal: 2 anos antes do start visualizado pra ter buffer
    #    de 12m no rolling DY anualizado desde o primeiro ponto da janela.)
    years = list(range(today.year - LOOKBACK_YEARS - 2, today.year + 1))
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
    # GRÁFICO 2 — Prêmio NTN-B vs DY tijolo
    # ----------------------------
    # IMPORTANTE: yfinance.dividends tem BURACO HISTÓRICO em FIIs brasileiros
    # (HGLG só retorna 2017 + 2022+ pulando 2018-2021). Trocamos pra CVM
    # `Percentual_Dividend_Yield_Mes` que é fonte oficial e tem histórico completo.
    # Como CVM publica mensal, a série de prêmio também vira mensal (preço fim-de-mês
    # do yfinance + DY 12m CVM agregado). Pro yield NTN-B usamos média mensal do
    # diário pra manter a consistência.
    print("[macro] Calculando prêmio NTN-B vs DY tijolo (mensal, CVM-based)...")

    # Forward-fill NTN-B em todos dias úteis (TD pode pular alguns dias)
    ntnb_full = ntnb_series.set_index("date").sort_index().reindex(
        pd.date_range(start, today, freq="B")
    ).ffill()

    # Constrói: cnpj -> Series mensal de dy_pct_mes (decimal, ex 0.007 = 0.7% no mês)
    cvm_by_cnpj_month_dy = cvm.set_index(["cnpj", "month_end"])["dy_pct_mes"].to_dict()

    # Pra cada ticker tijolo, monta serie mensal de DY 12m (sum últimos 12 meses)
    # Pulando meses com amortização > 0 (não é renda recorrente).
    cvm_by_cnpj_month_amort = cvm.set_index(["cnpj", "month_end"])["amort_pct_mes"].to_dict()

    # Universo de meses (igual ao P/VP).
    # Pula o mês corrente: ele praticamente nunca tem CVM publicado (prazo
    # de envio é dia 25 do mês seguinte), então o último ponto sempre seria
    # subestimado.
    current_month_end = (pd.Timestamp.today() + pd.offsets.MonthEnd(0)).normalize()
    premio_months = [m for m in months if m < current_month_end]

    premio_history: List[Dict] = []
    for m in premio_months:
        if m not in ntnb_full.index or pd.isna(ntnb_full.loc[m, "ntnb_yield"]):
            # Pega o NTN-B do último dia útil do mês via ffill (se m não é dia útil)
            wn = ntnb_full.loc[:m]
            if wn.empty or pd.isna(wn.iloc[-1]["ntnb_yield"]):
                continue
            ntnb_yld = float(wn.iloc[-1]["ntnb_yield"])
            venc = wn.iloc[-1]["ntnb_venc_year"]
        else:
            ntnb_yld = float(ntnb_full.loc[m, "ntnb_yield"])
            venc = ntnb_full.loc[m, "ntnb_venc_year"]

        # Top 25 tijolo do mês m por liquidez
        cat_liq: List[Tuple[str, float]] = []
        for t in universo:
            if ticker_segment.get(t) not in TIJOLO_SEGS:
                continue
            liq_s = liquidity_monthly.get(t)
            if liq_s is None or m not in liq_s.index:
                continue
            liq_val = liq_s.loc[m]
            if pd.notna(liq_val) and liq_val > 0:
                cat_liq.append((t, float(liq_val)))
        ranked = sorted(cat_liq, key=lambda x: -x[1])[:TOP_N]

        # DY 12m por ticker: soma dos últimos 12 meses de Percentual_Dividend_Yield_Mes (CVM).
        # Resultado em decimal — multiplica por 100 pra %.
        # Convertendo p/ anualizado simples: sum_12m_decimal * 100 = aprox. DY 12m em %.
        # (Composição ((1+r1)(1+r2)...) - 1 daria valor ~0.3% maior nesse range; aceita.)
        dys = []
        for t, _ in ranked:
            cnpj = ticker_to_cnpj.get(t)
            if not cnpj:
                continue
            # Últimos 12 meses incluindo m
            mes_atual = m
            soma = 0.0
            valid_meses = 0
            for k in range(12):
                mes_k = (mes_atual - pd.DateOffset(months=k)) + pd.offsets.MonthEnd(0)
                dy_k = cvm_by_cnpj_month_dy.get((cnpj, mes_k))
                amort_k = cvm_by_cnpj_month_amort.get((cnpj, mes_k))
                if dy_k is not None and not pd.isna(dy_k):
                    # Inclui só rendimento puro (sem amortização)
                    if amort_k is not None and not pd.isna(amort_k) and amort_k > 0:
                        # Mês com amortização — usa só a parte de rendimento puro
                        soma += float(dy_k)  # CVM já separa DY de Amortização — DY é puro rendimento
                    else:
                        soma += float(dy_k)
                    valid_meses += 1
            if valid_meses >= 10:  # exige pelo menos 10 dos 12 meses
                # Anualiza pela proporção de meses válidos. CVM tem lag de ~25d
                # de publicação, então o ÚLTIMO mês de cada FII tipicamente está
                # ausente — sem anualizar, a soma fica subestimada em 1/12 = 8%
                # e o DY aparenta "cair" artificialmente nos últimos pontos.
                dy_anual_pct = soma * 100.0 * (12.0 / valid_meses)
                if 0 < dy_anual_pct < 30:
                    dys.append(dy_anual_pct)

        if len(dys) < 10:
            continue
        dy_med = float(np.median(dys))
        premio_history.append({
            "date": m.strftime("%Y-%m-%d"),
            "dy_tijolo_pct": round(dy_med, 2),
            "ntnb_yield_pct": round(ntnb_yld, 2),
            "premio_pp": round(dy_med - ntnb_yld, 2),
            "ntnb_venc": int(venc) if pd.notna(venc) else None,
            "n_tijolo": len(dys),
        })

    print(f"[macro] Prêmio história: {len(premio_history)} pts (mensal)")

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
