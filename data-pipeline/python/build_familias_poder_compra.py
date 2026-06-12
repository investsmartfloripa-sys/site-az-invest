"""Build do JSON Painel Familias - Poder de Compra (C)."""
from __future__ import annotations
import argparse, json, sys, time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
import requests

HERE = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/familias_poder_compra.json"
UA = {"User-Agent": "az-invest-familias-poder-compra/0.1"}
SGS_BASE = "https://api.bcb.gov.br/dados/serie/bcdata.sgs"
IPEA_BASE = "http://www.ipeadata.gov.br/api/odata4/ValoresSerie"
HORAS_MES_PADRAO = 220.0

CAPITAIS_CODIGOS = {
    "1100205","1200401","1302603","1400100","1501402","1600303",
    "1721000","2111300","2211001","2304400","2408102","2507507",
    "2611606","2704302","2800308","2927408","3106200","3205309",
    "3304557","3550308","4106902","4205407","4314902","5002704",
    "5103403","5208707","5300108",
}


def _get(url, *, timeout=60, retries=3, sleep=3.0):
    last = None
    for i in range(retries):
        try:
            r = requests.get(url, timeout=timeout, headers=UA)
            r.raise_for_status()
            return r
        except Exception as e:
            last = e
            print(f"  retry {i+1}/{retries}: {e}", file=sys.stderr)
            time.sleep(sleep)
    raise RuntimeError(f"falha apos {retries} tentativas: {last}")


def _to_float(v):
    if v in ("", "-", "..", "...", None): return None
    try: return float(str(v).replace(",", "."))
    except: return None


def _br_date_to_iso(d):
    try:
        dd, mm, yy = d.split("/")
        return f"{yy}-{mm.zfill(2)}-{dd.zfill(2)}"
    except: return d


def _ym(d): return d[:7] if d and len(d) >= 7 else d


def sgs_serie_mensal(code):
    url = f"{SGS_BASE}.{code}/dados?formato=json"
    print(f"  [SGS {code}]")
    try: rows = _get(url).json()
    except Exception as e:
        print(f"  [SGS {code}] FAIL: {e}", file=sys.stderr)
        return {}
    out = {}
    for r in rows:
        d = _br_date_to_iso(r.get("data", ""))
        v = _to_float(r.get("valor"))
        if d: out[_ym(d)] = v
    return out


def ipea_serie_mensal(serid):
    url = f"{IPEA_BASE}(SERCODIGO='{serid}')"
    print(f"  [IPEA {serid}]")
    try: rows = _get(url, timeout=90).json().get("value", [])
    except Exception as e:
        print(f"  [IPEA {serid}] FAIL: {e}", file=sys.stderr)
        return {}
    out = {}
    for r in rows:
        niv = r.get("NIVNOME") or ""
        if niv and niv != "Brasil": continue
        d_raw = r.get("VALDATA", "")
        v_raw = r.get("VALVALOR")
        if not d_raw or v_raw is None: continue
        try: out[_ym(d_raw[:10])] = float(v_raw)
        except: out[_ym(d_raw[:10])] = None
    return out


def ipea_cesta_basica_media_capitais(serid="CESBTOTAL", desde="2010-01", presenca_min=0.9):
    """v2: PAINEL FIXO de capitais. A cobertura do DIEESE oscilou (27 capitais só em
    2015-18 e 2025+; ~17 no resto) — a média com min_cobertura=20 produzia uma série
    de 46 pontos com um BURACO de ~6,5 anos que o eixo do gráfico emendava em linha
    contínua (desinformação silenciosa). O painel = capitais presentes em >=90% dos
    meses desde 2010; a média mensal exige o painel quase completo (>=90% dele)."""
    url = f"{IPEA_BASE}(SERCODIGO='{serid}')"
    print(f"  [IPEA {serid} painel fixo de capitais]")
    try: rows = _get(url, timeout=120).json().get("value", [])
    except Exception as e:
        print(f"  [IPEA {serid}] FAIL: {e}", file=sys.stderr)
        return {}, []
    por_capital = defaultdict(dict)
    for r in rows:
        ter = str(r.get("TERCODIGO") or "")
        if ter not in CAPITAIS_CODIGOS: continue
        d_raw = r.get("VALDATA", "")
        v_raw = r.get("VALVALOR")
        if not d_raw or v_raw is None: continue
        try: v = float(v_raw)
        except: continue
        ym = _ym(d_raw[:10])
        if ym >= desde[:7]:
            por_capital[ter][ym] = v
    if not por_capital:
        return {}, []
    meses_todos = sorted(set().union(*[set(d.keys()) for d in por_capital.values()]))
    n_meses = len(meses_todos)
    painel = [t for t, d in por_capital.items() if len(d) >= presenca_min * n_meses]
    if len(painel) < 5:
        print(f"  [IPEA {serid}] WARN: painel fixo com só {len(painel)} capitais — série descartada", file=sys.stderr)
        return {}, painel
    minimo_mes = max(1, int(0.9 * len(painel)))
    out = {}
    for ym in meses_todos:
        vals = [por_capital[t][ym] for t in painel if ym in por_capital[t]]
        if len(vals) >= minimo_mes:
            out[ym] = round(sum(vals) / len(vals), 2)
    print(f"  painel: {len(painel)} capitais | {len(out)} meses contínuos")
    return out, painel


