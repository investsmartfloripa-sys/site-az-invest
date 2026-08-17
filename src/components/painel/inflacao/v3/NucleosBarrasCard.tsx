"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReactElement } from "react";

import type { TabelaSinteseBlock } from "@/lib/painel-ipca";
import { AzSegmented, AzTooltip, ChartCard, azGridProps, azXAxisProps } from "@/components/painel/core";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtPct, fmtSignedPct } from "@/lib/format-br";
import { META, META_TETO, NUCLEO_INFO, NUCLEOS_5, chaveNucleo } from "../v2/shared";

/**
 * Substitui a antiga "Núcleos e categorias por transformação" (tabela de SAAR
 * 3m/6m dessazonalizado), apontada pelo editor como ilegível — e cujo conteúdo
 * era justamente o momentum que saiu do painel na mesma revisão (ago/2026).
 *
 * No lugar: uma barra por núcleo contra a meta, com o IPCA cheio como régua e
 * um glossário VISÍVEL embaixo (não escondido no "?"), porque a dúvida do
 * leitor não é o número — é o que cada sigla significa.
 *
 * Todo valor vem pré-computado do builder (bloco `tabela_sintese`).
 */

type Horizonte = "mes" | "acum_12m";

const HORIZONTES = [
  { id: "acum_12m", label: "Em 12 meses" },
  { id: "mes", label: "No mês" },
];

type Linha = {
  id: string;
  /** Rótulo curto no eixo ("Núcleo EX0"). */
  rotulo: string;
  valor: number;
  /** Régua (IPCA cheio) e média ganham destaque próprio. */
  papel: "regua" | "media" | "nucleo";
};

