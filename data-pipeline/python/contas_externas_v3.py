"""Blocos do schema v3 do Painel Contas Externas (cockpit do balanço de pagamentos).

Chamado por build_contas_externas.py — ADITIVO: os campos v1/v2 ficam intactos.

Blocos:
- bp_mestre:     todas as linhas do BPM6 mensal (TC → conta capital → conta
                 financeira por função/instrumento → reservas → erros e omissões),
                 fluxo mensal (60 meses) e acumulado 12m (desde 1996) + PIB 12m.
                 Identidade auditada: TC + KK − CF + EO = 0.
- pii:           posição de investimento internacional (trimestral, SGS 24010+),
                 com dívida externa de curto prazo por PRAZO ORIGINAL montada dos
                 passivos da PII → razão Guidotti-Greenspan aproximada.
- fluxo_cambial: câmbio contratado (SGS 13961 total, 13967 comercial, 13970
                 financeiro; diário) → mensal e 12m.
- focus:         medianas anuais do Focus (conta corrente, balança, IDP, câmbio)
                 por data de coleta, uma por semana.
- revisoes:      log de diff do acumulado 12m da TC contra o Blob anterior
                 (o BCB reescreve a série em jul/CBE e nov/Censo).
"""
from __future__ import annotations

import sys
import time
from datetime import date, datetime, timedelta, timezone
from typing import Any, Callable

import requests

Serie = dict[str, float | None]

# ── Linhas da tabela mestra (BPM6, US$ milhões, convenção BCB) ────────────────
# (key, rótulo, nível de indentação, código SGS | None = derivada)
# Convenção da conta financeira (BPM6): líquido = ativos − passivos; NEGATIVO =
# entrada líquida de recursos (o país se financia). IDP e passivos: + = entrada.
LINHAS: list[tuple[str, str, int, int | None]] = [
    ("tc", "Transações correntes", 0, 22701),
    ("bens", "Balança comercial (bens)", 1, 22707),
    ("bens_x", "Exportações", 2, 22711),
    ("bens_m", "Importações", 2, None),               # 22711 − 22707
    ("servicos", "Serviços", 1, 22719),
    ("renda_primaria", "Renda primária", 1, 22800),
    ("lucros_dividendos", "Lucros e dividendos (inv. direto)", 2, 22812),
    ("lucros_reinvestidos", "Lucros reinvestidos", 2, 22815),
    ("juros_demais", "Juros e demais rendas", 2, None),  # 22800 − 22812 − 22815
    ("renda_secundaria", "Renda secundária", 1, 22838),
    ("conta_capital", "Conta capital", 0, 22851),
    ("conta_financeira", "Conta financeira", 0, 22863),
    ("inv_direto", "Investimento direto (IDE − IDP)", 1, 22864),
    ("ide", "IDE — brasileiros no exterior", 2, 22865),
    ("idp", "IDP — estrangeiros no país", 2, 22885),
    ("idp_participacao", "Participação no capital (exc. reinvest.)", 3, 22891),
    ("idp_reinvestimento", "Reinvestimento de lucros", 3, 22892),
    ("idp_intercompanhia", "Operações intercompanhia", 3, 22893),
    ("carteira", "Investimento em carteira (ativos − passivos)", 1, 22905),
    ("carteira_ativos", "Ativos (residentes no exterior)", 2, 22906),
    ("carteira_passivos", "Passivos (não residentes no país)", 2, 22924),
    ("acoes_passivos", "Ações", 3, 22927),
    ("fundos_passivos", "Fundos de investimento", 3, 22936),
    ("titulos_passivos", "Títulos de dívida", 3, 22939),
    ("titulos_domesticos", "Negociados no mercado doméstico", 4, 22942),
    ("titulos_externos", "Negociados no mercado externo", 4, 22945),
    ("derivativos", "Derivativos (ativos − passivos)", 1, 22966),
    ("outros_inv", "Outros investimentos (ativos − passivos)", 1, 22969),
    ("oi_ativos", "Ativos", 2, 22970),
    ("oi_passivos", "Passivos", 2, 22971),
    ("emprestimos_passivos", "Empréstimos", 3, 22994),
    ("credito_comercial_passivos", "Créditos comerciais", 3, 23026),
    ("reservas", "Ativos de reserva", 1, 23043),
    ("erros_omissoes", "Erros e omissões", 0, 23060),
]

