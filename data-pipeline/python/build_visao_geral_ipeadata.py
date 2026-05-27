"""Build do Painel Visao Geral - bloco IPEADATA (papelao + aco + FENABRAVE + ICEC).

IPEADATA tem espelho confiavel de varias series antecedentes/coincidentes
que NAO estao no BCB SGS. Endpoint REST publico.

Series:
  ABPO12_PAPEL12          - Expedicao papelao ondulado (ton) - ABPO
  IBSIE12_QSCAB12         - Aco bruto producao (ton) - IBS/IE
  FENABRAVE12_VENDVETOT12 - Emplacamentos autoveiculos - FENABRAVE
  CNC12_ICEC12            - Indice Confianca Empresario Comercio - CNC
  FCESP12_IIC12           - Confianca Consumidor Fecomercio SP

Gera /data/visao_geral_ipeadata.json no Blob.
"""
from __future__ import annotations
import argparse, json, sys, time, urllib.parse
from datetime import datetime, timezone
from pathlib import Path
import requests

HERE = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/visao_geral_ipeadata.json"
UA = {"User-Agent": "Mozilla/5.0"}
IPEA = "http://ipeadata.gov.br/api/odata4/ValoresSerie(SERCODIGO='{cod}')?{q}"

SERIES = {
    "papelao_abpo":      ("ABPO12_PAPEL12",          "Papelao ondulado - expedicao (ton)"),
    "aco_bruto":         ("IBSIE12_QSCAB12",         "Aco bruto - producao (ton)"),
    "fenabrave_emplac":  ("FENABRAVE12_VENDVETOT12", "Emplacamentos autoveiculos (FENABRAVE)"),
    "cnc_icec":          ("CNC12_ICEC12",            "ICEC - Confianca Empresario Comercio (CNC)"),
    "fecomercio_icc":    ("FCESP12_IIC12",           "Confianca Consumidor (Fecomercio SP)"),
    "fgv_constr_exp":    ("FGV12_IECSTCA12",         "Expectativas Construcao (FGV-IBRE com ajuste)"),
    "fgv_constr_atual":  ("FGV12_ISACSTCA12",        "Situacao Atual Construcao (FGV-IBRE com ajuste)"),
}
INPUTS = {k: "1995-01" for k in SERIES}

def _get(url, *, timeout=30, retries=3, sleep=4.0):
    last = None
    for i in range(retries):
        try:
            r = requests.get(url, timeout=timeout, headers=UA)
            r.raise_for_status()
            return r
        except Exception as e:
            last = e
            time.sleep(sleep)
    raise RuntimeError(f"falha: {last}")

def fetch_ipea(cod):
    q = urllib.parse.urlencode({"$orderby": "VALDATA"})
    url = IPEA.format(cod=cod, q=q)
    r = _get(url)
    out = []
    for row in r.json().get("value", []):
        try:
            data = row["VALDATA"][:7]  # YYYY-MM
            v = row.get("VALVALOR")
            if v is None: continue
            out.append({"mes": data, "valor": float(v)})
        except (KeyError, ValueError, TypeError):
            continue
    return out

def calcular_yoy(serie):
    by_mes = {it["mes"]: it["valor"] for it in serie}
    for it in serie:
        a, m = it["mes"].split("-")
        prev = by_mes.get(f"{int(a)-1:04d}-{m}")
        if prev and prev != 0:
            it["var_yoy_pct"] = round((it["valor"]/prev - 1)*100, 2)
        else:
            it["var_yoy_pct"] = None
    return serie

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--soft-fail", action="store_true")
    args = ap.parse_args()
    out_dir = Path(args.out_dir).resolve(); out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "visao_geral_ipeadata.json"

    print("== IPEADATA - antecedentes / confiancas ==")
    series = {}
    for slug, (cod, label) in SERIES.items():
        try:
            data = fetch_ipea(cod)
            series[slug] = {"serie": calcular_yoy(data), "label": label, "ipeacode": cod}
            print(f"  {slug} ({cod}): {len(data)} obs")
        except Exception as e:
            print(f"  FALHA {slug} ({cod}): {e}", file=sys.stderr)
            series[slug] = {"serie": [], "label": label, "ipeacode": cod}
        time.sleep(0.4)

    payload = {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "freshness_status": "fresh" if any(v["serie"] for v in series.values()) else "missing",
        **series,
        "inputs": INPUTS,
        "min_start_date": max(INPUTS.values()),
        "metadata": {
            "fonte": "IPEADATA (espelho IPEA com fontes ABPO/IBS/FENABRAVE/CNC/Fecomercio)",
            "nota": "Indicadores antecedentes/coincidentes nao espelhados no BCB SGS.",
        },
    }
    out_file.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"JSON {out_file} ({out_file.stat().st_size/1024:.1f} KB)")

    if args.upload:
        sys.path.insert(0, str(HERE))
        from shared.blob_upload import maybe_upload_json
        try:
            maybe_upload_json(out_file, BLOB_PATH)
        except Exception:
            if not args.soft_fail: sys.exit(1)

if __name__ == "__main__":
    main()
