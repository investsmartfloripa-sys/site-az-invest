"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { CagedQuebrasData } from "@/lib/painel-emprego";
import { AzSegmented, AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps, azZeroLineProps } from "@/components/painel/core";
import { AzPeriodSelector, resolvePeriodRange, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS, variationFill } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtSignedPct } from "@/lib/format-br";
import { mesIso, mmPoints, toPointsMes } from "@/components/painel/atividade/v2/shared";
import { ultimoCom } from "./shared";

/**
 * "Salário de admissão: ganhando da inflação?" — default REAL (R$ do mês-base
 * do deflator, campos *_real prontos do builder), nominal como toggle
 * secundário. Painel de cima: nível (média + mediana de admissão; demissão
 * tracejada). Painel de baixo: YoY REAL em barras cruas com mm3 sobreposta —
 * o elo com a inflação de serviços.
 */

type Modo = "real" | "nominal";

export function SalarioRealCard({ quebras, geradoEm }: { quebras: CagedQuebrasData; geradoEm: string }) {
  const [modo, setModo] = useState<Modo>("real");
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });

  const serie = quebras.serie;
  const baseMes = quebras.deflator_base_mes ?? null;

  const admPts = useMemo(
    () => toPointsMes(serie, modo === "real" ? "salario_adm_real" : "salario_medio_admissao"),
    [serie, modo],
  );
  const medianaPts = useMemo(
    () => toPointsMes(serie, modo === "real" ? "salario_mediana_adm_real" : "salario_mediana_admissao"),
    [serie, modo],
  );
  const demPts = useMemo(
    () => toPointsMes(serie, modo === "real" ? "salario_dem_real" : "salario_medio_demissao"),
    [serie, modo],
  );

  const minIso = serie.length > 0 ? mesIso(serie[0].mes) : "";
  const maxIso = serie.length > 0 ? mesIso(serie[serie.length - 1].mes) : "";

  // Painel YoY (sempre REAL — é a pergunta do card) + mm3 sobreposta.
  const rowsYoy = useMemo(() => {
    const yoyPts = toPointsMes(serie, "salario_adm_real_yoy_pct");
    const mm3 = new Map<string, number>();
    for (const [d, v] of mmPoints(yoyPts)) mm3.set(d, v);
    const { from, to } = resolvePeriodRange(period, minIso, maxIso);
    const out: { mes: string; yoy: number | null; mm3: number | null }[] = [];
    for (const r of serie) {
      const iso = mesIso(r.mes);
      if (iso < from || iso > to) continue;
      out.push({
        mes: r.mes,
        yoy: r.salario_adm_real_yoy_pct ?? null,
        mm3: mm3.get(iso) ?? null,
      });
    }
    return out;
  }, [serie, period, minIso, maxIso]);

  // Título afirmativo pela última YoY real disponível.
  const yoyUlt = useMemo(() => ultimoCom(serie, (r) => r.salario_adm_real_yoy_pct), [serie]);
  const titulo = (() => {
    if (!yoyUlt) return "Salário de admissão — nível real e variação interanual";
    if (Math.abs(yoyUlt.valor) < 0.1) return `Salário real de admissão empata com a inflação em ${fmtMesCurto(yoyUlt.mes)}`;
    return `Salário real de admissão ${yoyUlt.valor > 0 ? "ganha" : "perde"} da inflação: ${fmtSignedPct(yoyUlt.valor, 1)} em 12 meses`;
  })();

  return (
    <ChartCard
      title={titulo}
      subtitle={
        modo === "real"
          ? `Salário de quem foi ADMITIDO no mês, deflacionado pelo IPCA${baseMes ? ` — em R$ de ${fmtMesCurto(baseMes)}` : ""}. Mediana (navy) onde disponível; demissão tracejada para contraste.`
          : "Salário NOMINAL de quem foi admitido no mês — sem descontar a inflação (use o modo Real para a leitura econômica)."
      }
      toolbar={
        <>
          <AzSegmented
            ariaLabel="Modo de preço"
            options={[
              { id: "real", label: "Real (IPCA)" },
              { id: "nominal", label: "Nominal" },
            ]}
            value={modo}
            onChange={(id) => setModo(id as Modo)}
          />
          <AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />
        </>
      }
      footer={
        <>
          Microdado PDET com cobertura PARCIAL (~40–50% das declarações no prazo) e SEM controle de composição — a média muda
          também porque o mix de vagas muda (o BCB usa versão ajustada por composição no Relatório de Inflação). Média com teto
          de sanidade de 120 SM; a MEDIANA (só meses reprocessados) é robusta à cauda de outliers. Deflator: IPCA (SGS 433)
          {baseMes ? `, salários em R$ de ${fmtMesCurto(baseMes)}` : ""}. Leitura cruzada: salário real de admissão acelerando
          = pressão sobre a inflação de serviços.
        </>
      }
      stampGiro={geradoEm}
      stampDado={serie.length > 0 ? mesIso(serie[serie.length - 1].mes) : null}
    >
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Nível — salário de admissão ({modo === "real" ? `R$ de ${baseMes ? fmtMesCurto(baseMes) : "hoje"}` : "R$ correntes"})
        </p>
        <AzTimeSeriesChart
          series={[
            { id: "adm", label: "Admissão (média)", color: AZ_BRAND.azure, data: admPts },
            ...(medianaPts.length > 0 ? [{ id: "med", label: "Admissão (mediana)", color: AZ_BRAND.navy, data: medianaPts }] : []),
          ]}
          benchmarks={[{ id: "dem", label: "Demissão (média)", color: AZ_CHART.ticks, data: demPts }]}
          unit="R$"
          period={period}
          height={240}
        />

        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Variação interanual do salário REAL de admissão (%)
        </p>
        <div className="h-[170px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rowsYoy} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid {...azGridProps()} />
              <XAxis {...azXAxisProps()} dataKey="mes" tickFormatter={fmtMesCurto} minTickGap={28} />
              <YAxis {...azYAxisProps()} width={40} tickFormatter={(v: number) => fmtSignedPct(v, 0)} />
              <ReferenceLine {...azZeroLineProps("y")} />
              <Tooltip
                content={<AzTooltip labelFmt={(l) => fmtMesCurto(String(l))} valueFmt={(v) => fmtSignedPct(v, 1)} />}
                cursor={AZ_TOOLTIP_PROPS.cursor}
              />
              <Bar dataKey="yoy" name="YoY real" isAnimationActive={false} maxBarSize={14}>
                {rowsYoy.map((r) => (
                  <Cell key={r.mes} fill={variationFill(r.yoy ?? 0)} />
                ))}
              </Bar>
              <Line
                type="monotone"
                dataKey="mm3"
                name="mm3"
                stroke={AZ_BRAND.navy}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </ChartCard>
  );
}
