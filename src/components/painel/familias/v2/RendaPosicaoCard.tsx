"use client";

import { useMemo, useState } from "react";

import type { FamiliasRendaData } from "@/lib/painel-familias";
import type { CodaceFaixaAtividade } from "@/lib/painel-atividade";
import { AzSegmented, ChartCard } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart, type AzSeriesPoint, type AzXRefArea } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND, AZ_SERIES } from "@/lib/az-chart-theme";
import { fmtNum } from "@/lib/format-br";
import { codaceAreas, delta12m, mesIso, num } from "./shared";

/**
 * "Renda: quem ganha a corrida?" — em vez de 4 linhas de nível disputando o
 * mesmo eixo, a âncora é a RAZÃO formal ÷ informal (a métrica que responde a
 * pergunta "o prêmio da carteira assinada está abrindo ou fechando?").
 * O toggle "Base 100" mostra a TRAJETÓRIA das 4 categorias rebasadas no
 * início da janela — comparação honesta de ritmo, não de nível.
 */

type Modo = "razao" | "base100";

/** Reforma trabalhista (Lei 13.467, vigente nov/2017) — marco editorial fino. */
const REFORMA_TRABALHISTA: AzXRefArea = {
  x1: "2017-11-01",
  x2: "2018-01-01",
  label: "reforma trabalhista",
  color: "#FF5713",
  opacity: 0.14,
};

const CATEGORIAS = [
  { key: "empregado_privado_com_carteira", label: "Privado c/ carteira", color: AZ_BRAND.azure },
  { key: "empregado_privado_sem_carteira", label: "Privado s/ carteira", color: AZ_SERIES[2] },
  { key: "empregado_publico", label: "Setor público", color: AZ_BRAND.navy },
  { key: "conta_propria", label: "Conta-própria", color: AZ_SERIES[3] },
] as const;

export function RendaPosicaoCard({
  renda,
  codaceMensal,
  geradoEm,
}: {
  renda: FamiliasRendaData;
  codaceMensal?: CodaceFaixaAtividade[];
  geradoEm: string;
}) {
  const [modo, setModo] = useState<Modo>("razao");
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });

  const serie = renda.bloco_renda_posicao.serie ?? [];

  const razaoPts = useMemo<AzSeriesPoint[]>(() => {
    const out: AzSeriesPoint[] = [];
    for (const p of serie) {
      const f = num(p, "empregado_privado_com_carteira");
      const i = num(p, "empregado_privado_sem_carteira");
      if (f != null && i != null && i > 0) out.push([mesIso(p.trim), +(f / i).toFixed(3)]);
    }
    return out;
  }, [serie]);

  const categoriaPts = useMemo(() => {
    return CATEGORIAS.map((c) => {
      const data: AzSeriesPoint[] = [];
      for (const p of serie) {
        const v = num(p, c.key);
        if (v != null) data.push([mesIso(p.trim), v]);
      }
      return { id: c.key, label: c.label, color: c.color, data };
    });
  }, [serie]);

  const faixas = useMemo(() => [...codaceAreas(codaceMensal), REFORMA_TRABALHISTA], [codaceMensal]);

  const minIso = razaoPts.length > 0 ? razaoPts[0][0] : "";
  const maxIso = razaoPts.length > 0 ? razaoPts[razaoPts.length - 1][0] : "";

  const ultRazao = razaoPts.length > 0 ? razaoPts[razaoPts.length - 1][1] : null;
  const dRazao = useMemo(() => delta12m(razaoPts), [razaoPts]);

  const titulo =
    ultRazao != null
      ? `Quem tem carteira assinada ganha ${fmtNum(ultRazao, 2)}× o informal — diferença ${
          dRazao == null ? "no trimestre móvel mais recente" : dRazao > 0.02 ? "abrindo no último ano" : dRazao < -0.02 ? "fechando no último ano" : "estável no último ano"
        }`
      : "Renda por posição na ocupação";

  return (
    <ChartCard
      title={titulo}
      subtitle={
        modo === "razao"
          ? "Razão entre o rendimento real médio do empregado privado COM carteira e SEM carteira. Acima de 1, o formal ganha mais; a inclinação diz se o prêmio da formalidade abre ou fecha."
          : "Rendimento real das 4 posições, rebasado para 100 no início da janela selecionada — compara TRAJETÓRIAS, não níveis."
      }
      toolbar={
        <>
          <AzSegmented
            ariaLabel="Modo de leitura"
            options={[
              { id: "razao", label: "Razão formal÷informal" },
              { id: "base100", label: "Base 100" },
            ]}
            value={modo}
            onChange={(id) => setModo(id as Modo)}
          />
          <AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />
        </>
      }
      footer="IBGE/SIDRA 6389 — rendimento médio real habitual por posição na ocupação (trimestre móvel, deflacionado pelo próprio IBGE). A faixa laranja fina marca a reforma trabalhista (Lei 13.467, vigente desde nov/2017) — marco editorial p/ contexto, não implica causalidade. Faixas cinzas: recessões CODACE/FGV."
      stampGiro={geradoEm}
      stampDado={maxIso || null}
    >
      {modo === "razao" ? (
        <AzTimeSeriesChart
          series={[{ id: "razao", label: "Formal ÷ informal", color: AZ_BRAND.azure, data: razaoPts }]}
          unit="none"
          period={period}
          height={300}
          xRefAreas={faixas}
          showLegend={false}
          yAxisLabel="× (com ÷ sem carteira)"
        />
      ) : (
        <AzTimeSeriesChart
          series={categoriaPts}
          mode="rebase100"
          period={period}
          height={300}
          xRefAreas={faixas}
        />
      )}
    </ChartCard>
  );
}
