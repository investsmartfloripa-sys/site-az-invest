"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

import type { IgpmData, SerieIgpm } from "@/lib/painel-igpm";

const CORES_COMP: Record<string, string> = {
  "IPA-M": "#132960",
  "IPC-M": "#027DFC",
  "INCC-M": "#F59E0B",
};

function formatMes(s: string): string {
  if (!s) return "";
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const [y, m] = s.split("-");
  return `${meses[parseInt(m, 10) - 1]}/${y.slice(2)}`;
}

function rolling12(serie: SerieIgpm[], key: string): Array<number | null> {
  const r: Array<number | null> = [];
  for (let i = 0; i < serie.length; i++) {
    if (i < 11) {
      r.push(null);
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
    r.push(ok ? Number(s.toFixed(4)) : null);
  }
  return r;
}

function calcula12mIgpm(serie: SerieIgpm[], componentes: string[]): SerieIgpm[] {
  const out: SerieIgpm[] = serie.map((d) => ({ mes: d.mes, "IGP-M 12m": d["IGP-M 12m"] } as SerieIgpm));
  componentes.forEach((c) => {
    const r = rolling12(serie, `${c} (contrib)`);
    out.forEach((d, i) => {
      d[c] = r[i];
    });
  });
  return out.filter((d) => d[componentes[0]] != null);
}

function dadosMensalIgpm(serie: SerieIgpm[], componentes: string[]): SerieIgpm[] {
  return serie.map((d) => {
    const o: SerieIgpm = { mes: d.mes, "IGP-M": d["IGP-M"] } as SerieIgpm;
    componentes.forEach((c) => {
      o[c] = d[`${c} (contrib)`];
    });
    return o;
  });
}

type ToggleOption<T extends string> = { value: T; label: string };
function Toggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: ToggleOption<T>[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-[#132960]/20 text-xs">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 font-medium transition ${
            value === opt.value ? "bg-[#132960] text-white" : "bg-white text-[#132960] hover:bg-[#132960]/5"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Chip({
  label,
  color,
  ativo,
  onClick,
}: {
  label: string;
  color: string;
  ativo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
        ativo ? "border-[#132960] bg-white text-[#132960]" : "border-zinc-200 bg-zinc-50 text-zinc-400"
      }`}
    >
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: ativo ? color : "#d1d5db" }} />
      {label}
    </button>
  );
}

type Periodo = "mensal" | "12m";
type Modo = "empilhado" | "linhas";

function AnchorChartIgpm({ data }: { data: IgpmData }) {
  const [periodo, setPeriodo] = useState<Periodo>("12m");
  const [modo, setModo] = useState<Modo>("empilhado");
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const dados = data.igpm;
  const componentes = dados.componentes;

  const chartData = useMemo(() => {
    return periodo === "12m"
      ? calcula12mIgpm(dados.serie, componentes)
      : dadosMensalIgpm(dados.serie, componentes);
  }, [dados.serie, componentes, periodo]);

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
            Mês de referência: <strong>{formatMes(dados.mes_recente)}</strong> ·{" "}
            {periodo === "12m" ? "Acumulado em 12 meses" : "Variação mensal"} ·{" "}
            {modo === "empilhado" ? "Barras empilhadas" : "Linhas sobrepostas"}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            Pesos no IGP-M: IPA-M 60% · IPC-M 30% · INCC-M 10%. Fonte: FGV via BCB SGS.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Toggle<Periodo>
            value={periodo}
            options={[
              { value: "mensal", label: "Mensal" },
              { value: "12m", label: "12 meses" },
            ]}
            onChange={setPeriodo}
          />
          <Toggle<Modo>
            value={modo}
            options={[
              { value: "empilhado", label: "Empilhado" },
              { value: "linhas", label: "Linhas" },
            ]}
            onChange={setModo}
          />
        </div>
      </div>

      <div style={{ width: "100%", height: 380 }}>
        <ResponsiveContainer>
          <ComposedChart data={chartData} margin={{ top: 10, right: 24, bottom: 10, left: 0 }}>
            <CartesianGrid stroke="#eee" vertical={false} />
            <XAxis dataKey="mes" tickFormatter={formatMes} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => v.toFixed(1)} unit=" p.p." />
            <Tooltip
              labelFormatter={(l) => formatMes(String(l))}
              formatter={(v, n) =>
                v == null || typeof v !== "number"
                  ? ["—", String(n)]
                  : [`${v.toFixed(2)} p.p.`, String(n)]
              }
              contentStyle={{ fontSize: 12 }}
            />
            <ReferenceLine y={0} stroke="#000" strokeWidth={1} />

            {visiveis.map((c) =>
              modo === "empilhado" ? (
                <Bar key={c} dataKey={c} stackId="comp" fill={CORES_COMP[c] ?? "#888"} />
              ) : (
                <Line key={c} dataKey={c} stroke={CORES_COMP[c] ?? "#888"} strokeWidth={1.5} dot={false} />
              ),
            )}

            <Line
              dataKey={linhaCheio}
              stroke="#000"
              strokeWidth={2}
              dot={false}
              name={periodo === "12m" ? "IGP-M 12m" : "IGP-M (mês)"}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {componentes.map((c) => (
          <Chip
            key={c}
            label={c}
            color={CORES_COMP[c] ?? "#888"}
            ativo={!hidden.has(c)}
            onClick={() => toggleComp(c)}
          />
        ))}
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setHidden(new Set())}
            className="px-2 py-1 text-xs text-[#027DFC] hover:underline"
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setHidden(new Set(componentes))}
            className="px-2 py-1 text-xs text-[#027DFC] hover:underline"
          >
            Limpar
          </button>
        </div>
      </div>
    </div>
  );
}

function ComponentesChart({ data }: { data: IgpmData }) {
  // Linhas dos 3 componentes em var. mensal (sem contribuição) + IGP-M cheio
  const serie = useMemo(() => {
    return data.igpm.serie.map((d) => ({
      mes: d.mes,
      "IPA-M": d["IPA-M"],
      "IPC-M": d["IPC-M"],
      "INCC-M": d["INCC-M"],
      "IGP-M": d["IGP-M"],
    }));
  }, [data.igpm.serie]);

  return (
    <div className="w-full min-w-0 rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-[#027DFC]">Componentes — variação mensal</h3>
      <p className="mb-3 mt-1 text-xs text-zinc-600">
        IPA-M (atacado, principal driver) vs IPC-M (consumidor) vs INCC-M (construção). IGP-M cheio em preto.
      </p>
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <LineChart data={serie} margin={{ top: 10, right: 24, bottom: 10, left: 0 }}>
            <CartesianGrid stroke="#eee" vertical={false} />
            <XAxis dataKey="mes" tickFormatter={formatMes} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="%" />
            <Tooltip
              labelFormatter={(l) => formatMes(String(l))}
              formatter={(v, n) =>
                v == null || typeof v !== "number" ? ["—", String(n)] : [`${v.toFixed(2)}%`, String(n)]
              }
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
            <Line dataKey="IPA-M" stroke="#132960" strokeWidth={1.5} dot={false} />
            <Line dataKey="IPC-M" stroke="#027DFC" strokeWidth={1.5} dot={false} />
            <Line dataKey="INCC-M" stroke="#F59E0B" strokeWidth={1.5} dot={false} />
            <Line dataKey="IGP-M" stroke="#000" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TabelaHistoricoIgpm({ data }: { data: IgpmData }) {
  const ultimos = data.igpm.serie.slice(-12).reverse();
  return (
    <div className="w-full min-w-0 rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-[#027DFC]">Histórico — últimos 12 meses</h3>
      <p className="mb-3 mt-1 text-xs text-zinc-600">
        Variação mensal de cada componente e do IGP-M cheio, mais o acumulado 12 meses do IGP-M.
      </p>
      <div className="overflow-x-auto rounded-lg border border-zinc-100">
        <table className="min-w-full text-xs">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-zinc-700">Mês</th>
              <th className="px-3 py-2 text-right font-semibold text-zinc-700">IPA-M</th>
              <th className="px-3 py-2 text-right font-semibold text-zinc-700">IPC-M</th>
              <th className="px-3 py-2 text-right font-semibold text-zinc-700">INCC-M</th>
              <th className="px-3 py-2 text-right font-semibold text-zinc-700">IGP-M</th>
              <th className="px-3 py-2 text-right font-semibold text-zinc-700">IGP-M 12m</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white">
            {ultimos.map((d) => {
              const fmt = (v: unknown) => (typeof v === "number" ? `${v >= 0 ? "+" : ""}${v.toFixed(2)}` : "—");
              const fmt12 = (v: unknown) => (typeof v === "number" ? `${v.toFixed(2)}%` : "—");
              const cls = (v: unknown) =>
                typeof v === "number" ? (v >= 0 ? "text-red-600" : "text-blue-600") : "text-zinc-400";
              return (
                <tr key={d.mes} className="hover:bg-zinc-50">
                  <td className="whitespace-nowrap px-3 py-1.5 font-medium text-zinc-700">{formatMes(d.mes)}</td>
                  <td className={`whitespace-nowrap px-3 py-1.5 text-right font-mono tabular-nums ${cls(d["IPA-M"])}`}>
                    {fmt(d["IPA-M"])}
                  </td>
                  <td className={`whitespace-nowrap px-3 py-1.5 text-right font-mono tabular-nums ${cls(d["IPC-M"])}`}>
                    {fmt(d["IPC-M"])}
                  </td>
                  <td className={`whitespace-nowrap px-3 py-1.5 text-right font-mono tabular-nums ${cls(d["INCC-M"])}`}>
                    {fmt(d["INCC-M"])}
                  </td>
                  <td className={`whitespace-nowrap px-3 py-1.5 text-right font-mono tabular-nums ${cls(d["IGP-M"])}`}>
                    {fmt(d["IGP-M"])}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono tabular-nums text-zinc-700">
                    {fmt12(d["IGP-M 12m"])}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function IgpmDashboard({ data }: { data: IgpmData }) {
  const last = data.igpm.serie.find((d) => d.mes === data.mes_recente);
  const igpmM = typeof last?.["IGP-M"] === "number" ? (last["IGP-M"] as number) : null;
  const igpm12m = typeof last?.["IGP-M 12m"] === "number" ? (last["IGP-M 12m"] as number) : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[#132960]">Painel IGP-M</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Mês de referência: <strong>{formatMes(data.mes_recente)}</strong>
          <span className="mx-2 text-zinc-300">·</span>
          IGP-M mensal: <strong className="text-[#132960]">{igpmM != null ? igpmM.toFixed(2) : "—"}%</strong>
          <span className="mx-2 text-zinc-300">·</span>
          IGP-M 12m: <strong className="text-[#132960]">{igpm12m != null ? igpm12m.toFixed(2) : "—"}%</strong>
          <span className="mx-2 text-zinc-300">·</span>
          Fonte: FGV (via BCB SGS)
        </p>
      </header>

      <AnchorChartIgpm data={data} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ComponentesChart data={data} />
        <TabelaHistoricoIgpm data={data} />
      </div>

      <footer className="border-t border-zinc-200 pt-4 text-xs text-zinc-500">
        Fontes: FGV (IGP-M, IPA-M, IPC-M, INCC-M) via BCB SGS códigos 189/192/4174/4175/4176. Dados gerados em{" "}
        {data.gerado_em}.
      </footer>
    </div>
  );
}
