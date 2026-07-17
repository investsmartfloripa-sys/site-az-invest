"""Build do JSON do Painel IPCA.

Baixa dados de:
- IBGE SIDRA (IPCA cheio tabela 7060, IPCA-15 tabela 7062)
- BCB SGS (núcleos do IPCA, índice de difusão)
- BCB Olinda (expectativas Focus IPCA)

Gera `data-pipeline/out/ipca.json` e faz upload para Vercel Blob em `data/ipca.json`.

Lê BLOB_READ_WRITE_TOKEN do ambiente (idêntico aos outros builds).

schema_version 2 (2026-06): acumulados 12m por COMPOSIÇÃO geométrica e
contribuições 12m por encadeamento calculados AQUI (nunca no front — ver
PLANO-GRAFICOS-ECONOMIA-2026-06-11.md, princípio 1 da área de inflação):
- janela da âncora estendida 24 → 72 meses (teto prático da SIDRA 7060,
  que começa em jan/2020);
- `ipca_cheio.serie_contrib_12m`: contribuição de cada grupo ao acumulado
  12m via encadeamento, com resíduo de arredondamento realocado pró-rata
  p/ a pilha fechar EXATAMENTE com o IPCA 12m oficial (v2265);
- `nucleos.serie_12m` / `categorias.serie_12m`: 12m composto Π(1+v/100)−1
  de cada núcleo/categoria + média dos 5 núcleos do BC (EX0/EX3/MS/DP/P —
  MA fica fora, é a versão não suavizada da MS) e banda mín–máx;
- `difusao`: série com média móvel 3m e média histórica (jan/2012+) como régua;
- `sazonalidade`: mediana/média/mín/máx da variação mensal por mês civil
  (janela de 10 anos completos) — base do card "veio acima do padrão do mês?";
- validações automáticas no final do build: falhou, não publica.

schema_version 3 (2026-07): escrutínio completo p/ as tabs do painel + contrato
estável do robô de publicação (`data/ipca_release.json`):
- `tabela_sintese`: tabela estilo Carta de Conjuntura (IPEA) — cheio, IPCA-15,
  grupos, núcleos, categorias e difusão × [m-2, m-1, mês, acum. ano, 12m, peso];
- `abertura_hierarquica`: árvore grupo → subgrupo → item do mês (var, peso,
  contrib, acum. ano, 12m), da MESMA consulta SIDRA que alimenta as influências
  (subitens ganham acum. ano/12m de brinde);
- `momentum`: variação dessazonalizada (STL log-multiplicativa, período 12,
  robusta) e 3m/6m anualizados (SAAR) p/ cheio, núcleos, serviços e livres —
  dessazonalização SEMPRE aqui, nunca no front;
- `serie_longa` + `metas`: IPCA mensal e 12m oficial (SGS 433/13522) desde 1999
  com a meta CMN vigente mês a mês (tabela versionada abaixo) p/ o gráfico de
  tendência com meta escalonada;
- `focus_mensal` / `focus_12m` / `surpresas`: expectativas de curtíssimo prazo
  (Olinda ExpectativaMercadoMensais, baseCalculo=0), suavizada 12 meses à
  frente e histórico realizado × esperado na véspera da divulgação;
- `data/ipca_release.json` (schema próprio, v1): resumo legível por máquina da
  última divulgação — insumo do robô que escreve o texto do release.
"""
from __future__ import annotations

import argparse
import json
import re
import statistics
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

HERE = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/ipca.json"

UA = {"User-Agent": "az-invest-ipca-builder/0.2"}

SCHEMA_VERSION = 3

BLOB_PATH_RELEASE = "data/ipca_release.json"
RELEASE_SCHEMA_VERSION = 1

#: Janela da âncora (meses pedidos à SIDRA). 72 é o teto prático: a tabela
#: 7060 (POF 2020) começa em jan/2020 — em meados de 2026 há ~77 meses.
ANCORA_MESES = 72

#: Núcleos que entram na "média dos núcleos" (convenção de comunicação do
#: BCB: 5 medidas; MA fica de fora por ser a versão não suavizada da MS).
NUCLEOS_MEDIA = ("EX0", "EX3", "MS", "DP", "P")

#: Início da janela de referência da difusão (regime de metas maduro; a
#: série SGS 21379 começa em 1991 contaminada pela hiperinflação).
DIFUSAO_REF_INICIO = "2012-01"

#: Série longa (tendência): início do regime de metas. Antes de 1999 a escala
#: da inflação torna o gráfico ilegível e a comparação institucional inválida.
SERIE_LONGA_DESDE = "1999-01"

#: Dessazonalização STL: ajustar desde 2004 (pós-transição do regime de metas;
#: 2002-03 tem choque cambial que distorce o padrão sazonal estimado) e
#: publicar desde 2012 (janela conjuntural longa o suficiente p/ tendência).
MOMENTUM_AJUSTE_DESDE = "2004-01"
MOMENTUM_PUBLICA_DESDE = "2012-01"

#: Metas de inflação do CMN (centro e tolerância, % a.a.). Tabela NORMATIVA —
#: muda apenas por resolução do CMN (última: regime de meta contínua a partir
#: de 2025, Resolução CMN 5.109/2023). 2003-04 usam as metas AJUSTADAS
#: (Resolução 3.108/2003), convenção da tabela histórica do próprio BCB.
METAS_CMN: list[dict] = [
    {"ano": 1999, "meta": 8.0, "tol": 2.0},
    {"ano": 2000, "meta": 6.0, "tol": 2.0},
    {"ano": 2001, "meta": 4.0, "tol": 2.0},
    {"ano": 2002, "meta": 3.5, "tol": 2.0},
    {"ano": 2003, "meta": 4.0, "tol": 2.5},
    {"ano": 2004, "meta": 5.5, "tol": 2.5},
    {"ano": 2005, "meta": 4.5, "tol": 2.5},
    *[{"ano": a, "meta": 4.5, "tol": 2.0} for a in range(2006, 2017)],
    {"ano": 2017, "meta": 4.5, "tol": 1.5},
    {"ano": 2018, "meta": 4.5, "tol": 1.5},
    {"ano": 2019, "meta": 4.25, "tol": 1.5},
    {"ano": 2020, "meta": 4.0, "tol": 1.5},
    {"ano": 2021, "meta": 3.75, "tol": 1.5},
    {"ano": 2022, "meta": 3.5, "tol": 1.5},
    {"ano": 2023, "meta": 3.25, "tol": 1.5},
    {"ano": 2024, "meta": 3.0, "tol": 1.5},
    # 2025+: meta CONTÍNUA de 3,0% ± 1,5 p.p. (sem ano-calendário).
]
META_CONTINUA = {"desde": 2025, "meta": 3.0, "tol": 1.5}


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


def _parse_mes_sidra(s: str) -> str:
    return f"{s[:4]}-{s[4:]}"


# ---------------------------------------------------------------------------
# SIDRA (IBGE)
# ---------------------------------------------------------------------------
SIDRA_BASE = "https://apisidra.ibge.gov.br/values"


def sidra_fetch(tabela: int, path: str) -> list[dict]:
    url = f"{SIDRA_BASE}/t/{tabela}{path}"
    print(f"  [SIDRA] {url}")
    data = _get(url).json()
    if not data:
        return []
    header = data[0]
    return [{header.get(k, k): v for k, v in item.items()} for item in data[1:]]


#: c315: Índice geral (7169) + os 9 grupos do IPCA. Pedir só esses códigos à
#: SIDRA (em vez de c315/all) corta o payload de ~100 mil p/ ~2 mil linhas e
#: viabiliza a janela de 72 meses sem esbarrar no limite da API.
GRUPOS_CODES = ("7169", "7170", "7445", "7486", "7558", "7625", "7660", "7712", "7766", "7786")


