import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { KpiCard } from "@/components/painel/core";
import { AnchorContribuicoes } from "@/components/painel/inflacao/v2/AnchorContribuicoes";
import { NucleosCard } from "@/components/painel/inflacao/v2/NucleosCard";
import { DifusaoCard } from "@/components/painel/inflacao/v2/DifusaoCard";
import { SazonalidadeCard } from "@/components/painel/inflacao/v2/SazonalidadeCard";
import { GruposMesCard } from "@/components/painel/inflacao/v3/GruposMesCard";
import { HeatmapGruposCard } from "@/components/painel/inflacao/v3/HeatmapGruposCard";
import { MomentumCard } from "@/components/painel/inflacao/v3/MomentumCard";
import { SerieLongaCard } from "@/components/painel/inflacao/v3/SerieLongaCard";
import { AncoragemCard } from "@/components/painel/inflacao/v3/AncoragemCard";
import { FocusMensalCard } from "@/components/painel/inflacao/v3/FocusMensalCard";
import { SurpresasCard } from "@/components/painel/inflacao/v3/SurpresasCard";
import { TabelaSinteseCard } from "@/components/painel/inflacao/v3/TabelaSinteseCard";
import { AluguelCard } from "@/components/painel/inflacao/v2igpm/AluguelCard";
import { ComponentePane } from "@/components/painel/inflacao/v3igpm/ComponentePane";
import { Decomposicao12mCard } from "@/components/painel/inflacao/v3igpm/Decomposicao12mCard";
import { DecomposicaoMesCard } from "@/components/painel/inflacao/v3igpm/DecomposicaoMesCard";
import { FocusAnosIgpmCard } from "@/components/painel/inflacao/v3igpm/FocusAnosIgpmCard";
import { OrigemIpaCard } from "@/components/painel/inflacao/v3igpm/OrigemIpaCard";
import { SazonalidadeIgpmCard } from "@/components/painel/inflacao/v3igpm/SazonalidadeIgpmCard";
import { SerieLongaIgpmCard } from "@/components/painel/inflacao/v3igpm/SerieLongaIgpmCard";
import { TabelaSinteseIgpmCard } from "@/components/painel/inflacao/v3igpm/TabelaSinteseIgpmCard";
import type { IpcaData } from "@/lib/painel-ipca";
import type { IgpmData } from "@/lib/painel-igpm";
import { painelBlobUrl } from "@/lib/painel-blob";
import { fmtMesLongo, fmtPct, fmtSignedPct } from "@/lib/format-br";
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
 * divulgação. Sem menu, sem tabs — só o gráfico com moldura de marca.
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

/** Campos do release (schema v1) usados na capa de KPIs — tolerante a ausências. */
type ReleaseHeadline = {
  var_mes: number | null;
  acum_ano?: number | null;
  acum_12m: number | null;
};
type ReleaseComum = {
  mes_referencia: string;
  headline: ReleaseHeadline;
  expectativa_mes?: { mediana?: number | null; surpresa_pp?: number | null } | null;
};
type IpcaRelease = ReleaseComum & {
  nucleos?: { media_12m?: number | null } | null;
  difusao?: { valor?: number | null; media_historica?: number | null } | null;
  meta?: { meta?: number | null; piso?: number | null; teto?: number | null } | null;
};
type IgpmRelease = ReleaseComum & {
  reajuste_aluguel?: { aplicado_pct?: number | null } | null;
  posicao_historica?: { percentil?: number | null } | null;
};

