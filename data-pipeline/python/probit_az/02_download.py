"""Loop 27 #3 - Downloader em massa de todas series do catalogo.

Cada serie: tenta baixar, normaliza pra (mes, valor), salva CSV individual.
Falhas registradas em status.csv pra cross-check.
"""
from __future__ import annotations
import os, sys, time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import pandas as pd
import requests

BASE = Path("/sessions/relaxed-dazzling-rubin/mnt/Gráfico Site AZ Invest/loop27-probit-misto-az")
CAT = BASE / "01-catalogo" / "catalogo_antecedentes.csv"
RAW = BASE / "02-datasets-raw"

UA = {"User-Agent": "az-invest-loop27/1.0"}
UA_JSON = {"User-Agent": "az-invest-loop27/1.0", "Accept": "application/json"}

def to_mensal(df: pd.DataFrame, freq_orig: str) -> pd.DataFrame:
    """Normaliza para frequencia mensal."""
    if df.empty:
        return df
    df["data"] = pd.to_datetime(df["data"], errors="coerce")
    df = df.dropna(subset=["data"]).sort_values("data")
    if freq_orig.lower().startswith("diari"):
        df["mes"] = df["data"].dt.to_period("M").dt.to_timestamp()
        df = df.groupby("mes", as_index=False)["valor"].last()
        df = df.rename(columns={"mes": "data"})
    return df[["data", "valor"]]


def baixar_bcb_sgs(codigo: str, freq: str) -> pd.DataFrame:
    url = f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados?formato=json&dataInicial=01/01/1995"
    # Tentar 3 vezes com headers diferentes
    last_err = None
    for hdrs in (UA, UA_JSON, {"User-Agent": "Mozilla/5.0"}):
        try:
            r = requests.get(url, timeout=30, headers=hdrs)
            r.raise_for_status()
            break
        except Exception as e:
            last_err = e
    else:
        raise last_err
    data = r.json()
    df = pd.DataFrame([(p.get("data"), float(p["valor"])) for p in data], columns=["data", "valor"])
    df["data"] = pd.to_datetime(df["data"], format="%d/%m/%Y", errors="coerce")
    return to_mensal(df.dropna(), freq)


def baixar_ipeadata(codigo: str, freq: str) -> pd.DataFrame:
    url = f"http://www.ipeadata.gov.br/api/odata4/ValoresSerie(SERCODIGO='{codigo}')"
    r = requests.get(url, timeout=120, headers=UA)
    r.raise_for_status()
    data = r.json().get("value", [])
    rows = []
    for p in data:
        if p.get("VALVALOR") is None:
            continue
        rows.append((p.get("VALDATA", "")[:10], float(p["VALVALOR"])))
    df = pd.DataFrame(rows, columns=["data", "valor"])
    return to_mensal(df, freq)


def baixar_sidra(query: str, freq: str) -> pd.DataFrame:
    url = f"https://apisidra.ibge.gov.br/values/t/{query}/n1/all"
    r = requests.get(url, timeout=120, headers=UA)
    r.raise_for_status()
    rows_raw = r.json()
    if len(rows_raw) <= 1:
        return pd.DataFrame()
    rows = []
    for row in rows_raw[1:]:
        try:
            valor = float(row["V"])
            # D3C ou D4C contem o periodo - tentativa generica
            periodo = row.get("D3C") or row.get("D4C") or row.get("D2C", "")
            if len(periodo) == 6:  # YYYYMM
                data = f"{periodo[:4]}-{periodo[4:]}-01"
            elif len(periodo) == 7:  # YYYYTT (trim)
                ano, tri = periodo[:4], periodo[4:]
                mes = {"01": "01", "02": "04", "03": "07", "04": "10"}.get(tri, "01")
                data = f"{ano}-{mes}-01"
            else:
                continue
            rows.append((data, valor))
        except (KeyError, ValueError):
            continue
    df = pd.DataFrame(rows, columns=["data", "valor"])
    df["data"] = pd.to_datetime(df["data"], errors="coerce")
    return df.dropna().sort_values("data").reset_index(drop=True)


