"""Build do JSON do Painel Atividade — bloco PIM-PF (ENRIQUECIDO).

IBGE SIDRA — PIM-PF Brasil base 2022=100:
- 8888 — Seções e atividades industriais (27 categorias CNAE 2.0)
- 8887 — Grandes categorias econômicas (24 categorias: capital/intermediário/consumo)
- 8889 — Indicadores especiais (69 cats: bens duráveis, semiduráveis, não-duráveis, etc.)
- 8886 — Insumos típicos da construção civil (preditor da Construção)

Salva: serie geral, série setores, todas atividades CNAE (não só top 5), construção,
indicadores especiais filtrados, heatmap.
"""
from __future__ import annotations
import argparse, json, sys, time
from datetime import datetime, timezone
from pathlib import Path
import requests

HERE = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/atividade_pim.json"
UA = {"User-Agent": "az-invest-atividade-pim/0.2"}
SIDRA_BASE = "https://apisidra.ibge.gov.br/values"

VAR_PIM = {
    "11601": "var_mom_sa",
    "11602": "var_yoy",
    "11603": "var_acum_ano",
    "11604": "var_acum_12m",
    "12606": "indice",
    "12607": "indice_sa",
}

SECOES = {
    "129314": "industria_geral",
    "129315": "extrativa",
    "129316": "transformacao",
}

# Categorias econômicas principais (4 grupos cíclicos + sub-categorias)
CATEGORIAS_PRINCIPAIS = {
    "129278": "bens_capital",
    "129283": "bens_intermediarios",
    "129300": "bens_consumo",
    "129301": "bens_consumo_duraveis",
    "129305": "bens_consumo_semi_nao_duraveis",
    "129306": "bens_consumo_semi_duraveis",
    "129307": "bens_consumo_nao_duraveis",
}

# Indicadores especiais úteis (8889 tem 69; pego os mais relevantes pra leitura editorial)
# Filtrar pelo nome porque IDs variam — uso D4N contém algumas palavras-chave
PALAVRAS_INDICADORES = [
    "Bens de capital",
    "Bens de consumo",
    "Bens intermediários",
    "Bens duráveis",
    "Bens semiduráveis",
    "Bens não duráveis",
    "Veículos automotores",
    "Máquinas",
]


def _get(url, *, timeout=90, retries=3, sleep=3.0):
    last = None
    for i in range(retries):
        try:
            r = requests.get(url, timeout=timeout, headers=UA)
            r.raise_for_status()
            return r
        except Exception as e:
            last = e
            time.sleep(sleep)
    raise RuntimeError(f"falha: {last}")


def _to_float(v):
    if v in ("", "-", "..", "...", None):
        return None
    try:
        return float(str(v).replace(",", "."))
    except (TypeError, ValueError):
        return None


def _mes(d3c):
    return f"{d3c[:4]}-{d3c[4:]}"


def sidra(tabela, path):
    url = f"{SIDRA_BASE}/t/{tabela}{path}"
    print(f"  [SIDRA {tabela}]")
    data = _get(url).json()
    return data[1:] if data else []


def carrega_8888(periodos=60):
    """Todas as 27 categorias × 6 vars × N meses."""
    rows = sidra(8888, f"/n1/all/v/all/p/last%20{periodos}/c544/all?formato=json")
    out = {}  # mes → classif → {var: v}
    nomes = {}
    for r in rows:
        var_nome = VAR_PIM.get(r.get("D2C"))
        d4c = r.get("D4C", "")
        d4n = r.get("D4N", "")
        d3c = r.get("D3C", "")
        if not var_nome or not d4c or not d3c:
            continue
        out.setdefault(_mes(d3c), {}).setdefault(d4c, {})[var_nome] = _to_float(r.get("V"))
        nomes[d4c] = d4n
    return out, nomes


def carrega_8887(periodos=60):
    rows = sidra(8887, f"/n1/all/v/all/p/last%20{periodos}/c543/all?formato=json")
    out = {}
    for r in rows:
        var_nome = VAR_PIM.get(r.get("D2C"))
        d4c = r.get("D4C")
        d3c = r.get("D3C", "")
        if not var_nome or d4c not in CATEGORIAS_PRINCIPAIS or not d3c:
            continue
        chave = CATEGORIAS_PRINCIPAIS[d4c]
        out.setdefault(_mes(d3c), {}).setdefault(chave, {})[var_nome] = _to_float(r.get("V"))
    return out


def carrega_8889(periodos=24):
    """Filtra indicadores especiais por nome."""
    rows = sidra(8889, f"/n1/all/v/all/p/last%20{periodos}/c25/all?formato=json")
    out = {}
    nomes = {}
    for r in rows:
        var_nome = VAR_PIM.get(r.get("D2C"))
        d4c = r.get("D4C", "")
        d4n = r.get("D4N", "")
        d3c = r.get("D3C", "")
        if not var_nome or not d4c or not d3c:
            continue
        # filtro por nome
        if not any(p.lower() in d4n.lower() for p in PALAVRAS_INDICADORES):
            continue
        out.setdefault(_mes(d3c), {}).setdefault(d4c, {})[var_nome] = _to_float(r.get("V"))
        nomes[d4c] = d4n
    return out, nomes


