"use client";

import { useMemo } from "react";
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

import type { FocusMensalBlock } from "@/lib/painel-ipca";
import { AzTooltip, ChartCard, azGridProps, azTooltipProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AZ_BRAND, AZ_CHART } from "@/lib/az-chart-theme";
import { fmtDataBR, fmtMesCurto, fmtMesLongo, fmtNum, fmtSignedNum, fmtSignedPct } from "@/lib/format-br";

/**
 * "Quanto o mercado esperava de inflação e quanto deu" — a primeira pergunta
 * de quem abre o painel no dia da divulgação. Fusão (revisão ago/2026 do
 * editor) de dois cards que viviam separados na aba de expectativas:
 * `FocusMensalCard` (mediana Focus da véspera + próximos meses) e
 * `SurpresasCard` (histórico de realizado − esperado).
 *
 * Os dois componentes originais seguem existindo: o publisher os embute
 * avulsos em post de blog e o painel de IGP-M os reaproveita.
 *
 * Surpresa = realizado − mediana da ÚLTIMA pesquisa Focus antes da divulgação
 * (o BC encerra a coleta do mês no release do IBGE). Tudo pré-computado no
 * builder.
 */

/** Abaixo disso a leitura veio "em linha" com o consenso — não é surpresa. */
const BANDA_EM_LINHA = 0.05;

