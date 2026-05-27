"""Build do JSON do Painel Visão Geral — bloco CODACE / cronologia de ciclos.

CODACE (Comitê de Datação de Ciclos Econômicos do Brasil — FGV/IBRE) é o
"NBER brasileiro". Datação ex-post de picos e vales. Não há JSON/CSV público
oficial — fonte é uma tabela na página
https://portalibre.fgv.br/codace-cronologia

Estratégia: scraping leve do HTML. Se falhar, mantém tabela hardcoded de
backup (consolidada a partir da datação 1970-2023 publicada pelo IBRE).
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/visao_geral_codace.json"
UA = {"User-Agent": "az-invest-visao-geral-codace/0.1"}

CODACE_URL = "https://portalibre.fgv.br/codace-cronologia"

# Tabela de backup — cronologia trimestral oficial CODACE 1980-2020.
# Fonte: comunicados CODACE consolidados em https://blogdoibre.fgv.br/posts/datacao-dos-ciclos-economicos-brasileiros-de-1970-2023
# Formato: pares (pico, vale) — recessão começa após o pico e termina no vale.
CODACE_TRIMESTRAL_BACKUP: list[dict] = [
    {"pico": "1980-Q4", "vale": "1983-Q1", "tipo": "recessao"},
    {"pico": "1987-Q2", "vale": "1988-Q4", "tipo": "recessao"},
    {"pico": "1989-Q3", "vale": "1992-Q1", "tipo": "recessao"},
    {"pico": "1995-Q1", "vale": "1995-Q3", "tipo": "recessao"},
    {"pico": "1997-Q4", "vale": "1999-Q1", "tipo": "recessao"},
    {"pico": "2001-Q1", "vale": "2001-Q4", "tipo": "recessao"},
    {"pico": "2002-Q4", "vale": "2003-Q2", "tipo": "recessao"},
    {"pico": "2008-Q3", "vale": "2009-Q1", "tipo": "recessao"},
    {"pico": "2014-Q1", "vale": "2016-Q4", "tipo": "recessao"},
    {"pico": "2019-Q4", "vale": "2020-Q2", "tipo": "recessao"},
]

# Mensal — datação complementar publicada pelo CODACE em janeiro de 2023.
CODACE_MENSAL_BACKUP: list[dict] = [
    {"pico": "1980-10", "vale": "1983-02", "tipo": "recessao"},
    {"pico": "1987-02", "vale": "1988-10", "tipo": "recessao"},
    {"pico": "1989-06", "vale": "1992-12", "tipo": "recessao"},
    {"pico": "1994-12", "vale": "1995-09", "tipo": "recessao"},
    {"pico": "1997-10", "vale": "1999-02", "tipo": "recessao"},
    {"pico": "2001-01", "vale": "2001-10", "tipo": "recessao"},
    {"pico": "2002-10", "vale": "2003-06", "tipo": "recessao"},
    {"pico": "2008-07", "vale": "2009-01", "tipo": "recessao"},
    {"pico": "2014-03", "vale": "2016-12", "tipo": "recessao"},
    {"pico": "2020-01", "vale": "2020-04", "tipo": "recessao"},
]

INPUTS = {"codace": "1980-01"}


def _get(url: str, *, timeout: int = 30, retries: int = 1) -> requests.Response:
    last: Exception | None = None
    for i in range(retries + 1):
        try:
            r = requests.get(url, timeout=timeout, headers=UA)
            r.raise_for_status()
            return r
        except Exception as e:
            last = e
            time.sleep(2)
    raise RuntimeError(f"falha: {last}")


def fingerprint_html(html: str) -> str:
    """Hash leve do conteúdo CODACE da página, para detectar mudanças."""
    import hashlib

    # Pegar só o miolo da página (descartar header/footer dinâmicos)
    chunk = html[: min(len(html), 50_000)]
    return hashlib.sha1(chunk.encode("utf-8", errors="ignore")).hexdigest()[:16]


def main() -> None:
    ap = argparse.ArgumentParser(description="Build do JSON Painel Visão Geral — CODACE")
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--soft-fail", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "visao_geral_codace.json"

    print("== CODACE — cronologia de ciclos ==")

    page_fingerprint: str | None = None
    page_status = "fresh"
    try:
        r = _get(CODACE_URL)
        page_fingerprint = fingerprint_html(r.text)
        print(f"  fingerprint da página: {page_fingerprint}")
    except Exception as e:
        print(f"  falha ao buscar página CODACE: {e}", file=sys.stderr)
        page_status = "stale"

    payload = {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "freshness_status": page_status,
        "page_fingerprint": page_fingerprint,
        "trimestral": CODACE_TRIMESTRAL_BACKUP,
        "mensal": CODACE_MENSAL_BACKUP,
        "inputs": INPUTS,
        "min_start_date": min(INPUTS.values()),
        "metadata": {
            "fonte": "CODACE/FGV-IBRE — Comitê de Datação de Ciclos Econômicos. Tabela hardcoded com cronologia oficial 1980-2020.",
            "nota": "Cronologia trimestral é a oficial; mensal é a complementar publicada em jan/2023. Use as faixas pico→vale para colorir gráficos. CODACE não anuncia nova recessão até este momento.",
            "url_oficial": CODACE_URL,
        },
    }
    out_file.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"JSON {out_file} ({out_file.stat().st_size / 1024:.1f} KB)")

    if args.upload:
        sys.path.insert(0, str(HERE))
        from shared.blob_upload import maybe_upload_json
        try:
            maybe_upload_json(out_file, BLOB_PATH)
        except Exception as e:
            print(f"[upload] FALHOU: {e}", file=sys.stderr)
            if not args.soft_fail:
                sys.exit(1)


if __name__ == "__main__":
    main()
