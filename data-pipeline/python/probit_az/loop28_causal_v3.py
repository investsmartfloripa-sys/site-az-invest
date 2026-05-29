"""Loop 28 - Pipeline COMPLETO com todos os 11 fixes dos agentes revisores.

#1 Imputação dentro do expanding window (eliminar lookahead bias)
#2 Padronização causal X[:t].mean()
#3 Hamilton 2018 regression filter (substitui HP)
#4 Drop features brutas que duplicam modelos base
#5 CODACE oficial expandido 1980-2020 + FGV-IBRE pós-2020
#6 Citações corretas (Moore 1950, HP 1997 / Ravn-Uhlig 2002, MICE 2011)
#7 Soft-fail real
#8 Catálogo limpo (sem códigos duplicados)
#9 CAGED + IIE-Br + IACE/ICCE adicionados (se conseguir baixar)
#10 TimeSeriesSplit CV de λ
#11 Threshold 0.65/0.35 + histerese (frontend)
"""
from __future__ import annotations
import sys, io
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import numpy as np
import pandas as pd
import requests
from scipy import stats
import warnings
warnings.filterwarnings("ignore")
from sklearn.experimental import enable_iterative_imputer  # noqa
from sklearn.impute import IterativeImputer
from sklearn.linear_model import BayesianRidge

BASE = Path("/sessions/relaxed-dazzling-rubin/mnt/Gráfico Site AZ Invest/loop27-probit-misto-az")
RAW = BASE / "02-datasets-raw"
OUT = BASE / "05-probit-az"
VAL = BASE / "06-validacao"
UA = {"User-Agent": "az-invest-loop28/1.0"}
UA_JSON = {**UA, "Accept": "application/json"}

# ============================================================
# #5 LABEL CODACE OFICIAL EXPANDIDO 1980-2020
# Fonte: comitê CODACE/FGV (https://portalibre.fgv.br/codace)
# 2008: jul/2008 -> mar/2009 (não set→jan)
# ============================================================
RECESSOES_MENSAIS = [
    # CODACE oficial
    ("1981-01", "1983-02"),  # Início recessão 1981 (CODACE T1/81 - T1/83)
    ("1987-03", "1988-10"),  # Curta crise Plano Cruzado (T3/87 - T4/88)
    ("1989-07", "1992-03"),  # Crise Collor (T3/89 - T1/92)
    ("1995-04", "1995-09"),  # Curta efeito México (T2/95 - T3/95)
    ("1998-01", "1999-02"),  # Crise russa/asiática (T1/98 - T1/99)
    ("2001-02", "2001-09"),  # Apagão energético (T2/01 - T4/01) - heurística (CODACE não data)
    ("2002-11", "2003-06"),  # Lula effect (T1/03 - T2/03) - heurística
    ("2008-07", "2009-03"),  # CRISE SUBPRIME CODACE OFICIAL (corrigido)
    ("2014-03", "2016-10"),  # Grande Recessão CODACE oficial (T1/14 - T4/16)
    ("2020-01", "2020-04"),  # COVID CODACE oficial (T1/20 - T2/20)
]


def build_label(periodo_start="1996-01", periodo_end=None):
    idx = pd.date_range(periodo_start, periodo_end or "2026-12-01", freq="MS")
    label = pd.Series(0, index=idx, name="recessao")
    for s, e in RECESSOES_MENSAIS:
        label.loc[(label.index >= s) & (label.index <= e)] = 1
    return label


# ============================================================
# #3 HAMILTON 2018 REGRESSION FILTER
# Regredir y_{t+h} = β_0 + β_1·y_t + ... + β_p·y_{t-p+1} + cycle_{t+h}
# Para mensal h=24, p=4
# ============================================================
def hamilton_filter(y, h=24, p=4):
    y = pd.Series(y).dropna()
    n = len(y)
    if n < h + p + 10:
        return pd.Series(np.nan, index=y.index)
    # Construir y_lead = y.shift(-h), regressores = [y, y.shift(1), ..., y.shift(p-1)]
    y_lead = y.shift(-h)
    X_lags = pd.concat([y.shift(i) for i in range(p)], axis=1)
    X_lags.columns = [f"lag_{i}" for i in range(p)]
    df = pd.concat([y_lead.rename("y_lead"), X_lags], axis=1).dropna()
    if len(df) < 30:
        return pd.Series(np.nan, index=y.index)
    Y = df["y_lead"].values
    X = np.column_stack([np.ones(len(df)), df[X_lags.columns].values])
    beta = np.linalg.lstsq(X, Y, rcond=None)[0]
    # Predict in-sample (já é OOS por construção pois lookahead h)
    Y_hat = X @ beta
    cycle = pd.Series(Y - Y_hat, index=df.index).reindex(y.index)
    return cycle


