"""Upload files to Vercel Blob via HTTP PUT (Python side)."""

from __future__ import annotations

import os
from pathlib import Path

import requests

BLOB_PUT_URL = "https://blob.vercel-storage.com"


def blob_token() -> str | None:
    t = os.environ.get("BLOB_READ_WRITE_TOKEN", "").strip()
    return t or None


def upload_file(local_path: Path, blob_path: str, content_type: str) -> None:
    """PUT file contents to Vercel Blob at `blob_path` (no leading slash)."""
    token = blob_token()
    if not token:
        print(f"[blob] SKIP upload (no BLOB_READ_WRITE_TOKEN): {blob_path}")
        return

    url = f"{BLOB_PUT_URL}/{blob_path.lstrip('/')}"
    data = local_path.read_bytes()
    resp = requests.put(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {token}",
            "x-api-version": "7",
            "Content-Type": content_type,
        },
        timeout=120,
    )
    resp.raise_for_status()
    print(f"[blob] OK {blob_path} ({len(data)} bytes)")


def maybe_upload_json(local_path: Path, blob_path: str) -> None:
    upload_file(local_path, blob_path, "application/json; charset=utf-8")


def maybe_upload_svg(local_path: Path, blob_path: str) -> None:
    upload_file(local_path, blob_path, "image/svg+xml")
