"""Build do ranking de fundos de investimento (por categoria) via Mais Retorno.

Output: data/fundos_ranking.json
        (consumido por src/lib/painel-fundos-investimento-data.ts)

Por fundo do universo curado: retorno acumulado (3m/6m/no ano/12m), volatilidade
anualizada, índice de Sharpe (vs CDI) e — opcionalmente — máximo drawdown 12m.

Fonte: Mais Retorno Data API (https://data.maisretorno.com/mr-data/v4/api),
autenticada pelo header `X-Api-Key` lido de MAISRETORNO_API_KEY.

Plano: no free, o histórico vai só até ~12 meses (janelas 12m caem para o campo
"begin"); ao assinar um plano superior, as janelas longas passam a vir preenchidas
e o `--with-drawdown` pode ser ligado sem estourar a cota.

Uso:
    python data-pipeline/python/build_fundos_ranking.py --out-dir data-pipeline/out --upload
    python data-pipeline/python/build_fundos_ranking.py --upload --with-drawdown
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import requests

sys.path.append(str(Path(__file__).parent))
from shared.blob_upload import maybe_upload_json  # noqa: E402

API_BASE = "https://data.maisretorno.com/mr-data/v4/api"
PLAN = os.environ.get("MAISRETORNO_PLAN", "free").strip() or "free"

# ── Universo curado por categoria ──────────────────────────────────────────
# Cada fundo: nome de exibição + identificador Mais Retorno "<cnpj>:fi".
# Quando `id` é None, o script resolve via /search/{query} (1 chamada extra).
# Preferir `id` explícito (determinístico e econômico em cota).
UNIVERSO: dict[str, dict[str, Any]] = {
    "multimercado": {
        "label": "Multimercado",
        "metric_default": "sharpe_12m",
        "funds": [
            {"nome": "CSHG Verde", "id": "01221890000124:fi", "query": "CSHG Verde FIC FIM"},
            {"nome": "SPX Nimitz", "id": None, "query": "SPX Nimitz"},
            {"nome": "Kapitalo Zeta", "id": None, "query": "Kapitalo Zeta"},
            {"nome": "Legacy Capital", "id": None, "query": "Legacy Capital"},
            {"nome": "Ibiúna Hedge", "id": None, "query": "Ibiuna Hedge"},
            {"nome": "Bahia AM Maraú", "id": None, "query": "Bahia AM Marau"},
            {"nome": "Genoa Capital Radar", "id": None, "query": "Genoa Capital Radar"},
            {"nome": "Vinland Macro", "id": None, "query": "Vinland Macro"},
        ],
    },
    "acoes": {
        "label": "Ações",
        "metric_default": "sharpe_12m",
        "funds": [
            {"nome": "Dynamo Cougar", "id": None, "query": "Dynamo Cougar"},
            {"nome": "Bogari Value", "id": None, "query": "Bogari Value"},
            {"nome": "Alaska Black", "id": None, "query": "Alaska Black"},
            {"nome": "Tork Long Only", "id": None, "query": "Tork"},
            {"nome": "Moat Capital", "id": None, "query": "Moat Capital"},
            {"nome": "Atmos Ações", "id": None, "query": "Atmos"},
            {"nome": "Real Investor", "id": None, "query": "Real Investor"},
            {"nome": "Constellation", "id": None, "query": "Constellation"},
        ],
    },
    "renda_fixa": {
        "label": "Renda Fixa",
        "metric_default": "12m",
        "funds": [
            {"nome": "ARX Denali", "id": None, "query": "ARX Denali"},
            {"nome": "JGP Crédito", "id": None, "query": "JGP Credito"},
            {"nome": "AZ Quest Altro", "id": None, "query": "AZ Quest Altro"},
            {"nome": "Capitânia", "id": None, "query": "Capitania"},
            {"nome": "SPX Seahawk", "id": None, "query": "SPX Seahawk"},
            {"nome": "Augme", "id": None, "query": "Augme"},
            {"nome": "Sparta", "id": None, "query": "Sparta"},
            {"nome": "Icatu Vanguarda", "id": None, "query": "Icatu Vanguarda"},
        ],
    },
}

CATEGORY_ORDER = ["multimercado", "acoes", "renda_fixa"]

HEADERS = {"Accept": "application/json"}


def _api_key() -> str:
    k = os.environ.get("MAISRETORNO_API_KEY", "").strip()
    if not k:
        print("[fundos_mr] ERRO: MAISRETORNO_API_KEY não definido", file=sys.stderr)
    return k


def _get(path: str, key: str, *, timeout: int = 30, retries: int = 3, sleep: float = 2.0) -> Optional[Any]:
    """GET autenticado com retry. Devolve JSON ou None."""
    url = f"{API_BASE}/{path.lstrip('/')}"
    headers = {**HEADERS, "X-Api-Key": key}
    last: Exception | None = None
    for i in range(retries):
        try:
            r = requests.get(url, headers=headers, timeout=timeout)
            if r.status_code == 429:  # rate limit — espera e tenta de novo
                time.sleep(sleep * (i + 2))
                continue
            r.raise_for_status()
            return r.json()
        except Exception as e:  # noqa: BLE001
            last = e
            print(f"  [{path}] retry {i + 1}/{retries}: {e}", file=sys.stderr)
            time.sleep(sleep)
    print(f"  [{path}] falhou: {last}", file=sys.stderr)
    return None


def _to_pp(v: Any) -> Optional[float]:
    """Decimal (0.0621) → pontos percentuais (6.21). None se inválido."""
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if f != f:  # NaN
        return None
    return round(f * 100.0, 4)


def resolve_id(fund: dict[str, Any], key: str) -> Optional[str]:
    if fund.get("id"):
        return fund["id"]
    q = fund.get("query")
    if not q:
        return None
    res = _get(f"search/{requests.utils.quote(q)}", key)
    if isinstance(res, list):
        for item in res:
            ident = item.get("identifier", "")
            if ident.endswith(":fi"):
                return ident
        if res:
            return res[0].get("identifier")
    return None


def _tf(stats: dict[str, Any], name: str) -> dict[str, Any]:
    tf = stats.get("timeframe", {}) or {}
    val = tf.get(name)
    return val if isinstance(val, dict) and val else {}


def fetch_row(fund: dict[str, Any], key: str, *, with_drawdown: bool) -> Optional[dict[str, Any]]:
    ident = resolve_id(fund, key)
    if not ident:
        print(f"  [skip] não resolveu: {fund.get('nome')}", file=sys.stderr)
        return None

    stats_resp = _get(f"stats/{ident}?format_decimal=false", key)
    if not isinstance(stats_resp, dict):
        return None
    stats = stats_resp.get("stats", {}) or {}

    # Janela 12m: usa last_12_months; no plano free cai p/ "begin" (≈12m).
    w12 = _tf(stats, "last_12_months") or _tf(stats, "begin")
    retornos = {
        "3m": _to_pp(_tf(stats, "last_3_months").get("profitability")),
        "6m": _to_pp(_tf(stats, "last_6_months").get("profitability")),
        "ytd": _to_pp(_tf(stats, "ytd").get("profitability")),
        "12m": _to_pp(w12.get("profitability")),
    }

    drawdown = None
    if with_drawdown:
        dd = _get(f"drawdown/{ident}", key)
        if isinstance(dd, dict):
            cand = dd.get("max_drawdown") or dd.get("maxDrawdown") or dd.get("value")
            drawdown = _to_pp(cand)

    return {
        "id": ident,
        "nome": fund.get("nome") or stats_resp.get("nicename") or ident,
        "gestora": stats_resp.get("asset_manager") or stats_resp.get("gestora"),
        "cnpj": ident.split(":")[0] if ":" in ident else None,
        "retornos": retornos,
        "vol_12m": _to_pp(w12.get("volatility")),
        "sharpe_12m": (lambda s: round(float(s), 4) if isinstance(s, (int, float)) else None)(
            w12.get("sharpe_ratio")
        ),
        "drawdown_12m": drawdown,
        "_last_quote": stats.get("last_quote_date"),
    }


def build_payload(*, with_drawdown: bool) -> dict[str, Any]:
    key = _api_key()
    if not key:
        return {"status": "error", "message": "MAISRETORNO_API_KEY ausente"}

    categories: list[dict[str, Any]] = []
    data_date: Optional[str] = None

    for cat_key in CATEGORY_ORDER:
        cfg = UNIVERSO[cat_key]
        rows: list[dict[str, Any]] = []
        for fund in cfg["funds"]:
            row = fetch_row(fund, key, with_drawdown=with_drawdown)
            if not row:
                continue
            lq = row.pop("_last_quote", None)
            if lq and (data_date is None or lq > data_date):
                data_date = lq
            rows.append(row)
        categories.append(
            {
                "key": cat_key,
                "label": cfg["label"],
                "metric_default": cfg["metric_default"],
                "funds": rows,
            }
        )

    total = sum(len(c["funds"]) for c in categories)
    return {
        "status": "ok" if total else "error",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "data_date": data_date,
        "plan": PLAN,
        "plan_history_limit": "12m" if PLAN == "free" else "completo",
        "source": "Mais Retorno Data API",
        "categories": categories,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default="data-pipeline/out")
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--with-drawdown", action="store_true", help="busca drawdown (1 chamada extra/fundo)")
    args = ap.parse_args()

    payload = build_payload(with_drawdown=args.with_drawdown)

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "fundos_ranking.json"
    out_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(f"[fundos_mr] Escreveu {out_path} ({out_path.stat().st_size:,} bytes)")

    if payload.get("status") == "error":
        print(f"[fundos_mr] status=error: {payload.get('message', 'sem fundos')}", file=sys.stderr)
        return 1
    if args.upload:
        maybe_upload_json(out_path, "data/fundos_ranking.json")
    else:
        print("[fundos_mr] --upload NÃO setado; apenas salvou local.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
