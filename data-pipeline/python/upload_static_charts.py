#!/usr/bin/env python3
"""Envia SVGs de data-pipeline/out/charts/static/ para o Vercel Blob."""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from shared.blob_upload import maybe_upload_json, maybe_upload_svg

DATA_PIPELINE_ROOT = ROOT.parent
OUT = Path(os.environ.get("DATA_PIPELINE_OUT", str(DATA_PIPELINE_ROOT / "out"))).resolve()
static = OUT / "charts" / "static"
tables = OUT / "charts" / "tables"


def main() -> int:
    if not static.is_dir():
        print(f"[upload_static] pasta inexistente: {static}")
        return 0
    for f in sorted(static.glob("*.svg")):
        try:
            maybe_upload_svg(f, f"charts/static/{f.name}")
        except Exception as e:
            print(f"[WARN] {f.name}: {e}", file=sys.stderr)
    if tables.is_dir():
        for f in sorted(tables.glob("*.json")):
            try:
                maybe_upload_json(f, f"charts/tables/{f.name}")
            except Exception as e:
                print(f"[WARN] {f.name}: {e}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
