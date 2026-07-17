"use client";

import { useMemo, useState, type ReactNode } from "react";

import type {
  DecomposicaoBlock,
  IgpmData,
  IgpmMomentumBlock,
  SubPainelComponente,
  TransformacaoIgpm,
} from "@/lib/painel-igpm";
import { AzSegmented, ChartCard, Heatmap, steppedDivergingScale } from "@/components/painel/core";
import { AzTimeSeriesChart, type AzSeriesPoint, type AzTimeSeries } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_CHART } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtSignedNum, fmtSignedPct } from "@/lib/format-br";
import { mesIso, num } from "../v2/shared";
import { CORES_COMPONENTE } from "../v2igpm/shared";

/**
 * O TEMPLATE de escrutínio por componente do IGP-M (tabs 2/3/4): tabela de
 * transformações (com o IGP-M como régua cinza), série âncora + momentum lado
 * a lado, heatmap de sazonalidade anos × meses, distribuição pós-Real +
 * rankings e a contribuição do componente ao IGP-M cheio.
 *
 * Regras herdadas (inegociáveis): todo acumulado/dessaz/SAAR nasce no builder;
 * semântica de inflação (alta = vermelho, queda = azul); títulos neutros.
 */

export type ComponenteIgpm = "IPA-M" | "IPC-M" | "INCC-M";

const MESES_LABEL = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Thresholds do heatmap por componente (IPA é ~2× mais volátil que IPC/INCC). */
const THRESHOLDS_HEATMAP: Record<ComponenteIgpm, number[]> = {
  "IPA-M": [0.5, 1.5, 3],
  "IPC-M": [0.25, 0.75, 1.5],
  "INCC-M": [0.25, 0.75, 1.5],
};

