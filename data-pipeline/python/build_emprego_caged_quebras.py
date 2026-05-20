"""Build do JSON do Painel Emprego — bloco CAGED quebras (faixa salarial + setor + salário médio).

Baixa do FTP do PDET (MTE) os microdados CAGEDMOV de N meses recentes:
ftp://ftp.mtps.gov.br/pdet/microdados/NOVO CAGED/{ano}/{anomes}/CAGEDMOV{anomes}.7z

Descompacta em RAM (/dev/shm se disponível, senão /tmp), agrega por:
- Faixa salarial em SM (codificação MTE 01-12)
- Setor IBGE (5 grandes via tabela de-para CNAE)
- Salário médio de admissão e demissão

Merge incremental com Blob existente: mantém histórico, reescreve só últimos N meses pra capturar revisões.

ATENÇÃO: distribuição/quebras refletem APENAS declarações no prazo do mês (40-50%
do saldo oficial). Para saldo absoluto, ver build_emprego_caged_total.py (IPEADATA).
"""
from __future__ import annotations

import argparse
import io
import json
import os
import shutil
import sys
import time
from datetime import datetime, date, timezone
from ftplib import FTP
from pathlib import Path
from typing import Any

import py7zr
import pandas as pd

HERE = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/emprego_caged_quebras.json"

# Salário mínimo histórico (ajustar quando MTE/governo publicar novo SM)
SM_POR_ANO = {
    2020: 1045.00, 2021: 1100.00, 2022: 1212.00, 2023: 1320.00,
    2024: 1412.00, 2025: 1518.00, 2026: 1518.00,  # 2026 manter atualizado
}

# CNAE seção -> setor IBGE (5 grandes)
SECAO_PARA_SETOR = {
    "A": "Agropecuária",
    "B": "Indústria geral", "C": "Indústria geral", "D": "Indústria geral", "E": "Indústria geral",
    "F": "Construção",
    "G": "Comércio",
    "H": "Serviços", "I": "Serviços", "J": "Serviços", "K": "Serviços", "L": "Serviços",
    "M": "Serviços", "N": "Serviços", "O": "Serviços", "P": "Serviços", "Q": "Serviços",
    "R": "Serviços", "S": "Serviços", "T": "Serviços", "U": "Serviços",
}

FTP_HOST = "ftp.mtps.gov.br"
FTP_BASE = "/pdet/microdados/NOVO CAGED"


def _scratch_dir() -> Path:
    """Pasta de trabalho temporária — prefere /dev/shm (RAM), fallback /tmp."""
    shm = Path("/dev/shm")
    if shm.exists() and os.access(shm, os.W_OK):
        d = shm / "caged_quebras_build"
    else:
        d = Path("/tmp/caged_quebras_build")
    d.mkdir(exist_ok=True)
    return d


def _faixa(sm_ratio: float | None) -> str:
    if sm_ratio is None or pd.isna(sm_ratio):
        return "00"
    if sm_ratio <= 0.5: return "01"
    if sm_ratio <= 1.0: return "02"
    if sm_ratio <= 1.5: return "03"
    if sm_ratio <= 2.0: return "04"
    if sm_ratio <= 3.0: return "05"
    if sm_ratio <= 4.0: return "06"
    if sm_ratio <= 5.0: return "07"
    if sm_ratio <= 7.0: return "08"
    if sm_ratio <= 10.0: return "09"
    if sm_ratio <= 15.0: return "10"
    if sm_ratio <= 20.0: return "11"
    return "12"


def _meses_para_processar(meses_atras: int) -> list[tuple[int, int]]:
    """Gera lista [(ano, mes), ...] para os últimos N meses ATÉ o mês anterior ao corrente.
    O CAGEDMOV de mês X só fica disponível ~ último dia do mês X+1."""
    hoje = date.today()
    # Mês corrente menos 1 (último mês com dados garantidos)
    ano, mes = hoje.year, hoje.month - 1
    if mes == 0:
        ano -= 1
        mes = 12
    out: list[tuple[int, int]] = []
    for _ in range(meses_atras):
        out.append((ano, mes))
        mes -= 1
        if mes == 0:
            ano -= 1
            mes = 12
    out.reverse()
    return out


