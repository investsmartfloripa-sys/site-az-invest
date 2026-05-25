"""Build do bloco Comércio Exterior por Produto (Comex Stat / SECEX-MDIC).

Gera `data-pipeline/out/contas_externas_comex.json` e upload pra
`data/contas_externas_comex.json`.

Coleta:
- Top NCM exportações (12m)
- Top NCM importações (12m)
- Exportações por seção do SH (24m mensais)
- Importações por seção do SH (24m mensais)
- Top destinos das exportações (12m)
- Top origens das importações (12m)

API ComexStat usa endpoint POST /general com:
- flow=export|import
- monthDetail=true|false
- period={from,to} (YYYY-MM)
- details=[section|ncm|country|via|urf|state]
- metrics=[metricFOB|metricKG|metricStatistic]
- filterSizeLimit=12000 (necessário pra carregar dataset completo de NCM)

Rate limit: 1 req/10s aprox. (HTTP 429 com aviso).
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
BLOB_PATH = "data/contas_externas_comex.json"
COMEX = "https://api-comexstat.mdic.gov.br/general?language=pt&filterSizeLimit=12000"

UA = {"User-Agent": "az-invest-contas-externas-comex/0.1"}

# Categorias amigáveis para agregar NCMs em produtos populares
# Cada lista são prefixos NCM (4 ou 6 dígitos) que pertencem ao grupo
PRODUTO_CATEGORIAS_EXPORT: list[tuple[str, list[str]]] = [
    ("Soja e derivados", ["1201", "2304", "1507"]),
    ("Petróleo e derivados", ["2709", "2710", "2711"]),
    ("Minério de ferro", ["2601"]),
    ("Carne bovina", ["0201", "0202"]),
    ("Carne de frango", ["0207"]),
    ("Café", ["0901"]),
    ("Açúcar", ["1701", "1702"]),
    ("Celulose", ["4703"]),
    ("Algodão", ["5201", "5202", "5203"]),
    ("Milho", ["1005"]),
    ("Ouro", ["7108"]),
    ("Ferro e aço (semimanufaturados)", ["7207", "7208", "7209"]),
    ("Veículos", ["8703", "8704", "8708", "8429"]),
    ("Aviões", ["8802"]),
]
PRODUTO_CATEGORIAS_IMPORT: list[tuple[str, list[str]]] = [
    ("Adubos e fertilizantes", ["3102", "3103", "3104", "3105"]),
    ("Petróleo e derivados", ["2709", "2710", "2711"]),
    ("Eletrônicos (chips/celulares)", ["8542", "8517"]),
    ("Veículos e peças", ["8703", "8704", "8708"]),
    ("Medicamentos", ["3004"]),
    ("Máquinas industriais", ["8429", "8443", "8479"]),
    ("Pesticidas e defensivos", ["3808"]),
    ("Plásticos", ["3901", "3902", "3904"]),
    ("Trigo", ["1001"]),
    ("Cobre (catodos)", ["7403"]),
]


def _request(payload: dict, retries: int = 4, base_sleep: float = 12.0) -> dict | None:
    """POST pra ComexStat com tratamento de rate limit (HTTP 429)."""
    last_err = None
    for i in range(retries):
        try:
            r = requests.post(COMEX, headers={**UA, "Content-Type": "application/json"},
                              json=payload, timeout=60)
            if r.status_code == 429:
                wait = base_sleep * (i + 1)
                print(f"  [429] rate limit, aguardando {wait:.0f}s...", file=sys.stderr)
                time.sleep(wait)
                continue
            r.raise_for_status()
            return r.json()
        except Exception as e:
            last_err = e
            print(f"  retry {i+1}/{retries}: {e}", file=sys.stderr)
            time.sleep(5)
    print(f"  FAIL final: {last_err}", file=sys.stderr)
    return None


def _br_yyyymm_pair(months_back_from: int, months_back_to: int = 0) -> tuple[str, str]:
    """Retorna (from, to) em formato YYYY-MM relativos ao mês corrente.
    A API SECEX tem defasagem ~1 mês — usamos mês corrente -1 como ponta."""
    hoje = datetime.now(timezone.utc).date()
    # Para o mês anterior
    y, m = hoje.year, hoje.month
    def shift(y, m, k):
        m -= k
        while m <= 0:
            m += 12
            y -= 1
        return y, m
    yf, mf = shift(y, m, months_back_from)
    yt, mt = shift(y, m, months_back_to)
    return f"{yf}-{mf:02d}", f"{yt}-{mt:02d}"


def fetch_top_ncm(flow: str, period_from: str, period_to: str) -> list[dict]:
    """Top NCMs no período acumulado (sem monthDetail)."""
    payload = {
        "flow": flow,
        "monthDetail": False,
        "period": {"from": period_from, "to": period_to},
        "details": ["ncm"],
        "metrics": ["metricFOB"],
    }
    data = _request(payload)
    if not data or not data.get("success"):
        return []
    lst = data.get("data", {}).get("list", [])
    # Ordenar desc por FOB
    return sorted(lst, key=lambda x: -int(x.get("metricFOB", 0)))


def fetch_top_country(flow: str, period_from: str, period_to: str) -> list[dict]:
    """Top países no período."""
    payload = {
        "flow": flow,
        "monthDetail": False,
        "period": {"from": period_from, "to": period_to},
        "details": ["country"],
        "metrics": ["metricFOB"],
    }
    data = _request(payload)
    if not data or not data.get("success"):
        return []
    lst = data.get("data", {}).get("list", [])
    return sorted(lst, key=lambda x: -int(x.get("metricFOB", 0)))


def fetch_section_3m(flow: str, period_from: str, period_to: str) -> list[dict]:
    """Exportações ou importações por seção do SH, mensal (max 3m por chamada)."""
    payload = {
        "flow": flow,
        "monthDetail": True,
        "period": {"from": period_from, "to": period_to},
        "details": ["section"],
        "metrics": ["metricFOB"],
    }
    data = _request(payload)
    if not data or not data.get("success"):
        return []
    return data.get("data", {}).get("list", [])


def aggregate_ncm_by_category(ncm_rows: list[dict], categorias: list[tuple[str, list[str]]]) -> list[dict]:
    """Soma valores de NCMs por categoria amigável."""
    out: list[dict] = []
    used = set()
    for nome, prefixos in categorias:
        total = 0
        for row in ncm_rows:
            cod = str(row.get("coNcm", ""))
            if any(cod.startswith(p) for p in prefixos) and cod not in used:
                total += int(row.get("metricFOB", 0))
                used.add(cod)
        if total > 0:
            out.append({"categoria": nome, "valor_us": total})
    # "Outros" pega o resto
    outros = sum(int(r.get("metricFOB", 0)) for r in ncm_rows if str(r.get("coNcm", "")) not in used)
    if outros > 0:
        out.append({"categoria": "Outros", "valor_us": outros})
    return out


def section_24m_by_chunks(flow: str, n_chunks: int = 8) -> dict[str, dict[str, float]]:
    """Coleta 24m de section data em chunks de 3m. Retorna: { 'YYYY-MM': { section: valor } }."""
    out: dict[str, dict[str, float]] = {}
    for i in range(n_chunks):
        # 24-3*(i+1)+1 até 24-3*i — ou seja, mais antigo no início
        from_back = 3 * (n_chunks - i)        # 24, 21, 18, 15, 12, 9, 6, 3
        to_back = 3 * (n_chunks - i) - 2      # 22, 19, 16, 13, 10, 7, 4, 1
        pf, pt = _br_yyyymm_pair(from_back, to_back)
        print(f"  [{flow}] section chunk {i+1}/{n_chunks}: {pf} → {pt}")
        rows = fetch_section_3m(flow, pf, pt)
        for r in rows:
            y = r.get("year")
            m = r.get("monthNumber")
            sec = r.get("section", "?")
            v = int(r.get("metricFOB", 0))
            if y and m:
                ym = f"{y}-{m.zfill(2)}"
                out.setdefault(ym, {})[sec] = v
        time.sleep(11)  # respeitar rate limit
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description="Build Comex Stat por produto/país/seção")
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "contas_externas_comex.json"

    # NCM × 12m estoura limite da API (retorna 0 rows mesmo com success=true).
    # Pra ranking de produtos/países, usamos o trimestre mais recente disponível
    # (3 meses fechados, mês corrente -1 como ponta). É lente o bastante pra
    # atualizar mensalmente e ainda forte o suficiente como ranking.
    pf_12m, pt_12m = _br_yyyymm_pair(3, 1)  # ex.: fev/26 → abr/26
    print(f"Janela 3m (ranking): {pf_12m} → {pt_12m}")

    print("== Top NCM exports (3m mais recente) ==")
    ncm_exp = fetch_top_ncm("export", pf_12m, pt_12m)
    print(f"  {len(ncm_exp)} NCMs")
    top_ncm_exp = ncm_exp[:15]
    cat_exp = aggregate_ncm_by_category(ncm_exp, PRODUTO_CATEGORIAS_EXPORT)
    time.sleep(11)

    print("== Top NCM imports (3m mais recente) ==")
    ncm_imp = fetch_top_ncm("import", pf_12m, pt_12m)
    print(f"  {len(ncm_imp)} NCMs")
    top_ncm_imp = ncm_imp[:15]
    cat_imp = aggregate_ncm_by_category(ncm_imp, PRODUTO_CATEGORIAS_IMPORT)
    time.sleep(11)

    print("== Top destinos (3m) ==")
    country_exp = fetch_top_country("export", pf_12m, pt_12m)[:12]
    time.sleep(11)

    print("== Top origens (3m) ==")
    country_imp = fetch_top_country("import", pf_12m, pt_12m)[:12]
    time.sleep(11)

    # ---- 5. Exportações por seção 24m mensal ----
    print("== Section exports 24m (em chunks) ==")
    section_exp = section_24m_by_chunks("export", n_chunks=4)
    # Identifica top 6 seções no total agregado pra simplificar visual
    secao_totais_exp: dict[str, float] = {}
    for ym, secs in section_exp.items():
        for s, v in secs.items():
            secao_totais_exp[s] = secao_totais_exp.get(s, 0.0) + v
    top6_exp_sec = [s for s, _ in sorted(secao_totais_exp.items(), key=lambda kv: -kv[1])[:6]]
    # Constroi série temporal só com top 6 + Outros
    serie_exp_secoes: list[dict[str, Any]] = []
    for ym in sorted(section_exp.keys()):
        item: dict[str, Any] = {"mes": ym}
        outros = 0.0
        for s, v in section_exp[ym].items():
            if s in top6_exp_sec:
                item[s] = v / 1e9  # US$ bi
            else:
                outros += v
        item["Outros"] = outros / 1e9
        serie_exp_secoes.append(item)

    # ---- 6. Importações por seção 24m mensal ----
    print("== Section imports 24m (em chunks) ==")
    section_imp = section_24m_by_chunks("import", n_chunks=4)
    secao_totais_imp: dict[str, float] = {}
    for ym, secs in section_imp.items():
        for s, v in secs.items():
            secao_totais_imp[s] = secao_totais_imp.get(s, 0.0) + v
    top6_imp_sec = [s for s, _ in sorted(secao_totais_imp.items(), key=lambda kv: -kv[1])[:6]]
    serie_imp_secoes: list[dict[str, Any]] = []
    for ym in sorted(section_imp.keys()):
        item = {"mes": ym}
        outros = 0.0
        for s, v in section_imp[ym].items():
            if s in top6_imp_sec:
                item[s] = v / 1e9
            else:
                outros += v
        item["Outros"] = outros / 1e9
        serie_imp_secoes.append(item)

    # ---- Output ----
    payload = {
        "gerado_em": datetime.now(timezone.utc).isoformat(),
        "fonte_principal": "Comex Stat (SECEX / MDIC) — POST /general",
        "periodo_12m": {"from": pf_12m, "to": pt_12m},
        # Top NCMs (com nome amigável)
        "top_ncm_export_12m": [
            {
                "ncm": r.get("coNcm"),
                "nome": r.get("ncm"),
                "valor_us_bi": int(r["metricFOB"]) / 1e9,
            } for r in top_ncm_exp
        ],
        "top_ncm_import_12m": [
            {
                "ncm": r.get("coNcm"),
                "nome": r.get("ncm"),
                "valor_us_bi": int(r["metricFOB"]) / 1e9,
            } for r in top_ncm_imp
        ],
        # Categorias agregadas
        "categorias_export_12m": [
            {"categoria": c["categoria"], "valor_us_bi": c["valor_us"] / 1e9} for c in cat_exp
        ],
        "categorias_import_12m": [
            {"categoria": c["categoria"], "valor_us_bi": c["valor_us"] / 1e9} for c in cat_imp
        ],
        # Top países
        "top_destinos_12m": [
            {"pais": r.get("country"), "valor_us_bi": int(r["metricFOB"]) / 1e9}
            for r in country_exp
        ],
        "top_origens_12m": [
            {"pais": r.get("country"), "valor_us_bi": int(r["metricFOB"]) / 1e9}
            for r in country_imp
        ],
        # Séries por seção SH (US$ bi mensal)
        "secao_export_24m": serie_exp_secoes,
        "secao_import_24m": serie_imp_secoes,
        "secao_export_top6": top6_exp_sec,
        "secao_import_top6": top6_imp_sec,
        "metadata": {
            "fonte": "SECEX/MDIC — Comex Stat",
            "endpoint": "POST /general (api-comexstat.mdic.gov.br)",
            "nota": "Categorias de produto agregadas por prefixo NCM. Top NCMs limitado a 15. Séries mensais por seção SH em US$ bi.",
        },
    }

    out_file.write_text(json.dumps(payload, ensure_ascii=False))
    size_kb = out_file.stat().st_size / 1024
    print(f"\n✓ Gerado {out_file} ({size_kb:.1f} KB)")
    print(f"  Top export 12m: {top_ncm_exp[0].get('ncm','-')[:50]}  US$ {int(top_ncm_exp[0]['metricFOB'])/1e9:.1f} bi" if top_ncm_exp else "  Top export: -")
    print(f"  Top destino: {country_exp[0].get('country','-')}  US$ {int(country_exp[0]['metricFOB'])/1e9:.1f} bi" if country_exp else "  Top destino: -")
    print(f"  Seções export 24m: {len(serie_exp_secoes)} meses, top6: {top6_exp_sec[:3]}...")

    if args.upload:
        try:
            sys.path.insert(0, str(HERE))
            from shared.blob_upload import maybe_upload_json
            maybe_upload_json(out_file, BLOB_PATH)
        except Exception as e:
            print(f"[upload] FAIL: {e}", file=sys.stderr)
            sys.exit(3)


if __name__ == "__main__":
    main()
 