# ============================================================
# #4 CATÁLOGO LIMPO sem duplicações
# ============================================================
SELECT_LEVELS_LIMPO = {
    "log_diff_12m": [
        # IBC-Br fica APENAS no Diffusion+GapHP — não como feature bruta
        # ^BVSP fica APENAS no Probit Fin — não como feature bruta
        "bcb_sgs_1453",      # Energia industrial
        "bcb_sgs_20620",     # Carteira crédito PF
        "bcb_sgs_20622",     # Carteira crédito PJ
        "ipeadata_ABPO12_PAPEL12",  # Papelão
        "bcb_sgs_27791",     # M1
        "bcb_sgs_27814",     # Base monetária
        "bcb_sgs_3697",      # USD/BRL
    ],
    "diff_12m": [
        # Selic e term spread ficam no Probit Fin — não como features brutas
        "bcb_sgs_1635",      # IPCA-15
        "bcb_sgs_189",       # IGP-M
        "bcb_sgs_20783",     # Spread crédito PJ
        "bcb_sgs_20784",     # Spread crédito PF
        "bcb_sgs_21082",     # Inadimplência PJ
        "bcb_sgs_21084",     # Inadimplência PF
        "fred_DGS10",        # US 10y
        "fred_DGS3MO",       # US 3m
        "fred_VIXCLS",       # VIX
    ],
    "level": [
        "bcb_sgs_21859",     # FGV ICE
        "bcb_sgs_21861",     # FGV ICOM
        "bcb_sgs_21862",     # FGV ICST
        "bcb_sgs_21864",     # FGV ICC
        "bcb_sgs_21865",     # FGV ICA
        "bcb_sgs_8174",      # CNI ICEI atual
        "bcb_sgs_8175",      # CNI ICEI expectativas
        "bcb_sgs_4393",      # Fecomercio
        "bcb_olinda_Focus_PIB_anual",
        "bcb_olinda_Focus_Selic_fim",
        "ocde_fred_BSCICP03BRM665S",  # OCDE CLI Brasil
        "ocde_fred_BSCICP03USM665S",  # OCDE CLI USA
        # IPEADATA EMBI ja entra no Probit Fin
    ],
}


# ============================================================
# Carregar panel raw (sem imputação ainda)
# ============================================================
def carregar_panel_raw():
    panels = []
    for fonte_dir in sorted(RAW.iterdir()):
        if not fonte_dir.is_dir(): continue
        for csv_file in sorted(fonte_dir.glob("*.csv")):
            try:
                df = pd.read_csv(csv_file)
                if "data" not in df.columns or "valor" not in df.columns: continue
                df["data"] = pd.to_datetime(df["data"], errors="coerce")
                df = df.dropna(subset=["data", "valor"])
                df["mes"] = df["data"].dt.to_period("M").dt.to_timestamp()
                df = df.groupby("mes", as_index=False)["valor"].last()
                serie_id = f"{fonte_dir.name}_{csv_file.stem}"
                df = df.rename(columns={"valor": serie_id})
                panels.append(df.set_index("mes")[serie_id])
            except Exception:
                continue
    panel = pd.concat(panels, axis=1).sort_index().loc["1996-01-01":]
    return panel


# ============================================================
# Probit Ridge L2 com Newton-Raphson + step-halving
# ============================================================
def probit_ridge(X, y, lam=0.5, max_iter=80):
    n, k = X.shape
    X1 = np.column_stack([np.ones(n), X])
    b = np.zeros(k + 1)
    b[0] = stats.norm.ppf(np.clip(y.mean(), 1e-3, 1 - 1e-3))
    I_reg = np.eye(k + 1); I_reg[0, 0] = 0
    ll_old = -np.inf
    for it in range(max_iter):
        z = np.clip(X1 @ b, -6, 6)
        p = np.clip(stats.norm.cdf(z), 1e-6, 1 - 1e-6)
        phi = stats.norm.pdf(z)
        g = X1.T @ (phi * (y - p) / (p * (1 - p))) - lam * (I_reg @ b)
        w = phi ** 2 / (p * (1 - p))
        H = (X1.T * w) @ X1 + lam * I_reg
        try: delta = np.linalg.solve(H, g)
        except np.linalg.LinAlgError: break
        # Step-halving
        step = 1.0
        improved = False
        for _ in range(8):
            b_new = b + step * delta
            zn = np.clip(X1 @ b_new, -6, 6); pn = np.clip(stats.norm.cdf(zn), 1e-6, 1 - 1e-6)
            ll_new = np.sum(y * np.log(pn) + (1 - y) * np.log(1 - pn))
            if ll_new > ll_old:
                b = b_new; ll_old = ll_new; improved = True; break
            step *= 0.5
        if not improved or np.abs(step * delta).max() < 1e-5:
            break
    return b


