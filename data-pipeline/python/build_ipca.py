"""Build do JSON do Painel IPCA.

Baixa dados de:
- IBGE SIDRA (IPCA cheio tabela 7060, IPCA-15 tabela 7062)
- BCB SGS (núcleos do IPCA, índice de difusão)
- BCB Olinda (expectativas Focus IPCA)

Gera `data-pipeline/out/ipca.json` e faz upload para Vercel Blob em `data/ipca.json`.

Lê BLOB_READ_WRITE_TOKEN do ambiente (idêntico aos outros builds).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

HERE = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/ipca.json"

UA = {"User-Agent": "az-invest-ipca-builder/0.1"}


def _get(url: str, *, timeout: int = 90, retries: int = 3, sleep: float = 3.0) -> requests.Response:
    last: Exception | None = None
    for i in range(retries):
        try:
            r = requests.get(url, timeout=timeout, headers=UA)
            r.raise_for_status()
            return r
        except Exception as e:  # noqa: BLE001
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


def _parse_mes_sidra(s: str) -> str:
    return f"{s[:4]}-{s[4:]}"


# ---------------------------------------------------------------------------
# SIDRA (IBGE)
# ---------------------------------------------------------------------------
SIDRA_BASE = "https://apisidra.ibge.gov.br/values"


def sidra_fetch(tabela: int, path: str) -> list[dict]:
    url = f"{SIDRA_BASE}/t/{tabela}{path}"
    print(f"  [SIDRA] {url}")
    data = _get(url).json()
    if not data:
        return []
    header = data[0]
    return [{header.get(k, k): v for k, v in item.items()} for item in data[1:]]


def carrega_ipca_hierarquia(
    tabela: int,
    var_mensal: str,
    var_peso: str,
    var_12m: str,
    periodos: int = 24,
) -> dict:
    """Carrega IPCA (ou IPCA-15) com hierarquia completa, retorna estrutura pivotada."""
    path = f"/n1/all/v/{var_mensal},{var_peso},{var_12m}/p/last%20{periodos}/c315/all/d/v{var_mensal}%202,v{var_peso}%202,v{var_12m}%202"
    rows = sidra_fetch(tabela, path)

    GRUPOS_CODES = {"7169", "7170", "7445", "7486", "7558", "7625", "7660", "7712", "7766", "7786"}
    col_var = "Variável (Código)"
    col_grupo = "Geral, grupo, subgrupo, item e subitem"
    col_grupo_cod = "Geral, grupo, subgrupo, item e subitem (Código)"
    col_mes = "Mês (Código)"

    serie_mensal: dict[str, dict[str, float]] = {}
    serie_12m: dict[str, float | None] = {}
    ipca_cheio_m: dict[str, float | None] = {}
    pesos_por_mes: dict[str, dict[str, float]] = {}

    for r in rows:
        if r.get(col_grupo_cod) not in GRUPOS_CODES:
            continue
        mes = _parse_mes_sidra(r[col_mes])
        grupo = r[col_grupo]
        val = _to_float(r["Valor"])
        var = r.get(col_var)
        if var == var_mensal:
            if grupo == "Índice geral":
                ipca_cheio_m[mes] = val
            elif val is not None:
                serie_mensal.setdefault(mes, {})[grupo] = val
        elif var == var_12m:
            if grupo == "Índice geral":
                serie_12m[mes] = val
        elif var == var_peso:
            if grupo != "Índice geral" and val is not None:
                pesos_por_mes.setdefault(mes, {})[grupo] = val

    meses = sorted(serie_mensal.keys())
    if not meses:
        return {"serie": [], "pesos_recentes": {}, "mes_recente": "", "grupos": []}
    mes_ref = meses[-1]
    pesos_recentes = pesos_por_mes.get(mes_ref, {})

    serie: list[dict] = []
    for m in meses:
        item: dict[str, Any] = {"mes": m}
        vars_grupo = serie_mensal.get(m, {})
        pesos_m = pesos_por_mes.get(m, {})
        soma_contrib = 0.0
        for g, var in vars_grupo.items():
            item[g] = var
            p = pesos_m.get(g)
            if var is not None and p is not None:
                c = var * p / 100.0
                item[f"{g} (contrib)"] = round(c, 4)
                soma_contrib += c
        item["IPCA cheio"] = ipca_cheio_m.get(m)
        item["IPCA 12m"] = serie_12m.get(m)
        item["contrib_soma"] = round(soma_contrib, 4)
        serie.append(item)

    grupos_ordenados = sorted(pesos_recentes.keys(), key=lambda g: pesos_recentes.get(g, 0), reverse=True)
    return {
        "serie": serie,
        "pesos_recentes": pesos_recentes,
        "mes_recente": mes_ref,
        "grupos": grupos_ordenados,
    }


# ---------------------------------------------------------------------------
# BCB SGS
# ---------------------------------------------------------------------------
SGS_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{cod}/dados?formato=json"


def _parse_sgs_date(s: str) -> str:
    d, m, y = s.split("/")
    return f"{y}-{m}"


def sgs_fetch(cod: int) -> dict[str, float | None]:
    url = SGS_URL.format(cod=cod)
    print(f"  [SGS {cod}] {url}")
    data = _get(url).json()
    return {_parse_sgs_date(r["data"]): _to_float(r["valor"]) for r in data}


# ---------------------------------------------------------------------------
# Focus (BCB Olinda)
# ---------------------------------------------------------------------------
FOCUS_BASE = "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata"


def focus_anuais(ano_atual: int) -> dict[int, list[dict]]:
    url = (
        f"{FOCUS_BASE}/ExpectativasMercadoAnuais?$format=json&$top=20000"
        f"&$filter=Indicador%20eq%20%27IPCA%27%20and%20Data%20ge%20%27{ano_atual - 1}-01-01%27"
        f"&$orderby=Data%20desc"
    )
    print(f"  [Focus] {url}")
    data = _get(url).json().get("value", [])
    out: dict[int, list[dict]] = {}
    for r in data:
        try:
            ano = int(r["DataReferencia"])
        except (KeyError, ValueError):
            continue
        if ano not in (ano_atual, ano_atual + 1, ano_atual + 2):
            continue
        out.setdefault(ano, []).append({
            "data": r.get("Data", "")[:10],
            "mediana": _to_float(r.get("Mediana")),
            "media": _to_float(r.get("Media")),
            "dp": _to_float(r.get("DesvioPadrao")),
            "min": _to_float(r.get("Minimo")),
            "max": _to_float(r.get("Maximo")),
        })
    for ano in out:
        out[ano].sort(key=lambda x: x["data"])
        out[ano] = out[ano][-365:]
    return out


# ---------------------------------------------------------------------------
# Maiores influencias do mes (subitens)
# ---------------------------------------------------------------------------
def maiores_influencias(tabela: int, mes_ref: str, var_mensal: str, var_peso: str) -> list[dict]:
    path = f"/n1/all/v/{var_mensal},{var_peso}/p/{mes_ref.replace('-', '')}/c315/all/d/v{var_mensal}%202,v{var_peso}%202"
    rows = sidra_fetch(tabela, path)
    col_var = "Variável (Código)"
    col_grupo = "Geral, grupo, subgrupo, item e subitem"
    sub_var: dict[str, float] = {}
    sub_peso: dict[str, float] = {}
    for r in rows:
        nome = r[col_grupo]
        if not re.match(r"^\d{7}\.", nome):  # só subitens
            continue
        v = _to_float(r["Valor"])
        if v is None:
            continue
        if r[col_var] == var_mensal:
            sub_var[nome] = v
        elif r[col_var] == var_peso:
            sub_peso[nome] = v

    def _limpa(n: str) -> str:
        return re.sub(r"^\d{7}\.", "", n).strip()

    contrib = []
    for nome, v in sub_var.items():
        p = sub_peso.get(nome)
        if p is None:
            continue
        c = v * p / 100.0
        contrib.append({"subitem": _limpa(nome), "var": v, "peso": p, "contrib_pp": round(c, 4)})
    contrib.sort(key=lambda x: x["contrib_pp"], reverse=True)
    return contrib


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    ap = argparse.ArgumentParser(description="Build do JSON do Painel IPCA")
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR), help="Diretório de saída (default: data-pipeline/out)")
    ap.add_argument("--upload", action="store_true", help="Após gerar, fazer upload pro Vercel Blob")
    ap.add_argument("--no-merge", action="store_true", help="Reservado pra futuro merge incremental (no-op por enquanto)")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "ipca.json"

    print("== IPCA cheio (SIDRA 7060) ==")
    ipca_cheio = carrega_ipca_hierarquia(7060, "63", "66", "2265")
    print(f"  {len(ipca_cheio['serie'])} meses, último: {ipca_cheio['mes_recente']}")

    print("== IPCA-15 (SIDRA 7062) ==")
    ipca_15 = carrega_ipca_hierarquia(7062, "355", "357", "1120")
    print(f"  {len(ipca_15['serie'])} meses, último: {ipca_15['mes_recente']}")

    print("== Núcleos (BCB SGS) ==")
    NUCLEOS = {
        "IPCA cheio": 433,
        "MA": 4466,
        "MS": 16121,
        "EX0": 11427,
        "EX3": 27838,
        "DP": 27839,
        "P": 28751,
    }
    nuc_data = {label: sgs_fetch(c) for label, c in NUCLEOS.items()}
    meses_nuc = sorted(set.intersection(*[set(d.keys()) for d in nuc_data.values()]))[-60:]
    serie_nucleos = []
    for m in meses_nuc:
        item = {"mes": m}
        for label in NUCLEOS:
            item[label] = nuc_data[label].get(m)
        serie_nucleos.append(item)
    print(f"  {len(serie_nucleos)} meses")

    print("== Difusão ==")
    dif = sgs_fetch(21379)
    meses_dif = sorted(dif.keys())[-60:]
    serie_difusao = [{"mes": m, "difusao": dif[m]} for m in meses_dif]
    print(f"  {len(serie_difusao)} meses")

    print("== Categorias econômicas ==")
    CATEGORIAS = {"Servicos": 11428, "Livres": 4448, "Monitorados": 4449, "Comercializaveis": 27864}
    cat_data = {label: sgs_fetch(c) for label, c in CATEGORIAS.items()}
    meses_cat = sorted(set.intersection(*[set(d.keys()) for d in cat_data.values()]))[-60:]
    serie_categorias = []
    ipca_m_by_mes = nuc_data["IPCA cheio"]
    for m in meses_cat:
        item: dict[str, Any] = {"mes": m}
        for label in CATEGORIAS:
            item[label] = cat_data[label].get(m)
        ipca_m = ipca_m_by_mes.get(m)
        if ipca_m is not None and item.get("Servicos") is not None:
            item["Bens (calc)"] = round(ipca_m - item["Servicos"], 2)
        serie_categorias.append(item)
    print(f"  {len(serie_categorias)} meses")

    print("== Focus anuais ==")
    ano_atual = int(ipca_cheio["mes_recente"][:4])
    try:
        focus = focus_anuais(ano_atual)
        print(f"  Anos: {sorted(focus.keys())} | pontos por ano: {[len(focus[a]) for a in sorted(focus.keys())]}")
    except Exception as e:
        print(f"  [WARN] Focus indisponivel ({e}). Tentando fallback do Blob anterior.", file=sys.stderr)
        focus = {}
        # Merge incremental: se Focus falhar, preserva dados do build anterior
        try:
            sys.path.insert(0, str(HERE))
            from shared.blob_download import download_json  # noqa: E402
            prev = download_json(BLOB_PATH)
            if prev and isinstance(prev, dict) and prev.get("focus"):
                focus = prev["focus"]
                print(f"  [WARN] Usando Focus do run anterior (gerado_em {prev.get('gerado_em')}).", file=sys.stderr)
        except Exception as e2:
            print(f"  [WARN] Fallback do Blob falhou ({e2}). Focus fica vazio.", file=sys.stderr)

    print("== Maiores influências do mês ==")
    inf = maiores_influencias(7060, ipca_cheio["mes_recente"], "63", "66")
    top_altas = inf[:10]
    top_quedas = inf[-10:][::-1]
    print(f"  {len(inf)} subitens; top alta: {top_altas[0]['subitem']} ({top_altas[0]['contrib_pp']} p.p.)")

    out: dict[str, Any] = {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "mes_recente": ipca_cheio["mes_recente"],
        "ipca_cheio": ipca_cheio,
        "ipca_15": ipca_15,
        "nucleos": {"serie": serie_nucleos},
        "difusao": {"serie": serie_difusao},
        "categorias": {"serie": serie_categorias},
        "focus": focus,
        "maiores_influencias": {
            "mes": ipca_cheio["mes_recente"],
            "top_altas": top_altas,
            "top_quedas": top_quedas,
        },
    }


    out_file.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    size_kb = out_file.stat().st_size / 1024
    print(f"\nJSON salvo em {out_file} ({size_kb:.1f} KB)")

    if args.upload:
        try:
            sys.path.insert(0, str(HERE))
            from shared.blob_upload import maybe_upload_json
            maybe_upload_json(out_file, BLOB_PATH)
        except Exception as e:
            print(f"[upload] FALHOU: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        print("[upload] SKIP (use --upload pra subir pro Blob)")


if __name__ == "__main__":
    main()
