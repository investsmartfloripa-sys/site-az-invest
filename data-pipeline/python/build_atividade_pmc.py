"""Build do JSON do Painel Atividade — bloco PMC (ENRIQUECIDO).

IBGE SIDRA — PMC base 2022=100:
- 8880 — Varejo restrito (geral)
- 8881 — Varejo ampliado (geral)
- 8882 — Restrito por 11 atividades
- 8883 — Ampliado por 14 atividades

Salva: serie geral (restrito+ampliado, volume+receita_nominal), TODAS as atividades
por mês (não só top 5), gap restrito-ampliado, heatmap mensal.
"""
from __future__ import annotations
import argparse, json, sys, time
from datetime import datetime, timezone
from pathlib import Path
import requests

HERE = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/atividade_pmc.json"
UA = {"User-Agent": "az-invest-atividade-pmc/0.2"}
SIDRA_BASE = "https://apisidra.ibge.gov.br/values"

VAR_PMC = {
    "11708": "var_mom_sa",
    "11709": "var_yoy",
    "11710": "var_acum_ano",
    "11711": "var_acum_12m",
    "7169": "indice",
    "7170": "indice_sa",
}

# Tipos de índice (c11046): receita nominal × volume
TIPO_RESTRITO = {"56733": "receita_nominal", "56734": "volume"}
TIPO_AMPLIADO = {"56735": "receita_nominal", "56736": "volume"}


def _get(url, *, timeout=90, retries=3, sleep=3.0):
    last = None
    for i in range(retries):
        try:
            r = requests.get(url, timeout=timeout, headers=UA)
            r.raise_for_status()
            return r
        except Exception as e:
            last = e
            time.sleep(sleep)
    raise RuntimeError(f"falha: {last}")


def _to_float(v):
    if v in ("", "-", "..", "...", None):
        return None
    try:
        return float(str(v).replace(",", "."))
    except (TypeError, ValueError):
        return None


def _mes(d3c):
    return f"{d3c[:4]}-{d3c[4:]}"


def sidra(tabela, path):
    url = f"{SIDRA_BASE}/t/{tabela}{path}"
    print(f"  [SIDRA {tabela}]")
    data = _get(url).json()
    return data[1:] if data else []


def carrega_geral(tabela, tipo_map, periodos=320):
    rows = sidra(tabela, f"/n1/all/v/all/p/last%20{periodos}/c11046/all?formato=json")
    out = {}
    for r in rows:
        var_nome = VAR_PMC.get(r.get("D2C"))
        tipo = tipo_map.get(r.get("D4C"))
        d3c = r.get("D3C", "")
        if not var_nome or not tipo or not d3c:
            continue
        out.setdefault(_mes(d3c), {}).setdefault(tipo, {})[var_nome] = _to_float(r.get("V"))
    return out


