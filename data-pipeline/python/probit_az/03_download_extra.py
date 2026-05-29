"""Complemento: SIDRA com URL correta + BCB Olinda Focus + códigos IPEADATA reais."""
from __future__ import annotations
import io, sys
from pathlib import Path
import pandas as pd
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE = Path("/sessions/relaxed-dazzling-rubin/mnt/Gráfico Site AZ Invest/loop27-probit-misto-az")
RAW = BASE / "02-datasets-raw"
UA = {"User-Agent": "az-invest-loop27/1.0"}

# Complementar: SIDRA correto + Olinda + descobertas
EXTRAS = [
    # SIDRA PIM-PF por categoria de uso (tabela 8159)
    ("REAL_PROD", "SIDRA2", "PIMPF_geral",   "t/8888/v/11602/c544/129314/n1/all/p/all", "PIM-PF indústria geral YoY", "%"),
    ("REAL_PROD", "SIDRA2", "PIMPF_transf",  "t/8888/v/11602/c544/129316/n1/all/p/all", "PIM-PF transformação YoY", "%"),
    ("REAL_PROD", "SIDRA2", "PIMPF_extrat",  "t/8888/v/11602/c544/129315/n1/all/p/all", "PIM-PF extrativa YoY", "%"),
    # PMC tabela 8881 corrigida
    ("REAL_VEND", "SIDRA2", "PMC_restrito",  "t/8881/v/7170/c11046/56733/n1/all/p/all", "PMC restrito YoY", "%"),
    ("REAL_VEND", "SIDRA2", "PMC_ampliado",  "t/8881/v/7170/c11046/56734/n1/all/p/all", "PMC ampliado YoY", "%"),
    # PMS tabela 8688
    ("REAL_VEND", "SIDRA2", "PMS_servicos",  "t/8688/v/11620/n1/all/p/all", "PMS volume serviços YoY", "%"),
    # PNAD-C 6381 desocupação, 6390 rendimento
    ("REAL_EMP",  "SIDRA2", "PNAD_desoc",    "t/6381/v/4099/n1/all/p/all", "PNAD-C taxa desocupação", "%"),
    ("REAL_EMP",  "SIDRA2", "PNAD_renda",    "t/6390/v/5933/n1/all/p/all", "PNAD-C rendimento real R$", "R$"),
    # BCB Olinda Focus (mensal mediana ultimos 12m)
    ("EXPECTATIVA", "OLINDA", "Focus_IPCA_12m", "Focus IPCA 12 meses", "Mensal", "%"),
    ("EXPECTATIVA", "OLINDA", "Focus_PIB_anual", "Focus PIB anual", "Mensal", "%"),
    ("EXPECTATIVA", "OLINDA", "Focus_Selic_fim", "Focus Selic fim de ano", "Mensal", "%"),
]


def baixar_sidra2(query: str) -> pd.DataFrame:
    url = f"https://apisidra.ibge.gov.br/values/{query}"
    r = requests.get(url, timeout=60, headers=UA)
    r.raise_for_status()
    raw = r.json()
    if len(raw) <= 1:
        return pd.DataFrame()
    rows = []
    for row in raw[1:]:
        try:
            v = float(row["V"])
            periodo = row.get("D3C") or row.get("D2C") or ""
            if len(periodo) == 6:  # YYYYMM
                data = f"{periodo[:4]}-{periodo[4:]}-01"
            elif len(periodo) == 7:  # YYYYTNN trim
                ano, tri = periodo[:4], periodo[4:]
                m = {"01":"01","02":"04","03":"07","04":"10"}.get(tri, "01")
                data = f"{ano}-{m}-01"
            else:
                continue
            rows.append((data, v))
        except (KeyError, ValueError):
            continue
    df = pd.DataFrame(rows, columns=["data", "valor"])
    df["data"] = pd.to_datetime(df["data"], errors="coerce")
    return df.dropna().sort_values("data").reset_index(drop=True)


def baixar_olinda_focus(indicador: str) -> pd.DataFrame:
    """BCB Olinda Focus - mediana 12m ahead."""
    if indicador == "Focus_IPCA_12m":
        url = "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoInflacao12Meses?$filter=Indicador%20eq%20%27IPCA%27%20and%20Suavizada%20eq%20%27S%27%20and%20baseCalculo%20eq%200&$select=Data,Mediana&$format=json"
    elif indicador == "Focus_PIB_anual":
        url = "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais?$filter=Indicador%20eq%20%27PIB%20Total%27%20and%20baseCalculo%20eq%200&$select=Data,DataReferencia,Mediana&$format=json"
    elif indicador == "Focus_Selic_fim":
        url = "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais?$filter=Indicador%20eq%20%27Selic%27%20and%20baseCalculo%20eq%200&$select=Data,DataReferencia,Mediana&$format=json"
    else:
        return pd.DataFrame()
    r = requests.get(url, timeout=60, headers=UA)
    r.raise_for_status()
    data = r.json().get("value", [])
    rows = []
    for p in data:
        try:
            d = p.get("Data", "")[:10]
            v = float(p["Mediana"])
            # Para Anuais, filtrar so DataReferencia = ano corrente + 1 (proxy 12m)
            if "DataReferencia" in p:
                ano_ref = int(p["DataReferencia"])
                ano_data = int(d[:4])
                if ano_ref != ano_data:
                    continue
            rows.append((d, v))
        except (KeyError, ValueError):
            continue
    df = pd.DataFrame(rows, columns=["data", "valor"])
    df["data"] = pd.to_datetime(df["data"], errors="coerce")
    df = df.dropna().sort_values("data")
    # Mensalizar
    df["mes"] = df["data"].dt.to_period("M").dt.to_timestamp()
    return df.groupby("mes", as_index=False)["valor"].mean().rename(columns={"mes": "data"})


def processar(row):
    cat, fonte, codigo, query_or_name, freq_or_label, unid = row[:6]
    out_dir = RAW / fonte.lower()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / f"{codigo}.csv"
    try:
        if fonte == "SIDRA2":
            df = baixar_sidra2(query_or_name)
        elif fonte == "OLINDA":
            df = baixar_olinda_focus(codigo)
        else:
            return (codigo, "skip", 0)
        if len(df) == 0:
            return (codigo, "vazio", 0)
        df.to_csv(out_file, index=False)
        return (codigo, "ok", len(df))
    except Exception as e:
        return (codigo, "erro", str(e)[:100])


def main():
    print(f"Processando {len(EXTRAS)} extras")
    with ThreadPoolExecutor(max_workers=8) as ex:
        futs = {ex.submit(processar, r): r for r in EXTRAS}
        for fut in as_completed(futs):
            r = futs[fut]
            try:
                cod, st, n = fut.result()
            except Exception as e:
                cod, st, n = r[2], "fail", str(e)[:80]
            print(f"  [{st:6}] {r[1]:7} {cod:25} n={n}", flush=True)


if __name__ == "__main__":
    main()
