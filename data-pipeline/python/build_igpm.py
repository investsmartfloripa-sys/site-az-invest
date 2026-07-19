"""Build do JSON do Painel IGP-M.

Códigos SGS:
- 189   IGP-M variação mensal (fonte única do índice cheio)
- 7450  IPA-M cheio (peso de origem 60% do IGP-M)
- 7453  IPC-M cheio (30%)
- 7456  INCC-M cheio (10%)
- 433   IPCA mensal (referência cruzada)
- 13522 IPCA 12m (referência cruzada + validação da rotina de composição)

ATENÇÃO — CÓDIGOS 7456/7465 CORRIGIDOS (2026-07): o builder nasceu usando
7456 como IPC-M e 7465 como INCC-M, mas os nomes oficiais no SGS são
7453 = "Consumer Price Index-Market (IPC-M)", 7456 = "National Index of
Building Costs-Market (INCC-M)" e 7465 = "IPC-Fipe - Food stuffs" (nem é
FGV). Confirmado contra o release oficial FGV de jun/2026 (IPC +0,47 = 7453;
INCC +0,85 = 7456; mai/2026 idem: 0,61/0,77). O spot-check
COMPONENTES_MENSAL_OFICIAL trava essa identificação a cada build.

ATENÇÃO — SGS 192 NÃO É IGP-M 12m (2026-06): o builder v1 usava o 192
rotulado como "IGP-M acumulado 12 meses", mas o nome OFICIAL da série no
SGS é "National Index of Building Costs (INCC)" — é o INCC-DI mensal,
desde 1944 (por isso mai/2021 dava 2,22 quando o IGP-M 12m era 37,04%).
O acumulado 12m do IGP-M é COMPOSTO aqui das variações mensais oficiais
(SGS 189) — exatamente a convenção da FGV — e validado por spot-check
contra valores publicados (dez/2020 23,14; mai/2021 37,04; dez/2023
−3,18...) e pela rotina de composição aplicada ao IPCA (433 vs 13522).
Desde jul/2026 o 192 é usado NO PAPEL CERTO: INCC-DI no bloco `contexto`.

schema_version 2 (2026-06): transformações canônicas calculadas AQUI, nunca
no front (PLANO-GRAFICOS-ECONOMIA-2026-06-11.md, área de inflação):

- `decomposicao`: contribuição mensal de cada componente com PESOS EFETIVOS
  ENCADEADOS (não os fixos 60/30/10, que deixavam resíduo invisível de
  0,24 p.p. já na leitura mensal de abr/26). O SGS não publica número-índice
  dos componentes FGV, então os pesos exatos são irreconstruíveis — método
  adotado (crítica do revisor): encadear os números-índice das variações a
  partir do 1º mês comum (set/1994, logo após a base ago/1994) com pesos de
  origem 60/30/10 e
  renormalizar mês a mês: w_c,t = 0,6·I_c,t−1 / Σ(w_c0·I_c,t−1). Sem
  parâmetro estimado (reproduzível build a build). O resíduo restante é
  ESTRUTURAL (um mês de defasagem da base ago/1994 + janelas decendiais
  FGV + arredondamento a 2 casas) e fica em campo próprio (`residuo_pp`),
  nunca escondido nem realocado. A validação exige que o resíduo dos pesos
  efetivos seja MENOR que o dos fixos 60/30/10 (números impressos no build).
- `antecipacao`: correlação cruzada IPA-M 12m × IPCA 12m com defasagens
  0–6 meses, em duas janelas (pós-1996 e pós-2016) — base do bloco
  "IGP-M antecipa o IPCA?"; correlação baixa pós-2016 reformula o título.
- `aluguel`: os últimos 5 reajustes anuais (IGP-M 12m × IPCA 12m no mês de
  referência de cada ano) com a regra contratual de não-redução aplicada.
- `analise`: série mensal completa (120m) p/ tabela/CSV do front.
- Estatísticas, sazonalidade e rankings dos componentes TRUNCADOS a
  jan/1996 (pós-Real estabilizado) + percentil do 12m atual na distribuição
  histórica pós-96.
- Validações automáticas no final: falhou, não publica.
"""
from __future__ import annotations

import argparse
import json
import math
import statistics
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

HERE = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/igpm.json"

UA = {"User-Agent": "az-invest-igpm-builder/0.3"}
SGS_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{cod}/dados?formato=json"

SCHEMA_VERSION = 3

BLOB_PATH_RELEASE = "data/igpm_release.json"
RELEASE_SCHEMA_VERSION = 1

PESOS_IGPM = {"IPA-M": 60.0, "IPC-M": 30.0, "INCC-M": 10.0}
CODIGOS_COMPONENTES = {"IPA-M": 7450, "IPC-M": 7453, "INCC-M": 7456}

#: Spot-check dos componentes contra o release oficial FGV (jun e mai/2026,
#: portalibre.fgv.br) — trava a identificação código↔componente. O builder
#: já usou 7456 como IPC-M e 7465 como INCC-M por rótulo errado de terceiros;
#: 7465 é IPC-Fipe Alimentação. Falhou o spot-check → série trocada → não
#: publica.
COMPONENTES_MENSAL_OFICIAL = {
    ("IPA-M", "2026-06"): -0.97,
    ("IPA-M", "2026-05"): 0.91,
    ("IPC-M", "2026-06"): 0.47,
    ("IPC-M", "2026-05"): 0.61,
    ("INCC-M", "2026-06"): 0.85,
    ("INCC-M", "2026-05"): 0.77,
}

#: Família IGP (janelas de coleta deslocadas) — IGP-10 sai ~dia 10 do mês
#: SEGUINTE ao da coleta 11→10; IGP-DI fecha o mês civil e sai ~dia 10.
#: Ambos entram na tabela-síntese com `mes_proprio` (podem divergir do IGP-M).
CODIGOS_FAMILIA = {"IGP-10": 7447, "IGP-DI": 190}

#: Abertura de origem VIVA no SGS (as aberturas do IPA-M foram descontinuadas
#: em jul/2025). Página de metadados do BCB (mg40ap) rotula 7459/7460 como
#: IPA-OG industriais/agrícolas, mas o pareamento código↔rótulo é ambíguo —
#: a identificação é REVALIDADA a cada build (ver `origem_ipa_build`): fit
#: determinístico w·A+(1-w)·B ≈ IPA-DI (SGS 225) + critério de volatilidade
#: (agrícola é a série mais volátil pós-96). Falhou → bloco NÃO publica.
CODIGO_IPA_DI = 225
CODIGOS_IPA_ORIGEM = (7459, 7460)

#: Momentum: STL (dessaz) SÓ para séries com sazonalidade real (IPC-M tem
#: calendário; INCC-M tem dissídio em maio). IPA-M NÃO tem padrão sazonal
#: estável (commodities+câmbio) e o IGP-M CHEIO herda isso (60-70% de IPA):
#: teste empírico 2026-07 mostrou o STL distorcendo o cheio (jun/26 raw −0,50%
#: virou var_sa +4,27%). Ambos publicam 3m/6m anualizado SEM ajuste, rotulado.
MOMENTUM_AJUSTE_DESDE = "2004-01"
MOMENTUM_PUBLICA_DESDE = "2012-01"
MOMENTUM_DESSAZ = ("IPC-M", "INCC-M")
MOMENTUM_SEM_DESSAZ = ("IGP-M", "IPA-M")

FOCUS_BASE = "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata"

#: Janela da âncora de decomposição (meses publicados).
ANCORA_MESES = 72

#: Início das janelas estatísticas (pós-Plano Real estabilizado) — média,
#: percentis, sazonalidade e rankings ANTES disso são curiosidade de era de
#: crise (IPC-M 9,38% em jun/1995) sem valor decisório.
POS_REAL_INICIO = "1996-01"

#: Janela "recente" da correlação IPA->IPCA (o repasse atacado->varejo é
#: fraco e instável pós-2016 — a 2ª janela honesta do bloco de antecipação).
JANELA_RECENTE_INICIO = "2016-01"

#: Defasagens testadas na correlação cruzada IPA-M 12m x IPCA 12m.
LAGS_ANTECIPACAO = 6

#: Nº de reajustes anuais no bloco de aluguel.
ALUGUEL_ANOS = 5

#: Spot-check do 12m composto: valores oficiais FGV amplamente publicados.
#: (Substitui o SGS 192, que NÃO era IGP-M 12m — ver docstring.)
IGPM_12M_OFICIAL_CONHECIDO = {
    "2020-12": 23.14,
    "2021-05": 37.04,
    "2021-12": 17.78,
    "2022-12": 5.45,
    "2023-12": -3.18,
    "2024-12": 6.54,
}


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
    raise RuntimeError(f"falha apos {retries} tentativas: {last}")


def _to_float(v):
    if v in ("", "-", "..", "...", None):
        return None
    try:
        return float(str(v).replace(",", "."))
    except (TypeError, ValueError):
        return None


def _parse_sgs_date(s):
    d, m, y = s.split("/")
    return f"{y}-{m}"


def sgs_fetch(cod):
    url = SGS_URL.format(cod=cod)
    print(f"  [SGS {cod}] {url}")
    data = _get(url).json()
    return {_parse_sgs_date(r["data"]): _to_float(r["valor"]) for r in data}


def add_meses(m: str, k: int) -> str:
    """"2026-04" + k meses (k pode ser negativo)."""
    y, mm = int(m[:4]), int(m[5:7])
    total = y * 12 + (mm - 1) + k
    return f"{total // 12:04d}-{total % 12 + 1:02d}"


# ---------------------------------------------------------------------------
# Transformações — TODO acumulado/estatística nasce AQUI, nunca no front
# ---------------------------------------------------------------------------
def rolling12(serie, meses):
    """Acumulado 12m por composição geométrica: (PROD(1+v/100)-1)*100."""
    out = {}
    for i, m in enumerate(meses):
        if i < 11:
            out[m] = None
            continue
        prod = 1.0
        ok = True
        for j in range(i - 11, i + 1):
            v = serie.get(meses[j])
            if v is None:
                ok = False
                break
            prod *= 1 + v / 100
        out[m] = round((prod - 1) * 100, 4) if ok else None
    return out


