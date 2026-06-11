"""Build do JSON da sub-área CÂMBIO ECONÔMICO (Contas Externas → Câmbio).

Responde três perguntas canônicas da macro cambial:
1. O real está caro ou barato EM TERMOS REAIS? (câmbio real bilateral construído
   + REER oficial do BCB)
2. Quanto o Brasil paga a mais que os EUA em juros? (diferencial Selic meta −
   Fed Funds)
3. Juro alto garante câmbio? (scorecard UIP: diferencial de 12m atrás vs
   variação cambial efetivamente realizada — a literatura diz que a paridade
   descoberta de juros FALHA no curto prazo; mostrar a dispersão é o insight)

Fontes:
- BCB SGS 1      — PTAX venda DIÁRIA (agregada aqui p/ média mensal; o cross-check
                   é a SGS 3698, média de período oficial).
- BCB SGS 11752  — Índice da taxa de câmbio efetiva real (IPCA), jun/1994 = 100.
                   CONVENÇÃO (validada contra a base e contra 2002): ALTA do
                   índice = DEPRECIAÇÃO real do BRL. Não inverta a leitura.
- BCB SGS 433    — IPCA variação mensal (vira número-índice por composição —
                   a 433 NÃO é índice, é % a.m.).
- BCB SGS 432    — Meta Selic definida pelo Copom (% a.a., diária).
- FRED CPIAUCSL  — CPI EUA (índice 1982-84=100), via API com FRED_API_KEY ou
                   fallback fredgraph.csv sem chave.
- FRED DFF       — Effective Federal Funds Rate (% a.a., diária) → média mensal.

Câmbio real bilateral USD/BRL (construído):
  RER_t = PTAX_t × (CPI_EUA_t / IPCA_índice_t), reindexado p/ base 100 em
  BASE_BILATERAL (2000-01). Mesma convenção do REER: alta = depreciação real.
  Régua: média histórica + ±1 dp da própria série — HONESTIDADE: média
  histórica NÃO é taxa de equilíbrio, é só referência de posição relativa.

Gera `data-pipeline/out/cambio_macro.json` e (com --upload) publica em
`data/cambio_macro.json` no Vercel Blob. Validações automáticas no final:
FALHOU, NÃO PUBLICA (nunca sobrescrever dado bom com payload vazio/quebrado).
"""
from __future__ import annotations

import argparse
import json
import os
import statistics
import sys
import time
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

import requests

# Console Windows local é cp1252 — força UTF-8 nos prints (no CI já é UTF-8).
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:  # noqa: BLE001
        pass

HERE = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/cambio_macro.json"

UA = {"User-Agent": "az-invest-cambio-macro-builder/0.1"}
SGS_BASE = "https://api.bcb.gov.br/dados/serie/bcdata.sgs"

SCHEMA_VERSION = 1

# ---------------------------------------------------------------------------
# Parâmetros metodológicos (documentados — mudou, versione o schema)
# ---------------------------------------------------------------------------
#: Início da série nominal mensal (PTAX). 1999 = flutuação cambial.
INICIO_NOMINAL = "1999-01"
#: Início do diferencial de juros (Selic meta existe desde mar/1999; 2000 evita
#: a transição do regime e casa com o pedido editorial).
INICIO_JUROS = "2000-01"
#: Mês-base do índice de câmbio real bilateral (= 100).
BASE_BILATERAL = "2000-01"
#: Janela da régua (média ± 1 dp) do câmbio real — bilateral E REER, p/ as duas
#: réguas serem comparáveis. REER é servido desde 1994, mas a média declarada
#: começa aqui.
INICIO_REGUA = "2000-01"

SGS_PTAX_VENDA_DIARIA = 1
SGS_PTAX_VENDA_MEDIA_MENSAL = 3698  # cross-check da agregação mensal
SGS_REER_IPCA = 11752
SGS_IPCA_VAR_MENSAL = 433
SGS_SELIC_META = 432

