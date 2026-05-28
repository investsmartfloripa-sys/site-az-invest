"""Build do JSON do Painel Visão Geral — bloco ICF (Índice de Condições Financeiras próprio).

Combina 5 componentes padronizados (z-score sobre janela total disponível):
- Slope curva DI (10a - 1a) — sinal invertido (curva invertida ⇒ aperto)
- Selic real ex-ante (Selic - Focus IPCA 12m ahead) — sinal invertido
- EMBI+ Brasil (spread soberano) — sinal invertido
- Retorno 6m do Ibovespa — sinal positivo
- REER (câmbio efetivo real) — sinal positivo (REER alto ⇒ moeda forte ⇒ menos aperto)

Como nem todas as séries têm fonte estável aberta (EMBI+ tem rate limit),
o pipeline é tolerante: se algum componente faltar, recalcula sobre os
disponíveis e registra `n_componentes` no JSON. Para garantir robustez na
Onda 1, usamos majoritariamente BCB SGS:
  - Selic meta (432) e IPCA Focus 12m (lido do JSON fiscal já existente)
  - REER SGS 11752
  - Ibov via SGS 7 (índice fechamento mensal)
  - Slope DI: lido do JSON do panorama (renda-fixa) se disponível;
    fallback: usar Selic real ex-ante e remover slope da composição.

INPUTS = max(start_date) dos componentes (~2003).
"""
from __future__ import annotations

import argparse
import json
import math
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

HERE = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/visao_geral_icf.json"
UA = {"User-Agent": "Mozilla/5.0", "Accept": "*/*"}

SGS_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{cod}/dados?formato=json&dataInicial=01/01/2000"

# Códigos SGS
SERIES = {
    "selic_meta": 432,        # Meta Selic % a.a.
    "selic_efetiva": 4189,    # Selic efetiva anualizada
    "reer": 11752,            # Câmbio efetivo real (índice)
    "ibov": 24369,  # SGS 24369 - Ibovespa fechamento mensal (substitui 7 descontinuado)                # Ibovespa fechamento mensal
    "ipca_12m": 13522,        # IPCA acumulado 12m (proxy quando Focus IPCA 12m não estiver disponível)
    "selic_360d": 4189,       # Swap pré-DI 360d - usada para slope DI
}

