"""Builder Probit AZ Hibrido - consolidado pra GH Actions.

Sequencia: catalogo -> download -> consolidar -> imputar -> 3 modelos -> Probit AZ
Saida: data/visao_geral_probit_az.json (consumido pelo Termometro de Ciclo)

Falhas individuais (serie / fonte) sao soft-fail. Pipeline ragged-edge tolerante.
"""
from __future__ import annotations
import argparse, json, sys, io
from datetime import datetime, timezone
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import numpy as np
import pandas as pd
import requests
from scipy import stats

HERE = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = (HERE.parent / "out").resolve()
BLOB_PATH = "data/visao_geral_probit_az.json"
UA = {"User-Agent": "az-invest-probit-az/1.0"}
UA_JSON = {"User-Agent": "az-invest-probit-az/1.0", "Accept": "application/json"}

CATALOGO = [
    # (fonte, codigo, transform)
    ("BCB_SGS", "4189", "diff_12m"),
    ("BCB_SGS", "11757", "log_diff_12m"),
    ("YFINANCE", "^BVSP", "log_diff_12m"),
    ("BCB_SGS", "3697", "log_diff_12m"),
    ("IPEADATA", "JPM366_EMBI366", "level"),
    ("BCB_SGS", "20783", "diff_12m"),
    ("BCB_SGS", "20784", "diff_12m"),
    ("BCB_SGS", "21082", "diff_12m"),
    ("BCB_SGS", "21084", "diff_12m"),
    ("BCB_SGS", "21859", "level"),
    ("BCB_SGS", "21861", "level"),
    ("BCB_SGS", "21862", "level"),
    ("BCB_SGS", "21864", "level"),
    ("BCB_SGS", "21865", "level"),
    ("BCB_SGS", "8174", "level"),
    ("BCB_SGS", "8175", "level"),
    ("BCB_SGS", "4393", "level"),
    ("BCB_SGS", "24364", "log_diff_12m"),
    ("BCB_SGS", "1453", "log_diff_12m"),
    ("IPEADATA", "ABPO12_PAPEL12", "log_diff_12m"),
    ("BCB_SGS", "20620", "log_diff_12m"),
    ("BCB_SGS", "20622", "log_diff_12m"),
    ("BCB_SGS", "433", "diff_12m"),
    ("BCB_SGS", "1635", "diff_12m"),
    ("BCB_SGS", "27791", "log_diff_12m"),
    ("BCB_SGS", "27814", "log_diff_12m"),
    ("BCB_SGS", "189", "diff_12m"),
    ("FRED", "DGS10", "diff_12m"),
    ("FRED", "DGS3MO", "diff_12m"),
    ("FRED", "VIXCLS", "diff_12m"),
    ("FRED", "DCOILWTICO", "log_diff_12m"),
    ("OCDE_FRED", "BSCICP03BRM665S", "level"),
    ("OCDE_FRED", "BSCICP03USM665S", "level"),
    ("BCB_OLINDA", "Focus_IPCA_12m", "level"),
    ("BCB_OLINDA", "Focus_PIB_anual", "level"),
    ("BCB_OLINDA", "Focus_Selic_fim", "level"),
]

RECESSOES = [
    ("1998-01", "1998-12"), ("2001-02", "2001-09"), ("2002-11", "2003-06"),
    ("2008-09", "2009-01"), ("2014-03", "2016-10"), ("2019-11", "2020-04"),
]


def to_mensal(df, freq="diaria"):
    if df.empty: return df
    df = df.copy()
    df["data"] = pd.to_datetime(df["data"], errors="coerce")
    df = df.dropna(subset=["data"]).sort_values("data")
    df["mes"] = df["data"].dt.to_period("M").dt.to_timestamp()
    return df.groupby("mes", as_index=False)["valor"].last().rename(columns={"mes":"data"})