FRED_CPI_EUA = "CPIAUCSL"
FRED_FED_FUNDS_DIARIA = "DFF"       # via API (exige FRED_API_KEY; fredgraph dá 504)
FRED_FED_FUNDS_MENSAL = "FEDFUNDS"  # média mensal OFICIAL da DFF — fallback sem chave


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------
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
    if v in ("", "-", ".", "..", "...", None):
        return None
    try:
        return float(str(v).replace(",", "."))
    except (TypeError, ValueError):
        return None


def _br_to_iso(d: str) -> str:
    """'DD/MM/YYYY' → 'YYYY-MM-DD'."""
    dd, mm, yy = d.split("/")
    return f"{yy}-{mm.zfill(2)}-{dd.zfill(2)}"


# ---------------------------------------------------------------------------
# BCB SGS
# ---------------------------------------------------------------------------
def sgs_fetch_mensal(cod: int) -> dict[str, float]:
    """Série mensal completa → { 'YYYY-MM': valor }. Mensais não têm o teto de
    10 anos da API — um request resolve."""
    url = f"{SGS_BASE}.{cod}/dados?formato=json"
    print(f"  [SGS {cod}] {url}")
    data = _get(url).json()
    out: dict[str, float] = {}
    for r in data:
        v = _to_float(r.get("valor"))
        if v is not None:
            out[_br_to_iso(r["data"])[:7]] = v
    return out


def sgs_fetch_diaria(cod: int, inicio_iso: str) -> dict[str, float]:
    """Série DIÁRIA desde `inicio_iso` → { 'YYYY-MM-DD': valor }.

    A API do SGS limita consultas de séries diárias a janelas de 10 anos —
    e algumas séries (ex.: 432) rejeitam janelas bem menores que isso.
    Paginamos em blocos de 5 anos com dataInicial/dataFinal explícitos.
    """
    out: dict[str, float] = {}
    start = date.fromisoformat(inicio_iso)
    hoje = datetime.now(timezone.utc).date()
    while start <= hoje:
        end = min(date(start.year + 4, 12, 31), hoje)
        url = (
            f"{SGS_BASE}.{cod}/dados?formato=json"
            f"&dataInicial={start.strftime('%d/%m/%Y')}&dataFinal={end.strftime('%d/%m/%Y')}"
        )
        print(f"  [SGS {cod}] {url}")
        for r in _get(url).json():
            v = _to_float(r.get("valor"))
            if v is not None:
                out[_br_to_iso(r["data"])] = v
        start = date(end.year + 1, 1, 1)
    return out


def sgs_ultimo(cod: int) -> tuple[str, float] | None:
    """Última observação via endpoint /ultimos/1 (consulta direta de conferência)."""
    url = f"{SGS_BASE}.{cod}/dados/ultimos/1?formato=json"
    data = _get(url).json()
    if not data:
        return None
    v = _to_float(data[-1].get("valor"))
    if v is None:
        return None
    return _br_to_iso(data[-1]["data"]), v


# ---------------------------------------------------------------------------
# FRED (com chave via API oficial; sem chave via fredgraph.csv)
# ---------------------------------------------------------------------------
def fred_fetch(series_id: str, *, start: str = "1990-01-01") -> dict[str, float]:
    """Série FRED → { 'YYYY-MM-DD': valor }. Valores '.' (faltantes) descartados.

    `start` limita o range nas DUAS rotas — no fredgraph.csv é obrigatório p/
    séries diárias longas (DFF desde 1954 dá 504 sem o recorte cosd).
    """
    key = os.environ.get("FRED_API_KEY", "").strip()
    out: dict[str, float] = {}
    if key:
        url = (
            "https://api.stlouisfed.org/fred/series/observations"
            f"?series_id={series_id}&api_key={key}&file_type=json&observation_start={start}"
        )
        print(f"  [FRED {series_id}] api.stlouisfed.org (com FRED_API_KEY)")
        for o in _get(url).json().get("observations", []):
            v = _to_float(o.get("value"))
            if v is not None:
                out[o["date"]] = v
        return out
    hoje = datetime.now(timezone.utc).date().isoformat()
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}&cosd={start}&coed={hoje}"
    # Nota: o fredgraph.csv NÃO aguenta séries diárias longas (DFF → 504);
    # p/ diárias use a rota com FRED_API_KEY ou uma série mensal equivalente.
    print(f"  [FRED {series_id}] {url} (fallback sem chave)")
    text = _get(url).text
    for line in text.splitlines()[1:]:
        parts = line.split(",")
        if len(parts) != 2:
            continue
        v = _to_float(parts[1])
        if v is not None and len(parts[0]) == 10:
            out[parts[0]] = v
    return out