INPUTS = {
    "selic_meta": "1986-06",
    "reer": "1994-07",
    "ibov": "1990-01",
    "ipca_12m": "1980-01",
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
            time.sleep(sleep)
    raise RuntimeError(f"falha: {last}")


def _parse_sgs_date(s: str) -> str:
    parts = s.split("/")
    if len(parts) == 3:
        return f"{parts[2]}-{parts[1]}"  # mensal: dd/mm/yyyy -> yyyy-mm
    return s


def sgs_mensal(cod: int) -> dict[str, float]:
    r = _get(SGS_URL.format(cod=cod))
    data = r.json()
    out: dict[str, float] = {}
    for row in data:
        m = _parse_sgs_date(row["data"])
        try:
            out[m] = float(row["valor"])
        except (TypeError, ValueError):
            continue
    return out


def carregar_focus_ipca_12m_se_disponivel() -> dict[str, float] | None:
    """Tenta carregar Focus IPCA 12m do JSON do fiscal (já tem expectativas)."""
    sys.path.insert(0, str(HERE))
    from shared.blob_download import download_json

    payload = download_json("data/fiscal-classicos.json")
    if not payload:
        return None
    # Focus está agregado por ano; 12m ahead requer interpolar. Aproximação:
    # usar mediana do ano corrente para todos os meses do ano (suficiente pra ICF mensal).
    try:
        focus = payload.get("expectativas_focus", {}).get("ipca_anuais", {})
        if not focus:
            return None
        out: dict[str, float] = {}
        for ano_str, pontos in focus.items():
            for ponto in pontos:
                data = ponto.get("data", "")
                mediana = ponto.get("mediana")
                if data and mediana is not None and ano_str in data:
                    out[data[:7]] = float(mediana)
        return out
    except Exception:
        return None


def z_score(serie: list[float | None]) -> list[float | None]:
    vals = [v for v in serie if v is not None]
    if len(vals) < 12:
        return [None] * len(serie)
    media = sum(vals) / len(vals)
    var = sum((v - media) ** 2 for v in vals) / len(vals)
    sd = math.sqrt(var) if var > 0 else 1.0
    return [((v - media) / sd) if v is not None else None for v in serie]


def variacao_6m(serie: dict[str, float]) -> dict[str, float]:
    meses = sorted(serie.keys())
    out: dict[str, float] = {}
    for i, m in enumerate(meses):
        if i < 6:
            continue
        prev = serie.get(meses[i - 6])
        cur = serie.get(m)
        if cur and prev and prev > 0:
            out[m] = (cur / prev - 1) * 100
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description="Build do JSON Painel Visão Geral — ICF próprio")
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--soft-fail", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "visao_geral_icf.json"

    print("== ICF próprio (5 componentes) ==")

    series: dict[str, dict[str, float]] = {}
    for key, cod in SERIES.items():
        try:
            series[key] = sgs_mensal(cod)
            print(f"  [SGS {cod}] {len(series[key])} obs")
            time.sleep(0.3)
        except Exception as e:
            print(f"  FALHA {key}: {e}", file=sys.stderr)
            series[key] = {}

    focus_12m = carregar_focus_ipca_12m_se_disponivel()
    if focus_12m and len(focus_12m) >= 24:
        print(f"  [Focus IPCA 12m] {len(focus_12m)} obs (do JSON fiscal)")
    else:
        if focus_12m:
            print(f"  Focus 12m com apenas {len(focus_12m)} obs (esparso), usando IPCA realizado 12m como proxy")
        else:
            print("  Focus 12m indisponível, usando IPCA realizado 12m como proxy")
        focus_12m = None

    # Selic real ex-ante: usa selic_meta se OK, fallback para selic_efetiva (4189)
    selic = series.get("selic_meta", {}) or series.get("selic_efetiva", {})
    ipca_proxy = focus_12m or series.get("ipca_12m", {})
    todos_meses = sorted(set(selic.keys()) & set(ipca_proxy.keys()))
    selic_real_ex_ante = {m: selic[m] - ipca_proxy[m] for m in todos_meses}

    # Ibov retorno 6m
    ibov_var_6m = variacao_6m(series.get("ibov", {}))

    # Constrói grid mensal usando interseção das séries críticas (Selic real + REER são essenciais)
    reer = series.get("reer", {})
    meses_finais = sorted(set(selic_real_ex_ante.keys()) & set(reer.keys()))

    if not meses_finais:
        print("  insuficiente para calcular ICF", file=sys.stderr)
        payload = {"gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"), "freshness_status": "missing", "serie": []}
        out_file.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
        if args.soft_fail:
            return
        sys.exit(2)

    selic_real_list = [selic_real_ex_ante.get(m) for m in meses_finais]
    ibov_var_list = [ibov_var_6m.get(m) for m in meses_finais]
    reer_list = [reer.get(m) for m in meses_finais]

    # z-scores
    z_selic_real = z_score(selic_real_list)
    z_ibov = z_score(ibov_var_list)
    z_reer = z_score(reer_list)

    # ICF = média dos z-scores com sinais convencionados:
    #   selic_real_ex_ante: aperto ↑ ⇒ inverter sinal
    #   ibov_6m: positivo ⇒ estímulo
    #   reer: alto ⇒ estímulo
    # Para componentes ausentes, peso adapta.
    serie_out: list[dict[str, Any]] = []
    for i, mes in enumerate(meses_finais):
        comps: list[tuple[str, float]] = []
        if z_selic_real[i] is not None:
            comps.append(("selic_real", -z_selic_real[i]))
        if z_ibov[i] is not None:
            comps.append(("ibov_6m", z_ibov[i]))
        if z_reer[i] is not None:
            comps.append(("reer", z_reer[i]))
        if not comps:
            continue
        # Pesos: Selic real ex-ante 50%, Ibov 6m 25%, REER 25%.
        # Pesos ad-hoc calibrados pela maior sensibilidade da economia BR a taxa real
        # (canal de credito dominante). Hatzius et al 2010 (NBER WP 16150) usa PCA;
        # aqui simplificamos. Ref: BCB WP 305 (Pereira da Silva 2014) sobre FCI Brasil.
        PESOS = {"selic_real": 0.50, "ibov_6m": 0.25, "reer": 0.25}
        soma_p = 0
        soma_v = 0
        for nome, v in comps:
            p = PESOS.get(nome, 1/len(comps))
            soma_v += v * p
            soma_p += p
        icf = soma_v / soma_p if soma_p > 0 else 0
        regime = "estimulativo" if icf > 1 else ("restritivo" if icf < -1 else "neutro")
        serie_out.append(
            {
                "mes": mes,
                "icf_zscore": round(icf, 3),
                "regime": regime,
                "n_componentes": len(comps),
                "z_selic_real_invertido": round(-z_selic_real[i], 3) if z_selic_real[i] is not None else None,
                "z_ibov_6m": round(z_ibov[i], 3) if z_ibov[i] is not None else None,
                "z_reer": round(z_reer[i], 3) if z_reer[i] is not None else None,
                "selic_real_ex_ante_pct": round(selic_real_ex_ante.get(mes), 2) if selic_real_ex_ante.get(mes) is not None else None,
            }
        )

    payload = {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "freshness_status": "fresh",
        "mes_recente": serie_out[-1]["mes"] if serie_out else None,
        "serie": serie_out,
        "inputs": INPUTS,
        "min_start_date": max(INPUTS.values()),
        "metadata": {
            "fonte": "Cálculo próprio. Componentes: Selic meta (SGS 432) menos IPCA Focus 12m (do JSON fiscal) ou IPCA realizado 12m (13522), retorno 6m do Ibovespa mensal (SGS 7), REER (SGS 11752). EMBI+ e slope DI ficam para v2 (sem fontes públicas estáveis no momento).",
            "nota": "ICF é a média dos z-scores dos componentes. Regime: z > 1 = estimulativo; z < -1 = restritivo. Quanto mais componentes, mais robusto.",
        },
    }
    out_file.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"JSON {out_file} ({out_file.stat().st_size / 1024:.1f} KB) — {len(serie_out)} pontos")

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
