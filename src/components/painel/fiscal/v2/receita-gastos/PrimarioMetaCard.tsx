"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { AtividadeCodaceData } from "@/lib/painel-atividade";
import type { FiscalClassicosData } from "@/lib/painel-fiscal";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzSegmented } from "@/components/painel/panorama/AzSegmented";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtNum, fmtSignedPct, formatTimeTickLabel, isoFromUTC, parseIsoUTC } from "@/lib/format-br";
import type { AzSeriesPoint } from "@/components/painel/charts/AzTimeSeriesChart";
import {
  clipTimeRows,
  clipXAreasT,
  codaceAreas,
  fmtTLabel,
  mergeTimeRows,
  mesIso,
  pctPoints,
  timeAxis,
  ultimoPct,
  yDomainDe,
} from "./shared";
import { StatChip } from "./StatChip";

/**
 * 01 — Primário realizado × estabilizador × metas LDO (formato cockpit:
 * título FIXO, estado atual no chip, leitura no ?), em DOIS MODOS que
 * nunca misturam perímetro na mesma linha:
 * - "Consolidado (estabilizador)": primário do setor público consolidado
 *   (derivado no pipeline) contra o estabilizador — MESMO perímetro da DLSP.
 * - "Central (meta LDO)": primário do governo central (RTN) contra as bandas
 *   LDO, SEM a linha do estabilizador (a meta é do central).
 *
 * O estabilizador vem PRONTO do pipeline (sustentabilidade.serie — taxa
 * implícita da DLSP, perímetro consolidado): o front NUNCA recalcula a
 * fórmula. As bandas LDO são POR ANO-CALENDÁRIO (retângulos jan→dez, só nos
 * anos com meta vigente, 2024+) — não uma faixa horizontal pintada sobre a
 * década, como no dashboard antigo.
 */

type ModoPrimario = "consolidado" | "central";

const MODOS = [
  { id: "consolidado", label: "Consolidado (estabilizador)" },
  { id: "central", label: "Central (meta LDO)" },
] as const;