# PII trimestral (US$ milhões, estoque em fim de trimestre).
PII_SERIES: dict[str, int] = {
    "liquida": 24010,
    "ativos": 24011,
    "ide": 24012,
    "carteira_ativos": 24015,
    "reservas": 24039,
    "passivos": 24040,
    "idp": 24041,
    "idp_intercompanhia": 24043,
    "carteira_passivos": 24044,
    "acoes_passivos": 24045,
    "titulos_passivos": 24048,
    "titulos_domesticos": 24049,
    "titulos_externos": 24050,
    "oi_passivos": 24052,
    # componentes de curto prazo (prazo ORIGINAL) p/ Guidotti-Greenspan
    "cp_moeda_depositos": 24053,
    "cp_emprestimos_bancos": 24058,
    "cp_emprestimos_governo": 24061,
    "cp_emprestimos_demais": 24064,
    "cp_credito_comercial": 24066,
}
PII_CP_KEYS = [
    "cp_moeda_depositos",
    "cp_emprestimos_bancos",
    "cp_emprestimos_governo",
    "cp_emprestimos_demais",
    "cp_credito_comercial",
]

FLUXO_SERIES = {"total": 13961, "comercial": 13967, "financeiro": 13970}
FLUXO_INICIO = date(2009, 1, 1)

OLINDA_ANUAIS = "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais"
FOCUS_INDICADORES = {
    # chave: (Indicador, IndicadorDetalhe | None)
    "conta_corrente": ("Conta corrente", None),
    "balanca": ("Balança comercial", "Saldo"),
    "idp": ("Investimento direto no país", None),
    "cambio": ("Câmbio", None),
}
FOCUS_JANELA_DIAS = 800

IDENTIDADE_TOL = 150.0  # US$ mi — TC + KK − CF + EO
INICIO_12M = "1996-12-01"
MESES_FLUXO_MENSAL = 60

UA = {"User-Agent": "az-invest-contas-externas/0.3"}
SGS_BASE = "https://api.bcb.gov.br/dados/serie/bcdata.sgs"


# ── utilidades ────────────────────────────────────────────────────────────────
def _get_json(url: str, *, timeout: int = 90, retries: int = 3) -> Any:
    last: Exception | None = None
    for i in range(retries):
        try:
            r = requests.get(url, timeout=timeout, headers=UA)
            r.raise_for_status()
            return r.json()
        except Exception as e:  # noqa: BLE001
            last = e
            print(f"  retry {i + 1}/{retries}: {e}", file=sys.stderr)
            time.sleep(3.0)
    raise RuntimeError(f"falha após {retries} tentativas: {last}")


def _f(v: Any) -> float | None:
    if v in ("", "-", "..", "...", None):
        return None
    try:
        return float(str(v).replace(",", "."))
    except (TypeError, ValueError):
        return None


def _iso(d: str) -> str:
    dd, mm, yy = d.split("/")
    return f"{yy}-{mm.zfill(2)}-{dd.zfill(2)}"


def sgs_diaria(code: int, inicio: date) -> Serie:
    """Série diária paginada em blocos de 5 anos (teto de 10 anos da API)."""
    out: Serie = {}
    hoje = datetime.now(timezone.utc).date()
    start = inicio
    while start <= hoje:
        end = min(date(start.year + 4, 12, 31), hoje)
        url = (
            f"{SGS_BASE}.{code}/dados?formato=json"
            f"&dataInicial={start.strftime('%d/%m/%Y')}&dataFinal={end.strftime('%d/%m/%Y')}"
        )
        print(f"  [SGS {code}] {url}")
        # Falha num bloco ABORTA a série (buraco silencioso no meio distorceria o 12m);
        # o chamador preserva o bloco do Blob anterior.
        for r in _get_json(url):
            out[_iso(r["data"])] = _f(r.get("valor"))
        start = date(end.year + 1, 1, 1)
        time.sleep(0.4)
    return out


