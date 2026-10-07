"""Build do JSON de Valuation do Ibovespa pro painel de Renda Variável.

Output:
  data/acoes_valuation.json      (consumido por src/lib/painel-acoes.ts)
  data/acoes_lpa_reportado.json  (base interna: LPA trimestral por data de anúncio, merge incremental)

Alimenta:
  1. Prêmio de risco: earnings yield (1/PL) e dividend yield do Ibovespa contra a NTN-B
     real ~10 anos (card "Prêmio de risco vs NTN-B", série DIÁRIA dos últimos 6 anos).
  2. P/L mensal desde 2010 (`pl_mensal`), que é o Y do modelo P/L × juros reais
     (build_ibov_pl_modelo.py → data/ibov_pl_modelo.json).

Metodologia (100% automática; revisada em out/2026):
  - Universo + pesos: B3 GetPortfolioDay {index: IBOV} (cesta ATUAL projetada para trás).
  - Lucro: LPA REPORTADO trimestral do calendário de resultados do Yahoo
    (yfinance get_earnings_dates), carimbado pela DATA DE ANÚNCIO — a DRE do yfinance
    (income statement) fica até um trimestre defasada e começava só em 2023.
    LPA 12m = soma dos 4 últimos trimestres anunciados (janela <= 460 dias); vale até
    200 dias depois do último anúncio (papel que parou de reportar sai do cálculo).
  - Correções MECÂNICAS do LPA (moeda/unidade), explícitas em LPA_AJUSTES e conferidas a
    cada giro contra o trailingEps do Yahoo (aviso em `lpa_suspeitos`):
      VALE3, EMBJ3 reportam em US$ -> convertidos pelo dólar (SGS 1) da data do anúncio;
      KLBN11 é unit de 5 ações -> LPA x5.
    Classe sem LPA usa o da classe irmã da mesma empresa (ex.: BBDC3 <- BBDC4).
  - Salto de preço fora de [x0,4; x1,9] num dia (evento societário mal ajustado na fonte):
    o histórico ANTERIOR daquele papel é descartado.
  - EY_i = LPA12m_i / preço_i. Índice por MÉDIA HARMÔNICA ponderada pelos pesos B3:
        EY_idx = Σ(w_i·EY_i)/Σw_i   ->   P/L_idx = 1 / EY_idx
    Fora do cálculo: prejuízo (LPA <= 0), sem dado e P/L fora de [PL_PISO, PL_TETO]
    (guarda contra erro de dado, não corte econômico). Exige cobertura >= 60% do peso.
    Pregão parcial (cobertura de preço 3 p.p. abaixo da mediana de 20 dias) é descartado.
  - DY idem com dividendos 12m (coluna Dividends do histórico do yfinance).
  - NTN-B real ~10a: interpolação linear por data sobre a curva IPCA
    (data/treasury_history.json, fonte ANBIMA).
  - Prêmio (pp): EY% − NTNB% e DY% − NTNB%.

NOTA editorial: EY/DY são nominais e a NTN-B é real; o prêmio nominal-vs-real é o
gauge usual de "quanto a bolsa paga acima do juro real" (caveat na UI).

Uso:
    python data-pipeline/python/build_acoes_valuation.py --out-dir data-pipeline/out --upload
    python data-pipeline/python/build_acoes_valuation.py --subset 6   # teste rápido
"""
from __future__ import annotations

import argparse
import base64
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import requests