def carrega_renda_pnad(out_dir):
    f = out_dir / "familias_renda.json"
    if not f.exists():
        print(f"  [renda] nao existe local")
        return {}
    try: data = json.loads(f.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"  [renda] WARN parse: {e}", file=sys.stderr)
        return {}
    serie = data.get("bloco_renda_total", {}).get("serie", []) or []
    out = {}
    for p in serie:
        trim = p.get("trim")
        v = p.get("rendimento_medio_real")
        if trim and v is not None:
            out[trim] = float(v)
    return out


def build_serie_cambio(sm_nominal, ptax_media):
    out = []
    for ym in sorted(set(sm_nominal.keys()) & set(ptax_media.keys())):
        sm = sm_nominal.get(ym); ptax = ptax_media.get(ym)
        if sm and ptax and ptax > 0:
            out.append({"data": ym, "sm_brl": round(sm,2), "ptax": round(ptax,4),
                        "sm_usd_ptax": round(sm/ptax,2)})
    return out


def build_serie_ppc(sm_usd_ppc, ppc_taxa):
    out = []
    for ym in sorted(set(sm_usd_ppc.keys()) | set(ppc_taxa.keys())):
        p = {"data": ym}
        if sm_usd_ppc.get(ym) is not None: p["sm_usd_ppc"] = round(sm_usd_ppc[ym], 2)
        if ppc_taxa.get(ym) is not None: p["ppc_taxa"] = round(ppc_taxa[ym], 4)
        if len(p) > 1: out.append(p)
    return out


def build_serie_cesta(cesta, sm_nominal):
    out = []
    for ym in sorted(set(cesta.keys()) & set(sm_nominal.keys())):
        cb = cesta.get(ym); sm = sm_nominal.get(ym)
        if cb is None or sm is None or sm <= 0: continue
        valor_hora = sm / HORAS_MES_PADRAO
        horas = cb / valor_hora
        out.append({"data": ym, "cesta_brl": round(cb,2), "sm_brl": round(sm,2),
                    "horas_sm": round(horas,1), "pct_sm": round((cb/sm)*100.0, 1)})
    return out


def build_serie_renda_usd(renda_pnad, ptax_media):
    out = []
    for ym in sorted(set(renda_pnad.keys()) & set(ptax_media.keys())):
        r = renda_pnad.get(ym); ptax = ptax_media.get(ym)
        if r and ptax and ptax > 0:
            out.append({"data": ym, "renda_brl": round(r,2), "ptax": round(ptax,4),
                        "renda_usd_ptax": round(r/ptax,2)})
    return out


