"""Build das séries de PREÇO e RETORNO TOTAL (preço + proventos) dos FIIs do IFIX.

Output: data/fii_total_return.json (consumido por src/lib/painel-fii.ts).

Clone do build_acoes_total_return.py com o universo vindo da composição do
IFIX (B3 indexProxy, a mesma chamada do build_fii_screener). Em FII o retorno
total importa AINDA MAIS que em ação: o provento mensal é a maior parte do
retorno — comparar só preço engana.

Por FII, guardamos:
    series: [[date, close, adj_close], ...]
  onde close = só valorização (ajustado por desdobros) e adj_close = retorno
  total (proventos reinvestidos). Fonte: Yahoo Finance (auto_adjust=False).

Uso:
    python data-pipeline/python/build_fii_total_return.py --out-dir data-pipeline/out --upload
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

import pandas as pd

sys.path.append(str(Path(__file__).parent))
from shared.blob_upload import maybe_upload_json  # noqa: E402
from shared.blob_download import download_json  # noqa: E402
import build_fii_screener as scr  # noqa: E402  (reusa fetch_ifix_composition)
import build_acoes_total_return as tr  # noqa: E402  (reusa fetch_batch/_compact)

DEFAULT_LOOKBACK_YEARS = 5
DEFAULT_BATCH_SIZE = 25
BLOB_PATH = "data/fii_total_return.json"


def resolve_universe() -> List[str]:
    """Tickers .SA do IFIX; se a B3 falhar, cai pro universo já publicado no Blob."""
    try:
        comp = scr.fetch_ifix_composition()
        tickers = [f"{c['ticker']}.SA" for c in comp if c.get("ticker")]
        if tickers:
            return tickers
    except Exception as e:  # noqa: BLE001
        print(f"[fii_tr] B3 IFIX indisponível ({e}); usando universo do Blob", file=sys.stderr)
    prev = download_json(BLOB_PATH)
    if isinstance(prev, dict) and isinstance(prev.get("tickers"), dict):
        return list(prev["tickers"].keys())
    return []


def build_payload(lookback_years: int, batch_size: int) -> Dict:
    try:
        import yfinance as yf
    except ImportError:
        print("[fii_tr] yfinance não instalado. pip install yfinance", file=sys.stderr)
        return {"status": "error", "generated_at": datetime.now(timezone.utc).isoformat(), "tickers": {}}

    tickers = resolve_universe()
    if not tickers:
        return {"status": "error", "generated_at": datetime.now(timezone.utc).isoformat(), "tickers": {}}
    period = f"{lookback_years}y"
    print(f"[fii_tr] baixando {len(tickers)} FIIs do IFIX em batches de {batch_size}, período={period}")

    data: Dict[str, Dict[str, pd.Series]] = {}
    for i in range(0, len(tickers), batch_size):
        batch = tickers[i:i + batch_size]
        part = tr.fetch_batch(yf, batch, period)
        data.update(part)
        print(f"[fii_tr]  batch {i // batch_size + 1}: {len(part)}/{len(batch)} OK")

    missing = [t for t in tickers if t not in data]
    if missing:
        print(f"[fii_tr] retry individual em {len(missing)} FIIs: {missing[:10]}...")
        for t in missing:
            for _attempt in range(2):
                part = tr.fetch_batch(yf, [t], period)
                if part:
                    data.update(part)
                    break
                time.sleep(1.5)

    payload_tickers: Dict[str, Any] = {}
    for t in tickers:
        node = data.get(t)
        if not node:
            print(f"[fii_tr] sem dados: {t}", file=sys.stderr)
            continue
        series = tr._compact(node["close"], node["adj"])  # noqa: SLF001 (helper compartilhado)
        if len(series) < 2:
            continue
        payload_tickers[t] = {"series": series}

    run_count = len(payload_tickers)

    # Merge com o Blob (append-only): run parcial nunca derruba série boa.
    prev = download_json(BLOB_PATH)
    preserved = 0
    if isinstance(prev, dict) and isinstance(prev.get("tickers"), dict):
        for t, node in prev["tickers"].items():
            if t not in payload_tickers and isinstance(node, dict) and node.get("series"):
                payload_tickers[t] = node
                preserved += 1
    if preserved:
        print(f"[fii_tr] merge com Blob: {run_count} deste run + {preserved} preservados = {len(payload_tickers)}")

    print(f"[fii_tr] total com dados: {len(payload_tickers)}/{len(tickers)} (run={run_count})")
    return {
        "status": "ok" if payload_tickers else "error",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "Yahoo Finance via yfinance (Close + Adj Close, auto_adjust=False); universo B3 IFIX",
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
    out_path = out_dir / "fii_total_return.json"
    out_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(f"[fii_tr] Escreveu {out_path} ({out_path.stat().st_size:,} bytes)")

    if payload.get("status") == "error":
        print("[fii_tr] Status=error, não fará upload.", file=sys.stderr)
        return 1
    if args.upload:
        maybe_upload_json(out_path, BLOB_PATH)
    else:
        print("[fii_tr] --upload NÃO setado; apenas salvou local.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
