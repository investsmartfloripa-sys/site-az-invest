"""Build do JSON do Painel Visão Geral — bloco ICF (Índice de Condições Financeiras próprio).

Combina 5 componentes padronizados (z-score sobre janela total disponível):
- Slope curva DI (10a - 1a) — sinal invertido (curva invertida ⇒ aperto)
- Selic real ex-ante (Selic - Focus IPCA 12m ahead) — sinal invertido
- EMBI+ Brasil (spread soberano) — sinal invertido
- Retorno 6m do Ibovespa — sinal positivo
- REER (câmbio efetivo real) — sinal positivo (REER alto ⇒ moeda forte ⇒ menos aperto)

Como nem todas as séries têm fonte estável aberta (EMBI+ tem rate limit),
o pipeline é tolerante: se algum componente faltar, recalcula sobre os
disponíveis e registra `n_componentes` no JSON. Para garantir robustez na
Onda 1, usamos majoritariamente BCB SGS:
  - Selic meta (432) menos Focus IPCA 12 meses à frente SUAVIZADA
    (Olinda `ExpectativasMercadoInflacao12Meses`, mediana com Suavizada='S').
    Fallback (só se Olinda falhar): Focus ano-calendário do JSON fiscal,
    depois IPCA realizado 12m (ex-post).
  - REER SGS 11752
  - Ibov via Yahoo ^BVSP mensal (SGS 7 descontinuado em 2019; SGS 24369 é
    PNAD desocupação, não Ibovespa)
  - Slope DI: lido do JSON do panorama (renda-fixa) se disponível;
    fallback: usar Selic real ex-ante e remover slope da composição.

INPUTS = max(start_date) dos componentes (~2003).
"""
from __future__ import annotations

import argparse
import json
import math
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

HERE = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/visao_geral_icf.json"
UA = {"User-Agent": "Mozilla/5.0", "Accept": "*/*"}

SGS_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{cod}/dados?formato=json&dataInicial={ini}"

# Códigos SGS (mensais — buscados em request único)
SERIES = {
    "selic_efetiva": 4189,    # Selic efetiva acumulada no mês anualizada (fallback da meta)
    "reer": 11752,            # Câmbio efetivo real (índice)
    "ipca_12m": 13522,        # IPCA acumulado 12m (último fallback do Focus 12m)
}

# Selic meta (432) é DIÁRIA: o SGS limita janela a 10 anos por request (HTTP 406)
# — baixar em blocos.
SERIE_SELIC_META = 432

# Ibovespa: SGS 7 foi descontinuado em set/2019 e SGS 24369 NÃO é Ibovespa
# (é PNAD-C desocupação). Fonte: Yahoo ^BVSP mensal — mesmo endpoint usado em
# build_visao_geral_probit_az.py.
YAHOO_BVSP_URL = "https://query1.finance.yahoo.com/v8/finance/chart/%5EBVSP?range=max&interval=1mo"

INPUTS = {
    "selic_meta": "1999-03",
    "reer": "1994-07",
    "ibov": "1993-05",
    "focus_ipca_12m": "2001-11",
}

# Focus IPCA 12 meses à frente, mediana SUAVIZADA — mesmo endpoint Olinda
# usado em build_visao_geral_probit_az.py (ExpectativasMercadoInflacao12Meses).
OLINDA_IPCA_12M_URL = (
    "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/"
    "ExpectativasMercadoInflacao12Meses"
    "?$filter=Indicador%20eq%20%27IPCA%27%20and%20Suavizada%20eq%20%27S%27"
    "%20and%20baseCalculo%20eq%200"
    "&$select=Data,Mediana&$format=json&$top=30000"
)


def _get(url: str, *, timeout: int = 60, retries: int = 3, sleep: float = 3.0) -> requests.Response:
    last: Exception | None = None
    for i in range(retries):
        try:
            r = requests.get(url, timeout=timeout, headers=UA)
            r.raise_for_status()
            return r
        except Exception as e:
            last = e
            time.sleep(sleep)
    raise RuntimeError(f"falha: {last}")


def _parse_sgs_date(s: str) -> str:
    parts = s.split("/")
    if len(parts) == 3:
        return f"{parts[2]}-{parts[1]}"  # mensal: dd/mm/yyyy -> yyyy-mm
    return s