def _acum12(serie: Serie) -> Serie:
    ks = sorted(serie)
    out: Serie = {}
    for i, k in enumerate(ks):
        if i < 11:
            out[k] = None
            continue
        w = [serie.get(ks[i - j]) for j in range(12)]
        out[k] = None if any(v is None for v in w) else sum(w)  # type: ignore[arg-type]
    return out


def _r(v: float | None, nd: int = 3) -> float | None:
    return round(v, nd) if v is not None else None


def _bi(v: float | None, nd: int = 3) -> float | None:
    return round(v / 1000.0, nd) if v is not None else None


# ── blocos ────────────────────────────────────────────────────────────────────
def bloco_bp_mestre(
    sgs_serie: Callable[[int], Serie], pib_12m: Serie
) -> tuple[dict[str, Any], dict[str, Serie]]:
    mensal: dict[str, Serie] = {}
    for key, _label, _nivel, code in LINHAS:
        if code is None:
            continue
        mensal[key] = sgs_serie(code)
        time.sleep(0.4)

    # derivadas
    mensal["bens_m"] = {
        k: (x - s) if (x is not None and (s := mensal["bens"].get(k)) is not None) else None
        for k, x in mensal["bens_x"].items()
    }
    rp, ld, lr = mensal["renda_primaria"], mensal["lucros_dividendos"], mensal["lucros_reinvestidos"]
    mensal["juros_demais"] = {
        k: (v - ld[k] - lr[k]) if (v is not None and ld.get(k) is not None and lr.get(k) is not None) else None
        for k, v in rp.items()
    }

    # auditoria: TC + KK − CF + EO = 0
    ok, viol = 0, []
    for k, tc in mensal["tc"].items():
        kk, cf, eo = mensal["conta_capital"].get(k), mensal["conta_financeira"].get(k), mensal["erros_omissoes"].get(k)
        if None in (tc, kk, cf, eo):
            continue
        res = tc + kk - cf + eo  # type: ignore[operator]
        if abs(res) > IDENTIDADE_TOL:
            viol.append((k, res))
        else:
            ok += 1
    if viol:
        pior = max(viol, key=lambda t: abs(t[1]))
        print(f"[WARN] identidade BP (TC+KK−CF+EO=0) fora de US$ {IDENTIDADE_TOL:.0f} mi em {len(viol)} mês(es); pior {pior[0]}: {pior[1]:+.1f}", file=sys.stderr)
    else:
        print(f"[OK] identidade BP (TC+KK−CF+EO=0) fecha em {ok} meses")

    # auditoria: CF = ID + carteira + derivativos + OI + reservas
    viol_cf = 0
    for k, cf in mensal["conta_financeira"].items():
        parts = [mensal[p].get(k) for p in ("inv_direto", "carteira", "derivativos", "outros_inv", "reservas")]
        if cf is None or any(v is None for v in parts):
            continue
        if abs(cf - sum(parts)) > IDENTIDADE_TOL:  # type: ignore[arg-type]
            viol_cf += 1
    print(("[WARN] " if viol_cf else "[OK] ") + f"conta financeira = soma das funções ({viol_cf} violações)")

    keys = [k for k, *_ in LINHAS]
    todos_meses = sorted(mensal["tc"])
    ult_meses = [m for m in todos_meses if mensal["tc"].get(m) is not None][-MESES_FLUXO_MENSAL:]
    mensal_rows = [{"mes": m, **{k: _r(mensal[k].get(m), 1) for k in keys}} for m in ult_meses]

    acum = {k: _acum12(mensal[k]) for k in keys}
    acum_rows = []
    for m in todos_meses:
        if m < INICIO_12M or acum["tc"].get(m) is None:
            continue
        row: dict[str, Any] = {"mes": m, **{k: _bi(acum[k].get(m)) for k in keys}}
        row["pib"] = _bi(pib_12m.get(m), 1)
        acum_rows.append(row)

    bloco = {
        "linhas": [
            {"key": k, "label": lab, "nivel": niv, "sgs": code} for k, lab, niv, code in LINHAS
        ],
        "mensal": mensal_rows,  # US$ milhões
        "acum_12m": acum_rows,  # US$ bilhões + pib (US$ bi, 12m)
        "identidade": {
            "formula": "TC + conta capital − conta financeira + erros e omissões = 0",
            "tolerancia_usd_mi": IDENTIDADE_TOL,
            "meses_ok": ok,
            "violacoes": len(viol),
        },
        "_nota": (
            "Fluxos BPM6 do BCB. Conta financeira = ativos − passivos: NEGATIVO = entrada líquida de "
            "recursos. IDP e passivos de carteira/outros investimentos: positivo = entrada de não "
            "residentes. Importações = exportações (22711) − saldo (22707); juros e demais = renda "
            "primária (22800) − lucros e dividendos (22812) − reinvestidos (22815)."
        ),
    }
    return bloco, acum


