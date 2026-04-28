#!/usr/bin/env python3
"""Gera JSONs unificados do Panorama e opcionalmente envia ao Vercel Blob."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from build_asset_returns import _add_brl_usd_returns, compute_returns
from build_br_sector_baskets import (
    compute_cluster_returns,
    fetch_data as br_fetch_data,
    get_all_tickers as br_get_all_tickers,
    load_components,
    setup_logging as br_setup_logging,
)
from build_commodities_returns import compute_returns as compute_commodity_returns
from build_sector_baskets import (
    compute_basket_returns,
    fetch_data,
    get_all_tickers,
    setup_logging,
)
from build_world_indices_returns import compute_world_indices_returns
from shared.blob_upload import maybe_upload_json

DATA_PIPELINE_ROOT = ROOT.parent
OUT = Path(os.environ.get("DATA_PIPELINE_OUT", str(DATA_PIPELINE_ROOT / "out"))).resolve()
OUT.mkdir(parents=True, exist_ok=True)

PERIODS = ["1d", "1wk", "1mo", "3mo", "1y"]

PERIOD_LABELS = {
    "1d": "Diário",
    "1wk": "Semanal",
    "1mo": "Mensal",
    "3mo": "Trimestral",
    "1y": "Anual",
}


def build_asset_returns_unified() -> Path:
    by_period: dict = {}
    for p in PERIODS:
        rows = compute_returns(period=p)
        fx_meta = (
            _add_brl_usd_returns(rows)
            if rows
            else {"fx_ticker": "BRL=X", "fx_usd_brl_return_pct": None}
        )
        by_period[p] = {"period": p, "fx": fx_meta, "data": rows}
    payload = {
        "status": "ok",
        "generated_at": pd.Timestamp.utcnow().isoformat(),
        "title": "Retornos dos Ativos (%)",
        "chart_type": "horizontal_bar",
        "colors": {
            "positive": "#2ECC71",
            "negative": "#E74C3C",
            "text": "#2C3E50",
        },
        "by_period": by_period,
    }
    path = OUT / "asset_returns_panorama.json"
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[OK] {path.name}")
    return path


def build_world_indices_unified() -> Path:
    by_period: dict = {}
    for p in PERIODS:
        by_period[p] = {"period": p, "data": compute_world_indices_returns(period=p)}
    payload = {
        "status": "ok",
        "generated_at": pd.Timestamp.utcnow().isoformat(),
        "title": "Retornos Índices Globais (%)",
        "chart_type": "horizontal_bar",
        "colors": {
            "positive": "#2ECC71",
            "negative": "#E74C3C",
            "text": "#2C3E50",
        },
        "by_period": by_period,
    }
    path = OUT / "world_indices_returns_panorama.json"
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[OK] {path.name}")
    return path


def build_commodities_unified() -> Path:
    by_period: dict = {}
    for p in PERIODS:
        data = compute_commodity_returns(p)
        by_period[p] = {"period": p, "data": data}
    payload = {
        "status": "ok",
        "generated_at": pd.Timestamp.now().isoformat(),
        "title": "Índice de Commodities",
        "chart_type": "horizontal_bar",
        "colors": {"positive": "#2ECC71", "negative": "#E74C3C"},
        "by_period": by_period,
    }
    path = OUT / "commodities_returns_panorama.json"
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[OK] {path.name}")
    return path


def _process_sector_view(items: list) -> dict:
    sorted_items = sorted(items, key=lambda x: x["return_pct"], reverse=True)
    return {
        "top10": sorted_items[:10],
        "bottom10": sorted_items[-10:][::-1],
    }


def build_sector_baskets_unified() -> Path:
    setup_logging()
    all_tickers = get_all_tickers()
    by_period: dict = {}
    for p in PERIODS:
        df = fetch_data(all_tickers, period=p)
        if df.empty:
            by_period[p] = {
                "period": p,
                "view_brl": {"top10": [], "bottom10": []},
                "view_usd": {"top10": [], "bottom10": []},
            }
            continue
        basket_returns_map = compute_basket_returns(df, p)
        view_brl = _process_sector_view(basket_returns_map["view_brl"])
        view_usd = _process_sector_view(basket_returns_map["view_usd"])
        by_period[p] = {
            "period": p,
            "view_brl": view_brl,
            "view_usd": view_usd,
        }
    payload = {
        "status": "ok",
        "generated_at": pd.Timestamp.now().isoformat(),
        "title": "Setores Globais",
        "chart_type": "sector_table",
        "period_label": PERIOD_LABELS,
        "by_period": by_period,
    }
    path = OUT / "sector_baskets_panorama.json"
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[OK] {path.name}")
    return path


def build_br_sector_unified() -> Path:
    br_setup_logging()
    components_df = load_components()
    all_tickers = br_get_all_tickers(components_df)
    by_period: dict = {}
    for p in PERIODS:
        df = br_fetch_data(all_tickers, period=p)
        by_period[p] = {
            "period": p,
            "data": compute_cluster_returns(df, components_df, p),
        }
    payload = {
        "status": "ok",
        "generated_at": pd.Timestamp.now().isoformat(),
        "title": "Setores Brasil",
        "chart_type": "sector_table",
        "period_label": PERIOD_LABELS,
        "by_period": by_period,
    }
    path = OUT / "br_sector_baskets_panorama.json"
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[OK] {path.name}")
    return path


def run_fx_top_movers() -> Path:
    path = OUT / "fx_top_movers.json"
    r = subprocess.run(
        [
            sys.executable,
            str(ROOT / "build_fx_top_movers.py"),
            "--output",
            str(path),
            "--period",
            "2y",
        ],
        cwd=str(ROOT),
        check=False,
    )
    if r.returncode != 0:
        print("[WARN] fx_top_movers falhou", file=sys.stderr)
    else:
        print(f"[OK] {path.name}")
    return path


def main() -> int:
    print(f"Output dir: {OUT}")
    paths: list[Path] = []
    try:
        paths.append(build_asset_returns_unified())
        paths.append(build_world_indices_unified())
        paths.append(build_commodities_unified())
        paths.append(build_sector_baskets_unified())
        paths.append(build_br_sector_unified())
        paths.append(run_fx_top_movers())
    except Exception as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        return 1

    mapping = {
        "asset_returns_panorama.json": "data/asset_returns_panorama.json",
        "world_indices_returns_panorama.json": "data/world_indices_returns_panorama.json",
        "commodities_returns_panorama.json": "data/commodities_returns_panorama.json",
        "sector_baskets_panorama.json": "data/sector_baskets_panorama.json",
        "br_sector_baskets_panorama.json": "data/br_sector_baskets_panorama.json",
        "fx_top_movers.json": "data/fx_top_movers.json",
    }
    for p in paths:
        blob_key = mapping.get(p.name)
        if blob_key:
            try:
                maybe_upload_json(p, blob_key)
            except Exception as e:
                print(f"[WARN] upload {p.name}: {e}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
