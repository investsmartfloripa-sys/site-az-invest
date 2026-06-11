"use client";

import { useMemo, useState } from "react";

import { AzPeriodSelector, AzTimeSeriesChart, type AzPeriodValue, type AzTimeSeries } from "@/components/painel/charts";
import { AzSegmented, ChartCard, KpiCard } from "@/components/painel/core";
import { PipelinePendingCard } from "@/components/painel/PipelinePendingCard";
import { variationText } from "@/lib/az-chart-theme";
import { fmtNum, fmtSignedPct } from "@/lib/format-br";
import {
  PANORAMA_PERIODS,
  type HistorySlice,
  type PanoramaPeriodKey,
  type WorldIndicesReturnsPayload,
} from "@/lib/painel-mercado-global";

/**
 * Dashboard de Índices globais (mercado · global): tabela de retornos por
 * período separando desenvolvidos de emergentes + comparativo histórico
 * rebase 100 com presets Desenvolvidos / Emergentes / Américas.
 */

// ── Presets do comparativo histórico (tickers disponíveis no market_history_full) ──
const HISTORY_PRESETS: { id: string; label: string; tickers: string[] }[] = [
  { id: "desenvolvidos", label: "Desenvolvidos", tickers: ["^GSPC", "^STOXX50E", "^FTSE", "^N225"] },
  { id: "emergentes", label: "Emergentes", tickers: ["^BVSP", "^HSI", "000001.SS"] },
  { id: "americas", label: "Américas", tickers: ["^GSPC", "^IXIC", "^DJI", "^BVSP"] },
];

const HISTORY_LABELS: Record<string, string> = {
  "^GSPC": "S&P 500",
  "^STOXX50E": "Euro Stoxx 50",
  "^FTSE": "FTSE 100",
  "^N225": "Nikkei 225",
  "^GDAXI": "DAX",
  "^BVSP": "Ibovespa",
  "^HSI": "Hang Seng",
  "000001.SS": "Xangai",
  "^IXIC": "Nasdaq",
  "^DJI": "Dow Jones",
};

const KPI_TICKERS: { ticker: string; label: string }[] = [
  { ticker: "^GSPC", label: "EUA (S&P 500)" },
  { ticker: "^GDAXI", label: "Alemanha (DAX)" },
  { ticker: "^N225", label: "Japão (Nikkei 225)" },
  { ticker: "000001.SS", label: "China (SSE)" },
];

type TableRow = {
  ticker: string;
  name: string;
  returns: Partial<Record<PanoramaPeriodKey, number | null>>;
};

/** Pivota o by_period (período → lista) em linhas por índice com coluna por período. */
function buildTable(payload: WorldIndicesReturnsPayload | null): {
  developed: TableRow[];
  emerging: TableRow[];
} {
  const map = new Map<string, TableRow & { group: string }>();
  for (const { id } of PANORAMA_PERIODS) {
    const rows = payload?.by_period?.[id]?.data ?? [];
    for (const r of rows) {
      if (!r?.ticker) continue;
      let entry = map.get(r.ticker);
      if (!entry) {
        entry = { ticker: r.ticker, name: r.name ?? r.ticker, group: r.group ?? "emerging", returns: {} };
        map.set(r.ticker, entry);
      }
      entry.returns[id] = typeof r.return_pct === "number" && Number.isFinite(r.return_pct) ? r.return_pct : null;
    }
  }
  const all = [...map.values()].sort((a, b) => (b.returns["1y"] ?? -Infinity) - (a.returns["1y"] ?? -Infinity));
  return {
    developed: all.filter((r) => r.group === "developed"),
    emerging: all.filter((r) => r.group !== "developed"),
  };
}

function ReturnCell({ value }: { value: number | null | undefined }) {
  if (value == null) return <td className="px-2 py-1.5 text-right text-zinc-400">—</td>;
  return (
    <td className="px-2 py-1.5 text-right font-semibold tabular-nums" style={{ color: variationText(value, 0) }}>
      {fmtSignedPct(value, 1)}
    </td>
  );
}

function GroupRows({ title, rows }: { title: string; rows: TableRow[] }) {
  return (
    <>
      <tr>
        <td colSpan={PANORAMA_PERIODS.length + 1} className="px-2 pb-1 pt-3">
          <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">{title}</span>
        </td>
      </tr>
      {rows.map((r) => (
        <tr key={r.ticker} className="border-t border-zinc-100">
          <td className="max-w-[220px] truncate px-2 py-1.5 text-[#132960]">{r.name}</td>
          {PANORAMA_PERIODS.map((p) => (
            <ReturnCell key={p.id} value={r.returns[p.id]} />
          ))}
        </tr>
      ))}
    </>
  );
}

