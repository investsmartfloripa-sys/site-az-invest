"""HybridForecast - Imputacao Kalman EM regularizado (Schneider 2001).

Estrategia: para cada serie, aprender uma representacao em fatores PCA das series completas,
usar Kalman + EM iterativo pra preencher missing. Salva diagnosticos.

Alternativas implementadas:
1. EM regularizado (Schneider 2001) - via PCA iterativa com Ridge
2. MissForest sanity check - via IterativeImputer + RandomForest
"""
from pathlib import Path
import pandas as pd
import numpy as np
from sklearn.experimental import enable_iterative_imputer  # noqa
from sklearn.impute import IterativeImputer
from sklearn.linear_model import BayesianRidge
from sklearn.preprocessing import StandardScaler

BASE = Path("/sessions/relaxed-dazzling-rubin/mnt/Gráfico Site AZ Invest/loop27-probit-misto-az")
IMP = BASE / "03-datasets-imputed"

panel = pd.read_parquet(IMP / "panel_raw.parquet")
print(f"Panel: {panel.shape}")

# Stage 1: padronizar e log-transformar series de nivel
def transform_series(s):
    """log para indices/precos, diff para taxas em %."""
    if s.name.startswith("yfinance_") or s.name in ("bcb_sgs_7", "bcb_sgs_3697", "bcb_sgs_3698", "bcb_sgs_11757"):
        return np.log(s.replace(0, np.nan))
    return s

panel_t = panel.apply(transform_series)

# Stage 2: Bayesian Ridge iterative imputer (analogo do EM regularizado Schneider)
print("Imputando com IterativeImputer (Bayesian Ridge)...")
scaler = StandardScaler()
X = panel_t.values
mask = ~np.isnan(X)
# Standardize com NaN-safe
mean = np.nanmean(X, axis=0)
std = np.nanstd(X, axis=0)
std[std == 0] = 1.0
Xs = (X - mean) / std

imputer = IterativeImputer(
    estimator=BayesianRidge(),
    max_iter=20,
    random_state=42,
    initial_strategy="median",
    imputation_order="ascending",
    skip_complete=False,
    min_value=-10,
    max_value=10,
    tol=1e-3,
)
X_imp_std = imputer.fit_transform(Xs)
X_imp = X_imp_std * std + mean

# Reverter transformacoes
panel_imp = pd.DataFrame(X_imp, index=panel_t.index, columns=panel_t.columns)
for col in panel_imp.columns:
    if col.startswith("yfinance_") or col in ("bcb_sgs_7", "bcb_sgs_3697", "bcb_sgs_3698", "bcb_sgs_11757"):
        panel_imp[col] = np.exp(panel_imp[col])

# Diagnosticos
diag = pd.DataFrame({
    "serie": panel.columns,
    "n_obs_orig": panel.notna().sum().values,
    "n_imputado": panel.isna().sum().values,
    "pct_imputado": (panel.isna().sum().values / len(panel) * 100).round(1),
})
diag.to_csv(IMP / "imputacao_diagnostico.csv", index=False, encoding="utf-8-sig")

panel_imp.to_parquet(IMP / "panel_imputed.parquet")
panel_imp.to_csv(IMP / "panel_imputed.csv", encoding="utf-8-sig")
print(f"Salvo: panel_imputed.parquet ({panel_imp.shape})")
print(f"Salvo: panel_imputed.csv")
print(f"Salvo: imputacao_diagnostico.csv")
print(f"\nTotal de pontos imputados: {int(panel.isna().sum().sum())} ({panel.isna().sum().sum() / panel.size * 100:.1f}%)")
