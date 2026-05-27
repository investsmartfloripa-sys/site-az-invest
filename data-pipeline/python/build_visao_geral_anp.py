"""Build do JSON do Painel Visão Geral — bloco Vendas de Combustíveis (ANP).

Fonte: API Open Data ANP — séries históricas mensais de vendas de derivados.
Dados em m³ por UF/produto. Agregamos para Brasil-total e calculamos:
- Total de combustíveis líquidos (gasolina C + etanol hidratado + diesel S10/S500)
- Ciclo Otto (gasolina C + etanol hidratado) — proxy de consumo das famílias
- Diesel (S10 + S500) — proxy de atividade econômica/logística
- Querosene de aviação (QAV) — proxy de turismo/aviação

Calcula:
- Variação a/a (12m), MM3m, índice base 100 = média 2019

Ragged-edge tolerante. Se a ANP indisponível, preserva JSON anterior.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/visao_geral_anp.json"
UA = {"User-Agent": "az-invest-visao-geral-anp/0.1"}

# Endpoint dos dados abertos ANP (CSV agregado mensal Brasil-total publicado pela ANP).
# Como a estrutura muda às vezes, vamos usar uma URL conhecida (vendas de combustíveis).
# Documentação: https://dados.gov.br/dados/conjuntos-dados/vendas-de-derivados-de-petroleo-e-biocombustiveis
ANP_CSV_URL = "https://dados.gov.br/api/publico/conjuntos-dados/vendas-de-derivados-de-petroleo-e-biocombustiveis"

# Fallback: dataset CSV histórico já publicado pela ANP (vendas mensais por UF/produto)
ANP_FALLBACK_URL = (
    "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/arquivos/vdpb/vendas-anuais-de-derivados-de-petroleo-e-biocombustiveis/dados-abertos-vendas-derivados-petroleo-biocombustiveis-2000-2024.csv"
)

INPUTS = {"anp_combustiveis": "2000-01"}


def _get(url: str, *, timeout: int = 120, retries: int = 2, sleep: float = 5.0) -> requests.Response:
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


def parse_anp_csv(text: str) -> dict[str, dict[str, float]]:
    """Parse CSV ANP — colunas tipicamente: ANO;MES;UF;PRODUTO;UNIDADE;VENDAS.

    Retorna {mes_iso: {produto: m3_total_brasil}}.
    """
    lines = text.splitlines()
    if len(lines) < 2:
        return {}
    sep = ";" if ";" in lines[0] else ","
    header = [h.strip().strip('"').upper() for h in lines[0].split(sep)]
    # detectar colunas necessárias
    col_ano = next((i for i, h in enumerate(header) if h in ("ANO", "YEAR")), None)
    col_mes = next((i for i, h in enumerate(header) if h in ("MES", "MÊS", "MONTH")), None)
    col_prod = next((i for i, h in enumerate(header) if "PRODUTO" in h or "PRODUCT" in h), None)
    col_vendas = next((i for i, h in enumerate(header) if "VENDA" in h or "VOLUME" in h), None)
    if None in (col_ano, col_mes, col_prod, col_vendas):
        print(f"  header inesperado: {header}", file=sys.stderr)
        return {}

    out: dict[str, dict[str, float]] = {}
    for line in lines[1:]:
        parts = [p.strip().strip('"') for p in line.split(sep)]
        if len(parts) <= max(col_ano, col_mes, col_prod, col_vendas):
            continue
        try:
            ano = int(parts[col_ano])
            mes = int(parts[col_mes])
            prod = parts[col_prod].upper()
            vendas = float(parts[col_vendas].replace(",", "."))
        except ValueError:
            continue
        mes_iso = f"{ano:04d}-{mes:02d}"
        out.setdefault(mes_iso, {})
        out[mes_iso][prod] = out[mes_iso].get(prod, 0.0) + vendas
    return out


def normalizar_produto(produto: str) -> str | None:
    p = produto.upper()
    if "ETANOL HIDR" in p:
        return "etanol_hidratado"
    if "GASOLINA C" in p or p == "GASOLINA":
        return "gasolina_c"
    if "DIESEL" in p and ("S10" in p or "S500" in p or "S 10" in p or "S 500" in p):
        return "diesel"
    if "DIESEL" in p:
        return "diesel"
    if "QUEROSENE" in p and "AVIA" in p:
        return "qav"
    return None


def agregar(dados_brutos: dict[str, dict[str, float]]) -> list[dict]:
    """Agrega produtos similares e calcula categorias compostas."""
    serie: list[dict] = []
    for mes in sorted(dados_brutos.keys()):
        ag: dict[str, float] = {"gasolina_c": 0, "etanol_hidratado": 0, "diesel": 0, "qav": 0}
        for produto, vol in dados_brutos[mes].items():
            cat = normalizar_produto(produto)
            if cat:
                ag[cat] += vol
        ciclo_otto = ag["gasolina_c"] + ag["etanol_hidratado"]
        total = ciclo_otto + ag["diesel"]
        serie.append(
            {
                "mes": mes,
                "gasolina_c_m3": round(ag["gasolina_c"], 0),
                "etanol_hidratado_m3": round(ag["etanol_hidratado"], 0),
                "diesel_m3": round(ag["diesel"], 0),
                "qav_m3": round(ag["qav"], 0),
                "ciclo_otto_m3": round(ciclo_otto, 0),
                "total_liquidos_m3": round(total, 0),
            }
        )
    return serie


def calcular_variacoes(serie: list[dict]) -> None:
    """Adiciona var_yoy, mm3m e indice_2019=100 in-place."""
    # Base 2019 = média 2019
    valores_2019 = {k: [] for k in ("gasolina_c_m3", "etanol_hidratado_m3", "diesel_m3", "ciclo_otto_m3", "total_liquidos_m3", "qav_m3")}
    for item in serie:
        if item["mes"].startswith("2019-"):
            for k in valores_2019:
                if item.get(k):
                    valores_2019[k].append(item[k])
    bases = {k: (sum(v) / len(v) if v else None) for k, v in valores_2019.items()}

    by_mes = {item["mes"]: item for item in serie}
    for i, item in enumerate(serie):
        mes = item["mes"]
        ano, m = mes.split("-")
        anterior = by_mes.get(f"{int(ano) - 1:04d}-{m}")
        for key in ("gasolina_c_m3", "etanol_hidratado_m3", "diesel_m3", "ciclo_otto_m3", "total_liquidos_m3", "qav_m3"):
            atual = item.get(key)
            prev = anterior.get(key) if anterior else None
            if atual is not None and prev is not None and prev > 0:
                item[f"{key.replace('_m3','')}_var_yoy_pct"] = round((atual / prev - 1) * 100, 2)
            else:
                item[f"{key.replace('_m3','')}_var_yoy_pct"] = None
            base = bases.get(key)
            if atual is not None and base is not None and base > 0:
                item[f"{key.replace('_m3','')}_indice_2019"] = round(atual / base * 100, 2)
            else:
                item[f"{key.replace('_m3','')}_indice_2019"] = None


def main() -> None:
    ap = argparse.ArgumentParser(description="Build do JSON Painel Visão Geral — ANP combustíveis")
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--soft-fail", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "visao_geral_anp.json"

    print("== ANP — vendas de combustíveis ==")

    try:
        r = _get(ANP_FALLBACK_URL)
        # tentar decodificar latin-1 (ANP costuma)
        try:
            text = r.content.decode("utf-8")
        except UnicodeDecodeError:
            text = r.content.decode("latin-1")
        dados_brutos = parse_anp_csv(text)
        if not dados_brutos:
            raise RuntimeError("CSV ANP retornou estrutura inesperada")
        print(f"  {len(dados_brutos)} meses lidos")
    except Exception as e:
        print(f"  FALHA ANP: {e}", file=sys.stderr)
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

    serie = agregar(dados_brutos)
    calcular_variacoes(serie)

    payload = {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "freshness_status": "fresh",
        "mes_recente": serie[-1]["mes"] if serie else None,
        "serie": serie,
        "inputs": INPUTS,
        "min_start_date": min(INPUTS.values()),
        "metadata": {
            "fonte": "ANP — Vendas de derivados de petróleo e biocombustíveis (m³), agregação Brasil-total.",
            "nota": "Base índice = média 2019. Ciclo Otto = gasolina C + etanol hidratado (consumo famílias). Diesel = atividade econômica/logística.",
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
