"use client";

import { painelBlobUrl } from "@/lib/painel-blob";
import { formatUpdatedAt } from "./formatUpdatedAt";

type Props = {
  slug: string;
  /** URL absoluta do SVG (preferir: calculada no servidor com painelBlobUrl). */
  svgPublicSrc?: string | null;
  title: string;
  subtitle?: string;
  badge?: string;
  cacheBuster?: string;
  tableData?: StaticChartTablePayload | null;
};

type StaticChartTableColumn = {
  key: string;
  label: string;
};

type StaticChartTableRow = Record<string, string | number | null>;

export type StaticChartTablePayload = {
  status?: string;
  generated_at?: string;
  /** Refdate da curva "Hoje" (pode estar atrasado em relação ao dia corrente). */
  ref_today?: string;
  /** Data de hoje quando o pipeline rodou — âncora visual do gráfico. */
  chart_start?: string;
  /** chart_start + 12 meses. */
  chart_end?: string;
  /** Dias corridos entre chart_start e ref_today; > 1 indica curva atrasada. */
  curve_lag_calendar_days?: number;
  columns?: StaticChartTableColumn[];
  rows?: StaticChartTableRow[];
};

export function StaticChartCard({
  slug,
  svgPublicSrc,
  title,
  subtitle,
  badge,
  cacheBuster,
  tableData,
}: Props) {
  const baseUrl = (svgPublicSrc?.trim() || painelBlobUrl(`charts/static/${slug}.svg`)).trim();
  const url = baseUrl ? `${baseUrl}?v=${encodeURIComponent(cacheBuster ?? "1")}` : "";
  const updatedAt = formatUpdatedAt(tableData?.generated_at);
  const curveLag = tableData?.curve_lag_calendar_days;
  const refTodayLabel = tableData?.ref_today
    ? new Date(`${tableData.ref_today}T12:00:00`).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;
  const showStaleWarning = typeof curveLag === "number" && curveLag > 1 && refTodayLabel != null;

  if (!url) {
    return (
      <div className="w-full min-w-0 rounded-2xl border border-[#132960]/15 bg-white p-6">
        <h2 className="text-lg font-semibold text-[#027DFC]">{title}</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Defina <code className="rounded bg-zinc-100 px-1">NEXT_PUBLIC_BLOB_BASE_URL</code> (build) ou{" "}
          <code className="rounded bg-zinc-100 px-1">PAINEL_BLOB_PUBLIC_FALLBACK</code> no servidor para
          exibir os graficos estaticos.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-[#027DFC]">{title}</h2>
          {subtitle ? <p className="text-sm text-zinc-600">{subtitle}</p> : null}
        </div>
        {badge ? (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="w-full overflow-hidden rounded-xl border border-zinc-100 bg-white">
        {/* <img>: SVG no Vercel Blob nao deve passar pelo next/image; remotePatterns pode nao incluir o host no build. */}
        <img
          src={url}
          alt={title}
          className="h-auto w-full"
          loading="lazy"
          decoding="async"
        />
      </div>
      {showStaleWarning ? (
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
          Curva mais recente disponível: {refTodayLabel} ({curveLag} dias atrás). Aguardando publicação da
          fonte{badge ? ` (${badge})` : ""}.
        </p>
      ) : null}
      {updatedAt ? <p className="mt-2 text-xs italic text-zinc-700">Atualizado em {updatedAt}</p> : null}
      {tableData?.status === "ok" && (tableData.rows?.length ?? 0) > 0 && (tableData.columns?.length ?? 0) > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200">
          <table className="min-w-full divide-y divide-zinc-200 text-xs">
            <thead className="bg-zinc-50">
              <tr>
                {tableData.columns?.map((col) => (
                  <th key={col.key} className="px-3 py-2 text-left font-semibold text-zinc-700">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {tableData.rows?.map((row, idx) => (
                <tr key={`${slug}-row-${idx}`}>
                  {tableData.columns?.map((col) => (
                    <td key={`${slug}-${idx}-${col.key}`} className="whitespace-nowrap px-3 py-2 text-zinc-700">
                      {row[col.key] == null ? "—" : String(row[col.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
  