"""Build do Painel Visao Geral - bloco EPE (consumo de energia eletrica).

Fonte: EPE "CONSUMO MENSAL DE ENERGIA ELETRICA POR CLASSE.xlsx".
URL: https://www.epe.gov.br/sites-pt/publicacoes-dados-abertos/publicacoes/Documents/

Pre-trata XLSX para fixar bug do openpyxl com baseColWidth=\'8.43\' (decimal).
Estrutura: abas TOTAL/RESIDENCIAL/INDUSTRIAL/COMERCIAL/OUTROS, cada uma com
matriz pivotada (anos como blocos de 12 meses).
"""
from __future__ import annotations
import argparse, json, sys, time, re, zipfile, io
from datetime import datetime, timezone
from pathlib import Path
import requests

HERE = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/visao_geral_epe.json"
UA = {"User-Agent": "Mozilla/5.0 (compatible; az-invest/0.2)"}
EPE_XLSX = "https://www.epe.gov.br/sites-pt/publicacoes-dados-abertos/publicacoes/Documents/CONSUMO%20MENSAL%20DE%20ENERGIA%20EL%C3%89TRICA%20POR%20CLASSE.xlsx"
INPUTS = {"epe_consumo": "1995-01"}

def _get(url, *, timeout=120, retries=3, sleep=5.0):
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

def fix_xlsx_basecolwidth(content):
    """Recompacta XLSX trocando baseColWidth=\'8.43\' por 8 (bug openpyxl)."""
    buf_in = io.BytesIO(content)
    buf_out = io.BytesIO()
    with zipfile.ZipFile(buf_in, "r") as zin:
        with zipfile.ZipFile(buf_out, "w", zipfile.ZIP_DEFLATED) as zout:
            for item in zin.namelist():
                data = zin.read(item)
                if item.endswith(".xml"):
                    try:
                        text = data.decode("utf-8")
                        text2 = re.sub(r'baseColWidth="[\d.]+"', 'baseColWidth="8"', text)
                        data = text2.encode("utf-8")
                    except UnicodeDecodeError:
                        pass
                zout.writestr(item, data)
    return buf_out.getvalue()

def parse_xlsx_epe(content):
    """Parse das abas do EPE. Estrutura: matriz pivotada com anos como blocos.

    Cada aba tem linhas tipo:
      [ANO_HEADER]
      Jan Fev Mar Abr Mai Jun Jul Ago Set Out Nov Dez (header de meses)
      [valor jan] [valor fev] ... (valores)

    Como cada aba e por classe (uma classe por aba), retornamos
    {classe: {mes_iso: valor}}.
    """
    fixed = fix_xlsx_basecolwidth(content)
    from openpyxl import load_workbook
    wb = load_workbook(io.BytesIO(fixed), data_only=True, read_only=True)
    print(f"  abas: {wb.sheetnames[:6]}")
    out = {"total": {}, "residencial": {}, "industrial": {}, "comercial": {}, "outros": {}}
    aba_to_key = {"TOTAL":"total","RESIDENCIAL":"residencial","INDUSTRIAL":"industrial","COMERCIAL":"comercial","OUTROS":"outros"}
    meses_idx = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]
    for aba in wb.sheetnames:
        key = aba_to_key.get(aba.upper())
        if not key: continue
        ws = wb[aba]
        rows = list(ws.iter_rows(values_only=True))
        ano_atual = None
        # estrutura: por bloco - linha com Ano, linha com meses, linha com Brasil/total
        for i, row in enumerate(rows):
            cells = [str(c).strip() if c is not None else "" for c in row]
            # detecta linha-ano: tem um numero entre 1990-2050 e poucos outros valores
            for v in cells[:5]:
                try:
                    n = int(float(v))
                    if 1990 <= n <= 2050:
                        ano_atual = n
                        break
                except ValueError:
                    pass
            # Se for linha com 12 numeros sequenciais e ja temos ano: capturar
            if ano_atual is None:
                continue
            valores_numericos = []
            for c in row:
                if isinstance(c, (int, float)) and not isinstance(c, bool):
                    valores_numericos.append(float(c))
            if len(valores_numericos) >= 12:
                # Pegar os primeiros 12 numeros depois da label
                for m, v in enumerate(valores_numericos[:12], start=1):
                    if v > 0:
                        out[key][f"{ano_atual:04d}-{m:02d}"] = v
                # avancar (proxima linha pode ser outro pais)
    return out

def calcular(out_dict):
    todos_meses = set()
    for d in out_dict.values():
        todos_meses.update(d.keys())
    serie = []
    for mes in sorted(todos_meses):
        item = {"mes": mes}
        for k in ("total","residencial","industrial","comercial","outros"):
            v = out_dict[k].get(mes)
            item[f"{k}_gwh"] = v
        serie.append(item)
    # base 2019
    base = {}
    for it in serie:
        if it["mes"].startswith("2019-"):
            for k in ("total","residencial","industrial","comercial","outros"):
                key = f"{k}_gwh"
                if it.get(key):
                    base.setdefault(key, []).append(it[key])
    base = {k: (sum(v)/len(v) if v else None) for k, v in base.items()}
    by_mes = {it["mes"]: it for it in serie}
    for it in serie:
        a, m = it["mes"].split("-")
        prev = by_mes.get(f"{int(a)-1:04d}-{m}")
        for k in ("total","residencial","industrial","comercial","outros"):
            key = f"{k}_gwh"
            cur = it.get(key); pv = prev.get(key) if prev else None
            it[f"{k}_var_yoy_pct"] = round((cur/pv - 1)*100, 2) if (cur and pv and pv > 0) else None
            bs = base.get(key)
            it[f"{k}_indice_2019"] = round(cur/bs*100, 2) if (cur and bs and bs > 0) else None
    return serie

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--soft-fail", action="store_true")
    args = ap.parse_args()
    out_dir = Path(args.out_dir).resolve(); out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "visao_geral_epe.json"

    print("== EPE - Consumo Mensal por Classe ==")
    try:
        r = _get(EPE_XLSX)
        out_dict = parse_xlsx_epe(r.content)
        if not any(out_dict.values()):
            raise RuntimeError("Nenhum valor lido do XLSX")
        serie = calcular(out_dict)
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

    payload = {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "freshness_status": "fresh",
        "mes_recente": serie[-1]["mes"] if serie else None,
        "serie": serie,
        "inputs": INPUTS,
        "min_start_date": min(INPUTS.values()),
        "metadata": {"fonte": "EPE - Consumo Mensal de Energia Eletrica por Classe (XLSX). GWh.", "nota": "Industrial e antecedente forte da PIM. Base = media 2019."},
    }
    out_file.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"JSON {out_file} ({out_file.stat().st_size/1024:.1f} KB)")

    if args.upload:
        sys.path.insert(0, str(HERE))
        from shared.blob_upload import maybe_upload_json
        try:
            maybe_upload_json(out_file, BLOB_PATH)
        except Exception as e:
            if not args.soft_fail: sys.exit(1)

if __name__ == "__main__":
    main()