def baixar_yfinance(ticker: str, freq: str) -> pd.DataFrame:
    import io
    # Yahoo Finance via query1 endpoint (sem yfinance lib)
    url = f"https://query1.finance.yahoo.com/v7/finance/download/{ticker}?period1=946684800&period2=9999999999&interval=1d&events=history"
    r = requests.get(url, timeout=60, headers=UA)
    if r.status_code != 200:
        # Tentar chart endpoint
        url2 = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?range=max&interval=1mo"
        r2 = requests.get(url2, timeout=60, headers=UA)
        r2.raise_for_status()
        d = r2.json().get("chart", {}).get("result", [])
        if not d:
            return pd.DataFrame()
        ts = d[0].get("timestamp", [])
        cl = d[0].get("indicators", {}).get("quote", [{}])[0].get("close", [])
        rows = [(pd.Timestamp(t, unit="s"), v) for t, v in zip(ts, cl) if v is not None]
        df = pd.DataFrame(rows, columns=["data", "valor"])
        return to_mensal(df, "mensal")
    df = pd.read_csv(io.StringIO(r.text))
    df["data"] = pd.to_datetime(df["Date"], errors="coerce")
    df["valor"] = pd.to_numeric(df["Close"], errors="coerce")
    return to_mensal(df[["data", "valor"]].dropna(), "diaria")


def baixar_fred(codigo: str, freq: str) -> pd.DataFrame:
    # FRED CSV publico
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={codigo}"
    r = requests.get(url, timeout=60, headers=UA)
    r.raise_for_status()
    import io
    df = pd.read_csv(io.StringIO(r.text))
    if df.shape[1] < 2:
        return pd.DataFrame()
    df.columns = ["data", "valor"]
    df["data"] = pd.to_datetime(df["data"], errors="coerce")
    df["valor"] = pd.to_numeric(df["valor"], errors="coerce")
    return to_mensal(df.dropna(), freq)


def processar(row) -> tuple[str, str, str, int]:
    cat, fonte, codigo, nome, freq, unid, start, prio = row
    nome_safe = nome.replace("/", "_").replace(" ", "_").replace(":", "_")[:60]
    out_dir = RAW / fonte.lower()
    out_dir.mkdir(parents=True, exist_ok=True)
    codigo_safe = str(codigo).replace("/", "_")[:60]
    out_file = out_dir / f"{codigo_safe}.csv"
    try:
        if fonte == "BCB_SGS":
            df = baixar_bcb_sgs(str(codigo), freq)
        elif fonte == "IPEADATA":
            df = baixar_ipeadata(str(codigo), freq)
        elif fonte == "SIDRA":
            df = baixar_sidra(str(codigo), freq)
        elif fonte == "YFINANCE":
            df = baixar_yfinance(str(codigo), freq)
        elif fonte in ("FRED", "OCDE_FRED"):
            df = baixar_fred(str(codigo), freq)
        elif fonte == "BCB_OLINDA":
            return (str(codigo), "skip", "Olinda Focus tratado separadamente", 0)
        else:
            return (str(codigo), "skip", f"fonte {fonte} nao implementada", 0)
        n = len(df)
        if n == 0:
            return (str(codigo), "vazio", "0 obs retornadas", 0)
        df.to_csv(out_file, index=False)
        return (str(codigo), "ok", str(out_file), n)
    except Exception as e:
        return (str(codigo), "erro", str(e)[:120], 0)


def main():
    import sys
    start = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    end = int(sys.argv[2]) if len(sys.argv) > 2 else 99999
    cat = pd.read_csv(CAT).iloc[start:end].reset_index(drop=True)
    print(f"Processando {len(cat)} series (slice {start}:{end})")
    from concurrent.futures import ThreadPoolExecutor, as_completed
    resultados = []
    rows = [tuple(r.tolist()) for _, r in cat.iterrows()]
    with ThreadPoolExecutor(max_workers=12) as ex:
        futs = {ex.submit(processar, row): row for row in rows}
        for fut in as_completed(futs):
            row = futs[fut]
            try:
                codigo_str, status, info, n = fut.result()
            except Exception as e:
                codigo_str, status, info, n = (str(row[2]), "fail", str(e)[:80], 0)
            cat_, fonte, codigo, nome = row[0], row[1], row[2], row[3]
            marker = "OK " if status == "ok" else status.upper()
            print(f"  [{marker:6s}] {fonte:12s} {str(codigo_str):30s} n={n:5d}  {info[:60]}", flush=True)
            resultados.append((cat_, fonte, codigo, nome, status, n, info))
    df_status = pd.DataFrame(resultados, columns=["categoria", "fonte", "codigo", "nome", "status", "n_obs", "info"])
    df_status.to_csv(BASE / "01-catalogo" / f"status_download_{start}_{end}.csv", index=False, encoding="utf-8-sig")
    print("\n=== Resumo ===")
    print(df_status["status"].value_counts())


if __name__ == "__main__":
    main()
