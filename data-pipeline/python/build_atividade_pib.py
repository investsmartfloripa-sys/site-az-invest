"""Build do JSON do Painel Atividade — bloco PIB trimestral.

Baixa do IBGE SIDRA 4 tabelas das Contas Nacionais Trimestrais:
- 5932 — Taxa de variação do índice de volume trimestral (4 vars × 22 classes)
- 1620 — Série encadeada do índice de volume (sem ajuste, base 1995=100)
- 1621 — Série encadeada do índice de volume COM ajuste sazonal
- 2072 — Contas econômicas trimestrais (R$ correntes, 12 variáveis)

Também busca a mediana Focus do PIB anual (BCB Olinda).

Gera `data-pipeline/out/atividade_pib.json` e upload pra `data/atividade_pib.json`.

Decisões editoriais (NOTAS_ATIVIDADE.md §3.1 e §7):
- Card destaca PIB total (classif 90707) com var trimestral SA (v=6564) como manchete.
- Decomposição mostrada como var YoY (v=6561) por classificação.
- Linha "Mediana Focus" anual.
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
BLOB_PATH = "data/atividade_pib.json"

UA = {"User-Agent": "az-invest-atividade-pib/0.1"}
SIDRA_BASE = "https://apisidra.ibge.gov.br/values"

# Códigos das classificações (c11255) -> chaves limpas pro JSON
CLASSIF_OFERTA = {
    "90687": "agro",
    "90691": "industria",
    "90692": "industria_extrativa",
    "90693": "industria_transformacao",
    "90694": "construcao",
    "90695": "eletricidade_gas",
    "90696": "servicos",
    "90697": "comercio",
    "90698": "transporte",
    "90699": "informacao",
    "90700": "financeiras",
    "90701": "outros_servicos",
    "90702": "imobiliarias",
    "90703": "admin_publica",
    "90705": "valor_adicionado",
    "90706": "impostos",
    "90707": "pib",
}
CLASSIF_DEMANDA = {
    "93404": "consumo_familias",
    "93405": "consumo_governo",
    "93406": "fbcf",
    "93407": "exportacoes",
    "93408": "importacoes",
}
ALL_CLASSIF = {**CLASSIF_OFERTA, **CLASSIF_DEMANDA}

# Variáveis da tabela 5932 (variação)
VAR_5932 = {
    "6561": "yoy",       # Taxa trimestral (vs mesmo período ano anterior)
    "6562": "acum_4t",   # Acumulada em 4 trimestres
    "6563": "acum_ano",  # Acumulada ao longo do ano
    "6564": "qoq_sa",    # Trimestre contra trimestre imediatamente anterior (SA)
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


def _trim_label(d3c: str) -> str:
    """Converte '202504' em '2025-T4'."""
    return f"{d3c[:4]}-T{d3c[4:]}"


def sidra_fetch(tabela: int, path: str) -> list[dict]:
    url = f"{SIDRA_BASE}/t/{tabela}{path}"
    print(f"  [SIDRA {tabela}] {url}")
    data = _get(url).json()
    if not data:
        return []
    return data[1:]  # pula linha 0 (rótulos)


def carrega_5932(periodos: int = 80) -> dict[str, dict[str, dict[str, float | None]]]:
    """Carrega tabela 5932: variações % do PIB.

    Retorna estrutura: { trim: { var_nome: { classif_chave: valor } } }
    onde var_nome ∈ {yoy, acum_4t, acum_ano, qoq_sa}.
    """
    path = f"/n1/all/v/all/p/last%20{periodos}/c11255/all?formato=json"
    rows = sidra_fetch(5932, path)
    out: dict[str, dict[str, dict[str, float | None]]] = {}
    for r in rows:
        d2c = r.get("D2C")
        d4c = r.get("D4C")
        d3c = r.get("D3C", "")
        var_nome = VAR_5932.get(d2c)
        classif_chave = ALL_CLASSIF.get(d4c)
        if not var_nome or not classif_chave or not d3c:
            continue
        trim = _trim_label(d3c)
        out.setdefault(trim, {}).setdefault(var_nome, {})[classif_chave] = _to_float(r.get("V"))
    return out


def carrega_indice_volume(tabela: int, var_id: str, periodos: int = 80) -> dict[str, dict[str, float | None]]:
    """Carrega 1620 ou 1621 (índice de volume por classificação)."""
    path = f"/n1/all/v/{var_id}/p/last%20{periodos}/c11255/all?formato=json"
    rows = sidra_fetch(tabela, path)
    out: dict[str, dict[str, float | None]] = {}
    for r in rows:
        d4c = r.get("D4C")
        classif_chave = ALL_CLASSIF.get(d4c)
        d3c = r.get("D3C", "")
        if not classif_chave or not d3c:
            continue
        trim = _trim_label(d3c)
        out.setdefault(trim, {})[classif_chave] = _to_float(r.get("V"))
    return out


def carrega_2072(periodos: int = 80) -> list[dict[str, Any]]:
    """Carrega 2072 (contas econômicas trimestrais, R$ correntes)."""
    path = f"/n1/all/v/all/p/last%20{periodos}?formato=json"
    rows = sidra_fetch(2072, path)
    # Agrupa por trimestre
    by_trim: dict[str, dict[str, Any]] = {}
    for r in rows:
        d3c = r.get("D3C", "")
        d2n = r.get("D2N", "")
        if not d3c:
            continue
        trim = _trim_label(d3c)
        item = by_trim.setdefault(trim, {"trim": trim})
        # Usa D2N (nome humano) como chave; varia pouco e o front prefere texto direto
        v = _to_float(r.get("V"))
        if v is not None:
            item[d2n] = v
    return [by_trim[t] for t in sorted(by_trim.keys())]


FOCUS_BASE = "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata"


def focus_pib_anual(ano_atual: int) -> dict[int, list[dict[str, Any]]]:
    """Baixa expectativas Focus do PIB anual para ano_atual, ano+1, ano+2."""
    url = (
        f"{FOCUS_BASE}/ExpectativasMercadoAnuais?$format=json&$top=20000"
        f"&$filter=Indicador%20eq%20%27PIB%20Total%27%20and%20Data%20ge%20%27{ano_atual - 1}-01-01%27"
        f"&$orderby=Data%20desc"
    )
    print(f"  [Focus PIB] {url[:120]}...")
    data = _get(url).json().get("value", [])
    out: dict[int, list[dict[str, Any]]] = {}
    for r in data:
        try:
            ano = int(r["DataReferencia"])
        except (KeyError, ValueError):
            continue
        if ano not in (ano_atual, ano_atual + 1, ano_atual + 2):
            continue
        out.setdefault(ano, []).append({
            "data": r.get("Data", "")[:10],
            "mediana": _to_float(r.get("Mediana")),
            "media": _to_float(r.get("Media")),
            "dp": _to_float(r.get("DesvioPadrao")),
            "min": _to_float(r.get("Minimo")),
            "max": _to_float(r.get("Maximo")),
        })
    for ano in out:
        out[ano].sort(key=lambda x: x["data"])
        out[ano] = out[ano][-365:]  # último ano de coletas
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description="Build do JSON Painel Atividade — PIB")
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "atividade_pib.json"

    print("== PIB Variação (SIDRA 5932) ==")
    var_data = carrega_5932()

    print("== PIB Índice de volume (SIDRA 1621 — com ajuste sazonal) ==")
    idx_sa = carrega_indice_volume(1621, "584")

    print("== PIB Índice de volume (SIDRA 1620 — sem ajuste) ==")
    idx_ns = carrega_indice_volume(1620, "583")

    print("== Contas econômicas (SIDRA 2072) ==")
    contas = carrega_2072()

    print("== Focus PIB anual (BCB Olinda) ==")
    trims = sorted(var_data.keys())
    if not trims:
        print("ERRO: nenhum trimestre carregado de 5932, abortando", file=sys.stderr)
        sys.exit(2)
    ano_atual = int(trims[-1][:4])
    try:
        focus = focus_pib_anual(ano_atual)
        print(f"  Anos: {sorted(focus.keys())} | pontos por ano: {[len(focus[a]) for a in sorted(focus.keys())]}")
    except Exception as e:
        print(f"  [WARN] Focus indisponível ({e}). Tentando fallback do Blob anterior.", file=sys.stderr)
        focus = {}
        try:
            sys.path.insert(0, str(HERE))
            from shared.blob_download import download_json
            prev = download_json(BLOB_PATH)
            if prev and prev.get("focus"):
                focus = prev["focus"]
                print(f"  [WARN] Usando Focus do build anterior (gerado_em {prev.get('gerado_em')}).", file=sys.stderr)
        except Exception as e2:
            print(f"  [WARN] Fallback Blob falhou ({e2}). Focus fica vazio.", file=sys.stderr)

    # Monta serie unificada de variações
    serie_variacao: list[dict[str, Any]] = []
    for trim in trims:
        item: dict[str, Any] = {"trim": trim}
        for var_nome, classifs in var_data[trim].items():
            for classif_chave, v in classifs.items():
                item[f"{var_nome}_{classif_chave}"] = v
        serie_variacao.append(item)

    # Series de índice (níveis) - apenas para PIB total (90707), o resto ficaria pesado
    serie_indice: list[dict[str, Any]] = []
    for trim in sorted(idx_sa.keys()):
        serie_indice.append({
            "trim": trim,
            "idx_sa_pib": idx_sa[trim].get("pib"),
            "idx_ns_pib": idx_ns.get(trim, {}).get("pib"),
        })

    # Sanity: PIB var YoY do trimestre mais recente
    ultimo = serie_variacao[-1]
    yoy_pib = ultimo.get("yoy_pib")
    qoq_pib = ultimo.get("qoq_sa_pib")
    assert yoy_pib is None or -15 < yoy_pib < 15, f"PIB YoY fora da banda: {yoy_pib}"
    assert qoq_pib is None or -10 < qoq_pib < 10, f"PIB QoQ SA fora da banda: {qoq_pib}"

    out = {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "trim_recente": trims[-1],
        "variacao": {"serie": serie_variacao},
        "indice_volume": {"serie": serie_indice},
        "contas_economicas": {"serie": contas},
        "focus": focus,
        "metadata": {
            "fonte_principal": "IBGE SIDRA — Contas Nacionais Trimestrais (tabelas 5932 variação, 1620/1621 índice de volume, 2072 contas econômicas)",
            "fonte_focus": "BCB Olinda — ExpectativasMercadoAnuais (Indicador 'PIB Total')",
            "nota": "PIB sai trimestral com lag de ~60 dias. Cron: dia 1-3 dos meses mar/jun/set/dez. Cada divulgação revisa trimestres anteriores.",
        },
    }

    out_file.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nJSON salvo em {out_file} ({out_file.stat().st_size/1024:.1f} KB)")
    print(f"Trim recente: {trims[-1]} | PIB YoY: {yoy_pib}% | QoQ SA: {qoq_pib}%")

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
