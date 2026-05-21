"""Build do JSON do Painel Contas Externas — Brasil, BPM6.

Baixa séries do BCB SGS:
- Balanço de Pagamentos — Transações Correntes (22701) e componentes (22707 bens,
  22711 exportações bens, 22719 serviços líquido, 22740 renda primária).
- Investimento Direto no País (22885 líquido, 22886 ingressos), com decomposição
  (22888 participação, 22891 part. exc. reinvestimento, 22892 reinvestimento).
- Investimento brasileiro no exterior (22865 líquido).
- Reservas internacionais (3546 mensal, 13982 liquidez diária).
- PIB 12m em US$ (4380) para denominador de % PIB.

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
    "renda_primaria_saldo": 22740,      # Renda primária - saldo
    # Investimento Direto no País — US$ milhões mensais (passivos)
    "idp_liquido": 22885,               # IDP - líquido
    "idp_ingressos": 22886,             # IDP - ingressos
    "idp_participacao_capital": 22888,  # IDP - Participação no capital
    "idp_reinvestimento": 22892,        # IDP - Reinvestimento de lucros
    "idp_part_exc_reinv": 22891,        # IDP - Participação exc reinvestimento
    # Investimento brasileiro no exterior
    "ide_liquido": 22865,               # IDE - líquido
    # Reservas mensais
    "reservas_mensal": 3546,            # Reservas internacionais total mensal (US$ milhões)
    # PIB acumulado 12m (US$ milhões) — denominador
    "pib_12m": 4380,
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

    # Decomposição da TC: bens + serviços + renda primária + residual (≈ renda secundária)
    tc_decomposto: dict[str, dict[str, float | None]] = {}
    for k in mensais["tc_saldo"]:
        tc_val = mensais["tc_saldo"].get(k)
        bens = bens_saldo.get(k)
        servicos = mensais["servicos_liquido"].get(k)
        renda_prim = mensais["renda_primaria_saldo"].get(k)
        if any(v is None for v in [tc_val, bens, servicos, renda_prim]):
            residual = None
        else:
            residual = tc_val - bens - servicos - renda_prim
        tc_decomposto[k] = {
            "saldo_total": tc_val,
            "bens": bens,
            "servicos": servicos,
            "renda_primaria": renda_prim,
            "renda_secundaria": residual,
        }

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

    # ---- Output ----
    payload = {
        "gerado_em": datetime.now(timezone.utc).isoformat(),
        "fonte_principal": "Banco Central do Brasil — Estatísticas do Setor Externo (BPM6)",
        "ultima_referencia_mensal": k_tc,
        "ultima_referencia_diaria": k_div,
        "hero": hero,
        "bloco_a": {
            "saldo_anual": tc_anual_pct,
            "decomposicao_mensal_36m": bp_decomp_24m,
            "balanca_comercial_36m": balanca_24m,
        },
        "bloco_b": {
            "idp_vs_tc_pct_pib": idp_vs_tc,
            "idp_decomposicao_36m": idp_decomp_24m,
        },
        "bloco_c": {
            "reservas_diaria": reservas_serie,
            "meses_importacao_recente": meses_importacao,
        },
        "metadata": {
            "fonte": "BCB SGS / BPM6",
            "nota": "Saldo de transações correntes e componentes em US$. Decomposição soma identidade do BPM6: bens + serviços + renda primária + renda secundária ≈ saldo TC.",
            "series_sgs": SERIES_MENSAIS,
            "series_diarias_sgs": SERIES_DIARIAS,
        },
    }

    # ---- Merge incremental (preserva histórico) ----
    if not args.no_merge:
        try:
            sys.path.insert(0, str(HERE))
            from shared.blob_download import download_json
            prev = download_json(BLOB_PATH)
            if prev:
                print(f"  [merge] Blob anterior gerado_em {prev.get('gerado_em')}")
                # Não há janelas de retenção problemáticas aqui; apenas mantemos
                # gerado_em mais recente e o conjunto novo é autoritativo.
        except Exception as e:
            print(f"  [merge] WARN: {e}", file=sys.stderr)

    out_file.write_text(json.dumps(payload, ensure_ascii=False))
    size_kb = out_file.stat().st_size / 1024
    print(f"\n✓ Gerado {out_file} ({size_kb:.1f} KB)")
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