type Props = {
  panorama: WorldIndicesReturnsPayload | null;
  history: HistorySlice;
};

export function IndicesGlobaisDashboard({ panorama, history }: Props) {
  const [preset, setPreset] = useState<string>("desenvolvidos");
  const [histPeriod, setHistPeriod] = useState<AzPeriodValue>({ id: "1y" });

  const table = useMemo(() => buildTable(panorama), [panorama]);
  const hasTable = table.developed.length > 0 || table.emerging.length > 0;

  const kpis = useMemo(() => {
    const rows = panorama?.by_period?.["1d"]?.data ?? [];
    return KPI_TICKERS.map((k) => {
      const row = rows.find((r) => r.ticker === k.ticker) ?? null;
      return {
        label: k.label,
        value: row?.end_price != null ? fmtNum(row.end_price, 0) : "—",
        delta: row != null && Number.isFinite(row.return_pct ?? NaN) ? row.return_pct : null,
      };
    });
  }, [panorama]);

  const activePreset = HISTORY_PRESETS.find((p) => p.id === preset) ?? HISTORY_PRESETS[0];
  const historySeries = useMemo<AzTimeSeries[]>(
    () =>
      activePreset.tickers
        .map((ticker) => history.series.find((s) => s.ticker === ticker))
        .filter((s): s is NonNullable<typeof s> => s != null)
        .map((s) => ({ id: s.ticker, label: HISTORY_LABELS[s.ticker] ?? s.label, data: s.data })),
    [activePreset, history.series],
  );

  const histMin = history.series.length > 0 ? history.series[0].data[0]?.[0] : undefined;
  const histMax = history.lastDataDate ?? undefined;

  return (
    <div className="space-y-6">
      {/* KPIs (fechamento + variação 1D) */}
      {panorama ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((k) => (
            <KpiCard key={k.label} label={k.label} value={k.value} unit="pts" delta={k.delta} deltaHint="1D" />
          ))}
        </div>
      ) : null}

      {/* Tabela de retornos por período */}
      {panorama && hasTable ? (
        <ChartCard
          title="Retornos por período — desenvolvidos × emergentes"
          subtitle="Variação do índice em moeda local; ordenado pelo retorno de 12 meses"
          footer={<>Brasil entra via EWZ (ETF em US$ listado em NY) na cesta do pipeline. Fonte: Yahoo Finance, giro a cada 15 min.</>}
          stampGiro={panorama.generated_at}
          stampDado={panorama.generated_at}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-zinc-500">
                  <th className="px-2 py-1.5 text-left font-semibold">Índice</th>
                  {PANORAMA_PERIODS.map((p) => (
                    <th key={p.id} className="px-2 py-1.5 text-right font-semibold">
                      {p.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <GroupRows title="Desenvolvidos" rows={table.developed} />
                <GroupRows title="Emergentes" rows={table.emerging} />
              </tbody>
            </table>
          </div>
        </ChartCard>
      ) : (
        <PipelinePendingCard blobPaths={["data/world_indices_returns_panorama.json"]} workflow="data-pipeline.yml" />
      )}

      {/* Comparativo histórico rebase 100 */}
      {history.series.length > 0 ? (
        <ChartCard
          title="Comparativo histórico — rebase 100"
          subtitle="Todas as séries valem 100 no primeiro pregão da janela; acima de 100 = acumulou alta desde o início"
          toolbar={
            <AzSegmented
              ariaLabel="Grupo de índices"
              value={preset}
              onChange={setPreset}
              options={HISTORY_PRESETS.map((p) => ({ id: p.id, label: p.label }))}
            />
          }
          footer={
            <>
              Pontos de fechamento em moeda local (5 anos diários) — o rebase compara trajetória,
              não retorno em moeda comum. O histórico cobre o subconjunto de índices do catálogo
              diário; Coreia, Taiwan e Índia aparecem só na tabela acima.
            </>
          }
          stampGiro={history.generatedAt}
          stampDado={history.lastDataDate}
        >
          <div className="space-y-3">
            <AzPeriodSelector value={histPeriod} onChange={setHistPeriod} min={histMin} max={histMax} />
            <AzTimeSeriesChart
              series={historySeries}
              mode="rebase100"
              period={histPeriod}
              height={340}
              forwardFill
            />
          </div>
        </ChartCard>
      ) : (
        <PipelinePendingCard blobPaths={["data/market_history_full.json"]} workflow="market-data.yml" />
      )}
    </div>
  );
}
