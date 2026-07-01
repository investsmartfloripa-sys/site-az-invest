#!/usr/bin/env python3
"""Fluxo de investidores em acoes na B3 (acumulado no ano, por perfil).

Fonte gratuita e oficial: Boletim Diario do Mercado da B3 (PDF, sem captcha)
  https://arquivos.b3.com.br/bdi/download/bdi/<AAAA-MM-DD>/BDI_02-0_<AAAAMMDD>.pdf

A tabela "Participacao dos investidores" traz Compras e Vendas (R$ mil) por
categoria, ACUMULADAS NO MES, com defasagem de ~2 dias uteis (D-2).
Fluxo do mes = Compras - Vendas. Acumulado no ano = soma dos meses fechados +
mes corrente (reseta em 1o/jan).

JANELA CRESCENTE: a B3 so mantem ~6 meses de boletins online. Para nao perder
historico, cada execucao faz MERGE APPEND-ONLY do arquivo ja salvo no Blob
(data/fluxo_investidores.json) com os dias recem-raspados. Dias antigos
permanecem para sempre; com o tempo o arquivo ultrapassa a janela de 6 meses.

Uso:
  python build_fluxo_investidores.py --out-dir data-pipeline/out --upload
  python build_fluxo_investidores.py --backfill --upload        # semeia a janela toda
  python build_fluxo_investidores.py --days 10 --upload         # incremental (cron)
"""
from __future__ import annotations

import argparse
import datetime as dt
import io
import re
import sys
import time
from pathlib import Path
from typing import Optional

import pdfplumber
import requests

sys.path.append(str(Path(__file__).parent))
from shared.blob_upload import maybe_upload_json  # noqa: E402
from shared.blob_download import download_json  # noqa: E402

BLOB_PATH = "data/fluxo_investidores.json"
URL = "https://arquivos.b3.com.br/bdi/download/bdi/{d}/BDI_02-0_{dc}.pdf"
UA = {"User-Agent": "Mozilla/5.0 (AZ Invest data-pipeline; dados publicos B3)"}

# Categoria na tabela do PDF -> rotulo canonico
CATS = {
    "Institucionais": "Institucional",
    "Institui": "Inst. Financeira",   # "Instituicoes Financeiras"
    "Estrangeiro": "Estrangeiro",      # "Investidor Estrangeiro"
    "Individuais": "Pessoa Fisica",    # "Investidores Individuais"
    "Outros": "Outros",
}
LABELS = ["Estrangeiro", "Institucional", "Inst. Financeira", "Pessoa Fisica", "Outros"]


# ----------------------------------------------------------------------------- scrape
def fetch_pdf_bytes(pub: str, retries: int = 4) -> Optional[bytes]:
    """GET com retry/backoff. A B3 devolve 500 sob carga (throttling), nao apenas
    quando o arquivo nao existe — sem retry o backfill fica cheio de buracos.
    Distingue throttling de ausencia real tentando algumas vezes com backoff."""
    dc = pub.replace("-", "")
    url = URL.format(d=pub, dc=dc)
    for attempt in range(retries):
        try:
            r = requests.get(url, headers=UA, timeout=90)
            if r.status_code == 200 and len(r.content) >= 1000:
                return r.content
            # 404 = nao existe (fim de semana/feriado); nao adianta repetir.
            if r.status_code == 404:
                return None
        except Exception:
            pass
        time.sleep(0.8 * (attempt + 1))  # backoff linear: 0.8s, 1.6s, 2.4s...
    return None


def parse_pdf(data: bytes) -> tuple[Optional[str], Optional[dict]]:
    """Retorna (as_of 'AAAA-MM-DD', {rotulo: {'c': compras_mil, 'v': vendas_mil}}).
    Tabela na pagina 0; em boletins de fim de mes (gigantes) cai na pag. ~3."""
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for p in pdf.pages[:8]:
            t = p.extract_text() or ""
            if not ("Participa" in t and "investidores" in t and "Compras" in t):
                continue
            m = re.search(r"dia\D*?(\d{2})/(\d{2})/(\d{4})", t)
            as_of = f"{m.group(3)}-{m.group(2)}-{m.group(1)}" if m else None
            rec: dict = {}
            for line in t.split("\n"):
                first2 = line.split(" ")[:2]
                for key, label in CATS.items():
                    if line.strip().startswith(key) or (key in first2):
                        # captura a virgula decimal junto p/ descartar as colunas de %
                        ints = [n for n in re.findall(r"\d[\d.]*(?:,\d+)?", line)
                                if "," not in n and "." in n]
                        if len(ints) >= 2:
                            rec[label] = {"c": int(ints[0].replace(".", "")),
                                          "v": int(ints[1].replace(".", ""))}
                        break
            if len(rec) >= 4:
                return as_of, rec
    return None, None


