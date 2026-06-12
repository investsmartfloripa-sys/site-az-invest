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
    """Pasta de trabalho temporária — prefere /dev/shm (RAM, CI Linux); fallback
    tempfile.gettempdir() (portável — '/tmp' hardcoded quebrava no Windows)."""
    import tempfile
    shm = Path("/dev/shm")
    if shm.exists() and os.access(shm, os.W_OK):
        d = shm / "caged_quebras_build"
    else:
        d = Path(tempfile.gettempdir()) / "caged_quebras_build"
    d.mkdir(parents=True, exist_ok=True)
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
    """Lê o CAGEDMOV em chunks com pandas e devolve agregação por faixa salarial e setor.

    v2 (aditivo): admissoes_por_faixa (fluxo bruto — share válido, ao contrário do
    saldo) e desligamentos A PEDIDO (tipomovimentação 40 — proxy do quits rate,
    termômetro de mercado aquecido)."""
    t0 = time.time()
    sm = SM_POR_ANO.get(ano, SM_POR_ANO[max(SM_POR_ANO)])

    # usecols dinâmico: tipomovimentação pode não existir em algum layout antigo
    cols_head = list(pd.read_csv(txt, sep=";", nrows=0, encoding="utf-8").columns)
    tem_tipo = "tipomovimentação" in cols_head
    usecols = ["seção", "saldomovimentação", "salário"] + (["tipomovimentação"] if tem_tipo else [])
    dtypes: dict[str, Any] = {"seção": str, "saldomovimentação": "Int8"}
    if tem_tipo:
        dtypes["tipomovimentação"] = "Int16"

    total_adm = total_dem = total_linhas = 0
    desligamentos_a_pedido = 0
    saldo_setor: dict[str, int] = {s: 0 for s in {"Agropecuária", "Indústria geral", "Construção", "Comércio", "Serviços"}}
    saldo_faixa: dict[str, int] = {f"{i:02d}": 0 for i in range(0, 13)}
    adm_faixa: dict[str, int] = {f"{i:02d}": 0 for i in range(0, 13)}
    sum_sal_adm = n_sal_adm = 0
    sum_sal_dem = n_sal_dem = 0
    # v2: teto de sanidade p/ a MÉDIA (salários de declaração errada — bilhões — explodem
    # a média de um mês inteiro, como em abr/2026) + listas p/ MEDIANA (robusta à cauda)
    teto_sal = 120 * sm  # ~R$ 180k/mês: acima disso é erro de declaração
    sal_adm_chunks: list = []
    sal_dem_chunks: list = []

    for chunk in pd.read_csv(
        txt, sep=";", chunksize=500_000, encoding="utf-8",
        dtype=dtypes,
        usecols=usecols,
    ):
        total_linhas += len(chunk)
        chunk["sal"] = pd.to_numeric(chunk["salário"].astype(str).str.replace(",", ".", regex=False), errors="coerce")
        chunk["fxv"] = (chunk["sal"] / sm).apply(_faixa)
        chunk["st"] = chunk["seção"].map(SECAO_PARA_SETOR).fillna("Outros")

        s = chunk["saldomovimentação"]
        adm = (s == 1); dem = (s == -1)
        total_adm += int(adm.sum())
        total_dem += int(dem.sum())
        if tem_tipo:
            # 40 = desligamento a pedido (layout Novo CAGED)
            desligamentos_a_pedido += int((dem & (chunk["tipomovimentação"] == 40)).sum())

        for setor, sub in chunk.groupby("st"):
            if setor in saldo_setor:
                saldo_setor[setor] += int(sub["saldomovimentação"].sum())
        for fx, sub in chunk.groupby("fxv"):
            saldo_faixa[fx] = saldo_faixa.get(fx, 0) + int(sub["saldomovimentação"].sum())
        for fx, sub in chunk.loc[adm].groupby("fxv"):
            adm_faixa[fx] = adm_faixa.get(fx, 0) + int(len(sub))

        v = chunk["sal"].notna() & (chunk["sal"] > 0) & (chunk["sal"] <= teto_sal)
        sum_sal_adm += float(chunk.loc[adm & v, "sal"].sum())
        n_sal_adm += int((adm & v).sum())
        sum_sal_dem += float(chunk.loc[dem & v, "sal"].sum())
        n_sal_dem += int((dem & v).sum())
        sal_adm_chunks.append(chunk.loc[adm & v, "sal"].to_numpy(dtype="float32"))
        sal_dem_chunks.append(chunk.loc[dem & v, "sal"].to_numpy(dtype="float32"))

    txt.unlink()
    dt = time.time() - t0
    print(f"  [agg] {total_linhas:,} linhas, saldo {total_adm-total_dem:+,}, em {dt:.1f}s")

    sal_med_adm = round(sum_sal_adm / n_sal_adm, 2) if n_sal_adm else None
    sal_med_dem = round(sum_sal_dem / n_sal_dem, 2) if n_sal_dem else None
    import numpy as np
    arr_adm = np.concatenate(sal_adm_chunks) if sal_adm_chunks else np.array([])
    arr_dem = np.concatenate(sal_dem_chunks) if sal_dem_chunks else np.array([])
    sal_mediana_adm = round(float(np.median(arr_adm)), 2) if arr_adm.size else None
    sal_mediana_dem = round(float(np.median(arr_dem)), 2) if arr_dem.size else None
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
        # ── v2 ──
        "admissoes_por_faixa": adm_faixa,
        "desligamentos_a_pedido": desligamentos_a_pedido if tem_tipo else None,
        "pct_desligamentos_a_pedido": (
            round(desligamentos_a_pedido / total_dem * 100, 1) if (tem_tipo and total_dem) else None
        ),
        "salario_mediana_admissao": sal_mediana_adm,
        "salario_mediana_demissao": sal_mediana_dem,
    }


