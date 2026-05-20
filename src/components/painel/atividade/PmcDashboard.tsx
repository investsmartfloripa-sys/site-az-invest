"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  type AtividadePmcData,
  HORIZONTES_MENSAIS,
  formatMes,
  tail,
} from "@/lib/painel-atividade";
import {
  CardHeader,
  COR_ACENTO,
  COR_PRIMARIA,
  KPI,
  Toggle,
  formatDivulgadoEm,
  useHorizonte,
} from "./AtividadeShell";

export function PmcDashboard({ data }: { data: AtividadePmcData }) {
  const mesH = useHorizonte(
    HORIZONTES_MENSAIS.map((h) => ({ value: h.label, label: h.label, n: h.n })) as any,
    "24m",
  );

  const serie = useMemo(() => tail(data.serie, mesH.n), [data.serie, mesH.n]);
  const ultimo = serie[serie.length - 1];

  const chartData = serie.map((s) => ({
    mes: formatMes(s.mes as string),
    restrito: s.restrito_volume_indice_sa,
    ampliado: s.ampliado_volume_indice_sa,
  }));

  return (
    <div className="space-y-6">
      <CardHeader
        titulo="PMC — Comércio Varejista"
        subtitulo="IBGE / Pesquisa Mensal de Comércio. Volume deflacionado, base 2022=100."
        divulgadoEm={formatDivulgadoEm(data.gerado_em)}
        periodoReferencia={formatMes(data.mes_recente)}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPI
          label="Restrito — Volume MoM SA"
          value={ultimo?.restrito_volume_var_mom_sa}
          unit="%"
          trend={
            typeof ultimo?.restrito_volume_var_mom_sa === "number"
              ? (ultimo.restrito_volume_var_mom_sa as number) >= 0
                ? "up"
                : "down"
              : "neutral"
          }
        />
        <KPI
          label="Restrito — Variação anual"
          value={ultimo?.restrito_volume_var_yoy}
          unit="%"
          trend={
            typeof ultimo?.restrito_volume_var_yoy === "number"
              ? (ultimo.restrito_volume_var_yoy as number) >= 0
                ? "up"
                : "down"
              : "neutral"
          }
        />
        <KPI
          label="Ampliado — Volume MoM SA"
          value={ultimo?.ampliado_volume_var_mom_sa}
          unit="%"
          trend={
            typeof ultimo?.ampliado_volume_var_mom_sa === "number"
              ? (ultimo.ampliado_volume_var_mom_sa as number) >= 0
                ? "up"
                : "down"
              : "neutral"
          }
        />
        <KPI
          label="Ampliado — Variação anual"
          value={ultimo?.ampliado_volume_var_yoy}
          unit="%"
          trend={
            typeof ultimo?.ampliado_volume_var_yoy === "number"
              ? (ultimo.ampliado_volume_var_yoy as number) >= 0
                ? "up"
                : "down"
              : "neutral"
          }
          hint="Inclui veículos + materiais de construção"
        />
      </div>

      <section className="rounded-2xl border border-[#132960]/15 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[#132960]">
            Volume de vendas — índice SA, Restrito × Ampliado
          </h2>
          <Toggle size="sm" value={mesH.horizonte} onChange={mesH.setHorizonte as any} options={mesH.options as any} />
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
            <Tooltip
              formatter={(v: any, name: any) =>
                typeof v === "number" ? [v.toFixed(2), String(name)] : [v, String(name)]
              }
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="restrito"
              name="Varejo restrito"
              stroke={COR_PRIMARIA}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="ampliado"
              name="Varejo ampliado"
              stroke={COR_ACENTO}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
        <p className="mt-2 text-[11px] text-zinc-500">
          Restrito é o número manchete do IBGE (9 atividades); ampliado inclui veículos e materiais de construção. Diferenças
          entre as duas linhas costumam ser puxadas por autos.
        </p>
      </section>

      {data.atividades.restrito_top_altas.length > 0 && (
        <section className="rounded-2xl border border-[#132960]/15 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-[#132960]">
            Ranking de atividades — variação anual (Restrito, {formatMes(data.atividades.mes)})
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <RankingMini titulo="Top 5 altas" itens={data.atividades.restrito_top_altas} positivo />
            <RankingMini titulo="Top 5 quedas" itens={data.atividades.restrito_top_quedas} positivo={false} />
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
