"""Build do Painel Visao Geral - CNI ICEI (via BCB SGS).

SGS 7341 - ICEI (Indice de Confiança do Empresário Industrial CNI)
SGS 7342 - ICEI componente situação atual
SGS 7343 - ICEI componente expectativas
"""
from __future__ import annotations
import argparse, json, sys, time
from datetime import datetime, timezone
from pathlib import Path
import requests

HERE = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/visao_geral_cni.json"
UA = {"User-Agent": "Mozilla/5.0"}
SGS_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{cod}/dados?formato=json&dataInicial=01/01/1999"

SERIES = {"icei": 7341, "icei_atual": 7342, "icei_expectativas": 7343}
INPUTS = {"icei": "1999-04"}

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
    out_file = out_dir / "visao_geral_cni.json"

    print("== CNI ICEI (via BCB SGS) ==")
    series = {}
    for slug, cod in SERIES.items():
        try:
            data = parse_sgs(cod)
            series[slug] = data
            print(f"  {slug.upper()} (SGS {cod}): {len(data)} obs")
        except Exception as e:
            print(f"  FALHA {slug}: {e}", file=sys.stderr)
            series[slug] = []
        time.sleep(0.3)

    if not series.get("icei"):
        if args.soft_fail:
            payload = {"gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"), "freshness_status": "missing", "icei": [], "inec": []}
            out_file.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
            return
        sys.exit(2)

    payload = {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "freshness_status": "fresh",
        "icei": series.get("icei", []),
        "icei_atual": series.get("icei_atual", []),
        "icei_expectativas": series.get("icei_expectativas", []),
        "inec": [],  # INEC nao espelhado no SGS - manter scraper proprio em Onda 3
        "inputs": INPUTS,
        "min_start_date": max(INPUTS.values()),
        "metadata": {
            "fonte": "CNI ICEI via BCB SGS 7341 (composto), 7342 (situacao atual), 7343 (expectativas).",
            "nota": "50 = neutro. >50 otimismo industrial, <50 pessimismo. INEC consumidor ainda nao espelhado no SGS.",
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
