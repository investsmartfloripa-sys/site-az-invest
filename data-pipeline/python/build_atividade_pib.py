"""Build do JSON do Painel Atividade — bloco PIB trimestral (ENRIQUECIDO).

Tabelas IBGE SIDRA das Contas Nacionais Trimestrais:
- 5932 — Taxa de variação do índice de volume trimestral (4 vars × 22 classes)
- 1620/1621 — Série encadeada do índice de volume (sem ajuste / com ajuste)
- 1846 — Valores a preços correntes (R$ milhões — por setor)
- 2072 — Contas econômicas (renda macro: PIB, RNB, RNDB, Poupança, etc.)

Focus PIB anual (BCB Olinda).

JSON: gera todos os 22 sub-setores em variação, índice e R$ correntes; salva pesos atuais
do PIB; histórico completo de Focus pra comparação Realizado × Projetado.
"""
from __future__ import annotations

import argparse, json, sys, time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import requests

HERE = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/atividade_pib.json"
UA = {"User-Agent": "az-invest-atividade-pib/0.2"}
SIDRA_BASE = "https://apisidra.ibge.gov.br/values"

# Classificações c11255 (22 categorias) — chaves limpas
CLASSIF = {
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
    "93404": "consumo_familias",
    "93405": "consumo_governo",
    "93406": "fbcf",
    "93407": "exportacoes",
    "93408": "importacoes",
}

# Labels humanos pro front
CLASSIF_LABEL = {
    "agro": "Agropecuária",
    "industria": "Indústria total",
    "industria_extrativa": "Indústria extrativa",
    "industria_transformacao": "Indústria de transformação",
    "construcao": "Construção",
    "eletricidade_gas": "Eletricidade, gás e água",
    "servicos": "Serviços total",
    "comercio": "Comércio",
    "transporte": "Transporte e armazenagem",
    "informacao": "Informação e comunicação",
    "financeiras": "Atividades financeiras",
    "outros_servicos": "Outros serviços",
    "imobiliarias": "Atividades imobiliárias",
    "admin_publica": "Admin, saúde, educação públicas",
    "valor_adicionado": "Valor adicionado a preços básicos",
    "impostos": "Impostos líquidos sobre produtos",
    "pib": "PIB a preços de mercado",
    "consumo_familias": "Consumo das famílias",
    "consumo_governo": "Consumo do governo",
    "fbcf": "Formação Bruta de Capital Fixo",
    "exportacoes": "Exportações",
    "importacoes": "Importações",
}

VAR_5932 = {"6561": "yoy", "6562": "acum_4t", "6563": "acum_ano", "6564": "qoq_sa"}


def _get(url, *, timeout=90, retries=3, sleep=3.0):
    last = None
    for i in range(retries):
        try:
            r = requests.get(url, timeout=timeout, headers=UA)
            r.raise_for_status()
            return r
        except Exception as e:
            last = e
            print(f"  retry {i+1}/{retries}: {e}", file=sys.stderr)
            time.sleep(sleep)
    raise RuntimeError(f"falha após {retries} tentativas: {last}")


def _to_float(v):
    if v in ("", "-", "..", "...", None):
        return None
    try:
        return float(str(v).replace(",", "."))
    except (TypeError, ValueError):
        return None


def _trim_label(d3c):
    return f"{d3c[:4]}-T{d3c[4:]}"


def sidra_fetch(tabela, path):
    url = f"{SIDRA_BASE}/t/{tabela}{path}"
    print(f"  [SIDRA {tabela}] {url[:140]}...")
    data = _get(url).json()
    return data[1:] if data else []


def carrega_5932(periodos=80):
    """Retorna {trim: {var_nome: {classif: valor}}}."""
    path = f"/n1/all/v/all/p/last%20{periodos}/c11255/all?formato=json"
    rows = sidra_fetch(5932, path)
    out = {}
    for r in rows:
        var_nome = VAR_5932.get(r.get("D2C"))
        classif = CLASSIF.get(r.get("D4C"))
        d3c = r.get("D3C", "")
        if not var_nome or not classif or not d3c:
            continue
        out.setdefault(_trim_label(d3c), {}).setdefault(var_nome, {})[classif] = _to_float(r.get("V"))
    return out


def carrega_indice(tabela, var_id, periodos=80):
    path = f"/n1/all/v/{var_id}/p/last%20{periodos}/c11255/all?formato=json"
    rows = sidra_fetch(tabela, path)
    out = {}
    for r in rows:
        classif = CLASSIF.get(r.get("D4C"))
        d3c = r.get("D3C", "")
        if not classif or not d3c:
            continue
        out.setdefault(_trim_label(d3c), {})[classif] = _to_float(r.get("V"))
    return out


def carrega_1846(periodos=8):
    """PIB nominal por setor — R$ milhões. Pegamos apenas últimos trimestres pra pesos atuais."""
    path = f"/n1/all/v/all/p/last%20{periodos}/c11255/all?formato=json"
    rows = sidra_fetch(1846, path)
    out = {}
    for r in rows:
        classif = CLASSIF.get(r.get("D4C"))
        d3c = r.get("D3C", "")
        if not classif or not d3c:
            continue
        out.setdefault(_trim_label(d3c), {})[classif] = _to_float(r.get("V"))
    return out