def deflator_ipca_433() -> tuple[dict[str, float], str | None]:
    """SGS 433 (IPCA var % mensal) desde 2019, composto e NORMALIZADO p/ o último
    mês = 100 — deflaciona salários 'a preços de hoje'. Resolve o furo do deflator
    de 24 meses do ipca.json (que truncava silenciosamente o toggle Real)."""
    import requests
    try:
        r = requests.get(
            "https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=json&dataInicial=01/01/2019",
            timeout=60, headers={"User-Agent": "az-invest-emprego-quebras/0.2"},
        )
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        print(f"  [WARN] SGS 433 indisponível ({e}) — campos reais ficam nulos", file=sys.stderr)
        return {}, None
    idx = 100.0
    bruto: dict[str, float] = {}
    for row in data:
        try:
            d, m, y = row["data"].split("/")
            v = float(row["valor"])
        except (KeyError, ValueError):
            continue
        idx *= 1 + v / 100
        bruto[f"{y}-{m}"] = idx
    if not bruto:
        return {}, None
    base_mes = sorted(bruto.keys())[-1]
    base = bruto[base_mes]
    return {k: v / base * 100 for k, v in bruto.items()}, base_mes


def aplica_salario_real(serie: list[dict], defl: dict[str, float], base_mes: str | None) -> None:
    """v2: salário real (R$ do mês-base do IPCA) + YoY real da admissão, sobre a série
    INTEIRA (inclusive meses herdados do Blob — não exige reprocessar microdado).
    Mês mais novo que o IPCA disponível usa o último índice (≈ nominal) — fallback declarado."""
    if not defl:
        for item in serie:
            item.setdefault("salario_adm_real", None)
            item.setdefault("salario_dem_real", None)
            item.setdefault("salario_adm_real_yoy_pct", None)
        return
    ult_idx = defl[sorted(defl.keys())[-1]]
    reais: dict[str, float] = {}
    reais_mediana: dict[str, float] = {}
    campos = (
        ("salario_medio_admissao", "salario_adm_real"),
        ("salario_medio_demissao", "salario_dem_real"),
        ("salario_mediana_admissao", "salario_mediana_adm_real"),
        ("salario_mediana_demissao", "salario_mediana_dem_real"),
    )
    for item in serie:
        idx = defl.get(item["mes"], ult_idx)
        for campo, alvo in campos:
            v = item.get(campo)
            item[alvo] = round(v / idx * 100, 2) if (v is not None and idx) else None
        if item.get("salario_adm_real") is not None:
            reais[item["mes"]] = item["salario_adm_real"]
        if item.get("salario_mediana_adm_real") is not None:
            reais_mediana[item["mes"]] = item["salario_mediana_adm_real"]
    for item in serie:
        y, m = item["mes"].split("-")
        ant = reais.get(f"{int(y) - 1}-{m}")
        atual = item.get("salario_adm_real")
        item["salario_adm_real_yoy_pct"] = round((atual / ant - 1) * 100, 2) if (atual and ant) else None
        ant_md = reais_mediana.get(f"{int(y) - 1}-{m}")
        atual_md = item.get("salario_mediana_adm_real")
        item["salario_mediana_adm_real_yoy_pct"] = round((atual_md / ant_md - 1) * 100, 2) if (atual_md and ant_md) else None
    print(f"  [v2] salário real aplicado (base IPCA: {base_mes})")