def rolling_ano(serie, meses):
    out = {}
    for m in meses:
        ano = m[:4]
        prod = 1.0
        ok = False
        for k in meses:
            if k > m:
                break
            if k.startswith(ano):
                v = serie.get(k)
                if v is None:
                    continue
                prod *= 1 + v / 100
                ok = True
        out[m] = round((prod - 1) * 100, 4) if ok else None
    return out


def sazonalidade(serie, desde: str | None = None):
    """Estatísticas da variação mensal por mês civil (com corte de data).

    `mediana` é a estatística central recomendada (robusta a outliers);
    media/std/min/max mantidos por compatibilidade com o front v1.
    """
    por_mes = {f"{i:02d}": [] for i in range(1, 13)}
    for m, v in serie.items():
        if v is None or (desde is not None and m < desde):
            continue
        por_mes[m[5:7]].append(v)
    out = {}
    for mm, vals in por_mes.items():
        if not vals:
            out[mm] = {"media": None, "mediana": None, "std": None, "n": 0, "min": None, "max": None}
        else:
            out[mm] = {
                "media": round(statistics.mean(vals), 3),
                "mediana": round(statistics.median(vals), 3),
                "std": round(statistics.stdev(vals), 3) if len(vals) > 1 else 0.0,
                "n": len(vals),
                "min": round(min(vals), 3),
                "max": round(max(vals), 3),
            }
    return out


def estatisticas(serie, desde: str | None = None):
    vals = [v for m, v in serie.items() if v is not None and (desde is None or m >= desde)]
    if not vals:
        return {}
    return {
        "n": len(vals),
        "desde": desde,
        "media": round(statistics.mean(vals), 3),
        "mediana": round(statistics.median(vals), 3),
        "std": round(statistics.stdev(vals), 3) if len(vals) > 1 else 0.0,
        "min": round(min(vals), 3),
        "max": round(max(vals), 3),
        "positivos_pct": round(100 * sum(1 for v in vals if v > 0) / len(vals), 1),
        "negativos_pct": round(100 * sum(1 for v in vals if v < 0) / len(vals), 1),
    }


def percentil_de(valores: list[float], x: float) -> float:
    """Percentil (0-100) de x na distribuição empírica `valores`."""
    if not valores:
        return float("nan")
    abaixo = sum(1 for v in valores if v < x)
    iguais = sum(1 for v in valores if v == x)
    return round(100.0 * (abaixo + 0.5 * iguais) / len(valores), 1)


def estatisticas_12m(acum12: dict[str, float | None], desde: str, atual: float | None) -> dict:
    """Régua do 12m: média/mediana pós-corte + percentil do valor atual."""
    vals = [v for m, v in acum12.items() if v is not None and m >= desde]
    if not vals:
        return {}
    out = {
        "desde": desde,
        "n": len(vals),
        "media": round(statistics.mean(vals), 3),
        "mediana": round(statistics.median(vals), 3),
        "negativos_pct": round(100 * sum(1 for v in vals if v < 0) / len(vals), 1),
    }
    if atual is not None:
        out["percentil_atual"] = percentil_de(vals, atual)
    return out


def pearson(xs: list[float], ys: list[float]) -> float | None:
    n = len(xs)
    if n < 24:  # menos de 2 anos de pares = correlação sem valor
        return None
    mx = sum(xs) / n
    my = sum(ys) / n
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    sxx = sum((x - mx) ** 2 for x in xs)
    syy = sum((y - my) ** 2 for y in ys)
    if sxx <= 0 or syy <= 0:
        return None
    return round(sxy / math.sqrt(sxx * syy), 3)


# ---------------------------------------------------------------------------
# schema v3 — dessaz STL/SAAR, síntese, série longa, origem do IPA, Focus
# (helpers espelham build_ipca.py; duplicados por design — builders standalone)
# ---------------------------------------------------------------------------
def _tail_contiguo(meses: list[str]) -> list[str]:
    if not meses:
        return []
    ini = len(meses) - 1
    while ini > 0:
        if add_meses(meses[ini - 1], 1) != meses[ini]:
            break
        ini -= 1
    return meses[ini:]


def dessazonaliza_stl(valores: dict[str, float | None], desde: str = MOMENTUM_AJUSTE_DESDE) -> dict[str, float]:
    """STL sobre o log do índice encadeado (período 12, robusta) — ver build_ipca."""
    meses = _tail_contiguo(sorted(m for m, v in valores.items() if v is not None and m >= desde))
    if len(meses) < 48:
        return {}
    try:
        import pandas as pd
        from statsmodels.tsa.seasonal import STL
    except ImportError as e:  # noqa: BLE001
        print(f"  [STL] dependencia ausente ({e})", file=sys.stderr)
        return {}
    log_idx: list[float] = []
    acc = 0.0
    for m in meses:
        acc += math.log(1 + valores[m] / 100.0)
        log_idx.append(acc)
    res = STL(pd.Series(log_idx, index=pd.PeriodIndex(meses, freq="M")), period=12, robust=True).fit()
    sa = res.trend + res.resid
    return {
        meses[i]: (math.exp(float(sa.iloc[i]) - float(sa.iloc[i - 1])) - 1) * 100.0
        for i in range(1, len(meses))
    }


def anualizada(vals: dict[str, float], janela: int) -> dict[str, float]:
    """Taxa da janela anualizada geometricamente (sobre a série passada)."""
    meses = sorted(vals.keys())
    out: dict[str, float] = {}
    for i in range(janela - 1, len(meses)):
        prod = 1.0
        for j in range(i - janela + 1, i + 1):
            prod *= 1 + vals[meses[j]] / 100.0
        out[meses[i]] = round((prod ** (12.0 / janela) - 1) * 100.0, 4)
    return out


def momentum_igpm_build(series_map: dict[str, dict[str, float | None]]) -> dict:
    """Momentum por índice: STL+SAAR p/ quem tem sazonalidade real; 3m/6m
    anualizado SEM dessaz p/ o IPA (honestidade metodológica — ver constantes)."""
    out_series: dict[str, list[dict]] = {}
    for sid, valores in series_map.items():
        if sid in MOMENTUM_DESSAZ:
            base = dessazonaliza_stl(valores)
            dessaz = True
        else:
            meses = _tail_contiguo(sorted(m for m, v in valores.items() if v is not None and m >= MOMENTUM_AJUSTE_DESDE))
            base = {m: float(valores[m]) for m in meses}
            dessaz = False
        if not base:
            continue
        s3 = anualizada(base, 3)
        s6 = anualizada(base, 6)
        out_series[sid] = [
            {
                "mes": m,
                "var_base": round(base[m], 4),
                "saar_3m": s3.get(m),
                "saar_6m": s6.get(m),
                "dessaz": dessaz,
            }
            for m in sorted(base.keys())
            if m >= MOMENTUM_PUBLICA_DESDE
        ]
    return {
        "metodo": (
            "IPC-M/INCC-M: STL sobre log do indice encadeado (periodo 12, robusta) e SAAR geometrico; "
            "IGP-M/IPA-M: 3m/6m anualizado SEM ajuste sazonal (o atacado nao tem padrao sazonal estavel "
            "e domina o cheio — STL testado distorcia o IGP-M)"
        ),
        "ajuste_desde": MOMENTUM_AJUSTE_DESDE,
        "publica_desde": MOMENTUM_PUBLICA_DESDE,
        "series": out_series,
    }


def contrib_12m_com_residuo(serie_decomp: list[dict], igpm_12m: dict[str, float | None], nomes: list[str]) -> list[dict]:
    """Contribuição de cada componente ao IGP-M 12m por ENCADEAMENTO das
    contribs mensais estimadas (pesos efetivos), com o RESÍDUO como 4ª fatia
    explícita — aqui o resíduo é ESTRUTURAL (não arredondamento), então NUNCA
    é realocado: a pilha fecha por construção com componentes + resíduo."""
    por_mes = {r["mes"]: r for r in serie_decomp}
    meses = [r["mes"] for r in serie_decomp]
    out: list[dict] = []
    for i in range(11, len(meses)):
        janela = meses[i - 11 : i + 1]
        alvo = igpm_12m.get(meses[i])
        rows = [por_mes[m] for m in janela]
        if alvo is None or any(r.get("IGP-M") is None for r in rows):
            continue
        fator = [1.0] * 12
        for t in range(10, -1, -1):
            fator[t] = fator[t + 1] * (1 + rows[t + 1]["IGP-M"] / 100.0)
        item: dict[str, Any] = {"mes": meses[i], "IGP-M 12m": alvo}
        soma = 0.0
        for n in nomes:
            c = sum(rows[t][f"{n} (contrib)"] * fator[t] for t in range(12))
            item[n] = round(c, 4)
            soma += c
        residuo_enc = sum(rows[t]["residuo_pp"] * fator[t] for t in range(12))
        # fecho exato: resíduo publicado = alvo − Σ componentes (inclui o
        # resíduo estrutural encadeado + arredondamento da composição)
        item["residuo"] = round(alvo - soma, 4)
        item["residuo_estrutural_encadeado"] = round(residuo_enc, 4)
        out.append(item)
    return out


def serie_longa_igpm_build(
    igpm_m: dict[str, float | None],
    igpm_12m: dict[str, float | None],
    ipca_12m: dict[str, float | None],
) -> dict:
    """IGP-M mensal + 12m desde 1996 com réguas PRÓPRIAS (sem meta: mediana e
    faixa p10–p90 do 12m pós-Real) + IPCA 12m como única referência externa."""
    meses = sorted(m for m, v in igpm_m.items() if v is not None and m >= POS_REAL_INICIO)
    serie = [
        {"mes": m, "var": igpm_m.get(m), "acum_12m": igpm_12m.get(m), "ipca_12m": ipca_12m.get(m)}
        for m in meses
    ]
    vals12 = sorted(v for m, v in igpm_12m.items() if v is not None and m >= POS_REAL_INICIO)

    def _pct(p: float) -> float | None:
        if not vals12:
            return None
        k = max(0, min(len(vals12) - 1, int(round(p / 100.0 * (len(vals12) - 1)))))
        return round(vals12[k], 3)

    return {
        "desde": POS_REAL_INICIO,
        "serie": serie,
        "reguas": {
            "desde": POS_REAL_INICIO,
            "mediana_12m": round(statistics.median(vals12), 3) if vals12 else None,
            "p10_12m": _pct(10),
            "p90_12m": _pct(90),
            "n": len(vals12),
        },
    }


