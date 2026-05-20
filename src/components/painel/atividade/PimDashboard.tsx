"use client";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  type AtividadePimData,
  HORIZONTES_MENSAIS,
  formatMes,
  tail,
} from "@/lib/painel-atividade";
import {
  CardHeader,
  CORES_SERIES,
  COR_ACENTO,
  COR_PRIMARIA,
  KPI,
  Toggle,
  formatDivulgadoEm,
  useHorizonte,
} from "./AtividadeShell";

export function PimDashboard({ data }: { data: AtividadePimData }) {
  const mesH = useHorizonte(
    HORIZONTES_MENSAIS.map((h) => ({ value: h.label, label: h.label, n: h.n })) as any,
    "24m",
  );

  const serie = useMemo(() => tail(data.geral.serie, mesH.n), [data.geral.serie, mesH.n]);
  const ultimo = serie[serie.length - 1];

  const chartData = serie.map((s) => ({
    mes: formatMes(s.mes),
    var_mom_sa: s.var_mom_sa,
    indice_sa: s.indice_sa,
  }));

  const catSerie = useMemo(
    () => tail(data.categorias_economicas.serie, mesH.n),
    [data.categorias_economicas.serie, mesH.n],
  );

  const categorias = data.categorias_economicas.categorias;
  const catChart = catSerie.map((s) => {
    const r: any = { mes: formatMes(s.mes as string) };
    for (const cat of categorias) {
      r[cat] = s[`yoy_${cat}`];
    }
    return r;
  });

  return (
    <div className="space-y-6">
      <CardHeader
        titulo="PIM-PF — Produção Industrial"
        subtitulo="IBGE / Pesquisa Industrial Mensal — Produção Física. Base 2022=100."
        divulgadoEm={formatDivulgadoEm(data.gerado_em)}
        periodoReferencia={formatMes(data.mes_recente)}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPI
          label="Variação mensal SA"
          value={ultimo?.var_mom_sa}
          unit="%"
          trend={typeof ultimo?.var_mom_sa === "number" ? (ultimo.var_mom_sa >= 0 ? "up" : "down") : "neutral"}
          hint="Manchete IBGE"
        />
        <KPI
          label="Variação anual"
          value={ultimo?.var_yoy}
          unit="%"
          trend={typeof ultimo?.var_yoy === "number" ? (ultimo.var_yoy >= 0 ? "up" : "down") : "neutral"}
        />
        <KPI label="Acumulada no ano" value={ultimo?.var_acum_ano} unit="%" />
        <KPI label="Acumulada 12 meses" value={ultimo?.var_acum_12m} unit="%" />
      </div>

      <section className="rounded-2xl border border-[#132960]/15 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[#132960]">
            Indústria geral — índice SA (linha) + variação mensal SA (barras)
          </h2>
          <Toggle size="sm" value={mesH.horizonte} onChange={mesH.setHorizonte as any} options={mesH.options as any} />
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} unit="%" />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(v: any, name: any) => {
                const n = String(name);
                return typeof v === "number" ? [n.includes("Índice") ? v.toFixed(2) : `${v.toFixed(2)}%`, n] : [v, n];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="left" dataKey="var_mom_sa" name="Variação mensal SA" fill={COR_ACENTO} radius={[2, 2, 0, 0]} />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="indice_sa"
              name="Índice SA (2022=100)"
              stroke={COR_PRIMARIA}
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </section>

      <section className="rounded-2xl border border-[#132960]/15 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-[#132960]">
          Decomposição por categoria econômica — variação anual (%)
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={catChart} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="%" />
            <Tooltip
              formatter={(v: any, name: any) =>
                typeof v === "number" ? [`${v.toFixed(2)}%`, String(name)] : [v, String(name)]
              }
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {categorias.map((cat, i) => (
              <Line
                key={cat}
                type="monotone"
                dataKey={cat}
                stroke={CORES_SERIES[i % CORES_SERIES.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </section>

      {data.atividades_detalhe.top_altas.length > 0 && (
        <section className="rounded-2xl border border-[#132960]/15 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-[#132960]">
            Ranking de atividades — variação anual ({formatMes(data.atividades_detalhe.mes)})
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <RankingMini titulo="Top 5 altas" itens={data.atividades_detalhe.top_altas} positivo />
            <RankingMini titulo="Top 5 quedas" itens={data.atividades_detalhe.top_quedas} positivo={false} />
          </div>
        </section>
      )}

      <footer className="text-[11px] text-zinc-500">{data.metadata.nota}</footer>
    </div>
  );
}

function RankingMini({
  titulo,
  itens,
  positivo,
}: {
  titulo: string;
  itens: { atividade: string; var_yoy: number }[];
  positivo: boolean;
}) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">{titulo}</div>
      <ul className="space-y-1.5">
        {itens.map((it) => (
          <li key={it.atividade} className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate text-zinc-700">{it.atividade}</span>
            <span
              className="shrink-0 rounded px-1.5 py-0.5 font-semibold tabular-nums"
              style={{
                background: positivo ? "#dcfce7" : "#fee2e2",
                color: positivo ? "#15803d" : "#b91c1c",
              }}
            >
              {it.var_yoy >= 0 ? "+" : ""}
              {it.var_yoy.toFixed(2)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