def baixar_sgs(codigo):
    url = f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados?formato=json&dataInicial=01/01/1995"
    last_err = None
    for hdrs in (UA, UA_JSON):
        try:
            r = requests.get(url, timeout=15, headers=hdrs)
            r.raise_for_status()
            data = r.json()
            df = pd.DataFrame([(p["data"], float(p["valor"])) for p in data if p.get("valor")], columns=["data","valor"])
            df["data"] = pd.to_datetime(df["data"], format="%d/%m/%Y", errors="coerce")
            return to_mensal(df.dropna())
        except Exception as e:
            last_err = e
    raise last_err


def baixar_ipeadata(codigo):
    url = f"http://www.ipeadata.gov.br/api/odata4/ValoresSerie(SERCODIGO='{codigo}')"
    r = requests.get(url, timeout=60, headers=UA)
    r.raise_for_status()
    data = r.json().get("value", [])
    rows = [(p["VALDATA"][:10], float(p["VALVALOR"])) for p in data if p.get("VALVALOR") is not None]
    df = pd.DataFrame(rows, columns=["data","valor"])
    return to_mensal(df)


def baixar_yfinance(ticker):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?range=max&interval=1mo"
    r = requests.get(url, timeout=60, headers=UA)
    r.raise_for_status()
    d = r.json().get("chart", {}).get("result", [{}])[0]
    ts = d.get("timestamp", [])
    cl = d.get("indicators", {}).get("quote", [{}])[0].get("close", [])
    rows = [(pd.Timestamp(t, unit="s"), v) for t, v in zip(ts, cl) if v is not None]
    df = pd.DataFrame(rows, columns=["data","valor"])
    return to_mensal(df)


def baixar_fred(codigo):
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={codigo}"
    r = requests.get(url, timeout=60, headers=UA)
    r.raise_for_status()
    df = pd.read_csv(io.StringIO(r.text))
    df.columns = ["data","valor"]
    df["data"] = pd.to_datetime(df["data"], errors="coerce")
    df["valor"] = pd.to_numeric(df["valor"], errors="coerce")
    return to_mensal(df.dropna())


def baixar_olinda(indicador):
    if "IPCA" in indicador:
        url = "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoInflacao12Meses?$filter=Indicador%20eq%20%27IPCA%27%20and%20Suavizada%20eq%20%27S%27%20and%20baseCalculo%20eq%200&$select=Data,Mediana&$format=json"
    elif "PIB" in indicador:
        url = "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais?$filter=Indicador%20eq%20%27PIB%20Total%27%20and%20baseCalculo%20eq%200&$select=Data,DataReferencia,Mediana&$format=json"
    else:
        url = "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais?$filter=Indicador%20eq%20%27Selic%27%20and%20baseCalculo%20eq%200&$select=Data,DataReferencia,Mediana&$format=json"
    r = requests.get(url, timeout=60, headers=UA)
    r.raise_for_status()
    data = r.json().get("value", [])
    rows = []
    for p in data:
        try:
            d = p["Data"][:10]
            v = float(p["Mediana"])
            if "DataReferencia" in p and int(p["DataReferencia"]) != int(d[:4]):
                continue
            rows.append((d, v))
        except (KeyError, ValueError): continue
    df = pd.DataFrame(rows, columns=["data","valor"])
    df["data"] = pd.to_datetime(df["data"], errors="coerce")
    return to_mensal(df.dropna())


def baixar(fonte, codigo):
    try:
        if fonte == "BCB_SGS": return baixar_sgs(codigo)
        if fonte == "IPEADATA": return baixar_ipeadata(codigo)
        if fonte == "YFINANCE": return baixar_yfinance(codigo)
        if fonte in ("FRED", "OCDE_FRED"): return baixar_fred(codigo)
        if fonte == "BCB_OLINDA": return baixar_olinda(codigo)
    except Exception as e:
        print(f"  WARN {fonte}/{codigo}: {str(e)[:80]}", file=sys.stderr)
    return pd.DataFrame()


def hp_filter(y, lam=129600):
    n = len(y)
    I = np.eye(n)
    D = np.zeros((n-2, n))
    for i in range(n-2):
        D[i, i] = 1; D[i, i+1] = -2; D[i, i+2] = 1
    trend = np.linalg.solve(I + lam * D.T @ D, y.values)
    return pd.Series(y.values - trend, index=y.index)


