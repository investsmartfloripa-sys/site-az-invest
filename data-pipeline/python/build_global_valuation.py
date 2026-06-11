"""Build do JSON de valuation global/EUA pro painel de mercado.

Output: data/global_valuation.json (consumido por src/lib/painel-mercado-global.ts
na pagina /painel-economico/mercado/global/indices-globais, secao "Valuation EUA").

Tres blocos independentes (cada um com soft-fail que preserva o ultimo dado bom):

1. buffett — Indicador Buffett EUA = market cap agregado / PIB nominal.
     Numerador: FRED NCBEILQ027S ("Nonfinancial Corporate Business; Corporate
       Equities; Liability, Level", Fed Z.1, trimestral, US$ milhoes).
       ESCOLHA DOCUMENTADA: a serie classica do Wilshire 5000 (WILL5000PR)
       foi DESCONTINUADA no FRED (ultima observacao dez/2023). NCBEILQ027S
       e a alternativa viva consagrada na literatura do indicador; exclui
       financeiras (nivel ~20% abaixo do market cap total dos EUA), mas a
       leitura editorial e SEMPRE vs a propria media historica da razao,
       entao o vies de nivel nao muda o sinal caro/barato.
     Denominador: FRED GDP (PIB nominal trimestral SAAR, US$ bilhoes).
     LIMITACAO: frequencia TRIMESTRAL com defasagem de ~10 semanas (Z.1) —
       o ponto mais recente fica 1-2 trimestres atras do mercado a vista.

2. cape — CAPE (Shiller P/E 10) do S&P 500: dataset publico de Robert Shiller
     (Yale, ie_data.xls) — serie mensal desde ~1881 + valor corrente.
     Download fragil (host academico): soft-fail preserva o bloco anterior.

3. spy — snapshot diario de trailingPE/forwardPE/DY do SPY lido de
     data/market_fundamentals.json (Blob ou arquivo local), ACUMULADO em
     serie propria com merge incremental por data (append-only).

Uso:
    python data-pipeline/python/build_global_valuation.py                # local, sem upload
    python data-pipeline/python/build_global_valuation.py --upload      # CI (market-data.yml)

Env:
    FRED_API_KEY — opcional; quando presente usa a API oficial
    (api.stlouisfed.org). Sem chave cai no CSV publico fredgraph.csv.
"""
from __future__ import annotations

import argparse
import io
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
import requests

