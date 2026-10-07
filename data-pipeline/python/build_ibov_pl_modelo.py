"""Build do modelo P/L do Ibovespa × juros reais (Bolsa → Analítico).

Output: data/ibov_pl_modelo.json (consumido por src/lib/painel-acoes.ts → AcoesPlModelo).

Pergunta: que P/L o nível dos juros reais (e as expectativas) justifica para a bolsa hoje?

  Y  = P/L do Ibovespa no último dia útil do mês (build_acoes_valuation.py → pl_mensal).
  X  = MÉDIA MENSAL das explicativas — o tratamento é só nas explicativas (decisão do dono,
       ago/2026: suavizar o Y infla o R² mecanicamente):
    real_selic    (1 + Selic meta, SGS 432) / (1 + Focus IPCA 12m suavizada, mediana) − 1
    real_5a       NTN-B em prazo constante de 5 anos — PCHIP sobre a curva IPCA do
                  data/treasury_history.json, só interpola (nunca extrapola)
    real_30a      idem, 30 anos
    dselic_e      Selic esperada em 12m (Focus anual interpolado, ancorado na Selic meta) − Selic meta
    us10_real     Treasury 10 anos indexada à inflação (US Treasury; = FRED DFII10)
    cupom_real_e  cupom cambial esperado (paridade coberta com Focus de Selic e câmbio) deflacionado
                  pela inflação implícita de 10 anos dos EUA (nominal − real; = FRED T10YIE)
    t_us10        us10_real − us10_real 12 meses antes (calendário mensal completo)

Forma (revisão de 07/10/2026): o Y estimado é o LUCRO SOBRE PREÇO (EY = 100 / P/L, em %).
Pelo modelo de Gordon, P/L = 1/(k − g) com k = juro real + prêmio: o P/L é convexo nos juros
e o EY é linear. Com o P/L direto o teste RESET reprovava a forma funcional (p = 0,014); com
o EY passa (p = 0,07) e o erro fora da amostra (janela crescente, últimos 72 meses) caiu de
1,53x para 1,29x de P/L. O justificado volta para P/L como 100 / EY ajustado.

Modelos (MQO, erro-padrão HAC Newey-West com 6 defasagens):
  só juros : EY ~ real_selic + real_5a + real_30a
  completo : EY ~ as 7 variáveis
Relação de longo prazo à Engle-Granger (resíduo estacionário) + ECM p/ a meia-vida.
Amostra = meses COMPLETOS desde o primeiro mês com todas as séries (buracos de cobertura
do P/L preservados). O mês corrente entra só como ponto "hoje" (média do mês até a data).
Reestimado a cada fechamento de mês; a linha histórica do justificado muda pouco a cada
reestimação (in-sample).

Trava: se a estimação nova falhar (amostra curta, R² baixo, resíduo não estacionário,
justificado fora de [3; 30]), o upload é abortado e o site segue com o último modelo bom.

Uso:
    python data-pipeline/python/build_ibov_pl_modelo.py --out-dir data-pipeline/out --upload
"""
from __future__ import annotations

import argparse
import io
import json
import os
import sys
import time
import warnings
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
import requests
import statsmodels.api as sm
from scipy.interpolate import PchipInterpolator
from statsmodels.stats.outliers_influence import variance_inflation_factor
from statsmodels.stats.diagnostic import linear_reset
from statsmodels.tsa.stattools import adfuller

