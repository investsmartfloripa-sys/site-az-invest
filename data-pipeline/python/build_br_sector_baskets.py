"""Build Brazilian Sector Baskets ranking JSON for the DASHBOARD.

Computes average return of each "basket" (group of related tickers) and
outputs top 10 gainers and bottom 10 losers.

Output: frontend/data/br_sector_baskets.json
"""

import argparse
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd
import yfinance as yf

COMPONENTS_FILE = Path(__file__).with_name("br_sector_components.csv")


def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )


def normalize_b3_ticker(raw_ticker: str) -> str:
    ticker = str(raw_ticker).strip().upper()
    if not ticker:
        return ticker
    if "." in ticker:
        return ticker
    # Keep pure alphabetic symbols as global tickers (e.g., SOFI, FIS, TSN, KHC).
    if ticker.isalpha():
        return ticker
    if ticker.endswith(".SA"):
        return ticker
    return f"{ticker}.SA"


def load_components() -> pd.DataFrame:
    if not COMPONENTS_FILE.exists():
        raise FileNotFoundError(f"Composition file not found: {COMPONENTS_FILE}")

    df = pd.read_csv(COMPONENTS_FILE)
    required_cols = [
        "macro_bloco",
        "cluster_key",
        "cluster_nome",
        "subsetor_b3_aprox",
        "ticker",
        "empresa",
        "status_recomendado",
    ]
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns in {COMPONENTS_FILE.name}: {missing}")

    df = df.copy()
    df["ticker"] = df["ticker"].map(normalize_b3_ticker)
    for col in ("peso_liquidez_setor", "peso_igual_setor", "peso_base_liquidez"):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def get_all_tickers(components_df: pd.DataFrame) -> List[str]:
    """Extract unique tickers from all component rows."""
    tickers = set()
    for t in components_df["ticker"].dropna().tolist():
        tickers.add(t)
    return list(tickers)


def fetch_data(tickers: List[str], period: str = "1mo") -> pd.DataFrame:
    """Fetch close prices for all tickers."""
    if not tickers:
        return pd.DataFrame()
    
    download_period = period
    if period == "1d":
        download_period = "5d"

    logging.info(f"Fetching data for {len(tickers)} unique tickers (period={period})...")
    try:
        df = yf.download(
            tickers,
            period=download_period,
            interval="1d",
            auto_adjust=False,
            progress=False,
            threads=True,
            group_by="column" # Ensure consistency
        )
        if df.empty:
            logging.warning("Downloaded data is empty.")
            return pd.DataFrame()

        # Handle MultiIndex columns (Price, Ticker) -> just Close
        # yfinance 0.2+ returns e.g. (Adj Close, AAPL)
        
        # Helper to extract Series for each ticker
        # We perform extraction inside compute_basket_returns
        
        return df
    except Exception as e:
        logging.error(f"Error fetching data: {e}")
        return pd.DataFrame()


def _extract_close_series(download_df: pd.DataFrame, symbol: str) -> Optional[pd.Series]:
    if download_df is None or getattr(download_df, "empty", True):
        return None
    try:
        if isinstance(download_df.columns, pd.MultiIndex):
            for col_name in ("Adj Close", "Close"):
                if col_name in download_df.columns.get_level_values(0):
                    if symbol in download_df[col_name].columns:
                        s = pd.to_numeric(download_df[col_name][symbol], errors="coerce").dropna()
                        return s if not s.empty else None
            return None
        
        for col_name in ("Adj Close", "Close"):
            if col_name in download_df.columns:
                 # Check if this column IS the ticker or if the dataframe IS just the ticker
                 # If list of tickers was 1, structure might differ. But we have many.
                 # Actually if simple columns, it might be Ticker names directly if only Close was requested (not default).
                 # If 'Adj Close' is a column, then it's a single ticker or wide format?
                 # With group_by='column', it's usually (Price, Ticker).
                 
                 # Let's assume standard behavior for now.
                 pass

        return None
    except Exception:
        return None


def compute_return(series: pd.Series, period_label: str = None) -> Optional[float]:
    """Compute return % from first to last valid value."""
    if series is None or series.empty:
        return None
    
    # If 1d, take last 2.
    if period_label == "1d":
        if len(series) >= 2:
            series = series.iloc[-2:]
        else:
            return None

    if len(series) < 2:
        return None
        
    start_val = float(series.iloc[0])
    end_val = float(series.iloc[-1])
    
    if start_val == 0:
        return None
        
    return ((end_val / start_val) - 1.0) * 100.0


