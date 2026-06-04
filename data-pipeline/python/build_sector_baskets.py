"""Build Sector Baskets ranking JSON for the SANDBOX tab.

Computes average return of each "basket" (group of related tickers) and
outputs top 10 gainers and bottom 10 losers.

Output: frontend/data/sector_baskets.json
"""

import argparse
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd
import yfinance as yf

# Macro/micro composition for Global Sectors (Top / Bottom 10)
SECTOR_COMPONENTS = [
    {"status": "CORE", "macro_bloco": "Tecnologia", "micro_setor": "Semicondutores", "ticker": "SMH", "nome_etf": "VanEck Semiconductor ETF"},
    {"status": "CORE", "macro_bloco": "Tecnologia", "micro_setor": "Software", "ticker": "IGV", "nome_etf": "iShares Expanded Tech-Software Sector ETF"},
    {"status": "CORE", "macro_bloco": "Tecnologia", "micro_setor": "Cloud Computing", "ticker": "SKYY", "nome_etf": "First Trust Cloud Computing ETF"},
    {"status": "CORE", "macro_bloco": "Tecnologia", "micro_setor": "Cybersecurity", "ticker": "CIBR", "nome_etf": "First Trust Nasdaq Cybersecurity ETF"},
    {"status": "CORE", "macro_bloco": "Tecnologia", "micro_setor": "Internet", "ticker": "FDN", "nome_etf": "First Trust Dow Jones Internet Index Fund"},
    {"status": "CORE", "macro_bloco": "Tecnologia", "micro_setor": "E-commerce / Online Retail", "ticker": "IBUY", "nome_etf": "Amplify Online Retail ETF"},
    {"status": "CORE", "macro_bloco": "Tecnologia", "micro_setor": "Fintech", "ticker": "FINX", "nome_etf": "Global X FinTech ETF"},
    {"status": "CORE", "macro_bloco": "Tecnologia", "micro_setor": "Blockchain", "ticker": "BKCH", "nome_etf": "Global X Blockchain ETF"},
    {"status": "CORE", "macro_bloco": "Tecnologia", "micro_setor": "Inteligência Artificial", "ticker": "AIQ", "nome_etf": "Global X Artificial Intelligence & Technology ETF"},
    {"status": "CORE", "macro_bloco": "Tecnologia", "micro_setor": "Robótica e Automação", "ticker": "BOTZ", "nome_etf": "Global X Robotics & Artificial Intelligence ETF"},
    {"status": "CORE", "macro_bloco": "Comunicação", "micro_setor": "Telecom", "ticker": "IYZ", "nome_etf": "iShares U.S. Telecommunications ETF"},
    {"status": "CORE", "macro_bloco": "Infraestrutura Digital", "micro_setor": "Data Centers / Towers / Digital Infra", "ticker": "IDGT", "nome_etf": "iShares U.S. Digital Infrastructure and Real Estate ETF"},
    {"status": "OPCIONAL", "macro_bloco": "Entretenimento Digital", "micro_setor": "Video Games / eSports", "ticker": "ESPO", "nome_etf": "VanEck Video Gaming and eSports ETF"},
    {"status": "CORE", "macro_bloco": "Indústria", "micro_setor": "Aeroespacial e Defesa", "ticker": "XAR", "nome_etf": "SPDR S&P Aerospace & Defense ETF"},
    {"status": "CORE", "macro_bloco": "Transporte", "micro_setor": "Transporte Diversificado", "ticker": "XTN", "nome_etf": "SPDR S&P Transportation ETF"},
    {"status": "CORE", "macro_bloco": "Transporte", "micro_setor": "Companhias Aéreas", "ticker": "JETS", "nome_etf": "U.S. Global Jets ETF"},
    {"status": "CORE", "macro_bloco": "Consumo Cíclico", "micro_setor": "Homebuilders / Housing Ecosystem", "ticker": "XHB", "nome_etf": "SPDR S&P Homebuilders ETF"},
    {"status": "CORE", "macro_bloco": "Consumo Cíclico", "micro_setor": "Retail", "ticker": "XRT", "nome_etf": "SPDR S&P Retail ETF"},
    {"status": "CORE", "macro_bloco": "Consumo Cíclico", "micro_setor": "Leisure & Entertainment", "ticker": "PEJ", "nome_etf": "Invesco Leisure and Entertainment ETF"},
    {"status": "CORE", "macro_bloco": "Consumo", "micro_setor": "Food & Beverage", "ticker": "PBJ", "nome_etf": "Invesco Food & Beverage ETF"},
    {"status": "CORE", "macro_bloco": "Mobilidade", "micro_setor": "EVs / Autonomous Vehicles", "ticker": "DRIV", "nome_etf": "Global X Autonomous & Electric Vehicles ETF"},
    {"status": "CORE", "macro_bloco": "Energia", "micro_setor": "Oil & Gas E&P", "ticker": "XOP", "nome_etf": "SPDR S&P Oil & Gas Exploration & Production ETF"},
    {"status": "CORE", "macro_bloco": "Energia", "micro_setor": "Oil Services / Drilling", "ticker": "XES", "nome_etf": "SPDR S&P Oil & Gas Equipment & Services ETF"},
    {"status": "CORE", "macro_bloco": "Energia", "micro_setor": "Solar", "ticker": "TAN", "nome_etf": "Invesco Solar ETF"},
    {"status": "CORE", "macro_bloco": "Energia", "micro_setor": "Uranium / Nuclear Fuel Miners", "ticker": "URNM", "nome_etf": "Sprott Uranium Miners ETF"},
    {"status": "CORE", "macro_bloco": "Utilities / Recursos", "micro_setor": "Water", "ticker": "PHO", "nome_etf": "Invesco Water Resources ETF"},
    {"status": "CORE", "macro_bloco": "Agro", "micro_setor": "Agribusiness", "ticker": "MOO", "nome_etf": "VanEck Agribusiness ETF"},
    {"status": "CORE", "macro_bloco": "Materiais", "micro_setor": "Copper Miners", "ticker": "COPX", "nome_etf": "Global X Copper Miners ETF"},
    {"status": "CORE", "macro_bloco": "Materiais", "micro_setor": "Gold Miners", "ticker": "GDX", "nome_etf": "VanEck Gold Miners ETF"},
    {"status": "CORE", "macro_bloco": "Materiais", "micro_setor": "Silver Miners", "ticker": "SIL", "nome_etf": "Global X Silver Miners ETF"},
    {"status": "CORE", "macro_bloco": "Materiais", "micro_setor": "Steel", "ticker": "SLX", "nome_etf": "VanEck Steel ETF"},
    {"status": "OPCIONAL", "macro_bloco": "Materiais Estratégicos", "micro_setor": "Rare Earths / Strategic Metals", "ticker": "REMX", "nome_etf": "VanEck Rare Earth and Strategic Metals ETF"},
    {"status": "OPCIONAL", "macro_bloco": "Baterias", "micro_setor": "Lithium & Battery Tech", "ticker": "BATT", "nome_etf": "Amplify Lithium & Battery Technology ETF"},
    {"status": "OPCIONAL", "macro_bloco": "Renováveis", "micro_setor": "Clean Energy Broad", "ticker": "PBW", "nome_etf": "Invesco WilderHill Clean Energy ETF"},
    {"status": "OPCIONAL", "macro_bloco": "Renováveis", "micro_setor": "Wind Energy", "ticker": "FAN", "nome_etf": "First Trust Global Wind Energy ETF"},
    {"status": "CORE", "macro_bloco": "Saúde", "micro_setor": "Biotech", "ticker": "XBI", "nome_etf": "SPDR S&P Biotech ETF"},
    {"status": "CORE", "macro_bloco": "Saúde", "micro_setor": "Pharmaceuticals", "ticker": "XPH", "nome_etf": "SPDR S&P Pharmaceuticals ETF"},
    {"status": "CORE", "macro_bloco": "Saúde", "micro_setor": "Medical Devices", "ticker": "IHI", "nome_etf": "iShares U.S. Medical Devices ETF"},
    {"status": "CORE", "macro_bloco": "Saúde", "micro_setor": "Healthcare Providers", "ticker": "IHF", "nome_etf": "iShares U.S. Healthcare Providers ETF"},
    {"status": "CORE", "macro_bloco": "Saúde", "micro_setor": "Genomics / Immunology / Bioengineering", "ticker": "IDNA", "nome_etf": "iShares Genomics Immunology and Healthcare ETF"},
    {"status": "CORE", "macro_bloco": "Financeiro", "micro_setor": "Regional Banks", "ticker": "KRE", "nome_etf": "SPDR S&P Regional Banking ETF"},
    {"status": "CORE", "macro_bloco": "Financeiro", "micro_setor": "Insurance", "ticker": "KIE", "nome_etf": "SPDR S&P Insurance ETF"},
    {"status": "CORE", "macro_bloco": "Financeiro", "micro_setor": "Capital Markets / Brokers / Exchanges", "ticker": "KCE", "nome_etf": "SPDR S&P Capital Markets ETF"},
    {"status": "CORE", "macro_bloco": "Imobiliário", "micro_setor": "Industrial REITs / Logistics", "ticker": "INDS", "nome_etf": "Pacer Industrial Real Estate ETF"},
    {"status": "CORE", "macro_bloco": "Imobiliário", "micro_setor": "Residential / Healthcare / Self-Storage REITs", "ticker": "REZ", "nome_etf": "iShares Residential and Multisector Real Estate ETF"},
    {"status": "CORE", "macro_bloco": "Imobiliário", "micro_setor": "Mortgage REITs", "ticker": "REM", "nome_etf": "iShares Mortgage Real Estate ETF"},
]



