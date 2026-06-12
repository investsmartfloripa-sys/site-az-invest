"use client";

import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { FamiliasEstruturaSocialData } from "@/lib/painel-familias";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AzPeriodSelector, resolvePeriodRange, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum } from "@/lib/format-br";
import { chaveMaisProxima, clipFaixas, isoData, Chip } from "./shared";

/**
 * "Estrutura social" D3 — transferências sociais em R$ CONSTANTES (deflator
 * INPC do builder), em área empilhada PBF + BPC. Em nominal o gráfico só
 * mostrava inflação; em real aparecem as decisões de política (R$ 600,
 * Auxílio Emergencial). BPC em pessoas vai no CHIP — nunca no mesmo eixo.
 */

type Row = { mes: string; pbf: number | null; bpc: number | null };

const FAIXA_AUXILIO = { x1: "2020-04-01", x2: "2021-10-01", label: "Auxílio Emergencial", color: "#FF5713", opacity: 0.08 };

export function TransferenciasReaisCard({
  estruturaSocial,
  geradoEm,
}: {
  estruturaSocial: FamiliasEstruturaSocialData;
  geradoEm: string;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });

  const serie = estruturaSocial.bloco_transferencias_sociais.serie ?? [];

  const todos = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const p of serie) {
      const pbf = p.pbf_valor_real_milhoes;
      const bpc = p.bpc_valor_real_milhoes;
      if (pbf == null && bpc == null) continue;
      out.push({
        mes: isoData(p.data),
        pbf: pbf != null && Number.isFinite(pbf) ? pbf : null,
        bpc: bpc != null && Number.isFinite(bpc) ? bpc : null,
      });
    }
    return out.sort((a, b) => (a.mes < b.mes ? -1 : 1));
  }, [serie]);

  const minIso = todos.length > 0 ? todos[0].mes : "";
  const maxIso = todos.length > 0 ? todos[todos.length - 1].mes : "";

  const rows = useMemo(() => {
    if (todos.length === 0) return [];
    const { from, to } = resolvePeriodRange(period, minIso, maxIso);
    return todos.filter((r) => r.mes >= from && r.mes <= to);
  }, [todos, period, minIso, maxIso]);

  const keysVisiveis = useMemo(() => rows.map((r) => r.mes), [rows]);
  const faixaAuxilio = useMemo(() => clipFaixas([FAIXA_AUXILIO], keysVisiveis), [keysVisiveis]);
  const marcoPbf600 = useMemo(() => chaveMaisProxima(keysVisiveis, "2023-03-01"), [keysVisiveis]);

  const bpcPessoasUlt = useMemo(() => {
    for (let i = serie.length - 1; i >= 0; i--) {
      const v = serie[i].bpc_pessoas;
      if (v != null && Number.isFinite(v)) return { data: isoData(serie[i].data), valor: v };
    }
    return null;
  }, [serie]);

  const ult = todos[todos.length - 1];
  const totalUlt = ult ? (ult.pbf ?? 0) + (ult.bpc ?? 0) : null;

  const titulo =
    totalUlt != null && totalUlt > 0
      ? `Bolsa Família + BPC somam R$ ${fmtNum(totalUlt / 1000, 1)} bi por mês em termos reais`
      : "Transferências sociais em R$ constantes";

  if (todos.length === 0) {
    return (
      <ChartCard
        title="Transferências sociais em R$ constantes"
        footer="Ipeadata/MDS. As séries deflacionadas (v2) ainda não foram publicadas pelo builder — rode o workflow familias-pipeline.yml."
        stampGiro={geradoEm}
      >
        <p className="flex h-40 items-center justify-center text-sm text-zinc-400">
          Sem valores reais (deflacionados) disponíveis neste JSON.
        </p>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title={titulo}
      subtitle="Valor mensal pago em Bolsa Família e BPC, em R$ CONSTANTES (deflator INPC). Em termos reais, o gráfico mostra decisões de política — não inflação."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer="Ipeadata/MDS — Bolsa Família (VAL_PBF12) e BPC (VAL_BPC), deflacionados pelo INPC no builder (base = último mês com índice publicado). Faixa laranja: Auxílio Emergencial (abr/2020–out/2021), pago FORA do PBF — parte do público migrou de programa no período. Marco: relançamento do Bolsa Família com piso de R$ 600 (mar/2023). BPC: benefícios de 1 SM a idosos 65+ e PCD de baixa renda."
      stampGiro={geradoEm}
      stampDado={maxIso || null}
    >
      {bpcPessoasUlt != null ? (
        <div className="mb-3 flex flex-wrap gap-2">
          <Chip
            label={`BPC — beneficiários (${fmtMesCurto(bpcPessoasUlt.data)})`}
            valor={
              bpcPessoasUlt.valor >= 1_000_000
                ? `${fmtNum(bpcPessoasUlt.valor / 1_000_000, 1)} mi de pessoas`
                : `${fmtNum(bpcPessoasUlt.valor, 0)} pessoas`
            }
            hint="pessoas ≠ reais: por isso o número vive aqui, não no eixo do gráfico"
          />
        </div>
      ) : null}
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid {...azGridProps()} />
            <XAxis {...azXAxisProps()} dataKey="mes" tickFormatter={fmtMesCurto} minTickGap={36} />
            <YAxis {...azYAxisProps()} width={52} tickFormatter={(v: number) => fmtNum(v / 1000, 0)} />
            {faixaAuxilio.map((f, i) => (
              <ReferenceArea
                key={`aux-${i}`}
                x1={f.x1}
                x2={f.x2}
                fill={f.color}
                fillOpacity={f.opacity}
                stroke="none"
                label={{ value: f.label, position: "insideTop", fontSize: 9, fill: "#C2410C" }}
              />
            ))}
            {marcoPbf600 != null ? (
              <ReferenceLine
                x={marcoPbf600}
                stroke={AZ_CHART.zero}
                strokeOpacity={0.45}
                strokeDasharray="3 3"
                strokeWidth={1}
                label={{ value: "novo PBF (R$ 600)", position: "insideTopRight", fontSize: 9, fill: "#334155" }}
              />
            ) : null}
            <Tooltip
              content={
                <AzTooltip labelFmt={(l) => fmtMesCurto(String(l))} valueFmt={(v) => `R$ ${fmtNum(v / 1000, 2)} bi`} />
              }
              cursor={AZ_TOOLTIP_PROPS.cursor}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area
              type="monotone"
              dataKey="pbf"
              name="Bolsa Família (real)"
              stackId="transf"
              stroke={AZ_BRAND.azure}
              strokeWidth={1.2}
              fill={AZ_BRAND.azure}
              fillOpacity={0.35}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="bpc"
              name="BPC (real)"
              stackId="transf"
              stroke={AZ_BRAND.navy}
              strokeWidth={1.2}
              fill={AZ_BRAND.navy}
              fillOpacity={0.3}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[10px] text-zinc-400">Eixo Y em R$ bilhões/mês constantes.</p>
    </ChartCard>
  );
}
