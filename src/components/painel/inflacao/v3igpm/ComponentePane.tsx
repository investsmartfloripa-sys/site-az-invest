"use client";

import { useMemo, useState, type ReactNode } from "react";

import type {
  DecomposicaoBlock,
  IgpmData,
  SinteseIgpmLinha,
  SubPainelComponente,
  TransformacaoIgpm,
} from "@/lib/painel-igpm";
import { AzSegmented, ChartCard, Heatmap, steppedDivergingScale } from "@/components/painel/core";
import { AzTimeSeriesChart, type AzSeriesPoint } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_CHART } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtSignedNum, fmtSignedPct } from "@/lib/format-br";
import { mesIso, num } from "../v2/shared";
import { CORES_COMPONENTE } from "../v2igpm/shared";

/**
 * O TEMPLATE de escrutínio por componente do IGP-M (tabs 2/3/4): tabela de
 * transformações (com o IGP-M como régua cinza e leitura que diz o quanto o
 * componente pesou no IGP-M), série âncora, heatmap de sazonalidade anos ×
 * meses, régua histórica didática (zonas) e a contribuição do componente ao
 * IGP-M cheio. Os gráficos de Momentum foram RETIRADOS (relatório 14/08/2026).
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
  linhaSintese,
  igpmMes,
}: {
  transformacoes: TransformacaoIgpm[];
  comp: ComponenteIgpm;
  mesRef: string;
  geradoEm: string;
  /** Linha do componente na tabela_sintese — peso efetivo + contribuição do mês. */
  linhaSintese?: SinteseIgpmLinha;
  /** IGP-M cheio do mês (contexto da contribuição). */
  igpmMes?: number | null;
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
  // (6m anualizado) com o acumulado 12m e diz O QUANTO o componente pesou no
  // IGP-M do mês (peso efetivo + contribuição — pedido do relatório 14/08).
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
    let frase = `O ${nome} variou ${fmtSignedPct(mes, 2)} no mês. Nos últimos 6 meses, roda a ${fmtSignedPct(saar_6m, 2)} em ritmo anual${dessaz ? " (já descontada a sazonalidade)" : ""}, ${tendencia} (${fmtSignedPct(acum_12m, 2)}).`;
    if (linhaSintese?.peso != null && linhaSintese.contrib_pp != null) {
      frase += ` No IGP-M, o ${nome} pesa ${fmtNum(linhaSintese.peso, 0)}% e respondeu por ${fmtSignedNum(linhaSintese.contrib_pp, 2)} p.p.${igpmMes != null ? ` dos ${fmtSignedPct(igpmMes, 2)} do índice cheio` : ""} neste mês.`;
    }
    return frase;
  }, [linhaComp, dessaz, linhaSintese, igpmMes]);

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
// 4a. Régua histórica — versão DIDÁTICA (relatório 14/08/2026: as faixas
// anteriores não comunicavam). Cinco zonas rotuladas + frase-veredito gerada
// por regra: o mensal é classificado por z-score (média/DP pós-96) e o 12m
// pelo percentil histórico do builder.
// ---------------------------------------------------------------------------

const ZONAS_ROTULO = ["muito abaixo", "abaixo", "normal", "acima", "muito acima"] as const;
const ZONAS_FRASE = [
  "muito abaixo do padrão histórico",
  "abaixo do padrão histórico",
  "dentro do padrão histórico",
  "acima do padrão histórico",
  "muito acima do padrão histórico",
] as const;
/** Cores das zonas na semântica de inflação: abaixo = azul, acima = vermelho. */
const ZONAS_COR = [AZ_CHART.neutral, AZ_CHART.neutral, "#64748B", AZ_CHART.neg, AZ_CHART.neg];

/** Zona por z-score: ±1 DP = normal; ±2 DP = muito acima/abaixo. */
function zonaPorZ(z: number): number {
  if (z <= -2) return 0;
  if (z <= -1) return 1;
  if (z < 1) return 2;
  if (z < 2) return 3;
  return 4;
}

/** Zona por percentil: 10/30/70/90 como cortes. */
function zonaPorPercentil(p: number): number {
  if (p < 10) return 0;
  if (p < 30) return 1;
  if (p <= 70) return 2;
  if (p <= 90) return 3;
  return 4;
}

