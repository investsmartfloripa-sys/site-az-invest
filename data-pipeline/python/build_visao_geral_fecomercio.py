"""Build do JSON do Painel Visao Geral - bloco Fecomercio SP.

- ICEC - Indice de Confianca do Empresario do Comercio (Fecomercio SP, mensal)
- ICF - Intencao de Consumo das Familias (mensal desde jan/2010)

Fonte: https://www.fecomercio.com.br/pesquisas/indices

Como o site tem PDFs/HTMLs proprios mensais, esse scraper e best-effort.
Estrategia: buscar links recentes em /pesquisas/indices, parseiar PDFs ou
extrair valores do HTML quando possivel.

Pra v1 da Onda 2, esse pipeline preserva merge incremental do Blob anterior
e adiciona o ponto do mes quando consegue extrair.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/visao_geral_fecomercio.json"
UA = {"User-Agent": "az-invest-visao-geral-fecomercio/0.1"}

PAGE_INDICES = "https://www.fecomercio.com.br/pesquisas/indices"

INPUTS = {"icec": "2010-01", "icf": "2010-01"}


def _get(url: str, *, timeout: int = 60, retries: int = 2) -> requests.Response | None:
    for i in range(retries):
        try:
            r = requests.get(url, timeout=timeout, headers=UA)
            r.raise_for_status()
            return r
        except Exception:
            time.sleep(3)
    return None


def extrair_valor_titulo(html: str, padrao_titulo: str) -> float | None:
    """Procura numero proximo a um titulo na pagina."""
    # Busca contexto de ate 200 chars após o titulo
    m = re.search(rf"{padrao_titulo}.{{0,200}}?(\d{{1,3}}[,\.]\d{{1,2}})", html, re.IGNORECASE | re.DOTALL)
    if m:
        try:
            return float(m.group(1).replace(",", "."))
        except ValueError:
            return None
    return None


def mes_atual_iso() -> str:
    n = datetime.now(timezone.utc)
    return f"{n.year:04d}-{n.month:02d}"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--soft-fail", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "visao_geral_fecomercio.json"

    print("== Fecomercio SP - ICEC + ICF ==")

    icec: float | None = None
    icf: float | None = None
    r = _get(PAGE_INDICES)
    if r is not None:
        html = r.text
        icec = extrair_valor_titulo(html, "ICEC")
        icf = extrair_valor_titulo(html, "ICF")
        print(f"  ICEC={icec} | ICF={icf}")
    else:
        print("  pagina Fecomercio indisponivel")

    sys.path.insert(0, str(HERE))
    from shared.blob_download import download_json
    prev = download_json(BLOB_PATH) or {"icec": [], "icf": []}

    def merge(lista: list[dict], mes: str, valor: float | None) -> list[dict]:
        if valor is None:
            return lista
        by_mes = {p["mes"]: p for p in lista}
        by_mes[mes] = {"mes": mes, "valor": valor}
        return [by_mes[m] for m in sorted(by_mes.keys())]

    mes = mes_atual_iso()
    serie_icec = merge(prev.get("icec", []), mes, icec)
    serie_icf = merge(prev.get("icf", []), mes, icf)

    freshness = "fresh" if (icec is not None or icf is not None) else ("stale" if prev.get("icec") else "missing")

    payload = {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "freshness_status": freshness,
        "icec": serie_icec,
        "icf": serie_icf,
        "inputs": INPUTS,
        "min_start_date": max(INPUTS.values()),
        "metadata": {
            "fonte": "Fecomercio SP - Pesquisas e Indices. ICEC (empresario do comercio) e ICF (intencao consumo familias).",
            "nota": "100 = neutro. Cobertura SP (ICEC tem amostra nacional para alguns sub-itens).",
            "limitacao": "Scraping best-effort sobre HTML da pagina de indices. Incremental por mes - parser fragil.",
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
