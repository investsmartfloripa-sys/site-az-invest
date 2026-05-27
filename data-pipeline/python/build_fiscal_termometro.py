"""Termometro Fiscal — adaptacao para Brasil das formulas e tabelas de
"How Countries Go Broke" (Ray Dalio, 2025).

Le fiscal-classicos.json e gera:
- foto atual Brasil (KPIs Dalio-style)
- duas matrizes Debt-to-Income after 10 years (variando deficit / variando i-g)
- os 4 levers para estabilizar a divida

Output: data-pipeline/out/fiscal-termometro.json + upload Blob.

Convencao contabil:
- Primary Deficit POSITIVO = governo gasta mais que arrecada (oposta da STN)
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


def projetar_debt_to_income(d0, i_aa, g_aa, pd, anos=10):
    """R(t+1) = R(t) * (1+i)/(1+g) + primary_deficit_pct_revenue."""
    r = d0
    mult = (1 + i_aa) / (1 + g_aa)
    traj = [r]
    for _ in range(anos):
        r = r * mult + pd
        traj.append(round(r, 2))
    return traj


def matriz_debt_10y(starting, deficit_levels, i_aa, g_aa, anos=10):
    m = []
    for d0 in starting:
        row = []
        for pd in deficit_levels:
            traj = projetar_debt_to_income(d0, i_aa, g_aa, pd, anos)
            row.append(round(traj[-1], 1))
        m.append(row)
    return m


def matriz_change_10y(starting, deficit_levels, i_aa, g_aa, anos=10):
    m = []
    for d0 in starting:
        row = []
        for pd in deficit_levels:
            traj = projetar_debt_to_income(d0, i_aa, g_aa, pd, anos)
            row.append(round(traj[-1] - d0, 1))
        m.append(row)
    return m


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

    # Lever 1: i estavel
    i_estavel = g - (pd / 100) * (1 + g) / (d / 100)
    levers["lever_juros"] = {
        "i_estavel_aa": round(i_estavel * 100, 2),
        "i_atual_aa": round(i * 100, 2),
        "delta_pp": round((i_estavel - i) * 100, 2),
    }

    # Lever 2: inflacao estavel
    g_necessario = i + (pd / 100) * (1 + g) / (d / 100)
    g_real_atual = g - inflacao
    inflacao_necessaria = g_necessario - g_real_atual
    levers["lever_inflacao"] = {
        "inflacao_estavel_aa": round(inflacao_necessaria * 100, 2),
        "inflacao_atual_aa": round(inflacao * 100, 2),
        "delta_pp": round((inflacao_necessaria - inflacao) * 100, 2),
    }

    # Lever 3: corte de despesa
    pd_estavel = -(d / 100) * (i - g) / (1 + g)
    despesa_alvo_pct_rec = (1 + pd_estavel) * 100
    if despesa_pct_rec > 0:
        corte_pct = (despesa_pct_rec - despesa_alvo_pct_rec) / despesa_pct_rec * 100
        levers["lever_corte_despesa"] = {
            "corte_pct_da_despesa": round(corte_pct, 2),
            "despesa_atual_pct_receita": round(despesa_pct_rec, 2),
            "despesa_alvo_pct_receita": round(despesa_alvo_pct_rec, 2),
        }

    # Lever 4: aumento de receita
    if despesa_pct_rec > 0:
        receita_nova_idx = despesa_pct_rec / (100 + pd_estavel * 100)
        levers["lever_aumento_receita"] = {
            "aumento_pct_da_receita": round((receita_nova_idx - 1) * 100, 2),
        }

    return levers


def coletar_classicos(out_dir):
    local = out_dir / "fiscal-classicos.json"
    if local.exists():
        return json.loads(local.read_text(encoding="utf-8"))
    return download_json("data/fiscal-classicos.json")


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

    if pib_real_yoy_pct is None: pib_real_yoy_pct = 2.0
    if ipca_12m_pct is None: ipca_12m_pct = 4.5
    if selic_real is None: selic_real = 9.0

    debt_pct_receita = (dbgg_pct_pib / receita_pct_pib * 100) if (dbgg_pct_pib and receita_pct_pib) else None
    pd_pct_receita = -primario_pct_receita if primario_pct_receita is not None else None
    i_nominal = (juros_central_pct_pib / dbgg_pct_pib) if (juros_central_pct_pib and dbgg_pct_pib) else 0.10
    g_nominal = (pib_real_yoy_pct + ipca_12m_pct) / 100

    starting = [0, 100, 200, 300, 400, 500, 600, 700]
    deficit_levels = [0, 5, 10, 15, 20, 25, 30]
    gap_levels = [-3, -2, -1, 0, 1, 2, 3]

    matriz_def_end = matriz_debt_10y(starting, deficit_levels, g_nominal, g_nominal)
    matriz_def_chg = matriz_change_10y(starting, deficit_levels, g_nominal, g_nominal)

    pd_br = pd_pct_receita if pd_pct_receita is not None else 12.0
    matriz_gap_end = matriz_debt_por_gap(starting, gap_levels, pd_br, g_nominal)
    matriz_gap_chg = []
    for i_row, d0 in enumerate(starting):
        matriz_gap_chg.append([round(v - d0, 1) for v in matriz_gap_end[i_row]])

    levers = None
    if debt_pct_receita and pd_pct_receita is not None:
        levers = calcular_levers(
            d=debt_pct_receita, i=i_nominal, g=g_nominal, pd=pd_pct_receita,
            despesa_pct_rec=despesa_pct_receita or 100.0, inflacao=ipca_12m_pct / 100,
        )

    traj_br = None
    if debt_pct_receita is not None and pd_pct_receita is not None:
        traj_br = projetar_debt_to_income(debt_pct_receita, i_nominal, g_nominal, pd_pct_receita, 10)

    foto = {
        "divida": {
            "dbgg_pct_pib": dbgg_pct_pib,
            "dbgg_pct_receita": round(debt_pct_receita, 2) if debt_pct_receita else None,
        },
        "receita": {"receita_liquida_pct_pib": receita_pct_pib},
        "gastos": {
            "despesa_total_pct_pib": despesa_pct_pib,
            "despesa_total_pct_receita": despesa_pct_receita,
        },
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
            "gap_i_menos_g_pp": round((i_nominal - g_nominal) * 100, 2),
        },
    }

    payload = {
        "gerado_em": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "fonte_base": cl.get("mes_recente"),
        "foto_brasil": foto,
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
                    "gap_pp": round((i_nominal - g_nominal) * 100, 0),
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
            "Baseado em How Countries Go Broke (Ray Dalio, 2025) cap. The Mechanics. "
            "Equacao iterativa: Debt(t+1)/Income(t+1) = [Debt(t)*(1+i) + Primary_Deficit(t)] / [Income(t)*(1+g)]. "
            "Variaveis em tempo real: BCB SGS, Tesouro RTN, IBGE. "
            "Os 4 levers calculam o ajuste isolado em cada via para estabilizar divida."
        ),
    }

    out_file = out_dir / "fiscal-termometro.json"
    out_file.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    size = out_file.stat().st_size
    print(f"  -> {out_file} ({size / 1024:.1f} KB)")
    print(f"  Debt/Receita: {debt_pct_receita}  PrimDef/Receita: {pd_pct_receita}")
    print(f"  i: {i_nominal*100:.2f}%  g: {g_nominal*100:.2f}%  gap: {(i_nominal-g_nominal)*100:.2f}pp")
    if traj_br:
        print(f"  Traj 10y: {traj_br[0]:.0f}% -> {traj_br[-1]:.0f}%")

    if args.upload:
        maybe_upload_json(out_file, BLOB_PATH)


if __name__ == "__main__":
    main()
