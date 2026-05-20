"""Build credit spreads history JSON via ANBIMA debentures secundario.

Fonte: https://www.anbima.com.br/informacoes/merc-sec-debentures/arqs/db{YYMMDD}.txt
Formato: arroba-separado, encoding latin1.

Colunas:
  Codigo @ Nome @ Repac./Venc. @ Indice/Correcao @ Taxa Compra @ Taxa Venda @
  Taxa Indicativa @ Desvio Padrao @ Int. Min @ Int. Max @ PU @ % PU @
  Duration @ % Reune @ Referencia NTN-B

Estrategia de classificacao por 'Indice/Correcao':
  - 'DI'      -> DI-percent ou DI+spread (ex: "DI + 1,6%", "100% DI", "120% CDI")
  - 'IPCA'    -> IPCA+spread (ex: "IPCA + 5,5%")
  - 'PRE'     -> taxa pre-fixada (ex: "9,5%")
  - 'OUTRO'   -> selic, indice, exotico

Para cada dia + classe, agregamos a Taxa Indicativa (yield) em:
  - mediana, p25, p75, n papeis

Saida: data/credit_spreads_history.json

{
  "status": "ok",
  "generated_at": "...",
  "source": "ANBIMA - Mercado Secundario Debentures",
  "last_data_date": "YYYY-MM-DD",
  "classes": {
    "DI":   {"label": "DI+x%", "series": {"median":[...], "p25":[...], "p75":[...], "n":[...]}},
    "IPCA": {...},
    "PRE":  {...}
  }
}

series.median = lista de [data_ref, valor]
"""
from __future__ import annotations

import argparse
import json
import re
import statistics
import sys
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests

sys.path.append(str(Path(__file__).parent))
from build_anbima_tpf import (  # noqa: E402
    HEADERS,
    is_business_day,
    parse_decimal_br,
    previous_business_days,
)
from shared.blob_upload import maybe_upload_json  # noqa: E402


ANBIMA_DEB_URL = "https://www.anbima.com.br/informacoes/merc-sec-debentures/arqs/db{yymmdd}.txt"


def fetch_deb_day(d: date, session: requests.Session, timeout: int = 30) -> Optional[str]:
    yymmdd = d.strftime("%y%m%d")
    url = ANBIMA_DEB_URL.format(yymmdd=yymmdd)
    try:
        r = session.get(url, headers=HEADERS, timeout=timeout)
        if r.status_code == 200 and len(r.content) > 5000:
            return r.content.decode("latin1", errors="replace")
        return None
    except Exception as e:
        print(f"[deb] WARN {d}: {e}", file=sys.stderr)
        return None


# Padroes pra classificar
RE_DI = re.compile(r"^\s*(DI|CDI)\b", re.IGNORECASE)
RE_IPCA = re.compile(r"^\s*IPCA\b", re.IGNORECASE)
RE_IGPM = re.compile(r"^\s*IGP", re.IGNORECASE)
RE_SELIC = re.compile(r"^\s*SELIC\b", re.IGNORECASE)
# Pre = comeca com numero (ex: "9,5%") ou nada que case acima
RE_PURE_PRE = re.compile(r"^\s*\d+[,.]\d+\s*%?\s*$", re.IGNORECASE)


def classify_indexador(idx: str) -> Optional[str]:
    if not idx:
        return None
    s = idx.strip()
    if RE_DI.match(s):
        return "DI"
    if RE_IPCA.match(s):
        return "IPCA"
    if RE_PURE_PRE.match(s):
        return "PRE"
    return None  # ignora IGPM, SELIC etc.


def parse_date_dmy(s: str) -> Optional[str]:
    """Converte 'DD/MM/YYYY' em 'YYYY-MM-DD'."""
    s = (s or "").strip()
    if not s or "/" not in s:
        return None
    parts = s.split("/")
    if len(parts) != 3:
        return None
    try:
        d = int(parts[0]); m = int(parts[1]); y = int(parts[2])
        return f"{y:04d}-{m:02d}-{d:02d}"
    except ValueError:
        return None


def parse_deb_content(content: str, data_ref_iso: str) -> List[Dict]:
    """Parseia conteudo do db{}.txt. Retorna lista de dicts.

    Cada dict: { codigo, indexador, classe, taxa_indicativa, duration }
    """
    rows: List[Dict] = []
    lines = content.splitlines()
    for ln in lines:
        if not ln.strip() or "@" not in ln:
            continue
        parts = ln.split("@")
        if len(parts) < 13:
            continue
        codigo = parts[0].strip()
        # Header: 'Codigo' (ou similar). Filtra
        if codigo.lower() in ("codigo", "código", "c�digo"):
            continue
        # Linhas validas tem codigo com letras + numeros (ex: AALM12)
        if not re.match(r"^[A-Z][A-Z0-9]{3,7}$", codigo, re.IGNORECASE):
            continue

        indexador = parts[3].strip()
        classe = classify_indexador(indexador)
        if not classe:
            continue
        taxa_ind = parse_decimal_br(parts[6])
        if taxa_ind is None:
            continue
        # Duration vem em dias (string com virgula); converte
        duration = parse_decimal_br(parts[12]) if len(parts) > 12 else None

        rows.append({
            "data_ref": data_ref_iso,
            "codigo": codigo,
            "indexador": indexador,
            "classe": classe,
            "taxa_indicativa": taxa_ind,
            "duration_days": duration,
        })
    return rows


