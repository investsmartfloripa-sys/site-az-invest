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
from shared.blob_download import download_json as blob_download_json  # noqa: E402


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

    Cada dict: { codigo, indexador, classe, taxa_indicativa, duration, ref_ntnb }
    `ref_ntnb` eh a data de vencimento da NTN-B usada como benchmark
    pelo papel IPCA+ (formato YYYY-MM-DD). None se nao se aplicar (DI/PRE)
    ou se o ANBIMA nao publicou a referencia.
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
        # PU (coluna 10) — valor de mercado em reais por debenture, usado para ponderacao
        pu = parse_decimal_br(parts[10]) if len(parts) > 10 else None
        # Duration vem em dias (string com virgula); converte
        duration = parse_decimal_br(parts[12]) if len(parts) > 12 else None
        # Referencia NTN-B (coluna 14) — vem como DD/MM/YYYY para papeis IPCA+
        ref_ntnb = parse_date_dmy(parts[14]) if len(parts) > 14 else None

        rows.append({
            "data_ref": data_ref_iso,
            "codigo": codigo,
            "indexador": indexador,
            "classe": classe,
            "taxa_indicativa": taxa_ind,
            "pu": pu,
            "duration_days": duration,
            "ref_ntnb": ref_ntnb,
        })
    return rows


def build_ntnb_index(treasury_history: Optional[Dict]) -> Dict[str, Dict[str, float]]:
    """Constroi indice {vencimento_iso: {data_ref_iso: taxa}} a partir do
    treasury_history.json (categories.IPCA.series). Retorna dict vazio se input
    invalido.
    """
    if not treasury_history or not isinstance(treasury_history, dict):
        return {}
    ipca = (treasury_history.get("categories") or {}).get("IPCA") or {}
    series = ipca.get("series") or {}
    idx: Dict[str, Dict[str, float]] = {}
    for venc, points in series.items():
        m: Dict[str, float] = {}
        for entry in points:
            if isinstance(entry, list) and len(entry) >= 2:
                try:
                    m[entry[0]] = float(entry[1])
                except (TypeError, ValueError):
                    continue
        if m:
            idx[venc] = m
    return idx


def lookup_ntnb_rate(
    ntnb_index: Dict[str, Dict[str, float]],
    ref_ntnb: str,
    data_ref: str,
    max_back_days: int = 30,
) -> Optional[float]:
    """Busca a taxa da NTN-B benchmark numa data. Se nao houver cotacao exata,
    tenta forward-fill ate `max_back_days` dias uteis pra tras (cobre feriados,
    fins de semana, lacunas curtas no historico).
    """
    series = ntnb_index.get(ref_ntnb)
    if not series:
        return None
    if data_ref in series:
        return series[data_ref]
    from datetime import datetime, timedelta
    try:
        d = datetime.strptime(data_ref, "%Y-%m-%d").date()
    except ValueError:
        return None
    for back in range(1, max_back_days + 1):
        candidate = (d - timedelta(days=back)).isoformat()
        if candidate in series:
            return series[candidate]
    return None


