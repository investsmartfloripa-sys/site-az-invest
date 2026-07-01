"""Build do mapa de logos das ações brasileiras (universo do catálogo br_acoes).

Output: data/acoes_logos.json (consumido por src/lib/painel-acoes.ts).

Fonte: endpoint público de busca de símbolos do TradingView
(`symbol-search.tradingview.com`), que devolve o `logoid` oficial de cada
papel. O SVG fica em `https://s3-symbol-logo.tradingview.com/{logoid}--big.svg`
(alta qualidade, sem chave de API). Cada URL é verificada antes de entrar no
mapa; papéis sem logo simplesmente ficam de fora (o frontend cai no badge de
iniciais).

Uso:
    python data-pipeline/python/build_acoes_logos.py --out-dir data-pipeline/out --upload
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional

import requests

sys.path.append(str(Path(__file__).parent))
from shared.blob_upload import maybe_upload_json  # noqa: E402
from shared.blob_download import download_json  # noqa: E402
import market_catalog as mc  # noqa: E402

UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0",
    "Origin": "https://www.tradingview.com",
    "Referer": "https://www.tradingview.com/",
    "Accept": "application/json",
}
SEARCH_URL = "https://symbol-search.tradingview.com/symbol_search/"
LOGO_BASE = "https://s3-symbol-logo.tradingview.com"


def resolve_logoid(ticker_bare: str) -> Optional[str]:
    """Consulta o symbol-search do TradingView e devolve o logoid do papel."""
    try:
        r = requests.get(
            SEARCH_URL,
            params={"text": ticker_bare, "exchange": "BMFBOVESPA", "type": "stock", "lang": "en"},
            headers=UA,
            timeout=20,
        )
        r.raise_for_status()
        data = json.loads(r.text)
    except Exception as e:  # noqa: BLE001
        print(f"[logos] search FAIL {ticker_bare}: {repr(e)[:100]}", file=sys.stderr)
        return None
    if not isinstance(data, list) or not data:
        return None
    # Prefere o match exato do símbolo; senão o 1º resultado.
    for d in data:
        if str(d.get("symbol", "")).upper() == ticker_bare.upper() and d.get("logoid"):
            return d["logoid"]
    return data[0].get("logoid") or None


def logo_url_ok(logoid: str) -> Optional[str]:
    """Confirma que o SVG existe; devolve a URL --big preferencialmente."""
    for suffix in ("--big.svg", ".svg"):
        url = f"{LOGO_BASE}/{logoid}{suffix}"
        try:
            r = requests.get(url, headers=UA, timeout=15)
            if r.status_code == 200 and b"svg" in r.content[:400].lower():
                return url
        except Exception:  # noqa: BLE001
            continue
    return None


def build_payload() -> Dict:
    tickers_bare = [
        a["ticker"].replace(".SA", "")
        for a in mc.CATALOG
        if a.get("klass") == "br_acoes"
    ]
    print(f"[logos] resolvendo {len(tickers_bare)} papéis br_acoes...")
    logos: Dict[str, str] = {}
    for i, tk in enumerate(tickers_bare):
        lid = resolve_logoid(tk)
        url = logo_url_ok(lid) if lid else None
        if url:
            logos[tk] = url
        else:
            print(f"[logos] sem logo: {tk} (logoid={lid})", file=sys.stderr)
        if (i + 1) % 20 == 0:
            print(f"[logos]  {i + 1}/{len(tickers_bare)} (ok={len(logos)})")
        time.sleep(0.15)  # gentileza com o endpoint

    run_count = len(logos)
    # Merge com o Blob: se o symbol-search do TradingView falhar em alguns papéis
    # (rate limit), preserva os logos já publicados — um run parcial só
    # ADICIONA/ATUALIZA, nunca derruba um logo bom.
    prev = download_json("data/acoes_logos.json")
    preserved = 0
    if isinstance(prev, dict) and isinstance(prev.get("tickers"), dict):
        for tk, url in prev["tickers"].items():
            if tk not in logos and url:
                logos[tk] = url
                preserved += 1
    if preserved:
        print(f"[logos] merge com Blob: {run_count} deste run + {preserved} preservados = {len(logos)}")

    print(f"[logos] resolvidos {len(logos)}/{len(tickers_bare)} (run={run_count})")
    return {
        "status": "ok" if logos else "error",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "TradingView symbol-search + s3-symbol-logo (SVG)",
        "count": len(logos),
        "tickers": logos,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default="data-pipeline/out")
    ap.add_argument("--upload", action="store_true")
    args = ap.parse_args()

    payload = build_payload()
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "acoes_logos.json"
    out_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(f"[logos] Escreveu {out_path} ({out_path.stat().st_size:,} bytes)")

    if payload.get("status") == "error":
        print("[logos] Status=error, não fará upload.", file=sys.stderr)
        return 1
    if args.upload:
        maybe_upload_json(out_path, "data/acoes_logos.json")
    else:
        print("[logos] --upload NÃO setado; apenas salvou local.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
