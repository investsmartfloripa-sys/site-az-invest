"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  BarChart,
} from "recharts";

import type {
  IgpmData,
  OverviewBlock,
  SerieIgpmOverview,
  SerieLongaPonto,
  SubPainelComponente,
} from "@/lib/painel-igpm";
import DataStamp from "@/components/painel/DataStamp";

const CORES_COMP: Record<string, string> = {
  "IPA-M": "#132960",
  "IPC-M": "#027DFC",
  "INCC-M": "#F59E0B",
};

const MESES_NOMES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function formatMes(s: string): string {
  if (!s) return "";
  const [y, m] = s.split("-");
  return `${MESES_NOMES[parseInt(m, 10) - 1]}/${y.slice(2)}`;
}

function formatMesLongo(s: string): string {
  if (!s) return "";
  const [y, m] = s.split("-");
  return `${MESES_NOMES[parseInt(m, 10) - 1]}/${y}`;
}

type ToggleOption<T extends string> = { value: T; label: string };
function Toggle<T extends string>({ value, options, onChange }: { value: T; options: ToggleOption<T>[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-[#132960]/20 text-xs">
      {options.map((opt) => (
        <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 font-medium transition ${value === opt.value ? "bg-[#132960] text-white" : "bg-white text-[#132960] hover:bg-[#132960]/5"}`}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Chip({ label, color, ativo, onClick }: { label: string; color: string; ativo: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${ativo ? "border-[#132960] bg-white text-[#132960]" : "border-zinc-200 bg-zinc-50 text-zinc-400"}`}>
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: ativo ? color : "#d1d5db" }} />
      {label}
    </button>
  );
}

/* ============================================================
 * Visão geral — âncora com contribuição
 * ============================================================ */

type Periodo = "mensal" | "12m";
type Modo = "empilhado" | "linhas";

function rolling12FromOverview(serie: SerieIgpmOverview[], componentes: string[]): SerieIgpmOverview[] {
  const out: SerieIgpmOverview[] = serie.map((d) => ({ mes: d.mes, "IGP-M 12m": d["IGP-M 12m"] } as SerieIgpmOverview));
  componentes.forEach((c) => {
    const key = `${c} (contrib)`;
    for (let i = 0; i < serie.length; i++) {
      if (i < 11) {
        out[i][c] = null;
        continue;
      }
      let s = 0;
      let ok = true;
      for (let j = i - 11; j <= i; j++) {
        const v = serie[j][key];
        if (typeof v !== "number") {
          ok = false;
          break;
        }
        s += v;
      }
      out[i][c] = ok ? Number(s.toFixed(4)) : null;
    }
  });
  return out.filter((d) => d[componentes[0]] != null);
}

function dadosMensalOverview(serie: SerieIgpmOverview[], componentes: string[]): SerieIgpmOverview[] {
  return serie.map((d) => {
    const o: SerieIgpmOverview = { mes: d.mes, "IGP-M": d["IGP-M"] } as SerieIgpmOverview;
    componentes.forEach((c) => {
      o[c] = d[`${c} (contrib)`];
    });
    return o;
  });
}

function VisaoGeral({ overview, giro }: { overview: OverviewBlock; giro?: string }) {
  const [periodo, setPeriodo] = useState<Periodo>("12m");
  const [modo, setModo] = useState<Modo>("empilhado");
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const componentes = overview.componentes;
  const chartData = useMemo(() => {
    return periodo === "12m" ? rolling12FromOverview(overview.serie, componentes) : dadosMensalOverview(overview.serie, componentes);
  }, [overview.serie, componentes, periodo]);

  const toggleComp = (c: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };
  const visiveis = componentes.filter((c) => !hidden.has(c));
  const linhaCheio = periodo === "12m" ? "IGP-M 12m" : "IGP-M";

  return (
    <div className="w-full min-w-0 rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm lg:p-6">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#027DFC]">IGP-M — Contribuição por componente</h2>
          <p className="mt-1 text-xs text-zinc-600">
            Mês de referência: <strong>{formatMes(overview.mes_recente)}</strong> ·{" "}
            {periodo === "12m" ? "Acumulado em 12 meses" : "Variação mensal"} ·{" "}
            {modo === "empilhado" ? "Barras empilhadas" : "Linhas sobrepostas"}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            Pesos no IGP-M: IPA-M 60% · IPC-M 30% · INCC-M 10%. Fonte: FGV via BCB SGS (códigos 7450 / 7456 / 7465).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Toggle<Periodo> value={periodo} options={[{ value: "mensal", label: "Mensal" }, { value: "12m", label: "12 meses" }]} onChange={setPeriodo} />
          <Toggle<Modo> value={modo} options={[{ value: "empilhado", label: "Empilhado" }, { value: "linhas", label: "Linhas" }]} onChange={setModo} />
        </div>
      </div>

      <div style={{ width: "100%", height: 380 }}>
        <ResponsiveContainer>
          <ComposedChart data={chartData} margin={{ top: 10, right: 24, bottom: 10, left: 0 }}>
            <CartesianGrid stroke="#eee" vertical={false} />
            <XAxis dataKey="mes" tickFormatter={formatMes} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => v.toFixed(1)} unit=" p.p." />
            <Tooltip labelFormatter={(l) => formatMes(String(l))}
              formatter={(v, n) => v == null || typeof v !== "number" ? ["—", String(n)] : [`${v.toFixed(2)} p.p.`, String(n)]}
              contentStyle={{ fontSize: 12 }} />
            <ReferenceLine y={0} stroke="#000" strokeWidth={1} />
            {visiveis.map((c) => modo === "empilhado" ? (
              <Bar key={c} dataKey={c} stackId="comp" fill={CORES_COMP[c] ?? "#888"} />
            ) : (
              <Line key={c} dataKey={c} stroke={CORES_COMP[c] ?? "#888"} strokeWidth={1.5} dot={false} />
            ))}
            <Line dataKey={linhaCheio} stroke="#000" strokeWidth={2} dot={false} name={periodo === "12m" ? "IGP-M 12m" : "IGP-M (mês)"} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {componentes.map((c) => (
          <Chip key={c} label={c} color={CORES_COMP[c] ?? "#888"} ativo={!hidden.has(c)} onClick={() => toggleComp(c)} />
        ))}
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => setHidden(new Set())} className="px-2 py-1 text-xs text-[#027DFC] hover:underline">Todos</button>
          <button type="button" onClick={() => setHidden(new Set(componentes))} className="px-2 py-1 text-xs text-[#027DFC] hover:underline">Limpar</button>
        </div>
      </div>
      <p className="mt-2">
        <DataStamp giro={giro} dado={overview.serie[overview.serie.length - 1]?.mes} />
      </p>
    </div>
  );
}

