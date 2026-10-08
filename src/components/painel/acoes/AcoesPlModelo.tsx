"use client";

import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import DataStamp from "@/components/painel/DataStamp";
import { AcoesPremioNtnb } from "@/components/painel/acoes/AcoesPremioNtnb";
import { PL_CORES, rotuloMes } from "@/components/painel/acoes/plModeloShared";
import { AzPeriodSelector, resolvePeriodRange, type AzPeriodValue } from "@/components/painel/charts";
import { Divisor, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { MethodInfo } from "@/components/painel/core/MethodInfo";
import { AZ_BRAND, AZ_CHART } from "@/lib/az-chart-theme";
import {
  buildTimeTicks,
  diffDaysUTC,
  fmtMesCurto,
  fmtNum,
  fmtSignedNum,
  formatTimeTickLabel,
  isoFromUTC,
  parseIsoUTC,
} from "@/lib/format-br";
import type { AcoesValuationData, IbovPlModeloData, IbovPlModeloRow } from "@/lib/painel-acoes";

/** O P/L fica ao fundo, no eixo da direita, em cinza: traço mais leve que as linhas da frente. */
const COR_PL = "#64748B";
const OPAC_PL = 0.85;
const OPAC_PL_JUST = 0.45;

const pts = (v: number | null | undefined) => (v != null && Number.isFinite(v) ? fmtNum(v, 0) : "—");
const vezes = (v: number | null | undefined) => (v != null && Number.isFinite(v) ? `${fmtNum(v, 1)}x` : "—");
const taxa = (v: number | null | undefined) => (v != null && Number.isFinite(v) ? `${fmtNum(v, 2)}%` : "—");

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
// Ibovespa em pontos × onde deveria estar pelos juros, P/L ao fundo, simulador ao lado
// ---------------------------------------------------------------------------

/** Linha do gráfico: mês do histórico ou mês projetado (proj_*: pelas implícitas do dia ou pelo cenário). */
type Linha = IbovPlModeloRow & {
  t: number;
  faixa: [number, number] | null;
  projetado?: boolean;
  h?: number; // meses desde hoje (projeção)
  base_completo?: number | null; // P/L projetado no JSON (implícitas do dia)
  base_juros?: number | null;
  base_lucro?: number | null; // lucro do índice projetado no JSON (PIB nominal esperado)
  proj_pts?: number | null;
  proj_pts_juros?: number | null;
  proj_pl?: number | null;
  proj_lucro?: number | null;
  proj_selic?: number | null;
  proj_fed?: number | null;
};

/** Histórico + meses projetados. O 1º ponto da projeção é hoje: entra na linha do mês corrente,
 *  para as linhas pontilhadas saírem do justificado de hoje. */
function montar(m: IbovPlModeloData): { hist: Linha[]; proj: Linha[] } {
  const hist: Linha[] = m.serie
    .filter((r) => r.ibov != null)
    .map((r) => ({
      ...r,
      t: parseIsoUTC(r.date),
      faixa: r.pts_lo != null && r.pts_hi != null ? [r.pts_lo, r.pts_hi] : null,
    }));
  const pj = m.projecao?.pontos ?? [];
  const proj: Linha[] = [];
  if (pj.length < 2 || !hist.length) return { hist, proj };
  const vazio = Object.fromEntries(m.variaveis.map((v) => [v.key, null]));
  const ult = hist[hist.length - 1];
  pj.forEach((p, i) => {
    const extra = {
      base_completo: p.completo,
      base_juros: p.juros,
      base_lucro: p.lucro ?? null,
      proj_pts: p.pts_completo ?? null,
      proj_pts_juros: p.pts_juros ?? null,
      proj_pl: p.completo,
      proj_lucro: p.lucro ?? null,
      proj_selic: p.selic,
      proj_fed: p.fed,
    };
    if (i === 0 && ult.mes === p.mes) {
      Object.assign(ult, extra, { h: 0 });
      return;
    }
    proj.push({
      ...(vazio as Record<string, null>),
      date: p.date,
      mes: p.mes,
      parcial: false,
      na_amostra: false,
      pl: null,
      fit_juros: null,
      fit_completo: null,
      excl: null,
      excl_teto: null,
      excl_prejuizo: null,
      excl_sem_dado: null,
      ...extra,
      faixa: null,
      projetado: true,
      h: i,
      t: parseIsoUTC(p.date),
    } as Linha);
  });
  return { hist, proj };
}

function TooltipIbov({
  active,
  payload,
  cenario = false,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
  cenario?: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const r = payload[0]?.payload as Linha | undefined;
  if (!r) return null;
  if (r.projetado) {
    return (
      <div style={caixaTooltip}>
        <p style={{ color: "#94A3B8", fontWeight: 600, margin: "0 0 4px" }}>
          {fmtMesCurto(r.date)} · {cenario ? "seu cenário" : "projeção"}
        </p>
        <Item nome="Onde deveria estar" valor={pts(r.proj_pts)} cor={PL_CORES.completo} />
        <Item nome="Só juros" valor={pts(r.proj_pts_juros)} cor={PL_CORES.juros} />
        <Item nome="P/L justificado" valor={vezes(r.proj_pl)} cor={COR_PL} />
        <p style={{ margin: "4px 0 0", color: "#C7D2E8" }}>
          Lucro do índice <strong style={{ color: "#fff" }}>{pts(r.proj_lucro)}</strong> pontos/ano
        </p>
        <p style={{ margin: "2px 0 0", color: "#C7D2E8" }}>
          Selic <strong style={{ color: "#fff" }}>{taxa(r.proj_selic)}</strong> · Fed Funds{" "}
          <strong style={{ color: "#fff" }}>{taxa(r.proj_fed)}</strong>
        </p>
      </div>
    );
  }
  const dist = r.pts_completo != null && r.ibov ? (r.pts_completo / r.ibov - 1) * 100 : null;
  return (
    <div style={caixaTooltip}>
      <p style={{ color: "#94A3B8", fontWeight: 600, margin: "0 0 4px" }}>{rotuloMes(r)}</p>
      <Item nome="Ibovespa" valor={pts(r.ibov)} cor={PL_CORES.obs} />
      <Item nome="Onde deveria estar" valor={pts(r.pts_completo)} cor={PL_CORES.completo} />
      <Item nome="Só juros" valor={pts(r.pts_juros)} cor={PL_CORES.juros} />
      <Item nome="P/L do Ibovespa" valor={vezes(r.pl)} cor={COR_PL} />
      <Item nome="P/L justificado" valor={vezes(r.fit_completo)} />
      {dist != null ? (
        <p style={{ margin: "4px 0 0", color: "#C7D2E8" }}>
          {dist >= 0 ? "Abaixo" : "Acima"} de onde deveria estar em{" "}
          <strong style={{ color: "#fff" }}>{fmtNum(Math.abs(dist), 1)}%</strong>
        </p>
      ) : (
        <p style={{ margin: "4px 0 0", color: "#C7D2E8", whiteSpace: "normal" }}>
          Sem P/L no mês: menos de 60% do índice no cálculo
        </p>
      )}
      {r.lucro != null ? (
        <p style={{ margin: "2px 0 0", color: "#C7D2E8" }}>
          Lucro do índice {pts(r.lucro)} pontos/ano
        </p>
      ) : null}
    </div>
  );
}

function Controle({
  rotulo,
  ajuda,
  valor,
  min,
  max,
  onChange,
}: {
  rotulo: string;
  ajuda: string;
  valor: number;
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
      <span className="block text-[10px] text-zinc-400">{ajuda}</span>
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

/** Geometria do gráfico principal (px): altura total, margem de cima e altura do eixo X. */
const ALT = 380;
const TOPO = 8;
const EIXO_X = 30;

/** Variação até o fim da projeção, escrita à direita do gráfico na altura da linha. */
type Ponta = { chave: string; rotulo: string; valor: string; cor: string; y: number };

const PASSOS_PONTOS = [5000, 10000, 20000, 25000, 50000, 100000];
const PASSOS_PL = [0.5, 1, 2, 2.5, 5];
const serie = (lo: number, passo: number, n: number) => Array.from({ length: n + 1 }, (_, i) => lo + i * passo);

/**
 * Escalas do gráfico (mesma regra do card de FIIs de tijolo): pontos no eixo da esquerda e P/L ao
 * fundo, no eixo da direita. Os dois eixos têm o mesmo número de faixas, então a grade vale para
 * ambos; o P/L ganha o menor passo que cabe nessas faixas, centrado, e ocupa a mesma altura.
 */
function escalas(ind: number[], pl: number[]) {
  if (!ind.length) return null;
  const a = Math.min(...ind);
  const b = Math.max(...ind);
  const pad = (b - a) * 0.06 || 1000;
  let passo = PASSOS_PONTOS[PASSOS_PONTOS.length - 1];
  for (const p of PASSOS_PONTOS) {
    if (Math.ceil((b + pad) / p) - Math.floor((a - pad) / p) <= 8) {
      passo = p;
      break;
    }
  }
  const lo = Math.max(0, Math.floor((a - pad) / passo) * passo);
  const n = Math.ceil((b + pad) / passo) - Math.floor(lo / passo);
  const pontos = { lo, hi: lo + n * passo, ticks: serie(lo, passo, n) };
  if (!pl.length) return { pontos, pl: null };
  const c = Math.min(...pl);
  const d = Math.max(...pl);
  for (const p of PASSOS_PL) {
    const folga = 0.03 * n * p;
    const plo = Math.max(0, Math.floor(((c + d) / 2 - (n * p) / 2) / p) * p);
    if (plo <= c - folga && plo + n * p >= d + folga) {
      return { pontos, pl: { lo: plo, hi: plo + n * p, ticks: serie(plo, p, n), dec: p < 1 ? 1 : 0 } };
    }
  }
  const p = PASSOS_PL[PASSOS_PL.length - 1];
  const plo = Math.max(0, Math.floor(c / p) * p);
  return { pontos, pl: { lo: plo, hi: plo + n * p, ticks: serie(plo, p, n), dec: 0 } };
}

function IbovValuationCard({ m }: { m: IbovPlModeloData }) {
  const { hist, proj } = useMemo(() => montar(m), [m]);
  const [win, setWin] = useState<AzPeriodValue>({ id: "max" }); // abre sempre no histórico inteiro
  const h = m.hoje;
  const pj = m.projecao;
  const pFim = pj?.pontos[pj.pontos.length - 1];
  const p0 = pj?.pontos[0];
  const mesFim = pFim ? fmtMesCurto(pFim.date) : null;
  const sim = pj?.simulador ?? null;
  const lucroPj = pj?.lucro ?? null;

  // Simulador = Selic e Fed Funds no fim da projeção + crescimento do lucro em 12 meses. Parte das
  // implícitas do dia e do PIB nominal esperado; mexer nele refaz a projeção (linhas, barra e números).
  const selicBase = pFim?.selic ?? null;
  const fedBase = pFim?.fed ?? null;
  const gBase = lucroPj?.crescimento_12m ?? null;
  const [selic, setSelic] = useState<number | null>(selicBase);
  const [fed, setFed] = useState<number | null>(fedBase);
  const [g, setG] = useState<number | null>(gBase);
  const mexeu =
    (selic != null && selicBase != null && Math.abs(selic - selicBase) > 0.02) ||
    (fed != null && fedBase != null && Math.abs(fed - fedBase) > 0.02) ||
    (g != null && gBase != null && Math.abs(g - gBase) > 0.05);

  // Projeção mês a mês com os coeficientes publicados (o cliente não reestima nada). A Selic e a Fed
  // mantêm o formato das implícitas e são deslocadas aos poucos até o valor do simulador; no modelo,
  // o deslocamento d da Selic sobe a Selic real em d/(1+IPCA esperado) e tira d da mudança esperada da
  // Selic, e o da Fed sobe a Fed Funds real em d/(1+inflação implícita dos EUA). O lucro cresce à taxa
  // escolhida. Sem mexer, reproduz o JSON.
  const projDin = useMemo(() => {
    const k = proj.length;
    if (!k || !sim || selic == null || fed == null || g == null || selicBase == null || fedBase == null || gBase == null)
      return proj;
    return proj.map((r, i) => {
      const f = (i + 1) / k;
      const dS = (selic - selicBase) * f;
      const dF = (fed - fedBase) * f;
      // lucro do JSON reescalado pela troca de crescimento: com o crescimento do Focus, é o próprio JSON
      const lucro = r.base_lucro != null ? r.base_lucro * Math.pow((1 + g / 100) / (1 + gBase / 100), (i + 1) / 12) : null;
      const eyC =
        r.base_completo != null
          ? 100 / r.base_completo +
            (sim.coef.real_selic * dS) / (1 + sim.ipca_e / 100) -
            sim.coef.dselic_e * dS +
            (sim.coef.fed_real * dF) / (1 + sim.be10 / 100)
          : null;
      const eyJ = r.base_juros != null ? 100 / r.base_juros + (sim.coef_juros.real_selic * dS) / (1 + sim.ipca_e / 100) : null;
      const plC = eyC != null && eyC > 1 ? 100 / eyC : null;
      const plJ = eyJ != null && eyJ > 1 ? 100 / eyJ : null;
      return {
        ...r,
        proj_pl: plC,
        proj_pts: plC != null && lucro != null ? plC * lucro : null,
        proj_pts_juros: plJ != null && lucro != null ? plJ * lucro : null,
        proj_lucro: lucro,
        proj_selic: (r.proj_selic ?? selicBase) + dS,
        proj_fed: (r.proj_fed ?? fedBase) + dF,
      };
    });
  }, [proj, sim, selic, fed, g, selicBase, fedBase, gBase]);

  const fim = projDin.length ? projDin[projDin.length - 1] : null;
  const nivel = fim?.proj_pts ?? null;
  const plFim = fim?.proj_pl ?? null;
  const varFim = nivel != null && h.ibov ? (nivel / h.ibov - 1) * 100 : null;

  const dMin = hist[0]?.date;
  const dMax = hist[hist.length - 1]?.date;
  const vis = useMemo(() => {
    if (!hist.length) return [];
    const { from, to } = resolvePeriodRange(win, hist[0].date, hist[hist.length - 1].date);
    const v = hist.filter((r) => r.date >= from && r.date <= to);
    // A projeção acompanha qualquer janela que chegue até hoje.
    return v.length && v[v.length - 1].date === hist[hist.length - 1].date ? [...v, ...projDin] : v;
  }, [hist, projDin, win]);
  const temProj = vis.some((r) => r.projetado);
  const tHoje = hist.length ? hist[hist.length - 1].t : 0;
  const tFim = vis.length ? vis[vis.length - 1].t : 0;
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
      .flatMap((r) => [r.ibov, r.pts_completo, r.pts_juros, r.proj_pts ?? null, r.proj_pts_juros ?? null, r.faixa?.[0] ?? null, r.faixa?.[1] ?? null])
      .filter(finito);
    const pl = vis.flatMap((r) => [r.pl, r.fit_completo, r.proj_pl ?? null]).filter(finito);
    return escalas(ind, pl);
  }, [vis]);

  // Quanto o Ibovespa varia e onde fica o P/L no fim da projeção (a do simulador): escrito à direita
  // do gráfico, na altura em que cada linha projetada termina.
  const pontas = useMemo((): Ponta[] => {
    if (!esc || !temProj || nivel == null || varFim == null) return [];
    const alturaUtil = ALT - TOPO - EIXO_X;
    const yDe = (v: number, lo: number, hi: number) =>
      Math.min(ALT - EIXO_X - 12, Math.max(14, TOPO + ((hi - v) / (hi - lo)) * alturaUtil));
    const out: Ponta[] = [
      {
        chave: "ibov",
        rotulo: "Ibovespa",
        valor: `${fmtSignedNum(varFim, 1)}%`,
        cor: PL_CORES.completo,
        y: yDe(nivel, esc.pontos.lo, esc.pontos.hi),
      },
    ];
    if (esc.pl && plFim != null) {
      out.push({ chave: "pl", rotulo: "P/L", valor: vezes(plFim), cor: COR_PL, y: yDe(plFim, esc.pl.lo, esc.pl.hi) });
    }
    if (out.length === 2 && Math.abs(out[0].y - out[1].y) < 40) {
      const meio = (out[0].y + out[1].y) / 2;
      const sinal = out[0].y <= out[1].y ? -1 : 1;
      out[0].y = meio + sinal * 20;
      out[1].y = meio - sinal * 20;
    }
    return out;
  }, [esc, temProj, nivel, varFim, plFim]);

  const vars = new Map(m.variaveis.map((v) => [v.key, v]));
  const coefTxt = (k: "real_selic" | "dselic_e" | "fed_real") => fmtNum(Math.abs(vars.get(k)?.coef ?? 0), 2);

  if (h.ibov == null || !hist.length) {
    return (
      <article className="rounded-2xl border border-[#132960]/15 bg-white p-4 text-xs italic text-zinc-400 shadow-sm md:p-5">
        Ibovespa em pontos indisponível no momento.
      </article>
    );
  }

  return (
    <article className="rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm md:p-5">
      <header className="flex flex-wrap items-start justify-between gap-2 pb-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Ibovespa × onde deveria estar pelos juros ({fmtMesCurto(h.data)})
            <MethodInfo className="ml-1.5 align-middle">
              <strong>P/L do Ibovespa.</strong> Lucro por ação reportado nos últimos 12 meses (pela data de anúncio)
              contra o preço, agregado pela média harmônica com os pesos atuais do índice; último dia útil de cada mês.
              Meses em que menos de 60% do índice tem lucro positivo ficam sem P/L.
              <br />
              <br />
              <strong>Onde deveria estar.</strong> O P/L que os juros justificam vezes o lucro do índice (Ibovespa ÷
              P/L, em pontos de lucro por ano). O modelo explica o lucro sobre preço (o inverso do P/L) pela Selic
              real, os juros reais de 5 e de 30 anos, a mudança esperada da Selic, o juro real americano de 10 anos e
              a sua tendência, a Fed Funds real e o cupom cambial (R² {fmtNum(m.modelos.completo.r2, 2)},{" "}
              {fmtMesCurto(m.amostra.inicio)}–{fmtMesCurto(m.amostra.fim)}, {m.amostra.n} meses). &quot;Só
              juros&quot; usa apenas as três taxas brasileiras. A faixa é ±1 desvio do modelo. Os dois P/L ficam ao
              fundo, no eixo da direita.
              <br />
              <br />
              <strong>Projeção.</strong> A Selic implícita e a Fed implícita do dia, as mesmas do Panorama, fazem o
              papel da Selic e da Fed Funds nos meses seguintes; as demais variáveis ficam paradas. O lucro do índice
              cresce pelo PIB nominal esperado (Focus: PIB real e IPCA dos próximos 12 meses), a regra que menos errou
              o lucro de 12 meses à frente entre as testadas
              {lucroPj?.erro_12m != null ? ` (erro típico de ${fmtNum(lucroPj.erro_12m, 0)}% no histórico)` : ""}. O
              simulador ao lado troca a Selic e a Fed do fim da projeção e o crescimento do lucro. Não é recomendação.
            </MethodInfo>
          </h3>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Pontos no último dia útil de cada mês · lucro do índice hoje {pts(h.lucro)} pontos por ano
          </p>
        </div>
        <AzPeriodSelector value={win} onChange={setWin} min={dMin} max={dMax} periods={["ytd", "1y", "5y", "10y", "max"]} />
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
              <Amostra cor={PL_CORES.obs} />
              Ibovespa <strong className="tabular-nums text-[#132960]">{pts(h.ibov)}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Amostra cor={PL_CORES.completo} />
              Onde deveria estar <strong className="tabular-nums text-[#132960]">{pts(h.pts_completo)}</strong>
              {h.pts_completo != null ? (
                <span className="tabular-nums">({fmtSignedNum((h.pts_completo / h.ibov - 1) * 100, 1)}%)</span>
              ) : null}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Amostra cor={PL_CORES.juros} tracejado />
              Só juros <strong className="tabular-nums text-[#132960]">{pts(h.pts_juros)}</strong>
            </span>
            {barra && mesFim ? (
              <span className="inline-flex items-center gap-1.5">
                <Amostra cor={PL_CORES.completo} pontilhado />
                <Amostra cor={PL_CORES.completo} barra />
                {mexeu ? "Seu cenário" : "Pelas implícitas"} · {mesFim}{" "}
                <strong className="tabular-nums text-[#132960]">{pts(nivel)}</strong>
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5 text-zinc-500">
              <span aria-hidden className="inline-block h-2.5 w-3 rounded-sm" style={{ backgroundColor: "rgba(2,125,252,0.14)" }} />
              ±1 desvio do modelo
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-2 text-[11px] text-zinc-600">
            <span className="font-semibold uppercase tracking-wide text-zinc-500">P/L · eixo da direita</span>
            <span className="inline-flex items-center gap-1.5">
              <Amostra cor={COR_PL} tracejado opacidade={OPAC_PL} />
              Do Ibovespa <strong className="tabular-nums text-[#132960]">{vezes(h.pl)}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Amostra cor={COR_PL} tracejado opacidade={OPAC_PL_JUST} />
              Justificado <strong className="tabular-nums text-[#132960]">{vezes(h.justificado_completo)}</strong>
            </span>
            {barra ? (
              <span className="inline-flex items-center gap-1.5">
                <Amostra cor={COR_PL} pontilhado opacidade={OPAC_PL_JUST} />
                {mexeu ? "Seu cenário" : "Pelas implícitas"} <strong className="tabular-nums text-[#132960]">{vezes(plFim)}</strong>
              </span>
            ) : null}
          </div>

          <div className="flex">
            <div style={{ height: ALT }} className="min-w-0 flex-1">
              {vis.length < 2 || !esc ? (
                <div className="flex h-full items-center justify-center text-xs italic text-zinc-400">sem dados na janela</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={vis} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
                    <CartesianGrid {...azGridProps()} />
                    <XAxis
                      {...azXAxisProps()}
                      dataKey="t"
                      height={EIXO_X}
                      type="number"
                      scale="time"
                      domain={xDomain}
                      ticks={xTicks.length ? xTicks : undefined}
                      tickFormatter={(t) => formatTimeTickLabel(isoFromUTC(Number(t)), span)}
                      minTickGap={28}
                    />
                    <YAxis
                      {...azYAxisProps()}
                      domain={[esc.pontos.lo, esc.pontos.hi]}
                      ticks={esc.pontos.ticks}
                      interval={0}
                      allowDataOverflow
                      width={60}
                      tickFormatter={(v) => fmtNum(Number(v), 0)}
                    />
                    {/* Mesma exceção do card de FIIs de tijolo (pedido do dono, 08/10/2026) à regra de um eixo Y:
                        o P/L fica ao fundo, no eixo da direita, com as mesmas faixas dos pontos (ver escalas()). */}
                    {esc.pl ? (
                      <YAxis
                        {...azYAxisProps()}
                        yAxisId="pl"
                        orientation="right"
                        domain={[esc.pl.lo, esc.pl.hi]}
                        ticks={esc.pl.ticks}
                        interval={0}
                        allowDataOverflow
                        width={40}
                        tick={{ ...azYAxisProps().tick, fill: COR_PL }}
                        tickFormatter={(v) => `${fmtNum(Number(v), esc.pl?.dec ?? 0)}x`}
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
                    <Tooltip content={<TooltipIbov cenario={mexeu} />} cursor={{ stroke: AZ_BRAND.navy, strokeOpacity: 0.25 }} />

                    {/* Fundo: P/L, eixo da direita */}
                    {esc.pl ? (
                      <Line
                        yAxisId="pl"
                        type="linear"
                        dataKey="fit_completo"
                        stroke={COR_PL}
                        strokeOpacity={OPAC_PL_JUST}
                        strokeWidth={1.5}
                        strokeDasharray="6 4"
                        dot={false}
                        activeDot={false}
                        isAnimationActive={false}
                      />
                    ) : null}
                    {esc.pl && temProj ? (
                      <Line
                        yAxisId="pl"
                        type="linear"
                        dataKey="proj_pl"
                        stroke={COR_PL}
                        strokeOpacity={OPAC_PL_JUST}
                        strokeWidth={1.8}
                        strokeDasharray="2 3"
                        dot={false}
                        activeDot={false}
                        isAnimationActive={false}
                      />
                    ) : null}
                    {esc.pl ? (
                      <Line
                        yAxisId="pl"
                        type="linear"
                        dataKey="pl"
                        stroke={COR_PL}
                        strokeOpacity={OPAC_PL}
                        strokeWidth={1.5}
                        strokeDasharray="6 4"
                        dot={false}
                        activeDot={false}
                        isAnimationActive={false}
                      />
                    ) : null}
                    {esc.pl && barra && plFim != null ? (
                      <ReferenceLine
                        yAxisId="pl"
                        segment={[
                          { x: tHoje, y: plFim },
                          { x: tFim, y: plFim },
                        ]}
                        stroke={COR_PL}
                        strokeOpacity={OPAC_PL}
                        strokeWidth={2.5}
                        strokeLinecap="round"
                      />
                    ) : null}

                    {/* Frente: Ibovespa e onde deveria estar, eixo da esquerda */}
                    <Area
                      type="linear"
                      dataKey="faixa"
                      stroke="none"
                      fill={PL_CORES.completo}
                      fillOpacity={0.12}
                      isAnimationActive={false}
                      activeDot={false}
                    />
                    {temProj ? (
                      <Line
                        type="linear"
                        dataKey="proj_pts_juros"
                        stroke={PL_CORES.juros}
                        strokeWidth={1.8}
                        strokeDasharray="2 3"
                        dot={false}
                        isAnimationActive={false}
                      />
                    ) : null}
                    {temProj ? (
                      <Line
                        type="linear"
                        dataKey="proj_pts"
                        stroke={PL_CORES.completo}
                        strokeWidth={2}
                        strokeDasharray="2 3"
                        dot={false}
                        isAnimationActive={false}
                      />
                    ) : null}
                    <Line
                      type="linear"
                      dataKey="pts_juros"
                      stroke={PL_CORES.juros}
                      strokeWidth={1.6}
                      strokeDasharray="6 4"
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line type="linear" dataKey="pts_completo" stroke={PL_CORES.completo} strokeWidth={1.8} dot={false} isAnimationActive={false} />
                    <Line type="linear" dataKey="ibov" stroke={PL_CORES.obs} strokeWidth={2.2} dot={false} isAnimationActive={false} />
                    {barra && nivel != null ? (
                      <ReferenceLine
                        segment={[
                          { x: tHoje, y: nivel },
                          { x: tFim, y: nivel },
                        ]}
                        stroke={PL_CORES.completo}
                        strokeWidth={3}
                        strokeLinecap="round"
                      />
                    ) : null}
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
            {pontas.length && pFim ? (
              <div className="relative hidden w-[5rem] shrink-0 sm:block" style={{ height: ALT }}>
                <p className="absolute left-2 top-0 text-[10px] leading-tight text-zinc-500">até {fmtMesCurto(pFim.date)}</p>
                {pontas.map((pt) => (
                  <div key={pt.chave} className="absolute left-2 -translate-y-1/2 leading-tight" style={{ top: pt.y }}>
                    <p className="text-[10px] text-zinc-500">{pt.rotulo}</p>
                    <p className="text-sm font-bold tabular-nums" style={{ color: pt.cor }}>
                      {pt.valor}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          {pontas.length && pFim ? (
            <p className="flex flex-wrap gap-x-4 pt-2 text-[11px] text-zinc-500 sm:hidden">
              <span>Até {fmtMesCurto(pFim.date)}:</span>
              {pontas.map((pt) => (
                <span key={pt.chave}>
                  {pt.rotulo}{" "}
                  <strong className="tabular-nums" style={{ color: pt.cor }}>
                    {pt.valor}
                  </strong>
                </span>
              ))}
            </p>
          ) : null}
        </div>

        <aside className="border-t border-[#132960]/10 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Simulador de cenário
            <MethodInfo className="ml-1.5 align-middle">
              Os controles são a Selic e a Fed Funds no fim da projeção e o crescimento do lucro do índice em 12 meses.
              Partem das implícitas do dia e do PIB nominal esperado (Focus). Mês a mês, a Selic e a Fed mantêm o formato
              das implícitas e são levadas aos poucos ao valor escolhido. Mesmo modelo do gráfico, com as demais
              variáveis paradas: cada +1 ponto na Selic sobe a Selic real ({coefTxt("real_selic")} de peso) e reduz a queda
              esperada dela ({coefTxt("dselic_e")}); na Fed Funds real o peso é {coefTxt("fed_real")}. Ibovespa = P/L
              justificado × lucro do índice. Não é recomendação.
            </MethodInfo>
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            {mesFim ? `Cenário para ${mesFim}: mova e a projeção acompanha` : "Sem projeção pelas implícitas no momento"}
          </p>

          {sim && selic != null && fed != null && g != null && selicBase != null && fedBase != null && gBase != null ? (
            <>
              <div className="mt-4 space-y-5">
                <Controle
                  rotulo={`Selic em ${mesFim}`}
                  ajuda={`pela Selic implícita ${taxa(selicBase)} · hoje ${taxa(p0?.selic)}`}
                  valor={selic}
                  min={5}
                  max={20}
                  onChange={setSelic}
                />
                <Controle
                  rotulo={`Fed Funds em ${mesFim}`}
                  ajuda={`pela Fed implícita ${taxa(fedBase)} · hoje ${taxa(p0?.fed)}`}
                  valor={fed}
                  min={0}
                  max={8}
                  onChange={setFed}
                />
                <Controle
                  rotulo="Lucro em 12 meses"
                  ajuda={`PIB nominal esperado ${taxa(gBase)} (Focus)`}
                  valor={g}
                  min={-20}
                  max={30}
                  onChange={setG}
                />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-zinc-50 p-3">
                <div>
                  <p className="text-[11px] text-zinc-500">Ibovespa em {mesFim}</p>
                  <p className="text-xl font-semibold tabular-nums text-[#132960]">{pts(nivel)}</p>
                  <p className="text-[11px] tabular-nums text-zinc-500">
                    {varFim != null ? `${fmtSignedNum(varFim, 1)}% sobre hoje` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-zinc-500">P/L em {mesFim}</p>
                  <p className="text-xl font-semibold tabular-nums text-[#132960]">{vezes(plFim)}</p>
                  <p className="text-[11px] tabular-nums text-zinc-500">hoje {vezes(h.pl)}</p>
                </div>
              </div>
              <button
                type="button"
                disabled={!mexeu}
                onClick={() => {
                  setSelic(selicBase);
                  setFed(fedBase);
                  setG(gBase);
                }}
                className="mt-3 rounded-full border border-[#132960]/20 bg-white px-3 py-1 text-[11px] font-semibold text-[#132960] transition hover:border-[#132960]/40 hover:bg-zinc-50 disabled:cursor-default disabled:opacity-40"
              >
                Voltar às implícitas
              </button>
            </>
          ) : null}
        </aside>
      </div>

      <p className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-400">
        <span>
          Modelo estimado com dados até {fmtMesCurto(m.estimado_ate)} · linhas interrompidas = meses sem P/L confiável
          {temProj && pj && pFim
            ? mexeu
              ? ` · projeção: seu cenário (Selic ${taxa(selic)} e Fed Funds ${taxa(fed)} em ${mesFim}, lucro ${fmtSignedNum(g ?? 0, 1)}% em 12 meses), demais variáveis paradas`
              : ` · projeção: Selic implícita de ${taxa(pj.pontos[0].selic)} a ${taxa(pFim.selic)}${
                  pj.fed ? `, Fed implícita de ${taxa(pj.pontos[0].fed)} a ${taxa(pFim.fed)}` : ""
                }${gBase != null ? `, lucro ${fmtSignedNum(gBase, 1)}% em 12 meses (PIB nominal esperado)` : ""}, demais variáveis paradas`
            : ""}{" "}
          · não é recomendação
        </span>
        <DataStamp giro={m.generated_at} dado={m.last_data_date} />
      </p>
    </article>
  );
}

/**
 * Seção Valuation da aba Analítico (Bolsa): o Ibovespa em pontos contra onde deveria estar pelos juros
 * (P/L justificado do modelo de build_ibov_pl_modelo.py × lucro do índice), com o P/L ao fundo, a
 * projeção pelas implícitas do dia e o simulador; depois, o prêmio sobre a NTN-B.
 */
export function AcoesPlModelo({ modelo, valuation }: { modelo: IbovPlModeloData; valuation: AcoesValuationData | null }) {
  return (
    <div className="space-y-4">
      <Divisor
        label="Valuation — Ibovespa × juros"
        info="O Ibovespa em pontos comparado com onde deveria estar: o P/L que os juros justificam vezes o lucro do índice. Acima, a bolsa está mais cara do que os juros explicam; abaixo, mais barata. A projeção usa as curvas de juros do dia e o lucro crescendo com a economia."
      />
      <IbovValuationCard m={modelo} />
      {valuation && valuation.status === "ok" ? <AcoesPremioNtnb data={valuation} /> : null}
    </div>
  );
}
