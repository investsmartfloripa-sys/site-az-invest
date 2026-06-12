"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
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

import type { CodaceFaixaAtividade } from "@/lib/painel-atividade";
import type { CagedTotalData } from "@/lib/painel-emprego";
import { AzSegmented, AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps, azZeroLineProps } from "@/components/painel/core";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS, variationFill } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtSignedNum } from "@/lib/format-br";
import { mesIso } from "@/components/painel/atividade/v2/shared";
import { codaceFaixasCat, fmtMil, tendenciaMm3 } from "./shared";

/**
 * ÂNCORA do CAGED v2 — "o mercado formal está acelerando ou perdendo fôlego?"
 *
 * Barras do saldo MENSAL CRU (verde/vermelho pela direção) + linha navy do
 * mm3 do saldo DESSAZONALIZADO (STL própria — o momentum de verdade) + mm12
 * tracejada como tendência longa secundária. O cru de janeiro/dezembro
 * engana (sazonalidade forte); a leitura editorial vem da linha SA.
 */

type Janela = "24m" | "2020";

export function MomentumCard({
  total,
  codaceMensal,
  geradoEm,
}: {
  total: CagedTotalData;
  codaceMensal?: CodaceFaixaAtividade[];
  geradoEm: string;
}) {
  const [janela, setJanela] = useState<Janela>("24m");

  const serie = total.serie;

  const rows = useMemo(() => {
    const base = janela === "24m" ? serie.slice(-24) : serie.filter((r) => r.mes >= "2020-01");
    return base.map((r) => ({
      mes: r.mes,
      saldo: r.saldo != null ? +(r.saldo / 1000).toFixed(1) : null,
      mm3sa: r.saldo_sa_mm3 != null ? +(r.saldo_sa_mm3 / 1000).toFixed(1) : null,
      mm12: r.saldo_mm12 != null ? +(r.saldo_mm12 / 1000).toFixed(1) : null,
    }));
  }, [serie, janela]);

  const faixas = useMemo(
    () =>
      codaceFaixasCat(
        codaceMensal,
        rows.map((r) => r.mes),
      ),
    [codaceMensal, rows],
  );

  // Título afirmativo pelo momentum SA — nunca pelo número cru do mês.
  const mm3 = useMemo(() => tendenciaMm3(serie), [serie]);
  const titulo = (() => {
    if (!mm3) return "Saldo mensal do CAGED — cru × dessazonalizado";
    const ritmo = fmtMil(Math.abs(mm3.valor));
    const cauda = mm3.dir === "acelera" ? " — e acelera" : mm3.dir === "desacelera" ? " — mas perde fôlego" : ", em ritmo estável";
    return mm3.valor >= 0
      ? `No ritmo dessazonalizado, o mercado formal cria ${ritmo} vagas por mês${cauda}`
      : `No ritmo dessazonalizado, o mercado formal fecha ${ritmo} vagas por mês${cauda}`;
  })();

  const ult = serie[serie.length - 1];

  return (
    <ChartCard
      title={titulo}
      subtitle="Barras: saldo mensal CRU (admissões − desligamentos, mil postos). Linha navy: média móvel de 3 meses do saldo dessazonalizado — o sinal de momentum. Tracejada: média móvel de 12 meses (tendência longa)."
      toolbar={
        <AzSegmented
          ariaLabel="Janela do gráfico"
          options={[
            { id: "24m", label: "24m" },
            { id: "2020", label: "Desde 2020" },
          ]}
          value={janela}
          onChange={(id) => setJanela(id as Janela)}
        />
      }
      footer="Saldo cru: consolidado oficial MTE via IPEADATA. Dessazonalização PRÓPRIA (STL robusta a 2020) — o MTE não publica série SA do Novo CAGED; números crus de janeiro e dezembro enganam pela sazonalidade. Faixas cinzas: recessões CODACE/FGV."
      stampGiro={geradoEm}
      stampDado={ult ? mesIso(ult.mes) : null}
    >
      <div className="h-[360px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid {...azGridProps()} />
            <XAxis {...azXAxisProps()} dataKey="mes" tickFormatter={fmtMesCurto} minTickGap={28} />
            <YAxis {...azYAxisProps()} width={44} tickFormatter={(v: number) => fmtNum(v, 0)} />

            {faixas.map((f, i) => (
              <ReferenceArea key={`codace-${i}`} x1={f.x1} x2={f.x2} fill={AZ_CHART.ticks} fillOpacity={0.07} stroke="none" />
            ))}

            <ReferenceLine {...azZeroLineProps("y")} />

            <Tooltip
              content={
                <AzTooltip labelFmt={(l) => fmtMesCurto(String(l))} valueFmt={(v) => `${fmtSignedNum(v, 1)} mil`} />
              }
              cursor={AZ_TOOLTIP_PROPS.cursor}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />

            <Bar dataKey="saldo" name="Saldo do mês (cru)" isAnimationActive={false} maxBarSize={18} radius={[2, 2, 0, 0]}>
              {rows.map((r) => (
                <Cell key={r.mes} fill={variationFill(r.saldo ?? 0)} />
              ))}
            </Bar>
            <Line
              type="monotone"
              dataKey="mm3sa"
              name="mm3 do saldo dessazonalizado"
              stroke={AZ_BRAND.navy}
              strokeWidth={2.2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="mm12"
              name="mm12 (tendência longa)"
              stroke={AZ_CHART.ticks}
              strokeWidth={1.2}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
