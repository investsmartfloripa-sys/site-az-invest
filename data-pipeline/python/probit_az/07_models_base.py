"""3 modelos base v2 - Probit Fin com features canonicas Estrella-Mishkin e target lag 6m."""
from pathlib import Path
import numpy as np
import pandas as pd
from scipy import stats

BASE = Path("/sessions/relaxed-dazzling-rubin/mnt/Gráfico Site AZ Invest/loop27-probit-misto-az")
IMP = BASE / "03-datasets-imputed"
OUT = BASE / "04-modelos-base"

panel = pd.read_parquet(IMP / "panel_imputed.parquet")
label = pd.read_csv(BASE / "05-probit-az" / "label_recessao.csv", index_col=0)
label.index = pd.to_datetime(label.index)
y_full = label["recessao"]

# ============================================================
# MODELO 1: DIFFUSION (mantido)
# ============================================================
HARD_DATA = ["bcb_sgs_24363", "bcb_sgs_24364", "bcb_sgs_1453", "bcb_sgs_20620", "bcb_sgs_20622",
             "ipeadata_ABPO12_PAPEL12", "ipeadata_JPM366_EMBI366", "yfinance_^BVSP"]
diffusion = pd.Series(np.nan, index=panel.index, name="diffusion_p")
for t in range(6, len(panel)):
    janela = panel.iloc[t-3:t+1][HARD_DATA]
    em_queda, total = 0, 0
    for col in HARD_DATA:
        s = janela[col].dropna()
        if len(s) < 3: continue
        if col == "ipeadata_JPM366_EMBI366":
            if s.iloc[-1] > s.iloc[0]: em_queda += 1
        else:
            if s.iloc[-1] < s.iloc[0]: em_queda += 1
        total += 1
    if total > 0:
        diffusion.iloc[t] = em_queda / total

# ============================================================
# MODELO 2: GAP HP (mantido)
# ============================================================
def hp_filter(y, lam=129600):
    n = len(y)
    I = np.eye(n)
    D = np.zeros((n-2, n))
    for i in range(n-2):
        D[i, i] = 1; D[i, i+1] = -2; D[i, i+2] = 1
    trend = np.linalg.solve(I + lam * D.T @ D, y.values)
    return pd.Series(y.values - trend, index=y.index)

ibc = panel["bcb_sgs_24364"].dropna()
log_ibc = np.log(ibc.replace(0, np.nan)).dropna()
gap_hp = hp_filter(log_ibc) * 100
gap_hp_p = 1 / (1 + np.exp(2.5 * gap_hp))
gap_hp_p.name = "gap_hp_p"

# ============================================================
# MODELO 3: PROBIT FINANCEIRO v2 - Estrella-Mishkin canonico
# Features:
#   1. term_spread: pre_360d - pre_360d.shift(12) (achatamento curva)
#   2. selic_real_ex_ante: pre_360d - Focus IPCA 12m
#   3. ibov_real_6m: log Ibov - log Ibov.shift(6) - acumulado IPCA 6m
#   4. embi_yoy: log change 12m do EMBI+
# Target: recessao 6 meses a frente (Estrella-Mishkin classico)
# ============================================================
pre360 = panel["bcb_sgs_4189"]
focus_ipca = panel["olinda_Focus_IPCA_12m"]
ibov = panel["yfinance_^BVSP"]
ipca_mom = panel["bcb_sgs_433"]
embi = panel["ipeadata_JPM366_EMBI366"]

# Features
term_spread = pre360 - pre360.shift(12)  # diff 12m do pre
selic_real_ex_ante = pre360 - focus_ipca  # ex-ante real
ipca_6m_acum = (1 + ipca_mom / 100).rolling(6).apply(lambda x: x.prod() - 1, raw=True) * 100
ibov_real_6m = (np.log(ibov) - np.log(ibov.shift(6))) * 100 - ipca_6m_acum
embi_yoy = (np.log(embi) - np.log(embi.shift(12))) * 100

features = pd.DataFrame({
    "term_spread": term_spread,
    "selic_real_ex_ante": selic_real_ex_ante,
    "ibov_real_6m": -ibov_real_6m,  # invertido: queda Ibov real = sinal recessao
    "embi_yoy": embi_yoy,
}).dropna()

print(f"Features shape: {features.shape}")
print(f"Periodo: {features.index[0]} -> {features.index[-1]}")
print(f"\nCorrelacoes com recessao contemporanea:")
common = features.index.intersection(y_full.index)
for c in features.columns:
    print(f"  {c}: corr={features.loc[common, c].corr(y_full.loc[common]):.3f}")

