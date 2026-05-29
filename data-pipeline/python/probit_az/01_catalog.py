"""Loop 27 #1 - Catalogo exaustivo de antecedentes 100% automaticas.

Categorias:
1. FIN_TERM - estrutura a termo / spreads
2. FIN_RISCO - risco-pais / credito
3. FIN_MERCADO - bolsa / cambio / commodities
4. SOND_EMPRESARIAL - sondagens FGV/CNI
5. SOND_CONSUMIDOR - confianca consumidor / varejo
6. REAL_PRODUCAO - PIM categorias, ANFAVEA, EPE
7. REAL_VENDAS_CRED - PMC, crediario, concessoes
8. GLOBAL - OCDE CLI, commodities, indices mundiais

Saida: 01-catalogo/catalogo_antecedentes.xlsx
"""
from __future__ import annotations
import pandas as pd
from pathlib import Path

OUT = Path("/sessions/relaxed-dazzling-rubin/mnt/Gráfico Site AZ Invest/loop27-probit-misto-az/01-catalogo")

# Catalogo manual cuidadoso, cada linha = 1 serie
SERIES = [
    # === FIN_TERM - Estrutura a termo / juros ===
    ("FIN_TERM", "BCB_SGS", "1178", "DI Pre 360d", "Diaria", "% a.a.", "2002-01", "fundamental"),
    ("FIN_TERM", "BCB_SGS", "4189", "DI Pre 180d", "Diaria", "% a.a.", "2002-01", "fundamental"),
    ("FIN_TERM", "BCB_SGS", "432", "Selic meta", "Diaria", "% a.a.", "1999-03", "fundamental"),
    ("FIN_TERM", "BCB_SGS", "12", "CDI", "Diaria", "% a.d.", "1986-03", "alternativo"),
    ("FIN_TERM", "IPEADATA", "BMF12_SWAPDI360", "Swap DI 360d (IPEADATA)", "Diaria", "% a.a.", "1999-03", "fallback_slope_di"),
    ("FIN_TERM", "IPEADATA", "BMF12_SWAPDI180", "Swap DI 180d (IPEADATA)", "Diaria", "% a.a.", "1999-03", "fallback"),
    ("FIN_TERM", "IPEADATA", "BMF12_TJTLP12", "TJLP", "Mensal", "% a.a.", "1995-03", "alternativo"),
    # === FIN_RISCO ===
    ("FIN_RISCO", "IPEADATA", "JPM366_EMBI366", "EMBI+ Brasil JP Morgan", "Diaria", "bps", "1994-04", "core_antecedente"),
    ("FIN_RISCO", "BCB_SGS", "20783", "Spread medio credito PJ", "Mensal", "pp", "2011-03", "core_antecedente"),
    ("FIN_RISCO", "BCB_SGS", "20784", "Spread credito PF", "Mensal", "pp", "2011-03", "complementar"),
    ("FIN_RISCO", "BCB_SGS", "21082", "Inadimplencia credito PJ 90d", "Mensal", "%", "2011-03", "complementar"),
    ("FIN_RISCO", "BCB_SGS", "21084", "Inadimplencia credito PF 90d", "Mensal", "%", "2011-03", "complementar"),
    # === FIN_MERCADO ===
    ("FIN_MERCADO", "BCB_SGS", "7", "Ibovespa medio mensal", "Mensal", "pontos", "1968-07", "componente_IACE"),
    ("FIN_MERCADO", "YFINANCE", "^BVSP", "Ibovespa fechamento diario", "Diaria", "pontos", "1993-01", "fallback"),
    ("FIN_MERCADO", "BCB_SGS", "3697", "USD/BRL comercial venda", "Diaria", "BRL/USD", "1994-07", "componente"),
    ("FIN_MERCADO", "BCB_SGS", "3698", "USD/BRL comercial compra", "Diaria", "BRL/USD", "1994-07", "alternativo"),
    ("FIN_MERCADO", "BCB_SGS", "11757", "Taxa cambio efetiva real (REER)", "Mensal", "indice", "1994-12", "core_antecedente"),
    ("FIN_MERCADO", "YFINANCE", "BRL=X", "USD/BRL Yahoo", "Diaria", "BRL/USD", "2003-12", "fallback"),
    # === SOND_EMPRESARIAL ===
    ("SOND_EMP", "BCB_SGS", "21859", "FGV ICE - Confianca Empresarial", "Mensal", "indice", "2008-04", "core_IACE"),
    ("SOND_EMP", "BCB_SGS", "21860", "FGV ICI - Confianca Industria", "Mensal", "indice", "2008-04", "core"),
    ("SOND_EMP", "BCB_SGS", "21861", "FGV ICOM - Confianca Comercio", "Mensal", "indice", "2008-04", "core"),
    ("SOND_EMP", "BCB_SGS", "21862", "FGV ICST - Confianca Construcao", "Mensal", "indice", "2008-04", "core"),
    ("SOND_EMP", "BCB_SGS", "21863", "FGV ICS - Confianca Servicos", "Mensal", "indice", "2008-04", "core"),
    ("SOND_EMP", "BCB_SGS", "21864", "FGV ICC - Confianca Consumidor", "Mensal", "indice", "2002-09", "core"),
    ("SOND_EMP", "BCB_SGS", "21865", "FGV ICA - Confianca Agro", "Mensal", "indice", "2010-09", "complementar"),
    ("SOND_EMP", "IPEADATA", "FGV12_IIEBR12", "IIE-Br FGV - Incerteza Brasil", "Mensal", "indice", "2000-01", "componente_avancado"),
    ("SOND_EMP", "IPEADATA", "FGV12_IAEMP12", "IAEmp - Antecedente Emprego", "Mensal", "indice", "1995-01", "antecedente_emprego"),
    ("SOND_EMP", "IPEADATA", "FGV12_IACE12", "IACE FGV - Antecedente Composto", "Mensal", "indice", "1996-08", "BENCHMARK"),
    ("SOND_EMP", "IPEADATA", "FGV12_ICCE12", "ICCE FGV - Coincidente Composto", "Mensal", "indice", "1996-08", "BENCHMARK"),
    # === SOND_CONSUMIDOR ===
    ("SOND_CONS", "BCB_SGS", "4393", "Comercio - Confianca Consumidor Fecomercio SP", "Mensal", "indice", "1994-06", "complementar"),
    ("SOND_CONS", "BCB_SGS", "8175", "CNI ICEI - Confianca Industria CNI", "Mensal", "indice", "1999-04", "core"),
    ("SOND_CONS", "BCB_SGS", "8174", "CNI ICEI Atual", "Mensal", "indice", "1999-04", "core"),
    # === REAL_PRODUCAO ===
    ("REAL_PROD", "SIDRA", "8888/v/12606/p/all/c543/all", "PIM-PF transformacao", "Mensal", "indice", "2002-01", "core"),
    ("REAL_PROD", "SIDRA", "8888/v/12606/p/all/c543/40807", "PIM-PF bens de capital", "Mensal", "indice", "2002-01", "antecedente_real"),
    ("REAL_PROD", "SIDRA", "8888/v/12606/p/all/c543/40808", "PIM-PF bens duraveis", "Mensal", "indice", "2002-01", "antecedente_real"),
    ("REAL_PROD", "SIDRA", "8888/v/12606/p/all/c543/40806", "PIM-PF bens intermediarios", "Mensal", "indice", "2002-01", "coincidente"),
    ("REAL_PROD", "BCB_SGS", "21859", "Indice ABCR pedagio leves", "Mensal", "indice", "2000-01", "complementar"),
    ("REAL_PROD", "IPEADATA", "ABPO12_PAPEL12", "Papelao ABPO", "Mensal", "ton", "2002-01", "coincidente_TCB"),
    ("REAL_PROD", "IPEADATA", "IBS366_ACO366", "Aco bruto IBS", "Mensal", "ton", "1995-01", "coincidente"),
    ("REAL_PROD", "BCB_SGS", "24364", "Indice ANFAVEA producao", "Mensal", "indice", "2003-01", "antecedente"),
    ("REAL_PROD", "BCB_SGS", "24363", "Indice ANFAVEA vendas internas", "Mensal", "indice", "2003-01", "antecedente"),
    ("REAL_PROD", "BCB_SGS", "1453", "Consumo energia eletrica industrial (EPE)", "Mensal", "GWh", "1995-01", "coincidente"),
    # === REAL_VENDAS_CRED ===
    ("REAL_VEND", "SIDRA", "8881/v/7170/p/all", "PMC varejo restrito", "Mensal", "indice", "2000-01", "core_TCB"),
    ("REAL_VEND", "SIDRA", "8881/v/7170/p/all/c11046/56734", "PMC varejo ampliado", "Mensal", "indice", "2000-01", "core_TCB"),
    ("REAL_VEND", "SIDRA", "8688/v/11620/p/all", "PMS volume servicos", "Mensal", "indice", "2011-01", "coincidente"),
    ("REAL_VEND", "BCB_SGS", "20631", "Concessoes credito PF total", "Mensal", "R$ milhoes", "2011-03", "antecedente"),
    ("REAL_VEND", "BCB_SGS", "20633", "Concessoes credito PJ total", "Mensal", "R$ milhoes", "2011-03", "antecedente"),
    ("REAL_VEND", "BCB_SGS", "20620", "Carteira credito PF total", "Mensal", "R$ milhoes", "2011-03", "complementar"),
    ("REAL_VEND", "BCB_SGS", "20622", "Carteira credito PJ total", "Mensal", "R$ milhoes", "2011-03", "complementar"),
    # === REAL_EMPREGO ===
    ("REAL_EMP", "SIDRA", "6381/v/4099/p/all", "PNAD-C taxa desocupacao", "Trimestre movel", "%", "2012-03", "core_TCB"),
    ("REAL_EMP", "SIDRA", "6390/v/5933/p/all", "PNAD-C rendimento real", "Trimestre movel", "R$", "2012-03", "core_TCB"),
    ("REAL_EMP", "SIDRA", "6381/v/1641/p/all", "PNAD-C populacao ocupada", "Trimestre movel", "milhoes", "2012-03", "complementar"),
    ("REAL_EMP", "IPEADATA", "CAGED12_SALDO12", "CAGED saldo total", "Mensal", "vagas", "2007-01", "antecedente_emprego"),
    # === INFLACAO / IPCA ===
    ("INFLACAO", "BCB_SGS", "433", "IPCA mensal", "Mensal", "%", "1980-01", "deflator"),
    ("INFLACAO", "BCB_SGS", "1635", "IPCA-15", "Mensal", "%", "2001-01", "antecedente_ipca"),
    ("INFLACAO", "BCB_SGS", "189", "IGP-M", "Mensal", "%", "1989-06", "alternativo"),
    ("INFLACAO", "BCB_OLINDA", "Expectativa_IPCA_12m", "Focus IPCA 12m a frente", "Diaria", "%", "2001-11", "expectativa"),
    ("INFLACAO", "BCB_OLINDA", "Expectativa_PIB_anual", "Focus PIB anual", "Diaria", "%", "2001-11", "expectativa"),
    ("INFLACAO", "BCB_OLINDA", "Expectativa_Selic_fim_ano", "Focus Selic fim ano", "Diaria", "%", "2001-11", "expectativa"),
    # === MONETARIO ===
    ("MONETARIO", "BCB_SGS", "27791", "M1", "Mensal", "R$ milhoes", "1980-01", "monetario"),
    ("MONETARIO", "BCB_SGS", "27810", "M2", "Mensal", "R$ milhoes", "1988-07", "monetario"),
    ("MONETARIO", "BCB_SGS", "27814", "Base monetaria", "Mensal", "R$ milhoes", "1980-01", "monetario"),
    # === ATIVIDADE_AGREGADA ===
    ("ATIV_AGREG", "BCB_SGS", "24363", "IBC-Br - Indice atividade BCB", "Mensal", "indice", "2003-01", "TARGET_ALTERNATIVO"),
    ("ATIV_AGREG", "BCB_SGS", "24364", "IBC-Br dessaz", "Mensal", "indice", "2003-01", "TARGET_PRINCIPAL"),
    # === GLOBAL ===
    ("GLOBAL", "OCDE_FRED", "BSCICP03BRM665S", "OCDE CLI Brasil", "Mensal", "indice", "1996-01", "benchmark_externo"),
    ("GLOBAL", "OCDE_FRED", "BSCICP03USM665S", "OCDE CLI USA", "Mensal", "indice", "1996-01", "global_spillover"),
    ("GLOBAL", "FRED", "DGS10", "US Treasury 10Y yield", "Diaria", "%", "1962-01", "global_juros"),
    ("GLOBAL", "FRED", "DGS3MO", "US Treasury 3M yield", "Diaria", "%", "1981-09", "global_juros"),
    ("GLOBAL", "FRED", "VIXCLS", "VIX volatilidade S&P500", "Diaria", "indice", "1990-01", "global_risco"),
    ("GLOBAL", "FRED", "DCOILWTICO", "WTI petroleo spot", "Diaria", "USD/bbl", "1986-01", "commodity"),
    ("GLOBAL", "YFINANCE", "GC=F", "Ouro futuro", "Diaria", "USD/oz", "2000-08", "commodity_risco"),
    ("GLOBAL", "YFINANCE", "^GSPC", "S&P 500", "Diaria", "pontos", "1927-12", "global_bolsa"),
    ("GLOBAL", "IPEADATA", "FUNCEX12_XPVT12", "Termos de troca Funcex", "Mensal", "indice", "1977-01", "componente_IACE"),
    # === CONFIANCA SETORIAL ESPECIFICA ===
    ("SOND_DET", "IPEADATA", "FGV12_IIEBR12", "IIE-Br Incerteza", "Mensal", "indice", "2000-01", "antecedente"),
    ("SOND_DET", "IPEADATA", "FGV12_INECF12", "INEC Confianca Emp Consultoria FGV", "Mensal", "indice", "2010-01", "complementar"),
]

cols = ["categoria", "fonte", "codigo", "nome", "freq", "unidade", "start_date", "prioridade"]
df = pd.DataFrame(SERIES, columns=cols)
print(f"Total series: {len(df)}")
print("\nDistribuicao por categoria:")
print(df.groupby("categoria").size())
print("\nDistribuicao por fonte:")
print(df.groupby("fonte").size())

out_xlsx = OUT / "catalogo_antecedentes.xlsx"
df.to_excel(out_xlsx, index=False, sheet_name="catalogo")
out_csv = OUT / "catalogo_antecedentes.csv"
df.to_csv(out_csv, index=False, encoding="utf-8-sig")
print(f"\nSalvo em: {out_xlsx}")
print(f"        e: {out_csv}")
