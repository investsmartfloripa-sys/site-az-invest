"""Build do JSON do Painel IGP-M.

Códigos SGS:
- 189   IGP-M variação mensal (fonte única do índice cheio)
- 7450  IPA-M cheio (peso de origem 60% do IGP-M)
- 7456  IPC-M cheio (30%)
- 7465  INCC-M cheio (10%)
- 433   IPCA mensal (referência cruzada)
- 13522 IPCA 12m (referência cruzada + validação da rotina de composição)

ATENÇÃO — SGS 192 APOSENTADO (2026-06): o builder v1 usava o código 192
rotulado como "IGP-M acumulado 12 meses", mas a série NÃO é isso (em
mai/2021 o 192 dá 2,22 quando o IGP-M 12m oficial era 37,04%; a série
começa em 1944, antes do IGP-M existir). O acumulado 12m do IGP-M passa a
ser COMPOSTO aqui das variações mensais oficiais (SGS 189) — exatamente a
convenção da FGV — e é validado por spot-check contra valores publicados
(dez/2020 23,14; mai/2021 37,04; dez/2023 −3,18...) e pela rotina de
composição aplicada ao IPCA (433 composto vs 13522 oficial).

schema_version 2 (2026-06): transformações canônicas calculadas AQUI, nunca
no front (PLANO-GRAFICOS-ECONOMIA-2026-06-11.md, área de inflação):

- `decomposicao`: contribuição mensal de cada componente com PESOS EFETIVOS
  ENCADEADOS (não os fixos 60/30/10, que deixavam resíduo invisível de
  0,24 p.p. já na leitura mensal de abr/26). O SGS não publica número-índice
  dos componentes FGV e o INCC-M só começa em jan/1997 (depois da base
  ago/1994 do IGP-M), então os pesos exatos são irreconstruíveis — método
  adotado (crítica do revisor): encadear os números-índice das variações a
  partir do 1º mês comum (jan/1997) com pesos de origem 60/30/10 e
  renormalizar mês a mês: w_c,t = 0,6·I_c,t−1 / Σ(w_c0·I_c,t−1). Sem
  parâmetro estimado (reproduzível build a build). O resíduo restante é
  ESTRUTURAL (base ago/1994 anterior ao INCC-M + janelas decendiais FGV) e
  fica em campo próprio (`residuo_pp`), nunca escondido nem realocado.
  Medido: resíduo |médio| 72m cai de 0,130 (fixos) p/ 0,075 p.p.; em
  abr/2026, de 0,243 p/ 0,028 p.p.
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

SCHEMA_VERSION = 2

PESOS_IGPM = {"IPA-M": 60.0, "IPC-M": 30.0, "INCC-M": 10.0}
CODIGOS_COMPONENTES = {"IPA-M": 7450, "IPC-M": 7456, "INCC-M": 7465}

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
    encadeamos as variações a partir do 1º mês comum (jan/1997, início do
    INCC-M) e renormalizamos mês a mês:

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

    print("== Componentes (7450/7456/7465) ==")
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

    out = {
        "schema_version": SCHEMA_VERSION,
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "mes_recente": mes_recente,
        "fontes": {
            "IGP-M mensal": 189,
            "IPA-M": 7450,
            "IPC-M": 7456,
            "INCC-M": 7465,
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
    }

    erros = valida_schema_v2(out, igpm_12m, ipca_m, ipca_12m, serie_decomp)

    out_file.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nJSON salvo em {out_file} ({out_file.stat().st_size/1024:.1f} KB)")
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
        except Exception as e:
            print(f"[upload] FALHOU: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        print("[upload] SKIP")


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
