"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type {
  DecomposicaoBlock,
  IgpmData,
  IgpmMomentumBlock,
  SubPainelComponente,
  TransformacaoIgpm,
} from "@/lib/painel-igpm";
import {
  AzSegmented,
  AzTooltip,
  ChartCard,
  Heatmap,
  azGridProps,
  azXAxisProps,
  azYAxisProps,
  steppedDivergingScale,
} from "@/components/painel/core";
import { AzTimeSeriesChart, type AzSeriesPoint } from "@/components/painel/charts/AzTimeSeriesChart";
import { AzPeriodSelector, resolvePeriodRange, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AZ_CHART, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
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
  const rot3 = dessaz ? "Ritmo 3m (dessaz, anual)" : "Ritmo 3m (anual)";
  const rot6 = dessaz ? "Ritmo 6m (dessaz, anual)" : "Ritmo 6m (anual)";

  const linhas: Array<{ t: TransformacaoIgpm; regua: boolean }> = [
    { t: linhaComp, regua: false },
    ...(linhaIgpm ? [{ t: linhaIgpm, regua: true }] : []),
  ];

  // Leitura pronta, gerada por regra (nunca ad-hoc): compara o ritmo recente
  // (6m anualizado) com o acumulado 12m para dizer se acelera ou desacelera.
  const leitura = useMemo(() => {
    const { nome, mes, saar_6m, acum_12m } = linhaComp;
    if (mes == null || saar_6m == null || acum_12m == null) return null;
    const diff = saar_6m - acum_12m;
    const tendencia =
      diff > 0.3
        ? "acima do acumulado de 12 meses — pressão em aceleração"
        : diff < -0.3
          ? "abaixo do acumulado de 12 meses — pressão em desaceleração"
          : "em linha com o acumulado de 12 meses — ritmo estável";
    return `O ${nome} variou ${fmtSignedPct(mes, 2)} no mês. Nos últimos 6 meses, roda a ${fmtSignedPct(saar_6m, 2)} em ritmo anual${dessaz ? " (já descontada a sazonalidade)" : ""}, ${tendencia} (${fmtSignedPct(acum_12m, 2)}).`;
  }, [linhaComp, dessaz]);

  return (
    <ChartCard
      title="Tabela de transformações"
      footer={`Mês = variação % no mês de referência; ${rot3}/${rot6} = "se o ritmo dos últimos 3/6 meses durasse um ano inteiro" (janela anualizada geometricamente no pipeline${dessaz ? ", sobre a série dessazonalizada — STL sobre o log do índice encadeado, período 12, robusta" : "; SEM ajuste sazonal — o IPA não tem padrão sazonal estável, honestidade metodológica"}); acumulados no ano e em 12m COMPOSTOS (nunca soma aritmética). IGP-M na linha cinza como régua${linhaIgpm && linhaIgpm.dessaz !== dessaz ? " (ritmo do IGP-M é dessazonalizado)" : ""}.`}
      stampGiro={geradoEm}
      stampDado={mesRef}
    >
      {leitura ? (
        <p className="mb-3 text-xs leading-relaxed text-zinc-600">
          <strong className="font-semibold text-[#132960]">Leitura:</strong> {leitura}
        </p>
      ) : null}
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
  const [janela, setJanela] = useState<AzPeriodValue>({ id: "5y" });
  const [ritmo, setRitmo] = useState<"6m" | "3m">("6m");

  const minIso = serie.length > 0 ? mesIso(serie[0].mes) : "";
  const maxIso = serie.length > 0 ? mesIso(serie[serie.length - 1].mes) : "";

  const { rows, dessaz } = useMemo(() => {
    const { from, to } = resolvePeriodRange(janela, minIso, maxIso);
    const out = serie
      .filter((p) => {
        const iso = mesIso(p.mes);
        return iso >= from && iso <= to;
      })
      .map((p) => ({
        mes: p.mes,
        mensal: p.var_base,
        ritmo: ritmo === "6m" ? p.saar_6m : p.saar_3m,
      }));
    return { rows: out, dessaz: serie.at(-1)?.dessaz ?? false };
  }, [serie, janela, ritmo, minIso, maxIso]);

  if (serie.length === 0) return null;

  const rotuloMensal = dessaz ? "Mensal (dessaz)" : "Mensal";
  const rotuloRitmo = `Ritmo ${ritmo} (anualizado)`;

  return (
    <ChartCard
      title={`Momentum do ${comp}`}
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <AzSegmented
            ariaLabel="Janela do ritmo anualizado"
            options={[
              { id: "6m", label: "Ritmo 6m" },
              { id: "3m", label: "Ritmo 3m" },
            ]}
            value={ritmo}
            onChange={(id) => setRitmo(id as "6m" | "3m")}
          />
          <AzPeriodSelector value={janela} onChange={setJanela} min={minIso} max={maxIso} periods={["5y", "max"]} />
        </div>
      }
      footer={`Para onde o índice está indo AGORA, sem o retrovisor dos 12 meses: barras = variação mensal${dessaz ? " dessazonalizada (STL própria — não o X-13)" : " SEM dessazonalização — o IPA não tem padrão sazonal estável"} (alta = vermelho, queda = azul); linha = ritmo dos últimos ${ritmo === "6m" ? "6" : "3"} meses anualizado geometricamente no pipeline ("se esse ritmo durasse um ano"). Janela padrão de 5 anos — o histórico completo está no botão Máx. Ajuste desde ${momentum.ajuste_desde}; publicação desde ${momentum.publica_desde}.`}
      stampGiro={geradoEm}
      stampDado={serie.at(-1)?.mes ?? null}
    >
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid {...azGridProps()} />
            <XAxis {...azXAxisProps()} dataKey="mes" tickFormatter={fmtMesCurto} minTickGap={28} />
            <YAxis {...azYAxisProps()} width={48} tickFormatter={(v: number) => `${fmtNum(v, 0)}%`} />
            <ReferenceLine y={0} stroke={AZ_CHART.zero} strokeOpacity={AZ_CHART.zeroOpacity} strokeWidth={1.5} />
            <Tooltip
              content={
                <AzTooltip
                  labelFmt={(l) => fmtMesCurto(String(l))}
                  valueFmt={(v) => fmtSignedPct(v, 2)}
                />
              }
              cursor={AZ_TOOLTIP_PROPS.cursor}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="mensal" name={rotuloMensal} maxBarSize={10} isAnimationActive={false}>
              {rows.map((r) => (
                <Cell
                  key={r.mes}
                  fill={r.mensal > 0 ? AZ_CHART.neg : r.mensal < 0 ? AZ_CHART.neutral : AZ_CHART.ticks}
                  fillOpacity={0.55}
                />
              ))}
            </Bar>
            <Line
              type="monotone"
              dataKey="ritmo"
              name={rotuloRitmo}
              stroke={CORES_COMPONENTE[comp] ?? AZ_CHART.ticks}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
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
// 4a. Distribuição pós-Real — faixa visual: "o valor de hoje é normal ou
// extremo?" respondido em um olhar, no lugar da antiga tabela de estatísticas
// (relatório ago/2026: "essa tabela está ruim").
// ---------------------------------------------------------------------------

function pctPos(v: number, min: number, max: number): number {
  if (max <= min) return 50;
  return Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));
}