def baixa_e_extrai(ano: int, mes: int, scratch: Path) -> Path | None:
    """Baixa CAGEDMOV{anomes}.7z do FTP e descomprime. Retorna path do .txt ou None se falhar."""
    anomes = f"{ano}{mes:02d}"
    nome_7z = f"CAGEDMOV{anomes}.7z"
    tmp_7z = scratch / nome_7z
    try:
        print(f"  [FTP] baixando {nome_7z}...")
        t0 = time.time()
        with FTP(FTP_HOST, timeout=90) as ftp:
            ftp.login()
            ftp.cwd(f"{FTP_BASE}/{ano}/{anomes}")
            with tmp_7z.open("wb") as f:
                ftp.retrbinary(f"RETR {nome_7z}", f.write, blocksize=65536)
        print(f"  [FTP] {tmp_7z.stat().st_size/1024/1024:.1f} MB em {time.time()-t0:.1f}s")
    except Exception as e:
        print(f"  [FTP] FALHA {nome_7z}: {e}", file=sys.stderr)
        tmp_7z.unlink(missing_ok=True)
        return None

    try:
        # Limpa eventuais .txt anteriores
        for f in scratch.glob("*.txt"):
            f.unlink()
        t0 = time.time()
        with py7zr.SevenZipFile(tmp_7z, mode="r") as z:
            z.extractall(path=scratch)
        tmp_7z.unlink()
        txt = next(scratch.glob("*.txt"))
        print(f"  [7z] {txt.stat().st_size/1024/1024:.1f} MB em {time.time()-t0:.1f}s")
        return txt
    except Exception as e:
        print(f"  [7z] FALHA: {e}", file=sys.stderr)
        return None


def agrega_microdado(txt: Path, ano: int) -> dict:
    """Lê o CAGEDMOV em chunks com pandas e devolve agregação por faixa salarial e setor."""
    t0 = time.time()
    sm = SM_POR_ANO.get(ano, SM_POR_ANO[max(SM_POR_ANO)])

    total_adm = total_dem = total_linhas = 0
    saldo_setor: dict[str, int] = {s: 0 for s in {"Agropecuária", "Indústria geral", "Construção", "Comércio", "Serviços"}}
    saldo_faixa: dict[str, int] = {f"{i:02d}": 0 for i in range(0, 13)}
    sum_sal_adm = n_sal_adm = 0
    sum_sal_dem = n_sal_dem = 0

    for chunk in pd.read_csv(
        txt, sep=";", chunksize=500_000, encoding="utf-8",
        dtype={"seção": str, "saldomovimentação": "Int8"},
        usecols=["seção", "saldomovimentação", "salário"],
    ):
        total_linhas += len(chunk)
        chunk["sal"] = pd.to_numeric(chunk["salário"].str.replace(",", ".", regex=False), errors="coerce")
        chunk["fxv"] = (chunk["sal"] / sm).apply(_faixa)
        chunk["st"] = chunk["seção"].map(SECAO_PARA_SETOR).fillna("Outros")

        s = chunk["saldomovimentação"]
        adm = (s == 1); dem = (s == -1)
        total_adm += int(adm.sum())
        total_dem += int(dem.sum())

        for setor, sub in chunk.groupby("st"):
            if setor in saldo_setor:
                saldo_setor[setor] += int(sub["saldomovimentação"].sum())
        for fx, sub in chunk.groupby("fxv"):
            saldo_faixa[fx] = saldo_faixa.get(fx, 0) + int(sub["saldomovimentação"].sum())

        v = chunk["sal"].notna() & (chunk["sal"] > 0)
        sum_sal_adm += float(chunk.loc[adm & v, "sal"].sum())
        n_sal_adm += int((adm & v).sum())
        sum_sal_dem += float(chunk.loc[dem & v, "sal"].sum())
        n_sal_dem += int((dem & v).sum())

    txt.unlink()
    dt = time.time() - t0
    print(f"  [agg] {total_linhas:,} linhas, saldo {total_adm-total_dem:+,}, em {dt:.1f}s")

    sal_med_adm = round(sum_sal_adm / n_sal_adm, 2) if n_sal_adm else None
    sal_med_dem = round(sum_sal_dem / n_sal_dem, 2) if n_sal_dem else None
    return {
        "total_linhas": total_linhas,
        "total_admissoes": total_adm,
        "total_demissoes": total_dem,
        "saldo_microdado": total_adm - total_dem,
        "salario_minimo_aplicado": sm,
        "salario_medio_admissao": sal_med_adm,
        "salario_medio_demissao": sal_med_dem,
        "diferencial": round(sal_med_adm - sal_med_dem, 2) if (sal_med_adm and sal_med_dem) else None,
        "saldo_por_setor_ibge": saldo_setor,
        "saldo_por_faixa_salario": saldo_faixa,
    }