def aggregate_daily_stats(rows_by_day: Dict[str, List[Dict]]) -> Dict[str, Dict[str, List]]:
    """Para cada dia, agrega por classe: mediana, p25, p75, n."""
    out: Dict[str, Dict[str, List]] = {
        "DI":   {"median": [], "p25": [], "p75": [], "n": []},
        "IPCA": {"median": [], "p25": [], "p75": [], "n": []},
        "PRE":  {"median": [], "p25": [], "p75": [], "n": []},
    }
    dates_sorted = sorted(rows_by_day.keys())
    for d in dates_sorted:
        by_class: Dict[str, List[float]] = {"DI": [], "IPCA": [], "PRE": []}
        for r in rows_by_day[d]:
            by_class[r["classe"]].append(r["taxa_indicativa"])
        for cls, vals in by_class.items():
            if len(vals) < 3:
                # Poucos pontos: pula esse dia/classe
                continue
            vals_sorted = sorted(vals)
            median = statistics.median(vals_sorted)
            n = len(vals_sorted)
            p25_idx = max(0, int(n * 0.25) - 1)
            p75_idx = min(n - 1, int(n * 0.75))
            p25 = vals_sorted[p25_idx]
            p75 = vals_sorted[p75_idx]
            out[cls]["median"].append([d, round(median, 4)])
            out[cls]["p25"].append([d, round(p25, 4)])
            out[cls]["p75"].append([d, round(p75, 4)])
            out[cls]["n"].append([d, n])
    return out


def build_deb_history(business_days: int = 130, sleep_s: float = 0.15) -> Dict:
    days = previous_business_days(business_days)
    print(f"[deb] baixando {len(days)} dias uteis de {days[0]} a {days[-1]}")
    session = requests.Session()
    rows_by_day: Dict[str, List[Dict]] = {}
    ok_count = 0
    fail_count = 0

    for i, d in enumerate(days):
        content = fetch_deb_day(d, session)
        if content:
            data_iso = d.isoformat()
            rows = parse_deb_content(content, data_iso)
            if rows:
                rows_by_day[data_iso] = rows
                ok_count += 1
                if i % 20 == 0:
                    di = sum(1 for r in rows if r["classe"] == "DI")
                    ip = sum(1 for r in rows if r["classe"] == "IPCA")
                    pr = sum(1 for r in rows if r["classe"] == "PRE")
                    print(f"  [deb] {i+1}/{len(days)} ({d}): DI={di} IPCA={ip} PRE={pr}")
        else:
            fail_count += 1
        time.sleep(sleep_s)

    print(f"[deb] OK {ok_count} dias, FAIL {fail_count} dias")
    stats = aggregate_daily_stats(rows_by_day)

    last_data_date = max(rows_by_day.keys(), default="")

    classes_out = {
        "DI":   {"label": "DI / CDI",  "series": stats["DI"]},
        "IPCA": {"label": "IPCA+",     "series": stats["IPCA"]},
        "PRE":  {"label": "Prefixado", "series": stats["PRE"]},
    }

    return {
        "status": "ok" if ok_count > 0 else "error",
        "generated_at": datetime.now(tz=timezone.utc).isoformat(),
        "source": "ANBIMA - Mercado Secundario Debentures",
        "note": "Taxa indicativa agregada: DI = spread sobre CDI; IPCA = taxa real; PRE = nominal",
        "lookback_business_days": business_days,
        "days_loaded": ok_count,
        "days_failed": fail_count,
        "last_data_date": last_data_date,
        "classes": classes_out,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--business-days", type=int, default=130)
    ap.add_argument("--sleep", type=float, default=0.15)
    ap.add_argument("--out-dir", default="data-pipeline/out")
    ap.add_argument("--upload", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "credit_spreads_history.json"

    payload = build_deb_history(business_days=args.business_days, sleep_s=args.sleep)
    out_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    size_kb = out_path.stat().st_size / 1024
    print(f"[deb] Gerado {out_path} ({size_kb:.1f} KB)")
    print(f"[deb] Ultima data: {payload['last_data_date']}")
    for cls, c in payload["classes"].items():
        print(f"  {cls}: {len(c['series']['median'])} obs")

    if args.upload:
        maybe_upload_json(out_path, "data/credit_spreads_history.json")
    return 0 if payload["status"] == "ok" else 2


if __name__ == "__main__":
    raise SystemExit(main())