def carrega_ipca_hierarquia(
    tabela: int,
    var_mensal: str,
    var_peso: str,
    var_12m: str,
    periodos: int = ANCORA_MESES,
) -> dict:
    """Carrega IPCA (ou IPCA-15) no nível Índice geral + grupos, retorna estrutura pivotada."""
    c315 = ",".join(GRUPOS_CODES)
    path = f"/n1/all/v/{var_mensal},{var_peso},{var_12m}/p/last%20{periodos}/c315/{c315}/d/v{var_mensal}%202,v{var_peso}%202,v{var_12m}%202"
    rows = sidra_fetch(tabela, path)
    col_var = "Variável (Código)"
    col_grupo = "Geral, grupo, subgrupo, item e subitem"
    col_grupo_cod = "Geral, grupo, subgrupo, item e subitem (Código)"
    col_mes = "Mês (Código)"

    serie_mensal: dict[str, dict[str, float]] = {}
    serie_12m: dict[str, float | None] = {}
    ipca_cheio_m: dict[str, float | None] = {}
    pesos_por_mes: dict[str, dict[str, float]] = {}

    for r in rows:
        if r.get(col_grupo_cod) not in GRUPOS_CODES:
            continue
        mes = _parse_mes_sidra(r[col_mes])
        grupo = r[col_grupo]
        val = _to_float(r["Valor"])
        var = r.get(col_var)
        if var == var_mensal:
            if grupo == "Índice geral":
                ipca_cheio_m[mes] = val
            elif val is not None:
                serie_mensal.setdefault(mes, {})[grupo] = val
        elif var == var_12m:
            if grupo == "Índice geral":
                serie_12m[mes] = val
        elif var == var_peso:
            if grupo != "Índice geral" and val is not None:
                pesos_por_mes.setdefault(mes, {})[grupo] = val

    meses = sorted(serie_mensal.keys())
    if not meses:
        return {"serie": [], "pesos_recentes": {}, "mes_recente": "", "grupos": []}
    mes_ref = meses[-1]
    pesos_recentes = pesos_por_mes.get(mes_ref, {})

    serie: list[dict] = []
    for m in meses:
        item: dict[str, Any] = {"mes": m}
        vars_grupo = serie_mensal.get(m, {})
        pesos_m = pesos_por_mes.get(m, {})
        soma_contrib = 0.0
        for g, var in vars_grupo.items():
            item[g] = var
            p = pesos_m.get(g)
            if var is not None and p is not None:
                c = var * p / 100.0
                item[f"{g} (contrib)"] = round(c, 4)
                soma_contrib += c
        item["IPCA cheio"] = ipca_cheio_m.get(m)
        item["IPCA 12m"] = serie_12m.get(m)
        item["contrib_soma"] = round(soma_contrib, 4)
        serie.append(item)

    grupos_ordenados = sorted(pesos_recentes.keys(), key=lambda g: pesos_recentes.get(g, 0), reverse=True)
    return {
        "serie": serie,
        "pesos_recentes": pesos_recentes,
        "mes_recente": mes_ref,
        "grupos": grupos_ordenados,
    }


# ---------------------------------------------------------------------------
# BCB SGS
# ---------------------------------------------------------------------------
SGS_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{cod}/dados?formato=json"


def _parse_sgs_date(s: str) -> str:
    d, m, y = s.split("/")
    return f"{y}-{m}"


def sgs_fetch(cod: int) -> dict[str, float | None]:
    url = SGS_URL.format(cod=cod)
    print(f"  [SGS {cod}] {url}")
    data = _get(url).json()
    return {_parse_sgs_date(r["data"]): _to_float(r["valor"]) for r in data}


# ---------------------------------------------------------------------------
# Transformações (schema v2) — TODO acumulado 12m nasce AQUI, nunca no front
# ---------------------------------------------------------------------------
def compoe_12m(valores: dict[str, float | None], meses: list[str]) -> dict[str, float | None]:
    """Acumulado 12m por composição geométrica encadeada: (Π(1+v/100)−1)·100.

    `meses` deve ser a lista ORDENADA de competências; janelas com buraco
    viram None (nunca soma aritmética — bug que este builder aposenta).
    """
    out: dict[str, float | None] = {}
    for i, m in enumerate(meses):
        if i < 11:
            out[m] = None
            continue
        prod = 1.0
        ok = True
        for j in range(i - 11, i + 1):
            v = valores.get(meses[j])
            if v is None:
                ok = False
                break
            prod *= 1 + v / 100.0
        out[m] = round((prod - 1) * 100.0, 4) if ok else None
    return out


def media_movel_3m(valores: dict[str, float | None], meses: list[str]) -> dict[str, float | None]:
    """Média móvel simples de 3 meses (None se faltar observação na janela)."""
    out: dict[str, float | None] = {}
    for i, m in enumerate(meses):
        if i < 2:
            out[m] = None
            continue
        janela = [valores.get(meses[j]) for j in range(i - 2, i + 1)]
        out[m] = round(sum(janela) / 3.0, 2) if all(v is not None for v in janela) else None
    return out


def contribuicoes_12m(serie: list[dict], grupos: list[str]) -> list[dict]:
    """Contribuição de cada grupo ao acumulado 12m, por ENCADEAMENTO.

    contrib_g(T) = Σ_{t=T−11..T} c_g,t · Π_{s=t+1..T}(1 + π_s/100), onde
    c_g,t é a contribuição mensal (p.p., var×peso÷100) e π_s o IPCA cheio do
    mês. O resíduo (oficial v2265 − soma) é de ARREDONDAMENTO (~centésimos)
    e é realocado pró-rata por |contrib| p/ a pilha fechar exatamente com a
    série oficial; `residuo_pp` guarda o valor pré-ajuste p/ transparência.
    """
    out: list[dict] = []
    for i in range(11, len(serie)):
        janela = serie[i - 11 : i + 1]
        mes = janela[-1]["mes"]
        oficial = janela[-1].get("IPCA 12m")
        cheio = [x.get("IPCA cheio") for x in janela]
        if oficial is None or any(v is None for v in cheio):
            continue

        # fator[t] = Π_{s=t+1..T}(1+π_s/100) — encadeia a contrib do mês t até T.
        fator = [1.0] * 12
        for t in range(10, -1, -1):
            fator[t] = fator[t + 1] * (1 + cheio[t + 1] / 100.0)

        contribs: dict[str, float] = {}
        ok = True
        for g in grupos:
            total = 0.0
            for t, x in enumerate(janela):
                c = x.get(f"{g} (contrib)")
                if c is None:
                    ok = False
                    break
                total += c * fator[t]
            if not ok:
                break
            contribs[g] = total
        if not ok:
            continue

        residuo = oficial - sum(contribs.values())
        soma_abs = sum(abs(v) for v in contribs.values())
        if soma_abs > 0:
            contribs = {g: v + residuo * abs(v) / soma_abs for g, v in contribs.items()}

        item: dict[str, Any] = {"mes": mes, "IPCA 12m": oficial, "residuo_pp": round(residuo, 4)}
        for g, v in contribs.items():
            item[g] = round(v, 4)
        out.append(item)
    return out


def sazonalidade_mensal(serie: dict[str, float | None], ano_ini: int, ano_fim: int) -> dict[str, dict]:
    """Mediana/média/mín/máx da variação mensal por mês civil em [ano_ini, ano_fim].

    Mediana como estatística central (robusta aos outliers de 2020-22, sem
    decisão editorial de excluir anos — ver crítica do revisor no plano).
    """
    por_mes: dict[str, list[float]] = {f"{i:02d}": [] for i in range(1, 13)}
    for m, v in serie.items():
        if v is None:
            continue
        if ano_ini <= int(m[:4]) <= ano_fim:
            por_mes[m[5:7]].append(v)
    out: dict[str, dict] = {}
    for mm, vals in por_mes.items():
        if not vals:
            out[mm] = {"mediana": None, "media": None, "min": None, "max": None, "n": 0}
        else:
            out[mm] = {
                "mediana": round(statistics.median(vals), 3),
                "media": round(statistics.mean(vals), 3),
                "min": round(min(vals), 3),
                "max": round(max(vals), 3),
                "n": len(vals),
            }
    return out


# ---------------------------------------------------------------------------
# Transformações (schema v3) — acum. ano, série longa, metas, dessaz STL, SAAR
# ---------------------------------------------------------------------------
def _mes_mais(mes: str, delta: int) -> str:
    """"2026-06" + delta meses (delta pode ser negativo)."""
    total = int(mes[:4]) * 12 + (int(mes[5:7]) - 1) + delta
    return f"{total // 12}-{total % 12 + 1:02d}"


def acum_ano_composto(valores: dict[str, float | None], mes_ref: str) -> float | None:
    """Acumulado no ANO por composição: Π(1+v/100)−1 de janeiro até mes_ref."""
    ano = mes_ref[:4]
    prod = 1.0
    n = 0
    for mm in range(1, int(mes_ref[5:7]) + 1):
        v = valores.get(f"{ano}-{mm:02d}")
        if v is None:
            return None
        prod *= 1 + v / 100.0
        n += 1
    return round((prod - 1) * 100.0, 4) if n else None


def percentil_sazonal(valores: dict[str, float | None], mes_ref: str, ano_ini: int, ano_fim: int) -> float | None:
    """Percentil da variação do mês na distribuição do MESMO mês civil (janela da sazonalidade)."""
    atual = valores.get(mes_ref)
    if atual is None:
        return None
    hist = [
        v for m, v in valores.items()
        if v is not None and m[5:7] == mes_ref[5:7] and ano_ini <= int(m[:4]) <= ano_fim
    ]
    if len(hist) < 5:
        return None
    return round(100.0 * sum(1 for v in hist if v <= atual) / len(hist), 1)


