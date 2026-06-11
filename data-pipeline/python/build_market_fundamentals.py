"""Build market fundamentals JSON (multiplos via yfinance .info).

Para cada ticker do catalogo coleta:
  - trailingPE, forwardPE, priceToBook, priceToSalesTrailing12Months
  - enterpriseToEbitda, enterpriseToRevenue
  - dividendYield, payoutRatio
  - returnOnEquity, returnOnAssets
  - debtToEquity, currentRatio
  - profitMargins, operatingMargins, ebitdaMargins
  - revenueGrowth, earningsGrowth
  - beta, marketCap, enterpriseValue, sharesOutstanding

Saida: data/market_fundamentals.json

Limitacoes:
  - .info eh scraped do Yahoo; alguns campos vem null para tickers BR
  - Rate limit "extraoficial" do yfinance: usamos sleep entre tickers
  - Se um ticker falhar, mantemos cache do .info anterior (no JSON existente, se houver)
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

sys.path.append(str(Path(__file__).parent))
from market_catalog import CATALOG  # noqa: E402
from shared.blob_upload import maybe_upload_json  # noqa: E402


# Campos do .info que queremos extrair (em ordem de prioridade analitica)
INFO_FIELDS = [
    "shortName", "longName", "sector", "industry", "country", "currency",
    "marketCap", "enterpriseValue", "sharesOutstanding", "floatShares",
    "trailingPE", "forwardPE",
    "priceToBook", "priceToSalesTrailing12Months",
    "enterpriseToEbitda", "enterpriseToRevenue",
    "dividendYield", "trailingAnnualDividendYield", "payoutRatio", "fiveYearAvgDividendYield",
    "returnOnEquity", "returnOnAssets",
    "debtToEquity", "currentRatio", "quickRatio", "totalDebt", "totalCash",
    "profitMargins", "operatingMargins", "ebitdaMargins", "grossMargins",
    "revenueGrowth", "earningsGrowth", "earningsQuarterlyGrowth",
    "beta", "fiftyTwoWeekHigh", "fiftyTwoWeekLow",
    "regularMarketPrice", "regularMarketPreviousClose", "regularMarketChangePercent",
    "averageVolume", "averageVolume10days",
    "trailingEps", "forwardEps", "bookValue",
    "exchange",
]

# Campos numericos para arredondar
NUMERIC_2DEC = {
    "trailingPE", "forwardPE", "priceToBook", "priceToSalesTrailing12Months",
    "enterpriseToEbitda", "enterpriseToRevenue", "debtToEquity",
    "currentRatio", "quickRatio", "beta",
    "regularMarketChangePercent", "trailingEps", "forwardEps", "bookValue",
    "fiftyTwoWeekHigh", "fiftyTwoWeekLow", "regularMarketPrice", "regularMarketPreviousClose",
}
NUMERIC_4DEC_PCT = {
    "dividendYield", "trailingAnnualDividendYield", "fiveYearAvgDividendYield",
    "payoutRatio",
    "returnOnEquity", "returnOnAssets",
    "profitMargins", "operatingMargins", "ebitdaMargins", "grossMargins",
    "revenueGrowth", "earningsGrowth", "earningsQuarterlyGrowth",
}


def _coerce(value: Any, key: str) -> Any:
    """Normaliza valor: arredonda numericos, deixa strings intactas."""
    if value is None:
        return None
    if key in NUMERIC_2DEC:
        try:
            return round(float(value), 2)
        except (TypeError, ValueError):
            return None
    if key in NUMERIC_4DEC_PCT:
        try:
            v = float(value)
            # Contrato deste JSON: TODO campo de NUMERIC_4DEC_PCT eh RATIO (0.045 = 4.5%).
            # yfinance >= 0.2.50 passou a retornar dividendYield em PORCENTAGEM (9.42 = 9.42%),
            # e fiveYearAvgDividendYield sempre foi porcentagem — normalizar ambos para ratio.
            if key in ("dividendYield", "fiveYearAvgDividendYield"):
                v = v / 100.0
                if v > 0.30:
                    print(f"[WARN] {key}={v:.4f} (>30% a.a.) — escala suspeita, verificar yfinance", file=sys.stderr)
            return round(v, 4)
        except (TypeError, ValueError):
            return None
    return value


def fetch_info(yf_module, ticker: str, max_retries: int = 2) -> Optional[Dict[str, Any]]:
    for attempt in range(max_retries):
        try:
            t = yf_module.Ticker(ticker)
            info = t.info or {}
            if not info:
                return None
            return {k: _coerce(info.get(k), k) for k in INFO_FIELDS}
        except Exception as e:
            if attempt == max_retries - 1:
                print(f"[WARN] {ticker}: .info falhou ({e})", file=sys.stderr)
            time.sleep(0.5 * (attempt + 1))
    return None


def load_previous(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data.get("tickers") or {}
    except Exception:
        return {}


def build_fundamentals(sleep_seconds: float = 0.3, max_tickers: Optional[int] = None,
                       previous: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    try:
        import yfinance as yf
    except ImportError:
        print("[ERROR] yfinance nao instalado.", file=sys.stderr)
        return {"status": "error", "tickers": {}}

    previous = previous or {}
    tickers = [a["ticker"] for a in CATALOG]
    if max_tickers:
        tickers = tickers[:max_tickers]

    out_tickers: Dict[str, Any] = {}
    n_loaded = 0
    n_cached = 0
    n_failed = 0

    print(f"[INFO] Coletando .info de {len(tickers)} tickers (sleep={sleep_seconds}s)")
    for i, ticker in enumerate(tickers):
        info = fetch_info(yf, ticker)
        catalog_entry = next((a for a in CATALOG if a["ticker"] == ticker), {})
        if info:
            n_loaded += 1
            out_tickers[ticker] = {
                "name": catalog_entry.get("name"),
                "klass": catalog_entry.get("klass"),
                "sector": catalog_entry.get("sector"),
                "country": catalog_entry.get("country"),
                "currency": catalog_entry.get("currency"),
                "info": info,
                "fetched_at": datetime.now(tz=timezone.utc).isoformat(),
                "stale": False,
            }
        elif ticker in previous:
            n_cached += 1
            cached = previous[ticker].copy()
            cached["stale"] = True
            out_tickers[ticker] = cached
        else:
            n_failed += 1

        if i % 25 == 0:
            print(f"[INFO]  {i+1}/{len(tickers)} processado (loaded={n_loaded}, cached={n_cached}, failed={n_failed})")
        time.sleep(sleep_seconds)

    return {
        "status": "ok" if out_tickers else "error",
        "generated_at": datetime.now(tz=timezone.utc).isoformat(),
        "total_tickers_attempted": len(tickers),
        "total_loaded": n_loaded,
        "total_from_cache": n_cached,
        "total_failed": n_failed,
        "tickers": out_tickers,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Build market fundamentals JSON via yfinance .info")
    ap.add_argument("--sleep", type=float, default=0.3, help="Sleep entre tickers (anti-429)")
    ap.add_argument("--max-tickers", type=int, default=None, help="Limita N tickers (debug)")
    ap.add_argument("--out-dir", default="data-pipeline/out")
    ap.add_argument("--upload", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "market_fundamentals.json"

    previous = load_previous(out_path)
    result = build_fundamentals(sleep_seconds=args.sleep, max_tickers=args.max_tickers, previous=previous)
    out_path.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    print(f"[INFO] Gerado {out_path} ({out_path.stat().st_size} bytes)")
    print(f"[INFO] loaded={result['total_loaded']} cached={result['total_from_cache']} failed={result['total_failed']}")

    if args.upload:
        maybe_upload_json(out_path, "data/market_fundamentals.json")

    return 0 if result["status"] == "ok" else 2


if __name__ == "__main__":
    raise SystemExit(main())
