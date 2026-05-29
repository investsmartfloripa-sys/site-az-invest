"""Probit Misto AZ - 4o modelo, Ridge L2 sobre (3 base lag1m) + TODAS antecedentes.

Features: outputs lag 1 dos 3 modelos base + transformacoes das antecedentes brutas.
Target: label recessao CODACE+FGV.
Estimacao: expanding window OOS, mes a mes.
Output: probabilidade, vetor beta historico, contribuicao por feature.
"""
from pathlib import Path
import numpy as np
import pandas as pd
from scipy import stats

BASE = Path("/sessions/relaxed-dazzling-rubin/mnt/Gráfico Site AZ Invest/loop27-probit-misto-az")
IMP = BASE / "03-datasets-imputed"
MOD = BASE / "04-modelos-base"
OUT = BASE / "05-probit-az"

panel = pd.read_parquet(IMP / "panel_imputed.parquet")
modelos = pd.read_parquet(MOD / "modelos_base_outputs.parquet")
label = pd.read_csv(OUT / "label_recessao.csv", index_col=0)
label.index = pd.to_datetime(label.index)
label = label["recessao"]

print(f"Panel: {panel.shape}, Modelos: {modelos.shape}, Label: {label.shape}")

# ============================================================
# Construir matriz X
# ============================================================
# 1. Modelos base lag 1m
X_modelos = modelos.shift(1)
X_modelos.columns = [f"M_{c}" for c in X_modelos.columns]

# 2. Antecedentes brutas - transformar series de NIVEL em VAR mensal/anual
# E selecionar so series com cobertura razoavel
SELECT_LEVELS = {
    # transformacao por tipo de serie
    "log_diff_12m": [
        "bcb_sgs_24364", "bcb_sgs_1453", "bcb_sgs_20620", "bcb_sgs_20622",
        "ipeadata_ABPO12_PAPEL12", "yfinance_^BVSP", "yfinance_^GSPC",
        "bcb_sgs_27791", "bcb_sgs_27814", "bcb_sgs_3697",
    ],
    "diff_12m": [
        "bcb_sgs_4189", "bcb_sgs_433", "bcb_sgs_1635", "bcb_sgs_189",
        "bcb_sgs_20783", "bcb_sgs_20784", "bcb_sgs_21082", "bcb_sgs_21084",
        "fred_DGS10", "fred_DGS3MO", "fred_VIXCLS",
    ],
    "level": [
        # Confianca FGV e similares (ja em indice)
        "bcb_sgs_21859", "bcb_sgs_21861", "bcb_sgs_21862", "bcb_sgs_21864", "bcb_sgs_21865",
        "bcb_sgs_8174", "bcb_sgs_8175", "bcb_sgs_4393",
        "olinda_Focus_IPCA_12m", "olinda_Focus_PIB_anual", "olinda_Focus_Selic_fim",
        "ocde_fred_BSCICP03BRM665S", "ocde_fred_BSCICP03USM665S",
        "ipeadata_JPM366_EMBI366",
    ],
}

X_features = pd.DataFrame(index=panel.index)
for transform, cols in SELECT_LEVELS.items():
    for col in cols:
        if col not in panel.columns:
            continue
        s = panel[col]
        if transform == "log_diff_12m":
            X_features[f"{col}_yoy"] = np.log(s.replace(0, np.nan)).diff(12) * 100
        elif transform == "diff_12m":
            X_features[f"{col}_d12"] = s.diff(12)
        else:
            X_features[f"{col}_lvl"] = s

# Spread DI: SGS 4189 (DI 360d) - FRED DGS3MO (US 3m proxy)? Nao, melhor SGS 4189 sozinho
# Term spread proxy domestico
if "bcb_sgs_4189" in panel.columns:
    X_features["term_spread_proxy"] = panel["bcb_sgs_4189"] - panel["bcb_sgs_4189"].rolling(60).mean()

# Concatenar
X = pd.concat([X_modelos, X_features], axis=1)
print(f"X shape: {X.shape} (features: {X.columns.tolist()[:5]}...)")

# Janela 2002-01 em diante (antes muitas features faltam)
X = X.loc["2002-01-01":].copy()
y = label.loc[X.index].copy()
print(f"Periodo treino: {X.index[0]} -> {X.index[-1]}, obs={len(X)}")

# Drop features com >40% missing apos slice
miss_pct = X.isna().sum() / len(X)
to_drop = miss_pct[miss_pct > 0.4].index.tolist()
print(f"Drop {len(to_drop)} features com >40% missing: {to_drop}")
X = X.drop(columns=to_drop)

