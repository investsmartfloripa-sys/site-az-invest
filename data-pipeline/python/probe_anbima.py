"""Sonda exploratoria para validar fontes ANBIMA antes de construir pipeline.

Baixa amostras de:
  1. Mercado secundario TPF (Titulos Publicos Federais): ms{YYMMDD}.txt
  2. Debentures mercado secundario: tenta varios paths
  3. IDA (indice debentures ANBIMA): tenta varios paths

Salva tudo em data-pipeline/out-local/anbima-probe/ e produz um relatorio JSON.
NAO faz upload pra Blob, NAO modifica nada em producao.

Uso: python data-pipeline/python/probe_anbima.py
"""
from __future__ import annotations

import json
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests


HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/plain,text/html,application/octet-stream;q=0.9,*/*;q=0.5",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
}

OUT_DIR = Path("data-pipeline/out-local/anbima-probe")
OUT_DIR.mkdir(parents=True, exist_ok=True)


def is_weekday(d: date) -> bool:
    return d.weekday() < 5


def previous_business_days(n: int, start: Optional[date] = None) -> List[date]:
    d = start or date.today()
    out: List[date] = []
    while len(out) < n:
        d = d - timedelta(days=1)
        if is_weekday(d):
            out.append(d)
    return list(reversed(out))


def try_url(url: str, timeout: int = 15) -> Dict[str, Any]:
    """Retorna {status, size, content_type, content_first_200, sample_path?}."""
    try:
        r = requests.get(url, headers=HEADERS, timeout=timeout, allow_redirects=True)
        out: Dict[str, Any] = {
            "url": url,
            "status": r.status_code,
            "content_type": r.headers.get("Content-Type", ""),
            "size": len(r.content),
            "redirected": r.url != url,
            "final_url": r.url if r.url != url else None,
        }
        if r.status_code == 200 and r.content:
            preview = r.content[:200].decode("latin1", errors="replace")
            out["preview"] = preview
            # Salva se parece arquivo "real" (>2KB e nao HTML de erro)
            looks_like_data = len(r.content) > 2048 and not preview.lstrip().lower().startswith("<!doctype")
            if looks_like_data:
                fname = url.rsplit("/", 1)[-1] or "download"
                # Sanitiza
                safe = "".join(c if c.isalnum() or c in ".-_" else "_" for c in fname)
                p = OUT_DIR / safe
                p.write_bytes(r.content)
                out["saved_to"] = str(p)
        return out
    except Exception as e:
        return {"url": url, "err": str(e)[:200]}


def probe_tpf_secondary(n_days: int = 30) -> Dict[str, Any]:
    """Tenta baixar ms{YYMMDD}.txt para N dias uteis anteriores.

    URL: https://www.anbima.com.br/informacoes/merc-sec/arqs/ms{YYMMDD}.txt
    """
    days = previous_business_days(n_days)
    by_date: Dict[str, Dict[str, Any]] = {}
    for d in days:
        yymmdd = d.strftime("%y%m%d")
        url = f"https://www.anbima.com.br/informacoes/merc-sec/arqs/ms{yymmdd}.txt"
        res = try_url(url, timeout=15)
        by_date[d.isoformat()] = res
        time.sleep(0.15)

    ok_dates = [d for d, r in by_date.items() if r.get("status") == 200 and r.get("size", 0) > 1024]
    return {
        "endpoint": "anbima TPF mercado secundario (ms{YYMMDD}.txt)",
        "days_attempted": len(days),
        "days_ok": len(ok_dates),
        "first_ok": ok_dates[0] if ok_dates else None,
        "last_ok": ok_dates[-1] if ok_dates else None,
        "samples_by_date": by_date,
    }


def probe_debentures_secondary(n_days: int = 30) -> Dict[str, Any]:
    """Tenta variantes de URL para arquivo diario de debentures."""
    days = previous_business_days(n_days)
    results: List[Dict[str, Any]] = []
    # Variantes conhecidas / inferidas
    patterns = [
        "https://www.anbima.com.br/informacoes/merc-sec-debentures/arqs/db{YYMMDD}.txt",
        "https://www.anbima.com.br/informacoes/dwnld-dbt/arqs/db{YYMMDD}.txt",
        "https://www.anbima.com.br/informacoes/merc-sec/arqs/db{YYMMDD}.txt",
        "https://data.anbima.com.br/precos/historicos/ds_debentures/{YYYYMMDD}/ds_debentures.csv",
    ]
    for d in days[:5]:  # so 5 dias mais recentes para nao spammar
        yymmdd = d.strftime("%y%m%d")
        yyyymmdd = d.strftime("%Y%m%d")
        for p in patterns:
            url = p.format(YYMMDD=yymmdd, YYYYMMDD=yyyymmdd)
            res = try_url(url, timeout=15)
            res["pattern"] = p
            res["date"] = d.isoformat()
            results.append(res)
            time.sleep(0.15)

    ok = [r for r in results if r.get("status") == 200 and r.get("size", 0) > 1024]
    return {
        "endpoint": "anbima debentures mercado secundario (variantes)",
        "attempts": len(results),
        "ok_count": len(ok),
        "ok_samples": ok[:6],
        "all_attempts": results,
    }


def probe_ida() -> Dict[str, Any]:
    """Tenta URLs do IDA (indice de debentures ANBIMA)."""
    urls_to_try = [
        # Pagina HTML de download
        "https://www.anbima.com.br/informacoes/ida/",
        # Arquivos diretos vistos em paginas antigas
        "https://www.anbima.com.br/informacoes/ida/arqs/IDA.csv",
        "https://www.anbima.com.br/informacoes/ida/arqs/IDA.zip",
        "https://www.anbima.com.br/informacoes/ida/ida-historico/arqs/IDA_HIST.csv",
        "https://www.anbima.com.br/informacoes/ida/ida-historico/arqs/IDA_HIST.zip",
        "https://data.anbima.com.br/indicadores/ida/historico.csv",
    ]
    results: List[Dict[str, Any]] = []
    for u in urls_to_try:
        results.append(try_url(u, timeout=15))
        time.sleep(0.2)
    return {
        "endpoint": "anbima IDA (variantes)",
        "attempts": len(results),
        "results": results,
    }


def analyze_tpf_file(path: Path) -> Dict[str, Any]:
    """Le um arquivo ms{}.txt salvo e tenta inferir estrutura.

    Formato historico: linhas terminadas em \\r\\n, fixed-width, cada linha
    representa um titulo num dia. Campos esperados:
      Titulo, Data Referencia, Codigo SELIC, Data Vencimento, Taxa Compra, Taxa Venda,
      Taxa Indicativa, PU, ...
    """
    if not path.exists():
        return {"err": "file missing"}
    raw = path.read_bytes()
    try:
        txt = raw.decode("latin1")
    except Exception as e:
        return {"err": f"decode: {e}"}
    lines = [ln for ln in txt.splitlines() if ln.strip()]
    if not lines:
        return {"err": "empty"}
    header = lines[:3]
    body_sample = lines[3:8]
    # Tenta detectar separador (pode ser @ ou fixed-width)
    sep_at = sum(1 for ln in body_sample if "@" in ln)
    return {
        "file": str(path),
        "n_lines": len(lines),
        "header_lines": header,
        "body_sample": body_sample,
        "looks_at_separated": sep_at > 0,
    }


def main() -> int:
    print(f"[probe] iniciando em {datetime.now().isoformat()}")
    summary: Dict[str, Any] = {"started_at": datetime.now().isoformat()}

    print("[probe] 1/3 TPF mercado secundario...")
    tpf = probe_tpf_secondary(n_days=30)
    summary["tpf"] = tpf
    print(f"  -> {tpf['days_ok']}/{tpf['days_attempted']} dias com arquivo (ultimo OK: {tpf['last_ok']})")

    print("[probe] 2/3 Debentures secundario...")
    deb = probe_debentures_secondary(n_days=30)
    summary["debentures"] = deb
    print(f"  -> {deb['ok_count']}/{deb['attempts']} variantes/dias com arquivo")

    print("[probe] 3/3 IDA...")
    ida = probe_ida()
    summary["ida"] = ida
    ok_ida = sum(1 for r in ida["results"] if r.get("status") == 200 and r.get("size", 0) > 1024)
    print(f"  -> {ok_ida}/{ida['attempts']} URLs IDA respondem")

    # Se algum TPF baixou, analisa o ultimo OK
    last_ok_date = tpf.get("last_ok")
    if last_ok_date:
        yymmdd = last_ok_date.replace("-", "")[2:]
        sample_path = OUT_DIR / f"ms{yymmdd}.txt"
        if sample_path.exists():
            summary["tpf_file_analysis"] = analyze_tpf_file(sample_path)

    summary["finished_at"] = datetime.now().isoformat()
    out_path = OUT_DIR / "probe_summary.json"
    out_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[probe] relatorio: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