def meta_do_mes(mes: str) -> dict:
    """Meta CMN vigente no mês (centro/piso/teto) — regime contínuo a partir de 2025."""
    ano = int(mes[:4])
    if ano >= META_CONTINUA["desde"]:
        m, t = META_CONTINUA["meta"], META_CONTINUA["tol"]
    else:
        row = next((r for r in METAS_CMN if r["ano"] == ano), None)
        m, t = (row["meta"], row["tol"]) if row else (META_CONTINUA["meta"], META_CONTINUA["tol"])
    return {"meta": m, "piso": round(m - t, 2), "teto": round(m + t, 2)}


def serie_longa_build(ipca_mensal: dict[str, float | None], oficial_12m: dict[str, float | None]) -> list[dict]:
    """IPCA mensal (SGS 433) + 12m oficial (SGS 13522) desde 1999, com a meta
    vigente mês a mês — pronto p/ o gráfico de tendência com meta escalonada."""
    meses = sorted(m for m, v in ipca_mensal.items() if v is not None and m >= SERIE_LONGA_DESDE)
    return [
        {"mes": m, "var": ipca_mensal.get(m), "acum_12m": oficial_12m.get(m), **meta_do_mes(m)}
        for m in meses
    ]


def _tail_contiguo(meses: list[str]) -> list[str]:
    """Maior sufixo de meses CONSECUTIVOS (STL exige série regular sem buraco)."""
    if not meses:
        return []
    ini = len(meses) - 1
    while ini > 0:
        if _mes_mais(meses[ini - 1], 1) != meses[ini]:
            break
        ini -= 1
    return meses[ini:]


def dessazonaliza_stl(valores: dict[str, float | None], desde: str = MOMENTUM_AJUSTE_DESDE) -> dict[str, float]:
    """Variação mensal DESSAZONALIZADA via STL sobre o log do índice encadeado.

    Método: índice = 100·Π(1+v/100); y = ln(índice); STL(período 12, robusta);
    ajustada = tendência + resíduo (sazonal removido); var_sa = Δ% da ajustada.
    Multiplicativa via log — consistente com índice de preços. NÃO é o X-13 do
    BCB (rotulado na ficha técnica). Retorna {} se série curta ou sem statsmodels.
    """
    meses = _tail_contiguo(sorted(m for m, v in valores.items() if v is not None and m >= desde))
    if len(meses) < 48:
        print(f"  [STL] série curta ({len(meses)}m < 48) — pulando", file=sys.stderr)
        return {}
    try:
        import math

        import pandas as pd
        from statsmodels.tsa.seasonal import STL
    except ImportError as e:  # noqa: BLE001
        print(f"  [STL] dependência ausente ({e}) — momentum ficará vazio", file=sys.stderr)
        return {}
    log_idx: list[float] = []
    acc = 0.0
    for m in meses:
        acc += math.log(1 + valores[m] / 100.0)
        log_idx.append(acc)
    serie = pd.Series(log_idx, index=pd.PeriodIndex(meses, freq="M"))
    res = STL(serie, period=12, robust=True).fit()
    sa = res.trend + res.resid
    out: dict[str, float] = {}
    for i in range(1, len(meses)):
        out[meses[i]] = (math.exp(float(sa.iloc[i]) - float(sa.iloc[i - 1])) - 1) * 100.0
    return out


def anualizada(var_sa: dict[str, float], janela: int) -> dict[str, float]:
    """SAAR: taxa da janela de `janela` meses dessaz, anualizada geometricamente."""
    meses = sorted(var_sa.keys())
    out: dict[str, float] = {}
    for i in range(janela - 1, len(meses)):
        prod = 1.0
        for j in range(i - janela + 1, i + 1):
            prod *= 1 + var_sa[meses[j]] / 100.0
        out[meses[i]] = round((prod ** (12.0 / janela) - 1) * 100.0, 4)
    return out


def momentum_build(fontes: dict[str, dict[str, float | None]]) -> dict:
    """Bloco momentum: var dessaz + SAAR 3m/6m por série + média dos 5 núcleos."""
    series: dict[str, list[dict]] = {}
    saar3_map: dict[str, dict[str, float]] = {}
    for sid, valores in fontes.items():
        var_sa = dessazonaliza_stl(valores)
        if not var_sa:
            continue
        s3 = anualizada(var_sa, 3)
        s6 = anualizada(var_sa, 6)
        saar3_map[sid] = s3
        series[sid] = [
            {"mes": m, "var_sa": round(var_sa[m], 4), "saar_3m": s3.get(m), "saar_6m": s6.get(m)}
            for m in sorted(var_sa.keys())
            if m >= MOMENTUM_PUBLICA_DESDE
        ]
    media_pontos: list[dict] = []
    if all(k in saar3_map for k in NUCLEOS_MEDIA):
        meses_comuns = sorted(set.intersection(*[set(saar3_map[k].keys()) for k in NUCLEOS_MEDIA]))
        media_pontos = [
            {"mes": m, "saar_3m": round(sum(saar3_map[k][m] for k in NUCLEOS_MEDIA) / len(NUCLEOS_MEDIA), 4)}
            for m in meses_comuns
            if m >= MOMENTUM_PUBLICA_DESDE
        ]
    return {
        "metodo": "STL sobre log do índice encadeado (período 12, robusta); SAAR = janela dessaz anualizada geometricamente",
        "ajuste_desde": MOMENTUM_AJUSTE_DESDE,
        "publica_desde": MOMENTUM_PUBLICA_DESDE,
        "series": series,
        "media_nucleos_saar3m": media_pontos,
    }


# ---------------------------------------------------------------------------
# Focus (BCB Olinda)
# ---------------------------------------------------------------------------
FOCUS_BASE = "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata"


def focus_anuais(ano_atual: int) -> dict[int, list[dict]]:
    url = (
        f"{FOCUS_BASE}/ExpectativasMercadoAnuais?$format=json&$top=20000"
        f"&$filter=Indicador%20eq%20%27IPCA%27%20and%20Data%20ge%20%27{ano_atual - 1}-01-01%27"
        f"&$orderby=Data%20desc"
    )
    print(f"  [Focus] {url}")
    data = _get(url).json().get("value", [])
    out: dict[int, list[dict]] = {}
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
        out[ano] = out[ano][-365:]
    return out


def _focus_mensal_query(ref_mm_yyyy: str) -> dict | None:
    """Última pesquisa Focus (baseCalculo=0, convenção do boletim) p/ um mês de
    referência no formato "MM/YYYY". Após a divulgação do IBGE o BC para de
    coletar o mês ⇒ a última pesquisa disponível ≈ véspera da divulgação."""
    url = (
        f"{FOCUS_BASE}/ExpectativaMercadoMensais?$format=json&$top=1"
        f"&$filter=Indicador%20eq%20%27IPCA%27%20and%20DataReferencia%20eq%20%27{ref_mm_yyyy.replace('/', '%2F')}%27"
        f"%20and%20baseCalculo%20eq%200&$orderby=Data%20desc"
    )
    data = _get(url, retries=2, sleep=1.5).json().get("value", [])
    if not data:
        return None
    r = data[0]
    return {
        "data_pesquisa": r.get("Data", "")[:10],
        "mediana": _to_float(r.get("Mediana")),
        "media": _to_float(r.get("Media")),
        "dp": _to_float(r.get("DesvioPadrao")),
        "min": _to_float(r.get("Minimo")),
        "max": _to_float(r.get("Maximo")),
        "n_respondentes": r.get("numeroRespondentes"),
    }


def _ref_mm_yyyy(mes: str) -> str:
    return f"{mes[5:7]}/{mes[:4]}"


def focus_mensais_build(mes_recente: str, ipca_mensal: dict[str, float | None], n_surpresas: int = 24) -> dict:
    """Expectativas mensais do Focus: véspera do mês recente, próximos 4 meses
    e histórico realizado × esperado (surpresa inflacionária, em p.p.)."""
    vespera = _focus_mensal_query(_ref_mm_yyyy(mes_recente))
    proximos: list[dict] = []
    for d in range(1, 5):
        ref = _mes_mais(mes_recente, d)
        time.sleep(0.25)
        p = _focus_mensal_query(_ref_mm_yyyy(ref))
        if p and p.get("mediana") is not None:
            proximos.append({"mes_ref": ref, **p})
    surpresas: list[dict] = []
    for d in range(n_surpresas - 1, -1, -1):
        ref = _mes_mais(mes_recente, -d)
        realizado = ipca_mensal.get(ref)
        if realizado is None:
            continue
        if d == 0:
            esperado = vespera
        else:
            time.sleep(0.25)
            esperado = _focus_mensal_query(_ref_mm_yyyy(ref))
        if not esperado or esperado.get("mediana") is None:
            continue
        surpresas.append({
            "mes": ref,
            "realizado": realizado,
            "esperado": esperado["mediana"],
            "surpresa_pp": round(realizado - esperado["mediana"], 4),
            "data_pesquisa": esperado.get("data_pesquisa"),
        })
    return {"mes_referencia": mes_recente, "vespera": vespera, "proximos": proximos, "surpresas": surpresas}