def carrega_8886(periodos=24):
    """Insumos da construção civil."""
    rows = sidra(8886, f"/n1/all/v/all/p/last%20{periodos}?formato=json")
    out = {}
    for r in rows:
        var_nome = VAR_PIM.get(r.get("D2C"))
        d3c = r.get("D3C", "")
        if not var_nome or not d3c:
            continue
        out.setdefault(_mes(d3c), {})[var_nome] = _to_float(r.get("V"))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "atividade_pim.json"

    print("== PIM 8888 ==")
    secoes_raw, nomes_atividades = carrega_8888()
    print("== PIM 8887 ==")
    cat_raw = carrega_8887()
    print("== PIM 8889 ==")
    esp_raw, nomes_esp = carrega_8889()
    print("== PIM 8886 (construção) ==")
    construcao = carrega_8886()

    meses = sorted(secoes_raw.keys())
    if not meses:
        sys.exit(2)
    mes_recente = meses[-1]

    # geral (indústria geral) – todas vars
    serie_geral = []
    for m in meses:
        item = {"mes": m}
        g = secoes_raw[m].get("129314", {})
        for var_nome in VAR_PIM.values():
            item[var_nome] = g.get(var_nome)
        serie_geral.append(item)

    # secoes (3 cats) — todas vars
    serie_secoes = []
    for m in meses:
        item = {"mes": m}
        for d4c, chave in SECOES.items():
            val = secoes_raw[m].get(d4c, {})
            for var_nome in VAR_PIM.values():
                item[f"{chave}_{var_nome}"] = val.get(var_nome)
        serie_secoes.append(item)

    # categorias econômicas — todas vars
    serie_cat = []
    meses_cat = sorted(cat_raw.keys())
    for m in meses_cat:
        item = {"mes": m}
        for chave in CATEGORIAS_PRINCIPAIS.values():
            val = cat_raw[m].get(chave, {})
            for var_nome in VAR_PIM.values():
                item[f"{chave}_{var_nome}"] = val.get(var_nome)
        serie_cat.append(item)

    # atividades detalhe — TODAS as 25 atividades (não só top 5)
    # Estrutura: mes → list[{atividade, var_yoy, var_mom_sa, indice_sa}]
    atividades_mes = {}
    for m in meses:
        items = []
        for d4c, vals in secoes_raw[m].items():
            if d4c in SECOES:
                continue  # pula os 3 macro
            nome = nomes_atividades.get(d4c, d4c)
            items.append({
                "atividade": nome,
                "id": d4c,
                "var_yoy": vals.get("var_yoy"),
                "var_mom_sa": vals.get("var_mom_sa"),
                "var_acum_12m": vals.get("var_acum_12m"),
                "indice_sa": vals.get("indice_sa"),
            })
        items.sort(key=lambda x: x["var_yoy"] if x["var_yoy"] is not None else -999, reverse=True)
        atividades_mes[m] = items

    # Construção civil — série completa
    serie_construcao = []
    for m in sorted(construcao.keys()):
        item = {"mes": m}
        for var_nome in VAR_PIM.values():
            item[var_nome] = construcao[m].get(var_nome)
        serie_construcao.append(item)

    # Indicadores especiais filtrados
    serie_especiais = []
    todos_d4c_esp = set()
    for m, dic in esp_raw.items():
        todos_d4c_esp.update(dic.keys())
    for m in sorted(esp_raw.keys()):
        item = {"mes": m}
        for d4c in sorted(todos_d4c_esp):
            val = esp_raw[m].get(d4c, {})
            chave = f"esp_{d4c}"
            item[f"{chave}_yoy"] = val.get("var_yoy")
            item[f"{chave}_mom"] = val.get("var_mom_sa")
        serie_especiais.append(item)

    # Sanity
    ult = serie_geral[-1]
    assert ult.get("indice_sa") is None or 70 < ult["indice_sa"] < 130

    out = {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "mes_recente": mes_recente,
        "geral": {"serie": serie_geral},
        "secoes": {
            "categorias": list(SECOES.values()),
            "serie": serie_secoes,
        },
        "categorias_economicas": {
            "categorias": list(CATEGORIAS_PRINCIPAIS.values()),
            "serie": serie_cat,
        },
        "atividades": {  # NOVO — todas atividades, todos os meses
            "mes_recente": mes_recente,
            "serie_mensal": atividades_mes,  # mes → lista
        },
        "construcao": {  # NOVO
            "serie": serie_construcao,
        },
        "indicadores_especiais": {  # NOVO
            "labels": nomes_esp,
            "categorias_ids": sorted(todos_d4c_esp),
            "serie": serie_especiais,
        },
        "metadata": {
            "fonte": "IBGE SIDRA — PIM-PF (8888 seções/atividades, 8887 categorias econômicas, 8889 indicadores especiais, 8886 construção). Base 2022=100.",
            "nota": "Indústria geral é a manchete. Bens de capital reagem primeiro ao ciclo, consumo duráveis em segundo. Insumos da construção é preditor da Construção do PIB.",
        },
    }

    out_file.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"JSON {out_file} ({out_file.stat().st_size/1024:.1f} KB) | atividades: {len(atividades_mes.get(mes_recente, []))} no último mês")

    if args.upload:
        sys.path.insert(0, str(HERE))
        from shared.blob_upload import maybe_upload_json
        maybe_upload_json(out_file, BLOB_PATH)


if __name__ == "__main__":
    main()
