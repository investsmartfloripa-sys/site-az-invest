"use client";

import { useMemo, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
  ajustado: AZ_BRAND.azure,
  ifix: AZ_CHART.ticks,
  sobe: AZ_BRAND.azure,
  desce: AZ_BRAND.rust,
} as const;

const pts = (v: number | null | undefined, dec = 0) => (v != null ? fmtNum(v, dec) : "—");
const taxa = (v: number | null | undefined) => (v != null ? `${fmtNum(v, 2)}%` : "—");

function Amostra({ cor, tracejado, pontilhado }: { cor: string; tracejado?: boolean; pontilhado?: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-block h-0.5 w-4 align-middle"
      style={
        pontilhado
          ? { backgroundImage: `repeating-linear-gradient(90deg, ${cor} 0 2px, transparent 2px 5px)` }
          : tracejado
            ? { backgroundImage: `repeating-linear-gradient(90deg, ${cor} 0 5px, transparent 5px 8px)` }
            : { backgroundColor: cor }
      }
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
// Gráfico principal: índice × onde deveria estar pelos juros + projeção
// ---------------------------------------------------------------------------

type Linha = FiiTijoloRow & {
  t: number;
  faixa: [number, number] | null;
  distancia: number | null;
  projetado?: boolean;
  proj_just?: number | null;
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
        Object.assign(ult, { proj_just: p.just, proj_selic: p.selic, proj_p1: p.p1 });
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
        dy_just: p.dy_just,
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
      {r.distancia != null ? (
        <p style={{ margin: "4px 0 0", color: "#C7D2E8" }}>
          {r.distancia >= 0 ? "Abaixo" : "Acima"} do justificado em{" "}
          <strong style={{ color: "#fff" }}>{fmtNum(Math.abs(r.distancia), 1)}%</strong>
        </p>
      ) : null}
      <p style={{ margin: "2px 0 0", color: "#C7D2E8" }}>
        DY {taxa(r.dy)} · justificado {taxa(r.dy_just)} · {r.n} fundos
      </p>
      <p style={{ margin: "2px 0 0", color: "#C7D2E8" }}>
        Juro de 1 ano {taxa(r.p1)} · NTN-B 30 anos {taxa(r.r30)}
      </p>
    </div>
  );
}

function JustificadoCard({ m }: { m: FiiTijoloModeloData }) {
  const { hist, proj } = useMemo(() => montar(m), [m]);
  const [win, setWin] = useState<AzPeriodValue>({ id: "max" });
  const dMin = hist[0]?.date;
  const dMax = hist[hist.length - 1]?.date;
  const vis = useMemo(() => {
    if (!hist.length) return [];
    const { from, to } = resolvePeriodRange(win, hist[0].date, hist[hist.length - 1].date);
    const h = hist.filter((r) => r.date >= from && r.date <= to);
    return h.length && h[h.length - 1].date === hist[hist.length - 1].date ? [...h, ...proj] : h;
  }, [hist, proj, win]);
  const visHist = useMemo(() => vis.filter((r) => !r.projetado), [vis]);
  const temProj = vis.some((r) => r.projetado);
  const span = vis.length > 1 ? Math.max(1, diffDaysUTC(vis[0].date, vis[vis.length - 1].date)) : 1;
  const xTicks = useMemo(
    () => buildTimeTicks(vis.map((r) => r.date), span).map((iso) => parseIsoUTC(iso)).filter((t) => Number.isFinite(t)),
    [vis, span],
  );
  const xDomain: [number, number] = vis.length ? [vis[0].t, vis[vis.length - 1].t] : [0, 1];
  const [lo, hi] = useMemo(() => {
    const vals = vis
      .flatMap((r) => [r.preco, r.just, r.proj_just ?? null, r.faixa?.[0] ?? null, r.faixa?.[1] ?? null])
      .filter((v): v is number => v != null && Number.isFinite(v));
    if (!vals.length) return [0, 1];
    const a = Math.min(...vals);
    const b = Math.max(...vals);
    const pad = (b - a) * 0.06 || 10;
    return [Math.floor((a - pad) / 50) * 50, Math.ceil((b + pad) / 50) * 50];
  }, [vis]);
  const h = m.hoje;
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
              renda, na média dos {rg.janela_classificacao_meses ?? 3} últimos informes; ficam de fora fundos de papel (CRI), fundos de fundos e de
              desenvolvimento para venda. Liquidez: negociado em {fmtNum(rg.presenca * 100, 0)}% dos pregões dos{" "}
              {rg.janela_liquidez_meses} meses anteriores e dentro do grupo que soma{" "}
              {fmtNum(rg.corte_negociabilidade * 100, 0)}% da negociabilidade (negócios × volume). Peso pelo valor de
              mercado, com teto de {fmtNum(rg.teto * 100, 0)}% por fundo; rebalanceamento mensal. Índice de preço, base
              1.000 em {fmtMesCurto(m.indice.base)} (primeiro mês com informe da CVM para todos os fundos).
              <br />
              <br />
              <strong>Onde deveria estar.</strong> O rendimento de 12 meses sobre o preço (DY) do índice é explicado
              pelos juros: DY = {fmtNum(m.modelo.coef.const, 2)} + {fmtNum(m.modelo.coef.p1, 2)} × juro de 1 ano +{" "}
              {fmtNum(m.modelo.coef.r30, 2)} × NTN-B de 30 anos (R² {fmtNum(m.modelo.r2, 2)},{" "}
              {fmtMesCurto(m.modelo.inicio)}–{fmtMesCurto(m.modelo.fim)}). O juro de 1 ano é o que o CDI deve pagar nos
              próximos 12 meses (curva prefixada); a NTN-B de 30 anos é o juro real do Tesouro IPCA+ mais longo, o
              ativo mais parecido com um imóvel de renda. Como DY = rendimento ÷ preço, o índice justificado é o índice
              × DY observado ÷ DY justificado. A faixa é ±1 desvio do modelo.
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
        <span className="inline-flex items-center gap-1.5 text-zinc-500">
          <span aria-hidden className="inline-block h-2.5 w-3 rounded-sm" style={{ backgroundColor: "rgba(2,125,252,0.14)" }} />
          ±1 desvio do modelo
        </span>
      </div>

      {m.avisos.length ? (
        <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          {m.avisos.join(" ")}
        </p>
      ) : null}

      <div style={{ height: 300 }} className="w-full">
        {vis.length < 2 ? (
          <div className="flex h-full items-center justify-center text-xs italic text-zinc-400">sem dados na janela</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={vis} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
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
                domain={[lo, hi]}
                allowDataOverflow
                width={48}
                tickFormatter={(v) => fmtNum(Number(v), 0)}
              />
              {temProj ? (
                <ReferenceArea
                  x1={hist[hist.length - 1].t}
                  x2={vis[vis.length - 1].t}
                  fill={AZ_BRAND.navy}
                  fillOpacity={0.05}
                  ifOverflow="hidden"
                  label={{ value: "projeção", position: "insideTop", fontSize: 10, fill: AZ_CHART.ticks }}
                />
              ) : null}
              <Tooltip content={<TooltipJust />} cursor={{ stroke: AZ_BRAND.navy, strokeOpacity: 0.25 }} />
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
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        Distância até onde deveria estar
        <span className="ml-1 font-normal normal-case tracking-normal text-zinc-400">
          (acima de zero: índice abaixo do justificado)
        </span>
      </p>
      <div style={{ height: 110 }} className="w-full">
        {visHist.length >= 2 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={visHist} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
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
              <YAxis {...azYAxisProps()} width={48} tickFormatter={(v) => `${fmtNum(Number(v), 0)}%`} />
              <ReferenceLine y={0} stroke={AZ_CHART.ticks} strokeOpacity={0.6} />
              <Tooltip
                cursor={{ fill: AZ_BRAND.navy, fillOpacity: 0.05 }}
                content={({ active, payload }) => {
                  const r = active && payload?.[0]?.payload ? (payload[0].payload as Linha) : null;
                  if (!r || r.distancia == null) return null;
                  return (
                    <div style={caixaTooltip}>
                      <p style={{ color: "#94A3B8", fontWeight: 600, margin: "0 0 4px" }}>
                        {r.parcial ? fmtDataBR(r.date) : fmtMesCurto(r.date)}
                      </p>
                      <p style={{ margin: 0 }}>
                        {r.distancia >= 0 ? "Abaixo" : "Acima"} do justificado em{" "}
                        <strong>{fmtNum(Math.abs(r.distancia), 1)}%</strong>
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="distancia" isAnimationActive={false} maxBarSize={10}>
                {visHist.map((r) => (
                  <Cell key={r.mes} fill={(r.distancia ?? 0) >= 0 ? COR.sobe : COR.desce} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : null}
      </div>

      <p className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-400">
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
// Simulador de cenário: se o juro de 1 ano e a NTN-B forem para X, o índice vai para Y
// ---------------------------------------------------------------------------

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
      <span className="flex items-baseline justify-between gap-2 text-xs text-zinc-600">
        <span className="font-semibold text-[#132960]">{rotulo}</span>
        <span className="tabular-nums">
          <strong className="text-sm text-[#132960]">{fmtNum(valor, 2)}%</strong>
          <span className="ml-1 text-zinc-400">(hoje {fmtNum(hoje, 2)}%)</span>
        </span>
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
      <span className="flex justify-between text-[10px] text-zinc-400">
        <span>{fmtNum(min, 0)}%</span>
        <span>{ajuda}</span>
        <span>{fmtNum(max, 0)}%</span>
      </span>
    </label>
  );
}

function SimuladorCard({ m }: { m: FiiTijoloModeloData }) {
  const h = m.hoje;
  const c = m.modelo.coef;
  const [p1, setP1] = useState(h.p1);
  const [r30, setR30] = useState(h.r30);
  const dyJust = c.const + c.p1 * p1 + c.r30 * r30;
  const nivel = dyJust > 0.5 ? (h.preco * h.dy) / dyJust : null;
  const varHoje = nivel != null ? (nivel / h.preco - 1) * 100 : null;
  const mexeu = Math.abs(p1 - h.p1) > 0.02 || Math.abs(r30 - h.r30) > 0.02;

  return (
    <article className="rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm md:p-5">
      <header className="pb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Simulador de cenário ({fmtMesCurto(h.date)})
          <MethodInfo className="ml-1.5 align-middle">
            Mesmo modelo do gráfico ao lado: DY justificado = {fmtNum(c.const, 2)} + {fmtNum(c.p1, 2)} × juro de 1 ano +{" "}
            {fmtNum(c.r30, 2)} × NTN-B de 30 anos. O índice justificado é o índice de hoje × DY de hoje ÷ DY
            justificado, com os rendimentos parados. Cada +0,1 ponto no juro de 1 ano tira{" "}
            {fmtNum(Math.abs(m.modelo.efeito_01.p1), 2)}% do justificado; na NTN-B de 30 anos,{" "}
            {fmtNum(Math.abs(m.modelo.efeito_01.r30), 2)}%. Não é recomendação.
          </MethodInfo>
        </h3>
        <p className="mt-0.5 text-[11px] text-zinc-500">Mova os juros e veja onde o índice deveria estar</p>
      </header>

      <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <Controle
          rotulo="Juro de 1 ano"
          ajuda="o que o CDI deve pagar nos próximos 12 meses"
          valor={p1}
          hoje={h.p1}
          min={4}
          max={20}
          onChange={setP1}
        />
        <Controle
          rotulo="NTN-B 30 anos (juro real)"
          ajuda="Tesouro IPCA+ longo"
          valor={r30}
          hoje={h.r30}
          min={2}
          max={10}
          onChange={setR30}
        />
      </div>

      <div>
      <div className="grid grid-cols-2 gap-3 rounded-xl bg-zinc-50 p-3">
        <div>
          <p className="text-[11px] text-zinc-500">Índice deveria estar em</p>
          <p className="text-xl font-semibold tabular-nums text-[#132960]">{nivel != null ? fmtNum(nivel, 0) : "—"}</p>
          <p className="text-[11px] tabular-nums text-zinc-500">
            {varHoje != null ? `${fmtSignedNum(varHoje, 1)}% sobre o índice de hoje (${fmtNum(h.preco, 0)})` : "—"}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-zinc-500">DY justificado</p>
          <p className="text-xl font-semibold tabular-nums text-[#132960]">{fmtNum(dyJust, 2)}%</p>
          <p className="text-[11px] tabular-nums text-zinc-500">DY de hoje {fmtNum(h.dy, 2)}%</p>
        </div>
      </div>
      <div className="pt-3">
        <button
          type="button"
          disabled={!mexeu}
          onClick={() => {
            setP1(h.p1);
            setR30(h.r30);
          }}
          className="rounded-full border border-[#132960]/20 bg-white px-3 py-1 text-[11px] font-semibold text-[#132960] transition hover:border-[#132960]/40 hover:bg-zinc-50 disabled:cursor-default disabled:opacity-40"
        >
          Voltar aos juros de hoje
        </button>
      </div>
      </div>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Índice de tijolo × IFIX (variação acumulada na janela)
// ---------------------------------------------------------------------------

function IfixCard({ m }: { m: FiiTijoloModeloData }) {
  const rows = useMemo(() => m.serie.filter((r) => r.preco != null).map((r) => ({ ...r, t: parseIsoUTC(r.date) })), [m]);
  const [win, setWin] = useState<AzPeriodValue>({ id: "max" });
  const vis = useMemo(() => {
    if (!rows.length) return [];
    const { from, to } = resolvePeriodRange(win, rows[0].date, rows[rows.length - 1].date);
    const h = rows.filter((r) => r.date >= from && r.date <= to);
    if (!h.length) return [];
    const b0 = h[0];
    const v = (x: number | null, b: number | null) => (x != null && b ? (x / b - 1) * 100 : null);
    return h.map((r) => ({
      ...r,
      v_preco: v(r.preco, b0.preco),
      v_tr: v(r.retorno_total, b0.retorno_total),
      v_ifix: v(r.ifix, b0.ifix),
    }));
  }, [rows, win]);
  const ult = vis[vis.length - 1];
  const span = vis.length > 1 ? Math.max(1, diffDaysUTC(vis[0].date, vis[vis.length - 1].date)) : 1;
  const xTicks = useMemo(
    () => buildTimeTicks(vis.map((r) => r.date), span).map((iso) => parseIsoUTC(iso)).filter((t) => Number.isFinite(t)),
    [vis, span],
  );

  return (
    <article className="rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm md:p-5">
      <header className="flex flex-wrap items-start justify-between gap-2 pb-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Índice de tijolo × IFIX ({fmtMesCurto(m.hoje.date)})
            <MethodInfo className="ml-1.5 align-middle">
              Variação acumulada desde o início da janela. O índice de tijolo é de preço; a versão ajustada pelo
              rendimento reinveste os rendimentos e amortizações de cada mês, como o IFIX, que inclui todos os FIIs
              do índice da B3 (tijolo, papel e fundos de fundos). Fontes: B3 e CVM.
            </MethodInfo>
          </h3>
          <p className="mt-0.5 text-[11px] text-zinc-500">Variação acumulada na janela</p>
        </div>
        <AzPeriodSelector value={win} onChange={setWin} min={rows[0]?.date} max={rows[rows.length - 1]?.date} periods={["1y", "5y", "max"]} />
      </header>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-2 text-[11px] text-zinc-600">
        <span className="inline-flex items-center gap-1.5">
          <Amostra cor={COR.indice} />
          Tijolo (preço) <strong className="tabular-nums text-[#132960]">{ult?.v_preco != null ? `${fmtSignedNum(ult.v_preco, 1)}%` : "—"}</strong>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Amostra cor={COR.ajustado} />
          Tijolo ajustado pelo rendimento{" "}
          <strong className="tabular-nums text-[#132960]">{ult?.v_tr != null ? `${fmtSignedNum(ult.v_tr, 1)}%` : "—"}</strong>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Amostra cor={COR.ifix} tracejado />
          IFIX <strong className="tabular-nums text-[#132960]">{ult?.v_ifix != null ? `${fmtSignedNum(ult.v_ifix, 1)}%` : "—"}</strong>
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
                  const f = (v: number | null) => (v != null ? `${fmtSignedNum(v, 1)}%` : "—");
                  return (
                    <div style={caixaTooltip}>
                      <p style={{ color: "#94A3B8", fontWeight: 600, margin: "0 0 4px" }}>
                        {r.parcial ? fmtDataBR(r.date) : fmtMesCurto(r.date)}
                      </p>
                      <Item nome="Tijolo (preço)" valor={f(r.v_preco)} cor={COR.indice} />
                      <Item nome="Tijolo ajustado pelo rendimento" valor={f(r.v_tr)} cor={COR.ajustado} />
                      <Item nome="IFIX" valor={f(r.v_ifix)} cor={COR.ifix} />
                    </div>
                  );
                }}
              />
              <Line type="linear" dataKey="v_ifix" stroke={COR.ifix} strokeWidth={1.6} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
              <Line type="linear" dataKey="v_tr" stroke={COR.ajustado} strokeWidth={1.8} dot={false} isAnimationActive={false} />
              <Line type="linear" dataKey="v_preco" stroke={COR.indice} strokeWidth={2.2} dot={false} isAnimationActive={false} />
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
 * (modelo de build_fii_tijolo_modelo.py), projeção pela Selic implícita, simulador de cenário,
 * comparação com o IFIX e composição.
 */
export function FiiTijoloModelo({ modelo }: { modelo: FiiTijoloModeloData }) {
  const [verComp, setVerComp] = useState(false);
  return (
    <div className="space-y-4">
      <Divisor
        label="Valuation — FIIs de tijolo × juros"
        info="Um índice próprio dos FIIs de tijolo e o nível que os juros justificam para ele. Abaixo do justificado, os fundos estão mais baratos do que os juros explicam; acima, mais caros. Com os juros parados, o índice tende a chegar ao justificado em cerca de um ano."
      />
      <JustificadoCard m={modelo} />
      <SimuladorCard m={modelo} />
      <IfixCard m={modelo} />
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
