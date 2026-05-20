"""Build do JSON do Painel Fiscal — clássicos brasileiros.

Estratégia anti-rate-limit:
- DIÁRIAS primeiro (reservas, Selic) antes do BCB SGS rate-limitar
- Depois MENSAIS

Convenção contábil:
- NFSP positivo = déficit do SP. NFSP = -primário + juros nominais.
- Juros nominais positivo. Primário positivo = superávit.
- Logo: primário = juros - NFSP
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from shared.blob_upload import maybe_upload_json  # noqa: E402

DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/fiscal-classicos.json"

UA = {"User-Agent": "Mozilla/5.0 (compatible; az-invest-fiscal/0.1)"}


def _get(url, *, timeout=60, retries=4, sleep=4.0):
    last = None
    for i in range(retries):
        try:
            r = requests.get(url, timeout=timeout, headers=UA)
            if r.status_code in (406, 429, 502, 503, 504):
                backoff = (i + 1) * sleep
                print(f"  HTTP {r.status_code} (backoff {backoff:.0f}s)", file=sys.stderr)
                time.sleep(backoff)
                continue
            r.raise_for_status()
            return r
        except Exception as e:
            last = e
            print(f"  retry {i + 1}/{retries}: {e}", file=sys.stderr)
            time.sleep((i + 1) * 2)
    raise RuntimeError(f"falha após {retries} tentativas: {last}")


def _to_float(v):
    if v in ("", "-", "..", "...", None):
        return None
    try:
        return float(str(v).replace(",", "."))
    except (TypeError, ValueError):
        return None


def _parse_sgs_date(s):
    d, m, y = s.split("/")
    return f"{y}-{m}"


def _parse_sgs_full_date(s):
    d, m, y = s.split("/")
    return f"{y}-{m}-{d}"


SGS_URL_FULL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{cod}/dados?formato=json"
SGS_URL_FROM = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{cod}/dados?formato=json&dataInicial={inicio}"


def sgs_fetch(cod, *, daily=False, since=None):
    url = SGS_URL_FROM.format(cod=cod, inicio=since) if since else SGS_URL_FULL.format(cod=cod)
    print(f"  [SGS {cod}] {url}")
    try:
        data = _get(url).json()
    except Exception as e:
        print(f"  [SGS {cod}] FALHA: {e}; lista vazia", file=sys.stderr)
        return []
    parser = _parse_sgs_full_date if daily else _parse_sgs_date
    out = []
    for r in data:
        try:
            out.append({"data": parser(r["data"]), "valor": _to_float(r["valor"])})
        except Exception:
            continue
    return out


FOCUS_BASE = "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata"


def focus_anuais(indicador, ano_atual):
    indicador_url = indicador.replace(" ", "%20")
    url = (
        f"{FOCUS_BASE}/ExpectativasMercadoAnuais?$format=json&$top=20000"
        f"&$filter=Indicador%20eq%20%27{indicador_url}%27%20and%20Data%20ge%20%27{ano_atual - 1}-01-01%27"
        f"&$orderby=Data%20desc"
    )
    print(f"  [Focus {indicador}]")
    try:
        data = _get(url, timeout=90).json().get("value", [])
    except Exception as e:
        print(f"  [Focus {indicador}] FALHA: {e}", file=sys.stderr)
        return {}
    out = {}
    for r in data:
        try:
            ano = int(r["DataReferencia"])
        except (KeyError, ValueError):
            continue
        if ano not in (ano_atual, ano_atual + 1, ano_atual + 2, ano_atual + 3):
            continue
        out.setdefault(ano, []).append({
            "data": r.get("Data", "")[:10],
            "mediana": _to_float(r.get("Mediana")),
            "media": _to_float(r.get("Media")),
            "dp": _to_float(r.get("DesvioPadrao")),
            "min": _to_float(r.get("Minimo")),
            "max": _to_float(r.get("Maximo")),
        })
    for ano in out:
        out[ano].sort(key=lambda x: x["data"])
        out[ano] = out[ano][-365:]
    return out


def selic_real_ex_post(selic_diaria, ipca_mensal):
    selic_por_mes = {}
    for r in selic_diaria:
        if r["valor"] is None:
            continue
        selic_por_mes[r["data"][:7]] = r["valor"]
    out = []
    for r in ipca_mensal:
        if r["valor"] is None:
            continue
        s = selic_por_mes.get(r["data"])
        if s is None:
            continue
        real = ((1 + s / 100) / (1 + r["valor"] / 100) - 1) * 100
        out.append({"data": r["data"], "selic_nominal_pct": s, "ipca_12m_pct": r["valor"], "selic_real_pct": round(real, 4)})
    return out


def derivar_primario_de_nfsp_juros(nfsp_pct, juros_pct):
    """Primário 12m %PIB = juros_nominais - NFSP. Positivo = superávit primário."""
    juros_map = {r["data"]: r["valor"] for r in juros_pct}
    out = []
    for r in nfsp_pct:
        j = juros_map.get(r["data"])
        if j is None or r["valor"] is None:
            continue
        primario = j - r["valor"]
        out.append({"data": r["data"], "valor_pct": round(primario, 4)})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--no-merge", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "fiscal-classicos.json"

    # --- DIÁRIAS PRIMEIRO (antes do rate-limit) ---
    print("== [1/3] DIÁRIAS ==")
    print("-- Reservas USD MM (SGS 13621) --")
    reservas_diaria = sgs_fetch(13621, daily=True, since="01/01/2018")
    print(f"   {len(reservas_diaria)} obs")
    time.sleep(2)

    print("-- Selic diária %a.a. (SGS 1178) --")
    selic_diaria = sgs_fetch(1178, daily=True, since="01/01/2018")
    print(f"   {len(selic_diaria)} obs")
    time.sleep(2)

    # --- MENSAIS ---
    print("== [2/3] MENSAIS ==")
    print("-- DBGG %PIB (13762) --")
    dbgg = sgs_fetch(13762)
    print(f"   {len(dbgg)} obs")
    time.sleep(0.4)

    print("-- DLSP total %PIB (4513) --")
    dlsp = sgs_fetch(4513)
    time.sleep(0.4)

    print("-- DLSP gov central %PIB (4503) --")
    dlsp_central = sgs_fetch(4503)
    time.sleep(0.4)

    print("-- NFSP SP 12m %PIB (5727) --")
    nfsp_pct = sgs_fetch(5727)
    time.sleep(0.4)

    print("-- Juros nominais SP 12m %PIB (5718) --")
    juros_nominais_pct = sgs_fetch(5718)
    time.sleep(0.4)

    print("-- NFSP gov central 12m %PIB (5717) --")
    nfsp_central_pct = sgs_fetch(5717)
    time.sleep(0.4)

    print("-- Juros nominais gov central 12m %PIB (5728) --")
    juros_central_pct = sgs_fetch(5728)
    time.sleep(0.4)

    print("-- PIB 12m R$ MM (4382) --")
    pib_12m_sgs = sgs_fetch(4382)
    print(f"   último: {pib_12m_sgs[-1] if pib_12m_sgs else 'vazio'}")
    time.sleep(0.4)

    print("-- REER (11752) --")
    reer = sgs_fetch(11752)
    time.sleep(0.4)

    print("-- IPCA 12m (13522) --")
    ipca_12m = sgs_fetch(13522)
    time.sleep(0.4)

    # --- Cálculos ---
    print("== [3/3] DERIVADOS ==")
    reservas_mensal_d = {}
    for r in reservas_diaria:
        if r["valor"] is None:
            continue
        reservas_mensal_d[r["data"][:7]] = r["valor"]
    reservas_mensal = [{"data": k, "valor": v} for k, v in sorted(reservas_mensal_d.items())]

    primario_sp_pct = derivar_primario_de_nfsp_juros(nfsp_pct, juros_nominais_pct)
    primario_central_pct = derivar_primario_de_nfsp_juros(nfsp_central_pct, juros_central_pct)
    nominal_pct = [{"data": r["data"], "valor_pct": -r["valor"] if r["valor"] is not None else None} for r in nfsp_pct]

    selic_real = selic_real_ex_post(selic_diaria, ipca_12m)
    pib_12m_brl_recente = pib_12m_sgs[-1]["valor"] if pib_12m_sgs else None

    ano_atual = datetime.now(timezone.utc).year
    print(f"-- Focus ({ano_atual}-{ano_atual + 3}) --")
    focus_selic = focus_anuais("Selic", ano_atual)
    focus_ipca = focus_anuais("IPCA", ano_atual)
    focus_pib = focus_anuais("PIB Total", ano_atual)
    focus_cambio = focus_anuais("Câmbio", ano_atual)

    payload = {
        "gerado_em": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "mes_recente": dbgg[-1]["data"] if dbgg else None,
        "pib_nominal_12m_brl_milhoes": pib_12m_brl_recente,
        "divida": {
            "dbgg_pct": dbgg,
            "dlsp_total_pct": dlsp,
            "dlsp_gov_central_pct": dlsp_central,
        },
        "resultado_fiscal": {
            "primario_sp_12m_pct_pib": primario_sp_pct,
            "primario_central_12m_pct_pib": primario_central_pct,
            "juros_nominais_sp_12m_pct_pib": juros_nominais_pct,
            "juros_nominais_central_12m_pct_pib": juros_central_pct,
            "nfsp_sp_12m_pct_pib": nfsp_pct,
            "nfsp_central_12m_pct_pib": nfsp_central_pct,
            "nominal_sp_12m_pct_pib": nominal_pct,
        },
        "stress": {
            "reer_index": reer,
            "reservas_usd_mm_mensal": reservas_mensal,
        },
        "monetaria": {
            "selic_diaria_pct": selic_diaria[-730:],
            "ipca_12m_pct": ipca_12m,
            "selic_real_ex_post_pct": selic_real,
        },
        "pib": {
            "acumulado_12m_brl_milhoes_mensal": pib_12m_sgs,
        },
        "expectativas_focus": {
            "selic_anuais": {str(k): v for k, v in focus_selic.items()},
            "ipca_anuais": {str(k): v for k, v in focus_ipca.items()},
            "pib_anuais": {str(k): v for k, v in focus_pib.items()},
            "cambio_anuais": {str(k): v for k, v in focus_cambio.items()},
        },
        "destaques": {
            "dbgg_pct_recente": dbgg[-1] if dbgg else None,
            "dlsp_pct_recente": dlsp[-1] if dlsp else None,
            "primario_sp_12m_pct_recente": primario_sp_pct[-1] if primario_sp_pct else None,
            "primario_central_12m_pct_recente": primario_central_pct[-1] if primario_central_pct else None,
            "juros_nominais_sp_12m_pct_recente": (juros_nominais_pct[-1] if juros_nominais_pct else None),
            "nfsp_sp_12m_pct_recente": nfsp_pct[-1] if nfsp_pct else None,
            "nominal_sp_12m_pct_recente": nominal_pct[-1] if nominal_pct else None,
            "reer_recente": reer[-1] if reer else None,
            "reservas_usd_recente": reservas_mensal[-1] if reservas_mensal else None,
            "selic_real_recente": selic_real[-1] if selic_real else None,
        },
    }

    out_file.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    size = out_file.stat().st_size
    print(f"\n  -> {out_file} ({size} bytes = {size / 1024:.1f} KB)")

    if args.upload:
        maybe_upload_json(out_file, BLOB_PATH)


if __name__ == "__main__":
    main()