def focus_12m_suavizada(desde: str = "2016-01-01") -> list[dict]:
    """Expectativa IPCA 12 meses à frente (suavizada, baseCalculo=0), última
    observação de cada mês civil — o gráfico clássico de ancoragem vs meta."""
    base = (
        f"{FOCUS_BASE}/ExpectativasMercadoInflacao12Meses?$format=json&$top=20000"
        f"&$filter=Indicador%20eq%20%27IPCA%27%20and%20Suavizada%20eq%20%27S%27"
    )
    sufixo = f"%20and%20Data%20ge%20%27{desde}%27&$select=Data,Mediana&$orderby=Data"
    url = base + "%20and%20baseCalculo%20eq%200" + sufixo
    print(f"  [Focus 12m] {url}")
    try:
        data = _get(url, retries=2, sleep=2.0).json().get("value", [])
    except Exception:  # noqa: BLE001 — endpoint antigo pode não ter baseCalculo
        url2 = base + sufixo
        print(f"  [Focus 12m] retry sem baseCalculo: {url2}", file=sys.stderr)
        data = _get(url2).json().get("value", [])
    por_mes: dict[str, dict] = {}
    for r in data:
        d = r.get("Data", "")[:10]
        med = _to_float(r.get("Mediana"))
        if len(d) == 10 and med is not None:
            por_mes[d[:7]] = {"mes": d[:7], "data": d, "mediana": med}
    return [por_mes[m] for m in sorted(por_mes)]


# ---------------------------------------------------------------------------
# Abertura completa do mês (SIDRA c315/all): influências + hierarquia + síntese
# ---------------------------------------------------------------------------
#: Nível na hierarquia c315 pelo tamanho do prefixo numérico do nome
#: ("1.Alimentação…" = grupo, "11.…" = subgrupo, "1101.…" = item, "1101002.…" = subitem).
NIVEIS_C315 = {1: "grupo", 2: "subgrupo", 4: "item", 7: "subitem"}


def carrega_abertura_mes(
    tabela: int, mes_ref: str, var_mensal: str, var_peso: str, var_acum_ano: str, var_12m: str
) -> list[dict]:
    """Todos os níveis do IPCA no mês (geral, 9 grupos, 19 subgrupos, ~76 itens,
    ~460 subitens) com variação, peso, acum. ano e 12m — em UMA consulta SIDRA."""
    path = (
        f"/n1/all/v/{var_mensal},{var_peso},{var_acum_ano},{var_12m}"
        f"/p/{mes_ref.replace('-', '')}/c315/all"
        f"/d/v{var_mensal}%202,v{var_peso}%204,v{var_acum_ano}%202,v{var_12m}%202"
    )
    rows = sidra_fetch(tabela, path)
    col_var = "Variável (Código)"
    col_nome = "Geral, grupo, subgrupo, item e subitem"
    por_nome: dict[str, dict] = {}
    for r in rows:
        nome = r[col_nome]
        pref = re.match(r"^(\d+)\.", nome)
        if nome == "Índice geral":
            nivel, codigo = "geral", ""
        elif pref and len(pref.group(1)) in NIVEIS_C315:
            nivel, codigo = NIVEIS_C315[len(pref.group(1))], pref.group(1)
        else:
            continue
        item = por_nome.setdefault(nome, {
            "nome": re.sub(r"^\d+\.", "", nome).strip(),
            "codigo": codigo,
            "nivel": nivel,
            "var": None,
            "peso": None,
            "acum_ano": None,
            "acum_12m": None,
        })
        v = _to_float(r["Valor"])
        var_cod = r.get(col_var)
        if var_cod == var_mensal:
            item["var"] = v
        elif var_cod == var_peso:
            item["peso"] = v
        elif var_cod == var_acum_ano:
            item["acum_ano"] = v
        elif var_cod == var_12m:
            item["acum_12m"] = v
    out: list[dict] = []
    for item in por_nome.values():
        item["contrib_pp"] = (
            round(item["var"] * item["peso"] / 100.0, 4)
            if item["var"] is not None and item["peso"] is not None
            else None
        )
        out.append(item)
    out.sort(key=lambda x: (x["nivel"] != "geral", len(x["codigo"]), x["codigo"]))
    return out


def monta_hierarquia(abertura: list[dict]) -> dict:
    """Árvore grupo → subgrupo → item do mês (subitens ficam nas influências)."""
    grupos = [dict(x) for x in abertura if x["nivel"] == "grupo"]
    for g in grupos:
        g["subgrupos"] = []
    por_grupo = {g["codigo"]: g for g in grupos}
    por_subgrupo: dict[str, dict] = {}
    for s in sorted((dict(x) for x in abertura if x["nivel"] == "subgrupo"), key=lambda x: x["codigo"]):
        s["itens"] = []
        pai = por_grupo.get(s["codigo"][0])
        if pai is not None:
            pai["subgrupos"].append(s)
            por_subgrupo[s["codigo"]] = s
    for it in sorted((dict(x) for x in abertura if x["nivel"] == "item"), key=lambda x: x["codigo"]):
        pai = por_subgrupo.get(it["codigo"][:2])
        if pai is not None:
            pai["itens"].append(it)
    grupos.sort(key=lambda x: x["codigo"])
    geral = next((x for x in abertura if x["nivel"] == "geral"), None)
    return {"geral": geral, "grupos": grupos}


def influencias_de_abertura(abertura: list[dict]) -> list[dict]:
    """Subitens ordenados por contribuição (contrato v2 + acum. ano/12m + a
    localização na hierarquia: código e nomes de grupo/subgrupo/item — o
    prefixo do código c315 codifica a árvore: 1 díg = grupo, 2 = subgrupo,
    4 = item, 7 = subitem)."""
    nomes: dict[str, dict[str, str]] = {
        nivel: {x["codigo"]: x["nome"] for x in abertura if x["nivel"] == nivel}
        for nivel in ("grupo", "subgrupo", "item")
    }
    contrib = [
        {
            "subitem": x["nome"],
            "codigo": x["codigo"],
            "grupo": nomes["grupo"].get(x["codigo"][:1]),
            "subgrupo": nomes["subgrupo"].get(x["codigo"][:2]),
            "item": nomes["item"].get(x["codigo"][:4]),
            "var": x["var"],
            "peso": x["peso"],
            "contrib_pp": x["contrib_pp"],
            "acum_ano": x["acum_ano"],
            "acum_12m": x["acum_12m"],
        }
        for x in abertura
        if x["nivel"] == "subitem" and x["var"] is not None and x["peso"] is not None
    ]
    contrib.sort(key=lambda x: x["contrib_pp"], reverse=True)
    return contrib


