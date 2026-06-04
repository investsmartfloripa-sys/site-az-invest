"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  type AtividadePmsData,
  HORIZONTES_MENSAIS,
  formatMes,
  tail,
} from "@/lib/painel-atividade";
import {
  CardHeader,
  CORES_SERIES,
  COR_ACENTO,
  COR_PRIMARIA,
  Heatmap,
  KPI,
  RankingTable,
  Section,
  Toggle,
  formatDivulgadoEm,
  useHorizonte,
} from "./AtividadeShell";
import DataStamp from "@/components/painel/DataStamp";

type Detalhe = "segmentos" | "atividades";

export function PmsDashboard({ data }: { data: AtividadePmsData }) {
  const mesH = useHorizonte(
    HORIZONTES_MENSAIS.map((h) => ({ value: h.label, label: h.label, n: h.n })) as any,
    "36m",
  );
  const [detalhe, setDetalhe] = useState<Detalhe>("segmentos");

  const serie = useMemo(() => tail(data.serie, mesH.n), [data.serie, mesH.n]);
  const ultimo = serie[serie.length - 1];

  const chartData = serie.map((s) => ({
    mes: formatMes(s.mes as string),
    var_mom_sa: s.volume_var_mom_sa,
    indice_sa: s.volume_indice_sa,
  }));

  // Volume × Receita
  const inflacaoData = serie.map((s) => ({
    mes: formatMes(s.mes as string),
    Volume: s.volume_var_yoy,
    "Receita nominal": s.receita_var_yoy,
  }));

  // Turismo
  const turismo = data.turismo?.serie ?? [];
  const turismoTail = useMemo(() => tail(turismo, mesH.n), [turismo, mesH.n]);
  const turismoData = turismoTail.map((s) => ({
    mes: formatMes(s.mes as string),
    Volume: s["volume_var_yoy"],
    "Receita nominal": s["receita_var_yoy"],
  }));

  // Transportes — extrai chaves disponíveis
  const transportes = data.transportes?.serie ?? [];
  const transportesKeys = transportes.length
    ? Object.keys(transportes[transportes.length - 1])
        .filter((k) => k.endsWith("_var_yoy"))
        .map((k) => k.replace("_var_yoy", ""))
        .filter((k) => k !== "mes")
    : [];
  const transportesTail = useMemo(() => tail(transportes, mesH.n), [transportes, mesH.n]);
  const transportesChart = transportesTail.map((s) => {
    const r: any = { mes: formatMes(s.mes as string) };
    for (const k of transportesKeys) {
      r[k] = s[`${k}_var_yoy`];
    }
    return r;
  });

  // Categorias — segmentos ou atividades
  const cats = detalhe === "segmentos" ? data.segmentos : data.atividades;
  const catRecentes = cats.serie_mensal[data.mes_recente] ?? [];
  const rankingItems = catRecentes.map((c) => ({
    nome: c.categoria,
    var_yoy: c.var_yoy,
    var_mom_sa: c.var_mom_sa,
    var_acum_12m: c.var_acum_12m,
    indice_sa: c.indice_sa,
  }));

  // Heatmap
  const mesesUlt = serie.slice(-12).map((s) => s.mes as string);
  const ranked = [...catRecentes].sort(
    (a, b) => Math.abs((b.var_yoy ?? 0) as number) - Math.abs((a.var_yoy ?? 0) as number),
  ).slice(0, 14);
  const heatmapRows = ranked.map((r) => r.categoria);
  const heatmapValues = ranked.map((r) =>
    mesesUlt.map((m) => {
      const found = cats.serie_mensal[m]?.find((x) => x.id === r.id);
      return found?.var_yoy ?? null;
    }),
  );
  const heatmapCols = mesesUlt.map((m) => formatMes(m).slice(0, 3));

  return (
    <div className="space-y-6">
      <CardHeader
        titulo="PMS — Pesquisa Mensal de Serviços"
        subtitulo="IBGE / PMS. Base 2022=100. Inclui segmentos detalhados, atividades, atividades turísticas (PMS especial) e transporte de passageiros vs cargas."
        divulgadoEm={formatDivulgadoEm(data.gerado_em)}
        periodoReferencia={formatMes(data.mes_recente)}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPI
          label="Volume MoM SA"
          value={ultimo?.volume_var_mom_sa}
          unit="%"
          trend={
            typeof ultimo?.volume_var_mom_sa === "number"
              ? (ultimo.volume_var_mom_sa as number) >= 0 ? "up" : "down"
              : "neutral"
          }
          hint="Manchete IBGE"
        />
        <KPI
          label="Volume YoY"
          value={ultimo?.volume_var_yoy}
          unit="%"
          trend={
            typeof ultimo?.volume_var_yoy === "number"
              ? (ultimo.volume_var_yoy as number) >= 0 ? "up" : "down"
              : "neutral"
          }
        />
        <KPI label="Acumulado no ano" value={ultimo?.volume_var_acum_ano} unit="%" />
        <KPI label="Acumulado 12m" value={ultimo?.volume_var_acum_12m} unit="%" />
      </div>

      <Section
        titulo="Volume de serviços — Índice SA + variação mensal SA"
        rightSlot={
          <Toggle size="sm" value={mesH.horizonte} onChange={mesH.setHorizonte as any} options={mesH.options as any} />
        }
      >
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
            <Line yAxisId="right" type="monotone" dataKey="indice_sa" name="Índice SA (2022=100)" stroke={COR_PRIMARIA} strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="mt-2">
          <DataStamp giro={data.gerado_em} dado={serie[serie.length - 1]?.mes} />
        </p>
      </Section>

      <Section
        titulo="Volume × Receita nominal — variação anual"
        hint="Gap mede inflação nos serviços. Em serviços é normal o gap ser persistente (serviços inflam mais que bens)."
      >
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={inflacaoData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="%" />
            <Tooltip
              formatter={(v: any, name: any) =>
                typeof v === "number" ? [`${v.toFixed(2)}%`, String(name)] : [v, String(name)]
              }
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="Volume" stroke={COR_PRIMARIA} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Receita nominal" stroke={COR_ACENTO} strokeWidth={2} strokeDasharray="4 3" dot={false} />
          </LineChart>
        </ResponsiveContainer>
        <p className="mt-2">
          <DataStamp giro={data.gerado_em} dado={serie[serie.length - 1]?.mes} />
        </p>
      </Section>

      {turismoData.length > 0 && (
        <Section
          titulo="Atividades turísticas — variação anual (volume × receita)"
          hint="Sub-índice especial da PMS, sensível a sazonalidade e câmbio."
        >
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={turismoData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip
                formatter={(v: any, name: any) =>
                  typeof v === "number" ? [`${v.toFixed(2)}%`, String(name)] : [v, String(name)]
                }
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Volume" stroke={COR_PRIMARIA} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Receita nominal" stroke={COR_ACENTO} strokeWidth={2} strokeDasharray="4 3" dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <p className="mt-2">
            <DataStamp giro={data.gerado_em} dado={turismoTail[turismoTail.length - 1]?.mes} />
          </p>
        </Section>
      )}

      {transportesChart.length > 0 && transportesKeys.length > 0 && (
        <Section
          titulo="Transporte de passageiros e cargas — variação anual"
          hint="Sinal de demanda agregada. Passageiros sensível a renda/turismo; cargas a comércio e indústria."
        >
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={transportesChart} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip
                formatter={(v: any, name: any) =>
                  typeof v === "number" ? [`${v.toFixed(2)}%`, String(name)] : [v, String(name)]
                }
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {transportesKeys.map((k, i) => (
                <Line key={k} type="monotone" dataKey={k} stroke={CORES_SERIES[i % CORES_SERIES.length]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <p className="mt-2">
            <DataStamp giro={data.gerado_em} dado={transportesTail[transportesTail.length - 1]?.mes} />
          </p>
        </Section>
      )}

      <Section
        titulo={`Heatmap — top 14 ${detalhe} por amplitude (variação anual %) — últimos 12 meses`}
        rightSlot={
          <Toggle
            size="sm"
            value={detalhe}
            onChange={setDetalhe}
            options={[
              { value: "segmentos", label: "Segmentos (20)" },
              { value: "atividades", label: "Atividades (29)" },
            ]}
          />
        }
      >
        <Heatmap rows={heatmapRows} cols={heatmapCols} values={heatmapValues} />
        <p className="mt-2">
          <DataStamp giro={data.gerado_em} dado={data.mes_recente} />
        </p>
      </Section>

      <Section titulo={`Ranking completo de ${detalhe} — ${formatMes(data.mes_recente)}`}>
        <RankingTable items={rankingItems} colunaPrincipal="var_yoy" labelPrincipal="Var. anual" />
        <p className="mt-2">
          <DataStamp giro={data.gerado_em} dado={data.mes_recente} />
        </p>
      </Section>

      <footer className="text-[11px] text-zinc-500">{data.metadata.nota}</footer>
    </div>
  );
}