/* ============================================================
 * Comparativo IGP-M vs IPCA (12m, 10 anos)
 * ============================================================ */

function ComparativoIPCA({ data }: { data: IgpmData }) {
  const serie = data.comparativo_ipca;
  return (
    <div className="w-full min-w-0 rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-[#027DFC]">IGP-M × IPCA (12 meses, últimos 10 anos)</h3>
      <p className="mb-3 mt-1 text-xs text-zinc-600">
        O IGP-M é muito mais volátil que o IPCA porque carrega o IPA-M (atacado, 60% do peso) — fortemente influenciado por câmbio e commodities.
      </p>
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <LineChart data={serie} margin={{ top: 10, right: 24, bottom: 10, left: 0 }}>
            <CartesianGrid stroke="#eee" vertical={false} />
            <XAxis dataKey="mes" tickFormatter={formatMes} tick={{ fontSize: 11 }} minTickGap={40} />
            <YAxis tick={{ fontSize: 11 }} unit="%" />
            <Tooltip labelFormatter={(l) => formatMes(String(l))}
              formatter={(v, n) => v == null || typeof v !== "number" ? ["—", String(n)] : [`${v.toFixed(2)}%`, String(n)]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
            <Line dataKey="igpm_12m" name="IGP-M 12m" stroke="#132960" strokeWidth={1.6} dot={false} />
            <Line dataKey="ipca_12m" name="IPCA 12m" stroke="#027DFC" strokeWidth={1.6} dot={false} />
            <Line dataKey="spread" name="Spread (IGP-M − IPCA)" stroke="#F59E0B" strokeWidth={1.2} dot={false} strokeDasharray="4 4" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2">
        <DataStamp giro={data.gerado_em} dado={serie[serie.length - 1]?.mes} />
      </p>
    </div>
  );
}

/* ============================================================
 * Sub-painel POR componente (IPA-M, IPC-M, INCC-M)
 * ============================================================ */

function SubPainel({ nome, sub, cor, giro }: { nome: string; sub: SubPainelComponente; cor: string; giro?: string }) {
  const [view, setView] = useState<"12m" | "mensal" | "ano">("12m");

  const dataKey = view === "12m" ? "acum_12m" : view === "mensal" ? "mensal" : "acum_ano";
  const ipcaKey = view === "12m" ? "ipca_12m" : view === "mensal" ? "ipca_mensal" : null;
  const titulo = view === "12m" ? "Acumulado em 12 meses" : view === "mensal" ? "Variação mensal" : "Acumulado no ano";

  const sazonalidadeSerie = useMemo(() => {
    return Object.entries(sub.sazonalidade).map(([mm, s]) => ({
      mes: MESES_NOMES[parseInt(mm, 10) - 1],
      media: s.media,
      min: s.min,
      max: s.max,
      n: s.n,
    }));
  }, [sub.sazonalidade]);

  return (
    <section className="rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm lg:p-6">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#132960]">
            {nome}
            <span className="ml-2 text-sm font-medium text-zinc-500">peso {sub.peso_igpm.toFixed(0)}% no IGP-M</span>
          </h2>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
            <span className="text-zinc-500">Mês de referência:</span>
            <strong className="text-[#132960]">{formatMesLongo(sub.ultimo_mes)}</strong>
            <span className="text-zinc-500">Mensal:</span>
            <strong className="text-[#132960]">{sub.ultimo_mensal != null ? `${sub.ultimo_mensal.toFixed(2)}%` : "—"}</strong>
            <span className="text-zinc-500">12 meses:</span>
            <strong className="text-[#132960]">{sub.ultimo_12m != null ? `${sub.ultimo_12m.toFixed(2)}%` : "—"}</strong>
            <span className="text-zinc-500">Ano:</span>
            <strong className="text-[#132960]">{sub.ultimo_ano != null ? `${sub.ultimo_ano.toFixed(2)}%` : "—"}</strong>
          </div>
        </div>
        <Toggle<"12m" | "mensal" | "ano">
          value={view}
          options={[{ value: "mensal", label: "Mensal" }, { value: "12m", label: "12 meses" }, { value: "ano", label: "No ano" }]}
          onChange={setView}
        />
      </div>

      {/* Gráfico principal: série longa + IPCA */}
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <LineChart data={sub.serie_longa} margin={{ top: 10, right: 24, bottom: 10, left: 0 }}>
            <CartesianGrid stroke="#eee" vertical={false} />
            <XAxis dataKey="mes" tickFormatter={formatMes} tick={{ fontSize: 11 }} minTickGap={40} />
            <YAxis tick={{ fontSize: 11 }} unit="%" />
            <Tooltip labelFormatter={(l) => formatMes(String(l))}
              formatter={(v, n) => v == null || typeof v !== "number" ? ["—", String(n)] : [`${v.toFixed(2)}%`, String(n)]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
            <Line dataKey={dataKey} name={`${nome} ${titulo}`} stroke={cor} strokeWidth={1.8} dot={false} />
            {ipcaKey && (
              <Line dataKey={ipcaKey} name={`IPCA ${titulo}`} stroke="#94A3B8" strokeWidth={1.2} dot={false} strokeDasharray="4 4" />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Sazonalidade */}
        <div>
          <h3 className="text-sm font-semibold text-[#027DFC]">Sazonalidade — média histórica por mês</h3>
          <p className="mb-2 mt-0.5 text-[11px] text-zinc-500">
            Média da variação mensal em cada mês civil ao longo do histórico ({sub.estatisticas.n} pontos no total).
          </p>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={sazonalidadeSerie} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#eee" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v) => (v == null || typeof v !== "number" ? "—" : `${v.toFixed(2)}%`)} />
                <ReferenceLine y={0} stroke="#000" strokeWidth={0.6} />
                <Bar dataKey="media" fill={cor} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Estatísticas + maiores variações */}
        <div>
          <h3 className="text-sm font-semibold text-[#027DFC]">Estatísticas do histórico</h3>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <dt className="text-zinc-600">Observações</dt>
            <dd className="font-mono tabular-nums text-zinc-800">{sub.estatisticas.n ?? "—"}</dd>
            <dt className="text-zinc-600">Média mensal</dt>
            <dd className="font-mono tabular-nums text-zinc-800">{sub.estatisticas.media != null ? `${sub.estatisticas.media.toFixed(2)}%` : "—"}</dd>
            <dt className="text-zinc-600">Mediana</dt>
            <dd className="font-mono tabular-nums text-zinc-800">{sub.estatisticas.mediana != null ? `${sub.estatisticas.mediana.toFixed(2)}%` : "—"}</dd>
            <dt className="text-zinc-600">Desvio-padrão</dt>
            <dd className="font-mono tabular-nums text-zinc-800">{sub.estatisticas.std != null ? `${sub.estatisticas.std.toFixed(2)}%` : "—"}</dd>
            <dt className="text-zinc-600">Mínimo</dt>
            <dd className="font-mono tabular-nums text-blue-700">{sub.estatisticas.min != null ? `${sub.estatisticas.min.toFixed(2)}%` : "—"}</dd>
            <dt className="text-zinc-600">Máximo</dt>
            <dd className="font-mono tabular-nums text-red-700">{sub.estatisticas.max != null ? `${sub.estatisticas.max.toFixed(2)}%` : "—"}</dd>
            <dt className="text-zinc-600">% meses positivos</dt>
            <dd className="font-mono tabular-nums text-zinc-800">{sub.estatisticas.positivos_pct != null ? `${sub.estatisticas.positivos_pct.toFixed(0)}%` : "—"}</dd>
            <dt className="text-zinc-600">% meses negativos</dt>
            <dd className="font-mono tabular-nums text-zinc-800">{sub.estatisticas.negativos_pct != null ? `${sub.estatisticas.negativos_pct.toFixed(0)}%` : "—"}</dd>
          </dl>

          <h3 className="mt-4 text-sm font-semibold text-[#027DFC]">Maiores variações da história</h3>
          <div className="mt-1 grid grid-cols-2 gap-x-4">
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-red-700">Maiores altas</p>
              {sub.maiores_altas.slice(0, 6).map((p, i) => (
                <div key={i} className="flex justify-between border-b border-zinc-100 py-0.5 text-xs">
                  <span className="text-zinc-600">{formatMesLongo(p.mes)}</span>
                  <span className="font-mono tabular-nums text-red-600">+{p.valor.toFixed(2)}%</span>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700">Maiores quedas</p>
              {sub.maiores_quedas.slice(0, 6).map((p, i) => (
                <div key={i} className="flex justify-between border-b border-zinc-100 py-0.5 text-xs">
                  <span className="text-zinc-600">{formatMesLongo(p.mes)}</span>
                  <span className="font-mono tabular-nums text-blue-600">{p.valor.toFixed(2)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className="mt-2">
        <DataStamp giro={giro} dado={sub.serie_longa[sub.serie_longa.length - 1]?.mes} />
      </p>
    </section>
  );
}

/* ============================================================
 * Dashboard principal
 * ============================================================ */

export function IgpmDashboard({ data }: { data: IgpmData }) {
  const overview = data.overview ?? data.igpm;
  const last = overview.serie.find((d) => d.mes === data.mes_recente);
  const igpmM = typeof last?.["IGP-M"] === "number" ? (last["IGP-M"] as number) : overview.ultimo_mensal;
  const igpm12m = typeof last?.["IGP-M 12m"] === "number" ? (last["IGP-M 12m"] as number) : overview.ultimo_12m;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[#132960]">Painel IGP-M</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Mês de referência: <strong>{formatMesLongo(data.mes_recente)}</strong>
          <span className="mx-2 text-zinc-300">·</span>
          IGP-M mensal: <strong className="text-[#132960]">{igpmM != null ? `${igpmM.toFixed(2)}%` : "—"}</strong>
          <span className="mx-2 text-zinc-300">·</span>
          IGP-M 12m: <strong className="text-[#132960]">{igpm12m != null ? `${igpm12m.toFixed(2)}%` : "—"}</strong>
          <span className="mx-2 text-zinc-300">·</span>
          Fonte: FGV (via BCB SGS)
        </p>
      </header>

      <VisaoGeral overview={overview} giro={data.gerado_em} />
      <ComparativoIPCA data={data} />

      {data.componentes &&
        Object.entries(data.componentes).map(([nome, sub]) => (
          <SubPainel key={nome} nome={nome} sub={sub} cor={CORES_COMP[nome] ?? "#132960"} giro={data.gerado_em} />
        ))}

      <footer className="border-t border-zinc-200 pt-4 text-xs text-zinc-500">
        Fontes: FGV (IGP-M e componentes IPA-M, IPC-M, INCC-M) via BCB SGS códigos 189/192/7450/7456/7465. IPCA pra
        comparação cruzada: 433/13522. Dados gerados em {data.gerado_em}.
      </footer>
    </div>
  );
}
