"""Build do JSON de Valuation do Ibovespa pro painel de Renda Variável.

Output: data/acoes_valuation.json (consumido por src/lib/painel-acoes.ts).

Dois gráficos editoriais:
  1. P/L do Ibovespa no tempo + média e bandas de ±1σ/±2σ.
  2. Prêmio de risco: earnings yield (1/PL) e dividend yield do Ibovespa contra a
     NTN-B real ~10 anos (toggle no frontend).

Metodologia (100% automática):
  - Universo + pesos: B3 GetPortfolioDay {index: IBOV}.
  - Por papel i: preço BRUTO (yfinance auto_adjust=False), EPS TTM (income statement
    anual + trimestral, com defasagem de publicação) e dividendos TTM (.dividends).
  - EY_i(t) = EPS_TTM_i(t) / preço_i(t);  DY_i(t) = div_TTM_i(t) / preço_i(t).
  - Índice por MÉDIA HARMÔNICA ponderada pelos pesos B3 (trata ON/PN corretamente):
        EY_idx(t) = Σ(w_i·EY_i)/Σw_i      ->  P/L_idx(t) = 1 / EY_idx(t)
        DY_idx(t) = Σ(w_i·DY_i)/Σw_i
    Exige cobertura mínima de peso (MIN_COVERAGE) na data, senão ponto = null.
  - NTN-B real ~10a: interpolação linear por data sobre as maturidades da curva IPCA
    (data/treasury_history.json, fonte ANBIMA).
  - Prêmio (pp): EY%·  − NTNB%  e  DY% − NTNB%.

NOTA editorial: EY/DY são nominais e a NTN-B é real; o prêmio nominal-vs-real é o
gauge usual de "quanto a bolsa paga acima do juro real" (registrar caveat na UI).

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
LOOKBACK_YEARS = 6
MIN_COVERAGE = 0.60          # cobertura mínima de peso do índice por data
TARGET_NTNB_YEARS = 10.0     # horizonte da NTN-B real
PUB_LAG_Q = 60               # dias de defasagem de publicação trimestral
PUB_LAG_A = 90               # dias de defasagem de publicação anual


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
# yfinance — preço bruto, EPS TTM, dividendos TTM por papel
# ---------------------------------------------------------------------------

def _eps_row(df: pd.DataFrame) -> Optional[pd.Series]:
    if df is None or df.empty:
        return None
    for label in ("Diluted EPS", "Basic EPS"):
        if label in df.index:
            s = pd.to_numeric(df.loc[label], errors="coerce").dropna()
            if not s.empty:
                return s
    return None


def eps_ttm_knots(tk) -> List[Tuple[pd.Timestamp, float]]:
    """Constrói nós (data_efetiva, EPS_TTM) a partir de income statement anual+trimestral."""
    knots: Dict[pd.Timestamp, float] = {}
    # Anual: EPS do ano fiscal -> disponível ~90d após o fechamento
    try:
        ann = _eps_row(tk.income_stmt)
        if ann is not None:
            for col, val in ann.items():
                d = pd.Timestamp(col).normalize() + pd.Timedelta(days=PUB_LAG_A)
                knots[d] = float(val)
    except Exception:
        pass
    # Trimestral: soma de 4 trimestres -> disponível ~60d após o fechamento
    try:
        q = _eps_row(tk.quarterly_income_stmt)
        if q is not None and len(q) >= 4:
            q = q.sort_index()  # asc por data
            vals = q.values.astype(float)
            idx = list(q.index)
            for i in range(3, len(idx)):
                ttm = float(np.sum(vals[i - 3:i + 1]))
                d = pd.Timestamp(idx[i]).normalize() + pd.Timedelta(days=PUB_LAG_Q)
                knots[d] = ttm  # trimestral sobrescreve anual na mesma data efetiva
    except Exception:
        pass
    return sorted(knots.items())


def daily_from_knots(knots: List[Tuple[pd.Timestamp, float]], index: pd.DatetimeIndex) -> pd.Series:
    if not knots:
        return pd.Series(index=index, dtype="float64")
    ks = pd.Series({d: v for d, v in knots}).sort_index()
    s = ks.reindex(ks.index.union(index)).ffill().reindex(index)
    return s


def fetch_security(ticker: str, start: pd.Timestamp) -> Optional[Dict[str, pd.Series]]:
    """Retorna {'price','eps_ttm','div_ttm'} diários (index alinhado ao preço) ou None."""
    import yfinance as yf
    yt = f"{ticker}.SA"
    try:
        tk = yf.Ticker(yt)
        h = tk.history(start=start.strftime("%Y-%m-%d"), auto_adjust=False)
        if h is None or h.empty or "Close" not in h.columns:
            return None
        price = pd.to_numeric(h["Close"], errors="coerce").dropna()
        price.index = pd.DatetimeIndex(price.index).tz_localize(None).normalize()
        price = price[~price.index.duplicated(keep="last")].sort_index()
        if price.empty:
            return None
        eps_ttm = daily_from_knots(eps_ttm_knots(tk), price.index)
        # dividendos TTM
        div_ttm = pd.Series(index=price.index, dtype="float64")
        try:
            divs = tk.dividends
            if divs is not None and not divs.empty:
                d = divs.copy()
                d.index = pd.DatetimeIndex(d.index).tz_localize(None).normalize()
                d = d.groupby(d.index).sum().sort_index()
                cum = d.cumsum()
                cum_at = cum.reindex(cum.index.union(price.index)).ffill().reindex(price.index)
                back = (cum.reindex(cum.index.union(price.index - pd.Timedelta(days=365)))
                        .ffill().reindex(price.index - pd.Timedelta(days=365)))
                back.index = price.index
                div_ttm = (cum_at.fillna(0) - back.fillna(0)).clip(lower=0)
        except Exception:
            pass
        return {"price": price, "eps_ttm": eps_ttm, "div_ttm": div_ttm}
    except Exception as e:
        print(f"[acoes_val] FAIL {yt}: {repr(e)[:120]}", file=sys.stderr)
        return None


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

def build_payload(subset: Optional[int] = None, sleep: float = 0.0) -> Dict:
    print("[acoes_val] universo IBOV (B3)...")
    universe = fetch_ibov_universe()
    print(f"[acoes_val] IBOV universe: {len(universe)} papéis, Σpeso={sum(u['weight'] for u in universe):.1f}")
    if not universe:
        return {"status": "error", "generated_at": datetime.now(timezone.utc).isoformat()}
    if subset:
        universe = sorted(universe, key=lambda u: -u["weight"])[:subset]
        print(f"[acoes_val] SUBSET={subset}: {[u['ticker'] for u in universe]}")

    start = pd.Timestamp.today().normalize() - pd.Timedelta(days=int(LOOKBACK_YEARS * 365.25))

    # P/L atual observado por papel (yfinance .info via market_fundamentals) -> âncora de nível.
    fund = download_json("data/market_fundamentals.json") or {}
    ftk = fund.get("tickers", {})

    def _pe(t: str) -> Optional[float]:
        info = (ftk.get(f"{t}.SA") or {}).get("info", {})
        v = info.get("trailingPE")
        try:
            return float(v) if v is not None else None
        except (TypeError, ValueError):
            return None

    pe_map = {u["ticker"]: _pe(u["ticker"]) for u in universe}

    ey_frames, dy_frames, weights = {}, {}, {}
    ok = 0
    for u in universe:
        t, w = u["ticker"], u["weight"]
        if w <= 0:
            continue
        sec = fetch_security(t, start)
        if sleep:
            time.sleep(sleep)
        if not sec:
            continue
        price, eps, div = sec["price"], sec["eps_ttm"], sec["div_ttm"]
        eps = eps.where(eps > 0)  # exclui períodos de prejuízo (padrão de índice p/ P/L)
        ey = (eps / price).replace([np.inf, -np.inf], np.nan)
        dy = (div / price).replace([np.inf, -np.inf], np.nan)
        ey_valid = ey.dropna()
        if ey_valid.empty:
            continue
        # Âncora de nível: calibra o EY pelo P/L atual observado (yfinance .info),
        # corrigindo empresas que reportam em USD (ex.: VALE) e diferenças de unidade.
        pe = pe_map.get(t)
        anchor = "raw"
        if pe and pe > 0 and ey_valid.iloc[-1] > 0:
            ey = ey * ((1.0 / pe) / ey_valid.iloc[-1])
            anchor = f"PE={pe:.1f}"
        ey_frames[t] = ey
        dy_frames[t] = dy
        weights[t] = w
        ok += 1
        print(f"[acoes_val] {t} w={w:.2f} rows={len(price)} ey_last={ey.dropna().iloc[-1]:.4f} anchor={anchor}")
    print(f"[acoes_val] papéis OK: {ok}/{len(universe)}")
    if ok == 0:
        return {"status": "error", "generated_at": datetime.now(timezone.utc).isoformat()}

    EY = pd.DataFrame(ey_frames).sort_index()
    DY = pd.DataFrame(dy_frames).sort_index()
    w = pd.Series(weights)
    total_w = float(w.sum())

    # agregação ponderada por data, com cobertura mínima
    def weighted(df: pd.DataFrame) -> Tuple[pd.Series, pd.Series]:
        wv = w.reindex(df.columns).values
        vals = df.values
        mask = ~np.isnan(vals)
        wmat = np.where(mask, wv, 0.0)
        cov = wmat.sum(axis=1)
        num = np.nansum(np.where(mask, vals * wv, 0.0), axis=1)
        with np.errstate(invalid="ignore", divide="ignore"):
            agg = np.where(cov > 0, num / cov, np.nan)
        return pd.Series(agg, index=df.index), pd.Series(cov / total_w, index=df.index)

    ey_idx, cov = weighted(EY)
    dy_idx, _ = weighted(DY)
    ey_idx = ey_idx.where(cov >= MIN_COVERAGE)
    dy_idx = dy_idx.where(cov >= MIN_COVERAGE)
    pl_idx = (1.0 / ey_idx).where(ey_idx > 0)

    ntnb = ntnb_real_series()

    # série consolidada (datas com P/L válido)
    idx = pl_idx.dropna().index
    ntnb_al = ntnb.reindex(ntnb.index.union(idx)).ffill().reindex(idx)
    series = []
    for d in idx:
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

    pl_vals = pl_idx.dropna()
    mean = float(pl_vals.mean())
    sd = float(pl_vals.std(ddof=0))
    cur = series[-1] if series else None
    pl_stats = {
        "mean": round(mean, 2), "sd": round(sd, 3),
        "minus2": round(mean - 2 * sd, 2), "minus1": round(mean - sd, 2),
        "plus1": round(mean + sd, 2), "plus2": round(mean + 2 * sd, 2),
        "current_z": round((cur["pl"] - mean) / sd, 2) if (cur and sd > 0) else None,
        "n_points": int(len(pl_vals)),
    }

    ntnb_full = [[d.strftime("%Y-%m-%d"), round(float(v), 3)] for d, v in ntnb.dropna().items()]

    return {
        "status": "ok",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "current": cur,
        "coverage_weight_pct": round(float(cov.reindex(idx).iloc[-1]) * 100.0, 1) if len(idx) else None,
        "n_constituents": ok,
        "pl_stats": pl_stats,
        "series": series,
        "ntnb_full": ntnb_full,
        "sources": {
            "universe": "B3 GetPortfolioDay (IBOV)",
            "eps_dividends": "yfinance income statement (anual+trimestral) e .dividends",
            "price": "yfinance Close bruto (auto_adjust=False)",
            "ntnb": "treasury_history.json (ANBIMA), NTN-B real ~10a interpolada",
        },
        "method": "P/L índice = 1 / Σ(w_i·EY_i); EY_i=EPS_TTM/preço; pesos B3",
        "_meta": {"lookback_years": LOOKBACK_YEARS, "min_coverage": MIN_COVERAGE,
                  "target_ntnb_years": TARGET_NTNB_YEARS, "series_points": len(series)},
    }


def merge_series(new: Dict, existing: Optional[Dict]) -> Dict:
    """União append-only por data (novo cálculo prevalece)."""
    if not existing or existing.get("status") != "ok":
        return new
    by_date = {p["date"]: p for p in existing.get("series", [])}
    for p in new.get("series", []):
        by_date[p["date"]] = p
    merged = sorted(by_date.values(), key=lambda p: p["date"])
    new["series"] = merged
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

    payload = build_payload(subset=args.subset, sleep=args.sleep)
    if payload.get("status") == "ok" and not args.no_merge:
        payload = merge_series(payload, download_json("data/acoes_valuation.json"))

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "acoes_valuation.json"
    out_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(f"[acoes_val] Escreveu {out_path} ({out_path.stat().st_size:,} bytes)")

    if payload.get("status") == "error":
        return 1
    if args.upload:
        maybe_upload_json(out_path, "data/acoes_valuation.json")
    else:
        print("[acoes_val] --upload NÃO setado; apenas salvou local.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
