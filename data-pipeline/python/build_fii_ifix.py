"""Build do JSON do hero IFIX + benchmarks pro painel de Fundos Imobiliários.

Output: data/fii_ifix.json (consumido por src/lib/painel-fii.ts -> FiiIfixData).

Estratégia:
  - Histórico do IFIX: série OFICIAL diária da B3 (indexStatisticsProxy/GetPortfolioDay, um pedido por
    ano). Durante o pregão, o ponto de hoje é o spot do yfinance `IFIX.SA`. Reserva, se a B3 falhar:
    XFIX11.SA reescalado pelo spot (o ETF descola do índice em até ±4%; corr. diária 0,66).
  - Benchmarks ~5 anos:
      CDI: BCB SGS 12 (taxa diária, transformada em índice cumulativo base 100).
      IBOV: ^BVSP via yfinance.
      IMA-B e IMA-B5+: número-índice OFICIAL da ANBIMA (download público do quadro-resumo do IMA, um
        dia por pedido). O histórico fica no Blob (data/anbima_ima_historico.json) e cada rodada só pede
        os dias que faltam; sem histórico, a rodada baixa a janela toda. Até out/2026 vinham dos ETFs
        IMAB11/B5P211 no yfinance, que ficaram sem cotação de mar/2022 a jan/2026 (o ffill repetia o
        último valor por 914 pregões).
  - Hero (último dia disponível): last_value, change_pct_1d, max_12m, min_12m.
  - Série diária unificada por data (full outer), com IFIX em pontos e benchmarks
    em base 100 (data inicial da janela visualizada renormaliza no frontend).

Uso típico:
    python data-pipeline/python/build_fii_ifix.py --out-dir data-pipeline/out --upload
"""
from __future__ import annotations

import argparse
import base64
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import pandas as pd
import requests
import yfinance as yf

sys.path.append(str(Path(__file__).parent))
from shared.blob_download import public_blob_base  # noqa: E402
from shared.blob_upload import maybe_upload_json  # noqa: E402


LOOKBACK_YEARS = 5
B3_INDICE_URL = "https://sistemaswebb3-listados.b3.com.br/indexStatisticsProxy/IndexCall/GetPortfolioDay/{p}"
ANBIMA_IMA_URL = "https://www.anbima.com.br/informacoes/ima/ima-sh-down.asp"
IMA_HIST_BLOB = "data/anbima_ima_historico.json"
IMA_INDICES = {"IMA-B": "IMAB", "IMA-B 5+": "IMAB5P"}   # nome na ANBIMA -> coluna do JSON
IMA_POR_RODADA = 40          # dias pedidos à ANBIMA numa rodada normal (sem histórico: todos)
BRT = timezone(timedelta(hours=-3))
SGS_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{cod}/dados?formato=json&dataInicial={data_inicial}"
# BCB SGS retorna 406 com Accept específico — usar Accept: */* ou nada.
UA = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "*/*",
}


# ---------------------------------------------------------------------------
# Fetchers
# ---------------------------------------------------------------------------

def _yf_close(ticker: str, period: str = f"{LOOKBACK_YEARS}y") -> pd.Series:
    """Baixa série diária de Close ajustado via yfinance. Retorna Series vazia se falhar."""
    try:
        h = yf.Ticker(ticker).history(period=period, auto_adjust=True)
        if h is None or h.empty or "Close" not in h.columns:
            return pd.Series(dtype="float64", name=ticker)
        s = pd.to_numeric(h["Close"], errors="coerce").dropna()
        # Normaliza index pra date naive YYYY-MM-DD
        s.index = pd.to_datetime(s.index).tz_localize(None).normalize()
        s.name = ticker
        return s
    except Exception as e:
        print(f"[yf] FAIL {ticker}: {e}", file=sys.stderr)
        return pd.Series(dtype="float64", name=ticker)


def _yf_spot(ticker: str) -> Tuple[Optional[float], Optional[pd.Timestamp]]:
    """Spot atual (e a data do pregão dele) via yfinance.history period=5d."""
    try:
        h = yf.Ticker(ticker).history(period="5d")
        if h is None or h.empty:
            return None, None
        v = pd.to_numeric(h["Close"], errors="coerce").dropna()
        if v.empty:
            return None, None
        return float(v.iloc[-1]), pd.Timestamp(v.index[-1]).tz_localize(None).normalize()
    except Exception as e:
        print(f"[yf spot] FAIL {ticker}: {e}", file=sys.stderr)
        return None, None


