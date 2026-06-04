"use client";

import { useMemo, useState } from "react";
import {
  Bar,
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
  Legend,
} from "recharts";

import type { IpcaData, Influencia, SerieGrupo } from "@/lib/painel-ipca";
import DataStamp from "@/components/painel/DataStamp";
import { lastSeriesDate } from "@/lib/data-stamp";

const CORES_GRUPOS = [
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#7f7f7f",
  "#bcbd22",
];

function formatMes(s: string): string {
  if (!s) return "";
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const [y, m] = s.split("-");
  return `${meses[parseInt(m, 10) - 1]}/${y.slice(2)}`;
}

function rolling12(serie: SerieGrupo[], key: string): Array<number | null> {
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

function calcula12m(serie: SerieGrupo[], grupos: string[]): SerieGrupo[] {
  const out: SerieGrupo[] = serie.map((d) => ({ mes: d.mes, "IPCA 12m": d["IPCA 12m"] } as SerieGrupo));
  grupos.forEach((g) => {
    const r = rolling12(serie, `${g} (contrib)`);
    out.forEach((d, i) => {
      d[g] = r[i];
    });
  });
  return out.filter((d) => d[grupos[0]] != null);
}

function dadosMensal(serie: SerieGrupo[], grupos: string[]): SerieGrupo[] {
  return serie.map((d) => {
    const o: SerieGrupo = { mes: d.mes, "IPCA cheio": d["IPCA cheio"] } as SerieGrupo;
    grupos.forEach((g) => {
      o[g] = d[`${g} (contrib)`];
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
            value === opt.value
              ? "bg-[#132960] text-white"
              : "bg-white text-[#132960] hover:bg-[#132960]/5"
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
        ativo
          ? "border-[#132960] bg-white text-[#132960]"
          : "border-zinc-200 bg-zinc-50 text-zinc-400"
      }`}
    >
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: ativo ? color : "#d1d5db" }} />
      {label}
    </button>
  );
}

type Indice = "ipca_cheio" | "ipca_15";
type Periodo = "mensal" | "12m";
type Modo = "empilhado" | "linhas";

function AnchorChart({ data }: { data: IpcaData }) {
  const [indice, setIndice] = useState<Indice>("ipca_cheio");
  const [periodo, setPeriodo] = useState<Periodo>("12m");
  const [modo, setModo] = useState<Modo>("empilhado");
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const dados = data[indice];
  const grupos = dados.grupos;

  const chartData = useMemo(() => {
    return periodo === "12m" ? calcula12m(dados.serie, grupos) : dadosMensal(dados.serie, grupos);
  }, [dados.serie, grupos, periodo]);

  const toggleGrupo = (g: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  };

  const visiveis = grupos.filter((g) => !hidden.has(g));
  const linhaCheio = periodo === "12m" ? "IPCA 12m" : "IPCA cheio";

  return (
    <div className="w-full min-w-0 rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm lg:p-6">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#027DFC]">
            {indice === "ipca_cheio" ? "IPCA — Contribuição por grupo" : "IPCA-15 — Contribuição por grupo"}
          </h2>
          <p className="mt-1 text-xs text-zinc-600">
            Mês de referência: <strong>{formatMes(dados.mes_recente)}</strong> ·{" "}
            {periodo === "12m" ? "Acumulado em 12 meses" : "Variação mensal"} ·{" "}
            {modo === "empilhado" ? "Barras empilhadas" : "Linhas sobrepostas"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Toggle<Indice>
            value={indice}
            options={[
              { value: "ipca_cheio", label: "IPCA cheio" },
              { value: "ipca_15", label: "IPCA-15" },
            ]}
            onChange={setIndice}
          />
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

      <div style={{ width: "100%", height: 440 }}>
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

            {periodo === "12m" && <ReferenceArea y1={1.5} y2={4.5} fill="#10b981" fillOpacity={0.07} />}
            {periodo === "12m" && <ReferenceLine y={3} stroke="#10b981" strokeDasharray="4 4" />}
            <ReferenceLine y={0} stroke="#000" strokeWidth={1} />

            {visiveis.map((g) =>
              modo === "empilhado" ? (
                <Bar key={g} dataKey={g} stackId="grupos" fill={CORES_GRUPOS[grupos.indexOf(g) % 9]} />
              ) : (
                <Line key={g} dataKey={g} stroke={CORES_GRUPOS[grupos.indexOf(g) % 9]} strokeWidth={1.5} dot={false} />
              ),
            )}

            <Line
              dataKey={linhaCheio}
              stroke="#000"
              strokeWidth={2}
              dot={false}
              name={periodo === "12m" ? "IPCA 12m" : "IPCA cheio (mês)"}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {grupos.map((g) => (
          <Chip
            key={g}
            label={g.replace(/^\d+\./, "")}
            color={CORES_GRUPOS[grupos.indexOf(g) % 9]}
            ativo={!hidden.has(g)}
            onClick={() => toggleGrupo(g)}
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
            onClick={() => setHidden(new Set(grupos))}
            className="px-2 py-1 text-xs text-[#027DFC] hover:underline"
          >
            Limpar
          </button>
        </div>
      </div>
      <p className="mt-2">
        <DataStamp giro={data.gerado_em} dado={dados.serie[dados.serie.length - 1]?.mes} />
      </p>
    </div>
  );
}

function MaioresInfluencias({ data }: { data: IpcaData }) {
  const { mes, top_altas, top_quedas } = data.maiores_influencias;
  type ItemProps = { x: Influencia; kind: "alta" | "queda" };
  const Item = ({ x, kind }: ItemProps) => (
    <div className="flex items-center justify-between border-b border-zinc-100 py-1 text-xs last:border-0">
      <span className="mr-2 flex-1 truncate" title={x.subitem}>
        {x.subitem}
      </span>
      <span className={`font-mono tabular-nums ${kind === "alta" ? "text-red-600" : "text-blue-600"}`}>
        {x.contrib_pp >= 0 ? "+" : ""}
        {x.contrib_pp.toFixed(3)} p.p.
      </span>
    </div>
  );
  return (
    <div className="w-full min-w-0 rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-[#027DFC]">Maiores influências do mês</h3>
      <p className="mb-3 mt-1 text-xs text-zinc-600">
        {formatMes(mes)} · top 10 altas e quedas (p.p. = variação × peso ÷ 100)
      </p>
      <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-700">Maiores altas</p>
          {top_altas.map((x, i) => (
            <Item key={i} x={x} kind="alta" />
          ))}
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-700">Maiores quedas</p>
          {top_quedas.map((x, i) => (
            <Item key={i} x={x} kind="queda" />
          ))}
        </div>
      </div>
      <p className="mt-2">
        <DataStamp giro={data.gerado_em} dado={mes} />
      </p>
    </div>
  );
}

function NucleosChart({ data }: { data: IpcaData }) {
  const serie = data.nucleos.serie;
  const labels = ["IPCA cheio", "MA", "MS", "EX0", "EX3", "DP", "P"];
  const cores = ["#000", "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b"];

  const series12m = useMemo(() => {
    const out = serie.map((d) => ({ mes: d.mes }) as Record<string, number | string | null>);
    labels.forEach((l) => {
      const r = rolling12(serie as SerieGrupo[], l);
      out.forEach((d, i) => {
        d[l] = r[i];
      });
    });
    return out.filter((d) => d["MA"] != null);
  }, [serie]);

  return (
    <div className="w-full min-w-0 rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-[#027DFC]">Núcleos de inflação (12m)</h3>
      <p className="mb-3 mt-1 text-xs text-zinc-600">
        Medidas de inflação subjacente do BC — MA: médias aparadas; MS: MA suavizada; EX0 e EX3: por exclusão; DP: dupla
        ponderação; P: subjacente.
      </p>
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <LineChart data={series12m} margin={{ top: 10, right: 24, bottom: 10, left: 0 }}>
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
            {labels.map((l, i) => (
              <Line
                key={l}
                dataKey={l}
                stroke={cores[i]}
                strokeWidth={l === "IPCA cheio" ? 2 : 1.2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2">
        <DataStamp giro={data.gerado_em} dado={serie[serie.length - 1]?.mes} />
      </p>
    </div>
  );
}

function DifusaoChart({ data }: { data: IpcaData }) {
  const serie = data.difusao.serie;
  return (
    <div className="w-full min-w-0 rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-[#027DFC]">Índice de difusão</h3>
      <p className="mb-3 mt-1 text-xs text-zinc-600">
        % de subitens do IPCA com alta no mês. Acima de 60% indica inflação espalhada; abaixo de 50%, concentrada em poucos itens.
      </p>
      <div style={{ width: "100%", height: 240 }}>
        <ResponsiveContainer>
          <LineChart data={serie} margin={{ top: 10, right: 24, bottom: 10, left: 0 }}>
            <CartesianGrid stroke="#eee" vertical={false} />
            <XAxis dataKey="mes" tickFormatter={formatMes} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="%" domain={[30, 80]} />
            <Tooltip
              labelFormatter={(l) => formatMes(String(l))}
              formatter={(v) => (v == null || typeof v !== "number" ? "—" : `${v.toFixed(1)}%`)}
            />
            <ReferenceLine y={50} stroke="#9ca3af" strokeDasharray="3 3" />
            <Line dataKey="difusao" stroke="#7c3aed" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2">
        <DataStamp giro={data.gerado_em} dado={serie[serie.length - 1]?.mes} />
      </p>
    </div>
  );
}

function CategoriasChart({ data }: { data: IpcaData }) {
  const serie = data.categorias?.serie;
  const labels = ["Servicos", "Livres", "Monitorados", "Comercializaveis"];
  const labelExibicao: Record<string, string> = {
    Servicos: "Serviços",
    Livres: "Livres",
    Monitorados: "Monitorados",
    Comercializaveis: "Comercializáveis",
  };
  const cores: Record<string, string> = {
    Servicos: "#132960",
    Livres: "#027DFC",
    Monitorados: "#F59E0B",
    Comercializaveis: "#16A34A",
  };
  const series12m = useMemo(() => {
    if (!serie) return [];
    const out = serie.map((d) => ({ mes: d.mes }) as Record<string, number | string | null>);
    labels.forEach((l) => {
      const r = rolling12(serie as SerieGrupo[], l);
      out.forEach((d, i) => {
        d[labelExibicao[l]] = r[i];
      });
    });
    return out.filter((d) => d[labelExibicao["Servicos"]] != null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serie]);

  if (!serie || serie.length === 0) return null;

  return (
    <div className="w-full min-w-0 rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-[#027DFC]">Categorias econômicas (12m)</h3>
      <p className="mb-3 mt-1 text-xs text-zinc-600">
        Serviços × Livres × Monitorados × Comercializáveis. Mostra qual natureza de preço tem pressionado a inflação.
      </p>
      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>
          <LineChart data={series12m} margin={{ top: 10, right: 24, bottom: 10, left: 0 }}>
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
            {labels.map((l) => (
              <Line key={l} dataKey={labelExibicao[l]} stroke={cores[l]} strokeWidth={1.5} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2">
        <DataStamp giro={data.gerado_em} dado={serie[serie.length - 1]?.mes} />
      </p>
    </div>
  );
}

function FocusChart({ data }: { data: IpcaData }) {
  const focus = data.focus;
  if (!focus || Object.keys(focus).length === 0) return null;

  const anos = Object.keys(focus).sort();
  const dataMap: Record<string, Record<string, number | string | null>> = {};
  for (const ano of anos) {
    for (const ponto of focus[ano]) {
      if (!dataMap[ponto.data]) dataMap[ponto.data] = { data: ponto.data };
      dataMap[ponto.data][ano] = ponto.mediana;
    }
  }
  const serie = Object.values(dataMap).sort((a, b) => String(a.data).localeCompare(String(b.data)));
  const coresAno = ["#132960", "#027DFC", "#94A3B8"];

  return (
    <div className="w-full min-w-0 rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-[#027DFC]">Expectativas Focus — mediana</h3>
      <p className="mb-3 mt-1 text-xs text-zinc-600">
        Projeção mediana do mercado pra IPCA acumulado em cada ano de referência, ao longo do tempo. Fonte: BCB Olinda.
      </p>
      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>
          <LineChart data={serie} margin={{ top: 10, right: 24, bottom: 10, left: 0 }}>
            <CartesianGrid stroke="#eee" vertical={false} />
            <XAxis
              dataKey="data"
              tickFormatter={(d: string) => {
                const [y, m] = d.split("-");
                return `${m}/${y.slice(2)}`;
              }}
              tick={{ fontSize: 11 }}
              minTickGap={40}
            />
            <YAxis tick={{ fontSize: 11 }} unit="%" />
            <Tooltip
              labelFormatter={(l) => String(l)}
              formatter={(v, n) =>
                v == null || typeof v !== "number" ? ["—", `IPCA ${n}`] : [`${v.toFixed(2)}%`, `IPCA ${n}`]
              }
            />
            <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => `IPCA ${v}`} />
            {anos.map((ano, i) => (
              <Line key={ano} dataKey={ano} stroke={coresAno[i % coresAno.length]} strokeWidth={1.5} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2">
        <DataStamp giro={data.gerado_em} dado={lastSeriesDate(serie)} />
      </p>
    </div>
  );
}

function TabelaInfluencias({ data }: { data: IpcaData }) {
  const { mes, top_altas, top_quedas } = data.maiores_influencias;
  type SortKey = "contrib_pp" | "var" | "peso";
  const [sortBy, setSortBy] = useState<SortKey>("contrib_pp");
  const [filtro, setFiltro] = useState("");

  const visiveis = useMemo(() => {
    const todos = [...top_altas, ...top_quedas];
    const f = filtro.trim().toLowerCase();
    return todos
      .filter((x) => f === "" || x.subitem.toLowerCase().includes(f))
      .slice()
      .sort((a, b) => Math.abs(b[sortBy]) - Math.abs(a[sortBy]));
  }, [top_altas, top_quedas, sortBy, filtro]);

  return (
    <div className="w-full min-w-0 rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-[#027DFC]">Tabela de subitens</h3>
          <p className="mt-1 text-xs text-zinc-600">
            Top 10 altas + top 10 quedas do mês ({formatMes(mes)}). Clique nas colunas pra reordenar; filtre pelo nome.
          </p>
        </div>
        <input
          type="text"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Filtrar subitem…"
          className="rounded-md border border-[#132960]/20 px-3 py-1.5 text-xs focus:border-[#132960] focus:outline-none"
        />
      </div>
      <div className="overflow-x-auto rounded-lg border border-zinc-100">
        <table className="min-w-full text-xs">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-zinc-700">Subitem</th>
              {(
                [
                  ["var", "Var. mensal (%)"],
                  ["peso", "Peso (%)"],
                  ["contrib_pp", "Contrib. (p.p.)"],
                ] as Array<[SortKey, string]>
              ).map(([key, label]) => (
                <th
                  key={key}
                  className="cursor-pointer px-3 py-2 text-right font-semibold text-zinc-700 hover:text-[#132960]"
                  onClick={() => setSortBy(key)}
                >
                  {label} {sortBy === key ? "↓" : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white">
            {visiveis.map((x, i) => (
              <tr key={`${x.subitem}-${i}`} className="hover:bg-zinc-50">
                <td className="whitespace-nowrap px-3 py-1.5 text-zinc-700">{x.subitem}</td>
                <td
                  className={`whitespace-nowrap px-3 py-1.5 text-right font-mono tabular-nums ${
                    x.var >= 0 ? "text-red-600" : "text-blue-600"
                  }`}
                >
                  {x.var >= 0 ? "+" : ""}
                  {x.var.toFixed(2)}
                </td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono tabular-nums text-zinc-700">
                  {x.peso.toFixed(2)}
                </td>
                <td
                  className={`whitespace-nowrap px-3 py-1.5 text-right font-mono tabular-nums ${
                    x.contrib_pp >= 0 ? "text-red-600" : "text-blue-600"
                  }`}
                >
                  {x.contrib_pp >= 0 ? "+" : ""}
                  {x.contrib_pp.toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2">
        <DataStamp giro={data.gerado_em} dado={mes} />
      </p>
    </div>
  );
}

export function IpcaDashboard({ data }: { data: IpcaData }) {
  const last = data.ipca_cheio.serie.find((d) => d.mes === data.mes_recente);
  const ipcaM = typeof last?.["IPCA cheio"] === "number" ? (last["IPCA cheio"] as number) : null;
  const ipca12m = typeof last?.["IPCA 12m"] === "number" ? (last["IPCA 12m"] as number) : null;
  const meta = 3.0;
  const dist = ipca12m != null ? ipca12m - meta : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[#132960]">Painel IPCA</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Mês de referência: <strong>{formatMes(data.mes_recente)}</strong>
          <span className="mx-2 text-zinc-300">·</span>
          IPCA mensal: <strong className="text-[#132960]">{ipcaM?.toFixed(2)}%</strong>
          <span className="mx-2 text-zinc-300">·</span>
          IPCA 12m: <strong className="text-[#132960]">{ipca12m?.toFixed(2)}%</strong>
          <span className="mx-2 text-zinc-300">·</span>
          Meta BC: 3,0% ± 1,5 p.p.
          {dist != null && (
            <span
              className={`ml-2 inline-block rounded px-2 py-0.5 text-xs font-medium ${
                Math.abs(dist) <= 1.5 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
              }`}
            >
              {dist >= 0 ? "+" : ""}
              {dist.toFixed(2)} p.p. vs meta
            </span>
          )}
        </p>
      </header>

      <AnchorChart data={data} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MaioresInfluencias data={data} />
        <NucleosChart data={data} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CategoriasChart data={data} />
        <FocusChart data={data} />
      </div>

      <DifusaoChart data={data} />

      <TabelaInfluencias data={data} />

      <footer className="border-t border-zinc-200 pt-4 text-xs text-zinc-500">
        Fontes: IBGE (SIDRA tabelas 7060 e 7062) · BCB SGS (núcleos e difusão) · BCB Olinda (Focus). Dados gerados em{" "}
        {data.gerado_em}.
      </footer>
    </div>
  );
}