def bloco_pii(sgs_serie: Callable[[int], Serie], pib_12m: Serie, reservas_mensal: Serie) -> dict[str, Any] | None:
    raw: dict[str, Serie] = {}
    for key, code in PII_SERIES.items():
        raw[key] = sgs_serie(code)
        time.sleep(0.4)
    if not any(v is not None for v in raw["liquida"].values()):
        print("[WARN] PII vazia — bloco omitido", file=sys.stderr)
        return None

    rows = []
    for k in sorted(raw["liquida"]):
        if raw["liquida"].get(k) is None:
            continue
        # SGS grava o trimestre no 1º mês (01/01 = 1T). Fim do trimestre = mês + 2.
        y, m = int(k[:4]), int(k[5:7])
        tri = (m - 1) // 3 + 1
        mes_fim = f"{y}-{3 * tri:02d}-01"
        cp_vals = [raw[c].get(k) for c in PII_CP_KEYS]
        divida_cp = sum(v for v in cp_vals if v is not None) if any(v is not None for v in cp_vals) else None
        res = raw["reservas"].get(k)
        row: dict[str, Any] = {
            "trim": f"{y}-T{tri}",
            "mes_fim": mes_fim,
            **{key: _bi(raw[key].get(k), 1) for key in PII_SERIES if not key.startswith("cp_")},
            "divida_cp": _bi(divida_cp, 1),
            "guidotti": _r(res / divida_cp, 2) if (res and divida_cp) else None,
            "pib_12m": _bi(pib_12m.get(mes_fim), 1),
        }
        rows.append(row)
    return {
        "serie": rows,
        "ultimo_trim": rows[-1]["trim"] if rows else None,
        "_nota": (
            "PII trimestral do BCB (SGS 24010–24068), estoques em US$ bi no fim do trimestre. "
            "divida_cp = passivos de CURTO PRAZO POR PRAZO ORIGINAL: moeda e depósitos (24053) + "
            "empréstimos de curto prazo de bancos (24058), governo (24061) e demais setores (24064) + "
            "créditos comerciais (24066). Guidotti-Greenspan = reservas (24039) ÷ divida_cp. É uma "
            "APROXIMAÇÃO: a regra original usa prazo RESIDUAL (inclui amortizações de longo prazo que "
            "vencem em 12 meses), que o SGS não publica — a razão aqui é um teto do indicador."
        ),
    }