def _sgs_series(code: int, years_back: int = LOOKBACK_YEARS + 1) -> pd.Series:
    """Baixa série SGS BCB (formato {data,valor}).

    BCB rejeita HTTP 406 quando a janela pedida é muito grande (~25 anos);
    `years_back` limita pra ~6 anos (LOOKBACK_YEARS + 1) por padrão.
    """
    from datetime import date
    di = f"01/01/{date.today().year - years_back}"
    url = SGS_URL.format(cod=code, data_inicial=di)
    try:
        r = requests.get(url, timeout=60, headers=UA)
        r.raise_for_status()
        data = r.json()
        if not data:
            return pd.Series(dtype="float64", name=f"sgs_{code}")
        df = pd.DataFrame(data)
        df["data"] = pd.to_datetime(df["data"], format="%d/%m/%Y", errors="coerce")
        df["valor"] = pd.to_numeric(df["valor"], errors="coerce")
        df = df.dropna(subset=["data", "valor"])
        s = df.set_index("data")["valor"]
        s.index = s.index.normalize()
        s.name = f"sgs_{code}"
        return s
    except Exception as e:
        print(f"[sgs] FAIL {code}: {e}", file=sys.stderr)
        return pd.Series(dtype="float64", name=f"sgs_{code}")


def _b3_ifix_diario(anos: List[int]) -> pd.Series:
    """IFIX oficial de fechamento, dia a dia, do serviço de estatísticas de índices da B3."""
    out: Dict[pd.Timestamp, float] = {}
    for a in anos:
        p = base64.b64encode(json.dumps({"index": "IFIX", "language": "pt-br", "year": str(a)}).encode()).decode()
        try:
            j = requests.get(B3_INDICE_URL.format(p=p), headers=UA, timeout=60).json()
        except Exception as e:  # noqa: BLE001
            print(f"[b3] FAIL IFIX {a}: {repr(e)[:100]}", file=sys.stderr)
            continue
        for row in j.get("results", []):
            for m in range(1, 13):
                v = row.get(f"rateValue{m}")
                if not v:
                    continue
                try:
                    out[pd.Timestamp(a, m, int(row["day"]))] = float(str(v).replace(".", "").replace(",", "."))
                except (ValueError, TypeError):
                    pass
    return pd.Series(out, dtype="float64").sort_index()


def _anbima_ima_dia(d: pd.Timestamp) -> Tuple[pd.Timestamp, Optional[Dict[str, float]]]:
    """Números-índice do IMA-B e do IMA-B5+ num dia. {} = a ANBIMA respondeu sem dado (feriado ou ainda
    não publicado); None = falhou (tenta de novo na próxima rodada)."""
    dd = d.strftime("%d/%m/%Y")
    form = {"Tipo": "", "DataRef": "", "Pai": "ima", "escolha": "2", "Idioma": "PT", "saida": "csv",
            "Dt_Ref_Ver": d.strftime("%Y%m%d"), "Dt_Ref": dd, "DataIni": dd, "DataFim": dd,
            "Indice": "quadro-resumo", "Consulta": "Ambos"}
    for tentativa in range(3):
        try:
            r = requests.post(ANBIMA_IMA_URL, data=form, headers=UA, timeout=40)
            r.raise_for_status()
            out: Dict[str, float] = {}
            for ln in r.content.decode("latin1").splitlines():
                c = ln.split(";")
                if len(c) > 3 and c[0] in IMA_INDICES and c[1] == dd:
                    out[IMA_INDICES[c[0]]] = float(c[2].replace(".", "").replace(",", "."))
            return d, out
        except Exception as e:  # noqa: BLE001
            if tentativa == 2:
                print(f"[anbima] FAIL {dd}: {repr(e)[:100]}", file=sys.stderr)
    return d, None


