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

SCHEMA_VERSION = 2

#: Janela da âncora (meses pedidos à SIDRA). 72 é o teto prático: a tabela
#: 7060 (POF 2020) começa em jan/2020 — em meados de 2026 há ~77 meses.
ANCORA_MESES = 72

#: Núcleos que entram na "média dos núcleos" (convenção de comunicação do
#: BCB: 5 medidas; MA fica de fora por ser a versão não suavizada da MS).
NUCLEOS_MEDIA = ("EX0", "EX3", "MS", "DP", "P")

#: Início da janela de referência da difusão (regime de metas maduro; a
#: série SGS 21379 começa em 1991 contaminada pela hiperinflação).
DIFUSAO_REF_INICIO = "2012-01"


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


# ---------------------------------------------------------------------------
# Maiores influencias do mes (subitens)
# ---------------------------------------------------------------------------
def maiores_influencias(tabela: int, mes_ref: str, var_mensal: str, var_peso: str) -> list[dict]:
    path = f"/n1/all/v/{var_mensal},{var_peso}/p/{mes_ref.replace('-', '')}/c315/all/d/v{var_mensal}%202,v{var_peso}%202"
    rows = sidra_fetch(tabela, path)
    col_var = "Variável (Código)"
    col_grupo = "Geral, grupo, subgrupo, item e subitem"
    sub_var: dict[str, float] = {}
    sub_peso: dict[str, float] = {}
    for r in rows:
        nome = r[col_grupo]
        if not re.match(r"^\d{7}\.", nome):  # só subitens
            continue
        v = _to_float(r["Valor"])
        if v is None:
            continue
        if r[col_var] == var_mensal:
            sub_var[nome] = v
        elif r[col_var] == var_peso:
            sub_peso[nome] = v

    def _limpa(n: str) -> str:
        return re.sub(r"^\d{7}\.", "", n).strip()

    contrib = []
    for nome, v in sub_var.items():
        p = sub_peso.get(nome)
        if p is None:
            continue
        c = v * p / 100.0
        contrib.append({"subitem": _limpa(nome), "var": v, "peso": p, "contrib_pp": round(c, 4)})
    contrib.sort(key=lambda x: x["contrib_pp"], reverse=True)
    return contrib


# ---------------------------------------------------------------------------
# Validações (princípio: falhou, não publica)
# ---------------------------------------------------------------------------
def valida_schema_v2(out: dict, ipca_mensal_sgs: dict[str, float | None]) -> list[str]:
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

    # 2. composto 12m do SGS 433 vs oficiais (13522 e v2265)
    try:
        oficial_12m = sgs_fetch(13522)
    except Exception as e:  # noqa: BLE001
        oficial_12m = {}
        print(f"  [2] [WARN] SGS 13522 indisponível ({e}) — crosscheck só com v2265", file=sys.stderr)
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

    if not erros:
        print("  OK — todas as validações passaram.")
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

    print("== Sazonalidade (IPCA cheio, SGS 433) ==")
    ano_recente = int(ipca_cheio["mes_recente"][:4])
    saz_fim = ano_recente - 1
    saz_ini = saz_fim - 9
    sazonalidade = {
        "janela": f"{saz_ini}-{saz_fim}",
        "por_mes": sazonalidade_mensal(nuc_data["IPCA cheio"], saz_ini, saz_fim),
    }
    print(f"  janela {sazonalidade['janela']}")

    print("== Focus anuais ==")
    ano_atual = int(ipca_cheio["mes_recente"][:4])
    try:
        focus = focus_anuais(ano_atual)
        print(f"  Anos: {sorted(focus.keys())} | pontos por ano: {[len(focus[a]) for a in sorted(focus.keys())]}")
    except Exception as e:
        print(f"  [WARN] Focus indisponivel ({e}). Tentando fallback do Blob anterior.", file=sys.stderr)
        focus = {}
        # Merge incremental: se Focus falhar, preserva dados do build anterior
        try:
            sys.path.insert(0, str(HERE))
            from shared.blob_download import download_json  # noqa: E402
            prev = download_json(BLOB_PATH)
            if prev and isinstance(prev, dict) and prev.get("focus"):
                focus = prev["focus"]
                print(f"  [WARN] Usando Focus do run anterior (gerado_em {prev.get('gerado_em')}).", file=sys.stderr)
        except Exception as e2:
            print(f"  [WARN] Fallback do Blob falhou ({e2}). Focus fica vazio.", file=sys.stderr)

    print("== Maiores influências do mês ==")
    inf = maiores_influencias(7060, ipca_cheio["mes_recente"], "63", "66")
    top_altas = inf[:10]
    top_quedas = inf[-10:][::-1]
    if top_altas:
        print(f"  {len(inf)} subitens; top alta: {top_altas[0]['subitem']} ({top_altas[0]['contrib_pp']} p.p.)")
    else:
        print("  [WARN] SIDRA sem subitens para o mês — maiores_influencias publicado com listas vazias", file=sys.stderr)

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
    }

    erros = valida_schema_v2(out, nuc_data["IPCA cheio"])

    out_file.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    size_kb = out_file.stat().st_size / 1024
    print(f"\nJSON salvo em {out_file} ({size_kb:.1f} KB)")

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
        except Exception as e:
            print(f"[upload] FALHOU: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        print("[upload] SKIP (use --upload pra subir pro Blob)")


if __name__ == "__main__":
    main()
