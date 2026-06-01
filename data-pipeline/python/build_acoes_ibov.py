"""Build do JSON do hero Ibovespa + benchmarks pro painel de Renda Variável.

Output: data/acoes_ibov.json (consumido por src/lib/painel-acoes.ts -> AcoesIbovData).

Estratégia (100% automática, sem re-puxar yfinance daqui):
  - A série diária do Ibovespa (^BVSP), do S&P 500 (^GSPC) e do USD/BRL (BRL=X)
    já são geradas pelo workflow market-data.yml e ficam em
    data/market_history_full.json no Blob. Lemos de lá (evita rate-limit do
    Yahoo em IP de datacenter).
  - CDI vem do BCB SGS 12 (taxa diária), acumulado em índice base 100.
  - Hero (último dia): last_value (pontos do Ibov), change_pct_1d, max_12m, min_12m.
  - Série unificada por data: Ibov em pontos; benchmarks em base 100 (renormaliza
    no frontend conforme a janela escolhida).

Uso típico:
    python data-pipeline/python/build_acoes_ibov.py --out-dir data-pipeline/out --upload
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd
import requests

sys.path.append(str(Path(__file__).parent))
from shared.blob_upload import maybe_upload_json  # noqa: E402
from shared.blob_download import download_json  # noqa: E402


LOOKBACK_YEARS = 5
SGS_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{cod}/dados?formato=json&dataInicial={data_inicial}"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0", "Accept": "*/*"}

# Benchmarks: ticker no market_history_full -> chave de saída
BENCHMARK_TICKERS = {
    "^GSPC": "SP500",   # S&P 500 (base 100, perf em USD)
    "BRL=X": "USDBRL",  # USD/BRL (base 100)
}


# ---------------------------------------------------------------------------
# Fetchers
# ---------------------------------------------------------------------------

def series_from_full(full: Dict, ticker: str) -> pd.Series:
    """Extrai uma série diária de market_history_full.json -> pd.Series (index date)."""
    tickers = (full or {}).get("tickers", {})
    node = tickers.get(ticker)
    if not node:
        return pd.Series(dtype="float64", name=ticker)
    raw = node.get("series_daily") or []
    if not raw:
        return pd.Series(dtype="float64", name=ticker)
    idx = pd.to_datetime([p[0] for p in raw], errors="coerce")
    vals = pd.to_numeric([p[1] for p in raw], errors="coerce")
    s = pd.Series(vals, index=idx, name=ticker).dropna()
    s.index = pd.DatetimeIndex(s.index).normalize()
    return s.sort_index()


def sgs_series(code: int, years_back: int = LOOKBACK_YEARS + 1) -> pd.Series:
    """Série SGS BCB ({data,valor}). years_back limita a janela (SGS rejeita 406 se grande)."""
    from datetime import date
    di = f"01/01/{date.today().year - years_back}"
    url = SGS_URL.format(cod=code, data_inicial=di)
    try:
        r = requests.get(url, timeout=60, headers=UA)
        r.raise_for_status()
        data = r.json()
        if not data:
            return pd.Series(dtype="float64", name=f"sgs_{code}")
        df = pd.DataFrame(data)
        df["data"] = pd.to_datetime(df["data"], format="%d/%m/%Y", errors="coerce")
        df["valor"] = pd.to_numeric(df["valor"], errors="coerce")
        df = df.dropna(subset=["data", "valor"])
        s = df.set_index("data")["valor"]
        s.index = s.index.normalize()
        s.name = f"sgs_{code}"
        return s.sort_index()
    except Exception as e:
        print(f"[sgs] FAIL {code}: {e}", file=sys.stderr)
        return pd.Series(dtype="float64", name=f"sgs_{code}")


# ---------------------------------------------------------------------------
# Transforms
# ---------------------------------------------------------------------------

def cdi_cumulative_index(cdi_daily_pct: pd.Series, start_date: pd.Timestamp) -> pd.Series:
    """CDI diário em % (SGS 12) -> índice cumulativo base 100 a partir de start_date."""
    if cdi_daily_pct is None or cdi_daily_pct.empty or not isinstance(cdi_daily_pct.index, pd.DatetimeIndex):
        return pd.Series(dtype="float64", name="cdi_index_100")
    s = cdi_daily_pct.loc[cdi_daily_pct.index >= start_date].copy()
    if s.empty:
        return pd.Series(dtype="float64", name="cdi_index_100")
    factor = (1.0 + s / 100.0).cumprod() * 100.0 / (1.0 + s.iloc[0] / 100.0)
    factor.name = "cdi_index_100"
    return factor


def to_base_100(series: pd.Series) -> pd.Series:
    s = series.dropna()
    if s.empty:
        return s
    base = s.iloc[0]
    if base == 0:
        return pd.Series(dtype="float64", name=s.name)
    return (s / base) * 100.0


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

def build_payload() -> Dict:
    print("[acoes_ibov] Lendo market_history_full.json do Blob...")
    full = download_json("data/market_history_full.json")
    if not full or "tickers" not in full:
        print("[acoes_ibov] ERRO: market_history_full indisponível.", file=sys.stderr)
        return {"status": "error", "generated_at": datetime.now(timezone.utc).isoformat(),
                "hero": None, "series_daily": []}

    ibov = series_from_full(full, "^BVSP")
    print(f"[acoes_ibov] ^BVSP rows={len(ibov)}, last={ibov.iloc[-1] if not ibov.empty else None}")
    if ibov.empty:
        return {"status": "error", "generated_at": datetime.now(timezone.utc).isoformat(),
                "hero": None, "series_daily": []}

    benchmarks = {out_key: series_from_full(full, tk) for tk, out_key in BENCHMARK_TICKERS.items()}
    print("[acoes_ibov] Baixando CDI BCB SGS 12...")
    cdi_daily = sgs_series(12)
    print(f"[acoes_ibov] CDI rows={len(cdi_daily)}")

    # ---- Hero ----
    last_date = ibov.index[-1]
    last_value = float(ibov.iloc[-1])
    prev_value = float(ibov.iloc[-2]) if len(ibov) >= 2 else None
    change_pct_1d = (round((last_value - prev_value) / prev_value * 100.0, 2)
                     if prev_value and prev_value > 0 else None)
    one_year_ago = last_date - pd.Timedelta(days=365)
    win_12m = ibov.loc[ibov.index >= one_year_ago]
    hero = {
        "last_value": round(last_value, 2),
        "last_date": last_date.strftime("%Y-%m-%d"),
        "change_pct_1d": change_pct_1d,
        "max_12m": round(float(win_12m.max()), 2) if not win_12m.empty else round(last_value, 2),
        "min_12m": round(float(win_12m.min()), 2) if not win_12m.empty else round(last_value, 2),
    }

    # ---- Série unificada ----
    start_date = (last_date - pd.Timedelta(days=int(LOOKBACK_YEARS * 365.25 + 30))).normalize()
    cols = {"ibov": ibov.loc[ibov.index >= start_date].rename("ibov")}
    cols["CDI"] = cdi_cumulative_index(cdi_daily, start_date).rename("CDI")
    for out_key, s in benchmarks.items():
        cols[out_key] = to_base_100(s.loc[s.index >= start_date]).rename(out_key)

    df = pd.concat(list(cols.values()), axis=1, sort=True).sort_index()
    bench_cols = [c for c in df.columns if c != "ibov"]
    df[["ibov"] + [c for c in bench_cols if c != "CDI"]] = df[["ibov"] + [c for c in bench_cols if c != "CDI"]].ffill()
    if "CDI" in df.columns:
        df["CDI"] = df["CDI"].ffill()
    df = df.dropna(subset=["ibov"])

    series_daily: List[Dict] = []
    for dt, row in df.iterrows():
        point = {"date": dt.strftime("%Y-%m-%d"), "ibov": round(float(row["ibov"]), 2)}
        for col in bench_cols:
            v = row.get(col)
            point[col] = round(float(v), 4) if pd.notna(v) else None
        series_daily.append(point)

    return {
        "status": "ok",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_primary": "^BVSP via market_history_full.json (Blob; origem yfinance market-data.yml)",
        "benchmark_sources": {
            "CDI": "BCB SGS 12 (CDI diário acumulado, base 100)",
            "SP500": "^GSPC via market_history_full (base 100, USD)",
            "USDBRL": "BRL=X via market_history_full (base 100)",
        },
        "hero": hero,
        "series_daily": series_daily,
        "_meta": {"rows": len(series_daily), "lookback_years": LOOKBACK_YEARS,
                  "source_generated_at": full.get("generated_at")},
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default="data-pipeline/out")
    ap.add_argument("--upload", action="store_true")
    args = ap.parse_args()

    payload = build_payload()
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "acoes_ibov.json"
    out_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(f"[acoes_ibov] Escreveu {out_path} ({out_path.stat().st_size:,} bytes)")

    if payload.get("status") == "error":
        print("[acoes_ibov] Status=error, não fará upload.", file=sys.stderr)
        return 1
    if args.upload:
        maybe_upload_json(out_path, "data/acoes_ibov.json")
    else:
        print("[acoes_ibov] --upload NÃO setado; apenas salvou local.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
