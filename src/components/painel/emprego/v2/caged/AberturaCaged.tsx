"use client";

import { useMemo, useState, type ReactElement } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { CagedQuebrasData } from "@/lib/painel-emprego";
import { FAIXAS_5_ORDEM, SETORES_IBGE_ORDEM, agrupa5 } from "@/lib/painel-emprego";
import {
  AzSegmented,
  AzTooltip,
  ChartCard,
  azGridProps,
  azXAxisProps,
  azZeroLineProps,
  ticksRedondos,
} from "@/components/painel/core";
import type { DivergingBarRow } from "@/components/painel/charts/DivergingReturnBars";
import { AZ_CHART, AZ_TOOLTIP_PROPS, variationFill, variationText } from "@/lib/az-chart-theme";
import { fmtPct, fmtSignedNum } from "@/lib/format-br";
import { mesIso } from "@/components/painel/atividade/v2/shared";
import { fmtSignedMil, somaJanela } from "./shared";

/**
 * "Quem cria as vagas?" — saldo ACUMULADO 12 MESES por setor IBGE ou por
 * faixa salarial (5 grupos), em barras horizontais DIVERGENTES. Nada de pizza
 * nem stacked de saldo: saldo tem sinal misto e não comporta share — o share
 * (%) aparece só nas ADMISSÕES por faixa (fluxo bruto), e só nos meses em que
 * o campo v2 existe.
 */

type Vista = "setores" | "faixas";

type Linha = DivergingBarRow & { delta: number | null };

export function AberturaCaged({ quebras, geradoEm }: { quebras: CagedQuebrasData; geradoEm: string }) {
  const [vista, setVista] = useState<Vista>("setores");

  const serie = quebras.serie;
  const ult12 = useMemo(() => serie.slice(-12), [serie]);
  const ant12 = useMemo(() => serie.slice(-24, -12), [serie]);
  const temComparacao = ant12.length === 12;

  const { rows, mesesComShare } = useMemo(() => {
    if (vista === "setores") {
      const atual = somaJanela(ult12, "saldo_por_setor_ibge");
      const anterior = temComparacao ? somaJanela(ant12, "saldo_por_setor_ibge") : null;
      const out: Linha[] = SETORES_IBGE_ORDEM.map((s) => ({
        label: s,
        value: +((atual[s] ?? 0) / 1000).toFixed(1),
        delta: anterior ? (atual[s] ?? 0) - (anterior[s] ?? 0) : null,
      }));
      out.sort((a, b) => b.value - a.value);
      return { rows: out, mesesComShare: 0 };
    }
    // Faixas: agrega as 11 faixas somadas do período em 5 grupos (faixa "00" já excluída no agrupa5).
    const atual = agrupa5(somaJanela(ult12, "saldo_por_faixa_salario"));
    const anterior = temComparacao ? agrupa5(somaJanela(ant12, "saldo_por_faixa_salario")) : null;

    // Share % das ADMISSÕES por faixa — só nos meses em que admissoes_por_faixa existe.
    const mesesAdm = ult12.filter((r) => r.admissoes_por_faixa && Object.keys(r.admissoes_por_faixa).length > 0);
    const admPorFaixa = mesesAdm.length > 0 ? agrupa5(somaJanela(mesesAdm, "admissoes_por_faixa")) : null;
    const admTotal = admPorFaixa ? Object.values(admPorFaixa).reduce((a, b) => a + b, 0) : 0;

    const out: Linha[] = FAIXAS_5_ORDEM.map((f) => {
      const share = admPorFaixa && admTotal > 0 ? (100 * (admPorFaixa[f] ?? 0)) / admTotal : null;
      return {
        label: share != null ? `${f} · ${fmtPct(share, 0)} adm.` : f,
        value: +((atual[f] ?? 0) / 1000).toFixed(1),
        delta: anterior ? (atual[f] ?? 0) - (anterior[f] ?? 0) : null,
      };
    });
    out.sort((a, b) => b.value - a.value);
    return { rows: out, mesesComShare: mesesAdm.length };
  }, [vista, ult12, ant12, temComparacao]);

  const top = rows.length > 0 ? rows[0] : null;
  const titulo = (() => {
    if (!top) return "Saldo acumulado 12 meses por recorte";
    const nomeTop = top.label.split(" · ")[0];
    if (top.value < 0)
      return `Todos os recortes fecham vagas em 12 meses — ${nomeTop} resiste melhor (${fmtSignedNum(top.value, 1)} mil)`;
    return vista === "setores"
      ? `${nomeTop} lidera a criação de vagas: ${fmtSignedNum(top.value, 1)} mil no acumulado 12 meses`
      : `As vagas novas se concentram em ${nomeTop}: ${fmtSignedNum(top.value, 1)} mil em 12 meses`;
  })();

  const ultMes = serie.length > 0 ? serie[serie.length - 1].mes : null;

  return (
    <ChartCard
      title={titulo}
      subtitle={
        vista === "setores"
          ? "Saldo acumulado dos últimos 12 meses por setor IBGE (mil postos, microdado). Barras divergentes: criação líquida à direita, fechamento à esquerda."
          : `Saldo acumulado dos últimos 12 meses por faixa salarial em salários mínimos (mil postos, microdado).${
              mesesComShare > 0 ? ` Share % = participação nas admissões (fluxo bruto, ${mesesComShare} ${mesesComShare === 1 ? "mês" : "meses"} com dado).` : ""
            }`
      }
      toolbar={
        <AzSegmented
          ariaLabel="Recorte da abertura"
          options={[
            { id: "setores", label: "Setores" },
            { id: "faixas", label: "Faixas salariais" },
          ]}
          value={vista}
          onChange={(id) => setVista(id as Vista)}
        />
      }
      footer="Microdados PDET/MTE — declarações no prazo, cobertura ~40–50% do saldo oficial: use para COMPOSIÇÃO, não para o nível. Share % apenas de admissões — saldo tem sinal misto e não comporta participação. Faixa '00' (salário não informado) excluída. Δ = acumulado 12m vs os 12m imediatamente anteriores."
      stampGiro={geradoEm}
      stampDado={ultMes ? mesIso(ultMes) : null}
    >
      {temComparacao ? (
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
          <span className="font-semibold uppercase tracking-wider text-zinc-500">Δ vs 12m anteriores:</span>
          {rows.map((r) => (
            <span key={r.label} className="whitespace-nowrap tabular-nums">
              {r.label.split(" · ")[0]}{" "}
              <strong style={{ color: variationText((r.delta ?? 0) / 1000) }}>{fmtSignedMil(r.delta)}</strong>
            </span>
          ))}
        </div>
      ) : null}
      <BarrasSaldo rows={rows} />
    </ChartCard>
  );
}

