"""Termometro Fiscal — adaptacao Brasil das formulas + tabelas + indicadores
semaforizados de "How Countries Go Broke" (Ray Dalio, 2025).

Output:
- foto_brasil (KPIs basicos)
- INDICADORES SEMAFORIZADOS por categoria (carga, capacidade, estrutura, detentores, stress, levers)
- trajetoria 10y
- 2 matrizes (deficit, gap)
- 4 levers explicitos

Convencao:
- primary_deficit positivo = governo gasta mais que arrecada (Dalio)
- Para indicadores 'maior_pior': verde<amarelo<vermelho<break
- Para indicadores 'maior_melhor': verde>amarelo>vermelho>break
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

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
# Cada entry: {direcao, verde, amarelo, vermelho, break, titulo, categoria,
#              unidade, narrativa_curta}
# ============================================================================
THRESHOLDS = {
    # === A. CARGA DA DIVIDA ===
    "dbgg_pct_pib": {
        "titulo": "DBGG / PIB",
        "categoria": "Carga",
        "unidade": "%",
        "direcao": "maior_pior",
        "verde": 60, "amarelo": 80, "vermelho": 100, "break": 130,
        "narrativa": "Dívida bruta do governo geral / PIB. Métrica padrão FMI/Maastricht.",
    },
    "dbgg_pct_receita": {
        "titulo": "DBGG / Receita",
        "categoria": "Carga",
        "unidade": "%",
        "direcao": "maior_pior",
        "verde": 200, "amarelo": 350, "vermelho": 500, "break": 700,
        "narrativa": "Métrica Dalio (Debt/Income). NOTA DE PERÍMETRO: DBGG é do governo GERAL e a receita é do governo CENTRAL — proxy conservadora (infla a razão vs o Debt/Revenue do livro, que usa dívida e receita do mesmo ente).",
    },
    "credito_total_pct_pib": {
        "titulo": "Crédito total / PIB",
        "categoria": "Carga",
        "unidade": "%",
        "direcao": "maior_pior",
        "verde": 40, "amarelo": 65, "vermelho": 90, "break": 120,
        "narrativa": "Crédito ao setor privado (famílias + empresas) sobre PIB. Saturação alta sinaliza estágio tardio do Big Debt Cycle.",
    },
    "divida_total_economia_pct_pib": {
        "titulo": "Dívida total economia / PIB",
        "categoria": "Carga",
        "unidade": "%",
        "direcao": "maior_pior",
        "verde": 100, "amarelo": 150, "vermelho": 200, "break": 280,
        "narrativa": "Dívida total = governo + privado (famílias+empresas). EUA ~250%, China ~290%, Japão ~410%.",
    },
    # === B. CAPACIDADE DE PAGAMENTO ===
    "juros_pct_pib": {
        "titulo": "Juros / PIB",
        "categoria": "Capacidade",
        "unidade": "%",
        "direcao": "maior_pior",
        "verde": 3, "amarelo": 5, "vermelho": 7, "break": 10,
        "narrativa": "Despesa anual com juros nominais do gov central / PIB.",
    },
    "juros_pct_receita": {
        "titulo": "Juros / Receita",
        "categoria": "Capacidade",
        "unidade": "%",
        "direcao": "maior_pior",
        "verde": 10, "amarelo": 20, "vermelho": 30, "break": 40,
        "narrativa": "Métrica Dalio. Quanto da receita anual é consumida só pra pagar juros. Acima de 30% = zona de alerta.",
    },
    "custo_medio_aa_pct": {
        "titulo": "Taxa implícita da DLSP (a.a.)",
        "categoria": "Capacidade",
        "unidade": "%",
        "direcao": "maior_pior",
        "verde": 5, "amarelo": 8, "vermelho": 11, "break": 14,
        "narrativa": "Juros nominais 12m ÷ DLSP média 12m — convenção BCB, perímetro ÚNICO (setor público consolidado). Custo efetivo do estoque, distinto da Selic over.",
    },
    "primario_estabilizador_pct_pib": {
        "titulo": "Primário p/ estabilizar (% PIB)",
        "categoria": "Capacidade",
        "unidade": "%",
        "direcao": "maior_pior",
        "verde": 0.5, "amarelo": 2, "vermelho": 4, "break": 6,
        "narrativa": "Superávit primário necessário pra Dívida/PIB parar de crescer (Blanchard). Brasil hoje precisa de superávit > 2.5% PIB; realizado é déficit.",
    },
    # === C. ESTRUTURA DA DIVIDA ===
    "pct_indexado_selic": {
        "titulo": "% DPMFi em Selic/LFT",
        "categoria": "Estrutura",
        "unidade": "%",
        "direcao": "maior_pior",
        "verde": 20, "amarelo": 40, "vermelho": 55, "break": 70,
        "narrativa": "Dívida indexada à Selic transmite alta de juros direto pro estoque. Brasil 2002 era 70%, hoje ~46%.",
    },
    "pct_prefixado": {
        "titulo": "% DPMFi prefixado",
        "categoria": "Estrutura",
        "unidade": "%",
        "direcao": "maior_melhor",
        "verde": 30, "amarelo": 25, "vermelho": 15, "break": 10,
        "narrativa": "Prefixado fixa o custo — protege contra aperto monetário. Acima de 30% é saudável.",
    },
    "pct_cambio": {
        "titulo": "% DPMFi em câmbio",
        "categoria": "Estrutura",
        "unidade": "%",
        "direcao": "maior_pior",
        "verde": 3, "amarelo": 8, "vermelho": 15, "break": 25,
        "narrativa": "Dívida em câmbio explode em desvalorizações. Brasil tem virtude estrutural (~1-3%); Argentina 2001 tinha >60%.",
    },
    # === D. STRESS EXTERNO & MONETARIO ===
    "reer_var_12m_pct": {
        "titulo": "REER — variação 12m",
        "categoria": "Stress",
        "unidade": "%",
        "direcao": "maior_pior",
        "verde": 5, "amarelo": 10, "vermelho": 20, "break": 30,
        "narrativa": "Variação 12m do câmbio real efetivo (na série do BCB, ALTA = DEPRECIAÇÃO real do BRL). O sinal Dalio é a depreciação real PERSISTENTE — fuga da moeda; o nível do índice tem base arbitrária e não semaforiza.",
    },
    "selic_real_ex_post_pct": {
        "titulo": "Selic real ex-post (a.a.)",
        "categoria": "Stress",
        "unidade": "%",
        "direcao": "maior_pior",
        "verde": 3, "amarelo": 6, "vermelho": 9, "break": 12,
        "narrativa": "Selic - IPCA 12m. Brasil exige real alto pra compensar histórico inflacionário. Acima de 10% sufoca crescimento.",
    },
    "r_menos_g_pp": {
        "titulo": "r − g (pp)",
        "categoria": "Stress",
        "unidade": " pp",
        "direcao": "maior_pior",
        "verde": 0, "amarelo": 2, "vermelho": 4, "break": 6,
        "narrativa": "Taxa de juros nominal menos crescimento nominal. Quando r > g, dívida cresce mesmo com primário neutro (Domar).",
    },
    "primario_realizado_pct_pib": {
        "titulo": "Primário 12m / PIB",
        "categoria": "Stress",
        "unidade": "%",
        "direcao": "maior_melhor",
        "verde": 2, "amarelo": 0, "vermelho": -2, "break": -4,
        "narrativa": "Resultado primário gov central 12m % PIB. Convenção Brasil: positivo = superávit. Brasil 2003-08: +3.5%. 2024: -1%.",
    },
    "nfsp_pct_pib": {
        "titulo": "NFSP 12m / PIB",
        "categoria": "Stress",
        "unidade": "%",
        "direcao": "maior_pior",
        "verde": 2, "amarelo": 5, "vermelho": 8, "break": 12,
        "narrativa": "Necessidade de financiamento setor público (déficit nominal). Brasil hoje em zona vermelha por causa dos juros.",
    },
    # === E. LEVERS NECESSARIOS ===
    "lever_juros_delta_pp": {
        "titulo": "Δ juros pra estabilizar",
        "categoria": "Levers",
        "unidade": " pp",
        "direcao": "maior_pior",
        "verde": 2, "amarelo": 3, "vermelho": 4, "break": 6,
        "narrativa": "Quanto a taxa de juros teria que cair (em magnitude) pra estabilizar Dívida/Receita.",
    },
    "lever_inflacao_delta_pp": {
        "titulo": "Δ inflação pra estabilizar",
        "categoria": "Levers",
        "unidade": " pp",
        "direcao": "maior_pior",
        "verde": 2, "amarelo": 3, "vermelho": 4, "break": 6,
        "narrativa": "Inflação adicional necessária pra erodir dívida via crescimento nominal.",
    },
    "lever_corte_despesa_pct": {
        "titulo": "Corte de despesa necessário",
        "categoria": "Levers",
        "unidade": "%",
        "direcao": "maior_pior",
        "verde": 3, "amarelo": 7, "vermelho": 12, "break": 18,
        "narrativa": "% da despesa primária total que precisaria ser cortado isoladamente.",
    },
    "lever_aumento_receita_pct": {
        "titulo": "Aumento de receita necessário",
        "categoria": "Levers",
        "unidade": "%",
        "direcao": "maior_pior",
        "verde": 3, "amarelo": 7, "vermelho": 12, "break": 18,
        "narrativa": "% de aumento na receita líquida (mantendo despesa) pra estabilizar.",
    },
}


def avaliar(valor, t):
    if valor is None:
        return {"nivel": "sem_dado", "distancia_break": None}
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
    else:
        if valor > t["verde"]:
            nivel = "verde"
        elif valor > t["amarelo"]:
            nivel = "amarelo"
        elif valor > t["vermelho"]:
            nivel = "vermelho"
        else:
            nivel = "break" if valor <= t["break"] else "vermelho"
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
    r = d0
    mult = (1 + i_aa) / (1 + g_aa)
    traj = [r]
    for _ in range(anos):
        r = r * mult + pd
        traj.append(round(r, 2))
    return traj


def matriz_debt_10y(starting, deficit_levels, i_aa, g_aa, anos=10):
    return [[round(projetar_debt_to_income(d0, i_aa, g_aa, pd, anos)[-1], 1) for pd in deficit_levels] for d0 in starting]


def matriz_change_10y(starting, deficit_levels, i_aa, g_aa, anos=10):
    return [[round(projetar_debt_to_income(d0, i_aa, g_aa, pd, anos)[-1] - d0, 1) for pd in deficit_levels] for d0 in starting]


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
    nfsp_sp_pct = last_value(cl["receita_e_gastos"]["nfsp_sp_12m_pct_pib"])

    sr = cl.get("destaques", {}).get("selic_real_recente")
    selic_real = sr.get("selic_real_pct") if isinstance(sr, dict) else sr
    pry = cl.get("destaques", {}).get("pib_real_yoy_recente")
    pib_real_yoy_pct = pry.get("valor_yoy_pct") if isinstance(pry, dict) else pry
    ipca_obj = cl.get("destaques", {}).get("ipca_12m_recente")
    ipca_12m_pct = ipca_obj.get("valor") if isinstance(ipca_obj, dict) else ipca_obj

    # Composicao DPMFi
    comp = cl.get("composicao_dpmfi", {})
    pct_selic = last_value(comp.get("selic_pct"))
    pct_prefix = last_value(comp.get("prefixado_pct"))
    pct_cambio = last_value(comp.get("cambio_pct"))

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

    # Defaults / fallbacks
    if pib_real_yoy_pct is None: pib_real_yoy_pct = 2.0
    if ipca_12m_pct is None: ipca_12m_pct = 4.5
    if selic_real is None: selic_real = 9.0

    debt_pct_receita = (dbgg_pct_pib / receita_pct_pib * 100) if (dbgg_pct_pib and receita_pct_pib) else None
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
        g_nominal = (1 + pib_real_yoy_pct / 100) * (1 + ipca_12m_pct / 100) - 1
        gap_pp = (i_nominal - g_nominal) * 100
        primario_estab_pct_pib = None
        if dbgg_pct_pib and gap_pp is not None:
            primario_estab_pct_pib = (gap_pp / 100) * (dbgg_pct_pib / 100) * 100 / (1 + g_nominal)

    # Dívida total economia = DBGG + crédito total
    divida_total_pct_pib = (dbgg_pct_pib + credito_total_pct_pib) if (dbgg_pct_pib and credito_total_pct_pib) else None

    # Levers
    levers = None
    if debt_pct_receita and pd_pct_receita is not None:
        levers = calcular_levers(
            d=debt_pct_receita, i=i_nominal, g=g_nominal, pd=pd_pct_receita,
            despesa_pct_rec=despesa_pct_receita or 100.0, inflacao=ipca_12m_pct / 100,
        )

    # Trajetoria 10y
    traj_br = None
    if debt_pct_receita is not None and pd_pct_receita is not None:
        traj_br = projetar_debt_to_income(debt_pct_receita, i_nominal, g_nominal, pd_pct_receita, 10)

    # === Avaliar 20 indicadores semaforizados ===
    valores = {
        # Carga
        "dbgg_pct_pib": dbgg_pct_pib,
        "dbgg_pct_receita": debt_pct_receita,
        "credito_total_pct_pib": credito_total_pct_pib,
        "divida_total_economia_pct_pib": divida_total_pct_pib,
        # Capacidade
        "juros_pct_pib": juros_central_pct_pib,
        "juros_pct_receita": juros_pct_receita,
        "custo_medio_aa_pct": i_nominal * 100,
        "primario_estabilizador_pct_pib": primario_estab_pct_pib,
        # Estrutura
        "pct_indexado_selic": pct_selic,
        "pct_prefixado": pct_prefix,
        "pct_cambio": pct_cambio,
        # Stress
        "reer_var_12m_pct": reer_var_12m,
        "selic_real_ex_post_pct": selic_real,
        "r_menos_g_pp": gap_pp,
        "primario_realizado_pct_pib": primario_central_pct_pib,
        "nfsp_pct_pib": nfsp_sp_pct,
        # Levers
        "lever_juros_delta_pp": abs(levers["lever_juros"]["delta_pp"]) if levers and "lever_juros" in levers else None,
        "lever_inflacao_delta_pp": abs(levers["lever_inflacao"]["delta_pp"]) if levers and "lever_inflacao" in levers else None,
        "lever_corte_despesa_pct": levers["lever_corte_despesa"]["corte_pct_da_despesa"] if levers and "lever_corte_despesa" in levers else None,
        "lever_aumento_receita_pct": levers["lever_aumento_receita"]["aumento_pct_da_receita"] if levers and "lever_aumento_receita" in levers else None,
    }

    indicadores = {}
    for chave, t in THRESHOLDS.items():
        v = valores.get(chave)
        avali = avaliar(v, t)
        indicadores[chave] = {**t, "valor": v, **avali}

    score = calcular_score(indicadores)

    # Matrizes (mantidas)
    starting = [0, 100, 200, 300, 400, 500, 600, 700]
    deficit_levels = [0, 5, 10, 15, 20, 25, 30]
    gap_levels = [-3, -2, -1, 0, 1, 2, 3]

    matriz_def_end = matriz_debt_10y(starting, deficit_levels, g_nominal, g_nominal)
    matriz_def_chg = matriz_change_10y(starting, deficit_levels, g_nominal, g_nominal)

    pd_br = pd_pct_receita if pd_pct_receita is not None else 12.0
    matriz_gap_end = matriz_debt_por_gap(starting, gap_levels, pd_br, g_nominal)
    matriz_gap_chg = [[round(v - starting[i], 1) for v in row] for i, row in enumerate(matriz_gap_end)]

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
            "pib_real_yoy_pct": pib_real_yoy_pct,
            "ipca_12m_pct": ipca_12m_pct,
            "selic_real_ex_post_pct": selic_real,
            "g_nominal_aa_pct": round(g_nominal * 100, 2),
            "i_nominal_aa_pct": round(i_nominal * 100, 2),
            "gap_i_menos_g_pp": round(gap_pp, 2),
        },
    }

    payload = {
        "schema_version": 2,
        "gerado_em": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "fonte_base": cl.get("mes_recente"),
        "foto_brasil": foto,
        "score_semaforo": score,
        "indicadores_semaforo": indicadores,
        "categorias_ordem": ["Carga", "Capacidade", "Estrutura", "Stress", "Levers"],
        "trajetoria_br_pct_receita": traj_br,
        "matrizes": {
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
            "change_por_deficit": {
                "titulo": "Mudanca em 10 anos (pp)",
                "subtitulo": "Variando deficit primario, assumindo i = g",
                "eixo_y_starting": starting,
                "eixo_x_deficit": deficit_levels,
                "valores": matriz_def_chg,
            },
            "endlevel_por_gap": {
                "titulo": "Debt-to-Income apos 10 anos",
                "subtitulo": f"Variando (i - g), deficit primario constante {round(pd_br, 1)}% Receita",
                "eixo_y_starting": starting,
                "eixo_x_gap_pp": gap_levels,
                "valores": matriz_gap_end,
                "brasil": {
                    "starting": round(debt_pct_receita, 0) if debt_pct_receita else None,
                    "gap_pp": round(gap_pp, 0),
                },
            },
            "change_por_gap": {
                "titulo": "Mudanca em 10 anos (pp)",
                "subtitulo": "Variando (i - g), deficit constante",
                "eixo_y_starting": starting,
                "eixo_x_gap_pp": gap_levels,
                "valores": matriz_gap_chg,
            },
        },
        "levers": levers,
        "premissas": {
            "i_nominal_aa": round(i_nominal * 100, 2),
            "g_nominal_aa": round(g_nominal * 100, 2),
            "primary_deficit_pct_receita": round(pd_pct_receita, 2) if pd_pct_receita is not None else None,
            "debt_pct_receita": round(debt_pct_receita, 2) if debt_pct_receita else None,
            "anos_projecao": 10,
        },
        "metodologia": (
            "Termometro Fiscal baseado em 'How Countries Go Broke' (Ray Dalio, 2025). "
            "20 indicadores semaforizados em 5 categorias (Carga, Capacidade, Estrutura, Stress, Levers) — "
            "FAIXAS CALIBRADAS PELA AZ a partir dos casos historicos do livro, nao numeros do livro. "
            "r, g, r-g e primario estabilizador vem do bloco 'sustentabilidade' do fiscal-classicos v2 "
            "(taxa implicita da DLSP x PIB nominal 12m YoY, perimetro unico do setor publico consolidado) — "
            "calculados UMA vez no pipeline; nenhum componente do front recalcula. "
            "Equacao iterativa Debt(t+1)/Income(t+1) = [Debt(t)*(1+i) + Primary_Deficit(t)] / [Income(t)*(1+g)], "
            "matrizes Debt-to-Income apos 10 anos variando deficit e gap (i-g), e os 4 Levers calculados isoladamente. "
            "Variaveis em tempo real: BCB SGS, Tesouro RTN, IBGE."
        ),
    }

    out_file = out_dir / "fiscal-termometro.json"
    out_file.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    size = out_file.stat().st_size
    print(f"  -> {out_file} ({size / 1024:.1f} KB)")
    print(f"  Score: {score}")
    print(f"  Indicadores com nivel break: {[k for k, v in indicadores.items() if v['nivel'] == 'break']}")

    if args.upload:
        maybe_upload_json(out_file, BLOB_PATH)


if __name__ == "__main__":
    main()
