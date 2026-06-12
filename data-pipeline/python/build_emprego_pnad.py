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


def _periodo_path(periodos: int) -> str:
    """periodos <= 0 → série completa (/p/all); senão últimos N trimestres."""
    return "/p/all" if periodos <= 0 else f"/p/last%20{periodos}"


def carrega_taxas(periodos: int = 0) -> list[dict]:
    """Carrega 3 tabelas SIDRA de taxas e devolve série única por trimestre.

    v2: a 6461 também traz o "Nível da ocupação" (% da PIA) na MESMA chamada —
    par da participação p/ responder 'o desemprego caiu pelo motivo certo?'.
    """
    por_trim: dict[str, dict] = {}
    fetches = [
        (4099, VARS_4099, False),
        (6461, VARS_6461, True),  # aceita também 'Nível da ocupação' por nome
        (8529, VARS_8529, False),
    ]
    for tabela, vars_map, aceita_nivel in fetches:
        rows = sidra_fetch(tabela, f"/n1/all/v/all{_periodo_path(periodos)}")
        for r in rows:
            cod = r["Variável (Código)"]
            chave = vars_map.get(cod)
            if chave is None and aceita_nivel and "nível da ocupação" in str(r.get("Variável", "")).lower():
                chave = "Nível da ocupação"
            if chave is None:
                continue
            trim = _parse_trim(r["Trimestre (Código)"])
            por_trim.setdefault(trim, {})[chave] = _to_float(r["Valor"])
    return [{"trim": t, **v} for t, v in sorted(por_trim.items())]


def carrega_composicao(periodos: int = 0) -> list[dict]:
    """Tabela 4096: distribuição % por posição na ocupação (4 posições genéricas —
    o recorte de carteira NÃO existe nesta tabela; vive na 4097, ver carrega_carteira)."""
    rows = sidra_fetch(4096, f"/n1/all/v/all{_periodo_path(periodos)}/c12029/all")
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


def carrega_carteira(periodos: int = 0) -> list[dict]:
    """Tabela 4097 (v2): ocupados em MIL PESSOAS por categoria do emprego — o recorte
    de QUALIDADE da ocupação (privado com × sem carteira)."""
    rows = sidra_fetch(4097, f"/n1/all/v/all{_periodo_path(periodos)}/c11913/all")
    por_trim: dict[str, dict] = {}
    for r in rows:
        nome_var = str(r.get("Variável", "")).lower()
        if not nome_var.startswith("pessoas de 14"):
            continue  # pula "Coeficiente de variação - ..."
        nome_cat = ""
        for k, v in r.items():
            if "categoria do emprego" in k.lower() and "digo" not in k:
                nome_cat = str(v).lower()
                break
        if "setor privado" in nome_cat and "com carteira" in nome_cat:
            chave = "com_carteira_mil"
        elif "setor privado" in nome_cat and "sem carteira" in nome_cat:
            chave = "sem_carteira_mil"
        else:
            continue
        trim = _parse_trim(r["Trimestre (Código)"])
        por_trim.setdefault(trim, {})[chave] = _to_float(r["Valor"])
    return [{"trim": t, **v} for t, v in sorted(por_trim.items())]


def carrega_setor(periodos: int = 0) -> list[dict]:
    """Tabela 5434: pessoas ocupadas (mil pessoas) por grupamento de atividade."""
    rows = sidra_fetch(5434, f"/n1/all/v/all{_periodo_path(periodos)}/c888/all")
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


def carrega_massa() -> list[dict]:
    """Tabela 6392 (v2): massa de rendimento mensal REAL habitual — trimestre MÓVEL.

    Já vem deflacionada pelo IBGE (não re-deflacionar). É a massa do TRABALHO —
    não confundir com 'massa ampliada' (que inclui transferências; não temos)."""
    rows = sidra_fetch(6392, "/n1/all/v/all/p/all")
    serie: dict[str, float | None] = {}
    for r in rows:
        nome_var = str(r.get("Variável", "")).lower()
        # startswith exclui as variantes "Coeficiente de variação - Massa..." e
        # "Variação percentual/absoluta - Massa..." (que sobrescreviam com lixo)
        if not nome_var.startswith("massa de rendimento") or "real" not in nome_var or "habitual" not in nome_var:
            continue
        # chave do período no trimestre móvel: 'Trimestre Móvel (Código)' = YYYYMM
        cod = None
        for k, v in r.items():
            if "Trimestre Móvel (Código)" in k:
                cod = str(v)
                break
        if not cod or len(cod) != 6:
            continue
        serie[f"{cod[:4]}-{cod[4:]}"] = _to_float(r["Valor"])
    out = [{"mes": m, "massa_real_mi": v} for m, v in sorted(serie.items())]
    # YoY no builder (derivada canônica)
    vmap = {r["mes"]: r["massa_real_mi"] for r in out}
    for r in out:
        y, m = r["mes"].split("-")
        ant = vmap.get(f"{int(y) - 1}-{m}")
        r["massa_yoy_pct"] = round((r["massa_real_mi"] / ant - 1) * 100, 2) if (r["massa_real_mi"] and ant) else None
    return out


