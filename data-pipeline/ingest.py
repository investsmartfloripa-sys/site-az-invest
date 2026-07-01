#!/usr/bin/env python3
"""Ingest raw Mais Retorno get_quotes JSON staging files into the final fundos_quotes.json.

Each staging file lives in _staging/<key>.json where <key> is either "cdi" or a fund id
(with ':' replaced by '_'). The file content is the raw JSON object returned by get_quotes
(the part starting with {"nicename":...,"quotes":[...]}).
"""
import json, os, glob, datetime

BASE = os.path.dirname(os.path.abspath(__file__))
STAGING = os.path.join(BASE, "_staging")
OUT = os.path.join(BASE, "out", "fundos_quotes.json")

# id -> name mapping (order preserved)
FUNDS = [
    ("01221890000124:fi", "CSHG Verde"),
    ("12831360000114:fi", "SPX Nimitz"),
    ("12105992000109:fi", "Kapitalo Zeta"),
    ("30586677000114:fi", "Legacy Capital"),
    ("12154412000165:fi", "Ibiúna Hedge"),
    ("17087932000116:fi", "Bahia AM Maraú"),
    ("35828684000107:fi", "Genoa Capital Radar"),
    ("28581166000168:fi", "Vinland Macro"),
    ("31238370000195:fi", "Kinea Atlas"),
    ("08893082000152:fi", "Gávea Macro"),
    ("21470989000177:fi", "Absolute Vertex"),
    ("17162002000180:fi", "Occam Retorno Absoluto"),
    ("22918586000100:fi", "Asa Hedge"),
    ("26859555000187:fi", "Truxt Macro"),
    ("23731781000190:fi", "Kinea Chronos"),
    ("73232530000139:fi", "Dynamo Cougar"),
    ("08323402000139:fi", "Bogari Value"),
    ("12987743000186:fi", "Alaska Black"),
    ("35957054000124:fi", "Tork Long Only"),
    ("20658576000158:fi", "Moat Capital"),
    ("11145320000156:fi", "Atmos Ações"),
    ("10500884000105:fi", "Real Investor"),
    ("08671980000166:fi", "Constellation"),
    ("08940189000104:fi", "Velt"),
    ("09285146000103:fi", "Squadra Long Biased"),
    ("14284684000105:fi", "Brasil Capital 30"),
    ("22232927000190:fi", "Tarpon GT"),
    ("12565159000132:fi", "Sharp Equity Value"),
    ("21917184000129:fi", "Forpus Ações"),
    ("37487612000160:fi", "Encore Ações"),
    ("30921203000181:fi", "ARX Denali"),
    ("28767162000179:fi", "JGP Crédito"),
    ("22100009000107:fi", "AZ Quest Altro"),
    ("13615411000133:fi", "Capitânia Top"),
    ("35505971000178:fi", "SPX Seahawk"),
    ("17012208000123:fi", "Augme 90"),
    ("14188162000100:fi", "Sparta Top"),
    ("32760042000117:fi", "Icatu Vanguarda Credit Plus"),
    ("38658541000184:fi", "Vinci Crédito"),
    ("33701828000126:fi", "SulAmérica Crédito ESG"),
    ("49983964000196:fi", "Western Asset Crédito"),
    ("14171644000157:fi", "BTG Crédito Corporativo"),
    ("10326625000100:fi", "Valora Absolute"),
    ("20824446000148:fi", "JGP Corporate"),
    ("10783480000168:fi", "Daycoval Classic"),
]

def key_for(fund_id):
    return fund_id.replace(":", "_")

def parse_series(raw):
    """raw is dict with 'quotes': [{'d':date,'c':value}, ...]. Return sorted [ [date,value] ]."""
    quotes = raw.get("quotes", [])
    pairs = []
    for q in quotes:
        d = q.get("d")
        c = q.get("c")
        if d is None or c is None:
            continue
        pairs.append([d, float(c)])
    pairs.sort(key=lambda x: x[0])
    return pairs

def load_staging(name):
    path = os.path.join(STAGING, name + ".json")
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def main():
    # CDI
    cdi_raw = load_staging("cdi")
    cdi = parse_series(cdi_raw) if cdi_raw else []

    funds_out = {}
    all_dates = []
    missing = []
    short = []
    for fund_id, name in FUNDS:
        raw = load_staging(key_for(fund_id))
        if raw is None:
            missing.append(fund_id)
            continue
        series = parse_series(raw)
        if not series:
            missing.append(fund_id)
            continue
        funds_out[fund_id] = {"nome": name, "series": series}
        all_dates.append(series[-1][0])
        if len(series) < 100:
            short.append((fund_id, len(series)))

    if cdi:
        all_dates.append(cdi[-1][0])

    data_date = max(all_dates) if all_dates else None
    generated_at = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    out = {
        "generated_at": generated_at,
        "data_date": data_date,
        "cdi": cdi,
        "funds": funds_out,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

    # Report
    print("FUNDS_WRITTEN", len(funds_out))
    print("CDI_POINTS", len(cdi))
    print("DATA_DATE", data_date)
    if all_dates:
        mins = []
        for fid in funds_out:
            mins.append(funds_out[fid]["series"][0][0])
        if cdi:
            mins.append(cdi[0][0])
        print("MIN_DATE", min(mins))
    # points per fund summary
    counts = [len(v["series"]) for v in funds_out.values()]
    if counts:
        print("POINTS_MIN", min(counts), "POINTS_MAX", max(counts))
    print("MISSING", missing)
    print("SHORT", short)
    print("FILE_BYTES", os.path.getsize(OUT))

if __name__ == "__main__":
    main()
