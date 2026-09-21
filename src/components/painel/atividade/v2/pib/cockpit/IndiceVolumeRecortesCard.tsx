"use client";

import { useMemo, useState } from "react";

import type { AtividadeCodaceData, AtividadePibData } from "@/lib/painel-atividade";
import { AzSegmented, ChartCard, CockpitChip } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart, type AzRefLine, type AzSeriesPoint, type AzTimeSeries } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND, AZ_CHART, seriesColor } from "@/lib/az-chart-theme";
import { fmtNum } from "@/lib/format-br";
import { codaceAreas, fmtTrimCurto } from "../../shared";
import {
  RECORTES_DEMANDA,
  RECORTES_OFERTA,
  ROTULO_CURTO,
  lentePib,
  rebaseMedia,
  rotuloRecorte,
  seriePib,
  ultimoPib,
} from "../cockpit-shared";

/**
 * COCKPIT do PIB — índice de volume com ajuste sazonal (SIDRA 1621) por
 * recorte, rebasado para MÉDIA DE 2019 = 100. Toggle Oferta (agro · indústria ·
 * serviços) | Demanda (famílias · governo · FBCF · exportações · importações),
 * PIB tracejado como régua e recessões CODACE ao fundo. Adapta o modo "nível"
 * do antigo DecomposicaoPib; o modo "momentum" (YoY recalculado no cliente)
 * foi abandonado porque divergia do YoY oficial da 5932.
 */

type Otica = "oferta" | "demanda";

/** Recortes plotados por ótica (chaves da 1621 `sa_<r>`). Estoques e impostos não têm índice SA. */
const RECORTES_POR_OTICA: Record<Otica, readonly string[]> = {
  oferta: RECORTES_OFERTA.filter((r) => r.key === "agro" || r.key === "industria" || r.key === "servicos").map(
    (r) => r.key,
  ),
  demanda: RECORTES_DEMANDA.filter((r) => r.folha).map((r) => r.key),
};

/** Paleta das séries: pula o navy (índice 1 da AZ_SERIES), reservado à régua do PIB. */
const PALETA_SERIES = [seriesColor(0), seriesColor(2), seriesColor(3), seriesColor(4), seriesColor(5)];
const COR_PIB = AZ_BRAND.navy;

const LENTE = lentePib("idx_sa");

const REF_LINES: AzRefLine[] = [{ y: 100, label: "média 2019", color: AZ_CHART.ticks }];

/** Último ponto de uma série rebasada (valor na escala 2019 = 100) ou null. */
function ultimoValor(data: ReadonlyArray<AzSeriesPoint>): number | null {
  return data.length > 0 ? data[data.length - 1][1] : null;
}