# ---------------------------------------------------------------------------
# Tabela-síntese (estilo Carta de Conjuntura/IPEA) e release do robô
# ---------------------------------------------------------------------------
def tabela_sintese_build(
    mes_ref: str,
    ipca_cheio: dict,
    ipca_15: dict,
    abertura: list[dict],
    nuc_data: dict[str, dict[str, float | None]],
    nuc_12m: dict[str, dict[str, float | None]],
    cat_data: dict[str, dict[str, float | None]],
    cat_12m: dict[str, dict[str, float | None]],
    dif: dict[str, float | None],
) -> dict:
    """Linhas (cheio, IPCA-15, grupos, núcleos, categorias, difusão) ×
    colunas [m-2, m-1, mês, acum. ano, acum. 12m, peso] — TUDO pré-computado."""
    m0, m1, m2 = mes_ref, _mes_mais(mes_ref, -1), _mes_mais(mes_ref, -2)

    def _linha(sid: str, nome: str, valores: dict[str, float | None], *, acum12=None, peso=None, acum_ano=None) -> dict:
        return {
            "id": sid,
            "nome": nome,
            "m2": valores.get(m2),
            "m1": valores.get(m1),
            "m0": valores.get(m0),
            "acum_ano": acum_ano if acum_ano is not None else acum_ano_composto(valores, m0),
            "acum_12m": acum12,
            "peso": peso,
        }

    cheio_m = {r["mes"]: r.get("IPCA cheio") for r in ipca_cheio["serie"]}
    cheio_12 = {r["mes"]: r.get("IPCA 12m") for r in ipca_cheio["serie"]}
    geral_ab = next((x for x in abertura if x["nivel"] == "geral"), {})
    linhas_indice = [
        _linha("ipca", "IPCA", cheio_m, acum12=cheio_12.get(m0), acum_ano=geral_ab.get("acum_ano")),
    ]
    q15_m = {r["mes"]: r.get("IPCA cheio") for r in ipca_15["serie"]}
    q15_12 = {r["mes"]: r.get("IPCA 12m") for r in ipca_15["serie"]}
    m0_15 = ipca_15.get("mes_recente") or m0
    linhas_indice.append({
        "id": "ipca15",
        "nome": "IPCA-15",
        "m2": q15_m.get(_mes_mais(m0_15, -2)),
        "m1": q15_m.get(_mes_mais(m0_15, -1)),
        "m0": q15_m.get(m0_15),
        "acum_ano": acum_ano_composto(q15_m, m0_15),
        "acum_12m": q15_12.get(m0_15),
        "peso": None,
        "mes_proprio": m0_15,
    })

    ab_grupos = {x["codigo"]: x for x in abertura if x["nivel"] == "grupo"}
    linhas_grupos: list[dict] = []
    for g in ipca_cheio["grupos"]:
        pref = re.match(r"^(\d+)\.", g)
        cod = pref.group(1) if pref else ""
        ab = ab_grupos.get(cod, {})
        gm = {r["mes"]: r.get(g) for r in ipca_cheio["serie"]}
        linhas_grupos.append({
            "id": f"grupo_{cod}",
            "nome": re.sub(r"^\d+\.", "", g),
            "m2": gm.get(m2),
            "m1": gm.get(m1),
            "m0": gm.get(m0),
            "acum_ano": ab.get("acum_ano"),
            "acum_12m": ab.get("acum_12m"),
            "peso": ab.get("peso"),
            "contrib_pp": ab.get("contrib_pp"),
        })
    linhas_grupos.sort(key=lambda x: (x["contrib_pp"] is None, -(x["contrib_pp"] or 0.0)))

    linhas_nucleos: list[dict] = []
    for nid in ("EX0", "EX3", "MS", "DP", "P", "MA"):
        if nid in nuc_data:
            linhas_nucleos.append(
                _linha(f"nucleo_{nid.lower()}", f"Núcleo {nid}", nuc_data[nid], acum12=nuc_12m.get(nid, {}).get(m0))
            )
    medias = {
        m: (round(sum(vs) / len(vs), 4) if all(v is not None for v in vs) else None)
        for m in (m2, m1, m0)
        for vs in [[nuc_data.get(k, {}).get(m) for k in NUCLEOS_MEDIA]]
    }
    med12 = [nuc_12m.get(k, {}).get(m0) for k in NUCLEOS_MEDIA]
    linhas_nucleos.append({
        "id": "nucleos_media",
        "nome": "Média dos 5 núcleos",
        "m2": medias[m2],
        "m1": medias[m1],
        "m0": medias[m0],
        "acum_ano": None,
        "acum_12m": round(sum(med12) / len(med12), 4) if all(v is not None for v in med12) else None,
        "peso": None,
    })

    nome_cat = {
        "Livres": "Preços livres",
        "Monitorados": "Monitorados",
        "Servicos": "Serviços",
        "Comercializaveis": "Comercializáveis",
    }
    linhas_cat = [
        _linha(f"cat_{c.lower()}", nome_cat[c], cat_data[c], acum12=cat_12m.get(c, {}).get(m0))
        for c in ("Livres", "Monitorados", "Servicos", "Comercializaveis")
        if c in cat_data
    ]

    linhas_dif = [{
        "id": "difusao",
        "nome": "Difusão (% de subitens em alta)",
        "m2": dif.get(m2),
        "m1": dif.get(m1),
        "m0": dif.get(m0),
        "acum_ano": None,
        "acum_12m": None,
        "peso": None,
        "unidade": "%",
    }]

    return {
        "mes_recente": m0,
        "meses": [m2, m1, m0],
        "secoes": [
            {"id": "indice", "titulo": "Índice cheio", "linhas": linhas_indice},
            {"id": "grupos", "titulo": "Grupos", "linhas": linhas_grupos},
            {"id": "nucleos", "titulo": "Núcleos", "linhas": linhas_nucleos},
            {"id": "categorias", "titulo": "Categorias econômicas", "linhas": linhas_cat},
            {"id": "difusao", "titulo": "Difusão", "linhas": linhas_dif},
        ],
    }


def release_build(
    mes_ref: str,
    tabela_sintese: dict,
    influencias: list[dict],
    focus_mensal: dict | None,
    focus_anos: dict,
    focus_12m: list[dict],
    momentum: dict,
    difusao_bloco: dict,
    sazonalidade: dict,
    ipca_mensal: dict[str, float | None],
    saz_ini: int,
    saz_fim: int,
) -> dict:
    """Contrato ESTÁVEL do robô de publicação (data/ipca_release.json, v1).

    Tudo que um texto de release precisa, legível por máquina: realizado ×
    esperado (surpresa), posição vs padrão sazonal, grupos/núcleos/difusão,
    maiores influências e o que o Focus espera adiante. Campos ausentes = null
    (o robô decide o que fazer); NUNCA renomear campo sem subir schema_version.
    """
    secoes = {s["id"]: s["linhas"] for s in tabela_sintese["secoes"]}
    por_id = {linha["id"]: linha for linhas in secoes.values() for linha in linhas}
    ipca_l = por_id.get("ipca", {})
    q15_l = por_id.get("ipca15", {})
    realizado = ipca_l.get("m0")
    acum12 = ipca_l.get("acum_12m")
    meta = meta_do_mes(mes_ref)
    vespera = (focus_mensal or {}).get("vespera") or {}
    surpresa = (
        round(realizado - vespera["mediana"], 4)
        if realizado is not None and vespera.get("mediana") is not None
        else None
    )
    saz_mes = (sazonalidade.get("por_mes") or {}).get(mes_ref[5:7], {})
    leitura_saz = None
    if realizado is not None and saz_mes.get("mediana") is not None:
        d = realizado - saz_mes["mediana"]
        leitura_saz = "acima" if d > 0.05 else ("abaixo" if d < -0.05 else "em linha")

    def _saar_ultimo(sid: str) -> float | None:
        pts = (momentum.get("series") or {}).get(sid) or []
        return pts[-1].get("saar_3m") if pts else None

    media_saar = (momentum.get("media_nucleos_saar3m") or [])
    dif_serie = difusao_bloco.get("serie") or []
    dif_u = dif_serie[-1] if dif_serie else {}
    ano_atual = int(mes_ref[:4])
    focus_ano_pts = (focus_anos or {}).get(ano_atual) or []
    focus_ano_u = focus_ano_pts[-1] if focus_ano_pts else {}
    focus_12m_u = focus_12m[-1] if focus_12m else {}
    proximos = [
        {"mes_ref": p["mes_ref"], "mediana": p.get("mediana"), "min": p.get("min"), "max": p.get("max")}
        for p in ((focus_mensal or {}).get("proximos") or [])
    ]

    return {
        "schema_version": RELEASE_SCHEMA_VERSION,
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "indicador": "IPCA",
        "mes_referencia": mes_ref,
        "headline": {
            "var_mes": realizado,
            "acum_ano": ipca_l.get("acum_ano"),
            "acum_12m": acum12,
            "ipca15": {"mes": q15_l.get("mes_proprio"), "var_mes": q15_l.get("m0"), "acum_12m": q15_l.get("acum_12m")},
        },
        "expectativa_mes": {
            "mediana": vespera.get("mediana"),
            "media": vespera.get("media"),
            "dp": vespera.get("dp"),
            "min": vespera.get("min"),
            "max": vespera.get("max"),
            "data_pesquisa": vespera.get("data_pesquisa"),
            "surpresa_pp": surpresa,
        },
        "posicao_historica": {
            "mediana_mes_civil": saz_mes.get("mediana"),
            "min": saz_mes.get("min"),
            "max": saz_mes.get("max"),
            "n": saz_mes.get("n"),
            "janela": sazonalidade.get("janela"),
            "percentil": percentil_sazonal(ipca_mensal, mes_ref, saz_ini, saz_fim),
            "leitura": leitura_saz,
        },
        "meta": {
            **meta,
            "regime": "continua" if ano_atual >= META_CONTINUA["desde"] else "ano_calendario",
            "acum_12m_vs_meta_pp": round(acum12 - meta["meta"], 4) if acum12 is not None else None,
        },
        "grupos": [
            {
                "nome": g["nome"],
                "var_mes": g.get("m0"),
                "contrib_pp": g.get("contrib_pp"),
                "peso": g.get("peso"),
                "acum_ano": g.get("acum_ano"),
                "acum_12m": g.get("acum_12m"),
            }
            for g in secoes.get("grupos", [])
        ],
        "nucleos": {
            "por_nucleo": [
                {
                    "nucleo": linha["nome"].replace("Núcleo ", ""),
                    "var_mes": linha.get("m0"),
                    "saar_3m_dessaz": _saar_ultimo(linha["id"].replace("nucleo_", "").upper()),
                    "acum_12m": linha.get("acum_12m"),
                }
                for linha in secoes.get("nucleos", [])
                if linha["id"].startswith("nucleo_")
            ],
            "media_12m": por_id.get("nucleos_media", {}).get("acum_12m"),
            "media_saar_3m_dessaz": media_saar[-1]["saar_3m"] if media_saar else None,
        },
        "categorias": [
            {"nome": c["nome"], "var_mes": c.get("m0"), "acum_12m": c.get("acum_12m")}
            for c in secoes.get("categorias", [])
        ],
        "difusao": {
            "valor": dif_u.get("difusao"),
            "mm3": dif_u.get("mm3"),
            "media_historica": (difusao_bloco.get("media_historica") or {}).get("media"),
        },
        "top_influencias": {
            "altas": [
                {"subitem": x["subitem"], "var": x["var"], "contrib_pp": x["contrib_pp"]}
                for x in influencias[:5]
            ],
            "quedas": [
                {"subitem": x["subitem"], "var": x["var"], "contrib_pp": x["contrib_pp"]}
                for x in influencias[-5:][::-1]
            ],
        },
        "proximos_meses": proximos,
        "focus_ano_corrente": {
            "ano": ano_atual,
            "mediana": focus_ano_u.get("mediana"),
            "data": focus_ano_u.get("data"),
        },
        "focus_12m_suavizada": {
            "mediana": focus_12m_u.get("mediana"),
            "data": focus_12m_u.get("data"),
        },
    }


