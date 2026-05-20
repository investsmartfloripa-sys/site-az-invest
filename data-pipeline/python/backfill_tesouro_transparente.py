"""One-shot backfill historico via Tesouro Transparente.

Baixa o CSV consolidado "Preco e Taxa do Tesouro Direto" do Tesouro Nacional
(historico desde 2002, ~50-100MB), filtra titulos prefixados (LTN, NTN-F) e
IPCA+ (NTN-B), agrega taxa indicativa por (tipo, vencimento, data_base) e faz
**merge** com o JSON ANBIMA existente em data/treasury_history.json.

Estrategia de merge:
  - Le treasury_history.json atual (do Blob ou local).
  - Identifica a primeira data ANBIMA por vencimento.
  - Para datas ANTERIORES, usa o Tesouro Direto.
  - Para datas COBERTAS pela ANBIMA, mantem ANBIMA (mais autoritativa).

Importante: Tesouro Direto publica taxa de compra/venda do investidor PF,
que difere ~10-30bp da taxa indicativa do mercado secundario da ANBIMA. Pra
suavizar, calculamos (Taxa Compra Manha + Taxa Venda Manha) / 2 como proxy.

Uso: python data-pipeline/python/backfill_tesouro_transparente.py --upload

Roda **uma vez** localmente. NAO entra no cron diario (ANBIMA cuida do presente).
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from io import StringIO
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests

sys.path.append(str(Path(__file__).parent))
from shared.blob_upload import maybe_upload_json  # noqa: E402

# URL CKAN do Tesouro Transparente — "Preco e Taxa do Tesouro Direto"
CSV_URL = (
    "https://www.tesourotransparente.gov.br/ckan/dataset/"
    "df56aa42-484a-4a59-8184-7676580c81e3/resource/"
    "796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv"
)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/csv,text/plain,*/*;q=0.5",
}

# Mapeamento Tipo Titulo -> categoria simplificada
TIPO_TO_CATEGORY = {
    "Tesouro Prefixado":                          "PRE",
    "Tesouro Prefixado com Juros Semestrais":     "PRE",
    "LTN":                                        "PRE",  # nomes antigos
    "NTN-F":                                      "PRE",
    "Tesouro IPCA+":                              "IPCA",
    "Tesouro IPCA+ com Juros Semestrais":         "IPCA",
    "NTN-B":                                      "IPCA",
    "NTN-B Principal":                            "IPCA",
}


def download_csv(out_path: Path, timeout: int = 240) -> Path:
    """Baixa o CSV pra disco (stream) pra economizar memoria."""
    print(f"[backfill] baixando {CSV_URL} -> {out_path}")
    with requests.get(CSV_URL, headers=HEADERS, timeout=timeout, stream=True) as r:
        r.raise_for_status()
        total = 0
        with open(out_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=1024 * 256):
                if chunk:
                    f.write(chunk)
                    total += len(chunk)
        print(f"[backfill] download OK: {total / 1024 / 1024:.1f} MB")
    return out_path


def parse_decimal_br(s: str) -> Optional[float]:
    if not s:
        return None
    s = s.strip().replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def parse_date_br(s: str) -> Optional[str]:
    """DD/MM/YYYY -> YYYY-MM-DD."""
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


def parse_csv_streaming(csv_path: Path) -> List[Dict]:
    """Le linha-a-linha o CSV gigante (sep=';', encoding latin1) e extrai rows uteis."""
    out: List[Dict] = []
    header: Optional[List[str]] = None
    n_lines = 0
    n_kept = 0
    with open(csv_path, "rb") as f:
        for raw in f:
            n_lines += 1
            try:
                line = raw.decode("latin1").rstrip("\r\n")
            except Exception:
                continue
            parts = line.split(";")
            if header is None:
                header = [p.strip() for p in parts]
                continue
            if len(parts) < len(header):
                continue
            row = dict(zip(header, parts))
            tipo = row.get("Tipo Titulo", "").strip()
            cat = TIPO_TO_CATEGORY.get(tipo)
            if not cat:
                continue
            data_base = parse_date_br(row.get("Data Base", ""))
            vencimento = parse_date_br(row.get("Data Vencimento", ""))
            if not data_base or not vencimento:
                continue
            taxa_compra = parse_decimal_br(row.get("Taxa Compra Manha", ""))
            taxa_venda = parse_decimal_br(row.get("Taxa Venda Manha", ""))
            if taxa_compra is None and taxa_venda is None:
                continue
            if taxa_compra is not None and taxa_venda is not None:
                taxa = (taxa_compra + taxa_venda) / 2.0
            else:
                taxa = taxa_compra if taxa_compra is not None else taxa_venda

            out.append({
                "category": cat,
                "vencimento": vencimento,
                "data_base": data_base,
                "taxa": round(taxa, 4),
            })
            n_kept += 1
            if n_kept % 100000 == 0:
                print(f"[backfill]   parsed {n_lines} linhas, kept {n_kept}")

    print(f"[backfill] total linhas: {n_lines}, retidas: {n_kept}")
    return out


def aggregate_to_series(
    rows: List[Dict],
) -> Dict[str, Dict[str, List[Tuple[str, float]]]]:
    """Agrupa em {category: {vencimento: [(data_base, taxa), ...]}}."""
    out: Dict[str, Dict[str, List[Tuple[str, float]]]] = {"PRE": {}, "IPCA": {}}
    for r in rows:
        cat = r["category"]
        venc = r["vencimento"]
        out[cat].setdefault(venc, []).append((r["data_base"], r["taxa"]))
    # Sort + dedup por data_base (mantem ultimo se duplicar)
    for cat in out:
        for venc in out[cat]:
            by_date: Dict[str, float] = {}
            for d, t in out[cat][venc]:
                by_date[d] = t
            out[cat][venc] = sorted(by_date.items())
    return out


def merge_with_anbima(
    backfill: Dict[str, Dict[str, List[Tuple[str, float]]]],
    anbima_json_path: Path,
) -> Dict:
    """Carrega JSON ANBIMA e faz merge: backfill so para datas ANTERIORES."""
    if not anbima_json_path.exists():
        print(f"[backfill] WARN: {anbima_json_path} nao existe. Gerando so com Tesouro.")
        anbima = {"categories": {}, "last_data_date": ""}
    else:
        anbima = json.loads(anbima_json_path.read_text(encoding="utf-8"))

    merged_categories: Dict[str, Dict] = {}
    last_data_date = anbima.get("last_data_date", "")

    for cat in ("PRE", "IPCA"):
        anbima_cat = (anbima.get("categories") or {}).get(cat, {})
        anbima_series: Dict[str, List[List]] = anbima_cat.get("series", {})
        backfill_cat = backfill.get(cat, {})

        merged_series: Dict[str, List[List]] = {}
        all_vencimentos = set(anbima_series.keys()) | set(backfill_cat.keys())

        for venc in all_vencimentos:
            # Primeira data ANBIMA pra esse vencimento (se houver)
            anbima_first_date = (
                anbima_series[venc][0][0]
                if (venc in anbima_series and anbima_series[venc])
                else None
            )

            combined: Dict[str, float] = {}
            # 1. Tesouro Direto: tudo (mais antigo primeiro)
            for d, t in backfill_cat.get(venc, []):
                # Se ANBIMA cobre, e a data >= primeira ANBIMA, deixa ANBIMA dominar
                if anbima_first_date and d >= anbima_first_date:
                    continue
                combined[d] = t
            # 2. ANBIMA: sobrescreve onde existir (autoritativa)
            for d, t in anbima_series.get(venc, []):
                combined[d] = t
            # Filtra serie muito curta (< 10 obs)
            if len(combined) < 10:
                continue
            merged_series[venc] = [[d, v] for d, v in sorted(combined.items())]

        # Filtra so vencimentos que ainda nao venceram (data > 2 anos atras)
        cutoff_old = "2010-01-01"  # se vencimento ja eh pre-2010, ignora (irrelevante)
        merged_series = {v: s for v, s in merged_series.items() if v > cutoff_old}

        vencimentos_sorted = sorted(merged_series.keys())
        merged_categories[cat] = {
            "label": "Prefixado" if cat == "PRE" else "IPCA+",
            "vencimentos": vencimentos_sorted,
            "series": merged_series,
        }

    return {
        "status": "ok",
        "generated_at": datetime.now(tz=timezone.utc).isoformat(),
        "source": "ANBIMA (Mercado Secundario TPF, presente) + Tesouro Transparente (backfill historico)",
        "lookback_business_days": None,
        "days_loaded": None,
        "days_failed": None,
        "last_data_date": last_data_date or "",
        "backfill_first_date": min(
            (s[0][0] for cat in merged_categories.values() for s in cat["series"].values() if s),
            default=""
        ),
        "categories": merged_categories,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--anbima-json", default="data-pipeline/out/treasury_history.json",
                    help="JSON ANBIMA atual a fazer merge")
    ap.add_argument("--out", default="data-pipeline/out/treasury_history.json",
                    help="JSON de saida (sobrescreve por padrao)")
    ap.add_argument("--csv-cache", default="data-pipeline/out-local/tesouro_transparente.csv",
                    help="Path local pra cache do CSV (evita rebaixar)")
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--no-redownload", action="store_true", help="Usa cache se existir")
    args = ap.parse_args()

    csv_path = Path(args.csv_cache)
    csv_path.parent.mkdir(parents=True, exist_ok=True)

    if args.no_redownload and csv_path.exists() and csv_path.stat().st_size > 1024 * 1024:
        print(f"[backfill] usando cache existente {csv_path} ({csv_path.stat().st_size / 1024 / 1024:.1f} MB)")
    else:
        download_csv(csv_path)

    print("[backfill] parseando CSV...")
    rows = parse_csv_streaming(csv_path)
    print("[backfill] agregando series...")
    backfill = aggregate_to_series(rows)

    n_pre = len(backfill["PRE"])
    n_ipca = len(backfill["IPCA"])
    print(f"[backfill] backfill: PRE {n_pre} vencimentos, IPCA {n_ipca} vencimentos")

    print("[backfill] merge com ANBIMA...")
    merged = merge_with_anbima(backfill, Path(args.anbima_json))

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(merged, ensure_ascii=False), encoding="utf-8")
    size_mb = out_path.stat().st_size / 1024 / 1024
    print(f"[backfill] Gerado {out_path} ({size_mb:.2f} MB)")
    for cat_name, c in merged["categories"].items():
        total_obs = sum(len(s) for s in c["series"].values())
        first = min((s[0][0] for s in c["series"].values() if s), default="")
        last = max((s[-1][0] for s in c["series"].values() if s), default="")
        print(f"  {cat_name}: {len(c['vencimentos'])} vencs, {total_obs} obs, {first} .. {last}")

    if args.upload:
        maybe_upload_json(out_path, "data/treasury_history.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