def carrega_2072(periodos=12):
    path = f"/n1/all/v/all/p/last%20{periodos}?formato=json"
    rows = sidra_fetch(2072, path)
    by_trim = {}
    for r in rows:
        d3c = r.get("D3C", "")
        d2n = r.get("D2N", "")
        if not d3c:
            continue
        trim = _trim_label(d3c)
        item = by_trim.setdefault(trim, {"trim": trim})
        v = _to_float(r.get("V"))
        if v is not None:
            item[d2n] = v
    return [by_trim[t] for t in sorted(by_trim.keys())]


FOCUS_BASE = "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata"


def focus_pib_anual(ano_atual):
    url = (
        f"{FOCUS_BASE}/ExpectativasMercadoAnuais?$format=json&$top=20000"
        f"&$filter=Indicador%20eq%20%27PIB%20Total%27%20and%20Data%20ge%20%27{ano_atual - 1}-01-01%27"
        f"&$orderby=Data%20desc"
    )
    data = _get(url).json().get("value", [])
    out = {}
    for r in data:
        try:
            ano = int(r["DataReferencia"])
        except (KeyError, ValueError):
            continue
        if ano not in (ano_atual - 1, ano_atual, ano_atual + 1, ano_atual + 2):
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
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "atividade_pib.json"

    print("== PIB Variação 5932 ==")
    var_data = carrega_5932()
    print("== PIB Índice SA 1621 ==")
    idx_sa = carrega_indice(1621, "584")
    print("== PIB Índice NS 1620 ==")
    idx_ns = carrega_indice(1620, "583")
    print("== PIB R$ correntes 1846 ==")
    valores = carrega_1846()
    print("== Contas econômicas 2072 ==")
    contas = carrega_2072()

    trims = sorted(var_data.keys())
    if not trims:
        print("ERRO: nenhum trim em 5932", file=sys.stderr)
        sys.exit(2)
    trim_recente = trims[-1]

    # Calcula pesos atuais do PIB (cada componente / PIB total no último trim)
    valores_recentes = valores.get(trim_recente, {})
    pib_nominal = valores_recentes.get("pib")
    pesos_atuais = {}
    if pib_nominal:
        for k, v in valores_recentes.items():
            if v is not None and k != "pib":
                pesos_atuais[k] = round(v / pib_nominal * 100, 2)

    # Série unificada de variações
    serie_variacao = []
    for trim in trims:
        item = {"trim": trim}
        for var_nome, classifs in var_data[trim].items():
            for classif, v in classifs.items():
                item[f"{var_nome}_{classif}"] = v
        serie_variacao.append(item)

    # Série de índices (níveis)
    serie_indice = []
    todos_trim_idx = sorted(set(idx_sa.keys()) | set(idx_ns.keys()))
    for trim in todos_trim_idx:
        item = {"trim": trim}
        sa = idx_sa.get(trim, {})
        ns = idx_ns.get(trim, {})
        for ck in CLASSIF.values():
            item[f"sa_{ck}"] = sa.get(ck)
            item[f"ns_{ck}"] = ns.get(ck)
        serie_indice.append(item)

    # Série de valores nominais (R$ correntes)
    serie_valores = []
    for trim in sorted(valores.keys()):
        item = {"trim": trim}
        for ck, v in valores[trim].items():
            item[ck] = v
        serie_valores.append(item)

    print("== Focus PIB anual ==")
    ano_atual = int(trim_recente[:4])
    try:
        focus = focus_pib_anual(ano_atual)
        print(f"  Focus anos: {sorted(focus.keys())}")
    except Exception as e:
        print(f"  [WARN] Focus indisponível ({e}). Fallback Blob.", file=sys.stderr)
        focus = {}
        try:
            sys.path.insert(0, str(HERE))
            from shared.blob_download import download_json
            prev = download_json(BLOB_PATH)
            if prev and prev.get("focus"):
                focus = prev["focus"]
        except Exception:
            pass

    # Sanity
    ultimo = serie_variacao[-1]
    yoy_pib = ultimo.get("yoy_pib")
    qoq_pib = ultimo.get("qoq_sa_pib")
    assert yoy_pib is None or -15 < yoy_pib < 15
    assert qoq_pib is None or -10 < qoq_pib < 10

    out = {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "trim_recente": trim_recente,
        "variacao": {"serie": serie_variacao},
        "indice_volume": {"serie": serie_indice},
        "valores_correntes": {"serie": serie_valores},  # NOVO
        "contas_economicas": {"serie": contas},
        "pesos_atuais": pesos_atuais,  # NOVO
        "labels": CLASSIF_LABEL,  # NOVO
        "focus": focus,
        "metadata": {
            "fonte_principal": "IBGE SIDRA — Contas Nacionais Trimestrais (5932 variação, 1620/1621 índice volume, 1846 R$ correntes, 2072 contas econômicas)",
            "fonte_focus": "BCB Olinda — ExpectativasMercadoAnuais PIB Total",
            "nota": "PIB sai trimestral lag ~60 dias. Pesos atuais calculados a partir de 1846. Cada nova divulgação revisa trimestres anteriores.",
        },
    }

    out_file.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nJSON salvo {out_file} ({out_file.stat().st_size/1024:.1f} KB)")
    print(f"Trim recente: {trim_recente} | PIB YoY {yoy_pib}% | QoQ SA {qoq_pib}%")

    if args.upload:
        try:
            sys.path.insert(0, str(HERE))
            from shared.blob_upload import maybe_upload_json
            maybe_upload_json(out_file, BLOB_PATH)
        except Exception as e:
            print(f"[upload] FALHOU: {e}", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    main()