def dessazonaliza_desocupacao(taxas_serie: list[dict]) -> bool:
    """v2: STL trimestral (period=4, robust) na desocupação — só se a série não tiver
    buracos internos (STL não aceita NaN; o hiato pandêmico afeta OUTRAS tabelas)."""
    vals = [r.get("Taxa de desocupação") for r in taxas_serie]
    if len(vals) < 16 or any(v is None for v in vals):
        print("  [WARN] desocupação com buracos/curta — SA própria omitida", file=sys.stderr)
        return False
    try:
        import pandas as pd
        from statsmodels.tsa.seasonal import STL

        s = pd.Series([float(v) for v in vals])
        res = STL(s, period=4, robust=True).fit()
        sa = s - res.seasonal
        for i, r in enumerate(taxas_serie):
            r["desocupacao_sa"] = round(float(sa.iloc[i]), 2)
        print(f"  [v2] desocupação SA (STL): última {taxas_serie[-1]['desocupacao_sa']}%")
        return True
    except Exception as e:
        print(f"  [WARN] STL indisponível ({e}) — desocupacao_sa omitida", file=sys.stderr)
        return False


def main() -> None:
    ap = argparse.ArgumentParser(description="Build do JSON do Painel Emprego — PNAD")
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR), help="Diretório de saída (default: data-pipeline/out)")
    ap.add_argument("--upload", action="store_true", help="Após gerar, fazer upload pro Vercel Blob")
    ap.add_argument("--periodos", type=int, default=0,
                    help="Quantos trimestres puxar do SIDRA (default 0 = série completa desde 2012)")
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

    print("== PNAD: Carteira (4097, v2) ==")
    try:
        carteira_serie = carrega_carteira(args.periodos)
        print(f"  {len(carteira_serie)} trimestres, último: {carteira_serie[-1] if carteira_serie else 'NENHUM'}")
    except Exception as e:
        print(f"  [WARN] carteira indisponível ({e})", file=sys.stderr)
        carteira_serie = []

    print("== PNAD: Setor (5434) ==")
    setor_serie = carrega_setor(args.periodos)
    print(f"  {len(setor_serie)} trimestres")

    print("== PNAD: Massa de rendimento real (6392, v2) ==")
    try:
        massa_serie = carrega_massa()
        print(f"  {len(massa_serie)} meses (trimestre móvel), último: {massa_serie[-1] if massa_serie else 'NENHUM'}")
    except Exception as e:
        print(f"  [WARN] massa indisponível ({e})", file=sys.stderr)
        massa_serie = []

    if not taxas_serie:
        print("ERRO: série PNAD vazia, abortando sem upload", file=sys.stderr)
        sys.exit(2)

    # v2: desocupação dessazonalizada (STL própria) — campo desocupacao_sa nos rows de taxas
    dessazonaliza_desocupacao(taxas_serie)

    out = {
        "schema_version": 2,
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
        "carteira": {
            "_nota": "SIDRA 4097 — ocupados no setor privado (exclusive domésticos) com/sem carteira, em mil pessoas. Recorte de qualidade da ocupação.",
            "serie": carteira_serie,
        },
        "setor": {
            "serie": setor_serie,
            "categorias": list(SETOR_CATS.values()),
        },
        # ── v2 ──
        "massa_rendimento": {
            "_nota": "SIDRA 6392 — massa de rendimento mensal REAL habitual do TRABALHO, trimestre MÓVEL, já deflacionada pelo IBGE (não re-deflacionar). Não é a 'massa ampliada' (que inclui transferências).",
            "serie": massa_serie,
        },
        "metadata": {
            "fonte": "IBGE/SIDRA — PNAD Contínua Trimestral (tabelas 4099, 6461, 8529, 4096, 5434, 6392)",
            "nota": (
                "Indicadores trimestrais nacionais desde 1T2012. Hiato 2T2020-1T2022 em algumas tabelas (suspensão pandêmica). "
                "Informalidade (8529) só existe desde 4T2015. 'Nível da ocupação' e participação são % da PIA (mesma escala). "
                "desocupacao_sa (v2): dessazonalização PRÓPRIA (STL robusta) — não há SA oficial; rotular como estimativa da casa. "
                "Rendimento/massa (6392) é trimestre MÓVEL — janela amostral diferente das taxas (trimestre calendário)."
            ),
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