function IpcaKpis({ release }: { release: IpcaRelease }) {
  const h = release.headline;
  const e = release.expectativa_mes;
  const nuc = release.nucleos?.media_12m ?? null;
  const dif = release.difusao?.valor ?? null;
  const difMedia = release.difusao?.media_historica ?? null;
  const meta = release.meta?.meta ?? null;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiCard
        label="IPCA do mês"
        value={fmtSignedPct(h.var_mes, 2)}
        delta={e?.surpresa_pp ?? null}
        deltaUnit="p.p."
        deltaHint="vs Focus véspera"
        invertColor
        hint={e?.mediana != null ? `Focus véspera: ${fmtSignedPct(e.mediana, 2)}` : undefined}
      />
      <KpiCard
        label="IPCA 12 meses"
        value={fmtPct(h.acum_12m, 2)}
        delta={h.acum_12m != null && meta != null ? h.acum_12m - meta : null}
        deltaUnit="p.p."
        deltaHint={meta != null ? `vs meta ${fmtPct(meta, 1)}` : undefined}
        invertColor
        hint={
          release.meta?.piso != null && release.meta?.teto != null
            ? `banda: ${fmtPct(release.meta.piso, 1)} a ${fmtPct(release.meta.teto, 1)}`
            : undefined
        }
      />
      <KpiCard
        label="Núcleos 12m (média)"
        value={fmtPct(nuc, 2)}
        delta={nuc != null && meta != null ? nuc - meta : null}
        deltaUnit="p.p."
        deltaHint={meta != null ? `vs meta ${fmtPct(meta, 1)}` : undefined}
        invertColor
        hint="EX0 · EX3 · MS · DP · P"
      />
      <KpiCard
        label="Difusão do mês"
        value={fmtPct(dif, 1)}
        delta={dif != null && difMedia != null ? dif - difMedia : null}
        deltaUnit="p.p."
        deltaHint="vs média histórica"
        invertColor
        hint="% de subitens em alta"
      />
    </div>
  );
}

function IgpmKpis({ release }: { release: IgpmRelease }) {
  const h = release.headline;
  const e = release.expectativa_mes;
  const reajuste = release.reajuste_aluguel?.aplicado_pct ?? null;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiCard
        label="IGP-M do mês"
        value={fmtSignedPct(h.var_mes, 2)}
        delta={e?.surpresa_pp ?? null}
        deltaUnit="p.p."
        deltaHint="vs Focus véspera"
        invertColor
        hint={e?.mediana != null ? `Focus véspera: ${fmtSignedPct(e.mediana, 2)}` : undefined}
      />
      <KpiCard label="Acumulado no ano" value={fmtSignedPct(h.acum_ano ?? null, 2)} delta={null} />
      <KpiCard
        label="IGP-M 12 meses"
        value={fmtSignedPct(h.acum_12m, 2)}
        delta={null}
        hint={
          release.posicao_historica?.percentil != null
            ? `percentil pós-96: ${Math.round(release.posicao_historica.percentil)}`
            : undefined
        }
      />
      <KpiCard
        label="Reajuste de aluguel do mês"
        value={fmtPct(reajuste, 2)}
        delta={null}
        hint={reajuste != null ? "IGP-M 12m no aniversário" : undefined}
      />
    </div>
  );
}

function renderIpca(id: string, data: IpcaData | null, release: IpcaRelease | null) {
  switch (id) {
    case "IPCA-00":
      return release ? <IpcaKpis release={release} /> : null;
    case "IPCA-01":
      return data?.serie_longa ? <SerieLongaCard longa={data.serie_longa} geradoEm={data.gerado_em} /> : null;
    case "IPCA-02":
      return data?.abertura_hierarquica ? (
        <GruposMesCard hierarquia={data.abertura_hierarquica} mesRef={data.mes_recente} geradoEm={data.gerado_em} />
      ) : null;
    case "IPCA-03":
      return data ? <AnchorContribuicoes indice={data.ipca_cheio} geradoEm={data.gerado_em} /> : null;
    case "IPCA-04":
      return data ? <NucleosCard nucleos={data.nucleos} geradoEm={data.gerado_em} /> : null;
    case "IPCA-05":
      return data?.momentum ? <MomentumCard momentum={data.momentum} geradoEm={data.gerado_em} /> : null;
    case "IPCA-06":
      return data ? <DifusaoCard difusao={data.difusao} geradoEm={data.gerado_em} /> : null;
    case "IPCA-07":
      return data ? <SazonalidadeCard data={data} /> : null;
    case "IPCA-08":
      return data?.focus_mensal ? (
        <FocusMensalCard
          focusMensal={data.focus_mensal}
          realizadoMes={release?.headline.var_mes ?? null}
          geradoEm={data.gerado_em}
        />
      ) : null;
    case "IPCA-09":
      return data?.focus_mensal && data.focus_mensal.surpresas.length > 0 ? (
        <SurpresasCard focusMensal={data.focus_mensal} geradoEm={data.gerado_em} />
      ) : null;
    case "IPCA-10":
      return data ? <HeatmapGruposCard indice={data.ipca_cheio} geradoEm={data.gerado_em} /> : null;
    case "IPCA-11":
      return data?.focus_12m && data.focus_12m.length > 0 ? (
        <AncoragemCard focus12m={data.focus_12m} geradoEm={data.gerado_em} />
      ) : null;
    case "IPCA-12":
      return data?.tabela_sintese ? (
        <TabelaSinteseCard sintese={data.tabela_sintese} geradoEm={data.gerado_em} />
      ) : null;
    default:
      return null;
  }
}

