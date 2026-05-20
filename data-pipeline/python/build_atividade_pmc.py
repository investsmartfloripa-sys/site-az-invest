"""Build do JSON do Painel Atividade — bloco PMC (Comércio Varejista).

Baixa do IBGE SIDRA (PMC base 2022=100):
- 8880 — Varejo restrito (índice geral)
- 8881 — Varejo ampliado (índice geral)
- 8882 — Varejo restrito por 11 atividades
- 8883 — Varejo ampliado por 14 atividades

Decisão editorial (NOTAS §3.4): gráfico principal mostra restrito + ampliado lado a lado.

Gera `data-pipeline/out/atividade_pmc.json` e upload pra `data/atividade_pmc.json`.
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
BLOB_PATH = "data/atividade_pmc.json"

UA = {"User-Agent": "az-invest-atividade-pmc/0.1"}
SIDRA_BASE = "https://apisidra.ibge.gov.br/values"

# Variáveis comuns PMC (base 2022=100)
VAR_PMC = {
    "11708": "var_mom_sa",
    "11709": "var_yoy",
    "11710": "var_acum_ano",
    "11711": "var_acum_12m",
    "7169": "indice",
    "7170": "indice_sa",
}

# Tipos de índice (c11046)
TIPO_INDICE = {
    "56733": "receita_nominal",  # restrito
    "56734": "volume",            # restrito
    "56735": "receita_nominal",  # ampliado (mesmo nome, tabela diferente)
    "56736": "volume",            # ampliado
}


def _get(url: str, *, timeout: int = 90, retries: int = 3, sleep: float = 3.0) -> requests.Response:
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


def _mes_label(d3c: str) -> str:
    return f"{d3c[:4]}-{d3c[4:]}"


def sidra_fetch(tabela: int, path: str) -> list[dict]:
    url = f"{SIDRA_BASE}/t/{tabela}{path}"
    print(f"  [SIDRA {tabela}] {url[:140]}...")
    data = _get(url).json()
    if not data:
        return []
    return data[1:]


def carrega_geral(tabela: int, periodos: int = 60) -> dict[str, dict[str, dict[str, float | None]]]:
    """Carrega 8880 ou 8881 (índice geral por tipo). Retorna {mes: {tipo: {var: valor}}}."""
    path = f"/n1/all/v/all/p/last%20{periodos}/c11046/all?formato=json"
    rows = sidra_fetch(tabela, path)
    out: dict[str, dict[str, dict[str, float | None]]] = {}
    for r in rows:
        d2c = r.get("D2C")
        d4c = r.get("D4C")
        d3c = r.get("D3C", "")
        var_nome = VAR_PMC.get(d2c)
        tipo = TIPO_INDICE.get(d4c)
        if not var_nome or not tipo or not d3c:
            continue
        mes = _mes_label(d3c)
        out.setdefault(mes, {}).setdefault(tipo, {})[var_nome] = _to_float(r.get("V"))
    return out


def carrega_atividades(tabela: int, periodos: int = 12) -> dict[str, list[dict[str, Any]]]:
    """Carrega 8882 ou 8883 (por atividade) — apenas variável var_yoy do volume.

    Retorna {mes: [{atividade, var_yoy}]}.
    """
    path = f"/n1/all/v/11709/p/last%20{periodos}/c11046/all/c85/all?formato=json"
    rows = sidra_fetch(tabela, path)
    by_mes: dict[str, list[dict[str, Any]]] = {}
    for r in rows:
        d3c = r.get("D3C", "")
        d4c = r.get("D4C", "")  # c11046 tipo de índice
        d5n = r.get("D5N", "")  # c85 atividade
        v = _to_float(r.get("V"))
        # Filtrar apenas Volume (não receita nominal)
        if d4c not in ("56734", "56736"):
            continue
        if not d3c or not d5n or v is None:
            continue
        mes = _mes_label(d3c)
        by_mes.setdefault(mes, []).append({"atividade": d5n, "var_yoy": v})
    for mes in by_mes:
        by_mes[mes].sort(key=lambda x: x["var_yoy"], reverse=True)
    return by_mes


def main() -> None:
    ap = argparse.ArgumentParser(description="Build do JSON Painel Atividade — PMC")
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "atividade_pmc.json"

    print("== PMC Restrito (SIDRA 8880) ==")
    restrito = carrega_geral(8880)
    print("== PMC Ampliado (SIDRA 8881) ==")
    ampliado = carrega_geral(8881)
    print("== PMC Restrito por atividade (SIDRA 8882) ==")
    ativ_restrito = carrega_atividades(8882)
    print("== PMC Ampliado por atividade (SIDRA 8883) ==")
    ativ_ampliado = carrega_atividades(8883)

    meses = sorted(set(restrito.keys()) | set(ampliado.keys()))
    if not meses:
        print("ERRO: nenhum mês carregado, abortando", file=sys.stderr)
        sys.exit(2)
    mes_recente = meses[-1]

    # Serie unificada: para cada mês, volume_restrito + volume_ampliado em todas as vars + receita_nominal (compactamos com prefixo)
    serie: list[dict[str, Any]] = []
    for mes in meses:
        item: dict[str, Any] = {"mes": mes}
        r_vol = restrito.get(mes, {}).get("volume", {})
        r_rec = restrito.get(mes, {}).get("receita_nominal", {})
        a_vol = ampliado.get(mes, {}).get("volume", {})
        a_rec = ampliado.get(mes, {}).get("receita_nominal", {})
        for var_nome in VAR_PMC.values():
            item[f"restrito_volume_{var_nome}"] = r_vol.get(var_nome)
            item[f"restrito_receita_{var_nome}"] = r_rec.get(var_nome)
            item[f"ampliado_volume_{var_nome}"] = a_vol.get(var_nome)
            item[f"ampliado_receita_{var_nome}"] = a_rec.get(var_nome)
        serie.append(item)

    # Atividades (mês recente, top 5 alta/queda, restrito e ampliado)
    ativ_r = ativ_restrito.get(mes_recente, [])
    ativ_a = ativ_ampliado.get(mes_recente, [])

    # Sanity
    ultimo = serie[-1]
    idx_r = ultimo.get("restrito_volume_indice_sa")
    idx_a = ultimo.get("ampliado_volume_indice_sa")
    yoy_r = ultimo.get("restrito_volume_var_yoy")
    assert idx_r is None or 70 < idx_r < 140, f"índice restrito SA fora da banda: {idx_r}"
    assert idx_a is None or 70 < idx_a < 140, f"índice ampliado SA fora da banda: {idx_a}"

    out = {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "mes_recente": mes_recente,
        "serie": serie,
        "atividades": {
            "mes": mes_recente,
            "restrito_top_altas": ativ_r[:5],
            "restrito_top_quedas": ativ_r[-5:][::-1] if ativ_r else [],
            "ampliado_top_altas": ativ_a[:5],
            "ampliado_top_quedas": ativ_a[-5:][::-1] if ativ_a else [],
        },
        "metadata": {
            "fonte": "IBGE SIDRA — PMC (tabelas 8880 restrito, 8881 ampliado, 8882 restrito por atividade, 8883 ampliado por atividade). Base 2022=100.",
            "nota": "Volume é deflacionado e é a métrica principal; receita nominal disponível como toggle. Lag editorial ~45 dias.",
        },
    }

    out_file.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nJSON salvo em {out_file} ({out_file.stat().st_size/1024:.1f} KB)")
    print(f"Mês recente: {mes_recente} | Restrito YoY: {yoy_r}% | índice SA restrito: {idx_r}")

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
