"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DifusaoBlock, TabelaSinteseBlock } from "@/lib/painel-ipca";
import { AzSegmented, AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { DivergingReturnBars } from "@/components/painel/charts/DivergingReturnBars";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtMesLongo, fmtNum, fmtPct, fmtSignedNum, fmtSignedPct } from "@/lib/format-br";
import { META } from "../v2/shared";

/**
 * Os quatro blocos da antiga "Tabela-síntese do mês" como GRÁFICOS separados
 * (revisão ago/2026 do editor: a tabela única era densa demais para a leitura
 * do mês). A tabela continua viva, recolhida, em `TabelaSinteseCard` — nada de
 * dado se perdeu: aqui só muda a forma de ler.
 *
 * Todo valor vem pré-computado do builder (bloco `tabela_sintese`), como na
 * tabela — zero conta nova neste arquivo. Semântica de inflação em todos:
 * alta = vermelho (pressão), queda = azul.
 */

type Horizonte = "mes" | "acum_12m";

const HORIZONTES = [
  { id: "mes", label: "No mês" },
  { id: "acum_12m", label: "Em 12 meses" },
];

/** Cor pela DIREÇÃO na semântica de inflação (sobe = pressão = vermelho). */
const corInflacao = (v: number) => (v > 0 ? AZ_CHART.neg : AZ_CHART.neutral);

function linhasDaSecao(sintese: TabelaSinteseBlock, id: string) {
  return sintese.secoes.find((s) => s.id === id)?.linhas ?? [];
}

// ---------------------------------------------------------------------------
// 1. Índice cheio — IPCA e IPCA-15 nos três últimos meses
// ---------------------------------------------------------------------------

/**
 * IPCA e IPCA-15 lado a lado nos três meses fechados. Os acumulados (no ano e
 * em 12 meses) ficam na linha de leitura abaixo, e não no gráfico: misturar
 * variação mensal (~0,1%) com acumulado de 12 meses (~4,5%) no mesmo eixo
 * achata as barras do mês e engana a vista.
 */
