"use client";

import { useMemo, useState } from "react";

import type { TreasuryHistory } from "@/lib/painel-renda-fixa-data";
import { MarketCard } from "@/components/painel/market/MarketCard";
import {
  AzPeriodSelector,
  AzTimeSeriesChart,
  type AzPeriodValue,
  type AzTimeSeries,
} from "@/components/painel/charts";
import { seriesColor } from "@/lib/az-chart-theme";
import { fmtMesCurto } from "@/lib/format-br";

type CategoryKey = "PRE" | "IPCA";

type Props = {
  data: TreasuryHistory | null;
};

export function TreasuryTimeSeries({ data }: Props) {
  const [category, setCategory] = useState<CategoryKey>("PRE");
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "3m" });
  const [selected, setSelected] = useState<Record<CategoryKey, string[]>>({
    PRE: [],
    IPCA: [],
  });

  const cat = data?.categories[category];

  // Prefixado: o contrato de referência de cada ano vence em 1º de janeiro
  // (LTN/NTN-F). Os vencimentos intra-ano (abr/jul/out) são secundários e
  // poluem a leitura — exibimos só os de janeiro. IPCA+ (NTN-B) vence em
  // mai/ago (sem janeiro), então mantém todos os vencimentos.
  const catVencimentos = useMemo(() => {
    if (!cat) return [] as string[];
    if (category === "PRE") {
      const jan = cat.vencimentos.filter((v) => v.slice(5, 7) === "01");
      if (jan.length > 0) return jan;
    }
    return cat.vencimentos;
  }, [cat, category]);

  // Default: pega 4 vencimentos espacados ENTRE OS AINDA VIVOS (data > last_data_date).
  // Pre/IPCA tem vencimentos antigos no historico (LTN 2010 etc.) que ja venceram —
  // useis pra ver series passadas, mas o default precisa mostrar a curva vigente.
  const defaultSelected = useMemo(() => {
    if (catVencimentos.length === 0) return [] as string[];
    const lastDate = data?.last_data_date ?? "9999-12-31";
    const alive = catVencimentos.filter((v) => v > lastDate);
    const pool = alive.length >= 4 ? alive : catVencimentos;
    if (pool.length <= 4) return pool;
    const idx = [0, Math.floor(pool.length / 3), Math.floor((pool.length * 2) / 3), pool.length - 1];
    return Array.from(new Set(idx.map((i) => pool[i])));
  }, [catVencimentos, data?.last_data_date]);

  const activeSelected = selected[category].length > 0 ? selected[category] : defaultSelected;

  // Observação mais antiga entre as séries da categoria (limita o "Personalizado").
  const seriesMin = useMemo(() => {
    if (!cat) return "1900-01-01";
    let min = "";
    for (const venc of catVencimentos) {
      const first = cat.series[venc]?.[0]?.[0];
      if (first && (!min || first < min)) min = first;
    }
    return min || "1900-01-01";
  }, [cat, catVencimentos]);

  // Séries no formato do AzTimeSeriesChart — o chart recorta a janela pelo
  // `period` e marca a taxa atual no fim de cada linha (seriesEndLabels).
  const chartSeries = useMemo<AzTimeSeries[]>(() => {
    if (!cat) return [];
    return activeSelected.map((venc, i) => ({
      id: venc,
      label: fmtMesCurto(venc),
      color: seriesColor(i),
      data: cat.series[venc] ?? [],
    }));
  }, [cat, activeSelected]);

  function toggleVencimento(venc: string) {
    setSelected((prev) => {
      const cur = prev[category].length > 0 ? prev[category] : defaultSelected;
      const has = cur.includes(venc);
      const next = has ? cur.filter((v) => v !== venc) : [...cur, venc];
      // Limita 6
      const limited = next.slice(-6);
      return { ...prev, [category]: limited };
    });
  }

  if (!data || !cat) {
    return (
      <MarketCard title="Curva histórica de juros — Títulos Públicos">
        <div className="py-10 text-center text-sm text-zinc-500">
          Dados ANBIMA ainda não publicados pelo pipeline diário.
        </div>
      </MarketCard>
    );
  }

  return (
    <MarketCard
      title="Curva histórica de juros"
      subtitle="Evolução da taxa indicativa de cada vencimento ao longo do tempo. A taxa atual de cada título aparece marcada no fim da linha."
      badge={`ANBIMA · ${data.last_data_date}`}
      bodyClassName="px-4 pb-4 pt-2"
      footer={`Fonte: ${data.source}`}
      stampGiro={data.generated_at}
      stampDado={data.last_data_date}
      toolbar={
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setCategory("PRE")}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              category === "PRE"
                ? "bg-[#027DFC] text-white"
                : "border border-[#132960]/20 bg-white text-[#132960] hover:border-[#027DFC]"
            }`}
          >
            Prefixado
          </button>
          <button
            type="button"
            onClick={() => setCategory("IPCA")}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              category === "IPCA"
                ? "bg-[#027DFC] text-white"
                : "border border-[#132960]/20 bg-white text-[#132960] hover:border-[#027DFC]"
            }`}
          >
            IPCA+
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Periodos */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-zinc-500">Janela:</span>
          <AzPeriodSelector
            value={period}
            onChange={setPeriod}
            min={seriesMin}
            max={data.last_data_date}
          />
        </div>

        {/* Vencimentos disponiveis: separa vivos (em circulacao) de vencidos (historico) */}
        {(() => {
          const lastDate = data.last_data_date ?? "9999-12-31";
          const alive = catVencimentos.filter((v) => v > lastDate);
          const expired = catVencimentos.filter((v) => v <= lastDate);
          const renderChip = (venc: string, isExpired = false) => {
            const active = activeSelected.includes(venc);
            return (
              <button
                key={venc}
                type="button"
                onClick={() => toggleVencimento(venc)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                  active
                    ? "bg-[#027DFC] text-white"
                    : isExpired
                      ? "border border-zinc-200 bg-white text-zinc-500 hover:border-[#027DFC] hover:text-[#027DFC]"
                      : "border border-[#132960]/15 bg-zinc-50 text-[#132960] hover:border-[#027DFC]"
                }`}
                title={isExpired ? "Vencido — disponível para visualizar série histórica" : undefined}
              >
                {fmtMesCurto(venc)}
              </button>
            );
          };
          return (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-zinc-500">Em circulação:</span>
                {alive.map((v) => renderChip(v, false))}
              </div>
              {expired.length > 0 ? (
                <details className="group">
                  <summary className="cursor-pointer text-xs font-medium text-zinc-500 hover:text-[#027DFC]">
                    <span className="select-none">Vencidos ({expired.length}) — clique para mostrar séries históricas</span>
                  </summary>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {expired.map((v) => renderChip(v, true))}
                  </div>
                </details>
              ) : null}
              <p className="text-[11px] italic text-zinc-500">
                Máx 6 vencimentos simultâneos. Default: 4 espaçados entre os em circulação.
              </p>
            </div>
          );
        })()}

        {/* Grafico no estilo padrao AZ (mesmo do Ibovespa/IFIX), com um dot na
            cor da serie no fim de cada linha; os valores vao na legenda abaixo. */}
        <AzTimeSeriesChart
          series={chartSeries}
          unit="%"
          mode="raw"
          period={period}
          height={420}
          showLegend={false}
          seriesEndLabels
        />

        {/* Taxas atuais — último dado de cada vencimento, na cor da linha.
            Substitui o antigo painel lateral de estatísticas. */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-[#132960]/10 bg-zinc-50/50 px-4 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Taxa atual
          </span>
          {chartSeries.map((s) => {
            const serie = cat.series[s.id] ?? [];
            const last = serie.length > 0 ? serie[serie.length - 1] : null;
            const atual = last ? last[1] : null;
            return (
              <span key={s.id} className="inline-flex items-center gap-1.5 text-sm">
                <span
                  aria-hidden
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span className="font-medium text-[#132960]">{s.label}</span>
                <span className="tabular-nums font-semibold text-[#132960]">
                  {atual != null ? `${atual.toFixed(2).replace(".", ",")}%` : "—"}
                </span>
              </span>
            );
          })}
        </div>

        <p className="text-xs italic text-zinc-500">
          Cada linha mostra a evolução da <em>taxa indicativa</em> de um título com data de vencimento
          específica. No Prefixado exibimos apenas os vencimentos de <strong>janeiro</strong> (LTN/NTN-F),
          o contrato de referência de cada ano; IPCA+ usa NTN-B (vencimentos de maio e agosto).
        </p>
      </div>
    </MarketCard>
  );
}