def sgs_mensal(cod: int, ini: str = "01/01/2000", fim: str | None = None) -> dict[str, float]:
    url = SGS_URL.format(cod=cod, ini=ini)
    if fim:
        url += f"&dataFinal={fim}"
    data = None
    last: Exception | None = None
    for _ in range(3):  # SGS às vezes devolve 200 com corpo não-JSON sob throttle
        try:
            r = _get(url)
            data = r.json()
            break
        except Exception as e:
            last = e
            time.sleep(5)
    if data is None:
        raise RuntimeError(f"SGS {cod}: {last}")
    out: dict[str, float] = {}
    for row in data:
        m = _parse_sgs_date(row["data"])
        try:
            out[m] = float(row["valor"])
        except (TypeError, ValueError):
            continue
    return out


def sgs_mensal_diaria_chunked(cod: int, ano_inicio: int = 2000) -> dict[str, float]:
    """Série DIÁRIA do SGS em blocos de ≤10 anos (janela maior devolve HTTP 406).

    Agrega para mensal mantendo o último valor de cada mês.
    """
    out: dict[str, float] = {}
    ano_fim_total = datetime.now(timezone.utc).year
    ano = ano_inicio
    while ano <= ano_fim_total:
        fim = min(ano + 8, ano_fim_total)
        out.update(sgs_mensal(cod, ini=f"01/01/{ano}", fim=f"31/12/{fim}"))
        ano = fim + 1
        time.sleep(0.5)
    return out


def carregar_ibov_yahoo() -> dict[str, float]:
    """Ibovespa fechamento mensal via Yahoo Finance (^BVSP)."""
    r = _get(YAHOO_BVSP_URL)
    d = r.json().get("chart", {}).get("result", [{}])[0]
    ts = d.get("timestamp", [])
    cl = d.get("indicators", {}).get("quote", [{}])[0].get("close", [])
    out: dict[str, float] = {}
    for t, v in zip(ts, cl):
        if v is None:
            continue
        out[datetime.fromtimestamp(t, tz=timezone.utc).strftime("%Y-%m")] = float(v)
    return out


def carregar_focus_ipca_12m_olinda() -> dict[str, float] | None:
    """Expectativa Focus IPCA 12 meses à frente (mediana suavizada) via Olinda.

    Endpoint `ExpectativasMercadoInflacao12Meses` com Suavizada='S' e
    baseCalculo=0 — verdadeira expectativa ex-ante 12m, em vez do Focus do
    ano-calendário. Agrega usando a última observação diária de cada mês.
    Retorna None se a chamada falhar ou vier curta demais.
    """
    try:
        r = _get(OLINDA_IPCA_12M_URL, timeout=90)
        data = r.json().get("value", [])
    except Exception as e:
        print(f"  [WARN] Olinda Focus IPCA 12m falhou: {e}", file=sys.stderr)
        return None
    por_mes: dict[str, tuple[str, float]] = {}
    for p in data:
        try:
            d = str(p["Data"])[:10]
            v = float(p["Mediana"])
        except (KeyError, TypeError, ValueError):
            continue
        mes = d[:7]
        prev = por_mes.get(mes)
        if prev is None or d > prev[0]:
            por_mes[mes] = (d, v)
    if len(por_mes) < 24:
        print(f"  [WARN] Olinda Focus IPCA 12m retornou poucas obs ({len(por_mes)})", file=sys.stderr)
        return None
    return {m: v for m, (_, v) in sorted(por_mes.items())}


def carregar_focus_ipca_12m_se_disponivel() -> dict[str, float] | None:
    """FALLBACK legado: Focus do ano-calendário no JSON fiscal (frequentemente ex-post)."""
    sys.path.insert(0, str(HERE))
    from shared.blob_download import download_json

    payload = download_json("data/fiscal-classicos.json")
    if not payload:
        return None
    # Focus está agregado por ano; 12m ahead requer interpolar. Aproximação:
    # usar mediana do ano corrente para todos os meses do ano (suficiente pra ICF mensal).
    try:
        focus = payload.get("expectativas_focus", {}).get("ipca_anuais", {})
        if not focus:
            return None
        out: dict[str, float] = {}
        for ano_str, pontos in focus.items():
            for ponto in pontos:
                data = ponto.get("data", "")
                mediana = ponto.get("mediana")
                if data and mediana is not None and ano_str in data:
                    out[data[:7]] = float(mediana)
        return out
    except Exception:
        return None