# Imputar features remanescentes via forward-fill + median
X = X.ffill().fillna(X.median())
print(f"X apos limpeza: {X.shape}")

# ============================================================
# Probit Ridge L2 expanding window OOS
# ============================================================
def probit_ridge(X, y, lam=1.0, max_iter=50):
    n, k = X.shape
    X1 = np.column_stack([np.ones(n), X])
    b = np.zeros(k + 1)
    b[0] = stats.norm.ppf(np.clip(y.mean(), 1e-3, 1 - 1e-3))
    I_reg = np.eye(k + 1)
    I_reg[0, 0] = 0
    for it in range(max_iter):
        z = np.clip(X1 @ b, -6, 6)
        p = np.clip(stats.norm.cdf(z), 1e-6, 1 - 1e-6)
        phi = stats.norm.pdf(z)
        g = X1.T @ (phi * (y - p) / (p * (1 - p))) - lam * (I_reg @ b)
        w = phi ** 2 / (p * (1 - p))
        H = (X1.T * w) @ X1 + lam * I_reg
        try:
            delta = np.linalg.solve(H, g)
        except np.linalg.LinAlgError:
            break
        step = 1.0
        for _ in range(8):
            b_new = b + step * delta
            z_new = np.clip(X1 @ b_new, -6, 6)
            p_new = np.clip(stats.norm.cdf(z_new), 1e-6, 1 - 1e-6)
            ll_new = np.sum(y * np.log(p_new) + (1 - y) * np.log(1 - p_new))
            z_old = np.clip(X1 @ b, -6, 6)
            p_old = np.clip(stats.norm.cdf(z_old), 1e-6, 1 - 1e-6)
            ll_old = np.sum(y * np.log(p_old) + (1 - y) * np.log(1 - p_old))
            if ll_new > ll_old:
                b = b_new
                break
            step *= 0.5
        if np.abs(step * delta).max() < 1e-5:
            break
    return b

# Standardizar X
X_std = (X - X.mean()) / X.std()
X_std = X_std.fillna(0)
X_arr = X_std.values
y_arr = y.values.astype(float)

# Ridge L2 = k/n_train
probit_az = pd.Series(np.nan, index=X.index, name="probit_az_p")
betas_hist = pd.DataFrame(np.nan, index=X.index, columns=["intercept"] + X.columns.tolist())

window_min = 60  # 5 anos minimo para treinar
for t_idx in range(window_min, len(X)):
    X_tr = X_arr[:t_idx]
    y_tr = y_arr[:t_idx]
    if y_tr.sum() < 5:
        continue
    lam = X_arr.shape[1] / t_idx  # k/n
    try:
        b = probit_ridge(X_tr, y_tr, lam=lam)
        # Prever t
        x_t = X_arr[t_idx]
        z_t = np.clip(b[0] + x_t @ b[1:], -6, 6)
        probit_az.iloc[t_idx] = stats.norm.cdf(z_t)
        betas_hist.iloc[t_idx] = b
    except Exception as e:
        continue

print(f"\nProbit AZ: {probit_az.dropna().shape[0]} obs OOS")
print(f"  media={probit_az.mean():.3f}, max={probit_az.max():.3f}")

# Salvar outputs
probit_az.to_csv(OUT / "probabilidades.csv", header=True)
betas_hist.to_csv(OUT / "betas_historicos.csv", encoding="utf-8-sig")
betas_hist.to_parquet(OUT / "betas_historicos.parquet")

# Contribuicao do ultimo mes
last_t = probit_az.dropna().index[-1]
last_beta = betas_hist.loc[last_t]
last_x = X_std.loc[last_t]
contribuicao = pd.DataFrame({
    "beta": last_beta[1:],
    "x_std": last_x,
    "contribuicao_z": last_beta[1:] * last_x,
})
contribuicao["abs_contrib"] = contribuicao["contribuicao_z"].abs()
contribuicao = contribuicao.sort_values("abs_contrib", ascending=False)
contribuicao.to_csv(OUT / "contribuicao_ultimo_mes.csv", encoding="utf-8-sig")
print(f"\nTop 10 features contribuindo em {last_t.date()}:")
print(contribuicao.head(10).to_string())

# Tudo consolidado: 3 base + AZ
todos = pd.concat([modelos, probit_az], axis=1)
todos["mediana"] = todos.median(axis=1)
todos.to_csv(OUT / "4modelos_consolidado.csv", encoding="utf-8-sig")
todos.to_parquet(OUT / "4modelos_consolidado.parquet")
print(f"\nSalvo: 4modelos_consolidado.csv ({todos.shape})")
