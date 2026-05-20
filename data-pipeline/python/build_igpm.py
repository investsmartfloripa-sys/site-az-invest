"""Build do JSON do Painel IGP-M — escrutínio detalhado.

Códigos SGS confirmados (corrigidos):
- 189   IGP-M variação mensal
- 192   IGP-M acumulado 12 meses
- 7450  IPA-M cheio (60% do IGP-M)
- 7456  IPC-M cheio (30%)
- 7465  INCC-M cheio (10%)
- 433   IPCA mensal (referência cruzada)
- 13522 IPCA 12m (referência cruzada)
"""
from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

HERE = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/igpm.json"

UA = {"User-Agent": "az-invest-igpm-builder/0.2"}
SGS_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{cod}/dados?formato=json"

PESOS_IGPM = {"IPA-M": 60.0, "IPC-M": 30.0, "INCC-M": 10.0}
CODIGOS_COMPONENTES = {"IPA-M": 7450, "IPC-M": 7456, "INCC-M": 7465}


def _get(url, *, timeout=90, retries=3, sleep=3.0):
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
    if v in ("", "-", "..", "...", None):
        return None
    try:
        return float(str(v).replace(",", "."))
    except (TypeError, ValueError):
        return None


def _parse_sgs_date(s):
    d, m, y = s.split("/")
    return f"{y}-{m}"


def sgs_fetch(cod):
    url = SGS_URL.format(cod=cod)
    print(f"  [SGS {cod}] {url}")
    data = _get(url).json()
    return {_parse_sgs_date(r["data"]): _to_float(r["valor"]) for r in data}


def rolling12(serie, meses):
    out = {}
    for i, m in enumerate(meses):
        if i < 11:
            out[m] = None
            continue
        prod = 1.0
        ok = True
        for j in range(i - 11, i + 1):
            v = serie.get(meses[j])
            if v is None:
                ok = False
                break
            prod *= 1 + v / 100
        out[m] = round((prod - 1) * 100, 4) if ok else None
    return out


def rolling_ano(serie, meses):
    out = {}
    for m in meses:
        ano = m[:4]
        prod = 1.0
        ok = False
        for k in meses:
            if k > m:
                break
            if k.startswith(ano):
                v = serie.get(k)
                if v is None:
                    continue
                prod *= 1 + v / 100
                ok = True
        out[m] = round((prod - 1) * 100, 4) if ok else None
    return out


def sazonalidade(serie):
    por_mes = {f"{i:02d}": [] for i in range(1, 13)}
    for m, v in serie.items():
        if v is None:
            continue
        por_mes[m[5:7]].append(v)
    out = {}
    for mm, vals in por_mes.items():
        if not vals:
            out[mm] = {"media": None, "std": None, "n": 0, "min": None, "max": None}
        else:
            out[mm] = {
                "media": round(statistics.mean(vals), 3),
                "std": round(statistics.stdev(vals), 3) if len(vals) > 1 else 0.0,
                "n": len(vals),
                "min": round(min(vals), 3),
                "max": round(max(vals), 3),
            }
    return out


