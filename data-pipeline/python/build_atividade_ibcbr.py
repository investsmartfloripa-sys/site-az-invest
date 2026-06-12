"""Build do JSON do Painel Atividade — bloco IBC-Br (schema v2, aditivo).

BCB SGS 24363 (sem ajuste) + 24364 (com ajuste sazonal).

Convenções (v2):
- var_mom e var_3m sobre o índice SA (momentum dessazonalizado);
- var_yoy sobre o índice NS — convenção oficial: YoY compara com o mesmo mês do ano
  anterior, a sazonalidade cancela; sobre o SA o ajuste distorce (corrigido no v2);
- var_3m3m_saar (NOVO): média móvel 3m do índice SA ÷ média móvel 3m anterior,
  anualizada — a taxa trimestralizada canônica de research (bem menos ruidosa
  que anualizar a variação ponto-a-ponto m/m-3).
"""
from __future__ import annotations
import argparse, json, sys, time
from datetime import datetime, timezone
from pathlib import Path
import requests

HERE = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/atividade_ibcbr.json"
UA = {"User-Agent": "az-invest-atividade-ibcbr/0.2"}
SGS_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{cod}/dados?formato=json"


def _get(url, *, timeout=60, retries=3, sleep=3.0):
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
    raise RuntimeError(f"falha {retries} tentativas: {last}")


def _to_float(v):
    if v in ("", None):
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _parse(s):
    d, m, y = s.split("/")
    return f"{y}-{m}"


def sgs_fetch(cod):
    print(f"  [SGS {cod}]")
    data = _get(SGS_URL.format(cod=cod)).json()
    return {_parse(r["data"]): _to_float(r["valor"]) for r in data}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "atividade_ibcbr.json"

    print("== IBC-Br (BCB SGS) ==")
    try:
        ns = sgs_fetch(24363)
        sa = sgs_fetch(24364)
    except Exception as e:
        print(f"ERRO {e}", file=sys.stderr)
        sys.path.insert(0, str(HERE))
        from shared.blob_download import download_json
        prev = download_json(BLOB_PATH)
        if not prev:
            sys.exit(2)
        out_file.write_text(json.dumps(prev, indent=2, ensure_ascii=False), encoding="utf-8")
        return

    print(f"  NS {len(ns)} obs | SA {len(sa)} obs")
    meses = sorted(set(ns.keys()) | set(sa.keys()))
    serie = []
    for m in meses:
        serie.append({"mes": m, "indice_sa": sa.get(m), "indice_ns": ns.get(m)})

    # Variações — var_mom/var_3m sobre SA; var_yoy sobre NS (convenção oficial, v2)
    for i, item in enumerate(serie):
        idx_sa = item["indice_sa"]
        idx_ns = item["indice_ns"]
        prev_sa = serie[i-1]["indice_sa"] if i >= 1 else None
        y_ns = serie[i-12]["indice_ns"] if i >= 12 else None
        prev_q = serie[i-3]["indice_sa"] if i >= 3 else None
        item["var_mom"] = round((idx_sa/prev_sa - 1)*100, 2) if (idx_sa and prev_sa) else None
        item["var_yoy"] = round((idx_ns/y_ns - 1)*100, 2) if (idx_ns and y_ns) else None
        item["var_3m"] = round((idx_sa/prev_q - 1)*100, 2) if (idx_sa and prev_q) else None
        # MM3m do índice SA
        jan = [serie[j]["indice_sa"] for j in range(max(0, i-2), i+1) if serie[j]["indice_sa"] is not None]
        item["indice_sa_mm3"] = round(sum(jan)/len(jan), 4) if len(jan) == 3 else None

    # MM3m da var YoY (suaviza ruído; recalculada sobre a YoY do índice NS)
    for i, item in enumerate(serie):
        jan = [serie[j]["var_yoy"] for j in range(max(0, i-2), i+1) if serie[j]["var_yoy"] is not None]
        item["var_yoy_mm3"] = round(sum(jan)/len(jan), 2) if len(jan) == 3 else None

    # 3m/3m SAAR (v2): mm3 do índice SA vs mm3 três meses antes, anualizado
    for i, item in enumerate(serie):
        mm3 = item.get("indice_sa_mm3")
        mm3_prev = serie[i-3].get("indice_sa_mm3") if i >= 3 else None
        item["var_3m3m_saar"] = round(((mm3/mm3_prev)**4 - 1)*100, 2) if (mm3 and mm3_prev) else None

    # Heatmap mensal: ano × mês, índice SA
    heatmap = {}  # ano -> [12 valores]
    for item in serie:
        ano, mes = item["mes"].split("-")
        mes_int = int(mes) - 1
        heatmap.setdefault(ano, [None]*12)[mes_int] = item["indice_sa"]
    heatmap_anos = sorted(heatmap.keys())

    # Médias anuais (média do índice SA)
    medias_anuais = []
    for ano in heatmap_anos:
        vals = [v for v in heatmap[ano] if v is not None]
        if vals:
            medias_anuais.append({"ano": ano, "media": round(sum(vals)/len(vals), 2), "n": len(vals)})

    # Sanity
    assert len(serie) >= 24
    ult = serie[-1]["indice_sa"]
    assert ult and 70 < ult < 130

    out = {
        "schema_version": 2,
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "mes_recente": serie[-1]["mes"],
        "serie": serie,
        "heatmap": {"anos": heatmap_anos, "valores": heatmap},
        "medias_anuais": medias_anuais,
        "metadata": {
            "fonte": "BCB SGS — 24363 (sem ajuste) e 24364 (com ajuste sazonal). Base 2002=100.",
            "nota": "Proxy mensal do PIB. var_mom e var_3m sobre o índice SA; var_yoy sobre o índice NS (convenção oficial — a sazonalidade cancela na comparação interanual). var_3m3m_saar = média móvel 3m vs média móvel 3m anterior, anualizada (taxa trimestralizada canônica).",
        },
    }

    out_file.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"JSON {out_file} ({out_file.stat().st_size/1024:.1f} KB)")
    print(f"Último: {serie[-1]['mes']} | SA {ult} | YoY {serie[-1].get('var_yoy')}% | MM3 YoY {serie[-1].get('var_yoy_mm3')}%")

    if args.upload:
        try:
            sys.path.insert(0, str(HERE))
            from shared.blob_upload import maybe_upload_json
            maybe_upload_json(out_file, BLOB_PATH)
        except Exception as e:
            print(f"[upload] FALHOU: {e}", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    main()