sys.path.append(str(Path(__file__).parent))
from shared.blob_upload import maybe_upload_json  # noqa: E402
from shared.blob_download import download_json  # noqa: E402

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0", "Accept": "*/*"}

# ATENCAO: o CDN do FRED (Akamai) DERRUBA conexoes cujo User-Agent finge ser
# browser sem o TLS de browser (timeout silencioso) — requests/curl com UA
# honesto (default) passam normalmente. NAO enviar o header UA pro FRED.

BLOB_PATH = "data/global_valuation.json"
SCHEMA_VERSION = 1

# FRED — series confirmadas vivas (ver docstring p/ justificativa)
FRED_BUFFETT_NUM = "NCBEILQ027S"   # equities liability, nonfin. corp., US$ mi, trimestral
FRED_BUFFETT_DEN = "GDP"           # PIB nominal SAAR, US$ bi, trimestral
FRED_TIMEOUT = 60

# Shiller — o ie_data.xls VIVO mora em shillerdata.com (link com GUID por
# release, descoberto via scrape). Os mirrors estaticos abaixo estao CONGELADOS
# (wsimg sem GUID: set/2024; Yale: set/2023) — servem so de ultimo recurso.
SHILLER_PAGE = "https://shillerdata.com/"
SHILLER_LINK_RE = r"//img1\.wsimg\.com/[^\"'\s>]*?ie_data\.xls[^\"'\s>]*"
SHILLER_FALLBACK_URLS = [
    "https://img1.wsimg.com/blobby/go/e5e77e0b-59d1-44d9-ab25-4763ac982e53/downloads/ie_data.xls",
    "http://www.econ.yale.edu/~shiller/data/ie_data.xls",
]
SHILLER_TIMEOUT = 90


def utcnow_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# FRED — fetch com 3 caminhos: API oficial (chave) -> fredgraph.csv -> downloaddata
# ---------------------------------------------------------------------------

def _fred_api(series_id: str, api_key: str) -> Optional[pd.Series]:
    url = (
        "https://api.stlouisfed.org/fred/series/observations"
        f"?series_id={series_id}&api_key={api_key}&file_type=json"
    )
    r = requests.get(url, timeout=FRED_TIMEOUT)
    r.raise_for_status()
    obs = r.json().get("observations", [])
    rows = {}
    for o in obs:
        v = o.get("value")
        if v in (None, "", "."):
            continue
        try:
            rows[pd.Timestamp(o["date"])] = float(v)
        except (KeyError, ValueError, TypeError):
            continue
    return pd.Series(rows).sort_index() if rows else None


def _fred_csv(series_id: str, url: str) -> Optional[pd.Series]:
    r = requests.get(url, timeout=FRED_TIMEOUT)  # UA default — ver nota acima
    r.raise_for_status()
    return _parse_fred_csv_text(r.text)


def _parse_fred_csv_text(text: str) -> Optional[pd.Series]:
    df = pd.read_csv(io.StringIO(text))
    if df.shape[1] < 2:
        return None
    df.columns = ["date", "value"] + list(df.columns[2:])
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df["value"] = pd.to_numeric(df["value"], errors="coerce")
    df = df.dropna(subset=["date", "value"])
    if df.empty:
        return None
    return pd.Series(df["value"].values, index=df["date"].values).sort_index()


def _fred_curl(series_id: str) -> Optional[pd.Series]:
    """Fallback via curl (UA default do curl — ver nota sobre o CDN acima)."""
    if not shutil.which("curl"):
        return None
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}"
    proc = subprocess.run(
        ["curl", "-sL", "--max-time", str(FRED_TIMEOUT), url],
        capture_output=True, text=True, timeout=FRED_TIMEOUT + 15,
    )
    if proc.returncode != 0 or not proc.stdout.strip():
        return None
    return _parse_fred_csv_text(proc.stdout)


def fred_series(series_id: str) -> Optional[pd.Series]:
    """Serie FRED (index=Timestamp, valores float). None se todos os caminhos falharem."""
    api_key = os.environ.get("FRED_API_KEY", "").strip()
    attempts: List[Tuple[str, Any]] = []
    if api_key:
        attempts.append(("api", lambda: _fred_api(series_id, api_key)))
    attempts.append(("fredgraph", lambda: _fred_csv(
        series_id, f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}")))
    attempts.append(("curl", lambda: _fred_curl(series_id)))
    attempts.append(("downloaddata", lambda: _fred_csv(
        series_id, f"https://fred.stlouisfed.org/series/{series_id}/downloaddata/{series_id}.csv")))
    for name, fn in attempts:
        try:
            s = fn()
            if s is not None and not s.empty:
                print(f"[global_val] FRED {series_id} via {name}: {len(s)} obs, "
                      f"ultima {s.index[-1].date()} = {s.iloc[-1]:,.1f}")
                return s
        except Exception as e:
            print(f"[global_val] FRED {series_id} via {name} falhou: {repr(e)[:120]}", file=sys.stderr)
    return None


# ---------------------------------------------------------------------------
# Estatisticas (media + bandas ±1σ) — mesmo formato do pl_stats de acoes_valuation
# ---------------------------------------------------------------------------

def series_stats(values: List[float], current: Optional[float]) -> Optional[Dict[str, Any]]:
    if not values:
        return None
    arr = pd.Series(values, dtype="float64").dropna()
    if arr.empty:
        return None
    mean = float(arr.mean())
    sd = float(arr.std(ddof=0))
    return {
        "mean": round(mean, 2),
        "sd": round(sd, 3),
        "minus1": round(mean - sd, 2),
        "plus1": round(mean + sd, 2),
        "current_z": round((current - mean) / sd, 2) if (current is not None and sd > 0) else None,
        "n_points": int(len(arr)),
    }


# ---------------------------------------------------------------------------
# Bloco 1 — Buffett Indicator
# ---------------------------------------------------------------------------

def build_buffett() -> Optional[Dict[str, Any]]:
    num = fred_series(FRED_BUFFETT_NUM)   # US$ milhoes
    den = fred_series(FRED_BUFFETT_DEN)   # US$ bilhoes
    if num is None or den is None:
        return None
    df = pd.concat({"num": num, "den": den}, axis=1, sort=True).dropna()
    df = df[df["den"] > 0]
    if df.empty:
        return None
    ratio = (df["num"] / 1000.0) / df["den"] * 100.0  # % do PIB
    series = [[d.strftime("%Y-%m-%d"), round(float(v), 1)] for d, v in ratio.items()]
    cur_date, cur_val = series[-1][0], float(series[-1][1])
    return {
        "current": {"date": cur_date, "ratio_pct": cur_val},
        "stats": series_stats([p[1] for p in series], cur_val),
        "series": series,
        "numerator_series": FRED_BUFFETT_NUM,
        "denominator_series": FRED_BUFFETT_DEN,
        "frequency": "trimestral",
        "stale": False,
        "source": "FRED (Fed Z.1 + BEA)",
        "note": (
            "Numerador NCBEILQ027S (equities de corporacoes nao-financeiras, Z.1) — "
            "a serie Wilshire 5000 (WILL5000PR) foi descontinuada no FRED em 2023. "
            "Exclui financeiras; leitura editorial e vs a propria media historica."
        ),
    }


# ---------------------------------------------------------------------------
# Bloco 2 — CAPE (Shiller)
# ---------------------------------------------------------------------------

def _parse_shiller_xls(content: bytes) -> Optional[List[List[Any]]]:
    """Extrai [["YYYY-MM-01", cape], ...] da aba Data do ie_data.xls.

    Estrutura do xls (verificada jun/2026): cabecalho empilhado em varias
    linhas; a linha REAL de cabecalho e a que tem "Date" na coluna 0. Nessa
    linha, "CAPE" aparece DUAS vezes: col 12 (o CAPE) e col 16 e a ponta do
    "Excess CAPE Yield" (empilhado) — por isso o match tem que ser o PRIMEIRO
    "CAPE" da linha do "Date", nunca o primeiro "CAPE" da planilha inteira.
    """
    raw = pd.read_excel(io.BytesIO(content), sheet_name="Data", header=None)
    header_row = None
    cape_col = None
    for i in range(min(12, len(raw))):
        first = raw.iat[i, 0]
        if isinstance(first, str) and first.strip() == "Date":
            for j, cell in enumerate(raw.iloc[i].tolist()):
                if isinstance(cell, str) and cell.strip() == "CAPE":
                    header_row, cape_col = i, j
                    break
            break
    if header_row is None or cape_col is None:
        return None
    body = raw.iloc[header_row + 1:, [0, cape_col]].copy()
    body.columns = ["date_frac", "cape"]
    body["date_frac"] = pd.to_numeric(body["date_frac"], errors="coerce")
    body["cape"] = pd.to_numeric(body["cape"], errors="coerce")
    body = body.dropna()
    out: List[List[Any]] = []
    for _, row in body.iterrows():
        d = float(row["date_frac"])
        year = int(d)
        month = int(round((d - year) * 100))
        if month == 1 and abs(d - year - 0.1) < 1e-6:
            month = 10  # 1881.1 no xls = outubro (nao janeiro)
        if not (1 <= month <= 12) or year < 1800:
            continue
        out.append([f"{year:04d}-{month:02d}-01", round(float(row["cape"]), 2)])
    out.sort(key=lambda p: p[0])
    return out or None


def _discover_shiller_url() -> Optional[str]:
    """Acha o link vivo do ie_data.xls na pagina do shillerdata.com."""
    import re
    try:
        r = requests.get(SHILLER_PAGE, timeout=SHILLER_TIMEOUT, headers=UA)
        r.raise_for_status()
        m = re.search(SHILLER_LINK_RE, r.text)
        if m:
            return "https:" + m.group(0)
    except Exception as e:
        print(f"[global_val] shillerdata.com scrape falhou: {repr(e)[:120]}", file=sys.stderr)
    return None


def build_cape() -> Optional[Dict[str, Any]]:
    urls = [u for u in [_discover_shiller_url()] if u] + SHILLER_FALLBACK_URLS
    for url in urls:
        try:
            r = requests.get(url, timeout=SHILLER_TIMEOUT, headers=UA)
            r.raise_for_status()
            series = _parse_shiller_xls(r.content)
            if not series:
                print(f"[global_val] Shiller: parse vazio em {url}", file=sys.stderr)
                continue
            cur_date, cur_val = series[-1][0], float(series[-1][1])
            print(f"[global_val] CAPE Shiller via {url.split('/')[2]}: {len(series)} meses, "
                  f"ultimo {cur_date} = {cur_val}")
            return {
                "current": {"date": cur_date, "value": cur_val},
                "stats": series_stats([p[1] for p in series], cur_val),
                "series": series,
                "stale": False,
                "source": "Robert Shiller (Yale), ie_data.xls",
            }
        except Exception as e:
            print(f"[global_val] Shiller {url}: {repr(e)[:120]}", file=sys.stderr)
    return None


# ---------------------------------------------------------------------------
# Bloco 3 — snapshot SPY acumulado (P/L, P/L forward, DY)
# ---------------------------------------------------------------------------

def load_fundamentals(out_dir: Path) -> Optional[Dict[str, Any]]:
    local = out_dir / "market_fundamentals.json"
    if local.exists():
        try:
            data = json.loads(local.read_text(encoding="utf-8"))
            if data.get("tickers"):
                print(f"[global_val] fundamentals: local {local}")
                return data
        except Exception:
            pass
    data = download_json("data/market_fundamentals.json")
    if data:
        print("[global_val] fundamentals: Blob data/market_fundamentals.json")
    return data


def build_spy_snapshot(out_dir: Path) -> Optional[Dict[str, Any]]:
    fund = load_fundamentals(out_dir)
    if not fund:
        return None
    spy = (fund.get("tickers") or {}).get("SPY") or {}
    info = spy.get("info") or {}

    def _num(key: str, scale: float = 1.0) -> Optional[float]:
        v = info.get(key)
        try:
            return round(float(v) * scale, 2) if v is not None else None
        except (TypeError, ValueError):
            return None

    trailing_pe = _num("trailingPE")
    forward_pe = _num("forwardPE")
    dy_pct = _num("dividendYield", 100.0)  # contrato do JSON: ratio (0.0098) -> %
    if trailing_pe is None and dy_pct is None:
        return None
    # Data do snapshot = dia (UTC) da coleta do .info
    fetched = spy.get("fetched_at") or fund.get("generated_at") or utcnow_iso()
    date = str(fetched)[:10]
    return {"date": date, "trailing_pe": trailing_pe, "forward_pe": forward_pe, "dy_pct": dy_pct}


def merge_spy_series(snapshot: Optional[Dict[str, Any]],
                     existing: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Serie acumulada append-only por data (snapshot novo prevalece na mesma data)."""
    prev_series = (existing or {}).get("series") or []
    by_date = {p["date"]: p for p in prev_series if isinstance(p, dict) and p.get("date")}
    if snapshot:
        by_date[snapshot["date"]] = snapshot
    if not by_date:
        return None
    series = sorted(by_date.values(), key=lambda p: p["date"])
    cur = series[-1]
    return {
        "current": {
            "date": cur["date"],
            "trailing_pe": cur.get("trailing_pe"),
            "forward_pe": cur.get("forward_pe"),
            "dividend_yield_pct": cur.get("dy_pct"),
        },
        "series": series,
        "stale": snapshot is None,
        "source": "yfinance .info (SPY) via data/market_fundamentals.json",
    }


# ---------------------------------------------------------------------------
# Merge + validacao (nunca sobrescrever dado bom com vazio)
# ---------------------------------------------------------------------------

def _has_series(block: Optional[Dict[str, Any]]) -> bool:
    return bool(block and isinstance(block.get("series"), list) and len(block["series"]) > 0)


def _merge_point_series(new: List[List[Any]], old: List[List[Any]]) -> List[List[Any]]:
    """Uniao append-only por data de series [[date, value], ...] (novo prevalece)."""
    by_date = {p[0]: p for p in old if isinstance(p, list) and len(p) >= 2}
    for p in new:
        by_date[p[0]] = p
    return sorted(by_date.values(), key=lambda p: p[0])


def _preserve(block_name: str, new_block: Optional[Dict[str, Any]],
              existing: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Soft-fail: se o build novo falhou, preserva o bloco anterior (stale=True)."""
    old_block = (existing or {}).get(block_name)
    if _has_series(new_block):
        # merge incremental: uniao por data com o que ja existia no Blob
        if _has_series(old_block):
            merged = _merge_point_series(new_block["series"], old_block["series"])
            new_block["series"] = merged
            cur_val = float(merged[-1][1])
            new_block["stats"] = series_stats([p[1] for p in merged], cur_val) or new_block.get("stats")
        return new_block
    if _has_series(old_block):
        print(f"[global_val] {block_name}: build falhou — PRESERVANDO bloco anterior do Blob",
              file=sys.stderr)
        old_block = dict(old_block)
        old_block["stale"] = True
        return old_block
    return None


def build_payload(out_dir: Path, merge: bool = True) -> Dict[str, Any]:
    existing = download_json(BLOB_PATH) if merge else None
    if existing and existing.get("status") != "ok":
        existing = None

    buffett = _preserve("buffett", build_buffett(), existing)
    cape = _preserve("cape", build_cape(), existing)
    spy = merge_spy_series(build_spy_snapshot(out_dir), (existing or {}).get("spy"))
    if spy and spy.get("stale"):
        print("[global_val] spy: snapshot indisponivel — serie anterior preservada", file=sys.stderr)

    blocks_ok = sum(1 for b in (buffett, cape, spy) if _has_series(b))
    return {
        "status": "ok" if blocks_ok > 0 else "error",
        "generated_at": utcnow_iso(),
        "schema_version": SCHEMA_VERSION,
        "buffett": buffett,
        "cape": cape,
        "spy": spy,
        "_meta": {"blocks_ok": blocks_ok},
    }


def report(payload: Dict[str, Any]) -> None:
    b = payload.get("buffett") or {}
    c = payload.get("cape") or {}
    s = payload.get("spy") or {}
    bc, cc, sc = b.get("current") or {}, c.get("current") or {}, s.get("current") or {}
    # ASCII puro: console Windows roda em cp1252 e quebra com box-drawing chars
    print("[global_val] -- RESUMO --------------------------------------")
    print(f"[global_val] Buffett: {bc.get('ratio_pct', '—')}% do PIB em {bc.get('date', '—')}"
          f" (media {((b.get('stats') or {}).get('mean', '—'))}%, z={(b.get('stats') or {}).get('current_z', '—')})")
    print(f"[global_val] CAPE:    {cc.get('value', '—')} em {cc.get('date', '—')}"
          f" (media {((c.get('stats') or {}).get('mean', '—'))}, z={(c.get('stats') or {}).get('current_z', '—')})")
    print(f"[global_val] SPY:     P/L {sc.get('trailing_pe', '—')} | P/L fwd {sc.get('forward_pe', '—')}"
          f" | DY {sc.get('dividend_yield_pct', '—')}% em {sc.get('date', '—')}"
          f" ({len(s.get('series') or [])} snapshots acumulados)")


def main() -> int:
    ap = argparse.ArgumentParser(description="Build valuation global/EUA (Buffett, CAPE, SPY)")
    ap.add_argument("--out-dir", default="data-pipeline/out")
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--no-merge", action="store_true",
                    help="ignora o JSON existente no Blob (debug)")
    args = ap.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "global_valuation.json"

    payload = build_payload(out_dir, merge=not args.no_merge)
    out_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(f"[global_val] Escreveu {out_path} ({out_path.stat().st_size:,} bytes)")
    report(payload)

    # Validacao de payload minimo: nunca subir JSON sem nenhuma serie valida.
    if payload.get("status") != "ok":
        print("[global_val] payload sem nenhum bloco valido — upload BLOQUEADO", file=sys.stderr)
        return 1
    if args.upload:
        maybe_upload_json(out_path, BLOB_PATH)
    else:
        print("[global_val] --upload NAO setado; apenas salvou local.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
