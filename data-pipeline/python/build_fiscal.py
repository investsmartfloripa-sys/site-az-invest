"""Build do JSON do Painel Fiscal — clássicos brasileiros (receita, gastos, dívida).

Fontes:
- BCB SGS (DBGG, DLSP, primário/juros/NFSP % PIB, REER, Selic, IPCA, PIB nominal, PIB real)
- BCB Olinda (Focus — Selic, IPCA, PIB, Câmbio)
- Tesouro Nacional RTN (XLSX): receita líquida, despesa primária, juros nominais do
  GOVERNO CENTRAL — séries mensais R$ MM desde 1997

Output: data-pipeline/out/fiscal-classicos.json + upload Blob em data/fiscal-classicos.json

Convenção contábil:
- Primário positivo = SUPERÁVIT (convenção STN/BCB)
- NFSP positivo = DÉFICIT (oposto do primário) — convenção BCB SGS
- Juros nominais no RTN vêm negativos (saídas); convertemos pra positivo (custo)
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path

import requests
from openpyxl import load_workbook

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from shared.blob_upload import maybe_upload_json  # noqa: E402

DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/fiscal-classicos.json"

UA = {"User-Agent": "Mozilla/5.0 (compatible; az-invest-fiscal/0.2)"}


def _get(url, *, timeout=60, retries=4, sleep=4.0):
    last = None
    for i in range(retries):
        try:
            r = requests.get(url, timeout=timeout, headers=UA)
            if r.status_code in (406, 429, 502, 503, 504):
                time.sleep((i + 1) * sleep)
                continue
            r.raise_for_status()
            return r
        except Exception as e:
            last = e
            time.sleep((i + 1) * 2)
    raise RuntimeError(f"falha apos {retries}: {last}")


def _to_float(v):
    if v in ("", "-", "..", "...", None):
        return None
    try:
        return float(str(v).replace(",", "."))
    except (TypeError, ValueError):
        return None


def _parse_sgs(s, daily=False):
    d, m, y = s.split("/")
    return f"{y}-{m}-{d}" if daily else f"{y}-{m}"


SGS_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{cod}/dados?formato=json"
SGS_URL_FROM = SGS_URL + "&dataInicial={inicio}"


def sgs_fetch(cod, *, daily=False, since=None):
    url = SGS_URL_FROM.format(cod=cod, inicio=since) if since else SGS_URL.format(cod=cod)
    print(f"  [SGS {cod}]")
    try:
        data = _get(url).json()
    except Exception as e:
        print(f"  [SGS {cod}] FALHA: {e}", file=sys.stderr)
        return []
    out = []
    for r in data:
        try:
            out.append({"data": _parse_sgs(r["data"], daily), "valor": _to_float(r["valor"])})
        except Exception:
            continue
    return out


# Tesouro RTN — XLSX dinâmico do SISWEB
RTN_URL = "http://sisweb.tesouro.gov.br/apex/cosis/thot/link/rtn/serie-historica?conteudo=cdn"

RTN_LINHAS = {
    "receita_total": 6,
    "transferencias": 29,
    "receita_liquida": 38,
    "despesa_total": 39,
    "previdencia": 40,
    "pessoal": 41,
    "outras_obrigatorias": 42,
    "abono_seguro": 43,           # 4.3.01 Abono e Seguro Desemprego
    "bpc_loas": 47,               # 4.3.05 Benefícios LOAS/RMV
    "fundeb": 52,                 # 4.3.10 FUNDEB
    "subsidios": 57,              # 4.3.15 Subsídios, subvenções, Proagro
    "discricionarias": 65,
    "primario_acima": 66,
    "juros_nominais": 74,
    "nominal": 75,
}


def baixa_rtn_xlsx():
    print(f"  [Tesouro RTN] baixando")
    r = _get(RTN_URL, timeout=60)
    return BytesIO(r.content)


def parse_rtn(xlsx_stream):
    wb = load_workbook(xlsx_stream, data_only=True, read_only=True)
    sh = wb["1.1"]
    header = next(sh.iter_rows(min_row=5, max_row=5, values_only=True))
    datas_idx = []
    for i, h in enumerate(header[1:], 1):
        if h:
            try:
                if hasattr(h, "year"):
                    datas_idx.append((i, f"{h.year:04d}-{h.month:02d}"))
                else:
                    datas_idx.append((i, str(h)[:7]))
            except Exception:
                continue

    series = {k: [] for k in RTN_LINHAS}
    for chave, row_num in RTN_LINHAS.items():
        row = next(sh.iter_rows(min_row=row_num, max_row=row_num, values_only=True))
        for i, mes in datas_idx:
            v = row[i] if i < len(row) else None
            if v in ("", None):
                continue
            try:
                vf = float(v)
                if chave == "juros_nominais":
                    vf = -vf  # flip pra positivo (custo)
                series[chave].append({"data": mes, "valor": round(vf, 2)})
            except (TypeError, ValueError):
                continue
    return series


# Focus
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


def soma_12m(serie):
    if len(serie) < 12:
        return []
    serie = sorted(serie, key=lambda x: x["data"])
    out = []
    for i in range(11, len(serie)):
        window = serie[i - 11:i + 1]
        vals = [w["valor"] for w in window if w["valor"] is not None]
        if len(vals) < 12:
            continue
        out.append({"data": serie[i]["data"], "valor_12m": round(sum(vals), 2)})
    return out


def divide_por_pib(serie_12m, pib_map):
    if not pib_map:
        return []
    meses_pib = sorted(pib_map.keys())
    out = []
    ultimo_pib = None
    cur_idx = 0
    for r in sorted(serie_12m, key=lambda x: x["data"]):
        while cur_idx < len(meses_pib) and meses_pib[cur_idx] <= r["data"]:
            ultimo_pib = pib_map[meses_pib[cur_idx]]
            cur_idx += 1
        if ultimo_pib is None or ultimo_pib == 0:
            continue
        out.append({"data": r["data"], "valor_pct": round(r["valor_12m"] / ultimo_pib * 100, 4)})
    return out


def divide_por_receita(serie_12m, receita_12m):
    rmap = {r["data"]: r["valor_12m"] for r in receita_12m}
    out = []
    for r in serie_12m:
        rec = rmap.get(r["data"])
        if rec is None or rec == 0:
            continue
        out.append({"data": r["data"], "valor_pct": round(r["valor_12m"] / rec * 100, 4)})
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


def pib_real_yoy(pib_real_idx):
    out = []
    idx_map = {r["data"]: r["valor"] for r in pib_real_idx if r["valor"] is not None}
    meses = sorted(idx_map.keys())
    for mes in meses:
        y, m = mes.split("-")
        ant = f"{int(y) - 1}-{m}"
        if ant in idx_map and idx_map[ant]:
            yoy = (idx_map[mes] / idx_map[ant] - 1) * 100
            out.append({"data": mes, "valor_yoy_pct": round(yoy, 4)})
    return out


def last_val(serie, key="valor"):
    for r in reversed(serie):
        v = r.get(key)
        if v is not None:
            return r
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--no-merge", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "fiscal-classicos.json"

    print("== [1/4] Tesouro RTN (XLSX) ==")
    rtn_data = parse_rtn(baixa_rtn_xlsx())
    print(f"  Receita liquida: {len(rtn_data['receita_liquida'])} obs")

    print("\n== [2/4] BCB SGS diarias ==")
    reservas_diaria = sgs_fetch(13621, daily=True, since="01/01/2018")
    time.sleep(2)
    selic_diaria = sgs_fetch(1178, daily=True, since="01/01/2018")
    time.sleep(2)

    print("\n== [3/4] BCB SGS mensais ==")
    series_mensal = {
        "dbgg": 13762, "dlsp_total": 4513, "dlsp_gov_central": 4503,
        "nfsp_sp": 5727, "nfsp_central": 5717,
        "juros_sp_pct": 5718, "juros_central_pct": 5728,
        "pib_12m_brl": 4382, "reer": 11752,
        "ipca_12m": 13522, "pib_real_idx": 22099,
    }
    sgs = {}
    for nome, cod in series_mensal.items():
        sgs[nome] = sgs_fetch(cod)
        time.sleep(0.4)

    print("\n== [4/4] Derivados ==")
    reservas_mensal = {}
    for r in reservas_diaria:
        if r["valor"] is None:
            continue
        reservas_mensal[r["data"][:7]] = r["valor"]
    reservas_mensal = [{"data": k, "valor": v} for k, v in sorted(reservas_mensal.items())]

    pib_map = {r["data"]: r["valor"] for r in sgs["pib_12m_brl"] if r["valor"] is not None}

    receita_liquida_12m = soma_12m(rtn_data["receita_liquida"])
    despesa_total_12m = soma_12m(rtn_data["despesa_total"])
    primario_central_12m = soma_12m(rtn_data["primario_acima"])
    juros_central_12m = soma_12m(rtn_data["juros_nominais"])
    previdencia_12m = soma_12m(rtn_data["previdencia"])
    pessoal_12m = soma_12m(rtn_data["pessoal"])
    outras_obrig_12m = soma_12m(rtn_data["outras_obrigatorias"])
    discricionarias_12m = soma_12m(rtn_data["discricionarias"])
    abono_seguro_12m = soma_12m(rtn_data["abono_seguro"])
    bpc_loas_12m = soma_12m(rtn_data["bpc_loas"])
    fundeb_12m = soma_12m(rtn_data["fundeb"])
    subsidios_12m = soma_12m(rtn_data["subsidios"])

    receita_pct_pib = divide_por_pib(receita_liquida_12m, pib_map)
    despesa_pct_pib = divide_por_pib(despesa_total_12m, pib_map)
    primario_central_pct_pib = divide_por_pib(primario_central_12m, pib_map)
    juros_central_pct_pib = divide_por_pib(juros_central_12m, pib_map)
    previdencia_pct_pib = divide_por_pib(previdencia_12m, pib_map)
    pessoal_pct_pib = divide_por_pib(pessoal_12m, pib_map)

    despesa_pct_rec = divide_por_receita(despesa_total_12m, receita_liquida_12m)
    juros_pct_rec = divide_por_receita(juros_central_12m, receita_liquida_12m)
    primario_pct_rec = divide_por_receita(primario_central_12m, receita_liquida_12m)
    previdencia_pct_rec = divide_por_receita(previdencia_12m, receita_liquida_12m)
    pessoal_pct_rec = divide_por_receita(pessoal_12m, receita_liquida_12m)

    # Decomposicao expandida de despesa (% PIB)
    abono_seguro_pct_pib = divide_por_pib(abono_seguro_12m, pib_map)
    bpc_pct_pib = divide_por_pib(bpc_loas_12m, pib_map)
    fundeb_pct_pib = divide_por_pib(fundeb_12m, pib_map)
    subsidios_pct_pib = divide_por_pib(subsidios_12m, pib_map)
    discricionarias_pct_pib = divide_por_pib(discricionarias_12m, pib_map)
    outras_obrig_pct_pib = divide_por_pib(outras_obrig_12m, pib_map)

    # Decomposicao expandida (% Receita liquida)
    abono_seguro_pct_rec = divide_por_receita(abono_seguro_12m, receita_liquida_12m)
    bpc_pct_rec = divide_por_receita(bpc_loas_12m, receita_liquida_12m)
    fundeb_pct_rec = divide_por_receita(fundeb_12m, receita_liquida_12m)
    subsidios_pct_rec = divide_por_receita(subsidios_12m, receita_liquida_12m)
    discricionarias_pct_rec = divide_por_receita(discricionarias_12m, receita_liquida_12m)
    outras_obrig_pct_rec = divide_por_receita(outras_obrig_12m, receita_liquida_12m)

    selic_real = selic_real_ex_post(selic_diaria, sgs["ipca_12m"])
    pib_real_yoy_serie = pib_real_yoy(sgs["pib_real_idx"])

    ano_atual = datetime.now(timezone.utc).year
    focus_selic = focus_anuais("Selic", ano_atual)
    focus_ipca = focus_anuais("IPCA", ano_atual)
    focus_pib = focus_anuais("PIB Total", ano_atual)
    focus_cambio = focus_anuais("Câmbio", ano_atual)

    pib_12m_recente = sgs["pib_12m_brl"][-1]["valor"] if sgs["pib_12m_brl"] else None

    nominal_sp_pct = [{"data": r["data"], "valor_pct": -r["valor"] if r["valor"] is not None else None} for r in sgs["nfsp_sp"]]
    primario_sp_pct = []
    juros_sp_map = {r["data"]: r["valor"] for r in sgs["juros_sp_pct"]}
    for r in sgs["nfsp_sp"]:
        j = juros_sp_map.get(r["data"])
        if j is None or r["valor"] is None:
            continue
        primario_sp_pct.append({"data": r["data"], "valor_pct": round(j - r["valor"], 4)})

    payload = {
        "gerado_em": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "mes_recente": sgs["dbgg"][-1]["data"] if sgs["dbgg"] else None,
        "pib_nominal_12m_brl_milhoes": pib_12m_recente,
        "divida": {
            "dbgg_pct_pib": sgs["dbgg"],
            "dlsp_total_pct_pib": sgs["dlsp_total"],
            "dlsp_gov_central_pct_pib": sgs["dlsp_gov_central"],
        },
        "receita_e_gastos": {
            "receita_liquida_12m_brl_mm": receita_liquida_12m,
            "despesa_total_12m_brl_mm": despesa_total_12m,
            "primario_central_12m_brl_mm": primario_central_12m,
            "juros_central_12m_brl_mm": juros_central_12m,
            "receita_liquida_pct_pib": receita_pct_pib,
            "despesa_total_pct_pib": despesa_pct_pib,
            "primario_central_pct_pib": primario_central_pct_pib,
            "juros_central_pct_pib": juros_central_pct_pib,
            "despesa_pct_receita": despesa_pct_rec,
            "juros_pct_receita": juros_pct_rec,
            "primario_pct_receita": primario_pct_rec,
            "previdencia_12m_pct_pib": previdencia_pct_pib,
            "pessoal_12m_pct_pib": pessoal_pct_pib,
            "previdencia_12m_pct_receita": previdencia_pct_rec,
            "pessoal_12m_pct_receita": pessoal_pct_rec,
            "discricionarias_12m_brl_mm": discricionarias_12m,
            "outras_obrigatorias_12m_brl_mm": outras_obrig_12m,
            "abono_seguro_12m_pct_pib": abono_seguro_pct_pib,
            "bpc_loas_12m_pct_pib": bpc_pct_pib,
            "fundeb_12m_pct_pib": fundeb_pct_pib,
            "subsidios_12m_pct_pib": subsidios_pct_pib,
            "discricionarias_12m_pct_pib": discricionarias_pct_pib,
            "outras_obrigatorias_12m_pct_pib": outras_obrig_pct_pib,
            "abono_seguro_12m_pct_receita": abono_seguro_pct_rec,
            "bpc_loas_12m_pct_receita": bpc_pct_rec,
            "fundeb_12m_pct_receita": fundeb_pct_rec,
            "subsidios_12m_pct_receita": subsidios_pct_rec,
            "discricionarias_12m_pct_receita": discricionarias_pct_rec,
            "outras_obrigatorias_12m_pct_receita": outras_obrig_pct_rec,
            "nfsp_sp_12m_pct_pib": sgs["nfsp_sp"],
            "primario_sp_12m_pct_pib": primario_sp_pct,
            "juros_nominais_sp_12m_pct_pib": sgs["juros_sp_pct"],
            "nominal_sp_12m_pct_pib": nominal_sp_pct,
        },
        "monetaria": {
            "selic_diaria_pct": selic_diaria[-730:],
            "ipca_12m_pct": sgs["ipca_12m"],
            "selic_real_ex_post_pct": selic_real,
            "pib_real_yoy_pct": pib_real_yoy_serie,
        },
        "stress": {
            "reer_index": sgs["reer"],
            "reservas_usd_mm_mensal": reservas_mensal,
        },
        "pib": {
            "acumulado_12m_brl_milhoes_mensal": sgs["pib_12m_brl"],
            "real_idx": sgs["pib_real_idx"],
        },
        "expectativas_focus": {
            "selic_anuais": {str(k): v for k, v in focus_selic.items()},
            "ipca_anuais": {str(k): v for k, v in focus_ipca.items()},
            "pib_anuais": {str(k): v for k, v in focus_pib.items()},
            "cambio_anuais": {str(k): v for k, v in focus_cambio.items()},
        },
        "metas_ldo": {
            "_fonte": "LDO anuais (PLP 192/2023 e revisoes). Convenção: positivo = superávit primario do governo central, em % PIB. Banda ±0,25pp ao redor do centro segundo arcabouco fiscal (LC 200/2023).",
            "anos": {
                "2023": {"centro": -1.95, "banda_inf": -2.20, "banda_sup": -1.70},
                "2024": {"centro": 0.00, "banda_inf": -0.25, "banda_sup": 0.25},
                "2025": {"centro": 0.25, "banda_inf": 0.00, "banda_sup": 0.50},
                "2026": {"centro": 0.50, "banda_inf": 0.25, "banda_sup": 0.75},
                "2027": {"centro": 0.75, "banda_inf": 0.50, "banda_sup": 1.00}
            }
        },
        "destaques": {
            "dbgg_pct_recente": last_val(sgs["dbgg"]),
            "dlsp_pct_recente": last_val(sgs["dlsp_total"]),
            "receita_liquida_pct_pib_recente": last_val(receita_pct_pib, "valor_pct"),
            "despesa_total_pct_pib_recente": last_val(despesa_pct_pib, "valor_pct"),
            "primario_central_pct_pib_recente": last_val(primario_central_pct_pib, "valor_pct"),
            "juros_central_pct_pib_recente": last_val(juros_central_pct_pib, "valor_pct"),
            "juros_pct_receita_recente": last_val(juros_pct_rec, "valor_pct"),
            "primario_pct_receita_recente": last_val(primario_pct_rec, "valor_pct"),
            "nfsp_sp_pct_recente": last_val(sgs["nfsp_sp"]),
            "reer_recente": last_val(sgs["reer"]),
            "reservas_usd_recente": last_val(reservas_mensal),
            "selic_real_recente": last_val(selic_real, "selic_real_pct"),
            "pib_real_yoy_recente": last_val(pib_real_yoy_serie, "valor_yoy_pct"),
            "ipca_12m_recente": last_val(sgs["ipca_12m"]),
        },
    }

    out_file.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    size = out_file.stat().st_size
    print(f"\n  -> {out_file} ({size / 1024:.1f} KB)")

    if args.upload:
        maybe_upload_json(out_file, BLOB_PATH)


if __name__ == "__main__":
    main()
