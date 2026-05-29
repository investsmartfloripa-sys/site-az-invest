"""Consolida todos CSVs baixados em panel mensal wide (mes x serie)."""
from pathlib import Path
import pandas as pd

BASE = Path("/sessions/relaxed-dazzling-rubin/mnt/Gráfico Site AZ Invest/loop27-probit-misto-az")
RAW = BASE / "02-datasets-raw"
OUT = BASE / "03-datasets-imputed"

# Listar todos os CSVs
panels = []
for fonte_dir in sorted(RAW.iterdir()):
    if not fonte_dir.is_dir():
        continue
    for csv_file in sorted(fonte_dir.glob("*.csv")):
        try:
            df = pd.read_csv(csv_file)
            if "data" not in df.columns or "valor" not in df.columns:
                continue
            df["data"] = pd.to_datetime(df["data"], errors="coerce")
            df = df.dropna(subset=["data", "valor"])
            df["mes"] = df["data"].dt.to_period("M").dt.to_timestamp()
            df = df.groupby("mes", as_index=False)["valor"].last()
            serie_id = f"{fonte_dir.name}_{csv_file.stem}"
            df = df.rename(columns={"valor": serie_id})
            panels.append(df.set_index("mes")[serie_id])
        except Exception as e:
            print(f"  WARN {csv_file}: {e}")

# Merge tudo
panel = pd.concat(panels, axis=1).sort_index()
# Cortar 1996+ (antes tem poucas series)
panel = panel.loc["1996-01-01":]
print(f"Panel shape: {panel.shape}")
print(f"Periodo: {panel.index[0]} -> {panel.index[-1]}")
print(f"\nMissing por serie (top 10 mais missing):")
miss = panel.isna().sum().sort_values(ascending=False).head(10)
for s, m in miss.items():
    print(f"  {s:50s} {m:4d} missing ({m/len(panel)*100:.0f}%)")

print(f"\nMissing por serie (top 10 mais completas):")
compl = panel.isna().sum().sort_values().head(10)
for s, m in compl.items():
    print(f"  {s:50s} {m:4d} missing ({m/len(panel)*100:.0f}%)")

# Salvar
out_parquet = OUT / "panel_raw.parquet"
panel.to_parquet(out_parquet)
print(f"\nSalvo: {out_parquet}")

# CSV mais facil pro user inspecionar
out_csv = OUT / "panel_raw.csv"
panel.to_csv(out_csv, encoding="utf-8-sig")
print(f"Salvo: {out_csv}")

# Resumo
summary = pd.DataFrame({
    "serie": panel.columns,
    "n_obs": panel.notna().sum().values,
    "primeiro_dado": [panel[c].first_valid_index() for c in panel.columns],
    "ultimo_dado": [panel[c].last_valid_index() for c in panel.columns],
    "pct_missing": (panel.isna().sum().values / len(panel) * 100).round(1),
})
summary.to_csv(OUT / "panel_resumo.csv", index=False, encoding="utf-8-sig")
print(f"Salvo resumo: panel_resumo.csv")
