"""Build TPF (Titulos Publicos Federais) history JSON via ANBIMA.

Fonte: https://www.anbima.com.br/informacoes/merc-sec/arqs/ms{YYMMDD}.txt
Formato: arroba-separado, encoding latin1.

Colunas:
  Titulo @ Data Referencia @ Codigo SELIC @ Data Base/Emissao @ Data Vencimento @
  Tx. Compra @ Tx. Venda @ Tx. Indicativas @ PU @ Desvio padrao @
  Interv. Ind. Inf. (D0) @ Interv. Ind. Sup. (D0) @
  Interv. Ind. Inf. (D+1) @ Interv. Ind. Sup. (D+1) @ Criterio

Janela da fonte: ate 21/09/2026 a ANBIMA servia 130+ dias uteis de arquivos; desde
22/09/2026 serve so a partir de 11/09/2026 (17 dias uteis em 06/10) e dia mais
antigo da 404. O historico (backfill Tesouro Transparente desde 2004 + ANBIMA
acumulada) so existe no Blob: o merge incremental e obrigatorio e a trava de
defasagem (main) reprova o run quando a curva para de andar.

Saidas:
  - data/treasury_history.json  : series temporais por (tipo, vencimento)

Estrutura JSON:
{
  "status": "ok",
  "generated_at": "...",
  "lookback_business_days": 130,
  "last_data_date": "YYYY-MM-DD",   # ultima data PRESENTE nas series (a menor entre PRE e IPCA)
  "freshness_status": "fresh",      # "stale" se PRE ou IPCA esta mais de 2 dias uteis atras de D-1
  "categories": {
    "PRE": {
      "label": "Prefixado",
      "last_data_date": "YYYY-MM-DD",   # ultima data presente nas series da categoria
      "vencimentos": ["2026-07-01", "2027-01-01", ...],
      "series": {
        "2026-07-01": [["2025-12-02", 11.20], ["2025-12-03", 11.18], ...],
        ...
      }
    },
    "IPCA": {
      "label": "IPCA+",
      "vencimentos": [...],
      "series": {...}
    }
  }
}

Estrategia "Pre": combina LTN (zero coupon) + NTN-F (cupom semestral). Quando ha
ambos no mesmo vencimento, prioriza NTN-F (mais liquido). Geralmente vencimentos
nao coincidem (LTN em xx-04 ou xx-10, NTN-F em xx-01).
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests

sys.path.append(str(Path(__file__).parent))
from shared.blob_upload import maybe_upload_json  # noqa: E402
from shared.blob_download import download_json as blob_download_json  # noqa: E402


ANBIMA_TPF_URL = "https://www.anbima.com.br/informacoes/merc-sec/arqs/ms{yymmdd}.txt"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/plain,text/html,*/*;q=0.5",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
}

# Trava de defasagem (main): com a ANBIMA guardando so as ultimas semanas, dia que
# nao entra no Blob a tempo se perde. Se PRE ou IPCA ficar mais de N dias uteis
# atras de D-1, o builder sai com erro (depois do upload) e o workflow reprova a run.
MAX_DIAS_UTEIS_SEM_DADO = 2
BRT = timezone(timedelta(hours=-3), "BRT")  # sem horario de verao desde 2019


def _pascoa(ano: int) -> date:
    """Domingo de Pascoa no calendario gregoriano (algoritmo de Meeus/Jones/Butcher)."""
    a = ano % 19
    b, c = divmod(ano, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    ell = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * ell) // 451
    mes, dia = divmod(h + ell - 7 * m + 114, 31)
    return date(ano, mes, dia + 1)


@lru_cache(maxsize=None)
def feriados_nacionais(ano: int) -> frozenset:
    """Dias sem arquivo da ANBIMA: feriados nacionais fixos + Carnaval (seg e ter),
    Sexta-feira Santa e Corpus Christi. Calculado, para nao vencer na virada do ano
    como a lista fixa que existia aqui (ia so ate 2026)."""
    fixos = [(1, 1), (4, 21), (5, 1), (9, 7), (10, 12), (11, 2), (11, 15), (12, 25)]
    if ano >= 2024:
        fixos.append((11, 20))  # Consciencia Negra, nacional desde a Lei 14.759/2023
    pascoa = _pascoa(ano)
    moveis = [pascoa + timedelta(days=n) for n in (-48, -47, -2, 60)]
    return frozenset([date(ano, m, d) for m, d in fixos] + moveis)


def is_business_day(d: date) -> bool:
    return d.weekday() < 5 and d not in feriados_nacionais(d.year)


def previous_business_days(n: int, start: Optional[date] = None) -> List[date]:
    """Retorna N dias uteis anteriores (sem hoje), em ordem cronologica."""
    d = start or date.today()
    out: List[date] = []
    while len(out) < n:
        d = d - timedelta(days=1)
        if is_business_day(d):
            out.append(d)
    return list(reversed(out))


def parse_decimal_br(s: str) -> Optional[float]:
    """Converte string BR (virgula decimal) em float. Retorna None se invalido."""
    if not s or s in ("--", "N/D", ""):
        return None
    s = s.strip().replace(".", "").replace(",", ".")
    try:
        v = float(s)
        return v
    except ValueError:
        return None


def parse_date_yyyymmdd(s: str) -> Optional[str]:
    """Converte 'YYYYMMDD' em 'YYYY-MM-DD'. Retorna None se invalido."""
    s = (s or "").strip()
    if len(s) != 8 or not s.isdigit():
        return None
    return f"{s[:4]}-{s[4:6]}-{s[6:8]}"


def fetch_tpf_day(d: date, session: requests.Session, timeout: int = 15) -> Optional[str]:
    """Baixa o conteudo bruto do ms{YYMMDD}.txt para 1 dia. None se nao existir."""
    yymmdd = d.strftime("%y%m%d")
    url = ANBIMA_TPF_URL.format(yymmdd=yymmdd)
    try:
        r = session.get(url, headers=HEADERS, timeout=timeout)
        if r.status_code == 200 and len(r.content) > 1024:
            return r.content.decode("latin1", errors="replace")
        return None
    except Exception as e:
        print(f"[tpf] WARN {d}: {e}", file=sys.stderr)
        return None


def parse_tpf_content(content: str) -> List[Dict]:
    """Parseia conteudo do ms{}.txt. Retorna lista de dicts.

    Cada dict: { tipo, data_ref, vencimento, taxa_indicativa, pu }
    """
    rows: List[Dict] = []
    lines = content.splitlines()
    # Pula header (linhas 1-3) ate achar a primeira linha de dado
    body_start = 0
    for i, ln in enumerate(lines):
        if "@" in ln and ln.split("@")[0].strip() in ("LTN", "NTN-F", "NTN-B", "NTN-C", "LFT"):
            body_start = i
            break
    if body_start == 0:
        # Pode nao ter achado; tenta a partir da linha 3
        body_start = 3

    for ln in lines[body_start:]:
        if not ln.strip() or "@" not in ln:
            continue
        parts = ln.split("@")
        if len(parts) < 9:
            continue
        tipo = parts[0].strip()
        if tipo not in ("LTN", "NTN-F", "NTN-B", "NTN-C", "LFT"):
            continue
        data_ref = parse_date_yyyymmdd(parts[1])
        vencimento = parse_date_yyyymmdd(parts[4])
        taxa_ind = parse_decimal_br(parts[7])
        pu = parse_decimal_br(parts[8])
        if not data_ref or not vencimento or taxa_ind is None:
            continue
        rows.append({
            "tipo": tipo,
            "data_ref": data_ref,
            "vencimento": vencimento,
            "taxa_indicativa": round(taxa_ind, 4),
            "pu": round(pu, 6) if pu is not None else None,
        })
    return rows


def categorize_pre_or_ipca(tipo: str) -> Optional[str]:
    """LTN+NTN-F -> 'PRE'; NTN-B -> 'IPCA'; resto -> None (LFT, NTN-C ignorados)."""
    if tipo in ("LTN", "NTN-F"):
        return "PRE"
    if tipo == "NTN-B":
        return "IPCA"
    return None


def aggregate_by_category_and_vencimento(rows: List[Dict]) -> Dict[str, Dict[str, List[Tuple[str, float]]]]:
    """Agrupa: {category: {vencimento: [(data_ref, taxa), ...]}}.

    Em caso de empate (LTN e NTN-F com mesmo vencimento na mesma data),
    prioriza NTN-F (cupom, mais liquido).
    """
    out: Dict[str, Dict[str, List[Tuple[str, float, str]]]] = {"PRE": {}, "IPCA": {}}
    for r in rows:
        cat = categorize_pre_or_ipca(r["tipo"])
        if not cat:
            continue
        venc = r["vencimento"]
        out[cat].setdefault(venc, []).append((r["data_ref"], r["taxa_indicativa"], r["tipo"]))

    # Resolve duplicatas (mesma data_ref + vencimento, com tipos diferentes) priorizando NTN-F
    final: Dict[str, Dict[str, List[Tuple[str, float]]]] = {"PRE": {}, "IPCA": {}}
    for cat, venc_map in out.items():
        for venc, entries in venc_map.items():
            by_date: Dict[str, Tuple[float, str]] = {}
            for data_ref, taxa, tipo in entries:
                if data_ref not in by_date:
                    by_date[data_ref] = (taxa, tipo)
                else:
                    prev_taxa, prev_tipo = by_date[data_ref]
                    if tipo == "NTN-F" and prev_tipo == "LTN":
                        by_date[data_ref] = (taxa, tipo)
            series = sorted([(d, v) for d, (v, _) in by_date.items()])
            final[cat][venc] = series
    return final


def stamp_last_dates(payload: Dict) -> Dict[str, str]:
    """Carimba em cada categoria a maior data PRESENTE nas suas series e, no topo, a
    menor delas (data ate a qual PRE e IPCA estao completos). Devolve {categoria: data}.

    Ate 06/10/2026 o carimbo do topo vinha das linhas baixadas, antes do filtro de
    vencimentos e do merge: o JSON dizia 05/10 com as series paradas em 21/09.
    """
    lasts: Dict[str, str] = {}
    for cat, c in (payload.get("categories") or {}).items():
        last = max((p[0] for s in (c.get("series") or {}).values() for p in s), default="")
        c["last_data_date"] = last
        lasts[cat] = last
    present = [d for d in lasts.values() if d]
    payload["last_data_date"] = min(present) if present else ""
    return lasts


def count_obs(payload: Dict) -> int:
    return sum(len(s) for c in (payload.get("categories") or {}).values()
               for s in (c.get("series") or {}).values())


def combine_sources(new_source: str, old_source: str) -> str:
    """Fonte do JSON mesclado: a deste run + as de backfill do JSON antigo, sem repetir.
    A regra antiga prefixava a fonte nova a cada run e a string chegou a 200+ copias
    de 'ANBIMA — Mercado Secundario TPF'."""
    parts = [new_source] if new_source else []
    for p in old_source.split(" + "):
        p = p.strip()
        if p and not p.startswith("ANBIMA") and p not in parts:
            parts.append(p)
    return " + ".join(parts)


def merge_with_existing(new_payload: Dict, existing: Optional[Dict]) -> Dict:
    """Merge incremental: combina series do payload novo com o JSON ja existente
    (lido do Blob). Garante que o backfill historico (Tesouro Transparente) e
    dias antigos da ANBIMA acumulados anteriormente NAO sejam perdidos.

    Regra: por (categoria, vencimento), uniao por data_ref. Em caso de mesma
    data em ambos, prevalece o NOVO (mais autoritativo da ANBIMA do dia).
    """
    if not existing or not isinstance(existing, dict):
        return new_payload

    existing_cats = (existing.get("categories") or {})
    merged_cats: Dict[str, Dict] = {}

    all_cat_keys = set(new_payload.get("categories", {}).keys()) | set(existing_cats.keys())
    for cat in all_cat_keys:
        new_cat = (new_payload.get("categories") or {}).get(cat, {})
        old_cat = existing_cats.get(cat, {})

        new_series: Dict[str, List[List]] = new_cat.get("series", {})
        old_series: Dict[str, List[List]] = old_cat.get("series", {})

        merged_series: Dict[str, List[List]] = {}
        all_vencs = set(new_series.keys()) | set(old_series.keys())
        for venc in all_vencs:
            by_date: Dict[str, float] = {}
            # 1. Velho primeiro (passa a base)
            for entry in old_series.get(venc, []):
                if isinstance(entry, list) and len(entry) >= 2:
                    by_date[entry[0]] = entry[1]
            # 2. Novo sobrescreve datas que coincidem
            for entry in new_series.get(venc, []):
                if isinstance(entry, list) and len(entry) >= 2:
                    by_date[entry[0]] = entry[1]
            if not by_date:
                continue
            merged_series[venc] = [[d, v] for d, v in sorted(by_date.items())]

        vencimentos_sorted = sorted(merged_series.keys())
        merged_cats[cat] = {
            "label": new_cat.get("label") or old_cat.get("label") or cat,
            "vencimentos": vencimentos_sorted,
            "series": merged_series,
        }

    # Preserva metadados uteis do payload novo, indica que houve merge
    out = dict(new_payload)
    out["categories"] = merged_cats
    out["source"] = combine_sources(new_payload.get("source") or "", existing.get("source") or "")
    # Carimbo sai das series mescladas, nunca do max entre os carimbos de entrada
    stamp_last_dates(out)
    return out


def build_tpf_history(business_days: int = 130, sleep_s: float = 0.1) -> Dict:
    days = previous_business_days(business_days)
    print(f"[tpf] baixando {len(days)} dias uteis de {days[0]} a {days[-1]}")
    session = requests.Session()
    all_rows: List[Dict] = []
    loaded: List[date] = []
    fail_count = 0

    for i, d in enumerate(days):
        content = fetch_tpf_day(d, session)
        rows = parse_tpf_content(content) if content else []
        if rows:
            all_rows.extend(rows)
            loaded.append(d)
            if i % 20 == 0:
                print(f"  [tpf] {i+1}/{len(days)} ({d}): {len(rows)} linhas")
        else:
            fail_count += 1
        time.sleep(sleep_s)

    ok_count = len(loaded)
    print(f"[tpf] OK {ok_count} dias, FAIL {fail_count} dias, {len(all_rows)} linhas totais")
    if loaded:
        print(f"[tpf] janela servida pela ANBIMA: {loaded[0]} a {loaded[-1]}")
    grouped = aggregate_by_category_and_vencimento(all_rows)

    # Sem filtro de minimo de observacoes por vencimento. O filtro antigo (30% de
    # --business-days = 39 pontos NA JANELA BAIXADA) tirava papel curto ja vencido,
    # mas quando a ANBIMA passou a servir so ~17 dias (22/09/2026) descartou TODOS os
    # vencimentos: o merge recebia payload vazio e a curva congelou em 21/09. Com o
    # merge incremental todo dia novo conta, inclusive de papel recem-emitido.
    categories_out = {}
    for cat, venc_map in grouped.items():
        vencimentos_sorted = sorted(venc_map.keys())
        # Converte tuples para arrays no JSON
        series = {v: [[d, t] for d, t in venc_map[v]] for v in vencimentos_sorted}
        categories_out[cat] = {
            "label": "Prefixado" if cat == "PRE" else "IPCA+",
            "vencimentos": vencimentos_sorted,
            "series": series,
        }

    payload = {
        "status": "ok" if ok_count > 0 else "error",
        "generated_at": datetime.now(tz=timezone.utc).isoformat(),
        "source": "ANBIMA — Mercado Secundario TPF",
        "lookback_business_days": business_days,
        "days_loaded": ok_count,
        "days_failed": fail_count,
        "last_data_date": "",
        "categories": categories_out,
    }
    stamp_last_dates(payload)
    return payload


def read_existing(tries: int = 3) -> Optional[Dict]:
    """JSON atual do Blob, com retentativa. None = nao deu para ler."""
    for attempt in range(1, tries + 1):
        data = blob_download_json("data/treasury_history.json")
        if isinstance(data, dict) and data.get("categories"):
            return data
        if attempt < tries:
            time.sleep(5 * attempt)
    return None


def business_days_after(start_iso: str, end: date) -> int:
    """Quantidade de dias uteis em (start, end]."""
    d = date.fromisoformat(start_iso)
    n = 0
    while d < end:
        d += timedelta(days=1)
        if is_business_day(d):
            n += 1
    return n


def check_staleness(lasts: Dict[str, str], today: date) -> List[str]:
    """Compara a ultima data de PRE e IPCA com D-1 (dia util anterior a hoje).
    Devolve os problemas encontrados (lista vazia = ok).

    A referencia e D-1, nao hoje: a ANBIMA publica o arquivo do dia a noite
    (~19-21h BRT) e o run das 19h30 pode chegar antes dele.
    """
    ref = previous_business_days(1, start=today)[0]
    problems: List[str] = []
    for cat in ("PRE", "IPCA"):
        last = lasts.get(cat) or ""
        if not last:
            problems.append(f"{cat} sem nenhuma observacao")
            continue
        lag = business_days_after(last, ref)
        print(f"[tpf]   trava {cat}: ultima data {last}, referencia D-1 {ref}, "
              f"{lag} dia(s) util(eis) sem dado")
        if lag > MAX_DIAS_UTEIS_SEM_DADO:
            problems.append(f"{cat} parada em {last} ({lag} dias uteis sem dado ate {ref})")
        elif lag > 0:
            print(f"::warning::curva TPF {cat} com {lag} dia(s) util(eis) de atraso (ultima {last})")
    return problems


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--business-days", type=int, default=130, help="Dias uteis para baixar (~6 meses)")
    ap.add_argument("--sleep", type=float, default=0.1)
    ap.add_argument("--out-dir", default="data-pipeline/out")
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--no-merge", action="store_true",
                    help="Desliga merge incremental com Blob (rebuild from scratch). APAGA o historico "
                         "do Blob: a ANBIMA so serve as ultimas semanas")
    args = ap.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "treasury_history.json"

    payload = build_tpf_history(business_days=args.business_days, sleep_s=args.sleep)
    days_loaded = payload["days_loaded"]

    # Merge incremental: carrega o JSON ja existente no Blob e mescla as series.
    # Sem isso, o cron diario sobrescreveria o backfill historico (Tesouro Transparente)
    # e perderia dias antigos da ANBIMA que ja foram acumulados.
    if args.no_merge:
        if days_loaded == 0:
            print("::error::treasury_history: nenhum arquivo da ANBIMA baixado (--no-merge)")
            return 2
    else:
        print("[tpf] merge incremental: lendo data/treasury_history.json existente do Blob...")
        existing = read_existing()
        if existing is None:
            # Seguir sem o existente trocaria o historico inteiro pelas poucas semanas
            # que a ANBIMA ainda serve — perda silenciosa e irreversivel.
            print("::error::treasury_history: nao deu para ler o JSON atual do Blob. Abortado sem "
                  "upload para nao trocar o historico (Tesouro desde 2004 + ANBIMA acumulada) pelas "
                  "poucas semanas que a ANBIMA ainda serve. Rebuild proposital: --no-merge.")
            return 3
        old_obs = count_obs(existing)
        print(f"[tpf]   existing: {old_obs} observacoes, last_data={existing.get('last_data_date')}")
        payload = merge_with_existing(payload, existing)
        new_obs = count_obs(payload)
        print(f"[tpf]   apos merge: {new_obs} observacoes (delta {new_obs - old_obs})")
        if new_obs < old_obs:
            print(f"::error::treasury_history: o merge perdeu {old_obs - new_obs} observacoes. "
                  "Abortado sem upload.")
            return 4

    # Trava de defasagem: falhar e melhor que servir curva congelada com carimbo fresco.
    # freshness_status vai no JSON porque a Saude dos Dados, sem ele, so olha generated_at.
    lasts = {cat: c.get("last_data_date", "") for cat, c in payload["categories"].items()}
    today = datetime.now(BRT).date()
    problems = check_staleness(lasts, today)
    payload["freshness_status"] = "stale" if problems else "fresh"

    out_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    size_kb = out_path.stat().st_size / 1024
    n_pre = len(payload["categories"].get("PRE", {}).get("vencimentos", []))
    n_ipca = len(payload["categories"].get("IPCA", {}).get("vencimentos", []))
    print(f"[tpf] Gerado {out_path} ({size_kb:.1f} KB)")
    print(f"[tpf] PRE: {n_pre} vencimentos | IPCA: {n_ipca} vencimentos")
    print(f"[tpf] Ultima data nas series: PRE {lasts.get('PRE') or '-'} | IPCA {lasts.get('IPCA') or '-'}"
          f" -> last_data_date {payload['last_data_date']} ({payload['freshness_status']})")

    # Upload antes de reprovar: nao segura os dias que ainda entraram.
    if args.upload:
        if days_loaded > 0:
            maybe_upload_json(out_path, "data/treasury_history.json")
        else:
            print("::warning::treasury_history: nenhum arquivo da ANBIMA baixado neste run, "
                  "nada novo para publicar (upload pulado)")

    if not problems:
        return 0
    if not is_business_day(today):
        print(f"[tpf] curva atrasada, mas {today} nao e dia util: run nao reprovado")
        return 0
    for p in problems:
        print(f"::error::curva TPF congelada: {p}. A ANBIMA so guarda as ultimas semanas e dia "
              "nao recuperado a tempo se perde (docs/DADOS-E-SERIES.md §2).")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
