"""Sonda agressiva para achar fonte aberta do IDA-Geral (Indice de Debentures ANBIMA).
Testa varios URLs conhecidos / inferidos para baixar a serie historica do spread medio.
"""
from __future__ import annotations
import json
import time
from pathlib import Path
import requests

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,text/csv,application/xml,application/json,*/*;q=0.5",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    "Referer": "https://www.anbima.com.br/",
}

CANDIDATES = [
    # Pagina principal IDA (HTML)
    "https://www.anbima.com.br/informacoes/ida/",
    # Arquivos publicados em downloads anbima
    "https://www.anbima.com.br/informacoes/ida/ida-arqs/IDA.csv",
    "https://www.anbima.com.br/informacoes/ida/arqs/IDA.txt",
    "https://www.anbima.com.br/informacoes/ida/arqs/IDA.csv",
    "https://www.anbima.com.br/informacoes/ida/arqs/IDA_HIST.csv",
    "https://www.anbima.com.br/informacoes/ida/arqs/IDA_HIST.zip",
    "https://www.anbima.com.br/informacoes/ida/arqs/IDA_RESUMO.txt",
    "https://www.anbima.com.br/informacoes/ida/arqs/ida-resumo-diario.csv",
    # Dados ANBIMA (subdominio data)
    "https://data.anbima.com.br/ida",
    "https://data.anbima.com.br/ida/historico",
    "https://data.anbima.com.br/ida/historico.csv",
    "https://data.anbima.com.br/indicadores/ida/historico.csv",
    "https://data.anbima.com.br/indicadores/ida.json",
    # Pagina antiga "merc-sec" de debentures
    "https://www.anbima.com.br/informacoes/merc-sec-debentures/IDA-grupos.csv",
    "https://www.anbima.com.br/informacoes/merc-sec-debentures/ida-grupos.txt",
    # CMS Lumis (ANBIMA usa)
    "https://www.anbima.com.br/lumis/portal/services/getFile.jsp?docId=IDA",
    # Tentativa via API REST publica
    "https://www.anbima.com.br/anbima-api/indices/ida",
    "https://api.anbima.com.br/ida",
    # JGP (referencia alternativa do mercado, indices privados publicos)
    "https://www.jgp.com.br/?download_id=indice-jgp-credito",
    # Btg pactual ou XP frequentemente publicam estatisticas semanais
    # (skip — sao paginas dinamicas com auth)
]


def probe(url: str) -> dict:
    try:
        r = requests.get(url, headers=HEADERS, timeout=15, allow_redirects=True)
        ct = r.headers.get("Content-Type", "")
        out = {
            "url": url,
            "status": r.status_code,
            "ct": ct[:60],
            "size": len(r.content),
            "final": r.url if r.url != url else None,
        }
        if r.status_code == 200 and r.content:
            preview = r.content[:200].decode("latin1", errors="replace").replace("\n", " ")[:200]
            out["preview"] = preview
        return out
    except Exception as e:
        return {"url": url, "err": str(e)[:120]}


def main():
    out_dir = Path("data-pipeline/out-local/ida-probe")
    out_dir.mkdir(parents=True, exist_ok=True)
    results = []
    for u in CANDIDATES:
        r = probe(u)
        results.append(r)
        time.sleep(0.3)
    ok = [r for r in results if r.get("status") == 200 and r.get("size", 0) > 2048]
    interesting = [r for r in results if r.get("status") in (200, 301, 302) and "html" not in (r.get("ct") or "").lower()]
    summary = {
        "total": len(results),
        "ok": len(ok),
        "ok_sample": ok[:5],
        "non_html_responses": interesting,
        "all": results,
    }
    out_path = out_dir / "ida_probe_summary.json"
    out_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[ida-probe] testadas {len(results)} URLs, {len(ok)} respondem com conteudo > 2KB")
    for r in ok[:5]:
        print(f"  OK {r['size']:>8}B  {r['url']}")
    for r in interesting:
        print(f"  ?? {r.get('status'):>3} {r.get('ct', ''):<40} {r['url']}")
    print(f"\nRelatorio: {out_path}")


if __name__ == "__main__":
    main()
