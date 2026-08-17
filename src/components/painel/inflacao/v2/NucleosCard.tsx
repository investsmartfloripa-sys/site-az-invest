"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
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

import type { NucleosBlock } from "@/lib/painel-ipca";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtPct } from "@/lib/format-br";
import { META, META_PISO, META_TETO, NUCLEO_INFO, NUCLEOS_5, num } from "./shared";

/**
 * Bloco 01 — "a inflação subjacente converge para a meta?".
 *
 * Revisão ago/2026 (relatório do editor): este card ABSORVEU o "Os cinco
 * núcleos, um a um" (barras), que deixou de existir. Antes o gráfico mostrava
 * só a média dos 5 com uma banda de amplitude; agora traz OS CINCO núcleos,
 * cada um com sua linha, mais a média em destaque e o IPCA cheio como régua.
 * O glossário que vivia no card de barras veio junto, visível abaixo do
 * gráfico — é o que faz a sigla virar informação.
 *
 * Chips ligam/desligam cada núcleo: cinco linhas simultâneas viram spaghetti,
 * então elas nascem esmaecidas atrás da média e o leitor destaca a que quiser.
 *
 * Tudo em acumulado 12m COMPOSTO calculado no builder.
 */

/** Cor de cada núcleo — paleta categórica, estável entre sessões. */
const COR_NUCLEO: Record<string, string> = {
  EX0: "#FF5713",
  EX3: "#7C3AED",
  MS: "#1E8A5C",
  DP: "#A16207",
  P: "#0891B2",
};