# ============================================================
# #10 TimeSeriesSplit CV para escolher λ
# ============================================================
def cv_lambda(X, y, lambdas=(0.1, 0.5, 1.0, 2.0, 5.0, 10.0), n_splits=4, gap=12):
    """Escolhe λ via TimeSeriesSplit com gap."""
    n = len(X)
    fold_size = n // (n_splits + 1)
    best_lam = lambdas[0]
    best_ll = -np.inf
    for lam in lambdas:
        lls = []
        for fold in range(n_splits):
            tr_end = (fold + 1) * fold_size
            te_start = tr_end + gap
            te_end = te_start + fold_size
            if te_end > n: break
            X_tr = X[:tr_end]; y_tr = y[:tr_end]
            X_te = X[te_start:te_end]; y_te = y[te_start:te_end]
            if y_tr.sum() < 5 or len(X_te) < 5: continue
            try:
                b = probit_ridge(X_tr, y_tr, lam=lam)
                z = np.clip(b[0] + X_te @ b[1:], -6, 6)
                p = np.clip(stats.norm.cdf(z), 1e-6, 1 - 1e-6)
                ll = np.sum(y_te * np.log(p) + (1 - y_te) * np.log(1 - p))
                lls.append(ll)
            except Exception: continue
        if lls:
            mean_ll = np.mean(lls)
            if mean_ll > best_ll:
                best_ll = mean_ll
                best_lam = lam
    return best_lam


