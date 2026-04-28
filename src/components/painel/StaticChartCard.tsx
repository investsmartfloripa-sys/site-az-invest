"use client";

import Image from "next/image";

import { painelBlobUrl } from "@/lib/painel-blob";

type Props = {
  slug: string;
  title: string;
  badge?: string;
};

export function StaticChartCard({ slug, title, badge }: Props) {
  const url = painelBlobUrl(`charts/static/${slug}.svg`);

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
    </div>
  );
}