export function NucleosCard({ nucleos, geradoEm }: { nucleos: NucleosBlock; geradoEm: string }) {
  const [destacados, setDestacados] = useState<string[]>([]);

  const rows = useMemo(
    () =>
      (nucleos.serie_12m ?? []).map((r) => {
        const linha: Record<string, number | string | null> = {
          mes: r.mes,
          media_nucleos: num(r, "media_nucleos"),
          ipca: num(r, "IPCA cheio"),
        };
        for (const k of NUCLEOS_5) linha[k] = num(r, k);
        return linha;
      }),
    [nucleos.serie_12m],
  );

  const ultimo = rows[rows.length - 1];
  const alternar = (k: string) =>
    setDestacados((v) => (v.includes(k) ? v.filter((x) => x !== k) : [...v, k]));

  return (
    <ChartCard
      title="Núcleos de inflação (12 meses)"
      subtitle="Núcleo é o IPCA sem os preços que sobem e descem por motivo passageiro — a inflação que tende a ficar. O Banco Central acompanha cinco: EX0, EX3, MS, DP e P55."
      toolbar={
        <div className="flex flex-wrap items-center gap-1.5">
          {NUCLEOS_5.map((k) => {
            const on = destacados.includes(k);
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() => alternar(k)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  on ? "border-[#132960] bg-white text-[#132960]" : "border-zinc-200 bg-zinc-50 text-zinc-400"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: on ? COR_NUCLEO[k] : "#d1d5db" }}
                />
                {NUCLEO_INFO[k].sigla}
              </button>
            );
          })}
        </div>
      }
      footer={
        <>
          <p className="mb-1.5">
            <strong>Os cinco núcleos acompanhados pelo BC</strong> (conjunto vigente desde o Estudo Especial 102/2020;
            o antigo MA saiu por ser redundante com o MS):
          </p>
          <ul className="mb-1.5 space-y-1">
            {NUCLEOS_5.map((k) => (
              <li key={k}>
                <strong>{NUCLEO_INFO[k].sigla}</strong> ({NUCLEO_INFO[k].familia.toLowerCase()}) — {NUCLEO_INFO[k].curta}.
              </li>
            ))}
          </ul>
          <p>
            A linha azul grossa é a média simples dos cinco — é por ela que o Copom comunica, não por uma medida
            “preferida”. Quando as cinco correm juntas, o sinal é confiável; quando abrem o leque, as medidas discordam
            e vale olhar cada uma. Tudo em acumulado de 12 meses composto. A meta contínua é de {fmtPct(META, 1)}, com
            banda de {fmtPct(META_PISO, 1)} a {fmtPct(META_TETO, 1)}.
          </p>
        </>
      }
      stampGiro={geradoEm}
      stampDado={typeof ultimo?.mes === "string" ? ultimo.mes : null}
    >
      {rows.length === 0 ? (
        <p className="flex h-64 items-center justify-center text-sm text-zinc-400">
          Série de núcleos em 12m ainda não disponível neste JSON.
        </p>
      ) : (
        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid {...azGridProps()} />
              <XAxis {...azXAxisProps()} dataKey="mes" tickFormatter={fmtMesCurto} minTickGap={28} />
              <YAxis {...azYAxisProps()} width={44} tickFormatter={(v: number) => `${fmtNum(v, 1)}%`} />

              <ReferenceArea
                y1={META_PISO}
                y2={META_TETO}
                fill={AZ_CHART.ticks}
                fillOpacity={0.08}
                stroke="none"
                label={{ value: "banda da meta", position: "insideTopRight", fontSize: 9, fill: AZ_CHART.ticks }}
              />
              <ReferenceLine
                y={META}
                stroke={AZ_BRAND.navy}
                strokeDasharray="4 4"
                strokeWidth={1.2}
                label={{ value: "meta 3,0%", position: "insideBottomRight", fontSize: 9, fill: AZ_BRAND.navy }}
              />

              <Tooltip
                content={<AzTooltip labelFmt={(l) => fmtMesCurto(String(l))} valueFmt={(v) => fmtPct(v, 2)} />}
                cursor={AZ_TOOLTIP_PROPS.cursor}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />

              <Line
                type="monotone"
                dataKey="ipca"
                name="IPCA cheio (12m)"
                stroke={AZ_CHART.ticks}
                strokeWidth={1.5}
                strokeDasharray="5 3"
                dot={false}
                isAnimationActive={false}
              />
              {/* Os CINCO núcleos: esmaecidos por padrão (o conjunto conta a
                  história), realçados um a um pelos chips do topo. */}
              {NUCLEOS_5.map((k) => {
                const on = destacados.includes(k);
                return (
                  <Line
                    key={k}
                    type="monotone"
                    dataKey={k}
                    name={`Núcleo ${NUCLEO_INFO[k].sigla}`}
                    stroke={COR_NUCLEO[k]}
                    strokeWidth={on ? 2 : 1}
                    strokeOpacity={on ? 1 : 0.32}
                    dot={false}
                    isAnimationActive={false}
                  />
                );
              })}
              <Line
                type="monotone"
                dataKey="media_nucleos"
                name="Média dos 5 núcleos"
                stroke={AZ_BRAND.azure}
                strokeWidth={2.6}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Glossário VISÍVEL — herdado do card de barras que este absorveu. */}
      <dl className="mt-4 space-y-2 rounded-lg border border-zinc-100 bg-[#f8fafc] p-3 text-[11px] leading-relaxed">
        <p className="font-semibold text-[#132960]">O que cada núcleo tira da conta</p>
        {NUCLEOS_5.map((k) => (
          <div key={k} className="flex gap-2">
            <dt className="flex w-16 shrink-0 items-center gap-1.5 font-semibold text-zinc-700">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: COR_NUCLEO[k] }} />
              {NUCLEO_INFO[k].sigla}
            </dt>
            <dd className="text-zinc-600">
              <span className="text-zinc-400">{NUCLEO_INFO[k].familia}</span> · {NUCLEO_INFO[k].curta}.
            </dd>
          </div>
        ))}
        <p className="pt-1 text-zinc-500">
          A linha cinza tracejada (IPCA cheio) é a régua: quando os núcleos rodam abaixo dela, a alta do índice está
          vindo de itens voláteis; quando rodam acima, a pressão é de fundo.
        </p>
      </dl>
    </ChartCard>
  );
}
