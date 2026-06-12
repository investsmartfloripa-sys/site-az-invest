"""Build do JSON do Painel Atividade — bloco PMS (ENRIQUECIDO).

IBGE SIDRA — PMS base 2022=100:
- 5906 — Receita e volume de serviços (geral)
- 8163 — Por segmentos (20 segmentos)
- 8688 — Por atividades e subdivisões (29 cats hierárquico)
- 8694 — Atividades turísticas (turismo)
- 8695 — Transporte de passageiros e cargas

Salva: serie geral (volume+receita), TODAS as 20 segmentos + 29 atividades por mês,
turismo, transportes.
"""
from __future__ import annotations
import argparse, json, sys, time
from datetime import datetime, timezone
from pathlib import Path
import requests

HERE = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/atividade_pms.json"
UA = {"User-Agent": "az-invest-atividade-pms/0.2"}
SIDRA_BASE = "https://apisidra.ibge.gov.br/values"

VAR_PMS = {
    "11623": "var_mom_sa",
    "11624": "var_yoy",
    "11625": "var_acum_ano",
    "11626": "var_acum_12m",
    "7167": "indice",
    "7168": "indice_sa",
}
TIPO = {"56725": "receita_nominal", "56726": "volume"}
TIPO_TURISMO = {"56727": "receita_nominal", "56728": "volume"}


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


def carrega_geral(periodos=200):
    rows = sidra(5906, f"/n1/all/v/all/p/last%20{periodos}/c11046/all?formato=json")
    out = {}
    for r in rows:
        var_nome = VAR_PMS.get(r.get("D2C"))
        tipo = TIPO.get(r.get("D4C"))
        d3c = r.get("D3C", "")
        if not var_nome or not tipo or not d3c:
            continue
        out.setdefault(_mes(d3c), {}).setdefault(tipo, {})[var_nome] = _to_float(r.get("V"))
    return out


def carrega_categorias(tabela, classif_id, periodos=60):
    """Por segmento (8163) ou atividade (8688) — só volume."""
    rows = sidra(tabela, f"/n1/all/v/all/p/last%20{periodos}/c11046/all/c{classif_id}/all?formato=json")
    by_mes_cat = {}
    nomes = {}
    for r in rows:
        var_nome = VAR_PMS.get(r.get("D2C"))
        tipo = r.get("D4C", "")
        d3c = r.get("D3C", "")
        d5c = r.get("D5C", "")
        d5n = r.get("D5N", "")
        if not var_nome or tipo != "56726" or not d3c or not d5c:  # só volume
            continue
        by_mes_cat.setdefault(_mes(d3c), {}).setdefault(d5c, {})[var_nome] = _to_float(r.get("V"))
        nomes[d5c] = d5n
    out = {}
    for mes, cats in by_mes_cat.items():
        items = []
        for d5c, vals in cats.items():
            items.append({
                "id": d5c,
                "categoria": nomes.get(d5c, d5c),
                "var_yoy": vals.get("var_yoy"),
                "var_mom_sa": vals.get("var_mom_sa"),
                "var_acum_12m": vals.get("var_acum_12m"),
                "indice_sa": vals.get("indice_sa"),
            })
        items.sort(key=lambda x: x["var_yoy"] if x["var_yoy"] is not None else -999, reverse=True)
        out[mes] = items
    return out, nomes


def carrega_turismo(periodos=200):
    rows = sidra(8694, f"/n1/all/v/all/p/last%20{periodos}/c11046/all?formato=json")
    out = {}
    for r in rows:
        var_nome = VAR_PMS.get(r.get("D2C"))
        tipo = TIPO_TURISMO.get(r.get("D4C"))
        d3c = r.get("D3C", "")
        if not var_nome or not tipo or not d3c:
            continue
        out.setdefault(_mes(d3c), {}).setdefault(tipo, {})[var_nome] = _to_float(r.get("V"))
    return out


