"""Build World Indices returns chart JSON.

Output (JSON): frontend/data/world_indices_returns.json (and variants)

All values are returned as percentage points (unitless %).
Data source: Yahoo Finance via yfinance.
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import Dict, List, Optional

import pandas as pd


ASSETS = [
    {"name": "EUA (S&P 500)", "ticker": "^GSPC", "group": "developed"},
    {"name": "Reino Unido (FTSE)", "ticker": "^FTSE", "group": "developed"},
    {"name": "Alemanha (DAX)", "ticker": "^GDAXI", "group": "developed"},
    {"name": "Suíça (SMI)", "ticker": "^SSMI", "group": "developed"},
    {"name": "Espanha (IBEX 35)", "ticker": "^IBEX", "group": "developed"},
    {"name": "Japão (Nikkei 225)", "ticker": "^N225", "group": "developed"},
    {"name": "Hong Kong (Hang Seng)", "ticker": "^HSI", "group": "emerging"},
    {"name": "China (SSE Composite)", "ticker": "000001.SS", "group": "emerging"},
    {"name": "Coreia do Sul (KOSPI)", "ticker": "^KS11", "group": "emerging"},
    {"name": "Taiwan (TAIEX)", "ticker": "^TWII", "group": "emerging"},
    {"name": "Singapura (STI)", "ticker": "^STI", "group": "emerging"},
    {"name": "Índia (Nifty 50)", "ticker": "^NSEI", "group": "emerging"},
    {"name": "Argentina (Merval)", "ticker": "^MERV", "group": "emerging"},
    {"name": "Colômbia (GXG)", "ticker": "GXG", "group": "emerging"},
    {"name": "México (IPC)", "ticker": "^MXX", "group": "emerging"},
    {"name": "Brasil (EWZ)", "ticker": "EWZ", "group": "emerging"},
]


def _extract_close_series(download_df: pd.DataFrame, symbol: str) -> Optional[pd.Series]:
    if download_df is None or getattr(download_df, "empty", True):
        return None
    try:
        # yfinance > 0.2 format: (Price, Ticker)
        # Check standard MultiIndex columns
        if isinstance(download_df.columns, pd.MultiIndex):
            # level 0 = price type (Adj Close, Close), level 1 = ticker
            for col_name in ("Adj Close", "Close"):
                if col_name in download_df.columns.get_level_values(0):
                    close_df = download_df[col_name]
                    if symbol in close_df.columns:
                        s = pd.to_numeric(close_df[symbol], errors="coerce").dropna()
                        return s if not s.empty else None

            # Alternate grouping: level 0 = ticker, level 1 = price type
            # (Sometimes yfinance group_by='ticker' does this)
            for col_name in ("Adj Close", "Close"):
                if col_name in download_df.columns.get_level_values(1):
                    try:
                        # We need to find the column where level 1 is col_name and level 0 is symbol
                        pass 
                        # This part is tricky without selecting via xs or similar. 
                        # Let's try xs if possible or simplified access.
                        if symbol in download_df.columns.get_level_values(0):
                            s = download_df.loc[:, (symbol, col_name)]
                            s = pd.to_numeric(s, errors="coerce").dropna()
                            return s if not s.empty else None
                    except Exception:
                        pass
            return None

        # Flat index (single ticker)
        for col_name in ("Adj Close", "Close"):
            if col_name in download_df.columns:
                s = pd.to_numeric(download_df[col_name], errors="coerce").dropna()
                return s if not s.empty else None
        return None
    except Exception:
        return None


def compute_world_indices_returns(period: str = "1mo") -> List[Dict]:
    try:
        import yfinance as yf  # type: ignore
    except ImportError:
        print("[ERROR] yfinance não instalado.", file=sys.stderr)
        return []

    tickers = [a["ticker"] for a in ASSETS]

    # If period is "1d", fetch "5d" so we have at least 2 closes (yesterday, today)
    fetch_period = "5d" if period == "1d" else period

    # Download data
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
        group = asset["group"]

        series = _extract_close_series(dl, ticker)
        if series is None or len(series) < 2:
            continue

        end_price = float(series.iloc[-1])
        if period == "1d":
            start_price = float(series.iloc[-2])
        else:
            start_price = float(series.iloc[0])
        
        if start_price == 0:
            continue

        ret_pct = ((end_price - start_price) / start_price) * 100.0

        results.append({
            "ticker": ticker,
            "name": name,
            "group": group,
            "return_pct": round(ret_pct, 2),
            "start_date": series.index[0].strftime("%Y-%m-%d"),
            "end_date": series.index[-1].strftime("%Y-%m-%d"),
            "start_price": round(start_price, 2),
            "end_price": round(end_price, 2),
        })

    # Sort by return descending
    results.sort(key=lambda x: x["return_pct"], reverse=True)
    return results


def main():
    parser = argparse.ArgumentParser(description="Generate World Indices returns JSON.")
    parser.add_argument("--period", default="1mo", help="Period to download (1d, 1wk, 1mo, 3mo, 1y).")
    parser.add_argument("--output", required=True, help="Path to output JSON file.")
    args = parser.parse_args()

    data = compute_world_indices_returns(period=args.period)

    if not data:
        print("[WARN] payload vazio (yfinance falhou?) — status=error para o upload não sobrescrever dado bom no Blob", file=sys.stderr)

    output = {
        "status": "ok" if data else "error",
        "generated_at": pd.Timestamp.utcnow().isoformat(),
        "period": args.period,
        "data": data,
    }

    try:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        print(f"Generated {args.output}")
    except Exception as e:
        print(f"[ERROR] Could not write JSON: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