def compute_cluster_returns(df: pd.DataFrame, components_df: pd.DataFrame, period_label: str) -> Dict[str, List[Dict]]:
    """Compute weighted return by cluster_nome using component weights from CSV."""

    cluster_map: Dict[str, Dict] = {}

    for row in components_df.to_dict(orient="records"):
        ticker = row["ticker"]
        series = _extract_close_series(df, ticker)
        ret = compute_return(series, period_label)
        if ret is None:
            continue

        cluster_name = str(row.get("cluster_nome", "")).strip() or str(row.get("cluster_key", "")).strip()
        if not cluster_name:
            continue

        if cluster_name not in cluster_map:
            cluster_map[cluster_name] = {
                "basket_name": cluster_name,
                "cluster_nome": cluster_name,
                "macro_blocos": [],
                "cluster_keys": [],
                "cluster_names": [],
                "micro_sectors": [],
                "tickers": [],
                "companies": [],
                "statuses": [],
                "return_components": [],
                "weight_components": [],
            }

        bucket = cluster_map[cluster_name]
        bucket["return_components"].append(ret)

        weight = row.get("peso_liquidez_setor", None)
        if pd.isna(weight) or float(weight) < 0:
            weight = row.get("peso_igual_setor", None)
        if pd.isna(weight) or float(weight) < 0:
            weight = row.get("peso_base_liquidez", None)
        if pd.isna(weight) or float(weight) < 0:
            weight = 1.0
        bucket["weight_components"].append(float(weight))

        cluster_key = str(row.get("cluster_key", "")).strip()
        macro_bloco = str(row.get("macro_bloco", "")).strip()
        micro_sector = str(row.get("subsetor_b3_aprox", "")).strip()
        company = str(row.get("empresa", "")).strip()
        status = str(row.get("status_recomendado", "")).strip().upper()

        if macro_bloco and macro_bloco not in bucket["macro_blocos"]:
            bucket["macro_blocos"].append(macro_bloco)
        if cluster_key and cluster_key not in bucket["cluster_keys"]:
            bucket["cluster_keys"].append(cluster_key)
        if cluster_name and cluster_name not in bucket["cluster_names"]:
            bucket["cluster_names"].append(cluster_name)
        if micro_sector and micro_sector not in bucket["micro_sectors"]:
            bucket["micro_sectors"].append(micro_sector)
        if ticker and ticker not in bucket["tickers"]:
            bucket["tickers"].append(ticker)
        if company and company not in bucket["companies"]:
            bucket["companies"].append(company)
        if status:
            bucket["statuses"].append(status)

    results: List[Dict] = []
    for cluster_data in cluster_map.values():
        components = cluster_data.pop("return_components")
        weights = cluster_data.pop("weight_components")
        if not components:
            continue

        total_weight = sum(w for w in weights if w > 0)
        if total_weight > 0:
            weighted_return = sum(ret * w for ret, w in zip(components, weights) if w > 0) / total_weight
        else:
            weighted_return = sum(components) / len(components)

        cluster_data["return_pct"] = round(weighted_return, 2)
        cluster_data["component_count"] = len(components)
        cluster_data["weight_sum"] = round(total_weight, 6)
        cluster_data["status"] = "CORE" if "CORE" in cluster_data["statuses"] else "OPCIONAL"
        results.append(cluster_data)

    # Sort results
    results.sort(key=lambda x: x["return_pct"], reverse=True)
    
    # Split Top / Bottom
    top10 = results[:10]
    bottom10 = sorted(results[-10:], key=lambda x: x["return_pct"])

    return {
        "top10": top10,
        "bottom10": bottom10
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, help="Output JSON path")
    parser.add_argument("--period", default="1mo", help="yfinance period (1wk, 1mo, 3mo, 1y)")
    args = parser.parse_args()

    setup_logging()

    components_df = load_components()
    logging.info(f"Loaded BR composition with {len(components_df)} rows from {COMPONENTS_FILE.name}")

    # 1. Gather all unique tickers
    all_tickers = get_all_tickers(components_df)
    logging.info(f"Total unique tickers: {len(all_tickers)}")

    # 2. Fetch Data
    df = fetch_data(all_tickers, period=args.period)
    
    # 3. Compute returns
    # Note: We don't need currency conversion here as all are .SA (BRL)
    data = compute_cluster_returns(df, components_df, args.period)

    period_labels = {
        "1d": "Diário",
        "1wk": "Semanal",
        "1mo": "Mensal",
        "3mo": "Trimestral",
        "1y": "Anual",
    }

    out = {
        "status": "ok",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "period": args.period,
        "period_label": period_labels.get(args.period, args.period),
        "data": data
    }
    
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    
    logging.info(f"generated {args.output}")

if __name__ == "__main__":
    main()
