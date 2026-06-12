"""Build do JSON do Painel Contas Externas — Brasil, BPM6.

Baixa séries do BCB SGS:
- Balanço de Pagamentos — Transações Correntes (22701) e componentes (22707 bens,
  22711 exportações bens, 22719 serviços líquido, 22800 renda primária,
  22838 renda secundária).
- Investimento Direto no País (22885 líquido, 22886 ingressos), com decomposição
  (22888 participação, 22891 part. exc. reinvestimento, 22892 reinvestimento).
- Investimento brasileiro no exterior (22865 líquido).
- Reservas internacionais (3546 mensal, 13982 liquidez diária).
- PIB acumulado 12m em US$ milhões (4192) para denominador de % PIB.

Schema v2 (ADITIVO — campos v1 intactos):
- bloco_a.decomposicao_12m / balanca_12m: acumulados 12m (US$ bi) sobre a série
  completa, janela de saída desde 2005.
- bloco_b.cobertura_idp / idp_decomposicao_12m: % PIB com sinal e decomposição
  do IDP 12m (intercompanhia = 22885 − participação total 22888).
- bloco_servicos.serie_12m: transportes 22728, viagens 22740, telecom/informática
  22776, propriedade intelectual 22779, demais = residual de 22719.
- bloco_renda.serie_12m: lucros/dividendos IDP 22812, reinvestidos 22815,
  salários 22803, juros e demais = residual de 22806; total = 22800.
- bloco_c.reservas_mensal (3546) e meses_importacao_serie (despesa de serviços
  22721 no conceito bens+serviços).

Gera `data-pipeline/out/contas_externas.json` e upload pra `data/contas_externas.json`.

Cron diário (defasagem ~25 dias úteis pra publicação BCB). Merge incremental
contra Blob existente preserva histórico e registra revisões.
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
DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/contas_externas.json"

UA = {"User-Agent": "az-invest-contas-externas/0.1"}
SGS_BASE = "https://api.bcb.gov.br/dados/serie/bcdata.sgs"

# Séries SGS — agrupadas por bloco editorial
SERIES_MENSAIS = {
    # Balanço de Pagamentos — Transações Correntes (US$ milhões)
    "tc_saldo": 22701,                  # Transações correntes - saldo
    "bens_saldo": 22707,                # Balança comercial - saldo
    "bens_export": 22711,               # Exportações de bens
    "servicos_liquido": 22719,          # Serviços - líquido
    "renda_primaria_saldo": 22800,      # Renda primária - saldo (receita 22801, despesa 22802)
    "renda_secundaria_saldo": 22838,    # Renda secundária - saldo (fecha identidade BPM6 vs 22701)
    # Investimento Direto no País — US$ milhões mensais (passivos)
    "idp_liquido": 22885,               # IDP - líquido
    "idp_ingressos": 22886,             # IDP - ingressos
    "idp_participacao_capital": 22888,  # IDP - Participação no capital
    "idp_reinvestimento": 22892,        # IDP - Reinvestimento de lucros
    "idp_part_exc_reinv": 22891,        # IDP - Participação exc reinvestimento
    # Investimento brasileiro no exterior
    "ide_liquido": 22865,               # IDE - líquido
    # Serviços — componentes (saldos mensais, US$ milhões) [v2]
    "serv_transportes": 22728,          # Serviços - Transportes - saldo
    "serv_viagens": 22740,              # Serviços - Viagens - saldo
    "serv_telecom_informatica": 22776,  # Serviços - Telecom, computação e informação - saldo
    "serv_propriedade_intelectual": 22779,  # Serviços - Propriedade intelectual - saldo
    "serv_despesas_total": 22721,       # Serviços - despesa TOTAL (p/ meses de importação bens+serviços)
    # Renda primária — componentes (US$ milhões) [v2]
    "renda_salarios": 22803,            # Renda primária - Salários - saldo
    "renda_invest_saldo": 22806,        # Renda primária - Renda de investimento - saldo
    "renda_lucros_dividendos_idp": 22812,  # Renda de inv. direto - Lucros e dividendos - saldo
    "renda_lucros_reinvestidos": 22815,    # Renda de inv. direto - Lucros reinvestidos - saldo
    # Reservas mensais
    "reservas_mensal": 3546,            # Reservas internacionais total mensal (US$ milhões)
    # PIB acumulado 12m (US$ milhões) — denominador de % PIB
    # (4192 = PIB 12m em US$ mi; NUNCA usar 4380, que é PIB MENSAL em R$ milhões)
    "pib_12m": 4192,
}

SERIES_DIARIAS = {
    "reservas_liquidez": 13982,         # Reservas conceito liquidez diária
}


def _get(url: str, *, timeout: int = 60, retries: int = 3, sleep: float = 2.0) -> requests.Response:
    last: Exception | None = None
    for i in range(retries):
        try:
            r = requests.get(url, timeout=timeout, headers=UA)
            r.raise_for_status()
            return r
        except Exception as e:
            last = e
            print(f"  retry {i + 1}/{retries}: {e}", file=sys.stderr)
            time.sleep(sleep)
    raise RuntimeError(f"falha após {retries} tentativas: {last}")


def _to_float(v: Any) -> float | None:
    if v in ("", "-", "..", "...", None):
        return None
    try:
        return float(str(v).replace(",", "."))
    except (TypeError, ValueError):
        return None


def _br_date_to_iso(d: str) -> str:
    """Converte 'DD/MM/YYYY' em 'YYYY-MM-DD'."""
    try:
        dd, mm, yy = d.split("/")
        return f"{yy}-{mm.zfill(2)}-{dd.zfill(2)}"
    except Exception:
        return d


def sgs_fetch(code: int, *, desde_dias: int | None = None) -> list[dict[str, str]]:
    """Baixa série SGS completa ou últimos `desde_dias` dias por intervalo de data."""
    if desde_dias:
        from datetime import timedelta
        hoje = datetime.now(timezone.utc).date()
        inicio = hoje - timedelta(days=desde_dias)
        url = (
            f"{SGS_BASE}.{code}/dados?formato=json"
            f"&dataInicial={inicio.strftime('%d/%m/%Y')}"
            f"&dataFinal={hoje.strftime('%d/%m/%Y')}"
        )
    else:
        url = f"{SGS_BASE}.{code}/dados?formato=json"
    print(f"  [SGS {code}] {url}")
    try:
        return _get(url).json()
    except Exception as e:
        print(f"  [SGS {code}] FAIL: {e}", file=sys.stderr)
        return []


def sgs_serie(code: int, *, desde_dias: int | None = None) -> dict[str, float | None]:
    """Retorna dict { 'YYYY-MM-DD': valor } a partir do SGS."""
    rows = sgs_fetch(code, desde_dias=desde_dias)
    out: dict[str, float | None] = {}
    for r in rows:
        d = _br_date_to_iso(r.get("data", ""))
        v = _to_float(r.get("valor"))
        if d:
            out[d] = v
    return out


# ----------------------------------------------------------------------------
# Construção das séries por bloco
# ----------------------------------------------------------------------------
def acum_12m(serie_mensal: dict[str, float | None]) -> dict[str, float | None]:
    """Soma rolante de 12 meses. Datas em 'YYYY-MM-DD' (dia=01).

    Para cada data, soma o valor do mês corrente + 11 meses anteriores. Retorna
    None se faltar algum mês na janela.
    """
    keys = sorted(serie_mensal.keys())
    if len(keys) < 12:
        return {k: None for k in keys}
    out: dict[str, float | None] = {}
    for i, k in enumerate(keys):
        if i < 11:
            out[k] = None
            continue
        window = [serie_mensal.get(keys[i - j]) for j in range(12)]
        if any(v is None for v in window):
            out[k] = None
        else:
            out[k] = sum(v for v in window if v is not None)
    return out


def pct_pib(num: dict[str, float | None], pib_12m: dict[str, float | None]) -> dict[str, float | None]:
    """Divide série acumulada 12m (US$ mi) pelo PIB 12m (US$ mi) × 100. Resultado em %."""
    out: dict[str, float | None] = {}
    for k, v in num.items():
        p = pib_12m.get(k)
        if v is None or p is None or p == 0:
            out[k] = None
        else:
            out[k] = (v / p) * 100.0
    return out


def _bi(v: float | None, nd: int = 3) -> float | None:
    """US$ milhões → US$ bilhões, arredondado (None-safe)."""
    return round(v / 1000.0, nd) if v is not None else None


def _round(v: float | None, nd: int = 2) -> float | None:
    return round(v, nd) if v is not None else None


def _ultimo_valor(serie: dict[str, float | None]) -> tuple[str | None, float | None]:
    """Última (data, valor) não-nula da série; (None, None) se vazia."""
    ks = [k for k in sorted(serie.keys()) if serie.get(k) is not None]
    if not ks:
        return None, None
    return ks[-1], serie[ks[-1]]


def _serie_vazia(serie: dict[str, float | None]) -> bool:
    return not any(v is not None for v in serie.values())


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------
def main() -> None:
    ap = argparse.ArgumentParser(description="Build do JSON Painel Contas Externas")
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--no-merge", action="store_true", help="Não fazer merge com Blob existente")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "contas_externas.json"

    # ---- Coleta SGS ----
    print("== SGS mensal ==")
    mensais: dict[str, dict[str, float | None]] = {}
    for chave, code in SERIES_MENSAIS.items():
        mensais[chave] = sgs_serie(code)
        time.sleep(0.4)

    print("== SGS diário (reservas liquidez) ==")
    diarias: dict[str, dict[str, float | None]] = {}
    for chave, code in SERIES_DIARIAS.items():
        # Últimos 5 anos via intervalo de data (limite de ultimos/N é 20)
        diarias[chave] = sgs_serie(code, desde_dias=1825)
        time.sleep(0.4)

    # ---- Blob anterior (merge incremental / preservação de séries) ----
    prev: dict[str, Any] | None = None
    if not args.no_merge:
        try:
            sys.path.insert(0, str(HERE))
            from shared.blob_download import download_json
            prev = download_json(BLOB_PATH)
            if prev:
                print(f"  [merge] Blob anterior gerado_em {prev.get('gerado_em')}")
        except Exception as e:
            print(f"  [merge] WARN: {e}", file=sys.stderr)

    # Robustez: se reservas vierem vazias do SGS, reaproveita as séries
    # correspondentes do Blob anterior (hero não pode regredir pra None).
    if _serie_vazia(diarias["reservas_liquidez"]) and prev:
        prev_diaria = (prev.get("bloco_c") or {}).get("reservas_diaria") or []
        restaurada = {
            p["data"]: p["reservas_us_bi"] * 1000.0  # bi → mi (unidade interna)
            for p in prev_diaria
            if p.get("data") and p.get("reservas_us_bi") is not None
        }
        if restaurada:
            diarias["reservas_liquidez"] = restaurada
            print(f"  [preserva] reservas_liquidez (13982) vazia no SGS — reaproveitados {len(restaurada)} pontos do Blob anterior")

    if _serie_vazia(mensais["reservas_mensal"]) and prev:
        prev_mensal = (prev.get("bloco_c") or {}).get("reservas_mensal") or []
        restaurada_m = {
            p["mes"]: p["reservas_us_bi"] * 1000.0  # bi → mi (unidade interna)
            for p in prev_mensal
            if p.get("mes") and p.get("reservas_us_bi") is not None
        }
        if restaurada_m:
            mensais["reservas_mensal"] = restaurada_m
            print(f"  [preserva] reservas_mensal (3546) vazia no SGS — reaproveitados {len(restaurada_m)} pontos do Blob anterior")

    # ---- Cálculos derivados ----
    pib_12m = mensais["pib_12m"]

    # Transações correntes 12m acumulado e % PIB
    tc_12m = acum_12m(mensais["tc_saldo"])
    tc_pct_pib = pct_pib(tc_12m, pib_12m)

    # IDP 12m acumulado e % PIB
    idp_12m = acum_12m(mensais["idp_liquido"])
    idp_pct_pib = pct_pib(idp_12m, pib_12m)

    # Cobertura: |TC| financiada por IDP (1.0 = 100% coberto)
    cobertura: dict[str, float | None] = {}
    for k in tc_12m:
        tc = tc_12m.get(k)
        idp = idp_12m.get(k)
        if tc is None or idp is None or tc == 0:
            cobertura[k] = None
        elif tc >= 0:
            cobertura[k] = None  # superávit, conceito não aplica
        else:
            cobertura[k] = idp / abs(tc)

    # Balança comercial 12m, importação derivada
    bens_export = mensais["bens_export"]
    bens_saldo = mensais["bens_saldo"]
    bens_import: dict[str, float | None] = {}
    for k in bens_export:
        e = bens_export.get(k)
        s = bens_saldo.get(k)
        if e is None or s is None:
            bens_import[k] = None
        else:
            # import_bp = exp - saldo (sinal convencional)
            bens_import[k] = e - s

    # Decomposição da TC: as 4 séries vêm EXPLÍCITAS do SGS (nenhuma por resíduo).
    # O resíduo da identidade BPM6 (TC = bens + serviços + renda prim. + renda sec.)
    # é usado apenas como auditoria: se passar da tolerância, print [WARN] informativo.
    IDENTIDADE_TOL_USD_MI = 100.0  # tolerância absoluta (US$ milhões)
    tc_decomposto: dict[str, dict[str, float | None]] = {}
    identidade_violacoes: list[tuple[str, float]] = []
    identidade_meses_ok = 0
    for k in mensais["tc_saldo"]:
        tc_val = mensais["tc_saldo"].get(k)
        bens = bens_saldo.get(k)
        servicos = mensais["servicos_liquido"].get(k)
        renda_prim = mensais["renda_primaria_saldo"].get(k)
        renda_sec = mensais["renda_secundaria_saldo"].get(k)
        if not any(v is None for v in [tc_val, bens, servicos, renda_prim, renda_sec]):
            residuo = tc_val - bens - servicos - renda_prim - renda_sec
            if abs(residuo) > IDENTIDADE_TOL_USD_MI:
                identidade_violacoes.append((k, residuo))
            else:
                identidade_meses_ok += 1
        tc_decomposto[k] = {
            "saldo_total": tc_val,
            "bens": bens,
            "servicos": servicos,
            "renda_primaria": renda_prim,
            "renda_secundaria": renda_sec,
        }

    # Auditoria da identidade BPM6 (informativa — não aborta o build)
    if identidade_violacoes:
        pior = max(identidade_violacoes, key=lambda t: abs(t[1]))
        print(
            f"[WARN] identidade BPM6 (TC = bens+serviços+renda prim.+renda sec.) "
            f"fora da tolerância de US$ {IDENTIDADE_TOL_USD_MI:.0f} mi em "
            f"{len(identidade_violacoes)} mes(es); pior caso {pior[0]}: resíduo "
            f"US$ {pior[1]:+.1f} mi",
            file=sys.stderr,
        )
    else:
        print(f"[OK] identidade BPM6 fecha em {identidade_meses_ok} meses (tolerância US$ {IDENTIDADE_TOL_USD_MI:.0f} mi)")

    # IDP decomposição: participação no capital exc reinv + reinvestimento + intercompanhia (residual)
    idp_decomposto: dict[str, dict[str, float | None]] = {}
    for k in mensais["idp_liquido"]:
        idp_total = mensais["idp_liquido"].get(k)
        part_exc = mensais["idp_part_exc_reinv"].get(k)
        reinv = mensais["idp_reinvestimento"].get(k)
        if any(v is None for v in [idp_total, part_exc, reinv]):
            intercomp = None
        else:
            intercomp = idp_total - part_exc - reinv
        idp_decomposto[k] = {
            "total": idp_total,
            "participacao": part_exc,
            "reinvestimento": reinv,
            "intercompanhia": intercomp,
        }

    # Meses de importação (último valor)
    # Calcula importação 12m e divide reservas atuais pela média mensal
    bens_import_12m = acum_12m(bens_import)
    # Último valor das reservas (diária)
    reservas_dias = sorted(diarias["reservas_liquidez"].keys())
    reservas_recente = diarias["reservas_liquidez"].get(reservas_dias[-1]) if reservas_dias else None

    # Último valor de importação 12m
    keys_imp = [k for k in sorted(bens_import_12m.keys()) if bens_import_12m.get(k) is not None]
    import_12m_recente = bens_import_12m.get(keys_imp[-1]) if keys_imp else None

    meses_importacao = None
    if reservas_recente and import_12m_recente and import_12m_recente > 0:
        meses_importacao = reservas_recente / (import_12m_recente / 12.0)

    # ---- Hero KPIs ----
    def last_with_value(serie: dict[str, float | None]) -> tuple[str | None, float | None]:
        keys = [k for k in sorted(serie.keys()) if serie.get(k) is not None]
        if not keys:
            return None, None
        return keys[-1], serie[keys[-1]]

    k_tc, v_tc = last_with_value(tc_pct_pib)
    k_idp, v_idp = last_with_value(idp_pct_pib)
    k_div = reservas_dias[-1] if reservas_dias else None

    hero = {
        "saldo_tc_pct_pib": {"data": k_tc, "valor": v_tc, "unidade": "% PIB (12m)"},
        "idp_pct_pib": {"data": k_idp, "valor": v_idp, "unidade": "% PIB (12m)"},
        "reservas_us_bi": {
            "data": k_div,
            "valor": reservas_recente / 1000.0 if reservas_recente else None,
            "unidade": "US$ bilhões",
        },
        "meses_importacao": {
            "data": k_div,
            "valor": meses_importacao,
            "unidade": "meses de importação",
        },
    }

    # Robustez: hero nunca regride pra None se o Blob anterior tinha valor
    if prev:
        prev_hero = prev.get("hero") or {}
        for kpi, atual in hero.items():
            antes = prev_hero.get(kpi) or {}
            if atual.get("valor") is None and antes.get("valor") is not None:
                hero[kpi] = {**atual, "data": antes.get("data"), "valor": antes.get("valor")}
                print(f"  [preserva] hero.{kpi} sem valor novo — mantido valor do Blob anterior ({antes.get('data')})")

    # ---- Bloco A: Saldo TC histórico ----
    # Anos completos a partir de 2000 (somatório do ano civil)
    tc_anual: dict[str, float | None] = {}
    pib_anual: dict[str, float | None] = {}
    for k, v in mensais["tc_saldo"].items():
        ano = k[:4]
        if int(ano) < 2000:
            continue
        if v is None:
            continue
        tc_anual[ano] = (tc_anual.get(ano) or 0.0) + v
    # PIB anual = PIB 12m do mês 12
    for k, v in pib_12m.items():
        if k[5:7] == "12" and v is not None:
            pib_anual[k[:4]] = v
    tc_anual_pct: list[dict[str, Any]] = []
    for ano in sorted(tc_anual.keys()):
        pib = pib_anual.get(ano)
        if pib and pib > 0:
            tc_anual_pct.append({
                "ano": ano,
                "saldo_us_bi": tc_anual[ano] / 1000.0,
                "saldo_pct_pib": (tc_anual[ano] / pib) * 100.0,
            })

    # Ano corrente: 12m acumulado do ponto mais recente
    if k_tc:
        ano_corrente = k_tc[:4]
        # já incluído se ano fechado em dezembro; caso contrário, adiciona com label "YYYY (12m)"
        if not any(p["ano"] == ano_corrente for p in tc_anual_pct):
            tc_corrente = tc_12m.get(k_tc)
            pib_corrente = pib_12m.get(k_tc)
            if tc_corrente is not None and pib_corrente:
                tc_anual_pct.append({
                    "ano": f"{ano_corrente}*",
                    "saldo_us_bi": tc_corrente / 1000.0,
                    "saldo_pct_pib": (tc_corrente / pib_corrente) * 100.0,
                })

    # ---- Bloco A2/A3 decomposição mensal — últimos 36 meses ----
    keys_24m = sorted(mensais["tc_saldo"].keys())[-36:]
    bp_decomp_24m: list[dict[str, Any]] = []
    for k in keys_24m:
        item = tc_decomposto.get(k, {})
        bp_decomp_24m.append({
            "mes": k,
            "saldo_total": item.get("saldo_total"),
            "bens": item.get("bens"),
            "servicos": item.get("servicos"),
            "renda_primaria": item.get("renda_primaria"),
            "renda_secundaria": item.get("renda_secundaria"),
        })

    balanca_24m: list[dict[str, Any]] = []
    for k in keys_24m:
        e = bens_export.get(k)
        i = bens_import.get(k)
        s = bens_saldo.get(k)
        balanca_24m.append({
            "mes": k,
            "exportacoes": e,
            "importacoes": -i if i is not None else None,  # convenção visual: importação negativa
            "saldo": s,
        })

    # ---- Bloco B: IDP vs TC histórico ----
    # Série mensal % PIB de IDP 12m e |TC 12m|, desde 2010
    idp_vs_tc: list[dict[str, Any]] = []
    keys_2010 = [k for k in sorted(mensais["tc_saldo"].keys()) if k >= "2010-01-01"]
    for k in keys_2010:
        tc_v = tc_pct_pib.get(k)
        idp_v = idp_pct_pib.get(k)
        if tc_v is None or idp_v is None:
            continue
        idp_vs_tc.append({
            "mes": k,
            "tc_pct_pib": tc_v,
            "deficit_abs_pct_pib": -tc_v if tc_v < 0 else 0,
            "idp_pct_pib": idp_v,
        })

    # ---- Bloco B2: IDP decomposição últimos 24m ----
    keys_idp_24m = sorted(mensais["idp_liquido"].keys())[-36:]
    idp_decomp_24m: list[dict[str, Any]] = []
    for k in keys_idp_24m:
        item = idp_decomposto.get(k, {})
        idp_decomp_24m.append({
            "mes": k,
            "total": item.get("total"),
            "participacao": item.get("participacao"),
            "reinvestimento": item.get("reinvestimento"),
            "intercompanhia": item.get("intercompanhia"),
        })

    # ---- Bloco C1/C2: Reservas (diárias últimos 5 anos) ----
    reservas_serie: list[dict[str, Any]] = []
    for d in reservas_dias:
        v = diarias["reservas_liquidez"].get(d)
        if v is None:
            continue
        reservas_serie.append({"data": d, "reservas_us_bi": v / 1000.0})

    # ========================================================================
    # Schema v2 — acumulados 12m sobre a série completa (não o recorte 36m)
    # ========================================================================
    V2_JANELA_INICIO = "2005-01-01"

    # ---- v2 bloco_a.decomposicao_12m: TC decomposta, acumulado 12m, US$ bi ----
    bens_12m = acum_12m(bens_saldo)                              # 22707
    servicos_12m = acum_12m(mensais["servicos_liquido"])         # 22719
    renda_prim_12m = acum_12m(mensais["renda_primaria_saldo"])   # 22800
    renda_sec_12m = acum_12m(mensais["renda_secundaria_saldo"])  # 22838
    decomposicao_12m_serie: list[dict[str, Any]] = []
    for k in sorted(bens_12m.keys()):
        if k < V2_JANELA_INICIO:
            continue
        b, s, rp, rs = bens_12m.get(k), servicos_12m.get(k), renda_prim_12m.get(k), renda_sec_12m.get(k)
        if any(v is None for v in (b, s, rp, rs)):
            continue
        decomposicao_12m_serie.append({
            "mes": k,
            "bens": _bi(b),
            "servicos": _bi(s),
            "renda_primaria": _bi(rp),
            "renda_secundaria": _bi(rs),
            # total = soma das 4 (identidade BPM6 vs 22701 já auditada nos mensais)
            "total": _bi(b + s + rp + rs),
        })

    # ---- v2 bloco_a.balanca_12m: exportações/importações/saldo 12m, US$ bi ----
    bens_export_12m = acum_12m(bens_export)  # 22711
    balanca_12m_serie: list[dict[str, Any]] = []
    for k in sorted(bens_export_12m.keys()):
        if k < V2_JANELA_INICIO:
            continue
        e, i, s = bens_export_12m.get(k), bens_import_12m.get(k), bens_12m.get(k)
        if any(v is None for v in (e, i, s)):
            continue
        balanca_12m_serie.append({
            "mes": k,
            "exportacoes": _bi(e),
            "importacoes": _bi(-i),  # mesma convenção visual do bloco 36m: importação negativa
            "saldo": _bi(s),
        })

    # ---- v2 bloco_b.cobertura_idp: % PIB com sinal + cobertura do déficit ----
    cobertura_idp_serie: list[dict[str, Any]] = []
    for k in sorted(tc_12m.keys()):
        if k < V2_JANELA_INICIO:
            continue
        tc_p = tc_pct_pib.get(k)   # COM SINAL — nunca clipar em zero
        idp_p = idp_pct_pib.get(k)
        if tc_p is None or idp_p is None:
            continue
        tc_v = tc_12m.get(k)
        idp_v = idp_12m.get(k)
        if tc_v is not None and idp_v is not None and tc_v < 0:
            cob = (idp_v / abs(tc_v)) * 100.0
        else:
            cob = None  # superávit em TC: conceito não se aplica (front anota "superávit")
        cobertura_idp_serie.append({
            "mes": k,
            "idp_pct_pib": _round(idp_p, 2),
            "tc_pct_pib": _round(tc_p, 2),
            "cobertura_pct": _round(cob, 1),
        })

    # ---- v2 bloco_b.idp_decomposicao_12m: IDP 12m decomposto, US$ bi ----
    idp_part_total_12m = acum_12m(mensais["idp_participacao_capital"])  # 22888 (já baixado; agora usado)
    idp_part_exc_12m = acum_12m(mensais["idp_part_exc_reinv"])          # 22891
    idp_reinv_12m = acum_12m(mensais["idp_reinvestimento"])             # 22892
    IDP_PART_TOL_USD_MI = 200.0
    idp_part_violacoes: list[tuple[str, float]] = []
    idp_12m_serie: list[dict[str, Any]] = []
    for k in sorted(idp_12m.keys()):
        if k < V2_JANELA_INICIO:
            continue
        total = idp_12m.get(k)
        part_total = idp_part_total_12m.get(k)
        part_exc = idp_part_exc_12m.get(k)
        reinv = idp_reinv_12m.get(k)
        if any(v is None for v in (total, part_total, part_exc, reinv)):
            continue
        residuo_part = part_total - (part_exc + reinv)
        if abs(residuo_part) > IDP_PART_TOL_USD_MI:
            idp_part_violacoes.append((k, residuo_part))
        idp_12m_serie.append({
            "mes": k,
            "participacao": _bi(part_exc),
            "reinvestimento": _bi(reinv),
            # intercompanhia = IDP líquido (22885) − participação TOTAL (22888)
            "intercompanhia": _bi(total - part_total),
            "total": _bi(total),
        })
    if idp_part_violacoes:
        pior = max(idp_part_violacoes, key=lambda t: abs(t[1]))
        print(
            f"[WARN] IDP 12m: |22888 − (22891 + 22892)| > US$ {IDP_PART_TOL_USD_MI:.0f} mi em "
            f"{len(idp_part_violacoes)} mes(es); pior caso {pior[0]}: resíduo US$ {pior[1]:+.1f} mi",
            file=sys.stderr,
        )
    else:
        print(f"[OK] IDP 12m: participação total (22888) fecha com 22891 + 22892 (tolerância US$ {IDP_PART_TOL_USD_MI:.0f} mi)")

    # ---- v2 bloco_servicos.serie_12m: decomposição dos serviços, US$ bi ----
    SERV_COMPONENTES = {
        "transportes": "serv_transportes",                          # 22728
        "viagens": "serv_viagens",                                  # 22740
        "telecom_informatica": "serv_telecom_informatica",          # 22776
        "propriedade_intelectual": "serv_propriedade_intelectual",  # 22779
    }
    SERV_SANITY_MIN_USD_MI, SERV_SANITY_MAX_USD_MI = -4000.0, 1000.0
    serv_comp_mensal: dict[str, dict[str, float | None]] = {}
    for nome, chave in SERV_COMPONENTES.items():
        serie = mensais[chave]
        k_ult, v_ult = _ultimo_valor(serie)
        if v_ult is None or not (SERV_SANITY_MIN_USD_MI <= v_ult <= SERV_SANITY_MAX_USD_MI):
            print(
                f"[ERROR] serviços/{nome} (SGS {SERIES_MENSAIS[chave]}): último mensal "
                f"{v_ult} ({k_ult}) fora de [{SERV_SANITY_MIN_USD_MI:.0f}, {SERV_SANITY_MAX_USD_MI:.0f}] "
                f"US$ mi — série descartada (vai pro residual 'demais')",
                file=sys.stderr,
            )
            serv_comp_mensal[nome] = {}
        else:
            serv_comp_mensal[nome] = serie
    serv_ativos = [nome for nome in SERV_COMPONENTES if serv_comp_mensal[nome]]
    serv_comp_12m = {nome: acum_12m(serv_comp_mensal[nome]) for nome in serv_ativos}
    servicos_12m_serie: list[dict[str, Any]] = []
    for k in sorted(servicos_12m.keys()):
        if k < V2_JANELA_INICIO:
            continue
        total = servicos_12m.get(k)
        if total is None:
            continue
        comps = {nome: serv_comp_12m[nome].get(k) for nome in serv_ativos}
        validos = [v for v in comps.values() if v is not None]
        demais = total - sum(validos) if len(validos) == len(serv_ativos) else None
        servicos_12m_serie.append({
            "mes": k,
            "transportes": _bi(comps.get("transportes")),
            "viagens": _bi(comps.get("viagens")),
            "telecom_informatica": _bi(comps.get("telecom_informatica")),
            "propriedade_intelectual": _bi(comps.get("propriedade_intelectual")),
            "demais": _bi(demais),
            "total": _bi(total),
        })

    # ---- v2 bloco_renda.serie_12m: decomposição da renda primária, US$ bi ----
    # Auditoria mensal: salários (22803) + renda de investimento (22806) ≈ total (22800)
    RENDA_TOL_USD_MI = 50.0
    renda_violacoes: list[tuple[str, float]] = []
    for k in sorted(mensais["renda_primaria_saldo"].keys()):
        t = mensais["renda_primaria_saldo"].get(k)
        sal = mensais["renda_salarios"].get(k)
        rinv = mensais["renda_invest_saldo"].get(k)
        if any(v is None for v in (t, sal, rinv)):
            continue
        residuo = sal + rinv - t
        if abs(residuo) > RENDA_TOL_USD_MI:
            renda_violacoes.append((k, residuo))
    if renda_violacoes:
        pior = max(renda_violacoes, key=lambda t: abs(t[1]))
        print(
            f"[WARN] renda primária: |22803 + 22806 − 22800| > US$ {RENDA_TOL_USD_MI:.0f} mi em "
            f"{len(renda_violacoes)} mes(es); pior caso {pior[0]}: resíduo US$ {pior[1]:+.1f} mi",
            file=sys.stderr,
        )
    else:
        print(f"[OK] renda primária: 22803 + 22806 fecha com 22800 (tolerância US$ {RENDA_TOL_USD_MI:.0f} mi)")

    renda_ld_12m = acum_12m(mensais["renda_lucros_dividendos_idp"])  # 22812
    renda_lr_12m = acum_12m(mensais["renda_lucros_reinvestidos"])    # 22815
    renda_sal_12m = acum_12m(mensais["renda_salarios"])              # 22803
    renda_rinv_12m = acum_12m(mensais["renda_invest_saldo"])         # 22806
    renda_12m_serie: list[dict[str, Any]] = []
    for k in sorted(renda_prim_12m.keys()):
        if k < V2_JANELA_INICIO:
            continue
        total = renda_prim_12m.get(k)
        ld = renda_ld_12m.get(k)
        lr = renda_lr_12m.get(k)
        sal = renda_sal_12m.get(k)
        rinv = renda_rinv_12m.get(k)
        if any(v is None for v in (total, ld, lr, sal, rinv)):
            continue
        renda_12m_serie.append({
            "mes": k,
            "lucros_dividendos_idp": _bi(ld),
            "lucros_reinvestidos": _bi(lr),
            # juros e demais rendas de investimento = 22806 − (22812 + 22815)
            "juros_e_demais": _bi(rinv - (ld + lr)),
            "salarios": _bi(sal),
            "total": _bi(total),
        })

    # ---- v2 bloco_c.reservas_mensal: SGS 3546 (série completa), US$ bi ----
    reservas_mensal_serie: list[dict[str, Any]] = []
    for k in sorted(mensais["reservas_mensal"].keys()):
        v = mensais["reservas_mensal"].get(k)
        if v is None:
            continue
        reservas_mensal_serie.append({"mes": k, "reservas_us_bi": _bi(v)})

    # ---- v2 bloco_c.meses_importacao_serie ----
    # meses_bens = reservas ÷ (importação de bens 12m ÷ 12)
    # meses_bens_servicos = reservas ÷ ((import bens 12m + despesa de serviços 12m) ÷ 12)
    serv_desp_12m = acum_12m(mensais["serv_despesas_total"])  # 22721 (despesa, sinal positivo)
    meses_importacao_serie: list[dict[str, Any]] = []
    for k in sorted(mensais["reservas_mensal"].keys()):
        res = mensais["reservas_mensal"].get(k)
        imp12 = bens_import_12m.get(k)
        if res is None or imp12 is None or imp12 <= 0:
            continue
        meses_bens = res / (imp12 / 12.0)
        sd12 = serv_desp_12m.get(k)
        if sd12 is not None and (imp12 + sd12) > 0:
            meses_bens_serv = res / ((imp12 + sd12) / 12.0)
        else:
            meses_bens_serv = None
        meses_importacao_serie.append({
            "mes": k,
            "meses_bens": _round(meses_bens, 2),
            "meses_bens_servicos": _round(meses_bens_serv, 2),
        })

    # ---- Output ----
    payload = {
        "schema_version": 2,
        "gerado_em": datetime.now(timezone.utc).isoformat(),
        "fonte_principal": "Banco Central do Brasil — Estatísticas do Setor Externo (BPM6)",
        "ultima_referencia_mensal": k_tc,
        "ultima_referencia_diaria": k_div,
        "hero": hero,
        "bloco_a": {
            "saldo_anual": tc_anual_pct,
            "decomposicao_mensal_36m": bp_decomp_24m,
            "balanca_comercial_36m": balanca_24m,
            # v2 — acumulados 12m sobre a série completa, desde 2005, US$ bi
            "decomposicao_12m": decomposicao_12m_serie,
            "balanca_12m": balanca_12m_serie,
        },
        "bloco_b": {
            "idp_vs_tc_pct_pib": idp_vs_tc,
            "idp_decomposicao_36m": idp_decomp_24m,
            # v2
            "cobertura_idp": cobertura_idp_serie,
            "idp_decomposicao_12m": idp_12m_serie,
        },
        "bloco_c": {
            "reservas_diaria": reservas_serie,
            "meses_importacao_recente": meses_importacao,
            # v2
            "reservas_mensal": reservas_mensal_serie,
            "meses_importacao_serie": meses_importacao_serie,
        },
        # v2
        "bloco_servicos": {
            "serie_12m": servicos_12m_serie,
            "_nota": (
                "Saldos acumulados 12m em US$ bi. Componentes: transportes (SGS 22728), "
                "viagens (22740), telecom/computação/informação (22776), propriedade "
                "intelectual (22779). 'demais' é residual = total de serviços (22719) − "
                "soma dos componentes listados (inclui p.ex. serviços financeiros, "
                "aluguel de equipamentos e demais serviços empresariais)."
            ),
        },
        "bloco_renda": {
            "serie_12m": renda_12m_serie,
            "_nota": (
                "Saldos acumulados 12m em US$ bi. Componentes: lucros e dividendos de "
                "investimento direto (SGS 22812), lucros reinvestidos (22815), salários "
                "(22803). 'juros_e_demais' = renda de investimento (22806) − (22812 + "
                "22815), i.e. juros de portfólio/outros investimentos e demais rendas. "
                "Total = renda primária (22800)."
            ),
        },
        "metadata": {
            "fonte": "BCB SGS / BPM6",
            "nota": "Saldo de transações correntes e componentes em US$. Decomposição soma identidade do BPM6: bens + serviços + renda primária + renda secundária ≈ saldo TC.",
            "series_sgs": SERIES_MENSAIS,
            "series_diarias_sgs": SERIES_DIARIAS,
        },
    }

    # (merge incremental: o Blob anterior já foi baixado no início do build e
    #  usado para preservar reservas/hero; o conjunto novo é autoritativo.)

    out_file.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    size_kb = out_file.stat().st_size / 1024
    print(f"\n[OK] Gerado {out_file} ({size_kb:.1f} KB)")
    print(f"  Hero TC: {v_tc:.2f}% do PIB ({k_tc})" if v_tc else "  Hero TC: -")
    print(f"  Hero IDP: {v_idp:.2f}% do PIB ({k_idp})" if v_idp else "  Hero IDP: -")
    print(f"  Reservas: US$ {reservas_recente/1000:.1f} bi ({k_div})" if reservas_recente else "  Reservas: -")
    print(f"  Meses de importação: {meses_importacao:.1f}" if meses_importacao else "  Meses imp: -")

    if args.upload:
        try:
            from shared.blob_upload import maybe_upload_json
            maybe_upload_json(out_file, BLOB_PATH)
        except Exception as e:
            print(f"[upload] FAIL: {e}", file=sys.stderr)
            sys.exit(3)


if __name__ == "__main__":
    main()
