"""Build market history JSON for the /painel-economico/mercado tab.

Outputs TWO files:
  - data/market_history_latest.json  : metadata + returns (1d, 1w, 1m, 3m, ytd, 1y, 5y).
    Small (~ tens of KB). Used by overview/fundamentos.
  - data/market_history_full.json    : full daily closes for the lookback window (default 5y).
    Larger (~ few MB). Used by /mercado/historico (linhas comparativas).

Why two files? Histor.json is heavy. Most pages only need latest snapshot;
only the linhas page needs the full daily series. Splitting halves payload.

Source: Yahoo Finance via yfinance.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd

# Importa o catalogo
sys.path.append(str(Path(__file__).parent))
from market_catalog import CATALOG, all_tickers  # noqa: E402
from shared.blob_download import download_json  # noqa: E402
from shared.blob_upload import maybe_upload_json  # noqa: E402


DEFAULT_LOOKBACK_YEARS = 5
DEFAULT_BATCH_SIZE = 30  # tickers por chamada de yf.download (evita 429)
MIN_COVERAGE = 0.8  # abaixo disso o run e considerado parcial (429 etc.)


def _ensure_series(df: pd.DataFrame, ticker: str) -> Optional[pd.Series]:
    """Extrai a serie de 'Close' (ja ajustada com auto_adjust=True) de um DataFrame yfinance."""
    if df is None or df.empty:
        return None
    try:
        if isinstance(df.columns, pd.MultiIndex):
            for col_name in ("Close", "Adj Close"):
                if col_name in df.columns.get_level_values(0):
                    sub = df[col_name]
                    if ticker in sub.columns:
                        s = pd.to_numeric(sub[ticker], errors="coerce").dropna()
                        if not s.empty:
                            return s
            return None
        # Single ticker -> 1 nivel de colunas
        for col_name in ("Close", "Adj Close"):
            if col_name in df.columns:
                s = pd.to_numeric(df[col_name], errors="coerce").dropna()
                return s if not s.empty else None
    except Exception:
        return None
    return None


def _series_pct_change(series: pd.Series, days_back: int) -> Optional[float]:
    """Retorno % entre o ultimo close e o close de N dias uteis atras (aprox)."""
    if series is None or series.empty or len(series) < 2:
        return None
    try:
        last = float(series.iloc[-1])
        # Para 1d queremos o penultimo close. Para "N dias", aproximamos N pregos uteis atras.
        idx = -1 - max(1, days_back)
        if abs(idx) > len(series):
            return None
        prev = float(series.iloc[idx])
        if prev <= 0:
            return None
        return round(((last - prev) / prev) * 100.0, 2)
    except Exception:
        return None


def _series_ytd(series: pd.Series) -> Optional[float]:
    if series is None or series.empty or len(series) < 2:
        return None
    try:
        last = float(series.iloc[-1])
        last_date = series.index[-1]
        if hasattr(last_date, "year"):
            year = last_date.year
        else:
            year = pd.to_datetime(last_date).year
        # Primeiro close do ano corrente
        year_series = series[series.index.year == year] if hasattr(series.index, "year") else None
        if year_series is None or year_series.empty:
            return None
        first = float(year_series.iloc[0])
        if first <= 0:
            return None
        return round(((last - first) / first) * 100.0, 2)
    except Exception:
        return None


def _series_to_compact(series: pd.Series, max_points: int = 2000) -> List[List[Any]]:
    """Compacta serie em lista [[date_iso, close_rounded], ...].

    Se a serie tiver mais que max_points, faz downsampling uniforme.
    """
    if series is None or series.empty:
        return []
    s = series.copy()
    if len(s) > max_points:
        step = len(s) // max_points
        if step > 1:
            s = s.iloc[::step]
    out: List[List[Any]] = []
    for date, val in s.items():
        try:
            d = pd.Timestamp(date).strftime("%Y-%m-%d")
            v = float(val)
            if not (v != v):  # filtra NaN
                # Cripto/FX podem ter muitas decimais; mantemos 4 mas truncamos zeros nao significativos no JSON
                out.append([d, round(v, 4)])
        except Exception:
            continue
    return out


def fetch_batch(yf_module, tickers: List[str], period: str) -> Dict[str, pd.Series]:
    """Baixa varios tickers em uma chamada agrupada. Retorna {ticker: close_series}."""
    try:
        df = yf_module.download(
            tickers=tickers,
            period=period,
            interval="1d",
            auto_adjust=True,   # ja aplica splits/dividendos
            threads=True,
            progress=False,
            group_by="column",
        )
    except Exception as e:
        print(f"[WARN] yf.download falhou no batch {tickers[:3]}...: {e}", file=sys.stderr)
        return {}
    out: Dict[str, pd.Series] = {}
    for t in tickers:
        s = _ensure_series(df, t)
        if s is not None and not s.empty:
            out[t] = s
    return out


def build_market_history(lookback_years: int = DEFAULT_LOOKBACK_YEARS,
                         batch_size: int = DEFAULT_BATCH_SIZE) -> Dict[str, Any]:
    try:
        import yfinance as yf
    except ImportError:
        print("[ERROR] yfinance nao instalado. Rode: pip install yfinance", file=sys.stderr)
        return {"status": "error", "generated_at": datetime.now(tz=timezone.utc).isoformat(), "tickers": {}}

    period = f"{lookback_years}y"
    tickers = all_tickers()
    print(f"[INFO] Baixando {len(tickers)} tickers em batches de {batch_size}, periodo={period}")

    closes: Dict[str, pd.Series] = {}
    for i in range(0, len(tickers), batch_size):
        batch = tickers[i:i + batch_size]
        partial = fetch_batch(yf, batch, period)
        closes.update(partial)
        print(f"[INFO]  batch {i//batch_size + 1}: {len(partial)}/{len(batch)} OK")

    print(f"[INFO] Total com dados: {len(closes)}/{len(tickers)}")

    payload_tickers: Dict[str, Any] = {}
    series_payload: Dict[str, List[List[Any]]] = {}

    for asset in CATALOG:
        t = asset["ticker"]
        s = closes.get(t)
        if s is None or s.empty:
            print(f"[WARN] sem dados: {t}", file=sys.stderr)
            continue

        last = float(s.iloc[-1])
        last_date = pd.Timestamp(s.index[-1]).strftime("%Y-%m-%d")

        payload_tickers[t] = {
            "name": asset["name"],
            "klass": asset["klass"],
            "sector": asset["sector"],
            "country": asset["country"],
            "currency": asset["currency"],
            "last_date": last_date,
            "last_close": round(last, 4),
            "returns": {
                "1d":  _series_pct_change(s, 1),
                "1w":  _series_pct_change(s, 5),
                "1m":  _series_pct_change(s, 22),
                "3m":  _series_pct_change(s, 66),
                "ytd": _series_ytd(s),
                "1y":  _series_pct_change(s, 252),
                "5y":  _series_pct_change(s, 252 * 5),
            },
        }
        series_payload[t] = _series_to_compact(s)

    generated_at = datetime.now(tz=timezone.utc).isoformat()

    latest = {
        "status": "ok" if payload_tickers else "error",
        "generated_at": generated_at,
        "lookback_years": lookback_years,
        "total_tickers_attempted": len(tickers),
        "total_tickers_loaded": len(payload_tickers),
        "tickers": payload_tickers,
    }

    full = {
        "status": "ok" if payload_tickers else "error",
        "generated_at": generated_at,
        "lookback_years": lookback_years,
        "tickers": {
            t: {
                "name": payload_tickers[t]["name"],
                "klass": payload_tickers[t]["klass"],
                "currency": payload_tickers[t]["currency"],
                "series_daily": series_payload[t],
            }
            for t in payload_tickers
        },
    }

    return {"latest": latest, "full": full}


def merge_blob_fallback(latest: Dict[str, Any], full: Dict[str, Any]) -> None:
    """Preserva tickers ja publicados no Blob quando o run atual falhou neles.

    Um run parcial (batches 429 do Yahoo) nao pode sobrescrever o historico
    completo no Blob. Merge por ticker: serie nova prevalece; tickers ausentes
    neste run mantem a serie antiga do Blob. Recalcula metadados de cobertura.
    Aplica a protecao aos DOIS payloads (latest e full) de forma coerente.
    """
    run_count = len(latest.get("tickers") or {})

    preserved_latest = 0
    prev_latest = download_json("data/market_history_latest.json")
    if isinstance(prev_latest, dict) and isinstance(prev_latest.get("tickers"), dict):
        for t, info in prev_latest["tickers"].items():
            if t not in latest["tickers"]:
                latest["tickers"][t] = info
                preserved_latest += 1

    preserved_full = 0
    prev_full = download_json("data/market_history_full.json")
    if isinstance(prev_full, dict) and isinstance(prev_full.get("tickers"), dict):
        for t, info in prev_full["tickers"].items():
            if t not in full["tickers"]:
                full["tickers"][t] = info
                preserved_full += 1

    latest["total_tickers_loaded"] = len(latest["tickers"])
    if latest["tickers"]:
        latest["status"] = "ok"
    if full["tickers"]:
        full["status"] = "ok"
    print(
        f"[INFO] merge com Blob: {run_count} tickers deste run; "
        f"{preserved_latest} preservados do Blob (latest), {preserved_full} (full)"
    )


def main() -> int:
    ap = argparse.ArgumentParser(description="Build market history JSON (latest + full)")
    ap.add_argument("--lookback-years", type=int, default=DEFAULT_LOOKBACK_YEARS)
    ap.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    ap.add_argument("--out-dir", default="data-pipeline/out", help="Pasta onde salvar JSON local")
    ap.add_argument("--upload", action="store_true", help="Se setado, faz upload ao Vercel Blob")
    args = ap.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    result = build_market_history(lookback_years=args.lookback_years, batch_size=args.batch_size)
    latest, full = result["latest"], result["full"]

    attempted = int(latest.get("total_tickers_attempted") or 0)
    loaded_run = int(latest.get("total_tickers_loaded") or 0)
    coverage = (loaded_run / attempted) if attempted else 0.0

    if coverage < MIN_COVERAGE:
        print(
            f"[WARN] cobertura baixa: {loaded_run}/{attempted} tickers ({coverage:.0%}) "
            f"— tentando preservar series do Blob",
            file=sys.stderr,
        )
        merge_blob_fallback(latest, full)
        coverage = (int(latest.get("total_tickers_loaded") or 0) / attempted) if attempted else 0.0

    latest_path = out_dir / "market_history_latest.json"
    full_path = out_dir / "market_history_full.json"

    latest_path.write_text(json.dumps(latest, ensure_ascii=False), encoding="utf-8")
    full_path.write_text(json.dumps(full, ensure_ascii=False), encoding="utf-8")

    print(f"[INFO] Gerado {latest_path} ({latest_path.stat().st_size} bytes)")
    print(f"[INFO] Gerado {full_path} ({full_path.stat().st_size} bytes)")

    upload_aborted = False
    if args.upload:
        if latest["status"] != "ok" or coverage < MIN_COVERAGE:
            upload_aborted = True
            print(
                f"[WARN] upload abortado (status={latest['status']}, cobertura={coverage:.0%} "
                f"< {MIN_COVERAGE:.0%} mesmo apos merge) — preservando dado existente no Blob",
                file=sys.stderr,
            )
        else:
            maybe_upload_json(latest_path, "data/market_history_latest.json")
            maybe_upload_json(full_path, "data/market_history_full.json")

    return 0 if (latest["status"] == "ok" and not upload_aborted) else 2


if __name__ == "__main__":
    raise SystemExit(main())