def aggregate_daily_stats(
    rows_by_day: Dict[str, List[Dict]],
    ntnb_index: Dict[str, Dict[str, float]],
) -> Dict[str, Dict[str, List]]:
    """Para cada dia, agrega por classe: mediana, p25, p75, n.

    DI: usa Taxa Indicativa direto (ja eh spread sobre CDI por convencao ANBIMA).
    IPCA: calcula spread real = Taxa Indicativa - Taxa NTN-B benchmark naquele dia.
          So inclui papeis com referencia NTN-B preenchida e cotacao disponivel.
    PRE: usa Taxa Indicativa direto.
    """
    out: Dict[str, Dict[str, List]] = {
        "DI":   {"median": [], "p25": [], "p75": [], "n": [], "pct_neg": [], "pct_mid": [], "pct_high": [], "mean_weighted": []},
        "IPCA": {"median": [], "p25": [], "p75": [], "n": [], "pct_neg": [], "pct_mid": [], "pct_high": [], "mean_weighted": []},
        "PRE":  {"median": [], "p25": [], "p75": [], "n": [], "pct_neg": [], "pct_mid": [], "pct_high": [], "mean_weighted": []},
    }
    skipped_ipca = 0
    matched_ipca = 0

    dates_sorted = sorted(rows_by_day.keys())
    for d in dates_sorted:
        # Listas paralelas (spread, pu) — ignora papeis sem PU para o ponderado
        spreads_pu: Dict[str, List[Tuple[float, Optional[float]]]] = {"DI": [], "IPCA": [], "PRE": []}
        for r in rows_by_day[d]:
            classe = r["classe"]
            pu = r.get("pu")
            if classe == "IPCA":
                # Precisa de NTN-B benchmark + cotacao disponivel
                ref = r.get("ref_ntnb")
                if not ref:
                    skipped_ipca += 1
                    continue
                ntnb_rate = lookup_ntnb_rate(ntnb_index, ref, d)
                if ntnb_rate is None:
                    skipped_ipca += 1
                    continue
                spread = r["taxa_indicativa"] - ntnb_rate
                # Filtro de sanidade: spread fora de [-2, 15]% provavelmente eh erro
                if -2.0 <= spread <= 15.0:
                    spreads_pu["IPCA"].append((spread, pu))
                    matched_ipca += 1
                else:
                    skipped_ipca += 1
            else:
                spreads_pu[classe].append((r["taxa_indicativa"], pu))

        for cls, entries in spreads_pu.items():
            if len(entries) < 3:
                continue
            vals = [v for v, _ in entries]
            vals_sorted = sorted(vals)
            median = statistics.median(vals_sorted)
            n = len(vals_sorted)
            p25_idx = max(0, int(n * 0.25) - 1)
            p75_idx = min(n - 1, int(n * 0.75))
            p25 = vals_sorted[p25_idx]
            p75 = vals_sorted[p75_idx]
            # Buckets de distribuicao (% papeis em cada faixa de spread)
            n_neg = sum(1 for v in vals_sorted if v < 0)
            n_high = sum(1 for v in vals_sorted if v >= 1.0)  # >= 100 bps
            n_mid = n - n_neg - n_high
            pct_neg = round(100.0 * n_neg / n, 1)
            pct_mid = round(100.0 * n_mid / n, 1)
            pct_high = round(100.0 * n_high / n, 1)

            # Spread medio ponderado por PU (medida que o mercado usa)
            wsum = 0.0
            wtot = 0.0
            for v, pu in entries:
                if pu is None or pu <= 0:
                    continue
                wsum += v * pu
                wtot += pu
            mean_weighted = round(wsum / wtot, 4) if wtot > 0 else None

            out[cls]["median"].append([d, round(median, 4)])
            out[cls]["p25"].append([d, round(p25, 4)])
            out[cls]["p75"].append([d, round(p75, 4)])
            out[cls]["n"].append([d, n])
            out[cls]["pct_neg"].append([d, pct_neg])
            out[cls]["pct_mid"].append([d, pct_mid])
            out[cls]["pct_high"].append([d, pct_high])
            if mean_weighted is not None:
                out[cls]["mean_weighted"].append([d, mean_weighted])

    print(f"[deb] IPCA spread match: {matched_ipca} ok, {skipped_ipca} sem NTN-B ou fora de range")
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

    # Carrega historico de NTN-B (treasury_history.json do Blob) para calcular
    # spread real dos papeis IPCA+ contra a NTN-B benchmark.
    print("[deb] carregando treasury_history.json do Blob para cruzar NTN-B...")
    treasury = blob_download_json("data/treasury_history.json")
    ntnb_index = build_ntnb_index(treasury)
    n_vencs_ntnb = len(ntnb_index)
    print(f"[deb] NTN-B index: {n_vencs_ntnb} vencimentos disponiveis")

    stats = aggregate_daily_stats(rows_by_day, ntnb_index)

    last_data_date = max(rows_by_day.keys(), default="")

    classes_out = {
        "DI":   {"label": "DI / CDI (spread sobre CDI)",       "series": stats["DI"]},
        "IPCA": {"label": "IPCA+ (spread sobre NTN-B)",        "series": stats["IPCA"]},
        "PRE":  {"label": "Prefixado (taxa nominal)",          "series": stats["PRE"]},
    }

    return {
        "status": "ok" if ok_count > 0 else "error",
        "generated_at": datetime.now(tz=timezone.utc).isoformat(),
        "source": "ANBIMA - Mercado Secundario Debentures (DI) + ANBIMA TPF / Tesouro Transparente (NTN-B benchmark)",
        "note": "DI = spread sobre CDI (Taxa Indicativa direta); IPCA = spread = Taxa Indicativa - Taxa NTN-B benchmark do papel; PRE = taxa nominal",
        "lookback_business_days": business_days,
        "days_loaded": ok_count,
        "days_failed": fail_count,
        "last_data_date": last_data_date,
        "ntnb_vencs_used": n_vencs_ntnb,
        "classes": classes_out,
    }


