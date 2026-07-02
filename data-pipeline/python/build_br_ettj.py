"""Curva prefixada (e IPCA) do BRASIL por prazo constante — ANBIMA ETTJ → Blob.

Objetivo: dar ao Brasil um HISTÓRICO diário por prazo (1/2/5/10 anos) para o
comparador de juros soberanos (data/br_ettj.json), já que não existe fonte
gratuita de constante-maturidade BR (SGS swaps morreram em 2019; página de
taxas referenciais da B3 quebrada).

Fontes:
  1. ANBIMA est-termo (CZ-down.asp) — vértices da ETTJ (Svensson) por data:
     du 252=1a, 504=2a, 1260=5a, 2520=10a, curvas PRÉ e IPCA + implícita.
     D+0 (~18h30 BRT). LIMITAÇÃO: janela pública de ~4 meses → merge
     append-only no Blob (o arquivo cresce com o tempo — padrão
     fluxo-investidores).
  2. Tesouro Transparente (--tesouro-backfill) — CSV único PrecoTaxaTesouroDireto
     com taxas diárias de LTN/NTN-F desde 2002: interpola nos prazos-alvo e
     preenche SÓ datas ainda ausentes (a ANBIMA, quando existe, prevalece).

Uso:
    python data-pipeline/python/build_br_ettj.py --days 10 --upload
    python data-pipeline/python/build_br_ettj.py --seed --upload          # ~4 meses da ANBIMA
    python data-pipeline/python/build_br_ettj.py --tesouro-backfill --upload
"""
from __future__ import annotations

import argparse
import io
import json
import sys
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional

import requests

sys.path.append(str(Path(__file__).parent))
from shared.blob_upload import maybe_upload_json  # noqa: E402
from shared.blob_download import download_json  # noqa: E402

BLOB_PATH = "data/br_ettj.json"
ANBIMA_URL = "https://www.anbima.com.br/informacoes/est-termo/CZ-down.asp"
TESOURO_CSV = (
    "https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/"
    "resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv"
)
UA = {"User-Agent": "Mozilla/5.0 (compatible; AZInvestBot/1.0; +https://investimentosdeaz.com.br)"}

# Prazos-alvo (anos) e vértices ANBIMA correspondentes (dias úteis, 252/ano).
TENORS_YEARS = [1, 2, 5, 10]
TENOR_DU = {252: 1, 504: 2, 1260: 5, 2520: 10}


def _num(s: str) -> Optional[float]:
    """Número ANBIMA: vírgula decimal, ponto de milhar, latin-1."""
    t = s.strip().replace(".", "").replace(",", ".")
    if not t or t in {"-", "--"}:
        return None
    try:
        return float(t)
    except ValueError:
        return None


def fetch_anbima_day(d: date, session: requests.Session) -> Optional[Dict]:
    """Vértices da ETTJ de UMA data. None se a ANBIMA não tiver (feriado/fora da janela)."""
    body = {"Idioma": "PT", "Dt_Ref": d.strftime("%d/%m/%Y"), "saida": "csv"}
    try:
        r = session.post(ANBIMA_URL, data=body, headers=UA, timeout=30)
        r.raise_for_status()
    except Exception as e:  # noqa: BLE001
        print(f"[ettj] {d}: falha HTTP ({e})", file=sys.stderr)
        return None
    text = r.content.decode("latin-1", errors="replace")
    if "Vertices" not in text and "VERTICES" not in text.upper():
        return None
    pre: Dict[int, float] = {}
    ipca: Dict[int, float] = {}
    in_vertices = False
    for line in text.splitlines():
        cols = [c.strip() for c in line.split(";")]
        if not cols:
            continue
        if cols[0].upper().startswith("VERTICES"):
            in_vertices = True
            continue
        if not in_vertices:
            continue
        # Formato: Vertices;ETTJ IPCA;ETTJ PREF;Inflação Implícita
        du_raw = cols[0].replace(".", "")
        if not du_raw.isdigit():
            continue
        du = int(du_raw)
        if du not in TENOR_DU or len(cols) < 3:
            continue
        years = TENOR_DU[du]
        v_ipca = _num(cols[1])
        v_pre = _num(cols[2])
        if v_ipca is not None:
            ipca[years] = round(v_ipca, 4)
        if v_pre is not None:
            pre[years] = round(v_pre, 4)
    if len(pre) < 2:
        return None
    return {
        "pre": [pre.get(y) for y in TENORS_YEARS],
        "ipca": [ipca.get(y) for y in TENORS_YEARS] if ipca else None,
    }


def business_days_back(n: int, until: Optional[date] = None) -> List[date]:
    """Últimos ~n dias úteis (seg-sex; feriados retornam vazio na ANBIMA e são pulados)."""
    out: List[date] = []
    d = until or date.today()
    while len(out) < n:
        if d.weekday() < 5:
            out.append(d)
        d -= timedelta(days=1)
    return out