# ---------------------------------------------------------------------------
# Transformações
# ---------------------------------------------------------------------------
def fed_funds_mensal() -> tuple[dict[str, float], str]:
    """Fed Funds efetiva em média mensal { 'YYYY-MM': % a.a. } + descrição da rota.

    Com FRED_API_KEY: DFF diária → média mensal calculada aqui (inclui o mês
    corrente parcial). Sem chave (ou se a API falhar): FEDFUNDS, que é a média
    mensal OFICIAL da DFF publicada pelo FRED — numericamente equivalente p/
    meses fechados.
    """
    if os.environ.get("FRED_API_KEY", "").strip():
        try:
            diaria = fred_fetch(FRED_FED_FUNDS_DIARIA, start=f"{INICIO_JUROS}-01")
            if diaria:
                return media_mensal(diaria), "FRED DFF diária (média mensal no build)"
        except Exception as e:  # noqa: BLE001
            print(f"  [WARN] DFF via API falhou ({e}) — caindo p/ FEDFUNDS", file=sys.stderr)
    mensal_raw = fred_fetch(FRED_FED_FUNDS_MENSAL, start=f"{INICIO_JUROS}-01")
    return {d[:7]: v for d, v in mensal_raw.items()}, "FRED FEDFUNDS (média mensal oficial da DFF)"


def media_mensal(diaria: dict[str, float]) -> dict[str, float]:
    """{ 'YYYY-MM-DD': v } → { 'YYYY-MM': média } (média simples das observações)."""
    acc: dict[str, list[float]] = {}
    for d, v in diaria.items():
        acc.setdefault(d[:7], []).append(v)
    return {m: sum(vs) / len(vs) for m, vs in acc.items()}


def fim_de_mes(diaria: dict[str, float]) -> dict[str, float]:
    """{ 'YYYY-MM-DD': v } → { 'YYYY-MM': último valor do mês }."""
    ultimo_dia: dict[str, str] = {}
    for d in diaria:
        m = d[:7]
        if m not in ultimo_dia or d > ultimo_dia[m]:
            ultimo_dia[m] = d
    return {m: diaria[d] for m, d in ultimo_dia.items()}


def ipca_indice(var_mensal: dict[str, float], desde: str) -> dict[str, float]:
    """SGS 433 (% a.m.) → número-índice composto, começando em `desde` = 1.0
    no mês ANTERIOR (o índice do mês `desde` já carrega a variação do mês)."""
    meses = sorted(m for m in var_mensal if m >= desde)
    out: dict[str, float] = {}
    idx = 1.0
    for m in meses:
        idx *= 1.0 + var_mensal[m] / 100.0
        out[m] = idx
    return out


def mes_anterior(m: str, n: int = 1) -> str:
    y, mm = int(m[:4]), int(m[5:7])
    total = y * 12 + (mm - 1) - n
    return f"{total // 12:04d}-{total % 12 + 1:02d}"


def correlacao(xs: list[float], ys: list[float]) -> float | None:
    if len(xs) != len(ys) or len(xs) < 3:
        return None
    try:
        return statistics.correlation(xs, ys)
    except statistics.StatisticsError:
        return None