def collect(pub_dates: list[str], pace: float = 0.3) -> dict:
    """Raspa as datas de publicacao dadas; retorna {as_of: rec}.
    `pace` = pausa entre requisicoes (s). A B3 throttla acesso sustentado;
    no backfill use um pace maior (~1.2s) para nao perder dias."""
    out: dict = {}
    for pub in pub_dates:
        data = fetch_pdf_bytes(pub)
        time.sleep(pace)
        if not data:
            continue
        as_of, rec = parse_pdf(data)
        if as_of and rec:
            out[as_of] = rec
            est = (rec["Estrangeiro"]["c"] - rec["Estrangeiro"]["v"]) / 1e6
            print(f"  pub {pub} as_of={as_of} estrangeiro(mes)={est:+.2f} bi")
    return out


def daterange(start: dt.date, end: dt.date):
    d = start
    while d <= end:
        yield d.isoformat()
        d += dt.timedelta(days=1)


# ----------------------------------------------------------------------------- reconstruct
def reconstruct_year(records: dict, year: str) -> Optional[dict]:
    """Acumulado no ano (R$ bi) por categoria, em cada as_of do ano."""
    asofs = sorted(a for a in records if a[:4] == year)
    if not asofs:
        return None
    month_last = {}
    for a in asofs:
        month_last[a[:7]] = a  # ultimo as_of de cada mes (dict mantem ordem)
    month_total = {mk: records[a] for mk, a in month_last.items()}
    months = sorted(month_total)

    def net(rec, lb):
        x = rec.get(lb)
        return (x["c"] - x["v"]) if x else 0

    series = {lb: [] for lb in LABELS}
    for a in asofs:
        mk = a[:7]
        for lb in LABELS:
            base = sum(net(month_total[m], lb) for m in months if m < mk)
            series[lb].append(round((base + net(records[a], lb)) / 1e6, 2))
    return {"dates": asofs, "series": series, "labels": LABELS}


def build_payload(records: dict) -> dict:
    years = {}
    for y in sorted({a[:4] for a in records}):
        r = reconstruct_year(records, y)
        if r:
            years[y] = r
    return {
        "status": "ok",
        "generated_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "B3 - Boletim Diario do Mercado",
        "unit": "R$ bi",
        "lag_dias_uteis": 2,
        "data_date": max(records) if records else None,
        "records": dict(sorted(records.items())),
        "years": years,
    }


def merge_records(new: dict, existing: Optional[dict]) -> dict:
    """Uniao append-only por as_of (raspagem nova prevalece). E o que faz a janela crescer."""
    merged = {}
    if existing and isinstance(existing.get("records"), dict):
        merged.update(existing["records"])
    merged.update(new)
    return merged


# ----------------------------------------------------------------------------- main
def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default="data-pipeline/out")
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--backfill", action="store_true",
                    help="raspa toda a janela disponivel da B3 (~6 meses), diario")
    ap.add_argument("--days", type=int, default=10,
                    help="modo incremental: ultimos N dias de publicacao (default 10)")
    ap.add_argument("--pace", type=float, default=None,
                    help="pausa entre requisicoes (s); default 0.3 incremental, 1.2 backfill")
    ap.add_argument("--no-merge", action="store_true")
    args = ap.parse_args()

    today = dt.datetime.now(dt.timezone.utc).date()
    if args.backfill:
        start = today - dt.timedelta(days=200)  # ~6.5 meses cobre a janela da B3
        pub_dates = list(daterange(start, today))
        pace = args.pace if args.pace is not None else 1.2
        print(f"[fluxo] BACKFILL {start} -> {today} ({len(pub_dates)} dias, pace={pace}s)")
    else:
        pub_dates = list(daterange(today - dt.timedelta(days=args.days), today))
        pace = args.pace if args.pace is not None else 0.3
        print(f"[fluxo] INCREMENTAL ultimos {args.days} dias ({len(pub_dates)} datas)")

    scraped = collect(pub_dates, pace=pace)
    print(f"[fluxo] dias raspados: {len(scraped)}")

    if not scraped and not args.no_merge:
        # Nada novo (fim de semana/feriado): nao sobrescreve o arquivo existente.
        existing = download_json(BLOB_PATH)
        if existing:
            print("[fluxo] nada novo; mantem arquivo existente.")
            return 0

    import json
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "fluxo_investidores.json"

    existing = None
    if not args.no_merge:
        existing = download_json(BLOB_PATH)
        # Fallback: se o Blob ainda nao tem o arquivo, mescla com o output local
        # (permite backfills locais iterativos convergirem apesar do throttle da B3).
        if existing is None and out_path.exists():
            existing = json.loads(out_path.read_text(encoding="utf-8"))

    records = merge_records(scraped, existing)
    payload = build_payload(records)
    out_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    n_old = len((existing or {}).get("records", {})) if existing else 0
    print(f"[fluxo] arquivo: {len(records)} dias (antes {n_old}), "
          f"anos={list(payload['years'])}, data_date={payload['data_date']}")
    print(f"[fluxo] escreveu {out_path} ({out_path.stat().st_size:,} bytes)")

    if args.upload:
        maybe_upload_json(out_path, BLOB_PATH)
    else:
        print("[fluxo] --upload NAO setado; apenas salvou local.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
