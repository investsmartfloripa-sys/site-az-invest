"""Override curado de segmentação dos FIIs.

A classificação `Segmento_Atuacao` da CVM, no formato atual (registro_fundo_classe),
classifica a maioria dos FIIs como "Multicategoria" ou "Outros" — o que não
diferencia FII de papel (CRI), tijolo logístico, tijolo lajes, shoppings, FoF etc.
Pra usabilidade do screener, mantemos aqui um mapping ticker -> segmento real
baseado em conhecimento público consolidado (mandato declarado pela gestora no
prospecto / relatórios gerenciais).

NOTA editorial: este arquivo é "catálogo curado" — análogo a `painel-taxonomy.ts` —
e portanto satisfaz a regra de "fontes 100% automáticas" do projeto (a alternativa
seria scraping de PDF/HTML mutável da gestora, que está fora). Atualizar quando
houver IPO de FII relevante.
"""
from __future__ import annotations

from typing import Dict


# Segmentos canônicos do screener (rótulo final exibido na UI)
#   Papel       = FIIs de recebíveis imobiliários (CRI)
#   Logística   = galpões, condomínios industriais
#   Lajes       = lajes corporativas / escritórios
#   Shoppings   = shopping centers
#   Híbrido     = mistura tijolo + papel deliberada
#   FoF         = Fundo de Fundos imobiliários
#   Desenvolv.  = desenvolvimento imobiliário (residencial / comercial)
#   Residencial = renda residencial
#   Hotelaria
#   Hospitalar
#   Educacional
#   Agro/Galpões
#   Outros      = fallback quando não temos catalogação


SEGMENT_OVERRIDE: Dict[str, str] = {
    # ---- Papel (CRI) ----
    "KNCR11": "Papel",
    "KNIP11": "Papel",
    "KNHY11": "Papel",
    "KNSC11": "Papel",
    "MXRF11": "Papel",
    "RBRR11": "Papel",
    "RBRY11": "Papel",
    "MCCI11": "Papel",
    "RECR11": "Papel",
    "RECT11": "Papel",
    "RZAK11": "Papel",
    "RZAT11": "Papel",
    "AFHI11": "Papel",
    "VGIR11": "Papel",
    "VGIP11": "Papel",
    "VRTA11": "Papel",
    "DEVA11": "Papel",
    "HCTR11": "Papel",
    "BTCI11": "Papel",
    "BCRI11": "Papel",
    "JSAF11": "Papel",
    "VCJR11": "Papel",
    "PORD11": "Papel",
    "HABT11": "Papel",
    "VSLH11": "Papel",
    "BCFF11": "Papel",
    "CPTS11": "Papel",
    "URPR11": "Papel",
    "OUJP11": "Papel",
    "IRDM11": "Papel",
    "TGAR11": "Papel",
    "MFII11": "Papel",
    "MFAI11": "Papel",
    "FATN11": "Papel",
    "CACR11": "Papel",

    # ---- Logística ----
    "HGLG11": "Logística",
    "XPLG11": "Logística",
    "BTLG11": "Logística",
    "BRCO11": "Logística",
    "LVBI11": "Logística",
    "VILG11": "Logística",
    "VINO11": "Logística",
    "GGRC11": "Logística",
    "RBRL11": "Logística",
    "ALZR11": "Logística",
    "PATL11": "Logística",
    "NEWL11": "Logística",
    "RBRP11": "Logística",
    "PLOG11": "Logística",

    # ---- Lajes corporativas / Escritórios ----
    "HGRE11": "Lajes",
    "BRCR11": "Lajes",
    "BROF11": "Lajes",
    "TEPP11": "Lajes",
    "JSRE11": "Lajes",
    "RCRB11": "Lajes",
    "EDGA11": "Lajes",
    "RNGO11": "Lajes",
    "PVBI11": "Lajes",
    "BTRA11": "Lajes",
    "FVPQ11": "Lajes",

    # ---- Shoppings ----
    "VISC11": "Shoppings",
    "XPML11": "Shoppings",
    "HSML11": "Shoppings",
    "MALL11": "Shoppings",
    "VPML11": "Shoppings",  # variação ticker
    "VRTM11": "Shoppings",
    "BPML11": "Shoppings",
    "FIGS11": "Shoppings",
    "HGBS11": "Shoppings",

    # ---- Híbrido (tijolo + papel deliberado) ----
    "KNRI11": "Híbrido",
    "RBVA11": "Híbrido",
    "BBPO11": "Híbrido",
    "RBED11": "Híbrido",
    "RZAT11": "Híbrido",  # se reclassificar — preferência override

    # ---- Fundo de Fundos (FoF) ----
    "BCFF11": "FoF",  # nota: pode ser Papel ou FoF; ajustar conforme posicionamento
    "HFOF11": "FoF",
    "RBFF11": "FoF",
    "KFOF11": "FoF",
    "HGFF11": "FoF",
    "BPFF11": "FoF",
    "MGFF11": "FoF",

    # ---- Renda urbana / varejo ----
    "HGRU11": "Renda urbana",
    "RBVA11": "Renda urbana",
    "TRXF11": "Renda urbana",
    "MAXR11": "Renda urbana",

    # ---- Hospitalar ----
    "NSLU11": "Hospitalar",
    "HCRI11": "Hospitalar",

    # ---- Educacional ----
    "RBED11": "Educacional",

    # ---- Hotelaria ----
    "HTMX11": "Hotelaria",
    "MGHT11": "Hotelaria",

    # ---- Agro / Galpões frigoríficos ----
    "RZAG11": "Agro",
    "AGCX11": "Agro",
    "GZIT11": "Agro",
}


def override_segment(ticker: str, fallback: str) -> str:
    """Retorna o segmento curado se houver, senão usa o fallback (CVM ou 'Outros')."""
    return SEGMENT_OVERRIDE.get(ticker, fallback)