# ---------------------------------------------------------------------------
# Validações (princípio: falhou, não publica)
# ---------------------------------------------------------------------------
def valida_schema_v2(
    out: dict,
    ipca_mensal_sgs: dict[str, float | None],
    oficial_12m: dict[str, float | None] | None = None,
) -> list[str]:
    """Asserts numéricos do schema v2. Retorna lista de erros (vazia = ok).

    1. Pilha de contribuições 12m fecha com o IPCA 12m oficial ao centésimo.
    2. Acumulado 12m composto (SGS 433) ≈ série oficial 12m (SGS 13522 e
       v2265 da SIDRA) com tolerância de 0,02 p.p. — valida a rotina de
       composição usada também nos núcleos/categorias.
    3. Contagem mínima de pontos por bloco (teria pegado a âncora de 13 pontos).
    """
    erros: list[str] = []
    print("\n== Validações (schema v2) ==")

    # 1. contrib 12m soma = oficial
    serie_c12 = out["ipca_cheio"].get("serie_contrib_12m", [])
    grupos = out["ipca_cheio"]["grupos"]
    if not serie_c12:
        erros.append("serie_contrib_12m vazia (IPCA cheio)")
    else:
        max_dif = 0.0
        max_residuo = 0.0
        for item in serie_c12:
            soma = sum(item[g] for g in grupos if item.get(g) is not None)
            max_dif = max(max_dif, abs(soma - item["IPCA 12m"]))
            max_residuo = max(max_residuo, abs(item["residuo_pp"]))
        ultimo = serie_c12[-1]
        soma_u = sum(ultimo[g] for g in grupos if ultimo.get(g) is not None)
        print(
            f"  [1] contrib 12m ({ultimo['mes']}): pilha {soma_u:.4f} vs oficial {ultimo['IPCA 12m']:.2f} "
            f"| max |pilha-oficial| na série = {max_dif:.4f} p.p. | max resíduo pré-ajuste = {max_residuo:.4f} p.p."
        )
        if max_dif > 0.005:
            erros.append(f"pilha contrib 12m não fecha ao centésimo (max dif {max_dif:.4f} p.p.)")
        if max_residuo > 0.15:
            erros.append(
                f"resíduo de encadeamento pré-ajuste suspeito ({max_residuo:.4f} p.p. — esperado ~arredondamento)"
            )

    # 2. composto 12m do SGS 433 vs oficiais (13522 já baixado no main e v2265)
    oficial_12m = oficial_12m or {}
    if not oficial_12m:
        print("  [2] [WARN] SGS 13522 indisponível — crosscheck só com v2265", file=sys.stderr)
    meses_433 = sorted(k for k, v in ipca_mensal_sgs.items() if v is not None)
    composto = compoe_12m(ipca_mensal_sgs, meses_433)
    if oficial_12m:
        difs = [
            abs(composto[m] - oficial_12m[m])
            for m in meses_433[-ANCORA_MESES:]
            if composto.get(m) is not None and oficial_12m.get(m) is not None
        ]
        max_dif_13522 = max(difs) if difs else float("inf")
        m_u = meses_433[-1]
        print(
            f"  [2] 12m composto (433) vs SGS 13522 em {m_u}: {composto.get(m_u)} vs {oficial_12m.get(m_u)} "
            f"| max dif últimos {ANCORA_MESES}m = {max_dif_13522:.4f} p.p."
        )
        if max_dif_13522 > 0.02:
            erros.append(f"12m composto diverge do SGS 13522 (max dif {max_dif_13522:.4f} p.p.)")
    serie_sidra = out["ipca_cheio"]["serie"]
    dif_v2265 = [
        abs(composto[x["mes"]] - x["IPCA 12m"])
        for x in serie_sidra
        if composto.get(x["mes"]) is not None and x.get("IPCA 12m") is not None
    ]
    if dif_v2265:
        print(f"  [2] 12m composto (433) vs v2265 (SIDRA): max dif = {max(dif_v2265):.4f} p.p.")
        if max(dif_v2265) > 0.02:
            erros.append(f"12m composto diverge do v2265 (max dif {max(dif_v2265):.4f} p.p.)")

    # 3. contagens mínimas + sanidade dos blocos novos
    minimos = [
        ("ipca_cheio.serie", len(serie_sidra), 60),
        ("ipca_cheio.serie_contrib_12m", len(serie_c12), 36),
        ("nucleos.serie_12m", len(out["nucleos"].get("serie_12m", [])), 48),
        ("categorias.serie_12m", len(out["categorias"].get("serie_12m", [])), 48),
        ("difusao.serie", len(out["difusao"].get("serie", [])), 60),
    ]
    for nome, n, minimo in minimos:
        print(f"  [3] {nome}: {n} pontos (mínimo {minimo})")
        if n < minimo:
            erros.append(f"{nome} com só {n} pontos (mínimo {minimo})")
    saz = out["sazonalidade"]["por_mes"]
    incompletos = [mm for mm, s in saz.items() if (s.get("n") or 0) < 8]
    if incompletos:
        erros.append(f"sazonalidade com meses de amostra curta: {incompletos}")

    # Números p/ conferência manual (núcleos compostos vs tabela do RI/BCB —
    # o SGS não publica 12m oficial dos núcleos).
    nuc_12m = out["nucleos"].get("serie_12m", [])
    if nuc_12m:
        u = nuc_12m[-1]
        print(
            f"  [conferência] núcleos 12m composto em {u['mes']}: "
            + ", ".join(f"{k}={u.get(k)}" for k in ("EX0", "EX3", "MS", "DP", "P"))
            + f" | média 5 núcleos = {u.get('media_nucleos')} | IPCA cheio composto = {u.get('IPCA cheio')}"
        )
    mh = out["difusao"].get("media_historica", {})
    print(f"  [conferência] difusão: média hist. {mh.get('media')}% ± {mh.get('dp')} (n={mh.get('n')})")
    mes_ref = out["mes_recente"]
    saz_mes = saz.get(mes_ref[5:7], {})
    print(
        f"  [conferência] sazonalidade {mes_ref[5:7]}: mediana {saz_mes.get('mediana')} "
        f"min {saz_mes.get('min')} max {saz_mes.get('max')} (n={saz_mes.get('n')})"
    )

    # 4. blocos v3 (momentum, série longa, tabela síntese, hierarquia)
    mom = (out.get("momentum") or {}).get("series") or {}
    for sid in ("ipca", "servicos"):
        if not mom.get(sid):
            erros.append(f"momentum.{sid} vazio (STL falhou?)")
    if mom.get("ipca"):
        ult_mom = mom["ipca"][-1]["mes"]
        piso_mom = _mes_mais(mes_ref, -1)  # SGS pode estar 1 mês atrás da SIDRA no dia da divulgação
        print(f"  [4] momentum.ipca: {len(mom['ipca'])} pontos, último {ult_mom} (piso {piso_mom})")
        if ult_mom < piso_mom:
            erros.append(f"momentum.ipca desatualizado (último {ult_mom}, esperado ≥ {piso_mom})")
    n_longa = len((out.get("serie_longa") or {}).get("serie") or [])
    print(f"  [4] serie_longa: {n_longa} meses")
    if n_longa < 300:
        erros.append(f"serie_longa com só {n_longa} meses (mínimo 300)")
    ts = out.get("tabela_sintese") or {}
    linhas_grupos = next((s["linhas"] for s in ts.get("secoes", []) if s["id"] == "grupos"), [])
    if len(linhas_grupos) != 9:
        erros.append(f"tabela_sintese com {len(linhas_grupos)} grupos (esperado 9)")
    linha_ipca = next((l for s in ts.get("secoes", []) for l in s["linhas"] if l["id"] == "ipca"), {})
    if linha_ipca.get("m0") is None or linha_ipca.get("acum_12m") is None:
        erros.append("tabela_sintese: linha IPCA sem m0/acum_12m")
    hier_grupos = (out.get("abertura_hierarquica") or {}).get("grupos") or []
    if len(hier_grupos) != 9:
        erros.append(f"abertura_hierarquica com {len(hier_grupos)} grupos (esperado 9)")
    if not out.get("focus_mensal") or not (out["focus_mensal"].get("vespera") or {}).get("mediana"):
        print("  [4] [WARN] focus_mensal sem véspera (Olinda fora?) — publica sem, robô lida com null", file=sys.stderr)
    if not out.get("focus_12m"):
        print("  [4] [WARN] focus_12m vazio — gráfico de ancoragem ficará sem dados", file=sys.stderr)

    if not erros:
        print("  OK — todas as validações passaram.")
    return erros


