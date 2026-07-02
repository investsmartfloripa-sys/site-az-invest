"""Build do JSON Painel Familias - Estrutura Social (D)."""
from __future__ import annotations
import argparse, json, sys, time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
import requests

HERE = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/familias_estrutura_social.json"
UA = {"User-Agent": "az-invest-familias-estrutura-social/0.1"}
SIDRA_BASE = "https://apisidra.ibge.gov.br/values"
IPEA_BASE = "http://www.ipeadata.gov.br/api/odata4/ValoresSerie"

UFS = {"11","12","13","14","15","16","17","21","22","23","24","25","26","27","28","29",
       "31","32","33","35","41","42","43","50","51","52","53"}

FAIXAS_IPCA = {
    "DIMAC_INF1": "muito_baixa",
    "DIMAC_INF2": "baixa",
    "DIMAC_INF3": "media_baixa",
    "DIMAC_INF4": "media",
    "DIMAC_INF5": "media_alta",
    "DIMAC_INF6": "alta",
}


def _get(url, *, timeout=60, retries=5, sleep=3.0):
    # Backoff exponencial: SIDRA bloqueia IPs de nuvem em rajadas.
    last = None
    for i in range(retries):
        try:
            r = requests.get(url, timeout=timeout, headers=UA)
            r.raise_for_status()
            return r
        except Exception as e:
            last = e
            wait = sleep * (2 ** i)
            print(f"  retry {i+1}/{retries}: {e} (aguardando {wait:.0f}s)", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError(f"falha apos {retries} tentativas: {last}")


def _to_float(v):
    if v in ("", "-", "..", "...", None): return None
    try: return float(str(v).replace(",", "."))
    except: return None


def _ym(d): return d[:7] if d and len(d) >= 7 else d
def _year(d): return d[:4] if d and len(d) >= 4 else d


def ipea_serie_anual(serid):
    url = f"{IPEA_BASE}(SERCODIGO='{serid}')"
    print(f"  [IPEA {serid}]")
    try: rows = _get(url, timeout=90).json().get("value", [])
    except Exception as e:
        print(f"  [IPEA {serid}] FAIL: {e}", file=sys.stderr); return {}
    out = {}
    for r in rows:
        niv = r.get("NIVNOME") or ""
        if niv and niv != "Brasil": continue
        d_raw = r.get("VALDATA", "")
        v_raw = r.get("VALVALOR")
        if not d_raw or v_raw is None: continue
        try: out[_year(d_raw)] = float(v_raw)
        except: out[_year(d_raw)] = None
    return out


def ipea_mensal_agreg_uf(serid):
    url = f"{IPEA_BASE}(SERCODIGO='{serid}')"
    print(f"  [IPEA {serid} agreg UF]")
    try: rows = _get(url, timeout=180).json().get("value", [])
    except Exception as e:
        print(f"  [IPEA {serid}] FAIL: {e}", file=sys.stderr); return {}
    soma = defaultdict(float); cnt = defaultdict(int)
    for r in rows:
        niv = r.get("NIVNOME") or ""
        ter = str(r.get("TERCODIGO") or "")
        if niv != "Estados" or ter not in UFS: continue
        d_raw = r.get("VALDATA", "")
        v_raw = r.get("VALVALOR")
        if not d_raw or v_raw is None: continue
        try: v = float(v_raw)
        except: continue
        ym = _ym(d_raw[:10])
        soma[ym] += v
        cnt[ym] += 1
    out = {}
    for ym, s in soma.items():
        if cnt[ym] >= 25:
            out[ym] = s
    return out


def ipea_mensal_nac(serid):
    url = f"{IPEA_BASE}(SERCODIGO='{serid}')"
    print(f"  [IPEA {serid}]")
    try: rows = _get(url, timeout=90).json().get("value", [])
    except Exception as e:
        print(f"  [IPEA {serid}] FAIL: {e}", file=sys.stderr); return {}
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


def sidra_concentracao():
    """SIDRA 7530 (PNADC anual, var 10826): distribuicao da massa de rendimento mensal real
    domiciliar per capita por classes ACUMULADAS de percentual das pessoas.

    cat 49275 = 'ate o P40' -> bottom40 direto; cat 49280 = 'ate o P90' ->
    top10 = 100 - P90 e middle50 = P90 - P40.
    Substitui os codigos Ipeadata PNADS_BOTTOM40/MIDDLE50, que retornam 0 pontos na API.
    """
    url = f"{SIDRA_BASE}/t/7530/n1/all/v/10826/p/all/c1042/49275,49280"
    print(f"  [SIDRA 7530 concentracao]")
    try: data = _get(url).json()
    except Exception as e:
        print(f"  [SIDRA 7530] FAIL: {e}", file=sys.stderr); return {}
    if not data: return {}
    header = data[0]
    out = {}
    for item in data[1:]:
        row = {header.get(k,k): v for k,v in item.items()}
        ano = (row.get("Ano (Codigo)") or row.get("Ano (Código)") or row.get("Ano") or "")[:4]
        cat = None
        for k in row:
            if "Classes acumuladas" in k and ("Código" in k or "Codigo" in k):
                cat = str(row[k]); break
        val = _to_float(row.get("Valor"))
        if not ano or cat not in ("49275", "49280") or val is None: continue
        out.setdefault(ano, {})["p40" if cat == "49275" else "p90"] = val
    return out


def sidra_gini():
    url = f"{SIDRA_BASE}/t/7435/n1/all/v/10681/p/all"
    print(f"  [SIDRA Gini]")
    try: data = _get(url).json()
    except Exception as e:
        print(f"  [SIDRA] FAIL: {e}", file=sys.stderr); return {}
    if not data: return {}
    header = data[0]
    out = {}
    for item in data[1:]:
        row = {header.get(k,k): v for k,v in item.items()}
        ano = (row.get("Ano (Codigo)") or row.get("Ano (Código)") or row.get("Ano") or "")[:4]
        val = _to_float(row.get("Valor"))
        if ano and val is not None:
            out[ano] = val
    return out


def build_conc(conc):
    """conc: {ano: {'p40': massa ate P40, 'p90': massa ate P90}} (SIDRA 7530)."""
    out = []
    for ano in sorted(conc.keys()):
        p40 = conc[ano].get("p40"); p90 = conc[ano].get("p90")
        if p40 is None or p90 is None: continue
        out.append({"ano": ano, "bottom40": round(p40,2), "middle50": round(p90 - p40,2),
                    "top10": round(100.0 - p90, 2)})
    return out


def build_pobreza(p300, p420, p830, a215, a365):
    anos = sorted(set(p300)|set(p420)|set(p830)|set(a215)|set(a365))
    out = []
    for ano in anos:
        p = {"ano": ano}
        if p300.get(ano) is not None: p["pct_300"] = round(p300[ano], 2)
        if p420.get(ano) is not None: p["pct_420"] = round(p420[ano], 2)
        if p830.get(ano) is not None: p["pct_830"] = round(p830[ano], 2)
        if a215.get(ano) is not None: p["abs_215"] = int(a215[ano])
        if a365.get(ano) is not None: p["abs_365"] = int(a365[ano])
        if len(p) > 1: out.append(p)
    return out


def build_transf(pbf, bpc_pes, bpc_val):
    todos = sorted(set(pbf)|set(bpc_pes)|set(bpc_val))
    out = []
    for ym in todos:
        p = {"data": ym}
        if pbf.get(ym) is not None: p["pbf_valor_milhoes"] = round(pbf[ym]/1000.0, 2)
        if bpc_val.get(ym) is not None: p["bpc_valor_milhoes"] = round(bpc_val[ym]/1000.0, 2)
        if bpc_pes.get(ym) is not None: p["bpc_pessoas"] = int(bpc_pes[ym])
        if len(p) > 1: out.append(p)
    return out


def build_gini(g): return [{"ano": k, "valor": v} for k,v in sorted(g.items()) if v is not None]


def build_ipca(faixas):
    todos = set()
    for d in faixas.values(): todos |= set(d.keys())
    out = []
    for ym in sorted(todos):
        p = {"data": ym}
        for code, label in FAIXAS_IPCA.items():
            v = faixas.get(code, {}).get(ym)
            if v is not None: p[label] = round(v, 4)
        if len(p) > 1: out.append(p)
    return out


def sgs_mensal(cod):
    """BCB SGS — série mensal {YYYY-MM: valor} (usada p/ o deflator INPC, SGS 188)."""
    url = f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{cod}/dados?formato=json"
    print(f"  [SGS {cod}]")
    try:
        rows = _get(url, timeout=90).json()
    except Exception as e:
        print(f"  [SGS {cod}] FAIL: {e}", file=sys.stderr)
        return {}
    out = {}
    for r in rows:
        try:
            d, m, y = r["data"].split("/")
            out[f"{y}-{m}"] = float(r["valor"])
        except (KeyError, ValueError):
            continue
    return out


def build_ipca_12m(faixas):
    """v2: acumulado 12 MESES por faixa — composto Π(1+v/100)−1 rolling, nunca soma.
    Responde 'quem sente mais a inflação agora?'; a variação mensal crua em 6 linhas
    era espaguete de ruído. Inclui o SPREAD muito_baixa−alta (a resposta da pergunta)."""
    series = {}
    for code, nome in FAIXAS_IPCA.items():
        d = faixas.get(code) or {}
        meses = sorted(m for m, v in d.items() if v is not None)
        acum = {}
        for i in range(11, len(meses)):
            janela = meses[i - 11 : i + 1]
            fator = 1.0
            for mm in janela:
                fator *= 1 + d[mm] / 100
            acum[meses[i]] = round((fator - 1) * 100, 2)
        series[nome] = acum
    todos = sorted(set().union(*[set(s.keys()) for s in series.values()])) if series else []
    out = []
    for m in todos:
        p = {"data": m}
        for nome, s in series.items():
            if s.get(m) is not None:
                p[nome] = s[m]
        if p.get("muito_baixa") is not None and p.get("alta") is not None:
            p["spread_pp"] = round(p["muito_baixa"] - p["alta"], 2)
        if len(p) > 1:
            out.append(p)
    return out


def aplica_transferencias_reais(s_tran, inpc_mensal):
    """v2: PBF/BPC em R$ CONSTANTES (INPC composto, base = último mês com INPC).
    INPC é o deflator canônico p/ benefícios de famílias de baixa renda (cesta 1-5 SM;
    o BPC é indexado ao SM, corrigido por INPC). Nominal por 5 anos era só inflação."""
    idx = 100.0
    indice = {}
    for m in sorted(m for m, v in inpc_mensal.items() if v is not None):
        idx *= 1 + inpc_mensal[m] / 100
        indice[m] = idx
    if not indice:
        return s_tran
    base = indice[sorted(indice.keys())[-1]]
    indice = {m: v / base * 100 for m, v in indice.items()}
    for p in s_tran:
        i = indice.get(p["data"], 100.0)
        for campo in ("pbf_valor_milhoes", "bpc_valor_milhoes"):
            v = p.get(campo)
            p[campo.replace("_milhoes", "_real_milhoes")] = round(v / i * 100, 1) if (v is not None and i) else None
    return s_tran


def build_ipca_indice(faixas):
    """Acumula a variacao MENSAL (DIMAC_INF* tem unidade '% a.m.' no metadado Ipeadata)
    em indice base 100 no primeiro mes disponivel de cada faixa (jul/2006).

    O dado cru NAO e indice — plota-lo como nivel era a transformacao errada do D5.
    """
    indices = {}
    for code, label in FAIXAS_IPCA.items():
        d = faixas.get(code, {})
        acc = None
        serie = {}
        for ym in sorted(d.keys()):
            v = d[ym]
            if v is None: continue
            acc = 100.0 if acc is None else acc * (1.0 + v / 100.0)
            serie[ym] = acc
        indices[label] = serie
    todos = set()
    for s in indices.values(): todos |= set(s.keys())
    out = []
    for ym in sorted(todos):
        p = {"data": ym}
        for label, serie in indices.items():
            v = serie.get(ym)
            if v is not None: p[label] = round(v, 2)
        if len(p) > 1: out.append(p)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    args = ap.parse_args()
    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "familias_estrutura_social.json"

    print("== Concentracao renda (SIDRA 7530 — massa por classes acumuladas) ==")
    conc = sidra_concentracao()

    print("== Pobreza (PNADS_PERCPOBRE300/420/830 + PNADCA_POPPCC215/365) ==")
    p300 = ipea_serie_anual("PNADS_PERCPOBRE300")
    p420 = ipea_serie_anual("PNADS_PERCPOBRE420")
    p830 = ipea_serie_anual("PNADS_PERCPOBRE830")
    a215 = ipea_serie_anual("PNADCA_POPPCC215")
    a365 = ipea_serie_anual("PNADCA_POPPCC365")

    print("== Transferencias (Bolsa Familia + BPC, agregando estados) ==")
    pbf = ipea_mensal_agreg_uf("VAL_PBF12")
    bpc_pes = ipea_mensal_agreg_uf("PES_BPC")
    bpc_val = ipea_mensal_agreg_uf("VAL_BPC")
    print(f"  PBF={len(pbf)} meses, BPC pes={len(bpc_pes)}, BPC val={len(bpc_val)}")

    print("== Gini SIDRA 7435 ==")
    gini = sidra_gini()

    print("== IPCA por faixa (DIMAC_INF1..6) ==")
    faixas = {code: ipea_mensal_nac(code) for code in FAIXAS_IPCA}

    s_conc = build_conc(conc)
    s_pobr = build_pobreza(p300, p420, p830, a215, a365)
    s_tran = build_transf(pbf, bpc_pes, bpc_val)
    s_gini = build_gini(gini)
    s_ipca = build_ipca(faixas)
    s_ipca_idx = build_ipca_indice(faixas)

    # ── v2: acumulado 12m por faixa (com spread) + transferências em R$ reais (INPC) ──
    s_ipca_12m = build_ipca_12m(faixas)
    print("== INPC (SGS 188) p/ deflacionar transferencias ==")
    inpc = sgs_mensal(188)
    s_tran = aplica_transferencias_reais(s_tran, inpc)

    print(f"\n  conc={len(s_conc)} pobr={len(s_pobr)} tran={len(s_tran)} gini={len(s_gini)} ipca={len(s_ipca)} ipca12m={len(s_ipca_12m)}")

    # Sanity: serie vazia nao pode virar card vazio no ar (foi o modo de falha do D1
    # com os codigos Ipeadata PNADS_* inexistentes).
    if not s_conc:
        print("[sanity] FAIL: concentracao de renda (SIDRA 7530) retornou 0 pontos", file=sys.stderr)
        sys.exit(4)
    if not s_ipca_idx:
        print("[sanity] FAIL: indice IPCA por faixa de renda retornou 0 pontos", file=sys.stderr)
        sys.exit(4)

    def last(s, k):
        for p in reversed(s):
            if p.get(k) is not None: return p.get("ano") or p.get("data"), p.get(k)
        return None, None

    ano_top, top10 = last(s_conc, "top10")
    _, b40_v = last(s_conc, "bottom40")
    ano_pob, p830_v = last(s_pobr, "pct_830")
    ano_gini, gini_v = last(s_gini, "valor")
    dt_pbf, pbf_v = last(s_tran, "pbf_valor_milhoes")

    hero = {
        "concentracao_top10": {"ano": ano_top, "valor": top10, "bottom40": b40_v,
                                "unidade": "% renda total - 10% mais ricos"},
        "pobreza_pct_830": {"ano": ano_pob, "valor": p830_v,
                             "unidade": "% pop abaixo de US$ 8,30/dia PPC"},
        "gini": {"ano": ano_gini, "valor": gini_v, "unidade": "Indice de Gini"},
        "bolsa_familia": {"data": dt_pbf, "valor_milhoes_brl": pbf_v,
                           "unidade": "R$ milhoes/mes - PBF agregado"},
    }

    payload = {
        "schema_version": 2,
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "ano_recente": ano_pob or ano_gini,
        "mes_recente_mensal": dt_pbf,
        "fonte_principal": "Ipeadata + SIDRA IBGE",
        "hero": hero,
        "bloco_concentracao_renda": {"serie": s_conc,
            "fonte": "IBGE/SIDRA 7530 var 10826 (PNADC anual) — massa de rendimento domiciliar "
                     "per capita por classes acumuladas; bottom40 = ate P40, top10 = 100 - ate P90"},
        "bloco_pobreza": {"serie": s_pobr,
            "fonte": "Ipeadata PNADS_PERCPOBRE300/420/830 + PNADCA_POPPCC215/365"},
        "bloco_transferencias_sociais": {"serie": s_tran,
            "fonte": "Ipeadata VAL_PBF12 + VAL_BPC + PES_BPC (MDS, agregados Brasil)",
            "nota_v2": "pbf_valor_real_milhoes/bpc_valor_real_milhoes = R$ constantes do ultimo mes "
                       "com INPC (SGS 188, composto) — INPC e o deflator canonico de beneficios de baixa renda."},
        "bloco_gini": {"serie": s_gini, "fonte": "SIDRA 7435 var 10681 (PNAD Continua Anual)"},
        "bloco_ipca_faixa_renda": {"serie": s_ipca, "serie_indice": s_ipca_idx, "serie_12m": s_ipca_12m,
            "faixas": FAIXAS_IPCA,
            "fonte": "Ipeadata DIMAC_INF1..6 (IPEA Carta de Conjuntura)",
            "nota": "serie = variacao mensal crua (% a.m., unidade original do Ipeadata); "
                    "serie_indice = acumulado em indice base 100 no primeiro mes (jul/2006); "
                    "serie_12m (v2) = acumulado 12 meses COMPOSTO por faixa + spread_pp (muito_baixa - alta)."},
        "metadata": {"fonte": "Ipeadata (PNADS, PNADCA, MDS), IBGE/SIDRA, IPEA",
            "defasagem_publicacao": "anual (PNAD/Gini); mensal com 1-2 meses (BPC/PBF/IPCA-faixa)."},
    }

    out_file.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(f"\nGerado {out_file} ({out_file.stat().st_size/1024:.1f} KB)")
    if top10: print(f"  TOP 10%: {top10:.1f}% renda ({ano_top})")
    if p830_v: print(f"  pobreza US$8.30: {p830_v:.1f}% ({ano_pob})")
    if gini_v: print(f"  Gini: {gini_v:.3f} ({ano_gini})")
    if pbf_v: print(f"  Bolsa Familia: R$ {pbf_v:,.0f} milhoes/mes ({dt_pbf})")

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