sys.path.append(str(Path(__file__).parent))
from shared.blob_upload import maybe_upload_json  # noqa: E402
from shared.blob_download import download_json  # noqa: E402

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0", "Accept": "*/*"}
B3_IBOV_URL = (
    "https://sistemaswebb3-listados.b3.com.br/indexProxy/indexCall/GetPortfolioDay/"
    + base64.b64encode(b'{"language":"pt-br","pageNumber":1,"pageSize":200,"index":"IBOV","segment":"1"}').decode()
)
SCHEMA_VERSION = 2
LOOKBACK_YEARS = 6           # janela da série DIÁRIA publicada (card do prêmio)
HIST_START = "2009-06-01"    # preço + LPA desde aqui -> P/L mensal desde ~2010 (modelo)
MIN_COVERAGE = 0.60          # cobertura mínima de peso do índice por data
TARGET_NTNB_YEARS = 10.0     # horizonte da NTN-B real
PL_PISO, PL_TETO = 2.0, 100.0
LPA_VALIDADE_DIAS = 200      # LPA 12m vale até N dias depois do último anúncio
LPA_JANELA_MAX_DIAS = 460    # 4 trimestres somados cabem nesta janela (tolera 1 trimestre faltando, não 2)
SALTO_ALTA_MAX = 1.9         # preço x1,9 num dia = descontinuidade (Ultrapar 28/06/2021: x2,19)
SALTO_QUEDA_MIN = 0.4        # preço x0,4 num dia = descontinuidade (B3 09/05/2011: x0,34)
LPA_BLOB = "data/acoes_lpa_reportado.json"

# Correções mecânicas do LPA reportado (moeda/unidade). Conferidas a cada giro
# contra o trailingEps do Yahoo; divergência nova vira aviso, nunca auto-correção.
LPA_AJUSTES: Dict[str, Dict] = {
    "VALE3": {"moeda": "USD", "motivo": "Vale reporta em US$"},
    "EMBJ3": {"moeda": "USD", "motivo": "Embraer reporta em US$"},
    "KLBN11": {"fator": 5.0, "motivo": "unit = 1 ON + 4 PN; LPA vem por ação"},
}
# Divergências já conferidas em que o LPA reportado está CERTO e o trailingEps do Yahoo errado.
LPA_CONFERIDOS: Dict[str, str] = {
    "BPAC11": "trailingEps do Yahoo vem por ação; o LPA reportado já é por unit (P/L ~16x, out/2026)",
}


# ---------------------------------------------------------------------------
# B3 — universo + pesos do Ibovespa
# ---------------------------------------------------------------------------

def fetch_ibov_universe() -> List[Dict]:
    r = requests.get(B3_IBOV_URL, headers=UA, timeout=30)
    r.raise_for_status()
    data = r.json()
    out = []
    for row in data.get("results", []):
        cod = (row.get("cod") or "").strip()
        if not cod:
            continue
        try:
            w = float((row.get("part") or "0").replace(".", "").replace(",", "."))
        except ValueError:
            w = 0.0
        out.append({"ticker": cod, "name": (row.get("asset") or "").strip(), "weight": w})
    return out


# ---------------------------------------------------------------------------
# Dólar (SGS 1, venda) — conversão do LPA de quem reporta em US$
# ---------------------------------------------------------------------------

def dolar_diario(ini_ano: int = 2008) -> pd.Series:
    """SGS 1 em janelas de 5 anos (limite da API p/ série diária), com retry.
    Fallback: yfinance BRL=X."""
    out: Dict[pd.Timestamp, float] = {}
    fim_ano = datetime.now().year + 1
    for a in range(ini_ano, fim_ano, 5):
        b = min(a + 5, fim_ano)
        url = (f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados?formato=json"
               f"&dataInicial=01/01/{a}&dataFinal=31/12/{b - 1}")
        for tentativa in range(4):
            try:
                j = requests.get(url, headers=UA, timeout=60).json()
                if isinstance(j, list):
                    for x in j:
                        if isinstance(x, dict) and x.get("valor") not in (None, ""):
                            out[pd.to_datetime(x["data"], dayfirst=True)] = float(x["valor"])
                    break
            except Exception as e:  # noqa: BLE001
                print(f"[acoes_val] SGS 1 {a}-{b - 1} tentativa {tentativa + 1}: {repr(e)[:80]}", file=sys.stderr)
            time.sleep(3)
    s = pd.Series(out, dtype="float64").sort_index()
    if len(s) < 1000 or s.index.max() < pd.Timestamp.today() - pd.Timedelta(days=10):
        try:
            import yfinance as yf
            h = yf.Ticker("BRL=X").history(start=f"{ini_ano}-01-01", auto_adjust=False)["Close"].dropna()
            h.index = pd.DatetimeIndex(h.index).tz_localize(None).normalize()
            s = h.combine_first(s) if len(s) else h
            print(f"[acoes_val] dólar: SGS 1 incompleto -> completado com yfinance BRL=X ({len(s)} dias)")
        except Exception as e:  # noqa: BLE001
            print(f"[acoes_val] dólar: fallback BRL=X falhou: {repr(e)[:80]}", file=sys.stderr)
    return s


# ---------------------------------------------------------------------------
# yfinance — preço bruto, dividendos 12m e LPA reportado por papel
# ---------------------------------------------------------------------------

def fetch_security(ticker: str, start: pd.Timestamp) -> Optional[Dict]:
    """{'price','div_ttm','lpa'} — preço/dividendos diários e LPA trimestral cru por data de anúncio."""
    import yfinance as yf
    yt = f"{ticker}.SA"
    try:
        tk = yf.Ticker(yt)
        h = tk.history(start=start.strftime("%Y-%m-%d"), auto_adjust=False)
        if h is None or h.empty or "Close" not in h.columns:
            return None
        h.index = pd.DatetimeIndex(h.index).tz_localize(None).normalize()
        h = h[~h.index.duplicated(keep="last")].sort_index()
        price = pd.to_numeric(h["Close"], errors="coerce").dropna()
        if price.empty:
            return None
        # dividendos 12m pela coluna Dividends do próprio histórico (sem 2ª chamada)
        div_ttm = pd.Series(0.0, index=price.index)
        if "Dividends" in h.columns:
            d = pd.to_numeric(h["Dividends"], errors="coerce").fillna(0.0)
            d = d[d > 0]
            if not d.empty:
                cum = d.cumsum()
                cum_at = cum.reindex(cum.index.union(price.index)).ffill().reindex(price.index)
                back_idx = price.index - pd.Timedelta(days=365)
                back = cum.reindex(cum.index.union(back_idx)).ffill().reindex(back_idx)
                back.index = price.index
                div_ttm = (cum_at.fillna(0) - back.fillna(0)).clip(lower=0)
        lpa: Dict[str, float] = {}
        try:
            ed = tk.get_earnings_dates(limit=100)
            if ed is not None and len(ed) and "Reported EPS" in ed.columns:
                rep = ed[ed["Reported EPS"].notna()]
                for k, v in rep["Reported EPS"].items():
                    lpa[pd.Timestamp(k).strftime("%Y-%m-%d")] = float(v)  # data local do anúncio
        except Exception as e:  # noqa: BLE001
            print(f"[acoes_val] LPA {yt} falhou (usa a base salva): {repr(e)[:100]}", file=sys.stderr)
        return {"price": price, "div_ttm": div_ttm, "lpa": lpa}
    except Exception as e:  # noqa: BLE001
        print(f"[acoes_val] FAIL {yt}: {repr(e)[:120]}", file=sys.stderr)
        return None


def mesclar_lpa(salvo: Dict[str, float], novo: Dict[str, float]) -> Dict[str, float]:
    """Base incremental: o Yahoo só mostra uma janela de trimestres e pode falhar num giro.
    O novo prevalece; nó salvo a menos de 20 dias de um nó novo é o mesmo trimestre
    com data revisada e sai."""
    if not novo:
        return dict(salvo)
    novos = sorted(pd.Timestamp(d) for d in novo)
    out = dict(novo)
    for d, v in salvo.items():
        td = pd.Timestamp(d)
        if not any(abs((td - n).days) < 20 for n in novos):
            out[d] = v
    return dict(sorted(out.items()))


def lpa_12m_diario(lpa: Dict[str, float], ajuste: Optional[Dict], dolar: pd.Series,
                   index: pd.DatetimeIndex) -> pd.Series:
    """LPA 12m diário a partir dos nós trimestrais (data de anúncio), com correção de
    moeda/unidade, janela máxima de 4 trimestres e validade após o último anúncio."""
    if not lpa:
        return pd.Series(np.nan, index=index)
    q = pd.Series(lpa, dtype="float64")
    q.index = pd.to_datetime(q.index)
    q = q[~q.index.duplicated(keep="last")].sort_index()
    if ajuste and ajuste.get("moeda") == "USD":
        fx = dolar.reindex(dolar.index.union(q.index)).ffill().reindex(q.index)
        q = q * fx
    if ajuste and ajuste.get("fator"):
        q = q * float(ajuste["fator"])
    ttm = q.rolling(4).sum()
    span = pd.Series(q.index, index=q.index).diff(3).dt.days
    ttm = ttm.where(span <= LPA_JANELA_MAX_DIAS).dropna()
    if ttm.empty:
        return pd.Series(np.nan, index=index)
    al = ttm.reindex(ttm.index.union(index)).ffill().reindex(index)
    ult = pd.Series(ttm.index, index=ttm.index).reindex(ttm.index.union(index)).ffill().reindex(index)
    idade = (pd.Series(index, index=index) - ult).dt.days
    return al.where(idade <= LPA_VALIDADE_DIAS)


def corta_descontinuidade(price: pd.Series) -> Tuple[pd.Series, Optional[str]]:
    """Descarta o histórico ANTES do último salto diário de preço fora de [x0,4; x1,9]
    (evento societário mal ajustado no Yahoo). Quedas de pânico (mar/2020: −30%) ficam."""
    r = price / price.shift(1)
    saltos = r[(r > SALTO_ALTA_MAX) | (r < SALTO_QUEDA_MIN)]
    if saltos.empty:
        return price, None
    d = saltos.index[-1]
    return price[price.index >= d], d.strftime("%Y-%m-%d")


# ---------------------------------------------------------------------------
# NTN-B real ~10a (interp por data sobre a curva IPCA do treasury_history)
# ---------------------------------------------------------------------------

def ntnb_real_series(target_years: float = TARGET_NTNB_YEARS) -> pd.Series:
    th = download_json("data/treasury_history.json")
    if not th:
        return pd.Series(dtype="float64")
    ipca = (th.get("categories", {}) or {}).get("IPCA", {})
    series = ipca.get("series", {}) or {}
    # monta {date -> [(ytm_years, yield)]}
    by_date: Dict[pd.Timestamp, List[Tuple[float, float]]] = {}
    for venc, pts in series.items():
        try:
            mat = pd.Timestamp(venc)
        except Exception:
            continue
        for p in pts:
            try:
                d = pd.Timestamp(p[0]).normalize()
                y = float(p[1])
            except Exception:
                continue
            ytm = (mat - d).days / 365.25
            if ytm <= 0:
                continue
            by_date.setdefault(d, []).append((ytm, y))
    out = {}
    for d, pairs in by_date.items():
        pairs = sorted(pairs)
        xs = [p[0] for p in pairs]
        ys = [p[1] for p in pairs]
        if len(xs) < 2:
            continue
        # interp linear; fora do range usa o ponto mais próximo (np.interp já faz clamp)
        out[d] = float(np.interp(target_years, xs, ys))
    return pd.Series(out).sort_index()


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

def _r(v: Optional[float], n: int) -> Optional[float]:
    return None if v is None or not np.isfinite(v) else round(float(v), n)


def build_payload(subset: Optional[int] = None, sleep: float = 0.0) -> Tuple[Dict, Dict]:
    print("[acoes_val] universo IBOV (B3)...")
    universe = fetch_ibov_universe()
    print(f"[acoes_val] IBOV universe: {len(universe)} papéis, Σpeso={sum(u['weight'] for u in universe):.1f}")
    agora = datetime.now(timezone.utc).isoformat()
    if not universe:
        return {"status": "error", "generated_at": agora}, {}
    if subset:
        universe = sorted(universe, key=lambda u: -u["weight"])[:subset]
        print(f"[acoes_val] SUBSET={subset}: {[u['ticker'] for u in universe]}")

    start = pd.Timestamp(HIST_START)
    dolar = dolar_diario()
    print(f"[acoes_val] dólar: {len(dolar)} dias até {dolar.index.max().date() if len(dolar) else '—'}")

    base = download_json(LPA_BLOB) or {}
    lpa_base: Dict[str, Dict[str, float]] = dict(base.get("tickers", {}) or {})

    secs: Dict[str, Dict] = {}
    weights: Dict[str, float] = {}
    cortes: Dict[str, str] = {}
    lpa_novo_ok = 0
    for u in universe:
        t, w = u["ticker"], u["weight"]
        if w <= 0:
            continue
        sec = fetch_security(t, start)
        if sleep:
            time.sleep(sleep)
        if not sec:
            continue
        if sec["lpa"]:
            lpa_novo_ok += 1
        lpa_base[t] = mesclar_lpa(lpa_base.get(t, {}), sec["lpa"])
        price, corte = corta_descontinuidade(sec["price"])
        if corte:
            cortes[t] = corte
        secs[t] = {"price": price, "div_ttm": sec["div_ttm"].reindex(price.index)}
        weights[t] = w
    print(f"[acoes_val] papéis com preço: {len(secs)}/{len(universe)} | LPA novo do Yahoo: {lpa_novo_ok}")
    if cortes:
        print(f"[acoes_val] histórico cortado por descontinuidade de preço: {cortes}")
    if not secs:
        return {"status": "error", "generated_at": agora}, {}

    # classe irmã: papel sem LPA usa o da outra classe da mesma empresa (3/4/5/6, não units)
    irma_de: Dict[str, str] = {}
    for t in secs:
        if lpa_base.get(t):
            continue
        for v in secs:
            if v != t and v[:4] == t[:4] and lpa_base.get(v) and not t.endswith("11") and not v.endswith("11"):
                irma_de[t] = v
                break
    if irma_de:
        print(f"[acoes_val] LPA da classe irmã: {irma_de}")

    P = pd.DataFrame({t: s["price"] for t, s in secs.items()}).sort_index()
    P = P[P.index >= start]
    idx = P.index
    E = pd.DataFrame({t: lpa_12m_diario(lpa_base.get(irma_de.get(t, t), {}), LPA_AJUSTES.get(t), dolar, idx)
                      for t in P.columns})
    DV = pd.DataFrame({t: secs[t]["div_ttm"].reindex(idx) for t in P.columns})
    w = pd.Series(weights).reindex(P.columns)
    total_w = float(w.sum())

    # pregão parcial: cobertura de PREÇO bem abaixo da mediana recente
    cob_px = (P.notna() * w).sum(axis=1) / total_w
    parcial = cob_px < (cob_px.rolling(20, min_periods=5).median() - 0.03)
    if parcial.any():
        print(f"[acoes_val] pregões parciais descartados: {[d.strftime('%Y-%m-%d') for d in idx[parcial]][-5:]}")
    P, E, DV = P[~parcial], E[~parcial], DV[~parcial]
    idx = P.index

    PLi = P / E
    tem_px = P.notna()
    sem_dado = tem_px.eq(False) | E.isna()
    prejuizo = tem_px & (E <= 0)
    fora_faixa = tem_px & (E > 0) & ((PLi < PL_PISO) | (PLi > PL_TETO))
    valido = tem_px & (E > 0) & (PLi >= PL_PISO) & (PLi <= PL_TETO)

    wv = w.values
    def pond(mask: pd.DataFrame) -> pd.Series:
        return pd.Series((mask.values * wv).sum(axis=1) / total_w, index=idx)

    cov = pond(valido)
    ey = ((E / P).where(valido) * wv).sum(axis=1) / (valido * wv).sum(axis=1)
    ey_idx = ey.where(cov >= MIN_COVERAGE)
    pl_idx = (1.0 / ey_idx).where(ey_idx > 0)
    dvalido = tem_px & DV.notna()
    dy = ((DV / P).where(dvalido) * wv).sum(axis=1) / (dvalido * wv).sum(axis=1)
    dy_idx = dy.where(cov >= MIN_COVERAGE)
    ex_sem, ex_prej, ex_faixa = pond(sem_dado) * 100, pond(prejuizo) * 100, pond(fora_faixa) * 100

    # ---- conferência do LPA contra o trailingEps do Yahoo (só aviso) ----
    fund = download_json("data/market_fundamentals.json") or {}
    ftk = fund.get("tickers", {})
    suspeitos = []
    for t in P.columns:
        info = (ftk.get(f"{t}.SA") or {}).get("info", {}) or {}
        te = info.get("trailingEps")
        e_hoje = E[t].dropna()
        if te in (None, 0) or e_hoje.empty or e_hoje.iloc[-1] <= 0 or float(te) <= 0:
            continue
        razao = float(te) / float(e_hoje.iloc[-1])
        if (razao > 3.0 or razao < 1 / 3.0) and weights.get(t, 0) >= 0.5 and t not in LPA_CONFERIDOS:
            suspeitos.append({"ticker": t, "peso": round(weights[t], 2), "razao_trailing_sobre_calc": round(razao, 2)})
    if suspeitos:
        print(f"::warning::LPA possivelmente em outra moeda/unidade (conferir LPA_AJUSTES): {suspeitos}")

    ntnb = ntnb_real_series()

    # ---- série DIÁRIA publicada (últimos LOOKBACK_YEARS) ----
    corte_diario = pd.Timestamp.today().normalize() - pd.Timedelta(days=int(LOOKBACK_YEARS * 365.25))
    pl_ok = pl_idx.dropna()
    idx_d = pl_ok.index[pl_ok.index >= corte_diario]
    ntnb_al = ntnb.reindex(ntnb.index.union(idx_d)).ffill().reindex(idx_d) if len(ntnb) else pd.Series(np.nan, index=idx_d)
    series = []
    for d in idx_d:
        ey_pct = float(ey_idx.loc[d]) * 100.0
        dy_pct = float(dy_idx.loc[d]) * 100.0 if pd.notna(dy_idx.loc[d]) else None
        nb = float(ntnb_al.loc[d]) if pd.notna(ntnb_al.loc[d]) else None
        series.append({
            "date": d.strftime("%Y-%m-%d"),
            "pl": round(float(pl_idx.loc[d]), 2),
            "ey_pct": round(ey_pct, 3),
            "dy_pct": round(dy_pct, 3) if dy_pct is not None else None,
            "ntnb_pct": round(nb, 3) if nb is not None else None,
            "prem_ey_pp": round(ey_pct - nb, 3) if nb is not None else None,
            "prem_dy_pp": round(dy_pct - nb, 3) if (nb is not None and dy_pct is not None) else None,
        })

    # ---- P/L MENSAL desde o início (Y do modelo P/L × juros) ----
    dfm = pd.DataFrame({"pl": pl_idx, "excl_sem_dado": ex_sem, "excl_prejuizo": ex_prej,
                        "excl_teto": ex_faixa}).dropna(subset=["pl"])
    dfm["date"] = dfm.index.strftime("%Y-%m-%d")
    mens = dfm.groupby(dfm.index.to_period("M")).last()
    pl_mensal = [{
        "date": r["date"],
        "pl": round(float(r["pl"]), 3),
        "excl": round(float(r["excl_sem_dado"] + r["excl_prejuizo"] + r["excl_teto"]), 1),
        "excl_teto": round(float(r["excl_teto"]), 1),
        "excl_prejuizo": round(float(r["excl_prejuizo"]), 1),
        "excl_sem_dado": round(float(r["excl_sem_dado"]), 1),
    } for _, r in mens.iterrows()]

    pl_vals = pl_ok[pl_ok.index >= corte_diario]
    mean = float(pl_vals.mean()) if len(pl_vals) else float("nan")
    sd = float(pl_vals.std(ddof=0)) if len(pl_vals) else float("nan")
    cur = series[-1] if series else None
    pl_stats = {
        "mean": _r(mean, 2), "sd": _r(sd, 3),
        "minus2": _r(mean - 2 * sd, 2), "minus1": _r(mean - sd, 2),
        "plus1": _r(mean + sd, 2), "plus2": _r(mean + 2 * sd, 2),
        "current_z": round((cur["pl"] - mean) / sd, 2) if (cur and sd > 0) else None,
        "n_points": int(len(pl_vals)),
    }
    d_ult = pl_ok.index[-1] if len(pl_ok) else None
    ntnb_full = [[d.strftime("%Y-%m-%d"), round(float(v), 3)] for d, v in ntnb.dropna().items()]

    payload = {
        "schema_version": SCHEMA_VERSION,
        "status": "ok",
        "generated_at": agora,
        "last_data_date": d_ult.strftime("%Y-%m-%d") if d_ult is not None else None,
        "current": cur,
        "coverage_weight_pct": round(float(cov.loc[d_ult]) * 100.0, 1) if d_ult is not None else None,
        "excl_hoje": {
            "sem_dado": _r(ex_sem.loc[d_ult], 1), "prejuizo": _r(ex_prej.loc[d_ult], 1),
            "teto": _r(ex_faixa.loc[d_ult], 1),
        } if d_ult is not None else None,
        "n_constituents": int(len(secs)),
        "pl_stats": pl_stats,
        "series": series,
        "pl_mensal": pl_mensal,
        "ntnb_full": ntnb_full,
        "lpa_ajustes": {t: a["motivo"] for t, a in LPA_AJUSTES.items()},
        "lpa_irma": irma_de,
        "lpa_suspeitos": suspeitos,
        "cortes_descontinuidade": cortes,
        "sources": {
            "universe": "B3 GetPortfolioDay (IBOV) — cesta atual projetada para trás",
            "eps": "Yahoo, calendário de resultados (yfinance get_earnings_dates, Reported EPS) por data de anúncio",
            "dividends": "yfinance (coluna Dividends do histórico)",
            "price": "yfinance Close bruto (auto_adjust=False)",
            "fx": "BCB SGS 1 (dólar venda) para LPA reportado em US$",
            "ntnb": "treasury_history.json (ANBIMA), NTN-B real ~10a interpolada",
        },
        "method": ("P/L índice = 1 / Σ(w_i·EY_i)/Σw_i; EY_i = LPA reportado 12m / preço; pesos B3; "
                   f"fora: prejuízo, sem dado e P/L fora de [{PL_PISO:g}; {PL_TETO:g}]"),
        "_meta": {"lookback_years": LOOKBACK_YEARS, "hist_start": HIST_START, "min_coverage": MIN_COVERAGE,
                  "target_ntnb_years": TARGET_NTNB_YEARS, "pl_piso": PL_PISO, "pl_teto": PL_TETO,
                  "lpa_validade_dias": LPA_VALIDADE_DIAS, "series_points": len(series),
                  "meses": len(pl_mensal)},
    }
    lpa_payload = {"schema_version": 1, "generated_at": agora,
                   "fonte": "Yahoo calendário de resultados (Reported EPS), merge incremental",
                   "tickers": {t: v for t, v in sorted(lpa_base.items()) if v}}
    return payload, lpa_payload


def merge_series(new: Dict, existing: Optional[Dict]) -> Dict:
    """União append-only por data na série DIÁRIA (novo cálculo prevalece)."""
    if not existing or existing.get("status") != "ok":
        return new
    by_date = {p["date"]: p for p in existing.get("series", [])}
    for p in new.get("series", []):
        by_date[p["date"]] = p
    merged = sorted(by_date.values(), key=lambda p: p["date"])
    new["series"] = merged
    # Giro com dado ATRASADO da fonte não pode fazer o "hoje" andar para trás (07/10/2026:
    # o run das 03h25 recebeu do Yahoo preços só até 05/10 e rebaixou current, last_data_date
    # e o último pl_mensal, que o run da 1h já tinha em 06/10). Mantém o ponto mais recente.
    if (existing.get("last_data_date") or "") > (new.get("last_data_date") or ""):
        for k in ("current", "last_data_date", "excl_hoje", "coverage_weight_pct"):
            if existing.get(k) is not None:
                new[k] = existing[k]
    por_mes = {p["date"][:7]: p for p in existing.get("pl_mensal") or []}
    for p in new.get("pl_mensal") or []:
        ant = por_mes.get(p["date"][:7])
        if ant is None or p["date"] >= ant["date"]:
            por_mes[p["date"][:7]] = p
    if por_mes:
        new["pl_mensal"] = [por_mes[k] for k in sorted(por_mes)]
    pls = [p["pl"] for p in merged if p.get("pl") is not None]
    if pls:
        arr = np.array(pls, dtype=float)
        mean, sd = float(arr.mean()), float(arr.std(ddof=0))
        cur = merged[-1]["pl"]
        new["pl_stats"] = {
            "mean": round(mean, 2), "sd": round(sd, 3),
            "minus2": round(mean - 2 * sd, 2), "minus1": round(mean - sd, 2),
            "plus1": round(mean + sd, 2), "plus2": round(mean + 2 * sd, 2),
            "current_z": round((cur - mean) / sd, 2) if sd > 0 else None,
            "n_points": len(pls),
        }
    return new


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default="data-pipeline/out")
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--subset", type=int, default=None, help="limita N papéis (teste)")
    ap.add_argument("--sleep", type=float, default=0.0, help="pausa entre papéis (anti-throttle)")
    ap.add_argument("--no-merge", action="store_true")
    args = ap.parse_args()

    payload, lpa_payload = build_payload(subset=args.subset, sleep=args.sleep)
    if payload.get("status") == "ok" and not args.no_merge:
        payload = merge_series(payload, download_json("data/acoes_valuation.json"))

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "acoes_valuation.json"
    out_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(f"[acoes_val] Escreveu {out_path} ({out_path.stat().st_size:,} bytes)")

    if payload.get("status") == "error":
        return 1
    # Trava: P/L mensal curto demais = coleta quebrada; não sobrescreve dado bom.
    if not args.subset and len(payload.get("pl_mensal", [])) < 120:
        print(f"::error::pl_mensal com {len(payload.get('pl_mensal', []))} meses (< 120) — upload abortado")
        return 1
    lpa_path = out_dir / "acoes_lpa_reportado.json"
    if lpa_payload:
        lpa_path.write_text(json.dumps(lpa_payload, ensure_ascii=False), encoding="utf-8")
        print(f"[acoes_val] Escreveu {lpa_path} ({lpa_path.stat().st_size:,} bytes, "
              f"{len(lpa_payload['tickers'])} papéis)")
    if args.upload:
        maybe_upload_json(out_path, "data/acoes_valuation.json")
        if lpa_payload and not args.subset:
            maybe_upload_json(lpa_path, LPA_BLOB)
    else:
        print("[acoes_val] --upload NÃO setado; apenas salvou local.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
