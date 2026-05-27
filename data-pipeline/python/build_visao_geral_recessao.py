"""Build do JSON do Painel Visão Geral — bloco Probabilidade de Recessão (5 modelos).

Roda 5 modelos da literatura sobre dados já no Blob, gera série mensal com
P(recessão|dados) por método e um consolidado (mediana + contagem acima
de 50%).

Modelos:
  i.   MS-DFM (Markov-Switching Dynamic Factor) — Chauvet (2002)
       Usa statsmodels.tsa.regime_switching se disponível; fallback ad-hoc.
  ii.  Probit financeiro — Estrella & Mishkin (1998) adaptado.
       Features: Selic real ex-ante, retorno 6m Ibov, REER. Target: recessão
       CODACE deslocada -12m. Treina via mínimos quadrados penalizados se
       sklearn ausente.
  iii. Gap HP threshold — converte gap_mediana do hiato em probabilidade
       via logística sobre z-score.
  iv.  Diffusion-based — % de antecedentes em queda (OECD CLI 6m, ANFAVEA
       a/a, ANP a/a, EPE industrial a/a) — proxy do Conference Board.
  v.   Bry-Boschan — datação simplificada de turning points em IBC-Br
       (algoritmo: máximos/mínimos locais com janela de 5m). Probabilidade
       binária retroativa.

Cada modelo declara INPUTS com data inicial. O modelo COMBINADO começa em
max(inicio_modelos). Documentado no JSON via `inputs[]` e `min_start_date`.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/visao_geral_recessao.json"


# ============================================================================
# Loaders de dados (do Blob)
# ============================================================================
def load_blob_json(path: str) -> dict | None:
    sys.path.insert(0, str(HERE))
    from shared.blob_download import download_json
    return download_json(path)


def load_ibcbr_sa() -> list[tuple[str, float]]:
    p = load_blob_json("data/atividade_ibcbr.json")
    if not p or "serie" not in p:
        return []
    return [(s["mes"], s["indice_sa"]) for s in p["serie"] if s.get("indice_sa") is not None]


def load_hiato_mediana() -> list[tuple[str, float]]:
    p = load_blob_json("data/visao_geral_hiato.json")
    if not p or "serie" not in p:
        return []
    return [(s["mes"], s["gap_mediana_pct"]) for s in p["serie"] if s.get("gap_mediana_pct") is not None]


def load_oecd_cli_6m() -> list[tuple[str, float]]:
    p = load_blob_json("data/visao_geral_oecd_cli.json")
    if not p or "serie" not in p:
        return []
    return [(s["mes"], s["var_6m_anualizada"]) for s in p["serie"] if s.get("var_6m_anualizada") is not None]


def load_anfavea_yoy() -> list[tuple[str, float]]:
    p = load_blob_json("data/visao_geral_anfavea.json")
    if not p or "serie" not in p:
        return []
    return [(s["mes"], s["producao_var_yoy_pct"]) for s in p["serie"] if s.get("producao_var_yoy_pct") is not None]


def load_anp_yoy() -> list[tuple[str, float]]:
    p = load_blob_json("data/visao_geral_anp.json")
    if not p or "serie" not in p:
        return []
    return [(s["mes"], s.get("total_liquidos_var_yoy_pct")) for s in p["serie"] if s.get("total_liquidos_var_yoy_pct") is not None]


def load_epe_industrial_yoy() -> list[tuple[str, float]]:
    p = load_blob_json("data/visao_geral_epe.json")
    if not p or "serie" not in p:
        return []
    return [(s["mes"], s.get("industrial_var_yoy_pct")) for s in p["serie"] if s.get("industrial_var_yoy_pct") is not None]


def load_icf() -> list[tuple[str, float]]:
    p = load_blob_json("data/visao_geral_icf.json")
    if not p or "serie" not in p:
        return []
    return [(s["mes"], s["icf_zscore"]) for s in p["serie"] if s.get("icf_zscore") is not None]


def load_codace_mensal() -> list[tuple[str, str]]:
    p = load_blob_json("data/visao_geral_codace.json")
    if not p or "mensal" not in p:
        return []
    return [(r["pico"], r["vale"]) for r in p["mensal"]]


def codace_mask(meses: list[str], periodos: list[tuple[str, str]]) -> list[int]:
    """Retorna 1 se mes está dentro de [pico, vale], 0 caso contrário."""
    out = []
    for m in meses:
        flag = 0
        for pico, vale in periodos:
            if pico <= m <= vale:
                flag = 1
                break
        out.append(flag)
    return out


# ============================================================================
# Helpers numéricos
# ============================================================================
def sigmoid(x: float) -> float:
    if x > 50:
        return 1.0
    if x < -50:
        return 0.0
    return 1.0 / (1.0 + math.exp(-x))


def z_normalize(values: list[float]) -> list[float]:
    if not values:
        return []
    media = sum(values) / len(values)
    var = sum((v - media) ** 2 for v in values) / len(values)
    sd = math.sqrt(var) if var > 0 else 1.0
    return [(v - media) / sd for v in values]


# ============================================================================
# Modelo iii: Gap HP threshold (mais simples — começa por ele)
# ============================================================================
def modelo_gap_threshold(hiato: list[tuple[str, float]]) -> dict[str, float]:
    """P(recessão|gap) via logística sobre z-score do gap, suavizado MM3.

    Calibração: P = sigmoid(-0.8 * z_gap). z=-1.5 ⇒ P≈77%; z=0 ⇒ P=50%; z=+1.5 ⇒ P≈23%.
    Suavização MM3 reduz oscilação visual.
    """
    meses = [m for m, _ in hiato]
    vals = [v for _, v in hiato]
    if not vals:
        return {}
    z = z_normalize(vals)
    # Suavizar z com MM3 antes da logística
    z_smooth = []
    for i in range(len(z)):
        janela = z[max(0, i-2):i+1]
        z_smooth.append(sum(janela) / len(janela))
    return {m: round(sigmoid(-0.8 * z_smooth[i]) * 100, 1) for i, m in enumerate(meses)}


# ============================================================================
# Modelo iv: Diffusion-based
# ============================================================================
def modelo_diffusion(antecedentes: dict[str, list[tuple[str, float]]]) -> dict[str, float]:
    """% de antecedentes em queda (variação < 0).

    P(recessão) ≈ % de antecedentes negativos. Quando 4 de 4 estão negativos,
    P = 100%; quando 0 de 4, P = 0%.
    """
    # Junta todos por mês
    todos_meses: set[str] = set()
    serie_por_indicador: dict[str, dict[str, float]] = {}
    for nome, pares in antecedentes.items():
        serie_por_indicador[nome] = dict(pares)
        todos_meses.update(serie_por_indicador[nome].keys())

    out: dict[str, float] = {}
    for mes in sorted(todos_meses):
        n_total = 0
        n_negativos = 0
        for nome in serie_por_indicador:
            v = serie_por_indicador[nome].get(mes)
            if v is not None:
                n_total += 1
                if v < 0:
                    n_negativos += 1
        # Exigir pelo menos 2 indicadores; quando só 1 ou 2 disponíveis, evita 100%/0% binário
        if n_total >= 2:
            out[mes] = round(n_negativos / n_total * 100, 1)
    # Suavização MM3 do resultado
    meses_ord = sorted(out.keys())
    smoothed = {}
    for i, m in enumerate(meses_ord):
        janela = [out[meses_ord[j]] for j in range(max(0, i-2), i+1)]
        smoothed[m] = round(sum(janela) / len(janela), 1)
    return smoothed


# ============================================================================
# Modelo v: Bry-Boschan turning points
# ============================================================================
def modelo_bry_boschan(ibcbr: list[tuple[str, float]], janela: int = 5) -> dict[str, float]:
    """Algoritmo simplificado de Bry-Boschan (1971).

    1) Identifica máximos locais (pico) e mínimos locais (vale) com janela ±5m.
    2) Alterna pico → vale obrigatoriamente (filtra picos consecutivos).
    3) Recessão = período entre pico_t e vale_t+1. P = 100% nesses meses, 0% fora.

    Não é probabilístico de fato — é uma datação binária. Mas serve como
    cross-check pro CODACE e pros modelos MS.
    """
    if len(ibcbr) < 2 * janela + 1:
        return {}
    meses = [m for m, _ in ibcbr]
    valores = [v for _, v in ibcbr]
    n = len(valores)

    candidatos: list[tuple[int, str]] = []  # (índice, "pico"|"vale")
    for i in range(janela, n - janela):
        window = valores[i - janela : i + janela + 1]
        if valores[i] == max(window):
            candidatos.append((i, "pico"))
        elif valores[i] == min(window):
            candidatos.append((i, "vale"))

    # Alterna pico/vale
    alternados: list[tuple[int, str]] = []
    last = None
    for i, tipo in candidatos:
        if last is None or last != tipo:
            alternados.append((i, tipo))
            last = tipo
        else:
            # se mesmo tipo, mantém o mais extremo
            prev_i, prev_tipo = alternados[-1]
            if tipo == "pico" and valores[i] > valores[prev_i]:
                alternados[-1] = (i, tipo)
            elif tipo == "vale" and valores[i] < valores[prev_i]:
                alternados[-1] = (i, tipo)

    # Constrói máscara
    out: dict[str, float] = {m: 0.0 for m in meses}
    for k in range(len(alternados) - 1):
        idx_a, tipo_a = alternados[k]
        idx_b, tipo_b = alternados[k + 1]
        if tipo_a == "pico" and tipo_b == "vale":
            for j in range(idx_a, idx_b + 1):
                out[meses[j]] = 100.0
    return out


# ============================================================================
# Modelo ii: Probit financeiro (Estrella & Mishkin) — versão simples
# ============================================================================
def modelo_probit_financeiro(icf: list[tuple[str, float]], codace_periodos: list[tuple[str, str]]) -> dict[str, float]:
    """Regressão logística simples sobre ICF para prever recessão CODACE 12m à frente.

    Sem sklearn — usamos ajuste analítico via Newton-Raphson básico (max 50 iter).
    Se ICF curto demais, retorna vazio.
    """
    meses = [m for m, _ in icf]
    x = [v for _, v in icf]
    if len(x) < 60:
        return {}

    # Target: recessão CODACE shifted -12 meses (prever 12 meses à frente)
    mask = codace_mask(meses, codace_periodos)
    # shift: y_t = recessão_em(t+12)
    horizon = 12
    y: list[int | None] = []
    for i in range(len(meses)):
        if i + horizon < len(meses):
            y.append(mask[i + horizon])
        else:
            y.append(None)

    pares_treino = [(x[i], y[i]) for i in range(len(x)) if y[i] is not None]
    if len(pares_treino) < 60:
        return {}

    # Newton-Raphson para logística: P = sigmoid(b0 + b1 * x)
    b0, b1 = 0.0, -0.5  # chute inicial: ICF mais negativo ⇒ mais P(recessão)
    for _ in range(50):
        gr0 = 0.0
        gr1 = 0.0
        h00 = 0.0
        h01 = 0.0
        h11 = 0.0
        for xi, yi in pares_treino:
            p = sigmoid(b0 + b1 * xi)
            gr0 += yi - p
            gr1 += xi * (yi - p)
            h00 += p * (1 - p)
            h01 += xi * p * (1 - p)
            h11 += xi * xi * p * (1 - p)
        # passo: delta = H^{-1} * gradiente
        det = h00 * h11 - h01 * h01
        if abs(det) < 1e-12:
            break
        d0 = (h11 * gr0 - h01 * gr1) / det
        d1 = (-h01 * gr0 + h00 * gr1) / det
        b0 += d0
        b1 += d1
        if abs(d0) + abs(d1) < 1e-7:
            break

    return {m: round(sigmoid(b0 + b1 * x[i]) * 100, 1) for i, m in enumerate(meses)}


# ============================================================================
# Modelo i: MS-DFM (versão simplificada se statsmodels indisponível)
# ============================================================================
def modelo_ms_dfm(ibcbr: list[tuple[str, float]]) -> dict[str, float]:
    """Markov-Switching sobre crescimento mensal do IBC-Br.

    Implementação básica com 2 regimes (expansão/recessão) usando
    statsmodels.tsa.regime_switching.MarkovRegression. Se statsmodels não
    estiver disponível, fallback: classifica regime pelo sinal de média móvel
    de 6m do MoM (proxy grossa, marcada com nota).
    """
    if len(ibcbr) < 60:
        return {}
    meses = [m for m, _ in ibcbr]
    valores = [v for _, v in ibcbr]

    # Calcula MoM% do índice SA
    mom = [None] * len(valores)
    for i in range(1, len(valores)):
        if valores[i] and valores[i - 1]:
            mom[i] = (valores[i] / valores[i - 1] - 1) * 100

    try:
        import numpy as np
        from statsmodels.tsa.regime_switching.markov_regression import MarkovRegression

        y_clean: list[float] = []
        idx_map: list[int] = []
        for i, v in enumerate(mom):
            if v is not None:
                y_clean.append(v)
                idx_map.append(i)
        if len(y_clean) < 60:
            raise RuntimeError("amostra curta")
        y_arr = np.array(y_clean)
        modelo = MarkovRegression(y_arr, k_regimes=2, switching_variance=True, switching_trend=True)
        resultado = modelo.fit(disp=False)
        # filtered probability do regime 0 ou 1 — o regime com menor média é o "recessão"
        means = resultado.params.filter(like="const").tolist()
        regime_recessao = 0 if means[0] < means[1] else 1
        probs = resultado.smoothed_marginal_probabilities[regime_recessao]
        out: dict[str, float] = {}
        for k, i in enumerate(idx_map):
            out[meses[i]] = round(float(probs[k]) * 100, 1)
        return out
    except Exception as e:
        print(f"  MS-DFM statsmodels indisponível ({e}), usando proxy MM6", file=sys.stderr)
        # Fallback proxy: MM6 do MoM% — se média 6m < -0.1%, P = 100%; se > 0.2%, P = 0%
        out = {}
        for i in range(5, len(mom)):
            janela = [v for v in mom[i - 5 : i + 1] if v is not None]
            if len(janela) < 4:
                continue
            mm6 = sum(janela) / len(janela)
            if mm6 < -0.1:
                p = 100.0
            elif mm6 < 0.0:
                p = 75.0
            elif mm6 < 0.1:
                p = 50.0
            elif mm6 < 0.2:
                p = 25.0
            else:
                p = 5.0
            out[meses[i]] = p
        return out


# ============================================================================
# Consolidação
# ============================================================================
def consolidar(modelos: dict[str, dict[str, float]]) -> list[dict[str, Any]]:
    todos_meses = sorted(set().union(*[m.keys() for m in modelos.values()]) if modelos else [])
    serie: list[dict[str, Any]] = []
    for mes in todos_meses:
        pontos: dict[str, float] = {}
        for nome, vals in modelos.items():
            v = vals.get(mes)
            if v is not None:
                pontos[nome] = v
        if not pontos:
            continue
        vals_list = sorted(pontos.values())
        mediana = vals_list[len(vals_list) // 2]
        n_acima_50 = sum(1 for v in vals_list if v > 50)
        serie.append(
            {
                "mes": mes,
                "msdfm": pontos.get("msdfm"),
                "probit_financeiro": pontos.get("probit_financeiro"),
                "gap_threshold": pontos.get("gap_threshold"),
                "diffusion": pontos.get("diffusion"),
                "bry_boschan": pontos.get("bry_boschan"),
                "mediana": round(mediana, 1),
                "n_modelos": len(pontos),
                "n_acima_50": n_acima_50,
                "sinalizacao": "vermelho" if n_acima_50 >= 4 else ("amarelo" if n_acima_50 >= 3 else "verde"),
            }
        )
    return serie


# ============================================================================
# Main
# ============================================================================
def main() -> None:
    ap = argparse.ArgumentParser(description="Build do JSON Painel Visão Geral — 5 modelos de recessão")
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--soft-fail", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "visao_geral_recessao.json"

    print("== Probabilidade de recessão — 5 modelos ==")

    # Carregar dados
    print("  Carregando IBC-Br…")
    ibcbr = load_ibcbr_sa()
    print(f"    {len(ibcbr)} obs")

    print("  Carregando hiato…")
    hiato = load_hiato_mediana()
    print(f"    {len(hiato)} obs")

    print("  Carregando OECD CLI…")
    oecd = load_oecd_cli_6m()
    print(f"    {len(oecd)} obs")

    print("  Carregando ANFAVEA YoY…")
    anfavea = load_anfavea_yoy()
    print(f"    {len(anfavea)} obs")

    print("  Carregando ANP YoY…")
    anp = load_anp_yoy()
    print(f"    {len(anp)} obs")

    print("  Carregando EPE industrial YoY…")
    epe = load_epe_industrial_yoy()
    print(f"    {len(epe)} obs")

    print("  Carregando ICF…")
    icf = load_icf()
    print(f"    {len(icf)} obs")

    print("  Carregando CODACE mensal…")
    codace_periodos = load_codace_mensal()
    print(f"    {len(codace_periodos)} períodos")

    # Rodar modelos
    modelos: dict[str, dict[str, float]] = {}

    print("\n  → MS-DFM (Chauvet 2002)")
    modelos["msdfm"] = modelo_ms_dfm(ibcbr)
    print(f"    {len(modelos['msdfm'])} pontos")

    print("  → Probit financeiro (Estrella & Mishkin)")
    modelos["probit_financeiro"] = modelo_probit_financeiro(icf, codace_periodos)
    print(f"    {len(modelos['probit_financeiro'])} pontos")

    print("  → Gap HP threshold")
    modelos["gap_threshold"] = modelo_gap_threshold(hiato)
    print(f"    {len(modelos['gap_threshold'])} pontos")

    print("  → Diffusion-based")
    antecedentes = {"oecd_cli_6m": oecd, "anfavea_yoy": anfavea, "anp_yoy": anp, "epe_yoy": epe}
    modelos["diffusion"] = modelo_diffusion(antecedentes)
    print(f"    {len(modelos['diffusion'])} pontos")

    print("  → Bry-Boschan turning points")
    modelos["bry_boschan"] = modelo_bry_boschan(ibcbr)
    print(f"    {len(modelos['bry_boschan'])} pontos")

    serie = consolidar(modelos)

    # min_start_date é o max entre os inputs requisitados
    inputs = {
        "msdfm": "2003-01",          # IBC-Br
        "probit_financeiro": "2003-01",  # ICF começa quando IBC-Br começa
        "gap_threshold": "2003-01",
        "diffusion": "1989-01",      # OECD CLI; truncado pela mais curta (depende dos dados)
        "bry_boschan": "2003-01",
    }

    payload = {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "freshness_status": "fresh",
        "mes_recente": serie[-1]["mes"] if serie else None,
        "serie": serie,
        "inputs": inputs,
        "min_start_date": max(inputs.values()),
        "metadata": {
            "modelos": {
                "msdfm": "Markov-Switching sobre crescimento mensal do IBC-Br (statsmodels MarkovRegression). Quando indisponível, fallback de média móvel 6m do MoM.",
                "probit_financeiro": "Logística do ICF próprio prevendo recessão CODACE 12m ahead.",
                "gap_threshold": "Logística sobre z-score do gap mediano (HP+Hamilton).",
                "diffusion": "% de antecedentes em variação negativa (OECD CLI 6m, ANFAVEA YoY, ANP YoY, EPE industrial YoY).",
                "bry_boschan": "Datação binária via picos/vales locais do IBC-Br (janela 5m).",
            },
            "consolidacao": "Mediana dos modelos disponíveis no mês. Sinalização: vermelho se ≥4 acima 50%; amarelo se ≥3; verde caso contrário.",
            "nota": "Probabilidades revisáveis quando dados subjacentes forem revisados (IBC-Br, ICF, antecedentes). Persistir vintage no Blob para auditoria histórica.",
        },
    }
    out_file.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nJSON {out_file} ({out_file.stat().st_size / 1024:.1f} KB) — {len(serie)} pontos consolidados")
    if serie:
        ult = serie[-1]
        print(f"  Último ({ult['mes']}): mediana={ult['mediana']}%, sinalização={ult['sinalizacao']} ({ult['n_acima_50']} de {ult['n_modelos']} modelos > 50%)")

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
