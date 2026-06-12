"use client";

import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { FiscalClassicosData, PontoMensal } from "@/lib/painel-fiscal";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AzPeriodSelector, resolvePeriodRange, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtPct } from "@/lib/format-br";
import { dataIso } from "./shared";

/**
 * Composição da DPMFi por indexador — stacked area NORMALIZADA a 100% com as
 * SEIS fatias (o card antigo plotava 3 áreas SEM stackId e omitia a fatia de
 * índices de preços/NTN-B, ~27% do estoque — agora ela vem da SGS 12001 e o
 * stack fecha de verdade). Só entram meses em que as fatias somam ≈100%.
 *
 * A fatia Selic/LFT fica na BASE da pilha: o topo dela é a própria
 * participação, e o pico histórico (derivado da série) é anotado no gráfico.
 */

type FatiaKey = "selic" | "indices" | "prefixado" | "cambio" | "tr" | "outros";

const FATIAS: { key: FatiaKey; label: string; cor: string }[] = [
  { key: "selic", label: "Selic (LFT)", cor: AZ_BRAND.azure },
  { key: "indices", label: "Índices de preços (NTN-B)", cor: "#A16207" }, // ocre — cor fixa NTN-B da casa
  { key: "prefixado", label: "Prefixado", cor: AZ_BRAND.navy },
  { key: "cambio", label: "Câmbio", cor: "#1E8A5C" }, // verde — convenção "dólar"
  { key: "tr", label: "TR", cor: "#0891B2" },
  { key: "outros", label: "Outros", cor: "#94A3B8" },
];

type Row = { iso: string } & Record<FatiaKey, number>;

function mapaPorMes(serie: ReadonlyArray<PontoMensal> | undefined): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of serie ?? []) {
    if (p.valor != null && Number.isFinite(p.valor)) m.set(dataIso(p.data), p.valor);
  }
  return m;
}