def merge_credit_with_existing(new_payload: Dict, existing: Optional[Dict]) -> Dict:
    """Merge incremental: combina series de cada classe (DI/IPCA/PRE) com o JSON
    ja existente no Blob, evitando perder dias antigos quando ANBIMA tira do servidor.

    Cada classe tem series.{median, p25, p75, n}, cada uma e lista de [data, valor].
    Union por data; novo sobrescreve old quando coincidem.
    """
    if not existing or not isinstance(existing, dict):
        return new_payload

    existing_classes = existing.get("classes") or {}
    new_classes = new_payload.get("classes") or {}

    # Auto-migracao de formato: se a serie IPCA existente nao foi gerada com o
    # calculo de spread vs NTN-B (label antigo, sem "spread sobre NTN-B"),
    # descarta os dados velhos pra nao misturar taxa absoluta com spread.
    old_ipca_label = (existing_classes.get("IPCA") or {}).get("label", "") or ""
    legacy_ipca_format = bool(old_ipca_label) and "spread sobre NTN-B" not in old_ipca_label
    if legacy_ipca_format:
        print(f"[deb] migrando formato: IPCA antigo (label='{old_ipca_label}') descartado pra "
              f"nao misturar taxa absoluta com spread.")
        existing_classes = {k: v for k, v in existing_classes.items() if k != "IPCA"}

    merged_classes: Dict[str, Dict] = {}
    all_keys = set(new_classes.keys()) | set(existing_classes.keys())

    for cls in all_keys:
        new_cls = new_classes.get(cls, {})
        old_cls = existing_classes.get(cls, {})
        new_series = new_cls.get("series") or {}
        old_series = old_cls.get("series") or {}

        merged_series: Dict[str, List[List]] = {}
        for metric in ("median", "p25", "p75", "n", "pct_neg", "pct_mid", "pct_high", "mean_weighted"):
            by_date: Dict[str, float] = {}
            for entry in old_series.get(metric, []) or []:
                if isinstance(entry, list) and len(entry) >= 2:
                    by_date[entry[0]] = entry[1]
            for entry in new_series.get(metric, []) or []:
                if isinstance(entry, list) and len(entry) >= 2:
                    by_date[entry[0]] = entry[1]
            merged_series[metric] = [[d, v] for d, v in sorted(by_date.items())]

        merged_classes[cls] = {
            "label": new_cls.get("label") or old_cls.get("label") or cls,
            "series": merged_series,
        }

    out = dict(new_payload)
    out["classes"] = merged_classes
    out["last_data_date"] = max(
        new_payload.get("last_data_date") or "",
        existing.get("last_data_date") or "",
    )
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--business-days", type=int, default=130)
    ap.add_argument("--sleep", type=float, default=0.15)
    ap.add_argument("--out-dir", default="data-pipeline/out")
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--no-merge", action="store_true",
                    help="Desliga merge incremental com Blob (rebuild from scratch)")
    args = ap.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "credit_spreads_history.json"

    payload = build_deb_history(business_days=args.business_days, sleep_s=args.sleep)

    if not args.no_merge:
        print("[deb] merge incremental: lendo data/credit_spreads_history.json existente do Blob...")
        existing = blob_download_json("data/credit_spreads_history.json")
        if existing:
            old_obs = sum(len(s.get("series", {}).get("median", []) or []) for s in (existing.get("classes") or {}).values())
            print(f"[deb]   existing: {old_obs} obs (mediana), last_data={existing.get('last_data_date')}")
            payload = merge_credit_with_existing(payload, existing)
            new_obs = sum(len(c["series"]["median"]) for c in payload["classes"].values())
            print(f"[deb]   apos merge: {new_obs} obs (mediana), delta {new_obs - old_obs}")
        else:
            print("[deb]   nenhum JSON existente no Blob — primeira execucao")

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
