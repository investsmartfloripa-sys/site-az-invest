"""Build do JSON do Painel Atividade — bloco IBC-Br (proxy mensal do PIB).

Baixa do BCB SGS 2 séries:
- 24363 — IBC-Br sem ajuste sazonal (base 2002=100)
- 24364 — IBC-Br COM ajuste sazonal (base 2002=100)

Calcula variações MoM, YoY e MM3m a partir do índice dessazonalizado.

Gera `data-pipeline/out/atividade_ibcbr.json` e upload pra Vercel Blob em `data/atividade_ibcbr.json`.

Merge incremental: se o SGS estiver indisponível, preserva o JSON anterior.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

HERE = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/atividade_ibcbr.json"

UA = {"User-Agent": "az-invest-atividade-ibcbr/0.1"}
SGS_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{cod}/dados?formato=json"

SERIES = {
    "sem_ajuste": 24363,
    "com_ajuste": 24364,
}


def _get(url: str, *, timeout: int = 60, retries: int = 3, sleep: float = 3.0) -> requests.Response:
    last: Exception | None = None
    for i in range(retries):
        try:
            r = requests.get(url, timeout=timeout, headers=UA)
            r.raise_for_status()
            return r
        except Exception as e:
            last = e
            print(f"  retry {i + 1}/{retries}: {e}", file=sys.stderr)
            time.sleep(sleep)
    raise RuntimeError(f"falha após {retries} tentativas: {last}")


def _to_float(v: Any) -> float | None:
    if v in ("", None):
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _parse_sgs_date(s: str) -> str:
    d, m, y = s.split("/")
    return f"{y}-{m}"


def sgs_fetch(cod: int) -> dict[str, float | None]:
    url = SGS_URL.format(cod=cod)
    print(f"  [SGS {cod}] {url}")
    data = _get(url).json()
    return {_parse_sgs_date(r["data"]): _to_float(r["valor"]) for r in data}


def main() -> None:
    ap = argparse.ArgumentParser(description="Build do JSON Painel Atividade — IBC-Br")
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "atividade_ibcbr.json"

    print("== IBC-Br (BCB SGS) ==")
    try:
        sem_ajuste = sgs_fetch(SERIES["sem_ajuste"])
        com_ajuste = sgs_fetch(SERIES["com_ajuste"])
    except Exception as e:
        print(f"ERRO: SGS indisponível ({e}). Tentando fallback do Blob anterior.", file=sys.stderr)
        sys.path.insert(0, str(HERE))
        from shared.blob_download import download_json
        prev = download_json(BLOB_PATH)
        if not prev:
            print("ERRO: sem fallback disponível, abortando.", file=sys.stderr)
            sys.exit(2)
        print(f"  [WARN] Mantendo JSON anterior (gerado_em {prev.get('gerado_em')}).", file=sys.stderr)
        out_file.write_text(json.dumps(prev, indent=2, ensure_ascii=False), encoding="utf-8")
        return

    print(f"  Sem ajuste: {len(sem_ajuste)} obs | Com ajuste: {len(com_ajuste)} obs")

    meses = sorted(set(sem_ajuste.keys()) | set(com_ajuste.keys()))
    serie: list[dict[str, Any]] = []
    for m in meses:
        idx_sa = com_ajuste.get(m)
        idx_ns = sem_ajuste.get(m)
        serie.append({
            "mes": m,
            "indice_sa": idx_sa,
            "indice_ns": idx_ns,
        })

    # Calcula variações MoM e YoY a partir do índice dessazonalizado (padrão de mercado)
    for i, item in enumerate(serie):
        idx_sa = item["indice_sa"]
        idx_sa_prev = serie[i - 1]["indice_sa"] if i >= 1 else None
        idx_sa_y = serie[i - 12]["indice_sa"] if i >= 12 else None
        item["var_mom"] = (
            round((idx_sa / idx_sa_prev - 1) * 100, 2)
            if (idx_sa is not None and idx_sa_prev not in (None, 0))
            else None
        )
        item["var_yoy"] = (
            round((idx_sa / idx_sa_y - 1) * 100, 2)
            if (idx_sa is not None and idx_sa_y not in (None, 0))
            else None
        )
        # MM3m do índice dessazonalizado
        janela = [serie[j]["indice_sa"] for j in range(max(0, i - 2), i + 1) if serie[j]["indice_sa"] is not None]
        item["indice_sa_mm3"] = round(sum(janela) / len(janela), 4) if len(janela) == 3 else None

    out = {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "mes_recente": serie[-1]["mes"] if serie else "",
        "serie": serie,
        "metadata": {
            "fonte": "BCB SGS — séries 24363 (sem ajuste) e 24364 (com ajuste sazonal)",
            "nota": "IBC-Br é a proxy mensal do PIB calculada pelo BCB. Base 2002=100. Variações calculadas a partir do índice dessazonalizado.",
        },
    }

    # Sanity asserts
    assert len(serie) >= 24, f"série muito curta: {len(serie)} obs"
    ultimo_sa = serie[-1]["indice_sa"]
    assert ultimo_sa is not None and 70 < ultimo_sa < 130, f"índice SA fora do esperado: {ultimo_sa}"

    out_file.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nJSON salvo em {out_file} ({out_file.stat().st_size/1024:.1f} KB)")
    print(f"Último mês: {serie[-1]['mes']} | índice SA: {ultimo_sa} | var YoY: {serie[-1].get('var_yoy')}%")

    if args.upload:
        try:
            sys.path.insert(0, str(HERE))
            from shared.blob_upload import maybe_upload_json
            maybe_upload_json(out_file, BLOB_PATH)
        except Exception as e:
            print(f"[upload] FALHOU: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        print("[upload] SKIP")


if __name__ == "__main__":
    main()
