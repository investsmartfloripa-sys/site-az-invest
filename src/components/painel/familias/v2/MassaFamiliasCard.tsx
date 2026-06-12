"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { PnadData } from "@/lib/painel-emprego";
import type { CodaceFaixaAtividade } from "@/lib/painel-atividade";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AzPeriodSelector, resolvePeriodRange, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS, variationFill } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtPct, fmtSignedPct } from "@/lib/format-br";
import { clipFaixas, codaceAreas, fmtTrimMovel, isoData } from "./shared";

/**
 * "O bolo de salários" — massa de rendimento REAL do trabalho (SIDRA 6392).
 * É a renda média × número de ocupados: a melhor proxy do poder de consumo
 * agregado das famílias vindo do TRABALHO (não inclui transferências).
 * Nível em R$ bi/mês + barras YoY em painéis empilhados (nunca eixo duplo).
 * Série cross-painel: o mesmo JSON alimenta o painel Emprego.
 */

type Row = { mes: string; massaBi: number };
type RowVar = { mes: string; yoy: number };

export function MassaFamiliasCard({
  massa,
  codaceMensal,
  geradoEm,
}: {
  massa: NonNullable<PnadData["massa_rendimento"]>;
  codaceMensal?: CodaceFaixaAtividade[];
  geradoEm: string;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });

  const todos = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const p of massa.serie ?? []) {
      if (p.massa_real_mi == null || !Number.isFinite(p.massa_real_mi)) continue;
      out.push({ mes: isoData(p.mes), massaBi: +(p.massa_real_mi / 1000).toFixed(2) });
    }
    return out.sort((a, b) => (a.mes < b.mes ? -1 : 1));
  }, [massa.serie]);

  const todosVar = useMemo<RowVar[]>(() => {
    const out: RowVar[] = [];
    for (const p of massa.serie ?? []) {
      if (p.massa_yoy_pct == null || !Number.isFinite(p.massa_yoy_pct)) continue;
      out.push({ mes: isoData(p.mes), yoy: p.massa_yoy_pct });
    }
    return out.sort((a, b) => (a.mes < b.mes ? -1 : 1));
  }, [massa.serie]);

  const minIso = todos.length > 0 ? todos[0].mes : "";
  const maxIso = todos.length > 0 ? todos[todos.length - 1].mes : "";

  const rows = useMemo(() => {
    if (todos.length === 0) return [];
    const { from, to } = resolvePeriodRange(period, minIso, maxIso);
    return todos.filter((r) => r.mes >= from && r.mes <= to);
  }, [todos, period, minIso, maxIso]);

  const rowsVar = useMemo(() => {
    if (todosVar.length === 0) return [];
    const { from, to } = resolvePeriodRange(period, minIso, maxIso);
    return todosVar.filter((r) => r.mes >= from && r.mes <= to);
  }, [todosVar, period, minIso, maxIso]);

  const faixas = useMemo(
    () =>
      clipFaixas(
        codaceAreas(codaceMensal),
        rows.map((r) => r.mes),
      ),
    [codaceMensal, rows],
  );

  const yDomain = useMemo<[number, number]>(() => {
    if (rows.length === 0) return [0, 1];
    let lo = Infinity;
    let hi = -Infinity;
    for (const r of rows) {
      if (r.massaBi < lo) lo = r.massaBi;
      if (r.massaBi > hi) hi = r.massaBi;
    }
    const pad = Math.max((hi - lo) * 0.08, 2);
    return [Math.floor(lo - pad), Math.ceil(hi + pad)];
  }, [rows]);

  const ult = todos[todos.length - 1];
  const ultVar = todosVar[todosVar.length - 1];

  const titulo = ult
    ? `Massa real de salários: R$ ${fmtNum(ult.massaBi, 0)} bi por mês — ${
        ultVar == null
          ? "trimestre móvel mais recente"
          : ultVar.yoy > 0.05
            ? `alta de ${fmtPct(ultVar.yoy, 1)} em um ano`
            : ultVar.yoy < -0.05
              ? `queda de ${fmtPct(Math.abs(ultVar.yoy), 1)} em um ano`
              : "estável em um ano"
      }`
    : "Massa de rendimento real do trabalho";

  if (todos.length === 0) {
    return (
      <ChartCard
        title="Massa de rendimento real do trabalho"
        footer="O pipeline de Emprego ainda não publicou a massa de rendimento (schema v2)."
        stampGiro={geradoEm}
      >
        <p className="flex h-40 items-center justify-center text-sm text-zinc-400">Sem dados de massa de rendimento.</p>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title={titulo}
      subtitle="Renda média × ocupados: o poder de consumo agregado que vem do TRABALHO. Painel de cima: nível real em R$ bilhões/mês; painel de baixo: variação contra o mesmo trimestre móvel do ano anterior."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer="IBGE/SIDRA 6392 — massa de rendimento real habitual de todos os trabalhos (trimestre móvel, deflacionada pelo próprio IBGE). NÃO inclui aposentadorias nem transferências (Bolsa Família, BPC) — o bloco Estrutura social cobre essa outra perna da renda. Série compartilhada com o painel Emprego (data/emprego_pnad.json). Faixas cinzas: recessões CODACE/FGV."
      stampGiro={geradoEm}
      stampDado={maxIso || null}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Nível real (R$ bilhões por mês)</p>
      <div className="h-[230px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid {...azGridProps()} />
            <XAxis {...azXAxisProps()} dataKey="mes" tickFormatter={fmtMesCurto} minTickGap={36} />
            <YAxis {...azYAxisProps()} width={48} domain={yDomain} tickFormatter={(v: number) => fmtNum(v, 0)} />
            {faixas.map((f, i) => (
              <ReferenceArea key={`codace-${i}`} x1={f.x1} x2={f.x2} fill={AZ_CHART.ticks} fillOpacity={0.07} stroke="none" />
            ))}
            <Tooltip
              content={
                <AzTooltip
                  labelFmt={(l) => `trim. móvel ${fmtTrimMovel(String(l).slice(0, 7))}`}
                  valueFmt={(v) => `R$ ${fmtNum(v, 1)} bi`}
                />
              }
              cursor={AZ_TOOLTIP_PROPS.cursor}
            />
            <Line
              type="monotone"
              dataKey="massaBi"
              name="Massa real"
              stroke={AZ_BRAND.azure}
              strokeWidth={2.2}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Variação real em 12 meses</p>
      <div className="h-[150px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rowsVar} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid {...azGridProps()} />
            <XAxis {...azXAxisProps()} dataKey="mes" tickFormatter={fmtMesCurto} minTickGap={36} />
            <YAxis {...azYAxisProps()} width={48} tickFormatter={(v: number) => fmtSignedPct(v, 0)} />
            <ReferenceLine y={0} stroke={AZ_CHART.zero} strokeOpacity={AZ_CHART.zeroOpacity} strokeWidth={1.5} />
            <Tooltip
              content={
                <AzTooltip
                  labelFmt={(l) => `trim. móvel ${fmtTrimMovel(String(l).slice(0, 7))}`}
                  valueFmt={(v) => fmtSignedPct(v, 1)}
                />
              }
              cursor={AZ_TOOLTIP_PROPS.cursor}
            />
            <Bar dataKey="yoy" name="Massa real (YoY)" isAnimationActive={false} maxBarSize={14}>
              {rowsVar.map((r) => (
                <Cell key={r.mes} fill={variationFill(r.yoy)} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

