"use client";

import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DetentoresDpmfiPonto } from "@/lib/painel-fiscal";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AzPeriodSelector, resolvePeriodRange, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtPct } from "@/lib/format-br";
import { CockpitChip, dataIso } from "./shared";

/**
 * Detentores da DPMFi em mercado — stacked area normalizada a 100%: o share de
 * cada categoria é CALCULADO dos R$ bi (soma das sete categorias = denominador,
 * nunca um total externo — a pilha fecha por construção). Não-residentes em
 * destaque (tijolo): é a fatia que precifica o risco soberano em moeda local e
 * sai primeiro no stress.
 *
 * Padrão cockpit (mesma anatomia do ComposicaoDpmfiCard ao lado): título FIXO
 * técnico + chip dos não-residentes; leitura no footer (?).
 */

type DetentorKey = Exclude<keyof DetentoresDpmfiPonto, "data">;

const COR_NAO_RESIDENTES = "#BE3B33"; // tijolo — a fatia em destaque

const DETENTORES: { key: DetentorKey; label: string; cor: string }[] = [
  { key: "instituicoes_financeiras", label: "Instituições financeiras", cor: "#132960" },
  { key: "fundos", label: "Fundos", cor: "#027DFC" },
  { key: "previdencia", label: "Previdência", cor: "#1E8A5C" },
  { key: "nao_residentes", label: "Não-residentes", cor: COR_NAO_RESIDENTES },
  { key: "governo", label: "Governo", cor: "#0891B2" },
  { key: "seguradoras", label: "Seguradoras", cor: "#A16207" },
  { key: "outros", label: "Outros", cor: "#94A3B8" },
];

type Row = { iso: string } & Record<DetentorKey, number>;

export function DetentoresDpmfiCard({
  detentores,
  geradoEm,
}: {
  detentores: DetentoresDpmfiPonto[];
  geradoEm: string;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });

  // Share % calculado dos R$ bi: denominador = soma das próprias categorias.
  const todasRows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const p of detentores) {
      let soma = 0;
      for (const d of DETENTORES) {
        const v = p[d.key];
        if (v != null && Number.isFinite(v)) soma += v;
      }
      if (soma <= 0) continue;
      const row = { iso: dataIso(p.data) } as Row;
      for (const d of DETENTORES) {
        const v = p[d.key];
        row[d.key] = +((100 * (v != null && Number.isFinite(v) ? v : 0)) / soma).toFixed(2);
      }
      out.push(row);
    }
    out.sort((a, b) => (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0));
    return out;
  }, [detentores]);

  const minIso = todasRows.length > 0 ? todasRows[0].iso : "";
  const maxIso = todasRows.length > 0 ? todasRows[todasRows.length - 1].iso : "";

  const rows = useMemo(() => {
    if (todasRows.length === 0) return [];
    const { from, to } = resolvePeriodRange(period, minIso, maxIso);
    return todasRows.filter((r) => r.iso >= from && r.iso <= to);
  }, [todasRows, period, minIso, maxIso]);

  if (todasRows.length === 0) {
    return (
      <ChartCard title="Detentores da DPMFi (% do estoque em mercado)" stampGiro={geradoEm}>
        <p className="flex h-64 items-center justify-center text-sm text-zinc-400">
          O pipeline ainda não publicou os detentores da DPMFi (build_dpf_rmd.py).
        </p>
      </ChartCard>
    );
  }

  const atual = todasRows[todasRows.length - 1];

  return (
    <ChartCard
      title="Detentores da DPMFi (% do estoque em mercado)"
      subtitle="Quem carrega a dívida mobiliária interna, por categoria de detentor (RMD/Tesouro), normalizado a 100%"
      toolbar={
        <>
          <CockpitChip cor={COR_NAO_RESIDENTES}>não-residentes {fmtPct(atual.nao_residentes, 1)}</CockpitChip>
          <AzPeriodSelector
            value={period}
            onChange={setPeriod}
            min={minIso}
            max={maxIso}
            periods={["ytd", "1y", "5y", "max"]}
          />
        </>
      }
      footer={
        <>
          <strong>Base.</strong> DPMFi EM MERCADO (RMD/Tesouro) — exclui a carteira do BCB; o share de cada categoria é
          calculado dos estoques em R$ bi, com a soma das sete categorias como denominador (a pilha fecha 100% por
          construção). <strong>Leitura.</strong> Não-residentes em destaque: é a fatia sensível ao risco soberano — sai
          primeiro no stress e exige prêmio p/ voltar; instituições financeiras e fundos são a demanda doméstica cativa
          que amortece a rolagem.
        </>
      }
      stampGiro={geradoEm}
      stampDado={maxIso || null}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        {DETENTORES.map((d) => (
          <div key={d.key} className="flex items-center gap-1.5 rounded-lg bg-zinc-50 px-2.5 py-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: d.cor }} aria-hidden />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{d.label}</span>
            <span className="text-sm font-bold tabular-nums text-[#132960]">{fmtPct(atual[d.key], 1)}</span>
          </div>
        ))}
      </div>

      <div className="h-[340px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid {...azGridProps()} />
            <XAxis {...azXAxisProps()} dataKey="iso" tickFormatter={fmtMesCurto} minTickGap={32} />
            <YAxis
              {...azYAxisProps()}
              width={44}
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickFormatter={(v: number) => `${v}%`}
            />

            <Tooltip
              content={<AzTooltip labelFmt={(l) => fmtMesCurto(String(l))} valueFmt={(v) => fmtPct(v, 1)} />}
              cursor={AZ_TOOLTIP_PROPS.cursor}
            />

            {DETENTORES.map((d) => (
              <Area
                key={d.key}
                type="monotone"
                dataKey={d.key}
                name={d.label}
                stackId="detentores"
                stroke={d.cor}
                strokeWidth={d.key === "nao_residentes" ? 1.5 : 1}
                fill={d.cor}
                fillOpacity={d.key === "nao_residentes" ? 0.85 : 0.7}
                isAnimationActive={false}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
