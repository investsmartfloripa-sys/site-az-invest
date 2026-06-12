"""Build do JSON do Painel Atividade — bloco PIB trimestral (schema v2, aditivo).

Tabelas IBGE SIDRA das Contas Nacionais Trimestrais:
- 5932 — Taxa de variação do índice de volume trimestral (4 vars × 22 classes)
- 1620/1621 — Série encadeada do índice de volume (sem ajuste / com ajuste)
- 1846 — Valores a preços correntes (R$ milhões — por setor; janela de 84 trim p/ pesos t-4)
- 2072 — Contas econômicas (renda macro: PIB, RNB, RNDB, Poupança, etc.)
- 6784 — PIB e PIB per capita anuais (SCN anual)

Focus PIB anual (BCB Olinda).

Schema v2 (aditivo sobre o v1):
- contribuicoes.serie — contribuição ponderada ao crescimento YoY (óticas oferta e demanda),
  peso nominal do MESMO trimestre do ano anterior (t-4, convenção BCB/research); importações
  com sinal trocado; resíduo = não-aditividade do encadeamento (+ estoques na demanda).
  Índices encadeados são NÃO-aditivos: validação por tolerância, nunca igualdade exata.
- carrego — carry-over estatístico do ano corrente (índice SA congelado no último trim divulgado).
- per_capita.serie — PIB per capita anual (SIDRA 6784) + variação real per capita implícita.
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


def carrega_1846(periodos=84):
    """PIB nominal por setor — R$ milhões. Janela de 84 trim: cobre o peso t-4 dos 80 trim da 5932."""
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


VAR_6784 = {
    "9812": "per_capita_nominal",      # PIB per capita - valores correntes (R$)
    "9814": "var_real_per_capita",     # PIB per capita - variação em volume (%) — OFICIAL
    "9810": "var_real_pib",            # PIB - variação em volume (%)
    "93": "populacao_mil",             # População residente (mil pessoas)
}


def carrega_6784():
    """PIB e PIB per capita anuais (SCN anual 6784) — variação real per capita OFICIAL (9814)."""
    rows = sidra_fetch(6784, "/n1/all/v/all/p/all?formato=json")
    out = {}
    for r in rows:
        campo = VAR_6784.get(r.get("D2C", ""))
        ano = r.get("D3C", "")
        if not campo or not ano:
            continue
        out.setdefault(ano, {})[campo] = _to_float(r.get("V"))
    return out


# ── Contribuições ao crescimento (schema v2) ─────────────────────────────────
OFERTA_COMPONENTES = ["agro", "industria", "servicos", "impostos"]
DEMANDA_COMPONENTES = ["consumo_familias", "consumo_governo", "fbcf", "exportacoes", "importacoes"]


def _trim_add(trim, n):
    """'2024-T01' + n trimestres (mantém o zero à esquerda do _trim_label)."""
    y, q = trim.split("-T")
    idx = int(y) * 4 + (int(q) - 1) + n
    return f"{idx // 4}-T{idx % 4 + 1:02d}"


def calcula_contribuicoes(trims, var_data, valores):
    """Contribuição_i(t) = w_i(t-4) × yoy_i(t), w = nominal_i(t-4)/PIB nominal(t-4).

    Importações com sinal trocado (ótica da demanda). Resíduo = yoy_pib − Σ contribuições:
    na oferta captura a não-aditividade do encadeamento; na demanda soma estoques +
    discrepância estatística. NUNCA assert de igualdade exata (Laspeyres encadeado é não-aditivo).
    """
    serie = []
    max_residuo_oferta = 0.0
    for trim in trims:
        base = valores.get(_trim_add(trim, -4)) or {}
        pib_nom = base.get("pib")
        var_t = var_data.get(trim, {}).get("yoy", {})
        yoy_pib_t = var_t.get("pib")
        if not pib_nom or yoy_pib_t is None:
            continue
        item = {"trim": trim, "pib_yoy": yoy_pib_t}
        # ótica da oferta
        soma = 0.0
        ok = True
        for k in OFERTA_COMPONENTES:
            w, y = base.get(k), var_t.get(k)
            if w is None or y is None:
                ok = False
                break
            c = round(w / pib_nom * y, 2)
            item[f"oferta_{k}"] = c
            soma += c
        if ok:
            residuo = round(yoy_pib_t - soma, 2)
            item["oferta_residuo"] = residuo
            max_residuo_oferta = max(max_residuo_oferta, abs(residuo))
        # ótica da demanda
        soma = 0.0
        ok = True
        for k in DEMANDA_COMPONENTES:
            w, y = base.get(k), var_t.get(k)
            if w is None or y is None:
                ok = False
                break
            sinal = -1.0 if k == "importacoes" else 1.0
            c = round(sinal * w / pib_nom * y, 2)
            item[f"demanda_{k}"] = c
            soma += c
        if ok:
            # resíduo da demanda = variação de estoques + discrepância estatística
            item["demanda_residuo"] = round(yoy_pib_t - soma, 2)
        serie.append(item)
    print(f"  [contribuições] {len(serie)} trimestres | resíduo máx oferta {max_residuo_oferta:.2f} p.p. (tolerância 1,0)")
    if max_residuo_oferta > 1.0:
        print("  [WARN] resíduo da ótica da oferta acima de 1 p.p. — conferir pesos/fontes", file=sys.stderr)
    return serie


def calcula_carrego(serie_indice, trim_recente):
    """Carry-over do ano corrente: média do índice SA do ano (último trim divulgado congelado
    nos restantes) ÷ média do índice SA do ano anterior − 1."""
    sa_by_trim = {row["trim"]: row.get("sa_pib") for row in serie_indice}
    ano = int(trim_recente[:4])
    pub = [sa_by_trim.get(f"{ano}-T{q:02d}") for q in (1, 2, 3, 4)]
    pub = [v for v in pub if v is not None]
    prev = [sa_by_trim.get(f"{ano - 1}-T{q:02d}") for q in (1, 2, 3, 4)]
    if not pub or any(v is None for v in prev):
        return None
    congelado = pub + [pub[-1]] * (4 - len(pub))
    valor = round((sum(congelado) / 4) / (sum(prev) / 4) * 100 - 100, 2)
    return {"ano": ano, "valor": valor, "trimestres_divulgados": len(pub)}


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

    # ── schema v2: contribuições ao crescimento (peso t-4) ──
    print("== Contribuições ao crescimento (v2) ==")
    serie_contrib = calcula_contribuicoes(trims, var_data, valores)

    # ── schema v2: carrego estatístico do ano corrente ──
    carrego = calcula_carrego(serie_indice, trim_recente)
    if carrego:
        print(f"  [carrego] {carrego['ano']}: {carrego['valor']}% com {carrego['trimestres_divulgados']} trim divulgados")
        # teste de consistência: com 4 trim divulgados, carrego ≈ acumulado no ano (T4)
        if carrego["trimestres_divulgados"] == 4:
            acum = serie_variacao[-1].get("acum_ano_pib")
            if acum is not None and abs(carrego["valor"] - acum) > 0.5:
                print(f"  [WARN] carrego({carrego['valor']}) difere do acum_ano({acum}) > 0,5 p.p.", file=sys.stderr)

    # ── schema v2: PIB per capita anual (6784) ──
    print("== PIB per capita 6784 (v2) ==")
    serie_per_capita = []
    try:
        anos_pc = carrega_6784()
        anos_ord = sorted(a for a in anos_pc if anos_pc[a].get("per_capita_nominal") is not None)
        for ano in anos_ord:
            d = anos_pc[ano]
            serie_per_capita.append({
                "ano": ano,
                "per_capita_nominal": d.get("per_capita_nominal"),
                "var_real_per_capita": d.get("var_real_per_capita"),
                "var_real_pib": d.get("var_real_pib"),
                "populacao_mil": d.get("populacao_mil"),
            })
        print(f"  per capita: {len(serie_per_capita)} anos ({anos_ord[0] if anos_ord else '—'}–{anos_ord[-1] if anos_ord else '—'})")
    except Exception as e:
        print(f"  [WARN] 6784 indisponível ({e}) — per_capita omitido nesta rodada", file=sys.stderr)

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
        "schema_version": 2,
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "trim_recente": trim_recente,
        "variacao": {"serie": serie_variacao},
        "indice_volume": {"serie": serie_indice},
        "valores_correntes": {"serie": serie_valores},
        "contas_economicas": {"serie": contas},
        "pesos_atuais": pesos_atuais,
        "labels": CLASSIF_LABEL,
        "focus": focus,
        # ── v2 ──
        "contribuicoes": {"serie": serie_contrib},
        "carrego": carrego,
        "per_capita": {"serie": serie_per_capita},
        "metadata": {
            "fonte_principal": "IBGE SIDRA — Contas Nacionais Trimestrais (5932 variação, 1620/1621 índice volume, 1846 R$ correntes, 2072 contas econômicas, 6784 per capita anual)",
            "fonte_focus": "BCB Olinda — ExpectativasMercadoAnuais PIB Total",
            "nota": "PIB sai trimestral lag ~60 dias. Cada nova divulgação revisa trimestres anteriores. Contribuições: peso nominal t-4 (1846) × YoY real (5932); índices encadeados são não-aditivos — resíduo gravado por ótica (na demanda inclui estoques + discrepância). Carrego: índice SA congelado no último trim divulgado. Per capita: SIDRA 6784 — variação em volume per capita OFICIAL (v9814).",
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