def z_score(serie: list[float | None]) -> list[float | None]:
    vals = [v for v in serie if v is not None]
    if len(vals) < 12:
        return [None] * len(serie)
    media = sum(vals) / len(vals)
    var = sum((v - media) ** 2 for v in vals) / len(vals)
    sd = math.sqrt(var) if var > 0 else 1.0
    return [((v - media) / sd) if v is not None else None for v in serie]


def variacao_6m(serie: dict[str, float]) -> dict[str, float]:
    meses = sorted(serie.keys())
    out: dict[str, float] = {}
    for i, m in enumerate(meses):
        if i < 6:
            continue
        prev = serie.get(meses[i - 6])
        cur = serie.get(m)
        if cur and prev and prev > 0:
            out[m] = (cur / prev - 1) * 100
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description="Build do JSON Painel Visão Geral — ICF próprio")
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--soft-fail", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "visao_geral_icf.json"

    print("== ICF próprio (5 componentes) ==")

    series: dict[str, dict[str, float]] = {}
    for key, cod in SERIES.items():
        try:
            series[key] = sgs_mensal(cod)
            print(f"  [SGS {cod}] {len(series[key])} obs")
            time.sleep(0.5)
        except Exception as e:
            print(f"  FALHA {key}: {e}", file=sys.stderr)
            series[key] = {}

    try:
        series["selic_meta"] = sgs_mensal_diaria_chunked(SERIE_SELIC_META)
        print(f"  [SGS {SERIE_SELIC_META} em blocos] {len(series['selic_meta'])} obs")
    except Exception as e:
        print(f"  FALHA selic_meta: {e} — usando Selic efetiva (4189)", file=sys.stderr)
        series["selic_meta"] = {}

    try:
        series["ibov"] = carregar_ibov_yahoo()
        print(f"  [Yahoo ^BVSP] {len(series['ibov'])} obs")
    except Exception as e:
        print(f"  [WARN] Ibov Yahoo falhou: {e} — componente Ibov fora desta build", file=sys.stderr)
        series["ibov"] = {}

    # Fonte primária: Olinda — Focus IPCA 12 meses à frente, mediana suavizada (ex-ante de verdade).
    focus_12m = carregar_focus_ipca_12m_olinda()
    fonte_focus = "olinda_focus_ipca_12m_suavizada"
    if focus_12m:
        print(f"  [Focus IPCA 12m Olinda suavizada] {len(focus_12m)} meses")
    else:
        print("  [WARN] Olinda indisponível — fallback para método legado (Focus ano-calendário / IPCA realizado)", file=sys.stderr)
        focus_12m = carregar_focus_ipca_12m_se_disponivel()
        if focus_12m and len(focus_12m) >= 24:
            fonte_focus = "fallback_focus_ano_calendario"
            print(f"  [Focus IPCA ano-calendário] {len(focus_12m)} obs (do JSON fiscal)")
        else:
            if focus_12m:
                print(f"  [WARN] Focus ano-calendário com apenas {len(focus_12m)} obs (esparso), usando IPCA realizado 12m como proxy", file=sys.stderr)
            else:
                print("  [WARN] Focus ano-calendário indisponível, usando IPCA realizado 12m como proxy (EX-POST)", file=sys.stderr)
            focus_12m = None
            fonte_focus = "fallback_ipca_realizado_12m"

    # Selic real ex-ante: usa selic_meta se OK, fallback para selic_efetiva (4189)
    selic = series.get("selic_meta", {}) or series.get("selic_efetiva", {})
    ipca_proxy = focus_12m or series.get("ipca_12m", {})
    todos_meses = sorted(set(selic.keys()) & set(ipca_proxy.keys()))
    selic_real_ex_ante = {m: selic[m] - ipca_proxy[m] for m in todos_meses}

    # Ibov retorno 6m
    ibov_var_6m = variacao_6m(series.get("ibov", {}))

    # Constrói grid mensal usando interseção das séries críticas (Selic real + REER são essenciais)
    reer = series.get("reer", {})
    meses_finais = sorted(set(selic_real_ex_ante.keys()) & set(reer.keys()))

    if not meses_finais:
        print("  insuficiente para calcular ICF", file=sys.stderr)
        payload = {"gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"), "freshness_status": "missing", "serie": []}
        out_file.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
        if args.soft_fail:
            return
        sys.exit(2)

    selic_real_list = [selic_real_ex_ante.get(m) for m in meses_finais]
    ibov_var_list = [ibov_var_6m.get(m) for m in meses_finais]
    reer_list = [reer.get(m) for m in meses_finais]

    # z-scores
    z_selic_real = z_score(selic_real_list)
    z_ibov = z_score(ibov_var_list)
    z_reer = z_score(reer_list)

    # ICF = média dos z-scores com sinais convencionados:
    #   selic_real_ex_ante: aperto ↑ ⇒ inverter sinal
    #   ibov_6m: positivo ⇒ estímulo
    #   reer: alto ⇒ estímulo
    # Para componentes ausentes, peso adapta.
    serie_out: list[dict[str, Any]] = []
    for i, mes in enumerate(meses_finais):
        comps: list[tuple[str, float]] = []
        if z_selic_real[i] is not None:
            comps.append(("selic_real", -z_selic_real[i]))
        if z_ibov[i] is not None:
            comps.append(("ibov_6m", z_ibov[i]))
        if z_reer[i] is not None:
            comps.append(("reer", z_reer[i]))
        if not comps:
            continue
        # Pesos: Selic real ex-ante 50%, Ibov 6m 25%, REER 25%.
        # Pesos ad-hoc calibrados pela maior sensibilidade da economia BR a taxa real
        # (canal de credito dominante). Hatzius et al 2010 (NBER WP 16150) usa PCA;
        # aqui simplificamos. Ref: BCB WP 305 (Pereira da Silva 2014) sobre FCI Brasil.
        PESOS = {"selic_real": 0.50, "ibov_6m": 0.25, "reer": 0.25}
        soma_p = 0
        soma_v = 0
        for nome, v in comps:
            p = PESOS.get(nome, 1/len(comps))
            soma_v += v * p
            soma_p += p
        icf = soma_v / soma_p if soma_p > 0 else 0
        regime = "estimulativo" if icf > 1 else ("restritivo" if icf < -1 else "neutro")
        serie_out.append(
            {
                "mes": mes,
                "icf_zscore": round(icf, 3),
                "regime": regime,
                "n_componentes": len(comps),
                "z_selic_real_invertido": round(-z_selic_real[i], 3) if z_selic_real[i] is not None else None,
                "z_ibov_6m": round(z_ibov[i], 3) if z_ibov[i] is not None else None,
                "z_reer": round(z_reer[i], 3) if z_reer[i] is not None else None,
                "selic_real_ex_ante_pct": round(selic_real_ex_ante.get(mes), 2) if selic_real_ex_ante.get(mes) is not None else None,
            }
        )

    payload = {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "schema_version": 2,
        "freshness_status": "fresh",
        "mes_recente": serie_out[-1]["mes"] if serie_out else None,
        "serie": serie_out,
        "inputs": INPUTS,
        "min_start_date": max(INPUTS.values()),
        "metadata": {
            "fonte": "Cálculo próprio. Componentes: Selic meta (SGS 432, diária em blocos; fallback Selic efetiva 4189) menos expectativa Focus IPCA 12 meses à frente suavizada (Olinda ExpectativasMercadoInflacao12Meses, mediana), retorno 6m do Ibovespa mensal (Yahoo ^BVSP — SGS 7 descontinuado), REER (SGS 11752). Fallback do Focus (só se Olinda falhar): Focus ano-calendário do JSON fiscal e, em último caso, IPCA realizado 12m (SGS 13522, ex-post). EMBI+ e slope DI ficam para v2 (sem fontes públicas estáveis no momento).",
            "fonte_focus_ipca": fonte_focus,
            "nota": "ICF é a média ponderada dos z-scores dos componentes (Selic real ex-ante 50%, Ibov 6m 25%, REER 25%). Regime: z > 1 = estimulativo; z < -1 = restritivo. Quanto mais componentes, mais robusto.",
        },
    }
    out_file.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"JSON {out_file} ({out_file.stat().st_size / 1024:.1f} KB) — {len(serie_out)} pontos")

    if args.upload:
        sys.path.insert(0, str(HERE))
        from shared.blob_upload import maybe_upload_json
        try:
            maybe_upload_json(out_file, BLOB_PATH)
        except Exception as e:
            print(f"[upload] FALHOU: {e}", file=sys.stderr)
            if not args.soft_fail:
                sys.exit(1)


if __name__ == "__main__":
    main()
