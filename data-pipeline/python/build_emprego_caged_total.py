"""Build do JSON do Painel Emprego — bloco CAGED total (saldo nacional).

Baixa do IPEADATA 3 séries mensais consolidadas (já com revisões do MTE):
- CAGED12_SALDON12 — Saldo
- CAGED12_ADMISN12 — Admissões
- CAGED12_DESLIGN12 — Demissões

Calcula média móvel 12 meses do saldo.

Gera `data-pipeline/out/emprego_caged_total.json` e upload pra Vercel Blob em `data/emprego_caged_total.json`.
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
BLOB_PATH = "data/emprego_caged_total.json"

UA = {"User-Agent": "az-invest-emprego-caged-total/0.1"}
IPEADATA_URL = "http://www.ipeadata.gov.br/api/odata4/ValoresSerie(SERCODIGO='{cod}')"

SERIES = {
    "saldo": "CAGED12_SALDON12",
    "admissoes": "CAGED12_ADMISN12",
    "demissoes": "CAGED12_DESLIGN12",
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
    if v in ("", None):
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def ipeadata_fetch(cod: str) -> dict[str, float | None]:
    """Devolve dict {YYYY-MM: valor}."""
    url = IPEADATA_URL.format(cod=cod)
    print(f"  [IPEADATA] {url}")
    data = _get(url).json().get("value", [])
    out: dict[str, float | None] = {}
    for r in data:
        mes = (r.get("VALDATA") or "")[:7]  # '2026-03-01T...' -> '2026-03'
        if mes:
            out[mes] = _to_float(r.get("VALVALOR"))
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description="Build do JSON Painel Emprego — CAGED total")
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "emprego_caged_total.json"

    print("== CAGED total (IPEADATA) ==")
    series_data: dict[str, dict[str, float | None]] = {}
    for k, cod in SERIES.items():
        series_data[k] = ipeadata_fetch(cod)
        print(f"  {k} ({cod}): {len(series_data[k])} pontos")

    meses = sorted(set().union(*[set(d.keys()) for d in series_data.values()]))
    if not meses:
        print("ERRO: nenhuma série IPEADATA disponível, abortando", file=sys.stderr)
        sys.exit(2)

    serie = [
        {
            "mes": m,
            "saldo": series_data["saldo"].get(m),
            "admissoes": series_data["admissoes"].get(m),
            "demissoes": series_data["demissoes"].get(m),
        }
        for m in meses
    ]
    # Média móvel 12m do saldo
    for i, item in enumerate(serie):
        janela = [x["saldo"] for x in serie[max(0, i - 11) : i + 1] if x["saldo"] is not None]
        item["saldo_mm12"] = round(sum(janela) / len(janela), 0) if len(janela) >= 12 else None

    # ── v2: dessazonalização PRÓPRIA via STL (robust=True trata os outliers de 2020;
    # não existe SA oficial do CAGED). MM3 da série SA = momentum canônico de research —
    # a MM12 atrasa viradas em ~6 meses. Fluxo → decomposição aditiva (STL é aditiva).
    for item in serie:
        item["saldo_sa"] = None
        item["saldo_sa_mm3"] = None
    saldo_vals = [x["saldo"] for x in serie]
    if all(v is not None for v in saldo_vals) and len(saldo_vals) >= 36:
        try:
            import pandas as pd
            from statsmodels.tsa.seasonal import STL

            idx = pd.period_range(serie[0]["mes"], periods=len(serie), freq="M").to_timestamp()
            s = pd.Series([float(v) for v in saldo_vals], index=idx)
            res = STL(s, period=12, robust=True).fit()
            sa = s - res.seasonal
            for i, item in enumerate(serie):
                item["saldo_sa"] = round(float(sa.iloc[i]), 0)
            for i, item in enumerate(serie):
                if i >= 2:
                    jan = [serie[j]["saldo_sa"] for j in range(i - 2, i + 1)]
                    item["saldo_sa_mm3"] = round(sum(jan) / 3, 0)
            print(f"  [v2] STL ok | saldo_sa: {serie[-1]['saldo_sa']:+,.0f} | mm3 SA: {serie[-1]['saldo_sa_mm3']:+,.0f}")
        except Exception as e:
            print(f"  [WARN] STL indisponível ({e}) — saldo_sa fica nulo nesta rodada", file=sys.stderr)
    else:
        print("  [WARN] série com buracos ou curta demais p/ STL — saldo_sa nulo", file=sys.stderr)

    out = {
        "schema_version": 2,
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "mes_recente": serie[-1]["mes"],
        "serie": serie,
        "metadata": {
            "fonte": "IPEADATA — séries CAGED12_SALDON12 / _ADMISN12 / _DESLIGN12 (saldo consolidado MTE com revisões)",
            "nota": "Saldo nacional do Novo CAGED desde jan/2020. IPEADATA capta o consolidado oficial após revisões via CAGEDFOR/CAGEDEXC. saldo_sa/saldo_sa_mm3 (v2): dessazonalização PRÓPRIA (STL robusta, modelo aditivo) — não existe SA oficial do CAGED; divergências vs números SA de terceiros são esperadas.",
        },
    }

    out_file.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nJSON salvo em {out_file} ({out_file.stat().st_size/1024:.1f} KB)")
    print(f"Último mês: {serie[-1]['mes']}, saldo {serie[-1]['saldo']:+,.0f}")

    if args.upload:
        try:
            sys.path.insert(0, str(HERE))
            from shared.blob_upload import maybe_upload_json
            maybe_upload_json(out_file, BLOB_PATH)
        except Exception as e:
            print(f"[upload] FALHOU: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        print("[upload] SKIP")


if __name__ == "__main__":
    main()
