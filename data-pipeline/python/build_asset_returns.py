"""Build asset returns chart JSON for PANORAMA.

Output (JSON): frontend/data/asset_returns.json

- Market assets are downloaded from Yahoo Finance via yfinance.
- CDI uses the same market proxy as the 'ETFs (Base 100)' chart: LFTS11.SA.

All values are returned as percentage points (unitless %).
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd


ASSETS = [
    # Use the same CDI proxy as the ETFs base-100 chart (LFTS11)
    {"class": "RF", "name": "CDI", "ticker": "LFTS11.SA"},
    {"class": "RF", "name": "NTN-B 2050", "ticker": "IMAB11.SA"},
    {"class": "RF", "name": "NTN-F", "ticker": "IRFM11.SA"},
    {"class": "RF", "name": "Treasury 10y", "ticker": "IEF"},
    {"class": "RF", "name": "Treasury Curto", "ticker": "SHV"},
    # {"class": "RV", "name": "IFIX", "ticker": "IFIX.SA"},
    {"class": "RV", "name": "IFIX", "ticker": "XFIX11.SA"},
    {"class": "RV", "name": "EWZ", "ticker": "EWZ"},
    {"class": "RV", "name": "Small Caps", "ticker": "SMAL11.SA"},
    {"class": "RV", "name": "S&P 500", "ticker": "IVVB11.SA"},
    {"class": "RV", "name": "MSCI World", "ticker": "URTH"},
    {"class": "RV", "name": "MSCI Europa", "ticker": "IEUR"},
    {"class": "RV", "name": "MSCI Índia", "ticker": "INDA"},
    {"class": "RV", "name": "MSCI Emergentes", "ticker": "EEM"},
    {"class": "RV", "name": "MSCI China", "ticker": "MCHI"},
    {"class": "RV", "name": "REITs (VNQ)", "ticker": "VNQ"},
    {"class": "Commodities", "name": "Ouro (GOLD11)", "ticker": "GOLD11.SA"},
    {"class": "Cripto", "name": "HASH11", "ticker": "HASH11.SA"},
    # We keep USD/BRL for currency conversion calculations in frontend, 
    # but it will be hidden from the chart via excludedTickers in app.js
    {"class": "FX", "name": "USD/BRL", "ticker": "BRL=X"},
]


def _extract_close_series(download_df: pd.DataFrame, symbol: str) -> Optional[pd.Series]:
    if download_df is None or getattr(download_df, "empty", True):
        return None
    try:
        if isinstance(download_df.columns, pd.MultiIndex):
            for col_name in ("Adj Close", "Close"):
                if col_name in download_df.columns.get_level_values(0):
                    close_df = download_df[col_name]
                    if symbol in close_df.columns:
                        s = pd.to_numeric(close_df[symbol], errors="coerce").dropna()
                        return s if not s.empty else None
            return None
        for col_name in ("Adj Close", "Close"):
            if col_name in download_df.columns:
                s = pd.to_numeric(download_df[col_name], errors="coerce").dropna()
                return s if not s.empty else None
        return None
    except Exception:
        return None


def compute_returns(period: str = "1mo") -> List[Dict]:
    try:
        import yfinance as yf  # type: ignore
    except ImportError:
        print("[ERROR] yfinance não instalado. Instale: pip install yfinance", file=sys.stderr)
        return []

    tickers = [a["ticker"] for a in ASSETS]

    # If period is "1d", we fetch "5d" so we have at least 2 closes (yesterday, today)
    # to compute a daily return. For others, we trust yfinance period.
    fetch_period = "5d" if period == "1d" else period

    try:
        dl = yf.download(
            tickers=tickers,
            period=fetch_period,
            interval="1d",
            auto_adjust=False,
            threads=True,
            progress=False,
            group_by="column",
        )
    except Exception as e:
        print(f"[WARN] Falha ao baixar dados: {e}", file=sys.stderr)
        return []

    results: List[Dict] = []

    for asset in ASSETS:
        ticker = asset["ticker"]
        name = asset["name"]
        asset_class = asset["class"]

        series = _extract_close_series(dl, ticker)
        if series is None or len(series) < 2:
            print(f"[WARN] Sem dados para {name} ({ticker})", file=sys.stderr)
            continue

        last = float(series.iloc[-1])
        if period == "1d":
            first = float(series.iloc[-2])
        else:
            first = float(series.iloc[0])

        if first <= 0:
            print(f"[WARN] Preço inicial inválido para {name}: {first}", file=sys.stderr)
            continue

        ret_pct = ((last - first) / first) * 100.0

        results.append({
            "name": name,
            "ticker": ticker,
            "class": asset_class,
            "return_pct": round(ret_pct, 2),
            "first_close": round(first, 4),
            "last_close": round(last, 4),
        })

    # Sort descending by return
    results.sort(key=lambda r: r["return_pct"], reverse=True)

    return results


def _infer_currency(ticker: Optional[str], name: str) -> str:
    t = (ticker or "").strip()
    n = (name or "").strip().upper()
    if not t:
        # CDI is a Brazil-local rate
        if n == "CDI":
            return "REAL"
        return "REAL"
    if t.endswith(".SA") or t == "^BVSP":
        return "REAL"
    if t == "BG=F":
        return "REAL"
    if t.endswith("=F"):
        return "USD"
    if t.endswith("=X"):
        return "USD"
    return "USD"


def _add_brl_usd_returns(rows: List[Dict]) -> Dict[str, Optional[float]]:
    """Mutates rows by adding currency/return_brl_pct/return_usd_pct/return_native_pct.

    Returns a dict with FX metadata used by the frontend.
    """

    fx_row = next((r for r in rows if r.get("ticker") == "BRL=X"), None)
    fx_ret_pct = None
    try:
        if fx_row is not None:
            fx_ret_pct = float(fx_row.get("return_pct"))
    except Exception:
        fx_ret_pct = None

    fx = (fx_ret_pct / 100.0) if fx_ret_pct is not None else None

    for r in rows:
        name = str(r.get("name") or "")
        ticker = r.get("ticker")
        cur = _infer_currency(ticker, name)

        r["currency"] = cur
        r["return_native_pct"] = r.get("return_pct")

        # Default nulls if FX isn't available
        r["return_brl_pct"] = None
        r["return_usd_pct"] = None

        try:
            ret_native_pct = float(r.get("return_pct"))
        except Exception:
            continue

        # FX row: native is USD/BRL. In BRL terms, USD appreciation is just the native return.
        if (ticker or "").strip() == "BRL=X":
            r["return_brl_pct"] = round(ret_native_pct, 2)
            if fx is not None:
                r["return_usd_pct"] = round(((1.0 / (1.0 + fx)) - 1.0) * 100.0, 2)
            continue

        if fx is None:
            # Without FX we can't translate between BRL and USD consistently.
            if cur == "REAL":
                r["return_brl_pct"] = round(ret_native_pct, 2)
            else:
                r["return_usd_pct"] = round(ret_native_pct, 2)
            continue

        ret = ret_native_pct / 100.0

        if cur == "REAL":
            # Native is BRL; convert to USD-equivalent
            r["return_brl_pct"] = round(ret_native_pct, 2)
            usd_pct = (((1.0 + ret) / (1.0 + fx)) - 1.0) * 100.0
            r["return_usd_pct"] = round(usd_pct, 2)
        else:
            # Native is USD; convert to BRL-equivalent
            r["return_usd_pct"] = round(ret_native_pct, 2)
            brl_pct = (((1.0 + ret) * (1.0 + fx)) - 1.0) * 100.0
            r["return_brl_pct"] = round(brl_pct, 2)

    return {
        "fx_ticker": "BRL=X",
        "fx_usd_brl_return_pct": round(fx_ret_pct, 2) if fx_ret_pct is not None else None,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Build asset returns JSON")
    ap.add_argument(
        "--output",
        default="frontend/data/asset_returns.json",
        help="Output JSON path",
    )
    ap.add_argument(
        "--period",
        default="1mo",
        help="yfinance period (e.g., 1mo, 3mo, 1y)",
    )
    args = ap.parse_args()

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)

    returns = compute_returns(period=args.period)
    fx_meta = _add_brl_usd_returns(returns) if returns else {"fx_ticker": "BRL=X", "fx_usd_brl_return_pct": None}

    payload = {
        "status": "ok" if returns else "error",
        "generated_at": pd.Timestamp.utcnow().isoformat(),
        "period": args.period,
        "title": "Retornos dos Ativos (%)",
        "chart_type": "horizontal_bar",
        "fx": fx_meta,
        "colors": {
            "positive": "#2ECC71",
            "negative": "#E74C3C",
            "text": "#2C3E50",
        },
        "data": returns,
    }

    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[INFO] Gerado {out} com {len(returns)} ativos.")
    return 0 if returns else 2


if __name__ == "__main__":
    raise SystemExit(main())
