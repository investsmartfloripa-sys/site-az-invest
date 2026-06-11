"""Build do JSON do Painel Famílias — bloco Endividamento e Comprometimento.

Consome séries do BCB SGS (RNDBF — Relatório de Estabilidade Financeira / Sistema Financeiro Nacional):

- Endividamento (% da renda 12m):
  - 29037: total (com habitacional)
  - 29038: exceto habitacional
- Comprometimento de renda mensal (% da renda mensal, com ajuste sazonal):
  - 29034: serviço da dívida total (juros + amortização)
  - 29033: juros
  - 29036: amortização
- Inadimplência (% da carteira PF >90 dias):
  - 21082: total (livres + direcionados)
  - 21112: recursos livres total
  - 21114: crédito pessoal não-consignado
  - 21116: crédito pessoal consignado privado
  - 21121: aquisição de veículos
  - 21127: cartão de crédito rotativo
  - 21128: cartão de crédito parcelado
  - 21129: cartão de crédito total
- Saldo da carteira PF (composição estoque, R$ milhões — séries de SALDO, não concessões):
  - 20541: saldo total PF (livres + direcionados)
  - 20570: recursos livres PF
  - 20606: recursos direcionados PF
  - 20612: financiamento imobiliário PF
  - 20581: aquisição de veículos
  - 20590: cartão de crédito total
  - 20579: crédito pessoal consignado total
  - 20574: crédito pessoal não-consignado
  - 20573: cheque especial
  - 20609: crédito rural PF

Gera `data-pipeline/out/familias_endividamento.json` e upload pra `data/familias_endividamento.json`.

Merge incremental contra Blob existente preserva histórico e registra revisões via `revised_at`.

Cron diário 23:30 UTC (defasagem de publicação BCB é de ~2 meses).
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
BLOB_PATH = "data/familias_endividamento.json"

UA = {"User-Agent": "az-invest-familias-endividamento/0.1"}
SGS_BASE = "https://api.bcb.gov.br/dados/serie/bcdata.sgs"

# Séries SGS — agrupadas por bloco editorial
ENDIVIDAMENTO = {
    "total": 29037,                # com habitacional
    "sem_habitacional": 29038,     # exceto habitacional
}

COMPROMETIMENTO = {
    "servico_divida": 29034,       # total = juros + amortizacao (com ajuste sazonal)
    "juros": 29033,                # parcela de juros
    "amortizacao": 29036,           # parcela de amortizacao
}

INADIMPLENCIA = {
    "pf_total_geral": 21082,       # livres + direcionados
    "pf_livres_total": 21112,      # recursos livres
    "pessoal_nao_consignado": 21114,
    "consignado_privado": 21116,
    "veiculos": 21121,
    "cartao_rotativo": 21127,
    "cartao_parcelado": 21128,
    "cartao_total": 21129,
}

# Composição do estoque PF (R$ milhões — ordens de grandeza diferentes; usar %)
# ATENÇÃO: usar séries de SALDO (estoque). Os códigos antigos (20631/20680/...) eram
# de CONCESSÕES (fluxo mensal) e produziam residual ~96% no gráfico de composição.
# Códigos validados no catálogo dadosabertos.bcb.gov.br (identidade 20570+20606=20541).
ESTOQUE_PF = {
    "saldo_total": 20541,                 # saldo total PF (livres + direcionados)
    "livres_total": 20570,                # recursos livres PF
    "direcionado_total": 20606,           # recursos direcionados PF
    "habitacional": 20612,                # financiamento imobiliário PF
    "veiculos": 20581,                    # aquisição de veículos
    "cartao": 20590,                      # cartão de crédito total
    "consignado": 20579,                  # crédito pessoal consignado total
    "credito_pessoal_nao_consig": 20574,  # crédito pessoal não-consignado
    "cheque_especial": 20573,             # cheque especial
    "rural": 20609,                       # crédito rural PF
}


def _get(url: str, *, timeout: int = 30, retries: int = 3, sleep: float = 2.0) -> requests.Response:
    last: Exception | None = None
    for i in range(retries):
        try:
            r = requests.get(url, timeout=timeout, headers=UA)
            r.raise_for_status()
            ct = r.headers.get("content-type", "")
            if ct.startswith("text/html"):
                raise RuntimeError(f"BCB devolveu HTML (provável série inexistente): {url}")
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


def _br_date_to_iso(d: str) -> str:
    try:
        dd, mm, yy = d.split("/")
        return f"{yy}-{mm.zfill(2)}-{dd.zfill(2)}"
    except Exception:
        return d


def sgs_serie(code: int) -> dict[str, float | None]:
    """Retorna dict { 'YYYY-MM-DD': valor } a partir do SGS (série completa)."""
    url = f"{SGS_BASE}.{code}/dados?formato=json"
    print(f"  [SGS {code}] {url}")
    try:
        rows = _get(url).json()
    except Exception as e:
        print(f"  [SGS {code}] FAIL: {e}", file=sys.stderr)
        return {}
    out: dict[str, float | None] = {}
    for r in rows:
        d = _br_date_to_iso(r.get("data", ""))
        v = _to_float(r.get("valor"))
        if d:
            out[d] = v
    return out


def last_with_value(serie: dict[str, float | None]) -> tuple[str | None, float | None]:
    keys = [k for k in sorted(serie.keys()) if serie.get(k) is not None]
    if not keys:
        return None, None
    return keys[-1], serie[keys[-1]]


def serie_to_pontos(serie: dict[str, float | None]) -> list[dict[str, Any]]:
    """Converte dict para lista [{mes, valor}] ordenada."""
    return [{"mes": k, "valor": v} for k, v in sorted(serie.items()) if v is not None]


def merge_revisao(prev: dict[str, dict] | None, novo: dict[str, float | None], now_iso: str) -> dict[str, dict]:
    """Merge incremental: detecta revisão de valor passado e atualiza revised_at.

    Estrutura retornada: { 'YYYY-MM-DD': {'valor': float, 'revised_at': 'YYYY-MM-DD'} }
    """
    saida: dict[str, dict] = dict(prev or {})
    for k, v in novo.items():
        if v is None:
            continue
        if k in saida:
            prev_val = saida[k].get("valor")
            if prev_val is None or abs(prev_val - v) > 1e-9:
                saida[k] = {"valor": v, "revised_at": now_iso}
            # se valor é idêntico, mantém revised_at antigo
        else:
            saida[k] = {"valor": v, "revised_at": now_iso}
    return saida


def main() -> None:
    ap = argparse.ArgumentParser(description="Build do JSON Painel Famílias — Endividamento")
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--no-merge", action="store_true", help="Não fazer merge com Blob existente")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "familias_endividamento.json"
    now_iso = datetime.now(timezone.utc).date().isoformat()

    # ---- Coleta SGS ----
    print("== SGS — Endividamento ==")
    endiv: dict[str, dict[str, float | None]] = {}
    for k, c in ENDIVIDAMENTO.items():
        endiv[k] = sgs_serie(c)
        time.sleep(0.4)

    print("== SGS — Comprometimento ==")
    compr: dict[str, dict[str, float | None]] = {}
    for k, c in COMPROMETIMENTO.items():
        compr[k] = sgs_serie(c)
        time.sleep(0.4)

    print("== SGS — Inadimplência ==")
    inad: dict[str, dict[str, float | None]] = {}
    for k, c in INADIMPLENCIA.items():
        inad[k] = sgs_serie(c)
        time.sleep(0.4)

    print("== SGS — Estoque PF ==")
    estoque: dict[str, dict[str, float | None]] = {}
    for k, c in ESTOQUE_PF.items():
        estoque[k] = sgs_serie(c)
        time.sleep(0.4)

    # ---- Merge incremental contra Blob (registra revisões) ----
    prev_payload = None
    if not args.no_merge:
        try:
            sys.path.insert(0, str(HERE))
            from shared.blob_download import download_json
            prev_payload = download_json(BLOB_PATH)
            if prev_payload:
                print(f"  [merge] Blob anterior gerado_em {prev_payload.get('gerado_em','?')}")
        except Exception as e:
            print(f"  [merge] WARN: {e}", file=sys.stderr)

    def merge_block(novo: dict[str, dict[str, float | None]], path: list[str], *, use_prev: bool = True) -> dict[str, list[dict]]:
        """Merge cada série dentro de um bloco, retornando lista de pontos por chave."""
        bloco_prev: dict[str, dict] = {}
        if prev_payload and use_prev:
            cur = prev_payload
            for p in path:
                cur = (cur or {}).get(p, {}) if isinstance(cur, dict) else {}
            if isinstance(cur, dict):
                bloco_prev = cur.get("series_raw", {}) or {}

        series_raw: dict[str, dict[str, dict]] = {}
        series_pontos: dict[str, list[dict]] = {}
        for k, dados in novo.items():
            prev_k = bloco_prev.get(k, {}) if isinstance(bloco_prev, dict) else {}
            merged = merge_revisao(prev_k, dados, now_iso)
            series_raw[k] = merged
            series_pontos[k] = [
                {"mes": d, "valor": info["valor"], "revised_at": info["revised_at"]}
                for d, info in sorted(merged.items())
            ]
        return {"series_raw": series_raw, "series_pontos": series_pontos}

    endiv_block = merge_block(endiv, ["bloco_endividamento"])
    compr_block = merge_block(compr, ["bloco_comprometimento"])
    inad_block = merge_block(inad, ["bloco_inadimplencia"])
    # use_prev=False: o Blob anterior guardava CONCESSÕES (códigos errados) sob as
    # mesmas chaves — preservar aquele histórico misturaria fluxo com saldo.
    estoque_block = merge_block(estoque, ["bloco_estoque"], use_prev=False)

    # ---- Compõe percentuais do estoque (livres × direcionados × por modalidade) ----
    # Composição percentual mês-a-mês: cada modalidade / saldo total PF (livres + direcionados)
    def get_serie_atual(b: dict, k: str) -> dict[str, float]:
        return {p["mes"]: p["valor"] for p in b["series_pontos"].get(k, []) if p["valor"] is not None}

    saldo_total = get_serie_atual(estoque_block, "saldo_total")
    livres = get_serie_atual(estoque_block, "livres_total")
    direc = get_serie_atual(estoque_block, "direcionado_total")
    habit = get_serie_atual(estoque_block, "habitacional")
    veic = get_serie_atual(estoque_block, "veiculos")
    cart = get_serie_atual(estoque_block, "cartao")
    cons = get_serie_atual(estoque_block, "consignado")
    cred_n_consig = get_serie_atual(estoque_block, "credito_pessoal_nao_consig")
    cheque = get_serie_atual(estoque_block, "cheque_especial")
    rural = get_serie_atual(estoque_block, "rural")

    composicao_pct: list[dict[str, Any]] = []
    chaves_compostas = sorted(saldo_total.keys())
    max_diff_identidade = 0.0
    for m in chaves_compostas:
        total = saldo_total[m]
        if total <= 0:
            continue
        # Sanity: identidade livres + direcionados = total (pega código errado / revisão assimétrica)
        if m in livres and m in direc:
            diff = abs((livres[m] + direc[m]) - total) / total * 100.0
            max_diff_identidade = max(max_diff_identidade, diff)
        # Modalidades específicas (somente as que conhecemos do estoque)
        h = habit.get(m, 0.0) or 0.0
        v = veic.get(m, 0.0) or 0.0
        c = cart.get(m, 0.0) or 0.0
        co = cons.get(m, 0.0) or 0.0
        cn = cred_n_consig.get(m, 0.0) or 0.0
        ch = cheque.get(m, 0.0) or 0.0
        ru = rural.get(m, 0.0) or 0.0
        # outras = total - soma das modalidades conhecidas (positivo)
        outras = total - (h + v + c + co + cn + ch + ru)
        if outras < 0:
            outras = 0.0
        composicao_pct.append({
            "mes": m,
            "total_pf": total,
            "habitacional_pct": (h / total) * 100.0,
            "consignado_pct": (co / total) * 100.0,
            "cartao_pct": (c / total) * 100.0,
            "veiculos_pct": (v / total) * 100.0,
            "credito_pessoal_pct": (cn / total) * 100.0,
            "cheque_especial_pct": (ch / total) * 100.0,
            "rural_pct": (ru / total) * 100.0,
            "outras_pct": (outras / total) * 100.0,
        })

    # ---- Sanity checks do estoque (falham o build em vez de publicar gráfico quebrado) ----
    if not composicao_pct:
        print("[sanity] FAIL: composição do estoque PF vazia (séries SGS de saldo não retornaram dados)", file=sys.stderr)
        sys.exit(4)
    residual_ultimo = composicao_pct[-1]["outras_pct"]
    if residual_ultimo > 12.0:
        print(
            f"[sanity] FAIL: residual 'outras' da composição do estoque = {residual_ultimo:.1f}% (> 12%) — "
            "provável código SGS errado (esperado ~6% com séries de saldo)",
            file=sys.stderr,
        )
        sys.exit(4)
    if max_diff_identidade > 0.5:
        print(
            f"[sanity] FAIL: identidade livres+direcionados=total violada (diff máx {max_diff_identidade:.2f}% > 0,5%)",
            file=sys.stderr,
        )
        sys.exit(4)
    print(f"  [sanity] residual 'outras' (último mês): {residual_ultimo:.2f}% | diff identidade máx: {max_diff_identidade:.3f}%")

    # ---- Hero KPIs ----
    k_end, v_end = last_with_value(endiv["total"])
    k_endsh, v_endsh = last_with_value(endiv["sem_habitacional"])
    k_cmp, v_cmp = last_with_value(compr["servico_divida"])
    k_rot, v_rot = last_with_value(inad["cartao_rotativo"])

    hero = {
        "endividamento_total_pct_renda": {"data": k_end, "valor": v_end, "unidade": "% da renda 12m"},
        "endividamento_sem_habit_pct_renda": {"data": k_endsh, "valor": v_endsh, "unidade": "% da renda 12m"},
        "comprometimento_mensal_pct": {"data": k_cmp, "valor": v_cmp, "unidade": "% da renda mensal"},
        "inad_cartao_rotativo_pct": {"data": k_rot, "valor": v_rot, "unidade": "%"},
    }

    # ---- Output ----
    payload = {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "fonte_principal": "Banco Central do Brasil — SGS (RNDBF)",
        "ultima_referencia_mensal": k_end,
        "hero": hero,
        "bloco_endividamento": {
            "series_raw": endiv_block["series_raw"],
            "series_pontos": endiv_block["series_pontos"],
            "codigos_sgs": ENDIVIDAMENTO,
        },
        "bloco_comprometimento": {
            "series_raw": compr_block["series_raw"],
            "series_pontos": compr_block["series_pontos"],
            "codigos_sgs": COMPROMETIMENTO,
        },
        "bloco_inadimplencia": {
            "series_raw": inad_block["series_raw"],
            "series_pontos": inad_block["series_pontos"],
            "codigos_sgs": INADIMPLENCIA,
        },
        "bloco_estoque": {
            "series_raw": estoque_block["series_raw"],
            "series_pontos": estoque_block["series_pontos"],
            "composicao_pct": composicao_pct,
            "codigos_sgs": ESTOQUE_PF,
        },
        "metadata": {
            "fonte": "BCB SGS / RNDBF",
            "nota": (
                "Endividamento = saldo total PF / renda 12m. Comprometimento = serviço da dívida mensal / renda mensal. "
                "Inadimplência = parcelas atrasadas >90d sobre carteira. Comprometimento usa séries com ajuste sazonal."
            ),
            "campo_revised_at": "Cada ponto traz `revised_at` (YYYY-MM-DD UTC). Quando o BCB revisa valor passado, revised_at atualiza.",
            "defasagem_publicacao": "~2 meses (BCB)",
        },
    }

    out_file.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    size_kb = out_file.stat().st_size / 1024
    print(f"\n✓ Gerado {out_file} ({size_kb:.1f} KB)")
    print(f"  Hero endividamento: {v_end:.2f}% renda 12m ({k_end})" if v_end else "  Hero endividamento: -")
    print(f"  Hero comprometimento: {v_cmp:.2f}% renda mensal ({k_cmp})" if v_cmp else "  Hero comprometimento: -")
    print(f"  Hero rotativo: {v_rot:.2f}% ({k_rot})" if v_rot else "  Hero rotativo: -")

    if args.upload:
        try:
            from shared.blob_upload import maybe_upload_json
            maybe_upload_json(out_file, BLOB_PATH)
        except Exception as e:
            print(f"[upload] FAIL: {e}", file=sys.stderr)
            sys.exit(3)


if __name__ == "__main__":
    main()