export function SinteseIndiceCard({ sintese, geradoEm }: { sintese: TabelaSinteseBlock; geradoEm: string }) {
  const linhas = linhasDaSecao(sintese, "indice");
  const ipca = linhas.find((l) => l.id === "ipca");
  const ipca15 = linhas.find((l) => l.id === "ipca15");
  const [m2, m1, m0] = sintese.meses;

  const rows = useMemo(
    () =>
      [m2, m1, m0].map((mes, i) => ({
        mes: fmtMesCurto(mes),
        IPCA: [ipca?.m2, ipca?.m1, ipca?.m0][i] ?? null,
        "IPCA-15": [ipca15?.m2, ipca15?.m1, ipca15?.m0][i] ?? null,
      })),
    [ipca, ipca15, m2, m1, m0],
  );

  if (!ipca) return null;

  return (
    <ChartCard
      title={`O índice cheio (${fmtMesCurto(m0)})`}
      subtitle="IPCA é a inflação oficial fechada do mês. IPCA-15 é a prévia, coletada de meio a meio de mês — sai antes e serve de sinal do que vem."
      footer={
        <>
          <p className="mb-1.5">
            <strong>IPCA × IPCA-15.</strong> Os dois medem a mesma cesta, para as mesmas famílias (1 a 40 salários
            mínimos), nas mesmas regiões. Muda só a janela de coleta: o IPCA cobre o mês civil; o IPCA-15 vai do dia 16
            de um mês ao dia 15 do seguinte. Por isso o IPCA-15 antecipa o IPCA, sem repeti-lo.
          </p>
          <p>
            Os acumulados no ano e em 12 meses aparecem como texto e não como barra de propósito: colocar 0,07% do mês
            e 4,44% de 12 meses no mesmo eixo esmagaria as barras do mês.
          </p>
        </>
      }
      stampGiro={geradoEm}
      stampDado={m0}
    >
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid {...azGridProps()} />
            <XAxis {...azXAxisProps()} dataKey="mes" />
            <YAxis {...azYAxisProps()} width={44} tickFormatter={(v: number) => `${fmtNum(v, 1)}%`} />
            <ReferenceLine y={0} stroke={AZ_CHART.zero} strokeOpacity={AZ_CHART.zeroOpacity} strokeWidth={1.5} />
            <Tooltip content={<AzTooltip valueFmt={(v) => fmtSignedPct(v, 2)} />} cursor={AZ_TOOLTIP_PROPS.cursor} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="IPCA" name="IPCA (mês fechado)" fill={AZ_BRAND.navy} maxBarSize={38} isAnimationActive={false} />
            <Bar
              dataKey="IPCA-15"
              name="IPCA-15 (prévia)"
              fill={AZ_BRAND.azure}
              fillOpacity={0.55}
              maxBarSize={38}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        {[
          { nome: "IPCA", linha: ipca },
          { nome: "IPCA-15", linha: ipca15 },
        ]
          .filter((x) => x.linha)
          .map(({ nome, linha }) => (
            <div key={nome} className="rounded-lg border border-zinc-100 bg-[#f8fafc] px-3 py-2">
              <p className="font-semibold text-[#132960]">{nome}</p>
              <p className="mt-0.5 text-zinc-600">
                No ano <strong className="tabular-nums">{fmtSignedNum(linha?.acum_ano ?? null, 2)}%</strong> · 12 meses{" "}
                <strong className="tabular-nums">{fmtSignedNum(linha?.acum_12m ?? null, 2)}%</strong>
              </p>
            </div>
          ))}
      </div>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// 2. Grupos — quanto cada um SUBIU (variação %), com alternador de horizonte
// ---------------------------------------------------------------------------

/**
 * Variação percentual dos 9 grupos. Complementa (não repete) o card de
 * contribuição: aqui é "quanto subiu o preço"; lá é "quanto isso pesou no
 * índice", que já embute o peso do grupo na cesta.
 */
export function SinteseGruposCard({ sintese, geradoEm }: { sintese: TabelaSinteseBlock; geradoEm: string }) {
  const [horizonte, setHorizonte] = useState<Horizonte>("mes");
  const linhas = linhasDaSecao(sintese, "grupos");
  const m0 = sintese.mes_recente;

  const rows = useMemo(
    () =>
      linhas
        .map((l) => ({ label: l.nome, value: (horizonte === "mes" ? l.m0 : l.acum_12m) ?? null }))
        .filter((r): r is { label: string; value: number } => r.value != null)
        .sort((a, b) => b.value - a.value),
    [linhas, horizonte],
  );

  if (rows.length === 0) return null;

  return (
    <ChartCard
      title={`Quanto cada grupo subiu (${horizonte === "mes" ? fmtMesCurto(m0) : "12 meses"})`}
      subtitle="Variação de preço do grupo, sem levar em conta o tamanho dele na cesta. Um grupo pode subir muito e mexer pouco no IPCA se pesar pouco no orçamento."
      toolbar={
        <AzSegmented
          ariaLabel="Horizonte da variação por grupo"
          options={HORIZONTES}
          value={horizonte}
          onChange={(id) => setHorizonte(id as Horizonte)}
        />
      }
      footer={
        <p>
          Os nove grupos do IPCA cobrem 100% da cesta. Esta é a variação de preço de cada um — para saber quanto cada
          grupo empurrou o índice, veja o card de contribuição, que multiplica esta variação pelo peso do grupo. Em 12
          meses, a linha tracejada marca a meta de inflação de {fmtPct(META, 1)}.
        </p>
      }
      stampGiro={geradoEm}
      stampDado={m0}
    >
      <DivergingReturnBars
        rows={rows}
        yAxisWidth={168}
        labelMax={26}
        valueFmt={(v) => fmtSignedPct(v, 2)}
        axisFmt={(v) => fmtSignedNum(v, Math.abs(v) < 1 ? 1 : 0)}
        fillFor={corInflacao}
        refX={horizonte === "acum_12m" ? { value: META, label: `meta ${fmtPct(META, 1)}`, color: AZ_BRAND.navy } : undefined}
      />
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// 3. Categorias econômicas
// ---------------------------------------------------------------------------

const CATEGORIA_GLOSSA: Record<string, string> = {
  cat_livres: "preços definidos pelo mercado — a maior parte da cesta",
  cat_monitorados: "preços fixados ou autorizados por contrato/governo (energia, combustível, ônibus, plano de saúde)",
  cat_servicos: "mão de obra e serviços (aluguel, escola, salão, restaurante) — o que o Banco Central olha de perto",
  cat_comercializaveis: "bens que podem ser importados ou exportados — sensíveis ao câmbio",
};

/**
 * O recorte que o Copom lê. Serviços é o termômetro da inflação doméstica
 * (salários); monitorados e comercializáveis respondem a contrato e a câmbio.
 */
export function SinteseCategoriasCard({ sintese, geradoEm }: { sintese: TabelaSinteseBlock; geradoEm: string }) {
  const [horizonte, setHorizonte] = useState<Horizonte>("acum_12m");
  const linhas = linhasDaSecao(sintese, "categorias");
  const m0 = sintese.mes_recente;

  const rows = useMemo(
    () =>
      linhas
        .map((l) => ({ label: l.nome, value: (horizonte === "mes" ? l.m0 : l.acum_12m) ?? null }))
        .filter((r): r is { label: string; value: number } => r.value != null)
        .sort((a, b) => b.value - a.value),
    [linhas, horizonte],
  );

  if (rows.length === 0) return null;

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
      <DivergingReturnBars
        rows={rows}
        yAxisWidth={150}
        labelMax={22}
        valueFmt={(v) => fmtSignedPct(v, 2)}
        axisFmt={(v) => fmtSignedNum(v, Math.abs(v) < 1 ? 1 : 0)}
        fillFor={corInflacao}
        refX={horizonte === "acum_12m" ? { value: META, label: `meta ${fmtPct(META, 1)}`, color: AZ_BRAND.navy } : undefined}
      />
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// 4. Difusão — quantos preços subiram, mês a mês
// ---------------------------------------------------------------------------

const MESES_DIFUSAO = 13;

/**
 * A difusão dos últimos 13 meses em barras, contra a média histórica. É a
 * versão "leitura do mês" do card de difusão da aba de núcleos, que mostra a
 * série inteira: aqui interessa o mês recente contra o normal.
 */
export function SinteseDifusaoCard({ difusao, geradoEm }: { difusao: DifusaoBlock; geradoEm: string }) {
  const media = difusao.media_historica?.media ?? null;
  const dp = difusao.media_historica?.dp ?? null;
  const desde = difusao.media_historica?.desde ?? null;

  const rows = useMemo(
    () =>
      difusao.serie
        .filter((r) => typeof r.difusao === "number")
        .slice(-MESES_DIFUSAO)
        .map((r) => ({ mes: fmtMesCurto(r.mes), mesIso: r.mes, difusao: r.difusao as number })),
    [difusao.serie],
  );

  if (rows.length === 0) return null;

  const ultimo = rows[rows.length - 1];
  const posicao =
    media == null || dp == null
      ? null
      : ultimo.difusao > media + dp
        ? "acima"
        : ultimo.difusao < media - dp
          ? "abaixo"
          : "normal";

  /** Fora da faixa normal ganha cor; dentro dela fica cinza — não é notícia. */
  const cor = (v: number) => {
    if (media == null || dp == null) return AZ_CHART.ticks;
    if (v > media + dp) return AZ_CHART.neg;
    if (v < media - dp) return AZ_CHART.neutral;
    return "#94A3B8";
  };

  return (
    <ChartCard
      title={`Em quantos preços a alta apareceu (${fmtMesCurto(ultimo.mesIso)})`}
      subtitle="Percentual dos cerca de 380 subitens do IPCA que ficaram mais caros no mês. Mede o alcance da alta, não o tamanho dela."
      footer={
        <p>
          A régua não é 50%: a difusão do IPCA quase nunca fica abaixo disso, porque em geral há mais itens subindo do
          que caindo. A referência é a média desde {desde?.slice(0, 4) ?? "2012"} (linha tracejada), com a faixa de ±1
          desvio-padrão como “normal” — barras cinzas estão dentro dessa faixa. Difusão alta com IPCA baixo indica alta
          pequena e espalhada; difusão baixa com IPCA alto indica choque concentrado em poucos itens. A série completa
          está na aba “Núcleos &amp; difusão”.
        </p>
      }
      stampGiro={geradoEm}
      stampDado={ultimo.mesIso}
    >
      {media != null && posicao ? (
        <p className="mb-3 rounded-lg border border-zinc-100 bg-[#f8fafc] px-3 py-2 text-xs leading-relaxed text-zinc-700">
          <strong className="tabular-nums">{fmtPct(ultimo.difusao, 1)}</strong> dos subitens subiram em{" "}
          {fmtMesLongo(ultimo.mesIso)} — contra uma média histórica de{" "}
          <strong className="tabular-nums">{fmtPct(media, 1)}</strong>.{" "}
          {posicao === "normal" ? (
            <>A alta está espalhada dentro do normal.</>
          ) : posicao === "acima" ? (
            <strong style={{ color: AZ_CHART.negText }}>A alta está mais espalhada que o usual.</strong>
          ) : (
            <strong style={{ color: AZ_CHART.neutral }}>A alta está mais concentrada que o usual.</strong>
          )}
        </p>
      ) : null}
      <div className="h-[230px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid {...azGridProps()} />
            <XAxis {...azXAxisProps()} dataKey="mes" interval={1} />
            <YAxis
              {...azYAxisProps()}
              width={44}
              domain={[30, 90]}
              tickFormatter={(v: number) => `${fmtNum(v, 0)}%`}
            />
            {media != null ? (
              <ReferenceLine
                y={media}
                stroke={AZ_BRAND.navy}
                strokeDasharray="4 4"
                strokeWidth={1.2}
                label={{
                  value: `média ${desde?.slice(0, 4) ?? ""}+: ${fmtPct(media, 0)}`,
                  position: "insideTopRight",
                  fontSize: 9,
                  fill: AZ_BRAND.navy,
                }}
              />
            ) : null}
            <Tooltip
              content={<AzTooltip valueFmt={(v) => fmtPct(v, 1)} />}
              cursor={AZ_TOOLTIP_PROPS.cursor}
            />
            <Bar dataKey="difusao" name="Subitens em alta" maxBarSize={26} radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {rows.map((r) => (
                <Cell key={r.mesIso} fill={cor(r.difusao)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
