"""Build do JSON do Painel IGP-M.

Baixa do BCB SGS:
- 189   IGP-M variação mensal
- 192   IGP-M acumulado 12 meses
- 4174  IPA-M variação mensal (peso ~60% no IGP-M)
- 4175  IPC-M variação mensal (peso ~30%)
- 4176  INCC-M variação mensal (peso ~10%)

Calcula contribuição (variação × peso / 100) dos 3 componentes e gera JSON
pivotado pro frontend. Padrão idêntico ao build_ipca.py.

Lê BLOB_READ_WRITE_TOKEN do ambiente.
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
BLOB_PATH = "data/igpm.json"

UA = {"User-Agent": "az-invest-igpm-builder/0.1"}

SGS_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{cod}/dados?formato=json"

# Pesos efetivos no IGP-M (regulamento FGV)
PESOS_IGPM: dict[str, float] = {"IPA-M": 60.0, "IPC-M": 30.0, "INCC-M": 10.0}


def _get(url: str, *, timeout: int = 90, retries: int = 3, sleep: float = 3.0) -> requests.Response:
    last: Exception | None = None
    for i in range(retries):
        try:
            r = requests.get(url, timeout=timeout, headers=UA)
            r.raise_for_status()
            return r
        except Exception as e:  # noqa: BLE001
            last = e
            print(f"  retry {i + 1}/{retries}: {e}", file=sys.stderr)
            time.sleep(sleep)
    raise RuntimeError(f"falha após {retries} tentativas: {last}")


def _to_float(v: Any) -> float | None:
    if v in ("", "-", "..", "...", None):
        return None
    try:
        return float(str(v).replace(",", "."))
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
    ap = argparse.ArgumentParser(description="Build do JSON do Painel IGP-M")
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR), help="Diretório de saída (default: data-pipeline/out)")
    ap.add_argument("--upload", action="store_true", help="Após gerar, fazer upload pro Vercel Blob")
    ap.add_argument("--no-merge", action="store_true", help="Reservado pra futuro merge incremental (no-op por enquanto)")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "igpm.json"

    print("== IGP-M ==")
    igpm_m = sgs_fetch(189)
    igpm_12m = sgs_fetch(192)

    print("== Componentes ==")
    ipam = sgs_fetch(4174)
    ipcm = sgs_fetch(4175)
    inccm = sgs_fetch(4176)

    componentes = {"IPA-M": ipam, "IPC-M": ipcm, "INCC-M": inccm}

    # Janela: 60 meses mais recentes em que TODOS os componentes existem
    meses_comuns = sorted(
        set(igpm_m.keys())
        & set(ipam.keys())
        & set(ipcm.keys())
        & set(inccm.keys())
    )[-60:]

    if not meses_comuns:
        print("ERRO: nenhum mês com todos os componentes", file=sys.stderr)
        sys.exit(1)

    mes_recente = meses_comuns[-1]

    serie: list[dict[str, Any]] = []
    for m in meses_comuns:
        item: dict[str, Any] = {
            "mes": m,
            "IGP-M": igpm_m.get(m),
            "IGP-M 12m": igpm_12m.get(m),
        }
        soma_contrib = 0.0
        for comp, peso in PESOS_IGPM.items():
            val = componentes[comp].get(m)
            item[comp] = val
            if val is not None:
                c = val * peso / 100.0
                item[f"{comp} (contrib)"] = round(c, 4)
                soma_contrib += c
        item["contrib_soma"] = round(soma_contrib, 4)
        serie.append(item)

    out: dict[str, Any] = {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "mes_recente": mes_recente,
        "igpm": {
            "serie": serie,
            "pesos": PESOS_IGPM,
            "mes_recente": mes_recente,
            "componentes": list(PESOS_IGPM.keys()),
        },
    }

    out_file.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    size_kb = out_file.stat().st_size / 1024
    print(f"\nJSON salvo em {out_file} ({size_kb:.1f} KB) | mes_recente={mes_recente}")

    if args.upload:
        try:
            sys.path.insert(0, str(HERE))
            from shared.blob_upload import maybe_upload_json  # noqa: E402
            maybe_upload_json(out_file, BLOB_PATH)
        except Exception as e:  # noqa: BLE001
            print(f"[upload] FALHOU: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        print("[upload] SKIP (use --upload pra subir pro Blob)")


if __name__ == "__main__":
    main()
