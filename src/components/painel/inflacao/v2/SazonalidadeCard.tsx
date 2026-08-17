"use client";

import { useMemo } from "react";
import type { ReactElement } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  ErrorBar,
  LabelList,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { IpcaData } from "@/lib/painel-ipca";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtSignedNum, fmtSignedPct } from "@/lib/format-br";
import { leituraSazonal, num } from "./shared";

/**
 * Bloco 04 — "0,67% no mês é muito?" — depende do PADRÃO do mês civil
 * (jan/fev altos por reajustes e educação; meio do ano baixo).
 *
 * Gramática do card: barra = MEDIANA histórica do mês civil (robusta aos
 * outliers de 2020-22, sem exclusão editorial de anos) + haste mín–máx +
 * pontos = últimos 12 meses realizados, com o mês de referência em destaque.
 *
 * Revisão ago/2026 (relatório do editor): o gráfico não se explicava sozinho.
 * Agora traz a leitura em prosa acima do gráfico, marca visualmente ONDE está
 * o mês de referência (linha vertical + rótulo do valor) e usa rótulos de
 * legenda em português direto. A altura acompanha o card p/ não sobrar vazio.
 */

const MESES_LABEL = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_NOME = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export function SazonalidadeCard({ data }: { data: IpcaData }) {
  const saz = data.sazonalidade;
  const mesRef = data.mes_recente; // "2026-04"
  const mmRef = mesRef.slice(5, 7);
  const idxRef = Number(mmRef) - 1;
  const labelRef = MESES_LABEL[idxRef] ?? "";
  const nomeMesRef = MESES_NOME[idxRef] ?? "";

  // Últimos 12 meses realizados do IPCA cheio, indexados pelo mês civil.
  const realizados = useMemo(() => {
    const out = new Map<string, { mes: string; valor: number }>();
    const serie = data.ipca_cheio.serie;
    for (const row of serie.slice(-12)) {
      const v = num(row, "IPCA cheio");
      if (v != null) out.set(row.mes.slice(5, 7), { mes: row.mes, valor: v });
    }
    return out;
  }, [data.ipca_cheio.serie]);

  const rows = useMemo(() => {
    if (!saz) return [];
    return MESES_LABEL.map((label, i) => {
      const mm = String(i + 1).padStart(2, "0");
      const s = saz.por_mes[mm];
      const mediana = s?.mediana ?? null;
      const minV = s?.min ?? null;
      const maxV = s?.max ?? null;
      const real = realizados.get(mm);
      return {
        label,
        mediana,
        // ErrorBar do Recharts: offsets [abaixo, acima] relativos à barra.
        amplitude:
          mediana != null && minV != null && maxV != null
            ? ([mediana - minV, maxV - mediana] as [number, number])
            : undefined,
        realizado: real?.valor ?? null,
        mesRealizado: real?.mes ?? null,
        atual: mm === mmRef,
      };
    });
  }, [saz, realizados, mmRef]);

  // Leitura em prosa: o número do mês contra o padrão daquele mês civil.
  const leitura = useMemo(() => {
    const linha = rows.find((r) => r.atual);
    if (!linha || linha.realizado == null || linha.mediana == null) return null;
    const dif = linha.realizado - linha.mediana;
    const posicao = leituraSazonal(linha.realizado, linha.mediana);
    return { realizado: linha.realizado, mediana: linha.mediana, dif, posicao };
  }, [rows]);

  /** Rótulo do valor só no mês de referência — o resto polui. */
  const renderRotuloRef = (props: unknown): ReactElement => {
    const { x, y, index } = props as { x?: number; y?: number; index?: number };
    if (index == null || rows[index]?.atual !== true) return <g />;
    const v = rows[index]?.realizado;
    if (v == null || !Number.isFinite(Number(x)) || !Number.isFinite(Number(y))) return <g />;
    return (
      <text
        x={Number(x)}
        y={Number(y) - 12}
        textAnchor="middle"
        style={{ fontSize: 11, fontWeight: 700, fill: AZ_BRAND.rust, fontVariantNumeric: "tabular-nums" }}
      >
        {fmtSignedPct(v, 2)}
      </text>
    );
  };

  if (!saz) {
    return (
      <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
        Bloco de sazonalidade ainda não disponível neste JSON.
      </p>
    );
  }

  return (
    <ChartCard
      title={`IPCA de ${fmtMesCurto(mesRef)} contra o padrão de ${nomeMesRef}`}
      subtitle={`Um número do mês só é alto ou baixo em relação ao próprio mês: ${nomeMesRef} tem o comportamento típico dele. A barra cinza mostra quanto o IPCA costuma variar em cada mês; o ponto, quanto variou de verdade.`}
      footer={
        <>
          <p className="mb-1.5">
            <strong>Como ler.</strong> A barra cinza é a <em>mediana</em> daquele mês civil na janela {saz.janela} — o
            valor típico, escolhido no lugar da média porque não se deixa distorcer pelos meses excepcionais de
            2020-2022. A haste vertical vai do menor ao maior IPCA já registrado naquele mês no período. Os pontos são
            os 12 meses mais recentes, cada um no seu mês civil; o ponto laranja e a linha tracejada marcam o mês de
            referência.
          </p>
          <p>
            <strong>Por que importa.</strong> Comparar o IPCA de um mês com o do mês anterior engana: janeiro e
            fevereiro concentram reajustes (escolas, transporte, saúde) e o meio do ano costuma ser fraco. A pergunta
            certa é se o mês veio acima ou abaixo do <em>próprio</em> padrão. Diferença de até 0,05 p.p. conta como “em
            linha”.
          </p>
        </>
      }
      stampGiro={data.gerado_em}
      stampDado={mesRef}
    >
      {leitura ? (
        <p className="mb-3 rounded-lg border border-zinc-100 bg-[#f8fafc] px-3 py-2 text-xs leading-relaxed text-zinc-700">
          Em {nomeMesRef}, o IPCA costuma variar{" "}
          <strong className="tabular-nums">{fmtSignedPct(leitura.mediana, 2)}</strong>. Neste ano veio{" "}
          <strong className="tabular-nums" style={{ color: AZ_BRAND.rust }}>
            {fmtSignedPct(leitura.realizado, 2)}
          </strong>{" "}
          —{" "}
          {leitura.posicao === "em linha" ? (
            <strong>em linha com o padrão do mês</strong>
          ) : (
            <>
              <strong className="tabular-nums">{fmtNum(Math.abs(leitura.dif), 2)} p.p.</strong>{" "}
              <strong style={{ color: leitura.posicao === "acima" ? AZ_CHART.negText : AZ_CHART.neutral }}>
                {leitura.posicao === "acima" ? "acima" : "abaixo"} do padrão
              </strong>
            </>
          )}
          .
        </p>
      ) : null}

      <div className="h-full min-h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 20, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid {...azGridProps()} />
            <XAxis {...azXAxisProps()} dataKey="label" interval={0} />
            <YAxis {...azYAxisProps()} width={44} tickFormatter={(v: number) => `${fmtNum(v, 1)}%`} />
            <ReferenceLine y={0} stroke={AZ_CHART.zero} strokeOpacity={AZ_CHART.zeroOpacity} strokeWidth={1.5} />
            {labelRef ? (
              <ReferenceLine
                x={labelRef}
                stroke={AZ_BRAND.rust}
                strokeDasharray="3 3"
                strokeWidth={1.2}
                label={{
                  value: fmtMesCurto(mesRef),
                  position: "top",
                  fontSize: 10,
                  fontWeight: 700,
                  fill: AZ_BRAND.rust,
                }}
              />
            ) : null}

            <Tooltip
              content={
                <AzTooltip
                  valueFmt={(v) => fmtSignedPct(v, 2)}
                  labelFmt={(l) => `Mês de ${String(l)} — padrão ${saz.janela}`}
                />
              }
              cursor={AZ_TOOLTIP_PROPS.cursor}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />

            <Bar
              dataKey="mediana"
              name={`Quanto costuma variar (mediana ${saz.janela})`}
              fill={AZ_CHART.ticks}
              fillOpacity={0.45}
              maxBarSize={22}
              isAnimationActive={false}
            >
              <ErrorBar dataKey="amplitude" width={5} strokeWidth={1} stroke={AZ_CHART.labels} direction="y" />
            </Bar>
            <Scatter dataKey="realizado" name="Quanto variou de fato (últimos 12 meses)" isAnimationActive={false}>
              {rows.map((r) => (
                <Cell
                  key={r.label}
                  fill={r.atual ? AZ_BRAND.rust : AZ_BRAND.azure}
                  stroke="#fff"
                  strokeWidth={r.atual ? 1.5 : 1}
                />
              ))}
              <LabelList dataKey="realizado" content={renderRotuloRef} />
            </Scatter>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[10.5px] leading-relaxed text-zinc-400">
        A haste de cada barra vai do menor ao maior IPCA registrado naquele mês entre {saz.janela.replace("-", " e ")}.
        Diferença de até {fmtSignedNum(0.05, 2)} p.p. em relação à mediana conta como “em linha com o padrão”.
      </p>
    </ChartCard>
  );
}
