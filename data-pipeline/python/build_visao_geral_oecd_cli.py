"""Build do Painel Visao Geral - bloco OECD CLI Brasil via DBnomics.

DBnomics e espelho do OECD. Endpoint REST publico, sem auth, JSON estruturado.

TROCA DE DATASET EM 2026-09-18. O script lia `OECD/MEI_CLI/LOLITOAA.BRA.M`, da
base MEI, que a OCDE aposentou: o DBnomics segue servindo o historico congelado
em 2023-12 com HTTP 200, entao a serie ficou 2 anos e 9 meses parada marcada
como "fresh" — mesmo defeito da EPE, achado no mesmo dia.

Substituto: `OECD/DSD_STES@DF_CLI/BRA.M.LI.IX._Z.AA.IX._Z.H` (Composite leading
indicator, amplitude-adjusted). Continuidade conferida na sobreposicao: 420
meses em comum, diferenca media 0,13 e +0,02 no ponto de emenda (2023-12).
"""
from __future__ import annotations
import argparse, json, sys, time
from datetime import datetime, timezone
from pathlib import Path
import requests

HERE = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/visao_geral_oecd_cli.json"
UA = {"User-Agent": "Mozilla/5.0 (compatible; az-invest/0.3)"}
DBNOMICS = "https://api.db.nomics.world/v22/series/OECD/DSD_STES@DF_CLI/BRA.M.LI.IX._Z.AA.IX._Z.H?observations=1"
INPUTS = {"oecd_cli_bra": "1989-01"}

def _get(url, *, timeout=60, retries=3, sleep=4.0):
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

def freshness(mes_recente):
    """Compara a data do DADO com hoje — nao basta a API ter respondido 200.

    A CLI tem defasagem tipica de ~2 meses. Acima de 5 meses de atraso o dataset
    foi descontinuado ou mudou de lugar, e isso precisa aparecer no painel de
    saude em vez de passar por "fresh" (foi o que escondeu a quebra do MEI_CLI).
    """
    if not mes_recente:
        return "missing"
    hoje = datetime.now(timezone.utc)
    a, m = (int(x) for x in mes_recente.split("-"))
    atraso = (hoje.year - a) * 12 + (hoje.month - m)
    return "fresh" if atraso <= 5 else "stale"

def quadrante(nivel, mom6):
    if nivel is None or mom6 is None: return None
    if nivel >= 100 and mom6 >= 0: return "expansao"
    if nivel >= 100 and mom6 < 0: return "desaceleracao"
    if nivel < 100 and mom6 < 0: return "recessao"
    return "recuperacao"

def parse_dbnomics(payload):
    docs = payload.get("series", {}).get("docs", [])
    if not docs: return {}
    s = docs[0]
    periods = s.get("period", [])
    values = s.get("value", [])
    out = {}
    for p, v in zip(periods, values):
        if v is None: continue
        try:
            out[p[:7]] = float(v)
        except (ValueError, TypeError):
            continue
    return out

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
    status = freshness(ult.get("mes"))
    if status == "stale":
        print(f"  AVISO: dado mais recente e {ult.get('mes')} — dataset atrasado", file=sys.stderr)
    return {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "freshness_status": status,
        "mes_recente": ult.get("mes"),
        "serie": serie,
        "inputs": INPUTS,
        "min_start_date": min(INPUTS.values()),
        "destaques": {"nivel_recente": ult.get("nivel"), "var_6m_anualizada_recente": ult.get("var_6m_anualizada"), "quadrante_recente": ult.get("quadrante")},
        "metadata": {"fonte": "DBnomics espelho OECD DSD_STES@DF_CLI, serie BRA.M.LI.IX._Z.AA.IX._Z.H (CLI amplitude-adjusted, mensal)", "nota": "Linha 100 = tendencia. Defasagem tipica ~2 meses."},
    }

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--soft-fail", action="store_true")
    args = ap.parse_args()
    out_dir = Path(args.out_dir).resolve(); out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "visao_geral_oecd_cli.json"

    print("== OECD CLI Brasil (DBnomics) ==")
    try:
        r = _get(DBNOMICS)
        serie_dict = parse_dbnomics(r.json())
        if not serie_dict: raise RuntimeError("DBnomics retornou serie vazia")
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
    sz = out_file.stat().st_size / 1024
    print(f"JSON {out_file} ({sz:.1f} KB)")
    print("  mes:", payload["mes_recente"])

    if args.upload:
        sys.path.insert(0, str(HERE))
        from shared.blob_upload import maybe_upload_json
        try:
            maybe_upload_json(out_file, BLOB_PATH)
        except Exception:
            if not args.soft_fail: sys.exit(1)

if __name__ == "__main__":
    main()