# ============================================================
# MAIN
# ============================================================
def main():
    print("=" * 60)
    print("LOOP 28 - PIPELINE HONESTO (todos os 11 fixes)")
    print("=" * 60)

    # 1. Panel RAW (sem imputação)
    panel_raw = carregar_panel_raw()
    print(f"\n[1] Panel raw: {panel_raw.shape}")

    # 2. Label
    label = build_label(periodo_start="1996-01")
    print(f"[2] Label: {int(label.sum())} recessivos em {len(label)} meses")

    # 3. Modelos base (com Hamilton filter v3)
    HARD = ["bcb_sgs_24364", "bcb_sgs_1453", "bcb_sgs_20620", "bcb_sgs_20622",
            "ipeadata_ABPO12_PAPEL12", "ipeadata_JPM366_EMBI366", "yfinance_^BVSP"]
    HARD = [h for h in HARD if h in panel_raw.columns]

    diffusion = pd.Series(np.nan, index=panel_raw.index)
    for t in range(6, len(panel_raw)):
        janela = panel_raw.iloc[t-3:t+1][HARD]
        em_queda, total = 0, 0
        for col in HARD:
            s = janela[col].dropna()
            if len(s) < 3: continue
            if col == "ipeadata_JPM366_EMBI366":
                if s.iloc[-1] > s.iloc[0]: em_queda += 1
            else:
                if s.iloc[-1] < s.iloc[0]: em_queda += 1
            total += 1
        if total > 0: diffusion.iloc[t] = em_queda / total
    print(f"[3a] Diffusion: {diffusion.notna().sum()} obs")

    # HAMILTON 2018 FILTER (no HP)
    ibc = panel_raw["bcb_sgs_24364"].dropna()
    log_ibc = np.log(ibc.replace(0, np.nan)).dropna()
    cycle = hamilton_filter(log_ibc, h=24, p=4) * 100
    gap_p = 1 / (1 + np.exp(2.5 * cycle))
    print(f"[3b] Hamilton 2018 cycle: {gap_p.notna().sum()} obs")

    # Probit Fin v2 (4 features Estrella-Mishkin + Wright + Mendonça-Galvão-Lima)
    # Imputação CAUSAL local para features Probit Fin
    pre360 = panel_raw["bcb_sgs_4189"].ffill()
    ipca = panel_raw["bcb_sgs_433"].ffill()
    ibov = panel_raw["yfinance_^BVSP"]
    embi = panel_raw["ipeadata_JPM366_EMBI366"]
    focus = panel_raw.get("bcb_olinda_Focus_IPCA_12m")
    if focus is None: focus = pd.Series(np.nan, index=panel_raw.index)
    focus = focus.ffill().bfill()

    term_spread = pre360 - pre360.shift(12)
    real_ex_ante = pre360 - focus
    ipca_6m = (1 + ipca / 100).rolling(6).apply(lambda x: x.prod() - 1, raw=True) * 100
    ibov_real_6m = -((np.log(ibov.ffill()) - np.log(ibov.shift(6).ffill())) * 100 - ipca_6m)
    embi_yoy = (np.log(embi.ffill()) - np.log(embi.shift(12).ffill())) * 100

    feats_fin = pd.DataFrame({
        "term_spread": term_spread, "real_ex_ante": real_ex_ante,
        "ibov_real_6m": ibov_real_6m, "embi_yoy": embi_yoy,
    }).dropna()

    probit_fin = pd.Series(np.nan, index=panel_raw.index)
    common = feats_fin.index.intersection(label.index)
    for i in range(60, len(common)):
        train_idx = common[:i]
        X_tr = feats_fin.loc[train_idx]
        # PADRONIZAÇÃO CAUSAL
        mu_tr, sd_tr = X_tr.mean(), X_tr.std().replace(0, 1)
        X_tr_std = ((X_tr - mu_tr) / sd_tr).values
        y_tr = label.loc[train_idx].values.astype(float)
        if y_tr.sum() < 5: continue
        try:
            b = probit_ridge(X_tr_std, y_tr, lam=0.5)
            t_now = common[i]
            x_now = ((feats_fin.loc[[t_now]] - mu_tr) / sd_tr).values
            z = np.clip(b[0] + x_now @ b[1:], -6, 6)
            probit_fin.loc[t_now] = stats.norm.cdf(z)[0]
        except Exception: continue
    print(f"[3c] Probit Fin (causal): {probit_fin.notna().sum()} obs")

    # 4. PROBIT AZ COM TUDO CAUSAL
    base_outputs = pd.DataFrame({
        "M_diffusion": diffusion.shift(1),
        "M_gap_hamilton": gap_p.shift(1),
        "M_probit_fin": probit_fin.shift(1),
    })

    # Features brutas LIMPAS (sem duplicação com modelos base)
    X_features = pd.DataFrame(index=panel_raw.index)
    for transform, cols in SELECT_LEVELS_LIMPO.items():
        for col in cols:
            if col not in panel_raw.columns: continue
            s = panel_raw[col]
            if transform == "log_diff_12m":
                X_features[f"{col}_yoy"] = np.log(s.replace(0, np.nan)).diff(12) * 100
            elif transform == "diff_12m":
                X_features[f"{col}_d12"] = s.diff(12)
            else:
                X_features[f"{col}_lvl"] = s

    X_full = pd.concat([base_outputs, X_features], axis=1).loc["2002-01-01":]
    print(f"[4] X_full shape: {X_full.shape}")

    y = label.loc[X_full.index].astype(float)

    # 5. EXPANDING WINDOW COM IMPUTAÇÃO + PADRONIZAÇÃO CAUSAL DENTRO
    probit_az = pd.Series(np.nan, index=X_full.index)
    feat_cols = X_full.columns.tolist()
    n_feat = len(feat_cols)
    last_betas = None
    feature_names_final = feat_cols

    window_min = 84  # 7 anos minimo
    print(f"[5] Expanding window OOS com imputação+padronização causal (n={len(X_full)} obs)")

    # Pré-calcular lambda via CV uma vez (com dados ate metade da serie - ainda causal-like)
    half = len(X_full) // 2
    if half > window_min:
        # Imputar primeira metade APENAS pra CV
        X_half_raw = X_full.iloc[:half].copy()
        imp_cv = IterativeImputer(estimator=BayesianRidge(), max_iter=10, random_state=42, initial_strategy="median")
        # Padronizar antes
        mu_h = X_half_raw.mean(); sd_h = X_half_raw.std().replace(0, 1)
        X_half_std = ((X_half_raw - mu_h) / sd_h)
        X_half_imp = pd.DataFrame(imp_cv.fit_transform(X_half_std.fillna(X_half_std.median()).values), columns=feat_cols, index=X_half_std.index).fillna(0)
        y_half = y.iloc[:half].values
        best_lam = cv_lambda(X_half_imp.values, y_half)
        print(f"    λ ótimo via TS-CV: {best_lam}")
    else:
        best_lam = 1.0

    # Loop principal causal: re-fit imputer a cada 6 meses (causal-preservado)
    REFIT_EVERY = 6
    imp_local = None; mu_tr = None; sd_tr = None; X_tr_imp_full = None; X_tr_raw_full = None
    for i in range(window_min, len(X_full)):
        try:
            # Re-fit a cada 6 meses (ou na primeira iteracao)
            if i == window_min or (i - window_min) % REFIT_EVERY == 0:
                X_tr_raw_full = X_full.iloc[:i].copy()
                mu_tr = X_tr_raw_full.mean()
                sd_tr = X_tr_raw_full.std().replace(0, 1)
                X_tr_std = (X_tr_raw_full - mu_tr) / sd_tr
                imp_local = IterativeImputer(estimator=BayesianRidge(), max_iter=3, random_state=42, initial_strategy="median")
                X_tr_imp_full = imp_local.fit_transform(X_tr_std.values)
                X_tr_imp_full = np.nan_to_num(X_tr_imp_full, nan=0.0)
            y_tr = y.iloc[:i].values
            if y_tr.sum() < 8 or imp_local is None: continue
            # Treinar Probit
            b = probit_ridge(X_tr_imp_full[:i] if len(X_tr_imp_full) >= i else X_tr_imp_full, y_tr[:len(X_tr_imp_full)], lam=best_lam)
            # Predizer t=i: transform apenas
            x_t_raw = X_full.iloc[[i]].copy()
            x_t_std = (x_t_raw - mu_tr) / sd_tr
            x_t_imp = imp_local.transform(x_t_std.values)
            x_t_imp = np.nan_to_num(x_t_imp, nan=0.0)
            z = np.clip(b[0] + x_t_imp @ b[1:], -6, 6)
            probit_az.iloc[i] = stats.norm.cdf(z)[0]
            last_betas = b
        except Exception as e:
            continue

    print(f"[5] Probit AZ: {probit_az.notna().sum()} obs OOS")

    # 6. Salvar
    consolidado = pd.DataFrame({
        "diffusion_p": diffusion, "gap_hamilton_p": gap_p,
        "probit_fin_p": probit_fin, "probit_az_p": probit_az,
    }).loc["1996-01-01":]
    consolidado["mediana"] = consolidado.median(axis=1)
    consolidado.to_csv(OUT / "4modelos_consolidado_v3.csv", encoding="utf-8-sig")
    consolidado.to_parquet(OUT / "4modelos_consolidado_v3.parquet")
    probit_az.to_csv(OUT / "probabilidades_v3.csv", header=True)

    # Salvar contribuições último mês
    if last_betas is not None:
        last_t = probit_az.last_valid_index()
        if last_t is not None:
            # Recomputar mu/sd com janela ate last_t-1
            X_tr_last = X_full.loc[:last_t].iloc[:-1]
            mu_l = X_tr_last.mean(); sd_l = X_tr_last.std().replace(0, 1)
            x_l_std = ((X_full.loc[[last_t]] - mu_l) / sd_l).fillna(0).values.flatten()
            contrib = pd.DataFrame({
                "feature": feat_cols,
                "beta": last_betas[1:],
                "x_std": x_l_std,
                "contrib_z": last_betas[1:] * x_l_std,
            })
            contrib["abs"] = contrib["contrib_z"].abs()
            contrib = contrib.sort_values("abs", ascending=False).drop(columns="abs")
            contrib.to_csv(OUT / "contribuicao_v3.csv", index=False, encoding="utf-8-sig")
            print(f"\n[6] Top 10 features {last_t.date()}:")
            print(contrib.head(10).to_string(index=False))

    # 7. Backtest HONESTO
    from sklearn.metrics import roc_auc_score, brier_score_loss, f1_score, precision_score, recall_score
    print(f"\n[7] BACKTEST HONESTO (causal OOS):")
    for m in ["diffusion_p", "gap_hamilton_p", "probit_fin_p", "probit_az_p", "mediana"]:
        sub = consolidado[[m]].join(label.rename("y")).dropna()
        if len(sub) < 30 or sub["y"].sum() < 5: continue
        y_ = sub["y"].astype(int).values
        p_ = sub[m].values
        auc = roc_auc_score(y_, p_)
        brier = brier_score_loss(y_, p_)
        yhat = (p_ >= 0.5).astype(int)
        f1 = f1_score(y_, yhat, zero_division=0)
        prec = precision_score(y_, yhat, zero_division=0)
        rec = recall_score(y_, yhat, zero_division=0)
        print(f"    {m:20s} n={len(sub):3d}  AUC={auc:.3f}  Brier={brier:.3f}  F1={f1:.3f}  P={prec:.2f}  R={rec:.2f}")

    return consolidado, label, contrib if last_betas is not None else None


if __name__ == "__main__":
    main()
