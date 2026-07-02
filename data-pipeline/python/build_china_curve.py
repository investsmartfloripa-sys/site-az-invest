"""Curva soberana da CHINA (CGB) — ChinaBond/CCDC → Blob (merge append-only).

O endpoint do ChinaBond devolve a curva COMPLETA de um dia por request (JSON,
sem auth, só User-Agent de browser), mas: (a) 1 data por chamada; (b) a fonte
tem fama de instabilidade/bloqueio — por isso NUNCA é consultada ao vivo pela
página: este pipeline roda em cron, guarda no Blob (data/china_curve.json) e o
site lê de lá (mesmo padrão do fluxo de investidores B3).

Uso:
    python data-pipeline/python/build_china_curve.py --days 10 --upload
    python data-pipeline/python/build_china_curve.py --backfill-days 1900 --upload
"""
from __future__ import annotations

import argparse
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

BLOB_PATH = "data/china_curve.json"
YC_DEF_ID = "2c9081e50a2f9606010a3068cae70001"  # ChinaBond Government Bond Yield Curve (YTM)
URL = (
    "https://yield.chinabond.com.cn/cbweb-mn/yc/searchYc?xyzSelect=txy"
    "&workTimes={d}&dxbj=0&qxll=0,&yqqxN=N&yqqxK=K&ycDefIds=" + YC_DEF_ID + ",&wrjxCBFlag=0&locale=en_US"
)
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"}

# Prazos guardados (anos) — cobrem o comparador (1/2/5/10/20/30) + forma da curva.
TENORS_YEARS: List[float] = [1, 2, 3, 5, 7, 10, 15, 20, 30]


def fetch_day(d: date, session: requests.Session) -> Optional[List[Optional[float]]]:
    """Taxas nos TENORS_YEARS para uma data. None = sem dados (não útil/falha)."""
    try:
        r = session.post(URL.format(d=d.isoformat()), headers=UA, timeout=25)
        r.raise_for_status()
        arr = r.json()
    except Exception as e:  # noqa: BLE001
        print(f"[cgb] {d}: falha ({e})", file=sys.stderr)
        return None
    if not isinstance(arr, list) or not arr:
        return None
    series = arr[0].get("seriesData")
    if not isinstance(series, list) or len(series) < 10:
        return None
    by_tenor = {}
    for pt in series:
        if isinstance(pt, list) and len(pt) >= 2 and isinstance(pt[0], (int, float)) and isinstance(pt[1], (int, float)):
            by_tenor[round(float(pt[0]), 1)] = float(pt[1])
    out: List[Optional[float]] = []
    for t in TENORS_YEARS:
        v = by_tenor.get(round(t, 1))
        out.append(round(v, 4) if v is not None else None)
    return out if sum(1 for v in out if v is not None) >= 5 else None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=10, help="dias corridos recentes a buscar")
    ap.add_argument("--backfill-days", type=int, default=0, help="dias corridos p/ trás (seed histórico)")
    ap.add_argument("--pace", type=float, default=0.45, help="pausa entre requests (fonte frágil)")
    ap.add_argument("--out-dir", default="data-pipeline/out")
    ap.add_argument("--upload", action="store_true")
    args = ap.parse_args()

    prev = download_json(BLOB_PATH)
    dates_map: Dict[str, List[Optional[float]]] = {}
    if isinstance(prev, dict) and isinstance(prev.get("dates"), dict):
        dates_map = dict(prev["dates"])
        print(f"[cgb] Blob atual: {len(dates_map)} datas")

    span = args.backfill_days if args.backfill_days > 0 else args.days
    today = date.today()
    added = 0
    misses_seq = 0
    with requests.Session() as s:
        for i in range(span):
            d = today - timedelta(days=i)
            if d.weekday() >= 5:
                continue  # ChinaBond não publica fim de semana (feriados CN retornam vazio)
            iso = d.isoformat()
            if iso in dates_map:
                continue
            vals = fetch_day(d, s)
            if vals:
                dates_map[iso] = vals
                added += 1
                misses_seq = 0
                if added % 50 == 0:
                    print(f"[cgb] +{added} datas (última: {iso})")
            else:
                misses_seq += 1
                # 20 dias úteis seguidos sem resposta = bloqueio/fora do ar → para
                # (o que já foi coletado é preservado pelo merge).
                if misses_seq >= 20:
                    print("[cgb] 20 misses seguidos — interrompendo o run (merge preserva o coletado)", file=sys.stderr)
                    break
            time.sleep(args.pace)

    payload = {
        "status": "ok" if dates_map else "error",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "ChinaBond/CCDC — Government Bond Yield Curve (YTM)",
        "tenors_years": TENORS_YEARS,
        "schema": "dates[iso] = [taxa % a.a. em cada tenor, null se ausente]",
        "dates": dict(sorted(dates_map.items())),
    }
    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    p = out / "china_curve.json"
    p.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(f"[cgb] {p} ({p.stat().st_size:,} bytes) — +{added} novas, total {len(dates_map)}")

    if payload["status"] == "error":
        return 1
    if args.upload:
        maybe_upload_json(p, BLOB_PATH)
    return 0


if __name__ == "__main__":
    sys.exit(main())