def bloco_fluxo_cambial() -> dict[str, Any] | None:
    raw = {k: sgs_diaria(c, FLUXO_INICIO) for k, c in FLUXO_SERIES.items()}
    if not any(v is not None for v in raw["total"].values()):
        print("[WARN] fluxo cambial vazio — bloco omitido", file=sys.stderr)
        return None
    dias = sorted(d for d, v in raw["total"].items() if v is not None)

    mensal: dict[str, dict[str, float]] = {}
    for d in dias:
        m = d[:7] + "-01"
        acc = mensal.setdefault(m, {"total": 0.0, "comercial": 0.0, "financeiro": 0.0, "dias": 0})
        for k in FLUXO_SERIES:
            acc[k] += raw[k].get(d) or 0.0
        acc["dias"] += 1
    meses = sorted(mensal)
    mes_corrente_parcial = meses[-1] == dias[-1][:7] + "-01"

    def _roll12(key: str, i: int) -> float | None:
        if i < 11:
            return None
        return sum(mensal[meses[i - j]][key] for j in range(12))

    rows = []
    for i, m in enumerate(meses):
        rows.append({
            "mes": m,
            "total": _bi(mensal[m]["total"], 2),
            "comercial": _bi(mensal[m]["comercial"], 2),
            "financeiro": _bi(mensal[m]["financeiro"], 2),
            "dias_uteis": mensal[m]["dias"],
            "total_12m": _bi(_roll12("total", i), 2),
            "comercial_12m": _bi(_roll12("comercial", i), 2),
            "financeiro_12m": _bi(_roll12("financeiro", i), 2),
        })

    ano = dias[-1][:4]
    ytd = {k: sum(raw[k].get(d) or 0.0 for d in dias if d.startswith(ano)) for k in FLUXO_SERIES}
    diario = [
        {"data": d, **{k: _r(raw[k].get(d), 1) for k in FLUXO_SERIES}} for d in dias[-90:]
    ]
    return {
        "mensal": rows,  # US$ bi
        "diario_90d": diario,  # US$ mi
        "ultimo_dia": dias[-1],
        "mes_corrente_parcial": mes_corrente_parcial,
        "ano_corrente": {"ano": ano, **{k: _bi(v, 2) for k, v in ytd.items()}},
        "_nota": (
            "Câmbio contratado (BCB, SGS 13961 saldo total, 13967 comercial, 13970 financeiro), "
            "diário em US$ mi, agregado aqui por mês. Positivo = entrada líquida de dólares. É "
            "contratação (não liquidação) e não é o BP: exclui IDP/empréstimos que não passam pelo "
            "mercado de câmbio. O mês corrente é parcial até o último dia útil."
        ),
    }


def bloco_focus() -> dict[str, Any] | None:
    desde = (datetime.now(timezone.utc).date() - timedelta(days=FOCUS_JANELA_DIAS)).isoformat()
    ano_atual = datetime.now(timezone.utc).year
    out: dict[str, Any] = {}
    for chave, (ind, det) in FOCUS_INDICADORES.items():
        filtro = f"Indicador eq '{ind}' and Data ge '{desde}' and baseCalculo eq 0"
        if det:
            filtro += f" and IndicadorDetalhe eq '{det}'"
        url = (
            f"{OLINDA_ANUAIS}?$top=10000&$format=json&$select=Data,DataReferencia,Mediana,DesvioPadrao,numeroRespondentes"
            f"&$filter={requests.utils.quote(filtro)}"
        )
        print(f"  [Focus] {ind}{' / ' + det if det else ''}")
        try:
            vals = _get_json(url).get("value", [])
        except Exception as e:  # noqa: BLE001
            print(f"  [Focus] FAIL {ind}: {e}", file=sys.stderr)
            continue
        por_ano: dict[str, dict[str, dict[str, Any]]] = {}
        for v in vals:
            ref = str(v.get("DataReferencia"))
            if not ref.isdigit() or not (ano_atual - 1 <= int(ref) <= ano_atual + 1):
                continue
            d = v["Data"][:10]
            # uma observação por semana ISO (a última da semana)
            wk = date.fromisoformat(d).isocalendar()
            sem = f"{wk[0]}-{wk[1]:02d}"
            atual = por_ano.setdefault(ref, {}).get(sem)
            if atual is None or d > atual["data"]:
                por_ano[ref][sem] = {
                    "data": d,
                    "mediana": _r(_f(v.get("Mediana")), 2),
                    "dp": _r(_f(v.get("DesvioPadrao")), 2),
                    "n": v.get("numeroRespondentes"),
                }
        out[chave] = {
            ref: sorted(sem.values(), key=lambda r: r["data"]) for ref, sem in sorted(por_ano.items())
        }
        time.sleep(0.4)
    if not out:
        return None
    coletas = [c["data"] for ind in out.values() for serie in ind.values() for c in serie]
    out["ultima_coleta"] = max(coletas) if coletas else None
    out["_nota"] = (
        "Focus/BCB (Olinda ExpectativasMercadoAnuais, baseCalculo 0): mediana por data de coleta, "
        "última coleta de cada semana. Conta corrente, balança (saldo) e IDP em US$ bi no ano-calendário; "
        "câmbio em R$/US$ de fim de ano."
    )
    return out


