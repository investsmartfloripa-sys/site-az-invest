"""Build do JSON do Painel Emprego — bloco PNAD.

Baixa do IBGE/SIDRA PNAD Contínua Trimestral 5 tabelas:
- 4099 (taxa desocupação + subutilização)
- 6461 (taxa de participação)
- 8529 (taxa de informalidade)
- 4096 (posição na ocupação)
- 5434 (grupamento de atividade — setor)

Gera `data-pipeline/out/emprego_pnad.json` e faz upload pra Vercel Blob em `data/emprego_pnad.json`.

Lê BLOB_READ_WRITE_TOKEN do ambiente.
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
BLOB_PATH = "data/emprego_pnad.json"

UA = {"User-Agent": "az-invest-emprego-pnad/0.1"}
SIDRA_BASE = "https://apisidra.ibge.gov.br/values"

# Códigos de variáveis e categorias confirmados durante validação (NOTAS_EMPREGO.md)
VARS_4099 = {
    "4099": "Taxa de desocupação",
    "4114": "Taxa combinada (desocup. + subocup. horas)",
    "4118": "Taxa composta de subutilização",
}
VARS_6461 = {"4096": "Taxa de participação na força de trabalho"}
VARS_8529 = {"12466": "Taxa de informalidade"}

POSICAO_CATS = {
    "99163": "Empregado",
    "99358": "Empregador",
    "99357": "Conta própria",
    "31720": "Trab. familiar auxiliar",
}

SETOR_CATS = {
    "47947": "Agropecuária",
    "47948": "Indústria",
    "47949": "Construção",
    "47950": "Comércio",
    "56622": "Transporte/armazenagem",
    "56623": "Alojamento/alimentação",
    "56624": "Informação/financeiras",
    "60032": "Adm pública/saúde/educação",
    "56627": "Outros serviços",
    "56628": "Serviços domésticos",
}


def _get(url: str, *, timeout: int = 120, retries: int = 3, sleep: float = 3.0) -> requests.Response:
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


def _parse_trim(s: str) -> str:
    # '202602' -> '2026-T2'
    return f"{s[:4]}-T{int(s[4:])}"


def sidra_fetch(tabela: int, path: str) -> list[dict]:
    url = f"{SIDRA_BASE}/t/{tabela}{path}"
    print(f"  [SIDRA {tabela}] {url}")
    data = _get(url).json()
    if not data:
        return []
    header = data[0]
    return [{header.get(k, k): v for k, v in item.items()} for item in data[1:]]


def carrega_taxas(periodos: int = 24) -> list[dict]:
    """Carrega 3 tabelas SIDRA de taxas e devolve série única por trimestre."""
    por_trim: dict[str, dict] = {}
    fetches = [
        (4099, VARS_4099, "/n1/all/v/all/p/last%20{N}"),
        (6461, VARS_6461, "/n1/all/v/all/p/last%20{N}"),
        (8529, VARS_8529, "/n1/all/v/all/p/last%20{N}"),
    ]
    for tabela, vars_map, path_tpl in fetches:
        rows = sidra_fetch(tabela, path_tpl.replace("{N}", str(periodos)))
        for r in rows:
            cod = r["Variável (Código)"]
            if cod not in vars_map:
                continue
            trim = _parse_trim(r["Trimestre (Código)"])
            por_trim.setdefault(trim, {})[vars_map[cod]] = _to_float(r["Valor"])
    return [{"trim": t, **v} for t, v in sorted(por_trim.items())]


def carrega_composicao(periodos: int = 24) -> list[dict]:
    """Tabela 4096: distribuição % por posição na ocupação."""
    rows = sidra_fetch(4096, f"/n1/all/v/all/p/last%20{periodos}/c12029/all")
    por_trim: dict[str, dict] = {}
    for r in rows:
        if r.get("Variável (Código)") != "4108":  # distribuição percentual
            continue
        cat = r.get("Posição na ocupação no trabalho principal (Código)")
        if cat not in POSICAO_CATS:
            continue
        trim = _parse_trim(r["Trimestre (Código)"])
        por_trim.setdefault(trim, {})[POSICAO_CATS[cat]] = _to_float(r["Valor"])
    return [{"trim": t, **v} for t, v in sorted(por_trim.items())]


def carrega_setor(periodos: int = 24) -> list[dict]:
    """Tabela 5434: pessoas ocupadas (mil pessoas) por grupamento de atividade."""
    rows = sidra_fetch(5434, f"/n1/all/v/all/p/last%20{periodos}/c888/all")
    por_trim: dict[str, dict] = {}
    for r in rows:
        if r.get("Variável (Código)") != "4090":  # mil pessoas
            continue
        cat = r.get("Grupamento de atividade no trabalho principal (Código)")
        if cat not in SETOR_CATS:
            continue
        trim = _parse_trim(r["Trimestre (Código)"])
        por_trim.setdefault(trim, {})[SETOR_CATS[cat]] = _to_float(r["Valor"])
    return [{"trim": t, **v} for t, v in sorted(por_trim.items())]


def main() -> None:
    ap = argparse.ArgumentParser(description="Build do JSON do Painel Emprego — PNAD")
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR), help="Diretório de saída (default: data-pipeline/out)")
    ap.add_argument("--upload", action="store_true", help="Após gerar, fazer upload pro Vercel Blob")
    ap.add_argument("--periodos", type=int, default=24, help="Quantos trimestres puxar do SIDRA (default 24)")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "emprego_pnad.json"

    print("== PNAD: Taxas (4099 + 6461 + 8529) ==")
    taxas_serie = carrega_taxas(args.periodos)
    print(f"  {len(taxas_serie)} trimestres, último: {taxas_serie[-1] if taxas_serie else 'NENHUM'}")

    print("== PNAD: Composição (4096) ==")
    comp_serie = carrega_composicao(args.periodos)
    print(f"  {len(comp_serie)} trimestres")

    print("== PNAD: Setor (5434) ==")
    setor_serie = carrega_setor(args.periodos)
    print(f"  {len(setor_serie)} trimestres")

    if not taxas_serie:
        print("ERRO: série PNAD vazia, abortando sem upload", file=sys.stderr)
        sys.exit(2)

    out = {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "trim_recente": taxas_serie[-1]["trim"],
        "taxas": {
            "serie": taxas_serie,
            "indicadores": list(VARS_4099.values()) + list(VARS_6461.values()) + list(VARS_8529.values()),
        },
        "composicao": {
            "serie": comp_serie,
            "categorias": list(POSICAO_CATS.values()),
        },
        "setor": {
            "serie": setor_serie,
            "categorias": list(SETOR_CATS.values()),
        },
        "metadata": {
            "fonte": "IBGE/SIDRA — PNAD Contínua Trimestral (tabelas 4099, 6461, 8529, 4096, 5434)",
            "nota": "Indicadores trimestrais nacionais. Hiato 2T2020-1T2022 em algumas tabelas (suspensão pandêmica).",
        },
    }

    out_file.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nJSON salvo em {out_file} ({out_file.stat().st_size/1024:.1f} KB)")

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
