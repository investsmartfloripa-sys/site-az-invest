"""Build do Painel Visao Geral — PNAD rendimento medio real (income leg do quartet TCB).

SIDRA 6390 / v=5933 = Rendimento medio mensal real das pessoas ocupadas (R$).
Frequencia: trimestre movel.
"""
from __future__ import annotations
import argparse, json, sys
from datetime import datetime, timezone
from pathlib import Path
import requests

HERE = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/visao_geral_pnad_renda.json"
UA = {"User-Agent": "az-invest-pnad-renda/1.0"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--soft-fail", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    url = "https://apisidra.ibge.gov.br/values/t/6390/n1/all/v/5933/p/all"
    r = requests.get(url, timeout=120, headers=UA)
    r.raise_for_status()
    rows = r.json()
    serie = []
    for row in rows[1:]:  # primeira linha eh header
        try:
            trim_cod = row["D3C"]  # ex "202601"
            ano = trim_cod[:4]
            tri = trim_cod[4:]
            trim_iso = f"{ano}-T{tri}"
            valor = float(row["V"])
            serie.append({"trim": trim_iso, "rendimento_real_brl": valor})
        except (KeyError, ValueError):
            continue
    # Calcular var YoY (4 trimestres atrás)
    by_trim = {p["trim"]: p["rendimento_real_brl"] for p in serie}
    for p in serie:
        trim_atual = p["trim"]
        ano, tri = trim_atual.split("-T")
        trim_ano_ant = f"{int(ano) - 1}-T{tri}"
        v_ant = by_trim.get(trim_ano_ant)
        p["var_yoy_pct"] = round(((p["rendimento_real_brl"] / v_ant) - 1) * 100, 2) if v_ant else None

    payload = {
        "gerado_em": datetime.now(timezone.utc).isoformat(),
        "trim_recente": serie[-1]["trim"] if serie else None,
        "serie": serie,
        "metadata": {
            "fonte": "IBGE SIDRA tabela 6390 variavel 5933",
            "nota": "Rendimento medio real efetivo das pessoas ocupadas (PNAD-C). Income leg do quartet TCB (Stock-Watson, Duarte-Issler-Spacov 2004).",
        },
    }
    out_path = out_dir / "visao_geral_pnad_renda.json"
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    print(f"  -> {out_path} ({len(serie)} obs)")

    if args.upload:
        try:
            sys.path.insert(0, str(HERE / "shared"))
            from blob_upload import maybe_upload_json
            maybe_upload_json(out_path, BLOB_PATH)
        except Exception as e:
            print(f"upload skip: {e}", file=sys.stderr)


if __name__ == "__main__":
    main()
