"""Build do JSON do Painel Visão Geral — bloco Hiato do Produto (HP + Hamilton).

Consome o JSON do IBC-Br já no Blob (`data/atividade_ibcbr.json`) e calcula
o hiato do produto por dois métodos:

- **HP (Hodrick-Prescott)**: λ=129600 para dados mensais (regra padrão).
- **Hamilton (2018)**: regressão de IBC-Br_{t+h} em IBC-Br_{t}, IBC-Br_{t-1},
  IBC-Br_{t-2}, IBC-Br_{t-3} com h=24 (mensal). Resíduo é o hiato.

Saída: série mensal com ambos os métodos + faixa min/max (leque) e mediana.

INPUTS = {ibcbr: '2003-01'} — começa quando IBC-Br começa.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

HERE = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/visao_geral_hiato.json"
IBCBR_BLOB_PATH = "data/atividade_ibcbr.json"

INPUTS = {"ibcbr_sa": "2003-01"}


def fetch_ibcbr_serie() -> list[dict[str, Any]]:
    sys.path.insert(0, str(HERE))
    from shared.blob_download import download_json

    payload = download_json(IBCBR_BLOB_PATH)
    if not payload or "serie" not in payload:
        raise RuntimeError(f"IBC-Br não encontrado em {IBCBR_BLOB_PATH}")
    return payload["serie"]


def hp_filter(y: list[float], lamb: float = 129600.0) -> list[float]:
    """Filtro HP em Python puro (sem statsmodels).

    Resolve (I + lamb * D2'D2) * tau = y onde D2 é o operador de segunda
    diferença. Retorna a tendência tau; o ciclo é y - tau.
    """
    n = len(y)
    if n < 5:
        return [0.0] * n
    # Constrói matriz A = I + lamb * D2'D2 e resolve A * tau = y
    # Usa eliminação de Thomas para sistema pentadiagonal.
    # Diagonal principal: 1 + lamb * d (d varia nas pontas)
    # Tendência: usar implementação iterativa simples baseada em pentadiagonal.

    # Matriz pentadiagonal sob a forma de listas
    main_diag = [0.0] * n
    sub1 = [0.0] * (n - 1)  # diagonais ±1
    sub2 = [0.0] * (n - 2)  # diagonais ±2

    # D2: linhas i=2..n-1 do operador segunda-diferença (n-2 linhas, n colunas)
    # D2'D2 é matriz n×n. Vamos preenchê-la direto:
    for i in range(n):
        # contribuições de cada linha j da D2 onde j ∈ {2..n-1} (0-indexed: j ∈ {2..n-1})
        for j in range(max(2, i - 2), min(n, i + 3)):
            if j < 2 or j >= n:
                continue
            # linha j da D2: 1, -2, 1 em posições j-2, j-1, j
            row = {j - 2: 1.0, j - 1: -2.0, j: 1.0}
            if i in row and j - 2 <= i <= j:
                # essa linha contribui para A[i,k] = sum_j D2[j,i] * D2[j,k]
                # mas estamos pegando elemento errado — refazer
                pass

    # Em vez de construir matriz, usamos algoritmo direto via NumPy se disponível;
    # caso contrário fallback simples (lambda=0 → identidade).
    try:
        import numpy as np
    except ImportError:
        print("  numpy não disponível, hiato HP retornará zeros", file=sys.stderr)
        return [0.0] * n

    Y = np.array(y, dtype=float).reshape(-1, 1)
    I = np.eye(n)
    if n >= 3:
        D = np.zeros((n - 2, n))
        for i in range(n - 2):
            D[i, i] = 1.0
            D[i, i + 1] = -2.0
            D[i, i + 2] = 1.0
        A = I + lamb * (D.T @ D)
        try:
            tau = np.linalg.solve(A, Y).flatten().tolist()
            return tau
        except np.linalg.LinAlgError as e:
            print(f"  HP: erro linalg {e}", file=sys.stderr)
            return list(y)
    return list(y)


def hamilton_filter(y: list[float], h: int = 24, p: int = 4) -> list[float | None]:
    """Filtro de Hamilton (2018): regressa y_{t+h} em y_t, y_{t-1}, ..., y_{t-p+1}.

    Resíduo da regressão é o componente cíclico. Hamilton (2018) recomenda
    h=8 trimestres ou h=24 meses para variáveis mensais.

    Retorna vetor com None nos primeiros h+p-1 índices.
    """
    n = len(y)
    if n < h + p + 10:
        return [None] * n
    try:
        import numpy as np
    except ImportError:
        return [None] * n
    arr = np.array(y, dtype=float)
    # X é matriz com lags [y_t, y_{t-1}, ..., y_{t-p+1}], y_dep é y_{t+h}
    # índice t roda de p-1 até n-h-1; y_dep[t] = arr[t+h]; X[t] = arr[t-p+1:t+1][::-1]
    rows = []
    targets = []
    indices = []  # índice de y_{t+h}
    for t in range(p - 1, n - h):
        lags = arr[t - p + 1 : t + 1][::-1]
        rows.append(np.concatenate(([1.0], lags)))
        targets.append(arr[t + h])
        indices.append(t + h)
    X = np.array(rows)
    Y = np.array(targets)
    try:
        beta, *_ = np.linalg.lstsq(X, Y, rcond=None)
        fitted = X @ beta
        residuals = Y - fitted
    except np.linalg.LinAlgError:
        return [None] * n
    out: list[float | None] = [None] * n
    for idx, r in zip(indices, residuals):
        out[idx] = float(r)
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description="Build do JSON Painel Visão Geral — Hiato HP + Hamilton")
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--soft-fail", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "visao_geral_hiato.json"

    print("== Hiato do Produto (HP + Hamilton sobre IBC-Br) ==")

    try:
        serie_ibcbr = fetch_ibcbr_serie()
    except Exception as e:
        print(f"  FALHA carregar IBC-Br: {e}", file=sys.stderr)
        if args.soft_fail:
            payload = {"gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"), "freshness_status": "missing", "serie": []}
            out_file.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
            return
        sys.exit(2)

    # Extrai índice SA, descartando None
    pares = [(p["mes"], p.get("indice_sa")) for p in serie_ibcbr if p.get("indice_sa") is not None]
    pares.sort(key=lambda x: x[0])
    meses = [m for m, _ in pares]
    valores = [v for _, v in pares]

    if len(valores) < 60:
        print(f"  série muito curta ({len(valores)} obs), precisa ≥60", file=sys.stderr)
        if args.soft_fail:
            payload = {"gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"), "freshness_status": "missing"}
            out_file.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
            return
        sys.exit(2)

    # Log-transform — usar variação % do gap (mais interpretável que diferença em pontos)
    log_y = [math.log(v) for v in valores]

    tau_hp = hp_filter(log_y, lamb=129600.0)
    gap_hp = [(log_y[i] - tau_hp[i]) * 100 for i in range(len(log_y))]  # em %

    ciclo_hamilton = hamilton_filter(log_y, h=24, p=4)
    gap_hamilton = [(c * 100) if c is not None else None for c in ciclo_hamilton]

    # Constrói série mensal
    serie_out = []
    for i, mes in enumerate(meses):
        gh = gap_hp[i]
        gm = gap_hamilton[i]
        valores_validos = [v for v in (gh, gm) if v is not None]
        mediana = (sorted(valores_validos)[len(valores_validos) // 2] if valores_validos else None)
        serie_out.append(
            {
                "mes": mes,
                "indice_sa": valores[i],
                "gap_hp_pct": round(gh, 3) if gh is not None else None,
                "gap_hamilton_pct": round(gm, 3) if gm is not None else None,
                "gap_min_pct": round(min(valores_validos), 3) if valores_validos else None,
                "gap_max_pct": round(max(valores_validos), 3) if valores_validos else None,
                "gap_mediana_pct": round(mediana, 3) if mediana is not None else None,
            }
        )

    payload = {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "freshness_status": "fresh",
        "mes_recente": meses[-1] if meses else None,
        "serie": serie_out,
        "inputs": INPUTS,
        "min_start_date": min(INPUTS.values()),
        "metadata": {
            "fonte": "Cálculo próprio sobre IBC-Br dessazonalizado (BCB SGS 24364, lido do Blob).",
            "metodos": {
                "hp": "Filtro Hodrick-Prescott (1997) com λ=129600 (regra padrão para dados mensais).",
                "hamilton": "Filtro de Hamilton (2018) com h=24 meses, p=4 lags. Resíduo da regressão de y_{t+h} em lags de y_t.",
            },
            "nota": "Gap em log * 100 ≈ % vs tendência. Mostrar leque (min/max) e mediana, não um único método — divergência é a história. HP tem viés de fim de amostra; Hamilton tem defasagem de 24m e pode discordar.",
        },
    }

    out_file.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"JSON {out_file} ({out_file.stat().st_size / 1024:.1f} KB)")
    print(f"  Último gap HP={serie_out[-1]['gap_hp_pct']}%, Hamilton={serie_out[-1]['gap_hamilton_pct']}%, mediana={serie_out[-1]['gap_mediana_pct']}%")

    if args.upload:
        sys.path.insert(0, str(HERE))
        from shared.blob_upload import maybe_upload_json
        try:
            maybe_upload_json(out_file, BLOB_PATH)
        except Exception as e:
            print(f"[upload] FALHOU: {e}", file=sys.stderr)
            if not args.soft_fail:
                sys.exit(1)


if __name__ == "__main__":
    main()