def carrega_transportes(periodos=200):
    rows = sidra(8695, f"/n1/all/v/all/p/last%20{periodos}/c11046/all/c12355/all?formato=json")
    by_mes_d5 = {}
    nomes = {}
    for r in rows:
        var_nome = VAR_PMS.get(r.get("D2C"))
        tipo = r.get("D4C", "")
        d3c = r.get("D3C", "")
        d5c = r.get("D5C", "")
        d5n = r.get("D5N", "")
        if not var_nome or tipo != "56726" or not d3c or not d5c:
            continue
        by_mes_d5.setdefault(_mes(d3c), {}).setdefault(d5c, {})[var_nome] = _to_float(r.get("V"))
        nomes[d5c] = d5n
    return by_mes_d5, nomes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "atividade_pms.json"

    print("== PMS 5906 geral ==")
    geral = carrega_geral()
    print("== PMS 8163 segmentos ==")
    segmentos, _ = carrega_categorias(8163, "1274")
    print("== PMS 8688 atividades ==")
    atividades, _ = carrega_categorias(8688, "12355")
    print("== PMS 8694 turismo ==")
    try:
        turismo = carrega_turismo()
    except Exception as e:
        print(f"  WARN turismo: {e}")
        turismo = {}
    print("== PMS 8695 transportes ==")
    try:
        transportes_raw, nomes_transp = carrega_transportes()
    except Exception as e:
        print(f"  WARN transportes: {e}")
        transportes_raw, nomes_transp = {}, {}

    # nunca sobrescrever dado bom com vazio: se turismo/transportes vierem vazios,
    # reaproveita o bloco anterior do Blob
    blocos_prev = None
    if not turismo or not transportes_raw:
        try:
            sys.path.insert(0, str(HERE))
            from shared.blob_download import download_json
            blocos_prev = download_json(BLOB_PATH)
        except Exception:
            blocos_prev = None

    meses = sorted(geral.keys())
    if not meses:
        sys.exit(2)
    mes_recente = meses[-1]

    serie = []
    for m in meses:
        item = {"mes": m}
        for tipo in ("volume", "receita_nominal"):
            t = geral.get(m, {}).get(tipo, {})
            for var_nome in VAR_PMS.values():
                item[f"{tipo}_{var_nome}"] = t.get(var_nome)
        serie.append(item)

    # Turismo: só YoY volume e índice SA pra simplificar
    serie_turismo = []
    for m in sorted(turismo.keys()):
        item = {"mes": m}
        vol = turismo[m].get("volume", {})
        rec = turismo[m].get("receita_nominal", {})
        for var_nome in VAR_PMS.values():
            item[f"volume_{var_nome}"] = vol.get(var_nome)
            item[f"receita_{var_nome}"] = rec.get(var_nome)
        serie_turismo.append(item)

    # Transportes: vários sub-categorias
    serie_transportes = []
    for m in sorted(transportes_raw.keys()):
        item = {"mes": m}
        for d5c, vals in transportes_raw[m].items():
            label = nomes_transp.get(d5c, d5c)
            # Slug curto e estável
            if "passageiro" in label.lower():
                slug = "passageiros"
            elif "carga" in label.lower():
                slug = "cargas"
            else:
                slug = label.lower().replace(" ", "_").replace(".", "")[:20] or "outros"
            for var_nome in VAR_PMS.values():
                item[f"{slug}_{var_nome}"] = vals.get(var_nome)
        serie_transportes.append(item)

    ult = serie[-1]
    idx_sa = ult.get("volume_indice_sa")
    assert idx_sa is None or 70 < idx_sa < 140

    # preserva blocos anteriores se a rodada veio vazia
    bloco_turismo = {"serie": serie_turismo}
    if not serie_turismo and blocos_prev and blocos_prev.get("turismo", {}).get("serie"):
        bloco_turismo = blocos_prev["turismo"]
        print("  [preserva] turismo vazio nesta rodada — mantido bloco anterior do Blob")
    bloco_transportes = {"labels_transportes": nomes_transp, "serie": serie_transportes}
    if not serie_transportes and blocos_prev and blocos_prev.get("transportes", {}).get("serie"):
        bloco_transportes = blocos_prev["transportes"]
        print("  [preserva] transportes vazio nesta rodada — mantido bloco anterior do Blob")

    n_tur_sa = sum(1 for r in bloco_turismo.get("serie", []) if r.get("volume_indice_sa") is not None)
    print(f"  [turismo] {len(bloco_turismo.get('serie', []))} meses | volume_indice_sa não-nulo: {n_tur_sa}")

    out = {
        "schema_version": 2,
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "mes_recente": mes_recente,
        "serie": serie,
        "segmentos": {  # 20 segmentos com todos os meses
            "mes_recente": mes_recente,
            "serie_mensal": segmentos,
        },
        "atividades": {  # 29 atividades com todos os meses
            "mes_recente": mes_recente,
            "serie_mensal": atividades,
        },
        "turismo": bloco_turismo,
        "transportes": bloco_transportes,
        "metadata": {
            "fonte": "IBGE SIDRA — PMS (5906 geral, 8163 segmentos, 8688 atividades, 8694 turismo, 8695 transportes). Base 2022=100; série existe desde jan/2011.",
            "nota": "Volume deflacionado é a manchete IBGE. Turismo e transporte são sub-indicadores que reagem a sazonalidade e cenário externo. Se turismo/transportes vierem vazios numa rodada, o bloco anterior do Blob é preservado.",
        },
    }

    out_file.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"JSON {out_file} ({out_file.stat().st_size/1024:.1f} KB) | segmentos mes_rec: {len(segmentos.get(mes_recente, []))} | atividades: {len(atividades.get(mes_recente, []))}")

    if args.upload:
        sys.path.insert(0, str(HERE))
        from shared.blob_upload import maybe_upload_json
        maybe_upload_json(out_file, BLOB_PATH)


if __name__ == "__main__":
    main()