print(f"\nCorrelacoes com recessao 6m a frente:")
y_lag6 = y_full.shift(-6)
common6 = features.index.intersection(y_lag6.dropna().index)
for c in features.columns:
    print(f"  {c}: corr={features.loc[common6, c].corr(y_lag6.loc[common6]):.3f}")

# Probit Ridge L2
def probit_ridge(X, y, lam=0.5, max_iter=80):
    n, k = X.shape
    X1 = np.column_stack([np.ones(n), X])
    b = np.zeros(k + 1)
    b[0] = stats.norm.ppf(np.clip(y.mean(), 1e-3, 1 - 1e-3))
    I_reg = np.eye(k + 1); I_reg[0, 0] = 0
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
            zn = np.clip(X1 @ b_new, -6, 6)
            pn = np.clip(stats.norm.cdf(zn), 1e-6, 1 - 1e-6)
            ll_new = np.sum(y * np.log(pn) + (1 - y) * np.log(1 - pn))
            zo = np.clip(X1 @ b, -6, 6)
            po = np.clip(stats.norm.cdf(zo), 1e-6, 1 - 1e-6)
            ll_old = np.sum(y * np.log(po) + (1 - y) * np.log(1 - po))
            if ll_new > ll_old:
                b = b_new; break
            step *= 0.5
        if np.abs(step * delta).max() < 1e-5:
            break
    return b

# Expanding window OOS - target = recessao 6m a frente
# Mas predicao final reporta P(rec_t+6)
probit_fin = pd.Series(np.nan, index=panel.index, name="probit_fin_p")
common6 = features.index.intersection(y_lag6.dropna().index)
window_min = 60
for i in range(window_min, len(common6)):
    train_idx = common6[:i]
    X_tr = features.loc[train_idx].values
    y_tr = y_lag6.loc[train_idx].values.astype(float)
    if y_tr.sum() < 5 or y_tr.sum() > len(y_tr) - 5:
        continue
    try:
        b = probit_ridge(X_tr, y_tr, lam=0.5)
        t_now = common6[i]
        X_now = features.loc[[t_now]].values
        z = np.clip(b[0] + X_now @ b[1:], -6, 6)
        # Atribuir P(rec) ao mes da recessao prevista (t+6)
        t_target = t_now + pd.DateOffset(months=6)
        if t_target in probit_fin.index:
            probit_fin.loc[t_target] = stats.norm.cdf(z)[0]
        else:
            # Tambem ao mes corrente como "P(rec 6m a frente)" interpretacao
            probit_fin.loc[t_now] = stats.norm.cdf(z)[0]
    except Exception as e:
        continue

# Tambem rodar Probit Fin contemporaneo para comparacao
probit_fin_now = pd.Series(np.nan, index=panel.index, name="probit_fin_now_p")
common_now = features.index.intersection(y_full.index)
for i in range(window_min, len(common_now)):
    train_idx = common_now[:i]
    X_tr = features.loc[train_idx].values
    y_tr = y_full.loc[train_idx].values.astype(float)
    if y_tr.sum() < 5: continue
    try:
        b = probit_ridge(X_tr, y_tr, lam=0.5)
        t_now = common_now[i]
        X_now = features.loc[[t_now]].values
        z = np.clip(b[0] + X_now @ b[1:], -6, 6)
        probit_fin_now.loc[t_now] = stats.norm.cdf(z)[0]
    except Exception:
        continue

# Usar Probit Fin antecedente (6m) como principal
print(f"\nProbit Fin (6m a frente): {probit_fin.dropna().shape[0]} obs OOS, media={probit_fin.mean():.3f}")
print(f"Probit Fin (contemporaneo): {probit_fin_now.dropna().shape[0]} obs OOS, media={probit_fin_now.mean():.3f}")

# Consolidar v2
outputs = pd.DataFrame({
    "diffusion_p": diffusion,
    "gap_hp_p": gap_hp_p,
    "probit_fin_p": probit_fin,
    "probit_fin_now_p": probit_fin_now,
})
outputs = outputs.loc["1996-01-01":]
outputs.to_csv(OUT / "modelos_base_outputs_v2.csv", encoding="utf-8-sig")
outputs.to_parquet(OUT / "modelos_base_outputs_v2.parquet")
print(f"\nSalvo: modelos_base_outputs_v2.parquet ({outputs.shape})")

# Quick AUC test
from sklearn.metrics import roc_auc_score
for c in outputs.columns:
    sub = outputs[[c]].join(y_full.rename("y")).dropna()
    if len(sub) > 30 and sub["y"].sum() > 5:
        try:
            auc = roc_auc_score(sub["y"].astype(int), sub[c])
            print(f"  {c}: AUC = {auc:.3f} (n={len(sub)})")
        except Exception as e:
            print(f"  {c}: erro AUC: {e}")