export function NucleosBarrasCard({
  sintese,
  geradoEm,
}: {
  sintese: TabelaSinteseBlock;
  geradoEm: string;
}) {
  const [horizonte, setHorizonte] = useState<Horizonte>("acum_12m");
  const m0 = sintese.mes_recente;

  const linhas = useMemo<Linha[]>(() => {
    const secao = (id: string) => sintese.secoes.find((s) => s.id === id)?.linhas ?? [];
    const campo = (l: { m0: number | null; acum_12m: number | null }) =>
      horizonte === "mes" ? l.m0 : l.acum_12m;

    const out: Linha[] = [];
    const ipca = secao("indice").find((l) => l.id === "ipca");
    if (ipca && campo(ipca) != null) {
      out.push({ id: "ipca", rotulo: "IPCA cheio", valor: campo(ipca) as number, papel: "regua" });
    }
    const nucleos = secao("nucleos");
    const media = nucleos.find((l) => l.id === "nucleos_media");
    if (media && campo(media) != null) {
      out.push({ id: "media", rotulo: "Média dos 5", valor: campo(media) as number, papel: "media" });
    }
    // Só os CINCO do conjunto vigente — o MA saiu em 2020 e confundiria a leitura.
    for (const k of NUCLEOS_5) {
      const linha = nucleos.find((l) => chaveNucleo(l.id) === k);
      const v = linha ? campo(linha) : null;
      if (linha && v != null) {
        out.push({ id: linha.id, rotulo: `Núcleo ${NUCLEO_INFO[k].sigla}`, valor: v, papel: "nucleo" });
      }
    }
    return out;
  }, [sintese, horizonte]);

  if (linhas.length === 0) return null;

  const cor = (l: Linha) => {
    if (l.papel === "regua") return "#94A3B8";
    if (l.papel === "media") return AZ_BRAND.navy;
    // Em 12 meses a pergunta é "cabe na meta?"; no mês, é só a direção.
    if (horizonte === "acum_12m") return l.valor > META_TETO ? AZ_CHART.neg : AZ_BRAND.azure;
    return l.valor > 0 ? AZ_CHART.neg : AZ_CHART.neutral;
  };

  const fmtValor = (v: number) => (horizonte === "mes" ? fmtSignedPct(v, 2) : fmtPct(v, 2));

  const renderRotulo = (props: unknown): ReactElement => {
    const { x, y, width, height, value } = props as {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      value?: number;
    };
    const xx = Number(x);
    const yy = Number(y);
    const w = Number(width);
    const h = Number(height);
    const v = Number(value);
    if (!Number.isFinite(xx) || !Number.isFinite(yy) || !Number.isFinite(v)) return <g />;
    return (
      <text
        x={Math.max(xx, xx + (Number.isFinite(w) ? w : 0)) + 6}
        y={yy + (Number.isFinite(h) ? h : 0) / 2}
        textAnchor="start"
        dominantBaseline="central"
        style={{ fontSize: 10.5, fill: "#475569", fontVariantNumeric: "tabular-nums" }}
      >
        {fmtValor(v)}
      </text>
    );
  };

  const altura = 30 * linhas.length + 48;

  return (
    <ChartCard
      title={`Os cinco núcleos, um a um (${horizonte === "mes" ? fmtMesCurto(m0) : "12 meses"})`}
      subtitle="Cada núcleo tira da conta os preços que sobem e descem por motivo passageiro — mas cada um tira de um jeito. Quando as cinco medidas apontam para o mesmo lado, o sinal é confiável."
      toolbar={
        <AzSegmented
          ariaLabel="Horizonte dos núcleos"
          options={HORIZONTES}
          value={horizonte}
          onChange={(id) => setHorizonte(id as Horizonte)}
        />
      }
      footer={
        <p>
          Conjunto vigente desde o Estudo Especial 102/2020 do Banco Central, que reduziu de sete para cinco as medidas
          acompanhadas: saíram o Ex-1, o Ex-2 e o MA (médias aparadas sem suavização, redundante com o MS) e entrou o
          P55. Acumulado de 12 meses composto, calculado no pipeline. A meta contínua é de {fmtPct(META, 1)}, com teto
          de {fmtPct(META_TETO, 1)}.
        </p>
      }
      stampGiro={geradoEm}
      stampDado={m0}
    >
      <div className="w-full" style={{ height: altura }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={linhas}
            layout="vertical"
            barCategoryGap="30%"
            margin={{ left: 4, right: 52, top: 14, bottom: 4 }}
          >
            <CartesianGrid {...azGridProps("vertical-only")} />
            <XAxis
              {...azXAxisProps()}
              type="number"
              tickFormatter={(v) => fmtNum(Number(v), horizonte === "mes" ? 2 : 1)}
              tickCount={5}
            />
            <YAxis
              type="category"
              dataKey="rotulo"
              width={126}
              interval={0}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: AZ_CHART.labels }}
            />
            <ReferenceLine x={0} stroke={AZ_CHART.zero} strokeOpacity={AZ_CHART.zeroOpacity} strokeWidth={1.5} />
            {horizonte === "acum_12m" ? (
              <>
                <ReferenceLine
                  x={META}
                  stroke={AZ_BRAND.navy}
                  strokeDasharray="4 4"
                  strokeWidth={1.2}
                  label={{ value: `meta ${fmtPct(META, 1)}`, position: "top", fontSize: 9, fill: AZ_BRAND.navy }}
                />
                <ReferenceLine
                  x={META_TETO}
                  stroke={AZ_CHART.neg}
                  strokeDasharray="2 3"
                  strokeWidth={1}
                  label={{ value: `teto ${fmtPct(META_TETO, 1)}`, position: "top", fontSize: 9, fill: AZ_CHART.neg }}
                />
              </>
            ) : null}
            <Tooltip
              content={<AzTooltip hideDot valueFmt={(v) => fmtValor(v)} />}
              cursor={AZ_TOOLTIP_PROPS.cursor}
            />
            <Bar dataKey="valor" name="Variação" radius={[0, 3, 3, 0]} maxBarSize={18} isAnimationActive={false}>
              {linhas.map((l) => (
                <Cell key={l.id} fill={cor(l)} />
              ))}
              <LabelList dataKey="valor" content={renderRotulo} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Glossário VISÍVEL — é o que faltava para o gráfico se explicar sozinho. */}
      <dl className="mt-4 space-y-2 rounded-lg border border-zinc-100 bg-[#f8fafc] p-3 text-[11px] leading-relaxed">
        <p className="font-semibold text-[#132960]">O que cada núcleo tira da conta</p>
        {NUCLEOS_5.map((k) => (
          <div key={k} className="flex gap-2">
            <dt className="w-16 shrink-0 font-semibold text-zinc-700">{NUCLEO_INFO[k].sigla}</dt>
            <dd className="text-zinc-600">
              <span className="text-zinc-400">{NUCLEO_INFO[k].familia}</span> · {NUCLEO_INFO[k].curta}.
            </dd>
          </div>
        ))}
        <p className="pt-1 text-zinc-500">
          A barra cinza (IPCA cheio) é a régua: quando os núcleos rodam abaixo dela, a alta do índice está vindo de
          itens voláteis; quando rodam acima, a pressão é de fundo.{" "}
          {horizonte === "mes" ? "Valores do mês, sem acumular." : `Acumulado de 12 meses até ${fmtMesCurto(m0)}.`}
        </p>
      </dl>
    </ChartCard>
  );
}