/** Faixa horizontal com banda, tique da mediana e ponto do valor atual. */
function FaixaDistribuicao({
  min,
  max,
  bandLo,
  bandHi,
  mediana,
  atual,
  atualLabel,
  minLabel,
  maxLabel,
  corAtual: corAtualProp,
}: {
  min: number;
  max: number;
  bandLo: number | null;
  bandHi: number | null;
  mediana: number | null;
  atual: number | null;
  atualLabel: string | null;
  minLabel: string;
  maxLabel: string;
  /** Cor do ponto atual — default: semântica de inflação pelo sinal de `atual`. */
  corAtual?: string;
}) {
  const corAtual =
    corAtualProp ??
    (atual == null ? AZ_CHART.ticks : atual > 0 ? AZ_CHART.neg : atual < 0 ? AZ_CHART.neutral : AZ_CHART.ticks);
  const pAtual = atual != null ? pctPos(atual, min, max) : null;
  const pBandLo = bandLo != null ? pctPos(bandLo, min, max) : null;
  const pBandHi = bandHi != null ? pctPos(bandHi, min, max) : null;
  const pMediana = mediana != null ? pctPos(mediana, min, max) : null;

  return (
    <div className="relative h-16">
      {/* rótulo do valor atual, ancorado no ponto (clamp p/ não cortar) */}
      {pAtual != null && atualLabel ? (
        <span
          className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold tabular-nums"
          style={{ left: `${Math.min(90, Math.max(10, pAtual))}%`, color: corAtual }}
        >
          {atualLabel}
        </span>
      ) : null}

      {/* trilho */}
      <div className="absolute left-0 right-0 top-[34px] h-[3px] rounded-full bg-zinc-200" />
      {/* banda média ± 2 DP */}
      {pBandLo != null && pBandHi != null ? (
        <div
          className="absolute top-[29px] h-[13px] rounded-full bg-slate-400/25"
          style={{ left: `${pBandLo}%`, width: `${Math.max(pBandHi - pBandLo, 0)}%` }}
        />
      ) : null}
      {/* tique da mediana */}
      {pMediana != null ? (
        <div
          className="absolute top-[25px] h-[21px] w-[2px] -translate-x-1/2 rounded bg-zinc-500"
          style={{ left: `${pMediana}%` }}
        />
      ) : null}
      {/* ponto do valor atual */}
      {pAtual != null ? (
        <div
          className="absolute top-[35.5px] h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${pAtual}%`, background: corAtual }}
        />
      ) : null}

      {/* extremos */}
      <span className="absolute bottom-0 left-0 text-[10px] tabular-nums text-zinc-400">{minLabel}</span>
      <span className="absolute bottom-0 right-0 text-[10px] tabular-nums text-zinc-400">{maxLabel}</span>
    </div>
  );
}