def _ima_historico(dias: List[pd.Timestamp]) -> Tuple[pd.DataFrame, Optional[Dict], int]:
    """Histórico do IMA-B/IMA-B5+ no Blob + os dias que faltam. Devolve (série, payload p/ regravar ou None
    se nada foi pedido, dias sem dado)."""
    base = public_blob_base() or "https://8ytqvgmik75vk1it.public.blob.vercel-storage.com"
    hist: Dict = {}
    try:
        r = requests.get(f"{base}/{IMA_HIST_BLOB}", params={"t": int(datetime.now().timestamp())}, timeout=30)
        if r.status_code == 200:
            hist = r.json()
    except Exception as e:  # noqa: BLE001
        print(f"[anbima] histórico do Blob ilegível: {e}", file=sys.stderr)
    serie: Dict[str, Dict[str, float]] = dict(hist.get("serie", {}))
    sem_dado = set(hist.get("sem_dado", []))
    agora = datetime.now(BRT)
    hoje = pd.Timestamp(agora.date())
    faltam = [d for d in sorted(dias, reverse=True)
              if d.strftime("%Y-%m-%d") not in serie and d.strftime("%Y-%m-%d") not in sem_dado
              and (d < hoje or agora.hour >= 20)]                       # o IMA do dia sai à noite
    limite = len(faltam) if not serie else IMA_POR_RODADA
    pedir = faltam[:limite]
    if pedir:
        print(f"[anbima] pedindo {len(pedir)} dia(s) (faltavam {len(faltam)}; histórico com {len(serie)})")
        with ThreadPoolExecutor(max_workers=6) as ex:
            res = list(ex.map(_anbima_ima_dia, pedir))
        novos = 0
        for d, v in res:
            k = d.strftime("%Y-%m-%d")
            if v:
                serie[k] = v
                novos += 1
            elif v == {} and d < hoje - pd.Timedelta(days=4):              # feriado da ANBIMA: não pede de novo
                sem_dado.add(k)
        print(f"[anbima] +{novos} dia(s); sem dado: {len(sem_dado)}")
    payload = None
    if pedir:
        payload = {"schema_version": 1, "generated_at": datetime.now(timezone.utc).isoformat(),
                   "fonte": "ANBIMA — IMA, quadro-resumo (número-índice de fechamento)",
                   "last_data_date": max(serie) if serie else None,
                   "serie": dict(sorted(serie.items())), "sem_dado": sorted(sem_dado)}
    df = pd.DataFrame.from_dict(serie, orient="index") if serie else pd.DataFrame(columns=list(IMA_INDICES.values()))
    df.index = pd.to_datetime(df.index)
    return df.sort_index(), payload, len(sem_dado)


# ---------------------------------------------------------------------------
# Transforms
# ---------------------------------------------------------------------------

def _cdi_cumulative_index(cdi_daily_pct: pd.Series, start_date: pd.Timestamp) -> pd.Series:
    """CDI diário em % (SGS 12) -> índice cumulativo base 100 a partir de `start_date`.

    A taxa SGS 12 já é diária expressa em % (ex.: 0,0470 por dia).
    Acumulação: prod(1 + r_d / 100).
    """
    if cdi_daily_pct is None or cdi_daily_pct.empty:
        return pd.Series(dtype="float64", name="cdi_index_100")
    if not isinstance(cdi_daily_pct.index, pd.DatetimeIndex):
        # Defesa: se index não for DatetimeIndex (série vazia), pula
        return pd.Series(dtype="float64", name="cdi_index_100")
    s = cdi_daily_pct.loc[cdi_daily_pct.index >= start_date].copy()
    if s.empty:
        return pd.Series(dtype="float64", name="cdi_index_100")
    factor = (1.0 + s / 100.0).cumprod() * 100.0 / (1.0 + s.iloc[0] / 100.0)
    factor.name = "cdi_index_100"
    return factor


def _to_base_100(series: pd.Series) -> pd.Series:
    """Reescala uma série pra base 100 no primeiro ponto."""
    s = series.dropna()
    if s.empty:
        return s
    base = s.iloc[0]
    if base == 0:
        return pd.Series(dtype="float64", name=s.name)
    return (s / base) * 100.0


# ---------------------------------------------------------------------------
# Main build
# ---------------------------------------------------------------------------

