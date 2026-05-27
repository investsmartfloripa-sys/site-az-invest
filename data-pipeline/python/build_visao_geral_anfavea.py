"""Build do Painel Visao Geral - bloco ANFAVEA (producao e vendas de autoveiculos).

Fonte: https://anfavea.com.br/docs/siteautoveiculos<ANO>.xlsx
Estrutura: matriz pivotada com anos como blocos de 12 meses.
Abas: I.Emplacamento, V.Exportacao Volume, VI.Producao.
"""
from __future__ import annotations
import argparse, json, sys, time, re, io
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
import requests

HERE = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/visao_geral_anfavea.json"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      "Referer": "https://anfavea.com.br/site/edicoes-em-excel/"}
INPUTS = {"anfavea_veiculos": "1957-01"}

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

def localizar_xlsx_atual():
    """Pega a URL XLSX do ano atual ou recente da pagina de edicoes."""
    ano = datetime.now(timezone.utc).year
    for delta in range(0, 3):  # tenta ano atual, depois anterior
        url = f"https://anfavea.com.br/docs/siteautoveiculos{ano - delta}.xlsx"
        try:
            r = requests.head(url, timeout=20, headers=UA)
            if r.status_code == 200:
                return url
        except Exception:
            continue
    # fallback: parsear pagina e pegar primeiro XLSX
    r = _get("https://anfavea.com.br/site/edicoes-em-excel/", retries=2)
    matches = re.findall(r'href="(https?://anfavea\.com\.br/docs/[^"]+\.xlsx)"', r.text)
    return matches[0] if matches else None

def parse_xlsx(content):
    """Parse das abas com matriz pivotada por ano."""
    from openpyxl import load_workbook
    wb = load_workbook(BytesIO(content), data_only=True, read_only=True)
    print(f"  abas: {wb.sheetnames}")

    by_mes = {}  # {mes_iso: {producao_unidades, vendas_unidades, exportacao_unidades}}

    def encontrar_total(rows, ano):
        """Procura linha 'Total' no bloco do ano e retorna 12 meses."""
        for i, row in enumerate(rows):
            cells = [str(c).strip() if c is not None else "" for c in row]
            # Detectar bloco do ano
            if str(ano) in cells:
                # Proximas linhas: header (Jan/Fev/...) e Total
                for j in range(i, min(i + 8, len(rows))):
                    cells_j = [str(c).strip() if c is not None else "" for c in rows[j]]
                    has_total = any("TOTAL" in c.upper() for c in cells_j[:5])
                    if has_total:
                        nums = []
                        for c in rows[j]:
                            if isinstance(c, (int, float)) and not isinstance(c, bool):
                                if not (-100000 < c < 100000 and float(c).is_integer() and c < 3000 and c > 1990):
                                    nums.append(float(c))
                        if len(nums) >= 12:
                            return nums[:12]
        return None

    # Mapear abas
    for aba in wb.sheetnames:
        nome = aba.upper()
        if "PROD" in nome:
            sheet_kind = "producao"
        elif "EMPLACAM" in nome and "I." in aba:
            sheet_kind = "vendas"
        elif "EXPORT" in nome:
            sheet_kind = "exportacao"
        else:
            continue
        ws = wb[aba]
        rows = list(ws.iter_rows(values_only=True))
        # Detectar todos os anos presentes
        anos_vistos = set()
        for row in rows:
            for c in row:
                try:
                    n = int(c) if isinstance(c, (int, float)) else int(c)
                    if 1957 <= n <= 2050:
                        anos_vistos.add(n)
                except (ValueError, TypeError):
                    pass
        for ano in sorted(anos_vistos):
            doze = encontrar_total(rows, ano)
            if not doze: continue
            for m, v in enumerate(doze, start=1):
                if v and v > 0:
                    mes_iso = f"{ano:04d}-{m:02d}"
                    by_mes.setdefault(mes_iso, {})[f"{sheet_kind}_unidades"] = v
    return [by_mes[m] | {"mes": m} for m in sorted(by_mes.keys())]

def calcular(serie):
    base = {}
    for it in serie:
        if it["mes"].startswith("2019-"):
            for k in ("producao_unidades","vendas_unidades","exportacao_unidades"):
                if it.get(k): base.setdefault(k, []).append(it[k])
    base = {k: (sum(v)/len(v) if v else None) for k, v in base.items()}
    by_mes = {it["mes"]: it for it in serie}
    for it in serie:
        a, m = it["mes"].split("-")
        prev = by_mes.get(f"{int(a)-1:04d}-{m}")
        for k in ("producao_unidades","vendas_unidades","exportacao_unidades"):
            short = k.replace("_unidades", "")
            cur = it.get(k); pv = prev.get(k) if prev else None
            it[f"{short}_var_yoy_pct"] = round((cur/pv - 1)*100, 2) if (cur and pv and pv > 0) else None
            bs = base.get(k)
            it[f"{short}_indice_2019"] = round(cur/bs*100, 2) if (cur and bs and bs > 0) else None
        p = it.get("producao_unidades"); v = it.get("vendas_unidades")
        it["producao_sobre_vendas"] = round(p/v, 3) if (p and v) else None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--soft-fail", action="store_true")
    args = ap.parse_args()
    out_dir = Path(args.out_dir).resolve(); out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "visao_geral_anfavea.json"

    print("== ANFAVEA - XLSX ==")
    try:
        url = localizar_xlsx_atual()
        if not url: raise RuntimeError("URL XLSX nao encontrada")
        print(f"  URL: {url}")
        r = _get(url)
        serie = parse_xlsx(r.content)
        if not serie: raise RuntimeError("XLSX parseado mas serie vazia")
        calcular(serie)
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
        "metadata": {"fonte": "ANFAVEA - siteautoveiculos.xlsx (producao, emplacamento, exportacao)", "nota": "Unidades. Base 2019=100."},
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
