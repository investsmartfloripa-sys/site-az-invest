"use client";

import { useMemo, useState } from "react";

import type { AtividadeCodaceData, AtividadePibData } from "@/lib/painel-atividade";
import { ChartCard, AzSegmented, RankingTable, type RankingTableRow } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart, type AzSeriesPoint, type AzTimeSeries } from "@/components/painel/charts/AzTimeSeriesChart";
import { fmtPct } from "@/lib/format-br";
import { codaceAreas, fmtTrimCurto, num, trimIsoCentral } from "../shared";

/**
 * Composição do valor adicionado — de QUE é feita a economia brasileira. Dois
 * toggles ("abas") que respondem perguntas distintas com convenções distintas:
 *   (A) Participação %  → o PESO de cada setor no PIB nominal (SIDRA 1846, % do
 *       PIB) no último trimestre, em barras ordenadas — uma foto da estrutura.
 *   (B) Evolução R$ real → o TAMANHO de cada grande setor ao longo do tempo, em
 *       R$ reais a preços de 1995 com ajuste sazonal (SIDRA 6613) — quem cresceu.
 *
 * Estrutura nominal (peso) e valores reais (tamanho) NUNCA no mesmo eixo:
 * pergunta de composição (corte transversal) ≠ pergunta de trajetória (série).
 * Faixas cinzas = recessões CODACE só no gráfico de NÍVEL (R$ real).
 */

// Grandes blocos da oferta — peso % (todos com chave `{key}_pct_pib` em 1846).
// Ordem afirmativa: do maior agregado (VA) aos setores e impostos.
const BLOCOS_PESO: { key: string; label: string }[] = [
  { key: "servicos", label: "Serviços" },
  { key: "industria", label: "Indústria" },
  { key: "agro", label: "Agropecuária" },
  { key: "impostos", label: "Impostos s/ produtos" },
];

// Subsetores de serviços — peso % (detalham o bloco dominante sem poluir).
const SUBSERVICOS_PESO: { key: string; label: string }[] = [
  { key: "comercio", label: "Comércio" },
  { key: "transporte", label: "Transporte" },
  { key: "informacao", label: "Informação e comunic." },
  { key: "financeiras", label: "Atividades financeiras" },
  { key: "imobiliarias", label: "Atividades imobiliárias" },
  { key: "admin_publica", label: "Adm., saúde, educ. púb." },
  { key: "outros_servicos", label: "Outros serviços" },
];

// Grandes setores p/ a evolução em R$ real (chave direta `{key}` em 6613).
const SETORES_REAL: { key: string; label: string }[] = [
  { key: "valor_adicionado", label: "Valor adicionado" },
  { key: "servicos", label: "Serviços" },
  { key: "industria", label: "Indústria" },
  { key: "agro", label: "Agropecuária" },
  { key: "impostos", label: "Impostos s/ produtos" },
];