def estatisticas(serie):
    vals = [v for v in serie.values() if v is not None]
    if not vals:
        return {}
    return {
        "n": len(vals),
        "media": round(statistics.mean(vals), 3),
        "mediana": round(statistics.median(vals), 3),
        "std": round(statistics.stdev(vals), 3) if len(vals) > 1 else 0.0,
        "min": round(min(vals), 3),
        "max": round(max(vals), 3),
        "positivos_pct": round(100 * sum(1 for v in vals if v > 0) / len(vals), 1),
        "negativos_pct": round(100 * sum(1 for v in vals if v < 0) / len(vals), 1),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--no-merge", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "igpm.json"

    print("== IGP-M ==")
    igpm_m = sgs_fetch(189)
    igpm_12m = sgs_fetch(192)

    print("== Componentes (codigos corrigidos: 7450/7456/7465) ==")
    componentes = {nome: sgs_fetch(cod) for nome, cod in CODIGOS_COMPONENTES.items()}

    print("== IPCA pra comparacao ==")
    ipca_m = sgs_fetch(433)
    ipca_12m = sgs_fetch(13522)

    todos = set(igpm_m.keys())
    for s in componentes.values():
        todos &= set(s.keys())
    meses = sorted(todos)
    if not meses:
        print("ERRO: nenhum mes comum", file=sys.stderr)
        sys.exit(1)

    mes_recente = meses[-1]
    print(f"  Janela: {meses[0]} -> {mes_recente} ({len(meses)} meses)")

    # ---- visao geral (5 anos) ----
    serie_overview = []
    for m in meses[-60:]:
        item = {"mes": m, "IGP-M": igpm_m.get(m), "IGP-M 12m": igpm_12m.get(m)}
        soma = 0.0
        for comp, peso in PESOS_IGPM.items():
            v = componentes[comp].get(m)
            item[comp] = v
            if v is not None:
                c = v * peso / 100.0
                item[f"{comp} (contrib)"] = round(c, 4)
                soma += c
        item["contrib_soma"] = round(soma, 4)
        serie_overview.append(item)

    # ---- sub-paineis por componente (10 anos) ----
    sub_paineis = {}
    for nome, serie in componentes.items():
        acum12 = rolling12(serie, meses)
        acumano = rolling_ano(serie, meses)
        janela = meses[-120:]
        serie_longa = []
        for m in janela:
            row = {
                "mes": m,
                "mensal": serie.get(m),
                "acum_12m": acum12.get(m),
                "acum_ano": acumano.get(m),
                "ipca_mensal": ipca_m.get(m),
                "ipca_12m": ipca_12m.get(m),
            }
            if acum12.get(m) is not None and ipca_12m.get(m) is not None:
                row["spread_12m"] = round(acum12[m] - ipca_12m[m], 3)
            else:
                row["spread_12m"] = None
            serie_longa.append(row)

        ranking = sorted([(m, v) for m, v in serie.items() if v is not None], key=lambda x: x[1], reverse=True)
        maiores_altas = [{"mes": m, "valor": round(v, 3)} for m, v in ranking[:10]]
        maiores_quedas = [{"mes": m, "valor": round(v, 3)} for m, v in ranking[-10:]]
        maiores_quedas.reverse()

        sub_paineis[nome] = {
            "peso_igpm": PESOS_IGPM[nome],
            "serie_longa": serie_longa,
            "estatisticas": estatisticas(serie),
            "sazonalidade": sazonalidade(serie),
            "maiores_altas": maiores_altas,
            "maiores_quedas": maiores_quedas,
            "ultimo_mes": mes_recente,
            "ultimo_mensal": serie.get(mes_recente),
            "ultimo_12m": acum12.get(mes_recente),
            "ultimo_ano": acumano.get(mes_recente),
        }

    # ---- comparativo IGP-M vs IPCA ----
    igpm_12m_calc = rolling12(igpm_m, meses)
    comparativo = []
    for m in meses[-120:]:
        ig12 = igpm_12m.get(m) if igpm_12m.get(m) is not None else igpm_12m_calc.get(m)
        ip12 = ipca_12m.get(m)
        comparativo.append({
            "mes": m,
            "igpm_12m": ig12,
            "ipca_12m": ip12,
            "spread": round(ig12 - ip12, 3) if ig12 is not None and ip12 is not None else None,
        })

    out = {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "mes_recente": mes_recente,
        "fontes": {
            "IGP-M mensal": 189,
            "IGP-M 12m": 192,
            "IPA-M": 7450,
            "IPC-M": 7456,
            "INCC-M": 7465,
            "IPCA mensal": 433,
            "IPCA 12m": 13522,
        },
        "pesos": PESOS_IGPM,
        "overview": {
            "serie": serie_overview,
            "componentes": list(PESOS_IGPM.keys()),
            "mes_recente": mes_recente,
            "ultimo_mensal": igpm_m.get(mes_recente),
            "ultimo_12m": igpm_12m.get(mes_recente),
        },
        "comparativo_ipca": comparativo,
        "componentes": sub_paineis,
        # compat com versao anterior do frontend
        "igpm": {
            "serie": serie_overview,
            "pesos": PESOS_IGPM,
            "mes_recente": mes_recente,
            "componentes": list(PESOS_IGPM.keys()),
        },
    }

    out_file.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nJSON salvo em {out_file} ({out_file.stat().st_size/1024:.1f} KB)")
    print(f"  mes_recente: {mes_recente}")
    print(f"  IGP-M mensal: {igpm_m.get(mes_recente)} | 12m: {igpm_12m.get(mes_recente)}")
    for nome, sub in sub_paineis.items():
        print(f"  {nome}: mensal {sub['ultimo_mensal']} | 12m_calc {sub['ultimo_12m']} | ano {sub['ultimo_ano']}")

    if args.upload:
        try:
            sys.path.insert(0, str(HERE))
            from shared.blob_upload import maybe_upload_json
            maybe_upload_json(out_file, BLOB_PATH)
        except Exception as e:
            print(f"[upload] FALHOU: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        print("[upload] SKIP")


if __name__ == "__main__":
    main()
