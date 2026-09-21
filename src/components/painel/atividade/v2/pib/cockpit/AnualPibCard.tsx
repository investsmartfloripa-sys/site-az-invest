"use client";

import { useMemo, useState, type ReactElement } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { AtividadePibData, FocusPonto, PibPerCapitaPonto } from "@/lib/painel-atividade";
import {
  AzTooltip,
  ChartCard,
  CockpitChip,
  KpiCard,
  azGridProps,
  azXAxisProps,
  azYAxisProps,
  azZeroLineProps,
  tomPorSinal,
} from "@/components/painel/core";
import { AzPeriodSelector, resolvePeriodRange, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS, variationFill } from "@/lib/az-chart-theme";
import { fmtBRL, fmtDataBR, fmtNum, fmtPct, fmtSignedPct } from "@/lib/format-br";
import { fmtTrimCurto, num, trimIsoCentral } from "../../shared";
import { estatisticasBanda } from "../cockpit-shared";

/**
 * COCKPIT PIB — frequência ANUAL num card compacto: barras do crescimento real
 * realizado por ano (acum. no ano no 4º trimestre, SIDRA 5932 v6563) seguidas
 * das medianas Focus (BCB Olinda) dos anos ainda abertos, com a mediana de 20
 * anos como régua; abaixo, 3 KPIs do PIB per capita (SIDRA 6784, SCN anual).
 * Substitui RealizadoFocusCard + PerCapitaCard (v2) na casca §10.
 */

/** Primeiro ano plotado em barra (a série trimestral gravada começa no 3T06). */
const ANO_INICIAL = 2007;
/** Janela da régua: últimos N anos fechados com dado (mediana, não média). */
const JANELA_MEDIANA_ANOS = 20;
const CAMPO_ACUM_ANO = "acum_ano_pib";
const ALTURA_GRAFICO = 180;
const LARGURA_EIXO_Y = 44;
const MARGEM_DIREITA = 16;
/** Rótulo de valor só quando cada barra tem ao menos esta largura (senão colidem). */
const LARGURA_MIN_ROTULO_PX = 26;

type LinhaAnual = {
  ano: string;
  /** ISO do mês central do 4T (alinha o seletor de período às demais séries trimestrais). */
  iso: string;
  valor: number;
  tipo: "realizado" | "focus";
  /** Data da coleta Focus (só em `focus`). */
  coleta?: string;
  /** Desvio-padrão das projeções na coleta (só em `focus`). */
  dp?: number | null;
};

/** Última mediana gravada do ano (maior data; empate → última linha, como no FocusPibCard). */
function ultimaMedianaFocus(arr: ReadonlyArray<FocusPonto> | undefined): { mediana: number; data: string; dp: number | null } | null {
  if (!arr || arr.length === 0) return null;
  let best: { mediana: number; data: string; dp: number | null } | null = null;
  for (const p of arr) {
    if (!p.data || p.mediana == null || !Number.isFinite(p.mediana)) continue;
    if (!best || p.data >= best.data) {
      best = { mediana: p.mediana, data: p.data, dp: p.dp != null && Number.isFinite(p.dp) ? p.dp : null };
    }
  }
  return best;
}

/** Tick do eixo Y: inteiro sem casa ("+2%"), fracionário com uma ("+0,5%"). */
function fmtTickY(v: number): string {
  return fmtSignedPct(v, Number.isInteger(v) ? 0 : 1);
}

/**
 * Rótulo de valor no topo da barra. O Recharts entrega `y = escala(valor)` e
 * `height = escala(0) − escala(valor)` (negativo em barras negativas), então o
 * topo/base são min/max de y e y+height; positivo → acima do topo, negativo →
 * abaixo da base (nunca em cima da linha do zero).
 */
function renderRotuloBarra(props: unknown): ReactElement {
  const { x, y, width, height, value } = props as {
    x?: number | string;
    y?: number | string;
    width?: number | string;
    height?: number | string;
    value?: number | string;
  };
  const xx = Number(x);
  const yy = Number(y);
  const w = Number.isFinite(Number(width)) ? Number(width) : 0;
  const h = Number.isFinite(Number(height)) ? Number(height) : 0;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(xx) || !Number.isFinite(yy) || !Number.isFinite(n)) return <g />;
  const topo = Math.min(yy, yy + h);
  const base = Math.max(yy, yy + h);
  const acima = n >= 0;
  return (
    <text
      x={xx + w / 2}
      y={acima ? topo - 3 : base + 3}
      textAnchor="middle"
      dominantBaseline={acima ? "auto" : "hanging"}
      style={{ fontSize: 9, fill: AZ_CHART.labels, fontVariantNumeric: "tabular-nums" }}
    >
      {fmtSignedPct(n, 1)}
    </text>
  );
}