function renderIgpm(id: string, data: IgpmData | null, release: IgpmRelease | null) {
  switch (id) {
    case "IGPM-00":
      return release ? <IgpmKpis release={release} /> : null;
    case "IGPM-01":
      return data?.serie_longa ? <SerieLongaIgpmCard longa={data.serie_longa} geradoEm={data.gerado_em} /> : null;
    case "IGPM-02":
      return data?.tabela_sintese ? (
        <DecomposicaoMesCard sintese={data.tabela_sintese} geradoEm={data.gerado_em} />
      ) : null;
    case "IGPM-03":
      return data?.decomposicao_12m && data.decomposicao_12m.serie.length > 0 ? (
        <Decomposicao12mCard decomp={data.decomposicao_12m} geradoEm={data.gerado_em} />
      ) : null;
    case "IGPM-04":
      return data ? <ComponentePane data={data} comp="IPA-M" geradoEm={data.gerado_em} /> : null;
    case "IGPM-05":
      return data ? <ComponentePane data={data} comp="IPC-M" geradoEm={data.gerado_em} /> : null;
    case "IGPM-06":
      return data ? <ComponentePane data={data} comp="INCC-M" geradoEm={data.gerado_em} /> : null;
    case "IGPM-07":
      return data?.origem_ipa ? <OrigemIpaCard origem={data.origem_ipa} geradoEm={data.gerado_em} /> : null;
    case "IGPM-08":
      return data ? <SazonalidadeIgpmCard data={data} /> : null;
    case "IGPM-09":
      return data?.aluguel && data.aluguel.reajustes.length > 0 ? (
        <AluguelCard aluguel={data.aluguel} geradoEm={data.gerado_em} />
      ) : null;
    case "IGPM-10":
      return data?.focus_mensal ? (
        <FocusMensalCard
          focusMensal={data.focus_mensal}
          realizadoMes={release?.headline.var_mes ?? null}
          geradoEm={data.gerado_em}
          indicador="IGP-M"
        />
      ) : null;
    case "IGPM-11":
      return data?.focus_mensal && data.focus_mensal.surpresas.length > 0 ? (
        <SurpresasCard focusMensal={data.focus_mensal} geradoEm={data.gerado_em} indicador="IGP-M" />
      ) : null;
    case "IGPM-12":
      return data?.focus_anuais && Object.keys(data.focus_anuais).length > 0 ? (
        <FocusAnosIgpmCard focus={data.focus_anuais} geradoEm={data.gerado_em} />
      ) : null;
    case "IGPM-13":
      return data?.tabela_sintese ? (
        <TabelaSinteseIgpmCard sintese={data.tabela_sintese} geradoEm={data.gerado_em} />
      ) : null;
    default:
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
        {renderIpca(def.id, data, release)}
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
      {renderIgpm(def.id, data, release)}
    </Stage>
  );
}