def valida_release(release: dict) -> list[str]:
    """Asserts do contrato do robô — headline e grupos são inegociáveis."""
    erros: list[str] = []
    print("\n== Validações (release) ==")
    h = release.get("headline") or {}
    for k in ("var_mes", "acum_12m"):
        if h.get(k) is None:
            erros.append(f"release.headline.{k} nulo")
    if len(release.get("grupos") or []) != 9:
        erros.append(f"release.grupos com {len(release.get('grupos') or [])} entradas (esperado 9)")
    if not (release.get("top_influencias") or {}).get("altas"):
        erros.append("release.top_influencias.altas vazio")
    exp = release.get("expectativa_mes") or {}
    if exp.get("mediana") is None:
        print("  [WARN] release sem expectativa da véspera — surpresa_pp = null", file=sys.stderr)
    print(
        f"  release {release.get('mes_referencia')}: headline ok={not any('headline' in e for e in erros)} "
        f"| grupos={len(release.get('grupos') or [])} | surpresa={exp.get('surpresa_pp')}"
    )
    if not erros:
        print("  OK — release válido.")
    return erros


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    ap = argparse.ArgumentParser(description="Build do JSON do Painel IPCA")
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR), help="Diretório de saída (default: data-pipeline/out)")
    ap.add_argument("--upload", action="store_true", help="Após gerar, fazer upload pro Vercel Blob")
    ap.add_argument("--no-merge", action="store_true", help="Reservado pra futuro merge incremental (no-op por enquanto)")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "ipca.json"

    print("== IPCA cheio (SIDRA 7060) ==")
    ipca_cheio = carrega_ipca_hierarquia(7060, "63", "66", "2265")
    print(f"  {len(ipca_cheio['serie'])} meses, último: {ipca_cheio['mes_recente']}")

    print("== IPCA-15 (SIDRA 7062) ==")
    ipca_15 = carrega_ipca_hierarquia(7062, "355", "357", "1120")
    print(f"  {len(ipca_15['serie'])} meses, último: {ipca_15['mes_recente']}")

    # Contribuições ao 12m por encadeamento (substitui o calcula12m do front).
    ipca_cheio["serie_contrib_12m"] = contribuicoes_12m(ipca_cheio["serie"], ipca_cheio["grupos"])
    ipca_15["serie_contrib_12m"] = contribuicoes_12m(ipca_15["serie"], ipca_15["grupos"])
    print(
        f"  contrib 12m: {len(ipca_cheio['serie_contrib_12m'])} pontos (cheio), "
        f"{len(ipca_15['serie_contrib_12m'])} pontos (IPCA-15)"
    )

    print("== IPCA 12m oficial (SGS 13522) ==")
    try:
        oficial_12m = sgs_fetch(13522)
    except Exception as e:  # noqa: BLE001
        oficial_12m = {}
        print(f"  [WARN] SGS 13522 indisponível ({e}) — 12m da série longa via composto", file=sys.stderr)

    print("== Núcleos (BCB SGS) ==")
    NUCLEOS = {
        "IPCA cheio": 433,
        "MA": 4466,
        "MS": 16121,
        "EX0": 11427,
        "EX3": 27838,
        "DP": 27839,
        "P": 28751,
    }
    nuc_data = {label: sgs_fetch(c) for label, c in NUCLEOS.items()}
    # Histórico completo fica em nuc_data (estatísticas); a serie mensal
    # publicada segue em 60m (janela conjuntural padrão).
    meses_nuc_full = sorted(set.intersection(*[set(d.keys()) for d in nuc_data.values()]))
    meses_nuc = meses_nuc_full[-60:]
    serie_nucleos = []
    for m in meses_nuc:
        item = {"mes": m}
        for label in NUCLEOS:
            item[label] = nuc_data[label].get(m)
        serie_nucleos.append(item)
    print(f"  {len(serie_nucleos)} meses (mensal)")

    # 12m COMPOSTO de cada núcleo sobre o histórico completo + média dos 5
    # núcleos do BC e banda mín–máx (prontos p/ o front plotar sem spaghetti).
    nuc_12m = {label: compoe_12m(nuc_data[label], meses_nuc_full) for label in NUCLEOS}
    serie_nucleos_12m: list[dict] = []
    for m in meses_nuc_full[-ANCORA_MESES:]:
        item: dict[str, Any] = {"mes": m}
        for label in NUCLEOS:
            item[label] = nuc_12m[label].get(m)
        cinco = [item[k] for k in NUCLEOS_MEDIA]
        if all(v is not None for v in cinco):
            item["media_nucleos"] = round(sum(cinco) / len(cinco), 4)
            item["nucleos_min"] = round(min(cinco), 4)
            item["nucleos_max"] = round(max(cinco), 4)
        else:
            item["media_nucleos"] = item["nucleos_min"] = item["nucleos_max"] = None
        serie_nucleos_12m.append(item)
    serie_nucleos_12m = [x for x in serie_nucleos_12m if x["media_nucleos"] is not None]
    print(f"  {len(serie_nucleos_12m)} meses (12m composto)")

    print("== Difusão ==")
    dif = sgs_fetch(21379)
    meses_dif_full = sorted(dif.keys())
    dif_mm3 = media_movel_3m(dif, meses_dif_full)
    serie_difusao = [
        {"mes": m, "difusao": dif[m], "mm3": dif_mm3.get(m)} for m in meses_dif_full[-ANCORA_MESES:]
    ]
    dif_ref = [v for m, v in dif.items() if m >= DIFUSAO_REF_INICIO and v is not None]
    difusao_media_hist = {
        "desde": DIFUSAO_REF_INICIO,
        "media": round(statistics.mean(dif_ref), 2) if dif_ref else None,
        "dp": round(statistics.stdev(dif_ref), 2) if len(dif_ref) > 1 else None,
        "n": len(dif_ref),
    }
    print(f"  {len(serie_difusao)} meses | média hist. ({DIFUSAO_REF_INICIO}+): {difusao_media_hist['media']}%")

    print("== Categorias econômicas ==")
    CATEGORIAS = {"Servicos": 11428, "Livres": 4448, "Monitorados": 4449, "Comercializaveis": 27864}
    cat_data = {label: sgs_fetch(c) for label, c in CATEGORIAS.items()}
    meses_cat_full = sorted(set.intersection(*[set(d.keys()) for d in cat_data.values()]))
    serie_categorias = []
    for m in meses_cat_full[-60:]:
        item: dict[str, Any] = {"mes": m}
        for label in CATEGORIAS:
            item[label] = cat_data[label].get(m)
        # "Bens (calc)" removido no schema v2: IPCA − Serviços ignora pesos e o
        # complemento de Serviços nem é "Bens" (inclui monitorados) — ver crítica.
        serie_categorias.append(item)
    cat_12m = {label: compoe_12m(cat_data[label], meses_cat_full) for label in CATEGORIAS}
    serie_categorias_12m = [
        {"mes": m, **{label: cat_12m[label].get(m) for label in CATEGORIAS}}
        for m in meses_cat_full[-ANCORA_MESES:]
    ]
    serie_categorias_12m = [
        x for x in serie_categorias_12m if any(x[label] is not None for label in CATEGORIAS)
    ]
    print(f"  {len(serie_categorias)} meses (mensal) | {len(serie_categorias_12m)} meses (12m composto)")

    print("== Momentum dessazonalizado (STL) ==")
    fontes_momentum: dict[str, dict[str, float | None]] = {
        "ipca": nuc_data["IPCA cheio"],
        **{k: nuc_data[k] for k in NUCLEOS_MEDIA},
        "servicos": cat_data["Servicos"],
        "livres": cat_data["Livres"],
    }
    momentum = momentum_build(fontes_momentum)
    print(
        f"  séries dessaz: {sorted(momentum['series'].keys())} | "
        f"média núcleos SAAR 3m: {len(momentum['media_nucleos_saar3m'])} pontos"
    )

    print("== Série longa + metas CMN ==")
    longa_12m = oficial_12m
    if not longa_12m:
        meses_433_all = sorted(k for k, v in nuc_data["IPCA cheio"].items() if v is not None)
        longa_12m = compoe_12m(nuc_data["IPCA cheio"], meses_433_all)
    serie_longa = serie_longa_build(nuc_data["IPCA cheio"], longa_12m)
    print(f"  {len(serie_longa)} meses desde {SERIE_LONGA_DESDE}")

    print("== Sazonalidade (IPCA cheio, SGS 433) ==")
    ano_recente = int(ipca_cheio["mes_recente"][:4])
    saz_fim = ano_recente - 1
    saz_ini = saz_fim - 9
    sazonalidade = {
        "janela": f"{saz_ini}-{saz_fim}",
        "por_mes": sazonalidade_mensal(nuc_data["IPCA cheio"], saz_ini, saz_fim),
    }
    print(f"  janela {sazonalidade['janela']}")

    # Fallback incremental: blob anterior baixado no máximo UMA vez e
    # reaproveitado por todos os blocos de expectativas (Olinda cai junto).
    _prev_cache: dict[str, Any] = {}

    def prev_blob() -> dict | None:
        if "v" not in _prev_cache:
            try:
                sys.path.insert(0, str(HERE))
                from shared.blob_download import download_json  # noqa: E402
                _prev_cache["v"] = download_json(BLOB_PATH)
            except Exception as e_prev:  # noqa: BLE001
                print(f"  [WARN] blob anterior indisponível ({e_prev})", file=sys.stderr)
                _prev_cache["v"] = None
        return _prev_cache["v"]

    print("== Focus anuais ==")
    ano_atual = int(ipca_cheio["mes_recente"][:4])
    try:
        focus = focus_anuais(ano_atual)
        print(f"  Anos: {sorted(focus.keys())} | pontos por ano: {[len(focus[a]) for a in sorted(focus.keys())]}")
    except Exception as e:
        print(f"  [WARN] Focus indisponivel ({e}). Tentando fallback do Blob anterior.", file=sys.stderr)
        prev = prev_blob()
        focus = prev.get("focus", {}) if isinstance(prev, dict) else {}
        if focus:
            print(f"  [WARN] Usando Focus do run anterior (gerado_em {prev.get('gerado_em')}).", file=sys.stderr)
    # Chaves podem vir como str do fallback JSON — normalizar p/ int.
    focus = {int(k): v for k, v in focus.items() if str(k).isdigit()}

    print("== Focus mensais (curtíssimo prazo + surpresas) ==")
    try:
        focus_mensal = focus_mensais_build(ipca_cheio["mes_recente"], nuc_data["IPCA cheio"])
        print(
            f"  véspera ({ipca_cheio['mes_recente']}): {(focus_mensal.get('vespera') or {}).get('mediana')} "
            f"| próximos: {len(focus_mensal['proximos'])} | surpresas: {len(focus_mensal['surpresas'])}"
        )
    except Exception as e:  # noqa: BLE001
        print(f"  [WARN] Focus mensais indisponível ({e}) — tentando blob anterior.", file=sys.stderr)
        prev = prev_blob()
        focus_mensal = prev.get("focus_mensal") if isinstance(prev, dict) else None

    print("== Focus 12 meses (suavizada) ==")
    try:
        focus_12m = focus_12m_suavizada()
        print(f"  {len(focus_12m)} meses (última obs de cada mês civil)")
    except Exception as e:  # noqa: BLE001
        print(f"  [WARN] Focus 12m indisponível ({e}) — tentando blob anterior.", file=sys.stderr)
        prev = prev_blob()
        focus_12m = prev.get("focus_12m", []) if isinstance(prev, dict) else []

    print("== Abertura completa do mês (c315/all) ==")
    abertura = carrega_abertura_mes(7060, ipca_cheio["mes_recente"], "63", "66", "69", "2265")
    inf = influencias_de_abertura(abertura)
    hierarquia = monta_hierarquia(abertura)
    n_sub = sum(len(g["subgrupos"]) for g in hierarquia["grupos"])
    n_it = sum(len(s["itens"]) for g in hierarquia["grupos"] for s in g["subgrupos"])
    print(f"  hierarquia: {len(hierarquia['grupos'])} grupos, {n_sub} subgrupos, {n_it} itens")
    top_altas = inf[:10]
    top_quedas = inf[-10:][::-1]
    if top_altas:
        print(f"  {len(inf)} subitens; top alta: {top_altas[0]['subitem']} ({top_altas[0]['contrib_pp']} p.p.)")
    else:
        print("  [WARN] SIDRA sem subitens para o mês — maiores_influencias publicado com listas vazias", file=sys.stderr)

    print("== Tabela síntese ==")
    tabela_sintese = tabela_sintese_build(
        ipca_cheio["mes_recente"], ipca_cheio, ipca_15, abertura,
        nuc_data, nuc_12m, cat_data, cat_12m, dif,
    )
    print(f"  seções: {[s['id'] + ':' + str(len(s['linhas'])) for s in tabela_sintese['secoes']]}")

    out: dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "mes_recente": ipca_cheio["mes_recente"],
        "ipca_cheio": ipca_cheio,
        "ipca_15": ipca_15,
        "nucleos": {
            "serie": serie_nucleos,
            "serie_12m": serie_nucleos_12m,
            "conjunto_media": list(NUCLEOS_MEDIA),
        },
        "difusao": {"serie": serie_difusao, "media_historica": difusao_media_hist},
        "categorias": {"serie": serie_categorias, "serie_12m": serie_categorias_12m},
        "sazonalidade": sazonalidade,
        "focus": focus,
        "maiores_influencias": {
            "mes": ipca_cheio["mes_recente"],
            "top_altas": top_altas,
            "top_quedas": top_quedas,
            # Lista completa (~440 subitens) SÓ do mês corrente — alimenta a
            # tabela com busca/sort e o CSV; histórico de subitens não entra
            # (explosão de tamanho sem pergunta que justifique).
            "todos": inf,
        },
        "serie_longa": {
            "desde": SERIE_LONGA_DESDE,
            "serie": serie_longa,
            "metas_anuais": METAS_CMN
            + [{"ano": META_CONTINUA["desde"], "meta": META_CONTINUA["meta"], "tol": META_CONTINUA["tol"], "continua": True}],
        },
        "momentum": momentum,
        "tabela_sintese": tabela_sintese,
        "abertura_hierarquica": hierarquia,
        "focus_mensal": focus_mensal,
        "focus_12m": focus_12m,
    }

    print("== Release (contrato do robô) ==")
    release = release_build(
        ipca_cheio["mes_recente"], tabela_sintese, inf, focus_mensal, focus, focus_12m,
        momentum, out["difusao"], sazonalidade, nuc_data["IPCA cheio"], saz_ini, saz_fim,
    )
    print(
        f"  headline: mês {release['headline']['var_mes']} | 12m {release['headline']['acum_12m']} "
        f"| esperado {release['expectativa_mes']['mediana']} | surpresa {release['expectativa_mes']['surpresa_pp']} p.p."
    )

    erros = valida_schema_v2(out, nuc_data["IPCA cheio"], oficial_12m)
    erros += valida_release(release)

    out_file.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    size_kb = out_file.stat().st_size / 1024
    print(f"\nJSON salvo em {out_file} ({size_kb:.1f} KB)")

    release_file = out_dir / "ipca_release.json"
    release_file.write_text(json.dumps(release, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Release salvo em {release_file} ({release_file.stat().st_size / 1024:.1f} KB)")

    if erros:
        print(f"\n[VALIDACAO] {len(erros)} erro(s) — NÃO publicar:", file=sys.stderr)
        for e in erros:
            print(f"  - {e}", file=sys.stderr)
        sys.exit(1)

    if args.upload:
        try:
            sys.path.insert(0, str(HERE))
            from shared.blob_upload import maybe_upload_json
            maybe_upload_json(out_file, BLOB_PATH)
            maybe_upload_json(release_file, BLOB_PATH_RELEASE)
        except Exception as e:
            print(f"[upload] FALHOU: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        print("[upload] SKIP (use --upload pra subir pro Blob)")


if __name__ == "__main__":
    main()
