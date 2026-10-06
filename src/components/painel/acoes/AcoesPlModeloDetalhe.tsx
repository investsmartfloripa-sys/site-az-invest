"use client";

import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import DataStamp from "@/components/painel/DataStamp";
import { PL_CORES, rotuloMes } from "@/components/painel/acoes/plModeloShared";
import {
  AzPeriodSelector,
  resolvePeriodRange,
  type AzPeriodValue,
} from "@/components/painel/charts";
import { azGridProps, azXAxisProps, azYAxisProps, azZeroLineProps } from "@/components/painel/core";
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
import type { IbovPlModeloData, IbovPlModeloVarKey } from "@/lib/painel-acoes";

const CARD = "rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm md:p-5";
const TITULO = "text-xs font-semibold uppercase tracking-wide text-zinc-500";

const navyBox = {
  background: AZ_BRAND.navy,
  borderRadius: 8,
  color: "#fff",
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(19,41,96,.25)",
  padding: "8px 12px",
} as const;

function fmtP(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return "—";
  return p < 0.001 ? "< 0,001" : fmtNum(p, 3);
}

/** Valor com a unidade da variável: "8,76%" ou "−1,38 p.p." */
function fmtVar(v: number | null | undefined, unidade: string, dec = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return unidade === "%" ? `${fmtNum(v, dec)}%` : `${fmtSignedNum(v, dec)} p.p.`;
}

// ---------------------------------------------------------------------------
// Dispersões: P/L × cada taxa de juros real, com a reta de regressão simples
// ---------------------------------------------------------------------------

type Ponto = { x: number; y: number; mes: string; date: string; parcial: boolean };

function DispTooltip({
  active,
  payload,
  nome,
  unidade,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
  nome: string;
  unidade: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0]?.payload as Ponto | undefined;
  if (!p) return null;
  return (
    <div style={navyBox}>
      <p style={{ color: "#94A3B8", fontWeight: 600, margin: 0, marginBottom: 2 }}>
        {rotuloMes({ date: p.date, parcial: p.parcial })}
      </p>
      <p style={{ margin: 0 }}>
        P/L <strong>{fmtNum(p.y, 1)}x</strong> · {nome} <strong>{fmtVar(p.x, unidade)}</strong>
      </p>
    </div>
  );
}

