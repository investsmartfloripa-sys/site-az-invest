"""Build das séries de PREÇO e RETORNO TOTAL (preço + dividendos) das ações BR.

Output: data/acoes_total_return.json (consumido por src/lib/painel-acoes.ts).

Motivação: o histórico do painel (`market_history_full.json`) guarda apenas o
close AJUSTADO (auto_adjust=True), que já embute dividendos. Para mostrar as
DUAS curvas — "preço" (só valorização) e "preço + dividendos" (retorno total) —
precisamos do close SEM ajuste de proventos e do close ajustado, alinhados na
mesma data.

Por papel do catálogo (br_acoes), guardamos:
    series: [[date, close, adj_close], ...]
  onde
    close      = fechamento ajustado por splits, SEM dividendos (a curva "preço")
    adj_close  = fechamento ajustado por splits E dividendos (retorno total)

O frontend deriva a curva de retorno total ancorada no 1º preço da janela:
    tr[t] = close[0] * (adj_close[t] / adj_close[0])
e, na comparação com o Ibovespa (base 100), usa adj_close (retorno total justo).

Fonte: Yahoo Finance via yfinance (auto_adjust=False → Close + Adj Close).

Uso:
    python data-pipeline/python/build_acoes_total_return.py --out-dir data-pipeline/out --upload
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd

sys.path.append(str(Path(__file__).parent))
from shared.blob_upload import maybe_upload_json  # noqa: E402
from shared.blob_download import download_json  # noqa: E402
import market_catalog as mc  # noqa: E402

DEFAULT_LOOKBACK_YEARS = 5
DEFAULT_BATCH_SIZE = 25
MAX_POINTS = 2000


def _extract(df: pd.DataFrame, ticker: str, field: str) -> Optional[pd.Series]:
    """Extrai uma coluna (Close / Adj Close) de um DataFrame yfinance (mono ou multiindex)."""
    if df is None or df.empty:
        return None
    try:
        if isinstance(df.columns, pd.MultiIndex):
            if field in df.columns.get_level_values(0):
                sub = df[field]
                if ticker in sub.columns:
                    s = pd.to_numeric(sub[ticker], errors="coerce").dropna()
                    return s if not s.empty else None
            return None
        if field in df.columns:
            s = pd.to_numeric(df[field], errors="coerce").dropna()
            return s if not s.empty else None
    except Exception:  # noqa: BLE001
        return None
    return None


def fetch_batch(yf_module, tickers: List[str], period: str) -> Dict[str, Dict[str, pd.Series]]:
    """Baixa Close + Adj Close (auto_adjust=False) de vários tickers. Retorna {t: {close, adj}}."""
    try:
        df = yf_module.download(
            tickers=tickers,
            period=period,
            interval="1d",
            auto_adjust=False,   # queremos Close (só splits) E Adj Close (splits+div)
            actions=False,
            threads=True,
            progress=False,
            group_by="column",
        )
    except Exception as e:  # noqa: BLE001
        print(f"[tr] yf.download falhou no batch {tickers[:3]}...: {e}", file=sys.stderr)
        return {}
    out: Dict[str, Dict[str, pd.Series]] = {}
    for t in tickers:
        close = _extract(df, t, "Close")
        adj = _extract(df, t, "Adj Close")
        if close is not None and adj is not None and not close.empty and not adj.empty:
            out[t] = {"close": close, "adj": adj}
    return out


def _compact(close: pd.Series, adj: pd.Series, max_points: int = MAX_POINTS) -> List[List[Any]]:
    """Alinha close+adj pela data e compacta em [[date, close, adj], ...]."""
    df = pd.concat([close.rename("c"), adj.rename("a")], axis=1).dropna()
    if df.empty:
        return []
    if len(df) > max_points:
        step = max(1, len(df) // max_points)
        df = df.iloc[::step]
    out: List[List[Any]] = []
    for idx, row in df.iterrows():
        try:
            d = pd.Timestamp(idx).strftime("%Y-%m-%d")
            c = float(row["c"])
            a = float(row["a"])
            if c == c and a == a:  # filtra NaN
                out.append([d, round(c, 2), round(a, 4)])
        except Exception:  # noqa: BLE001
            continue
    return out


def build_payload(lookback_years: int, batch_size: int) -> Dict:
    try:
        import yfinance as yf
    except ImportError:
        print("[tr] yfinance não instalado. pip install yfinance", file=sys.stderr)
        return {"status": "error", "generated_at": datetime.now(timezone.utc).isoformat(), "tickers": {}}

    tickers = [a["ticker"] for a in mc.CATALOG if a.get("klass") == "br_acoes"]
    period = f"{lookback_years}y"
    print(f"[tr] baixando {len(tickers)} papéis br_acoes em batches de {batch_size}, período={period}")

    data: Dict[str, Dict[str, pd.Series]] = {}
    for i in range(0, len(tickers), batch_size):
        batch = tickers[i:i + batch_size]
        part = fetch_batch(yf, batch, period)
        data.update(part)
        print(f"[tr]  batch {i // batch_size + 1}: {len(part)}/{len(batch)} OK")

    # Passo de retry: papéis que faltaram (batch flakes / throttle transitório)
    # são rebaixados individualmente. Robustez p/ o runner de produção.
    import time as _time
    missing = [t for t in tickers if t not in data]
    if missing:
        print(f"[tr] retry individual em {len(missing)} papéis: {missing}")
        for t in missing:
            for attempt in range(2):
                part = fetch_batch(yf, [t], period)
                if part:
                    data.update(part)
                    break
                _time.sleep(1.5)

    payload_tickers: Dict[str, Any] = {}
    for t in tickers:
        node = data.get(t)
        if not node:
            print(f"[tr] sem dados: {t}", file=sys.stderr)
            continue
        series = _compact(node["close"], node["adj"])
        if len(series) < 2:
            continue
        payload_tickers[t] = {"series": series}

    run_count = len(payload_tickers)

    # Merge com o Blob: papéis que ESTE run não conseguiu (throttle do Yahoo,
    # 404 disfarçado) mantêm a série já publicada. Um run parcial só
    # ADICIONA/ATUALIZA — nunca derruba dado bom (mesma proteção do
    # build_market_history.py::merge_blob_fallback).
    prev = download_json("data/acoes_total_return.json")
    preserved = 0
    if isinstance(prev, dict) and isinstance(prev.get("tickers"), dict):
        for t, node in prev["tickers"].items():
            if t not in payload_tickers and isinstance(node, dict) and node.get("series"):
                payload_tickers[t] = node
                preserved += 1
    if preserved:
        print(f"[tr] merge com Blob: {run_count} deste run + {preserved} preservados = {len(payload_tickers)}")

    print(f"[tr] total com dados: {len(payload_tickers)}/{len(tickers)} (run={run_count})")
    return {
        "status": "ok" if payload_tickers else "error",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "Yahoo Finance via yfinance (Close + Adj Close, auto_adjust=False)",
        "schema": "series: [[date, close_split_adj, adj_close_total_return], ...]",
        "lookback_years": lookback_years,
        "tickers": payload_tickers,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lookback-years", type=int, default=DEFAULT_LOOKBACK_YEARS)
    ap.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    ap.add_argument("--out-dir", default="data-pipeline/out")
    ap.add_argument("--upload", action="store_true")
    args = ap.parse_args()

    payload = build_payload(args.lookback_years, args.batch_size)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "acoes_total_return.json"
    out_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(f"[tr] Escreveu {out_path} ({out_path.stat().st_size:,} bytes)")

    if payload.get("status") == "error":
        print("[tr] Status=error, não fará upload.", file=sys.stderr)
        return 1
    if args.upload:
        maybe_upload_json(out_path, "data/acoes_total_return.json")
    else:
        print("[tr] --upload NÃO setado; apenas salvou local.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