export function PrimarioMetaCard({ data, codace }: { data: FiscalClassicosData; codace: AtividadeCodaceData | null }) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "5y" });
  const [modo, setModo] = useState<ModoPrimario>("consolidado");
  const rg = data.receita_e_gastos;
  const sust = data.sustentabilidade;

  const seriePrimario = modo === "consolidado" ? rg.primario_sp_12m_pct_pib : rg.primario_central_pct_pib;

  const estabPts = useMemo<AzSeriesPoint[]>(() => {
    const out: AzSeriesPoint[] = [];
    for (const p of sust?.serie ?? []) {
      if (p.primario_estabilizador_pct_pib != null && Number.isFinite(p.primario_estabilizador_pct_pib)) {
        out.push([mesIso(p.data), p.primario_estabilizador_pct_pib]);
      }
    }
    return out;
  }, [sust]);

  const rowsAll = useMemo(
    () =>
      modo === "consolidado"
        ? mergeTimeRows({ primario: pctPoints(seriePrimario), estab: estabPts })
        : mergeTimeRows({ primario: pctPoints(seriePrimario) }),
    [modo, seriePrimario, estabPts],
  );

  const rows = useMemo(() => clipTimeRows(rowsAll, period), [rowsAll, period]);
  const { ticks, spanDays } = useMemo(() => timeAxis(rows), [rows]);
  const faixas = useMemo(() => clipXAreasT(codaceAreas(codace?.mensal), rows), [codace?.mensal, rows]);

  // Bandas LDO por ano-calendário, clipadas à janela visível — SÓ no modo
  // central: a meta LDO é do governo central, não do consolidado.
  const bandas = useMemo(() => {
    if (modo !== "central" || rows.length === 0) return [];
    const firstT = rows[0].t;
    const lastT = rows[rows.length - 1].t;
    const out: { ano: string; x1: number; x2: number; y1: number; y2: number }[] = [];
    for (const [ano, m] of Object.entries(data.metas_ldo?.anos ?? {})) {
      const x1 = parseIsoUTC(`${ano}-01-01`);
      const x2 = parseIsoUTC(`${ano}-12-31`);
      if (!Number.isFinite(x1) || !Number.isFinite(x2) || x2 < firstT || x1 > lastT) continue;
      out.push({ ano, x1: Math.max(x1, firstT), x2: Math.min(x2, lastT), y1: m.banda_inf, y2: m.banda_sup });
    }
    return out;
  }, [modo, data.metas_ldo, rows]);

  const dom = useMemo(
    () =>
      yDomainDe(rows, modo === "consolidado" ? ["primario", "estab"] : ["primario"], {
        incluirZero: true,
        extras: bandas.flatMap((b) => [b.y1, b.y2]),
      }),
    [rows, bandas, modo],
  );

  const minIso = rowsAll.length > 0 ? isoFromUTC(rowsAll[0].t) : "";
  const maxIso = rowsAll.length > 0 ? isoFromUTC(rowsAll[rowsAll.length - 1].t) : "";

  const primUlt = ultimoPct(seriePrimario);
  const estabUlt = estabPts.length > 0 ? estabPts[estabPts.length - 1][1] : null;

  const chip = (() => {
    if (!primUlt) return null;
    if (modo === "consolidado") {
      const tone = estabUlt != null ? (primUlt.valor >= estabUlt ? "pos" : "neg") : "neutral";
      return (
        <StatChip tone={tone}>
          {fmtSignedPct(primUlt.valor, 2)} (SP)
          {estabUlt != null ? ` · estab. ${fmtSignedPct(estabUlt, 1)}` : ""}
        </StatChip>
      );
    }
    const ano = primUlt.data.slice(0, 4);
    const meta = data.metas_ldo?.anos?.[ano];
    const tone = meta ? (primUlt.valor < meta.banda_inf ? "neg" : "pos") : "neutral";
    return (
      <StatChip tone={tone}>
        {fmtSignedPct(primUlt.valor, 2)} (GC)
        {meta ? ` · banda ${fmtSignedPct(meta.banda_inf, 2)} a ${fmtSignedPct(meta.banda_sup, 2)}` : ""}
      </StatChip>
    );
  })();

  const interpretacao = (() => {
    if (modo === "consolidado") {
      const leitura =
        primUlt && estabUlt != null
          ? estabUlt - primUlt.valor > 0
            ? ` Hoje o primário roda ${fmtNum(estabUlt - primUlt.valor, 1)} p.p. aquém do que estabiliza a dívida.`
            : " Hoje o primário já supera o estabilizador da dívida."
          : "";
      return `O resultado que o setor público entrega basta para a dívida parar de crescer?${leitura}`;
    }
    return "O governo central cabe na meta do ano? O chip compara o 12m móvel com a banda LDO do ano corrente — a aferição oficial é no ano-calendário.";
  })();

  return (
    <ChartCard
      title="Primário × estabilizador / meta"
      subtitle={
        modo === "consolidado"
          ? "Setor público consolidado (SP) · primário 12m vs p* do pipeline · mesmo perímetro (DLSP)"
          : "Governo central (GC) · primário 12m (RTN) vs bandas LDO por ano-calendário"
      }
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          {chip}
          <AzSegmented
            options={[...MODOS]}
            value={modo}
            onChange={(id) => setModo(id as ModoPrimario)}
            ariaLabel="Perímetro do primário"
          />
          <AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["ytd", "1y", "5y", "max"]} />
        </div>
      }
      footer={`${interpretacao} Dois perímetros em dois modos, nunca na mesma linha: Consolidado = setor público consolidado (BCB, derivado no pipeline) contra o estabilizador; Central = governo central (RTN) contra a meta LDO. ${
        modo === "consolidado"
          ? "Estabilizador (linha navy tracejada): p* = (r−g)/(1+g) × DLSP/PIB t−12, com r = taxa implícita da DLSP — calculado SÓ no pipeline, MESMO perímetro (DLSP) da linha realizada."
          : "Bandas verdes: metas LDO por ano-calendário (LC 200/2023, banda ±0,25 p.p., vigência 2024+); a aferição oficial é no ANO com abatimentos (ex.: precatórios) — o 12m móvel é aproximação."
      } Faixas cinzas: recessões CODACE.`}
      stampGiro={data.gerado_em}
      stampDado={primUlt ? mesIso(primUlt.data) : null}
    >
      <div className="h-[340px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid {...azGridProps()} />
            <XAxis
              {...azXAxisProps()}
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              ticks={ticks}
              tickFormatter={(t: number) => formatTimeTickLabel(isoFromUTC(Number(t)), spanDays)}
              minTickGap={28}
            />
            <YAxis {...azYAxisProps()} width={48} domain={dom} tickFormatter={(v: number) => `${fmtNum(v, 1)}%`} />

            {faixas.map((f, i) => (
              <ReferenceArea key={`codace-${i}`} x1={f.t1} x2={f.t2} fill={AZ_CHART.ticks} fillOpacity={0.07} stroke="none" />
            ))}
            {bandas.map((b) => (
              <ReferenceArea
                key={`ldo-${b.ano}`}
                x1={b.x1}
                x2={b.x2}
                y1={b.y1}
                y2={b.y2}
                fill={AZ_CHART.pos}
                fillOpacity={0.12}
                stroke="none"
                label={{ value: `LDO ${b.ano}`, position: "insideTop", fontSize: 9, fill: AZ_CHART.posText }}
              />
            ))}
            <ReferenceLine y={0} stroke={AZ_CHART.zero} strokeOpacity={AZ_CHART.zeroOpacity} strokeWidth={1.5} />

            <Tooltip
              content={<AzTooltip labelFmt={fmtTLabel} valueFmt={(v) => fmtSignedPct(v, 2)} />}
              cursor={AZ_TOOLTIP_PROPS.cursor}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />

            <Line
              type="monotone"
              dataKey="primario"
              name={modo === "consolidado" ? "Primário consolidado (12m)" : "Primário central (12m)"}
              stroke={AZ_BRAND.azure}
              strokeWidth={2}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            {modo === "consolidado" ? (
              <Line
                type="monotone"
                dataKey="estab"
                name="Primário estabilizador (consolidado)"
                stroke={AZ_BRAND.navy}
                strokeWidth={1.8}
                strokeDasharray="5 3"
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