export function IndiceVolumeRecortesCard({
  pib,
  codace,
  geradoEm,
}: {
  pib: AtividadePibData;
  codace?: AtividadeCodaceData | null;
  geradoEm: string;
}) {
  const [otica, setOtica] = useState<Otica>("oferta");
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "10y" });

  // Séries da ótica ativa: índice SA → rebase média 2019 = 100 (cálculo leve no cliente).
  const series = useMemo<AzTimeSeries[]>(
    () =>
      RECORTES_POR_OTICA[otica].map((key, i) => ({
        id: key,
        label: ROTULO_CURTO[key] ?? rotuloRecorte(pib, key),
        color: PALETA_SERIES[i % PALETA_SERIES.length],
        data: rebaseMedia(seriePib(pib, LENTE, key)),
      })),
    [otica, pib],
  );

  // PIB como régua tracejada (benchmark) — mesma base.
  const benchmarks = useMemo<AzTimeSeries[]>(
    () => [{ id: "pib", label: "PIB", color: COR_PIB, data: rebaseMedia(seriePib(pib, LENTE, "pib")) }],
    [pib],
  );

  const faixas = useMemo(() => codaceAreas(codace?.trimestral), [codace]);

  const { minIso, maxIso } = useMemo(() => {
    let lo = "";
    let hi = "";
    for (const s of [...series, ...benchmarks]) {
      for (const [d] of s.data) {
        if (!lo || d < lo) lo = d;
        if (!hi || d > hi) hi = d;
      }
    }
    return { minIso: lo, maxIso: hi };
  }, [series, benchmarks]);

  // Trimestre CRU do último ponto do PIB (o DataStamp imprime "2T26").
  const ultPib = useMemo(() => ultimoPib(pib, LENTE, "pib"), [pib]);
  const trimPib = ultPib?.trim ?? pib.trim_recente;

  // Chips: último valor de cada série (ponto na cor da série); o trimestre só
  // é repetido quando difere do trimestre do PIB.
  const chips = useMemo(
    () =>
      series.map((s) => {
        const ult = ultimoPib(pib, LENTE, s.id);
        const trimDiferente = ult && ult.trim !== trimPib ? ` · ${fmtTrimCurto(ult.trim)}` : "";
        return {
          id: s.id,
          cor: s.color ?? AZ_BRAND.azure,
          texto: `${s.label} ${fmtNum(ultimoValor(s.data), 1)}${trimDiferente}`,
        };
      }),
    [series, pib, trimPib],
  );
  const valorPib = ultimoValor(benchmarks[0].data);

  return (
    <ChartCard
      id="pib-indice-volume-recortes"
      title="Índice de volume SA por recorte (média 2019 = 100)"
      subtitle="SIDRA 1621 · oferta: agropecuária · indústria · serviços | Demanda: consumo das famílias · governo · FBCF · exportações · importações · PIB tracejado como régua · recessões CODACE"
      toolbar={
        <>
          <AzSegmented
            ariaLabel="Ótica do PIB"
            options={[
              { id: "oferta", label: "Oferta" },
              { id: "demanda", label: "Demanda" },
            ]}
            value={otica}
            onChange={(id) => setOtica(id === "demanda" ? "demanda" : "oferta")}
          />
          <AzPeriodSelector
            value={period}
            onChange={setPeriod}
            min={minIso || undefined}
            max={maxIso || undefined}
            periods={["5y", "10y", "max"]}
          />
        </>
      }
      footer={
        <div className="space-y-1.5">
          <p>
            <strong>O que é:</strong> índice de volume do PIB e de seus recortes com ajuste sazonal (SA = sem o
            efeito do calendário/estação), tabela 1621 do SIDRA (IBGE, média 1995 = 100), rebasado aqui para{" "}
            <strong>média do ano de 2019 = 100</strong> — o último ano cheio pré-pandemia. Valor acima de 100 =
            volume acima do nível médio de 2019. A linha tracejada &quot;média 2019&quot; só aparece quando 100 está
            dentro da faixa plotada na janela.
          </p>
          <p>
            <strong>Índices encadeados:</strong> a 1621 é um índice de volume encadeado (Laspeyres com pesos do ano
            anterior); o rebase é só uma mudança de escala e não altera nenhuma taxa de variação. Ajuste sazonal do
            próprio IBGE (X-13); agregados (indústria, serviços, PIB) são dessazonalizados separadamente e não fecham
            por soma dos componentes.
          </p>
          <p>
            <strong>Leitura:</strong> oferta = quem produz (setores de atividade); demanda = quem gasta (componentes
            da despesa). <strong>Importações entram como volume</strong> (alta = mais demanda por bens e serviços de
            fora), não com o sinal negativo da identidade do PIB. PIB a preços de mercado tracejado como régua comum
            às duas óticas. Faixas cinzas = recessões datadas pelo CODACE/FGV (cronologia com anos de defasagem — só
            contexto histórico).
          </p>
          <p>
            <strong>Fora do card:</strong> a 1621 não publica índice SA de impostos líquidos sobre produtos nem de
            variação de estoques (estoques só existem em % do PIB nominal, tabela 1846); os subsetores da indústria e
            dos serviços vivem no card de lupa setorial. Rebase calculado no cliente a partir da série oficial.
          </p>
        </div>
      }
      stampGiro={geradoEm}
      stampDado={trimPib}
    >
      <div className="mb-2 flex flex-wrap gap-1.5">
        {/* Período lidera a linha (§13): "2T26 · PIB 116,2"; os chips das séries
            (ponto na cor da linha) dobram como legenda quando a Legend está oculta. */}
        <CockpitChip tom="navy">
          {fmtTrimCurto(trimPib)} · PIB {fmtNum(valorPib, 1)}
        </CockpitChip>
        {chips.map((c) => (
          <CockpitChip key={c.id} cor={c.cor}>
            {c.texto}
          </CockpitChip>
        ))}
      </div>
      <AzTimeSeriesChart
        series={series}
        benchmarks={benchmarks}
        unit="index"
        period={period}
        height={260}
        xRefAreas={faixas}
        refLines={REF_LINES}
        variant="default"
        // §22: Legend só com ≤4 itens (Oferta = 3 + PIB). Em Demanda são 6 → chips como legenda.
        showLegend={series.length + benchmarks.length <= 4}
        seriesEndLabels
        dots={false}
      />
    </ChartCard>
  );
}
