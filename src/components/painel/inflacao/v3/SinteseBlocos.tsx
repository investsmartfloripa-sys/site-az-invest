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
import { AzSegmented, AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtPct, fmtSignedPct } from "@/lib/format-br";
import { META } from "../v2/shared";

/**
 * Categorias econômicas — o corte da mesma cesta pelo MOTIVO que faz o preço
 * mudar, que é como o Copom lê a inflação.
 *
 * Histórico deste arquivo (revisões do editor): em ago/2026 ele nasceu com os
 * quatro blocos da tabela-síntese como gráficos separados; na revisão seguinte
 * três deles saíram — "índice cheio" e "difusão" foram removidos e "grupos"
 * foi absorvido pelo card único dos 9 grupos (GruposMesCard). Sobrou este, e
 * na horizontal→vertical pedida no mesmo relatório.
 */

type Horizonte = "mes" | "acum_12m";

const HORIZONTES = [
  { id: "mes", label: "No mês" },
  { id: "acum_12m", label: "Em 12 meses" },
];

const CATEGORIA_GLOSSA: Record<string, string> = {
  cat_livres: "preços definidos pelo mercado — a maior parte da cesta",
  cat_monitorados: "preços fixados ou autorizados por contrato/governo (energia, combustível, ônibus, plano de saúde)",
  cat_servicos: "mão de obra e serviços (aluguel, escola, salão, restaurante) — o que o Banco Central olha de perto",
  cat_comercializaveis: "bens que podem ser importados ou exportados — sensíveis ao câmbio",
};

export function SinteseCategoriasCard({ sintese, geradoEm }: { sintese: TabelaSinteseBlock; geradoEm: string }) {
  const [horizonte, setHorizonte] = useState<Horizonte>("acum_12m");
  const linhas = sintese.secoes.find((s) => s.id === "categorias")?.linhas ?? [];
  const m0 = sintese.mes_recente;

  const rows = useMemo(
    () =>
      linhas
        .map((l) => ({ nome: l.nome, valor: (horizonte === "mes" ? l.m0 : l.acum_12m) ?? null }))
        .filter((r): r is { nome: string; valor: number } => r.valor != null)
        .sort((a, b) => b.valor - a.valor),
    [linhas, horizonte],
  );

  if (rows.length === 0) return null;

  const fmtValor = (v: number) => fmtSignedPct(v, 2);

  /** Rótulo no topo da coluna (embaixo, quando negativa). */
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
    const negativo = v < 0;
    return (
      <text
        x={xx + (Number.isFinite(w) ? w : 0) / 2}
        y={negativo ? yy + (Number.isFinite(h) ? h : 0) + 13 : yy - 6}
        textAnchor="middle"
        style={{ fontSize: 11, fontWeight: 600, fill: "#475569", fontVariantNumeric: "tabular-nums" }}
      >
        {fmtValor(v)}
      </text>
    );
  };

  return (
    <ChartCard
      title={`Categorias econômicas (${horizonte === "mes" ? fmtMesCurto(m0) : "12 meses"})`}
      subtitle="Outro corte da mesma cesta: em vez de agrupar por tipo de produto, agrupa pelo motivo que faz o preço mudar."
      toolbar={
        <AzSegmented
          ariaLabel="Horizonte da variação por categoria"
          options={HORIZONTES}
          value={horizonte}
          onChange={(id) => setHorizonte(id as Horizonte)}
        />
      }
      footer={
        <>
          <ul className="mb-1.5 space-y-1">
            {linhas.map((l) => (
              <li key={l.id}>
                <strong>{l.nome}</strong> — {CATEGORIA_GLOSSA[l.id] ?? "recorte do IPCA por natureza do preço"}.
              </li>
            ))}
          </ul>
          <p>
            As categorias se sobrepõem (serviços e comercializáveis estão dentro dos preços livres) — não somam 100%,
            são leituras diferentes da mesma cesta. Em 12 meses, a linha tracejada marca a meta de {fmtPct(META, 1)}.
          </p>
        </>
      }
      stampGiro={geradoEm}
      stampDado={m0}
    >
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 22, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid {...azGridProps()} />
            <XAxis {...azXAxisProps()} dataKey="nome" interval={0} tick={{ fontSize: 11, fill: AZ_CHART.labels }} />
            <YAxis {...azYAxisProps()} width={46} tickFormatter={(v: number) => `${fmtNum(v, 1)}%`} />
            <ReferenceLine y={0} stroke={AZ_CHART.zero} strokeOpacity={AZ_CHART.zeroOpacity} strokeWidth={1.5} />
            {horizonte === "acum_12m" ? (
              <ReferenceLine
                y={META}
                stroke={AZ_BRAND.navy}
                strokeDasharray="4 4"
                strokeWidth={1.2}
                label={{ value: `meta ${fmtPct(META, 1)}`, position: "insideTopRight", fontSize: 9, fill: AZ_BRAND.navy }}
              />
            ) : null}
            <Tooltip content={<AzTooltip valueFmt={fmtValor} />} cursor={AZ_TOOLTIP_PROPS.cursor} />
            <Bar dataKey="valor" name="Variação" maxBarSize={64} radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {rows.map((r) => (
                <Cell key={r.nome} fill={r.valor > 0 ? AZ_CHART.neg : AZ_CHART.neutral} />
              ))}
              <LabelList dataKey="valor" content={renderRotulo} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
