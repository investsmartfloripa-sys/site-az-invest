"""Build a Top Movers table (day/week/month) for FX pairs + DXY using yfinance.

Output (JSON): frontend/data/fx_top_movers.json

Pairs are interpreted as BASE/QUOTE (e.g. BRL/USD). We try to download BASEQUOTE=X
from Yahoo; if missing, we try the inverse QUOTEBASE=X and invert prices.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import pandas as pd


@dataclass(frozen=True)
class Instrument:
    label: str
    direct: Optional[str] = None
    inverse: Optional[str] = None
    invert: bool = False


INSTRUMENTS: List[Instrument] = [
    # Requested pairs (BASE/QUOTE)
    Instrument(label="BRL / USD", direct="BRLUSD=X", inverse="USDBRL=X"),
    Instrument(label="EUR / USD", direct="EURUSD=X", inverse="USDEUR=X"),
    Instrument(label="GBP / USD", direct="GBPUSD=X", inverse="USDGBP=X"),
    Instrument(label="JPY / USD", direct="JPYUSD=X", inverse="USDJPY=X"),
    Instrument(label="CNY / USD", direct="CNYUSD=X", inverse="USDCNY=X"),
    Instrument(label="RUB / USD", direct="RUBUSD=X", inverse="USDRUB=X"),
    Instrument(label="MXN / USD", direct="MXNUSD=X", inverse="USDMXN=X"),
    Instrument(label="INR / USD", direct="INRUSD=X", inverse="USDINR=X"),
    Instrument(label="ARS / USD", direct="ARSUSD=X", inverse="USDARS=X"),
    Instrument(label="ZAR / USD", direct="ZARUSD=X", inverse="USDZAR=X"),
    Instrument(label="CLP / USD", direct="CLPUSD=X", inverse="USDCLP=X"),
    Instrument(label="COP / USD", direct="COPUSD=X", inverse="USDCOP=X"),
    # DXY
    Instrument(label="DXY", direct="DX-Y.NYB"),
]


def _extract_close_series(download_df: pd.DataFrame, symbol: str) -> Optional[pd.Series]:
    if download_df is None or getattr(download_df, "empty", True):
        return None
    try:
        if isinstance(download_df.columns, pd.MultiIndex):
            # Common: level 0 = OHLCV, level 1 = ticker
            if "Close" in download_df.columns.get_level_values(0):
                close_df = download_df["Close"]
                if symbol in close_df.columns:
                    s = pd.to_numeric(close_df[symbol], errors="coerce").dropna()
                    return s if not s.empty else None

            # Alternate: level 0 = ticker, level 1 = OHLCV
            if "Close" in download_df.columns.get_level_values(1):
                try:
                    close_df = download_df.xs("Close", axis=1, level=1)
                    if symbol in close_df.columns:
                        s = pd.to_numeric(close_df[symbol], errors="coerce").dropna()
                        return s if not s.empty else None
                except Exception:
                    return None
            return None

        # Single-symbol download
        if "Close" in download_df.columns:
            s = pd.to_numeric(download_df["Close"], errors="coerce").dropna()
            return s if not s.empty else None
        return None
    except Exception:
        return None


def _download_closes(symbols: List[str], period: str) -> Dict[str, pd.Series]:
    if not symbols:
        return {}
    try:
        import yfinance as yf  # type: ignore
    except Exception:
        print("[ERROR] yfinance não instalado. Instale: pip install yfinance", file=sys.stderr)
        return {}

    try:
        dl = yf.download(
            tickers=symbols,
            period=period,
            interval="1d",
            auto_adjust=False,
            threads=True,
            progress=False,
            group_by="column",
        )
    except Exception as e:
        print(f"[WARN] Falha ao baixar dados via yfinance: {e}", file=sys.stderr)
        return {}

    out: Dict[str, pd.Series] = {}
    for sym in symbols:
        s = _extract_close_series(dl, sym)
        if s is not None and not s.empty:
            out[sym] = s
    return out


def _build_prices_df(instruments: List[Instrument], period: str) -> Tuple[pd.DataFrame, List[str]]:
    direct_syms = [i.direct for i in instruments if i.direct]
    direct_data = _download_closes(direct_syms, period=period)

    missing_inverse: List[str] = []
    for ins in instruments:
        if ins.direct and ins.direct in direct_data:
            continue
        if ins.inverse:
            missing_inverse.append(ins.inverse)

    inverse_data = _download_closes(sorted(set(missing_inverse)), period=period)

    points: List[Dict] = []
    warnings: List[str] = []

    for ins in instruments:
        series: Optional[pd.Series] = None
        used_symbol: Optional[str] = None
        invert = False

        if ins.direct and ins.direct in direct_data:
            series = direct_data[ins.direct]
            used_symbol = ins.direct
        elif ins.inverse and ins.inverse in inverse_data:
            series = inverse_data[ins.inverse]
            used_symbol = ins.inverse
            invert = True
        else:
            warnings.append(f"Sem dados: {ins.label}")
            continue

        s = pd.to_numeric(series, errors="coerce").dropna()
        s = s[s > 0]
        if s.empty:
            warnings.append(f"Sem dados válidos: {ins.label} ({used_symbol})")
            continue

        if invert:
            s = 1.0 / s

        idx = pd.to_datetime(s.index, errors="coerce")
        for ts, v in zip(idx, s.values):
            if pd.isna(ts):
                continue
            points.append(
                {
                    "ticker": ins.label,
                    "date": pd.Timestamp(ts).normalize(),
                    "close": float(v),
                }
            )

    df = pd.DataFrame(points)
    if df.empty:
        return df, warnings

    df = df.dropna(subset=["ticker", "date", "close"])
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df["close"] = pd.to_numeric(df["close"], errors="coerce")
    df = df.dropna(subset=["ticker", "date", "close"])
    df = df.sort_values(["ticker", "date"]).reset_index(drop=True)
    return df, warnings


def compute_top_movers(df: pd.DataFrame, shift_n: int, top_n: int) -> Dict:
    g = df.groupby("ticker", sort=False)

    df2 = df.copy()
    df2["prev_close"] = g["close"].shift(shift_n)
    df2["prev_date"] = g["date"].shift(shift_n)

    last = df2.groupby("ticker", sort=False).tail(1)
    last = last.dropna(subset=["prev_close", "prev_date"])
    last = last[last["prev_close"] > 0]
    last["change_pct"] = (last["close"] / last["prev_close"] - 1.0) * 100.0

    up = last.sort_values("change_pct", ascending=False).head(top_n)
    down = last.sort_values("change_pct", ascending=True).head(top_n)

    def to_rows(frame: pd.DataFrame) -> List[Dict]:
        rows: List[Dict] = []
        for _, r in frame.iterrows():
            rows.append(
                {
                    "ticker": str(r["ticker"]),
                    "last_date": pd.Timestamp(r["date"]).date().isoformat(),
                    "last_close": float(r["close"]),
                    "prev_date": pd.Timestamp(r["prev_date"]).date().isoformat(),
                    "prev_close": float(r["prev_close"]),
                    "change_pct": float(r["change_pct"]),
                }
            )
        return rows

    asof = pd.Timestamp(df["date"].max()).date().isoformat() if not df.empty else None
    return {"asof": asof, "up": to_rows(up), "down": to_rows(down)}


def main() -> int:
    ap = argparse.ArgumentParser(description="Build FX/DXY top movers JSON")
    ap.add_argument(
        "--output",
        default="frontend/data/fx_top_movers.json",
        help="Output JSON path",
    )
    ap.add_argument(
        "--top",
        type=int,
        default=10,
        help="How many tickers per side (up/down) per period",
    )
    ap.add_argument(
        "--period",
        default="2y",
        help="yfinance period to download (e.g. 3mo, 6mo, 1y)",
    )
    args = ap.parse_args()

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)

    df, warnings = _build_prices_df(INSTRUMENTS, period=args.period)

    if df.empty:
        # Falha total do Yahoo: sem este guard, df.groupby("ticker") lança KeyError
        # antes do caminho de status "error". Gera payload de erro explícito;
        # quem publica no Blob (run_panorama_builds) ignora payloads status != ok,
        # então o dado bom existente é preservado.
        print("[WARN] nenhum dado de FX retornado — payload status=error, sem upload destrutivo", file=sys.stderr)
        payload_err: Dict = {
            "status": "error",
            "generated_at": pd.Timestamp.utcnow().isoformat(),
            "source": "yfinance",
            "period": args.period,
            "warnings": warnings,
            "top": {},
        }
        out.write_text(json.dumps(payload_err, ensure_ascii=False, indent=2), encoding="utf-8")
        return 2

    payload: Dict = {
        "status": "ok" if not df.empty else "error",
        "generated_at": pd.Timestamp.utcnow().isoformat(),
        "source": "yfinance",
        "period": args.period,
        "warnings": warnings,
        "top": {
            "day": compute_top_movers(df, shift_n=1, top_n=args.top),
            "week": compute_top_movers(df, shift_n=5, top_n=args.top),
            "month": compute_top_movers(df, shift_n=21, top_n=args.top),
            # ~3 months of trading days
            "quarter": compute_top_movers(df, shift_n=63, top_n=args.top),
            # ~1 year of trading days (approx. 252)
            "year": compute_top_movers(df, shift_n=252, top_n=args.top),
        },
    }

    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0 if payload["status"] == "ok" else 2


if __name__ == "__main__":
    raise SystemExit(main())
