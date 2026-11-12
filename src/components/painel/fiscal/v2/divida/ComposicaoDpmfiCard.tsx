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

import type { FiscalClassicosData, PontoMensal } from "@/lib/painel-fiscal";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AzPeriodSelector, resolvePeriodRange, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AZ_BRAND, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtPct } from "@/lib/format-br";
import { CockpitChip, LinkSecundario, ValoresPorCategoria, dataIso } from "./shared";

/**
 * Composição da DPMFi por indexador — stacked area NORMALIZADA a 100% com as
 * SEIS fatias (o card antigo plotava 3 áreas SEM stackId e omitia a fatia de
 * índices de preços/NTN-B, ~27% do estoque — agora ela vem da SGS 12001 e o
 * stack fecha de verdade). Só entram meses em que as fatias somam ≈100%.
 *
 * Padrão cockpit: título FIXO técnico + chip da fatia Selic; leitura no
 * footer (?). SEM <Legend>: os chips por fatia (cor + label + valor) já fazem
 * o papel — legenda seria dupla.
 *
 * A fatia Selic/LFT fica na BASE da pilha: o topo dela é a própria
 * participação. O pico histórico (derivado da série) vai no chip e no (?), não
 * no gráfico: o rótulo caía na borda esquerda, cortado sobre o eixo (revisão 12/11/2026).
 * Fatias zeradas (TR, Outros) somem das pílulas e da pilha.
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

  // Stack 100% VERDADEIRO: só meses em que as seis fatias fecham ≈100 (97–103),
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
      if (soma < 97 || soma > 103) continue; // mês incompleto (ex.: antes da SGS 12001) — fora do stack
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
      <ChartCard title="DPMFi por indexador (% do estoque)" stampGiro={geradoEm}>
        <p className="flex h-64 items-center justify-center text-sm text-zinc-500">
          Sem meses em que as seis fatias fecham 97–103% — verifique a coleta da SGS 12001 no pipeline.
        </p>
      </ChartCard>
    );
  }

  const atual = todasRows[todasRows.length - 1];
  const maiorAtual = FATIAS.reduce((a, b) => (atual[b.key] > atual[a.key] ? b : a));

  // Leitura interpretativa verificada contra o dado — footer (?), nunca título.
  const leitura =
    maiorAtual.key === "selic"
      ? `Selic indexa ${fmtPct(atual.selic, 0)} da dívida mobiliária — cada alta de juro repassa direto ao estoque.`
      : `${maiorAtual.label} é a maior fatia da DPMFi (${fmtPct(atual[maiorAtual.key], 0)}).`;

  // Fatias que não aparecem em nenhum mês visível (ex.: TR e Outros em 0,0%) ficam fora da pilha.
  const fatiasNaPilha = FATIAS.filter((f) => rows.some((r) => r[f.key] >= 0.05));
  const valoresAtuais = FATIAS.map((f) => ({ key: f.key, label: f.label, cor: f.cor, valor: atual[f.key] }));

  return (
    <ChartCard
      title="DPMFi por indexador (% do estoque)"
      subtitle="Dívida Pública Mobiliária Federal interna por indexador, normalizada a 100%. A base da pilha é a fatia Selic/LFT — quanto maior, mais o custo da dívida acompanha o juro básico em tempo real."
      toolbar={
        <>
          <CockpitChip cor={AZ_BRAND.azure}>
            Selic {fmtPct(atual.selic, 1)} do estoque
            {picoSelic ? ` · pico ${fmtPct(picoSelic.v, 0)} em ${fmtMesCurto(picoSelic.iso)}` : ""}
          </CockpitChip>
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
          <strong>Leitura.</strong> {leitura} Vulnerabilidades por fatia: <strong>Selic/LFT</strong> repassa cada alta da Selic ao estoque imediatamente
          (risco de juros); <strong>índices de preços/NTN-B</strong> indexa à inflação; <strong>câmbio</strong> expõe a
          desvalorização — hoje fatia residual (virtude estrutural do Brasil); <strong>prefixado</strong> trava o custo
          na emissão. Fontes: BCB SGS 4174–4178 e 12001 (índices de preços — a fatia NTN-B que faltava). Meses em que as
          fatias não fecham entre 97% e 103% ficam fora do stack (renormalizados a 100% quando entram).
          {picoSelic ? ` Pico histórico da fatia Selic: ${fmtPct(picoSelic.v, 1)} em ${fmtMesCurto(picoSelic.iso)}.` : ""}
        </>
      }
      stampGiro={geradoEm}
      stampDado={maxIso || null}
    >
      <ValoresPorCategoria itens={valoresAtuais} posicao="acima" />

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

            {fatiasNaPilha.map((f) => (
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
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <ValoresPorCategoria itens={valoresAtuais} posicao="abaixo" />

      <p className="mt-3">
        <LinkSecundario href="/painel-economico/economia/brasil/fiscal/indicadores-de-risco-fiscal#semaforo">
          Estado de risco por indexador →
        </LinkSecundario>
      </p>
    </ChartCard>
  );
}
