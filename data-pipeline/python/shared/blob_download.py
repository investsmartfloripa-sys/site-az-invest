"""Download JSON publico do Vercel Blob (read-only, sem token)."""
from __future__ import annotations

import json
import os
from typing import Any, Optional

import requests


def public_blob_base() -> Optional[str]:
    """Le NEXT_PUBLIC_BLOB_BASE_URL ou PAINEL_BLOB_PUBLIC_FALLBACK do ambiente."""
    primary = os.environ.get("NEXT_PUBLIC_BLOB_BASE_URL", "").strip()
    fallback = os.environ.get("PAINEL_BLOB_PUBLIC_FALLBACK", "").strip()
    base = fallback or primary
    return base.rstrip("/") if base else None


def download_json(blob_path: str, timeout: int = 30) -> Optional[Any]:
    """Faz GET de um JSON publico do Blob. Retorna None se nao existir/falhar."""
    base = public_blob_base()
    if not base:
        # Fallback hardcoded ao base atual conhecido (mesmo da memoria do projeto)
        base = "https://8ytqvgmik75vk1it.public.blob.vercel-storage.com"
    path = blob_path.lstrip("/")
    url = f"{base}/{path}"
    try:
        r = requests.get(url, timeout=timeout)
        if r.status_code != 200:
            print(f"[blob] read {url}: HTTP {r.status_code}")
            return None
        return r.json()
    except Exception as e:
        print(f"[blob] read {url}: erro {e}")
        return None
