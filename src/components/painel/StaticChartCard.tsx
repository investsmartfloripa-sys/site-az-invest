"use client";

import Image from "next/image";

import { painelBlobUrl } from "@/lib/painel-blob";

type Props = {
  slug: string;
  title: string;
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
  columns?: StaticChartTableColumn[];
  rows?: StaticChartTableRow[];
};

export function StaticChartCard({ slug, title, badge, cacheBuster, tableData }: Props) {
  const baseUrl = painelBlobUrl(`charts/static/${slug}.svg`);
  const url = baseUrl ? `${baseUrl}?v=${encodeURIComponent(cacheBuster ?? "1")}` : "";

  if (!url) {
    return (
      <div className="rounded-2xl border border-[#132960]/15 bg-white p-6">
        <h2 className="text-lg font-semibold text-[#027DFC]">{title}</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Defina <code className="rounded bg-zinc-100 px-1">NEXT_PUBLIC_BLOB_BASE_URL</code> para exibir
          os graficos estaticos.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-[#027DFC]">{title}</h2>
        {badge ? (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="relative aspect-[16/9] w-full max-h-[480px] min-h-[240px]">
        <Image
          src={url}
          alt={title}
          fill
          className="object-contain"
          unoptimized
          sizes="(max-width: 768px) 100vw, 896px"
        />
      </div>
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
    </div>
  );
}
