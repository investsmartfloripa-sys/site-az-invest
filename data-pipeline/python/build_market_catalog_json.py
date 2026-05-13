"""Exporta o catalogo de mercado como JSON estatico, consumivel pelo frontend.

Saida: data/market_catalog.json
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.append(str(Path(__file__).parent))
from market_catalog import CATALOG, CLASS_LABELS  # noqa: E402
from shared.blob_upload import maybe_upload_json  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default="data-pipeline/out")
    ap.add_argument("--upload", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "market_catalog.json"

    payload = {
        "generated_at": datetime.now(tz=timezone.utc).isoformat(),
        "total": len(CATALOG),
        "class_labels": CLASS_LABELS,
        "assets": CATALOG,
    }
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[INFO] Gerado {out_path} ({len(CATALOG)} ativos, {out_path.stat().st_size} bytes)")

    if args.upload:
        maybe_upload_json(out_path, "data/market_catalog.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