export function EsperadoRealizadoCard({
  focusMensal,
  realizadoMes,
  geradoEm,
  indicador = "IPCA",
}: {
  focusMensal: FocusMensalBlock;
  realizadoMes: number | null;
  geradoEm: string;
  /** Nome do índice nos textos (default "IPCA") — reuso pelo painel IGP-M. */
  indicador?: string;
}) {
  const vespera = focusMensal.vespera;
  const esperado = vespera?.mediana ?? null;
  const surpresa = realizadoMes != null && esperado != null ? realizadoMes - esperado : null;

  const rows = useMemo(
    () =>
      focusMensal.surpresas.map((s) => ({
        mes: fmtMesCurto(s.mes),
        surpresa: s.surpresa_pp,
        realizado: s.realizado,
        esperado: s.esperado,
      })),
    [focusMensal.surpresas],
  );

  /**
   * Domínio APERTADO no maior desvio observado (+10% de folga), simétrico em
   * torno do zero. O "auto" do Recharts arredondava a escala para ±1,4 p.p.
   * enquanto a maior surpresa da série é ~0,3 — as barras viravam traços
   * (relatório do editor, ago/2026). Piso de ±0,15 p.p. p/ uma série morna não
   * virar ruído ampliado.
   */
  const dominio = useMemo<[number, number]>(() => {
    const pico = rows.reduce((mx, r) => Math.max(mx, Math.abs(r.surpresa ?? 0)), 0);
    const lim = Math.max(0.15, Math.ceil(pico * 1.1 * 100) / 100);
    return [-lim, lim];
  }, [rows]);

  const veredito =
    surpresa == null
      ? null
      : surpresa > BANDA_EM_LINHA
        ? { texto: "acima do que o mercado esperava", cor: AZ_CHART.negText }
        : surpresa < -BANDA_EM_LINHA
          ? { texto: "abaixo do que o mercado esperava", cor: AZ_CHART.neutral }
          : { texto: "em linha com o que o mercado esperava", cor: "#3f3f46" };

  return (
    <ChartCard
      title={`O que o mercado esperava e o que deu (${fmtMesCurto(focusMensal.mes_referencia)})`}
      subtitle={`Toda semana o Banco Central pergunta a cerca de 100 instituições financeiras quanto elas acham que o ${indicador} vai marcar. A comparação entre esse palpite e o número do IBGE é o que move juros e mercado no dia da divulgação.`}
      footer={
        <>
          <p className="mb-1.5">
            <strong>De onde vem o “esperado”.</strong> É a mediana das projeções do boletim Focus, do Banco Central, na
            última pesquisa publicada antes da divulgação do IBGE — a foto mais recente do consenso. Mediana, e não
            média, para que uma projeção muito fora da curva não puxe o número.
          </p>
          <p className="mb-1.5">
            <strong>Como ler a surpresa.</strong> Surpresa = {indicador} realizado − esperado, em pontos percentuais.
            Barra vermelha: veio acima do consenso (pressão inflacionária maior que a prevista, tende a endurecer a
            expectativa de juros). Barra azul: veio abaixo. Barra cinza: diferença de até{" "}
            {fmtNum(BANDA_EM_LINHA, 2)} p.p., que conta como “em linha”.
          </p>
          <p>
            <strong>Próximos meses.</strong> As linhas seguintes são o que o Focus projeta adiante. A coluna mín–máx e o
            desvio-padrão mostram o grau de discordância entre as instituições: quanto mais largo, menos consenso — e
            maior a chance de surpresa na próxima divulgação.
          </p>
        </>
      }
      stampGiro={geradoEm}
      stampDado={focusMensal.mes_referencia}
    >
      {/* Manchete: esperado × realizado × surpresa */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-100 bg-[#f8fafc] px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">O mercado esperava</p>
          <p className="mt-0.5 text-xl font-bold tabular-nums text-zinc-700">{fmtSignedPct(esperado, 2)}</p>
          <p className="text-[10.5px] text-zinc-400">
            mediana do Focus{vespera?.data_pesquisa ? ` de ${fmtDataBR(vespera.data_pesquisa)}` : ""}
          </p>
        </div>
        <div className="rounded-lg border border-[#132960]/15 bg-white px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Deu</p>
          <p className="mt-0.5 text-xl font-bold tabular-nums text-[#132960]">{fmtSignedPct(realizadoMes, 2)}</p>
          <p className="text-[10.5px] text-zinc-400">{indicador} de {fmtMesLongo(focusMensal.mes_referencia)} · IBGE</p>
        </div>
        <div className="rounded-lg border border-zinc-100 bg-[#f8fafc] px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Surpresa</p>
          <p className="mt-0.5 text-xl font-bold tabular-nums" style={{ color: veredito?.cor }}>
            {surpresa != null ? `${fmtSignedNum(surpresa, 2)} p.p.` : "—"}
          </p>
          <p className="text-[10.5px] text-zinc-400">{veredito?.texto ?? "sem projeção da véspera"}</p>
        </div>
      </div>

      {/* Histórico: acertou ou errou, mês a mês */}
      {rows.length > 0 ? (
        <>
          <p className="mb-1 mt-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Histórico da surpresa — quanto o consenso errou, mês a mês
          </p>
          <div className="h-[220px] w-full">
            <ResponsiveContainer>
              <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid {...azGridProps()} />
                <XAxis {...azXAxisProps()} dataKey="mes" interval={2} />
                <YAxis
                  {...azYAxisProps()}
                  domain={dominio}
                  tickFormatter={(v: number) => fmtSignedNum(v, 2)}
                  width={50}
                />
                <Tooltip
                  content={
                    <AzTooltip
                      valueFmt={(v, name) => (name === "Surpresa" ? `${fmtSignedNum(v, 2)} p.p.` : `${fmtNum(v, 2)}%`)}
                    />
                  }
                  cursor={azTooltipProps().cursor}
                />
                <ReferenceLine y={0} stroke={AZ_BRAND.navy} strokeOpacity={0.55} strokeWidth={1} />
                <Bar dataKey="surpresa" name="Surpresa" radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false}>
                  {rows.map((r) => (
                    <Cell
                      key={r.mes}
                      fill={
                        r.surpresa > BANDA_EM_LINHA
                          ? AZ_CHART.neg
                          : r.surpresa < -BANDA_EM_LINHA
                            ? AZ_CHART.neutral
                            : "#94A3B8"
                      }
                    />
                  ))}
                </Bar>
                {/* Linhas transparentes: realizado × esperado no tooltip sem roubar largura das barras */}
                <Line dataKey="realizado" name="Realizado" stroke="transparent" dot={false} activeDot={false} legendType="none" />
                <Line dataKey="esperado" name="Esperado (véspera)" stroke="transparent" dot={false} activeDot={false} legendType="none" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : null}

      {/* O que o mercado espera adiante */}
      {focusMensal.proximos.length > 0 ? (
        <>
          <p className="mb-1 mt-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            O que o mercado espera dos próximos meses
          </p>
          <div className="overflow-x-auto rounded-lg border border-zinc-100">
            <table className="min-w-full text-xs">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-zinc-700">Mês</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-zinc-700">Mediana (%)</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-zinc-700">Média (%)</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-zinc-700">
                    Mín–Máx (%)
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-zinc-700">
                    Discordância (dp)
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-zinc-700">Pesquisa</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {focusMensal.proximos.map((p) => (
                  <tr key={p.mes_ref} className="border-t border-zinc-50 hover:bg-zinc-50/60">
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-800">{fmtMesCurto(p.mes_ref)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-[#132960]">
                      {p.mediana != null ? fmtNum(p.mediana, 2) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-700">
                      {p.media != null ? fmtNum(p.media, 2) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-700">
                      {p.min != null && p.max != null ? `${fmtNum(p.min, 2)} a ${fmtNum(p.max, 2)}` : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-700">
                      {p.dp != null ? fmtNum(p.dp, 2) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-500">
                      {p.data_pesquisa ? fmtDataBR(p.data_pesquisa) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </ChartCard>
  );
}
