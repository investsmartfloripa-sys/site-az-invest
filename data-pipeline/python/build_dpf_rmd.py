"""Build do JSON DPF/RMD — perfil da Dívida Pública Federal (Tesouro Nacional).

Fonte: API REST pública das Séries Temporais do Tesouro Nacional
(backend da visualização "Séries Temporais" — mesmo conteúdo dos anexos do
Relatório Mensal da Dívida/RMD, JSON, sem autenticação).

ATENÇÃO: o header `Accept: application/json` é OBRIGATÓRIO — sem ele o
servidor devolve HTTP 500 (MessageBodyWriter application/octet-stream).

Séries (idSerie):
- 7721  Prazo médio do estoque — DPF Total (anos)
- 7651  % vincendo em 12 meses — DPF Total (%)
- 7812  Custo médio acumulado 12m — DPF Total (% a.a.)
- 7639..7645  Detentores DPMFi (R$ bi): Inst. Financeiras / Fundos /
              Previdência / Não-residentes / Governo / Seguradoras / Outros
- 7589  Estoque DPF Total (R$ bi)
- 7597  Estoque DPMFi Total (R$ bi) — usado SÓ como referência de sanity da
        soma dos detentores (base dos detentores = DPMFi em mercado, um
        pouco menor); NUNCA como denominador do % não-residentes.

Derivado: pct_nao_residentes = 7642 ÷ soma(7639..7645) × 100.

Output: data-pipeline/out/fiscal-dpf-rmd.json + upload Blob em
data/fiscal-dpf-rmd.json (schema_version 1 — contrato da Onda 3).
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from shared.blob_upload import maybe_upload_json  # noqa: E402

DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/fiscal-dpf-rmd.json"

BASE_URL = (
    "https://series-temporais.tesouro.gov.br/backend-series-temporais/"
    "rest/Public/SerieGrafico/ValorSerie/{id}"
)
HEADERS = {
    # Accept JSON é obrigatório: sem ele a API devolve 500.
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0 (compatible; az-invest-dpf/0.1)",
}

SERIES_SIMPLES = {
    "prazo_medio_dpf_anos": 7721,
    "vincendo_12m_pct": 7651,
    "custo_medio_12m_aa_pct": 7812,
    "estoque_dpf_brl_bi": 7589,
}

DETENTORES = {
    "instituicoes_financeiras": 7639,
    "fundos": 7640,
    "previdencia": 7641,
    "nao_residentes": 7642,
    "governo": 7643,
    "seguradoras": 7644,
    "outros": 7645,
}

ID_DPMFI_TOTAL = 7597  # só para sanity check da soma dos detentores

STATUS_OK = "atualmente publicado"
SANITY_TOLERANCIA = 0.05  # ±5% entre soma dos detentores e estoque DPMFi


def fetch_serie(id_serie: int, *, retries: int = 4, sleep: float = 3.0) -> list[dict]:
    """GET ValorSerie/{id} → [{data: 'YYYY-MM', valor: float}] ascendente."""
    url = BASE_URL.format(id=id_serie)
    last = None
    for i in range(retries):
        try:
            r = requests.get(url, headers=HEADERS, timeout=60)
            if r.status_code in (429, 500, 502, 503, 504):
                time.sleep((i + 1) * sleep)
                continue
            r.raise_for_status()
            raw = r.json()
            break
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep((i + 1) * 2)
    else:
        raise RuntimeError(f"ValorSerie/{id_serie}: falha apos {retries} tentativas: {last}")

    out = []
    descartados = 0
    for row in raw:
        status = row.get("nomeStatusValor")
        if status is not None and STATUS_OK not in str(status).lower():
            descartados += 1
            continue
        ds = row.get("dataString")
        v = row.get("valor")
        if not ds or v is None:
            continue
        # dataString dd/MM/yyyy (sempre dia 01 do mês de referência) → YYYY-MM
        try:
            dd, mm, yyyy = ds.split("/")
            data = f"{yyyy}-{mm}"
        except ValueError:
            continue
        out.append({"data": data, "valor": float(v)})
    if descartados:
        print(f"  [serie {id_serie}] {descartados} pontos descartados por status != publicado", file=sys.stderr)
    # A API devolve do mais recente para o mais antigo — ordenar ascendente,
    # dedupe por mês (mantém o último visto, irrelevante na prática).
    dedup = {r["data"]: r["valor"] for r in sorted(out, key=lambda x: x["data"])}
    serie = [{"data": d, "valor": v} for d, v in sorted(dedup.items())]
    print(f"  [serie {id_serie}] {len(serie)} pontos ({serie[0]['data']} -> {serie[-1]['data']})")
    return serie


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    print("Baixando séries do Tesouro (Séries Temporais)...")
    simples = {nome: fetch_serie(i) for nome, i in SERIES_SIMPLES.items()}
    det_raw = {nome: fetch_serie(i) for nome, i in DETENTORES.items()}
    dpmfi_total = fetch_serie(ID_DPMFI_TOTAL)

    # === Detentores: join por mês — só meses com as 7 categorias presentes ===
    det_maps = {nome: {r["data"]: r["valor"] for r in serie} for nome, serie in det_raw.items()}
    meses_comuns = sorted(set.intersection(*(set(m.keys()) for m in det_maps.values())))
    detentores = [
        {"data": mes, **{nome: round(det_maps[nome][mes], 4) for nome in DETENTORES}}
        for mes in meses_comuns
    ]
    if not detentores:
        print("ERRO: nenhum mês com as 7 categorias de detentores", file=sys.stderr)
        sys.exit(1)

    # === % não-residentes = não-residentes ÷ soma dos 7 detentores (DPMFi em
    # mercado). NÃO usar o estoque DPMFi total (7597) como denominador: a base
    # dos detentores é a DPMFi em mercado (custódia Selic), menor que o total —
    # só a soma dos próprios detentores bate com o % divulgado no RMD. ===
    pct_nao_res = []
    for row in detentores:
        soma = sum(row[nome] for nome in DETENTORES)
        if soma <= 0:
            continue
        pct_nao_res.append({"data": row["data"], "valor": round(row["nao_residentes"] / soma * 100, 2)})

    # === Sanity (ABORTA upload): soma dos detentores no mês mais recente deve
    # ficar dentro de ±5% do estoque DPMFi total (7597) — a base "em mercado" é
    # ~3% menor que o total, então 5% acomoda a diferença conceitual; um desvio
    # maior indica série quebrada/unidade errada. ===
    dpmfi_map = {r["data"]: r["valor"] for r in dpmfi_total}
    ult = detentores[-1]
    soma_ult = sum(ult[nome] for nome in DETENTORES)
    ref = dpmfi_map.get(ult["data"])
    if ref:
        desvio = abs(soma_ult / ref - 1)
        print(f"  Sanity detentores {ult['data']}: soma R$ {soma_ult:,.1f} bi vs DPMFi total R$ {ref:,.1f} bi (desvio {desvio*100:.2f}%)")
        if desvio > SANITY_TOLERANCIA:
            print(f"ERRO: soma dos detentores desvia {desvio*100:.1f}% do estoque DPMFi (tol. ±{SANITY_TOLERANCIA*100:.0f}%) — abortando", file=sys.stderr)
            sys.exit(1)
    else:
        print(f"AVISO: DPMFi total (7597) sem o mês {ult['data']} — sanity pulado", file=sys.stderr)

    arred = lambda serie, casas: [{"data": r["data"], "valor": round(r["valor"], casas)} for r in serie]  # noqa: E731

    payload = {
        "schema_version": 1,
        "gerado_em": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "_fonte": (
            "Tesouro Nacional — API pública das Séries Temporais (backend-series-temporais, "
            "mesmo conteúdo dos anexos do Relatório Mensal da Dívida/RMD). Séries: prazo médio "
            "DPF Total (7721), % vincendo 12m DPF Total (7651), custo médio acumulado 12m DPF "
            "Total (7812), detentores DPMFi em R$ bi (7639-7645), estoque DPF Total (7589)."
        ),
        "_nota": (
            "Perfil de risco de rolagem da Dívida Pública Federal. % não-residentes derivado: "
            "não-residentes ÷ soma das 7 categorias de detentores (base = DPMFi em mercado, "
            "custódia Selic — menor que o estoque DPMFi total; é a base que reproduz o % "
            "divulgado no RMD). Dado mensal, publicado com ~1 mês de defasagem no RMD."
        ),
        "prazo_medio_dpf_anos": arred(simples["prazo_medio_dpf_anos"], 4),
        "vincendo_12m_pct": arred(simples["vincendo_12m_pct"], 4),
        "custo_medio_12m_aa_pct": arred(simples["custo_medio_12m_aa_pct"], 4),
        "pct_nao_residentes": pct_nao_res,
        "detentores_brl_bi": detentores,
        "estoque_dpf_brl_bi": arred(simples["estoque_dpf_brl_bi"], 4),
    }

    out_file = out_dir / "fiscal-dpf-rmd.json"
    out_file.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(f"  -> {out_file} ({out_file.stat().st_size / 1024:.1f} KB)")

    def _ult(nome):
        s = payload[nome]
        return f"{s[-1]['data']}: {s[-1]['valor']}" if s else "vazio"

    print(f"  Prazo médio: {_ult('prazo_medio_dpf_anos')} anos")
    print(f"  Vincendo 12m: {_ult('vincendo_12m_pct')} %")
    print(f"  Custo médio 12m: {_ult('custo_medio_12m_aa_pct')} % a.a.")
    print(f"  Não-residentes: {_ult('pct_nao_residentes')} %")

    if args.upload:
        maybe_upload_json(out_file, BLOB_PATH)


if __name__ == "__main__":
    main()
