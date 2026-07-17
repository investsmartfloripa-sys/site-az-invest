import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import {
  ChartById,
  type IgpmRelease,
  type IpcaRelease,
} from "@/components/painel/publisher/ChartById";
import type { IpcaData } from "@/lib/painel-ipca";
import type { IgpmData } from "@/lib/painel-igpm";
import { painelBlobUrl } from "@/lib/painel-blob";
import { fmtMesLongo } from "@/lib/format-br";
import {
  DATA_BLOB_PATH,
  INDICADOR_LABEL,
  PAINEL_PATH,
  RELEASE_BLOB_PATH,
  getChartDef,
  type ChartDef,
} from "@/lib/publisher/chart-catalog";

/**
 * Página de render ISOLADO de um gráfico do catálogo do Publisher.
 *
 * Existe para UMA finalidade: o motor de imagens (Playwright, GitHub Actions)
 * fotografa o elemento #render-stage e arquiva o PNG numerado no Blob a cada
 * divulgação — usado como capa do post, og:image e imagem de WhatsApp.
 * (No CORPO dos posts o gráfico entra VIVO via marcador [az-chart:ID].)
 *
 * - `force-dynamic` + fetch `no-store`: o motor roda logo após o pipeline
 *   subir o JSON; cache ISR aqui significaria fotografar dado velho.
 * - `data-mes` no stage: o motor valida que o mês renderizado == mês do
 *   release antes de fotografar (contrato anti-cache-velho).
 * - `data-error` presente = dado indisponível; o motor registra a falha e pula.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Render de gráfico — AZ Invest",
  robots: { index: false, follow: false },
};

async function fetchFresh<T>(path: string): Promise<T | null> {
  const url = painelBlobUrl(path);
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function Stage({
  def,
  mes,
  children,
}: {
  def: ChartDef;
  mes: string | null;
  children: React.ReactNode | null;
}) {
  const erro = children == null;
  return (
    <main className="min-h-screen bg-zinc-100 px-6 py-8">
      <div
        id="render-stage"
        data-chart={def.id}
        data-mes={mes ?? ""}
        {...(erro ? { "data-error": "missing-data" } : {})}
        className="mx-auto w-[1080px] overflow-hidden rounded-2xl border border-[#132960]/10 bg-white shadow-md"
      >
        <header className="flex items-center justify-between gap-4 bg-[#132960] px-6 py-4">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
              {INDICADOR_LABEL[def.indicador]} · {def.id}
            </div>
            <div className="truncate text-lg font-bold text-white">{def.titulo}</div>
          </div>
          <Image
            src="/logo-az-branco.png"
            alt="AZ Invest"
            width={128}
            height={34}
            style={{ height: 34, width: "auto" }}
          />
        </header>
        <div className="p-5">
          {children ?? (
            <div className="flex h-64 items-center justify-center text-sm text-zinc-500">
              Dados desta visualização indisponíveis no momento.
            </div>
          )}
        </div>
        <footer className="flex items-center justify-between border-t border-zinc-200 px-6 py-3 text-[11px] text-zinc-500">
          <span>Referência: {mes ? fmtMesLongo(mes) : "—"}</span>
          <span>
            Gráfico interativo: investimentosdeaz.com.br{PAINEL_PATH[def.indicador]}
          </span>
        </footer>
      </div>
    </main>
  );
}

export default async function RenderChartPage({
  params,
}: {
  params: Promise<{ chartId: string }>;
}) {
  const { chartId } = await params;
  const def = getChartDef(decodeURIComponent(chartId));
  if (!def) notFound();

  if (def.indicador === "ipca") {
    const [data, release] = await Promise.all([
      fetchFresh<IpcaData>(DATA_BLOB_PATH.ipca),
      fetchFresh<IpcaRelease>(RELEASE_BLOB_PATH.ipca),
    ]);
    const mes = data?.mes_recente ?? release?.mes_referencia ?? null;
    return (
      <Stage def={def} mes={mes}>
        {ChartById({ id: def.id, data: { ipca: data, ipcaRelease: release } })}
      </Stage>
    );
  }

  const [data, release] = await Promise.all([
    fetchFresh<IgpmData>(DATA_BLOB_PATH.igpm),
    fetchFresh<IgpmRelease>(RELEASE_BLOB_PATH.igpm),
  ]);
  const mes = data?.mes_recente ?? release?.mes_referencia ?? null;
  return (
    <Stage def={def} mes={mes}>
      {ChartById({ id: def.id, data: { igpm: data, igpmRelease: release } })}
    </Stage>
  );
}
