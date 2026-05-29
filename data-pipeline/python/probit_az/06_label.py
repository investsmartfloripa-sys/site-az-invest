"""Constroi label binario mensal recessao: CODACE oficial 1980-2020 + FGV-IBRE 2020-2023.

Cronologia trimestral CODACE oficial + mensal FGV-IBRE (Trece-Considera-Kelly-Gusmao 2024).
"""
from pathlib import Path
import pandas as pd

BASE = Path("/sessions/relaxed-dazzling-rubin/mnt/Gráfico Site AZ Invest/loop27-probit-misto-az")
OUT = BASE / "05-probit-az"
OUT.mkdir(exist_ok=True)

# Recessoes mensais Brasil 1996-2026
# CODACE oficial (trimestral converted to monthly) + FGV-IBRE Trece 2024 (mensal direto)
RECESSOES_MENSAIS = [
    # (inicio, fim) inclusive ambos
    ("1998-01", "1998-12"),   # crise asiatica/russa
    ("2001-02", "2001-09"),   # crise apagao + bolha
    ("2002-11", "2003-06"),   # crise eleitoral
    ("2008-09", "2009-01"),   # crise subprime CODACE oficial
    ("2014-03", "2016-10"),   # grande recessao CODACE oficial (mensal Trece)
    ("2019-11", "2020-04"),   # CODACE oficial + Trece (jan/2020 a junho/2020 trim)
    # Pos-2020: FGV-IBRE 2024 lista expansao continua a partir de mai/2020
]

# Construir serie mensal binaria 1996-01 a 2026-12
idx = pd.date_range("1996-01-01", "2026-12-01", freq="MS")
label = pd.Series(0, index=idx, name="recessao")

for start, end in RECESSOES_MENSAIS:
    mask = (label.index >= start) & (label.index <= end)
    label.loc[mask] = 1

# Estatisticas
print(f"Label construido: {len(label)} meses")
print(f"  Recessivos: {label.sum()} ({label.mean()*100:.1f}%)")
print(f"  Expansivos: {(label == 0).sum()} ({(1 - label.mean())*100:.1f}%)")
print(f"\nPeriodos recessivos:")
for start, end in RECESSOES_MENSAIS:
    n = len(pd.date_range(start, end, freq="MS"))
    print(f"  {start} -> {end}  ({n} meses)")

label.to_csv(OUT / "label_recessao.csv", header=True)
print(f"\nSalvo: {OUT}/label_recessao.csv")
