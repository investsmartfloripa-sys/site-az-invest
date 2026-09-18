"""Build do Painel Visao Geral - bloco EPE (consumo de energia eletrica).

Fonte: EPE - Dados Abertos, "Dados_abertos_Consumo_Mensal.xlsx".
URL:   https://www.epe.gov.br/pt/publicacoes-dados-abertos/dados-abertos/dados-do-consumo-mensal-de-energia-eletrica

TROCA DE FONTE EM 2026-09-18. O script lia o XLSX da "publicacao original"
(.../publicacoes/Documents/CONSUMO MENSAL DE ENERGIA ELETRICA POR CLASSE.xlsx),
que a EPE parou de atualizar em dez/2025 sem tirar do ar. Dois defeitos ao mesmo
tempo, os dois silenciosos:

  1. Serie congelada em 2025-12 por 9 meses, com `freshness_status: "fresh"` —
     o campo media se o download funcionou, nao se o dado e recente.
  2. Nivel ERRADO: o parser da matriz pivotada capturava ~18% do consumo
     nacional (dez/2025 saia 8,83 mi MWh contra 48,17 mi reais).

O arquivo de Dados Abertos e formato longo e dispensa heuristica de matriz:
uma linha por (Data, Regiao, Sistema, Classe, TipoConsumidor). Somamos o Brasil
inteiro, cativo + livre.

Unidade: MWh (os campos mantem o sufixo `_gwh` para nao quebrar o schema que o
painel ja consome).
"""
from __future__ import annotations
import argparse, io, json, sys, time
from datetime import datetime, timezone
from pathlib import Path
import requests

HERE = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/visao_geral_epe.json"
UA = {"User-Agent": "Mozilla/5.0 (compatible; az-invest/0.3)"}
EPE_XLSX = (
    "https://www.epe.gov.br/sites-pt/publicacoes-dados-abertos/dados-abertos/"
    "Documents/Dados_abertos_Consumo_Mensal.xlsx"
)
ABA = "CONSUMO E NUMCONS SAM"
INPUTS = {"epe_consumo": "2004-01"}

# Classe do arquivo -> chave do payload. "Rural" entra em outros, como na serie antiga.
CLASSE_MAP = {
    "Residencial": "residencial",
    "Industrial": "industrial",
    "Comercial": "comercial",
    "Outros": "outros",
    "Rural": "outros",
}
CHAVES = ("total", "residencial", "industrial", "comercial", "outros")


def _get(url, *, timeout=180, retries=3, sleep=5.0):
    last = None
    for _ in range(retries):
        try:
            r = requests.get(url, timeout=timeout, headers=UA)
            r.raise_for_status()
            return r
        except Exception as e:
            last = e
            time.sleep(sleep)
    raise RuntimeError(f"falha: {last}")


def parse_xlsx_epe(content):
    """Le a aba SAM (formato longo) e devolve {chave: {mes_iso: consumo}}.

    Soma o Brasil inteiro: todas as regioes, todos os sistemas, cativo + livre.
    """
    import pandas as pd

    df = pd.read_excel(io.BytesIO(content), sheet_name=ABA)
    faltando = {"Data", "Classe", "Consumo"} - set(df.columns)
    if faltando:
        raise RuntimeError(f"colunas ausentes na aba {ABA!r}: {sorted(faltando)}")

    df = df[df["Consumo"].notna()].copy()
    df["mes"] = df["Data"].astype("int64").astype(str).str.slice(0, 6)
    df["mes"] = df["mes"].str.slice(0, 4) + "-" + df["mes"].str.slice(4, 6)
    df["chave"] = df["Classe"].map(CLASSE_MAP)

    desconhecidas = sorted(set(df.loc[df["chave"].isna(), "Classe"].dropna().unique()))
    if desconhecidas:
        # Classe nova na fonte entra em "outros" para nao sumir do total.
        print(f"  AVISO: classe nao mapeada, somada em outros: {desconhecidas}")
        df["chave"] = df["chave"].fillna("outros")

    out = {k: {} for k in CHAVES}
    for (mes, chave), v in df.groupby(["mes", "chave"])["Consumo"].sum().items():
        out[chave][mes] = round(float(v), 3)
    for mes, v in df.groupby("mes")["Consumo"].sum().items():
        out["total"][mes] = round(float(v), 3)

    print(f"  aba {ABA!r}: {len(df):,} linhas | {len(out['total'])} meses "
          f"| {min(out['total'])} a {max(out['total'])}")
    return out


