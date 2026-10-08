"use client";

import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import DataStamp from "@/components/painel/DataStamp";
import { AzPeriodSelector, resolvePeriodRange, type AzPeriodValue } from "@/components/painel/charts";
import { Divisor, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { MethodInfo } from "@/components/painel/core/MethodInfo";
import { AZ_BRAND, AZ_CHART } from "@/lib/az-chart-theme";
import {
  buildTimeTicks,
  diffDaysUTC,
  fmtDataBR,
  fmtMesCurto,
  fmtNum,
  fmtSignedNum,
  formatTimeTickLabel,
  isoFromUTC,
  parseIsoUTC,
} from "@/lib/format-br";
import type { FiiTijoloModeloData, FiiTijoloRow } from "@/lib/painel-fii";

const COR = {
  indice: AZ_BRAND.navy,
  just: AZ_BRAND.azure,
  dy: AZ_CHART.neg,
  ifix: AZ_BRAND.azure,
} as const;
/** O DY pelos juros é o mesmo vermelho do DY do índice, mais claro. */
const OPAC_DY_JUST = 0.4;
/** O DY fica ao fundo do gráfico do índice: traço mais leve que as linhas da frente. */
const OPAC_DY = 0.8;

const pts = (v: number | null | undefined, dec = 0) => (v != null ? fmtNum(v, dec) : "—");
const taxa = (v: number | null | undefined) => (v != null ? `${fmtNum(v, 2)}%` : "—");

function Amostra({
  cor,
  tracejado,
  pontilhado,
  barra,
  opacidade = 1,
}: {
  cor: string;
  tracejado?: boolean;
  pontilhado?: boolean;
  barra?: boolean;
  opacidade?: number;
}) {
  return (
    <span
      aria-hidden
      className={`inline-block align-middle ${barra ? "h-[3px] w-3 rounded-full" : "h-0.5 w-4"}`}
      style={{
        opacity: opacidade,
        ...(pontilhado
          ? { backgroundImage: `repeating-linear-gradient(90deg, ${cor} 0 2px, transparent 2px 5px)` }
          : tracejado
            ? { backgroundImage: `repeating-linear-gradient(90deg, ${cor} 0 5px, transparent 5px 8px)` }
            : { backgroundColor: cor }),
      }}
    />
  );
}

const caixaTooltip = {
  background: AZ_BRAND.navy,
  borderRadius: 8,
  color: "#fff",
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(19,41,96,.25)",
  padding: "8px 12px",
  maxWidth: 300,
} as const;

function Item({ nome, valor, cor }: { nome: string; valor: string; cor?: string }) {
  return (
    <p style={{ display: "flex", alignItems: "center", gap: 6, margin: 0, whiteSpace: "nowrap" }}>
      {cor ? <span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%", background: cor, flexShrink: 0 }} /> : null}
      <span style={{ color: "#C7D2E8" }}>{nome}</span>
      <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", marginLeft: "auto" }}>{valor}</span>
    </p>
  );
}

// ---------------------------------------------------------------------------
// Aba Analítico: índice × onde deveria estar pelos juros, DY embaixo, simulador ao lado
// ---------------------------------------------------------------------------

type Linha = FiiTijoloRow & {
  t: number;
  faixa: [number, number] | null;
  distancia: number | null;
  projetado?: boolean;
  proj_just?: number | null;
  proj_dy?: number | null;
  proj_selic?: number | null;
  proj_p1?: number | null;
};

function montar(m: FiiTijoloModeloData): { hist: Linha[]; proj: Linha[] } {
  const hist: Linha[] = m.serie
    .filter((r) => r.preco != null)
    .map((r) => ({
      ...r,
      t: parseIsoUTC(r.date),
      faixa: r.just_lo != null && r.just_hi != null ? [r.just_lo, r.just_hi] : null,
      distancia: r.just != null && r.preco ? (r.just / r.preco - 1) * 100 : null,
    }));
  const pj = m.projecao?.pontos ?? [];
  const proj: Linha[] = [];
  if (pj.length >= 2 && hist.length) {
    const ult = hist[hist.length - 1];
    pj.forEach((p, i) => {
      if (i === 0 && p.mes === ult.mes) {
        Object.assign(ult, { proj_just: p.just, proj_dy: p.dy_just, proj_selic: p.selic, proj_p1: p.p1 });
        return;
      }
      proj.push({
        mes: p.mes,
        date: p.date,
        parcial: false,
        preco: null,
        retorno_total: null,
        ifix: null,
        dy: null,
        dy_just: null,
        just: null,
        just_lo: null,
        just_hi: null,
        pvp: null,
        n: 0,
        p1: p.p1,
        r30: null,
        t: parseIsoUTC(p.date),
        faixa: null,
        distancia: null,
        projetado: true,
        proj_just: p.just,
        proj_dy: p.dy_just,
        proj_selic: p.selic,
        proj_p1: p.p1,
      });
    });
  }
  return { hist, proj };
}

function TooltipJust({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }> }) {
  if (!active || !payload || payload.length === 0) return null;
  const r = payload[0]?.payload as Linha | undefined;
  if (!r) return null;
  if (r.projetado) {
    return (
      <div style={caixaTooltip}>
        <p style={{ color: "#94A3B8", fontWeight: 600, margin: "0 0 4px" }}>{fmtMesCurto(r.date)} · projeção</p>
        <Item nome="Onde deveria estar" valor={pts(r.proj_just)} cor={COR.just} />
        <Item nome="DY pelos juros" valor={taxa(r.proj_dy)} cor={COR.dy} />
        <p style={{ margin: "4px 0 0", color: "#C7D2E8" }}>
          Selic implícita no mês <strong style={{ color: "#fff" }}>{taxa(r.proj_selic)}</strong> · juro de 1 ano{" "}
          <strong style={{ color: "#fff" }}>{taxa(r.proj_p1)}</strong>
        </p>
      </div>
    );
  }
  return (
    <div style={caixaTooltip}>
      <p style={{ color: "#94A3B8", fontWeight: 600, margin: "0 0 4px" }}>
        {r.parcial ? `${fmtDataBR(r.date)} (mês em curso)` : fmtMesCurto(r.date)}
      </p>
      <Item nome="Índice de tijolo" valor={pts(r.preco)} cor={COR.indice} />
      <Item nome="Onde deveria estar" valor={pts(r.just)} cor={COR.just} />
      <Item nome="DY do índice" valor={taxa(r.dy)} cor={COR.dy} />
      <Item nome="DY pelos juros" valor={taxa(r.dy_just)} />
      {r.distancia != null ? (
        <p style={{ margin: "4px 0 0", color: "#C7D2E8" }}>
          {r.distancia >= 0 ? "Abaixo" : "Acima"} do justificado em{" "}
          <strong style={{ color: "#fff" }}>{fmtNum(Math.abs(r.distancia), 1)}%</strong> · {r.n} fundos
        </p>
      ) : null}
      <p style={{ margin: "2px 0 0", color: "#C7D2E8" }}>
        Juro de 1 ano {taxa(r.p1)} · NTN-B 30 anos {taxa(r.r30)}
      </p>
    </div>
  );
}

function Controle({
  rotulo,
  ajuda,
  valor,
  hoje,
  min,
  max,
  onChange,
}: {
  rotulo: string;
  ajuda: string;
  valor: number;
  hoje: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold text-[#132960]">{rotulo}</span>
        <strong className="text-sm tabular-nums text-[#132960]">{fmtNum(valor, 2)}%</strong>
      </span>
      <span className="block text-[10px] text-zinc-400">
        {ajuda} · hoje <span className="tabular-nums">{fmtNum(hoje, 2)}%</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step="any"
        value={valor}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 w-full accent-[#027DFC]"
        aria-label={rotulo}
      />
      <span className="flex justify-between text-[10px] tabular-nums text-zinc-400">
        <span>{fmtNum(min, 0)}%</span>
        <span>{fmtNum(max, 0)}%</span>
      </span>
    </label>
  );
}

const PASSOS_INDICE = [25, 50, 100, 200, 250, 500, 1000];
const PASSOS_DY = [0.25, 0.5, 1, 2, 2.5, 5];
const serie = (lo: number, passo: number, n: number) => Array.from({ length: n + 1 }, (_, i) => lo + i * passo);

/**
 * Escalas do gráfico principal: índice no eixo da esquerda e DY ao fundo, no eixo da direita.
 * Os dois eixos têm o mesmo número de faixas, então as linhas de grade valem para ambos; o DY
 * ganha o menor passo que cabe nessas faixas, centrado, para ocupar a mesma altura que o índice.
 */
function escalas(ind: number[], dy: number[]) {
  if (!ind.length) return null;
  const a = Math.min(...ind);
  const b = Math.max(...ind);
  const pad = (b - a) * 0.06 || 10;
  let passo = PASSOS_INDICE[PASSOS_INDICE.length - 1];
  for (const p of PASSOS_INDICE) {
    if ((Math.ceil((b + pad) / p) - Math.floor((a - pad) / p)) <= 8) {
      passo = p;
      break;
    }
  }
  const lo = Math.floor((a - pad) / passo) * passo;
  const n = Math.ceil((b + pad) / passo) - Math.floor((a - pad) / passo);
  const indice = { lo, hi: lo + n * passo, ticks: serie(lo, passo, n), dec: 0 };
  if (!dy.length) return { indice, dy: null };
  const c = Math.min(...dy);
  const d = Math.max(...dy);
  for (const p of PASSOS_DY) {
    const folga = 0.03 * n * p;
    const dlo = Math.max(0, Math.floor(((c + d) / 2 - (n * p) / 2) / p) * p);
    if (dlo <= c - folga && dlo + n * p >= d + folga) {
      return { indice, dy: { lo: dlo, hi: dlo + n * p, ticks: serie(dlo, p, n), dec: p < 0.5 ? 2 : p < 1 ? 1 : 0 } };
    }
  }
  const p = PASSOS_DY[PASSOS_DY.length - 1];
  const dlo = Math.max(0, Math.floor(c / p) * p);
  return { indice, dy: { lo: dlo, hi: dlo + n * p, ticks: serie(dlo, p, n), dec: 0 } };
}

function ValuationCard({ m }: { m: FiiTijoloModeloData }) {
  const { hist, proj } = useMemo(() => montar(m), [m]);
  const [win, setWin] = useState<AzPeriodValue>({ id: "max" });
  const h = m.hoje;
  const c = m.modelo.coef;

  // Simulador: mesmos coeficientes do JSON, partindo dos juros de hoje.
  const [p1, setP1] = useState(h.p1);
  const [r30, setR30] = useState(h.r30);
  const dyCen = c.const + c.p1 * p1 + c.r30 * r30;
  const nivel = dyCen > 0.5 ? (h.preco * h.dy) / dyCen : null;
  const varHoje = nivel != null ? (nivel / h.preco - 1) * 100 : null;
  const mexeu = Math.abs(p1 - h.p1) > 0.02 || Math.abs(r30 - h.r30) > 0.02;

  const dMin = hist[0]?.date;
  const dMax = hist[hist.length - 1]?.date;
  const vis = useMemo(() => {
    if (!hist.length) return [];
    const { from, to } = resolvePeriodRange(win, hist[0].date, hist[hist.length - 1].date);
    const v = hist.filter((r) => r.date >= from && r.date <= to);
    return v.length && v[v.length - 1].date === hist[hist.length - 1].date ? [...v, ...proj] : v;
  }, [hist, proj, win]);
  const temProj = vis.some((r) => r.projetado);
  const tHoje = hist.length ? hist[hist.length - 1].t : 0;
  const tFim = vis.length ? vis[vis.length - 1].t : 0;
  // A barra do cenário ocupa a área da projeção: onde o índice estaria com esses juros.
  const barra = temProj && nivel != null;
  const span = vis.length > 1 ? Math.max(1, diffDaysUTC(vis[0].date, vis[vis.length - 1].date)) : 1;
  const xTicks = useMemo(
    () => buildTimeTicks(vis.map((r) => r.date), span).map((iso) => parseIsoUTC(iso)).filter((t) => Number.isFinite(t)),
    [vis, span],
  );
  const xDomain: [number, number] = vis.length ? [vis[0].t, vis[vis.length - 1].t] : [0, 1];
  const esc = useMemo(() => {
    const finito = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);
    const ind = vis
      .flatMap((r) => [r.preco, r.just, r.proj_just ?? null, r.faixa?.[0] ?? null, r.faixa?.[1] ?? null])
      .filter(finito);
    if (barra && nivel != null) ind.push(nivel);
    const dy = vis.flatMap((r) => [r.dy, r.dy_just, r.proj_dy ?? null]).filter(finito);
    if (barra) dy.push(dyCen);
    return escalas(ind, dy);
  }, [vis, barra, nivel, dyCen]);
  const pj = m.projecao;
  const pFim = pj?.pontos[pj.pontos.length - 1];
  const rg = m.indice.regras;

  return (
    <article className="rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm md:p-5">
      <header className="flex flex-wrap items-start justify-between gap-2 pb-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Índice de FIIs de tijolo × onde deveria estar pelos juros ({fmtMesCurto(h.date)})
            <MethodInfo className="ml-1.5 align-middle">
              <strong>Índice de tijolo (AZ).</strong> Cotas de FII negociadas na B3 com informe mensal na CVM. Entra o
              fundo com pelo menos {fmtNum(rg.limiar_tijolo * 100, 0)}% dos investimentos (fora o caixa) em imóveis de
              renda, na média dos {rg.janela_classificacao_meses ?? 3} últimos informes; ficam de fora fundos de papel
              (CRI), fundos de fundos e de desenvolvimento para venda. Liquidez: negociado em{" "}
              {fmtNum(rg.presenca * 100, 0)}% dos pregões dos {rg.janela_liquidez_meses} meses anteriores e dentro do
              grupo que soma {fmtNum(rg.corte_negociabilidade * 100, 0)}% da negociabilidade (negócios × volume). Peso
              pelo valor de mercado, com teto de {fmtNum(rg.teto * 100, 0)}% por fundo; rebalanceamento mensal. Índice
              de preço, base 1.000 em {fmtMesCurto(m.indice.base)} (primeiro mês com informe da CVM para todos os
              fundos).
              <br />
              <br />
              <strong>Onde deveria estar.</strong> O rendimento de 12 meses sobre o preço (DY) do índice é explicado
              pelos juros: DY = {fmtNum(c.const, 2)} + {fmtNum(c.p1, 2)} × juro de 1 ano + {fmtNum(c.r30, 2)} × NTN-B de
              30 anos (R² {fmtNum(m.modelo.r2, 2)}, {fmtMesCurto(m.modelo.inicio)}–{fmtMesCurto(m.modelo.fim)}). O juro
              de 1 ano é o que o CDI deve pagar nos próximos 12 meses (curva prefixada); a NTN-B de 30 anos é o juro
              real do Tesouro IPCA+ mais longo, o ativo mais parecido com um imóvel de renda. Como DY = rendimento ÷
              preço, o índice justificado é o índice × DY do índice ÷ DY pelos juros; os dois DY ficam ao fundo, no
              eixo da direita. A faixa é ±1 desvio do modelo.
              <br />
              <br />
              <strong>Projeção.</strong> Só a Selic implícita do Panorama se move: o juro de 1 ano de cada mês segue a
              média da Selic implícita nos 12 meses seguintes; NTN-B e rendimentos ficam no nível de hoje. Fontes: B3
              (cotações), CVM (informe mensal), curvas do site (juros). Não é recomendação.
            </MethodInfo>
          </h3>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Índice de preço, base 1.000 em {fmtMesCurto(m.indice.base)} · {h.n} fundos hoje
          </p>
        </div>
        <AzPeriodSelector value={win} onChange={setWin} min={dMin} max={dMax} periods={["1y", "5y", "max"]} />
      </header>

      {m.avisos.length ? (
        <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          {m.avisos.join(" ")}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-2 text-[11px] text-zinc-600">
            <span className="inline-flex items-center gap-1.5">
              <Amostra cor={COR.indice} />
              Índice <strong className="tabular-nums text-[#132960]">{pts(h.preco)}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Amostra cor={COR.just} />
              Onde deveria estar <strong className="tabular-nums text-[#132960]">{pts(h.just)}</strong>
              <span className="tabular-nums">({fmtSignedNum((h.just / h.preco - 1) * 100, 1)}%)</span>
            </span>
            {temProj && pFim ? (
              <span className="inline-flex items-center gap-1.5">
                <Amostra cor={COR.just} pontilhado />
                Pela Selic implícita · {fmtMesCurto(pFim.date)}{" "}
                <strong className="tabular-nums text-[#132960]">{pts(pFim.just)}</strong>
              </span>
            ) : null}
            {barra ? (
              <span className="inline-flex items-center gap-1.5">
                <Amostra cor={COR.just} barra />
                Cenário do simulador <strong className="tabular-nums text-[#132960]">{pts(nivel)}</strong>
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5 text-zinc-500">
              <span aria-hidden className="inline-block h-2.5 w-3 rounded-sm" style={{ backgroundColor: "rgba(2,125,252,0.14)" }} />
              ±1 desvio do modelo
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-2 text-[11px] text-zinc-600">
            <span className="font-semibold uppercase tracking-wide text-zinc-500">DY 12 meses · eixo da direita</span>
            <span className="inline-flex items-center gap-1.5">
              <Amostra cor={COR.dy} tracejado opacidade={OPAC_DY} />
              Do índice <strong className="tabular-nums text-[#132960]">{taxa(h.dy)}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Amostra cor={COR.dy} tracejado opacidade={OPAC_DY_JUST} />
              Pelos juros <strong className="tabular-nums text-[#132960]">{taxa(h.dy_just)}</strong>
            </span>
            {temProj && pFim ? (
              <span className="inline-flex items-center gap-1.5">
                <Amostra cor={COR.dy} pontilhado opacidade={OPAC_DY_JUST} />
                Pela Selic implícita <strong className="tabular-nums text-[#132960]">{taxa(pFim.dy_just)}</strong>
              </span>
            ) : null}
          </div>

          <div style={{ height: 380 }} className="w-full">
            {vis.length < 2 || !esc ? (
              <div className="flex h-full items-center justify-center text-xs italic text-zinc-400">sem dados na janela</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={vis} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
                  <CartesianGrid {...azGridProps()} />
                  <XAxis
                    {...azXAxisProps()}
                    dataKey="t"
                    type="number"
                    scale="time"
                    domain={xDomain}
                    ticks={xTicks.length ? xTicks : undefined}
                    tickFormatter={(t) => formatTimeTickLabel(isoFromUTC(Number(t)), span)}
                    minTickGap={28}
                  />
                  <YAxis
                    {...azYAxisProps()}
                    domain={[esc.indice.lo, esc.indice.hi]}
                    ticks={esc.indice.ticks}
                    interval={0}
                    allowDataOverflow
                    width={48}
                    tickFormatter={(v) => fmtNum(Number(v), 0)}
                  />
                  {/* Exceção pedida pelo dono (08/10/2026) à regra de um eixo Y: o DY fica ao fundo, no
                      eixo da direita, com as mesmas faixas do índice (ver escalas()). */}
                  {esc.dy ? (
                    <YAxis
                      {...azYAxisProps()}
                      yAxisId="dy"
                      orientation="right"
                      domain={[esc.dy.lo, esc.dy.hi]}
                      ticks={esc.dy.ticks}
                      interval={0}
                      allowDataOverflow
                      width={44}
                      tick={{ ...azYAxisProps().tick, fill: COR.dy }}
                      tickFormatter={(v) => `${fmtNum(Number(v), esc.dy?.dec ?? 0)}%`}
                    />
                  ) : null}
                  {temProj ? (
                    <ReferenceArea
                      x1={tHoje}
                      x2={tFim}
                      fill={AZ_BRAND.navy}
                      fillOpacity={0.05}
                      ifOverflow="hidden"
                      label={{ value: "projeção", position: "insideTop", fontSize: 10, fill: AZ_CHART.ticks }}
                    />
                  ) : null}
                  <Tooltip content={<TooltipJust />} cursor={{ stroke: AZ_BRAND.navy, strokeOpacity: 0.25 }} />

                  {/* Fundo: DY 12 meses, eixo da direita */}
                  {esc.dy ? (
                    <Line
                      yAxisId="dy"
                      type="linear"
                      dataKey="dy_just"
                      stroke={COR.dy}
                      strokeOpacity={OPAC_DY_JUST}
                      strokeWidth={1.6}
                      strokeDasharray="6 4"
                      dot={false}
                      activeDot={false}
                      isAnimationActive={false}
                    />
                  ) : null}
                  {esc.dy && temProj ? (
                    <Line
                      yAxisId="dy"
                      type="linear"
                      dataKey="proj_dy"
                      stroke={COR.dy}
                      strokeOpacity={OPAC_DY_JUST}
                      strokeWidth={1.8}
                      strokeDasharray="2 3"
                      dot={false}
                      activeDot={false}
                      isAnimationActive={false}
                    />
                  ) : null}
                  {esc.dy ? (
                    <Line
                      yAxisId="dy"
                      type="linear"
                      dataKey="dy"
                      stroke={COR.dy}
                      strokeOpacity={OPAC_DY}
                      strokeWidth={1.6}
                      strokeDasharray="6 4"
                      dot={false}
                      activeDot={false}
                      isAnimationActive={false}
                    />
                  ) : null}
                  {esc.dy && barra ? (
                    <ReferenceLine
                      yAxisId="dy"
                      segment={[
                        { x: tHoje, y: dyCen },
                        { x: tFim, y: dyCen },
                      ]}
                      stroke={COR.dy}
                      strokeOpacity={OPAC_DY}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                    />
                  ) : null}

                  {/* Frente: índice e onde deveria estar, eixo da esquerda */}
                  <Area
                    type="linear"
                    dataKey="faixa"
                    stroke="none"
                    fill={COR.just}
                    fillOpacity={0.12}
                    isAnimationActive={false}
                    activeDot={false}
                  />
                  {temProj ? (
                    <Line
                      type="linear"
                      dataKey="proj_just"
                      stroke={COR.just}
                      strokeWidth={2}
                      strokeDasharray="2 3"
                      dot={false}
                      isAnimationActive={false}
                    />
                  ) : null}
                  <Line type="linear" dataKey="just" stroke={COR.just} strokeWidth={1.8} dot={false} isAnimationActive={false} />
                  <Line type="linear" dataKey="preco" stroke={COR.indice} strokeWidth={2.2} dot={false} isAnimationActive={false} />
                  {barra && nivel != null ? (
                    <ReferenceLine
                      segment={[
                        { x: tHoje, y: nivel },
                        { x: tFim, y: nivel },
                      ]}
                      stroke={COR.just}
                      strokeWidth={3}
                      strokeLinecap="round"
                    />
                  ) : null}
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <aside className="border-t border-[#132960]/10 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Simulador de cenário
            <MethodInfo className="ml-1.5 align-middle">
              Mesmo modelo do gráfico: DY pelos juros = {fmtNum(c.const, 2)} + {fmtNum(c.p1, 2)} × juro de 1 ano +{" "}
              {fmtNum(c.r30, 2)} × NTN-B de 30 anos. O índice no cenário é o índice de hoje × DY de hoje ÷ DY pelos
              juros, com os rendimentos parados; a barra no gráfico marca esse nível na área da projeção. Cada +0,1
              ponto no juro de 1 ano tira {fmtNum(Math.abs(m.modelo.efeito_01.p1), 2)}% do índice justificado; na NTN-B
              de 30 anos, {fmtNum(Math.abs(m.modelo.efeito_01.r30), 2)}%. Não é recomendação.
            </MethodInfo>
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-500">Mova os juros e acompanhe a barra no gráfico</p>

          <div className="mt-4 space-y-5">
            <Controle
              rotulo="Juro de 1 ano"
              ajuda="CDI dos próximos 12 meses"
              valor={p1}
              hoje={h.p1}
              min={4}
              max={20}
              onChange={setP1}
            />
            <Controle
              rotulo="NTN-B 30 anos"
              ajuda="juro real do IPCA+ longo"
              valor={r30}
              hoje={h.r30}
              min={2}
              max={10}
              onChange={setR30}
            />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-zinc-50 p-3">
            <div>
              <p className="text-[11px] text-zinc-500">Índice</p>
              <p className="text-xl font-semibold tabular-nums text-[#132960]">{pts(nivel)}</p>
              <p className="text-[11px] tabular-nums text-zinc-500">
                {varHoje != null ? `${fmtSignedNum(varHoje, 1)}% sobre hoje` : "—"}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-zinc-500">DY pelos juros</p>
              <p className="text-xl font-semibold tabular-nums text-[#132960]">{taxa(dyCen)}</p>
              <p className="text-[11px] tabular-nums text-zinc-500">hoje {taxa(h.dy)}</p>
            </div>
          </div>
          <button
            type="button"
            disabled={!mexeu}
            onClick={() => {
              setP1(h.p1);
              setR30(h.r30);
            }}
            className="mt-3 rounded-full border border-[#132960]/20 bg-white px-3 py-1 text-[11px] font-semibold text-[#132960] transition hover:border-[#132960]/40 hover:bg-zinc-50 disabled:cursor-default disabled:opacity-40"
          >
            Voltar aos juros de hoje
          </button>
        </aside>
      </div>

      <p className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-400">
        <span>
          Modelo estimado com dados até {fmtMesCurto(m.modelo.fim)} · VP e rendimentos até{" "}
          {fmtMesCurto(m.cvm_ate)} (informe da CVM)
          {temProj && pj && pFim
            ? ` · projeção: Selic implícita de ${taxa(pj.pontos[0].selic)} a ${taxa(pFim.selic)}, NTN-B e rendimentos parados`
            : ""}{" "}
          · não é recomendação
        </span>
        <DataStamp giro={m.generated_at} dado={m.last_data_date} />
      </p>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Visão geral: índice de tijolo ajustado pelo rendimento × IFIX
// ---------------------------------------------------------------------------

/**
 * Índice de tijolo (AZ) com os rendimentos reinvestidos contra o IFIX, em variação acumulada
 * na janela. Fica na aba Visão geral da página de FIIs.
 */
export function TijoloIfixCard({ modelo: m }: { modelo: FiiTijoloModeloData }) {
  const rows = useMemo(
    () => m.serie.filter((r) => r.retorno_total != null).map((r) => ({ ...r, t: parseIsoUTC(r.date) })),
    [m],
  );
  const [win, setWin] = useState<AzPeriodValue>({ id: "max" });
  const vis = useMemo(() => {
    if (!rows.length) return [];
    const { from, to } = resolvePeriodRange(win, rows[0].date, rows[rows.length - 1].date);
    const v = rows.filter((r) => r.date >= from && r.date <= to);
    if (!v.length) return [];
    const b0 = v[0];
    const varia = (x: number | null, b: number | null) => (x != null && b ? (x / b - 1) * 100 : null);
    return v.map((r) => ({ ...r, v_tr: varia(r.retorno_total, b0.retorno_total), v_ifix: varia(r.ifix, b0.ifix) }));
  }, [rows, win]);
  const ult = vis[vis.length - 1];
  const span = vis.length > 1 ? Math.max(1, diffDaysUTC(vis[0].date, vis[vis.length - 1].date)) : 1;
  const xTicks = useMemo(
    () => buildTimeTicks(vis.map((r) => r.date), span).map((iso) => parseIsoUTC(iso)).filter((t) => Number.isFinite(t)),
    [vis, span],
  );
  const pct = (v: number | null | undefined) => (v != null ? `${fmtSignedNum(v, 1)}%` : "—");

  return (
    <article className="rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm md:p-5">
      <header className="flex flex-wrap items-start justify-between gap-2 pb-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Índice de FIIs de tijolo × IFIX ({fmtMesCurto(m.hoje.date)})
            <MethodInfo className="ml-1.5 align-middle">
              Índice próprio da AZ com os FIIs de tijolo mais negociados ({m.hoje.n} fundos hoje; regras e modelo na aba
              Analítico), com os rendimentos e amortizações de cada mês reinvestidos, como no IFIX — que reúne todos os
              FIIs do índice da B3 (tijolo, papel e fundos de fundos). Variação acumulada desde o início da janela.
              Fontes: B3 e CVM.
            </MethodInfo>
          </h3>
          <p className="mt-0.5 text-[11px] text-zinc-500">Ajustado pelo rendimento · variação acumulada na janela</p>
        </div>
        <AzPeriodSelector
          value={win}
          onChange={setWin}
          min={rows[0]?.date}
          max={rows[rows.length - 1]?.date}
          periods={["1y", "5y", "max"]}
        />
      </header>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-2 text-[11px] text-zinc-600">
        <span className="inline-flex items-center gap-1.5">
          <Amostra cor={COR.indice} />
          Tijolo (AZ) <strong className="tabular-nums text-[#132960]">{pct(ult?.v_tr)}</strong>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Amostra cor={COR.ifix} />
          IFIX <strong className="tabular-nums text-[#132960]">{pct(ult?.v_ifix)}</strong>
        </span>
      </div>
      <div style={{ height: 260 }} className="w-full">
        {vis.length < 2 ? (
          <div className="flex h-full items-center justify-center text-xs italic text-zinc-400">sem dados na janela</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={vis} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid {...azGridProps()} />
              <XAxis
                {...azXAxisProps()}
                dataKey="t"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                ticks={xTicks.length ? xTicks : undefined}
                tickFormatter={(t) => formatTimeTickLabel(isoFromUTC(Number(t)), span)}
                minTickGap={28}
              />
              <YAxis {...azYAxisProps()} width={44} tickFormatter={(v) => `${fmtNum(Number(v), 0)}%`} />
              <ReferenceLine y={0} stroke={AZ_CHART.ticks} strokeOpacity={0.6} />
              <Tooltip
                cursor={{ stroke: AZ_BRAND.navy, strokeOpacity: 0.25 }}
                content={({ active, payload }) => {
                  const r = active && payload?.[0]?.payload ? (payload[0].payload as (typeof vis)[number]) : null;
                  if (!r) return null;
                  return (
                    <div style={caixaTooltip}>
                      <p style={{ color: "#94A3B8", fontWeight: 600, margin: "0 0 4px" }}>
                        {r.parcial ? fmtDataBR(r.date) : fmtMesCurto(r.date)}
                      </p>
                      <Item nome="Tijolo (AZ)" valor={pct(r.v_tr)} cor={COR.indice} />
                      <Item nome="IFIX" valor={pct(r.v_ifix)} cor={COR.ifix} />
                    </div>
                  );
                }}
              />
              <Line type="linear" dataKey="v_ifix" stroke={COR.ifix} strokeWidth={1.8} dot={false} isAnimationActive={false} />
              <Line type="linear" dataKey="v_tr" stroke={COR.indice} strokeWidth={2.2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      <p className="flex justify-end pt-2">
        <DataStamp giro={m.generated_at} dado={m.last_data_date} />
      </p>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Composição
// ---------------------------------------------------------------------------

function Composicao({ m }: { m: FiiTijoloModeloData }) {
  const metade = Math.ceil(m.composicao.length / 2);
  const colunas = [m.composicao.slice(0, metade), m.composicao.slice(metade)];
  return (
    <article className="rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm md:p-5">
      <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
        {colunas.map((col, i) => (
          <table key={i} className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#132960]/10 text-left text-[10px] uppercase tracking-wide text-zinc-500">
                <th className="py-1.5 font-semibold">Fundo</th>
                <th className="py-1.5 text-right font-semibold">Peso</th>
                <th className="py-1.5 text-right font-semibold">P/VP</th>
                <th className="py-1.5 text-right font-semibold">DY 12m</th>
              </tr>
            </thead>
            <tbody>
              {col.map((r) => (
                <tr key={r.ticker} className="border-b border-[#132960]/5">
                  <td className="py-1 font-semibold text-[#132960]">{r.ticker}</td>
                  <td className="py-1 text-right tabular-nums">{r.peso != null ? `${fmtNum(r.peso, 1)}%` : "—"}</td>
                  <td className="py-1 text-right tabular-nums">{r.pvp != null ? fmtNum(r.pvp, 2) : "—"}</td>
                  <td className="py-1 text-right tabular-nums">{r.dy != null ? `${fmtNum(r.dy, 1)}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-zinc-400">
        Composição de {fmtMesCurto(m.hoje.date)} · P/VP com o VP do último informe da CVM ({fmtMesCurto(m.cvm_ate)})
      </p>
    </article>
  );
}

/**
 * Aba Analítico dos FIIs: índice de tijolo (AZ) contra onde ele deveria estar pelos juros
 * (modelo de build_fii_tijolo_modelo.py), com o DY embaixo, a projeção pela Selic implícita,
 * o simulador de cenário ao lado e a composição. A comparação com o IFIX fica na Visão geral
 * (TijoloIfixCard).
 */
export function FiiTijoloModelo({ modelo }: { modelo: FiiTijoloModeloData }) {
  const [verComp, setVerComp] = useState(false);
  return (
    <div className="space-y-4">
      <Divisor
        label="Valuation — FIIs de tijolo × juros"
        info="Um índice próprio dos FIIs de tijolo e o nível que os juros justificam para ele. Abaixo do justificado, os fundos estão mais baratos do que os juros explicam; acima, mais caros. Com os juros parados, o índice tende a chegar ao justificado em cerca de um ano."
      />
      <ValuationCard m={modelo} />
      <Divisor
        label={`Composição do índice — ${modelo.hoje.n} fundos`}
        right={
          <button
            type="button"
            onClick={() => setVerComp((v) => !v)}
            aria-expanded={verComp}
            className="rounded-full border border-[#132960]/20 bg-white px-3 py-1 text-[11px] font-semibold text-[#132960] transition hover:border-[#132960]/40 hover:bg-zinc-50"
          >
            {verComp ? "Ocultar composição" : "Ver composição"}
          </button>
        }
      />
      {verComp ? <Composicao m={modelo} /> : null}
    </div>
  );
}