def carrega_atividades(tabela, tipo_volume, periodos=60):
    """Todas as atividades com var_yoy + var_mom_sa + var_acum_12m + indice_sa."""
    rows = sidra(tabela, f"/n1/all/v/all/p/last%20{periodos}/c11046/all/c85/all?formato=json")
    out = {}  # mes → list[dict]
    by_mes_ativ = {}  # mes → ativ → {var: v}
    nomes = {}
    for r in rows:
        var_nome = VAR_PMC.get(r.get("D2C"))
        tipo = r.get("D4C", "")
        d3c = r.get("D3C", "")
        d5c = r.get("D5C", "")
        d5n = r.get("D5N", "")
        if not var_nome or tipo != tipo_volume or not d3c or not d5c:
            continue
        mes = _mes(d3c)
        by_mes_ativ.setdefault(mes, {}).setdefault(d5c, {})[var_nome] = _to_float(r.get("V"))
        nomes[d5c] = d5n
    for mes, atividades in by_mes_ativ.items():
        items = []
        for d5c, vals in atividades.items():
            items.append({
                "id": d5c,
                "atividade": nomes.get(d5c, d5c),
                "var_yoy": vals.get("var_yoy"),
                "var_mom_sa": vals.get("var_mom_sa"),
                "var_acum_12m": vals.get("var_acum_12m"),
                "indice_sa": vals.get("indice_sa"),
            })
        items.sort(key=lambda x: x["var_yoy"] if x["var_yoy"] is not None else -999, reverse=True)
        out[mes] = items
    return out, nomes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "atividade_pmc.json"

    print("== PMC 8880 restrito ==")
    restrito = carrega_geral(8880, TIPO_RESTRITO)
    print("== PMC 8881 ampliado ==")
    ampliado = carrega_geral(8881, TIPO_AMPLIADO)
    print("== PMC 8882 restrito por atividade ==")
    ativ_restrito, nomes_r = carrega_atividades(8882, "56734")  # volume restrito
    print("== PMC 8883 ampliado por atividade ==")
    ativ_ampliado, nomes_a = carrega_atividades(8883, "56736")  # volume ampliado

    meses = sorted(set(restrito.keys()) | set(ampliado.keys()))
    if not meses:
        sys.exit(2)
    mes_recente = meses[-1]

    # Série unificada com TODAS as vars (volume + receita) restrito + ampliado
    serie = []
    for m in meses:
        item = {"mes": m}
        for tipo in ("volume", "receita_nominal"):
            r = restrito.get(m, {}).get(tipo, {})
            a = ampliado.get(m, {}).get(tipo, {})
            for var_nome in VAR_PMC.values():
                item[f"restrito_{tipo}_{var_nome}"] = r.get(var_nome)
                item[f"ampliado_{tipo}_{var_nome}"] = a.get(var_nome)
        # gap ampliado − restrito (var YoY volume)
        rv = item.get("restrito_volume_var_yoy")
        av = item.get("ampliado_volume_var_yoy")
        item["gap_yoy"] = round(av - rv, 2) if (rv is not None and av is not None) else None
        # v2: deflator implícito do varejo = (1+receita)/(1+volume) − 1 (inflação embutida nas vendas)
        for escopo in ("restrito", "ampliado"):
            rec = item.get(f"{escopo}_receita_nominal_var_yoy")
            vol = item.get(f"{escopo}_volume_var_yoy")
            item[f"{escopo}_deflator_yoy"] = (
                round(((1 + rec / 100) / (1 + vol / 100) - 1) * 100, 2)
                if (rec is not None and vol is not None) else None
            )
        serie.append(item)

    # Sanity
    ult = serie[-1]
    idx_r = ult.get("restrito_volume_indice_sa")
    assert idx_r is None or 70 < idx_r < 140

    out = {
        "schema_version": 2,
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "mes_recente": mes_recente,
        "serie": serie,
        "atividades": {
            "mes_recente": mes_recente,
            "restrito_mensal": ativ_restrito,  # mes → list
            "ampliado_mensal": ativ_ampliado,  # mes → list
        },
        "metadata": {
            "fonte": "IBGE SIDRA — PMC (8880 restrito, 8881 ampliado, 8882/8883 por atividade). Base 2022=100; restrito retropola a ~2000, ampliado a ~2003/04 (séries com inícios distintos).",
            "nota": "Volume é deflacionado (manchete IBGE); receita nominal mostra impacto da inflação. Ampliado adiciona veículos + materiais de construção (mais volátil). Gap ampliado−restrito mede contribuição de autos/construção. Deflator implícito (v2) = (1+receita)/(1+volume)−1.",
        },
    }

    out_file.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"JSON {out_file} ({out_file.stat().st_size/1024:.1f} KB) | atividades restrito mes_rec: {len(ativ_restrito.get(mes_recente, []))} | ampliado: {len(ativ_ampliado.get(mes_recente, []))}")

    if args.upload:
        sys.path.insert(0, str(HERE))
        from shared.blob_upload import maybe_upload_json
        maybe_upload_json(out_file, BLOB_PATH)


if __name__ == "__main__":
    main()
