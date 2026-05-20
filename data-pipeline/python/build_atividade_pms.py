"""Build do JSON do Painel Atividade — bloco PMS (Serviços).

Baixa do IBGE SIDRA (PMS base 2022=100):
- 5906 — Receita e volume de serviços (índice geral)
- 8163 — Por segmentos (20 cats)
- 8688 — Por atividades e subdivisões (29 cats, hierárquico)

Gera `data-pipeline/out/atividade_pms.json` e upload pra `data/atividade_pms.json`.
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
BLOB_PATH = "data/atividade_pms.json"

UA = {"User-Agent": "az-invest-atividade-pms/0.1"}
SIDRA_BASE = "https://apisidra.ibge.gov.br/values"

VAR_PMS = {
    "11623": "var_mom_sa",
    "11624": "var_yoy",
    "11625": "var_acum_ano",
    "11626": "var_acum_12m",
    "7167": "indice",
    "7168": "indice_sa",
}

TIPO_INDICE = {
    "56725": "receita_nominal",
    "56726": "volume",
}


def _get(url: str, *, timeout: int = 90, retries: int = 3, sleep: float = 3.0) -> requests.Response:
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
    if v in ("", "-", "..", "...", None):
        return None
    try:
        return float(str(v).replace(",", "."))
    except (TypeError, ValueError):
        return None


def _mes_label(d3c: str) -> str:
    return f"{d3c[:4]}-{d3c[4:]}"


def sidra_fetch(tabela: int, path: str) -> list[dict]:
    url = f"{SIDRA_BASE}/t/{tabela}{path}"
    print(f"  [SIDRA {tabela}] {url[:140]}...")
    data = _get(url).json()
    if not data:
        return []
    return data[1:]


def carrega_geral(periodos: int = 60) -> dict[str, dict[str, dict[str, float | None]]]:
    path = f"/n1/all/v/all/p/last%20{periodos}/c11046/all?formato=json"
    rows = sidra_fetch(5906, path)
    out: dict[str, dict[str, dict[str, float | None]]] = {}
    for r in rows:
        d2c = r.get("D2C")
        d4c = r.get("D4C")
        d3c = r.get("D3C", "")
        var_nome = VAR_PMS.get(d2c)
        tipo = TIPO_INDICE.get(d4c)
        if not var_nome or not tipo or not d3c:
            continue
        mes = _mes_label(d3c)
        out.setdefault(mes, {}).setdefault(tipo, {})[var_nome] = _to_float(r.get("V"))
    return out


def carrega_segmentos_ou_atividades(tabela: int, classif_id: str, periodos: int = 12) -> dict[str, list[dict[str, Any]]]:
    """Carrega 8163 (c1274 segmentos) ou 8688 (c12355 atividades). Filtra apenas Volume."""
    path = f"/n1/all/v/11624/p/last%20{periodos}/c11046/all/c{classif_id}/all?formato=json"
    rows = sidra_fetch(tabela, path)
    by_mes: dict[str, list[dict[str, Any]]] = {}
    for r in rows:
        d3c = r.get("D3C", "")
        d4c = r.get("D4C", "")
        d5n = r.get("D5N", "")
        v = _to_float(r.get("V"))
        if d4c != "56726":  # só volume
            continue
        if not d3c or not d5n or v is None:
            continue
        mes = _mes_label(d3c)
        by_mes.setdefault(mes, []).append({"categoria": d5n, "var_yoy": v})
    for mes in by_mes:
        by_mes[mes].sort(key=lambda x: x["var_yoy"], reverse=True)
    return by_mes


def main() -> None:
    ap = argparse.ArgumentParser(description="Build do JSON Painel Atividade — PMS")
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "atividade_pms.json"

    print("== PMS Geral (SIDRA 5906) ==")
    geral = carrega_geral()
    print("== PMS Segmentos (SIDRA 8163) ==")
    segmentos = carrega_segmentos_ou_atividades(8163, "1274")
    print("== PMS Atividades (SIDRA 8688) ==")
    atividades = carrega_segmentos_ou_atividades(8688, "12355")

    meses = sorted(geral.keys())
    if not meses:
        print("ERRO: nenhum mês carregado, abortando", file=sys.stderr)
        sys.exit(2)
    mes_recente = meses[-1]

    serie: list[dict[str, Any]] = []
    for mes in meses:
        item: dict[str, Any] = {"mes": mes}
        vol = geral.get(mes, {}).get("volume", {})
        rec = geral.get(mes, {}).get("receita_nominal", {})
        for var_nome in VAR_PMS.values():
            item[f"volume_{var_nome}"] = vol.get(var_nome)
            item[f"receita_{var_nome}"] = rec.get(var_nome)
        serie.append(item)

    seg_recente = segmentos.get(mes_recente, [])
    ativ_recente = atividades.get(mes_recente, [])

    # Sanity
    ultimo = serie[-1]
    idx_sa = ultimo.get("volume_indice_sa")
    yoy = ultimo.get("volume_var_yoy")
    assert idx_sa is None or 70 < idx_sa < 140, f"índice SA fora da banda: {idx_sa}"

    out = {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "mes_recente": mes_recente,
        "serie": serie,
        "segmentos": {
            "mes": mes_recente,
            "top_altas": seg_recente[:5],
            "top_quedas": seg_recente[-5:][::-1] if seg_recente else [],
        },
        "atividades": {
            "mes": mes_recente,
            "top_altas": ativ_recente[:5],
            "top_quedas": ativ_recente[-5:][::-1] if ativ_recente else [],
        },
        "metadata": {
            "fonte": "IBGE SIDRA — PMS (tabelas 5906 geral, 8163 segmentos, 8688 atividades). Base 2022=100.",
            "nota": "Volume é a métrica principal. Lag editorial ~45 dias.",
        },
    }

    out_file.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nJSON salvo em {out_file} ({out_file.stat().st_size/1024:.1f} KB)")
    print(f"Mês recente: {mes_recente} | Volume YoY: {yoy}% | índice SA: {idx_sa}")

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