/** Valor com sinal e cor de inflação (alta = vermelho, queda = azul). */
function celula(v: number | null | undefined, opts?: { destaque?: boolean; mudo?: boolean }): ReactNode {
  if (v == null) return <span className="text-zinc-300">—</span>;
  const cor = opts?.mudo ? undefined : v > 0 ? AZ_CHART.negText : v < 0 ? AZ_CHART.neutral : undefined;
  return (
    <span className={opts?.destaque ? "font-bold" : undefined} style={{ color: cor }}>
      {fmtSignedNum(v, 2)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// 1. Tabela de transformações (componente + IGP-M como régua)
// ---------------------------------------------------------------------------
function TabelaTransformacoes({
  transformacoes,
  comp,
  mesRef,
  geradoEm,
}: {
  transformacoes: TransformacaoIgpm[];
  comp: ComponenteIgpm;
  mesRef: string;
  geradoEm: string;
}) {
  const linhaComp = transformacoes.find((t) => t.id === comp);
  const linhaIgpm = transformacoes.find((t) => t.id === "IGP-M");
  if (!linhaComp) return null;

  const dessaz = linhaComp.dessaz;
  const rot3 = dessaz ? "3m SAAR dessaz" : "3m anualizado";
  const rot6 = dessaz ? "6m SAAR dessaz" : "6m anualizado";

  const linhas: Array<{ t: TransformacaoIgpm; regua: boolean }> = [
    { t: linhaComp, regua: false },
    ...(linhaIgpm ? [{ t: linhaIgpm, regua: true }] : []),
  ];

  return (
    <ChartCard
      title="Tabela de transformações"
      footer={`Mês = variação % no mês de referência; ${rot3}/${rot6} = janela de 3/6 meses anualizada geometricamente no pipeline${dessaz ? " sobre a série dessazonalizada (STL sobre o log do índice encadeado, período 12, robusta)" : " SEM ajuste sazonal — o IPA não tem padrão sazonal estável (honestidade metodológica)"}; acumulados no ano e em 12m COMPOSTOS (nunca soma aritmética). IGP-M na linha cinza como régua${linhaIgpm && linhaIgpm.dessaz !== dessaz ? " (SAAR do IGP-M é dessazonalizado)" : ""}.`}
      stampGiro={geradoEm}
      stampDado={mesRef}
    >
      <div className="overflow-x-auto rounded-lg border border-zinc-100">
        <table className="min-w-full text-xs">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-zinc-700">Índice</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-[#132960]">Mês</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-zinc-700">{rot3}</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-zinc-700">{rot6}</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-zinc-700">No ano</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-zinc-700">12 meses</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {linhas.map(({ t, regua }) => (
              <tr key={t.id} className={`border-t border-zinc-50 ${regua ? "text-zinc-400" : ""}`}>
                <td className={`whitespace-nowrap px-3 py-1.5 font-medium ${regua ? "text-zinc-400" : "text-zinc-800"}`}>
                  {t.nome}
                  {regua ? <span className="ml-1 text-[10px] font-normal">(régua)</span> : null}
                </td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
                  {celula(t.mes, { destaque: !regua, mudo: regua })}
                </td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
                  {celula(t.saar_3m, { mudo: regua })}
                </td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
                  {celula(t.saar_6m, { mudo: regua })}
                </td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
                  {celula(t.acum_ano, { mudo: regua })}
                </td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
                  {celula(t.acum_12m, { mudo: regua })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// 2a. Série âncora do componente (toggle mensal × 12m)
// ---------------------------------------------------------------------------
function SerieComponenteCard({
  sub,
  comp,
  geradoEm,
}: {
  sub: SubPainelComponente;
  comp: ComponenteIgpm;
  geradoEm: string;
}) {
  const [modo, setModo] = useState<"mensal" | "12m">("12m");

  const { mensal, acum12m } = useMemo(() => {
    const m: AzSeriesPoint[] = [];
    const a: AzSeriesPoint[] = [];
    for (const r of sub.serie_longa) {
      const iso = mesIso(r.mes);
      if (r.mensal != null) m.push([iso, r.mensal]);
      if (r.acum_12m != null) a.push([iso, r.acum_12m]);
    }
    return { mensal: m, acum12m: a };
  }, [sub.serie_longa]);

  const data = modo === "12m" ? acum12m : mensal;
  if (mensal.length === 0 && acum12m.length === 0) return null;

  return (
    <ChartCard
      title={`Série do ${comp}`}
      toolbar={
        <AzSegmented
          ariaLabel="Transformação da série do componente"
          options={[
            { id: "mensal", label: "Mensal" },
            { id: "12m", label: "Acum. 12m" },
          ]}
          value={modo}
          onChange={(id) => setModo(id as "mensal" | "12m")}
        />
      }
      footer="Janela de 10 anos (120 meses) do builder; acumulado 12m COMPOSTO no pipeline, validado contra os oficiais FGV — nunca soma de variações."
      stampGiro={geradoEm}
      stampDado={sub.ultimo_mes}
    >
      <AzTimeSeriesChart
        series={[
          {
            id: "comp",
            label: modo === "12m" ? `${comp} 12m` : `${comp} mensal`,
            color: CORES_COMPONENTE[comp] ?? AZ_CHART.ticks,
            data,
          },
        ]}
        unit="%"
        height={300}
      />
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// 2b. Momentum do componente (SAAR 3m × 6m)
// ---------------------------------------------------------------------------
function MomentumComponenteCard({
  momentum,
  comp,
  geradoEm,
}: {
  momentum: IgpmMomentumBlock;
  comp: ComponenteIgpm;
  geradoEm: string;
}) {
  const serie = momentum.series[comp] ?? [];

  const { s3, s6, dessaz } = useMemo(() => {
    const p3: AzSeriesPoint[] = [];
    const p6: AzSeriesPoint[] = [];
    for (const p of serie) {
      const iso = mesIso(p.mes);
      if (p.saar_3m != null) p3.push([iso, p.saar_3m]);
      if (p.saar_6m != null) p6.push([iso, p.saar_6m]);
    }
    return { s3: p3, s6: p6, dessaz: serie.at(-1)?.dessaz ?? false };
  }, [serie]);

  if (s3.length === 0 && s6.length === 0) return null;

  const sufixo = dessaz ? "SAAR dessaz" : "anualizado";
  const series: AzTimeSeries[] = [
    { id: "saar3", label: `3m ${sufixo}`, color: CORES_COMPONENTE[comp] ?? AZ_CHART.ticks, data: s3 },
    { id: "saar6", label: `6m ${sufixo}`, color: "#94A3B8", data: s6 },
  ].filter((s) => s.data.length > 0);

  return (
    <ChartCard
      title={`Momentum do ${comp}`}
      footer={`Para onde o índice está indo AGORA, sem o retrovisor dos 12 meses: janelas de 3 e 6 meses anualizadas geometricamente no pipeline${dessaz ? ", sobre a série dessazonalizada (STL própria — não o X-13)" : " SEM dessazonalização — o IPA não tem padrão sazonal estável"}. Ajuste desde ${momentum.ajuste_desde}; publicação desde ${momentum.publica_desde}.`}
      stampGiro={geradoEm}
      stampDado={serie.at(-1)?.mes ?? null}
    >
      <AzTimeSeriesChart series={series} unit="%" height={300} showLegend />
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// 3. Heatmap de sazonalidade (anos × meses civis, mediana como 1ª linha)
// ---------------------------------------------------------------------------
function HeatmapSazonalidadeCard({
  sub,
  comp,
  geradoEm,
}: {
  sub: SubPainelComponente;
  comp: ComponenteIgpm;
  geradoEm: string;
}) {
  const { rows, cols, data } = useMemo(() => {
    const valores: Record<string, Record<string, number | null>> = {};
    valores["Mediana"] = {};
    MESES_LABEL.forEach((label, i) => {
      const mm = String(i + 1).padStart(2, "0");
      valores["Mediana"][label] = sub.sazonalidade[mm]?.mediana ?? null;
    });
    const anos = [...new Set(sub.serie_longa.map((r) => r.mes.slice(0, 4)))].sort().reverse();
    for (const ano of anos) valores[ano] = {};
    for (const r of sub.serie_longa) {
      const ano = r.mes.slice(0, 4);
      const idx = Number(r.mes.slice(5, 7)) - 1;
      if (idx >= 0 && idx < 12) valores[ano][MESES_LABEL[idx]] = r.mensal;
    }
    return { rows: ["Mediana", ...anos], cols: MESES_LABEL, data: valores };
  }, [sub.serie_longa, sub.sazonalidade]);

  const escala = useMemo(
    () => steppedDivergingScale(THRESHOLDS_HEATMAP[comp], { posColor: AZ_CHART.neg, negColor: AZ_CHART.neutral }),
    [comp],
  );

  if (rows.length <= 1) return null;

  return (
    <ChartCard
      title="Sazonalidade — anos × meses"
      footer={`Variação mensal do ${comp} por ano × mês civil (janela de 10 anos do builder); 1ª linha = mediana histórica do mês civil, calculada no pipeline. Escala em degraus com semântica de inflação (alta = vermelho, queda = azul); degraus de ±${THRESHOLDS_HEATMAP[comp].map((t) => fmtNum(t, 2)).join(" / ±")} p.p.`}
      stampGiro={geradoEm}
      stampDado={sub.ultimo_mes}
    >
      <Heatmap
        rows={rows}
        cols={cols}
        data={data}
        colorScale={escala}
        valueFmt={(v) => fmtSignedNum(v, 2)}
        stretch
        caption="Células cinzas = sem observação. Passe o mouse para ver ano × mês."
      />
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// 4a. Distribuição pós-Real (mensal × 12m)
// ---------------------------------------------------------------------------
function DistribuicaoCard({
  sub,
  geradoEm,
}: {
  sub: SubPainelComponente;
  geradoEm: string;
}) {
  const est = sub.estatisticas;
  const e12 = sub.estatisticas_12m;
  if (est.media == null && e12 == null) return null;

  const linhas: Array<{ rotulo: string; mensal: ReactNode; acum: ReactNode }> = [
    { rotulo: "Média", mensal: celula(est.media), acum: celula(e12?.media) },
    { rotulo: "Mediana", mensal: celula(est.mediana), acum: celula(e12?.mediana) },
    {
      rotulo: "Desvio-padrão",
      mensal: est.std != null ? fmtNum(est.std, 2) : <span className="text-zinc-300">—</span>,
      acum: <span className="text-zinc-300">—</span>,
    },
    { rotulo: "Mínimo", mensal: celula(est.min), acum: <span className="text-zinc-300">—</span> },
    { rotulo: "Máximo", mensal: celula(est.max), acum: <span className="text-zinc-300">—</span> },
    {
      rotulo: "% meses negativos",
      mensal: est.negativos_pct != null ? `${fmtNum(est.negativos_pct, 1)}%` : <span className="text-zinc-300">—</span>,
      acum: e12?.negativos_pct != null ? `${fmtNum(e12.negativos_pct, 1)}%` : <span className="text-zinc-300">—</span>,
    },
    {
      rotulo: "Percentil do 12m atual",
      mensal: <span className="text-zinc-300">—</span>,
      acum:
        e12?.percentil_atual != null ? (
          <span className="font-bold text-[#132960]">{fmtNum(e12.percentil_atual, 0)}</span>
        ) : (
          <span className="text-zinc-300">—</span>
        ),
    },
  ];

  return (
    <ChartCard
      title="Distribuição pós-Real"
      footer={`Estatísticas da variação mensal e do acumulado 12m composto desde ${e12?.desde ?? "jan/1996"} (pós-Real estabilizado), calculadas no pipeline. Percentil = posição do 12m atual na distribuição histórica (0 = mínimo, 100 = máximo).`}
      stampGiro={geradoEm}
      stampDado={sub.ultimo_mes}
    >
      <div className="overflow-x-auto rounded-lg border border-zinc-100">
        <table className="min-w-full text-xs">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-zinc-700">Estatística</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-zinc-700">Var. mensal (%)</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-zinc-700">Acum. 12m (%)</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {linhas.map((l) => (
              <tr key={l.rotulo} className="border-t border-zinc-50 hover:bg-zinc-50/60">
                <td className="whitespace-nowrap px-3 py-1.5 font-medium text-zinc-800">{l.rotulo}</td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{l.mensal}</td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{l.acum}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// 4b. Rankings (10 maiores altas × 10 maiores quedas)
// ---------------------------------------------------------------------------
function MiniRanking({
  rotulo,
  rows,
  cor,
}: {
  rotulo: string;
  rows: Array<{ mes: string; valor: number }>;
  cor: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-100">
      <div className="bg-[#f8fafc] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {rotulo}
      </div>
      <table className="min-w-full text-xs">
        <tbody className="bg-white">
          {rows.map((r, i) => (
            <tr key={r.mes} className="border-t border-zinc-50 hover:bg-zinc-50/60">
              <td className="w-8 px-3 py-1.5 text-zinc-400 tabular-nums">{i + 1}.</td>
              <td className="whitespace-nowrap px-3 py-1.5 font-medium text-zinc-800">{fmtMesCurto(r.mes)}</td>
              <td className="whitespace-nowrap px-3 py-1.5 text-right font-semibold tabular-nums" style={{ color: cor }}>
                {fmtSignedPct(r.valor, 2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RankingsCard({
  sub,
  geradoEm,
}: {
  sub: SubPainelComponente;
  geradoEm: string;
}) {
  const altas = sub.maiores_altas.slice(0, 10);
  const quedas = sub.maiores_quedas.slice(0, 10);
  if (altas.length === 0 && quedas.length === 0) return null;

  return (
    <ChartCard
      title="Maiores altas e quedas"
      footer="Maiores variações MENSAIS do componente na janela pós-Real do builder. Alta em vermelho (pressão), queda em azul — semântica de inflação."
      stampGiro={geradoEm}
      stampDado={sub.ultimo_mes}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {altas.length > 0 ? <MiniRanking rotulo="10 maiores altas" rows={altas} cor={AZ_CHART.negText} /> : null}
        {quedas.length > 0 ? <MiniRanking rotulo="10 maiores quedas" rows={quedas} cor={AZ_CHART.neutral} /> : null}
      </div>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// 5. Contribuição do componente ao IGP-M (p.p., pesos efetivos)
// ---------------------------------------------------------------------------
function ContribuicaoCard({
  decomposicao,
  comp,
  geradoEm,
}: {
  decomposicao: DecomposicaoBlock;
  comp: ComponenteIgpm;
  geradoEm: string;
}) {
  const pontos = useMemo<AzSeriesPoint[]>(() => {
    const out: AzSeriesPoint[] = [];
    for (const r of decomposicao.serie) {
      const v = num(r, `${comp} (contrib)`);
      if (v != null) out.push([mesIso(r.mes), v]);
    }
    return out;
  }, [decomposicao.serie, comp]);

  if (pontos.length === 0) return null;

  return (
    <ChartCard
      title="Contribuição ao IGP-M"
      footer="Contribuição mensal do componente ao IGP-M cheio, em p.p., com pesos EFETIVOS encadeados calculados no pipeline (w = peso de origem × número-índice encadeado, renormalizado mês a mês); o resíduo estrutural da aproximação fica explícito na decomposição da aba Leitura do mês."
      stampGiro={geradoEm}
      stampDado={decomposicao.serie.at(-1)?.mes ?? null}
    >
      <AzTimeSeriesChart
        series={[
          {
            id: "contrib",
            label: `${comp} — contribuição (p.p.)`,
            color: CORES_COMPONENTE[comp] ?? AZ_CHART.ticks,
            data: pontos,
          },
        ]}
        unit="none"
        yAxisLabel="p.p."
        height={280}
      />
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// Pane
// ---------------------------------------------------------------------------
export function ComponentePane({
  data,
  comp,
  geradoEm,
}: {
  data: IgpmData;
  comp: ComponenteIgpm;
  geradoEm: string;
}) {
  const sub = data.componentes[comp];
  if (!sub && !data.transformacoes) return null;

  return (
    <div className="space-y-6">
      {data.transformacoes ? (
        <TabelaTransformacoes transformacoes={data.transformacoes} comp={comp} mesRef={data.mes_recente} geradoEm={geradoEm} />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        {sub ? <SerieComponenteCard sub={sub} comp={comp} geradoEm={geradoEm} /> : null}
        {data.momentum ? <MomentumComponenteCard momentum={data.momentum} comp={comp} geradoEm={geradoEm} /> : null}
      </div>

      {sub ? <HeatmapSazonalidadeCard sub={sub} comp={comp} geradoEm={geradoEm} /> : null}

      <div className="grid gap-6 xl:grid-cols-2">
        {sub ? <DistribuicaoCard sub={sub} geradoEm={geradoEm} /> : null}
        {sub ? <RankingsCard sub={sub} geradoEm={geradoEm} /> : null}
      </div>

      {data.decomposicao ? <ContribuicaoCard decomposicao={data.decomposicao} comp={comp} geradoEm={geradoEm} /> : null}
    </div>
  );
}