export function ComposicaoVaPib({
  pib,
  codace,
  geradoEm,
}: {
  pib: AtividadePibData;
  codace?: AtividadeCodaceData | null;
  geradoEm: string;
}) {
  const [aba, setAba] = useState<"peso" | "real">("peso");
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });

  // (A) Participação % do PIB nominal no último trimestre com dados (1846).
  const { rowsBloco, rowsSub, trimPeso, maxPeso } = useMemo(() => {
    const serie = pib.estrutura_nominal?.serie ?? [];
    // Última observação com algum peso preenchido (busca de trás p/ frente).
    let ultimo: (typeof serie)[number] | null = null;
    for (let i = serie.length - 1; i >= 0; i--) {
      const r = serie[i];
      if (BLOCOS_PESO.some((b) => num(r, `${b.key}_pct_pib`) != null)) {
        ultimo = r;
        break;
      }
    }
    if (!ultimo) {
      return { rowsBloco: [] as RankingTableRow[], rowsSub: [] as RankingTableRow[], trimPeso: null as string | null, maxPeso: 0 };
    }
    const toRows = (defs: { key: string; label: string }[]): RankingTableRow[] =>
      defs
        .map((d) => ({ label: d.label, value: num(ultimo, `${d.key}_pct_pib`) }))
        .filter((r): r is RankingTableRow => r.value != null)
        .sort((a, b) => b.value - a.value);
    const rowsBloco = toRows(BLOCOS_PESO);
    const rowsSub = toRows(SUBSERVICOS_PESO);
    // Escala comum às duas tabelas p/ barras comparáveis entre elas.
    const maxPeso = Math.max(0, ...rowsBloco.map((r) => r.value), ...rowsSub.map((r) => r.value));
    return { rowsBloco, rowsSub, trimPeso: String(ultimo.trim ?? pib.trim_recente), maxPeso };
  }, [pib.estrutura_nominal, pib.trim_recente]);

  // (B) Evolução em R$ real (preços de 1995, SA) dos grandes setores (6613).
  const seriesReal = useMemo<AzTimeSeries[]>(() => {
    const serie = pib.valores_reais_sa?.serie ?? [];
    return SETORES_REAL.map((s) => {
      const data: AzSeriesPoint[] = [];
      for (const r of serie) {
        const v = num(r, s.key);
        if (v != null) data.push([trimIsoCentral(String(r.trim)), v]);
      }
      return { id: s.key, label: s.label, data };
    }).filter((s) => s.data.length > 0);
  }, [pib.valores_reais_sa]);

  const faixas = useMemo(() => codaceAreas(codace?.trimestral), [codace]);

  const { minIso, maxIso } = useMemo(() => {
    let lo = "";
    let hi = "";
    for (const s of seriesReal) {
      for (const [d] of s.data) {
        if (!lo || d < lo) lo = d;
        if (!hi || d > hi) hi = d;
      }
    }
    return { minIso: lo, maxIso: hi };
  }, [seriesReal]);

  const semReal = seriesReal.length === 0;

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <AzSegmented
        ariaLabel="Visão"
        options={[
          { id: "peso", label: "Participação %" },
          { id: "real", label: "Evolução R$ real" },
        ]}
        value={aba}
        onChange={(id) => setAba(id === "real" ? "real" : "peso")}
      />
      {aba === "real" && !semReal ? (
        <AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />
      ) : null}
    </div>
  );

  return (
    <ChartCard
      title={
        aba === "peso"
          ? "Serviços dominam a estrutura da economia"
          : "Os serviços puxaram o crescimento real do PIB"
      }
      subtitle={
        aba === "peso"
          ? `Peso de cada setor no PIB nominal${trimPeso ? ` (${fmtTrimCurto(trimPeso)})` : ""}: serviços × indústria × agro × impostos, e o detalhe dentro de serviços.`
          : "Tamanho de cada grande setor ao longo do tempo, em R$ reais (preços de 1995, com ajuste sazonal). Faixas cinzas = recessões CODACE."
      }
      toolbar={toolbar}
      footer="Fonte: IBGE/SIDRA — Contas Nacionais Trimestrais. Participação %: tabela 1846 (valores a preços correntes, % do PIB nominal). Evolução R$ real: tabela 6613 (valores encadeados a preços de 1995, R$ reais com ajuste sazonal). Recessões: cronologia CODACE/FGV-IBRE."
      stampGiro={geradoEm}
      stampDado={aba === "peso" ? (trimPeso ? fmtTrimCurto(trimPeso) : pib.trim_recente) : maxIso || pib.trim_recente}
    >
      {aba === "peso" ? (
        rowsBloco.length === 0 && rowsSub.length === 0 ? (
          <p className="py-12 text-center text-sm text-zinc-400">
            Participação % do PIB nominal indisponível nesta atualização.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <RankingTable
              title="Grandes setores (% do PIB)"
              dotColor="#132960"
              rows={rowsBloco}
              valueFmt={(v) => fmtPct(v, 1)}
              maxAbs={maxPeso}
            />
            <RankingTable
              title="Dentro de serviços (% do PIB)"
              dotColor="#027DFC"
              rows={rowsSub}
              valueFmt={(v) => fmtPct(v, 1)}
              maxAbs={maxPeso}
            />
          </div>
        )
      ) : semReal ? (
        <p className="py-12 text-center text-sm text-zinc-400">
          Série de valores reais (R$ de 1995) indisponível nesta atualização.
        </p>
      ) : (
        <AzTimeSeriesChart
          series={seriesReal}
          unit="R$"
          period={period}
          height={340}
          xRefAreas={faixas}
        />
      )}
    </ChartCard>
  );
}
