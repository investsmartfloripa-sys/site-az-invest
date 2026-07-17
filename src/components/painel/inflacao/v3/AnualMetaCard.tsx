"use client";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { SerieLongaBlock } from "@/lib/painel-ipca";
import { AzTooltip, azGridProps, azTooltipProps, azXAxisProps, azYAxisProps, ChartCard } from "@/components/painel/core";
import { AZ_CHART } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum } from "@/lib/format-br";

/**
 * Fechamento de cada ano-calendário contra a meta e a banda do CMN: barra =
 * IPCA de dezembro (12m oficial); ano corrente = 12m até o mês disponível
 * (marcado como parcial). Barra vermelha = fora da banda. Seleção puramente
 * presentacional sobre a serie_longa do builder — nenhuma conta aqui.
 */

type Row = {
  ano: string;
  valor: number;
  meta: number;
  piso: number;
  teto: number;
  parcial: boolean;
  fora: boolean;
};

export function AnualMetaCard({ longa, geradoEm }: { longa: SerieLongaBlock; geradoEm: string }) {
  const { rows, mesUltimo } = useMemo(() => {
    const porAno = new Map<string, (typeof longa.serie)[number]>();
    for (const p of longa.serie) {
      if (p.acum_12m == null) continue;
      porAno.set(p.mes.slice(0, 4), p); // último mês disponível de cada ano
    }
    const ultimo = longa.serie.at(-1);
    const anoUltimo = ultimo?.mes.slice(0, 4);
    const out: Row[] = [];
    for (const [ano, p] of porAno) {
      const parcial = ano === anoUltimo && !p.mes.endsWith("-12");
      const valor = p.acum_12m as number;
      out.push({
        ano,
        valor,
        meta: p.meta,
        piso: p.piso,
        teto: p.teto,
        parcial,
        fora: valor > p.teto || valor < p.piso,
      });
    }
    out.sort((a, b) => a.ano.localeCompare(b.ano));
    return { rows: out, mesUltimo: ultimo?.mes ?? null };
  }, [longa]);

  if (rows.length === 0) return null;

  return (
    <ChartCard
      title="Ano a ano contra a meta"
      subtitle="IPCA de cada ano-calendário (dezembro, 12m oficial) e a banda vigente. O ano corrente entra como 12 meses até o último dado, marcado como parcial."
      footer="Barra vermelha = fechou fora da banda de tolerância do ano (carta aberta do BC ao CMN até 2024; no regime contínuo, 6 meses seguidos fora). Barra navy = dentro da banda. Linha vermelha = centro da meta; cinzas = piso e teto."
      stampGiro={geradoEm}
      stampDado={mesUltimo}
    >
      <div className="h-[300px] w-full">
        <ResponsiveContainer>
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid {...azGridProps} />
            <XAxis {...azXAxisProps} dataKey="ano" interval={2} />
            <YAxis {...azYAxisProps} tickFormatter={(v: number) => `${fmtNum(v, 0)}%`} width={40} />
            <Tooltip
              content={<AzTooltip valueFmt={(v) => `${fmtNum(v, 2)}%`} />}
              cursor={azTooltipProps().cursor}
            />
            <Bar dataKey="valor" name="IPCA no ano" radius={[3, 3, 0, 0]} maxBarSize={26}>
              {rows.map((r) => (
                <Cell
                  key={r.ano}
                  fill={r.fora ? AZ_CHART.neg : "#132960"}
                  fillOpacity={r.parcial ? 0.45 : 1}
                />
              ))}
            </Bar>
            <Line dataKey="meta" name="Meta" type="stepAfter" stroke={AZ_CHART.neg} strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
            <Line dataKey="teto" name="Teto" type="stepAfter" stroke="#94A3B8" strokeDasharray="3 3" strokeWidth={1} dot={false} />
            <Line dataKey="piso" name="Piso" type="stepAfter" stroke="#94A3B8" strokeDasharray="3 3" strokeWidth={1} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {mesUltimo && !mesUltimo.endsWith("-12") ? (
        <p className="mt-2 text-[11px] text-zinc-500">
          Barra translúcida de {mesUltimo.slice(0, 4)} = 12 meses até {fmtMesCurto(mesUltimo)} (parcial).
        </p>
      ) : null}
    </ChartCard>
  );
}
