"""Build do JSON do Painel Atividade — bloco PIM-PF (Produção Industrial).

Baixa do IBGE SIDRA 3 tabelas (PIM-PF base 2022=100):
- 8888 — Por seções e atividades industriais (27 cats, CNAE 2.0)
- 8887 — Por grandes categorias econômicas (24 cats)
- 8889 — Indicadores especiais (69 cats; usado apenas para insumos da construção e bens de capital especiais)

Gera `data-pipeline/out/atividade_pim.json` e upload pra `data/atividade_pim.json`.

Estrutura editorial:
- `geral`: série com índice SA e variações (var MoM SA é o KPI manchete).
- `secoes`: série por seção CNAE (extrativa, transformação, etc).
- `categorias_economicas`: série por bens de capital / intermediário / consumo duráveis / consumo semi+não-duráveis (decomposição cíclica).
- `atividades_detalhe`: ranking de variações YoY das atividades detalhadas para o mês mais recente.
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
BLOB_PATH = "data/atividade_pim.json"

UA = {"User-Agent": "az-invest-atividade-pim/0.1"}
SIDRA_BASE = "https://apisidra.ibge.gov.br/values"

# Variáveis comuns PIM
VAR_PIM = {
    "11601": "var_mom_sa",      # var mês/mês imediatamente anterior, SA
    "11602": "var_yoy",         # var mês/mesmo mês ano anterior
    "11603": "var_acum_ano",    # acumulada no ano
    "11604": "var_acum_12m",    # acumulada em 12 meses
    "12606": "indice",          # número-índice 2022=100
    "12607": "indice_sa",       # número-índice SA 2022=100
}

# Seções principais (tabela 8888 c544) — 3 macro + algumas atividades destacadas
SECOES_PRINCIPAIS = {
    "129314": "industria_geral",
    "129315": "extrativa",
    "129316": "transformacao",
}

# Grandes categorias econômicas (tabela 8887 c543) — 4 blocos cíclicos
CATEGORIAS_ECON = {
    "129278": "bens_capital",
    "129283": "bens_intermediarios",
    "129301": "bens_consumo_duraveis",
    "129305": "bens_consumo_semi_nao_duraveis",
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


def carrega_tabela_pim(tabela: int, classif_id: str, categorias_map: dict[str, str], periodos: int = 60) -> dict[str, dict[str, dict[str, float | None]]]:
    """Carrega tabela PIM filtrando por categorias_map. Retorna {mes: {chave_classif: {var_nome: valor}}}."""
    path = f"/n1/all/v/all/p/last%20{periodos}/c{classif_id}/all?formato=json"
    rows = sidra_fetch(tabela, path)
    out: dict[str, dict[str, dict[str, float | None]]] = {}
    for r in rows:
        d2c = r.get("D2C")
        d4c = r.get("D4C")
        d3c = r.get("D3C", "")
        var_nome = VAR_PIM.get(d2c)
        classif_chave = categorias_map.get(d4c)
        if not var_nome or not classif_chave or not d3c:
            continue
        mes = _mes_label(d3c)
        out.setdefault(mes, {}).setdefault(classif_chave, {})[var_nome] = _to_float(r.get("V"))
    return out


def carrega_atividades_detalhe(periodos: int = 12) -> dict[str, list[dict[str, Any]]]:
    """Carrega 8888 com todas as atividades (não filtra). Retorna {mes: [{atividade, var_yoy}]}."""
    path = f"/n1/all/v/11602/p/last%20{periodos}/c544/all?formato=json"
    rows = sidra_fetch(8888, path)
    by_mes: dict[str, list[dict[str, Any]]] = {}
    for r in rows:
        d3c = r.get("D3C", "")
        d4n = r.get("D4N", "")
        d4c = r.get("D4C", "")
        v = _to_float(r.get("V"))
        if not d3c or not d4n or v is None:
            continue
        # Pula os 3 grandes (geral, extrativa, transformação) — já temos eles em "secoes"
        if d4c in SECOES_PRINCIPAIS:
            continue
        mes = _mes_label(d3c)
        by_mes.setdefault(mes, []).append({"atividade": d4n, "var_yoy": v})
    for mes in by_mes:
        by_mes[mes].sort(key=lambda x: x["var_yoy"], reverse=True)
    return by_mes


def main() -> None:
    ap = argparse.ArgumentParser(description="Build do JSON Painel Atividade — PIM-PF")
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "atividade_pim.json"

    print("== PIM Seções (SIDRA 8888) ==")
    secoes = carrega_tabela_pim(8888, "544", SECOES_PRINCIPAIS)

    print("== PIM Categorias econômicas (SIDRA 8887) ==")
    categorias = carrega_tabela_pim(8887, "543", CATEGORIAS_ECON)

    print("== PIM Atividades detalhe (SIDRA 8888, ranking) ==")
    atividades = carrega_atividades_detalhe()

    meses = sorted(secoes.keys())
    if not meses:
        print("ERRO: nenhum mês carregado, abortando", file=sys.stderr)
        sys.exit(2)
    mes_recente = meses[-1]

    # Serie "geral" = indústria geral com todas as variáveis
    serie_geral: list[dict[str, Any]] = []
    for mes in meses:
        item: dict[str, Any] = {"mes": mes}
        geral = secoes[mes].get("industria_geral", {})
        for var_nome in VAR_PIM.values():
            item[var_nome] = geral.get(var_nome)
        serie_geral.append(item)

    # Serie "secoes" = indústria geral + extrativa + transformação, só var_yoy + indice_sa
    serie_secoes: list[dict[str, Any]] = []
    for mes in meses:
        item: dict[str, Any] = {"mes": mes}
        for chave in SECOES_PRINCIPAIS.values():
            val = secoes[mes].get(chave, {})
            item[f"yoy_{chave}"] = val.get("var_yoy")
            item[f"idx_sa_{chave}"] = val.get("indice_sa")
        serie_secoes.append(item)

    # Serie "categorias_economicas" = 4 grandes blocos, var_yoy
    serie_cat: list[dict[str, Any]] = []
    meses_cat = sorted(categorias.keys())
    for mes in meses_cat:
        item: dict[str, Any] = {"mes": mes}
        for chave in CATEGORIAS_ECON.values():
            val = categorias[mes].get(chave, {})
            item[f"yoy_{chave}"] = val.get("var_yoy")
            item[f"idx_sa_{chave}"] = val.get("indice_sa")
        serie_cat.append(item)

    # Ranking de atividades do mês recente: top 5 alta + top 5 queda
    ativ_recente = atividades.get(mes_recente, [])
    top_altas = ativ_recente[:5]
    top_quedas = ativ_recente[-5:][::-1]

    # Sanity
    ultimo = serie_geral[-1]
    idx_sa = ultimo.get("indice_sa")
    var_yoy = ultimo.get("var_yoy")
    assert idx_sa is None or 70 < idx_sa < 130, f"índice SA fora da banda: {idx_sa}"
    assert var_yoy is None or -25 < var_yoy < 25, f"var YoY fora da banda: {var_yoy}"

    out = {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "mes_recente": mes_recente,
        "geral": {"serie": serie_geral},
        "secoes": {
            "categorias": list(SECOES_PRINCIPAIS.values()),
            "serie": serie_secoes,
        },
        "categorias_economicas": {
            "categorias": list(CATEGORIAS_ECON.values()),
            "serie": serie_cat,
        },
        "atividades_detalhe": {
            "mes": mes_recente,
            "top_altas": top_altas,
            "top_quedas": top_quedas,
        },
        "metadata": {
            "fonte": "IBGE SIDRA — PIM-PF Brasil (tabelas 8888 seções/atividades, 8887 categorias econômicas)",
            "nota": "PIM-PF base 2022=100; antiga base 2012 encerrada em dez/2022. Lag editorial ~45 dias.",
        },
    }

    out_file.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nJSON salvo em {out_file} ({out_file.stat().st_size/1024:.1f} KB)")
    print(f"Mês recente: {mes_recente} | Indústria geral var YoY: {var_yoy}% | índice SA: {idx_sa}")

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
