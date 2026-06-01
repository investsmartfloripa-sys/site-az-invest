"""Build do screener de ações (universo Ibovespa) pro painel de Renda Variável.

Output: data/acoes_screener.json (consumido por src/lib/painel-acoes.ts).

Por papel do IBOV: preço + variação do dia, P/L, P/VP, Dividend Yield 12m, ROE,
valor de mercado, setor e peso no índice.

Fontes (100% automáticas):
  - Universo + pesos: B3 GetPortfolioDay {index: IBOV}.
  - Métricas: market_fundamentals.json (yfinance .info, já gerado por market-data.yml)
    e market_history_full.json (preço diário) — lidos do Blob. Lacunas (papéis do
    IBOV ainda não no catálogo) caem para yfinance direto.
  - Setor: catálogo curado market_catalog.CATALOG (fallback "Outros").

Uso:
    python data-pipeline/python/build_acoes_screener.py --out-dir data-pipeline/out --upload
"""
from __future__ import annotations

import argparse
import base64
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

import requests

sys.path.append(str(Path(__file__).parent))
from shared.blob_upload import maybe_upload_json  # noqa: E402
from shared.blob_download import download_json  # noqa: E402
import market_catalog as mc  # noqa: E402

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0", "Accept": "*/*"}
B3_IBOV_URL = (
    "https://sistemaswebb3-listados.b3.com.br/indexProxy/indexCall/GetPortfolioDay/"
    + base64.b64encode(b'{"language":"pt-br","pageNumber":1,"pageSize":200,"index":"IBOV","segment":"1"}').decode()
)

# Mapa ticker (sem .SA) -> setor, do catálogo curado.
SECTOR_MAP: Dict[str, str] = {
    a["ticker"].replace(".SA", ""): a.get("sector", "Outros")
    for a in mc.CATALOG
    if a.get("klass") == "br_acoes"
}


def fetch_ibov_universe() -> List[Dict]:
    r = requests.get(B3_IBOV_URL, headers=UA, timeout=30)
    r.raise_for_status()
    out = []
    for row in r.json().get("results", []):
        cod = (row.get("cod") or "").strip()
        if not cod:
            continue
        try:
            w = float((row.get("part") or "0").replace(".", "").replace(",", "."))
        except ValueError:
            w = 0.0
        out.append({"ticker": cod, "name": (row.get("asset") or "").strip(), "weight": w})
    return out


def _num(v) -> Optional[float]:
    try:
        f = float(v)
        return f if f == f else None  # filtra NaN
    except (TypeError, ValueError):
        return None


def _dy_pct(info: Dict) -> Optional[float]:
    """Normaliza dividend yield para %. trailingAnnualDividendYield é fração; alguns
    campos já vêm em %."""
    tay = _num(info.get("trailingAnnualDividendYield"))
    if tay is not None:
        return round(tay * 100.0, 2)
    dy = _num(info.get("dividendYield"))
    if dy is None:
        return None
    return round((dy * 100.0) if dy < 1.0 else dy, 2)


def metrics_from_blob(cod: str, fund: Dict, hist: Dict) -> Optional[Dict]:
    info = ((fund.get("tickers", {}) or {}).get(f"{cod}.SA") or {}).get("info")
    node = (hist.get("tickers", {}) or {}).get(f"{cod}.SA")
    series = (node or {}).get("series_daily") or []
    if not info and not series:
        return None
    price = prev = None
    price_date = None
    if len(series) >= 1:
        price = _num(series[-1][1]); price_date = series[-1][0]
    if len(series) >= 2:
        prev = _num(series[-2][1])
    return _assemble(info or {}, price, prev, price_date)


def metrics_from_yf(cod: str) -> Optional[Dict]:
    try:
        import yfinance as yf
        tk = yf.Ticker(f"{cod}.SA")
        info = tk.info or {}
        h = tk.history(period="5d", auto_adjust=False)
        price = prev = None
        price_date = None
        if h is not None and not h.empty:
            closes = [c for c in h["Close"].tolist() if c == c]
            if closes:
                price = float(closes[-1])
                price_date = h.index[-1].strftime("%Y-%m-%d")
            if len(closes) >= 2:
                prev = float(closes[-2])
        return _assemble(info, price, prev, price_date)
    except Exception as e:
        print(f"[acoes_scr] yf FAIL {cod}: {repr(e)[:100]}", file=sys.stderr)
        return None


def _assemble(info: Dict, price, prev, price_date) -> Dict:
    pl = _num(info.get("trailingPE"))
    pvp = _num(info.get("priceToBook"))
    roe = _num(info.get("returnOnEquity"))
    mktcap = _num(info.get("marketCap"))
    change = None
    if price is not None and prev not in (None, 0):
        change = round((price - prev) / prev * 100.0, 2)
    return {
        "price": round(price, 2) if price is not None else None,
        "price_date": price_date,
        "change_pct_1d": change,
        "pl": round(pl, 2) if pl is not None else None,
        "pvp": round(pvp, 2) if pvp is not None else None,
        "roe_pct": round(roe * 100.0, 1) if roe is not None else None,
        "market_cap": mktcap,
        "dy_12m_pct": _dy_pct(info),
    }


def build_payload() -> Dict:
    print("[acoes_scr] universo IBOV (B3)...")
    universe = fetch_ibov_universe()
    print(f"[acoes_scr] IBOV: {len(universe)} papéis")
    if not universe:
        return {"status": "error", "generated_at": datetime.now(timezone.utc).isoformat(),
                "total_rows": 0, "rows": [], "sectors": []}

    fund = download_json("data/market_fundamentals.json") or {}
    hist = download_json("data/market_history_full.json") or {}
    print(f"[acoes_scr] Blob fund={len(fund.get('tickers', {}))} hist={len(hist.get('tickers', {}))}")

    rows: List[Dict] = []
    from_yf = 0
    for u in universe:
        cod = u["ticker"]
        m = metrics_from_blob(cod, fund, hist)
        if m is None or (m["pl"] is None and m["pvp"] is None and m["price"] is None):
            m2 = metrics_from_yf(cod)
            if m2 is not None:
                m = m2
                from_yf += 1
        if m is None:
            m = {"price": None, "price_date": None, "change_pct_1d": None, "pl": None,
                 "pvp": None, "roe_pct": None, "market_cap": None, "dy_12m_pct": None}
        dy = m["dy_12m_pct"]
        pl = m["pl"]
        rows.append({
            "ticker": cod,
            "name": u["name"],
            "sector": SECTOR_MAP.get(cod, "Outros"),
            "ibov_weight_pct": round(u["weight"], 2) if u["weight"] else None,
            **m,
            "pl_warning": bool(pl is not None and (pl <= 0 or pl > 100)),
            "dy_atypical": bool(dy is not None and dy > 15.0),
        })
    print(f"[acoes_scr] rows={len(rows)} (yf fallback em {from_yf})")

    sectors = sorted({r["sector"] for r in rows})
    return {
        "status": "ok",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_rows": len(rows),
        "rows": rows,
        "sectors": sectors,
        "sources": {
            "universe": "B3 GetPortfolioDay (IBOV)",
            "metrics": "market_fundamentals.json (yfinance .info) + fallback yfinance",
            "price": "market_history_full.json (yfinance Close)",
            "sector": "catálogo curado market_catalog",
        },
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default="data-pipeline/out")
    ap.add_argument("--upload", action="store_true")
    args = ap.parse_args()

    payload = build_payload()
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "acoes_screener.json"
    out_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(f"[acoes_scr] Escreveu {out_path} ({out_path.stat().st_size:,} bytes)")

    if payload.get("status") == "error":
        return 1
    if args.upload:
        maybe_upload_json(out_path, "data/acoes_screener.json")
    else:
        print("[acoes_scr] --upload NÃO setado; apenas salvou local.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
