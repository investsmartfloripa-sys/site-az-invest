"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { CambioMacroData } from "@/lib/painel-contas-externas";
import { ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AZ_BRAND, AZ_CHART } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtSignedPct } from "@/lib/format-br";

/**
 * Bloco 03 — "juro alto garante câmbio?" — a UIP na prática.
 *
 * Scatter: x = diferencial Selic−Fed de 12 meses atrás (p.p. a.a.);
 * y = variação % da PTAX efetivamente realizada nos 12m seguintes
 * (alta = depreciação). Se a paridade descoberta de juros valesse, os pontos
 * cairiam na reta y = x. A literatura (Fama 1984 e sucessores) diz que ela
 * FALHA no curto prazo — a dispersão do gráfico É o insight: juro alto não
 * garante câmbio.
 */

type Pt = { x: number; y: number; mes: string };

function UipTooltip({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: Pt }> }) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <div
      style={{
        background: AZ_BRAND.navy,
        borderRadius: 8,
        color: "#fff",
        fontSize: 12,
        boxShadow: "0 4px 12px rgba(19,41,96,.25)",
        padding: "8px 12px",
      }}
    >
      <p style={{ color: "#94A3B8", fontWeight: 600, margin: 0, marginBottom: 4 }}>
        12m encerrados em {fmtMesCurto(p.mes)}
      </p>
      <p style={{ margin: 0 }}>Diferencial 12m antes: {fmtNum(p.x, 1)} p.p.</p>
      <p style={{ margin: 0 }}>Variação cambial realizada: {fmtSignedPct(p.y, 1)}</p>
    </div>
  );
}

export function UipScatterCard({ data }: { data: CambioMacroData }) {
  const { pontos, ultimo, dominio } = useMemo(() => {
    const pts: Pt[] = data.juros.uip.pontos.map((p) => ({
      x: p.diferencial_t12_pp,
      y: p.var_cambial_12m_pct,
      mes: p.mes,
    }));
    const u = pts.length > 0 ? pts[pts.length - 1] : null;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const lim = (vals: number[]): [number, number] => {
      if (vals.length === 0) return [0, 1];
      const lo = Math.min(...vals);
      const hi = Math.max(...vals);
      const pad = (hi - lo) * 0.08 || 1;
      return [Math.floor(lo - pad), Math.ceil(hi + pad)];
    };
    return { pontos: pts, ultimo: u, dominio: { x: lim(xs), y: lim(ys) } };
  }, [data.juros.uip.pontos]);

  const stats = data.juros.uip.stats;

  // Reta y = x recortada à diagonal visível do domínio plotado.
  const diagIni = Math.max(dominio.x[0], dominio.y[0]);
  const diagFim = Math.min(dominio.x[1], dominio.y[1]);

  return (
    <ChartCard
      title="Juro alto não garante câmbio: veja a dispersão"
      subtitle="Cada ponto é uma janela de 12 meses desde 2001: diferencial de juros no início (eixo X) vs variação cambial efetivamente realizada (eixo Y, alta = depreciação). Se a paridade descoberta de juros valesse, os pontos cairiam na reta y = x."
      footer={
        <span>
          Placar da amostra ({stats.n} janelas): correlação de {fmtNum(stats.correlacao, 2)} entre diferencial e
          variação realizada{stats.correlacao != null && stats.correlacao <= 0 ? " (sinal contrário ao previsto pela paridade — o clássico forward premium puzzle)" : ""}; erro médio de{" "}
          {fmtNum(stats.erro_medio_pp, 1)} p.p. e desvio-padrão do erro de {fmtNum(stats.erro_dp_pp, 1)} p.p.
          {stats.pct_depreciou_com_dif_positivo != null
            ? ` Com diferencial positivo, o real depreciou nos 12m seguintes em ${fmtNum(stats.pct_depreciou_com_dif_positivo, 0)}% das janelas.`
            : ""}{" "}
          A literatura empírica documenta exatamente isso: a UIP falha no curto prazo.
        </span>
      }
      stampGiro={data.generated_at}
      stampDado={ultimo?.mes ?? null}
    >
      <div className="h-[340px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 12, right: 24, bottom: 14, left: 0 }}>
            <CartesianGrid {...azGridProps()} />
            <XAxis
              {...azXAxisProps()}
              type="number"
              dataKey="x"
              domain={dominio.x}
              tickFormatter={(v) => fmtNum(Number(v), 0)}
              label={{
                value: "Diferencial Selic − Fed 12m antes (p.p. a.a.)",
                position: "insideBottom",
                offset: -8,
                fontSize: 10,
                fill: AZ_CHART.ticks,
              }}
            />
            <YAxis
              {...azYAxisProps()}
              type="number"
              dataKey="y"
              width={56}
              domain={dominio.y}
              tickFormatter={(v) => `${fmtNum(Number(v), 0)}%`}
              label={{
                value: "Variação cambial realizada 12m (%)",
                angle: -90,
                position: "insideLeft",
                fontSize: 10,
                fill: AZ_CHART.ticks,
              }}
            />
            <ReferenceLine y={0} stroke={AZ_CHART.zero} strokeOpacity={AZ_CHART.zeroOpacity} strokeWidth={1.5} />
            <ReferenceLine x={0} stroke={AZ_CHART.zero} strokeOpacity={AZ_CHART.zeroOpacity} strokeWidth={1} />
            {diagFim > diagIni ? (
              <ReferenceLine
                segment={[
                  { x: diagIni, y: diagIni },
                  { x: diagFim, y: diagFim },
                ]}
                stroke={AZ_BRAND.rust}
                strokeDasharray="4 4"
                strokeWidth={1.2}
                label={{
                  value: "se a UIP valesse (y = x)",
                  position: "insideTopRight",
                  fontSize: 10,
                  fill: AZ_BRAND.rust,
                }}
              />
            ) : null}
            <Tooltip content={<UipTooltip />} cursor={{ stroke: AZ_BRAND.navy, strokeOpacity: 0.2 }} />
            <Scatter data={pontos} fill={AZ_BRAND.azure} fillOpacity={0.35} isAnimationActive={false} />
            {ultimo ? (
              <Scatter
                data={[ultimo]}
                fill={AZ_BRAND.rust}
                fillOpacity={1}
                isAnimationActive={false}
                shape="circle"
              />
            ) : null}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      {ultimo ? (
        <p className="mt-1 text-[11px] text-zinc-500">
          Ponto em destaque (laranja): janela mais recente, encerrada em {fmtMesCurto(ultimo.mes)} — diferencial
          de {fmtNum(ultimo.x, 1)} p.p. no início da janela, variação cambial realizada de{" "}
          {fmtSignedPct(ultimo.y, 1)}.
        </p>
      ) : null}
    </ChartCard>
  );
}