def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )


def get_all_tickers() -> List[str]:
    """Extract unique tickers from all sector components and add FX rates."""
    tickers = set()
    for component in SECTOR_COMPONENTS:
        tickers.add(component["ticker"])
    
    # Add conversion rates if not present
    tickers.add("BRL=X")
    tickers.add("EURUSD=X")
    tickers.add("GBPUSD=X")
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
            threads=True
        )
        if df.empty:
            logging.warning("Downloaded data is empty.")
            return pd.DataFrame()

        # Handle MultiIndex columns (Price, Ticker) -> just Close
        if isinstance(df.columns, pd.MultiIndex):
            if 'Adj Close' in df.columns.get_level_values(0):
                df = df['Adj Close']
            elif 'Close' in df.columns.get_level_values(0):
                df = df['Close']
            else:
                df = df['Close']

        if isinstance(df, pd.Series):
            df = df.to_frame()

        return df
    except Exception as e:
        logging.error(f"Error fetching data: {e}")
        return pd.DataFrame()


def compute_return(series: pd.Series, period_label: str = None) -> Optional[float]:
    """Compute return % from first to last valid value."""
    valid = series.dropna()
    
    if period_label == "1d" and len(valid) >= 2:
        valid = valid.iloc[-2:]

    if len(valid) < 2:
        return None
    start_val = valid.iloc[0]
    end_val = valid.iloc[-1]
    if start_val == 0 or not pd.notna(start_val):
        return None
    return ((end_val / start_val) - 1) * 100.0


