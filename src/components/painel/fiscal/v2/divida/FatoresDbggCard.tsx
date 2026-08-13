"use client";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { FiscalDbggFatoresData } from "@/lib/painel-fiscal";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtNum, fmtSignedNum } from "@/lib/format-br";
import { CockpitChip } from "./shared";

/**
 * Decomposição OFICIAL da variação da DBGG (fatores condicionantes da Nota de
 * Imprensa/BCB), anual em p.p. do PIB — barras empilhadas COM SINAL: juros
 * nominais, emissões líquidas, ajuste cambial, outros (dívida externa-outros
 * ajustes + reconhecimento de dívidas + privatizações) e efeito do PIB
 * (denominador). O losango navy marca o Δ total do ano.
 *
 * Mesma anatomia do PorQueSubiuCard (a decomposição CALCULADA da ΔDLSP) — os
 * dois vivem lado a lado na seção Dinâmica; a diferença metodológica fica no
 * footer (?), nunca no título.
 */

const FATORES = [
  { key: "juros", label: "Juros nominais", cor: "#132960" },
  { key: "emissoes", label: "Emissões líquidas", cor: "#027DFC" },
  { key: "cambio", label: "Ajuste cambial", cor: "#D97706" },
  { key: "outros", label: "Outros ajustes", cor: "#94A3B8" },
  { key: "efeito_pib", label: "Efeito PIB (denominador)", cor: "#1E8A5C" },
] as const;

/** Losango navy do Δ total — injetado como dot da Line (Recharts clona com cx/cy). */
function DiamondDot({ cx, cy }: { cx?: number; cy?: number }) {
  if (cx == null || cy == null) return null;
  const r = 4;
  return <path d={`M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`} fill={AZ_BRAND.navy} />;
}

export function FatoresDbggCard({ fatores, geradoEm }: { fatores: FiscalDbggFatoresData; geradoEm: string }) {
  const rows = useMemo(
    () =>
      fatores.anual.map((a) => ({
        ano: a.ano,
        juros: a.juros_nominais_pp,
        emissoes: a.emissoes_liquidas_pp,
        cambio: a.ajuste_cambial_pp,
        outros: a.outros_pp,
        efeito_pib: a.efeito_pib_pp,
        delta: a.variacao_dbgg_pp_pib,
      })),
    [fatores.anual],
  );

  if (rows.length === 0) {
    return (
      <ChartCard title="Decomposição oficial da ΔDBGG (p.p. do PIB)" stampGiro={geradoEm}>
        <p className="flex h-64 items-center justify-center text-sm text-zinc-400">
          O pipeline ainda não publicou os fatores condicionantes da DBGG (build_fiscal_dbgg_fatores.py).
        </p>
      </ChartCard>
    );
  }

  const ult = rows[rows.length - 1];

  return (
    <ChartCard
      title="Decomposição oficial da ΔDBGG (p.p. do PIB)"
      subtitle="Fatores condicionantes da variação da dívida bruta (BCB): barra acima de zero empurra a dívida p/ cima, abaixo puxa p/ baixo. O losango é o Δ total do ano."
      toolbar={
        <CockpitChip cor={AZ_BRAND.navy}>
          Δ {ult.ano}: {fmtSignedNum(ult.delta, 1)} p.p.
        </CockpitChip>
      }
      footer={`${fatores._fonte} ${fatores._nota} Identidade: juros nominais + emissões líquidas + ajuste cambial + outros + efeito PIB ≈ Δ(DBGG/PIB) do ano. Diferença metodológica vs o card da ΔDLSP ao lado: aqui o perímetro é a dívida BRUTA do governo geral e os fatores são os OFICIAIS do BCB (emissões líquidas no lugar do primário; câmbio destacado dos demais ajustes) — lá, a decomposição é calculada pelo pipeline no perímetro consolidado (DLSP), com primário e resíduo. Os dois contam a mesma história por lentes distintas, e não são comparáveis fator a fator.`}
      stampGiro={geradoEm}
      stampDado={`${ult.ano}-12-01`}
    >
      <div className="h-[360px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid {...azGridProps()} />
            <XAxis {...azXAxisProps()} dataKey="ano" minTickGap={16} />
            <YAxis {...azYAxisProps()} width={48} tickFormatter={(v: number) => `${fmtNum(v, 0)} pp`} />

            <ReferenceLine y={0} stroke={AZ_CHART.zero} strokeOpacity={AZ_CHART.zeroOpacity} strokeWidth={1.5} />

            <Tooltip
              content={<AzTooltip labelFmt={(l) => String(l)} valueFmt={(v) => `${fmtSignedNum(v, 1)} p.p.`} />}
              cursor={AZ_TOOLTIP_PROPS.cursor}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />

            {FATORES.map((f) => (
              <Bar
                key={f.key}
                dataKey={f.key}
                name={f.label}
                stackId="fatores"
                fill={f.cor}
                isAnimationActive={false}
                maxBarSize={26}
              />
            ))}
            <Line
              dataKey="delta"
              name="Δ DBGG no ano"
              stroke={AZ_BRAND.navy}
              strokeWidth={1.5}
              dot={<DiamondDot />}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