export function ComposicaoDpmfiCard({
  composicao,
  geradoEm,
}: {
  composicao: NonNullable<FiscalClassicosData["composicao_dpmfi"]>;
  geradoEm: string;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });

  // Stack 100% VERDADEIRO: só meses em que as seis fatias fecham ≈100 (90–110),
  // renormalizados a exatamente 100 — nunca uma pilha que não soma.
  const todasRows = useMemo<Row[]>(() => {
    const mapas: Record<FatiaKey, Map<string, number>> = {
      selic: mapaPorMes(composicao.selic_pct),
      indices: mapaPorMes(composicao.indices_precos_pct),
      prefixado: mapaPorMes(composicao.prefixado_pct),
      cambio: mapaPorMes(composicao.cambio_pct),
      tr: mapaPorMes(composicao.tr_pct),
      outros: mapaPorMes(composicao.outros_pct),
    };
    const meses = [...new Set(FATIAS.flatMap((f) => [...mapas[f.key].keys()]))].sort();
    const out: Row[] = [];
    for (const iso of meses) {
      let soma = 0;
      const brutos: Record<FatiaKey, number> = { selic: 0, indices: 0, prefixado: 0, cambio: 0, tr: 0, outros: 0 };
      for (const f of FATIAS) {
        const v = mapas[f.key].get(iso) ?? 0;
        brutos[f.key] = v;
        soma += v;
      }
      if (soma < 90 || soma > 110) continue; // mês incompleto (ex.: antes da SGS 12001) — fora do stack
      const row = { iso } as Row;
      for (const f of FATIAS) row[f.key] = +((100 * brutos[f.key]) / soma).toFixed(2);
      out.push(row);
    }
    return out;
  }, [composicao]);

  const minIso = todasRows.length > 0 ? todasRows[0].iso : "";
  const maxIso = todasRows.length > 0 ? todasRows[todasRows.length - 1].iso : "";

  const rows = useMemo(() => {
    if (todasRows.length === 0) return [];
    const { from, to } = resolvePeriodRange(period, minIso, maxIso);
    return todasRows.filter((r) => r.iso >= from && r.iso <= to);
  }, [todasRows, period, minIso, maxIso]);

  // Anotação DERIVADA: pico histórico da fatia Selic (a fatia da base da pilha).
  const picoSelic = useMemo(() => {
    let melhor: { iso: string; v: number } | null = null;
    for (const r of todasRows) {
      if (melhor == null || r.selic > melhor.v) melhor = { iso: r.iso, v: r.selic };
    }
    return melhor;
  }, [todasRows]);

  if (todasRows.length === 0) {
    return (
      <ChartCard title="Composição da DPMFi por indexador" stampGiro={geradoEm}>
        <p className="flex h-64 items-center justify-center text-sm text-zinc-400">
          Sem meses em que as seis fatias fecham ≈100% — verifique a coleta da SGS 12001 no pipeline.
        </p>
      </ChartCard>
    );
  }

  const atual = todasRows[todasRows.length - 1];
  const maiorAtual = FATIAS.reduce((a, b) => (atual[b.key] > atual[a.key] ? b : a));

  // Título afirmativo verificado contra o dado: nomeia a maior fatia atual.
  const titulo =
    maiorAtual.key === "selic"
      ? `Selic indexa ${fmtPct(atual.selic, 0)} da dívida mobiliária — cada alta de juro repassa direto ao estoque`
      : `${maiorAtual.label} é a maior fatia da DPMFi (${fmtPct(atual[maiorAtual.key], 0)})`;

  const picoVisivel = picoSelic != null && rows.some((r) => r.iso === picoSelic.iso);

  return (
    <ChartCard
      title={titulo}
      subtitle="Dívida Pública Mobiliária Federal interna por indexador, normalizada a 100%. A base da pilha é a fatia Selic/LFT — quanto maior, mais o custo da dívida acompanha o juro básico em tempo real."
      toolbar={
        <AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />
      }
      footer={
        <>
          Vulnerabilidades por fatia: <strong>Selic/LFT</strong> repassa cada alta da Selic ao estoque imediatamente
          (risco de juros); <strong>índices de preços/NTN-B</strong> indexa à inflação; <strong>câmbio</strong> expõe a
          desvalorização — hoje fatia residual (virtude estrutural do Brasil); <strong>prefixado</strong> trava o custo
          na emissão. Fontes: BCB SGS 4174–4178 e 12001 (índices de preços — a fatia NTN-B que faltava). Meses em que as
          fatias não fecham ≈100% ficam fora do stack.
          {picoSelic ? ` Pico histórico da fatia Selic: ${fmtPct(picoSelic.v, 1)} em ${fmtMesCurto(picoSelic.iso)}.` : ""}
        </>
      }
      stampGiro={geradoEm}
      stampDado={maxIso || null}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        {FATIAS.map((f) => (
          <div key={f.key} className="flex items-center gap-1.5 rounded-lg bg-zinc-50 px-2.5 py-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: f.cor }} aria-hidden />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{f.label}</span>
            <span className="text-sm font-bold tabular-nums text-[#132960]">{fmtPct(atual[f.key], 1)}</span>
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
            <Legend wrapperStyle={{ fontSize: 11 }} />

            {FATIAS.map((f) => (
              <Area
                key={f.key}
                type="monotone"
                dataKey={f.key}
                name={f.label}
                stackId="dpmfi"
                stroke={f.cor}
                strokeWidth={1}
                fill={f.cor}
                fillOpacity={0.75}
                isAnimationActive={false}
              />
            ))}

            {picoVisivel && picoSelic ? (
              <ReferenceDot
                x={picoSelic.iso}
                y={picoSelic.v}
                r={3}
                fill={AZ_BRAND.navy}
                stroke="#FFFFFF"
                strokeWidth={1}
                label={{
                  value: `pico LFT ${fmtPct(picoSelic.v, 0)} · ${fmtMesCurto(picoSelic.iso)}`,
                  position: "top",
                  offset: 6,
                  fontSize: 9,
                  fill: AZ_CHART.labels,
                }}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