function MiniDispersao({
  d,
  unidade,
  pts,
  hoje,
  ylo,
  yhi,
}: {
  d: IbovPlModeloData["dispersao"][number];
  unidade: string;
  pts: Ponto[];
  hoje: Ponto | null;
  ylo: number;
  yhi: number;
}) {
  const xs = pts.map((p) => p.x).concat(hoje ? [hoje.x] : []);
  const xlo = Math.floor(Math.min(...xs) - 0.5);
  const xhi = Math.ceil(Math.max(...xs) + 0.5);
  return (
    <div className="min-w-0">
      <p className="text-[12px] font-semibold text-[#132960]">
        {d.nome}
        {unidade === "p.p." ? <span className="font-normal text-zinc-500"> (p.p.)</span> : null}
      </p>
      <p className="text-[10px] text-zinc-500">
        inclinação {fmtSignedNum(d.b, 2)} · R² {fmtNum(d.r2, 2)}
      </p>
      <div style={{ height: 230 }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid {...azGridProps()} />
            <XAxis
              {...azXAxisProps()}
              type="number"
              dataKey="x"
              domain={[xlo, xhi]}
              tickFormatter={(v) => (unidade === "%" ? `${fmtNum(Number(v), 0)}%` : fmtNum(Number(v), 0))}
              tickCount={5}
            />
            <YAxis
              {...azYAxisProps()}
              type="number"
              dataKey="y"
              domain={[ylo, yhi]}
              width={30}
              tickFormatter={(v) => fmtNum(Number(v), 0)}
            />
            <Tooltip
              content={<DispTooltip nome={d.nome} unidade={unidade} />}
              cursor={{ strokeDasharray: "3 3", stroke: AZ_CHART.ticks }}
            />
            <Scatter data={pts} fill={PL_CORES.obs} fillOpacity={0.32} isAnimationActive={false} />
            {d.x0 != null && d.y0 != null && d.x1 != null && d.y1 != null ? (
              <ReferenceLine
                segment={[
                  { x: d.x0, y: d.y0 },
                  { x: d.x1, y: d.y1 },
                ]}
                stroke={PL_CORES.completo}
                strokeWidth={2}
                ifOverflow="hidden"
              />
            ) : null}
            {hoje ? (
              <Scatter
                data={[hoje]}
                isAnimationActive={false}
                shape={(props: { cx?: number; cy?: number }) => (
                  <circle cx={props.cx} cy={props.cy} r={5.5} fill={AZ_BRAND.rust} stroke="#fff" strokeWidth={1.5} />
                )}
              />
            ) : null}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Grupo da dispersão: blobs antigos não trazem `grupo` — deduz pelas variáveis do "só juros". */
export function grupoDispersao(m: IbovPlModeloData, key: IbovPlModeloVarKey): "juros" | "outras" {
  const d = m.dispersao.find((x) => x.key === key);
  if (d?.grupo) return d.grupo;
  return m.modelos.juros.vars.includes(key) ? "juros" : "outras";
}

const GRUPOS = {
  juros: { titulo: "P/L × juro real", grade: "grid-cols-1 sm:grid-cols-3" },
  outras: { titulo: "P/L × demais variáveis do modelo", grade: "grid-cols-2 sm:grid-cols-4" },
} as const;

export function PlDispersaoCard({ m, grupo }: { m: IbovPlModeloData; grupo: "juros" | "outras" }) {
  const { porVar, hojePorVar, ylo, yhi } = useMemo(() => {
    const amostra = m.serie.filter((r) => r.na_amostra && r.pl != null);
    const hojeRow = m.serie.find((r) => r.mes === m.hoje.mes) ?? null;
    const porVar: Record<string, Ponto[]> = {};
    const hojePorVar: Record<string, Ponto | null> = {};
    for (const d of m.dispersao) {
      porVar[d.key] = amostra
        .filter((r) => r[d.key] != null)
        .map((r) => ({ x: r[d.key] as number, y: r.pl as number, mes: r.mes, date: r.date, parcial: r.parcial }));
      const xv = hojeRow?.[d.key];
      hojePorVar[d.key] =
        hojeRow && xv != null && hojeRow.pl != null
          ? { x: xv, y: hojeRow.pl, mes: hojeRow.mes, date: hojeRow.date, parcial: hojeRow.parcial }
          : null;
    }
    // Mesma régua de P/L em todos os painéis (os dois cards ficam lado a lado).
    const ys = amostra.map((r) => r.pl as number).concat(hojeRow?.pl != null ? [hojeRow.pl] : []);
    return { porVar, hojePorVar, ylo: Math.floor(Math.min(...ys) - 0.5), yhi: Math.ceil(Math.max(...ys) + 0.5) };
  }, [m]);
  const itens = m.dispersao.filter((d) => grupoDispersao(m, d.key) === grupo);
  if (!itens.length) return null;
  const unidadeDe = (key: IbovPlModeloVarKey) =>
    m.dispersao.find((d) => d.key === key)?.unidade ?? m.variaveis.find((v) => v.key === key)?.unidade ?? "%";
  const g = GRUPOS[grupo];

  return (
    <article className={`${CARD} h-full`}>
      <header className="pb-2">
        <h3 className={TITULO}>
          {g.titulo} ({fmtMesCurto(m.amostra.inicio)}–{fmtMesCurto(m.amostra.fim)})
          <MethodInfo className="ml-1.5 align-middle">
            Cada ponto é um mês da amostra do modelo: P/L do Ibovespa (eixo vertical) contra a variável do mês
            (média mensal). A reta é a regressão simples com aquela variável sozinha — serve para ver a relação;
            o P/L justificado do modelo usa as variáveis juntas, com outros coeficientes. Ponto laranja = hoje.
          </MethodInfo>
        </h3>
        <p className="mt-0.5 text-[11px] text-zinc-500">Cada ponto é um mês · ponto laranja = hoje</p>
      </header>
      <div className={`grid ${g.grade} gap-3`}>
        {itens.map((d) => (
          <MiniDispersao
            key={d.key}
            d={d}
            unidade={unidadeDe(d.key)}
            pts={porVar[d.key] ?? []}
            hoje={hojePorVar[d.key] ?? null}
            ylo={ylo}
            yhi={yhi}
          />
        ))}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Variáveis do modelo (uma por vez, escolhida por botão)
// ---------------------------------------------------------------------------

type LinhaVar = { t: number; date: string; mes: string; parcial: boolean; valor: number; pl: number | null };

function VarTooltip({
  active,
  payload,
  nome,
  unidade,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
  nome: string;
  unidade: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const r = payload[0]?.payload as LinhaVar | undefined;
  if (!r) return null;
  return (
    <div style={navyBox}>
      <p style={{ color: "#94A3B8", fontWeight: 600, margin: 0, marginBottom: 2 }}>{rotuloMes(r)}</p>
      <p style={{ margin: 0 }}>
        {nome} <strong>{fmtVar(r.valor, unidade)}</strong>
      </p>
      <p style={{ margin: 0, color: "#C7D2E8" }}>P/L observado {r.pl != null ? `${fmtNum(r.pl, 1)}x` : "—"}</p>
    </div>
  );
}

export function PlVariaveisCard({ m }: { m: IbovPlModeloData }) {
  const [k, setK] = useState<IbovPlModeloVarKey>(m.variaveis[0]?.key ?? "real_selic");
  const [win, setWin] = useState<AzPeriodValue>({ id: "max" });
  const v = m.variaveis.find((x) => x.key === k) ?? m.variaveis[0];
  const cor = v.tipo === "direção" ? PL_CORES.juros : PL_CORES.completo;

  const rows: LinhaVar[] = useMemo(
    () =>
      m.serie
        .filter((r) => r[k] != null)
        .map((r) => ({ t: parseIsoUTC(r.date), date: r.date, mes: r.mes, parcial: r.parcial, valor: r[k] as number, pl: r.pl })),
    [m, k],
  );
  const vis = useMemo(() => {
    if (!rows.length) return [];
    const { from, to } = resolvePeriodRange(win, rows[0].date, rows[rows.length - 1].date);
    return rows.filter((r) => r.date >= from && r.date <= to);
  }, [rows, win]);
  const span = vis.length > 1 ? Math.max(1, diffDaysUTC(vis[0].date, vis[vis.length - 1].date)) : 1;
  const xTicks = useMemo(
    () => buildTimeTicks(vis.map((r) => r.date), span).map((iso) => parseIsoUTC(iso)).filter((t) => Number.isFinite(t)),
    [vis, span],
  );
  const vals = vis.map((r) => r.valor);
  const cruzaZero = vals.length > 0 && Math.min(...vals) < 0 && Math.max(...vals) > 0;

  const stats: Array<[string, string]> = [
    ["Hoje", fmtVar(v.hoje, v.unidade)],
    ["Média da amostra", fmtVar(v.media, v.unidade)],
    ["Mínimo", fmtVar(v.min, v.unidade)],
    ["Máximo", fmtVar(v.max, v.unidade)],
    ["Coeficiente", `${fmtSignedNum(v.coef, 3)} (t ${fmtNum(v.t, 1)})`],
    ["VIF", fmtNum(v.vif, 1)],
  ];

  return (
    <article className={CARD}>
      <header className="flex flex-wrap items-start justify-between gap-2 pb-2">
        <div>
          <h3 className={TITULO}>
            Variáveis do modelo ({fmtMesCurto(m.hoje.data)})
            <MethodInfo className="ml-1.5 align-middle">
              Cada variável como entra na regressão: média mensal dos dados diários. &quot;Nível&quot; = a taxa em
              si; &quot;direção&quot; = para onde ela está indo (mudança esperada ou tendência de 12 meses).
              Coeficiente = quanto o P/L justificado muda para cada 1 ponto na variável, mantidas as outras;
              VIF alto (acima de 10) indica variável que anda junto com outras — por isso os juros valem em
              bloco, não um a um.
            </MethodInfo>
          </h3>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Média mensal · {v.tipo === "direção" ? "variável de direção" : "variável de nível"}
          </p>
        </div>
        <AzPeriodSelector
          value={win}
          onChange={setWin}
          min={rows[0]?.date}
          max={rows[rows.length - 1]?.date}
          periods={["ytd", "1y", "5y", "10y", "max"]}
        />
      </header>

      <div className="flex flex-wrap gap-1 pb-2">
        {m.variaveis.map((x) => {
          const ativo = x.key === k;
          return (
            <button
              key={x.key}
              type="button"
              onClick={() => setK(x.key)}
              aria-pressed={ativo}
              className={
                "rounded-full border px-3 py-1 text-[11px] font-semibold transition " +
                (ativo
                  ? "border-transparent bg-[#132960] text-white shadow-sm"
                  : "border-[#132960]/15 bg-white text-zinc-600 hover:border-[#132960]/40 hover:text-[#132960]")
              }
            >
              {x.nome}
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-zinc-600">
        <strong className="text-[#132960]">{v.nome}</strong> — {v.formula}
      </p>
      <dl className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {stats.map(([rot, val]) => (
          <div key={rot} className="rounded-lg bg-zinc-50 px-2 py-1.5">
            <dt className="text-[10px] uppercase tracking-wide text-zinc-500">{rot}</dt>
            <dd className="text-[12px] font-semibold tabular-nums text-[#132960]">{val}</dd>
          </div>
        ))}
      </dl>

      <div style={{ height: 240 }} className="mt-3 w-full">
        {vis.length < 2 ? (
          <div className="flex h-full items-center justify-center text-xs italic text-zinc-400">sem dados na janela</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={vis} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
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
              <YAxis
                {...azYAxisProps()}
                domain={["auto", "auto"]}
                width={44}
                tickFormatter={(x) => (v.unidade === "%" ? `${fmtNum(Number(x), 0)}%` : fmtNum(Number(x), 1))}
              />
              {cruzaZero ? <ReferenceLine {...azZeroLineProps("y")} /> : null}
              {v.media != null ? (
                <ReferenceLine
                  y={v.media}
                  stroke={AZ_CHART.ticks}
                  strokeDasharray="4 3"
                  ifOverflow="hidden"
                  label={{ value: "média", position: "insideTopRight", fontSize: 9, fill: AZ_CHART.ticks }}
                />
              ) : null}
              <Tooltip content={<VarTooltip nome={v.nome} unidade={v.unidade} />} cursor={{ stroke: AZ_BRAND.navy, strokeOpacity: 0.25 }} />
              <Area type="linear" dataKey="valor" stroke="none" fill={cor} fillOpacity={0.08} isAnimationActive={false} />
              <Line type="linear" dataKey="valor" name={v.nome} stroke={cor} strokeWidth={2} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
      <p className="mt-2 text-right">
        <DataStamp giro={m.generated_at} dado={m.last_data_date} />
      </p>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Decomposição do justificado + estatísticas do modelo
// ---------------------------------------------------------------------------

export function PlDecomposicaoCard({ m }: { m: IbovPlModeloData }) {
  const dc = m.decomposicao.completo;
  const dj = m.decomposicao.juros;
  const varPorKey = Object.fromEntries(m.variaveis.map((v) => [v.key, v]));
  const c = m.modelos.completo;
  const j = m.modelos.juros;
  const corEfeito = (e: number | null) =>
    e == null || Math.abs(e) < 0.05 ? AZ_CHART.ticks : e > 0 ? AZ_CHART.posText : AZ_CHART.negText;

  return (
    <article className={CARD}>
      <header className="pb-2">
        <h3 className={TITULO}>
          De onde vem o P/L justificado ({fmtMesCurto(m.hoje.data)})
          <MethodInfo className="ml-1.5 align-middle">
            O P/L justificado parte da média histórica do P/L e soma o efeito de cada variável: coeficiente ×
            (valor de hoje − média da amostra). Os efeitos são somados por bloco — os mesmos do teste F — porque
            variáveis que andam juntas (as três taxas de juros) só têm leitura em conjunto.
          </MethodInfo>
        </h3>
        <p className="mt-0.5 text-[11px] text-zinc-500">Modelo completo, em pontos de P/L (x)</p>
      </header>

      <table className="w-full text-[12px]">
        <tbody>
          <tr className="border-b border-[#132960]/10">
            <td className="py-1.5 text-zinc-600">
              Média histórica do P/L ({fmtMesCurto(m.amostra.inicio)}–{fmtMesCurto(m.amostra.fim)})
            </td>
            <td className="py-1.5 text-right font-semibold tabular-nums text-[#132960]">{fmtNum(dc.media_pl, 1)}x</td>
          </tr>
          {dc.blocos.map((b) => (
            <FragmentoBloco key={b.bloco} b={b} varPorKey={varPorKey} corEfeito={corEfeito} />
          ))}
          <tr className="border-t-2 border-[#132960]/20">
            <td className="py-1.5 font-semibold text-[#132960]">= P/L justificado — modelo completo</td>
            <td className="py-1.5 text-right font-bold tabular-nums text-[#132960]">{fmtNum(dc.justificado, 1)}x</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-zinc-600">
        Só juros: média {fmtNum(dj.media_pl, 1)}x {fmtSignedNum(dj.blocos[0]?.efeito ?? null, 1)}x dos juros reais ={" "}
        <strong className="text-[#132960]">{fmtNum(dj.justificado, 1)}x</strong> (outros coeficientes: sem as
        demais variáveis, as taxas carregam também o efeito delas).
      </p>

      <h4 className={`${TITULO} mt-4`}>Qualidade do ajuste</h4>
      <dl className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            ["R² completo", fmtNum(c.r2, 2)],
            ["R² só juros", fmtNum(j.r2, 2)],
            ["Meses na amostra", String(c.n)],
            ["Meia-vida do desvio", c.meia_vida_meses != null ? `${fmtNum(c.meia_vida_meses, 1)} meses` : "—"],
          ] as Array<[string, string]>
        ).map(([rot, val]) => (
          <div key={rot} className="rounded-lg bg-zinc-50 px-2 py-1.5">
            <dt className="text-[10px] uppercase tracking-wide text-zinc-500">{rot}</dt>
            <dd className="text-[12px] font-semibold tabular-nums text-[#132960]">{val}</dd>
          </div>
        ))}
      </dl>
      <table className="mt-3 w-full text-[11px]">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wide text-zinc-500">
            <th className="py-1 font-semibold">Teste F (variáveis juntas)</th>
            <th className="py-1 text-right font-semibold">F</th>
            <th className="py-1 text-right font-semibold">p-valor</th>
          </tr>
        </thead>
        <tbody>
          {m.testes_f.map((t) => (
            <tr key={t.bloco} className="border-t border-[#132960]/10">
              <td className="py-1 text-zinc-600">{t.nome}</td>
              <td className="py-1 text-right tabular-nums text-[#132960]">{fmtNum(t.F, 1)}</td>
              <td className="py-1 text-right tabular-nums text-[#132960]">{fmtP(t.p)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[10px] text-zinc-400">
        p-valor abaixo de 0,05 = o bloco ajuda a explicar o P/L. Resíduo do modelo completo estacionário (ADF p ={" "}
        {fmtP(c.adf_residuo_p)}): o P/L volta para o justificado com o tempo.
      </p>
    </article>
  );
}

function FragmentoBloco({
  b,
  varPorKey,
  corEfeito,
}: {
  b: IbovPlModeloData["decomposicao"]["completo"]["blocos"][number];
  varPorKey: Record<string, IbovPlModeloData["variaveis"][number]>;
  corEfeito: (e: number | null) => string;
}) {
  return (
    <>
      <tr className="border-t border-[#132960]/10">
        <td className="pt-2 font-semibold text-[#132960]">{b.nome}</td>
        <td className="pt-2 text-right font-semibold tabular-nums" style={{ color: corEfeito(b.efeito) }}>
          {fmtSignedNum(b.efeito, 1)}x
        </td>
      </tr>
      {b.itens.map((it) => {
        const v = varPorKey[it.key];
        return (
          <tr key={it.key}>
            <td className="py-0.5 pl-3 text-[11px] text-zinc-500">
              {it.nome}: {fmtVar(v?.hoje, v?.unidade ?? "%")} hoje vs {fmtVar(v?.media, v?.unidade ?? "%")} na média
            </td>
            <td className="py-0.5 text-right text-[11px] tabular-nums text-zinc-500">{fmtSignedNum(it.efeito, 1)}x</td>
          </tr>
        );
      })}
    </>
  );
}
