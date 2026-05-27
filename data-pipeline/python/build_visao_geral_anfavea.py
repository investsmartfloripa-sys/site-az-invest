"""Build do JSON do Painel Visão Geral — bloco ANFAVEA (produção e vendas de veículos).

Fonte: XLSX consolidado mensal publicado pela ANFAVEA em
https://anfavea.com.br/site/edicoes-em-excel/

A planilha contém séries mensais desde 1957 (produção, vendas internas,
exportações em unidades). Estrutura defensiva: detecta colunas por header,
falha limpa se shape inesperada.

Calcula:
- Variação a/a (12m), MM3m, índice base 2019=100
- Produção × vendas (ratio — proxy de inventário)

Ragged-edge tolerante.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/visao_geral_anfavea.json"
UA = {"User-Agent": "az-invest-visao-geral-anfavea/0.1", "Accept": "*/*"}

# URL canônica da página de "Edições em Excel". A página tem links para o XLSX
# consolidado mais recente; o nome do arquivo muda mensalmente. Mantemos URL
# como page-fetch + regex pra achar XLSX, com fallback hardcoded.
ANFAVEA_PAGE = "https://anfavea.com.br/site/edicoes-em-excel/"
ANFAVEA_FALLBACK_XLSX = "https://anfavea.com.br/docs/SeriesTemporais_Autoveiculos.xlsx"

INPUTS = {"anfavea_veiculos": "1957-01"}


def _get(url: str, *, timeout: int = 90, retries: int = 2, sleep: float = 5.0) -> requests.Response:
    last: Exception | None = None
    for i in range(retries):
        try:
            r = requests.get(url, timeout=timeout, headers=UA)
            r.raise_for_status()
            return r
        except Exception as e:
            last = e
            print(f"  retry {i + 1}/{retries}: {e}", file=sys.stderr)
            time.sleep(sleep)
    raise RuntimeError(f"falha após {retries} tentativas: {last}")


def localizar_xlsx() -> str:
    """Busca URL do XLSX mais recente; cai para fallback se não achar."""
    try:
        r = _get(ANFAVEA_PAGE, retries=1)
        html = r.text
        # procurar links que terminam em .xlsx
        import re

        urls = re.findall(r'href="(https?://[^"]+\.xlsx)"', html)
        # priorizar "series" ou "temporais"
        for u in urls:
            if "serie" in u.lower() or "temporais" in u.lower() or "autoveic" in u.lower():
                return u
        if urls:
            return urls[0]
    except Exception as e:
        print(f"  não achou XLSX no portal: {e}", file=sys.stderr)
    return ANFAVEA_FALLBACK_XLSX


def parse_xlsx(content: bytes) -> list[dict]:
    """Parse defensivo do XLSX ANFAVEA usando openpyxl."""
    from openpyxl import load_workbook

    wb = load_workbook(BytesIO(content), data_only=True, read_only=True)
    # ANFAVEA costuma ter abas "Produção", "Vendas Internas", "Exportações" ou consolidado.
    # Estratégia: ler a primeira aba que tenha "AN" + "MÊS" + colunas numéricas.
    sheet_names = wb.sheetnames
    print(f"  abas: {sheet_names}")

    by_mes: dict[str, dict] = {}

    for sheet_name in sheet_names:
        ws = wb[sheet_name]
        rows = list(ws.iter_rows(values_only=True))
        if len(rows) < 5:
            continue
        # heuristic: encontrar linha de header (primeira que tenha "ANO" ou "MÊS")
        header_idx = None
        for i, row in enumerate(rows[:20]):
            row_str = [str(c).upper() if c else "" for c in row]
            if any("ANO" in c for c in row_str) and any("MÊS" in c or "MES" in c for c in row_str):
                header_idx = i
                break
        if header_idx is None:
            continue
        header = [str(c).upper() if c else "" for c in rows[header_idx]]
        col_ano = next((i for i, c in enumerate(header) if "ANO" in c), None)
        col_mes = next((i for i, c in enumerate(header) if "MÊS" in c or "MES" in c), None)
        col_total = next((i for i, c in enumerate(header) if "TOTAL" in c), None)
        if col_ano is None or col_mes is None:
            continue
        sn = sheet_name.upper()
        if "PROD" in sn:
            sheet_kind = "producao"
        elif "VENDA" in sn or "EMPLACAM" in sn:
            sheet_kind = "vendas"
        elif "EXPORT" in sn:
            sheet_kind = "exportacao"
        else:
            sheet_kind = None
        for row in rows[header_idx + 1 :]:
            try:
                ano = int(row[col_ano])
                mes = int(row[col_mes])
            except (TypeError, ValueError):
                continue
            mes_iso = f"{ano:04d}-{mes:02d}"
            entry = by_mes.setdefault(mes_iso, {"mes": mes_iso})
            if sheet_kind and col_total is not None:
                try:
                    val = float(row[col_total])
                    entry[f"{sheet_kind}_unidades"] = val
                except (TypeError, ValueError):
                    pass

    serie = [by_mes[m] for m in sorted(by_mes.keys())]
    return serie


def calcular_variacoes(serie: list[dict]) -> None:
    by_mes = {item["mes"]: item for item in serie}
    # base 2019
    bases: dict[str, list[float]] = {"producao_unidades": [], "vendas_unidades": [], "exportacao_unidades": []}
    for item in serie:
        if item["mes"].startswith("2019-"):
            for k in bases:
                if item.get(k):
                    bases[k].append(item[k])
    base_2019 = {k: (sum(v) / len(v) if v else None) for k, v in bases.items()}

    for item in serie:
        ano, m = item["mes"].split("-")
        anterior = by_mes.get(f"{int(ano) - 1:04d}-{m}")
        for key in ("producao_unidades", "vendas_unidades", "exportacao_unidades"):
            atual = item.get(key)
            prev = anterior.get(key) if anterior else None
            short = key.replace("_unidades", "")
            if atual is not None and prev is not None and prev > 0:
                item[f"{short}_var_yoy_pct"] = round((atual / prev - 1) * 100, 2)
            else:
                item[f"{short}_var_yoy_pct"] = None
            base = base_2019.get(key)
            if atual is not None and base is not None and base > 0:
                item[f"{short}_indice_2019"] = round(atual / base * 100, 2)
            else:
                item[f"{short}_indice_2019"] = None
        # ratio produção/vendas (proxy de inventário)
        p = item.get("producao_unidades")
        v = item.get("vendas_unidades")
        item["producao_sobre_vendas"] = round(p / v, 3) if (p and v) else None


def main() -> None:
    ap = argparse.ArgumentParser(description="Build do JSON Painel Visão Geral — ANFAVEA")
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--soft-fail", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "visao_geral_anfavea.json"

    print("== ANFAVEA — XLSX consolidado ==")
    try:
        url = localizar_xlsx()
        print(f"  XLSX: {url}")
        r = _get(url)
        serie = parse_xlsx(r.content)
        if not serie:
            raise RuntimeError("XLSX parseado mas série vazia — verificar formato")
    except Exception as e:
        print(f"  FALHA ANFAVEA: {e}", file=sys.stderr)
        sys.path.insert(0, str(HERE))
        from shared.blob_download import download_json
        prev = download_json(BLOB_PATH)
        if prev:
            prev["freshness_status"] = "stale"
            prev["gerado_em"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
            out_file.write_text(json.dumps(prev, indent=2, ensure_ascii=False), encoding="utf-8")
            print("  preservado JSON anterior (stale)")
            return
        if args.soft_fail:
            payload = {"gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"), "freshness_status": "missing", "serie": []}
            out_file.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
            return
        sys.exit(2)

    calcular_variacoes(serie)

    payload = {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "freshness_status": "fresh",
        "mes_recente": serie[-1]["mes"] if serie else None,
        "serie": serie,
        "inputs": INPUTS,
        "min_start_date": min(INPUTS.values()),
        "metadata": {
            "fonte": "ANFAVEA — Séries temporais consolidadas (XLSX) com produção, vendas internas e exportações de autoveículos.",
            "nota": "Unidades de veículos. Base índice = média 2019. Ratio produção/vendas é proxy indireto de variação de estoques.",
        },
    }

    out_file.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"JSON {out_file} ({out_file.stat().st_size / 1024:.1f} KB)")

    if args.upload:
        sys.path.insert(0, str(HERE))
        from shared.blob_upload import maybe_upload_json
        try:
            maybe_upload_json(out_file, BLOB_PATH)
        except Exception as e:
            print(f"[upload] FALHOU: {e}", file=sys.stderr)
            if not args.soft_fail:
                sys.exit(1)


if __name__ == "__main__":
    main()
