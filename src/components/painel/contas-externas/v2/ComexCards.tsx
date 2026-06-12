"use client";

import { useMemo } from "react";

import type { CategoriaPonto, ContasExternasComexData, PaisPonto } from "@/lib/painel-contas-externas";
import { ChartCard, RankingTable, type RankingTableRow } from "@/components/painel/core";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import { fmtNum, fmtPct } from "@/lib/format-br";

/**
 * Bloco 07 — Comex em 3 cards (substitui as 8 telas estáticas antigas):
 * 1. categorias export/import como RANKING com share % sobre a soma do top;
 * 2. destinos/origens com o share da China em destaque;
 * 3. nota no lugar das séries de seção 24m — a leitura correta (contribuição
 *    YoY por seção) exige t-12 no builder; registrada como evolução.
 */

const TOP_CATEGORIAS = 15;
const TOP_PAISES = 10;

function truncaLabel(s: string, max = 38): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** Ranking com share % calculado sobre a SOMA do próprio top (declarado no rótulo). */
function comShare(itens: ReadonlyArray<{ label: string; valor: number }>): RankingTableRow[] {
  const soma = itens.reduce((acc, i) => acc + i.valor, 0);
  if (!(soma > 0)) return [];
  return itens.map((i) => ({
    label: truncaLabel(i.label),
    value: (100 * i.valor) / soma,
    hint: `US$ ${fmtNum(i.valor, 1)} bi`,
  }));
}

function topCategorias(categorias: ReadonlyArray<CategoriaPonto>): { label: string; valor: number }[] {
  return categorias
    .slice()
    .sort((a, b) => b.valor_us_bi - a.valor_us_bi)
    .slice(0, TOP_CATEGORIAS)
    .map((c) => ({ label: c.categoria, valor: c.valor_us_bi }));
}

function topPaises(paises: ReadonlyArray<PaisPonto>): { label: string; valor: number }[] {
  return paises
    .slice()
    .sort((a, b) => b.valor_us_bi - a.valor_us_bi)
    .slice(0, TOP_PAISES)
    .map((p) => ({ label: p.pais, valor: p.valor_us_bi }));
}

/** Share da China sobre a soma do top listado (null se a China não está no top). */
function shareChina(top: ReadonlyArray<{ label: string; valor: number }>): number | null {
  const soma = top.reduce((acc, p) => acc + p.valor, 0);
  if (!(soma > 0)) return null;
  const china = top.find((p) => /china/i.test(p.label) && !/hong\s*kong/i.test(p.label));
  return china ? (100 * china.valor) / soma : null;
}

export function ComexCards({ comex }: { comex: ContasExternasComexData }) {
  const catExp = useMemo(() => topCategorias(comex.categorias_export_12m), [comex.categorias_export_12m]);
  const catImp = useMemo(() => topCategorias(comex.categorias_import_12m), [comex.categorias_import_12m]);
  const dest = useMemo(() => topPaises(comex.top_destinos_12m), [comex.top_destinos_12m]);
  const orig = useMemo(() => topPaises(comex.top_origens_12m), [comex.top_origens_12m]);

  const chinaDest = useMemo(() => shareChina(dest), [dest]);
  const chinaOrig = useMemo(() => shareChina(orig), [orig]);

  const periodo = `${comex.periodo_12m.from} a ${comex.periodo_12m.to}`;
  const footerFontes = `Fonte: SECEX/MDIC Comex Stat (composição por produto e país), período ${periodo}. Os SALDOS agregados deste painel vêm do BCB (BPM6) e diferem dos números aduaneiros da SECEX — fontes distintas por desenho, não por erro.`;

  const tituloCategorias =
    catExp.length > 0
      ? `${truncaLabel(catExp[0].label, 48)} lidera a pauta exportadora (${fmtPct((100 * catExp[0].valor) / Math.max(1e-9, catExp.reduce((a, c) => a + c.valor, 0)), 0)} do top ${catExp.length})`
      : "O que o Brasil vende — e o que compra";

  const tituloPaises =
    chinaDest != null
      ? `China compra ${fmtPct(chinaDest, 0)} do top ${dest.length} de destinos${
          chinaOrig != null ? ` — e fornece ${fmtPct(chinaOrig, 0)} do top de origens` : ""
        }`
      : "Para onde as exportações vão — e de onde as importações vêm";

  return (
    <div className="space-y-4">
      <ChartCard
        title={tituloCategorias}
        subtitle={`Principais categorias de exportação e importação nos últimos 12 meses. O share é calculado sobre a soma do top ${TOP_CATEGORIAS} listado — não sobre o total exportado/importado.`}
        footer={footerFontes}
        stampGiro={comex.gerado_em}
        stampDado={comex.periodo_12m.to}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <RankingTable
            title={`Exportações — share do top ${catExp.length}`}
            dotColor={AZ_BRAND.azure}
            rows={comShare(catExp)}
            valueFmt={(v) => fmtPct(v, 1)}
          />
          <RankingTable
            title={`Importações — share do top ${catImp.length}`}
            dotColor={AZ_BRAND.navy}
            rows={comShare(catImp)}
            valueFmt={(v) => fmtPct(v, 1)}
          />
        </div>
      </ChartCard>

      <ChartCard
        title={tituloPaises}
        subtitle={`Top ${TOP_PAISES} destinos das exportações e origens das importações (12m). Share sobre a soma do top listado.`}
        footer={`${footerFontes} A concentração na China é o número a acompanhar: define a sensibilidade da pauta a um ciclo chinês.`}
        stampGiro={comex.gerado_em}
        stampDado={comex.periodo_12m.to}
      >
        <div className="mb-2 flex flex-wrap gap-2">
          {chinaDest != null ? (
            <span className="rounded-full bg-[#027DFC]/10 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-[#132960]">
              China: {fmtPct(chinaDest, 1)} do top de destinos
            </span>
          ) : null}
          {chinaOrig != null ? (
            <span className="rounded-full bg-[#132960]/10 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-[#132960]">
              China: {fmtPct(chinaOrig, 1)} do top de origens
            </span>
          ) : null}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <RankingTable
            title={`Destinos — share do top ${dest.length}`}
            dotColor={AZ_BRAND.azure}
            rows={comShare(dest)}
            valueFmt={(v) => fmtPct(v, 1)}
          />
          <RankingTable
            title={`Origens — share do top ${orig.length}`}
            dotColor={AZ_BRAND.navy}
            rows={comShare(orig)}
            valueFmt={(v) => fmtPct(v, 1)}
          />
        </div>
      </ChartCard>

      <ChartCard
        title="Contribuições por produto à variação do comércio — próxima evolução"
        subtitle="No lugar das oito telas estáticas de composição mensal por seção."
        footer={`Fonte: SECEX/MDIC Comex Stat, período ${periodo}.`}
        stampGiro={comex.gerado_em}
        stampDado={comex.periodo_12m.to}
      >
        <p className="rounded-xl border border-dashed border-[#132960]/15 bg-zinc-50/50 p-4 text-xs leading-relaxed text-zinc-600">
          As séries mensais empilhadas por seção do Sistema Harmonizado foram aposentadas: empilhar níveis mensais repete a
          sazonalidade da soja e do petróleo sem responder a pergunta que importa — <em>o que mudou</em>. A leitura correta é a
          contribuição de cada seção à variação interanual das exportações e importações, que exige o nível de 12 meses
          atrás (t-12) no builder do Comex. Evolução registrada na ficha técnica; até lá, os rankings acima respondem
          composição e os gráficos de 12m do bloco de comércio respondem tendência.
        </p>
      </ChartCard>
    </div>
  );
}
