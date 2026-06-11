"""Build commodities returns chart JSON for PANORAMA.

Output (JSON): frontend/data/commodities_returns.json
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List, Optional
import pandas as pd
from datetime import datetime, timezone

# Metadata provided by user
COMMODITIES = {
    "ZC=F": {"Nome": "Milho", "Bolsa": "Chicago (CBOT)", "Setor": "Agrícola"},
    "ZS=F": {"Nome": "Soja", "Bolsa": "Chicago (CBOT)", "Setor": "Agrícola"},
    "ZW=F": {"Nome": "Trigo", "Bolsa": "Chicago (CBOT)", "Setor": "Agrícola"},
    "LE=F": {"Nome": "Boi Gordo", "Bolsa": "Chicago (CME)", "Setor": "Pecuária"},
    "HE=F": {"Nome": "Suínos", "Bolsa": "Chicago (CME)", "Setor": "Pecuária"},
    
    "KC=F": {"Nome": "Café", "Bolsa": "Nova York (ICE)", "Setor": "Softs"},
    "SB=F": {"Nome": "Açúcar", "Bolsa": "Nova York (ICE)", "Setor": "Softs"},
    "CT=F": {"Nome": "Algodão", "Bolsa": "Nova York (ICE)", "Setor": "Softs"},
    
    "CL=F": {"Nome": "Petróleo WTI", "Bolsa": "NYMEX", "Setor": "Energia"},
    "NG=F": {"Nome": "Gás Natural", "Bolsa": "NYMEX", "Setor": "Energia"},
    "GC=F": {"Nome": "Ouro", "Bolsa": "COMEX", "Setor": "Metais"},
    "SI=F": {"Nome": "Prata", "Bolsa": "COMEX", "Setor": "Metais"},
    "HG=F": {"Nome": "Cobre", "Bolsa": "COMEX", "Setor": "Metais"},
    "TIO=F": {"Nome": "Minério de Ferro", "Bolsa": "SGX", "Setor": "Metais"},
    "PA=F": {"Nome": "Paládio", "Bolsa": "COMEX", "Setor": "Metais"},
    "PL=F": {"Nome": "Platina", "Bolsa": "COMEX", "Setor": "Metais"},
    
    "BZ=F": {"Nome": "Petróleo Brent", "Bolsa": "Londres (ICE)", "Setor": "Energia"},
}

def _extract_close_series(download_df: pd.DataFrame, symbol: str) -> Optional[pd.Series]:
    if download_df is None or getattr(download_df, "empty", True):
        return None
    try:
        # yfinance (multi-ticker) returns MultiIndex columns: (Attribute, Ticker)
        # We prefer "Adj Close", fallback to "Close"
        if isinstance(download_df.columns, pd.MultiIndex):
            for col_name in ("Adj Close", "Close"):
                if col_name in download_df.columns.get_level_values(0):
                    # Check if symbol exists in this level
                    if symbol in download_df[col_name].columns:
                        s = pd.to_numeric(download_df[col_name][symbol], errors="coerce").dropna()
                        return s if not s.empty else None
            return None
        
        # Single ticker structure (unlikely here, but good practice) or unexpected structure
        for col_name in ("Adj Close", "Close"):
            if col_name in download_df.columns:
                s = pd.to_numeric(download_df[col_name], errors="coerce").dropna()
                return s if not s.empty else None
        return None
    except Exception:
        return None

def compute_returns(period: str = "1mo") -> List[Dict]:
    try:
        import yfinance as yf
    except ImportError:
        print("[ERROR] yfinance não instalado.", file=sys.stderr)
        return []

    # Get commodity tickers plus USD/BRL for conversion
    tickers = list(COMMODITIES.keys()) + ["BRL=X"]
    
    download_period = period
    if period == "1d":
        download_period = "5d"

    try:
        print(f"Baixando dados para {len(tickers)} ativos ({period})...")
        dl = yf.download(
            tickers=tickers,
            period=download_period,
            interval="1d",
            auto_adjust=False,
            threads=True,
            progress=False,
            group_by="column",
        )
    except Exception as e:
        print(f"[WARN] Falha ao baixar dados: {e}", file=sys.stderr)
        return []

    # Calculate FX return (USD appreciation vs BRL)
    fx_ret = 0.0
    fx_series = _extract_close_series(dl, "BRL=X")

    if period == "1d" and fx_series is not None and len(fx_series) >= 2:
        fx_series = fx_series.iloc[-2:]

    if fx_series is not None and len(fx_series) >= 2:
        f_start = float(fx_series.iloc[0])
        f_end = float(fx_series.iloc[-1])
        if f_start > 0:
            fx_ret = (f_end - f_start) / f_start

    results: List[Dict] = []

    for ticker, meta in COMMODITIES.items():
        name = meta["Nome"]
        sector = meta["Setor"]
        
        series = _extract_close_series(dl, ticker)

        if period == "1d" and series is not None and len(series) >= 2:
            series = series.iloc[-2:]

        if series is None or len(series) < 2:
            print(f"[WARN] Sem dados para {name} ({ticker})", file=sys.stderr)
            continue

        first = float(series.iloc[0])
        last = float(series.iloc[-1])

        if first <= 0:
            print(f"[WARN] Preço inicial inválido para {name}: {first}", file=sys.stderr)
            continue

        ret_pct_usd = ((last - first) / first) * 100.0
        
        # BRL return compounds asset return (in USD) with USD appreciation
        # (1 + r_usd) * (1 + r_fx) - 1
        ret_pct_brl = ((1 + ret_pct_usd/100.0) * (1 + fx_ret) - 1) * 100.0

        results.append({
            "name": name,
            "ticker": ticker,
            "sector": sector,
            "exchange": meta["Bolsa"],
            "return_pct_usd": round(ret_pct_usd, 2), # Explicit USD return
            "return_pct_brl": round(ret_pct_brl, 2), # Explicit BRL return
            "return_pct": round(ret_pct_usd, 2),     # Keep backward compatibility (default USD)
            "first_close": round(first, 4),
            "last_close": round(last, 4),
        })
        
    # Sort by USD return descending by default
    results.sort(key=lambda x: x["return_pct_usd"], reverse=True)
    return results

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--period", default="1mo", help="Period to download (1wk, 1mo, 3mo, 1y)")
    parser.add_argument("--output", required=True, help="Path for the output JSON")
    args = parser.parse_args()

    data = compute_returns(args.period)

    if not data:
        print("[WARN] payload vazio (yfinance falhou?) — status=error para o upload não sobrescrever dado bom no Blob", file=sys.stderr)

    payload = {
        "status": "ok" if data else "error",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "period": args.period,
        "data": data,
        "colors": {
            "positive": "#2ECC71",
            "negative": "#E74C3C"
        }
    }

    try:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        print(f"JSON salvo em: {args.output}")
    except Exception as e:
        print(f"[ERROR] Falha ao salvar JSON: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