# ---------------------------------------------------------------------------
# Validações (princípio: falhou, não publica)
# ---------------------------------------------------------------------------
def valida(out: dict, ptax_media_calc: dict[str, float], sgs_3698: dict[str, float],
           reer: dict[str, float], reer_direto: tuple[str, float] | None) -> list[str]:
    erros: list[str] = []
    print("\n== Validações ==")

    # [1] Agregação mensal da PTAX diária vs série oficial de média de período
    comuns = sorted(set(ptax_media_calc) & set(sgs_3698))[-120:]
    if not comuns:
        erros.append("sem meses comuns entre PTAX agregada (SGS 1) e SGS 3698")
    else:
        difs = [abs(ptax_media_calc[m] - sgs_3698[m]) for m in comuns]
        m_u = comuns[-1]
        print(
            f"  [1] PTAX média mensal calculada vs SGS 3698 em {m_u}: "
            f"{ptax_media_calc[m_u]:.4f} vs {sgs_3698[m_u]:.4f} | max dif 120m = {max(difs):.4f}"
        )
        if max(difs) > 0.01:
            erros.append(f"PTAX média mensal diverge da SGS 3698 (max dif {max(difs):.4f})")

    # [2] REER: último valor da série vs consulta direta /ultimos/1
    meses_reer = sorted(reer)
    if not meses_reer:
        erros.append("REER (SGS 11752) veio vazio")
    else:
        u = meses_reer[-1]
        if reer_direto is None:
            erros.append("consulta direta REER /ultimos/1 falhou")
        else:
            d_dir, v_dir = reer_direto
            print(f"  [2] REER último na série: {u} = {reer[u]:.2f} | consulta direta: {d_dir[:7]} = {v_dir:.2f}")
            if d_dir[:7] != u or abs(reer[u] - v_dir) > 0.01:
                erros.append(f"REER da série ({u}={reer[u]}) ≠ consulta direta ({d_dir[:7]}={v_dir})")
        # base jun/1994 = 100 (confirma a definição da série)
        base94 = reer.get("1994-06")
        print(f"  [2] REER jun/1994 (base da série): {base94}")
        if base94 is None or abs(base94 - 100.0) > 1.0:
            erros.append(f"REER jun/1994 deveria ser ≈100 (veio {base94}) — definição da série mudou?")
        # convenção ALTA = DEPRECIAÇÃO: a crise de 2002 tem que estar ACIMA de 1997
        v2002, v1997 = reer.get("2002-10"), reer.get("1997-06")
        print(f"  [2] convenção (alta=depreciação): REER out/2002 = {v2002} deve ser > jun/1997 = {v1997}")
        if v2002 is not None and v1997 is not None and v2002 <= v1997:
            erros.append("convenção do REER inesperada: out/2002 não está acima de jun/1997")

    # [3] Bilateral: 100 no mês-base + coerência de convenção com o REER
    bilateral = {p["mes"]: p["indice"] for p in out["cambio_real"]["bilateral"]["serie"]}
    v_base = bilateral.get(BASE_BILATERAL)
    print(f"  [3] bilateral no mês-base {BASE_BILATERAL}: {v_base} (deve ser 100)")
    if v_base is None or abs(v_base - 100.0) > 0.01:
        erros.append(f"índice bilateral no mês-base ≠ 100 (veio {v_base})")
    var_b, var_r = [], []
    for m in sorted(bilateral):
        m12 = mes_anterior(m, 12)
        if m12 in bilateral and m in reer and m12 in reer:
            var_b.append(bilateral[m] / bilateral[m12] - 1)
            var_r.append(reer[m] / reer[m12] - 1)
    corr = correlacao(var_b, var_r)
    print(f"  [3] correlação var 12m bilateral × REER: {corr if corr is None else round(corr, 3)} (n={len(var_b)})")
    if corr is None or corr < 0.3:
        erros.append(f"correlação bilateral×REER suspeita ({corr}) — convenção ou dado errado")
    elif corr < 0.6:
        print(f"  [3] [WARN] correlação bilateral×REER abaixo do usual ({corr:.3f})", file=sys.stderr)

    # [4] Diferencial de juros: sanidade de magnitude
    dif_serie = out["juros"]["diferencial"]["serie"]
    if dif_serie:
        ult = dif_serie[-1]
        print(
            f"  [4] diferencial em {ult['mes']}: Selic {ult['selic_meta']} − FedFunds {ult['fed_funds']} "
            f"= {ult['diferencial_pp']} p.p."
        )
        if not (-5.0 < ult["diferencial_pp"] < 30.0):
            erros.append(f"diferencial de juros fora de faixa plausível ({ult['diferencial_pp']} p.p.)")

    # [5] Contagens mínimas por bloco (payload mínimo — nunca publicar vazio)
    minimos = [
        ("nominal.serie", len(out["nominal"]["serie"]), 300),
        ("cambio_real.bilateral.serie", len(out["cambio_real"]["bilateral"]["serie"]), 300),
        ("cambio_real.reer.serie", len(out["cambio_real"]["reer"]["serie"]), 360),
        ("juros.diferencial.serie", len(dif_serie), 300),
        ("juros.uip.pontos", len(out["juros"]["uip"]["pontos"]), 250),
    ]
    for nome, n, minimo in minimos:
        print(f"  [5] {nome}: {n} pontos (mínimo {minimo})")
        if n < minimo:
            erros.append(f"{nome} com só {n} pontos (mínimo {minimo})")

    # Hero sem None (o front mostra '—', mas publicar hero vazio é regressão)
    for k, v in out["hero"].items():
        if v is None or (isinstance(v, dict) and any(x is None for x in v.values())):
            erros.append(f"hero.{k} veio None")

    if not erros:
        print("  OK — todas as validações passaram.")
    return erros


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    ap = argparse.ArgumentParser(description="Build do JSON Câmbio Econômico (Contas Externas → Câmbio)")
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR), help="Diretório de saída (default: data-pipeline/out)")
    ap.add_argument("--upload", action="store_true", help="Após gerar E validar, fazer upload pro Vercel Blob")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "cambio_macro.json"

    # ── 1. Câmbio nominal: PTAX venda diária → mensal ────────────────────────
    print("== PTAX venda diária (SGS 1) ==")
    ptax_diaria = sgs_fetch_diaria(SGS_PTAX_VENDA_DIARIA, f"{INICIO_NOMINAL}-01")
    if not ptax_diaria:
        print("[FATAL] SGS 1 vazio — abortando sem publicar.", file=sys.stderr)
        sys.exit(1)
    ptax_media = media_mensal(ptax_diaria)
    ptax_fim = fim_de_mes(ptax_diaria)
    dia_ultimo = max(ptax_diaria)
    print(f"  {len(ptax_diaria)} obs diárias → {len(ptax_media)} meses | último: {dia_ultimo} = {ptax_diaria[dia_ultimo]}")

    print("== PTAX venda média de período (SGS 3698 — cross-check) ==")
    sgs_3698 = sgs_fetch_mensal(SGS_PTAX_VENDA_MEDIA_MENSAL)

    # ── 2. Câmbio real ───────────────────────────────────────────────────────
    print("== REER (SGS 11752) ==")
    reer = sgs_fetch_mensal(SGS_REER_IPCA)
    reer_direto = None
    try:
        reer_direto = sgs_ultimo(SGS_REER_IPCA)
    except Exception as e:  # noqa: BLE001
        print(f"  [WARN] /ultimos/1 falhou: {e}", file=sys.stderr)
    print(f"  {len(reer)} meses")

    print("== IPCA mensal (SGS 433) → número-índice composto ==")
    ipca_var = sgs_fetch_mensal(SGS_IPCA_VAR_MENSAL)
    # composição desde dez/1998 p/ o índice cobrir todo o nominal (1999+)
    ipca_idx = ipca_indice(ipca_var, "1998-12")
    print(f"  índice composto: {len(ipca_idx)} meses")

    print("== CPI EUA (FRED CPIAUCSL) ==")
    cpi_raw = fred_fetch(FRED_CPI_EUA)
    cpi = {d[:7]: v for d, v in cpi_raw.items()}  # mensal: 1 obs por mês (dia 01)
    print(f"  {len(cpi)} meses")

    # bilateral real: PTAX × CPI_EUA / IPCA, base 100 em BASE_BILATERAL.
    # Convenção idêntica à do REER: ALTA = DEPRECIAÇÃO real do BRL.
    meses_bilateral = sorted(
        m for m in ptax_media
        if m >= INICIO_NOMINAL and m in cpi and m in ipca_idx
    )
    if BASE_BILATERAL not in meses_bilateral:
        print(f"[FATAL] mês-base {BASE_BILATERAL} ausente do bilateral.", file=sys.stderr)
        sys.exit(1)
    rer_bruto = {m: ptax_media[m] * cpi[m] / ipca_idx[m] for m in meses_bilateral}
    fator = 100.0 / rer_bruto[BASE_BILATERAL]
    bilateral = {m: round(rer_bruto[m] * fator, 2) for m in meses_bilateral}

    vals_regua_bi = [v for m, v in bilateral.items() if m >= INICIO_REGUA]
    media_bi = statistics.mean(vals_regua_bi)
    dp_bi = statistics.stdev(vals_regua_bi)
    m_bi_ult = meses_bilateral[-1]
    desvio_pct = (bilateral[m_bi_ult] / media_bi - 1.0) * 100.0

    vals_regua_reer = [v for m, v in reer.items() if m >= INICIO_REGUA]
    media_reer = statistics.mean(vals_regua_reer)
    dp_reer = statistics.stdev(vals_regua_reer)
    m_reer_ult = max(reer)
    m_reer_12 = mes_anterior(m_reer_ult, 12)
    reer_var_12m = (
        (reer[m_reer_ult] / reer[m_reer_12] - 1.0) * 100.0 if m_reer_12 in reer else None
    )

    # ── 3. Paridade de juros ─────────────────────────────────────────────────
    print("== Selic meta (SGS 432, diária) ==")
    selic_diaria = sgs_fetch_diaria(SGS_SELIC_META, f"{INICIO_JUROS}-01")
    selic_mensal = media_mensal(selic_diaria)
    print(f"  {len(selic_mensal)} meses")

    print("== Fed Funds (FRED) ==")
    dff_mensal, fed_funds_rota = fed_funds_mensal()
    print(f"  {len(dff_mensal)} meses | rota: {fed_funds_rota}")

    meses_dif = sorted(m for m in selic_mensal if m >= INICIO_JUROS and m in dff_mensal)
    diferencial_serie = [
        {
            "mes": m,
            "selic_meta": round(selic_mensal[m], 2),
            "fed_funds": round(dff_mensal[m], 2),
            "diferencial_pp": round(selic_mensal[m] - dff_mensal[m], 2),
        }
        for m in meses_dif
    ]
    dif_por_mes = {r["mes"]: r["diferencial_pp"] for r in diferencial_serie}

    # ── 4. Scorecard UIP ─────────────────────────────────────────────────────
    # Pergunta: o diferencial de juros de 12m atrás "previu" a variação cambial
    # realizada? UIP diz var_cambial ≈ diferencial; a evidência empírica
    # (Fama 1984 e sucessores) é que NÃO no curto prazo — o gráfico mostra a
    # dispersão. x = diferencial em t−12 (p.p. a.a.); y = variação % da PTAX
    # média mensal entre t−12 e t (alta = depreciação do BRL).
    uip_pontos: list[dict[str, Any]] = []
    for m in meses_dif:
        m12 = mes_anterior(m, 12)
        if m12 in dif_por_mes and m in ptax_media and m12 in ptax_media:
            var_fx = (ptax_media[m] / ptax_media[m12] - 1.0) * 100.0
            uip_pontos.append(
                {
                    "mes": m,
                    "diferencial_t12_pp": dif_por_mes[m12],
                    "var_cambial_12m_pct": round(var_fx, 2),
                }
            )
    xs = [p["diferencial_t12_pp"] for p in uip_pontos]
    ys = [p["var_cambial_12m_pct"] for p in uip_pontos]
    erros_uip = [y - x for x, y in zip(xs, ys)]
    uip_stats = {
        "n": len(uip_pontos),
        "correlacao": round(c, 3) if (c := correlacao(xs, ys)) is not None else None,
        # erro = realizado − previsto pela UIP; média ≠ 0 = desvio sistemático
        "erro_medio_pp": round(statistics.mean(erros_uip), 2) if erros_uip else None,
        "erro_dp_pp": round(statistics.stdev(erros_uip), 2) if len(erros_uip) > 1 else None,
        # % dos meses em que o BRL DEPRECIOU apesar de diferencial positivo
        "pct_depreciou_com_dif_positivo": (
            round(100.0 * sum(1 for x, y in zip(xs, ys) if x > 0 and y > 0)
                  / max(1, sum(1 for x in xs if x > 0)), 1)
        ),
    }

    # ── Payload ──────────────────────────────────────────────────────────────
    ult_mes_nominal = max(ptax_media)
    out: dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "ultima_referencia_mensal": ult_mes_nominal,
        "nominal": {
            "serie": [
                {
                    "mes": m,
                    "ptax_media": round(ptax_media[m], 4),
                    "ptax_fim": round(ptax_fim[m], 4) if m in ptax_fim else None,
                }
                for m in sorted(ptax_media)
            ],
            "ptax_ultimo": {"data": dia_ultimo, "valor": round(ptax_diaria[dia_ultimo], 4)},
        },
        "cambio_real": {
            "convencao": "ALTA do índice = DEPRECIAÇÃO real do BRL (vale p/ o REER 11752 e p/ o bilateral construído)",
            "bilateral": {
                "base_100": BASE_BILATERAL,
                "metodologia": (
                    "PTAX venda média mensal × (CPI EUA CPIAUCSL ÷ IPCA número-índice composto da SGS 433), "
                    f"reindexado p/ 100 em {BASE_BILATERAL}. Régua = média {INICIO_REGUA}+ ± 1 dp — "
                    "média histórica NÃO é taxa de equilíbrio."
                ),
                "serie": [{"mes": m, "indice": bilateral[m]} for m in meses_bilateral],
                "media_hist": round(media_bi, 2),
                "dp_hist": round(dp_bi, 2),
                "janela_regua": f"{INICIO_REGUA}+",
                "ultimo": {"mes": m_bi_ult, "indice": bilateral[m_bi_ult]},
                "desvio_vs_media_pct": round(desvio_pct, 1),
            },
            "reer": {
                "sgs": SGS_REER_IPCA,
                "definicao": (
                    "Índice da taxa de câmbio efetiva real (IPCA) do BCB — SGS 11752, jun/1994 = 100. "
                    "Cesta dos principais parceiros comerciais, deflator doméstico IPCA. "
                    "ALTA = depreciação real do BRL (base jun/1994≈100 e pico de 2002 validados no build)."
                ),
                "serie": [{"mes": m, "indice": round(reer[m], 2)} for m in sorted(reer)],
                "media_hist": round(media_reer, 2),
                "dp_hist": round(dp_reer, 2),
                "janela_regua": f"{INICIO_REGUA}+",
                "ultimo": {"mes": m_reer_ult, "indice": round(reer[m_reer_ult], 2)},
                "var_12m_pct": round(reer_var_12m, 1) if reer_var_12m is not None else None,
            },
        },
        "juros": {
            "diferencial": {
                "metodologia": (
                    "Meta Selic (SGS 432, média mensal das observações diárias) − Effective Fed Funds "
                    f"em média mensal ({fed_funds_rota}), em pontos percentuais a.a."
                ),
                "serie": diferencial_serie,
            },
            "uip": {
                "metodologia": (
                    "Paridade descoberta de juros na prática: x = diferencial Selic−Fed de 12 meses atrás "
                    "(p.p. a.a.); y = variação % da PTAX média mensal efetivamente realizada nos 12m "
                    "seguintes (alta = depreciação). Se a UIP valesse, os pontos cairiam na reta y = x."
                ),
                "pontos": uip_pontos,
                "stats": uip_stats,
            },
        },
        "hero": {
            "ptax": {"data": dia_ultimo, "valor": round(ptax_diaria[dia_ultimo], 4)},
            "bilateral_vs_media_pct": round(desvio_pct, 1),
            "reer_var_12m_pct": round(reer_var_12m, 1) if reer_var_12m is not None else None,
            "diferencial_pp": diferencial_serie[-1]["diferencial_pp"] if diferencial_serie else None,
        },
        "previsao": {
            # Estrutura reservada p/ os modelos do dono (combinação de paridades
            # + fundamentos). O front mostra placeholder honesto enquanto vazio.
            "modelos": [],
            "nota": "Em construção — nenhum modelo publicado ainda.",
        },
        "metadata": {
            "fonte": "BCB/SGS (PTAX 1 e 3698, REER 11752, IPCA 433, Selic meta 432) + FRED (CPIAUCSL, DFF)",
            "series_sgs": {
                "ptax_venda_diaria": SGS_PTAX_VENDA_DIARIA,
                "ptax_venda_media_mensal": SGS_PTAX_VENDA_MEDIA_MENSAL,
                "reer_ipca": SGS_REER_IPCA,
                "ipca_var_mensal": SGS_IPCA_VAR_MENSAL,
                "selic_meta": SGS_SELIC_META,
            },
            "series_fred": {
                "cpi_eua": FRED_CPI_EUA,
                "fed_funds_diaria": FRED_FED_FUNDS_DIARIA,
                "fed_funds_mensal_fallback": FRED_FED_FUNDS_MENSAL,
            },
            "fed_funds_rota": fed_funds_rota,
            "nota": (
                "O câmbio real bilateral defasa 1-2 meses vs a PTAX (espera CPI/IPCA). "
                "Convenção única: alta = depreciação real do BRL."
            ),
        },
    }

    erros = valida(out, ptax_media, sgs_3698, reer, reer_direto)

    out_file.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nJSON salvo em {out_file} ({out_file.stat().st_size / 1024:.1f} KB)")

    # ── Valores-chave p/ conferência manual ──────────────────────────────────
    print("\n== Valores-chave ==")
    print(f"  PTAX último: {dia_ultimo} = R$ {ptax_diaria[dia_ultimo]:.4f}")
    print(
        f"  Bilateral real ({m_bi_ult}): {bilateral[m_bi_ult]} | média {INICIO_REGUA}+: {media_bi:.1f} ± {dp_bi:.1f} "
        f"→ {desvio_pct:+.1f}% vs média ({'mais DEPRECIADO' if desvio_pct > 0 else 'mais APRECIADO'} que a média)"
    )
    print(
        f"  REER ({m_reer_ult}): {reer[m_reer_ult]:.2f} | var 12m: "
        f"{reer_var_12m:+.1f}% ({'depreciação' if (reer_var_12m or 0) > 0 else 'apreciação'} real no ano)"
        if reer_var_12m is not None else "  REER: var 12m indisponível"
    )
    if diferencial_serie:
        u = diferencial_serie[-1]
        print(f"  Diferencial ({u['mes']}): Selic {u['selic_meta']}% − Fed {u['fed_funds']}% = {u['diferencial_pp']} p.p.")
    print(f"  UIP: n={uip_stats['n']} | corr={uip_stats['correlacao']} | erro médio={uip_stats['erro_medio_pp']} p.p. "
          f"| dp do erro={uip_stats['erro_dp_pp']} p.p.")

    if erros:
        print(f"\n[VALIDACAO] {len(erros)} erro(s) — NÃO publicar:", file=sys.stderr)
        for e in erros:
            print(f"  - {e}", file=sys.stderr)
        sys.exit(1)

    if args.upload:
        try:
            sys.path.insert(0, str(HERE))
            from shared.blob_upload import maybe_upload_json
            maybe_upload_json(out_file, BLOB_PATH)
        except Exception as e:  # noqa: BLE001
            print(f"[upload] FALHOU: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        print("[upload] SKIP (use --upload pra subir pro Blob)")


if __name__ == "__main__":
    main()
