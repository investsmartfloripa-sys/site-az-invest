"""Build TPF (Titulos Publicos Federais) history JSON via ANBIMA.

Fonte: https://www.anbima.com.br/informacoes/merc-sec/arqs/ms{YYMMDD}.txt
Formato: arroba-separado, encoding latin1.

Colunas:
  Titulo @ Data Referencia @ Codigo SELIC @ Data Base/Emissao @ Data Vencimento @
  Tx. Compra @ Tx. Venda @ Tx. Indicativas @ PU @ Desvio padrao @
  Interv. Ind. Inf. (D0) @ Interv. Ind. Sup. (D0) @
  Interv. Ind. Inf. (D+1) @ Interv. Ind. Sup. (D+1) @ Criterio

Saidas:
  - data/treasury_history.json  : series temporais por (tipo, vencimento)

Estrutura JSON:
{
  "status": "ok",
  "generated_at": "...",
  "lookback_business_days": 130,
  "last_data_date": "YYYY-MM-DD",
  "categories": {
    "PRE": {
      "label": "Prefixado",
      "vencimentos": ["2026-07-01", "2027-01-01", ...],
      "series": {
        "2026-07-01": [["2025-12-02", 11.20], ["2025-12-03", 11.18], ...],
        ...
      }
    },
    "IPCA": {
      "label": "IPCA+",
      "vencimentos": [...],
      "series": {...}
    }
  }
}

Estrategia "Pre": combina LTN (zero coupon) + NTN-F (cupom semestral). Quando ha
ambos no mesmo vencimento, prioriza NTN-F (mais liquido). Geralmente vencimentos
nao coincidem (LTN em xx-04 ou xx-10, NTN-F em xx-01).
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests

sys.path.append(str(Path(__file__).parent))
from shared.blob_upload import maybe_upload_json  # noqa: E402


ANBIMA_TPF_URL = "https://www.anbima.com.br/informacoes/merc-sec/arqs/ms{yymmdd}.txt"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/plain,text/html,*/*;q=0.5",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
}

# Feriados nacionais conhecidos (apenas pra pular tentativas de download)
# Lista basica - faltando data sera pulada se 404
KNOWN_HOLIDAYS_RECENT = {
    "2025-01-01", "2025-03-03", "2025-03-04", "2025-04-18", "2025-04-21",
    "2025-05-01", "2025-06-19", "2025-09-07", "2025-10-12", "2025-11-02",
    "2025-11-15", "2025-11-20", "2025-12-25",
    "2026-01-01", "2026-02-16", "2026-02-17", "2026-04-03", "2026-04-21",
    "2026-05-01", "2026-06-04", "2026-09-07", "2026-10-12", "2026-11-02",
    "2026-11-15", "2026-11-20", "2026-12-25",
}


def is_business_day(d: date) -> bool:
    if d.weekday() >= 5:
        return False
    if d.isoformat() in KNOWN_HOLIDAYS_RECENT:
        return False
    return True


def previous_business_days(n: int, start: Optional[date] = None) -> List[date]:
    """Retorna N dias uteis anteriores (sem hoje), em ordem cronologica."""
    d = start or date.today()
    out: List[date] = []
    while len(out) < n:
        d = d - timedelta(days=1)
        if is_business_day(d):
            out.append(d)
    return list(reversed(out))


def parse_decimal_br(s: str) -> Optional[float]:
    """Converte string BR (virgula decimal) em float. Retorna None se invalido."""
    if not s or s in ("--", "N/D", ""):
        return None
    s = s.strip().replace(".", "").replace(",", ".")
    try:
        v = float(s)
        return v
    except ValueError:
        return None


def parse_date_yyyymmdd(s: str) -> Optional[str]:
    """Converte 'YYYYMMDD' em 'YYYY-MM-DD'. Retorna None se invalido."""
    s = (s or "").strip()
    if len(s) != 8 or not s.isdigit():
        return None
    return f"{s[:4]}-{s[4:6]}-{s[6:8]}"


def fetch_tpf_day(d: date, session: requests.Session, timeout: int = 15) -> Optional[str]:
    """Baixa o conteudo bruto do ms{YYMMDD}.txt para 1 dia. None se nao existir."""
    yymmdd = d.strftime("%y%m%d")
    url = ANBIMA_TPF_URL.format(yymmdd=yymmdd)
    try:
        r = session.get(url, headers=HEADERS, timeout=timeout)
        if r.status_code == 200 and len(r.content) > 1024:
            return r.content.decode("latin1", errors="replace")
        return None
    except Exception as e:
        print(f"[tpf] WARN {d}: {e}", file=sys.stderr)
        return None


def parse_tpf_content(content: str) -> List[Dict]:
    """Parseia conteudo do ms{}.txt. Retorna lista de dicts.

    Cada dict: { tipo, data_ref, vencimento, taxa_indicativa, pu }
    """
    rows: List[Dict] = []
    lines = content.splitlines()
    # Pula header (linhas 1-3) ate achar a primeira linha de dado
    body_start = 0
    for i, ln in enumerate(lines):
        if "@" in ln and ln.split("@")[0].strip() in ("LTN", "NTN-F", "NTN-B", "NTN-C", "LFT"):
            body_start = i
            break
    if body_start == 0:
        # Pode nao ter achado; tenta a partir da linha 3
        body_start = 3

    for ln in lines[body_start:]:
        if not ln.strip() or "@" not in ln:
            continue
        parts = ln.split("@")
        if len(parts) < 9:
            continue
        tipo = parts[0].strip()
        if tipo not in ("LTN", "NTN-F", "NTN-B", "NTN-C", "LFT"):
            continue
        data_ref = parse_date_yyyymmdd(parts[1])
        vencimento = parse_date_yyyymmdd(parts[4])
        taxa_ind = parse_decimal_br(parts[7])
        pu = parse_decimal_br(parts[8])
        if not data_ref or not vencimento or taxa_ind is None:
            continue
        rows.append({
            "tipo": tipo,
            "data_ref": data_ref,
            "vencimento": vencimento,
            "taxa_indicativa": round(taxa_ind, 4),
            "pu": round(pu, 6) if pu is not None else None,
        })
    return rows


def categorize_pre_or_ipca(tipo: str) -> Optional[str]:
    """LTN+NTN-F -> 'PRE'; NTN-B -> 'IPCA'; resto -> None (LFT, NTN-C ignorados)."""
    if tipo in ("LTN", "NTN-F"):
        return "PRE"
    if tipo == "NTN-B":
        return "IPCA"
    return None


def aggregate_by_category_and_vencimento(rows: List[Dict]) -> Dict[str, Dict[str, List[Tuple[str, float]]]]:
    """Agrupa: {category: {vencimento: [(data_ref, taxa), ...]}}.

    Em caso de empate (LTN e NTN-F com mesmo vencimento na mesma data),
    prioriza NTN-F (cupom, mais liquido).
    """
    out: Dict[str, Dict[str, List[Tuple[str, float, str]]]] = {"PRE": {}, "IPCA": {}}
    for r in rows:
        cat = categorize_pre_or_ipca(r["tipo"])
        if not cat:
            continue
        venc = r["vencimento"]
        out[cat].setdefault(venc, []).append((r["data_ref"], r["taxa_indicativa"], r["tipo"]))

    # Resolve duplicatas (mesma data_ref + vencimento, com tipos diferentes) priorizando NTN-F
    final: Dict[str, Dict[str, List[Tuple[str, float]]]] = {"PRE": {}, "IPCA": {}}
    for cat, venc_map in out.items():
        for venc, entries in venc_map.items():
            by_date: Dict[str, Tuple[float, str]] = {}
            for data_ref, taxa, tipo in entries:
                if data_ref not in by_date:
                    by_date[data_ref] = (taxa, tipo)
                else:
                    prev_taxa, prev_tipo = by_date[data_ref]
                    if tipo == "NTN-F" and prev_tipo == "LTN":
                        by_date[data_ref] = (taxa, tipo)
            series = sorted([(d, v) for d, (v, _) in by_date.items()])
            final[cat][venc] = series
    return final


def filter_relevant_vencimentos(series_by_venc: Dict[str, List[Tuple[str, float]]],
                                 min_observations: int = 30) -> Dict[str, List[Tuple[str, float]]]:
    """Remove vencimentos com poucas observacoes (papeis curtos que ja venceram)."""
    return {v: s for v, s in series_by_venc.items() if len(s) >= min_observations}


def build_tpf_history(business_days: int = 130, sleep_s: float = 0.1) -> Dict:
    days = previous_business_days(business_days)
    print(f"[tpf] baixando {len(days)} dias uteis de {days[0]} a {days[-1]}")
    session = requests.Session()
    all_rows: List[Dict] = []
    ok_count = 0
    fail_count = 0

    for i, d in enumerate(days):
        content = fetch_tpf_day(d, session)
        if content:
            rows = parse_tpf_content(content)
            all_rows.extend(rows)
            ok_count += 1
            if i % 20 == 0:
                print(f"  [tpf] {i+1}/{len(days)} ({d}): {len(rows)} linhas")
        else:
            fail_count += 1
        time.sleep(sleep_s)

    print(f"[tpf] OK {ok_count} dias, FAIL {fail_count} dias, {len(all_rows)} linhas totais")
    grouped = aggregate_by_category_and_vencimento(all_rows)

    # Filtra vencimentos com poucos pontos
    for cat in grouped:
        grouped[cat] = filter_relevant_vencimentos(grouped[cat], min_observations=int(business_days * 0.3))

    last_data_date = max((r["data_ref"] for r in all_rows), default="")

    categories_out = {}
    for cat, venc_map in grouped.items():
        vencimentos_sorted = sorted(venc_map.keys())
        # Converte tuples para arrays no JSON
        series = {v: [[d, t] for d, t in venc_map[v]] for v in vencimentos_sorted}
        categories_out[cat] = {
            "label": "Prefixado" if cat == "PRE" else "IPCA+",
            "vencimentos": vencimentos_sorted,
            "series": series,
        }

    return {
        "status": "ok" if ok_count > 0 else "error",
        "generated_at": datetime.now(tz=timezone.utc).isoformat(),
        "source": "ANBIMA — Mercado Secundario TPF",
        "lookback_business_days": business_days,
        "days_loaded": ok_count,
        "days_failed": fail_count,
        "last_data_date": last_data_date,
        "categories": categories_out,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--business-days", type=int, default=130, help="Dias uteis para baixar (~6 meses)")
    ap.add_argument("--sleep", type=float, default=0.1)
    ap.add_argument("--out-dir", default="data-pipeline/out")
    ap.add_argument("--upload", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "treasury_history.json"

    payload = build_tpf_history(business_days=args.business_days, sleep_s=args.sleep)
    out_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    size_kb = out_path.stat().st_size / 1024
    n_pre = len(payload["categories"].get("PRE", {}).get("vencimentos", []))
    n_ipca = len(payload["categories"].get("IPCA", {}).get("vencimentos", []))
    print(f"[tpf] Gerado {out_path} ({size_kb:.1f} KB)")
    print(f"[tpf] PRE: {n_pre} vencimentos | IPCA: {n_ipca} vencimentos")
    print(f"[tpf] Ultima data: {payload['last_data_date']}")

    if args.upload:
        maybe_upload_json(out_path, "data/treasury_history.json")

    return 0 if payload["status"] == "ok" else 2


if __name__ == "__main__":
    raise SystemExit(main())