def build_payload() -> Tuple[Dict, Optional[Dict]]:
    ano = datetime.now(BRT).year
    print("[fii_ifix] Baixando IFIX oficial da B3...")
    b3 = _b3_ifix_diario(list(range(ano - LOOKBACK_YEARS - 1, ano + 1)))
    print(f"[fii_ifix] IFIX B3 rows={len(b3)}, last={b3.index[-1].date() if len(b3) else None}")

    print("[fii_ifix] Baixando IFIX.SA spot...")
    ifix_spot, spot_dia = _yf_spot("IFIX.SA")
    print(f"[fii_ifix] IFIX spot = {ifix_spot} ({spot_dia.date() if spot_dia is not None else '-'})")

    print("[fii_ifix] Baixando benchmark ^BVSP...")
    ibov = _yf_close("^BVSP")
    print(f"[fii_ifix] IBOV rows={len(ibov)}")

    print("[fii_ifix] Baixando CDI BCB SGS 12...")
    cdi_daily = _sgs_series(12)
    print(f"[fii_ifix] CDI rows={len(cdi_daily)}")

    scale_ratio = None
    if len(b3) >= 250:
        ifix_history = b3.rename("IFIX")
        source_history = "B3 — IFIX oficial (estatísticas de índices, fechamento diário)"
        primary_source_note = "B3 (fechamento oficial)"
        # Pregão de hoje ainda sem fechamento oficial: o ponto de hoje é o spot do Yahoo.
        if ifix_spot and spot_dia is not None and spot_dia > ifix_history.index[-1]:
            ifix_history.loc[spot_dia] = ifix_spot
            primary_source_note = f"B3 (fechamento oficial) + IFIX.SA spot de hoje ({ifix_spot:.2f})"
        ifix_anchor_value = float(ifix_history.iloc[-1])
    else:
        # Reserva: XFIX11 reescalado pelo spot (descola do índice em até ±4%).
        print("[fii_ifix] [WARN] IFIX da B3 indisponível — reserva XFIX11", file=sys.stderr)
        xfix = _yf_close("XFIX11.SA")
        if xfix.empty:
            print("[fii_ifix] ERRO crítico: B3 e XFIX11 vazios. Abort.", file=sys.stderr)
            return {
                "status": "error",
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "source_primary": "yfinance",
                "source_history": "B3 e XFIX11.SA vazios",
                "benchmark_sources": {},
                "hero": None,
                "series_daily": [],
            }, None
        xfix_today = float(xfix.iloc[-1])
        scale_ratio = (ifix_spot / xfix_today) if ifix_spot and ifix_spot > 0 else 1.0
        ifix_history = (xfix * scale_ratio).rename("IFIX")
        source_history = "XFIX11.SA via yfinance (proxy IFIX — reserva, B3 indisponível)"
        primary_source_note = "XFIX11.SA reescalado pelo IFIX.SA spot"
        ifix_anchor_value = ifix_spot or xfix_today

    # ---- Hero ----
    last_date = ifix_history.index[-1]
    last_value = float(ifix_history.iloc[-1])
    prev_value = float(ifix_history.iloc[-2]) if len(ifix_history) >= 2 else None
    change_pct_1d = (
        round((last_value - prev_value) / prev_value * 100.0, 2)
        if prev_value and prev_value > 0
        else None
    )
    one_year_ago = last_date - pd.Timedelta(days=365)
    win_12m = ifix_history.loc[ifix_history.index >= one_year_ago]
    max_12m = float(win_12m.max()) if not win_12m.empty else last_value
    min_12m = float(win_12m.min()) if not win_12m.empty else last_value

    hero = {
        "last_value": last_value,
        "last_date": last_date.strftime("%Y-%m-%d"),
        "change_pct_1d": change_pct_1d,
        "max_12m": max_12m,
        "min_12m": min_12m,
    }

    # ---- Série unificada por data (full outer join) ----
    start_date = (last_date - pd.Timedelta(days=int(LOOKBACK_YEARS * 365.25 + 30))).normalize()
    ifix_clip = ifix_history.loc[ifix_history.index >= start_date]
    cdi_idx = _cdi_cumulative_index(cdi_daily, start_date)
    ibov_idx = _to_base_100(ibov.loc[ibov.index >= start_date])

    # IMA-B / IMA-B5+ da ANBIMA nos pregões do IFIX (histórico no Blob + o que falta)
    ima, ima_payload, n_sem = _ima_historico([d for d in ifix_clip.index if d.weekday() < 5])
    ima = ima[ima.index >= start_date]
    imab_idx = _to_base_100(ima["IMAB"]) if "IMAB" in ima else pd.Series(dtype="float64")
    imab5p_idx = _to_base_100(ima["IMAB5P"]) if "IMAB5P" in ima else pd.Series(dtype="float64")
    print(f"[fii_ifix] IMA-B rows={len(imab_idx)}, IMA-B5+ rows={len(imab5p_idx)}, "
          f"último {ima.index.max().date() if len(ima) else None}")

    df = pd.concat(
        [
            ifix_clip.rename("ifix"),
            imab_idx.rename("IMAB"),
            imab5p_idx.rename("IMAB5P"),
            cdi_idx.rename("CDI"),
            ibov_idx.rename("IBOV"),
        ],
        axis=1,
        sort=True,
    )
    df = df.sort_index()
    # Forward-fill em dias úteis sem cotação (ex.: CDI publica feriados, BVSP não)
    # IMA: ffill curto (feriado da ANBIMA em dia de pregão, ou o dia de hoje antes de a ANBIMA publicar);
    # nunca o ffill sem limite que escondeu o buraco dos ETFs por 914 pregões.
    df[["ifix", "IBOV"]] = df[["ifix", "IBOV"]].ffill()
    df[["IMAB", "IMAB5P"]] = df[["IMAB", "IMAB5P"]].ffill(limit=3)
    df["CDI"] = df["CDI"].ffill()
    df = df.dropna(subset=["ifix"])

    series_daily: List[Dict] = []
    for date, row in df.iterrows():
        point = {
            "date": date.strftime("%Y-%m-%d"),
            "ifix": round(float(row["ifix"]), 2),
        }
        for col in ("IMAB", "IMAB5P", "CDI", "IBOV"):
            v = row.get(col)
            point[col] = (round(float(v), 4) if pd.notna(v) else None)
        series_daily.append(point)

    return {
        "status": "ok",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_primary": primary_source_note,
        "source_history": source_history,
        "benchmark_sources": {
            "IMAB": "ANBIMA — IMA-B (número-índice oficial, base 100)",
            "IMAB5P": "ANBIMA — IMA-B 5+ (número-índice oficial, base 100)",
            "CDI": "BCB SGS 12 (CDI diário acumulado, base 100)",
            "IBOV": "^BVSP via yfinance (Ibovespa, base 100)",
        },
        "hero": hero,
        "series_daily": series_daily,
        "_meta": {
            "anchor_ifix_spot": ifix_anchor_value,
            "scale_ratio_xfix_to_ifix": round(scale_ratio, 6) if scale_ratio else None,
            "rows": len(series_daily),
            "lookback_years": LOOKBACK_YEARS,
            "ima_ultimo": ima.index.max().strftime("%Y-%m-%d") if len(ima) else None,
            "ima_dias_sem_dado": n_sem,
        },
    }, ima_payload


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default="data-pipeline/out")
    ap.add_argument("--upload", action="store_true", help="Faz upload pro Vercel Blob")
    args = ap.parse_args()

    payload, ima_payload = build_payload()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "fii_ifix.json"
    out_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(f"[fii_ifix] Escreveu {out_path} ({out_path.stat().st_size:,} bytes)")

    if payload.get("status") == "error":
        print("[fii_ifix] Status=error, não fará upload.", file=sys.stderr)
        return 1

    if ima_payload:
        ima_path = out_dir / "anbima_ima_historico.json"
        ima_path.write_text(json.dumps(ima_payload, ensure_ascii=False), encoding="utf-8")
        print(f"[fii_ifix] Escreveu {ima_path} ({ima_path.stat().st_size:,} bytes)")
        if args.upload:
            maybe_upload_json(ima_path, IMA_HIST_BLOB)

    if args.upload:
        maybe_upload_json(out_path, "data/fii_ifix.json")
    else:
        print("[fii_ifix] --upload NÃO setado; apenas salvou local.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
