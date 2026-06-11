"""Build do JSON do Painel Famílias — bloco Renda.

Consome:
- IBGE/SIDRA PNAD Contínua Trimestral:
  - Tabela 6390 (rendimento médio mensal habitualmente recebido em todos os trabalhos)
    var 5933 (real, R$ correntes do mês de divulgação), 5929 (nominal),
    8837 (var % ano anterior, real), 8826 (var % ano anterior, nominal)
  - Tabela 6389 (rendimento médio por posição na ocupação no trabalho principal — real)
    var 5933, classificação 12030 (posição na ocupação)
- BCB SGS:
  - 1619: salário mínimo nominal (R$)
- Ipeadata API OData4:
  - GAC12_SALMINRE12: salário mínimo real (R$ deflacionados — mês de referência IPEA)
  - MTE12_SALMIN12: salário mínimo nominal (cross-check)

Gera `data-pipeline/out/familias_renda.json` e upload pra `data/familias_renda.json`.

Cron diário (PNAD trimestral atualiza ~45 dias após fim do trimestre).
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

HERE = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/familias_renda.json"

UA = {"User-Agent": "az-invest-familias-renda/0.1"}
SIDRA_BASE = "https://apisidra.ibge.gov.br/values"
SGS_BASE = "https://api.bcb.gov.br/dados/serie/bcdata.sgs"
IPEA_BASE = "http://www.ipeadata.gov.br/api/odata4/ValoresSerie"

# Variáveis SIDRA Tabela 6390
# (todos os trabalhos — rendimento médio mensal habitualmente recebido)
VARS_6390 = {
    "5933": "rendimento_medio_real",          # R$ (preços do trimestre divulgado)
    "5929": "rendimento_medio_nominal",       # R$
    "8837": "var_pct_aa_real",                # % vs mesmo trim ano anterior
    "8826": "var_pct_aa_nominal",             # % vs mesmo trim ano anterior nominal
}

# Posição na ocupação (Tabela 6389 — variável 5932, classificação 11913)
POSICAO_CATS_6389 = {
    "96165": "total",
    "31722": "empregado_privado_com_carteira",
    "31723": "empregado_privado_sem_carteira",
    "31724": "trabalhador_domestico",
    "31727": "empregado_publico",
    "96170": "empregador",
    "96171": "conta_propria",
}


def _get(url: str, *, timeout: int = 60, retries: int = 3, sleep: float = 3.0) -> requests.Response:
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


def _to_float(v: Any) -> float | None:
    if v in ("", "-", "..", "...", None):
        return None
    try:
        return float(str(v).replace(",", "."))
    except (TypeError, ValueError):
        return None


def _br_date_to_iso(d: str) -> str:
    try:
        dd, mm, yy = d.split("/")
        return f"{yy}-{mm.zfill(2)}-{dd.zfill(2)}"
    except Exception:
        return d


def _parse_trim(s: str) -> str:
    """'202602' -> '2026-02' (rotulo unico por trimestre movel)."""
    if not s or len(s) < 6:
        return s
    return f"{s[:4]}-{s[4:6]}"


def sidra_fetch(tabela: int, path: str) -> list[dict]:
    url = f"{SIDRA_BASE}/t/{tabela}{path}"
    print(f"  [SIDRA {tabela}] {url}")
    data = _get(url).json()
    if not data:
        return []
    header = data[0]
    return [{header.get(k, k): v for k, v in item.items()} for item in data[1:]]


def _periodo_path(periodos: int) -> str:
    """Trecho /p/ da URL SIDRA: 0 ou negativo = tudo disponível; N>0 = últimos N períodos.

    ATENÇÃO: nas tabelas 6390/6389 o período é o TRIMESTRE MÓVEL mensal — 'last 30'
    significa 30 MESES (~2,5 anos), não 30 trimestres. A série completa começa em 2012-03.
    """
    return "all" if periodos <= 0 else f"last%20{periodos}"


def carrega_renda_total(periodos: int = 0) -> list[dict]:
    """Tabela 6390: rendimento médio (real e nominal) trimestre móvel."""
    vars_csv = ",".join(VARS_6390.keys())
    rows = sidra_fetch(6390, f"/n1/all/v/{vars_csv}/p/{_periodo_path(periodos)}")
    por_trim: dict[str, dict] = {}
    for r in rows:
        var_cod = r.get("Variável (Código)")
        if var_cod not in VARS_6390:
            continue
        trim = _parse_trim(r.get("Trimestre Móvel (Código)") or r.get("Trimestre (Código)") or "")
        if not trim:
            continue
        por_trim.setdefault(trim, {"trim": trim})[VARS_6390[var_cod]] = _to_float(r.get("Valor"))
    return [v for _, v in sorted(por_trim.items())]


def carrega_renda_posicao(periodos: int = 0) -> list[dict]:
    """Tabela 6389: rendimento médio real por posição na ocupação (var 5932, class 11913)."""
    cats_csv = ",".join(POSICAO_CATS_6389.keys())
    rows = sidra_fetch(6389, f"/n1/all/v/5932/p/{_periodo_path(periodos)}/c11913/{cats_csv}")
    por_trim: dict[str, dict] = {}
    # Tenta achar a coluna correta (varia entre 'Posição na ocupação...' diferentes labels)
    for r in rows:
        cat_cod = None
        for key in r:
            if "Posição na ocupação" in key and "Código" in key:
                cat_cod = r[key]
                break
        if cat_cod is None or cat_cod not in POSICAO_CATS_6389:
            continue
        trim = _parse_trim(r.get("Trimestre Móvel (Código)") or r.get("Trimestre (Código)") or "")
        if not trim:
            continue
        por_trim.setdefault(trim, {"trim": trim})[POSICAO_CATS_6389[cat_cod]] = _to_float(r.get("Valor"))
    return [v for _, v in sorted(por_trim.items())]


def sgs_serie(code: int) -> dict[str, float | None]:
    url = f"{SGS_BASE}.{code}/dados?formato=json"
    print(f"  [SGS {code}] {url}")
    try:
        rows = _get(url).json()
    except Exception as e:
        print(f"  [SGS {code}] FAIL: {e}", file=sys.stderr)
        return {}
    out: dict[str, float | None] = {}
    for r in rows:
        d = _br_date_to_iso(r.get("data", ""))
        v = _to_float(r.get("valor"))
        if d:
            out[d] = v
    return out


def ipea_serie(serid: str) -> dict[str, float | None]:
    url = f"{IPEA_BASE}(SERCODIGO='{serid}')"
    print(f"  [IPEA {serid}] {url}")
    try:
        rows = _get(url, timeout=90).json().get("value", [])
    except Exception as e:
        print(f"  [IPEA {serid}] FAIL: {e}", file=sys.stderr)
        return {}
    out: dict[str, float | None] = {}
    for r in rows:
        d_raw = r.get("VALDATA", "")
        v_raw = r.get("VALVALOR")
        if not d_raw or v_raw is None:
            continue
        # VALDATA = '2026-04-01T00:00:00-03:00'
        d = d_raw[:10]
        try:
            out[d] = float(v_raw)
        except (TypeError, ValueError):
            out[d] = None
    return out


def last_with_value(serie: dict[str, float | None]) -> tuple[str | None, float | None]:
    keys = [k for k in sorted(serie.keys()) if serie.get(k) is not None]
    if not keys:
        return None, None
    return keys[-1], serie[keys[-1]]


def serie_dict_to_pontos(serie: dict[str, float | None]) -> list[dict]:
    return [{"data": k, "valor": v} for k, v in sorted(serie.items()) if v is not None]


def main() -> None:
    ap = argparse.ArgumentParser(description="Build do JSON Painel Famílias — Renda")
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    ap.add_argument(
        "--periodos", type=int, default=0,
        help="Quantos períodos (meses de trimestre móvel) puxar do SIDRA. "
             "0 = tudo disponível (desde 2012-03, ~170 períodos). "
             "Nota: a tabela é de trimestre MÓVEL mensal — 30 = 30 meses, não 30 trimestres.",
    )
    ap.add_argument("--no-merge", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "familias_renda.json"

    # ---- Coleta ----
    print("== SIDRA PNAD 6390 (rendimento médio real e nominal) ==")
    renda_total = carrega_renda_total(args.periodos)
    print(f"  {len(renda_total)} trimestres móveis")

    print("== SIDRA PNAD 6389 (rendimento por posição) ==")
    renda_posicao = carrega_renda_posicao(args.periodos)
    print(f"  {len(renda_posicao)} trimestres móveis")

    print("== BCB SGS 1619 (salário mínimo nominal) ==")
    sal_min_nominal = sgs_serie(1619)
    time.sleep(0.4)

    print("== Ipeadata GAC12_SALMINRE12 (salário mínimo real) ==")
    sal_min_real = ipea_serie("GAC12_SALMINRE12")

    # ---- Merge incremental (opcional) ----
    prev_payload = None
    if not args.no_merge:
        try:
            sys.path.insert(0, str(HERE))
            from shared.blob_download import download_json
            prev_payload = download_json(BLOB_PATH)
            if prev_payload:
                print(f"  [merge] Blob anterior gerado_em {prev_payload.get('gerado_em','?')}")
        except Exception as e:
            print(f"  [merge] WARN: {e}", file=sys.stderr)

    # ---- Hero KPIs ----
    renda_real_ultimo = renda_total[-1] if renda_total else {}
    renda_real_kpi = {
        "trim": renda_real_ultimo.get("trim"),
        "valor": renda_real_ultimo.get("rendimento_medio_real"),
        "var_pct_aa_real": renda_real_ultimo.get("var_pct_aa_real"),
        "unidade": "R$ por mês (preços do trimestre)",
    }

    k_smn, v_smn = last_with_value(sal_min_nominal)
    k_smr, v_smr = last_with_value(sal_min_real)

    hero = {
        "renda_real": renda_real_kpi,
        "salario_minimo_nominal": {"data": k_smn, "valor": v_smn, "unidade": "R$"},
        "salario_minimo_real": {"data": k_smr, "valor": v_smr, "unidade": "R$ (preços do mês mais recente)"},
    }

    # ---- Output ----
    payload = {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "trim_recente": renda_real_ultimo.get("trim"),
        "fonte_principal": "IBGE/SIDRA — PNAD Contínua Trimestral; BCB SGS; Ipeadata",
        "hero": hero,
        "bloco_renda_total": {
            "serie": renda_total,
            "vars": VARS_6390,
            "sidra_tabela": 6390,
        },
        "bloco_renda_posicao": {
            "serie": renda_posicao,
            "vars": POSICAO_CATS_6389,
            "sidra_tabela": 6389,
        },
        "bloco_salario_minimo": {
            "nominal_serie": serie_dict_to_pontos(sal_min_nominal),
            "real_serie": serie_dict_to_pontos(sal_min_real),
            "fontes": {
                "nominal": "BCB SGS 1619 (Salário mínimo Lei)",
                "real": "Ipeadata GAC12_SALMINRE12 (deflacionado INPC)",
            },
        },
        "metadata": {
            "fonte": "PNAD Contínua Trimestral (IBGE), BCB SGS, Ipeadata",
            "nota": (
                "Rendimento PNAD é trimestre móvel (ex: 'dez-jan-fev 2026' codificado YYYYMM, último mês). "
                "Real = deflacionado pelo IBGE com base no INPC, valores em R$ do trimestre de divulgação."
            ),
            "defasagem_publicacao": "~45 dias após o fim do trimestre móvel (PNAD); 1 mês (SGS 1619); 30-60 dias (Ipeadata).",
        },
    }

    out_file.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    size_kb = out_file.stat().st_size / 1024
    print(f"\nGerado {out_file} ({size_kb:.1f} KB)")
    if renda_real_kpi.get("valor"):
        v = renda_real_kpi["valor"]
        t = renda_real_kpi["trim"]
        print(f"  Hero renda real: R$ {v:.0f} ({t})")
    if v_smr:
        print(f"  Hero salario minimo real: R$ {v_smr:.2f} ({k_smr})")
    if v_smn:
        print(f"  Hero salario minimo nominal: R$ {v_smn:.2f} ({k_smn})")
    if args.upload:
        try:
            from shared.blob_upload import maybe_upload_json
            maybe_upload_json(out_file, BLOB_PATH)
        except Exception as e:
            print(f"[upload] FAIL: {e}", file=sys.stderr)
            sys.exit(3)

if __name__ == "__main__":
    main()
