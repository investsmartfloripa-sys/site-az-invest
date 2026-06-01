"""Catalogo curado de ativos da aba /painel-economico/mercado.

Cada entrada tem:
  - ticker  : simbolo Yahoo Finance (com sufixo .SA para BR, =F futuros, =X FX, etc.)
  - name    : nome amigavel exibido no painel
  - klass   : classe (br_acoes, br_etf, br_fii, us_acoes, us_etf, indice, fx, commodity, cripto)
  - sector  : agrupamento setorial / categoria
  - country : BR, US, GLOBAL
  - currency: BRL | USD (moeda nativa da cotacao)

O catalogo eh usado por build_market_history.py e build_market_fundamentals.py,
e tambem exposto ao frontend via data/market_catalog.json para alimentar pickers.
"""
from __future__ import annotations

from typing import Dict, List


CATALOG: List[Dict[str, str]] = [
    # ---------------------------------------------------------------------
    # Indices globais (referencias macro)
    # ---------------------------------------------------------------------
    {"ticker": "^BVSP",   "name": "Ibovespa",            "klass": "indice", "sector": "Brasil",      "country": "BR",     "currency": "BRL"},
    {"ticker": "^GSPC",   "name": "S&P 500",             "klass": "indice", "sector": "EUA",         "country": "US",     "currency": "USD"},
    {"ticker": "^IXIC",   "name": "NASDAQ Composite",    "klass": "indice", "sector": "EUA",         "country": "US",     "currency": "USD"},
    {"ticker": "^DJI",    "name": "Dow Jones",           "klass": "indice", "sector": "EUA",         "country": "US",     "currency": "USD"},
    {"ticker": "^RUT",    "name": "Russell 2000",        "klass": "indice", "sector": "EUA",         "country": "US",     "currency": "USD"},
    {"ticker": "^N225",   "name": "Nikkei 225",          "klass": "indice", "sector": "Asia",        "country": "GLOBAL", "currency": "USD"},
    {"ticker": "^HSI",    "name": "Hang Seng",           "klass": "indice", "sector": "Asia",        "country": "GLOBAL", "currency": "USD"},
    {"ticker": "000001.SS","name": "Shanghai Composite", "klass": "indice", "sector": "Asia",        "country": "GLOBAL", "currency": "USD"},
    {"ticker": "^STOXX50E","name": "Euro Stoxx 50",      "klass": "indice", "sector": "Europa",      "country": "GLOBAL", "currency": "USD"},
    {"ticker": "^FTSE",   "name": "FTSE 100",            "klass": "indice", "sector": "Europa",      "country": "GLOBAL", "currency": "USD"},
    {"ticker": "^GDAXI",  "name": "DAX",                 "klass": "indice", "sector": "Europa",      "country": "GLOBAL", "currency": "USD"},
    {"ticker": "^FCHI",   "name": "CAC 40",              "klass": "indice", "sector": "Europa",      "country": "GLOBAL", "currency": "USD"},
    {"ticker": "^VIX",    "name": "VIX",                 "klass": "indice", "sector": "Volatilidade","country": "US",     "currency": "USD"},

    # ---------------------------------------------------------------------
    # FX (moedas vs BRL e cross-rates)
    # ---------------------------------------------------------------------
    {"ticker": "BRL=X",   "name": "USD/BRL",  "klass": "fx", "sector": "Cambio", "country": "BR",     "currency": "BRL"},
    {"ticker": "EURBRL=X","name": "EUR/BRL",  "klass": "fx", "sector": "Cambio", "country": "BR",     "currency": "BRL"},
    {"ticker": "GBPBRL=X","name": "GBP/BRL",  "klass": "fx", "sector": "Cambio", "country": "BR",     "currency": "BRL"},
    {"ticker": "ARS=X",   "name": "USD/ARS",  "klass": "fx", "sector": "Cambio", "country": "GLOBAL", "currency": "USD"},
    {"ticker": "MXN=X",   "name": "USD/MXN",  "klass": "fx", "sector": "Cambio", "country": "GLOBAL", "currency": "USD"},
    {"ticker": "CNY=X",   "name": "USD/CNY",  "klass": "fx", "sector": "Cambio", "country": "GLOBAL", "currency": "USD"},
    {"ticker": "JPY=X",   "name": "USD/JPY",  "klass": "fx", "sector": "Cambio", "country": "GLOBAL", "currency": "USD"},
    {"ticker": "EURUSD=X","name": "EUR/USD",  "klass": "fx", "sector": "Cambio", "country": "GLOBAL", "currency": "USD"},
    {"ticker": "DX-Y.NYB","name": "DXY",      "klass": "fx", "sector": "Cambio", "country": "US",     "currency": "USD"},

    # ---------------------------------------------------------------------
    # Commodities (futuros)
    # ---------------------------------------------------------------------
    {"ticker": "GC=F", "name": "Ouro (futuro)",        "klass": "commodity", "sector": "Metais",     "country": "GLOBAL", "currency": "USD"},
    {"ticker": "SI=F", "name": "Prata (futuro)",       "klass": "commodity", "sector": "Metais",     "country": "GLOBAL", "currency": "USD"},
    {"ticker": "HG=F", "name": "Cobre (futuro)",       "klass": "commodity", "sector": "Metais",     "country": "GLOBAL", "currency": "USD"},
    {"ticker": "CL=F", "name": "Petroleo WTI",         "klass": "commodity", "sector": "Energia",    "country": "GLOBAL", "currency": "USD"},
    {"ticker": "BZ=F", "name": "Petroleo Brent",       "klass": "commodity", "sector": "Energia",    "country": "GLOBAL", "currency": "USD"},
    {"ticker": "NG=F", "name": "Gas natural",          "klass": "commodity", "sector": "Energia",    "country": "GLOBAL", "currency": "USD"},
    {"ticker": "ZC=F", "name": "Milho",                "klass": "commodity", "sector": "Agricola",   "country": "GLOBAL", "currency": "USD"},
    {"ticker": "ZS=F", "name": "Soja",                 "klass": "commodity", "sector": "Agricola",   "country": "GLOBAL", "currency": "USD"},
    {"ticker": "ZW=F", "name": "Trigo",                "klass": "commodity", "sector": "Agricola",   "country": "GLOBAL", "currency": "USD"},
    {"ticker": "KC=F", "name": "Cafe",                 "klass": "commodity", "sector": "Agricola",   "country": "GLOBAL", "currency": "USD"},
    {"ticker": "SB=F", "name": "Acucar",               "klass": "commodity", "sector": "Agricola",   "country": "GLOBAL", "currency": "USD"},
    {"ticker": "LE=F", "name": "Boi gordo",            "klass": "commodity", "sector": "Agricola",   "country": "GLOBAL", "currency": "USD"},

    # ---------------------------------------------------------------------
    # Cripto
    # ---------------------------------------------------------------------
    {"ticker": "BTC-USD","name": "Bitcoin",      "klass": "cripto", "sector": "Cripto", "country": "GLOBAL", "currency": "USD"},
    {"ticker": "ETH-USD","name": "Ethereum",     "klass": "cripto", "sector": "Cripto", "country": "GLOBAL", "currency": "USD"},
    {"ticker": "SOL-USD","name": "Solana",       "klass": "cripto", "sector": "Cripto", "country": "GLOBAL", "currency": "USD"},
    {"ticker": "BNB-USD","name": "BNB",          "klass": "cripto", "sector": "Cripto", "country": "GLOBAL", "currency": "USD"},
    {"ticker": "XRP-USD","name": "XRP",          "klass": "cripto", "sector": "Cripto", "country": "GLOBAL", "currency": "USD"},
    {"ticker": "ADA-USD","name": "Cardano",      "klass": "cripto", "sector": "Cripto", "country": "GLOBAL", "currency": "USD"},
    {"ticker": "AVAX-USD","name": "Avalanche",   "klass": "cripto", "sector": "Cripto", "country": "GLOBAL", "currency": "USD"},
    {"ticker": "LINK-USD","name": "Chainlink",   "klass": "cripto", "sector": "Cripto", "country": "GLOBAL", "currency": "USD"},

    # ---------------------------------------------------------------------
    # ETFs BR (Bovespa)
    # ---------------------------------------------------------------------
    {"ticker": "BOVA11.SA","name": "BOVA11 (Ibov)",          "klass": "br_etf", "sector": "Indice amplo", "country": "BR", "currency": "BRL"},
    {"ticker": "SMAL11.SA","name": "SMAL11 (Small Caps)",    "klass": "br_etf", "sector": "Small caps",   "country": "BR", "currency": "BRL"},
    {"ticker": "IVVB11.SA","name": "IVVB11 (S&P 500 BR)",    "klass": "br_etf", "sector": "Renda var EUA","country": "BR", "currency": "BRL"},
    {"ticker": "BBSD11.SA","name": "BBSD11 (Dividendos)",    "klass": "br_etf", "sector": "Dividendos",   "country": "BR", "currency": "BRL"},
    {"ticker": "DIVO11.SA","name": "DIVO11 (Dividendos)",    "klass": "br_etf", "sector": "Dividendos",   "country": "BR", "currency": "BRL"},
    {"ticker": "FIND11.SA","name": "FIND11 (Financeiro)",    "klass": "br_etf", "sector": "Financeiro",   "country": "BR", "currency": "BRL"},
    {"ticker": "GOLD11.SA","name": "GOLD11 (Ouro)",          "klass": "br_etf", "sector": "Commodities",  "country": "BR", "currency": "BRL"},
    {"ticker": "HASH11.SA","name": "HASH11 (Cripto)",        "klass": "br_etf", "sector": "Cripto",       "country": "BR", "currency": "BRL"},
    {"ticker": "FIXA11.SA","name": "FIXA11 (NTN-F)",         "klass": "br_etf", "sector": "Renda fixa",   "country": "BR", "currency": "BRL"},
    {"ticker": "IMAB11.SA","name": "IMAB11 (NTN-B)",         "klass": "br_etf", "sector": "Renda fixa",   "country": "BR", "currency": "BRL"},
    {"ticker": "IRFM11.SA","name": "IRFM11 (NTN-F)",         "klass": "br_etf", "sector": "Renda fixa",   "country": "BR", "currency": "BRL"},
    {"ticker": "LFTS11.SA","name": "LFTS11 (LFT/CDI)",       "klass": "br_etf", "sector": "Renda fixa",   "country": "BR", "currency": "BRL"},
    {"ticker": "XFIX11.SA","name": "XFIX11 (IFIX)",          "klass": "br_etf", "sector": "Imobiliario",  "country": "BR", "currency": "BRL"},

    # ---------------------------------------------------------------------
    # FIIs principais (alguns de cada segmento)
    # ---------------------------------------------------------------------
    {"ticker": "HGLG11.SA","name": "HGLG11 (Logistica)",     "klass": "br_fii", "sector": "Logistica",  "country": "BR", "currency": "BRL"},
    {"ticker": "KNRI11.SA","name": "KNRI11 (Hibrido)",       "klass": "br_fii", "sector": "Hibrido",    "country": "BR", "currency": "BRL"},
    {"ticker": "MXRF11.SA","name": "MXRF11 (Recebiveis)",    "klass": "br_fii", "sector": "Recebiveis", "country": "BR", "currency": "BRL"},
    {"ticker": "HGRE11.SA","name": "HGRE11 (Lajes)",         "klass": "br_fii", "sector": "Lajes",      "country": "BR", "currency": "BRL"},
    {"ticker": "XPLG11.SA","name": "XPLG11 (Logistica)",     "klass": "br_fii", "sector": "Logistica",  "country": "BR", "currency": "BRL"},
    {"ticker": "VISC11.SA","name": "VISC11 (Shoppings)",     "klass": "br_fii", "sector": "Shoppings",  "country": "BR", "currency": "BRL"},
    {"ticker": "RECT11.SA","name": "RECT11 (Recebiveis)",    "klass": "br_fii", "sector": "Recebiveis", "country": "BR", "currency": "BRL"},

    # ---------------------------------------------------------------------
    # Acoes BR (top tickers IBrX, organizadas por setor)
    # ---------------------------------------------------------------------
    # Bancos / Financeiros
    {"ticker": "ITUB4.SA","name": "Itau Unibanco",      "klass": "br_acoes", "sector": "Bancos",           "country": "BR", "currency": "BRL"},
    {"ticker": "BBDC4.SA","name": "Bradesco",           "klass": "br_acoes", "sector": "Bancos",           "country": "BR", "currency": "BRL"},
    {"ticker": "BBAS3.SA","name": "Banco do Brasil",    "klass": "br_acoes", "sector": "Bancos",           "country": "BR", "currency": "BRL"},
    {"ticker": "SANB11.SA","name": "Santander BR",      "klass": "br_acoes", "sector": "Bancos",           "country": "BR", "currency": "BRL"},
    {"ticker": "BPAC11.SA","name": "BTG Pactual",       "klass": "br_acoes", "sector": "Bancos",           "country": "BR", "currency": "BRL"},
    {"ticker": "B3SA3.SA","name": "B3",                 "klass": "br_acoes", "sector": "Bolsa/Servicos",   "country": "BR", "currency": "BRL"},
    {"ticker": "BBSE3.SA","name": "BB Seguridade",      "klass": "br_acoes", "sector": "Seguros",          "country": "BR", "currency": "BRL"},
    {"ticker": "ITSA4.SA","name": "Itausa",             "klass": "br_acoes", "sector": "Holding",          "country": "BR", "currency": "BRL"},
    # Petroleo / Energia
    {"ticker": "PETR4.SA","name": "Petrobras PN",       "klass": "br_acoes", "sector": "Petroleo & Gas",   "country": "BR", "currency": "BRL"},
    {"ticker": "PETR3.SA","name": "Petrobras ON",       "klass": "br_acoes", "sector": "Petroleo & Gas",   "country": "BR", "currency": "BRL"},
    {"ticker": "PRIO3.SA","name": "PRIO",               "klass": "br_acoes", "sector": "Petroleo & Gas",   "country": "BR", "currency": "BRL"},
    {"ticker": "RECV3.SA","name": "PetroReconcavo",     "klass": "br_acoes", "sector": "Petroleo & Gas",   "country": "BR", "currency": "BRL"},
    {"ticker": "UGPA3.SA","name": "Ultrapar",           "klass": "br_acoes", "sector": "Petroleo & Gas",   "country": "BR", "currency": "BRL"},
    # Mineracao / Siderurgia
    {"ticker": "VALE3.SA","name": "Vale",               "klass": "br_acoes", "sector": "Mineracao",        "country": "BR", "currency": "BRL"},
    {"ticker": "CSNA3.SA","name": "CSN",                "klass": "br_acoes", "sector": "Siderurgia",       "country": "BR", "currency": "BRL"},
    {"ticker": "GGBR4.SA","name": "Gerdau",             "klass": "br_acoes", "sector": "Siderurgia",       "country": "BR", "currency": "BRL"},
    {"ticker": "USIM5.SA","name": "Usiminas",           "klass": "br_acoes", "sector": "Siderurgia",       "country": "BR", "currency": "BRL"},
    {"ticker": "GOAU4.SA","name": "Metalurgica Gerdau", "klass": "br_acoes", "sector": "Siderurgia",       "country": "BR", "currency": "BRL"},
    # Utilities / Eletrica / Saneamento
    {"ticker": "ELET3.SA","name": "Eletrobras ON",      "klass": "br_acoes", "sector": "Eletrica",         "country": "BR", "currency": "BRL"},
    {"ticker": "ELET6.SA","name": "Eletrobras PNB",     "klass": "br_acoes", "sector": "Eletrica",         "country": "BR", "currency": "BRL"},
    {"ticker": "CMIG4.SA","name": "Cemig",              "klass": "br_acoes", "sector": "Eletrica",         "country": "BR", "currency": "BRL"},
    {"ticker": "TAEE11.SA","name": "Taesa",             "klass": "br_acoes", "sector": "Eletrica",         "country": "BR", "currency": "BRL"},
    {"ticker": "EGIE3.SA","name": "Engie BR",           "klass": "br_acoes", "sector": "Eletrica",         "country": "BR", "currency": "BRL"},
    {"ticker": "EQTL3.SA","name": "Equatorial",         "klass": "br_acoes", "sector": "Eletrica",         "country": "BR", "currency": "BRL"},
    {"ticker": "ENEV3.SA","name": "Eneva",              "klass": "br_acoes", "sector": "Eletrica",         "country": "BR", "currency": "BRL"},
    {"ticker": "CPLE6.SA","name": "Copel",              "klass": "br_acoes", "sector": "Eletrica",         "country": "BR", "currency": "BRL"},
    {"ticker": "SBSP3.SA","name": "Sabesp",             "klass": "br_acoes", "sector": "Saneamento",       "country": "BR", "currency": "BRL"},
    {"ticker": "SAPR11.SA","name": "Sanepar",           "klass": "br_acoes", "sector": "Saneamento",       "country": "BR", "currency": "BRL"},
    # Consumo / Varejo
    {"ticker": "ABEV3.SA","name": "Ambev",              "klass": "br_acoes", "sector": "Consumo",          "country": "BR", "currency": "BRL"},
    {"ticker": "BRFS3.SA","name": "BRF",                "klass": "br_acoes", "sector": "Alimentos",        "country": "BR", "currency": "BRL"},
    {"ticker": "JBSS3.SA","name": "JBS",                "klass": "br_acoes", "sector": "Alimentos",        "country": "BR", "currency": "BRL"},
    {"ticker": "MRFG3.SA","name": "Marfrig",            "klass": "br_acoes", "sector": "Alimentos",        "country": "BR", "currency": "BRL"},
    {"ticker": "BEEF3.SA","name": "Minerva",            "klass": "br_acoes", "sector": "Alimentos",        "country": "BR", "currency": "BRL"},
    {"ticker": "MGLU3.SA","name": "Magazine Luiza",     "klass": "br_acoes", "sector": "Varejo",           "country": "BR", "currency": "BRL"},
    {"ticker": "LREN3.SA","name": "Lojas Renner",       "klass": "br_acoes", "sector": "Varejo",           "country": "BR", "currency": "BRL"},
    {"ticker": "ASAI3.SA","name": "Assai",              "klass": "br_acoes", "sector": "Varejo",           "country": "BR", "currency": "BRL"},
    {"ticker": "PCAR3.SA","name": "GPA",                "klass": "br_acoes", "sector": "Varejo",           "country": "BR", "currency": "BRL"},
    {"ticker": "AMER3.SA","name": "Americanas",         "klass": "br_acoes", "sector": "Varejo",           "country": "BR", "currency": "BRL"},
    {"ticker": "VIIA3.SA","name": "Via",                "klass": "br_acoes", "sector": "Varejo",           "country": "BR", "currency": "BRL"},
    # Saude
    {"ticker": "RDOR3.SA","name": "Rede D'Or",          "klass": "br_acoes", "sector": "Saude",            "country": "BR", "currency": "BRL"},
    {"ticker": "HAPV3.SA","name": "Hapvida",            "klass": "br_acoes", "sector": "Saude",            "country": "BR", "currency": "BRL"},
    {"ticker": "QUAL3.SA","name": "Qualicorp",          "klass": "br_acoes", "sector": "Saude",            "country": "BR", "currency": "BRL"},
    {"ticker": "FLRY3.SA","name": "Fleury",             "klass": "br_acoes", "sector": "Saude",            "country": "BR", "currency": "BRL"},
    {"ticker": "RADL3.SA","name": "RaiaDrogasil",       "klass": "br_acoes", "sector": "Saude",            "country": "BR", "currency": "BRL"},
    # Telecom / Tech
    {"ticker": "VIVT3.SA","name": "Telefonica BR",      "klass": "br_acoes", "sector": "Telecom",          "country": "BR", "currency": "BRL"},
    {"ticker": "TIMS3.SA","name": "TIM",                "klass": "br_acoes", "sector": "Telecom",          "country": "BR", "currency": "BRL"},
    {"ticker": "TOTS3.SA","name": "Totvs",              "klass": "br_acoes", "sector": "Tech/SaaS",        "country": "BR", "currency": "BRL"},
    {"ticker": "POSI3.SA","name": "Positivo",           "klass": "br_acoes", "sector": "Tech/SaaS",        "country": "BR", "currency": "BRL"},
    # Industria / Aviacao / Logistica
    {"ticker": "WEGE3.SA","name": "WEG",                "klass": "br_acoes", "sector": "Industria",        "country": "BR", "currency": "BRL"},
    {"ticker": "EMBR3.SA","name": "Embraer",            "klass": "br_acoes", "sector": "Industria",        "country": "BR", "currency": "BRL"},
    {"ticker": "AZUL4.SA","name": "Azul",               "klass": "br_acoes", "sector": "Aviacao",          "country": "BR", "currency": "BRL"},
    {"ticker": "GOLL4.SA","name": "Gol",                "klass": "br_acoes", "sector": "Aviacao",          "country": "BR", "currency": "BRL"},
    {"ticker": "RAIL3.SA","name": "Rumo",               "klass": "br_acoes", "sector": "Logistica",        "country": "BR", "currency": "BRL"},
    {"ticker": "CCRO3.SA","name": "CCR",                "klass": "br_acoes", "sector": "Logistica",        "country": "BR", "currency": "BRL"},
    {"ticker": "ECOR3.SA","name": "Ecorodovias",        "klass": "br_acoes", "sector": "Logistica",        "country": "BR", "currency": "BRL"},
    # Construcao / Imobiliario
    {"ticker": "CYRE3.SA","name": "Cyrela",             "klass": "br_acoes", "sector": "Construcao",       "country": "BR", "currency": "BRL"},
    {"ticker": "MRVE3.SA","name": "MRV",                "klass": "br_acoes", "sector": "Construcao",       "country": "BR", "currency": "BRL"},
    {"ticker": "EZTC3.SA","name": "Eztec",              "klass": "br_acoes", "sector": "Construcao",       "country": "BR", "currency": "BRL"},
    # Papel & Celulose / Agro
    {"ticker": "SUZB3.SA","name": "Suzano",             "klass": "br_acoes", "sector": "Papel & Celulose", "country": "BR", "currency": "BRL"},
    {"ticker": "KLBN11.SA","name": "Klabin",            "klass": "br_acoes", "sector": "Papel & Celulose", "country": "BR", "currency": "BRL"},
    {"ticker": "SLCE3.SA","name": "SLC Agricola",       "klass": "br_acoes", "sector": "Agronegocio",      "country": "BR", "currency": "BRL"},
    # --- IBOV: complementos (revisao 2026-06-01, p/ resolver detalhe por ticker no screener de Acoes) ---
    {"ticker": "BBDC3.SA","name": "Bradesco ON",        "klass": "br_acoes", "sector": "Bancos",           "country": "BR", "currency": "BRL"},
    {"ticker": "BRAP4.SA","name": "Bradespar",          "klass": "br_acoes", "sector": "Holding",          "country": "BR", "currency": "BRL"},
    {"ticker": "CXSE3.SA","name": "Caixa Seguridade",   "klass": "br_acoes", "sector": "Seguros",          "country": "BR", "currency": "BRL"},
    {"ticker": "PSSA3.SA","name": "Porto Seguro",       "klass": "br_acoes", "sector": "Seguros",          "country": "BR", "currency": "BRL"},
    {"ticker": "AURE3.SA","name": "Auren Energia",      "klass": "br_acoes", "sector": "Eletrica",         "country": "BR", "currency": "BRL"},
    {"ticker": "AXIA3.SA","name": "Axia Energia ON",    "klass": "br_acoes", "sector": "Eletrica",         "country": "BR", "currency": "BRL"},
    {"ticker": "AXIA6.SA","name": "Axia Energia PNB",   "klass": "br_acoes", "sector": "Eletrica",         "country": "BR", "currency": "BRL"},
    {"ticker": "CPLE3.SA","name": "Copel ON",           "klass": "br_acoes", "sector": "Eletrica",         "country": "BR", "currency": "BRL"},
    {"ticker": "CPFE3.SA","name": "CPFL Energia",       "klass": "br_acoes", "sector": "Eletrica",         "country": "BR", "currency": "BRL"},
    {"ticker": "ENGI11.SA","name": "Energisa",          "klass": "br_acoes", "sector": "Eletrica",         "country": "BR", "currency": "BRL"},
    {"ticker": "ISAE4.SA","name": "ISA Energia",        "klass": "br_acoes", "sector": "Eletrica",         "country": "BR", "currency": "BRL"},
    {"ticker": "CSMG3.SA","name": "Copasa",             "klass": "br_acoes", "sector": "Saneamento",       "country": "BR", "currency": "BRL"},
    {"ticker": "CSAN3.SA","name": "Cosan",              "klass": "br_acoes", "sector": "Petroleo & Gas",   "country": "BR", "currency": "BRL"},
    {"ticker": "VBBR3.SA","name": "Vibra Energia",      "klass": "br_acoes", "sector": "Petroleo & Gas",   "country": "BR", "currency": "BRL"},
    {"ticker": "BRAV3.SA","name": "Brava Energia",      "klass": "br_acoes", "sector": "Petroleo & Gas",   "country": "BR", "currency": "BRL"},
    {"ticker": "CMIN3.SA","name": "CSN Mineracao",      "klass": "br_acoes", "sector": "Mineracao",        "country": "BR", "currency": "BRL"},
    {"ticker": "RENT3.SA","name": "Localiza",           "klass": "br_acoes", "sector": "Locacao",          "country": "BR", "currency": "BRL"},
    {"ticker": "VAMO3.SA","name": "Vamos",              "klass": "br_acoes", "sector": "Locacao",          "country": "BR", "currency": "BRL"},
    {"ticker": "MOTV3.SA","name": "Motiva",             "klass": "br_acoes", "sector": "Logistica",        "country": "BR", "currency": "BRL"},
    {"ticker": "POMO4.SA","name": "Marcopolo",          "klass": "br_acoes", "sector": "Industria",        "country": "BR", "currency": "BRL"},
    {"ticker": "EMBJ3.SA","name": "Embraer",            "klass": "br_acoes", "sector": "Industria",        "country": "BR", "currency": "BRL"},
    {"ticker": "MBRF3.SA","name": "MBRF Global",        "klass": "br_acoes", "sector": "Alimentos",        "country": "BR", "currency": "BRL"},
    {"ticker": "HYPE3.SA","name": "Hypera",             "klass": "br_acoes", "sector": "Saude",            "country": "BR", "currency": "BRL"},
    {"ticker": "COGN3.SA","name": "Cogna",              "klass": "br_acoes", "sector": "Educacao",         "country": "BR", "currency": "BRL"},
    {"ticker": "YDUQ3.SA","name": "Yduqs",              "klass": "br_acoes", "sector": "Educacao",         "country": "BR", "currency": "BRL"},
    {"ticker": "SMFT3.SA","name": "Smart Fit",          "klass": "br_acoes", "sector": "Consumo",          "country": "BR", "currency": "BRL"},
    {"ticker": "NATU3.SA","name": "Natura",             "klass": "br_acoes", "sector": "Consumo",          "country": "BR", "currency": "BRL"},
    {"ticker": "AZZA3.SA","name": "Azzas 2154",         "klass": "br_acoes", "sector": "Varejo",           "country": "BR", "currency": "BRL"},
    {"ticker": "CEAB3.SA","name": "C&A Modas",          "klass": "br_acoes", "sector": "Varejo",           "country": "BR", "currency": "BRL"},
    {"ticker": "VIVA3.SA","name": "Vivara",             "klass": "br_acoes", "sector": "Varejo",           "country": "BR", "currency": "BRL"},
    {"ticker": "ALOS3.SA","name": "Allos",              "klass": "br_acoes", "sector": "Shoppings",        "country": "BR", "currency": "BRL"},
    {"ticker": "IGTI11.SA","name": "Iguatemi",          "klass": "br_acoes", "sector": "Shoppings",        "country": "BR", "currency": "BRL"},
    {"ticker": "MULT3.SA","name": "Multiplan",          "klass": "br_acoes", "sector": "Shoppings",        "country": "BR", "currency": "BRL"},
    {"ticker": "CURY3.SA","name": "Cury",               "klass": "br_acoes", "sector": "Construcao",       "country": "BR", "currency": "BRL"},
    {"ticker": "DIRR3.SA","name": "Direcional",         "klass": "br_acoes", "sector": "Construcao",       "country": "BR", "currency": "BRL"},
    {"ticker": "AGRO3.SA","name": "BrasilAgro",         "klass": "br_acoes", "sector": "Agronegocio",      "country": "BR", "currency": "BRL"},
    # Quimica / Outros
    {"ticker": "BRKM5.SA","name": "Braskem",            "klass": "br_acoes", "sector": "Quimica",          "country": "BR", "currency": "BRL"},

    # ---------------------------------------------------------------------
    # Acoes EUA (top S&P / mega caps + setoriais)
    # ---------------------------------------------------------------------
    # Tech mega cap
    {"ticker": "AAPL","name": "Apple",                "klass": "us_acoes", "sector": "Tech",           "country": "US", "currency": "USD"},
    {"ticker": "MSFT","name": "Microsoft",            "klass": "us_acoes", "sector": "Tech",           "country": "US", "currency": "USD"},
    {"ticker": "GOOGL","name": "Alphabet",            "klass": "us_acoes", "sector": "Tech",           "country": "US", "currency": "USD"},
    {"ticker": "AMZN","name": "Amazon",               "klass": "us_acoes", "sector": "Consumo/Tech",   "country": "US", "currency": "USD"},
    {"ticker": "META","name": "Meta",                 "klass": "us_acoes", "sector": "Tech",           "country": "US", "currency": "USD"},
    {"ticker": "NVDA","name": "NVIDIA",               "klass": "us_acoes", "sector": "Semicondutores", "country": "US", "currency": "USD"},
    {"ticker": "TSLA","name": "Tesla",                "klass": "us_acoes", "sector": "Auto/Tech",      "country": "US", "currency": "USD"},
    {"ticker": "AVGO","name": "Broadcom",             "klass": "us_acoes", "sector": "Semicondutores", "country": "US", "currency": "USD"},
    {"ticker": "AMD","name": "AMD",                   "klass": "us_acoes", "sector": "Semicondutores", "country": "US", "currency": "USD"},
    {"ticker": "INTC","name": "Intel",                "klass": "us_acoes", "sector": "Semicondutores", "country": "US", "currency": "USD"},
    {"ticker": "TSM","name": "TSMC",                  "klass": "us_acoes", "sector": "Semicondutores", "country": "US", "currency": "USD"},
    {"ticker": "ORCL","name": "Oracle",               "klass": "us_acoes", "sector": "Tech",           "country": "US", "currency": "USD"},
    {"ticker": "CRM","name": "Salesforce",            "klass": "us_acoes", "sector": "Tech",           "country": "US", "currency": "USD"},
    {"ticker": "NFLX","name": "Netflix",              "klass": "us_acoes", "sector": "Tech/Media",     "country": "US", "currency": "USD"},
    # Bancos / Financeiros US
    {"ticker": "JPM","name": "JPMorgan",              "klass": "us_acoes", "sector": "Bancos US",      "country": "US", "currency": "USD"},
    {"ticker": "BAC","name": "Bank of America",       "klass": "us_acoes", "sector": "Bancos US",      "country": "US", "currency": "USD"},
    {"ticker": "WFC","name": "Wells Fargo",           "klass": "us_acoes", "sector": "Bancos US",      "country": "US", "currency": "USD"},
    {"ticker": "GS","name": "Goldman Sachs",          "klass": "us_acoes", "sector": "Bancos US",      "country": "US", "currency": "USD"},
    {"ticker": "MS","name": "Morgan Stanley",         "klass": "us_acoes", "sector": "Bancos US",      "country": "US", "currency": "USD"},
    {"ticker": "C","name": "Citigroup",               "klass": "us_acoes", "sector": "Bancos US",      "country": "US", "currency": "USD"},
    {"ticker": "BLK","name": "BlackRock",             "klass": "us_acoes", "sector": "Asset Mgmt",     "country": "US", "currency": "USD"},
    {"ticker": "V","name": "Visa",                    "klass": "us_acoes", "sector": "Pagamentos",     "country": "US", "currency": "USD"},
    {"ticker": "MA","name": "Mastercard",             "klass": "us_acoes", "sector": "Pagamentos",     "country": "US", "currency": "USD"},
    # Consumo
    {"ticker": "WMT","name": "Walmart",               "klass": "us_acoes", "sector": "Varejo US",      "country": "US", "currency": "USD"},
    {"ticker": "COST","name": "Costco",               "klass": "us_acoes", "sector": "Varejo US",      "country": "US", "currency": "USD"},
    {"ticker": "HD","name": "Home Depot",             "klass": "us_acoes", "sector": "Varejo US",      "country": "US", "currency": "USD"},
    {"ticker": "MCD","name": "McDonald's",            "klass": "us_acoes", "sector": "Consumo US",     "country": "US", "currency": "USD"},
    {"ticker": "KO","name": "Coca-Cola",              "klass": "us_acoes", "sector": "Consumo US",     "country": "US", "currency": "USD"},
    {"ticker": "PEP","name": "PepsiCo",               "klass": "us_acoes", "sector": "Consumo US",     "country": "US", "currency": "USD"},
    {"ticker": "PG","name": "Procter & Gamble",       "klass": "us_acoes", "sector": "Consumo US",     "country": "US", "currency": "USD"},
    {"ticker": "NKE","name": "Nike",                  "klass": "us_acoes", "sector": "Consumo US",     "country": "US", "currency": "USD"},
    {"ticker": "SBUX","name": "Starbucks",            "klass": "us_acoes", "sector": "Consumo US",     "country": "US", "currency": "USD"},
    # Saude
    {"ticker": "JNJ","name": "Johnson & Johnson",     "klass": "us_acoes", "sector": "Saude US",       "country": "US", "currency": "USD"},
    {"ticker": "UNH","name": "UnitedHealth",          "klass": "us_acoes", "sector": "Saude US",       "country": "US", "currency": "USD"},
    {"ticker": "PFE","name": "Pfizer",                "klass": "us_acoes", "sector": "Saude US",       "country": "US", "currency": "USD"},
    {"ticker": "MRK","name": "Merck",                 "klass": "us_acoes", "sector": "Saude US",       "country": "US", "currency": "USD"},
    {"ticker": "ABBV","name": "AbbVie",               "klass": "us_acoes", "sector": "Saude US",       "country": "US", "currency": "USD"},
    {"ticker": "LLY","name": "Eli Lilly",             "klass": "us_acoes", "sector": "Saude US",       "country": "US", "currency": "USD"},
    # Energia / Industria
    {"ticker": "XOM","name": "ExxonMobil",            "klass": "us_acoes", "sector": "Petroleo US",    "country": "US", "currency": "USD"},
    {"ticker": "CVX","name": "Chevron",               "klass": "us_acoes", "sector": "Petroleo US",    "country": "US", "currency": "USD"},
    {"ticker": "GE","name": "General Electric",       "klass": "us_acoes", "sector": "Industria US",   "country": "US", "currency": "USD"},
    {"ticker": "BA","name": "Boeing",                 "klass": "us_acoes", "sector": "Industria US",   "country": "US", "currency": "USD"},
    {"ticker": "CAT","name": "Caterpillar",           "klass": "us_acoes", "sector": "Industria US",   "country": "US", "currency": "USD"},
    {"ticker": "F","name": "Ford",                    "klass": "us_acoes", "sector": "Auto US",        "country": "US", "currency": "USD"},
    {"ticker": "GM","name": "GM",                     "klass": "us_acoes", "sector": "Auto US",        "country": "US", "currency": "USD"},
    # Comunicacao
    {"ticker": "DIS","name": "Disney",                "klass": "us_acoes", "sector": "Media",          "country": "US", "currency": "USD"},
    {"ticker": "VZ","name": "Verizon",                "klass": "us_acoes", "sector": "Telecom US",     "country": "US", "currency": "USD"},
    {"ticker": "T","name": "AT&T",                    "klass": "us_acoes", "sector": "Telecom US",     "country": "US", "currency": "USD"},
    # REITs / Outros
    {"ticker": "O","name": "Realty Income",           "klass": "us_acoes", "sector": "REIT",           "country": "US", "currency": "USD"},
    {"ticker": "PLD","name": "Prologis",              "klass": "us_acoes", "sector": "REIT",           "country": "US", "currency": "USD"},
    {"ticker": "BRK-B","name": "Berkshire (B)",       "klass": "us_acoes", "sector": "Conglomerado",   "country": "US", "currency": "USD"},

    # ---------------------------------------------------------------------
    # ETFs US (referencia macro)
    # ---------------------------------------------------------------------
    {"ticker": "SPY","name": "SPY (S&P 500)",         "klass": "us_etf", "sector": "Indice amplo",  "country": "US", "currency": "USD"},
    {"ticker": "QQQ","name": "QQQ (Nasdaq 100)",      "klass": "us_etf", "sector": "Tech",          "country": "US", "currency": "USD"},
    {"ticker": "DIA","name": "DIA (Dow)",             "klass": "us_etf", "sector": "Indice amplo",  "country": "US", "currency": "USD"},
    {"ticker": "IWM","name": "IWM (Russell 2000)",    "klass": "us_etf", "sector": "Small caps",    "country": "US", "currency": "USD"},
    {"ticker": "VTI","name": "VTI (Total Market)",    "klass": "us_etf", "sector": "Indice amplo",  "country": "US", "currency": "USD"},
    {"ticker": "URTH","name": "URTH (MSCI World)",    "klass": "us_etf", "sector": "Mundo",         "country": "US", "currency": "USD"},
    {"ticker": "EFA","name": "EFA (Desenvolvidos)",   "klass": "us_etf", "sector": "Desenvolvidos", "country": "US", "currency": "USD"},
    {"ticker": "EEM","name": "EEM (Emergentes)",      "klass": "us_etf", "sector": "Emergentes",    "country": "US", "currency": "USD"},
    {"ticker": "EWZ","name": "EWZ (Brasil)",          "klass": "us_etf", "sector": "Brasil",        "country": "US", "currency": "USD"},
    {"ticker": "INDA","name": "INDA (India)",         "klass": "us_etf", "sector": "Emergentes",    "country": "US", "currency": "USD"},
    {"ticker": "MCHI","name": "MCHI (China)",         "klass": "us_etf", "sector": "Emergentes",    "country": "US", "currency": "USD"},
    {"ticker": "IEUR","name": "IEUR (Europa)",        "klass": "us_etf", "sector": "Europa",        "country": "US", "currency": "USD"},
    {"ticker": "VNQ","name": "VNQ (REITs US)",        "klass": "us_etf", "sector": "REITs",         "country": "US", "currency": "USD"},
    {"ticker": "GLD","name": "GLD (Ouro)",            "klass": "us_etf", "sector": "Commodities",   "country": "US", "currency": "USD"},
    {"ticker": "SLV","name": "SLV (Prata)",           "klass": "us_etf", "sector": "Commodities",   "country": "US", "currency": "USD"},
    {"ticker": "USO","name": "USO (Petroleo)",        "klass": "us_etf", "sector": "Commodities",   "country": "US", "currency": "USD"},
    {"ticker": "DBC","name": "DBC (Commodities)",     "klass": "us_etf", "sector": "Commodities",   "country": "US", "currency": "USD"},
    {"ticker": "TLT","name": "TLT (Treasury 20+)",    "klass": "us_etf", "sector": "Renda fixa",    "country": "US", "currency": "USD"},
    {"ticker": "IEF","name": "IEF (Treasury 7-10)",   "klass": "us_etf", "sector": "Renda fixa",    "country": "US", "currency": "USD"},
    {"ticker": "SHV","name": "SHV (Treasury <1)",     "klass": "us_etf", "sector": "Renda fixa",    "country": "US", "currency": "USD"},
    {"ticker": "HYG","name": "HYG (High Yield)",      "klass": "us_etf", "sector": "Renda fixa",    "country": "US", "currency": "USD"},
    {"ticker": "LQD","name": "LQD (IG Corporate)",    "klass": "us_etf", "sector": "Renda fixa",    "country": "US", "currency": "USD"},
]


CLASS_LABELS: Dict[str, str] = {
    "br_acoes":   "Acoes BR",
    "br_etf":     "ETFs BR",
    "br_fii":     "FIIs BR",
    "us_acoes":   "Acoes EUA",
    "us_etf":     "ETFs EUA",
    "indice":     "Indices",
    "fx":         "Cambio",
    "commodity":  "Commodities",
    "cripto":     "Cripto",
}


def tickers_by_class(klass: str) -> List[str]:
    return [a["ticker"] for a in CATALOG if a["klass"] == klass]


def all_tickers() -> List[str]:
    return [a["ticker"] for a in CATALOG]


def total() -> int:
    return len(CATALOG)


if __name__ == "__main__":
    import collections
    counts = collections.Counter(a["klass"] for a in CATALOG)
    print(f"Total: {total()} ativos")
    for k, v in counts.most_common():
        print(f"  {CLASS_LABELS.get(k, k):20s} {v:3d}")
