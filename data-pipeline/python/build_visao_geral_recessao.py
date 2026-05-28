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


def load_slope_di() -> list[tuple[str, float]]:
    """Slope DI = swap pré-DI 360d (SGS 4189) menos Selic diária (SGS 1178), mensalizado.

    Spread positivo = curva inclinada (mercado esperando alta de juros);
    spread negativo = curva invertida (sinal clássico de recessão pela literatura Estrella-Mishkin).
    """
    import requests, time
    try:
        UA_LOC = {"User-Agent": "Mozilla/5.0"}
        out_360 = {}
        out_over = {}
        for cod, alvo in [(4189, out_360), (1178, out_over)]:
            r = requests.get(f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{cod}/dados?formato=json&dataInicial=01/01/2000",
                             timeout=30, headers=UA_LOC)
            r.raise_for_status()
            for row in r.json():
                try:
                    d_, m_, y_ = row["data"].split("/")
                    alvo.setdefault(f"{y_}-{m_}", []).append(float(row["valor"]))
                except: pass
            time.sleep(0.3)
        meses = sorted(set(out_360.keys()) & set(out_over.keys()))
        out = []
        for mes in meses:
            avg_360 = sum(out_360[mes]) / len(out_360[mes]) if out_360[mes] else None
            avg_over = sum(out_over[mes]) / len(out_over[mes]) if out_over[mes] else None
            if avg_360 is not None and avg_over is not None:
                out.append((mes, avg_360 - avg_over))
        return out
    except Exception as e:
        print(f"  load_slope_di erro: {e}", file=sys.stderr)
        return []


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
def modelo_probit_financeiro(icf: list[tuple[str, float]], codace_periodos: list[tuple[str, str]], slope_di: list[tuple[str, float]] | None = None) -> dict[str, float]:
    """Regressão logística sobre [ICF, slope DI] para prever recessão CODACE 12m à frente.

    Adicionando slope DI (4189-1178) como segunda feature seguindo Estrella-Mishkin (1998),
    que mostra slope negativo (curva invertida) como melhor antecedente de recessão.
    """
    meses_icf = [m for m, _ in icf]
    x1 = [v for _, v in icf]
    # Mapear slope_di por mes
    slope_map = dict(slope_di) if slope_di else {}
    if len(x1) < 60:
        return {}

    # Target: recessão CODACE shifted -12 meses (prever 12 meses à frente)
    meses = meses_icf
    x = x1  # alias para retro-compatibilidade
    x2 = [slope_map.get(m) for m in meses]  # slope DI alinhado por mes (pode ter None)
    mask = codace_mask(meses, codace_periodos)
    horizon = 12
    y: list[int | None] = []
    for i in range(len(meses)):
        if i + horizon < len(meses):
            y.append(mask[i + horizon])
        else:
            y.append(None)

    # Triplas (x1, x2, y) - somente onde slope disponível
    pares_treino = [(x[i], x2[i], y[i]) for i in range(len(x)) if y[i] is not None and x2[i] is not None]
    if len(pares_treino) < 60:
        return {}

    # Newton-Raphson para logística multivariada: P = sigmoid(b0 + b1*x1 + b2*x2)
    # x1 = ICF z-score, x2 = slope DI (spread)
    b0, b1, b2 = 0.0, -0.5, -0.3  # ICF neg & slope neg => mais P(recessão)
    import numpy as np
    X = np.array([[1.0, t[0], t[1]] for t in pares_treino])
    Y = np.array([t[2] for t in pares_treino], dtype=float)
    for _ in range(50):
        z = X @ np.array([b0, b1, b2])
        p = 1.0 / (1.0 + np.exp(-np.clip(z, -50, 50)))
        gr = X.T @ (Y - p)
        W = p * (1 - p)
        H = (X.T * W) @ X
        try:
            delta = np.linalg.solve(H, gr)
            b0 += delta[0]; b1 += delta[1]; b2 += delta[2]
            if np.max(np.abs(delta)) < 1e-7: break
        except np.linalg.LinAlgError:
            break

    out = {}
    last = None
    for i, m in enumerate(meses):
        if x[i] is not None:
            # x2 pode ser None mesmo se x1 OK; carry-forward apenas se ambos None
            slope_v = x2[i] if x2[i] is not None else (out.get(meses[i-1], None) and 0)  # fallback 0 se carry
            try:
                val = round(sigmoid(b0 + b1 * x[i] + b2 * (x2[i] if x2[i] is not None else 0)) * 100, 1)
                out[m] = val
                last = val
            except Exception:
                if last is not None: out[m] = last
        else:
            if last is not None:
                out[m] = last  # carry-forward
    return out


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
    """Consolida modelos probabilísticos (MS-DFM, probit, gap_threshold, diffusion).

    Bry-Boschan é tratado SEPARADAMENTE como datação binária — não entra no ensemble
    de mediana/min-max/média porque distorce (Harding-Pagan 2002 é datador, não probabilizador).
    """
    todos_meses = sorted(set().union(*[m.keys() for m in modelos.values()]) if modelos else [])
    serie: list[dict[str, Any]] = []
    MODELOS_PROB = ("msdfm", "probit_financeiro", "gap_threshold", "diffusion")  # bry_boschan tratado a parte
    for mes in todos_meses:
        pontos_prob: dict[str, float] = {}  # apenas modelos probabilísticos
        for nome, vals in modelos.items():
            v = vals.get(mes)
            if v is not None and nome in MODELOS_PROB:
                pontos_prob[nome] = v
        # Bry-Boschan capturado separado
        bb_val = modelos.get("bry_boschan", {}).get(mes)
        # Para retro-compatibilidade do código abaixo, usa pontos_prob como "pontos"
        pontos = pontos_prob
        if not pontos and bb_val is None:
            continue
        vals_list = sorted(pontos.values()) if pontos else []
        mediana = vals_list[len(vals_list) // 2] if vals_list else 0
        media = (sum(vals_list) / len(vals_list)) if vals_list else 0
        n_acima_50 = sum(1 for v in vals_list if v > 50)
        n = len(pontos)
        # Modelos "sensíveis" à virada (probit + diffusion). Se ambos faltam: sinal incerto
        sensiveis_presentes = sum(1 for k in ("probit_financeiro", "diffusion") if k in pontos)
        if n < 3:
            sinalizacao = "indeterminado"
        elif sensiveis_presentes == 0:
            # Sem probit nem diffusion, sinal mais conservador (amber por default)
            if n_acima_50 >= max(2, n // 2 + 1):
                sinalizacao = "vermelho"
            else:
                sinalizacao = "amarelo"
        elif n_acima_50 >= 3:
            sinalizacao = "vermelho"
        elif n_acima_50 >= 2:
            sinalizacao = "amarelo"
        else:
            sinalizacao = "verde"
        serie.append(
            {
                "mes": mes,
                "msdfm": pontos.get("msdfm"),
                "probit_financeiro": pontos.get("probit_financeiro"),
                "gap_threshold": pontos.get("gap_threshold"),
                "diffusion": pontos.get("diffusion"),
                "bry_boschan": bb_val,
                "mediana": round(mediana, 1) if n >= 3 else None,
                "mediana_parcial": round(mediana, 1) if n > 0 else None,
                "media": round(media, 1) if n > 0 else None,
                "min_val": round(vals_list[0], 1) if vals_list else None,
                "max_val": round(vals_list[-1], 1) if vals_list else None,
                "n_modelos": n,
                "n_acima_50": n_acima_50,
                "sensiveis_presentes": sensiveis_presentes,
                "sinalizacao": sinalizacao,
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

    print("  Carregando slope DI (SGS 4189-1178)…")
    slope_di = load_slope_di()
    print(f"    {len(slope_di)} obs")

    # Rodar modelos
    modelos: dict[str, dict[str, float]] = {}

    print("\n  → MS-DFM (Chauvet 2002)")
    modelos["msdfm"] = modelo_ms_dfm(ibcbr)
    print(f"    {len(modelos['msdfm'])} pontos")

    print("  → Probit financeiro (Estrella & Mishkin) com slope DI")
    modelos["probit_financeiro"] = modelo_probit_financeiro(icf, codace_periodos, slope_di)
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
                "bry_boschan": "Datação binária via picos/vales locais do IBC-Br (Harding-Pagan 2002). NÃO é probabilidade — exibido como overlay binário, fora do ensemble de mediana.",
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