def origem_ipa_build(
    ipa_m: dict[str, float | None],
    serie_a: dict[str, float | None],
    serie_b: dict[str, float | None],
    ipa_di: dict[str, float | None],
) -> dict | None:
    """Abertura de origem do IPA com IDENTIFICAÇÃO REVALIDADA a cada build.

    As séries SGS 7459/7460 têm rótulo ambíguo na página de metadados do BCB.
    Validação determinística (sem parâmetro arbitrário):
    1. fit OLS de w em  w·A + (1−w)·B ≈ IPA-DI (SGS 225), janela pós-2010
       (família OG→DI unificada), exigindo R² > 0,99 e w ∈ (0,05, 0,45) —
       prova que A e B são MESMO a partição agro/ind da família DI;
    2. o peso MENOR identifica a série AGRÍCOLA (peso agro no IPA ≈ 20-30%,
       notório) e o cross-check exige std(agro) > std(ind) pós-96.
    Qualquer critério falhou → retorna None e o bloco NÃO é publicado.
    """
    meses = sorted(
        m for m in ipa_di
        if m >= "2010-01"
        and ipa_di.get(m) is not None
        and serie_a.get(m) is not None
        and serie_b.get(m) is not None
    )
    if len(meses) < 120:
        print(f"  [origem IPA] janela curta ({len(meses)}m) — bloco nao publicado", file=sys.stderr)
        return None
    ys = [ipa_di[m] for m in meses]
    a = [serie_a[m] for m in meses]
    b = [serie_b[m] for m in meses]
    # OLS de y ≈ w·a + (1−w)·b  ⇒  (y−b) ≈ w·(a−b)
    num = sum((ys[i] - b[i]) * (a[i] - b[i]) for i in range(len(meses)))
    den = sum((a[i] - b[i]) ** 2 for i in range(len(meses)))
    if den <= 0:
        return None
    w = num / den
    resid = [ys[i] - (w * a[i] + (1 - w) * b[i]) for i in range(len(meses))]
    my = sum(ys) / len(ys)
    ss_tot = sum((y - my) ** 2 for y in ys)
    r2 = 1 - sum(r * r for r in resid) / ss_tot if ss_tot > 0 else 0.0
    print(f"  [origem IPA] fit vs IPA-DI: w(A)={w:.3f} | R2={r2:.4f} (n={len(meses)})")
    if not (r2 > 0.99 and 0.05 < min(w, 1 - w) and max(w, 1 - w) < 0.95 and min(w, 1 - w) < 0.45):
        print("  [origem IPA] identidade NAO confirmada — bloco nao publicado", file=sys.stderr)
        return None
    # peso menor = agrícola; cross-check por volatilidade pós-96
    if w < 1 - w:
        agro, ind, w_agro = serie_a, serie_b, w
        cod_agro, cod_ind = CODIGOS_IPA_ORIGEM
    else:
        agro, ind, w_agro = serie_b, serie_a, 1 - w
        cod_ind, cod_agro = CODIGOS_IPA_ORIGEM
    std_agro = statistics.stdev([v for m, v in agro.items() if v is not None and m >= POS_REAL_INICIO])
    std_ind = statistics.stdev([v for m, v in ind.items() if v is not None and m >= POS_REAL_INICIO])
    print(f"  [origem IPA] std pos-96: agro {std_agro:.3f} vs ind {std_ind:.3f} | w_agro={w_agro:.3f}")
    if std_agro <= std_ind:
        print("  [origem IPA] cross-check de volatilidade FALHOU — bloco nao publicado", file=sys.stderr)
        return None
    meses_pub = sorted(set(agro) & set(ind))
    agro12 = rolling12(agro, meses_pub)
    ind12 = rolling12(ind, meses_pub)
    serie = [
        {"mes": m, "agro": agro.get(m), "ind": ind.get(m), "agro_12m": agro12.get(m), "ind_12m": ind12.get(m)}
        for m in meses_pub[-120:]
    ]
    return {
        "familia": "IPA-DI (origem) — SGS 7459/7460; proxy da dinamica agro/industrial do atacado FGV",
        "identificacao": {
            "metodo": "fit w*A+(1-w)*B ~ IPA-DI (SGS 225) pos-2010 + cross-check de volatilidade pos-96",
            "codigo_agro": cod_agro,
            "codigo_ind": cod_ind,
            "w_agro": round(w_agro, 4),
            "r2": round(r2, 5),
        },
        "serie": serie,
        "ultimo": serie[-1] if serie else None,
    }


# ---------------------------------------------------------------------------
# Contexto por componente (aditivo ao schema v3) — músculo dos tabs 2/3/4.
# SÓ fontes abertas e VIVAS no SGS/BCB (as aberturas FGV morreram jul/2025):
#   IPA  → IC-Br (commodities em BRL, com aberturas) + câmbio médio mensal
#   IPC  → IPC-Br (FGV), IPC-Fipe (SP) e IPCA: o varejo em 4 medidas
#   INCC → INCC-DI (SGS 192 — o nome oficial é INCC, não "IGP-M 12m"),
#          IVG-R (valor de garantia residencial, defasagem ~2m) e INCC real
# ---------------------------------------------------------------------------
CODIGOS_CONTEXTO = {
    "IC-Br": 27574,
    "IC-Br agro": 27575,
    "IC-Br metal": 27576,
    "IC-Br energia": 27577,
    "cambio": 3698,
    "IPC-Br": 191,
    "IPC-Fipe": 193,
    "INCC-DI": 192,
    "IVG-R": 21340,
}

#: Janela dos gráficos de contexto (meses) e lags do repasse cambial.
CONTEXTO_MESES = 120
LAGS_CAMBIO = 6


def yoy_nivel(serie: dict[str, float | None]) -> dict[str, float | None]:
    """Var. 12m (%) de série de NÍVEL (número-índice/câmbio): I_t/I_{t-12}−1."""
    out: dict[str, float | None] = {}
    for m, v in serie.items():
        v0 = serie.get(add_meses(m, -12))
        out[m] = round((v / v0 - 1) * 100.0, 4) if v is not None and v0 else None
    return out


def _rolling12_de(serie: dict[str, float | None]) -> dict[str, float | None]:
    return rolling12(serie, sorted(m for m, v in serie.items() if v is not None))


def _corr_pares(pares: list[tuple[float, float]]) -> float | None:
    if len(pares) < 24:
        return None
    xs = [p[0] for p in pares]
    ys = [p[1] for p in pares]
    mx, my = statistics.mean(xs), statistics.mean(ys)
    sx = math.sqrt(sum((x - mx) ** 2 for x in xs))
    sy = math.sqrt(sum((y - my) ** 2 for y in ys))
    if sx == 0 or sy == 0:
        return None
    return round(sum((xs[i] - mx) * (ys[i] - my) for i in range(len(xs))) / (sx * sy), 3)