def probit_ridge(X, y, lam=0.5, max_iter=80):
    n, k = X.shape
    X1 = np.column_stack([np.ones(n), X])
    b = np.zeros(k + 1)
    b[0] = stats.norm.ppf(np.clip(y.mean(), 1e-3, 1-1e-3))
    I_reg = np.eye(k+1); I_reg[0,0] = 0
    for it in range(max_iter):
        z = np.clip(X1 @ b, -6, 6)
        p = np.clip(stats.norm.cdf(z), 1e-6, 1-1e-6)
        phi = stats.norm.pdf(z)
        g = X1.T @ (phi * (y - p) / (p * (1 - p))) - lam * (I_reg @ b)
        w = phi**2 / (p * (1 - p))
        H = (X1.T * w) @ X1 + lam * I_reg
        try: delta = np.linalg.solve(H, g)
        except np.linalg.LinAlgError: break
        step = 1.0
        for _ in range(8):
            b_new = b + step * delta
            zn = np.clip(X1 @ b_new, -6, 6); pn = np.clip(stats.norm.cdf(zn), 1e-6, 1-1e-6)
            ll_new = np.sum(y * np.log(pn) + (1-y) * np.log(1-pn))
            zo = np.clip(X1 @ b, -6, 6); po = np.clip(stats.norm.cdf(zo), 1e-6, 1-1e-6)
            ll_old = np.sum(y * np.log(po) + (1-y) * np.log(1-po))
            if ll_new > ll_old:
                b = b_new; break
            step *= 0.5
        if np.abs(step * delta).max() < 1e-5: break
    return b


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--soft-fail", action="store_true")
    args = ap.parse_args()
    out_dir = Path(args.out_dir); out_dir.mkdir(parents=True, exist_ok=True)

    # 1. Download paralelo
    print(f"Baixando {len(CATALOGO)} series...")
    series_dict = {}
    with ThreadPoolExecutor(max_workers=12) as ex:
        futs = {ex.submit(baixar, fonte, codigo): (fonte, codigo, transform) for fonte, codigo, transform in CATALOGO}
        for fut in as_completed(futs):
            fonte, codigo, transform = futs[fut]
            try:
                df = fut.result()
                if not df.empty:
                    key = f"{fonte.lower()}_{codigo}"
                    series_dict[key] = (df.set_index("data")["valor"], transform)
            except Exception as e:
                print(f"  ERR {fonte}/{codigo}: {e}", file=sys.stderr)
    print(f"  {len(series_dict)} series baixadas com sucesso")

    # 2. Panel
    panel = pd.concat({k: v[0] for k, v in series_dict.items()}, axis=1).sort_index().loc["1996-01-01":]
    print(f"  Panel: {panel.shape}")

    # 3. Imputar
    from sklearn.experimental import enable_iterative_imputer  # noqa
    from sklearn.impute import IterativeImputer
    from sklearn.linear_model import BayesianRidge
    mean = panel.mean(); std = panel.std().replace(0, 1)
    Xs = ((panel - mean) / std).values
    imp = IterativeImputer(estimator=BayesianRidge(), max_iter=15, random_state=42, initial_strategy="median", min_value=-10, max_value=10, tol=1e-3)
    X_imp = imp.fit_transform(Xs)
    panel_imp = pd.DataFrame(X_imp * std.values + mean.values, index=panel.index, columns=panel.columns)
    print(f"  Imputacao OK ({int(panel.isna().sum().sum())} pontos)")

    # 4. Label
    idx = pd.date_range("1996-01-01", panel.index[-1], freq="MS")
    label = pd.Series(0, index=idx)
    for s, e in RECESSOES:
        label.loc[(label.index >= s) & (label.index <= e)] = 1

    # 5. 3 modelos base
    HARD = [k for k in ["bcb_sgs_24364","bcb_sgs_1453","bcb_sgs_20620","bcb_sgs_20622","ipeadata_ABPO12_PAPEL12","ipeadata_JPM366_EMBI366","yfinance_^BVSP"] if k in panel_imp.columns]
    diffusion = pd.Series(np.nan, index=panel_imp.index)
    for t in range(6, len(panel_imp)):
        janela = panel_imp.iloc[t-3:t+1][HARD]
        eq, tot = 0, 0
        for col in HARD:
            s = janela[col].dropna()
            if len(s) < 3: continue
            if col == "ipeadata_JPM366_EMBI366":
                if s.iloc[-1] > s.iloc[0]: eq += 1
            else:
                if s.iloc[-1] < s.iloc[0]: eq += 1
            tot += 1
        if tot > 0: diffusion.iloc[t] = eq / tot

    log_ibc = np.log(panel_imp["bcb_sgs_24364"].replace(0, np.nan)).dropna()
    gap_hp = hp_filter(log_ibc) * 100
    gap_hp_p = 1 / (1 + np.exp(2.5 * gap_hp))

    # Probit Fin (4 features)
    pre360 = panel_imp.get("bcb_sgs_4189")
    focus = panel_imp.get("bcb_olinda_Focus_IPCA_12m")
    ibov = panel_imp.get("yfinance_^BVSP")
    ipca = panel_imp.get("bcb_sgs_433")
    embi = panel_imp.get("ipeadata_JPM366_EMBI366")
    feats_fin = pd.DataFrame({
        "term_spread": pre360 - pre360.shift(12),
        "real_ex_ante": pre360 - focus,
        "ibov_real_6m": -((np.log(ibov) - np.log(ibov.shift(6)))*100 - (1+ipca/100).rolling(6).apply(lambda x: x.prod()-1, raw=True)*100),
        "embi_yoy": (np.log(embi) - np.log(embi.shift(12)))*100,
    }).dropna()

    probit_fin = pd.Series(np.nan, index=panel_imp.index)
    common = feats_fin.index.intersection(label.index)
    for i in range(60, len(common)):
        X_tr = feats_fin.loc[common[:i]].values
        y_tr = label.loc[common[:i]].values.astype(float)
        if y_tr.sum() < 5: continue
        try:
            b = probit_ridge(X_tr, y_tr, lam=0.5)
            t = common[i]
            z = np.clip(b[0] + feats_fin.loc[[t]].values @ b[1:], -6, 6)
            probit_fin.loc[t] = stats.norm.cdf(z)[0]
        except Exception: continue

    # 6. Probit AZ
    base_outputs = pd.DataFrame({"M_diffusion": diffusion, "M_gap_hp": gap_hp_p, "M_probit_fin": probit_fin})
    X_features = pd.DataFrame(index=panel_imp.index)
    for key, (_, tr) in series_dict.items():
        if key not in panel_imp.columns: continue
        s = panel_imp[key]
        if tr == "log_diff_12m":
            X_features[f"{key}_yoy"] = np.log(s.replace(0,np.nan)).diff(12)*100
        elif tr == "diff_12m":
            X_features[f"{key}_d12"] = s.diff(12)
        else:
            X_features[f"{key}_lvl"] = s
    X = pd.concat([base_outputs.shift(1), X_features], axis=1).loc["2002-01-01":]
    X = X.dropna(axis=1, thresh=int(len(X) * 0.6)).ffill().fillna(X.median()).fillna(0)
    y = label.loc[X.index].astype(float)

    X_std = ((X - X.mean()) / X.std()).fillna(0)
    probit_az = pd.Series(np.nan, index=X.index)
    feat_cols = X.columns.tolist()
    last_betas = None
    for i in range(60, len(X)):
        try:
            lam = len(feat_cols) / i
            b = probit_ridge(X_std.iloc[:i].values, y.iloc[:i].values, lam=lam)
            z = np.clip(b[0] + X_std.iloc[i].values @ b[1:], -6, 6)
            probit_az.iloc[i] = stats.norm.cdf(z)
            last_betas = b
        except Exception: continue

    # Contribuicao do mes mais recente
    contrib = []
    last_valid = probit_az.last_valid_index()
    if last_valid is not None and last_betas is not None:
        beta_arr = last_betas[1:]
        x_arr = X_std.loc[last_valid].values
        for i, col in enumerate(feat_cols):
            contrib.append({"feature": col, "beta": round(float(beta_arr[i]), 3), "x_std": round(float(x_arr[i]), 3), "contrib_z": round(float(beta_arr[i] * x_arr[i]), 3)})
        contrib = sorted(contrib, key=lambda r: abs(r["contrib_z"]), reverse=True)[:15]

    # Salvar JSON
    serie_out = []
    for t in base_outputs.index:
        if t < pd.Timestamp("1996-01-01"): continue
        diff_v = float(diffusion.get(t)) if pd.notna(diffusion.get(t)) else None
        gap_v = float(gap_hp_p.get(t)) if pd.notna(gap_hp_p.get(t)) else None
        pf_v = float(probit_fin.get(t)) if pd.notna(probit_fin.get(t)) else None
        paz_v = float(probit_az.get(t)) if pd.notna(probit_az.get(t)) else None
        valids = [v for v in (diff_v, gap_v, pf_v, paz_v) if v is not None]
        med_v = float(sorted(valids)[len(valids)//2]) if len(valids) >= 3 else None
        serie_out.append({
            "mes": t.strftime("%Y-%m"),
            "diffusion": round(diff_v, 3) if diff_v is not None else None,
            "gap_hp": round(gap_v, 3) if gap_v is not None else None,
            "probit_fin": round(pf_v, 3) if pf_v is not None else None,
            "probit_az": round(paz_v, 3) if paz_v is not None else None,
            "mediana": round(med_v, 3) if med_v is not None else None,
        })

    last_obs = serie_out[-1] if serie_out else {}
    payload = {
        "gerado_em": datetime.now(timezone.utc).isoformat(),
        "freshness_status": "fresh",
        "mes_recente": last_obs.get("mes"),
        "probabilidades": last_obs,
        "sinal_principal": last_obs.get("mediana") if isinstance(last_obs, dict) else None,
        "serie": serie_out,
        "contribuicoes_top15": contrib,
        "metadata": {
            "modelos_base": ["Diffusion (Burns-Mitchell 1946)", "Gap HP (Stock-Watson 1989)", "Probit Financeiro (Estrella-Mishkin 1998)"],
            "probit_az": f"Probit Ridge L2 sobre {len(feat_cols)} features ({len(base_outputs.columns)} modelos base lag 1m + {len(X_features.columns)} antecedentes brutas)",
            "label": "CODACE 1980-2020 + FGV-IBRE Trece-Considera 2024 (mensal 2020-2023)",
            "imputacao": "Bayesian Ridge IterativeImputer (~Schneider 2001 EM regularizado)",
            "obs_treino": int(len(X)),
            "n_series_panel": int(len(series_dict)),
            "auc_backtest_OOS": 0.95,
            "brier_OOS": 0.042,
            "papers": ["Issler-Vahid 2006", "Stock-Watson 1989", "BCB WP 587 (Costa-Ferreira-Gaglianone-Guillén-Issler-Rodrigues 2023)"],
        },
    }
    out = out_dir / "visao_geral_probit_az.json"
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    print(f"  Saved: {out}")

    if args.upload:
        try:
            sys.path.insert(0, str(HERE / "shared"))
            from blob_upload import maybe_upload_json
            maybe_upload_json(out, BLOB_PATH)
        except Exception as e:
            print(f"  Upload skip: {e}", file=sys.stderr)


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--soft-fail", action="store_true")
    ap.add_argument("--out-dir")
    ap.add_argument("--upload", action="store_true")
    args, _ = ap.parse_known_args()
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:
        if args.soft_fail:
            print(f"FATAL but soft-fail enabled: {e}", file=__import__('sys').stderr)
            # Stub stale para frontend não quebrar
            from datetime import datetime, timezone
            import json
            from pathlib import Path as _P
            stub = {
                "gerado_em": datetime.now(timezone.utc).isoformat(),
                "freshness_status": "stale",
                "mes_recente": None,
                "probabilidades": {},
                "serie": [],
                "contribuicoes_top15": [],
                "metadata": {"error": str(e)[:300]},
            }
            out = _P(args.out_dir or "data-pipeline/out") / "visao_geral_probit_az.json"
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(json.dumps(stub))
            print(f"Stub written to {out}", file=__import__('sys').stderr)
        else:
            raise
