"""Build do Painel Visao Geral - bloco OECD CLI Brasil (via FRED).

Fonte unica: FRED BRALOLITOAASTSAM (espelho do OECD CLI Brasil amplitude-adjusted).
SDMX OECD mudou para 9 dimensoes em 2024 e mapeamento ficou complexo;
FRED ja serve o mesmo dado historico.
"""
from __future__ import annotations
import argparse, json, sys, time
from datetime import datetime, timezone
from pathlib import Path
import requests

HERE = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/visao_geral_oecd_cli.json"
UA = {"User-Agent": "Mozilla/5.0 (compatible; az-invest/0.2)"}
FRED_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=BRALOLITOAASTSAM"
INPUTS = {"oecd_cli_bra": "1989-01"}

def _get(url, *, timeout=180, retries=5, sleep=10.0):
    last = None
    for i in range(retries):
        try:
            r = requests.get(url, timeout=timeout, headers=UA)
            r.raise_for_status()
            return r
        except Exception as e:
            last = e
            print(f"  retry {i+1}/{retries}: {e}", file=sys.stderr)
            time.sleep(sleep)
    raise RuntimeError(f"falha apos {retries}: {last}")

def parse_fred(text):
    out = {}
    for ln in text.strip().split("\n")[1:]:
        parts = ln.split(",")
        if len(parts) < 2: continue
        d, v = parts[0].strip(), parts[1].strip()
        if v in (".", "", "NaN"): continue
        try:
            out[d[:7]] = float(v)
        except ValueError:
            continue
    return out

def quadrante(nivel, mom6):
    if nivel is None or mom6 is None: return None
    if nivel >= 100 and mom6 >= 0: return "expansao"
    if nivel >= 100 and mom6 < 0: return "desaceleracao"
    if nivel < 100 and mom6 < 0: return "recessao"
    return "recuperacao"

def build_payload(serie_dict):
    meses = sorted(serie_dict.keys())
    serie = []
    for i, m in enumerate(meses):
        nivel = serie_dict[m]
        prev6 = serie_dict.get(meses[i-6]) if i >= 6 else None
        mom6 = round(((nivel/prev6)**2 - 1)*100, 2) if (prev6 and prev6 > 0) else None
        prev12 = serie_dict.get(meses[i-12]) if i >= 12 else None
        yoy = round((nivel/prev12 - 1)*100, 2) if (prev12 and prev12 > 0) else None
        serie.append({"mes": m, "nivel": round(nivel, 3), "var_6m_anualizada": mom6, "var_yoy": yoy, "quadrante": quadrante(nivel, mom6)})
    ult = serie[-1] if serie else {}
    return {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "freshness_status": "fresh",
        "mes_recente": ult.get("mes"),
        "serie": serie,
        "inputs": INPUTS,
        "min_start_date": min(INPUTS.values()),
        "destaques": {"nivel_recente": ult.get("nivel"), "var_6m_anualizada_recente": ult.get("var_6m_anualizada"), "quadrante_recente": ult.get("quadrante")},
        "metadata": {"fonte": "FRED BRALOLITOAASTSAM (espelho OECD CLI Brasil amplitude-adjusted)", "nota": "Linha 100 = tendencia. Var 6m anualizada e o leading verdadeiro. Defasagem tipica ~2 meses."},
    }

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--soft-fail", action="store_true")
    args = ap.parse_args()
    out_dir = Path(args.out_dir).resolve(); out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "visao_geral_oecd_cli.json"

    print("== OECD CLI Brasil (via FRED) ==")
    try:
        r = _get(FRED_URL)
        serie_dict = parse_fred(r.text)
        if not serie_dict: raise RuntimeError("FRED CSV vazio")
        print(f"  {len(serie_dict)} obs")
    except Exception as e:
        print(f"  FALHA: {e}", file=sys.stderr)
        sys.path.insert(0, str(HERE))
        from shared.blob_download import download_json
        prev = download_json(BLOB_PATH)
        if prev:
            prev["freshness_status"] = "stale"
            prev["gerado_em"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
            out_file.write_text(json.dumps(prev, indent=2, ensure_ascii=False), encoding="utf-8")
            return
        if args.soft_fail:
            out_file.write_text(json.dumps({"gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"), "freshness_status": "missing", "serie": []}, indent=2), encoding="utf-8")
            return
        sys.exit(2)

    payload = build_payload(serie_dict)
    out_file.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"JSON {out_file} ({out_file.stat().st_size/1024:.1f} KB) mes {payload[\'mes_recente\']}")

    if args.upload:
        sys.path.insert(0, str(HERE))
        from shared.blob_upload import maybe_upload_json
        try:
            maybe_upload_json(out_file, BLOB_PATH)
        except Exception:
            if not args.soft_fail: sys.exit(1)

if __name__ == "__main__":
    main()