def calcular(out_dict):
    todos_meses = set()
    for d in out_dict.values():
        todos_meses.update(d.keys())
    serie = []
    for mes in sorted(todos_meses):
        item = {"mes": mes}
        for k in CHAVES:
            item[f"{k}_gwh"] = out_dict[k].get(mes)
        serie.append(item)

    base = {}
    for it in serie:
        if it["mes"].startswith("2019-"):
            for k in CHAVES:
                key = f"{k}_gwh"
                if it.get(key):
                    base.setdefault(key, []).append(it[key])
    base = {k: (sum(v) / len(v) if v else None) for k, v in base.items()}

    by_mes = {it["mes"]: it for it in serie}
    for it in serie:
        a, m = it["mes"].split("-")
        prev = by_mes.get(f"{int(a)-1:04d}-{m}")
        for k in CHAVES:
            key = f"{k}_gwh"
            cur = it.get(key)
            pv = prev.get(key) if prev else None
            it[f"{k}_var_yoy_pct"] = round((cur / pv - 1) * 100, 2) if (cur and pv and pv > 0) else None
            bs = base.get(key)
            it[f"{k}_indice_2019"] = round(cur / bs * 100, 2) if (cur and bs and bs > 0) else None
    return serie


def freshness(mes_recente):
    """Compara a data do DADO com hoje — nao basta o download ter funcionado.

    A serie e mensal com defasagem tipica de 1 a 2 meses. Acima de 4 meses de
    atraso a fonte parou ou mudou de lugar, e isso precisa aparecer no painel de
    saude em vez de passar por "fresh" (foi o que escondeu a quebra de dez/2025).
    """
    if not mes_recente:
        return "missing"
    hoje = datetime.now(timezone.utc)
    a, m = (int(x) for x in mes_recente.split("-"))
    atraso = (hoje.year - a) * 12 + (hoje.month - m)
    if atraso <= 3:
        return "fresh"
    return "stale"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--soft-fail", action="store_true")
    args = ap.parse_args()
    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "visao_geral_epe.json"

    print("== EPE - Consumo Mensal por Classe (Dados Abertos) ==")
    try:
        r = _get(EPE_XLSX)
        out_dict = parse_xlsx_epe(r.content)
        if not any(out_dict.values()):
            raise RuntimeError("Nenhum valor lido do XLSX")
        serie = calcular(out_dict)
    except Exception as e:
        print(f"  FALHA: {e}", file=sys.stderr)
        sys.path.insert(0, str(HERE))
        from shared.blob_download import download_json
        prev = download_json(BLOB_PATH)
        if prev:
            prev["freshness_status"] = "stale"
            prev["gerado_em"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
            out_file.write_text(json.dumps(prev, indent=2, ensure_ascii=False), encoding="utf-8")
            return
        if args.soft_fail:
            out_file.write_text(json.dumps({
                "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "freshness_status": "missing", "serie": []}, indent=2), encoding="utf-8")
            return
        sys.exit(2)

    mes_recente = serie[-1]["mes"] if serie else None
    status = freshness(mes_recente)
    if status == "stale":
        print(f"  AVISO: dado mais recente e {mes_recente} — fonte atrasada", file=sys.stderr)

    payload = {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "freshness_status": status,
        "mes_recente": mes_recente,
        "serie": serie,
        "inputs": INPUTS,
        "min_start_date": min(INPUTS.values()),
        "metadata": {
            "fonte": "EPE - Dados Abertos, Consumo Mensal de Energia Eletrica (XLSX). MWh, Brasil, cativo + livre.",
            "nota": "Industrial e antecedente forte da PIM. Base = media 2019. Rural somado em outros.",
        },
    }
    out_file.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"JSON {out_file} ({out_file.stat().st_size/1024:.1f} KB) | mes_recente {mes_recente} | {status}")

    if args.upload:
        sys.path.insert(0, str(HERE))
        from shared.blob_upload import maybe_upload_json
        try:
            maybe_upload_json(out_file, BLOB_PATH)
        except Exception:
            if not args.soft_fail:
                sys.exit(1)


if __name__ == "__main__":
    main()