function DistribuicaoCard({
  sub,
  geradoEm,
}: {
  sub: SubPainelComponente;
  geradoEm: string;
}) {
  const est = sub.estatisticas;
  const e12 = sub.estatisticas_12m;
  const atualMensal = sub.ultimo_mensal;
  const atual12m = sub.ultimo_12m;
  const percentil = e12?.percentil_atual ?? null;

  if (est.min == null || est.max == null) return null;

  const bandLo = est.media != null && est.std != null ? est.media - 2 * est.std : null;
  const bandHi = est.media != null && est.std != null ? est.media + 2 * est.std : null;

  return (
    <ChartCard
      title="Distribuição pós-Real"
      footer={`Onde o valor de hoje cai na história desde ${e12?.desde ?? "jan/1996"} (pós-Real estabilizado; estatísticas do pipeline). Faixa de cima: variação mensal entre o mínimo e o máximo históricos — banda cinza = média ± 2 desvios-padrão, tique = mediana, ponto = mês atual (alta = vermelho, queda = azul). Faixa de baixo: percentil do acumulado 12m na distribuição histórica (0 = mínimo, 100 = máximo; tique = mediana no percentil 50).`}
      stampGiro={geradoEm}
      stampDado={sub.ultimo_mes}
    >
      <div className="space-y-4">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Variação mensal — mês atual na história
          </p>
          <FaixaDistribuicao
            min={est.min}
            max={est.max}
            bandLo={bandLo}
            bandHi={bandHi}
            mediana={est.mediana ?? null}
            atual={atualMensal}
            atualLabel={atualMensal != null ? `mês atual ${fmtSignedPct(atualMensal, 2)}` : null}
            minLabel={`mín ${fmtSignedNum(est.min, 2)}`}
            maxLabel={`máx ${fmtSignedNum(est.max, 2)}`}
          />
          <p className="text-[11px] text-zinc-500">
            média {est.media != null ? fmtSignedNum(est.media, 2) : "—"} · mediana{" "}
            {est.mediana != null ? fmtSignedNum(est.mediana, 2) : "—"} · desvio-padrão{" "}
            {est.std != null ? fmtNum(est.std, 2) : "—"}
            {est.negativos_pct != null ? ` · ${fmtNum(est.negativos_pct, 1)}% dos meses negativos` : ""}
          </p>
        </div>

        {percentil != null ? (
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Acumulado 12m — percentil na história
            </p>
            <FaixaDistribuicao
              min={0}
              max={100}
              bandLo={null}
              bandHi={null}
              mediana={50}
              atual={percentil}
              corAtual={
                atual12m == null
                  ? AZ_CHART.ticks
                  : atual12m > 0
                    ? AZ_CHART.neg
                    : atual12m < 0
                      ? AZ_CHART.neutral
                      : AZ_CHART.ticks
              }
              atualLabel={
                atual12m != null
                  ? `percentil ${fmtNum(percentil, 0)} (12m: ${fmtSignedPct(atual12m, 2)})`
                  : `percentil ${fmtNum(percentil, 0)}`
              }
              minLabel="0 = mínimo pós-96"
              maxLabel="100 = máximo"
            />
            <p className="text-[11px] text-zinc-500">
              12m histórico: média {e12?.media != null ? fmtSignedNum(e12.media, 2) : "—"} · mediana{" "}
              {e12?.mediana != null ? fmtSignedNum(e12.mediana, 2) : "—"}
              {e12?.negativos_pct != null ? ` · ${fmtNum(e12.negativos_pct, 1)}% dos períodos negativos` : ""}
            </p>
          </div>
        ) : null}
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

/**
 * Recolhido num <details> no FIM da tab (relatório ago/2026: "legal, mas
 * deveria ficar em seção mais escondida") — curiosidade histórica, não
 * leitura do mês.
 */
function RankingsDetails({ sub, comp }: { sub: SubPainelComponente; comp: ComponenteIgpm }) {
  const altas = sub.maiores_altas.slice(0, 10);
  const quedas = sub.maiores_quedas.slice(0, 10);
  if (altas.length === 0 && quedas.length === 0) return null;

  return (
    <details className="group rounded-2xl border border-[#132960]/10 bg-white p-4 shadow-sm">
      <summary className="cursor-pointer select-none text-sm font-semibold text-[#132960] marker:text-[#027DFC]">
        Recordes históricos do {comp} — maiores altas e quedas mensais
      </summary>
      <div className="mt-3 space-y-2">
        <div className="grid gap-4 sm:grid-cols-2">
          {altas.length > 0 ? <MiniRanking rotulo="10 maiores altas" rows={altas} cor={AZ_CHART.negText} /> : null}
          {quedas.length > 0 ? <MiniRanking rotulo="10 maiores quedas" rows={quedas} cor={AZ_CHART.neutral} /> : null}
        </div>
        <p className="text-[11px] text-zinc-500">
          Maiores variações MENSAIS do componente na janela pós-Real do builder. Alta em vermelho (pressão), queda
          em azul — semântica de inflação.
        </p>
      </div>
    </details>
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

      {sub ? <DistribuicaoCard sub={sub} geradoEm={geradoEm} /> : null}

      {data.decomposicao ? <ContribuicaoCard decomposicao={data.decomposicao} comp={comp} geradoEm={geradoEm} /> : null}

      {sub ? <RankingsDetails sub={sub} comp={comp} /> : null}
    </div>
  );
}