sys.path.append(str(Path(__file__).parent))
from shared.blob_upload import maybe_upload_json  # noqa: E402
from shared.blob_download import download_json  # noqa: E402

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0", "Accept": "*/*"}
BLOB_OUT = "data/ibov_pl_modelo.json"
SCHEMA_VERSION = 2  # 2 = modelo no lucro sobre preço; dispersões com pontos/curva
INICIO_DADOS = "2008-01-01"     # explicativas baixadas desde aqui (t_us10 precisa de 12m antes)
PISO_AMOSTRA = "2010-01"        # amostra começa no 1º mês com tudo, nunca antes disto
HAC_LAGS = 6
FFILL_DIAS_UTEIS = 22           # fonte parada há mais que isso some do mês (vira buraco)
DEFASAGEM_AVISO = 5             # dias úteis sem dado novo -> aviso na página
OLINDA = "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata"

# Estrutura do modelo aprovado no protótipo (ago/2026)
JUROS = ["real_selic", "real_5a", "real_30a"]
COMPLETO = JUROS + ["dselic_e", "us10_real", "cupom_real_e", "t_us10"]
BLOCOS_F = [
    ("curva", "Juros reais (Selic, 5 e 30 anos)", "real_selic = real_5a = real_30a = 0"),
    ("externo", "Exterior (juro real EUA e cupom cambial real)", "us10_real = cupom_real_e = 0"),
    ("direcao", "Direção (Selic esperada e tendência EUA)", "dselic_e = t_us10 = 0"),
]
VARS = {
    "real_selic": {"nome": "Selic real (curto prazo)", "unidade": "%", "tipo": "nível",
                   "formula": "(1 + Selic meta) ÷ (1 + IPCA esperado em 12 meses, Focus) − 1"},
    "real_5a": {"nome": "Juro real de 5 anos", "unidade": "%", "tipo": "nível",
                "formula": "NTN-B em prazo constante de 5 anos (interpolação PCHIP da curva)"},
    "real_30a": {"nome": "Juro real de 30 anos", "unidade": "%", "tipo": "nível",
                 "formula": "NTN-B em prazo constante de 30 anos (interpolação PCHIP da curva)"},
    "dselic_e": {"nome": "Mudança esperada da Selic", "unidade": "p.p.", "tipo": "direção",
                 "formula": "Selic esperada daqui a 12 meses (Focus) − Selic meta de hoje"},
    "us10_real": {"nome": "Juro real dos EUA (10 anos)", "unidade": "%", "tipo": "nível",
                  "formula": "Treasury de 10 anos indexada à inflação (TIPS, US Treasury)"},
    "cupom_real_e": {"nome": "Cupom cambial real esperado", "unidade": "%", "tipo": "nível",
                     "formula": "juro em dólar implícito no Focus (Selic e câmbio esperados) descontada "
                                "a inflação implícita de 10 anos dos EUA (Treasury nominal − TIPS)"},
    "t_us10": {"nome": "Tendência do juro real dos EUA", "unidade": "p.p.", "tipo": "direção",
               "formula": "juro real dos EUA de 10 anos hoje − o de 12 meses antes"},
}


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------

def _get(url: str, *, timeout: int = 90, retries: int = 4, sleep: float = 4.0) -> requests.Response:
    last: Optional[Exception] = None
    for i in range(retries):
        try:
            r = requests.get(url, timeout=timeout, headers=UA)
            r.raise_for_status()
            return r
        except Exception as e:  # noqa: BLE001
            last = e
            print(f"  retry {i + 1}/{retries}: {repr(e)[:100]}", file=sys.stderr)
            time.sleep(sleep)
    raise RuntimeError(f"falha após {retries} tentativas: {last}")


def _get_json(url: str, *, timeout: int = 90, retries: int = 4, sleep: float = 4.0):
    """GET + JSON com retry também quando a fonte responde 200 com corpo vazio ou HTML
    (falha intermitente do SGS/Olinda que o raise_for_status não pega)."""
    last: Optional[Exception] = None
    for i in range(retries):
        try:
            return _get(url, timeout=timeout, retries=1).json()
        except Exception as e:  # noqa: BLE001
            last = e
            print(f"  json retry {i + 1}/{retries}: {repr(e)[:100]}", file=sys.stderr)
            time.sleep(sleep)
    raise RuntimeError(f"JSON inválido após {retries} tentativas ({url[:80]}...): {last}")


def sgs_diaria(cod: int, ini_ano: int = 2008) -> pd.Series:
    """Série diária do SGS em janelas de 5 anos (limite da API)."""
    out: Dict[pd.Timestamp, float] = {}
    fim_ano = datetime.now().year + 1
    for a in range(ini_ano, fim_ano, 5):
        b = min(a + 5, fim_ano)
        url = (f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{cod}/dados?formato=json"
               f"&dataInicial=01/01/{a}&dataFinal=31/12/{b - 1}")
        j = _get_json(url, timeout=60)
        if not isinstance(j, list):
            raise RuntimeError(f"SGS {cod} {a}-{b - 1}: resposta inesperada")
        for x in j:
            if isinstance(x, dict) and x.get("valor") not in (None, ""):
                out[pd.to_datetime(x["data"], dayfirst=True)] = float(x["valor"])
    s = pd.Series(out, dtype="float64").sort_index()
    print(f"  SGS {cod}: {len(s)} dias até {s.index.max().date()}")
    return s


def focus_ipca_12m() -> pd.Series:
    """Focus IPCA 12 meses à frente, mediana SUAVIZADA (mesma série do ICF)."""
    url = (f"{OLINDA}/ExpectativasMercadoInflacao12Meses"
           "?$filter=Indicador%20eq%20%27IPCA%27%20and%20Suavizada%20eq%20%27S%27%20and%20baseCalculo%20eq%200"
           "&$select=Data,Mediana&$format=json&$top=30000")
    v = _get_json(url, timeout=120).get("value", [])
    s = pd.Series({pd.Timestamp(x["Data"]): float(x["Mediana"]) for x in v if x.get("Mediana") is not None})
    s = s[~s.index.duplicated(keep="last")].sort_index()
    print(f"  Focus IPCA 12m: {len(s)} dias até {s.index.max().date()}")
    return s


def focus_anuais(indicador_url: str) -> Dict[pd.Timestamp, Dict[int, float]]:
    """{Data: {ano de referência: mediana}} do Focus anual (baseCalculo 0)."""
    rows: List[Dict] = []
    skip = 0
    while True:
        url = (f"{OLINDA}/ExpectativasMercadoAnuais?$format=json&$select=Data,DataReferencia,Mediana"
               f"&$filter=Indicador%20eq%20'{indicador_url}'%20and%20baseCalculo%20eq%200"
               f"%20and%20Data%20ge%20'{INICIO_DADOS}'&$orderby=Data&$top=10000&$skip={skip}")
        v = _get_json(url, timeout=180).get("value", [])
        if not v:
            break
        rows += v
        skip += len(v)
        if len(v) < 10000 or skip > 600000:
            break
    out: Dict[pd.Timestamp, Dict[int, float]] = {}
    for r in rows:
        try:
            out.setdefault(pd.Timestamp(r["Data"]), {})[int(r["DataReferencia"])] = float(r["Mediana"])
        except (TypeError, ValueError, KeyError):
            continue
    print(f"  Focus anual {indicador_url}: {len(rows)} linhas, {len(out)} datas")
    return out


def esperado_12m(exp: Dict[pd.Timestamp, Dict[int, float]], spot: pd.Series) -> pd.Series:
    """Expectativa para t+12m: ancora no valor à vista em t e nas medianas de fim de ano,
    interpolação linear no tempo (mesma regra do protótipo)."""
    spot_al = spot.reindex(spot.index.union(pd.DatetimeIndex(list(exp)))).ffill()
    out = {}
    for t, refs in exp.items():
        if t not in spot_al.index or pd.isna(spot_al.loc[t]):
            continue
        alvo = t + pd.DateOffset(months=12)
        xs, ys = [t.value], [float(spot_al.loc[t])]
        for ano in sorted(refs):
            fim = pd.Timestamp(year=ano, month=12, day=31)
            if fim > t:
                xs.append(fim.value)
                ys.append(refs[ano])
        if len(xs) < 2 or alvo.value > xs[-1]:
            continue
        out[t] = float(np.interp(alvo.value, xs, ys))
    return pd.Series(out, dtype="float64").sort_index()


def fred(series_id: str, start: str = INICIO_DADOS) -> pd.Series:
    """FRED pela API oficial (FRED_API_KEY) ou fredgraph.csv recortado (sem chave)."""
    key = os.environ.get("FRED_API_KEY", "").strip()
    out: Dict[pd.Timestamp, float] = {}
    if key:
        url = ("https://api.stlouisfed.org/fred/series/observations"
               f"?series_id={series_id}&api_key={key}&file_type=json&observation_start={start}")
        for o in _get_json(url).get("observations", []):
            try:
                out[pd.Timestamp(o["date"])] = float(o["value"])
            except (TypeError, ValueError):
                continue
    else:
        hoje = datetime.now(timezone.utc).date().isoformat()
        url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}&cosd={start}&coed={hoje}"
        df = pd.read_csv(io.StringIO(_get(url).text))
        df.columns = ["d", "v"]
        df["v"] = pd.to_numeric(df["v"], errors="coerce")
        out = {pd.Timestamp(d): float(v) for d, v in zip(df["d"], df["v"]) if pd.notna(v)}
    s = pd.Series(out, dtype="float64").sort_index()
    print(f"  FRED {series_id}: {len(s)} dias até {s.index.max().date()} ({'API' if key else 'fredgraph'})")
    return s


def tesouro_eua_10a(ano_ini: int = 2008) -> Tuple[pd.Series, pd.Series]:
    """Juro real (TIPS) e nominal de 10 anos direto do US Treasury (fonte das séries
    DFII10 e DGS10 do FRED). Inflação implícita = nominal − real (= FRED T10YIE)."""
    base = ("https://home.treasury.gov/resource-center/data-chart-center/interest-rates/"
            "daily-treasury-rates.csv/{ano}/all?type={tipo}&field_tdr_date_value={ano}&page&_format=csv")
    out = {}
    for tipo, col in [("daily_treasury_real_yield_curve", "10 YR"), ("daily_treasury_yield_curve", "10 Yr")]:
        partes = []
        for ano in range(ano_ini, datetime.now().year + 1):
            df = pd.read_csv(io.StringIO(_get(base.format(ano=ano, tipo=tipo), timeout=60).text))
            if col in df.columns:
                partes.append(pd.Series(pd.to_numeric(df[col], errors="coerce").values,
                                        index=pd.to_datetime(df["Date"], format="%m/%d/%Y")))
        s = pd.concat(partes).dropna().sort_index()
        out[tipo] = s[~s.index.duplicated(keep="last")]
    real, nom = out["daily_treasury_real_yield_curve"], out["daily_treasury_yield_curve"]
    print(f"  US Treasury 10a: real {len(real)} dias, nominal {len(nom)} dias até {real.index.max().date()}")
    return real, (nom - real).dropna()


def eua_10a() -> Tuple[pd.Series, pd.Series, str]:
    """(juro real 10a, inflação implícita 10a, rota). US Treasury primeiro; FRED de reserva."""
    try:
        r, be = tesouro_eua_10a()
        return r, be, "US Treasury (par real e nominal 10 anos)"
    except Exception as e:  # noqa: BLE001
        print(f"  [WARN] US Treasury falhou, tentando FRED: {repr(e)[:100]}", file=sys.stderr)
    return fred("DFII10"), fred("T10YIE"), "FRED DFII10 / T10YIE"


# ---------------------------------------------------------------------------
# Curva real em prazo constante (NTN-B) a partir do treasury_history.json do site
# ---------------------------------------------------------------------------

def curva_real(alvos=(5.0, 30.0)) -> pd.DataFrame:
    th = download_json("data/treasury_history.json")
    if not th:
        raise RuntimeError("treasury_history.json indisponível no Blob")
    series = ((th.get("categories") or {}).get("IPCA") or {}).get("series") or {}
    por_data: Dict[pd.Timestamp, List[Tuple[float, float]]] = {}
    for venc, pts in series.items():
        try:
            mat = pd.Timestamp(venc)
        except Exception:  # noqa: BLE001
            continue
        for p in pts:
            try:
                d, y = pd.Timestamp(p[0]).normalize(), float(p[1])
            except Exception:  # noqa: BLE001
                continue
            prazo = (mat - d).days / 365.25
            if prazo > 0 and 0 < y < 30:
                por_data.setdefault(d, []).append((prazo, y))
    linhas = {}
    for d, pp in por_data.items():
        xs = np.array([p[0] for p in pp])
        ys = np.array([p[1] for p in pp])
        ux, inv = np.unique(np.round(xs, 3), return_inverse=True)
        uy = np.array([ys[inv == i].mean() for i in range(len(ux))])
        if len(ux) < 2:
            continue
        f = PchipInterpolator(ux, uy) if len(ux) >= 3 else None
        row = {}
        for a in alvos:
            if ux.min() <= a <= ux.max():  # só interpola, nunca extrapola
                row[f"real_{int(a)}a"] = float(f(a)) if f is not None else float(np.interp(a, ux, uy))
        if row:
            linhas[d] = row
    df = pd.DataFrame(linhas).T.sort_index()
    df.index = pd.DatetimeIndex(df.index)
    print(f"  curva real (treasury_history): {len(df)} dias até {df.index.max().date()} | "
          + ", ".join(f"{c}: {df[c].notna().sum()}" for c in df.columns))
    return df


# ---------------------------------------------------------------------------
# P/L mensal (Y)
# ---------------------------------------------------------------------------

def carregar_pl(out_dir: Path) -> Tuple[pd.DataFrame, str]:
    """pl_mensal do valuation recém-gerado no MESMO job (out/) ou, na falta, do Blob."""
    local = out_dir / "acoes_valuation.json"
    val = None
    if local.exists():
        try:
            val = json.loads(local.read_text(encoding="utf-8"))
            if val.get("status") != "ok" or not val.get("pl_mensal"):
                val = None
            else:
                print(f"  P/L: {local} (gerado neste job)")
        except Exception:  # noqa: BLE001
            val = None
    if val is None:
        val = download_json("data/acoes_valuation.json")
        print("  P/L: data/acoes_valuation.json do Blob")
    if not val or not val.get("pl_mensal"):
        raise RuntimeError("acoes_valuation.json sem pl_mensal (schema >= 2)")
    df = pd.DataFrame(val["pl_mensal"])
    df["mes"] = pd.to_datetime(df["date"]).dt.to_period("M")
    df = df.set_index("mes").sort_index()
    return df, str(val.get("last_data_date") or df["date"].iloc[-1])


# ---------------------------------------------------------------------------
# Estimação
# ---------------------------------------------------------------------------

def ols_hac(y: pd.Series, X: pd.DataFrame):
    return sm.OLS(y, sm.add_constant(X)).fit(cov_type="HAC", cov_kwds={"maxlags": HAC_LAGS})


def ajuste_com_ic(res, x: pd.Series) -> Tuple[float, float, float]:
    g = np.r_[1.0, x.values.astype(float)]
    v = float(g @ res.params.values)
    se = float(np.sqrt(g @ res.cov_params().values @ g))
    return v, v - 1.96 * se, v + 1.96 * se


def meses_buracos(meses: pd.PeriodIndex) -> List[List[str]]:
    out = []
    for a, b in zip(meses[:-1], meses[1:]):
        if (b - a).n > 1:
            out.append([str(a + 1), str(b - 1)])
    return out


def _r(v, n=3):
    if v is None:
        return None
    try:
        v = float(np.asarray(v, dtype="float64").squeeze())
    except (TypeError, ValueError):
        return None
    return round(v, n) if np.isfinite(v) else None


def build(out_dir: Path) -> Dict:
    agora = datetime.now(timezone.utc)
    print("[pl_modelo] Y — P/L mensal...")
    pl, last_data = carregar_pl(out_dir)

    print("[pl_modelo] explicativas...")
    curva = curva_real()
    selic = sgs_diaria(432)
    usd = sgs_diaria(1)
    ipca_e = focus_ipca_12m()
    sel_e12 = esperado_12m(focus_anuais("Selic"), selic)
    cam_e12 = esperado_12m(focus_anuais("C%C3%A2mbio"), usd)
    us10, be10, rota_eua = eua_10a()

    fontes_ult = {
        "NTN-B (treasury_history)": curva.dropna(how="all").index.max(),
        "Selic meta (SGS 432)": selic.index.max(), "Dólar (SGS 1)": usd.index.max(),
        "Focus IPCA 12m": ipca_e.index.max(), "Focus Selic": sel_e12.index.max(),
        "Focus câmbio": cam_e12.index.max(), "Juro real EUA 10a": us10.index.max(),
        "Inflação implícita EUA 10a": be10.index.max(),
    }

    fim = pd.Timestamp(last_data)
    dias = pd.bdate_range(INICIO_DADOS, fim)
    def al(s: pd.Series) -> pd.Series:
        return s.reindex(s.index.union(dias)).ffill(limit=FFILL_DIAS_UTEIS).reindex(dias)

    X = pd.DataFrame(index=dias)
    X["real_5a"] = al(curva["real_5a"].dropna())
    X["real_30a"] = al(curva["real_30a"].dropna())
    sel, ipe = al(selic), al(ipca_e)
    X["real_selic"] = ((1 + sel / 100) / (1 + ipe / 100) - 1) * 100
    se12, ce12, us = al(sel_e12), al(cam_e12), al(usd)
    X["dselic_e"] = se12 - sel
    X["us10_real"] = al(us10)
    dep = (ce12 / us - 1) * 100
    nom = ((1 + se12 / 100) / (1 + dep / 100) - 1) * 100
    X["cupom_real_e"] = ((1 + nom / 100) / (1 + al(be10) / 100) - 1) * 100
    X = X.dropna()

    m = X.resample("ME").mean()
    m.index = m.index.to_period("M")
    cal = pd.period_range(m.index.min(), max(m.index.max(), pl.index.max()), freq="M")
    m = m.reindex(cal)
    m["t_us10"] = m["us10_real"] - m["us10_real"].shift(12)
    for c in ["pl", "excl", "excl_teto", "excl_prejuizo", "excl_sem_dado", "date"]:
        m[c] = pl[c].reindex(cal)

    mes_corrente = pd.Timestamp(agora.date()).to_period("M")
    completos = m[m.index < mes_corrente]
    base = completos.dropna(subset=["pl"] + COMPLETO)
    base = base[base.index >= pd.Period(PISO_AMOSTRA, "M")]
    if len(base) < 120:
        raise RuntimeError(f"amostra curta: {len(base)} meses")
    inicio = base.index.min()
    amostra = base[base.index >= inicio]
    print(f"[pl_modelo] amostra: {len(amostra)} meses {amostra.index.min()} -> {amostra.index.max()}")

    ey = 100.0 / amostra["pl"]  # lucro sobre preço (%) — o Y estimado
    rj = ols_hac(ey, amostra[JUROS])
    rc = ols_hac(ey, amostra[COMPLETO])

    def para_pl(v):
        """EY ajustado (%) -> P/L. EY <= 1% (P/L > 100) não tem leitura: vira NaN."""
        v = np.asarray(v, dtype="float64")
        with np.errstate(divide="ignore", invalid="ignore"):
            return np.where(v > 1.0, 100.0 / v, np.nan)

    # ECM em calendário completo (o resíduo defasado não pula buracos), no EY
    cal_a = pd.period_range(amostra.index.min(), amostra.index.max(), freq="M")
    resid = rc.resid.reindex(cal_a)
    dX = amostra[COMPLETO].reindex(cal_a).diff()
    dy = ey.reindex(cal_a).diff()
    W = pd.concat([resid.shift(1).rename("ect"), dX], axis=1)
    ok = W.notna().all(axis=1) & dy.notna()
    ecm = sm.OLS(dy[ok], sm.add_constant(W[ok])).fit(cov_type="HAC", cov_kwds={"maxlags": HAC_LAGS})
    gamma = float(ecm.params["ect"])
    meia_vida = float(np.log(0.5) / np.log(1 + gamma)) if -1 < gamma < 0 else None
    adf_c = float(adfuller(rc.resid, autolag="AIC")[1])
    adf_j = float(adfuller(rj.resid, autolag="AIC")[1])
    reset_c = float(linear_reset(sm.OLS(ey, sm.add_constant(amostra[COMPLETO])).fit(), power=3, use_f=True).pvalue)

    Zc = sm.add_constant(amostra[COMPLETO])
    vifs = {c: float(variance_inflation_factor(Zc.values, i)) for i, c in enumerate(Zc.columns) if c != "const"}
    testes = []
    for k, nome, h in BLOCOS_F:
        f = rc.f_test(h)
        testes.append({"bloco": k, "nome": nome, "F": _r(f.fvalue, 2), "p": float(np.squeeze(f.pvalue))})
    fj = rj.f_test("real_selic = real_5a = real_30a = 0")
    testes.insert(0, {"bloco": "so_juros", "nome": "Só juros: as 3 taxas juntas", "F": _r(fj.fvalue, 2),
                      "p": float(np.squeeze(fj.pvalue))})

    # ---- série de saída (linhas justificadas onde houver X, mesmo sem P/L) ----
    m_out = m[m.index >= inicio]
    tem_xj = m_out[JUROS].notna().all(axis=1)
    tem_xc = m_out[COMPLETO].notna().all(axis=1)
    fit_j = pd.Series(np.nan, index=m_out.index)
    fit_c = pd.Series(np.nan, index=m_out.index)
    fit_j[tem_xj] = para_pl(sm.add_constant(m_out.loc[tem_xj, JUROS], has_constant="add") @ rj.params.values)
    fit_c[tem_xc] = para_pl(sm.add_constant(m_out.loc[tem_xc, COMPLETO], has_constant="add") @ rc.params.values)

    # "hoje": último mês com P/L e todas as explicativas (normalmente o mês corrente, parcial)
    ult = m_out[m_out["pl"].notna() & tem_xc].index.max()
    xh = m_out.loc[ult]
    xh_num = xh[COMPLETO].astype(float)
    ey_j, ey_lo_j, ey_hi_j = ajuste_com_ic(rj, xh[JUROS])
    ey_c, ey_lo_c, ey_hi_c = ajuste_com_ic(rc, xh[COMPLETO])
    eq_j, lo_j, hi_j = 100 / ey_j, 100 / ey_hi_j, 100 / ey_lo_j  # EY maior = P/L menor
    eq_c, lo_c, hi_c = 100 / ey_c, 100 / ey_hi_c, 100 / ey_lo_c
    pl_hoje = float(xh["pl"])

    pls = m_out.loc[m_out.index <= ult, "pl"].dropna()
    mean, sd = float(pls.mean()), float(pls.std(ddof=0))
    pl_stats = {"mean": _r(mean, 2), "sd": _r(sd, 3), "minus2": _r(mean - 2 * sd, 2), "minus1": _r(mean - sd, 2),
                "plus1": _r(mean + sd, 2), "plus2": _r(mean + 2 * sd, 2), "n": int(len(pls)),
                "inicio": str(pls.index.min()), "z_hoje": _r((pl_hoje - mean) / sd, 2) if sd > 0 else None}

    # ---- trava ----
    falhas = []
    if rc.rsquared < 0.35:
        falhas.append(f"R² do completo {rc.rsquared:.3f} < 0,35")
    if adf_c >= 0.05:
        falhas.append(f"resíduo do completo não estacionário (ADF p={adf_c:.3f})")
    if not (3 <= eq_c <= 30 and 3 <= eq_j <= 30):
        falhas.append(f"justificado fora de [3; 30]: completo {eq_c:.2f}, só juros {eq_j:.2f}")
    if float(rc.fittedvalues.min()) <= 2.0:
        falhas.append(f"EY ajustado chega a {rc.fittedvalues.min():.2f}% (P/L > 50) dentro da amostra")
    if testes[1]["p"] >= 0.05:
        falhas.append(f"bloco de juros não significativo (p={testes[1]['p']:.3f})")
    if falhas:
        raise RuntimeError("trava do modelo: " + "; ".join(falhas))

    # ---- decomposição, em P/L ----
    # O modelo soma efeitos no EY; o P/L é 1/EY, então os efeitos em P/L se encadeiam: parte do
    # EY médio da amostra e soma os blocos na ordem do teste F (juros → exterior → direção). Cada
    # bloco leva o P/L do passo anterior ao seguinte, e a soma fecha exatamente no justificado.
    # Dentro do bloco, cada variável recebe a parte proporcional pela mesma inclinação do bloco.
    # Em bloco colinear (VIF alto) o efeito de cada taxa sozinha não se interpreta — só o do bloco.
    blocos_vars = {"curva": JUROS, "externo": ["us10_real", "cupom_real_e"], "direcao": ["dselic_e", "t_us10"]}

    def decompor(res, cols):
        ef_ey = {c: float(res.params[c] * (float(xh[c]) - amostra[c].mean())) for c in cols}
        ey0 = float(res.fittedvalues.mean())
        ey_acc = ey0
        blocos = []
        for k, nome, _ in BLOCOS_F:
            vs = [c for c in blocos_vars[k] if c in cols]
            if not vs:
                continue
            d_ey = sum(ef_ey[c] for c in vs)
            inclin = -100.0 / (ey_acc * (ey_acc + d_ey))  # ΔP/L por p.p. de EY neste trecho
            blocos.append({"bloco": k, "nome": nome, "efeito": _r(inclin * d_ey, 3), "efeito_ey": _r(d_ey, 3),
                           "itens": [{"key": c, "nome": VARS[c]["nome"], "efeito": _r(inclin * ef_ey[c], 3),
                                      "efeito_ey": _r(ef_ey[c], 3)} for c in vs]})
            ey_acc += d_ey
        return {"media_pl": _r(100 / ey0, 3), "media_ey": _r(ey0, 3), "blocos": blocos,
                "justificado": _r(100 / ey_acc, 3)}

    variaveis = []
    for c in COMPLETO:
        s = m_out[c].dropna()
        b = float(rc.params[c])
        variaveis.append({
            "key": c, **VARS[c],
            "coef": _r(b, 4), "ep": _r(rc.bse[c], 4), "t": _r(rc.tvalues[c], 2), "p": _r(rc.pvalues[c], 4),
            "vif": _r(vifs.get(c), 1), "hoje": _r(xh[c], 3), "media": _r(amostra[c].mean(), 3),
            "min": _r(s.min(), 3), "max": _r(s.max(), 3),
            # efeito de +1 (p.p.) na variável sobre o P/L justificado de hoje, com as outras paradas
            "efeito_1pp": _r(100 / (ey_c + b) - 100 / ey_c, 3) if ey_c + b > 1 else None,
            "coef_so_juros": _r(rj.params[c], 4) if c in JUROS else None,
        })

    # ---- dispersões ----
    # Juros: P/L observado × a taxa (bruto), curva = regressão simples do EY na taxa, em P/L.
    # Demais variáveis: EFEITO PARCIAL — P/L que o mês teria com as OUTRAS seis variáveis na média
    # da amostra (resíduo parcial). No bruto essas quatro se misturam com o ciclo dos juros (ex.:
    # Selic esperada subindo acontece quando a Selic está baixa) e a relação some do gráfico.
    medias = amostra[COMPLETO].mean()
    ey_med = float(rc.fittedvalues.mean())
    dispersao = []
    for c in COMPLETO:
        x = amostra[c].astype(float)
        x0, x1 = float(x.min()), float(x.max())
        xs = np.linspace(x0, x1, 25)
        if c in JUROS:
            rb = ols_hac(ey, amostra[[c]])
            a, b = float(rb.params["const"]), float(rb.params[c])
            ys = amostra["pl"].astype(float).values
            curva = para_pl(a + b * xs)
            y_hoje = pl_hoje
            extra = {"tipo": "bruto", "a": _r(a, 4), "b": _r(b, 4), "t": _r(rb.tvalues[c], 2), "r2": _r(rb.rsquared, 3)}
        else:
            outras = [j for j in COMPLETO if j != c]
            desloc = (amostra[outras] - medias[outras]) @ rc.params[outras]
            ys = para_pl(ey - desloc)
            curva = para_pl(ey_med + rc.params[c] * (xs - medias[c]))
            y_hoje = float(para_pl(100 / pl_hoje - float((xh_num[outras] - medias[outras]) @ rc.params[outras])))
            extra = {"tipo": "parcial", "a": None, "b": _r(rc.params[c], 4), "t": _r(rc.tvalues[c], 2), "r2": None}
        pontos = [[_r(xv, 3), _r(yv, 3), str(per)] for per, xv, yv in zip(amostra.index, x.values, ys)
                  if np.isfinite(yv)]
        dispersao.append({
            "key": c, "nome": VARS[c]["nome"], "unidade": VARS[c]["unidade"],
            "grupo": "juros" if c in JUROS else "outras", **extra,
            "pontos": pontos,
            "curva": [[_r(xv, 3), _r(yv, 3)] for xv, yv in zip(xs, curva) if np.isfinite(yv)],
            "hoje": [_r(xh_num[c], 3), _r(y_hoje, 3)] if np.isfinite(y_hoje) else None,
            "x0": _r(x0, 3), "x1": _r(x1, 3),
        })

    serie = []
    for p, row in m_out.iterrows():
        parcial = p >= mes_corrente
        data = row["date"] if isinstance(row["date"], str) else (
            last_data if parcial else p.to_timestamp(how="end").strftime("%Y-%m-%d"))
        if pd.isna(row["pl"]) and pd.isna(fit_c[p]) and pd.isna(fit_j[p]):
            continue
        item = {"date": data, "mes": str(p), "parcial": bool(parcial), "na_amostra": bool(p in amostra.index),
                "pl": _r(row["pl"], 3), "fit_juros": _r(fit_j[p], 3), "fit_completo": _r(fit_c[p], 3),
                "excl": _r(row["excl"], 1), "excl_teto": _r(row["excl_teto"], 1),
                "excl_prejuizo": _r(row["excl_prejuizo"], 1), "excl_sem_dado": _r(row["excl_sem_dado"], 1)}
        for c in COMPLETO:
            item[c] = _r(row[c], 3)
        serie.append(item)

    # ---- avisos de frescor (fonte parada contamina o "hoje") ----
    avisos = []
    for nome, d in fontes_ult.items():
        atraso = len(pd.bdate_range(d, fim)) - 1 if d is not None and d < fim else 0
        if atraso > DEFASAGEM_AVISO:
            avisos.append(f"{nome} sem dado novo desde {d.strftime('%d/%m/%Y')} — o ponto de hoje repete o último valor.")

    hoje = {
        "data": last_data, "mes": str(ult), "parcial": bool(ult >= mes_corrente),
        "pl": _r(pl_hoje, 3), "z": pl_stats["z_hoje"],
        "justificado_juros": _r(eq_j, 3), "ic_juros": [_r(lo_j, 2), _r(hi_j, 2)],
        "justificado_completo": _r(eq_c, 3), "ic_completo": [_r(lo_c, 2), _r(hi_c, 2)],
        "ey": _r(100 / pl_hoje, 3), "ey_justificado_juros": _r(ey_j, 3), "ey_justificado_completo": _r(ey_c, 3),
        "desvio_juros_pct": _r((pl_hoje / eq_j - 1) * 100, 1),
        "desvio_completo_pct": _r((pl_hoje / eq_c - 1) * 100, 1),
        "excl": {"total": _r(xh["excl"], 1), "teto": _r(xh["excl_teto"], 1),
                 "prejuizo": _r(xh["excl_prejuizo"], 1), "sem_dado": _r(xh["excl_sem_dado"], 1)},
    }
    estimado_ate = str(amostra.index.max())
    hist_item = {"mes": estimado_ate, "forma": "ey", "n": int(len(amostra)), "r2": _r(rc.rsquared, 3),
                 "r2_juros": _r(rj.rsquared, 3),
                 "coefs": {c: _r(rc.params[c], 4) for c in ["const"] + COMPLETO}}

    def resumo(res, adf_p):
        return {"r2": _r(res.rsquared, 3), "r2_aj": _r(res.rsquared_adj, 3), "aic": _r(res.aic, 1),
                "sigma": _r(np.std(res.resid, ddof=len(res.params)), 3), "n": int(res.nobs),
                "const": _r(res.params["const"], 4), "adf_residuo_p": _r(adf_p, 4)}

    return {
        "schema_version": SCHEMA_VERSION,
        "status": "ok",
        "generated_at": agora.isoformat(),
        "last_data_date": last_data,
        "estimado_ate": estimado_ate,
        "min_start_date": str(inicio),
        "amostra": {"inicio": str(inicio), "fim": estimado_ate, "n": int(len(amostra)),
                    "buracos": meses_buracos(amostra.index)},
        "hoje": hoje,
        "pl_stats": pl_stats,
        "serie": serie,
        "variaveis": variaveis,
        "modelos": {
            "juros": {**resumo(rj, adf_j), "vars": JUROS},
            "forma": "ey",
            "forma_descricao": "Estimado no lucro sobre preço (EY = 1/P-L); justificado = 1/EY ajustado",
            "completo": {**resumo(rc, adf_c), "vars": COMPLETO, "reset_p": _r(reset_c, 4), "ecm_gamma": _r(gamma, 3),
                         "ecm_gamma_p": _r(ecm.pvalues["ect"], 4), "meia_vida_meses": _r(meia_vida, 1)},
        },
        "testes_f": testes,
        "dispersao": dispersao,
        "decomposicao": {"completo": decompor(rc, COMPLETO), "juros": decompor(rj, JUROS)},
        "coef_history": [hist_item],
        "avisos": avisos,
        "fontes_ultima_data": {k: (v.strftime("%Y-%m-%d") if v is not None else None) for k, v in fontes_ult.items()},
        "fontes": {
            "pl": "data/acoes_valuation.json (pl_mensal) — LPA reportado por data de anúncio, média harmônica",
            "curva_real": "data/treasury_history.json (ANBIMA + Tesouro Transparente), PCHIP em prazo constante",
            "selic": "BCB SGS 432 (Selic meta)", "dolar": "BCB SGS 1",
            "focus": "BCB Olinda — ExpectativasMercadoInflacao12Meses (IPCA, suavizada) e ExpectativasMercadoAnuais (Selic, câmbio)",
            "eua": f"{rota_eua} — juro real (TIPS) e inflação implícita de 10 anos",
        },
        "_meta": {"hac_lags": HAC_LAGS, "piso_amostra": PISO_AMOSTRA, "ffill_dias_uteis": FFILL_DIAS_UTEIS,
                  "juros": JUROS, "completo": COMPLETO},
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default="data-pipeline/out")
    ap.add_argument("--upload", action="store_true")
    args = ap.parse_args()
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    try:
        payload = build(out_dir)
    except Exception as e:  # noqa: BLE001
        print(f"::error::modelo P/L × juros não publicado (site segue com o último bom): {e}")
        return 1
    anterior = download_json(BLOB_OUT) or {}
    hist = {h["mes"]: h for h in (anterior.get("coef_history") or []) if isinstance(h, dict) and h.get("mes")}
    for h in payload["coef_history"]:
        hist[h["mes"]] = h
    payload["coef_history"] = [hist[k] for k in sorted(hist)][-60:]

    out_path = out_dir / "ibov_pl_modelo.json"
    out_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    h = payload["hoje"]
    print(f"[pl_modelo] Escreveu {out_path} ({out_path.stat().st_size:,} bytes) | P/L {h['pl']} | "
          f"justificado só juros {h['justificado_juros']} ({h['desvio_juros_pct']:+.1f}%) | "
          f"completo {h['justificado_completo']} ({h['desvio_completo_pct']:+.1f}%) | "
          f"R² {payload['modelos']['juros']['r2']} / {payload['modelos']['completo']['r2']}")
    for a in payload["avisos"]:
        print(f"::warning::{a}")
    if args.upload:
        maybe_upload_json(out_path, BLOB_OUT)
    else:
        print("[pl_modelo] --upload NÃO setado; apenas salvou local.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
