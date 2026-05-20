"""Build do JSON do Termômetro Fiscal — 18 indicadores adaptados de Ray Dalio.

Lê fiscal-classicos.json (local ou do Blob), busca extras (FRED spread soberano, BCB
séries de dívida externa), calcula 18 indicadores Big Debt Cycle adaptados ao Brasil
com thresholds verde/amarelo/vermelho/break e gera score consolidado.

Output: data-pipeline/out/fiscal-termometro.json + upload pro Blob em data/fiscal-termometro.json.
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
sys.path.insert(0, str(HERE))
from shared.blob_upload import maybe_upload_json  # noqa: E402
from shared.blob_download import download_json  # noqa: E402

DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/fiscal-termometro.json"

UA = {"User-Agent": "Mozilla/5.0 (compatible; az-invest-termometro/0.1)"}


def _get(url, *, timeout=60, retries=3, sleep=4.0):
    last = None
    for i in range(retries):
        try:
            r = requests.get(url, timeout=timeout, headers=UA)
            if r.status_code in (406, 429, 502, 503, 504):
                time.sleep((i + 1) * sleep)
                continue
            r.raise_for_status()
            return r
        except Exception as e:
            last = e
            time.sleep((i + 1) * 2)
    raise RuntimeError(f"falha após {retries}: {last}")


def _to_float(v):
    if v in ("", "-", "..", "...", None):
        return None
    try:
        return float(str(v).replace(",", "."))
    except (TypeError, ValueError):
        return None


def _parse_sgs(s, daily=False):
    d, m, y = s.split("/")
    return f"{y}-{m}-{d}" if daily else f"{y}-{m}"


def sgs_fetch(cod, daily=False, since=None):
    url = f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{cod}/dados?formato=json"
    if since:
        url += f"&dataInicial={since}"
    print(f"  [SGS {cod}]")
    try:
        data = _get(url).json()
    except Exception as e:
        print(f"  [SGS {cod}] FALHA: {e}", file=sys.stderr)
        return []
    out = []
    for r in data:
        try:
            out.append({"data": _parse_sgs(r["data"], daily), "valor": _to_float(r["valor"])})
        except Exception:
            continue
    return out


def fred_csv(series_id, since="2010-01-01"):
    """FRED CSV (sem API key). Retorna lista [{data, valor}]."""
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}&cosd={since}"
    print(f"  [FRED {series_id}]")
    try:
        r = _get(url, timeout=30)
    except Exception as e:
        print(f"  [FRED {series_id}] FALHA: {e}", file=sys.stderr)
        return []
    lines = r.text.strip().split("\n")
    if len(lines) < 2:
        return []
    out = []
    for line in lines[1:]:
        parts = line.split(",")
        if len(parts) < 2:
            continue
        d = parts[0]
        v = _to_float(parts[1])
        out.append({"data": d, "valor": v})
    return out


# ---------------------------------------------------------------------------
# Thresholds Dalio adaptados ao Brasil — verde/amarelo/vermelho/break
# Cada item: cutoff_verde, cutoff_amarelo, cutoff_vermelho, cutoff_break.
# Convenção: se cutoff_verde < cutoff_break → indicador "mais é pior" (ex: dívida).
#            se cutoff_verde > cutoff_break → indicador "mais é melhor" (ex: reservas).
# ---------------------------------------------------------------------------
THRESHOLDS = {
    # === A. Carga de dívida ===
    "dbgg_pct": {
        "titulo": "Dívida bruta governo geral / PIB",
        "fonte": "BCB SGS 13762",
        "categoria": "Carga de dívida",
        "verde": 60.0, "amarelo": 80.0, "vermelho": 100.0, "break": 130.0,
        "direcao": "maior_pior",
        "marcos": "Reino Unido 1976: ~55% (bailout do FMI). Japão pós-90: cresceu de 70% → 260% em 30 anos. Argentina 2001 default: 50%. EUA 2024: 123%.",
        "narrativa": "Estoque de dívida do governo geral em % do PIB. Métrica mais clássica. Dalio observa que 100% é a 'zona de atenção': país ainda funciona, mas qualquer choque (recessão, juros, câmbio) leva à crise. Acima de 130%, só países com superpoder monetário (EUA, Japão) sobrevivem.",
    },
    "divida_total_economia_pct": {
        "titulo": "Dívida total da economia (gov+empresas+famílias) / PIB",
        "fonte": "BIS Total Credit + BCB",
        "categoria": "Carga de dívida",
        "verde": 150.0, "amarelo": 250.0, "vermelho": 350.0, "break": 400.0,
        "direcao": "maior_pior",
        "marcos": "China 2024: ~300%. EUA 2024: 250%. Japão pós-bolha: 400%. Brasil ainda relativamente baixo.",
        "narrativa": "Endividamento total da economia (não só governo). Quando passa de 250%, há risco sistêmico: queda de juros pra refinanciar contaminam todos os setores, inflação se torna inevitável.",
    },
    "divida_externa_pct": {
        "titulo": "Dívida externa total / PIB",
        "fonte": "BCB Estatísticas Externas",
        "categoria": "Carga de dívida",
        "verde": 20.0, "amarelo": 40.0, "vermelho": 60.0, "break": 80.0,
        "direcao": "maior_pior",
        "marcos": "Argentina 2001 default: 50%. Turquia 2018 crise: 53%. Brasil 2002: 41%. Atualmente ~30%.",
        "narrativa": "Dívida em moeda estrangeira é o calcanhar de Aquiles dos emergentes. Sem capacidade de imprimir dólares, qualquer choque cambial dobra o serviço da dívida em moeda local.",
    },
    "divida_ext_cp_reservas_pct": {
        "titulo": "Dívida externa curto prazo / Reservas",
        "fonte": "BCB",
        "categoria": "Carga de dívida",
        "verde": 25.0, "amarelo": 50.0, "vermelho": 100.0, "break": 200.0,
        "direcao": "maior_pior",
        "marcos": "México 1994 crise tequila: 280%. Tailândia 1997: 145%. Argentina 2001: 130%. Brasil 2002: 120%.",
        "narrativa": "Indicador clássico de Guidotti-Greenspan. Se as reservas não cobrem a dívida externa de curto prazo, o país não tem munição pra uma fuga de capitais. Brasil hoje confortável: reservas > 5x dívida externa CP.",
    },
    # === B. Capacidade de pagamento ===
    "juros_pct_pib": {
        "titulo": "Despesa com juros nominais / PIB",
        "fonte": "BCB SGS 5718",
        "categoria": "Capacidade de pagamento",
        "verde": 3.0, "amarelo": 5.0, "vermelho": 7.0, "break": 10.0,
        "direcao": "maior_pior",
        "marcos": "Reino Unido 1976: 4.5% (já apertou). Itália 1992: 12% (forçou disciplina). EUA 1980s (Volcker): 5%. Brasil 2024-25: 8-9% (zona vermelha).",
        "narrativa": "Quanto da economia evapora pagando juros. Quando passa de 7%, o orçamento fiscal vira refém da política monetária — qualquer alta de juros faz despesa primária ser cortada pra rolar dívida.",
    },
    "juros_pct_receita": {
        "titulo": "Despesa com juros / Receita líquida do governo",
        "fonte": "BCB + Tesouro",
        "categoria": "Capacidade de pagamento",
        "verde": 10.0, "amarelo": 20.0, "vermelho": 30.0, "break": 40.0,
        "direcao": "maior_pior",
        "marcos": "Ponto de inflexão Dalio: 25-30% é onde 'mercados começam a duvidar'. Argentina 2000: 35%. Itália anos 90: 30%. Reino Unido 1976: 28%.",
        "narrativa": "Métrica favorita do Dalio. Quanto da arrecadação some pagando juros antes de qualquer serviço público. Acima de 30%, governo perde grau de liberdade fiscal.",
    },
    "primario_estabiliza_dbgg": {
        "titulo": "Primário necessário pra estabilizar dívida (r-g)",
        "fonte": "Cálculo: DBGG × (r-g)",
        "categoria": "Capacidade de pagamento",
        "verde": 0.5, "amarelo": 2.0, "vermelho": 4.0, "break": 6.0,
        "direcao": "maior_pior",
        "marcos": "Fórmula Blanchard. Brasil atual: 80% × (10% - 2%) / 1.02 ≈ 6.3% PIB de superávit primário necessário. Realizado: -1.5%. Gap fiscal de ~8pp PIB.",
        "narrativa": "Quanto o governo precisaria arrancar em superávit primário pra dívida parar de crescer. Quando a taxa real de juros (r) supera o crescimento real (g), a dívida cresce sozinha — só fôlego primário interrompe.",
    },
    # === C. Estrutura da dívida ===
    "rolagem_12m_pct": {
        "titulo": "% da dívida vencendo em 12 meses",
        "fonte": "Tesouro Nacional RMD",
        "categoria": "Estrutura da dívida",
        "verde": 15.0, "amarelo": 25.0, "vermelho": 35.0, "break": 45.0,
        "direcao": "maior_pior",
        "marcos": "México 1994: 28% maturity wall. Argentina 2001: 40%. Brasil 2024: ~20%. Itália pós-2010: 14%.",
        "narrativa": "Quanto da dívida o governo precisa rolar nos próximos 12 meses. Alto = vulnerável a choques de juros e prêmio de risco.",
    },
    "prazo_medio_anos": {
        "titulo": "Prazo médio da dívida pública federal (anos)",
        "fonte": "Tesouro RMD",
        "categoria": "Estrutura da dívida",
        "verde": 5.0, "amarelo": 3.5, "vermelho": 2.5, "break": 1.5,
        "direcao": "maior_melhor",
        "marcos": "Reino Unido (gilts): 15 anos. EUA Treasuries: 6 anos. Brasil 2024: ~4 anos. Argentina pré-default: 1.8 anos.",
        "narrativa": "Quanto mais longo o prazo, menos sensível a choques de juros. Brasil melhorou desde 1999 (1.7 anos) mas ainda curto em padrões globais.",
    },
    "pct_indexado_selic_cambio": {
        "titulo": "% da dívida em Selic + câmbio (componentes voláteis)",
        "fonte": "Tesouro RMD composição",
        "categoria": "Estrutura da dívida",
        "verde": 20.0, "amarelo": 40.0, "vermelho": 55.0, "break": 70.0,
        "direcao": "maior_pior",
        "marcos": "Brasil 2002 (pré-tripé): 70% Selic + 30% câmbio. Brasil 2024: 47% Selic + 4% câmbio. EUA: 0%.",
        "narrativa": "Dívida em Selic transmite imediatamente alta de juros pro custo da dívida. Dívida em câmbio explode em desvalorizações. Pré-fixado e IPCA+ amortecem.",
    },
    # === D. Quem detém a dívida ===
    "pct_nao_residentes": {
        "titulo": "% da dívida detida por não-residentes",
        "fonte": "Tesouro DPMFi detentores",
        "categoria": "Detentores",
        "verde": 15.0, "amarelo": 25.0, "vermelho": 35.0, "break": 50.0,
        "direcao": "maior_pior",
        "marcos": "Brasil 2024: ~10%. Turquia pré-2018: 25%. Hungria pré-2008: 40%. Argentina pré-2001: 60%. Japão: 14%.",
        "narrativa": "Quanto mais estrangeiros segurando, mais vulnerável a sudden stop. Pelo lado bom: diversificação da base de financiamento. Brasil tem nível confortável.",
    },
    "pct_bc": {
        "titulo": "% da dívida detida pelo Banco Central (monetização)",
        "fonte": "BCB",
        "categoria": "Detentores",
        "verde": 5.0, "amarelo": 15.0, "vermelho": 30.0, "break": 50.0,
        "direcao": "maior_pior",
        "marcos": "Japão BoJ 2024: 53% (zona break). EUA Fed pós-QE: 22%. Reino Unido BoE: 30%. Brasil BCB: ~5% (compromissadas são outro mecanismo).",
        "narrativa": "BC comprando dívida do Tesouro = monetização. Sinaliza que mercado não absorve, governo imprime moeda pra pagar. Histórico de hiperinflação.",
    },
    # === E. Sinais de stress ===
    "reer_index": {
        "titulo": "Câmbio real efetivo (REER)",
        "fonte": "BCB SGS 11752",
        "categoria": "Sinais de stress",
        "verde": 110.0, "amarelo": 100.0, "vermelho": 90.0, "break": 80.0,
        "direcao": "maior_melhor",
        "marcos": "Brasil 2011 (forte): 130. 2020 (fraco): 90. 2024: ~115. Argentina pré-2001: queda de 100 → 50.",
        "narrativa": "Quando residentes e estrangeiros perdem confiança, vendem a moeda. Queda persistente do REER é sinal precoce de crise fiscal/cambial — antes mesmo dos números oficiais piorarem.",
    },
    "spread_soberano_bps": {
        "titulo": "Spread soberano (EMBI proxy, bps)",
        "fonte": "FRED BAMLEMRECRPIBRRACRPIUSOAS",
        "categoria": "Sinais de stress",
        "verde": 200.0, "amarelo": 350.0, "vermelho": 500.0, "break": 800.0,
        "direcao": "maior_pior",
        "marcos": "Brasil 2002 (eleição Lula): 2400 bps. 2016 (impeachment): 540 bps. 2024: 200-250 bps. Argentina 2001: 5000 bps. Grécia 2012: 3000 bps.",
        "narrativa": "Quanto o mercado cobra a mais que o Treasury americano pra emprestar pro Brasil. É o termômetro do mercado em tempo real — precede os indicadores oficiais.",
    },
    "r_menos_g": {
        "titulo": "Taxa real ex-post − Crescimento real (r − g)",
        "fonte": "Selic real ex-post − PIB real YoY",
        "categoria": "Sinais de stress",
        "verde": 0.0, "amarelo": 2.0, "vermelho": 4.0, "break": 6.0,
        "direcao": "maior_pior",
        "marcos": "EUA pós-2008 (QE): -2% (favorável). Brasil 2024: ~8% (severo). Itália anos 90: 5%. Equilíbrio de Domar: r = g.",
        "narrativa": "Quando juros real supera crescimento, a dívida cresce automaticamente mesmo com primário neutro. Brasil atual: r-g ≈ +7-8pp, situação que pede primário ENORME pra estabilizar.",
    },
    "selic_real_pct": {
        "titulo": "Selic real ex-post (%a.a.)",
        "fonte": "BCB SGS 1178 / 13522",
        "categoria": "Sinais de stress",
        "verde": 3.0, "amarelo": 6.0, "vermelho": 9.0, "break": 12.0,
        "direcao": "maior_pior",
        "marcos": "Média histórica Brasil: 7%. Atual: ~9-10% (zona vermelha). Países desenvolvidos: 0-2%. China: ~1%.",
        "narrativa": "Selic real é o termômetro do prêmio de risco. Brasil tradicionalmente exige real alto pra compensar histórico inflacionário e fiscal frágil. Acima de 10%, o crescimento sufoca.",
    },
    "primario_pct_pib": {
        "titulo": "Resultado primário SP 12m / PIB",
        "fonte": "BCB SGS 5727 / 5718 (derivado)",
        "categoria": "Sinais de stress",
        "verde": 2.0, "amarelo": 0.0, "vermelho": -2.0, "break": -4.0,
        "direcao": "maior_melhor",
        "marcos": "Brasil 2003-2008 (Lula 1): +3.5% (estabilizou DBGG). 2014 (Dilma): -0.6%. 2020 (pandemia): -10%. 2024: -2.4%.",
        "narrativa": "Sem primário positivo, dívida cresce indefinidamente com r > g. Métrica que SP usa pra medir 'esforço fiscal'. Brasil precisa de +1.5-2% pra estabilizar DBGG.",
    },
    "nfsp_pct_pib": {
        "titulo": "NFSP nominal SP / PIB 12m",
        "fonte": "BCB SGS 5727",
        "categoria": "Sinais de stress",
        "verde": 2.0, "amarelo": 5.0, "vermelho": 8.0, "break": 12.0,
        "direcao": "maior_pior",
        "marcos": "Brasil 2024: 8-9% (zona vermelha). EUA 2024: 6%. Itália 2010 crise: 8%. Argentina 2001: 6%.",
        "narrativa": "Buraco nominal anual que precisa ser financiado emitindo dívida. Soma primário + juros. Brasil hoje em zona vermelha por causa dos juros, não do primário.",
    },
}


# ---------------------------------------------------------------------------
# Coletores extras
# ---------------------------------------------------------------------------
def coletar_divida_externa(since="01/01/2018"):
    """Dívida externa (BCB SGS) — séries de estatísticas externas."""
    # SGS 3546 = dívida externa total trimestral USD MM
    serie = sgs_fetch(3546, since=since)
    return serie


def coletar_divida_externa_cp(since="01/01/2018"):
    """Dívida externa curto prazo. SGS varia; aproximar pela dívida externa total / fator."""
    # placeholder: usar série de dívida externa total como proxy; ajustar quando ID confirmado
    return []


def coletar_dpf_composicao():
    """Composição da DPF por indexador — Tesouro Transparente.

    Não bate API ckan v3 estável; deixa estrutura pronta pra preenchimento manual depois.
    """
    return None


def coletar_fred_spread():
    """Spread soberano Brasil — FRED ICE BofA Brazil Sovereign OAS."""
    return fred_csv("BAMLEMRECRPIBRRACRPIUSOAS", since="2010-01-01")


# ---------------------------------------------------------------------------
# Avaliação semaforizada
# ---------------------------------------------------------------------------
def avaliar(valor, t):
    """Devolve {nivel: verde|amarelo|vermelho|break|sem_dado, distancia_break, distancia_break_pct}."""
    if valor is None:
        return {"nivel": "sem_dado", "distancia_break": None, "distancia_break_pct": None}
    direcao = t["direcao"]
    if direcao == "maior_pior":
        if valor < t["verde"]:
            nivel = "verde"
        elif valor < t["amarelo"]:
            nivel = "amarelo"
        elif valor < t["vermelho"]:
            nivel = "vermelho"
        else:
            nivel = "break" if valor >= t["break"] else "vermelho"
        dist = t["break"] - valor
    else:  # maior_melhor
        if valor > t["verde"]:
            nivel = "verde"
        elif valor > t["amarelo"]:
            nivel = "amarelo"
        elif valor > t["vermelho"]:
            nivel = "vermelho"
        else:
            nivel = "break" if valor <= t["break"] else "vermelho"
        dist = valor - t["break"]
    return {"nivel": nivel, "distancia_break": round(dist, 4), "distancia_break_pct": None}


NIVEL_SCORE = {"verde": 1, "amarelo": 2, "vermelho": 3, "break": 4, "sem_dado": None}


def calcular_score(avaliacoes):
    pesos = [v["nivel"] for v in avaliacoes.values()]
    scores = [NIVEL_SCORE[n] for n in pesos if NIVEL_SCORE[n] is not None]
    if not scores:
        return {"score_medio": None, "nivel_geral": "sem_dado", "n_indicadores": 0}
    media = sum(scores) / len(scores)
    if media < 1.5:
        nivel = "verde"
    elif media < 2.5:
        nivel = "amarelo"
    elif media < 3.5:
        nivel = "vermelho"
    else:
        nivel = "break"
    return {"score_medio": round(media, 2), "nivel_geral": nivel, "n_indicadores": len(scores)}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def last_value(serie, key="valor"):
    if not serie:
        return None
    for r in reversed(serie):
        v = r.get(key)
        if v is not None:
            return v
    return None


def coletar_dado_classicos(out_dir):
    """Lê fiscal-classicos.json local; se não existir, baixa do Blob."""
    local = out_dir / "fiscal-classicos.json"
    if local.exists():
        return json.loads(local.read_text(encoding="utf-8"))
    print("  Sem fiscal-classicos local; tentando Blob...")
    return download_json("data/fiscal-classicos.json")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--no-merge", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    print("== Lendo fiscal-classicos.json ==")
    classicos = coletar_dado_classicos(out_dir)
    if classicos is None:
        print("ERRO: fiscal-classicos não disponível. Rode build_fiscal.py primeiro.", file=sys.stderr)
        sys.exit(1)

    print("== Coletando extras ==")
    divida_externa = coletar_divida_externa()
    spread = coletar_fred_spread()

    # --- Extrai valores recentes ---
    print("== Extraindo valores recentes ==")
    dbgg_recente = last_value([r for r in classicos["divida"]["dbgg_pct"]])
    juros_pct = last_value([{"valor": r["valor"]} for r in classicos["resultado_fiscal"]["juros_nominais_sp_12m_pct_pib"]])
    primario_pct = last_value([{"valor": r["valor_pct"]} for r in classicos["resultado_fiscal"]["primario_sp_12m_pct_pib"]])
    nfsp_pct = last_value([r for r in classicos["resultado_fiscal"]["nfsp_sp_12m_pct_pib"]])
    reer_recente = last_value(classicos["stress"]["reer_index"])
    selic_real_obj = classicos["destaques"].get("selic_real_recente")
    selic_real_recente = selic_real_obj.get("selic_real_pct") if selic_real_obj else None
    pib_12m = classicos.get("pib_nominal_12m_brl_milhoes")

    # Dívida externa USD recente
    div_ext_recente = last_value(divida_externa)
    pib_12m_usd = None
    # Câmbio: usar último valor REER como proxy não basta; usaremos câmbio nominal via Focus
    # Para simplicidade na v1, calcular usando câmbio ~5.5 BRL/USD como proxy se não tiver
    cambio_proxy = 5.5
    if pib_12m and pib_12m > 0:
        pib_12m_usd = pib_12m / cambio_proxy  # R$ MM / (R$/USD) = USD MM
    div_ext_pct = (div_ext_recente / pib_12m_usd * 100) if (div_ext_recente and pib_12m_usd) else None

    # Spread soberano
    spread_bps = last_value(spread)
    if spread_bps is not None:
        spread_bps = spread_bps * 100  # FRED dá em %, multiplico por 100 pra bps

    # r-g: Selic real menos PIB real recente. PIB real YoY do Focus (atual): proxy 2.0%
    pib_real_proxy = 2.0
    r_menos_g = (selic_real_recente - pib_real_proxy) if selic_real_recente is not None else None

    # Primário necessário pra estabilizar dívida (Blanchard simplificado):
    # primário* = (r-g)/(1+g) × DBGG
    primario_estabiliza = None
    if r_menos_g is not None and dbgg_recente is not None:
        primario_estabiliza = (r_menos_g / (1 + pib_real_proxy / 100)) * (dbgg_recente / 100)

    # --- Avalia cada indicador ---
    valores = {
        "dbgg_pct": dbgg_recente,
        "divida_total_economia_pct": None,  # placeholder v2 (BIS Total Credit)
        "divida_externa_pct": div_ext_pct,
        "divida_ext_cp_reservas_pct": None,  # v2
        "juros_pct_pib": juros_pct,
        "juros_pct_receita": None,  # v2 (precisa receita líquida do Tesouro)
        "primario_estabiliza_dbgg": primario_estabiliza,
        "rolagem_12m_pct": None,  # v2 (Tesouro RMD)
        "prazo_medio_anos": None,  # v2 (Tesouro RMD)
        "pct_indexado_selic_cambio": None,  # v2
        "pct_nao_residentes": None,  # v2
        "pct_bc": None,  # v2
        "reer_index": reer_recente,
        "spread_soberano_bps": spread_bps,
        "r_menos_g": r_menos_g,
        "selic_real_pct": selic_real_recente,
        "primario_pct_pib": primario_pct,
        "nfsp_pct_pib": nfsp_pct,
    }

    indicadores = {}
    for chave, t in THRESHOLDS.items():
        v = valores.get(chave)
        avaliacao = avaliar(v, t)
        indicadores[chave] = {
            **t,
            "valor": v,
            **avaliacao,
        }

    score = calcular_score(indicadores)

    payload = {
        "gerado_em": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "score": score,
        "indicadores": indicadores,
        "fonte_base": classicos.get("mes_recente"),
        "extras": {
            "divida_externa_serie": divida_externa[-24:] if divida_externa else [],
            "spread_soberano_serie": spread[-365:] if spread else [],
        },
        "metodologia": (
            "Termômetro Fiscal inspirado em 'How Countries Go Broke' (Ray Dalio, 2025). "
            "18 indicadores adaptados ao Brasil com thresholds verde/amarelo/vermelho/break "
            "baseados nos casos históricos do livro. "
            "Score consolidado é a média do nível de cada indicador (verde=1 a break=4). "
            "Onde marcado 'sem dado', indicador depende de fonte ainda não integrada (Tesouro RMD, BIS Total Credit) — disponível em iteração futura."
        ),
    }

    out_file = out_dir / "fiscal-termometro.json"
    out_file.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    size = out_file.stat().st_size
    print(f"  -> {out_file} ({size} bytes = {size / 1024:.1f} KB)")
    print(f"  Score: {score}")

    if args.upload:
        maybe_upload_json(out_file, BLOB_PATH)


if __name__ == "__main__":
    main()