def carrega_blob_anterior() -> dict | None:
    """Tenta baixar o JSON anterior do Blob para merge incremental."""
    try:
        sys.path.insert(0, str(HERE))
        from shared.blob_download import download_json
        return download_json(BLOB_PATH)
    except Exception as e:
        print(f"  [blob] read anterior falhou: {e}", file=sys.stderr)
        return None


def main() -> None:
    ap = argparse.ArgumentParser(description="Build do JSON Painel Emprego — CAGED quebras")
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--meses-atras", type=int, default=6,
                    help="Quantos meses reprocessar a cada run (default 6, captura ~95%% das revisões)")
    ap.add_argument("--backfill", action="store_true",
                    help="Backfill total desde jan/2020 (uso pontual; ignora --meses-atras)")
    ap.add_argument("--no-merge", action="store_true",
                    help="Não fazer merge incremental com Blob anterior (regenera só os meses processados)")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "emprego_caged_quebras.json"

    if args.backfill:
        # Desde jan/2020 até o mês anterior ao corrente
        hoje = date.today()
        meses: list[tuple[int, int]] = []
        for ano in range(2020, hoje.year + 1):
            for mes in range(1, 13):
                if ano == hoje.year and mes >= hoje.month:
                    break
                meses.append((ano, mes))
        print(f"== BACKFILL: {len(meses)} meses ==")
    else:
        meses = _meses_para_processar(args.meses_atras)
        print(f"== Reprocessando últimos {len(meses)} meses ==")

    # Carrega anterior se vai mergear
    anterior = None
    if not args.no_merge:
        anterior = carrega_blob_anterior()
        if anterior and "serie" in anterior:
            print(f"  Blob anterior: {len(anterior['serie'])} meses")

    serie_existente: dict[str, dict] = {}
    if anterior and "serie" in anterior:
        for item in anterior["serie"]:
            serie_existente[item["mes"]] = item

    # Processa cada mês
    scratch = _scratch_dir()
    print(f"  scratch: {scratch}")
    for ano, mes in meses:
        anomes = f"{ano}-{mes:02d}"
        print(f"\n--- {anomes} ---")
        txt = baixa_e_extrai(ano, mes, scratch)
        if txt is None:
            print(f"  [SKIP] {anomes} indisponível, mantendo anterior se houver")
            continue
        agg = agrega_microdado(txt, ano)
        agg["mes"] = anomes
        serie_existente[anomes] = agg

    # Limpa scratch
    shutil.rmtree(scratch, ignore_errors=True)

    serie = [serie_existente[k] for k in sorted(serie_existente.keys())]
    if not serie:
        print("ERRO: nenhum mês processado e sem dado anterior, abortando", file=sys.stderr)
        sys.exit(2)

    out = {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "mes_recente": serie[-1]["mes"],
        "serie": serie,
        "metadata": {
            "fonte": "MTE/PDET — microdados Novo CAGED (FTP), agregação local",
            "nota": (
                "Distribuições por faixa salarial/setor e salário médio refletem APENAS declarações no prazo "
                "do mês de referência (~40-50% do saldo oficial). Para saldo absoluto use emprego_caged_total.json."
            ),
            "cnae_para_setor": SECAO_PARA_SETOR,
        },
    }

    out_file.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nJSON salvo em {out_file} ({out_file.stat().st_size/1024:.1f} KB) — {len(serie)} meses")

    if args.upload:
        try:
            sys.path.insert(0, str(HERE))
            from shared.blob_upload import maybe_upload_json
            maybe_upload_json(out_file, BLOB_PATH)
        except Exception as e:
            print(f"[upload] FALHOU: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        print("[upload] SKIP")


if __name__ == "__main__":
    main()
