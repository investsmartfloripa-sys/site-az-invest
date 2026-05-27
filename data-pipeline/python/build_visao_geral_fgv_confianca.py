"""Build do Painel Visao Geral - bloco Confianca FGV-IBRE (via BCB SGS).

BCB espelha as séries de Confiança da FGV-IBRE no SGS, evitando scraping
de XLSX do portal IBRE (que bloqueia user-agent / SSL handshake).

Códigos SGS (validados em 2026-05-27):
  21859 - ICE Confianca Empresarial (composto)
  21861 - ICI Industria
  21862 - ICOM Comercio
  21863 - ICS Servicos
  21864 - ICST Construcao
  21865 - ICC Consumidor
  21866 - ICA Agropecuaria (segundo Conjuntura Economica)
"""
from __future__ import annotations
import argparse, json, sys, time
from datetime import datetime, timezone
from pathlib import Path
import requests

HERE = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/visao_geral_fgv_confianca.json"
UA = {"User-Agent": "Mozilla/5.0"}
SGS_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{cod}/dados?formato=json&dataInicial=01/01/2005"

SERIES = {
    "ice": 21859,
    "ici": 21861,
    "icom": 21862,
    "ics": 21863,
    "icst": 21864,
    "icc": 21865,
    "ica": 21866,
}
INPUTS = {k: "2005-01" for k in SERIES}

def _get(url, *, timeout=30, retries=3, sleep=3.0):
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

def parse_sgs(cod):
    r = _get(SGS_URL.format(cod=cod))
    out = []
    for row in r.json():
        try:
            d, m, y = row["data"].split("/")
            out.append({"mes": f"{y}-{m}", "valor": float(row["valor"])})
        except: continue
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--soft-fail", action="store_true")
    args = ap.parse_args()
    out_dir = Path(args.out_dir).resolve(); out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "visao_geral_fgv_confianca.json"

    print("== FGV-IBRE Confianças (via BCB SGS) ==")
    series = {}
    falhas = []
    for slug, cod in SERIES.items():
        try:
            data = parse_sgs(cod)
            series[slug] = data
            print(f"  {slug.upper()} (SGS {cod}): {len(data)} obs")
        except Exception as e:
            print(f"  FALHA {slug} ({cod}): {e}", file=sys.stderr)
            series[slug] = []
            falhas.append(slug)
        time.sleep(0.3)

    if not any(series.values()):
        sys.path.insert(0, str(HERE))
        from shared.blob_download import download_json
        prev = download_json(BLOB_PATH)
        if prev:
            prev["freshness_status"] = "stale"
            prev["gerado_em"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
            out_file.write_text(json.dumps(prev, indent=2, ensure_ascii=False), encoding="utf-8")
            return
        if args.soft_fail:
            payload = {"gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"), "freshness_status": "missing", **{k: [] for k in series}}
            out_file.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
            return
        sys.exit(2)

    payload = {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "freshness_status": "fresh" if not falhas else "stale",
        **series,
        "inputs": INPUTS,
        "min_start_date": max(INPUTS.values()),
        "metadata": {
            "fonte": "FGV-IBRE Confianças via BCB SGS (21859 ICE, 21861 ICI, 21862 ICOM, 21863 ICS, 21864 ICST, 21865 ICC, 21866 ICA).",
            "nota": "100 = neutro. >100 otimismo, <100 pessimismo.",
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
