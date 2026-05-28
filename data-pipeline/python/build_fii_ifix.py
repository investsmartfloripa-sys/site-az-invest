"""Build do JSON do hero IFIX + benchmarks pro painel de Fundos Imobiliários.

Output: data/fii_ifix.json (consumido por src/lib/painel-fii.ts -> FiiIfixData).

Estratégia (sem fonte oficial pública do histórico do índice IFIX):
  - Spot do IFIX hoje vem do yfinance `IFIX.SA` (Yahoo expõe só o último ponto).
  - Histórico ~5 anos vem do XFIX11.SA (ETF que replica o IFIX), reescalado
    pra escala do índice usando o ratio (IFIX_spot / XFIX11_today).
  - Benchmarks ~5 anos:
      CDI: BCB SGS 12 (taxa diária, transformada em índice cumulativo base 100).
      IBOV: ^BVSP via yfinance.
      IMA-B: IMAB11.SA (ETF proxy do IMA-B).
      IMA-B5+: B5P211.SA (ETF proxy do IMA-B5+).
  - Hero (último dia disponível): last_value, change_pct_1d, max_12m, min_12m.
  - Série diária unificada por data (full outer), com IFIX em pontos e benchmarks
    em base 100 (data inicial da janela visualizada renormaliza no frontend).

Uso típico:
    python data-pipeline/python/build_fii_ifix.py --out-dir data-pipeline/out --upload
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
import yfinance as yf

sys.path.append(str(Path(__file__).parent))
from shared.blob_upload import maybe_upload_json  # noqa: E402


LOOKBACK_YEARS = 5
SGS_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{cod}/dados?formato=json&dataInicial={data_inicial}"
# BCB SGS retorna 406 com Accept específico — usar Accept: */* ou nada.
UA = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "*/*",
}


# ---------------------------------------------------------------------------
# Fetchers
# ---------------------------------------------------------------------------

def _yf_close(ticker: str, period: str = f"{LOOKBACK_YEARS}y") -> pd.Series:
    """Baixa série diária de Close ajustado via yfinance. Retorna Series vazia se falhar."""
    try:
        h = yf.Ticker(ticker).history(period=period, auto_adjust=True)
        if h is None or h.empty or "Close" not in h.columns:
            return pd.Series(dtype="float64", name=ticker)
        s = pd.to_numeric(h["Close"], errors="coerce").dropna()
        # Normaliza index pra date naive YYYY-MM-DD
        s.index = pd.to_datetime(s.index).tz_localize(None).normalize()
        s.name = ticker
        return s
    except Exception as e:
        print(f"[yf] FAIL {ticker}: {e}", file=sys.stderr)
        return pd.Series(dtype="float64", name=ticker)


def _yf_spot(ticker: str) -> Optional[float]:
    """Spot atual via yfinance.history period=1d."""
    try:
        h = yf.Ticker(ticker).history(period="5d")
        if h is None or h.empty:
            return None
        v = pd.to_numeric(h["Close"], errors="coerce").dropna()
        return float(v.iloc[-1]) if not v.empty else None
    except Exception as e:
        print(f"[yf spot] FAIL {ticker}: {e}", file=sys.stderr)
        return None


def _sgs_series(code: int, years_back: int = LOOKBACK_YEARS + 1) -> pd.Series:
    """Baixa série SGS BCB (formato {data,valor}).

    BCB rejeita HTTP 406 quando a janela pedida é muito grande (~25 anos);
    `years_back` limita pra ~6 anos (LOOKBACK_YEARS + 1) por padrão.
    """
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
        return s
    except Exception as e:
        print(f"[sgs] FAIL {code}: {e}", file=sys.stderr)
        return pd.Series(dtype="float64", name=f"sgs_{code}")


# ---------------------------------------------------------------------------
# Transforms
# ---------------------------------------------------------------------------

def _cdi_cumulative_index(cdi_daily_pct: pd.Series, start_date: pd.Timestamp) -> pd.Series:
    """CDI diário em % (SGS 12) -> índice cumulativo base 100 a partir de `start_date`.

    A taxa SGS 12 já é diária expressa em % (ex.: 0,0470 por dia).
    Acumulação: prod(1 + r_d / 100).
    """
    if cdi_daily_pct is None or cdi_daily_pct.empty:
        return pd.Series(dtype="float64", name="cdi_index_100")
    if not isinstance(cdi_daily_pct.index, pd.DatetimeIndex):
        # Defesa: se index não for DatetimeIndex (série vazia), pula
        return pd.Series(dtype="float64", name="cdi_index_100")
    s = cdi_daily_pct.loc[cdi_daily_pct.index >= start_date].copy()
    if s.empty:
        return pd.Series(dtype="float64", name="cdi_index_100")
    factor = (1.0 + s / 100.0).cumprod() * 100.0 / (1.0 + s.iloc[0] / 100.0)
    factor.name = "cdi_index_100"
    return factor


def _to_base_100(series: pd.Series) -> pd.Series:
    """Reescala uma série pra base 100 no primeiro ponto."""
    s = series.dropna()
    if s.empty:
        return s
    base = s.iloc[0]
    if base == 0:
        return pd.Series(dtype="float64", name=s.name)
    return (s / base) * 100.0


# ---------------------------------------------------------------------------
# Main build
# ---------------------------------------------------------------------------

def build_payload() -> Dict:
    print("[fii_ifix] Baixando XFIX11.SA (5y)...")
    xfix = _yf_close("XFIX11.SA")
    print(f"[fii_ifix] XFIX11 rows={len(xfix)}, last={xfix.iloc[-1] if not xfix.empty else None}")

    print("[fii_ifix] Baixando IFIX.SA spot...")
    ifix_spot = _yf_spot("IFIX.SA")
    print(f"[fii_ifix] IFIX spot = {ifix_spot}")

    print("[fii_ifix] Baixando benchmarks (^BVSP, IMAB11.SA, B5P211.SA)...")
    ibov = _yf_close("^BVSP")
    imab = _yf_close("IMAB11.SA")
    imab5p = _yf_close("B5P211.SA")
    print(f"[fii_ifix] IBOV rows={len(ibov)}, IMAB11 rows={len(imab)}, B5P211 rows={len(imab5p)}")

    print("[fii_ifix] Baixando CDI BCB SGS 12...")
    cdi_daily = _sgs_series(12)
    print(f"[fii_ifix] CDI rows={len(cdi_daily)}")

    # ---- Reescalar XFIX11 -> escala do IFIX ----
    if xfix.empty:
        print("[fii_ifix] ERRO crítico: XFIX11 vazio. Abort.", file=sys.stderr)
        return {
            "status": "error",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "source_primary": "yfinance",
            "source_history": "XFIX11.SA (vazio)",
            "benchmark_sources": {},
            "hero": None,
            "series_daily": [],
        }

    xfix_today = float(xfix.iloc[-1])
    if ifix_spot is None or ifix_spot <= 0:
        # Sem âncora — usa o próprio XFIX11 (escala R$) com aviso no source
        scale_ratio = 1.0
        primary_source_note = "XFIX11.SA escala R$ (sem âncora IFIX hoje)"
        ifix_anchor_value = xfix_today
    else:
        scale_ratio = ifix_spot / xfix_today
        primary_source_note = f"IFIX.SA spot ({ifix_spot:.2f}) ancorando XFIX11"
        ifix_anchor_value = ifix_spot

    ifix_history = (xfix * scale_ratio).rename("IFIX")

    # ---- Hero ----
    last_date = ifix_history.index[-1]
    last_value = float(ifix_history.iloc[-1])
    prev_value = float(ifix_history.iloc[-2]) if len(ifix_history) >= 2 else None
    change_pct_1d = (
        round((last_value - prev_value) / prev_value * 100.0, 2)
        if prev_value and prev_value > 0
        else None
    )
    one_year_ago = last_date - pd.Timedelta(days=365)
    win_12m = ifix_history.loc[ifix_history.index >= one_year_ago]
    max_12m = float(win_12m.max()) if not win_12m.empty else last_value
    min_12m = float(win_12m.min()) if not win_12m.empty else last_value

    hero = {
        "last_value": last_value,
        "last_date": last_date.strftime("%Y-%m-%d"),
        "change_pct_1d": change_pct_1d,
        "max_12m": max_12m,
        "min_12m": min_12m,
    }

    # ---- Série unificada por data (full outer join) ----
    start_date = (last_date - pd.Timedelta(days=int(LOOKBACK_YEARS * 365.25 + 30))).normalize()
    ifix_clip = ifix_history.loc[ifix_history.index >= start_date]
    cdi_idx = _cdi_cumulative_index(cdi_daily, start_date)
    ibov_idx = _to_base_100(ibov.loc[ibov.index >= start_date])
    imab_idx = _to_base_100(imab.loc[imab.index >= start_date])
    imab5p_idx = _to_base_100(imab5p.loc[imab5p.index >= start_date])

    df = pd.concat(
        [
            ifix_clip.rename("ifix"),
            imab_idx.rename("IMAB"),
            imab5p_idx.rename("IMAB5P"),
            cdi_idx.rename("CDI"),
            ibov_idx.rename("IBOV"),
        ],
        axis=1,
        sort=True,
    )
    df = df.sort_index()
    # Forward-fill em dias úteis sem cotação (ex.: CDI publica feriados, BVSP não)
    df[["ifix", "IMAB", "IMAB5P", "IBOV"]] = df[["ifix", "IMAB", "IMAB5P", "IBOV"]].ffill()
    df["CDI"] = df["CDI"].ffill()
    df = df.dropna(subset=["ifix"])

    series_daily: List[Dict] = []
    for date, row in df.iterrows():
        point = {
            "date": date.strftime("%Y-%m-%d"),
            "ifix": round(float(row["ifix"]), 2),
        }
        for col in ("IMAB", "IMAB5P", "CDI", "IBOV"):
            v = row.get(col)
            point[col] = (round(float(v), 4) if pd.notna(v) else None)
        series_daily.append(point)

    return {
        "status": "ok",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_primary": primary_source_note,
        "source_history": "XFIX11.SA via yfinance (proxy IFIX)",
        "benchmark_sources": {
            "IMAB": "IMAB11.SA via yfinance (proxy ETF do IMA-B)",
            "IMAB5P": "B5P211.SA via yfinance (proxy ETF do IMA-B5+)",
            "CDI": "BCB SGS 12 (CDI diário acumulado, base 100)",
            "IBOV": "^BVSP via yfinance (Ibovespa, base 100)",
        },
        "hero": hero,
        "series_daily": series_daily,
        "_meta": {
            "anchor_ifix_spot": ifix_anchor_value,
            "scale_ratio_xfix_to_ifix": round(scale_ratio, 6),
            "rows": len(series_daily),
            "lookback_years": LOOKBACK_YEARS,
        },
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default="data-pipeline/out")
    ap.add_argument("--upload", action="store_true", help="Faz upload pro Vercel Blob")
    args = ap.parse_args()

    payload = build_payload()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "fii_ifix.json"
    out_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(f"[fii_ifix] Escreveu {out_path} ({out_path.stat().st_size:,} bytes)")

    if payload.get("status") == "error":
        print("[fii_ifix] Status=error, não fará upload.", file=sys.stderr)
        return 1

    if args.upload:
        maybe_upload_json(out_path, "data/fii_ifix.json")
    else:
        print("[fii_ifix] --upload NÃO setado; apenas salvou local.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
