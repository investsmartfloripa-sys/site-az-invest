import { fmtNum, fmtPct, fmtSignedPct } from "@/lib/format-br";
import type { FundoJanela, FundoRetornos, FundoRow } from "@/lib/painel-fundos-investimento-data";

const MINUS = "−";
const tm = (s: string) => s.replace(/-/g, MINUS);

const JANELAS: ReadonlyArray<{ id: FundoJanela; label: string }> = [
  { id: "3m", label: "3M" },
  { id: "6m", label: "6M" },
  { id: "ytd", label: "No ano" },
  { id: "12m", label: "12M" },
];

function ret(row: FundoRow, j: FundoJanela): number | null {
  const v = row.retornos?.[j];
  return v == null || !Number.isFinite(v) ? null : v;
}

function retClass(r: number | null, cdi: number | null): string {
  if (r == null) return "text-zinc-400";
  if (cdi != null) {
    if (r > cdi) return "text-[#16A34A]";
    if (r < cdi) return "text-[#DC2626]";
  } else if (r !== 0) {
    return r > 0 ? "text-[#16A34A]" : "text-[#DC2626]";
  }
  return "text-[#132960]";
}

function Tile({ label, value, sub, valueClass }: { label: string; value: string; sub?: string; valueClass?: string }) {
  return (
    <div className="rounded-xl border border-[#132960]/12 bg-white p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${valueClass ?? "text-[#132960]"}`}>{value}</p>
      {sub ? <p className="text-[10px] text-zinc-400">{sub}</p> : null}
    </div>
  );
}

export function FundoKpis({ fund, cdi }: { fund: FundoRow; cdi?: FundoRetornos }) {
  return (
    <section className="space-y-3">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Retorno acumulado <span className="font-normal normal-case text-zinc-400">(verde = acima do CDI)</span>
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {JANELAS.map((j) => {
            const r = ret(fund, j.id);
            const c = cdi?.[j.id] ?? null;
            return (
              <Tile
                key={j.id}
                label={j.label}
                value={fmtSignedPct(r)}
                valueClass={retClass(r, c)}
                sub={c != null ? `CDI ${fmtSignedPct(c)}` : undefined}
              />
            );
          })}
        </div>
      </div>
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Risco (12 meses)</p>
        <div className="grid grid-cols-3 gap-2">
          <Tile label="Volatilidade" value={fmtPct(fund.vol_12m)} />
          <Tile label="Sharpe vs CDI" value={tm(fmtNum(fund.sharpe_12m, 2))} />
          <Tile label="Máx. drawdown" value={tm(fmtPct(fund.drawdown_12m))} valueClass="text-zinc-600" />
        </div>
      </div>
    </section>
  );
}