def contexto_igpm_build(
    componentes: dict[str, dict[str, float | None]],
    ipca_12m: dict[str, float | None],
    raw: dict[str, dict[str, float | None]],
) -> dict:
    """Blocos de contexto dos tabs por componente. Transformações AQUI (nunca
    no front); janelas de coleta distintas ficam explícitas nos metadados."""
    ipa_12m = _rolling12_de(componentes["IPA-M"])
    ipcm_12m = _rolling12_de(componentes["IPC-M"])
    inccm_12m = _rolling12_de(componentes["INCC-M"])

    icbr_12m = yoy_nivel(raw["IC-Br"])
    agro_12m = yoy_nivel(raw["IC-Br agro"])
    metal_12m = yoy_nivel(raw["IC-Br metal"])
    energia_12m = yoy_nivel(raw["IC-Br energia"])
    cambio_12m = yoy_nivel(raw["cambio"])
    ipcbr_12m = _rolling12_de(raw["IPC-Br"])
    fipe_12m = _rolling12_de(raw["IPC-Fipe"])
    inccdi_12m = _rolling12_de(raw["INCC-DI"])
    ivgr_12m = yoy_nivel(raw["IVG-R"])

    # ---- IPA: drivers do atacado ----
    meses_ipa = sorted(m for m, v in ipa_12m.items() if v is not None)[-CONTEXTO_MESES:]
    serie_ipa = [
        {
            "mes": m,
            "ipa_12m": ipa_12m.get(m),
            "icbr_12m": icbr_12m.get(m),
            "agro_12m": agro_12m.get(m),
            "metal_12m": metal_12m.get(m),
            "energia_12m": energia_12m.get(m),
            "cambio_12m": cambio_12m.get(m),
        }
        for m in meses_ipa
    ]
    # Repasse cambial: corr(câmbio 12m em t, IPA 12m em t+k) — câmbio ANTECIPA.
    lags_cambio = []
    for k in range(LAGS_CAMBIO + 1):
        pares96, pares16 = [], []
        for m, v in cambio_12m.items():
            if v is None or m < POS_REAL_INICIO:
                continue
            alvo = ipa_12m.get(add_meses(m, k))
            if alvo is None:
                continue
            pares96.append((v, alvo))
            if m >= JANELA_RECENTE_INICIO:
                pares16.append((v, alvo))
        lags_cambio.append({
            "lag": k,
            "corr_pos96": _corr_pares(pares96),
            "n_pos96": len(pares96),
            "corr_pos2016": _corr_pares(pares16),
            "n_pos2016": len(pares16),
        })
    validos = [l for l in lags_cambio if l["corr_pos96"] is not None]
    melhor = max(validos, key=lambda l: l["corr_pos96"]) if validos else None

    # ---- IPC: o varejo em 4 medidas ----
    meses_ipc = sorted(m for m, v in ipcm_12m.items() if v is not None)[-CONTEXTO_MESES:]
    serie_ipc = [
        {
            "mes": m,
            "ipcm_12m": ipcm_12m.get(m),
            "ipcbr_12m": ipcbr_12m.get(m),
            "fipe_12m": fipe_12m.get(m),
            "ipca_12m": ipca_12m.get(m),
        }
        for m in meses_ipc
    ]
    u_ipc = serie_ipc[-1] if serie_ipc else {}
    spreads_mes = {
        "mes": u_ipc.get("mes"),
        "vs_ipca": round(u_ipc["ipcm_12m"] - u_ipc["ipca_12m"], 3)
        if u_ipc.get("ipcm_12m") is not None and u_ipc.get("ipca_12m") is not None else None,
        "vs_ipcbr": round(u_ipc["ipcm_12m"] - u_ipc["ipcbr_12m"], 3)
        if u_ipc.get("ipcm_12m") is not None and u_ipc.get("ipcbr_12m") is not None else None,
        "vs_fipe": round(u_ipc["ipcm_12m"] - u_ipc["fipe_12m"], 3)
        if u_ipc.get("ipcm_12m") is not None and u_ipc.get("fipe_12m") is not None else None,
    }

    # ---- INCC: custo de construir em contexto ----
    meses_incc = sorted(m for m, v in inccm_12m.items() if v is not None)[-CONTEXTO_MESES:]
    serie_incc = []
    for m in meses_incc:
        v12 = inccm_12m.get(m)
        ip12 = ipca_12m.get(m)
        serie_incc.append({
            "mes": m,
            "inccm_12m": v12,
            "inccdi_12m": inccdi_12m.get(m),
            "ivgr_12m": ivgr_12m.get(m),
            "ipca_12m": ip12,
            "spread_ipca": round(v12 - ip12, 3) if v12 is not None and ip12 is not None else None,
        })
    spreads_hist = sorted(
        inccm_12m[m] - ipca_12m[m]
        for m in inccm_12m
        if m >= POS_REAL_INICIO and inccm_12m.get(m) is not None and ipca_12m.get(m) is not None
    )
    spread_atual = next((r["spread_ipca"] for r in reversed(serie_incc) if r["spread_ipca"] is not None), None)

    def _pct_de(vals: list[float], p: float) -> float | None:
        if not vals:
            return None
        k = max(0, min(len(vals) - 1, int(round(p / 100.0 * (len(vals) - 1)))))
        return round(vals[k], 3)

    percentil_atual = None
    if spread_atual is not None and spreads_hist:
        abaixo = sum(1 for v in spreads_hist if v <= spread_atual)
        percentil_atual = round(100.0 * abaixo / len(spreads_hist), 1)
    ivgr_ultimo = next((m for m in sorted(ivgr_12m, reverse=True) if ivgr_12m[m] is not None), None)

    return {
        "ipa_drivers": {
            "serie": serie_ipa,
            "cambio_lags": {
                "lags": lags_cambio,
                "melhor_lag": melhor["lag"] if melhor else None,
                "melhor_corr_pos96": melhor["corr_pos96"] if melhor else None,
            },
            "fontes": {k: CODIGOS_CONTEXTO[k] for k in ("IC-Br", "IC-Br agro", "IC-Br metal", "IC-Br energia", "cambio")},
            "ultimo_mes": meses_ipa[-1] if meses_ipa else None,
        },
        "ipc_medidas": {
            "serie": serie_ipc,
            "spreads_mes": spreads_mes,
            "fontes": {k: CODIGOS_CONTEXTO[k] for k in ("IPC-Br", "IPC-Fipe")} | {"IPCA": 433},
            "nota": (
                "Janelas de coleta distintas: IPC-M dia 21 do mes anterior ao dia 20; "
                "IPC-Br e IPCA mes civil; IPC-Fipe quadrissemanas (municipio de Sao Paulo)"
            ),
        },
        "incc_contexto": {
            "serie": serie_incc,
            "spread_stats": {
                "desde": POS_REAL_INICIO,
                "percentil_atual": percentil_atual,
                "mediana": _pct_de(spreads_hist, 50),
                "p10": _pct_de(spreads_hist, 10),
                "p90": _pct_de(spreads_hist, 90),
                "n": len(spreads_hist),
            },
            "ivgr_ultimo_mes": ivgr_ultimo,
            "fontes": {k: CODIGOS_CONTEXTO[k] for k in ("INCC-DI", "IVG-R")} | {"IPCA": 433},
        },
    }


# ---- Focus (Olinda) — espelho de build_ipca, indicador parametrizado ----
def _focus_mensal_query(indicador: str, ref_mm_yyyy: str) -> dict | None:
    url = (
        f"{FOCUS_BASE}/ExpectativaMercadoMensais?$format=json&$top=1"
        f"&$filter=Indicador%20eq%20%27{indicador.replace('-', '-')}%27%20and%20DataReferencia%20eq%20%27{ref_mm_yyyy.replace('/', '%2F')}%27"
        f"%20and%20baseCalculo%20eq%200&$orderby=Data%20desc"
    )
    data = _get(url, retries=2, sleep=2.0).json().get("value", [])
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


def focus_mensais_build(indicador: str, mes_recente: str, realizado: dict[str, float | None], n_surpresas: int = 24) -> dict:
    ref = lambda m: f"{m[5:7]}/{m[:4]}"  # noqa: E731
    vespera = _focus_mensal_query(indicador, ref(mes_recente))
    proximos: list[dict] = []
    for d in range(1, 5):
        m = add_meses(mes_recente, d)
        time.sleep(0.25)
        p = _focus_mensal_query(indicador, ref(m))
        if p and p.get("mediana") is not None:
            proximos.append({"mes_ref": m, **p})
    surpresas: list[dict] = []
    for d in range(n_surpresas - 1, -1, -1):
        m = add_meses(mes_recente, -d)
        real = realizado.get(m)
        if real is None:
            continue
        e = vespera if d == 0 else (_focus_mensal_query(indicador, ref(m)), time.sleep(0.25))[0]
        if not e or e.get("mediana") is None:
            continue
        surpresas.append({
            "mes": m,
            "realizado": real,
            "esperado": e["mediana"],
            "surpresa_pp": round(real - e["mediana"], 4),
            "data_pesquisa": e.get("data_pesquisa"),
        })
    return {"mes_referencia": mes_recente, "vespera": vespera, "proximos": proximos, "surpresas": surpresas}