/**
 * Barras horizontais divergentes no padrão do DivergingReturnBars (grade vertical, zero navy,
 * barras de 16 px, valor com sinal na ponta), mas com o eixo calculado aqui: com o domínio
 * automático, uma única barra de −15 mil abria o eixo em −250 e deixava a metade esquerda
 * vazia; no celular ainda sumia o "+250" (revisão 12/11/2026). Agora: marcas redondas a partir
 * do zero e só a folga necessária do lado negativo.
 */
function BarrasSaldo({ rows }: { rows: Linha[] }) {
  const data = useMemo(
    () => rows.map((r) => ({ name: r.label.length > 20 ? `${r.label.slice(0, 19)}…` : r.label, value: r.value })),
    [rows],
  );

  const eixo = useMemo(() => {
    let lo = 0;
    let hi = 0;
    for (const r of rows) {
      if (r.value < lo) lo = r.value;
      if (r.value > hi) hi = r.value;
    }
    const { ticks } = ticksRedondos(lo, hi, 4);
    const folga = (hi - lo) * 0.05;
    const min = lo < 0 ? lo - folga : 0;
    const max = hi > 0 ? Math.max(ticks[ticks.length - 1] ?? hi, hi) : folga;
    return { domain: [min, max] as [number, number], ticks: ticks.filter((t) => t >= min && t <= max) };
  }, [rows]);

  if (data.length === 0) {
    return <p className="py-6 text-center text-sm text-zinc-500">Sem dados para este período.</p>;
  }

  const renderLabel = (props: unknown): ReactElement => {
    const { x, y, width, height: h, value } = props as {
      x?: number | string;
      y?: number | string;
      width?: number | string;
      height?: number | string;
      value?: number | string;
    };
    const xx = Number(x);
    const yy = Number(y);
    const w = Number(width);
    const hh = Number(h);
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(xx) || !Number.isFinite(yy) || !Number.isFinite(n)) return <g />;
    return (
      <text
        x={Math.max(xx, xx + (Number.isFinite(w) ? w : 0)) + 6}
        y={yy + (Number.isFinite(hh) ? hh : 0) / 2}
        textAnchor="start"
        dominantBaseline="central"
        style={{ fontSize: 10.5, fill: "#475569", fontVariantNumeric: "tabular-nums" }}
      >
        {`${fmtSignedNum(n, 0)} mil`}
      </text>
    );
  };

  return (
    <div className="w-full" style={{ height: 28 * data.length + 56 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" barCategoryGap="35%" margin={{ left: 4, right: 56, top: 4, bottom: 4 }}>
          <CartesianGrid {...azGridProps("vertical-only")} />
          <XAxis
            {...azXAxisProps()}
            type="number"
            domain={eixo.domain}
            ticks={eixo.ticks}
            interval={0}
            tickFormatter={(v) => fmtSignedNum(Number(v), 0)}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={132}
            interval={0}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: AZ_CHART.labels }}
          />
          <ReferenceLine {...azZeroLineProps("x")} />
          <Tooltip
            content={<AzTooltip hideDot valueFmt={(v) => `${fmtSignedNum(v, 1)} mil`} />}
            cursor={AZ_TOOLTIP_PROPS.cursor}
          />
          <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={16} isAnimationActive={false}>
            {data.map((e, i) => (
              <Cell key={`${e.name}-${i}`} fill={variationFill(e.value)} />
            ))}
            <LabelList dataKey="value" content={renderLabel} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
