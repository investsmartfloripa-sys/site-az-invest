"""Build do JSON do Painel Visão Geral — bloco OECD CLI Brasil.

OECD Composite Leading Indicator amplitude-adjusted (`BRALOLITOAASTSAM`).
Fonte: SDMX REST do OECD.Stat. Sem auth. Mensal, defasagem ~2 meses.

Calcula:
- Nível do CLI (linha de tendência 100)
- Variação 6m anualizada (momentum — sinal leading verdadeiro)
- Quadrante do "Relógio do Ciclo": expansão (>100, subindo),
  desaceleração (>100, caindo), recessão (<100, caindo), recuperação (<100, subindo)

Gera `data-pipeline/out/visao_geral_oecd_cli.json` e upload para Vercel Blob
em `data/visao_geral_oecd_cli.json`.

Ragged-edge tolerante: se a OECD falhar, preserva JSON anterior do Blob
(`freshness_status: 'stale'`).
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
BLOB_PATH = "data/visao_geral_oecd_cli.json"
UA = {"User-Agent": "az-invest-visao-geral-oecd/0.1", "Accept": "application/vnd.sdmx.data+csv;version=1.0.0"}

# OECD SDMX REST — CLI Brazil, amplitude-adjusted, monthly
# Reference: https://sdmx.oecd.org/public/rest/data/OECD.SDD.STES,DSD_STES@DF_CLI/BRA.....M/
OECD_URL = (
    "https://sdmx.oecd.org/public/rest/data/OECD.SDD.STES,DSD_STES@DF_CLI/BRA.M.LI..AA...."
    "?dimensionAtObservation=AllDimensions&format=csvfilewithlabels"
)
# Fallback via FRED (BRALOLITOAASTSAM) caso OECD SDMX bloqueie por user-agent
FRED_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=BRALOLITOAASTSAM"

INPUTS = {"oecd_cli_bra": "1989-01"}  # série começa em 1989


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


def _parse_oecd_csv(text: str) -> dict[str, float]:
    """Parse SDMX CSV — colunas dependem da query. Procura coluna TIME_PERIOD/OBS_VALUE."""
    lines = text.strip().split("\n")
    if len(lines) < 2:
        return {}
    header = [h.strip().strip('"') for h in lines[0].split(",")]
    try:
        idx_time = header.index("TIME_PERIOD")
        idx_val = header.index("OBS_VALUE")
    except ValueError:
        print(f"  header OECD inesperado: {header[:8]}", file=sys.stderr)
        return {}
    out: dict[str, float] = {}
    for line in lines[1:]:
        parts = [p.strip().strip('"') for p in line.split(",")]
        if len(parts) <= max(idx_time, idx_val):
            continue
        t, v = parts[idx_time], parts[idx_val]
        if not t or not v:
            continue
        # TIME_PERIOD pode ser "2026-04" ou "2026-04-01"
        mes = t[:7]
        try:
            out[mes] = float(v)
        except ValueError:
            continue
    return out


def _parse_fred_csv(text: str) -> dict[str, float]:
    lines = text.strip().split("\n")
    out: dict[str, float] = {}
    for line in lines[1:]:
        parts = line.split(",")
        if len(parts) < 2:
            continue
        d, v = parts[0].strip(), parts[1].strip()
        if v in (".", "", "NaN"):
            continue
        try:
            out[d[:7]] = float(v)
        except ValueError:
            continue
    return out


def fetch_oecd_cli() -> dict[str, float]:
    try:
        print("  [OECD SDMX] tentando…")
        r = _get(OECD_URL, retries=2)
        data = _parse_oecd_csv(r.text)
        if data:
            return data
    except Exception as e:
        print(f"  OECD SDMX falhou: {e}", file=sys.stderr)
    print("  [FRED] fallback…")
    r = _get(FRED_URL, retries=2)
    return _parse_fred_csv(r.text)


def quadrante(nivel: float | None, mom6_anualizado: float | None) -> str | None:
    if nivel is None or mom6_anualizado is None:
        return None
    if nivel >= 100 and mom6_anualizado >= 0:
        return "expansao"
    if nivel >= 100 and mom6_anualizado < 0:
        return "desaceleracao"
    if nivel < 100 and mom6_anualizado < 0:
        return "recessao"
    return "recuperacao"


def build_payload(serie_dict: dict[str, float]) -> dict:
    meses = sorted(serie_dict.keys())
    serie = []
    for i, m in enumerate(meses):
        nivel = serie_dict[m]
        # variação 6m anualizada = (X_t / X_{t-6})^2 - 1 (em %)
        prev6 = serie_dict.get(meses[i - 6]) if i >= 6 else None
        mom6_anual = round(((nivel / prev6) ** 2 - 1) * 100, 2) if (prev6 and prev6 > 0) else None
        prev12 = serie_dict.get(meses[i - 12]) if i >= 12 else None
        yoy = round((nivel / prev12 - 1) * 100, 2) if (prev12 and prev12 > 0) else None
        serie.append(
            {
                "mes": m,
                "nivel": round(nivel, 3),
                "var_6m_anualizada": mom6_anual,
                "var_yoy": yoy,
                "quadrante": quadrante(nivel, mom6_anual),
            }
        )

    ultimo = serie[-1] if serie else {}
    return {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "freshness_status": "fresh",
        "mes_recente": ultimo.get("mes"),
        "serie": serie,
        "inputs": INPUTS,
        "min_start_date": min(INPUTS.values()),
        "destaques": {
            "nivel_recente": ultimo.get("nivel"),
            "var_6m_anualizada_recente": ultimo.get("var_6m_anualizada"),
            "quadrante_recente": ultimo.get("quadrante"),
        },
        "metadata": {
            "fonte": "OECD.Stat — Composite Leading Indicator Brazil, amplitude-adjusted (BRALOLITOAASTSAM)",
            "nota": "Linha 100 = tendência. Variação 6m anualizada é o leading 'verdadeiro'. Defasagem típica ~2 meses.",
        },
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="Build do JSON Painel Visão Geral — OECD CLI")
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--soft-fail", action="store_true", help="se OECD falhar, retorna JSON 'stale' baseado no Blob anterior em vez de exit 2")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "visao_geral_oecd_cli.json"

    print("== OECD CLI Brasil ==")
    try:
        serie = fetch_oecd_cli()
    except Exception as e:
        print(f"ERRO OECD/FRED: {e}", file=sys.stderr)
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

    print(f"  {len(serie)} observações")
    payload = build_payload(serie)
    out_file.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"JSON {out_file} ({out_file.stat().st_size / 1024:.1f} KB) — mês recente {payload['mes_recente']}")

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
