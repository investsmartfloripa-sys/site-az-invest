"use client";

import { useMemo } from "react";
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
  Heatmap,
  KPI,
  RankingTable,
  Section,
  Toggle,
  formatDivulgadoEm,
  useHorizonte,
} from "./AtividadeShell";
import DataStamp from "@/components/painel/DataStamp";

const CAT_LABELS: Record<string, string> = {
  bens_capital: "Bens de capital",
  bens_intermediarios: "Bens intermediários",
  bens_consumo: "Bens de consumo (total)",
  bens_consumo_duraveis: "Bens duráveis",
  bens_consumo_semi_nao_duraveis: "Semi e não duráveis",
  bens_consumo_semi_duraveis: "Semi duráveis",
  bens_consumo_nao_duraveis: "Não duráveis",
};

export function PimDashboard({ data }: { data: AtividadePimData }) {
  const mesH = useHorizonte(
    HORIZONTES_MENSAIS.map((h) => ({ value: h.label, label: h.label, n: h.n })) as any,
    "36m",
  );

  const serie = useMemo(() => tail(data.geral.serie, mesH.n), [data.geral.serie, mesH.n]);
  const ultimo = serie[serie.length - 1];

  const chartData = serie.map((s) => ({
    mes: formatMes(s.mes),
    var_mom_sa: s.var_mom_sa,
    indice_sa: s.indice_sa,
  }));

  // Categorias econômicas: 4 grandes blocos
  const catSerie = useMemo(() => tail(data.categorias_economicas.serie, mesH.n), [data.categorias_economicas.serie, mesH.n]);
  const catPrincipais = ["bens_capital", "bens_intermediarios", "bens_consumo_duraveis", "bens_consumo_semi_nao_duraveis"];
  const catChart = catSerie.map((s) => {
    const r: any = { mes: formatMes(s.mes as string) };
    for (const c of catPrincipais) r[CAT_LABELS[c] ?? c] = s[`${c}_var_yoy`];
    return r;
  });

  // Setores (extrativa vs transformação)
  const secSerie = useMemo(() => tail(data.secoes.serie, mesH.n), [data.secoes.serie, mesH.n]);
  const secChart = secSerie.map((s) => ({
    mes: formatMes(s.mes as string),
    "Indústria geral": s["industria_geral_var_yoy"],
    Extrativa: s["extrativa_var_yoy"],
    Transformação: s["transformacao_var_yoy"],
  }));

  // Construção (insumos)
  const construcao = data.construcao?.serie ?? [];
  const construcaoTail = useMemo(() => tail(construcao, mesH.n), [construcao, mesH.n]);
  const construcaoChart = construcaoTail.map((s) => ({
    mes: formatMes(s.mes),
    var_mom_sa: s.var_mom_sa,
    var_yoy: s.var_yoy,
    indice_sa: s.indice_sa,
  }));

  // Atividades — mês recente, todas as 24
  const atividadesRecentes = data.atividades.serie_mensal[data.mes_recente] ?? [];
  const rankingItems = atividadesRecentes.map((a) => ({
    nome: a.atividade,
    var_yoy: a.var_yoy,
    var_mom_sa: a.var_mom_sa,
    var_acum_12m: a.var_acum_12m,
    indice_sa: a.indice_sa,
  }));

  // Heatmap das top 10 atividades (com maior amplitude) × últimos 12 meses
  const mesesUlt = serie.slice(-12).map((s) => s.mes);
  const ranked = [...atividadesRecentes].sort(
    (a, b) =>
      (Math.abs((b.var_yoy ?? 0) as number)) - (Math.abs((a.var_yoy ?? 0) as number)),
  ).slice(0, 12);
  const heatmapRows = ranked.map((r) => r.atividade);
  const heatmapValues = ranked.map((r) =>
    mesesUlt.map((m) => {
      const found = data.atividades.serie_mensal[m]?.find((x) => x.id === r.id);
      return found?.var_yoy ?? null;
    }),
  );
  const heatmapCols = mesesUlt.map((m) => formatMes(m).slice(0, 3));

  return (
    <div className="space-y-6">
      <CardHeader
        titulo="PIM-PF — Produção Industrial"
        subtitulo="IBGE / Pesquisa Industrial Mensal — Produção Física. Base 2022=100. Inclui categorias econômicas, atividades CNAE e insumos da construção civil."
        divulgadoEm={formatDivulgadoEm(data.gerado_em)}
        periodoReferencia={formatMes(data.mes_recente)}
        info={data.metadata.nota}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPI
          label="Indústria geral — MoM SA"
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
        <KPI label="Acumulada 12m" value={ultimo?.var_acum_12m} unit="%" />
      </div>

      <Section
        titulo="Indústria geral — Índice SA + variação mensal SA"
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
        titulo="Decomposição cíclica — variação anual por categoria econômica"
        hint="Bens de capital reagem primeiro ao ciclo (investimento). Duráveis vêm depois (consumo financiado). Intermediários acompanham a produção geral."
      >
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={catChart} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="%" />
            <Tooltip
              formatter={(v: any, name: any) =>
                typeof v === "number" ? [`${v.toFixed(2)}%`, String(name)] : [v, String(name)]
              }
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {catPrincipais.map((c, i) => (
              <Line
                key={c}
                type="monotone"
                dataKey={CAT_LABELS[c] ?? c}
                stroke={CORES_SERIES[i % CORES_SERIES.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        <p className="mt-2">
          <DataStamp giro={data.gerado_em} dado={catSerie[catSerie.length - 1]?.mes} />
        </p>
      </Section>

      <Section
        titulo="Indústria extrativa × Transformação — variação anual"
        hint="Extrativa puxada por petróleo, minério, gás. Transformação reflete manufatura — mais sensível à demanda interna."
      >
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={secChart} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="%" />
            <Tooltip
              formatter={(v: any, name: any) =>
                typeof v === "number" ? [`${v.toFixed(2)}%`, String(name)] : [v, String(name)]
              }
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="Indústria geral" stroke={COR_PRIMARIA} strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="Extrativa" stroke={CORES_SERIES[1]} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Transformação" stroke={CORES_SERIES[2]} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
        <p className="mt-2">
          <DataStamp giro={data.gerado_em} dado={secSerie[secSerie.length - 1]?.mes} />
        </p>
      </Section>

      {construcaoChart.length > 0 && (
        <Section
          titulo="Insumos da construção civil — Índice SA e variação anual"
          hint="Sinal antecedente da rubrica Construção do PIB. Cimento, vergalhões, tijolos, etc."
        >
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={construcaoChart} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
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
              <Bar yAxisId="left" dataKey="var_yoy" name="Variação anual" fill={COR_ACENTO} radius={[2, 2, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="indice_sa" name="Índice SA (2022=100)" stroke={COR_PRIMARIA} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
          <p className="mt-2">
            <DataStamp giro={data.gerado_em} dado={construcaoTail[construcaoTail.length - 1]?.mes} />
          </p>
        </Section>
      )}

      <Section
        titulo={`Heatmap — top 12 atividades por amplitude (variação anual %) — últimos 12 meses`}
        hint="Ranking por amplitude (módulo da variação) — destaca atividades mais voláteis ou em movimento mais forte."
      >
        <Heatmap rows={heatmapRows} cols={heatmapCols} values={heatmapValues} />
        <p className="mt-2">
          <DataStamp giro={data.gerado_em} dado={data.mes_recente} />
        </p>
      </Section>

      <Section titulo={`Ranking completo das atividades industriais — ${formatMes(data.mes_recente)}`}>
        <RankingTable items={rankingItems} colunaPrincipal="var_yoy" labelPrincipal="Var. anual" />
        <p className="mt-2">
          <DataStamp giro={data.gerado_em} dado={data.mes_recente} />
        </p>
      </Section>
    </div>
  );
}
