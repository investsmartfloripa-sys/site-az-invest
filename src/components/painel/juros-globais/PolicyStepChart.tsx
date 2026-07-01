"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { PolicyRow } from "@/lib/global-rates";

const GRID = "#E2E8F0";
const TICKS = "#64748B";
/** Mesma convenção da Selic implícita: D+0 preto, D-30 azul, D-90 azul claro. */
const PAL = { d0: "#000000", d30: "#2E74C9", d90: "#56B4E9", meeting: "#ff5713" } as const;

const tooltipStyle = {
  background: "#132960",
  border: "none",
  borderRadius: 8,
  color: "#fff",
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(19,41,96,.25)",
} as const;

const thClass = "py-2 pr-2 text-right font-semibold";
const tdClass = "py-1.5 pr-2 text-right tabular-nums";

function fmtRate(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(2).replace(".", ",")}%`;
}
function dateLabelBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}
function tsMonthLabel(t: number): string {
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const d = new Date(t);
  return `${months[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(2)}`;
}

/** Eixo Y alinhado a múltiplos de 0,25% (passo dos BCs). */
function quarterAxis(values: (number | null)[]): { domain: [number, number]; ticks: number[] } | undefined {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (v != null && Number.isFinite(v)) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return undefined;
  const range = hi - lo || 0.25;
  const pad = Math.max(0.05, range * 0.08);
  let step = 0.25;
  for (const s of [0.25, 0.5, 1, 1.5, 2]) {
    if ((range + 2 * pad) / s <= 10) {
      step = s;
      break;
    }
  }
  const snap = (x: number, dir: 1 | -1) =>
    (dir < 0 ? Math.floor((x - 1e-9) / step) : Math.ceil((x + 1e-9) / step)) * step;
  const dlo = snap(lo - pad, -1);
  const dhi = snap(hi + pad, 1);
  const ticks: number[] = [];
  for (let v = dlo; v <= dhi + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return { domain: [Math.round(dlo * 100) / 100, Math.round(dhi * 100) / 100], ticks };
}
const quarterTickFmt = (v: number | string) => `${Number(v).toFixed(2).replace(".", ",")}%`;

/**
 * Gráfico + tabela da política monetária implícita, no PADRÃO da Selic implícita:
 * três séries escada (D+0 / D-30 / D-90 — como a expectativa se moveu) + linhas
 * verticais nas reuniões do banco central + tabela por reunião/degrau.
 */
export function PolicyStepChart({
  rows,
  meetings,
  labels,
  note,
}: {
  rows: PolicyRow[];
  meetings: string[];
  labels: { d0: string; d30: string; d90: string };
  note: string;
}) {
  const data = useMemo(
    () => rows.map((r) => ({ t: Date.parse(r.date), d0: r.d0, d30: r.d30, d90: r.d90 })),
    [rows],
  );
  const yAxis = useMemo(() => quarterAxis(rows.flatMap((r) => [r.d0, r.d30, r.d90])), [rows]);
  const hasD30 = rows.some((r) => r.d30 != null);
  const hasD90 = rows.some((r) => r.d90 != null);
  const anchorISO = rows[0]?.date;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
      <div className="min-w-0">
        <div className="h-[300px] w-full md:h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 18, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid stroke={GRID} strokeWidth={1} />
              {meetings.map((m, idx) => {
                const t = Date.parse(m);
                if (!Number.isFinite(t)) return null;
                return (
                  <ReferenceLine
                    key={m}
                    x={t}
                    stroke={PAL.meeting}
                    strokeDasharray="4 4"
                    strokeWidth={1.1}
                    label={
                      idx % 2 === 0
                        ? { value: dateLabelBR(m).slice(0, 5), position: "top", fontSize: 9, fontWeight: 700, fill: "#000" }
                        : undefined
                    }
                  />
                );
              })}
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(t) => tsMonthLabel(Number(t))}
                tick={{ fontSize: 10, fill: TICKS }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: TICKS }}
                width={58}
                domain={yAxis?.domain ?? ["auto", "auto"]}
                ticks={yAxis?.ticks}
                tickFormatter={quarterTickFmt}
                axisLine={false}
                tickLine={false}
                label={{ value: "Taxa (% a.a.)", angle: -90, position: "insideLeft", fontSize: 10, fill: TICKS }}
              />
              <Tooltip
                labelFormatter={(t) => tsMonthLabel(Number(t))}
                formatter={(v, name) => [fmtRate(typeof v === "number" ? v : Number(v)), String(name)]}
                contentStyle={tooltipStyle}
                itemStyle={{ color: "#fff" }}
                labelStyle={{ color: "#94A3B8", fontWeight: 600 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {hasD90 ? (
                <Line type="stepAfter" dataKey="d90" name={labels.d90} stroke={PAL.d90} strokeWidth={1.6} dot={{ r: 2 }} connectNulls isAnimationActive={false} />
              ) : null}
              {hasD30 ? (
                <Line type="stepAfter" dataKey="d30" name={labels.d30} stroke={PAL.d30} strokeWidth={1.6} dot={{ r: 2 }} connectNulls isAnimationActive={false} />
              ) : null}
              <Line type="stepAfter" dataKey="d0" name={labels.d0} stroke={PAL.d0} strokeWidth={2.4} dot={{ r: 2.5 }} connectNulls isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-[11px] text-zinc-500">{note}</p>
      </div>

      <div className="min-w-0 overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-200 text-[10px] uppercase tracking-wider text-zinc-500">
              <th className="py-2 pr-2 text-left font-semibold">Degrau</th>
              {hasD90 ? <th className={thClass}>D-90</th> : null}
              {hasD30 ? <th className={thClass}>D-30</th> : null}
              <th className={thClass}>D+0</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((r) => (
              <tr key={r.date}>
                <td className="py-1.5 pr-2 font-semibold text-[#132960]">
                  {r.date === anchorISO ? "Vigente" : dateLabelBR(r.date)}
                </td>
                {hasD90 ? <td className={`${tdClass} text-zinc-400`}>{fmtRate(r.d90)}</td> : null}
                {hasD30 ? <td className={`${tdClass} text-zinc-500`}>{fmtRate(r.d30)}</td> : null}
                <td className={`${tdClass} font-semibold text-[#132960]`}>{fmtRate(r.d0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
