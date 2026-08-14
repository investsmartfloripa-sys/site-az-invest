"""Termometro Fiscal — adaptacao Brasil das formulas + tabelas + indicadores
semaforizados de "How Countries Go Broke" (Ray Dalio, 2025).

Output:
- foto_brasil (KPIs basicos)
- 14 INDICADORES SEMAFORIZADOS de ESTADO em 4 categorias (Carga, Capacidade,
  Stress, Monetizacao), todos com serie mensal
- trajetoria 10y
- 2 matrizes (deficit, gap)
- 4 levers explicitos (data.levers — prescritivos, FORA do semaforo)

Convencao:
- primary_deficit positivo = governo gasta mais que arrecada (Dalio)
- Para indicadores 'maior_pior': verde<amarelo<vermelho<break
- Para indicadores 'maior_melhor': verde>amarelo>vermelho>break
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from shared.blob_upload import maybe_upload_json
from shared.blob_download import download_json

DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/fiscal-termometro.json"


def last_value(serie, key=None):
    if not serie:
        return None
    for r in reversed(serie):
        if isinstance(r, dict):
            if key:
                v = r.get(key)
            else:
                v = r.get("valor", r.get("valor_pct"))
            if v is not None:
                return v
    return None


# ============================================================================
# THRESHOLDS DALIO POR INDICADOR
# Cada entry: {direcao, verde, amarelo, break, titulo, categoria, unidade,
#              narrativa}
#
# ONDA 0 (13/08/2026): 3 fronteiras REAIS (verde/amarelo/break) — o antigo
# campo "vermelho" nunca decidia classificação (letra morta) e foi removido.
# Zonas: seguro < verde ≤ atenção < amarelo ≤ crítico < break ≤ ruptura
# (invertido p/ maior_melhor). Âncoras externas citadas na narrativa quando
# existem; o resto é calibração AZ dos casos históricos do livro (ver
# calibracao_nota no payload).
# ============================================================================
THRESHOLDS = {
    # === A. CARGA DA DIVIDA ===
    "dbgg_pct_pib": {
        "titulo": "DBGG / PIB",
        "categoria": "Carga",
        "unidade": "%",
        "direcao": "maior_pior",
        "verde": 60, "amarelo": 70, "break": 130,
        "narrativa": "Dívida bruta do governo geral / PIB. Âncoras: 60% = referência de Maastricht; 70% = referência do FMI p/ emergentes (Fiscal Monitor/DSA); 130% = faixa AZ de ruptura p/ EM sem moeda de reserva (casos do livro).",
    },
    "dbgg_pct_receita": {
        "titulo": "DBGG / Receita",
        "categoria": "Carga",
        "unidade": "%",
        "direcao": "maior_pior",
        "verde": 400, "amarelo": 700, "break": 1400,
        "narrativa": "Métrica Dalio (Debt/Income). PROXY DECLARADA: DBGG (governo geral) ÷ receita líquida do governo CENTRAL — a receita do governo geral (~2× a central, FMI WEO) não é coletada em frequência mensal. Faixas RECALIBRADAS para a proxy: as faixas do conceito do livro (mesmo ente: 200/350/700) × fator 2,0.",
    },
    "credito_total_pct_pib": {
        "titulo": "Crédito total / PIB",
        "categoria": "Carga",
        "unidade": "%",
        "direcao": "maior_pior",
        "verde": 40, "amarelo": 65, "break": 120,
        "narrativa": "Crédito ao setor privado (famílias + empresas) sobre PIB. Saturação alta sinaliza estágio tardio do Big Debt Cycle.",
    },
    "divida_total_economia_pct_pib": {
        "titulo": "Dívida total economia / PIB",
        "categoria": "Carga",
        "unidade": "%",
        "direcao": "maior_pior",
        "verde": 100, "amarelo": 150, "break": 280,
        "narrativa": "Dívida total = DBGG + crédito total (SGS 20622), que inclui operações com o setor público (dupla contagem parcial com a DBGG) e exclui mercado de capitais e dívida externa corporativa (subestima a dívida privada). Comparação internacional exigiria a metodologia BIS, não disponível aqui.",
    },
    # === B. CAPACIDADE DE PAGAMENTO ===
    "juros_pct_receita": {
        "titulo": "Juros / Receita",
        "categoria": "Capacidade",
        "unidade": "%",
        "direcao": "maior_pior",
        "verde": 10, "amarelo": 20, "break": 40,
        "narrativa": "Métrica Dalio: quanto da receita anual é consumida só pelos juros. Âncora externa: nas escalas de debt affordability das agências (Moody's/S&P), juros acima de ~20% da receita = perfil muito fraco; 40% = faixa AZ de ruptura (casos do livro).",
    },
    "custo_medio_aa_pct": {
        "titulo": "Taxa implícita da DLSP (a.a.)",
        "categoria": "Capacidade",
        "unidade": "%",
        "direcao": "maior_pior",
        "verde": 5, "amarelo": 8, "break": 14,
        "narrativa": "Juros nominais 12m ÷ DLSP média 12m — convenção BCB, perímetro ÚNICO (setor público consolidado). Custo efetivo do estoque, distinto da Selic over.",
    },
    "primario_estabilizador_pct_pib": {
        "titulo": "Primário p/ estabilizar (% PIB)",
        "categoria": "Capacidade",
        "unidade": "%",
        "direcao": "maior_pior",
        "verde": 0.5, "amarelo": 2, "break": 6,
        "narrativa": "Superávit primário que congela a Dívida/PIB (Blanchard). Quanto maior, mais distante do politicamente factível é o ajuste.",
    },
    # === C. STRESS EXTERNO & MONETARIO ===
    # (Estrutura da dívida saiu do payload — casa canônica na aba Dívida: DPMFi/DPF)
    "reer_var_12m_pct": {
        "titulo": "REER — variação 12m",
        "categoria": "Stress",
        "unidade": "%",
        "direcao": "maior_pior",
        "verde": 5, "amarelo": 10, "break": 30,
        "narrativa": "Variação 12m do câmbio real efetivo (na série do BCB, ALTA = DEPRECIAÇÃO real do BRL). O sinal Dalio é a depreciação real PERSISTENTE — fuga da moeda; o nível do índice tem base arbitrária e não semaforiza.",
    },
    "selic_real_ex_post_pct": {
        "titulo": "Selic real ex-post (a.a.)",
        "categoria": "Stress",
        "unidade": "%",
        "direcao": "maior_pior",
        "verde": 3, "amarelo": 6, "break": 12,
        "narrativa": "Selic − IPCA 12m. Juro real persistentemente alto encarece a rolagem e sufoca o crescimento nominal que dilui a dívida.",
    },
    "r_menos_g_pp": {
        "titulo": "r − g (pp)",
        "categoria": "Stress",
        "unidade": " pp",
        "direcao": "maior_pior",
        "verde": 0, "amarelo": 2, "break": 6,
        "narrativa": "Taxa de juros nominal menos crescimento nominal. Quando r > g, dívida cresce mesmo com primário neutro (Domar). Zero é a âncora natural.",
    },
    # === D. MONETIZACAO (estágio final do livro, adaptado ao Brasil) ===
    # Levers saíram do semáforo (prescritivos, não indicadores) — seguem como
    # LeverCards na seção Ferramentas, lendo data.levers (intacto).
    "base_monetaria_var_12m_pct": {
        "titulo": "Base monetária — var. 12m",
        "categoria": "Monetizacao",
        "unidade": "%",
        "direcao": "maior_pior",
        "verde": 10, "amarelo": 20, "break": 40,
        "narrativa": (
            "Crescimento nominal 12m do M0 (base monetária restrita, saldo fim de período — SGS 1788). "
            "É a variável de estágio final do livro: expansão monetária acelerada financia o governo quando "
            "o mercado não absorve mais dívida. Faixas ancoradas no episódio 2020 (auxílio emergencial + QE "
            "global): M0 chegou a crescer ~+40% em 12m — essa é a âncora de ruptura; 10% ≈ crescimento "
            "nominal do PIB (neutro), 20% = o dobro."
        ),
    },
    "carteira_bcb_pct_pib": {
        "titulo": "Carteira do BCB / PIB",
        "categoria": "Monetizacao",
        "unidade": "%",
        "direcao": "maior_pior",
        # faixas = percentis HISTÓRICOS da própria série, calculados no builder:
        # verde = p50, amarelo = p75, break = máximo histórico arredondado p/ cima
        "verde": None, "amarelo": None, "break": None,
        "narrativa": (
            "Títulos públicos na carteira do Banco Central (SGS 4152) ÷ PIB nominal 12m (SGS 4382). "
            "Faixas = percentis históricos da própria série (sem âncora externa): verde = mediana, "
            "amarelo = p75, ruptura = máximo histórico arredondado para cima. Nuance BR: a carteira "
            "lastreia as operações compromissadas (gestão de liquidez) — NÃO é QE à americana; o sinal "
            "Dalio é a EXPANSÃO da carteira para absorver dívida que o mercado não quer."
        ),
    },
    "compras_bcb_12m_pp_pib": {
        "titulo": "Δ carteira do BCB 12m (pp PIB)",
        "categoria": "Monetizacao",
        "unidade": " pp",
        "direcao": "maior_pior",
        # verde = 0 (âncora natural: BC não expandindo); amarelo/break = percentis
        # históricos (p75 e máximo), calculados no builder
        "verde": 0, "amarelo": None, "break": None,
        "narrativa": (
            "Variação em 12 meses da carteira do BCB em pontos do PIB — o FLUXO (~'bond purchases' do "
            "livro). Zero é a âncora natural (BC não expandindo a carteira); amarelo e ruptura = percentis "
            "históricos da própria série (p75 e máximo — sem âncora externa). Expansão rápida da carteira "
            "com dívida crescendo = o BC virando comprador residual."
        ),
    },
    "titulos_mercado_var_12m_pct": {
        "titulo": "Títulos em mercado — var. 12m",
        "categoria": "Monetizacao",
        "unidade": "%",
        "direcao": "maior_melhor",
        "verde": 5, "amarelo": 0, "break": -5,
        "narrativa": (
            "Crescimento nominal 12m da DPMFi em poder do MERCADO (soma das 7 categorias de detentores, "
            "RMD/Tesouro). Mercado absorvendo dívida nova = funding saudável (verde acima de +5% a.a., "
            "calibração AZ); estoque em mercado ENCOLHENDO enquanto a dívida cresce (abaixo de −5%) = "
            "ruptura — o setor privado se recusando a carregar o papel, com o BC/governo absorvendo."
        ),
    },
}

# Nota de calibração publicada no payload (renderizada na ficha técnica da aba).
CALIBRACAO_NOTA = (
    "Como as faixas foram calibradas (Onda 0, ago/2026; poda + Monetização, ago/2026): cada indicador tem "
    "3 fronteiras reais (seguro < atenção < crítico < ruptura). Âncoras EXTERNAS quando existem: DBGG/PIB 60% "
    "(Maastricht) e 70% (FMI, referência p/ emergentes); Juros/Receita ~20% (limiar de debt affordability muito "
    "fraca nas escalas de Moody's/S&P); r−g com âncora natural em zero. Dívida/Receita usa PROXY declarada (DBGG "
    "do governo geral ÷ receita do governo central) e as faixas do conceito do livro (200/350/700, mesmo ente) "
    "foram multiplicadas pelo fator ~2,0 da razão entre receita do governo geral e central (FMI WEO) → 400/700/1400. "
    "MONETIZAÇÃO (variáveis de estágio final do livro, adaptadas ao Brasil): base monetária var. 12m ancorada no "
    "episódio 2020 (M0 ~+40% em 12m = ruptura; 10/20 abaixo); carteira do BCB/PIB e Δ carteira 12m usam faixas = "
    "percentis históricos da PRÓPRIA série calculados no builder (mediana/p75/máximo — sem âncora externa), com a "
    "nuance BR de que a carteira lastreia compromissadas (não é QE à americana) — o sinal Dalio é a expansão para "
    "absorver dívida que o mercado não quer; títulos em mercado var. 12m (+5/0/−5) é calibração AZ: mercado "
    "encolhendo enquanto a dívida cresce = ruptura. As demais faixas são calibração editorial AZ a partir dos casos "
    "históricos de 'How Countries Go Broke' (Reino Unido 1976, Japão pós-1990, Argentina 2001, EUA pós-2008) — não "
    "são números do livro. O limiar de 90% de Reinhart-Rogoff não é usado em nenhuma aba (contestado em Herndon, "
    "Ash & Pollin, 2013). Indicadores com casa canônica em outra aba (estrutura da DPMFi → aba Dívida; primário e "
    "NFSP → aba Receita e gastos; juros/PIB → idem) saíram deste payload; os levers são prescritivos e vivem só na "
    "seção Ferramentas."
)


def avaliar(valor, t):
    """3 fronteiras reais (verde/amarelo/break) → 4 zonas. O nível 'vermelho'
    (crítico) é a zona entre amarelo e break; o antigo campo homônimo era letra
    morta e foi removido na Onda 0."""
    if valor is None or t["verde"] is None or t["amarelo"] is None or t["break"] is None:
        # faixas percentílicas não calculadas (série ausente) contam como sem_dado
        return {"nivel": "sem_dado", "distancia_break": None}
    if t["direcao"] == "maior_pior":
        if valor < t["verde"]:
            nivel = "verde"
        elif valor < t["amarelo"]:
            nivel = "amarelo"
        elif valor < t["break"]:
            nivel = "vermelho"
        else:
            nivel = "break"
        dist = t["break"] - valor
    else:
        if valor > t["verde"]:
            nivel = "verde"
        elif valor > t["amarelo"]:
            nivel = "amarelo"
        elif valor > t["break"]:
            nivel = "vermelho"
        else:
            nivel = "break"
        dist = valor - t["break"]
    return {"nivel": nivel, "distancia_break": round(dist, 4)}


NIVEL_SCORE = {"verde": 1, "amarelo": 2, "vermelho": 3, "break": 4, "sem_dado": None}


def calcular_score(indicadores):
    scores = []
    for v in indicadores.values():
        s = NIVEL_SCORE.get(v["nivel"])
        if s is not None:
            scores.append(s)
    if not scores:
        return {"score_medio": None, "nivel_geral": "sem_dado", "n": 0, "total": len(indicadores)}
    media = sum(scores) / len(scores)
    if media < 1.5:
        nivel = "verde"
    elif media < 2.5:
        nivel = "amarelo"
    elif media < 3.5:
        nivel = "vermelho"
    else:
        nivel = "break"
    return {"score_medio": round(media, 2), "nivel_geral": nivel, "n": len(scores), "total": len(indicadores)}


# ============================================================================
# Funções existentes mantidas
# ============================================================================
def projetar_debt_to_income(d0, i_aa, g_aa, pd, anos=10):
    # Equação declarada na metodologia:
    # Debt(t+1)/Income(t+1) = [Debt(t)·(1+i) + Primary_Deficit(t)] / [Income(t)·(1+g)]
    r = d0
    traj = [r]
    for _ in range(anos):
        r = (r * (1 + i_aa) + pd) / (1 + g_aa)
        traj.append(round(r, 2))
    return traj


def matriz_debt_10y(starting, deficit_levels, i_aa, g_aa, anos=10):
    return [[round(projetar_debt_to_income(d0, i_aa, g_aa, pd, anos)[-1], 1) for pd in deficit_levels] for d0 in starting]


def matriz_debt_por_gap(starting, gap_levels, primary_def, g_base, anos=10):
    m = []
    for d0 in starting:
        row = []
        for gap in gap_levels:
            i_eff = g_base + gap / 100
            traj = projetar_debt_to_income(d0, i_eff, g_base, primary_def, anos)
            row.append(round(traj[-1], 1))
        m.append(row)
    return m


def calcular_levers(d, i, g, pd, despesa_pct_rec, inflacao):
    levers = {"gap_atual_pp": round((i - g) * 100, 2)}
    if d <= 0:
        return levers
    i_estavel = g - (pd / 100) * (1 + g) / (d / 100)
    levers["lever_juros"] = {
        "i_estavel_aa": round(i_estavel * 100, 2),
        "i_atual_aa": round(i * 100, 2),
        "delta_pp": round((i_estavel - i) * 100, 2),
    }
    g_necessario = i + (pd / 100) * (1 + g) / (d / 100)
    g_real_atual = g - inflacao
    inflacao_necessaria = g_necessario - g_real_atual
    levers["lever_inflacao"] = {
        "inflacao_estavel_aa": round(inflacao_necessaria * 100, 2),
        "inflacao_atual_aa": round(inflacao * 100, 2),
        "delta_pp": round((inflacao_necessaria - inflacao) * 100, 2),
    }
    pd_estavel = -(d / 100) * (i - g) / (1 + g)
    despesa_alvo_pct_rec = (1 + pd_estavel) * 100
    if despesa_pct_rec > 0:
        corte_pct = (despesa_pct_rec - despesa_alvo_pct_rec) / despesa_pct_rec * 100
        levers["lever_corte_despesa"] = {
            "corte_pct_da_despesa": round(corte_pct, 2),
            "despesa_atual_pct_receita": round(despesa_pct_rec, 2),
            "despesa_alvo_pct_receita": round(despesa_alvo_pct_rec, 2),
        }
    if despesa_pct_rec > 0:
        receita_nova_idx = despesa_pct_rec / (100 + pd_estavel * 100)
        levers["lever_aumento_receita"] = {"aumento_pct_da_receita": round((receita_nova_idx - 1) * 100, 2)}
    return levers


def coletar_classicos(out_dir):
    local = out_dir / "fiscal-classicos.json"
    if local.exists():
        return json.loads(local.read_text(encoding="utf-8"))
    return download_json("data/fiscal-classicos.json")


# ============================================================================
# Onda 3 (a): spread soberano vivo — pré 5a (ANBIMA ETTJ) − Treasury 5a (FRED)
# ============================================================================
FRED_DGS5_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS5&cosd=2004-01-01"


def _fred_dgs5():
    """CSV keyless do FRED (observation_date,DGS5) -> {'YYYY-MM-DD': float}."""
    r = requests.get(FRED_DGS5_URL, timeout=60, headers={"User-Agent": "Mozilla/5.0 (az-invest-fiscal)"})
    r.raise_for_status()
    out = {}
    for line in r.text.splitlines()[1:]:
        parts = line.strip().split(",")
        if len(parts) != 2:
            continue
        d, v = parts
        if v in ("", "."):
            continue
        try:
            out[d] = float(v)
        except ValueError:
            continue
    return out


def montar_spread_soberano():
    """Bloco spread_soberano: série mensal (média dos dias comuns) do spread
    pré 5a BR − Treasury 5a EUA, com último valor e percentis de 10 anos.
    Retorna None (bloco ausente) se uma das fontes falhar."""
    ettj = download_json("data/br_ettj.json")
    dates = (ettj or {}).get("dates") or {}
    if not dates:
        print("[WARN] br_ettj indisponível — spread_soberano ficará ausente", file=sys.stderr)
        return None
    try:
        dgs5 = _fred_dgs5()
    except Exception as e:  # noqa: BLE001
        print(f"[WARN] FRED DGS5 falhou ({e}) — spread_soberano ficará ausente", file=sys.stderr)
        return None
    if not dgs5:
        print("[WARN] FRED DGS5 vazio — spread_soberano ficará ausente", file=sys.stderr)
        return None

    # spread diário nas datas comuns; tenor 5a = pre[2] no shape do br_ettj
    por_mes: dict[str, list[float]] = {}
    for d, row in dates.items():
        pre = (row or {}).get("pre")
        us = dgs5.get(d)
        if not pre or len(pre) < 3 or pre[2] is None or us is None:
            continue
        por_mes.setdefault(d[:7], []).append(pre[2] - us)
    if not por_mes:
        print("[WARN] nenhuma data comum ETTJ×FRED — spread_soberano ficará ausente", file=sys.stderr)
        return None

    serie = [
        {"data": mes, "valor": round(sum(vals) / len(vals), 2)}
        for mes, vals in sorted(por_mes.items())
    ]
    ult = serie[-1]
    corte = f"{int(ult['data'][:4]) - 10}-01"
    vals_10a = sorted(r["valor"] for r in serie if r["data"] >= corte)

    def _pct(p):
        if not vals_10a:
            return None
        k = max(0, min(len(vals_10a) - 1, int(round(p / 100 * (len(vals_10a) - 1)))))
        return round(vals_10a[k], 2)

    return {
        "_fonte": (
            "Curva pré ANBIMA (ETTJ, vértice 5 anos — blob br_ettj) menos US Treasury 5 anos "
            "(FRED DGS5, constant maturity). Spread diário nas datas comuns, agregado em média mensal."
        ),
        "_nota": (
            "Spread NOMINAL entre moedas distintas (BRL vs USD): embute inflação esperada relativa, "
            "prêmio cambial e risco fiscal/de crédito — não é um credit spread puro (para isso seria "
            "preciso CDS ou soberano BRL vs USD no mesmo emissor). Tenor de 5 anos segue a convenção "
            "do CDS 5y, a referência usual de risco soberano."
        ),
        "unidade": "p.p.",
        "serie": serie,
        "ultimo": ult,
        "percentis_10a": {"p25": _pct(25), "p50": _pct(50), "p75": _pct(75)},
    }


# ============================================================================
# Onda 3 (b): serviço total da dívida — juros 12m + principal vincendo 12m
# ============================================================================
def carrega_dpf(out_dir):
    """Blob data/fiscal-dpf-rmd.json com fallback ao arquivo local out/.
    Insumo do servico_total e do indicador titulos_mercado_var_12m_pct."""
    dpf = download_json("data/fiscal-dpf-rmd.json")
    if not dpf:
        local = out_dir / "fiscal-dpf-rmd.json"
        if local.exists():
            dpf = json.loads(local.read_text(encoding="utf-8"))
    return dpf


def montar_servico_total(cl, dpf):
    """(juros_central_12m + % vincendo 12m × estoque DPF) ÷ receita líquida 12m.
    Recebe o fiscal-dpf-rmd já carregado (carrega_dpf). Retorna None sem quebrar
    se o DPF não estiver disponível."""
    if not dpf:
        print("[WARN] fiscal-dpf-rmd indisponível (blob e local) — servico_total ficará null", file=sys.stderr)
        return None

    vinc = {r["data"]: r["valor"] for r in dpf.get("vincendo_12m_pct") or []}
    estoque = {r["data"]: r["valor"] for r in dpf.get("estoque_dpf_brl_bi") or []}
    rg = cl.get("receita_e_gastos") or {}
    juros = {r["data"]: r.get("valor_12m") for r in rg.get("juros_central_12m_brl_mm") or []}
    receita = {r["data"]: r.get("valor_12m") for r in rg.get("receita_liquida_12m_brl_mm") or []}

    serie = []
    for mes in sorted(set(vinc) & set(estoque) & set(juros) & set(receita)):
        j, rec = juros[mes], receita[mes]
        if j is None or not rec:
            continue
        # principal vincendo em 12m, em R$ mi: % vincendo × estoque DPF (R$ bi → R$ mi)
        principal_mi = vinc[mes] / 100.0 * estoque[mes] * 1000.0
        serie.append({"data": mes, "valor_pct_receita": round((j + principal_mi) / rec * 100, 2)})
    if not serie:
        print("[WARN] nenhum mês comum DPF×clássicos — servico_total ficará null", file=sys.stderr)
        return None

    return {
        "_nota": (
            "Serviço TOTAL da dívida em % da receita líquida 12m do governo central: juros nominais 12m "
            "(RTN) + principal da DPF vincendo em 12 meses (% vincendo × estoque DPF, RMD/Tesouro). "
            "O principal é ROLÁVEL — a série mede a necessidade bruta de refinanciamento, não despesa; "
            "por isso complementa (e não substitui) o juros/receita do semáforo."
        ),
        "serie": serie,
    }


# ============================================================================
# Séries históricas dos indicadores — a "camada tempo" da aba de risco.
# Tudo derivado do fiscal-classicos (nenhuma coleta nova aqui).
# ============================================================================
def _norm(serie, key="valor"):
    """[{data, <key>}] -> [{data, valor}] sem nulos, ordenado por data."""
    out = []
    for r in serie or []:
        v = r.get(key, r.get("valor", r.get("valor_pct")))
        if v is None:
            continue
        out.append({"data": r["data"], "valor": v})
    out.sort(key=lambda x: x["data"])
    return out


def _join_ratio(num, den, escala=100.0, casas=2):
    """Razão num/den mês a mês (ambos [{data, valor}])."""
    dmap = {r["data"]: r["valor"] for r in den}
    out = []
    for r in num:
        d = dmap.get(r["data"])
        if d in (None, 0):
            continue
        out.append({"data": r["data"], "valor": round(r["valor"] / d * escala, casas)})
    return out


def _join_sum(a, b, casas=2):
    bmap = {r["data"]: r["valor"] for r in b}
    out = []
    for r in a:
        v = bmap.get(r["data"])
        if v is None:
            continue
        out.append({"data": r["data"], "valor": round(r["valor"] + v, casas)})
    return out


def _var_12m(serie, casas=2):
    smap = {r["data"]: r["valor"] for r in serie}
    out = []
    for data in sorted(smap.keys()):
        y, m = data.split("-")
        ant = f"{int(y) - 1}-{m}"
        if smap.get(ant):
            out.append({"data": data, "valor": round((smap[data] / smap[ant] - 1) * 100, casas)})
    return out


def _diff_12m(serie, casas=2):
    """Diferença em NÍVEL vs 12 meses atrás (pp), não razão."""
    smap = {r["data"]: r["valor"] for r in serie}
    out = []
    for data in sorted(smap.keys()):
        y, m = data.split("-")
        ant = f"{int(y) - 1}-{m}"
        if smap.get(ant) is not None:
            out.append({"data": data, "valor": round(smap[data] - smap[ant], casas)})
    return out


def _percentil(serie, p, casas=2):
    """Percentil p (0-100) dos valores de [{data, valor}] — mesmo método por
    posto arredondado usado nos percentis 10a do spread/EMBI."""
    vals = sorted(r["valor"] for r in serie)
    if not vals:
        return None
    k = max(0, min(len(vals) - 1, int(round(p / 100 * (len(vals) - 1)))))
    return round(vals[k], casas)


# ============================================================================
# Main
# ============================================================================
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--no-merge", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    cl = coletar_classicos(out_dir)
    if cl is None:
        print("ERRO: fiscal-classicos nao disponivel", file=sys.stderr)
        sys.exit(1)

    # Extrair variaveis-chave
    dbgg_pct_pib = last_value(cl["divida"]["dbgg_pct_pib"])
    receita_pct_pib = last_value(cl["receita_e_gastos"]["receita_liquida_pct_pib"], "valor_pct")
    despesa_pct_pib = last_value(cl["receita_e_gastos"]["despesa_total_pct_pib"], "valor_pct")
    juros_central_pct_pib = last_value(cl["receita_e_gastos"]["juros_central_pct_pib"], "valor_pct")
    primario_central_pct_pib = last_value(cl["receita_e_gastos"]["primario_central_pct_pib"], "valor_pct")
    juros_pct_receita = last_value(cl["receita_e_gastos"]["juros_pct_receita"], "valor_pct")
    primario_pct_receita = last_value(cl["receita_e_gastos"]["primario_pct_receita"], "valor_pct")
    despesa_pct_receita = last_value(cl["receita_e_gastos"]["despesa_pct_receita"], "valor_pct")

    sr = cl.get("destaques", {}).get("selic_real_recente")
    selic_real = sr.get("selic_real_pct") if isinstance(sr, dict) else sr
    pry = cl.get("destaques", {}).get("pib_real_yoy_recente")
    pib_real_yoy_pct = pry.get("valor_yoy_pct") if isinstance(pry, dict) else pry
    ipca_obj = cl.get("destaques", {}).get("ipca_12m_recente")
    ipca_12m_pct = ipca_obj.get("valor") if isinstance(ipca_obj, dict) else ipca_obj

    # Composicao DPMFi: PODADA do semáforo (casa canônica na aba Dívida)

    # Credito economia
    credito_total_pct_pib = last_value(cl.get("credito_economia", {}).get("credito_total_pct_pib"))

    # Reer — variação 12m (na 11752, ALTA = depreciação real; o nível tem base arbitrária)
    reer_serie = cl["stress"]["reer_index"]
    reer_var_12m = None
    reer_map = {r["data"]: r["valor"] for r in reer_serie if r.get("valor") is not None}
    for data in sorted(reer_map.keys(), reverse=True):
        y, m = data.split("-")
        ant = f"{int(y) - 1}-{m}"
        if reer_map.get(ant):
            reer_var_12m = round((reer_map[data] / reer_map[ant] - 1) * 100, 2)
            break

    # SEM fallbacks hardcoded: pib_real_yoy_pct / ipca_12m_pct / selic_real podem
    # ser None — avaliar() devolve sem_dado e foto_brasil.macro publica null.

    pd_pct_receita = -primario_pct_receita if primario_pct_receita is not None else None

    # r, g, r−g e primário estabilizador: CONSUMIR do fiscal-classicos v2 (fórmula
    # única, perímetro consolidado: taxa implícita da DLSP × PIB nominal 12m YoY).
    # Fallback (classicos v1): aproximações antigas — com g composto, não somado.
    sust = (cl.get("sustentabilidade") or {}).get("serie") or []
    sust_ult = sust[-1] if sust else None
    if sust_ult:
        i_nominal = sust_ult["r_aa_pct"] / 100
        g_nominal = sust_ult["g_aa_pct"] / 100
        gap_pp = sust_ult["r_menos_g_pp"]
        primario_estab_pct_pib = sust_ult["primario_estabilizador_pct_pib"]
    else:
        print("[WARN] classicos sem bloco v2 'sustentabilidade' — usando aproximações de fallback", file=sys.stderr)
        i_nominal = (juros_central_pct_pib / dbgg_pct_pib) if (juros_central_pct_pib and dbgg_pct_pib) else 0.10
        if pib_real_yoy_pct is not None and ipca_12m_pct is not None:
            g_nominal = (1 + pib_real_yoy_pct / 100) * (1 + ipca_12m_pct / 100) - 1
        else:
            g_nominal = None  # sem macro observada não se inventa g — matrizes/projeção/levers são pulados
        gap_pp = (i_nominal - g_nominal) * 100 if g_nominal is not None else None
        primario_estab_pct_pib = None
        if dbgg_pct_pib and gap_pp is not None:
            primario_estab_pct_pib = (gap_pp / 100) * (dbgg_pct_pib / 100) * 100 / (1 + g_nominal)

    # === Camada tempo: série histórica mensal de cada indicador (derivada do classicos) ===
    # Construída ANTES dos escalares: debt_pct_receita sai do ÚLTIMO ponto da
    # série joinada (numerador e denominador do MESMO mês).
    dbgg_serie = _norm(cl["divida"]["dbgg_pct_pib"])
    receita_pct_serie = _norm(cl["receita_e_gastos"]["receita_liquida_pct_pib"], "valor_pct")
    juros_pct_pib_serie = _norm(cl["receita_e_gastos"]["juros_central_pct_pib"], "valor_pct")  # insumo do dalio4 (juros % poupança)
    credito_serie = _norm(cl.get("credito_economia", {}).get("credito_total_pct_pib"))
    sust_norm = sorted((r for r in sust if r.get("r_aa_pct") is not None), key=lambda x: x["data"])

    # === Monetização (estágio final): séries derivadas + faixas percentílicas ===
    mon = cl.get("monetizacao") or {}
    base_mon_var12 = _var_12m(_norm(mon.get("base_monetaria_brl_mm")))
    pib_map_mensal = {
        r["data"]: r["valor"]
        for r in (cl.get("pib") or {}).get("acumulado_12m_brl_milhoes_mensal") or []
        if r.get("valor") is not None
    }
    carteira_pct_pib_serie = []
    for r in _norm(mon.get("carteira_bcb_brl_mm")):
        pib = pib_map_mensal.get(r["data"])
        if pib:  # ambos em R$ milhões
            carteira_pct_pib_serie.append({"data": r["data"], "valor": round(r["valor"] / pib * 100, 2)})
    compras_12m_serie = _diff_12m(carteira_pct_pib_serie)

    dpf = carrega_dpf(out_dir)
    detentores_keys = (
        "instituicoes_financeiras", "fundos", "previdencia", "nao_residentes",
        "governo", "seguradoras", "outros",
    )
    titulos_mercado_brl_bi = []
    for row in (dpf or {}).get("detentores_brl_bi") or []:
        vals = [row.get(k) for k in detentores_keys]
        if any(v is None for v in vals):
            continue
        titulos_mercado_brl_bi.append({"data": row["data"], "valor": sum(vals)})
    titulos_mercado_var12 = _var_12m(titulos_mercado_brl_bi)
    if not titulos_mercado_var12:
        print("[WARN] fiscal-dpf-rmd sem detentores — titulos_mercado_var_12m_pct ficará sem_dado", file=sys.stderr)

    # Faixas percentílicas calculadas NO BUILDER (contrato: percentis da própria série)
    if carteira_pct_pib_serie:
        THRESHOLDS["carteira_bcb_pct_pib"]["verde"] = _percentil(carteira_pct_pib_serie, 50)
        THRESHOLDS["carteira_bcb_pct_pib"]["amarelo"] = _percentil(carteira_pct_pib_serie, 75)
        THRESHOLDS["carteira_bcb_pct_pib"]["break"] = float(math.ceil(max(r["valor"] for r in carteira_pct_pib_serie)))
        t = THRESHOLDS["carteira_bcb_pct_pib"]
        print(f"  Faixas percentilicas carteira_bcb_pct_pib: verde(p50)={t['verde']} amarelo(p75)={t['amarelo']} break(max arred. p/ cima)={t['break']}")
    if compras_12m_serie:
        THRESHOLDS["compras_bcb_12m_pp_pib"]["amarelo"] = _percentil(compras_12m_serie, 75)
        # máximo arredondado p/ cima em 1 decimal: o mês recorde fica como crítico, não ruptura
        THRESHOLDS["compras_bcb_12m_pp_pib"]["break"] = math.ceil(max(r["valor"] for r in compras_12m_serie) * 10) / 10
        t = THRESHOLDS["compras_bcb_12m_pp_pib"]
        print(f"  Faixas percentilicas compras_bcb_12m_pp_pib: verde(ancora)=0 amarelo(p75)={t['amarelo']} break(max arred. p/ cima)={t['break']}")

    series_hist = {
        "dbgg_pct_pib": dbgg_serie,
        "dbgg_pct_receita": _join_ratio(dbgg_serie, receita_pct_serie),
        "credito_total_pct_pib": credito_serie,
        "divida_total_economia_pct_pib": _join_sum(dbgg_serie, credito_serie),
        "juros_pct_receita": _norm(cl["receita_e_gastos"]["juros_pct_receita"], "valor_pct"),
        "custo_medio_aa_pct": [{"data": r["data"], "valor": r["r_aa_pct"]} for r in sust_norm],
        "primario_estabilizador_pct_pib": [
            {"data": r["data"], "valor": r["primario_estabilizador_pct_pib"]}
            for r in sust_norm if r.get("primario_estabilizador_pct_pib") is not None
        ],
        "reer_var_12m_pct": _var_12m(_norm(reer_serie)),
        "selic_real_ex_post_pct": _norm(cl["monetaria"].get("selic_real_ex_post_pct"), "selic_real_pct"),
        "r_menos_g_pp": [{"data": r["data"], "valor": r["r_menos_g_pp"]} for r in sust_norm],
        # Monetização (estágio final do livro)
        "base_monetaria_var_12m_pct": base_mon_var12,
        "carteira_bcb_pct_pib": carteira_pct_pib_serie,
        "compras_bcb_12m_pp_pib": compras_12m_serie,
        "titulos_mercado_var_12m_pct": titulos_mercado_var12,
        # Podados do semáforo: estrutura DPMFi (aba Dívida), primário/NFSP/juros%PIB
        # (aba Receita e gastos). Levers são prescritivos — seguem só em data.levers.
    }

    # Escalar consistente com a série (último ponto da razão joinada)
    _dbgg_rec_serie = series_hist["dbgg_pct_receita"]
    debt_pct_receita = _dbgg_rec_serie[-1]["valor"] if _dbgg_rec_serie else None

    # Dívida total economia = DBGG + crédito total
    divida_total_pct_pib = (dbgg_pct_pib + credito_total_pct_pib) if (dbgg_pct_pib and credito_total_pct_pib) else None

    # Levers — só com IPCA observado (sem fallback) e g válido
    levers = None
    if debt_pct_receita and pd_pct_receita is not None and ipca_12m_pct is not None and g_nominal is not None:
        levers = calcular_levers(
            d=debt_pct_receita, i=i_nominal, g=g_nominal, pd=pd_pct_receita,
            despesa_pct_rec=despesa_pct_receita or 100.0, inflacao=ipca_12m_pct / 100,
        )

    # === Avaliar 14 indicadores semaforizados (todos de ESTADO, com série mensal) ===
    valores = {
        # Carga
        "dbgg_pct_pib": dbgg_pct_pib,
        "dbgg_pct_receita": debt_pct_receita,
        "credito_total_pct_pib": credito_total_pct_pib,
        "divida_total_economia_pct_pib": divida_total_pct_pib,
        # Capacidade
        "juros_pct_receita": juros_pct_receita,
        "custo_medio_aa_pct": i_nominal * 100,
        "primario_estabilizador_pct_pib": primario_estab_pct_pib,
        # Stress
        "reer_var_12m_pct": reer_var_12m,
        "selic_real_ex_post_pct": selic_real,
        "r_menos_g_pp": gap_pp,
        # Monetizacao (estágio final)
        "base_monetaria_var_12m_pct": last_value(base_mon_var12),
        "carteira_bcb_pct_pib": last_value(carteira_pct_pib_serie),
        "compras_bcb_12m_pp_pib": compras_12m_serie[-1]["valor"] if compras_12m_serie else None,
        "titulos_mercado_var_12m_pct": titulos_mercado_var12[-1]["valor"] if titulos_mercado_var12 else None,
    }

    indicadores = {}
    for chave, t in THRESHOLDS.items():
        v = valores.get(chave)
        if v is not None:
            v = round(v, 2)  # publica/avalia em 2 casas (evita 15 casas de float no JSON)
        avali = avaliar(v, t)
        indicadores[chave] = {**t, "valor": v, **avali}
        hist = series_hist.get(chave)
        if hist:
            indicadores[chave]["serie"] = hist

    score = calcular_score(indicadores)

    # === Dalio 4 — os indicadores prioritários do livro ===
    poup_serie = (cl.get("poupanca") or {}).get("serie") or []
    dbgg_map = {r["data"]: r["valor"] for r in dbgg_serie}
    juros_pib_map = {r["data"]: r["valor"] for r in juros_pct_pib_serie}
    divida_servico_poupanca = []
    for r in poup_serie:
        taxa = r.get("taxa_poupanca_pct_pib")
        if not taxa:
            continue
        db = dbgg_map.get(r["data"])
        jp = juros_pib_map.get(r["data"])
        divida_servico_poupanca.append({
            "data": r["data"],
            "taxa_poupanca_pct_pib": taxa,
            "divida_anos_poupanca": round(db / taxa, 2) if db is not None else None,
            "juros_pct_poupanca": round(jp / taxa * 100, 1) if jp is not None else None,
        })

    ipca_map = {r["data"]: r["valor"] for r in _norm(cl["monetaria"].get("ipca_12m_pct"))}
    juros_infl_cresc = [
        {
            "data": r["data"],
            "r_aa_pct": r["r_aa_pct"],
            "g_aa_pct": r["g_aa_pct"],
            "ipca_12m_pct": ipca_map.get(r["data"]),
            "r_menos_g_pp": r["r_menos_g_pp"],
        }
        for r in sust_norm
    ]

    def _faixas(chave):
        t = THRESHOLDS[chave]
        return {
            "direcao": t["direcao"], "verde": t["verde"], "amarelo": t["amarelo"],
            "break": t["break"],
            "fonte": "Faixas AZ: âncoras externas quando existem (FMI, Maastricht, agências) + casos históricos do livro — ver nota de calibração na ficha técnica.",
        }

    pico_dbgg = max(dbgg_serie, key=lambda r: r["valor"]) if dbgg_serie else None

    dalio4 = {
        "_nota": (
            "Os 4 indicadores que Dalio destaca como prioritários em 'How Countries Go Broke': "
            "(1) dívida vs renda; (2) serviço da dívida vs renda; (3) juro nominal vs inflação e vs "
            "crescimento nominal da renda; (4) dívida e serviço da dívida vs poupança."
        ),
        "divida_renda": {
            # séries em indicadores_semaforo.dbgg_pct_receita.serie e .dbgg_pct_pib.serie (front lê de lá)
            "faixas_pct_receita": _faixas("dbgg_pct_receita"),
            "faixas_pct_pib": _faixas("dbgg_pct_pib"),
            # Onda 0: Reinhart-Rogoff 90% REMOVIDO (posição da casa: contestado, não usamos);
            # FMI 70% virou a própria fronteira amarela da banda — só o pico fica como linha.
            "referencias_pct_pib": (
                [{"valor": round(pico_dbgg["valor"], 1), "label": f"pico histórico ({pico_dbgg['data']})"}] if pico_dbgg else []
            ),
            "_nota": "DBGG (governo geral) ÷ receita líquida 12m do governo central — proxy conservadora do Debt/Income do livro (perímetros distintos, declarado).",
        },
        "servico_renda": {
            # série em indicadores_semaforo.juros_pct_receita.serie (front lê de lá)
            "faixas": _faixas("juros_pct_receita"),
            "_nota": (
                "Serviço = juros nominais 12m do governo central (RTN). A rolagem de principal "
                "(% da DPF vincendo em 12m × estoque, RMD/Tesouro) existe como série adicional em "
                "servico_total (juros + principal vincendo 12m, % da receita líquida 12m)."
            ),
        },
        "juros_inflacao_crescimento": {
            "serie": juros_infl_cresc,
            "faixas_gap": _faixas("r_menos_g_pp"),
            "_nota": (cl.get("sustentabilidade") or {}).get("_perimetro"),
        },
        "divida_servico_poupanca": {
            "serie": divida_servico_poupanca,
            "_nota": (
                "Poupança bruta acumulada 4 trimestres (IBGE CNT, SIDRA t/2072). 'Anos de poupança' = DBGG %PIB ÷ "
                "taxa de poupança %PIB; 'juros % poupança' = juros nominais 12m %PIB ÷ poupança %PIB — fração da "
                "poupança nacional que o serviço de juros do governo central absorve."
            ),
        },
    }

    # === EMBI+ (o preço que o mercado cobra do risco fiscal) — reuso do blob dos antecedentes ===
    embi_block = None
    antec = download_json("data/visao_geral_antecedentes_fin.json")
    embi_serie = [
        {"data": r["mes"], "valor": r["embi_bps"]}
        for r in ((antec or {}).get("embi") or [])
        if r.get("embi_bps") is not None
    ]
    if embi_serie:
        ult_embi = embi_serie[-1]
        corte = f"{int(ult_embi['data'][:4]) - 10}-01"
        vals_10a = sorted(r["valor"] for r in embi_serie if r["data"] >= corte)

        def _pct(p):
            if not vals_10a:
                return None
            k = max(0, min(len(vals_10a) - 1, int(round(p / 100 * (len(vals_10a) - 1)))))
            return round(vals_10a[k], 1)

        # A série pública do EMBI+ foi descontinuada (Ipeadata/JPM parou em ~jul/2024).
        # Defasagem calculada do dado, nunca assumida: >4 meses sem observação = descontinuada.
        hoje = datetime.now(timezone.utc)
        anos_meses = (hoje.year - int(ult_embi["data"][:4])) * 12 + (hoje.month - int(ult_embi["data"][5:7]))
        embi_block = {
            "_fonte": (
                "IPEADATA JPM366_EMBI366 (média mensal, pontos-base) — reaproveitado do pipeline de antecedentes "
                "financeiros. O CDS 5y (referência atual de research) não tem fonte pública gratuita."
            ),
            "serie": embi_serie,
            "ultimo": ult_embi,
            "percentis_10a": {"p25": _pct(25), "p50": _pct(50), "p75": _pct(75)},
            "descontinuada": anos_meses > 4,
        }
    else:
        print("[WARN] EMBI indisponível (blob antecedentes) — card ficará oculto", file=sys.stderr)

    # === Onda 3: spread soberano vivo (pré 5a − Treasury 5a) e serviço total ===
    spread_soberano = montar_spread_soberano()
    servico_total = montar_servico_total(cl, dpf)

    # === Projeção DBGG com Focus (ilustrativa, sem efeito câmbio) ===
    projecao_dbgg = None
    focus = cl.get("expectativas_focus") or {}

    def _focus_mediana(bloco, ano):
        pts = (focus.get(bloco) or {}).get(str(ano)) or []
        for p in reversed(pts):
            if p.get("mediana") is not None:
                return p["mediana"]
        return None

    metas_anos = ((cl.get("metas_ldo") or {}).get("anos")) or {}
    if dbgg_pct_pib is not None and sust_ult:
        mes_recente = cl.get("mes_recente") or "2026-01"
        ano_base = int(mes_recente[:4])
        mes_base = int(mes_recente[5:7])
        b_meta = b_atual = dbgg_pct_pib
        prim_atual = primario_central_pct_pib or 0.0  # % PIB 12m, positivo = superávit
        ult_meta = None
        anos_proj = []

        # (i) ANO-BASE PARCIAL: do estoque de mes_recente até dez/ano_base, com
        # fração = meses_restantes/12 como EXPOENTE na dinâmica e fração do primário
        # (meta vigente do ano-base, ex. 0,25 em 2026).
        meta_base = (metas_anos.get(str(ano_base)) or {}).get("centro")
        if meta_base is not None:
            ult_meta = meta_base
        fracao = (12 - mes_base) / 12
        pib_focus0 = _focus_mediana("pib_anuais", ano_base)
        ipca_focus0 = _focus_mediana("ipca_anuais", ano_base)
        if fracao > 0 and pib_focus0 is not None and ipca_focus0 is not None:
            g0 = (1 + pib_focus0 / 100) * (1 + ipca_focus0 / 100) - 1
            p_meta0 = ult_meta if ult_meta is not None else prim_atual
            dinamica = ((1 + i_nominal) / (1 + g0)) ** fracao
            b_meta = b_meta * dinamica - p_meta0 * fracao
            b_atual = b_atual * dinamica - prim_atual * fracao
            anos_proj.append({
                "ano": ano_base,
                "fracao_ano": round(fracao, 4),
                "g_nominal_focus_aa_pct": round(g0 * 100, 2),
                "primario_cenario_meta_pct_pib": p_meta0,
                "dbgg_cenario_meta_pct_pib": round(b_meta, 1),
                "dbgg_cenario_primario_atual_pct_pib": round(b_atual, 1),
            })

        for ano in range(ano_base + 1, ano_base + 4):
            pib_focus = _focus_mediana("pib_anuais", ano)
            ipca_focus = _focus_mediana("ipca_anuais", ano)
            if pib_focus is None or ipca_focus is None:
                break  # sem Focus para o ano → não inventa premissa
            g_ano = (1 + pib_focus / 100) * (1 + ipca_focus / 100) - 1
            meta = (metas_anos.get(str(ano)) or {}).get("centro")
            meta_extrapolada = False
            if meta is not None:
                ult_meta = meta
            elif ult_meta is not None:
                meta_extrapolada = True  # (ii) pós-horizonte da LDO: repete a última meta, declarado
            p_meta = ult_meta if ult_meta is not None else prim_atual
            b_meta = b_meta * (1 + i_nominal) / (1 + g_ano) - p_meta
            b_atual = b_atual * (1 + i_nominal) / (1 + g_ano) - prim_atual
            ponto = {
                "ano": ano,
                "g_nominal_focus_aa_pct": round(g_ano * 100, 2),
                "primario_cenario_meta_pct_pib": p_meta,
                "dbgg_cenario_meta_pct_pib": round(b_meta, 1),
                "dbgg_cenario_primario_atual_pct_pib": round(b_atual, 1),
            }
            if meta_extrapolada:
                ponto["meta_extrapolada"] = True
            anos_proj.append(ponto)
        hist_anual = [r for r in dbgg_serie if r["data"].endswith("-12")]
        if dbgg_serie and (not hist_anual or hist_anual[-1]["data"] != dbgg_serie[-1]["data"]):
            hist_anual = hist_anual + [dbgg_serie[-1]]
        if anos_proj:
            projecao_dbgg = {
                "_nota": (
                    "Projeção ILUSTRATIVA: b(t+1) = b(t)·(1+i)/(1+g) − primário. i = taxa implícita da DLSP "
                    "(proxy declarada — os juros que acruam sobre a DBGG não são coletados); g composto "
                    "multiplicativamente do Focus (PIB real × IPCA, medianas mais recentes); SEM efeito câmbio/"
                    "ajustes patrimoniais. Cenário A: metas LDO cumpridas (centro, % PIB); cenário B: primário 12m atual constante. "
                    "O ano-base entra como fração (fracao_ano = meses restantes/12) a partir do estoque do mês mais recente. "
                    "Após 2027, meta mantida em +0,50% (hipótese AZ, extrapolada — anos marcados com meta_extrapolada). "
                    "i mantido constante (cenário juro não cede)."
                ),
                "historico_anual": hist_anual,
                "premissas": {"i_aa_pct": round(i_nominal * 100, 2), "primario_atual_pct_pib": prim_atual},
                "anos": anos_proj,
            }

    # Matrizes (endlevel; as change_* saíram do payload — o front não as lê mais)
    starting = [0, 100, 200, 300, 400, 500, 600, 700]
    deficit_levels = [0, 5, 10, 15, 20, 25, 30]
    gap_levels = [-3, -2, -1, 0, 1, 2, 3]

    matrizes_block = None
    if g_nominal is not None:
        matriz_def_end = matriz_debt_10y(starting, deficit_levels, g_nominal, g_nominal)
        pd_br = pd_pct_receita if pd_pct_receita is not None else 12.0
        matriz_gap_end = matriz_debt_por_gap(starting, gap_levels, pd_br, g_nominal)
        matrizes_block = {
            "endlevel_por_deficit": {
                "titulo": "Debt-to-Income apos 10 anos",
                "subtitulo": "Variando deficit primario (% Receita), assumindo i = g",
                "eixo_y_starting": starting,
                "eixo_x_deficit": deficit_levels,
                "valores": matriz_def_end,
                "brasil": {
                    "starting": round(debt_pct_receita, 0) if debt_pct_receita else None,
                    "deficit": round(pd_pct_receita, 0) if pd_pct_receita is not None else None,
                },
            },
            "endlevel_por_gap": {
                "titulo": "Debt-to-Income apos 10 anos",
                "subtitulo": f"Variando (i - g), deficit primario constante {round(pd_br, 1)}% Receita",
                "eixo_y_starting": starting,
                "eixo_x_gap_pp": gap_levels,
                "valores": matriz_gap_end,
                "brasil": {
                    "starting": round(debt_pct_receita, 0) if debt_pct_receita else None,
                    "gap_pp": round(gap_pp, 0) if gap_pp is not None else None,
                },
            },
        }

    foto = {
        "divida": {"dbgg_pct_pib": dbgg_pct_pib, "dbgg_pct_receita": round(debt_pct_receita, 2) if debt_pct_receita else None},
        "receita": {"receita_liquida_pct_pib": receita_pct_pib},
        "gastos": {"despesa_total_pct_pib": despesa_pct_pib, "despesa_total_pct_receita": despesa_pct_receita},
        "deficit_primario": {
            "primary_deficit_pct_pib": -primario_central_pct_pib if primario_central_pct_pib is not None else None,
            "primary_deficit_pct_receita": pd_pct_receita,
        },
        "juros": {
            "juros_pct_pib": juros_central_pct_pib,
            "juros_pct_receita": juros_pct_receita,
            "taxa_nominal_efetiva_aa": round(i_nominal * 100, 2),
        },
        "macro": {
            # podem ser null quando faltar insumo — o front trata; não se inventa valor
            "pib_real_yoy_pct": pib_real_yoy_pct,
            "ipca_12m_pct": ipca_12m_pct,
            "selic_real_ex_post_pct": selic_real,
            "g_nominal_aa_pct": round(g_nominal * 100, 2) if g_nominal is not None else None,
            "i_nominal_aa_pct": round(i_nominal * 100, 2),
            "gap_i_menos_g_pp": round(gap_pp, 2) if gap_pp is not None else None,
        },
    }

    payload = {
        "schema_version": 2,
        "gerado_em": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "fonte_base": cl.get("mes_recente"),
        "foto_brasil": foto,
        "indicadores_semaforo": indicadores,
        "categorias_ordem": ["Carga", "Capacidade", "Stress", "Monetizacao"],
        "matrizes": matrizes_block,
        "levers": levers,
        "dalio4": dalio4,
        "embi": embi_block,
        "spread_soberano": spread_soberano,
        "servico_total": servico_total,
        "projecao_dbgg": projecao_dbgg,
        "premissas": {
            "i_nominal_aa": round(i_nominal * 100, 2),
            "g_nominal_aa": round(g_nominal * 100, 2) if g_nominal is not None else None,
            "primary_deficit_pct_receita": round(pd_pct_receita, 2) if pd_pct_receita is not None else None,
            "debt_pct_receita": round(debt_pct_receita, 2) if debt_pct_receita else None,
            "anos_projecao": 10,
        },
        "calibracao_nota": CALIBRACAO_NOTA,
        "metodologia": (
            "Indicadores de Risco Fiscal baseados em 'How Countries Go Broke' (Ray Dalio, 2025). "
            "Os 4 indicadores prioritarios do livro (divida/renda, servico/renda, juro vs inflacao e crescimento, "
            "divida e servico vs poupanca) abrem a pagina como series historicas com faixas de risco; "
            "14 indicadores semaforizados de ESTADO em 4 categorias (Carga, Capacidade, Stress, Monetizacao), cada um "
            "com serie mensal historica — 3 fronteiras por indicador (seguro/atencao/critico/ruptura), com ancoras "
            "externas quando existem (Maastricht, FMI, agencias, episodio 2020 do M0), percentis historicos da propria "
            "serie na carteira do BCB e calibracao AZ dos casos do livro no restante (ver calibracao_nota). "
            "A categoria Monetizacao adapta ao Brasil as variaveis de estagio final do livro: crescimento 12m do M0, "
            "carteira de titulos do BCB em % do PIB (nivel e fluxo 12m) e crescimento 12m da DPMFi em poder do mercado "
            "(soma dos detentores, RMD/Tesouro); compromissadas publicadas como serie de contexto no fiscal-classicos. "
            "Indicadores com casa canonica em outra aba (estrutura DPMFi, primario, NFSP, juros/PIB) sairam do payload; "
            "os 4 levers seguem como ferramenta prescritiva em data.levers (secao Ferramentas), fora do semaforo. "
            "r, g, r-g e primario estabilizador vem do bloco 'sustentabilidade' do fiscal-classicos v2 "
            "(taxa implicita da DLSP x PIB nominal 12m YoY, perimetro unico do setor publico consolidado) — "
            "calculados UMA vez no pipeline; nenhum componente do front recalcula. "
            "Equacao iterativa Debt(t+1)/Income(t+1) = [Debt(t)*(1+i) + Primary_Deficit(t)] / [Income(t)*(1+g)], "
            "matrizes Debt-to-Income apos 10 anos variando deficit e gap (i-g), e os 4 Levers calculados isoladamente. "
            "EMBI+ como validador de mercado (IPEADATA); projecao ilustrativa da DBGG com Focus. "
            "Variaveis em tempo real: BCB SGS, Tesouro RTN, IBGE."
        ),
    }

    out_file = out_dir / "fiscal-termometro.json"
    out_file.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    size = out_file.stat().st_size
    print(f"  -> {out_file} ({size / 1024:.1f} KB)")
    print(f"  Score: {score}")
    print(f"  Indicadores no payload: {len(indicadores)} | categorias: {sorted({v['categoria'] for v in indicadores.values()})}")
    print(f"  Indicadores com nivel break: {[k for k, v in indicadores.items() if v['nivel'] == 'break']}")
    for k in ("base_monetaria_var_12m_pct", "carteira_bcb_pct_pib", "compras_bcb_12m_pp_pib", "titulos_mercado_var_12m_pct"):
        v = indicadores.get(k) or {}
        serie = v.get("serie") or []
        ult = serie[-1]["data"] if serie else "-"
        print(f"  Monetizacao {k}: valor={v.get('valor')} nivel={v.get('nivel')} (serie ate {ult}, n={len(serie)})")
    if spread_soberano:
        print(f"  Spread soberano: ultimo {spread_soberano['ultimo']} | percentis 10a {spread_soberano['percentis_10a']}")
    else:
        print("  Spread soberano: AUSENTE")
    if servico_total:
        print(f"  Servico total: ultimo {servico_total['serie'][-1]}")
    else:
        print("  Servico total: null")

    if args.upload:
        maybe_upload_json(out_file, BLOB_PATH)


if __name__ == "__main__":
    main()