def get_adjusted_return(df: pd.DataFrame, ticker: str, target_currency: str, period_label: str = None) -> Optional[float]:
    """Compute return for a ticker converted to target_currency (BRL or USD)."""
    if ticker not in df.columns:
        return None

    series = df[ticker]
    
    # If ticker is an FX rate (contains =X), do not convert (return raw performance of the pair)
    if "=X" in ticker and ticker not in ['EURUSD=X', 'GBPUSD=X', 'JPY=X']: 
        return compute_return(series, period_label)

    # 1. Identify Source Currency
    if ticker.endswith('.SA') or ticker == '^BVSP':
        source = 'BRL'
    elif ticker in ['^GDAXI', '^FCHI']:
        source = 'EUR'
    elif ticker == '^FTSE':
        source = 'GBP'
    elif ticker == '^N225':
        source = 'JPY'
    elif ticker == '^NSEI':
        source = 'INR'
    elif ticker == '000001.SS':
        source = 'CNY'
    else:
        source = 'USD' # Default

    if source == target_currency:
        return compute_return(series, period_label)

    # Helper to get rate series safely
    def get_rate(rate_ticker):
        if rate_ticker in df.columns:
            return df[rate_ticker]
        return None

    # 2. Convert Source -> USD (intermediate)
    series_usd = series.copy()
    
    if source == 'BRL':
        rate = get_rate('BRL=X')
        if rate is not None: series_usd = series / rate
    elif source == 'EUR':
        rate = get_rate('EURUSD=X')
        if rate is not None: series_usd = series * rate
    elif source == 'GBP':
        rate = get_rate('GBPUSD=X')
        if rate is not None: series_usd = series * rate
    elif source == 'JPY':
        rate = get_rate('JPY=X')
        if rate is not None: series_usd = series / rate
    elif source == 'INR':
        rate = get_rate('INR=X')
        if rate is not None: series_usd = series / rate
    elif source == 'CNY':
        rate = get_rate('CNY=X')
        if rate is not None: series_usd = series / rate
    
    if target_currency == 'USD':
        return compute_return(series_usd, period_label)

    # 3. Convert USD -> BRL
    if target_currency == 'BRL':
        rate = get_rate('BRL=X')
        if rate is not None:
             series_brl = series_usd * rate
             return compute_return(series_brl, period_label)

    return compute_return(series, period_label)


