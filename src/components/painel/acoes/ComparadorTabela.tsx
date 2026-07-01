"use client";

import { useMemo } from "react";

import { CompanyLogo } from "@/components/painel/acoes/CompanyLogo";
import { resolvePeriodRange, type AzPeriodValue, type AzSeriesPoint } from "@/components/painel/charts";
import { MethodInfo } from "@/components/painel/core/MethodInfo";
import { fmtBRL, fmtNum, fmtSignedPct } from "@/lib/format-br";
import { variationText } from "@/lib/az-chart-theme";

/**
 * Tabela que ACOMPANHA o comparador do hero (padrão consagrado pelos
 * comparadores de mercado): uma linha por ativo selecionado + o Ibovespa como
 * régua, com retornos por janela, volatilidade e dividend yield. Os retornos
 * são calculados das MESMAS séries plotadas (retorno total), então gráfico e
 * tabela nunca divergem.
 */

export type ComparadorAtivoRow = {
  ticker: string;
  label: string;
  color: string;
  /** Série [dateISO, valor] em retorno total (mesma do gráfico). */
  data: ReadonlyArray<AzSeriesPoint>;
  logoSrc?: string | null;
  /** Dividend yield 12m (%) — do screener. */
  dy12m?: number | null;
  /** Preço atual (BRL) — do screener. */
  price?: number | null;
};

type Props = {
  /** Série do Ibovespa (pontos) — vira a linha-régua. */
  ibovData: ReadonlyArray<AzSeriesPoint>;
  rows: ComparadorAtivoRow[];
  period: AzPeriodValue;
};

/** Retorno % entre o último valor <= from e o último <= to. null se não cobre. */
function returnBetween(data: ReadonlyArray<AzSeriesPoint>, fromISO: string, toISO: string): number | null {
  let first: number | null = null;
  let last: number | null = null;
  let firstDate: string | null = null;
  for (const [d, v] of data) {
    if (!Number.isFinite(v)) continue;
    if (d <= toISO) {
      if (first == null && d >= fromISO) {
        first = v;
        firstDate = d;
      }
      if (d >= fromISO) last = v;
    }
  }
  if (first == null || last == null || firstDate == null || !(first > 0)) return null;
  return 100 * (last / first - 1);
}

/** Vol anualizada (%) dos retornos diários no intervalo. null com < 40 obs. */
function annualizedVol(data: ReadonlyArray<AzSeriesPoint>, fromISO: string, toISO: string): number | null {
  const vals: number[] = [];
  for (const [d, v] of data) {
    if (d >= fromISO && d <= toISO && Number.isFinite(v) && v > 0) vals.push(v);
  }
  if (vals.length < 40) return null;
  const rets: number[] = [];
  for (let i = 1; i < vals.length; i++) rets.push(Math.log(vals[i] / vals[i - 1]));
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const varr = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
  return 100 * Math.sqrt(varr) * Math.sqrt(252);
}

function isoShiftDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
}

type ComputedRow = {
  key: string;
  label: string;
  color: string;
  logoSrc?: string | null;
  ticker?: string;
  isIndex: boolean;
  janela: number | null;
  ytd: number | null;
  m12: number | null;
  m24: number | null;
  vol12m: number | null;
  dy12m?: number | null;
  price?: number | null;
};

function Pct({ v }: { v: number | null }) {
  if (v == null) return <span className="text-zinc-300">—</span>;
  return (
    <span className="font-semibold tabular-nums" style={{ color: variationText(v) }}>
      {fmtSignedPct(v, 1)}
    </span>
  );
}

