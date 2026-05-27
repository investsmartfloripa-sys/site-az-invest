"""Build do Painel Visao Geral - bloco ANP combustiveis (vendas).

Fonte: ANP Dados Abertos. CSV com colunas ANO;MES;GRANDE REGIAO;UF;PRODUTO;VENDAS (m3).
"""
from __future__ import annotations
import argparse, json, sys, time, re
from datetime import datetime, timezone
from pathlib import Path
import requests

HERE = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/visao_geral_anp.json"
UA = {"User-Agent": "Mozilla/5.0 (compatible; az-invest/0.2)"}
ANP_CSV = "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/arquivos/vdpb/vendas-derivados-petroleo-e-etanol/vendas-combustiveis-m3-1990-2025.csv"
INPUTS = {"anp_combustiveis": "1990-01"}

MES_PT = {"JAN":1,"FEV":2,"MAR":3,"ABR":4,"MAI":5,"JUN":6,"JUL":7,"AGO":8,"SET":9,"OUT":10,"NOV":11,"DEZ":12}

def _get(url, *, timeout=120, retries=3, sleep=5.0):
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
    raise RuntimeError(f"falha {retries}: {last}")

def normalizar_produto(p):
    p = p.upper()
    if "ETANOL HIDR" in p: return "etanol_hidratado"
    if "GASOLINA C" in p or p.strip() == "GASOLINA": return "gasolina_c"
    if "DIESEL" in p: return "diesel"
    if "QUEROSENE" in p and "AVIA" in p: return "qav"
    if "GLP" in p: return "glp"
    return None

def parse_csv(text):
    lines = text.splitlines()
    if lines and lines[0].startswith("\ufeff"):
        lines[0] = lines[0][1:]
    if len(lines) < 2:
        return {}
    by_mes = {}
    for ln in lines[1:]:
        parts = ln.split(";")
        if len(parts) < 6:
            continue
        try:
            ano = int(parts[0])
            mes_str = parts[1].strip().upper()
            mes = MES_PT.get(mes_str)
            if not mes: continue
            produto = parts[4]
            vendas = float(parts[5].replace(",", "."))
        except (ValueError, IndexError):
            continue
        cat = normalizar_produto(produto)
        if not cat: continue
        mes_iso = f"{ano:04d}-{mes:02d}"
        d = by_mes.setdefault(mes_iso, {})
        d[cat] = d.get(cat, 0.0) + vendas
    return by_mes

def serializar(by_mes):
    serie = []
    for mes in sorted(by_mes.keys()):
        ag = by_mes[mes]
        gas = ag.get("gasolina_c", 0.0)
        eta = ag.get("etanol_hidratado", 0.0)
        die = ag.get("diesel", 0.0)
        qav = ag.get("qav", 0.0)
        ciclo = gas + eta
        total = ciclo + die
        serie.append({
            "mes": mes,
            "gasolina_c_m3": round(gas, 0),
            "etanol_hidratado_m3": round(eta, 0),
            "diesel_m3": round(die, 0),
            "qav_m3": round(qav, 0),
            "ciclo_otto_m3": round(ciclo, 0),
            "total_liquidos_m3": round(total, 0),
        })
    return serie

def calcular_variacoes(serie):
    base = {}
    for it in serie:
        if it["mes"].startswith("2019-"):
            for k in ("gasolina_c_m3","etanol_hidratado_m3","diesel_m3","qav_m3","ciclo_otto_m3","total_liquidos_m3"):
                if it.get(k):
                    base.setdefault(k, []).append(it[k])
    base = {k: (sum(v)/len(v) if v else None) for k, v in base.items()}
    by_mes = {it["mes"]: it for it in serie}
    for it in serie:
        a, m = it["mes"].split("-")
        prev = by_mes.get(f"{int(a)-1:04d}-{m}")
        for k in ("gasolina_c_m3","etanol_hidratado_m3","diesel_m3","qav_m3","ciclo_otto_m3","total_liquidos_m3"):
            cur = it.get(k); pv = prev.get(k) if prev else None
            short = k.replace("_m3", "")
            it[f"{short}_var_yoy_pct"] = round((cur/pv - 1)*100, 2) if (cur and pv and pv > 0) else None
            bs = base.get(k)
            it[f"{short}_indice_2019"] = round(cur/bs*100, 2) if (cur and bs and bs > 0) else None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--soft-fail", action="store_true")
    args = ap.parse_args()
    out_dir = Path(args.out_dir).resolve(); out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "visao_geral_anp.json"

    print("== ANP - vendas de combustiveis ==")
    try:
        r = _get(ANP_CSV)
        try:
            text = r.content.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = r.content.decode("latin-1")
        by_mes = parse_csv(text)
        if not by_mes:
            raise RuntimeError("CSV ANP vazio apos parse")
        print(f"  {len(by_mes)} meses")
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

    serie = serializar(by_mes)
    calcular_variacoes(serie)

    payload = {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "freshness_status": "fresh",
        "mes_recente": serie[-1]["mes"] if serie else None,
        "serie": serie,
        "inputs": INPUTS,
        "min_start_date": min(INPUTS.values()),
        "metadata": {"fonte": "ANP - Vendas de derivados de petroleo e biocombustiveis (m3)", "nota": "Base indice = media 2019. Ciclo Otto = gasolina C + etanol hidratado."},
    }
    out_file.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"JSON {out_file} ({out_file.stat().st_size/1024:.1f} KB)")

    if args.upload:
        sys.path.insert(0, str(HERE))
        from shared.blob_upload import maybe_upload_json
        try:
            maybe_upload_json(out_file, BLOB_PATH)
        except Exception as e:
            print(f"[upload] FAIL: {e}", file=sys.stderr)
            if not args.soft_fail: sys.exit(1)

if __name__ == "__main__":
    main()