export function AnualPibCard({ pib, geradoEm }: { pib: AtividadePibData; geradoEm: string }) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "10y" });
  const [larguraPlot, setLarguraPlot] = useState(0);

  // Anos FECHADOS: acum. no ano lido no 4º trimestre (variável oficial da 5932, não soma do cliente).
  const realizados = useMemo<LinhaAnual[]>(() => {
    const out: LinhaAnual[] = [];
    for (const r of pib.variacao.serie) {
      if (!r.trim.endsWith("-T04")) continue;
      const v = num(r, CAMPO_ACUM_ANO);
      if (v == null) continue;
      out.push({ ano: r.trim.slice(0, 4), iso: trimIsoCentral(r.trim), valor: v, tipo: "realizado" });
    }
    return out.sort((a, b) => a.ano.localeCompare(b.ano));
  }, [pib.variacao.serie]);

  const ultRealizado = realizados.length > 0 ? realizados[realizados.length - 1] : null;
  const anoFechado = ultRealizado ? parseInt(ultRealizado.ano, 10) : null;

  // Régua: mediana dos últimos 20 anos fechados com dado (fixa, independe da janela do seletor).
  const mediana = useMemo(() => {
    const ultimos = realizados.slice(-JANELA_MEDIANA_ANOS);
    const b = estatisticasBanda(ultimos.map((r) => r.valor));
    if (!b || ultimos.length === 0) return null;
    return { valor: b.mediana, n: b.n, de: ultimos[0].ano, ate: ultimos[ultimos.length - 1].ano };
  }, [realizados]);

  // Barras realizadas: de ANO_INICIAL em diante, recortadas pelo seletor.
  const plotaveis = useMemo(() => realizados.filter((r) => parseInt(r.ano, 10) >= ANO_INICIAL), [realizados]);
  const minIso = plotaveis.length > 0 ? plotaveis[0].iso : "";
  const maxIso = plotaveis.length > 0 ? plotaveis[plotaveis.length - 1].iso : "";

  const realizadosNaJanela = useMemo<LinhaAnual[]>(() => {
    if (plotaveis.length === 0) return [];
    const { from, to } = resolvePeriodRange(period, minIso, maxIso);
    return plotaveis.filter((r) => r.iso >= from && r.iso <= to);
  }, [plotaveis, period, minIso, maxIso]);

  // Projeções: última mediana Focus de cada ano-referência AINDA ABERTO (> último fechado).
  const projecoes = useMemo<LinhaAnual[]>(() => {
    if (anoFechado == null) return [];
    const out: LinhaAnual[] = [];
    for (const ano of Object.keys(pib.focus)) {
      const n = parseInt(ano, 10);
      if (!Number.isFinite(n) || n <= anoFechado) continue;
      const u = ultimaMedianaFocus(pib.focus[ano]);
      if (!u) continue;
      out.push({ ano: String(n), iso: `${n}-11-01`, valor: u.mediana, tipo: "focus", coleta: u.data, dp: u.dp });
    }
    return out.sort((a, b) => a.ano.localeCompare(b.ano));
  }, [pib.focus, anoFechado]);

  const rows = useMemo<LinhaAnual[]>(() => [...realizadosNaJanela, ...projecoes], [realizadosNaJanela, projecoes]);
  const porAno = useMemo(() => new Map(rows.map((r) => [r.ano, r] as const)), [rows]);

  // Rótulos de valor só quando há espaço por barra (o SSR e o 1º render do cliente coincidem: sem rótulo).
  const larguraPorBarra = rows.length > 0 ? (larguraPlot - LARGURA_EIXO_Y - MARGEM_DIREITA) / rows.length : 0;
  const mostrarRotulos = larguraPorBarra >= LARGURA_MIN_ROTULO_PX;

  // PIB per capita (SCN anual 6784) — último ano gravado e o anterior (crescimento populacional).
  const serieBase: ReadonlyArray<PibPerCapitaPonto> = pib.per_capita?.serie ?? [];
  const ultPc = serieBase.length > 0 ? serieBase[serieBase.length - 1] : null;
  const penultPc = serieBase.length > 1 ? serieBase[serieBase.length - 2] : null;
  const popMi = ultPc?.populacao_mil != null ? ultPc.populacao_mil / 1000 : null;
  const varPop =
    ultPc?.populacao_mil != null && penultPc?.populacao_mil != null && penultPc.populacao_mil > 0
      ? +((ultPc.populacao_mil / penultPc.populacao_mil - 1) * 100).toFixed(2)
      : null;
  const anoPc = ultPc ? ` ${ultPc.ano}` : "";

  const ultimaColeta = projecoes.length > 0 ? projecoes[projecoes.length - 1].coleta ?? null : null;
  // Trimestre recente só é "parcial" quando não é o 4T (no 4T o ano já entrou como realizado).
  const trimParcial = pib.trim_recente && !pib.trim_recente.endsWith("-T04") ? pib.trim_recente : null;
  const chipRealizado = ultRealizado ? `${ultRealizado.ano} realizado ${fmtSignedPct(ultRealizado.valor, 1)}` : "realizado —";
  const chipFocus =
    projecoes.length > 0 ? `Focus ${projecoes.map((p) => `${p.ano} ${fmtPct(p.valor, 1)}`).join(" · ")}` : "Focus —";

  const rotuloTooltip = (l: string | number): string => {
    const r = porAno.get(String(l));
    if (!r) return String(l);
    if (r.tipo === "realizado") return `${r.ano} · realizado (acum. no ano, 4T)`;
    const detalhes = [r.coleta ? `coleta ${fmtDataBR(r.coleta)}` : null, r.dp != null ? `dp ${fmtNum(r.dp, 2)}` : null]
      .filter((s): s is string => s != null)
      .join(", ");
    return `${r.ano} · Focus mediana${detalhes ? ` (${detalhes})` : ""}`;
  };

  const footer = (
    <div className="space-y-1.5">
      <p>
        <strong>Realizado</strong> = variação real do PIB acumulada no ano, lida no 4º trimestre (SIDRA 5932, variável
        6563, campo <code>acum_ano_pib</code>) — só anos fechados. O acumulado de meio de ano
        {trimParcial ? ` (${fmtTrimCurto(trimParcial)})` : ""} não entra: acumulado parcial não é
        comparável com a projeção do ano-calendário. Barra verde = cresceu, vermelha = caiu (direção literal do
        número). As barras começam em {ANO_INICIAL} porque a série trimestral gravada começa no 3T06.
      </p>
      <p>
        <strong>Projeções</strong> (barras azuis translúcidas, tracejadas) = última mediana Focus gravada por
        ano-referência ainda aberto (BCB Olinda, ExpectativasMercadoAnuais &quot;PIB Total&quot;
        {ultimaColeta ? `, coleta de ${fmtDataBR(ultimaColeta)}` : ""}). O tooltip mostra o desvio-padrão entre as
        instituições (dp) — dispersão de respostas, não intervalo de confiança. O payload é regravado só no giro do
        PIB, então a mediana pode estar semanas atrás do Focus corrente.
      </p>
      <p>
        <strong>Mediana {JANELA_MEDIANA_ANOS}a</strong> (linha tracejada) = mediana dos últimos{" "}
        {mediana?.n ?? JANELA_MEDIANA_ANOS} anos fechados com dado
        {mediana ? ` (${mediana.de}–${mediana.ate}: ${fmtSignedPct(mediana.valor, 1)})` : ""}, calculada no cliente.
        Mediana em vez de média porque 2009, 2015–16 e 2020 puxariam a média para baixo. Fixa: não muda com a
        janela do seletor. Rótulos de valor aparecem quando cada barra tem ≥ {LARGURA_MIN_ROTULO_PX} px; na janela
        Máx em tela estreita, use o tooltip.
      </p>
      <p>
        <strong>PIB per capita</strong> = SIDRA 6784 (SCN anual): v9814 = variação em volume do PIB per capita
        (oficial, não é PIB ÷ população feito aqui), v9812 = PIB per capita a preços correntes (R$ por habitante no
        ano), v9810 = variação em volume do PIB, v93 = população residente (mil). A diferença entre PIB real e per
        capita real é o crescimento populacional (KPI &quot;População&quot;, variação vs ano anterior, calculada no
        cliente). O SCN anual definitivo sai com 1–2 anos de defasagem
        {ultPc ? ` — último ano gravado: ${ultPc.ano}` : " — o builder omite o bloco quando a 6784 está indisponível na rodada"}
        .
      </p>
    </div>
  );

  return (
    <ChartCard
      id="pib-anual"
      title="Anual — PIB realizado × Focus · per capita"
      subtitle="SIDRA 5932 / 6784 · BCB Olinda · crescimento anual realizado (acum. no ano do 4º trimestre) com as medianas Focus dos anos-referência abertos · per capita real e nominal"
      toolbar={
        <AzPeriodSelector
          value={period}
          onChange={setPeriod}
          min={minIso || undefined}
          max={maxIso || undefined}
          periods={["5y", "10y", "max"]}
        />
      }
      footer={footer}
      stampGiro={geradoEm}
      stampDado={pib.trim_recente || null}
    >
      <div className="mb-2 flex flex-wrap gap-1.5">
        <CockpitChip
          tom={tomPorSinal(ultRealizado?.valor)}
          title="Último ano fechado: variação real acumulada no ano, lida no 4º trimestre (SIDRA 5932 v6563)"
        >
          {chipRealizado}
        </CockpitChip>
        <CockpitChip
          tom="navy"
          title={
            ultimaColeta
              ? `Mediana Focus mais recente gravada por ano-referência (coleta de ${fmtDataBR(ultimaColeta)})`
              : "Sem projeção Focus gravada para anos abertos"
          }
        >
          {chipFocus}
        </CockpitChip>
      </div>

      {rows.length === 0 ? (
        <p
          className="flex items-center justify-center text-sm text-zinc-400"
          style={{ height: ALTURA_GRAFICO }}
        >
          — sem anos fechados de PIB na série gravada.
        </p>
      ) : (
        <div className="w-full">
          <ResponsiveContainer width="100%" height={ALTURA_GRAFICO} onResize={(w) => setLarguraPlot(w)}>
            <ComposedChart data={rows} margin={{ top: 12, right: MARGEM_DIREITA, bottom: 0, left: 0 }}>
              <CartesianGrid {...azGridProps()} />
              <XAxis {...azXAxisProps()} dataKey="ano" minTickGap={8} />
              <YAxis {...azYAxisProps()} width={LARGURA_EIXO_Y} tickFormatter={fmtTickY} />

              <ReferenceLine {...azZeroLineProps("y")} />

              {mediana ? (
                <ReferenceLine
                  y={mediana.valor}
                  stroke={AZ_BRAND.navy}
                  strokeDasharray="4 4"
                  strokeWidth={1.2}
                  ifOverflow="extendDomain"
                  label={{
                    value: `mediana ${JANELA_MEDIANA_ANOS}a ${fmtSignedPct(mediana.valor, 1)}`,
                    position: "insideTopLeft",
                    fontSize: 9,
                    fill: AZ_BRAND.navy,
                  }}
                />
              ) : null}

              <Tooltip
                content={<AzTooltip labelFmt={rotuloTooltip} valueFmt={(v) => fmtSignedPct(v, 1)} hideDot />}
                cursor={AZ_TOOLTIP_PROPS.cursor}
              />

              <Bar dataKey="valor" name="var. real anual" isAnimationActive={false} maxBarSize={22} radius={[2, 2, 0, 0]}>
                {rows.map((r) => (
                  <Cell
                    key={`${r.tipo}-${r.ano}`}
                    fill={r.tipo === "focus" ? AZ_BRAND.azure : variationFill(r.valor)}
                    fillOpacity={r.tipo === "focus" ? 0.35 : 1}
                    stroke={r.tipo === "focus" ? AZ_BRAND.azure : undefined}
                    strokeWidth={r.tipo === "focus" ? 1 : undefined}
                    strokeDasharray={r.tipo === "focus" ? "4 3" : undefined}
                  />
                ))}
                {mostrarRotulos ? <LabelList dataKey="valor" content={renderRotuloBarra} /> : null}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <KpiCard
          size="sm"
          label={`PIB per capita real${anoPc}`}
          value={fmtSignedPct(ultPc?.var_real_per_capita, 1)}
          hint={ultPc?.var_real_pib != null ? `PIB real ${fmtSignedPct(ultPc.var_real_pib, 1)}` : undefined}
        />
        <KpiCard
          size="sm"
          label={`PIB per capita nominal${anoPc}`}
          value={fmtBRL(ultPc?.per_capita_nominal, 0)}
          hint="preços correntes · por habitante"
        />
        <KpiCard
          size="sm"
          label={`População${anoPc}`}
          value={fmtNum(popMi, 1)}
          unit={popMi != null ? "mi" : undefined}
          delta={varPop}
          deltaHint={varPop != null && penultPc ? `vs ${penultPc.ano}` : undefined}
        />
      </div>
    </ChartCard>
  );
}
