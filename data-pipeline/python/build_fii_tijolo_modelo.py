"""Índice de FIIs de tijolo + modelo DY × juros → data/fii_tijolo_modelo.json.

Índice (regras aprovadas em out/2026, protótipo em _prototipos/fii-tijolo-juros):
  - Universo: cotas de FII no mercado à vista da B3 (COTAHIST, CODBDI 12, códigos XXXX11/XXXX11B) com informe
    mensal na CVM.
  - Tijolo: na média dos 3 últimos informes, >= 2/3 dos investimentos (fora caixa/renda fixa de liquidez) em
    imóveis de renda (prontos, em construção, terrenos, direitos reais, sociedades imobiliárias).
  - Liquidez (6 meses): negociado em >= 90% dos pregões, 6 meses de negociação e dentro dos fundos que somam 95%
    do índice de negociabilidade (raiz de negócios × volume, como a B3).
  - Peso: valor de mercado (P/VP × PL) no fim do mês anterior, teto de 10%. Rebalanceamento mensal.
  - Índice oficial = PREÇO (sem reinvestir rendimentos; amortização conta como preço). Base 1.000 em jan/2017,
    primeiro mês com informe da CVM para 100% do volume. Versão "ajustada pelo rendimento" só para comparar
    com o IFIX.
Modelo: DY 12m do índice (fim do mês) = c + b1·juro de 1 ano (curva PRE) + b2·NTN-B 30 anos (curva IPCA),
  com constante, sem defasagens, juros do mês. Índice justificado = índice × DY observado ÷ DY justificado.
Projeção: só a Selic implícita do Panorama se move (mesmos ajustes da página, via build_ibov_pl_modelo.
  implicita_selic): o juro de 1 ano de cada mês futuro = valor de hoje + variação da média da Selic implícita nos
  12 meses seguintes (depois do fim da curva, o último degrau). NTN-B 30a e rendimentos parados.

Armadilha: quando o FII troca de código, a B3 cria ISIN novo e a CVM mantém o antigo (BBPO11→TVRI11,
MALL11→PMLL11, HSRE11→BTRU11). A ligação ISIN→CNPJ usa o ISIN da CVM, a semente fii_isin_cnpj.json, a raiz,
a contagem de cotas da B3 contra a CVM e a continuidade de negociação.

Uso: python data-pipeline/python/build_fii_tijolo_modelo.py [--upload] [--cache-dir data-pipeline/cache]
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import sys
import time
import unicodedata
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
import requests
import statsmodels.api as sm
from scipy.interpolate import PchipInterpolator

sys.path.append(str(Path(__file__).parent))
from shared.blob_download import download_json  # noqa: E402
from shared.blob_upload import maybe_upload_json  # noqa: E402
import build_ibov_pl_modelo as bm  # noqa: E402  (Selic implícita com os ajustes do Panorama, SGS)

BLOB_OUT = "data/fii_tijolo_modelo.json"
SCHEMA_VERSION = 1
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0", "Accept": "*/*"}
ANO_INI = 2016
BASE_MES = pd.Period("2017-01", "M")
AMOSTRA_INI = pd.Period("2017-06", "M")
# regras do índice
LIMIAR_TIJOLO, JANELA_CLASS, PRESENCA, MESES_HIST, JANELA_LIQ, CORTE_IN, TETO = 2 / 3, 3, 0.90, 6, 6, 0.95, 0.10
CVM_FFILL = 3                  # meses que VP/composição seguem valendo enquanto o informe não sai
DY_MIN_MESES = 9               # meses de rendimento informado para ter DY 12m
HAC_LAGS = 6
X_COLS = ["p1", "r30"]
SEMENTE = Path(__file__).parent / "fii_isin_cnpj.json"
MANUAL = {"BRJCINCTF001": "50.718.976/0001-72"}   # JCIN11 = JHSF Capital Institucional (P/VP 0,96 estável)


def _r(v, n=3):
    try:
        v = float(v)
    except (TypeError, ValueError):
        return None
    return round(v, n) if np.isfinite(v) else None


def _get(url: str, timeout: int = 300, tentativas: int = 4) -> requests.Response:
    erro = None
    for i in range(tentativas):
        try:
            r = requests.get(url, headers=UA, timeout=timeout)
            if r.status_code == 200 and r.content:
                return r
            erro = f"HTTP {r.status_code}"
        except Exception as e:  # noqa: BLE001
            erro = repr(e)[:120]
        time.sleep(4 * (i + 1))
    raise RuntimeError(f"{url}: {erro}")


def baixar(url: str, dest: Path, sempre: bool) -> Path:
    if dest.exists() and dest.stat().st_size > 0 and not sempre:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(_get(url).content)
    return dest


# ---------------------------------------------------------------------------
# Fontes brutas: CVM (informe mensal) e B3 (COTAHIST anual)
# ---------------------------------------------------------------------------

def cvm_informes(cache: Path, ano_hoje: int) -> Dict[str, pd.DataFrame]:
    frames: Dict[str, List[pd.DataFrame]] = {"geral": [], "complemento": [], "ativo_passivo": []}
    for a in range(ANO_INI, ano_hoje + 1):
        arq = baixar(f"https://dados.cvm.gov.br/dados/FII/DOC/INF_MENSAL/DADOS/inf_mensal_fii_{a}.zip",
                     cache / "cvm" / f"inf_mensal_fii_{a}.zip", sempre=a >= ano_hoje - 1)
        z = zipfile.ZipFile(arq)
        for n in z.namelist():
            k = next((k for k in frames if f"_{k}_" in n), None)
            if k:
                frames[k].append(pd.read_csv(z.open(n), sep=";", encoding="latin1", dtype=str))
    out = {}
    for k, v in frames.items():
        df = pd.concat(v, ignore_index=True)
        df["cnpj"] = df["CNPJ_Fundo_Classe"].fillna(df["CNPJ_Fundo"]) if "CNPJ_Fundo" in df else df["CNPJ_Fundo_Classe"]
        df["mes"] = pd.to_datetime(df["Data_Referencia"]).dt.to_period("M")
        df["Versao"] = pd.to_numeric(df["Versao"], errors="coerce")
        out[k] = df.sort_values("Versao").drop_duplicates(["cnpj", "mes"], keep="last")
    print(f"[tijolo] CVM: {len(out['complemento']):,} informes, até {out['complemento'].mes.max()}")
    return out


def cotahist(cache: Path, ano_hoje: int) -> pd.DataFrame:
    linhas = []
    for a in range(ANO_INI, ano_hoje + 1):
        arq = baixar(f"https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_A{a}.ZIP",
                     cache / "cotahist" / f"COTAHIST_A{a}.ZIP", sempre=a == ano_hoje)
        z = zipfile.ZipFile(arq)
        with z.open(z.namelist()[0]) as fh:
            for ln in io.TextIOWrapper(fh, encoding="latin1"):
                if ln[:2] != "01" or ln[10:12] != "12":
                    continue
                linhas.append((ln[2:10], ln[12:24].strip(), ln[27:39].strip(), ln[39:49].strip(), int(ln[108:121]) / 100,
                               int(ln[147:152]), int(ln[152:170]), int(ln[170:188]) / 100, ln[230:242]))
    q = pd.DataFrame(linhas, columns=["data", "ticker", "nome", "especi", "fech", "negocios", "qtd", "volume", "cod_isin"])
    q["data"] = pd.to_datetime(q["data"])
    q = q[~q.especi.str.startswith("DIR") & q.ticker.str.match(r"^[A-Z]{4}11B?$")].sort_values("data")
    print(f"[tijolo] B3: {len(q):,} negócios-dia de FII, até {q.data.max().date()}")
    return q


# ---------------------------------------------------------------------------
# ISIN (B3) -> CNPJ (CVM)
# ---------------------------------------------------------------------------

def _norm(t) -> str:
    t = unicodedata.normalize("NFKD", str(t)).encode("ascii", "ignore").decode().upper()
    return "".join(ch if ch.isalnum() else " " for ch in t)


def mapear(q: pd.DataFrame, cvm: Dict[str, pd.DataFrame]) -> pd.Series:
    g, c = cvm["geral"], cvm["complemento"]
    gi = g.dropna(subset=["Codigo_ISIN"])
    por_isin = gi.groupby("Codigo_ISIN")["cnpj"].agg(lambda s: s.value_counts().index[0])
    por_raiz = gi.assign(r=gi.Codigo_ISIN.str[2:6]).groupby("r")["cnpj"].agg(lambda s: s.value_counts().index[0])
    span = q.groupby("cod_isin").agg(tk=("ticker", "last"), d0=("data", "min"), d1=("data", "max"), p0=("fech", "first"),
                                     p1=("fech", "last"), vol=("volume", "sum"), nomres=("nome", "last"))
    span["cnpj"] = pd.Series(span.index.map(por_isin), index=span.index, dtype=object)  # object: aceita NaN e texto
    span["via"] = pd.Series(np.where(span.cnpj.notna(), "isin", None), index=span.index, dtype=object)
    try:
        sem = {d["isin"]: d["cnpj"] for d in json.loads(SEMENTE.read_text(encoding="utf-8"))["ligacoes"]}
    except Exception as e:  # noqa: BLE001
        print(f"[tijolo] [WARN] semente ISIN->CNPJ ilegível: {e}", file=sys.stderr)
        sem = {}
    sem.update(MANUAL)
    for isin, cn in sem.items():
        if isin in span.index and pd.isna(span.at[isin, "cnpj"]):
            span.loc[isin, ["cnpj", "via"]] = [cn, "semente"]
    m = span.cnpj.isna()
    span.loc[m, "cnpj"] = pd.Series(span.index[m].str[2:6], index=span.index[m]).map(por_raiz).astype(object)
    span.loc[m & span.cnpj.notna(), "via"] = "raiz"

    # contagem de cotas da B3 = cotas emitidas na CVM (só códigos ainda negociados, com volume relevante)
    nome_cvm = g.sort_values("mes").drop_duplicates("cnpj", keep="last").set_index("cnpj")
    nome_cvm = (nome_cvm["Nome_Fundo_Classe"].fillna(nome_cvm["Nome_Fundo"]) if "Nome_Fundo" in nome_cvm
                else nome_cvm["Nome_Fundo_Classe"]).map(_norm)
    cot = c.assign(cotas=pd.to_numeric(c["Cotas_Emitidas"], errors="coerce")).dropna(subset=["cotas"])
    hoje = span.d1.max()
    alvo = span[span.cnpj.isna() & (span.d1 >= hoje - pd.Timedelta(days=45)) & (span.vol > 20e6)]
    for isin, r in alvo.iterrows():
        try:
            b = base64.b64encode(json.dumps({"cnpj": "0", "identifierFund": r.tk[:4], "typeFund": 7}).encode()).decode()
            j = requests.get(f"https://sistemaswebb3-listados.b3.com.br/fundsProxy/fundsCall/GetListedSupplementFunds/{b}",
                             headers=UA, timeout=30).json()
            qtd = float(str(j.get("quantity", "")).replace(".", "").replace(",", "."))
        except Exception:  # noqa: BLE001
            continue
        meses = pd.period_range(r.d0.to_period("M"), r.d1.to_period("M"), freq="M")
        cand = list(cot[cot.mes.isin(meses) & ((cot.cotas - qtd).abs() / qtd < 0.002)].cnpj.unique())
        if len(cand) > 1:
            toks = [t for t in _norm(r.nomres).split() if t not in {"FII", "FDO", "FUNDO"} and len(t) >= 2]
            nota = {cn: sum(1 for t in toks if any(p.startswith(t) for p in nome_cvm.get(cn, "").split())) for cn in cand}
            top = max(nota.values()) if nota else 0
            cand = [cn for cn, v in nota.items() if v == top and v > 0]
        if len(cand) == 1:
            span.loc[isin, ["cnpj", "via"]] = [cand[0], "cotas"]
        time.sleep(0.25)

    # continuidade: um código para e outro começa (até 10 dias) no mesmo preço (±15%)
    ult_cvm = c.assign(vp=pd.to_numeric(c["Valor_Patrimonial_Cotas"], errors="coerce")).query("vp > 0").groupby("cnpj").mes.max()
    for isin, r in span[span.cnpj.isna()].sort_values("vol", ascending=False).iterrows():
        ant = span[span.cnpj.notna() & (span.d1 >= r.d0 - pd.Timedelta(days=10)) & (span.d1 < r.d0) & ((r.p0 / span.p1 - 1).abs() < 0.15)]
        ant = ant[ant.cnpj.map(ult_cvm).fillna(pd.Period("1900-01", "M")) >= r.d0.to_period("M") + 2]
        if len(ant) == 1:
            span.loc[isin, ["cnpj", "via"]] = [ant.cnpj.iloc[0], "continuidade"]
            continue
        nx = span[span.cnpj.notna() & (span.d0 > r.d1) & (span.d0 <= r.d1 + pd.Timedelta(days=10)) & ((span.p0 / r.p1 - 1).abs() < 0.15)]
        if len(nx) == 1:
            span.loc[isin, ["cnpj", "via"]] = [nx.cnpj.iloc[0], "continuidade"]
    ano = q.data.dt.year == q.data.max().year
    v = q[ano].groupby("cod_isin").volume.sum()
    sem_cnpj = float(v[span.cnpj.reindex(v.index).isna()].sum() / v.sum()) if v.sum() > 0 else 0.0
    print(f"[tijolo] ISIN->CNPJ: {span.via.value_counts(dropna=False).to_dict()} | volume do ano sem CNPJ {sem_cnpj:.1%}")
    return span["cnpj"].dropna(), sem_cnpj


# ---------------------------------------------------------------------------
# Painel mensal fundo × mês
# ---------------------------------------------------------------------------

def painel(q: pd.DataFrame, mp: pd.Series, cvm: Dict[str, pd.DataFrame]) -> pd.DataFrame:
    q = q[q.cod_isin.isin(mp.index)].copy()
    q["cnpj"] = q.cod_isin.map(mp)
    q["mes"] = q.data.dt.to_period("M")
    sessoes = q.groupby("mes").data.nunique().rename("sessoes")
    agg = q.groupby(["cnpj", "mes", "ticker"]).agg(fech=("fech", "last"), data_ult=("data", "last"), dias_neg=("data", "nunique"),
                                                   volume=("volume", "sum"), negocios=("negocios", "sum"), qtd=("qtd", "sum"))
    agg = agg.reset_index().sort_values("volume").drop_duplicates(["cnpj", "mes"], keep="last").set_index(["cnpj", "mes"])
    agg = agg.join(sessoes, on="mes")
    agg["vwap"] = agg["volume"] / agg["qtd"]

    g, c, a = (cvm[k].set_index(["cnpj", "mes"]) for k in ("geral", "complemento", "ativo_passivo"))
    num = lambda s: pd.to_numeric(s, errors="coerce")  # noqa: E731
    cv = pd.DataFrame(index=c.index)
    cv["vp_cota"] = num(c["Valor_Patrimonial_Cotas"])
    cv["pl"] = num(c["Patrimonio_Liquido"])
    cv["ativo"] = num(c["Valor_Ativo"])
    cv["dy_vp"] = num(c["Percentual_Dividend_Yield_Mes"])
    cv["amort_vp"] = num(c["Percentual_Amortizacao_Cotas_Mes"])
    col = lambda *ns: sum(num(a[n]).fillna(0) for n in ns if n in a.columns).reindex(cv.index)  # noqa: E731
    cv["a_tijolo"] = col("Direitos_Bens_Imoveis", "Terrenos", "Imoveis_Renda_Acabados", "Imoveis_Renda_Construcao",
                         "Outros_Direitos_Reais", "Acoes_Sociedades_Atividades_FII", "Cotas_Sociedades_Atividades_FII")
    cv["a_desenv"] = col("Imoveis_Venda_Acabados", "Imoveis_Venda_Construcao")
    cv["a_papel"] = col("CRI", "CRI_CRA", "LCI", "LCI_LCA", "Letras_Hipotecarias", "LIG", "Debentures", "Cedulas_Debentures",
                        "Notas_Promissorias", "Certificados_Deposito_Valores_Mobiliarios")
    cv["a_fof"] = col("FII")
    cv["a_outros"] = col("Acoes", "Fundo_Acoes", "FIP", "FDIC", "Outras_Cotas_FI", "CEPAC", "Bonus_Subscricao", "Outros_Valores_Mobliarios")
    inv = cv[["a_tijolo", "a_desenv", "a_papel", "a_fof", "a_outros"]].sum(axis=1)
    cv["f_tijolo"] = np.where(inv > 0, cv["a_tijolo"] / inv, np.nan)
    nome = g["Nome_Fundo_Classe"].fillna(g["Nome_Fundo"]) if "Nome_Fundo" in g else g["Nome_Fundo_Classe"]
    cv["nome"] = nome.reindex(cv.index)

    P = agg.join(cv, how="outer").sort_index()
    ff = ["vp_cota", "pl", "ativo", "f_tijolo", "nome"]
    P[ff] = P.groupby(level=0)[ff].ffill(limit=CVM_FFILL)
    P["pvp"] = P["fech"] / P["vp_cota"]
    P["pvp_ok"] = P["pvp"].between(0.25, 3.0)
    return P


def preparar(P: pd.DataFrame) -> pd.DataFrame:
    P = P.copy()
    g = P.groupby(level=0)
    P["f_tij_m"] = g["f_tijolo"].transform(lambda s: s.clip(0, 1).rolling(JANELA_CLASS, min_periods=1).mean())
    s = g["vp_cota"].shift(1) / P["vp_cota"]
    P["fat_ev"] = np.where((s > 1.6) | (s < 1 / 1.6), s, 1.0)          # desdobramento/grupamento
    P["F"] = P.groupby(level=0)["fat_ev"].transform(lambda x: x[::-1].cumprod()[::-1].shift(-1).fillna(1.0))
    P["vp_adj"] = P["vp_cota"] / P["F"]
    P["p_adj"] = P["fech"] / P["F"]
    dy = P["dy_vp"].where(P["dy_vp"].between(0, 0.03))
    am = P["amort_vp"].where(P["amort_vp"].between(0, 0.5)).fillna(0)
    P["div_adj"] = dy * P["vp_adj"]
    g = P.groupby(level=0)
    imp = g["div_adj"].transform(lambda x: x.shift(1).rolling(6, min_periods=3).median())
    P["dist_adj"] = P["div_adj"].fillna(imp).fillna(0) + am * P["vp_adj"]
    n12 = g["div_adj"].transform(lambda x: x.rolling(12, min_periods=1).count())
    s12 = g["div_adj"].transform(lambda x: x.rolling(12, min_periods=1).sum())
    P["div12_adj"] = np.where(n12 >= DY_MIN_MESES, s12 * 12 / n12.clip(lower=1), np.nan)
    P["dy12"] = np.where(P["pvp_ok"], P["div12_adj"] / P["p_adj"], np.nan)
    P.loc[~P["dy12"].between(0, 0.4), "dy12"] = np.nan
    p_ant = g["p_adj"].shift(1)
    mes = P.index.get_level_values(1).to_series(index=P.index)
    contiguo = (mes - mes.groupby(level=0).shift(1)).apply(lambda x: getattr(x, "n", np.nan)) == 1
    ok = contiguo & P["fech"].notna() & p_ant.notna()
    P["ret"] = np.where(ok, (P["p_adj"] + P["dist_adj"]) / p_ant - 1, np.nan)
    P.loc[P["ret"].abs() > 0.6, "ret"] = np.nan
    P["ret_preco"] = np.where(P["ret"].notna(), (P["p_adj"] + am * P["vp_adj"]) / p_ant - 1, np.nan)
    return P


def elegiveis(P: pd.DataFrame, mes: pd.Period) -> pd.DataFrame:
    jan = pd.period_range(mes - JANELA_LIQ + 1, mes, freq="M")
    H = P[P.index.get_level_values(1).isin(jan)]
    liq = H.groupby(level=0).agg(dias=("dias_neg", "sum"), vol=("volume", "sum"), neg=("negocios", "sum"), meses=("fech", "count"))
    ses = H["sessoes"].groupby(level=1).first().sum()
    liq["pres"] = liq["dias"] / ses
    try:
        X = P.xs(mes, level=1).join(liq, rsuffix="_6m")
    except KeyError:
        return pd.DataFrame()
    ok = X["pvp_ok"].fillna(False).astype(bool) & X["pl"].gt(0) & X["fech"].notna()
    ok &= (X["pres"] >= PRESENCA) & (X["meses"] >= MESES_HIST) & (X["f_tij_m"] >= LIMIAR_TIJOLO)
    X = X[ok].copy()
    if X.empty:
        return X
    X["IN"] = np.sqrt((X["neg"] / X["neg"].sum()) * (X["vol"] / X["vol"].sum()))
    X = X.sort_values("IN", ascending=False)
    X = X[(X["IN"].cumsum() / X["IN"].sum()).shift(1).fillna(0) < CORTE_IN]
    X["vm"] = X["pvp"] * X["pl"]
    w = X["vm"] / X["vm"].sum()
    for _ in range(50):
        exc = w > TETO + 1e-12
        if not exc.any():
            break
        sobra = (w[exc] - TETO).sum()
        w[exc] = TETO
        livre = ~exc & (w < TETO)
        w[livre] += sobra * w[livre] / w[livre].sum()
    X["w"] = w
    return X


def construir(P: pd.DataFrame):
    meses = pd.period_range(BASE_MES, P.index.get_level_values(1).max(), freq="M")
    linhas, X_ant, ult = [], None, None
    nivel = nivel_p = 1000.0
    for m in meses:
        if X_ant is not None and len(X_ant):
            try:
                R = P.xs(m, level=1).reindex(X_ant.index)
            except KeyError:
                R = pd.DataFrame(index=X_ant.index, columns=["ret", "ret_preco"])
            ok = R["ret"].notna()
            if ok.any():
                w = X_ant.loc[ok, "w"] / X_ant.loc[ok, "w"].sum()
                nivel *= 1 + float((w * R.loc[ok, "ret"]).sum())
                nivel_p *= 1 + float((w * R.loc[ok, "ret_preco"]).sum())
        X = elegiveis(P, m)
        row = dict(mes=m, nivel=nivel, nivel_preco=nivel_p, n=len(X))
        if len(X):
            row["pvp"] = 1 / float((X["w"] / X["pvp"]).sum())
            d = X["dy12"].notna()
            row["dy12"] = float((X.loc[d, "w"] * X.loc[d, "dy12"]).sum() / X.loc[d, "w"].sum()) if d.any() else np.nan
            row["dy_cob"] = float(X.loc[d, "w"].sum())
            ult = X
            X_ant = X
        linhas.append(row)
    S = pd.DataFrame(linhas).set_index("mes")
    return S, ult


# ---------------------------------------------------------------------------
# Juros (curvas do site) e IFIX
# ---------------------------------------------------------------------------

def juro_1a_pre() -> pd.Series:
    """Taxa prefixada de 1 ano (PCHIP na curva PRE do treasury_history.json). Sem vértice abaixo de 1 ano
    (1º sem./2023), usa o mais curto se vencer em até 1,35 ano."""
    th = download_json("data/treasury_history.json", timeout=120)
    if not th:
        raise RuntimeError("treasury_history.json indisponível no Blob")
    por: Dict[pd.Timestamp, list] = {}
    for venc, pts in ((th.get("categories") or {}).get("PRE") or {}).get("series", {}).items():
        mat = pd.Timestamp(venc)
        for p in pts:
            d, y = pd.Timestamp(p[0]).normalize(), float(p[1])
            pr = (mat - d).days / 365.25
            if pr > 0 and 0 < y < 40:
                por.setdefault(d, []).append((pr, y))
    rows = {}
    for d, pp in por.items():
        xs, ys = np.array([p[0] for p in pp]), np.array([p[1] for p in pp])
        ux, inv = np.unique(np.round(xs, 3), return_inverse=True)
        uy = np.array([ys[inv == i].mean() for i in range(len(ux))])
        if len(ux) >= 3 and ux.min() <= 1.0 <= ux.max():
            rows[d] = float(PchipInterpolator(ux, uy)(1.0))
        elif len(ux) >= 1 and 1.0 < ux.min() <= 1.35:
            rows[d] = float(uy[0])
    return pd.Series(rows).sort_index()


def ifix_mensal() -> pd.Series:
    out = {}
    for a in range(ANO_INI, datetime.now().year + 1):
        p = base64.b64encode(json.dumps({"index": "IFIX", "language": "pt-br", "year": str(a)}).encode()).decode()
        try:
            j = requests.get(f"https://sistemaswebb3-listados.b3.com.br/indexStatisticsProxy/IndexCall/GetPortfolioDay/{p}",
                             headers=UA, timeout=60).json()
        except Exception as e:  # noqa: BLE001
            print(f"[tijolo] [WARN] IFIX {a}: {repr(e)[:80]}", file=sys.stderr)
            continue
        for row in j.get("results", []):
            for m in range(1, 13):
                v = row.get(f"rateValue{m}")
                if v:
                    try:
                        out[pd.Timestamp(a, m, row["day"])] = float(v.replace(".", "").replace(",", "."))
                    except (ValueError, TypeError):
                        pass
    s = pd.Series(out).sort_index()
    return s.groupby(s.index.to_period("M")).last() if len(s) else s


def fim_de_mes(s: pd.Series, meses: pd.PeriodIndex) -> pd.Series:
    """último valor de cada mês (no máximo 22 dias úteis velho)."""
    s = s.dropna().sort_index()
    dias = pd.bdate_range(s.index.min(), max(s.index.max(), meses.max().to_timestamp(how="end")))
    d = s.reindex(s.index.union(dias)).ffill(limit=22).reindex(dias)
    return d.groupby(d.index.to_period("M")).last().reindex(meses)


# ---------------------------------------------------------------------------
# Payload
# ---------------------------------------------------------------------------

def build(cache: Path) -> Dict:
    agora = datetime.now(timezone.utc)
    ano = agora.year
    cvm = cvm_informes(cache, ano)
    q = cotahist(cache, ano)
    mp, sem_cnpj = mapear(q, cvm)
    P = preparar(painel(q, mp, cvm))
    S, comp = construir(P)
    data_hoje = q.data.max()
    mes_hoje = data_hoje.to_period("M")
    S = S[S.index <= mes_hoje]
    # mês do informe com cobertura ampla: os primeiros fundos entregam o mês anterior semanas antes dos demais
    n_mes = cvm["complemento"].groupby("mes").size()
    cvm_ate = n_mes[n_mes >= 0.6 * n_mes.tail(6).max()].index.max()

    # juros
    p1 = juro_1a_pre()
    r30_d = bm.curva_real(alvos=(30.0,))["real_30a"].dropna()
    meses = S.index
    S["p1"] = fim_de_mes(p1, meses)
    S["r30"] = fim_de_mes(r30_d, meses)
    x_hoje = {"p1": float(p1.iloc[-1]), "r30": float(r30_d.iloc[-1])}
    data_curva = min(p1.index.max(), r30_d.index.max())
    S.loc[mes_hoje, "p1"], S.loc[mes_hoje, "r30"] = x_hoje["p1"], x_hoje["r30"]
    S["dy"] = S["dy12"] * 100

    # IFIX (base jan/17) e índices em base 1.000
    ifx = ifix_mensal()
    S["ifix"] = ifx.reindex(meses) / ifx.get(BASE_MES, np.nan) * 1000 if len(ifx) and BASE_MES in ifx.index else np.nan

    # modelo: fim de mês, jun/17 até o último mês fechado
    am = S[(S.index >= AMOSTRA_INI) & (S.index < mes_hoje)].dropna(subset=["dy"] + X_COLS)
    if len(am) < 90:
        raise RuntimeError(f"amostra curta: {len(am)} meses")
    res = sm.OLS(am["dy"], sm.add_constant(am[X_COLS])).fit(cov_type="HAC", cov_kwds={"maxlags": HAC_LAGS})
    b = res.params
    sd = float(np.sqrt(res.mse_resid))
    fit = lambda x1, x2: float(b["const"] + b["p1"] * x1 + b["r30"] * x2)  # noqa: E731
    S["dy_just"] = [fit(r.p1, r.r30) if pd.notna(r.p1) and pd.notna(r.r30) else np.nan for r in S.itertuples()]
    S["just"] = S["nivel_preco"] * S["dy"] / S["dy_just"]
    S["just_lo"] = S["nivel_preco"] * S["dy"] / (S["dy_just"] + sd)
    S["just_hi"] = S["nivel_preco"] * S["dy"] / (S["dy_just"] - sd)
    hoje_row = S.loc[mes_hoje]
    dy_hoje, p_hoje, dyj_hoje = float(hoje_row["dy"]), float(hoje_row["nivel_preco"]), float(hoje_row["dy_just"])

    # trava
    falhas = []
    if res.rsquared < 0.8:
        falhas.append(f"R² {res.rsquared:.3f} < 0,8")
    if b["r30"] <= 0 or b["p1"] < -0.05:
        falhas.append(f"sinais fora do esperado (pré 1a {b['p1']:+.3f}, NTN-B 30a {b['r30']:+.3f})")
    if int(hoje_row["n"]) < 20:
        falhas.append(f"índice com só {int(hoje_row['n'])} fundos")
    if not (0.7 <= hoje_row["just"] / p_hoje <= 1.4):
        falhas.append(f"justificado fora de ±40% do índice ({hoje_row['just'] / p_hoje - 1:+.0%})")
    if sem_cnpj > 0.08:
        falhas.append(f"{sem_cnpj:.0%} do volume do ano sem ligação com a CVM")
    if falhas:
        raise RuntimeError("trava do modelo: " + "; ".join(falhas))

    # projeção: só a Selic implícita se move
    projecao = None
    meta = bm.sgs_diaria(432, ini_ano=ano - 1)
    sel = bm.implicita_selic(float(meta.dropna().iloc[-1])) if len(meta.dropna()) else None
    if sel:
        degr = pd.Series({d: v for d, v in sel["degraus"]}).sort_index()
        degr = degr[~degr.index.duplicated(keep="last")]
        fim = pd.Timestamp(sel["fim"])
        cal = pd.date_range(data_hoje.normalize(), fim + pd.DateOffset(months=13), freq="D")
        sd_ = degr.reindex(degr.index.union(cal)).ffill().bfill().reindex(cal)   # depois do fim: último degrau
        media12 = lambda t0: float(sd_[(sd_.index >= t0) & (sd_.index < t0 + pd.DateOffset(months=12))].mean())  # noqa: E731
        a0 = media12(data_hoje.normalize())
        pontos = [{"mes": str(mes_hoje), "date": data_hoje.strftime("%Y-%m-%d"), "selic": _r(sd_.iloc[0], 2),
                   "p1": _r(x_hoje["p1"], 3), "dy_just": _r(dyj_hoje, 3), "just": _r(p_hoje * dy_hoje / dyj_hoje, 2)}]
        for p in pd.period_range(mes_hoje + 1, fim.to_period("M"), freq="M"):
            t0 = p.to_timestamp(how="start")
            dias_mes = sd_[(sd_.index >= t0) & (sd_.index <= p.to_timestamp(how="end"))]
            if (dias_mes.index <= fim).sum() < 20:
                continue
            p1_k = x_hoje["p1"] + media12(t0) - a0
            dj = fit(p1_k, x_hoje["r30"])
            pontos.append({"mes": str(p), "date": p.to_timestamp(how="end").strftime("%Y-%m-%d"),
                           "selic": _r(dias_mes.mean(), 2), "p1": _r(p1_k, 3), "dy_just": _r(dj, 3),
                           "just": _r(p_hoje * dy_hoje / dj, 2)})
        if len(pontos) >= 3:
            projecao = {"inicio": pontos[0]["mes"], "fim": pontos[-1]["mes"], "pontos": pontos,
                        "selic": {k: sel.get(k) for k in ("origem", "ref", "gerado_em")},
                        "premissas": "O juro de 1 ano de cada mês = o de hoje + a variação da média da Selic implícita "
                                     "nos 12 meses seguintes (depois do fim da curva, o último degrau); NTN-B 30a e "
                                     "rendimentos ficam no nível de hoje."}
    else:
        print("[tijolo] [WARN] Selic implícita indisponível — sem projeção", file=sys.stderr)

    avisos = []
    atraso_cvm = (mes_hoje - cvm_ate).n
    if atraso_cvm > 2:
        avisos.append(f"O informe da CVM mais recente é de {cvm_ate}; VP e rendimentos podem estar defasados.")
    if (data_hoje - data_curva).days > 7:
        avisos.append(f"As curvas de juros do site estão paradas desde {data_curva.date()}.")

    ef = lambda k: _r(-b[k] * 0.1 / dyj_hoje * 100, 2)  # noqa: E731   (+0,1 p.p. → variação % do preço justificado)
    serie = []
    for m, r in S.iterrows():
        serie.append({"mes": str(m), "date": (data_hoje if m == mes_hoje else m.to_timestamp(how="end")).strftime("%Y-%m-%d"),
                      "parcial": bool(m == mes_hoje), "preco": _r(r["nivel_preco"], 2), "retorno_total": _r(r["nivel"], 2),
                      "ifix": _r(r.get("ifix"), 2), "dy": _r(r["dy"], 3), "dy_just": _r(r["dy_just"], 3),
                      "just": _r(r["just"], 2), "just_lo": _r(r["just_lo"], 2), "just_hi": _r(r["just_hi"], 2),
                      "pvp": _r(r.get("pvp"), 3), "n": int(r["n"]), "p1": _r(r["p1"], 3), "r30": _r(r["r30"], 3)})
    composicao = []
    if comp is not None:
        for _, r in comp.sort_values("w", ascending=False).iterrows():
            composicao.append({"ticker": r["ticker"], "peso": _r(r["w"] * 100, 2), "pvp": _r(r["pvp"], 3),
                               "dy": _r(r["dy12"] * 100, 2) if pd.notna(r["dy12"]) else None})
    return {
        "schema_version": SCHEMA_VERSION, "status": "ok", "generated_at": agora.isoformat(),
        "last_data_date": data_hoje.strftime("%Y-%m-%d"), "cvm_ate": str(cvm_ate),
        "curva_data": data_curva.strftime("%Y-%m-%d"),
        "hoje": {"date": data_hoje.strftime("%Y-%m-%d"), "preco": _r(p_hoje, 2), "dy": _r(dy_hoje, 3),
                 "dy_just": _r(dyj_hoje, 3), "just": _r(p_hoje * dy_hoje / dyj_hoje, 2),
                 "distancia_pct": _r((dy_hoje / dyj_hoje - 1) * 100, 2), "p1": _r(x_hoje["p1"], 3),
                 "r30": _r(x_hoje["r30"], 3), "pvp": _r(hoje_row.get("pvp"), 3), "n": int(hoje_row["n"])},
        "modelo": {"formula": "DY 12m = c + b1 × juro de 1 ano + b2 × NTN-B 30 anos", "n": int(len(am)),
                   "inicio": str(am.index.min()), "fim": str(am.index.max()), "r2": _r(res.rsquared, 3), "sd": _r(sd, 3),
                   "coef": {k: _r(v, 4) for k, v in b.items()}, "t": {k: _r(v, 2) for k, v in res.tvalues.items()},
                   "efeito_01": {"p1": ef("p1"), "r30": ef("r30"),
                                 "juntos": _r(-(b["p1"] + b["r30"]) * 0.1 / dyj_hoje * 100, 2)}},
        "projecao": projecao,
        "serie": serie,
        "composicao": composicao,
        "indice": {"base": str(BASE_MES), "n_hoje": int(hoje_row["n"]), "volume_sem_cnpj": _r(sem_cnpj * 100, 2),
                   "regras": {"limiar_tijolo": _r(LIMIAR_TIJOLO, 4), "janela_classificacao_meses": JANELA_CLASS,
                              "presenca": PRESENCA, "corte_negociabilidade": CORTE_IN,
                              "teto": TETO, "janela_liquidez_meses": JANELA_LIQ}},
        "avisos": avisos,
        "fontes": {"cotacoes": "B3 — COTAHIST (histórico oficial de cotações)", "fundos": "CVM — informe mensal de FII",
                   "juros": "Curvas PRE e IPCA do site (treasury_history.json)", "ifix": "B3 — IFIX diário",
                   "projecao": "Selic implícita do Panorama (charts/tables/selic_implicita.json)"},
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default="data-pipeline/out")
    ap.add_argument("--cache-dir", default="data-pipeline/cache")
    ap.add_argument("--upload", action="store_true")
    args = ap.parse_args()
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    try:
        payload = build(Path(args.cache_dir))
    except Exception as e:  # noqa: BLE001
        print(f"::error::índice de tijolo não publicado (site segue com o último bom): {e}")
        return 1
    out = out_dir / "fii_tijolo_modelo.json"
    out.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    h, m = payload["hoje"], payload["modelo"]
    print(f"[tijolo] {out} ({out.stat().st_size:,} bytes) | índice {h['preco']} ({h['n']} fundos) | DY {h['dy']} | "
          f"justificado {h['just']} ({h['distancia_pct']:+.1f}%) | R² {m['r2']} | coef {m['coef']}")
    if payload["projecao"]:
        u = payload["projecao"]["pontos"][-1]
        print(f"[tijolo] projeção até {u['mes']}: Selic {u['selic']} | juro 1a {u['p1']} | justificado {u['just']}")
    for a in payload["avisos"]:
        print(f"::warning::{a}")
    if args.upload:
        maybe_upload_json(out, BLOB_OUT)
    else:
        print("[tijolo] --upload NÃO setado; apenas salvou local.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