def focus_anuais_igpm(ano_atual: int) -> dict[int, list[dict]]:
    url = (
        f"{FOCUS_BASE}/ExpectativasMercadoAnuais?$format=json&$top=20000"
        f"&$filter=Indicador%20eq%20%27IGP-M%27%20and%20Data%20ge%20%27{ano_atual - 1}-01-01%27"
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


# ---------------------------------------------------------------------------
# Decomposição com pesos efetivos encadeados (schema v2)
# ---------------------------------------------------------------------------
def decompoe_pesos_efetivos(
    igpm_m: dict[str, float | None],
    componentes: dict[str, dict[str, float | None]],
    meses: list[str],
) -> list[dict[str, Any]]:
    """Decomposição mensal do IGP-M com pesos efetivos encadeados.

    Os pesos 60/30/10 valem no NÍVEL dos números-índice na base (ago/1994);
    como o IPA inflacionou muito mais acumuladamente, o peso efetivo dele na
    variação mensal hoje passa de 60%. Sem número-índice publicado no SGS,
    encadeamos as variações a partir do 1º mês comum (set/1994, logo após a
    base ago/1994) e renormalizamos mês a mês:

        w_c,t = w_c0 * I_c,t-1 / SOMA_c(w_c0 * I_c,t-1)

    Método sem parâmetro estimado (reproduzível). O resíduo
    IGP-M_t - SOMA(w_c,t * v_c,t) é estrutural e fica explícito em
    `residuo_pp` (validação compara com o resíduo dos pesos fixos).
    """
    nomes = list(componentes.keys())
    w0 = {n: PESOS_IGPM[n] / 100.0 for n in nomes}

    # Números-índice encadeados (nível ANTES de cada mês; base 1.0 no 1º mês comum).
    nivel_antes: dict[str, dict[str, float]] = {n: {} for n in nomes}
    nivel = {n: 1.0 for n in nomes}
    for m in meses:
        for n in nomes:
            nivel_antes[n][m] = nivel[n]
            v = componentes[n].get(m)
            if v is not None:
                nivel[n] *= 1 + v / 100.0

    serie: list[dict[str, Any]] = []
    for m in meses:
        y = igpm_m.get(m)
        vs = {n: componentes[n].get(m) for n in nomes}
        if y is None or any(v is None for v in vs.values()):
            continue
        raw = {n: w0[n] * nivel_antes[n][m] for n in nomes}
        total = sum(raw.values())
        pesos = {n: raw[n] / total for n in nomes}
        contribs = {n: pesos[n] * vs[n] for n in nomes}
        item: dict[str, Any] = {"mes": m, "IGP-M": y}
        for n in nomes:
            item[f"{n} (contrib)"] = round(contribs[n], 4)
            item[f"{n} (peso efetivo)"] = round(100.0 * pesos[n], 2)
        item["contrib_soma"] = round(sum(contribs.values()), 4)
        item["residuo_pp"] = round(y - sum(contribs.values()), 4)
        serie.append(item)
    return serie


def tabela_sintese_igpm_build(
    mes_ref: str,
    igpm_m: dict[str, float | None],
    igpm_12m: dict[str, float | None],
    igpm_ano: dict[str, float | None],
    familia_raw: dict[str, dict[str, float | None]],
    componentes: dict[str, dict[str, float | None]],
    serie_decomp: list[dict],
    origem_ipa: dict | None,
) -> dict:
    """Síntese: família IGP (com mes_proprio — janelas deslocadas), componentes
    (com peso efetivo e contrib do mês) e origem do IPA (se validada)."""
    m1, m2 = add_meses(mes_ref, -1), add_meses(mes_ref, -2)
    u_decomp = serie_decomp[-1] if serie_decomp else {}

    def _linha(sid, nome, serie, *, peso=None, contrib=None, mes_proprio=None):
        m0p = mes_proprio or mes_ref
        meses_s = sorted(k for k, v in serie.items() if v is not None)
        r12 = rolling12(serie, meses_s)
        rano = rolling_ano(serie, meses_s)
        return {
            "id": sid,
            "nome": nome,
            "m2": serie.get(add_meses(m0p, -2)),
            "m1": serie.get(add_meses(m0p, -1)),
            "m0": serie.get(m0p),
            "acum_ano": rano.get(m0p),
            "acum_12m": r12.get(m0p),
            "peso": peso,
            "contrib_pp": contrib,
            **({"mes_proprio": m0p} if mes_proprio else {}),
        }

    linhas_familia = [{
        "id": "igpm", "nome": "IGP-M",
        "m2": igpm_m.get(m2), "m1": igpm_m.get(m1), "m0": igpm_m.get(mes_ref),
        "acum_ano": igpm_ano.get(mes_ref), "acum_12m": igpm_12m.get(mes_ref),
        "peso": None, "contrib_pp": None,
    }]
    for nome, serie in familia_raw.items():
        m0p = max((k for k, v in serie.items() if v is not None), default=mes_ref)
        linhas_familia.append(_linha(nome.lower().replace("-", ""), nome, serie, mes_proprio=m0p))

    linhas_comp = []
    for nome, serie in componentes.items():
        linhas_comp.append(_linha(
            f"comp_{nome.split('-')[0].lower()}", nome, serie,
            peso=u_decomp.get(f"{nome} (peso efetivo)"),
            contrib=u_decomp.get(f"{nome} (contrib)"),
        ))
    if u_decomp:
        linhas_comp.append({
            "id": "residuo", "nome": "Resíduo estrutural",
            "m2": None, "m1": None, "m0": u_decomp.get("residuo_pp"),
            "acum_ano": None, "acum_12m": None, "peso": None, "contrib_pp": u_decomp.get("residuo_pp"),
        })

    secoes = [
        {"id": "familia", "titulo": "Família IGP", "linhas": linhas_familia},
        {"id": "componentes", "titulo": "Componentes do IGP-M (peso efetivo)", "linhas": linhas_comp},
    ]
    if origem_ipa and origem_ipa.get("ultimo"):
        u = origem_ipa["ultimo"]
        secoes.append({
            "id": "origem", "titulo": "IPA por origem (família IPA-DI)",
            "linhas": [
                {"id": "ipa_agro", "nome": "Agrícola", "m2": None, "m1": None, "m0": u.get("agro"),
                 "acum_ano": None, "acum_12m": u.get("agro_12m"), "peso": None, "contrib_pp": None,
                 "mes_proprio": u.get("mes")},
                {"id": "ipa_ind", "nome": "Industrial", "m2": None, "m1": None, "m0": u.get("ind"),
                 "acum_ano": None, "acum_12m": u.get("ind_12m"), "peso": None, "contrib_pp": None,
                 "mes_proprio": u.get("mes")},
            ],
        })
    return {"mes_recente": mes_ref, "meses": [m2, m1, mes_ref], "secoes": secoes}


def transformacoes_build(
    momentum: dict,
    igpm_m: dict[str, float | None],
    igpm_12m: dict[str, float | None],
    igpm_ano: dict[str, float | None],
    componentes: dict[str, dict[str, float | None]],
    mes_ref: str,
) -> list[dict]:
    """Tabela por índice: mês, 3m e 6m anualizados (dessaz onde cabe), ano, 12m."""
    out = []
    fontes = {"IGP-M": igpm_m, **componentes}
    for nome, serie in fontes.items():
        pts = (momentum.get("series") or {}).get(nome) or []
        u = pts[-1] if pts else {}
        meses_s = sorted(k for k, v in serie.items() if v is not None)
        r12 = rolling12(serie, meses_s)
        rano = rolling_ano(serie, meses_s)
        out.append({
            "id": nome,
            "nome": nome,
            "mes": serie.get(mes_ref),
            "saar_3m": u.get("saar_3m"),
            "saar_6m": u.get("saar_6m"),
            "dessaz": bool(u.get("dessaz")),
            "acum_ano": rano.get(mes_ref) if nome != "IGP-M" else igpm_ano.get(mes_ref),
            "acum_12m": r12.get(mes_ref) if nome != "IGP-M" else igpm_12m.get(mes_ref),
        })
    return out


def release_igpm_build(
    mes_ref: str,
    igpm_m: dict[str, float | None],
    igpm_12m: dict[str, float | None],
    igpm_ano: dict[str, float | None],
    transformacoes: list[dict],
    serie_decomp: list[dict],
    focus_mensal: dict | None,
    focus_anos: dict,
    aluguel: dict,
    overview_saz: dict,
    est_12m: dict,
    familia_raw: dict[str, dict[str, float | None]],
) -> dict:
    """Contrato do robô (data/igpm_release.json, v1) — nunca renomear campo."""
    realizado = igpm_m.get(mes_ref)
    vespera = (focus_mensal or {}).get("vespera") or {}
    surpresa = (
        round(realizado - vespera["mediana"], 4)
        if realizado is not None and vespera.get("mediana") is not None
        else None
    )
    saz_mes = (overview_saz or {}).get(mes_ref[5:7], {})
    leitura = None
    if realizado is not None and saz_mes.get("mediana") is not None:
        d = realizado - saz_mes["mediana"]
        leitura = "acima" if d > 0.05 else ("abaixo" if d < -0.05 else "em linha")
    vals_mes_civil = [
        v for m, v in igpm_m.items()
        if v is not None and m[5:7] == mes_ref[5:7] and m >= POS_REAL_INICIO
    ]
    u_decomp = serie_decomp[-1] if serie_decomp else {}
    ano_atual = int(mes_ref[:4])
    fa = (focus_anos or {}).get(ano_atual) or []
    ig12 = igpm_12m.get(mes_ref)
    rj = (aluguel.get("reajustes") or [{}])[0]
    return {
        "schema_version": RELEASE_SCHEMA_VERSION,
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "indicador": "IGP-M",
        "mes_referencia": mes_ref,
        "headline": {"var_mes": realizado, "acum_ano": igpm_ano.get(mes_ref), "acum_12m": ig12},
        "componentes": [
            {
                "nome": t["nome"], "var_mes": t["mes"], "acum_ano": t["acum_ano"], "acum_12m": t["acum_12m"],
                "saar_3m": t["saar_3m"], "dessaz": t["dessaz"],
                "peso_efetivo": u_decomp.get(f"{t['nome']} (peso efetivo)"),
                "contrib_pp": u_decomp.get(f"{t['nome']} (contrib)"),
            }
            for t in transformacoes if t["id"] != "IGP-M"
        ],
        "decomposicao_mes": {
            "residuo_pp": u_decomp.get("residuo_pp"),
            "fecho": u_decomp.get("contrib_soma"),
        },
        "expectativa_mes": {
            "mediana": vespera.get("mediana"), "media": vespera.get("media"), "dp": vespera.get("dp"),
            "min": vespera.get("min"), "max": vespera.get("max"),
            "data_pesquisa": vespera.get("data_pesquisa"), "surpresa_pp": surpresa,
        },
        "posicao_historica": {
            "mediana_mes_civil": saz_mes.get("mediana"),
            "min": saz_mes.get("min"), "max": saz_mes.get("max"), "n": saz_mes.get("n"),
            "percentil_mes": percentil_de(vals_mes_civil, realizado) if realizado is not None and vals_mes_civil else None,
            "percentil_12m_pos96": est_12m.get("percentil_atual"),
            "leitura": leitura,
        },
        "aluguel": {
            "mes_referencia": aluguel.get("mes_referencia"),
            "reajuste_12m": rj.get("igpm_12m"),
            "aplicado_pct": rj.get("aplicado_pct"),
            "clausula_nao_reducao": rj.get("clausula_nao_reducao"),
        },
        "familia": {
            nome.lower().replace("-", ""): {
                "mes": max((k for k, v in serie.items() if v is not None), default=None),
                "var_mes": serie.get(max((k for k, v in serie.items() if v is not None), default="")),
            }
            for nome, serie in familia_raw.items()
        },
        "proximos_meses": [
            {"mes_ref": p["mes_ref"], "mediana": p.get("mediana"), "min": p.get("min"), "max": p.get("max")}
            for p in ((focus_mensal or {}).get("proximos") or [])
        ],
        "focus_ano_corrente": {
            "ano": ano_atual,
            "mediana": (fa[-1] if fa else {}).get("mediana"),
            "data": (fa[-1] if fa else {}).get("data"),
        },
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--no-merge", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "igpm.json"

    print("== IGP-M ==")
    igpm_m = sgs_fetch(189)

    print(f"== Componentes ({'/'.join(str(c) for c in CODIGOS_COMPONENTES.values())}) ==")
    componentes = {nome: sgs_fetch(cod) for nome, cod in CODIGOS_COMPONENTES.items()}

    print("== IPCA pra comparacao ==")
    ipca_m = sgs_fetch(433)
    ipca_12m = sgs_fetch(13522)

    todos = set(igpm_m.keys())
    for s in componentes.values():
        todos &= set(s.keys())
    meses = sorted(todos)
    if not meses:
        print("ERRO: nenhum mes comum", file=sys.stderr)
        sys.exit(1)

    mes_recente = meses[-1]
    print(f"  Janela comum: {meses[0]} -> {mes_recente} ({len(meses)} meses)")

    # ---- IGP-M 12m por composição geométrica (SGS 192 aposentado — ver docstring) ----
    meses_igpm = sorted(m for m, v in igpm_m.items() if v is not None)
    igpm_12m = rolling12(igpm_m, meses_igpm)

    # ---- visao geral (5 anos) — formato v1 preservado (contribs de pesos FIXOS, legado) ----
    serie_overview = []
    for m in meses[-60:]:
        item = {"mes": m, "IGP-M": igpm_m.get(m), "IGP-M 12m": igpm_12m.get(m)}
        soma = 0.0
        for comp, peso in PESOS_IGPM.items():
            v = componentes[comp].get(m)
            item[comp] = v
            if v is not None:
                c = v * peso / 100.0
                item[f"{comp} (contrib)"] = round(c, 4)
                soma += c
        item["contrib_soma"] = round(soma, 4)
        serie_overview.append(item)

    # ---- decomposição v2: pesos efetivos encadeados + resíduo explícito ----
    print("== Decomposicao (pesos efetivos encadeados) ==")
    serie_decomp_full = decompoe_pesos_efetivos(igpm_m, componentes, meses)
    serie_decomp = serie_decomp_full[-ANCORA_MESES:]
    for item in serie_decomp:
        item["IGP-M 12m"] = igpm_12m.get(item["mes"])  # p/ sombrear deflação no front
    print(f"  base do encadeamento: {meses[0]} | {len(serie_decomp_full)} meses decompostos")

    # ---- sub-paineis por componente (10 anos; estatísticas pós-1996) ----
    sub_paineis = {}
    for nome, serie in componentes.items():
        acum12 = rolling12(serie, meses)
        acumano = rolling_ano(serie, meses)
        janela = meses[-120:]
        serie_longa = []
        for m in janela:
            row = {
                "mes": m,
                "mensal": serie.get(m),
                "acum_12m": acum12.get(m),
                "acum_ano": acumano.get(m),
                "ipca_mensal": ipca_m.get(m),
                "ipca_12m": ipca_12m.get(m),
            }
            if acum12.get(m) is not None and ipca_12m.get(m) is not None:
                row["spread_12m"] = round(acum12[m] - ipca_12m[m], 3)
            else:
                row["spread_12m"] = None
            serie_longa.append(row)

        # Rankings truncados ao pós-Real (jun/1995 e nov/2002 são curiosidade
        # de era de crise, não régua de decisão).
        ranking = sorted(
            [(m, v) for m, v in serie.items() if v is not None and m >= POS_REAL_INICIO],
            key=lambda x: x[1],
            reverse=True,
        )
        maiores_altas = [{"mes": m, "valor": round(v, 3)} for m, v in ranking[:10]]
        maiores_quedas = [{"mes": m, "valor": round(v, 3)} for m, v in ranking[-10:]]
        maiores_quedas.reverse()

        sub_paineis[nome] = {
            "peso_igpm": PESOS_IGPM[nome],
            "serie_longa": serie_longa,
            "estatisticas": estatisticas(serie, desde=POS_REAL_INICIO),
            "estatisticas_12m": estatisticas_12m(acum12, POS_REAL_INICIO, acum12.get(mes_recente)),
            "sazonalidade": sazonalidade(serie, desde=POS_REAL_INICIO),
            "maiores_altas": maiores_altas,
            "maiores_quedas": maiores_quedas,
            "ultimo_mes": mes_recente,
            "ultimo_mensal": serie.get(mes_recente),
            "ultimo_12m": acum12.get(mes_recente),
            "ultimo_ano": acumano.get(mes_recente),
        }

    # ---- comparativo IGP-M vs IPCA (10 anos) ----
    comparativo = []
    for m in meses[-120:]:
        ig12 = igpm_12m.get(m)
        ip12 = ipca_12m.get(m)
        comparativo.append({
            "mes": m,
            "igpm_12m": ig12,
            "ipca_12m": ip12,
            "spread": round(ig12 - ip12, 3) if ig12 is not None and ip12 is not None else None,
        })

    # ---- antecipação: correlação cruzada IPA-M 12m x IPCA 12m (lags 0-6m) ----
    print("== Antecipacao (IPA-M 12m vs IPCA 12m defasado) ==")
    meses_ipa = sorted(m for m, v in componentes["IPA-M"].items() if v is not None)
    ipa_12m = rolling12(componentes["IPA-M"], meses_ipa)
    lags_out = []
    for lag in range(LAGS_ANTECIPACAO + 1):
        pares_total: list[tuple[float, float]] = []
        pares_recente: list[tuple[float, float]] = []
        for m, v in ipa_12m.items():
            if v is None or m < POS_REAL_INICIO:
                continue
            alvo = ipca_12m.get(add_meses(m, lag))
            if alvo is None:
                continue
            pares_total.append((v, alvo))
            if m >= JANELA_RECENTE_INICIO:
                pares_recente.append((v, alvo))
        corr_total = pearson([p[0] for p in pares_total], [p[1] for p in pares_total])
        corr_recente = pearson([p[0] for p in pares_recente], [p[1] for p in pares_recente])
        lags_out.append({
            "lag": lag,
            "corr_pos96": corr_total,
            "n_pos96": len(pares_total),
            "corr_pos2016": corr_recente,
            "n_pos2016": len(pares_recente),
        })
    melhor = max((l for l in lags_out if l["corr_pos96"] is not None), key=lambda l: l["corr_pos96"])
    melhor_rec = max(
        (l for l in lags_out if l["corr_pos2016"] is not None),
        key=lambda l: l["corr_pos2016"],
        default=None,
    )
    serie_antecipacao = [
        {"mes": m, "ipa_12m": ipa_12m.get(m), "ipca_12m": ipca_12m.get(m)}
        for m in meses_ipa[-180:]
        if ipa_12m.get(m) is not None or ipca_12m.get(m) is not None
    ]
    antecipacao = {
        "janela_total": POS_REAL_INICIO,
        "janela_recente": JANELA_RECENTE_INICIO,
        "lags": lags_out,
        "melhor_lag": melhor["lag"],
        "melhor_corr_pos96": melhor["corr_pos96"],
        "melhor_lag_pos2016": melhor_rec["lag"] if melhor_rec else None,
        "melhor_corr_pos2016": melhor_rec["corr_pos2016"] if melhor_rec else None,
        "serie": serie_antecipacao,
    }

    # ---- aluguel na prática: últimos 5 reajustes anuais ----
    # Mês de referência = último mês com IGP-M 12m E IPCA 12m disponíveis
    # (o IGP-M sai antes do IPCA no mês corrente).
    mes_aluguel = next(
        (m for m in reversed(meses) if igpm_12m.get(m) is not None and ipca_12m.get(m) is not None),
        mes_recente,
    )
    mm_ref = mes_aluguel[5:7]
    ano_ref = int(mes_aluguel[:4])
    reajustes = []
    for k in range(ALUGUEL_ANOS):
        m = f"{ano_ref - k:04d}-{mm_ref}"
        ig = igpm_12m.get(m)
        ip = ipca_12m.get(m)
        if ig is None or ip is None:
            continue
        reajustes.append({
            "ano": ano_ref - k,
            "mes": m,
            "igpm_12m": round(ig, 2),
            "ipca_12m": round(ip, 2),
            # Regra contratual de mercado: cláusula de não-redução — IGP-M
            # negativo congela o aluguel, não reduz.
            "aplicado_pct": round(max(ig, 0.0), 2),
            "clausula_nao_reducao": ig < 0,
        })
    aluguel = {"mes_referencia": mes_aluguel, "reajustes": reajustes}

    # ---- série mensal completa (10 anos) p/ tabela/CSV do front ----
    serie_analise = []
    for m in meses[-120:]:
        ig12 = igpm_12m.get(m)
        ip12 = ipca_12m.get(m)
        serie_analise.append({
            "mes": m,
            "igpm": igpm_m.get(m),
            "ipa": componentes["IPA-M"].get(m),
            "ipc": componentes["IPC-M"].get(m),
            "incc": componentes["INCC-M"].get(m),
            "igpm_12m": ig12,
            "ipca_12m": ip12,
            "spread_12m": round(ig12 - ip12, 3) if ig12 is not None and ip12 is not None else None,
        })

    # ------------------------------- schema v3 -------------------------------
    igpm_ano = rolling_ano(igpm_m, meses_igpm)

    print("== Momentum (STL onde ha sazonalidade; IPA anualizado sem ajuste) ==")
    momentum = momentum_igpm_build({"IGP-M": igpm_m, **componentes})
    print(f"  series: {sorted(momentum['series'].keys())}")

    print("== Serie longa + reguas pos-Real ==")
    serie_longa = serie_longa_igpm_build(igpm_m, igpm_12m, ipca_12m)
    print(f"  {len(serie_longa['serie'])} meses | reguas: {serie_longa['reguas']}")

    print("== Familia IGP (IGP-10 / IGP-DI) ==")
    familia_raw = {nome: sgs_fetch(cod) for nome, cod in CODIGOS_FAMILIA.items()}

    print("== Origem do IPA (identificacao revalidada por build) ==")
    ipa_di = sgs_fetch(CODIGO_IPA_DI)
    origem_a = sgs_fetch(CODIGOS_IPA_ORIGEM[0])
    origem_b = sgs_fetch(CODIGOS_IPA_ORIGEM[1])
    origem_ipa = origem_ipa_build(componentes["IPA-M"], origem_a, origem_b, ipa_di)

    print("== Contexto dos componentes (IC-Br / cambio / IPC-Br / Fipe / INCC-DI / IVG-R) ==")
    contexto_raw = {nome: sgs_fetch(cod) for nome, cod in CODIGOS_CONTEXTO.items()}
    contexto = contexto_igpm_build(componentes, ipca_12m, contexto_raw)
    print(
        f"  ipa_drivers: {len(contexto['ipa_drivers']['serie'])}m | "
        f"melhor lag cambio->IPA: {contexto['ipa_drivers']['cambio_lags']['melhor_lag']}m "
        f"(corr {contexto['ipa_drivers']['cambio_lags']['melhor_corr_pos96']}) | "
        f"ipc_medidas: {len(contexto['ipc_medidas']['serie'])}m | "
        f"incc_contexto: {len(contexto['incc_contexto']['serie'])}m "
        f"(IVG-R ate {contexto['incc_contexto']['ivgr_ultimo_mes']})"
    )

    print("== Decomposicao 12m (residuo como fatia explicita) ==")
    decomp_12m = contrib_12m_com_residuo(serie_decomp_full, igpm_12m, list(PESOS_IGPM.keys()))[-ANCORA_MESES:]
    if decomp_12m:
        u12 = decomp_12m[-1]
        print(f"  {len(decomp_12m)} meses | ultimo residuo 12m: {u12['residuo']:+.3f} p.p. (12m {u12['IGP-M 12m']:.2f})")

    print("== Tabela sintese ==")
    tabela_sintese = tabela_sintese_igpm_build(
        mes_recente, igpm_m, igpm_12m, igpm_ano, familia_raw, componentes,
        serie_decomp_full, origem_ipa,
    )
    print(f"  secoes: {[s['id'] + ':' + str(len(s['linhas'])) for s in tabela_sintese['secoes']]}")

    print("== Transformacoes por indice ==")
    transformacoes = transformacoes_build(momentum, igpm_m, igpm_12m, igpm_ano, componentes, mes_recente)

    _prev_cache: dict[str, Any] = {}

    def prev_blob():
        if "v" not in _prev_cache:
            try:
                sys.path.insert(0, str(HERE))
                from shared.blob_download import download_json  # noqa: E402
                _prev_cache["v"] = download_json(BLOB_PATH)
            except Exception as e_prev:  # noqa: BLE001
                print(f"  [WARN] blob anterior indisponivel ({e_prev})", file=sys.stderr)
                _prev_cache["v"] = None
        return _prev_cache["v"]

    print("== Focus IGP-M (anuais) ==")
    try:
        focus_anos = focus_anuais_igpm(int(mes_recente[:4]))
        print(f"  anos: {sorted(focus_anos.keys())}")
    except Exception as e:  # noqa: BLE001
        print(f"  [WARN] Focus anuais indisponivel ({e}) — blob anterior.", file=sys.stderr)
        prev = prev_blob()
        focus_anos = prev.get("focus_anuais", {}) if isinstance(prev, dict) else {}
    focus_anos = {int(k): v for k, v in focus_anos.items() if str(k).isdigit()}

    print("== Focus IGP-M (mensais: vespera + proximos + surpresas) ==")
    try:
        focus_mensal = focus_mensais_build("IGP-M", mes_recente, igpm_m)
        print(
            f"  vespera: {(focus_mensal.get('vespera') or {}).get('mediana')} "
            f"| proximos: {len(focus_mensal['proximos'])} | surpresas: {len(focus_mensal['surpresas'])}"
        )
    except Exception as e:  # noqa: BLE001
        print(f"  [WARN] Focus mensais indisponivel ({e}) — blob anterior.", file=sys.stderr)
        prev = prev_blob()
        focus_mensal = prev.get("focus_mensal") if isinstance(prev, dict) else None

    out = {
        "schema_version": SCHEMA_VERSION,
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "mes_recente": mes_recente,
        "fontes": {
            "IGP-M mensal": 189,
            "IPA-M": CODIGOS_COMPONENTES["IPA-M"],
            "IPC-M": CODIGOS_COMPONENTES["IPC-M"],
            "INCC-M": CODIGOS_COMPONENTES["INCC-M"],
            "IPCA mensal": 433,
            "IPCA 12m": 13522,
            # "IGP-M 12m" não tem código SGS: é composto aqui do 189 (o
            # antigo 192 NÃO era IGP-M 12m — ver docstring do builder).
        },
        "pesos": PESOS_IGPM,
        "overview": {
            "serie": serie_overview,
            "componentes": list(PESOS_IGPM.keys()),
            "mes_recente": mes_recente,
            "ultimo_mensal": igpm_m.get(mes_recente),
            "ultimo_12m": igpm_12m.get(mes_recente),
            # schema v2: réguas do IGP-M cheio (pós-Real)
            "sazonalidade_pos96": sazonalidade(igpm_m, desde=POS_REAL_INICIO),
            "estatisticas_pos96": estatisticas(igpm_m, desde=POS_REAL_INICIO),
            "estatisticas_12m": estatisticas_12m(igpm_12m, POS_REAL_INICIO, igpm_12m.get(mes_recente)),
        },
        # schema v2: âncora — decomposição com pesos efetivos + resíduo explícito
        "decomposicao": {
            "metodo": (
                "pesos efetivos encadeados: w_c,t = w_c0*I_c,t-1 / soma(w_c0*I_c,t-1), "
                "I encadeado das variacoes desde a base; residuo estrutural explicito"
            ),
            "base_encadeamento": meses[0],
            "componentes": list(PESOS_IGPM.keys()),
            "serie": serie_decomp,
        },
        "antecipacao": antecipacao,
        "aluguel": aluguel,
        "analise": {"serie": serie_analise},
        "comparativo_ipca": comparativo,
        "componentes": sub_paineis,
        # compat com versao anterior do frontend
        "igpm": {
            "serie": serie_overview,
            "pesos": PESOS_IGPM,
            "mes_recente": mes_recente,
            "componentes": list(PESOS_IGPM.keys()),
        },
        # ------------------------------ schema v3 ------------------------------
        "tabela_sintese": tabela_sintese,
        "transformacoes": transformacoes,
        "momentum": momentum,
        "decomposicao_12m": {"serie": decomp_12m, "componentes": list(PESOS_IGPM.keys())},
        "serie_longa": serie_longa,
        "origem_ipa": origem_ipa,
        "focus_anuais": focus_anos,
        "focus_mensal": focus_mensal,
        # aditivo (jul/2026): contexto dos tabs por componente — fontes
        # abertas vivas (IC-Br, cambio, IPC-Br, IPC-Fipe, INCC-DI, IVG-R)
        "contexto": contexto,
    }

    print("== Release (contrato do robo) ==")
    release = release_igpm_build(
        mes_recente, igpm_m, igpm_12m, igpm_ano, transformacoes, serie_decomp_full,
        focus_mensal, focus_anos, aluguel, out["overview"]["sazonalidade_pos96"],
        out["overview"]["estatisticas_12m"], familia_raw,
    )
    print(
        f"  headline: mes {release['headline']['var_mes']} | 12m {release['headline']['acum_12m']} "
        f"| esperado {release['expectativa_mes']['mediana']} | surpresa {release['expectativa_mes']['surpresa_pp']} "
        f"| aluguel aplicado {release['aluguel']['aplicado_pct']}%"
    )

    erros = valida_schema_v2(out, igpm_12m, ipca_m, ipca_12m, serie_decomp)
    erros += valida_schema_v3(out, release)

    out_file.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nJSON salvo em {out_file} ({out_file.stat().st_size/1024:.1f} KB)")
    release_file = out_dir / "igpm_release.json"
    release_file.write_text(json.dumps(release, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Release salvo em {release_file} ({release_file.stat().st_size/1024:.1f} KB)")
    print(f"  mes_recente: {mes_recente}")
    print(f"  IGP-M mensal: {igpm_m.get(mes_recente)} | 12m composto: {igpm_12m.get(mes_recente)}")
    for nome, sub in sub_paineis.items():
        print(f"  {nome}: mensal {sub['ultimo_mensal']} | 12m composto {sub['ultimo_12m']} | ano {sub['ultimo_ano']}")

    if erros:
        print(f"\n[VALIDACAO] {len(erros)} erro(s) — NAO publicar:", file=sys.stderr)
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
        print("[upload] SKIP")


def valida_schema_v3(out: dict, release: dict) -> list[str]:
    """Asserts dos blocos v3 + release (falhou, não publica)."""
    erros: list[str] = []
    print("\n== Validacoes (schema v3) ==")
    mom = (out.get("momentum") or {}).get("series") or {}
    for sid in ("IGP-M", "IPA-M", "IPC-M", "INCC-M"):
        pts = mom.get(sid) or []
        if not pts:
            erros.append(f"momentum.{sid} vazio")
            continue
        if sid in MOMENTUM_DESSAZ and not pts[-1].get("dessaz"):
            erros.append(f"momentum.{sid} deveria ser dessazonalizado")
        if sid in MOMENTUM_SEM_DESSAZ and pts[-1].get("dessaz"):
            erros.append(f"momentum.{sid} NAO deveria ser dessazonalizado (IPA sem sazonalidade estavel)")
        print(f"  [1] momentum.{sid}: {len(pts)} pontos | dessaz={pts[-1].get('dessaz')} | saar3={pts[-1].get('saar_3m')}")
    d12 = (out.get("decomposicao_12m") or {}).get("serie") or []
    if len(d12) < 48:
        erros.append(f"decomposicao_12m com {len(d12)} meses (<48)")
    else:
        u = d12[-1]
        fecho = sum(u[c] for c in PESOS_IGPM) + u["residuo"]
        print(f"  [2] decomp 12m ({u['mes']}): fecho {fecho:.4f} vs oficial {u['IGP-M 12m']:.4f} | residuo {u['residuo']:+.3f} p.p.")
        if abs(fecho - u["IGP-M 12m"]) > 0.005:
            erros.append("decomposicao_12m nao fecha com o IGP-M 12m")
    n_longa = len((out.get("serie_longa") or {}).get("serie") or [])
    print(f"  [3] serie_longa: {n_longa} meses | origem_ipa: {'publicada' if out.get('origem_ipa') else 'NAO publicada (identidade nao confirmada)'}")
    if n_longa < 300:
        erros.append(f"serie_longa com {n_longa} meses (<300)")
    ts = out.get("tabela_sintese") or {}
    n_comp = len(next((s["linhas"] for s in ts.get("secoes", []) if s["id"] == "componentes"), []))
    if n_comp < 3:
        erros.append(f"tabela_sintese.componentes com {n_comp} linhas (<3)")
    h = release.get("headline") or {}
    if h.get("var_mes") is None or h.get("acum_12m") is None:
        erros.append("release.headline incompleto")
    if len(release.get("componentes") or []) != 3:
        erros.append("release.componentes != 3")
    if (release.get("aluguel") or {}).get("aplicado_pct") is None:
        erros.append("release.aluguel sem aplicado_pct")
    if (release.get("expectativa_mes") or {}).get("mediana") is None:
        print("  [WARN] release sem expectativa da vespera (Olinda fora?) — publica com null", file=sys.stderr)
    print(f"  [4] release {release.get('mes_referencia')}: headline ok | aluguel {release['aluguel'].get('aplicado_pct')}%")

    # 6. contexto dos componentes: contagens minimas + frescor das fontes vivas
    ctx = out.get("contexto") or {}
    mes_ref = out["mes_recente"]
    for bloco, minimo in (("ipa_drivers", 100), ("ipc_medidas", 100), ("incc_contexto", 100)):
        serie = (ctx.get(bloco) or {}).get("serie") or []
        print(f"  [6] contexto.{bloco}: {len(serie)} meses")
        if len(serie) < minimo:
            erros.append(f"contexto.{bloco} com {len(serie)} meses (<{minimo})")
    u_ipa = ((ctx.get("ipa_drivers") or {}).get("serie") or [{}])[-1]
    if u_ipa.get("icbr_12m") is None:
        erros.append(f"contexto.ipa_drivers sem IC-Br 12m no mes recente ({u_ipa.get('mes')})")
    if u_ipa.get("cambio_12m") is None:
        erros.append(f"contexto.ipa_drivers sem cambio 12m no mes recente ({u_ipa.get('mes')})")
    u_ipc = ((ctx.get("ipc_medidas") or {}).get("serie") or [{}])[-1]
    if u_ipc.get("ipcbr_12m") is None or u_ipc.get("fipe_12m") is None:
        erros.append(f"contexto.ipc_medidas sem IPC-Br/Fipe no mes recente ({u_ipc.get('mes')})")
    u_incc = ((ctx.get("incc_contexto") or {}).get("serie") or [{}])[-1]
    if u_incc.get("inccdi_12m") is None:
        erros.append(f"contexto.incc_contexto sem INCC-DI no mes recente ({u_incc.get('mes')})")
    ivgr_u = (ctx.get("incc_contexto") or {}).get("ivgr_ultimo_mes")
    if ivgr_u is None or add_meses(mes_ref, -6) > ivgr_u:
        erros.append(f"contexto.incc_contexto: IVG-R velho demais ({ivgr_u} vs ref {mes_ref})")
    print(f"  [6] frescor: IC-Br/cambio no mes ref | IVG-R ate {ivgr_u} (tolerancia 6m)")

    if not erros:
        print("  OK — validacoes v3 passaram.")
    return erros


# ---------------------------------------------------------------------------
# Validações (princípio: falhou, não publica)
# ---------------------------------------------------------------------------
def valida_schema_v2(
    out: dict,
    igpm_12m: dict[str, float | None],
    ipca_m: dict[str, float | None],
    ipca_12m_oficial: dict[str, float | None],
    serie_decomp: list[dict],
) -> list[str]:
    """Asserts numéricos do schema v2. Retorna lista de erros (vazia = ok).

    1. Rotina de composição 12m validada no IPCA: rolling12(SGS 433) vs
       12m oficial (SGS 13522), tolerância 0,02 p.p. — prova a rotina contra
       uma série oficial de 12m que EXISTE no SGS.
    2. IGP-M 12m composto vs valores oficiais FGV publicados (spot-check,
       tolerância 0,05 p.p. — variações mensais com 2 casas acumulam
       arredondamento).
    3. Decomposição fecha (soma contribs + resíduo = IGP-M cheio) e o
       resíduo dos pesos efetivos é MENOR que o dos fixos 60/30/10.
    4. Correlação de antecipação calculada e impressa.
    5. Contagens mínimas por bloco.
    """
    erros: list[str] = []
    print("\n== Validacoes (schema v2) ==")

    # 1. rotina de composição validada no IPCA (433 composto vs 13522 oficial)
    meses_ipca = sorted(m for m, v in ipca_m.items() if v is not None)
    ipca_comp = rolling12(ipca_m, meses_ipca)
    difs_ipca = [
        abs(ipca_comp[m] - ipca_12m_oficial[m])
        for m in meses_ipca
        if m >= POS_REAL_INICIO
        and ipca_comp.get(m) is not None
        and ipca_12m_oficial.get(m) is not None
    ]
    if difs_ipca:
        print(
            f"  [1] rotina 12m no IPCA: composto(433) vs oficial(13522) "
            f"max dif pos-96 = {max(difs_ipca):.4f} p.p. (n={len(difs_ipca)})"
        )
        if max(difs_ipca) > 0.02:
            erros.append(f"rotina de composicao 12m diverge do IPCA oficial (max {max(difs_ipca):.4f})")
    else:
        erros.append("sem meses p/ validar a rotina 12m no IPCA")

    # 2. IGP-M 12m composto vs oficiais FGV publicados
    mes_u = out["mes_recente"]
    print(f"  [2] IGP-M 12m composto em {mes_u}: {igpm_12m.get(mes_u)}")
    for m, oficial in IGPM_12M_OFICIAL_CONHECIDO.items():
        calc = igpm_12m.get(m)
        if calc is None:
            erros.append(f"12m composto ausente em {m} (spot-check)")
            continue
        dif = abs(calc - oficial)
        print(f"  [2] spot-check {m}: composto {calc:.2f} vs oficial FGV {oficial:.2f} (dif {dif:.4f})")
        if dif > 0.05:
            erros.append(f"12m composto diverge do oficial FGV em {m} ({calc:.2f} vs {oficial:.2f})")

    # 2b. componentes vs release oficial FGV (trava a identificação dos códigos
    # SGS — o builder já publicou INCC como IPC por rótulo errado; nunca mais)
    for (comp, m), oficial in COMPONENTES_MENSAL_OFICIAL.items():
        calc = (out["componentes"].get(comp) or {}).get("serie_longa")
        v = None
        if calc:
            v = next((r["mensal"] for r in calc if r["mes"] == m), None)
        if v is None:
            print(f"  [2b] spot-check {comp} {m}: fora da janela publicada — pulado")
            continue
        dif = abs(v - oficial)
        print(f"  [2b] spot-check {comp} {m}: SGS {v:.2f} vs release FGV {oficial:.2f} (dif {dif:.4f})")
        if dif > 0.005:
            erros.append(f"{comp} em {m} diverge do release FGV ({v:.2f} vs {oficial:.2f}) — codigo SGS trocado?")

    # 3. decomposição: identidade contrib+resíduo = cheio e resíduo menor que o legado
    nomes = out["decomposicao"]["componentes"]
    mensais = {r["mes"]: r for r in out["analise"]["serie"]}  # ipa/ipc/incc mensais (120m)
    chave_analise = {"IPA-M": "ipa", "IPC-M": "ipc", "INCC-M": "incc"}
    max_fecho = 0.0
    residuos = []
    residuos_fixos = []
    for item in serie_decomp:
        soma = sum(item[f"{c} (contrib)"] for c in nomes) + item["residuo_pp"]
        max_fecho = max(max_fecho, abs(soma - item["IGP-M"]))
        residuos.append(abs(item["residuo_pp"]))
        row = mensais.get(item["mes"])
        if row is not None and all(row.get(chave_analise[c]) is not None for c in nomes):
            fixo = item["IGP-M"] - sum(
                (out["pesos"][c] / 100.0) * row[chave_analise[c]] for c in nomes
            )
            residuos_fixos.append(abs(fixo))
    u = serie_decomp[-1]
    partes = " + ".join(f"{c.split('-')[0]} {u[f'{c} (contrib)']:+.3f}" for c in nomes)
    print(
        f"  [3] decomposicao ({u['mes']}): {partes} + residuo {u['residuo_pp']:+.3f} "
        f"= {u['IGP-M']:.2f} | fecho max |soma-IGP-M| = {max_fecho:.6f}"
    )
    if residuos_fixos:
        print(
            f"  [3] residuo |medio| na janela de {len(serie_decomp)}m: "
            f"pesos efetivos {statistics.mean(residuos):.4f} p.p. vs fixos 60/30/10 "
            f"{statistics.mean(residuos_fixos):.4f} p.p. "
            f"(max: {max(residuos):.4f} vs {max(residuos_fixos):.4f})"
        )
        if statistics.mean(residuos) >= statistics.mean(residuos_fixos):
            erros.append("pesos efetivos nao reduziram o residuo medio vs pesos fixos")
    else:
        erros.append("sem meses p/ comparar residuo efetivo vs fixo")
    if max_fecho > 0.001:
        erros.append(f"decomposicao nao fecha com o IGP-M cheio (max dif {max_fecho:.4f} p.p.)")
    pesos_u = {c: u[f"{c} (peso efetivo)"] for c in nomes}
    soma_pesos = sum(pesos_u.values())
    print(f"  [3] pesos efetivos em {u['mes']}: {pesos_u} (soma = {soma_pesos:.2f}%)")
    if not 99.0 <= soma_pesos <= 101.0:
        erros.append(f"pesos efetivos somam {soma_pesos:.2f}% (esperado 100%)")

    # 4. correlação de antecipação (régua editorial do bloco "antecipa o IPCA?")
    ant = out["antecipacao"]
    print("  [4] correlacao IPA-M 12m x IPCA 12m (IPCA defasado em +k meses):")
    for l in ant["lags"]:
        print(
            f"      lag {l['lag']}m: pos-96 {l['corr_pos96']} (n={l['n_pos96']}) | "
            f"pos-2016 {l['corr_pos2016']} (n={l['n_pos2016']})"
        )
    print(f"      melhor lag pos-96: {ant['melhor_lag']}m (corr {ant['melhor_corr_pos96']})")
    if ant["melhor_corr_pos96"] is None:
        erros.append("correlacao de antecipacao nao calculada")

    # 5. contagens mínimas
    minimos = [
        ("decomposicao.serie", len(serie_decomp), 60),
        ("antecipacao.serie", len(ant["serie"]), 120),
        ("analise.serie", len(out["analise"]["serie"]), 120),
        ("comparativo_ipca", len(out["comparativo_ipca"]), 120),
        ("aluguel.reajustes", len(out["aluguel"]["reajustes"]), ALUGUEL_ANOS),
        ("overview.serie", len(out["overview"]["serie"]), 60),
    ]
    for nome, n, minimo in minimos:
        print(f"  [5] {nome}: {n} pontos (minimo {minimo})")
        if n < minimo:
            erros.append(f"{nome} com so {n} pontos (minimo {minimo})")

    # Conferências p/ leitura manual
    est12 = out["overview"]["estatisticas_12m"]
    print(
        f"  [conferencia] IGP-M 12m atual no historico pos-96: percentil {est12.get('percentil_atual')} "
        f"| media {est12.get('media')} | mediana {est12.get('mediana')} | % meses 12m<0: {est12.get('negativos_pct')}"
    )
    for nome in nomes:
        e12 = out["componentes"][nome].get("estatisticas_12m", {})
        print(
            f"  [conferencia] {nome} 12m: atual {out['componentes'][nome]['ultimo_12m']} "
            f"| percentil pos-96 {e12.get('percentil_atual')} | media {e12.get('media')}"
        )
    rj = out["aluguel"]["reajustes"]
    print(
        "  [conferencia] aluguel (mes ref. " + out["aluguel"]["mes_referencia"] + "): "
        + "; ".join(
            f"{r['ano']}: IGP-M {r['igpm_12m']}% vs IPCA {r['ipca_12m']}% (aplicado {r['aplicado_pct']}%)"
            for r in rj
        )
    )

    if not erros:
        print("  OK — todas as validacoes passaram.")
    return erros


if __name__ == "__main__":
    main()