def run_anbima(dates_map: Dict[str, Dict], n_days: int, pace: float) -> int:
    added = 0
    with requests.Session() as s:
        for d in business_days_back(n_days):
            iso = d.isoformat()
            if iso in dates_map:
                continue
            node = fetch_anbima_day(d, s)
            if node:
                dates_map[iso] = {**node, "src": "anbima"}
                added += 1
                print(f"[ettj] {iso}: pré={node['pre']}")
            time.sleep(pace)
    return added


def run_tesouro_backfill(dates_map: Dict[str, Dict]) -> int:
    """Preenche datas ausentes (2002+) com LTN/NTN-F interpoladas do Tesouro Direto."""
    import pandas as pd

    print("[ettj] baixando CSV do Tesouro Transparente (grande, ~1-2 min)...")
    r = requests.get(TESOURO_CSV, headers=UA, timeout=300)
    r.raise_for_status()
    df = pd.read_csv(io.BytesIO(r.content), sep=";", decimal=",", encoding="latin-1")
    df.columns = [c.strip() for c in df.columns]
    tipo_col = next(c for c in df.columns if "Tipo" in c)
    venc_col = next(c for c in df.columns if "Vencimento" in c)
    base_col = next(c for c in df.columns if "Base" in c)
    taxa_col = next(c for c in df.columns if "Taxa Compra" in c)
    df = df[df[tipo_col].isin(["Tesouro Prefixado", "Tesouro Prefixado com Juros Semestrais"])]
    df[venc_col] = pd.to_datetime(df[venc_col], format="%d/%m/%Y", errors="coerce")
    df[base_col] = pd.to_datetime(df[base_col], format="%d/%m/%Y", errors="coerce")
    df = df.dropna(subset=[venc_col, base_col, taxa_col])
    df["anos"] = (df[venc_col] - df[base_col]).dt.days / 365.25
    df = df[(df["anos"] > 0.05) & (df[taxa_col] > 0)]

    added = 0
    for base, g in df.groupby(base_col):
        iso = base.date().isoformat()
        if iso in dates_map:
            continue  # ANBIMA (ou run anterior) prevalece
        g = g.sort_values("anos")
        xs = g["anos"].tolist()
        ys = g[taxa_col].tolist()
        pre: List[Optional[float]] = []
        for ty in TENORS_YEARS:
            # Interpolação linear SÓ com bracketing real (sem extrapolar).
            v: Optional[float] = None
            for i in range(len(xs) - 1):
                if xs[i] <= ty <= xs[i + 1]:
                    w = (ty - xs[i]) / (xs[i + 1] - xs[i]) if xs[i + 1] > xs[i] else 0
                    v = round(ys[i] + w * (ys[i + 1] - ys[i]), 4)
                    break
            pre.append(v)
        if sum(1 for v in pre if v is not None) >= 2:
            dates_map[iso] = {"pre": pre, "ipca": None, "src": "tesouro"}
            added += 1
    print(f"[ettj] Tesouro backfill: +{added} datas")
    return added


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=10, help="dias úteis recentes a buscar na ANBIMA")
    ap.add_argument("--seed", action="store_true", help="janela cheia da ANBIMA (~88 dias úteis)")
    ap.add_argument("--tesouro-backfill", action="store_true", help="preenche 2002+ com LTN/NTN-F")
    ap.add_argument("--pace", type=float, default=0.4)
    ap.add_argument("--out-dir", default="data-pipeline/out")
    ap.add_argument("--upload", action="store_true")
    args = ap.parse_args()

    prev = download_json(BLOB_PATH)
    dates_map: Dict[str, Dict] = {}
    if isinstance(prev, dict) and isinstance(prev.get("dates"), dict):
        dates_map = dict(prev["dates"])
        print(f"[ettj] Blob atual: {len(dates_map)} datas")

    n = 88 if args.seed else args.days
    added_anbima = run_anbima(dates_map, n, args.pace)
    added_tesouro = 0
    if args.tesouro_backfill:
        # Tesouro Transparente cai com frequência (502) — não pode derrubar o
        # que a ANBIMA já entregou neste run.
        try:
            added_tesouro = run_tesouro_backfill(dates_map)
        except Exception as e:  # noqa: BLE001
            print(f"[ettj] Tesouro backfill falhou (segue só ANBIMA): {e}", file=sys.stderr)

    payload = {
        "status": "ok" if dates_map else "error",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "ANBIMA ETTJ (vértices Svensson, % a.a. 252du) + Tesouro Direto LTN/NTN-F (backfill)",
        "tenors_years": TENORS_YEARS,
        "schema": "dates[iso] = {pre: [r_1a, r_2a, r_5a, r_10a], ipca: idem|null, src}",
        # Última observação — lido pelo health-check (data-manifest dataDateField).
        "last_data_date": max(dates_map) if dates_map else None,
        "dates": dict(sorted(dates_map.items())),
    }
    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    p = out / "br_ettj.json"
    p.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(f"[ettj] {p} ({p.stat().st_size:,} bytes) — anbima +{added_anbima}, tesouro +{added_tesouro}, total {len(dates_map)}")

    if payload["status"] == "error":
        return 1
    if args.upload:
        maybe_upload_json(p, BLOB_PATH)
    return 0


if __name__ == "__main__":
    sys.exit(main())