def bloco_revisoes(acum_tc: Serie, prev: dict[str, Any] | None) -> dict[str, Any]:
    """Compara o acumulado 12m da TC com o Blob anterior (log de diff)."""
    antes = {}
    prev_bp = (prev or {}).get("bp_mestre") or {}
    for r in prev_bp.get("acum_12m") or []:
        if r.get("tc") is not None:
            antes[r["mes"]] = r["tc"]
    diffs = []
    for m, v in acum_tc.items():
        if v is None or m not in antes:
            continue
        d = round(v / 1000.0 - antes[m], 3)
        if abs(d) >= 0.05:
            diffs.append({"mes": m, "antes": antes[m], "depois": round(v / 1000.0, 3), "diff": d})
    anterior = (prev or {}).get("revisoes") or {}
    if diffs:
        return {
            "revised_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "n_meses": len(diffs),
            "max_abs_diff_usd_bi": max(abs(x["diff"]) for x in diffs),
            "amostra": sorted(diffs, key=lambda x: -abs(x["diff"]))[:12],
            "_nota": "TC acumulada 12m (US$ bi): meses cujo valor mudou ≥ US$ 0,05 bi vs o giro anterior.",
        }
    return anterior or {"revised_at": None, "n_meses": 0, "_nota": "Sem revisão detectada desde que o log existe."}


def build_v3(
    sgs_serie: Callable[[int], Serie],
    pib_12m: Serie,
    reservas_mensal: Serie,
    prev: dict[str, Any] | None,
) -> dict[str, Any]:
    print("== v3: tabela mestra do BP ==")
    bp, acum = bloco_bp_mestre(sgs_serie, pib_12m)
    out: dict[str, Any] = {"bp_mestre": bp, "revisoes": bloco_revisoes(acum["tc"], prev)}

    def _preserva(nome: str, novo: Any) -> None:
        if novo is None and prev and prev.get(nome):
            print(f"  [preserva] {nome} sem dado novo — mantido do Blob anterior")
            out[nome] = prev[nome]
        elif novo is not None:
            out[nome] = novo

    print("== v3: PII trimestral ==")
    try:
        _preserva("pii", bloco_pii(sgs_serie, pib_12m, reservas_mensal))
    except Exception as e:  # noqa: BLE001
        print(f"[WARN] PII: {e}", file=sys.stderr)
        _preserva("pii", None)
    print("== v3: fluxo cambial ==")
    try:
        _preserva("fluxo_cambial", bloco_fluxo_cambial())
    except Exception as e:  # noqa: BLE001
        print(f"[WARN] fluxo cambial: {e}", file=sys.stderr)
        _preserva("fluxo_cambial", None)
    print("== v3: Focus ==")
    try:
        _preserva("focus", bloco_focus())
    except Exception as e:  # noqa: BLE001
        print(f"[WARN] Focus: {e}", file=sys.stderr)
        _preserva("focus", None)
    return out