def carrega_blob_anterior() -> dict | None:
    """Tenta baixar o JSON anterior do Blob para merge incremental."""
    try:
        sys.path.insert(0, str(HERE))
        from shared.blob_download import download_json
        return download_json(BLOB_PATH)
    except Exception as e:
        print(f"  [blob] read anterior falhou: {e}", file=sys.stderr)
        return None


def _salva_e_upload_parcial(serie_existente: dict, out_file: Path) -> None:
    """Salva JSON parcial e faz upload pro Blob (usado em checkpoints de backfill)."""
    serie = [serie_existente[k] for k in sorted(serie_existente.keys())]
    out = {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "mes_recente": serie[-1]["mes"] if serie else "",
        "serie": serie,
        "metadata": {
            "fonte": "MTE/PDET — microdados Novo CAGED (FTP), agregação local",
            "nota": "Backfill em progresso — checkpoint intermediário.",
            "cnae_para_setor": SECAO_PARA_SETOR,
        },
    }
    out_file.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    sys.path.insert(0, str(HERE))
    from shared.blob_upload import maybe_upload_json
    maybe_upload_json(out_file, BLOB_PATH)


def main() -> None:
    ap = argparse.ArgumentParser(description="Build do JSON Painel Emprego — CAGED quebras")
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--meses-atras", type=int, default=3,
                    help="Quantos meses reprocessar a cada run (default 3, captura ~80%% das revisões; CAGED tem cauda longa de FOR)")
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

    # Processa cada mês — backfill resiliente: skipa já processados, upload incremental
    scratch = _scratch_dir()
    print(f"  scratch: {scratch}")
    processados_no_run = 0
    for ano, mes in meses:
        anomes = f"{ano}-{mes:02d}"
        if anomes in serie_existente and args.backfill:
            print(f"--- {anomes} já processado, pulando ---")
            continue
        print(f"\n--- {anomes} ---")
        txt = baixa_e_extrai(ano, mes, scratch)
        if txt is None:
            print(f"  [SKIP] {anomes} indisponível, mantendo anterior se houver")
            continue
        agg = agrega_microdado(txt, ano)
        agg["mes"] = anomes
        serie_existente[anomes] = agg
        processados_no_run += 1

        # Upload incremental a cada 10 meses pra proteger progresso de backfills longos
        if args.upload and args.backfill and processados_no_run % 10 == 0:
            try:
                _salva_e_upload_parcial(serie_existente, out_file)
                print(f"  [checkpoint] {processados_no_run} meses processados, upload incremental OK")
            except Exception as e:
                print(f"  [checkpoint] upload incremental falhou: {e}", file=sys.stderr)

    # Limpa scratch
    shutil.rmtree(scratch, ignore_errors=True)

    serie = [serie_existente[k] for k in sorted(serie_existente.keys())]
    if not serie:
        print("ERRO: nenhum mês processado e sem dado anterior, abortando", file=sys.stderr)
        sys.exit(2)

    # ── v2: salário REAL sobre a série inteira (deflator dedicado SGS 433 desde 2019) ──
    defl, base_mes = deflator_ipca_433()
    aplica_salario_real(serie, defl, base_mes)

    out = {
        "schema_version": 2,
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "mes_recente": serie[-1]["mes"],
        "deflator_base_mes": base_mes,
        "serie": serie,
        "metadata": {
            "fonte": "MTE/PDET — microdados Novo CAGED (FTP), agregação local; deflator IPCA SGS 433",
            "nota": (
                "Distribuições por faixa salarial/setor e salário médio refletem APENAS declarações no prazo "
                "do mês de referência (~40-50% do saldo oficial). Para saldo absoluto use emprego_caged_total.json. "
                "v2: salario_adm_real/_dem_real em R$ do mês-base do IPCA (deflator_base_mes); salário de admissão "
                "é proxy SEM controle de composição (o mix setorial muda mês a mês — o BCB usa versão ajustada no RI). "
                "admissoes_por_faixa = fluxo bruto (share válido); desligamentos a pedido (tipo 40) = proxy do quits rate. "
                "Faixa '00' = salário não informado (excluir de agregações por faixa, reportar como nota)."
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