def compute_basket_returns(df: pd.DataFrame, period_label: str) -> Dict[str, List[Dict]]:
    """Compute macro block return as arithmetic mean of available micro sectors."""

    def build_view(target_currency: str) -> List[Dict]:
        macro_map: Dict[str, Dict] = {}

        for component in SECTOR_COMPONENTS:
            ticker = component["ticker"]
            ret = get_adjusted_return(df, ticker, target_currency, period_label)
            if ret is None:
                continue

            macro = component["macro_bloco"]
            micro = component["micro_setor"]

            if macro not in macro_map:
                macro_map[macro] = {
                    "basket_name": macro,
                    "macro_bloco": macro,
                    "return_components": [],
                    "micro_sectors": [],
                    "tickers": [],
                    "etf_names": [],
                    "statuses": [],
                }

            macro_map[macro]["return_components"].append(ret)
            macro_map[macro]["micro_sectors"].append(micro)
            macro_map[macro]["tickers"].append(ticker)
            macro_map[macro]["etf_names"].append(component["nome_etf"])
            macro_map[macro]["statuses"].append(component["status"])

        results: List[Dict] = []
        for macro_data in macro_map.values():
            components = macro_data.pop("return_components")
            if not components:
                continue

            macro_data["return_pct"] = round(sum(components) / len(components), 2)
            macro_data["micro_sector_count"] = len(macro_data["micro_sectors"])
            macro_data["status"] = "CORE" if "CORE" in macro_data["statuses"] else "OPCIONAL"
            results.append(macro_data)

        return results

    return {
        "view_brl": build_view("BRL"),
        "view_usd": build_view("USD"),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, help="Output JSON path")
    parser.add_argument("--period", default="1mo", help="yfinance period (1wk, 1mo, 3mo, 1y)")
    args = parser.parse_args()

    setup_logging()

    # 1. Gather all unique tickers
    all_tickers = get_all_tickers()
    logging.info(f"Total unique tickers: {len(all_tickers)}")

    # 2. Fetch Data
    df = fetch_data(all_tickers, period=args.period)
    if df.empty:
        logging.error("No data fetched.")
        # Output empty structure
        out = {
            "status": "error",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "period": args.period,
            "view_brl": {"top10": [], "bottom10": []},
            "view_usd": {"top10": [], "bottom10": []}
        }
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=2)
        return

    # 3. Compute basket returns
    basket_returns_map = compute_basket_returns(df, args.period)

    if not basket_returns_map["view_brl"] and not basket_returns_map["view_usd"]:
        logging.error("No basket returns computed.")
        out = {
            "status": "error",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "period": args.period,
            "view_brl": {"top10": [], "bottom10": []},
            "view_usd": {"top10": [], "bottom10": []}
        }
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=2)
        return

    # 4. Sort and pick top 10 / bottom 10 for both views
    def process_view(items):
        sorted_items = sorted(items, key=lambda x: x["return_pct"], reverse=True)
        return {
            "top10": sorted_items[:10],
            "bottom10": sorted_items[-10:][::-1]
        }
    
    view_brl = process_view(basket_returns_map["view_brl"])
    view_usd = process_view(basket_returns_map["view_usd"])

    # 5. Build output
    data = {
        "status": "ok",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "period": args.period,
        "period_label": {
            "1d": "Diário",
            "1wk": "Semanal",
            "1mo": "Mensal",
            "3mo": "Trimestral",
            "1y": "Anual"
        }.get(args.period, args.period),
        "view_brl": view_brl,
        "view_usd": view_usd
    }

    # 6. Save
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    logging.info(f"Sector baskets data saved to {out_path}")


if __name__ == "__main__":
    main()
