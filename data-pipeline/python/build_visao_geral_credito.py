"""Build do JSON do Painel Visão Geral — bloco Crédito e Condições Financeiras.

Consome o BCB SGS para:
- Concessões totais PF (20662) e PJ (20635) — mensal R$ milhões
- Concessões PF veículos (20673), não-consignado (20666), imobiliário direcionado (20704)
- Saldos de crédito livre PF: não rotativo (20571) e rotativo (20572)
- Saldos de crédito SFN: total (20539), PJ (20540), PF (20541)
- Agregados monetários: M1 (27788), M2 (27789), M3 (27790), M4 (27791)
- IPCA mensal (433, desde 2010) para compor o índice deflator

AUDITORIA 2026-06 (rótulos legados): as séries 20571/20572 estavam rotuladas
como "crédito ampliado famílias/empresas", mas no catálogo SGS são:
  20571 = Saldo da carteira de crédito com recursos LIVRES NÃO ROTATIVO — PF
  20572 = Saldo da carteira de crédito com recursos LIVRES ROTATIVO — PF
  (20571 + 20572 = 20570 = livres PF total; nada de "ampliado" nem de "empresas")
Pela regra aditiva do schema v2, os campos JSON legados (`credito_*_pct_pib`,
`impulso_*_pp`) foram MANTIDOS com os mesmos valores; campos novos com nomes
corretos foram adicionados (`livres_pf_*` e `saldo_sfn_*`). O front deve migrar.

Calcula:
- Concessões reais (deflator = índice IPCA composto Π(1+v/100), último mês = 100)
- Variação real a/a das concessões
- Crédito/PIB (PIB 12m nominal 4382): livres PF (legado) e saldo SFN total/PF/PJ (correto)
- Impulso de crédito: Δ em pp do crédito/PIB em 12 meses

Gera `data-pipeline/out/visao_geral_credito.json`.

Ragged-edge tolerante: cada série tem `--soft-fail` próprio; falha de 1 série
não derruba as outras.
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
BLOB_PATH = "data/visao_geral_credito.json"
UA = {"User-Agent": "az-invest-visao-geral-credito/0.1"}
SGS_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{cod}/dados?formato=json"

SERIES: dict[str, int] = {
    "concessoes_pf_total": 20662,
    "concessoes_pj_total": 20635,
    "concessoes_pf_veiculos": 20673,
    "concessoes_pf_naoconsignado": 20666,
    "concessoes_pf_imobiliario": 20704,
    # 20571/20572: rotulados historicamente como "crédito ampliado famílias/empresas",
    # mas são na verdade crédito LIVRE PF não rotativo/rotativo (ver docstring).
    "saldo_livres_pf_nao_rotativo": 20571,
    "saldo_livres_pf_rotativo": 20572,
    "saldo_sfn_total": 20539,
    "saldo_sfn_pj": 20540,
    "saldo_sfn_pf": 20541,
    "m1": 27788,
    "m2": 27789,
    "m3": 27790,
    "m4": 27791,
    "ipca_mensal": 433,
    "pib_12m_brl": 4382,
}

# dataInicial específico por série (SGS aceita dd/mm/yyyy)
SERIES_DATA_INICIAL: dict[str, str] = {
    "ipca_mensal": "01/01/2010",
}

INPUTS = {  # min_start_date conservador — séries começam mais tarde
    "concessoes_pf_total": "2011-03",
    "concessoes_pj_total": "2011-03",
    # "credito_ampliado" é rótulo LEGADO (mantido pela regra aditiva): refere-se
    # às séries 20571/20572 = crédito livre PF (início real 2007-03).
    "credito_ampliado": "2013-01",
    "saldo_credito_sfn": "2007-03",
    "ipca_mensal": "2010-01",
    "pib_12m": "1990-01",
}


def _get(url: str, *, timeout: int = 60, retries: int = 3, sleep: float = 3.0) -> requests.Response:
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
    if v in ("", None):
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _parse_sgs_date(s: str) -> str:
    d, m, y = s.split("/")
    return f"{y}-{m}"


def sgs_fetch(cod: int, data_inicial: str | None = None) -> dict[str, float | None]:
    url = SGS_URL.format(cod=cod)
    if data_inicial:
        url += f"&dataInicial={data_inicial}"
    print(f"  [SGS {cod}]")
    data = _get(url).json()
    return {_parse_sgs_date(r["data"]): _to_float(r["valor"]) for r in data}


def ipca_indice_composto(ipca_mensal: dict[str, float | None]) -> dict[str, float]:
    """Índice IPCA composto a partir da variação mensal (SGS 433).

    Compõe Π(1 + v/100) mês a mês e normaliza o ÚLTIMO mês disponível = 100.
    """
    meses = sorted(m for m, v in ipca_mensal.items() if v is not None)
    if not meses:
        return {}
    idx: dict[str, float] = {}
    acc = 1.0
    for m in meses:
        acc *= 1.0 + ipca_mensal[m] / 100.0
        idx[m] = acc
    ultimo = idx[meses[-1]]
    return {m: v / ultimo * 100.0 for m, v in idx.items()}


def deflate_real(nominal_series: dict[str, float | None], ipca_indice: dict[str, float]) -> dict[str, float | None]:
    """Deflaciona série nominal pelo índice IPCA composto (último mês = 100).

    real_m = nominal_m × 100 / índice_m → valores a preços do último mês do índice.
    Meses sem índice (anteriores a 2010) ficam None.
    """
    out: dict[str, float | None] = {}
    for m in sorted(nominal_series.keys()):
        nom = nominal_series.get(m)
        i_m = ipca_indice.get(m)
        out[m] = round(nom * 100.0 / i_m, 2) if (nom is not None and i_m) else None
    return out


def variacao_12m(serie: dict[str, float | None]) -> dict[str, float | None]:
    meses = sorted(serie.keys())
    out: dict[str, float | None] = {}
    for i, m in enumerate(meses):
        if i < 12:
            out[m] = None
            continue
        prev = serie.get(meses[i - 12])
        cur = serie.get(m)
        if cur is None or prev is None or prev == 0:
            out[m] = None
            continue
        out[m] = round((cur / prev - 1) * 100, 2)
    return out


def fetch_all_safe(soft_fail: bool) -> dict[str, dict[str, float | None]]:
    out: dict[str, dict[str, float | None]] = {}
    falhas: list[str] = []
    for key, cod in SERIES.items():
        try:
            out[key] = sgs_fetch(cod, data_inicial=SERIES_DATA_INICIAL.get(key))
            time.sleep(0.3)
        except Exception as e:
            print(f"  FALHA {key} ({cod}): {e}", file=sys.stderr)
            falhas.append(key)
            out[key] = {}
            if not soft_fail:
                raise
    if falhas:
        print(f"  séries com falha: {falhas}", file=sys.stderr)
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description="Build do JSON Painel Visão Geral — Crédito")
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--soft-fail", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "visao_geral_credito.json"

    print("== Crédito e Condições Financeiras (BCB SGS) ==")
    series = fetch_all_safe(soft_fail=args.soft_fail)

    # Concessões reais e variação real — deflator = índice IPCA composto (SGS 433)
    ipca_indice = ipca_indice_composto(series.get("ipca_mensal", {}))
    print(f"  índice IPCA composto: {len(ipca_indice)} meses (último = 100)")
    concessoes_pf_real = deflate_real(series.get("concessoes_pf_total", {}), ipca_indice)
    concessoes_pj_real = deflate_real(series.get("concessoes_pj_total", {}), ipca_indice)

    var_pf_real = variacao_12m(concessoes_pf_real)
    var_pj_real = variacao_12m(concessoes_pj_real)

    # Crédito / PIB
    # Legado (rótulo errado, valores mantidos): 20571/20572 = livres PF não rotativo/rotativo.
    saldo_livre_nrot = series.get("saldo_livres_pf_nao_rotativo", {})
    saldo_livre_rot = series.get("saldo_livres_pf_rotativo", {})
    # Correto: saldo da carteira de crédito do SFN — total (20539), PF (20541), PJ (20540).
    saldo_sfn_total = series.get("saldo_sfn_total", {})
    saldo_sfn_pf = series.get("saldo_sfn_pf", {})
    saldo_sfn_pj = series.get("saldo_sfn_pj", {})
    pib_12m = series.get("pib_12m_brl", {})

    def _pct_pib(valor: float | None, pib: float | None) -> float | None:
        if valor is None or pib is None or pib == 0:
            return None
        return round(valor / pib * 100, 2)

    credito_pib: list[dict[str, Any]] = []
    todos_meses = sorted(set(saldo_livre_nrot.keys()) | set(saldo_livre_rot.keys()))
    for m in todos_meses:
        s_nrot = saldo_livre_nrot.get(m)
        s_rot = saldo_livre_rot.get(m)
        if s_nrot is None or s_rot is None:
            continue
        # pib_12m está em R$ milhões, saldos em R$ milhões → razão *100 = %
        pib = pib_12m.get(m)
        if pib is None or pib == 0:
            pib = None
        total = s_nrot + s_rot
        credito_pib.append(
            {
                "mes": m,
                # LEGADO (nomes errados — manter pela regra aditiva; front deve migrar):
                "credito_total_pct_pib": _pct_pib(total, pib),
                "credito_familias_pct_pib": _pct_pib(s_nrot, pib),
                "credito_empresas_pct_pib": _pct_pib(s_rot, pib),
                # NOVOS (nomes corretos para os mesmos dados legados):
                "livres_pf_total_pct_pib": _pct_pib(total, pib),
                "livres_pf_nao_rotativo_pct_pib": _pct_pib(s_nrot, pib),
                "livres_pf_rotativo_pct_pib": _pct_pib(s_rot, pib),
                # NOVOS (séries corretas para total/famílias/empresas — saldo SFN):
                "saldo_sfn_total_pct_pib": _pct_pib(saldo_sfn_total.get(m), pib),
                "saldo_sfn_familias_pct_pib": _pct_pib(saldo_sfn_pf.get(m), pib),
                "saldo_sfn_empresas_pct_pib": _pct_pib(saldo_sfn_pj.get(m), pib),
            }
        )

    # Impulso de crédito: Δ em pp do crédito/PIB em 12 meses (total, PF, PJ)
    cp_por_mes = {r["mes"]: r for r in credito_pib}
    impulso_credito: list[dict[str, Any]] = []
    for m in sorted(cp_por_mes.keys()):
        prev_m = f"{int(m[:4]) - 1}-{m[5:7]}"
        atual = cp_por_mes[m]
        ant = cp_por_mes.get(prev_m)
        if ant is None:
            continue

        def _delta(campo: str) -> float | None:
            a, b = atual.get(campo), ant.get(campo)
            return round(a - b, 2) if (a is not None and b is not None) else None

        impulso_credito.append(
            {
                "mes": m,
                # LEGADO (nomes errados — base = livres PF; manter pela regra aditiva):
                "impulso_total_pp": _delta("credito_total_pct_pib"),
                "impulso_familias_pp": _delta("credito_familias_pct_pib"),
                "impulso_empresas_pp": _delta("credito_empresas_pct_pib"),
                # NOVOS (nomes corretos para os mesmos dados legados):
                "impulso_livres_pf_total_pp": _delta("livres_pf_total_pct_pib"),
                "impulso_livres_pf_nao_rotativo_pp": _delta("livres_pf_nao_rotativo_pct_pib"),
                "impulso_livres_pf_rotativo_pp": _delta("livres_pf_rotativo_pct_pib"),
                # NOVOS (base correta — saldo SFN total/PF/PJ):
                "impulso_saldo_sfn_total_pp": _delta("saldo_sfn_total_pct_pib"),
                "impulso_saldo_sfn_familias_pp": _delta("saldo_sfn_familias_pct_pib"),
                "impulso_saldo_sfn_empresas_pp": _delta("saldo_sfn_empresas_pct_pib"),
            }
        )

    # Variação real a/a M2
    m2 = series.get("m2", {})
    m2_real = deflate_real(m2, ipca_indice)
    var_m2_real = variacao_12m(m2_real)

    # Serialização final
    def serie_para_lista(d: dict[str, float | None]) -> list[dict[str, Any]]:
        return [{"mes": m, "valor": d[m]} for m in sorted(d.keys())]

    payload: dict[str, Any] = {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "schema_version": 2,
        "freshness_status": "fresh",
        "concessoes": {
            "pf_total_nominal": serie_para_lista(series.get("concessoes_pf_total", {})),
            "pj_total_nominal": serie_para_lista(series.get("concessoes_pj_total", {})),
            "pf_total_real_12m_var_pct": serie_para_lista(var_pf_real),
            "pj_total_real_12m_var_pct": serie_para_lista(var_pj_real),
            "pf_veiculos_nominal": serie_para_lista(series.get("concessoes_pf_veiculos", {})),
            "pf_naoconsignado_nominal": serie_para_lista(series.get("concessoes_pf_naoconsignado", {})),
            "pf_imobiliario_nominal": serie_para_lista(series.get("concessoes_pf_imobiliario", {})),
        },
        "credito_pib": credito_pib,
        "impulso_credito": impulso_credito,
        "agregados_monetarios": {
            "m1": serie_para_lista(series.get("m1", {})),
            "m2": serie_para_lista(series.get("m2", {})),
            "m3": serie_para_lista(series.get("m3", {})),
            "m4": serie_para_lista(series.get("m4", {})),
            "m2_real_var_12m_pct": serie_para_lista(var_m2_real),
        },
        "inputs": INPUTS,
        "min_start_date": max(INPUTS.values()),
        "metadata": {
            "fonte": "BCB SGS — concessões mensais (20662/20635/20673/20666/20704), crédito livre PF não rotativo/rotativo (20571/20572), saldo SFN total/PJ/PF (20539/20540/20541), agregados (27788-27791), IPCA mensal (433, desde 2010), PIB 12m (4382).",
            "nota": "Deflator: índice IPCA composto Π(1+v/100) a partir do SGS 433, normalizado com último mês = 100 — séries reais a preços do último mês. Impulso de crédito = variação em 12 meses, em pontos percentuais do PIB, do estoque de crédito/PIB.",
            "nota_auditoria_2026_06": "Os campos legados credito_total/familias/empresas_pct_pib e impulso_total/familias/empresas_pp usam as séries 20571/20572, que são crédito LIVRE PF (não rotativo/rotativo) — NÃO 'crédito ampliado famílias/empresas' como o rótulo sugeria. Valores preservados pela regra aditiva. Migrar o front para livres_pf_* (mesmos dados, nome correto) ou saldo_sfn_* (saldo da carteira de crédito do SFN: total 20539, famílias 20541, empresas 20540).",
        },
    }

    out_file.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"JSON {out_file} ({out_file.stat().st_size / 1024:.1f} KB)")

    if args.upload:
        sys.path.insert(0, str(HERE))
        from shared.blob_upload import maybe_upload_json
        try:
            maybe_upload_json(out_file, BLOB_PATH)
        except Exception as e:
            print(f"[upload] FALHOU: {e}", file=sys.stderr)
            if not args.soft_fail:
                sys.exit(1)


if __name__ == "__main__":
    main()