def build_serie_fipezap(fipezap):
    keys = sorted(k for k in fipezap if fipezap.get(k) is not None)
    out = []
    for ym in keys:
        v = fipezap[ym]
        y, m = ym.split("-")
        prev_ym = f"{int(y)-1}-{m}"
        var_aa = None
        if prev_ym in fipezap and fipezap[prev_ym]:
            var_aa = round((v/fipezap[prev_ym] - 1)*100.0, 2)
        out.append({"data": ym, "indice": round(v,2), "var_pct_aa": var_aa})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    args = ap.parse_args()
    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "familias_poder_compra.json"

    sm_nominal = sgs_serie_mensal(1619)
    ptax_media = sgs_serie_mensal(3697)
    cesta, painel_capitais = ipea_cesta_basica_media_capitais("CESBTOTAL")
    sm_usd_ppc = ipea_serie_mensal("GAC12_SALMINDOL12")
    ppc_taxa = ipea_serie_mensal("GAC12_PPCTAXAC12")
    fipezap = ipea_serie_mensal("FIPE12_VENBR12")
    ipca_12m = sgs_serie_mensal(13522)  # v2: IPCA acum 12m — par do FipeZap (valorização REAL)
    renda_pnad = carrega_renda_pnad(out_dir)

    serie_cesta = build_serie_cesta(cesta, sm_nominal)
    serie_cambio = build_serie_cambio(sm_nominal, ptax_media)
    serie_ppc = build_serie_ppc(sm_usd_ppc, ppc_taxa)
    serie_renda_usd = build_serie_renda_usd(renda_pnad, ptax_media)
    serie_fipezap = build_serie_fipezap(fipezap)
    # v2: IPCA 12m na própria linha do FipeZap (distância entre as curvas = valorização real)
    for p in serie_fipezap:
        v = ipca_12m.get(p["data"])
        p["ipca_12m"] = round(v, 2) if v is not None else None

    # v2: régua do KPI/gráfico cambial — média de 20 anos da série SM em US$ PTAX
    vals_20a = [p["sm_usd_ptax"] for p in serie_cambio[-240:] if p.get("sm_usd_ptax") is not None]
    media_20a_ptax = round(sum(vals_20a) / len(vals_20a), 2) if vals_20a else None

    print(f"\n  cesta={len(serie_cesta)} cambio={len(serie_cambio)} ppc={len(serie_ppc)} renda_usd={len(serie_renda_usd)} fipezap={len(serie_fipezap)} | media 20a PTAX: {media_20a_ptax}")

    def last_pt(s, k):
        for p in reversed(s):
            if p.get(k) is not None: return p.get("data"), p.get(k)
        return None, None

    c_dt, c_horas = last_pt(serie_cesta, "horas_sm")
    _, c_pct = last_pt(serie_cesta, "pct_sm")
    cm_dt, cm_val = last_pt(serie_cambio, "sm_usd_ptax")
    ppc_dt, ppc_val = last_pt(serie_ppc, "sm_usd_ppc")
    r_dt, r_val = last_pt(serie_renda_usd, "renda_usd_ptax")
    fz_dt, fz_var = last_pt(serie_fipezap, "var_pct_aa")
    _, fz_idx = last_pt(serie_fipezap, "indice")

    hero = {
        "cesta_horas_sm": {"data": c_dt, "valor": c_horas, "pct_sm": c_pct,
                            "unidade": "horas de SM para 1 cesta"},
        "sm_usd_ptax": {"data": cm_dt, "valor": cm_val, "unidade": "US$ corrente PTAX"},
        "sm_usd_ppc": {"data": ppc_dt, "valor": ppc_val, "unidade": "US$ PPC"},
        "renda_media_usd_ptax": {"data": r_dt, "valor": r_val, "unidade": "US$ corrente PTAX"},
        "fipezap": {"data": fz_dt, "indice": fz_idx, "var_pct_aa": fz_var,
                     "unidade": "indice FipeZap (jun/2012=100)"},
    }

    payload = {
        "schema_version": 2,
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "mes_recente": cm_dt,
        "fonte_principal": "BCB SGS + Ipeadata",
        "hero": hero,
        "bloco_cesta_basica": {"serie": serie_cesta, "horas_mes_referencia": HORAS_MES_PADRAO,
                                "painel_capitais": painel_capitais,
                                "fonte": "Ipeadata CESBTOTAL (DIEESE) — média simples de PAINEL FIXO de capitais",
                                "nota_v2": "Painel fixo (capitais com >=90% de presença desde 2010) — a cobertura "
                                           "DIEESE oscilou e a média de todas produzia série com buraco de ~6,5 anos. "
                                           "Cálculo sobre SM BRUTO/220h — difere do indicador DIEESE oficial (SM líquido)."},
        "bloco_cambio_ptax": {"serie": serie_cambio, "media_20a_sm_usd_ptax": media_20a_ptax,
                               "fonte": "BCB SGS 1619 / 3697"},
        "bloco_ppc": {"serie": serie_ppc, "fonte": "Ipeadata GAC12_SALMINDOL12 + GAC12_PPCTAXAC12"},
        "bloco_renda_media_usd": {"serie": serie_renda_usd, "fonte": "PNAD / SGS 3697"},
        "bloco_fipezap": {"serie": serie_fipezap,
                           "fonte": "Ipeadata FIPE12_VENBR12 + BCB SGS 13522 (IPCA 12m)",
                           "nota_v2": "var_pct_aa vs ipca_12m no mesmo eixo: a distância entre as linhas é a "
                                      "valorização REAL dos imóveis (de ~2014 a 2020 o preço real CAIU)."},
        "metadata": {"fonte": "BCB SGS, Ipeadata", "defasagem_publicacao": "1 mes (SGS); 30-60 dias (Ipeadata)."},
    }

    out_file.write_text(json.dumps(payload, ensure_ascii=False))
    print(f"\nGerado {out_file} ({out_file.stat().st_size/1024:.1f} KB)")
    if c_horas: print(f"  cesta: {c_horas:.1f}h SM ({c_dt}) - {c_pct:.1f}% do SM")
    if cm_val: print(f"  SM USD PTAX: US$ {cm_val:.2f} ({cm_dt})")
    if ppc_val: print(f"  SM USD PPC: US$ {ppc_val:.2f} ({ppc_dt})")
    if r_val: print(f"  renda USD: US$ {r_val:.2f} ({r_dt})")
    if fz_var is not None: print(f"  FipeZap: idx {fz_idx:.1f} ({fz_dt}) var a/a {fz_var:+.2f}%")

    if args.upload:
        sys.path.insert(0, str(HERE))
        try:
            from shared.blob_upload import maybe_upload_json
            maybe_upload_json(out_file, BLOB_PATH)
        except Exception as e:
            print(f"[upload] FAIL: {e}", file=sys.stderr)
            sys.exit(3)


if __name__ == "__main__":
    main()
