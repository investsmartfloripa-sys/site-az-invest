"""Gera data/fundos_quotes.json: série de cota de cada fundo + CDI (gráfico da
página de detalhe /fundos-investimento/[slug]).

Fonte: Mais Retorno Data API, endpoint /quotes/{identifier} (header X-Api-Key).
Reusa o UNIVERSO e o _get do build_fundos_ranking.

Cota = NAV (não é %), então NÃO passa por _to_pp. No plano free o histórico vai
até ~1 ano (start_date 2025-06-16+). Custo: ~46 chamadas/rodada — pesado na cota,
então rode menos vezes que o ranking (ex.: 1x/semana) ou em plano superior.

Uso:
    python data-pipeline/python/build_fundos_quotes.py --upload
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

sys.path.append(str(Path(__file__).parent))
from shared.blob_upload import maybe_upload_json  # noqa: E402
from build_fundos_ranking import UNIVERSO, CATEGORY_ORDER, _api_key, _get  # noqa: E402

# Janela máxima do plano free (1 ano). Ajustar quando subir de plano.
START_DATE = "2025-06-16"


def fetch_series(ident: str, key: str) -> tuple[list[list[Any]], Optional[str]]:
    """Devolve (série [[data, cota]], nicename). Série vazia em falha."""
    resp = _get(f"quotes/{ident}?start_date={START_DATE}", key)
    if not isinstance(resp, dict):
        return [], None
    out: list[list[Any]] = []
    for row in resp.get("quotes") or []:
        d, c = row.get("d"), row.get("c")
        if d and isinstance(c, (int, float)):
            out.append([d, round(float(c), 6)])
    out.sort(key=lambda x: x[0])
    return out, resp.get("nicename")


def build_payload() -> dict[str, Any]:
    key = _api_key()
    if not key:
        return {"status": "error", "message": "MAISRETORNO_API_KEY ausente"}

    cdi, _ = fetch_series("cdi:idx", key)
    funds: dict[str, Any] = {}
    data_date: Optional[str] = None
    for cat_key in CATEGORY_ORDER:
        for fund in UNIVERSO[cat_key]["funds"]:
            ident = fund.get("id")
            if not ident:
                continue
            series, nicename = fetch_series(ident, key)
            if len(series) < 50:
                print(f"  [skip] série curta/vazia: {fund.get('nome')}", file=sys.stderr)
                continue
            funds[ident] = {"nome": fund.get("nome") or nicename or ident, "series": series}
            last = series[-1][0]
            if data_date is None or last > data_date:
                data_date = last

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "data_date": data_date,
        "cdi": cdi,
        "funds": funds,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default="data-pipeline/out")
    ap.add_argument("--upload", action="store_true")
    args = ap.parse_args()

    payload = build_payload()
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "fundos_quotes.json"
    out_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    n = len(payload.get("funds", {}))
    print(f"[fundos_quotes] Escreveu {out_path} ({out_path.stat().st_size:,} bytes, {n} fundos)")

    if payload.get("status") == "error" or n == 0:
        print(f"[fundos_quotes] sem dados: {payload.get('message', '')}", file=sys.stderr)
        return 1
    if args.upload:
        maybe_upload_json(out_path, "data/fundos_quotes.json")
    else:
        print("[fundos_quotes] --upload NÃO setado; apenas salvou local.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
