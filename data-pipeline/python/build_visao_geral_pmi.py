"""Build do JSON do Painel Visao Geral - bloco PMI Brasil.

S&P Global publica headlines mensais gratuitos do PMI Brasil:
- Manufatura (dia 1 de cada mes)
- Servicos (dia 3-5)
- Composto (dia 3-5)

Serie historica completa e licenciada (LSEG). Aqui pegamos apenas o valor
mais recente via scraping dos press-releases publicos.

Estrategia: buscar pagina central de PMI Brazil no site da S&P Global e
tentar extrair os 3 valores via regex sobre o HTML.

Limitacao conhecida: serie e curta (apenas valores agregados disponiveis
publicamente). Para historico, usar JSON anterior do Blob como base
incremental - adicionar 1 ponto por mes.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/visao_geral_pmi.json"
UA = {"User-Agent": "az-invest-visao-geral-pmi/0.1"}

PMI_INDEX_URL = "https://www.pmi.spglobal.com/Public/Release/PressReleases"

INPUTS = {"pmi_manufatura": "2006-02", "pmi_servicos": "2007-03", "pmi_composto": "2007-03"}


def _get(url: str, *, timeout: int = 60, retries: int = 2) -> requests.Response | None:
    for i in range(retries):
        try:
            r = requests.get(url, timeout=timeout, headers=UA)
            r.raise_for_status()
            return r
        except Exception:
            time.sleep(3)
    return None


def buscar_press_releases_brasil() -> list[str]:
    """Lista URLs de releases recentes mencionando Brasil."""
    r = _get(PMI_INDEX_URL)
    if r is None:
        return []
    urls = re.findall(r'href=["\']([^"\']+)["\']', r.text)
    brasil = []
    for u in urls:
        ul = u.lower()
        if "brazil" in ul or "brasil" in ul:
            if u.startswith("/"):
                u = "https://www.pmi.spglobal.com" + u
            brasil.append(u)
    return brasil[:5]


def extrair_pmi(html: str, tipo: str) -> float | None:
    """Tenta extrair valor PMI do tipo (manufacturing/services/composite) do HTML."""
    # Padroes comuns: "PMI ... 50.5", "Index ... 50.5", "registered 50.5"
    patterns = [
        rf"{tipo}[^0-9]{{0,40}}(\d{{2}}\.\d)",
        rf"PMI[^0-9]{{0,40}}(\d{{2}}\.\d)",
    ]
    for p in patterns:
        m = re.search(p, html, re.IGNORECASE | re.DOTALL)
        if m:
            try:
                return float(m.group(1))
            except ValueError:
                continue
    return None


def fetch_pmi_recente() -> dict[str, float | None]:
    """Tenta pegar valores recentes via press release. Retorna {tipo: valor}."""
    out: dict[str, float | None] = {"manufatura": None, "servicos": None, "composto": None}
    urls = buscar_press_releases_brasil()
    if not urls:
        return out
    for url in urls:
        r = _get(url)
        if r is None:
            continue
        html = r.text
        if out["manufatura"] is None:
            out["manufatura"] = extrair_pmi(html, "manufacturing")
        if out["servicos"] is None:
            out["servicos"] = extrair_pmi(html, "services")
        if out["composto"] is None:
            out["composto"] = extrair_pmi(html, "composite")
        if all(out.values()):
            break
    return out


def mes_atual_iso() -> str:
    n = datetime.now(timezone.utc)
    return f"{n.year:04d}-{n.month:02d}"


def merge_incremental(serie: list[dict], mes: str, valores: dict[str, float | None]) -> list[dict]:
    """Merge incremental: adiciona/atualiza ponto do mes."""
    by_mes = {p["mes"]: p for p in serie}
    by_mes[mes] = {"mes": mes, **{k: v for k, v in valores.items() if v is not None}}
    return [by_mes[m] for m in sorted(by_mes.keys())]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--soft-fail", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "visao_geral_pmi.json"

    print("== S&P Global PMI Brasil ==")
    valores = fetch_pmi_recente()
    print(f"  manufatura={valores['manufatura']} | servicos={valores['servicos']} | composto={valores['composto']}")

    # Le serie historica anterior do Blob
    sys.path.insert(0, str(HERE))
    from shared.blob_download import download_json
    prev = download_json(BLOB_PATH) or {"serie": []}
    serie_prev = prev.get("serie", [])

    if any(v is not None for v in valores.values()):
        mes_iso = mes_atual_iso()
        serie = merge_incremental(serie_prev, mes_iso, valores)
        freshness = "fresh"
    elif serie_prev:
        serie = serie_prev
        freshness = "stale"
    else:
        serie = []
        freshness = "missing"

    payload = {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "freshness_status": freshness,
        "serie": serie,
        "inputs": INPUTS,
        "min_start_date": max(INPUTS.values()),
        "metadata": {
            "fonte": "S&P Global PMI Brasil - press release mensal publico.",
            "nota": "50 = corte expansao/contracao. Apenas valor headline corrente disponivel publicamente. Serie historica e licenciada.",
            "limitacao": "Pipeline incremental: 1 ponto por mes, baseado em scraping defensivo. Pode falhar se S&P Global mudar layout.",
        },
    }
    out_file.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"JSON {out_file} ({out_file.stat().st_size / 1024:.1f} KB) | {len(serie)} pontos")

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
