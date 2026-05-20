"""Upload manual dos JSONs locais de renda fixa ao Blob.

Le BLOB_READ_WRITE_TOKEN do ambiente.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from shared.blob_upload import maybe_upload_json  # noqa: E402


for local_rel, blob_path in [
    ("data-pipeline/out/treasury_history.json", "data/treasury_history.json"),
    ("data-pipeline/out/credit_spreads_history.json", "data/credit_spreads_history.json"),
]:
    p = Path(local_rel)
    if not p.exists():
        print(f"[SKIP] missing: {local_rel}")
        continue
    print(f"[upload] {local_rel} ({p.stat().st_size} bytes) -> {blob_path}")
    maybe_upload_json(p, blob_path)