/** Régua de 5 zonas com a zona ativa acesa e o valor embaixo dela. */
function ReguaZonas({ ativa, valorLabel }: { ativa: number; valorLabel: string }) {
  return (
    <div className="flex gap-1.5">
      {ZONAS_ROTULO.map((z, i) => {
        const acesa = i === ativa;
        return (
          <div key={z} className="min-w-0 flex-1 text-center">
            <div
              className="h-2.5 rounded-full"
              style={{ background: ZONAS_COR[i], opacity: acesa ? 1 : 0.16 }}
            />
            <p
              className="mt-1 truncate text-[10px] uppercase tracking-wide"
              style={acesa ? { color: ZONAS_COR[i], fontWeight: 700 } : { color: "#a1a1aa" }}
            >
              {z}
            </p>
            {acesa ? (
              <p className="whitespace-nowrap text-[11px] font-bold tabular-nums" style={{ color: ZONAS_COR[i] }}>
                {valorLabel}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function DistribuicaoCard({
  sub,
  comp,
  geradoEm,
}: {
  sub: SubPainelComponente;
  comp: ComponenteIgpm;
  geradoEm: string;
}) {
  const est = sub.estatisticas;
  const e12 = sub.estatisticas_12m;
  const atualMensal = sub.ultimo_mensal;
  const atual12m = sub.ultimo_12m;
  const percentil = e12?.percentil_atual ?? null;

  const zonaMensal =
    atualMensal != null && est.media != null && est.std != null && est.std > 0
      ? zonaPorZ((atualMensal - est.media) / est.std)
      : null;
  const zona12m = percentil != null ? zonaPorPercentil(percentil) : null;

  if (zonaMensal == null && zona12m == null) return null;

  return (
    <ChartCard
      title="Régua histórica"
      footer={`O valor de hoje comparado com TODA a história desde ${e12?.desde ?? "jan/1996"} (pós-Real estabilizado; estatísticas do pipeline). Zonas do mês: "normal" = até 1 desvio-padrão da média histórica; "muito acima/abaixo" = além de 2 desvios. Zonas do 12m: percentil histórico (abaixo de 10 e acima de 90 = extremos). Semântica de inflação: acima = vermelho (pressão), abaixo = azul.`}
      stampGiro={geradoEm}
      stampDado={sub.ultimo_mes}
    >
      <div className="space-y-5">
        {zonaMensal != null && atualMensal != null ? (
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Variação do mês
            </p>
            <p className="mb-2 text-xs leading-relaxed text-zinc-600">
              O {comp} de {fmtMesCurto(sub.ultimo_mes)} (
              <strong className="tabular-nums">{fmtSignedPct(atualMensal, 2)}</strong>) ficou{" "}
              <strong>{ZONAS_FRASE[zonaMensal]}</strong> — o mês típico deste índice é{" "}
              {est.mediana != null ? fmtSignedPct(est.mediana, 2) : "—"}.
            </p>
            <ReguaZonas ativa={zonaMensal} valorLabel={fmtSignedPct(atualMensal, 2)} />
          </div>
        ) : null}

        {zona12m != null && percentil != null ? (
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Acumulado 12 meses
            </p>
            <p className="mb-2 text-xs leading-relaxed text-zinc-600">
              Nos 12 meses (
              <strong className="tabular-nums">{atual12m != null ? fmtSignedPct(atual12m, 2) : "—"}</strong>), o{" "}
              {comp} está {ZONAS_FRASE[zona12m]}:{" "}
              {percentil < 50
                ? `mais baixo que ${fmtNum(100 - percentil, 0)}% de toda a história`
                : `mais alto que ${fmtNum(percentil, 0)}% de toda a história`}{" "}
              — o usual é {e12?.mediana != null ? fmtSignedPct(e12.mediana, 2) : "—"}.
            </p>
            <ReguaZonas ativa={zona12m} valorLabel={atual12m != null ? fmtSignedPct(atual12m, 2) : ""} />
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
      <p className="mb-2 text-xs leading-relaxed text-zinc-600">
        <strong className="font-semibold text-[#132960]">Leitura:</strong> o quanto o {comp} pesou no IGP-M,
        mês a mês — cada ponto é a fatia (em pontos percentuais) da variação do IGP-M daquele mês que veio
        deste componente.
      </p>
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

  // Linha do componente na tabela_sintese (peso efetivo + contribuição do
  // mês) e o IGP-M cheio — alimentam a Leitura da tabela de transformações.
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const linhaSintese = data.tabela_sintese?.secoes
    .find((s) => s.id === "componentes")
    ?.linhas.find((l) => l.nome === comp || norm(l.id) === norm(comp));
  const igpmMes = data.overview.ultimo_mensal;

  return (
    <div className="space-y-6">
      {data.transformacoes ? (
        <TabelaTransformacoes
          transformacoes={data.transformacoes}
          comp={comp}
          mesRef={data.mes_recente}
          geradoEm={geradoEm}
          linhaSintese={linhaSintese}
          igpmMes={igpmMes}
        />
      ) : null}

      {sub ? <SerieComponenteCard sub={sub} comp={comp} geradoEm={geradoEm} /> : null}

      {sub ? <HeatmapSazonalidadeCard sub={sub} comp={comp} geradoEm={geradoEm} /> : null}

      {sub ? <DistribuicaoCard sub={sub} comp={comp} geradoEm={geradoEm} /> : null}

      {data.decomposicao ? <ContribuicaoCard decomposicao={data.decomposicao} comp={comp} geradoEm={geradoEm} /> : null}

      {sub ? <RankingsDetails sub={sub} comp={comp} /> : null}
    </div>
  );
}
