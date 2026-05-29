"""Build do Painel Visao Geral - bloco Antecedentes Financeiros.

Tres series antecedentes do PIB via APIs publicas:
  1) Slope DI = SGS 4189 (Pre 360d) - SGS 432 (Selic meta). Inversao antecede recessao.
  2) Ibov real 6m = retorno acumulado 6m do Ibov (SGS 16121 medio mensal) deflacionado IPCA SGS 433.
  3) EMBI+ Brasil = IPEADATA JPM366_EMBI366 (risco-pais; alta antecede aperto).

Saida: data/visao_geral_antecedentes_fin.json
"""
from __future__ import annotations
import argparse, json, sys, time
from datetime import datetime, timezone
from pathlib import Path
import requests

HERE = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/visao_geral_antecedentes_fin.json"
UA = {"User-Agent": "az-invest-antecedentes-fin/1.0", "Accept": "application/json"}
SGS_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{cod}/dados?formato=json&dataInicial=01/01/2010"


def _get_sgs(codigo):
    r = requests.get(SGS_URL.format(cod=codigo), timeout=60, headers=UA)
    r.raise_for_status()
    return r.json()


def _to_mes(data_str):
    # DD/MM/YYYY -> YYYY-MM
    d, m, y = data_str.split("/")
    return f"{y}-{m}"


def serie_mensal_ultimo(serie_diaria):
    """Pega o ultimo valor de cada mes."""
    by_mes = {}
    for p in serie_diaria:
        try:
            mes = _to_mes(p["data"])
            valor = float(p["valor"])
            by_mes[mes] = valor  # sobrescreve, fica com o ultimo do mes
        except (ValueError, KeyError):
            continue
    return by_mes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--soft-fail", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    # 1) Slope DI = SGS 4189 - SGS 432
    slope_serie = []
    try:
        print("Slope DI...")
        pre_di = serie_mensal_ultimo(_get_sgs(4189))
        selic_meta = serie_mensal_ultimo(_get_sgs(432))
        meses_slope = sorted(set(pre_di.keys()) & set(selic_meta.keys()))
        slope_serie = [
            {"mes": m, "slope_di_pp": round(pre_di[m] - selic_meta[m], 3),
             "pre_di_360d_pct": pre_di[m], "selic_meta_pct": selic_meta[m]}
            for m in meses_slope
        ]
        print(f"  slope_di: {len(slope_serie)} obs")
    except Exception as e:
        print(f"  WARN slope_di: {e}", file=sys.stderr)

    # 2) Ibov real 6m
    ibov_real_serie = []
    try:
        print("Ibov real 6m...")
        ibov = serie_mensal_ultimo(_get_sgs(16121))
        ipca = _get_sgs(433)
        ipca_by_mes = {}
        for p in ipca:
            try:
                mes = _to_mes(p["data"])
                valor = float(p["valor"])
                ipca_by_mes[mes] = valor
            except (ValueError, KeyError):
                continue
        # IPCA acumulado: calcular indice
        meses_ipca = sorted(ipca_by_mes.keys())
        idx = 100.0
        ipca_indice = {}
        for m in meses_ipca:
            idx *= (1 + ipca_by_mes[m] / 100)
            ipca_indice[m] = idx
        # Ibov real = Ibov / ipca_indice (base no inicio)
        meses_ibov = sorted(ibov.keys())
        base_ipca = ipca_indice.get(meses_ibov[0]) if meses_ibov else None
        ibov_real_serie = []
        for i, m in enumerate(meses_ibov):
            if m not in ipca_indice:
                continue
            ibov_real = ibov[m] / (ipca_indice[m] / base_ipca) if base_ipca else None
            # Retorno 6m
            m_6m_ago = meses_ibov[i - 6] if i >= 6 else None
            if m_6m_ago and m_6m_ago in ipca_indice:
                ibov_real_6m_ago = ibov[m_6m_ago] / (ipca_indice[m_6m_ago] / base_ipca) if base_ipca else None
                retorno_6m = ((ibov_real / ibov_real_6m_ago) - 1) * 100 if ibov_real_6m_ago else None
            else:
                retorno_6m = None
            ibov_real_serie.append({
                "mes": m, "ibov_real_indice": round(ibov_real, 2) if ibov_real else None,
                "retorno_real_6m_pct": round(retorno_6m, 2) if retorno_6m is not None else None,
            })
            print(f"  ibov_real: {len(ibov_real_serie)} obs")
    except Exception as e:
        print(f"  WARN ibov_real: {e}", file=sys.stderr)

    # 3) EMBI+ via IPEADATA
    print("EMBI+...")
    embi_serie = []
    try:
        r = requests.get(
            "http://ipeadata.gov.br/api/odata4/ValoresSerie(SERCODIGO='JPM366_EMBI366')",
            timeout=120, headers=UA
        )
        r.raise_for_status()
        data = r.json().get("value", [])
        # filtrar valores nao-nulos, pegar ultimo de cada mes
        by_mes_embi = {}
        for p in data:
            try:
                if p["VALVALOR"] is None:
                    continue
                dt = p["VALDATA"][:10]
                mes = dt[:7]
                by_mes_embi[mes] = float(p["VALVALOR"])
            except (KeyError, ValueError):
                continue
        for m in sorted(by_mes_embi.keys()):
            embi_serie.append({"mes": m, "embi_bps": round(by_mes_embi[m], 1)})
    except Exception as e:
        print(f"  WARN EMBI: {e}", file=sys.stderr)

    payload = {
        "gerado_em": datetime.now(timezone.utc).isoformat(),
        "freshness_status": "fresh",
        "slope_di": slope_serie,
        "ibov_real": ibov_real_serie,
        "embi": embi_serie,
        "metadata": {
            "fontes": "BCB SGS 4189 (DI 360d), SGS 432 (Selic meta), SGS 16121 (Ibov medio), SGS 433 (IPCA), IPEADATA JPM366_EMBI366 (EMBI+)",
            "nota": "Slope DI invertido (<0) antecede recessao (Estrella-Mishkin 1998). Ibov real 6m positivo antecede expansao (componente IACE-FGV). EMBI+ alta antecede aperto de credito.",
        },
    }
    out_path = out_dir / "visao_geral_antecedentes_fin.json"
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    print(f"  -> {out_path}")
    print(f"    slope: {len(slope_serie)} obs, ibov real: {len(ibov_real_serie)} obs, embi: {len(embi_serie)} obs")

    if args.upload:
        try:
            sys.path.insert(0, str(HERE / "shared"))
            from blob_upload import maybe_upload_json
            maybe_upload_json(out_path, BLOB_PATH)
        except Exception as e:
            print(f"upload skip: {e}", file=sys.stderr)


if __name__ == "__main__":
    main()