export function ComparadorTabela({ ibovData, rows, period }: Props) {
  const computed = useMemo<ComputedRow[]>(() => {
    // Range da união (mesma regra do gráfico) → janela selecionada.
    let minIso = "";
    let maxIso = "";
    for (const src of [ibovData, ...rows.map((r) => r.data)]) {
      for (const [d] of src) {
        if (!minIso || d < minIso) minIso = d;
        if (!maxIso || d > maxIso) maxIso = d;
      }
    }
    if (!minIso || !maxIso) return [];
    const { from, to } = resolvePeriodRange(period, minIso, maxIso);
    const ytdFrom = `${maxIso.slice(0, 4)}-01-01`;

    const compute = (data: ReadonlyArray<AzSeriesPoint>): Omit<ComputedRow, "key" | "label" | "color" | "isIndex"> => ({
      janela: returnBetween(data, from, to),
      ytd: returnBetween(data, ytdFrom, maxIso),
      m12: returnBetween(data, isoShiftDays(maxIso, 365), maxIso),
      m24: returnBetween(data, isoShiftDays(maxIso, 730), maxIso),
      vol12m: annualizedVol(data, isoShiftDays(maxIso, 365), maxIso),
    });

    return [
      {
        key: "ibov",
        label: "Ibovespa",
        color: "#027DFC",
        isIndex: true,
        ...compute(ibovData),
      },
      ...rows.map((r) => ({
        key: r.ticker,
        label: r.ticker,
        ticker: r.ticker,
        color: r.color,
        logoSrc: r.logoSrc,
        isIndex: false,
        ...compute(r.data),
        dy12m: r.dy12m,
        price: r.price,
      })),
    ];
  }, [ibovData, rows, period]);

  if (rows.length === 0 || computed.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-xl border border-[#132960]/10">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-[#132960]/10 bg-zinc-50/80 text-[11px] uppercase tracking-wide text-zinc-500">
            <th className="px-3 py-2 text-left font-semibold">
              Ativo
              <MethodInfo className="ml-1.5 align-middle">
                Retornos em retorno total (preço + dividendos reinvestidos), das mesmas séries do
                gráfico. &quot;Na janela&quot; usa o período selecionado acima; 12m/24m são janelas
                móveis até o último pregão. Vol 12m = desvio-padrão dos retornos diários
                anualizado (√252). DY 12m e preço vêm do screener (Yahoo Finance). Não é
                recomendação.
              </MethodInfo>
            </th>
            <th className="px-3 py-2 text-right font-semibold">Na janela</th>
            <th className="px-3 py-2 text-right font-semibold">No ano</th>
            <th className="px-3 py-2 text-right font-semibold">12m</th>
            <th className="px-3 py-2 text-right font-semibold">24m</th>
            <th className="px-3 py-2 text-right font-semibold">Vol 12m</th>
            <th className="px-3 py-2 text-right font-semibold">DY 12m</th>
            <th className="px-3 py-2 text-right font-semibold">Preço</th>
          </tr>
        </thead>
        <tbody>
          {computed.map((r) => (
            <tr
              key={r.key}
              className={`border-b border-[#132960]/5 last:border-0 ${r.isIndex ? "bg-[#027DFC]/[0.04]" : ""}`}
            >
              <td className="px-3 py-2">
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: r.color }}
                  />
                  {r.ticker ? (
                    <CompanyLogo ticker={r.ticker} name={r.label} src={r.logoSrc} size={22} />
                  ) : null}
                  <span className="font-semibold text-[#132960]">{r.label}</span>
                  {r.isIndex ? (
                    <span className="rounded-full bg-[#027DFC]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#027DFC]">
                      índice
                    </span>
                  ) : null}
                </span>
              </td>
              <td className="px-3 py-2 text-right"><Pct v={r.janela} /></td>
              <td className="px-3 py-2 text-right"><Pct v={r.ytd} /></td>
              <td className="px-3 py-2 text-right"><Pct v={r.m12} /></td>
              <td className="px-3 py-2 text-right"><Pct v={r.m24} /></td>
              <td className="px-3 py-2 text-right tabular-nums text-zinc-600">
                {r.vol12m == null ? <span className="text-zinc-300">—</span> : `${fmtNum(r.vol12m, 1)}%`}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-zinc-600">
                {r.dy12m == null ? <span className="text-zinc-300">—</span> : `${fmtNum(r.dy12m, 2)}%`}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-zinc-600">
                {r.price == null ? <span className="text-zinc-300">—</span> : fmtBRL(r.price)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
