"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
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
  type AtividadePmcData,
  HORIZONTES_MENSAIS,
  formatMes,
  tail,
} from "@/lib/painel-atividade";
import {
  CardHeader,
  COR_ACENTO,
  COR_NEGATIVO,
  COR_POSITIVO,
  COR_PRIMARIA,
  Heatmap,
  KPI,
  RankingTable,
  Section,
  Toggle,
  formatDivulgadoEm,
  useHorizonte,
} from "./AtividadeShell";

type Tipo = "volume" | "receita_nominal";
type Escopo = "restrito" | "ampliado";

export function PmcDashboard({ data }: { data: AtividadePmcData }) {
  const mesH = useHorizonte(
    HORIZONTES_MENSAIS.map((h) => ({ value: h.label, label: h.label, n: h.n })) as any,
    "36m",
  );
  const [tipo, setTipo] = useState<Tipo>("volume");
  const [escopo, setEscopo] = useState<Escopo>("restrito");

  const serie = useMemo(() => tail(data.serie, mesH.n), [data.serie, mesH.n]);
  const ultimo = serie[serie.length - 1];

  // Gráfico 1: restrito × ampliado no índice SA do tipo selecionado
  const chartData = serie.map((s) => ({
    mes: formatMes(s.mes as string),
    restrito: s[`restrito_${tipo}_indice_sa`],
    ampliado: s[`ampliado_${tipo}_indice_sa`],
  }));

  // Gráfico 2: gap ampliado − restrito (somente volume)
  const gapData = serie.map((s) => ({
    mes: formatMes(s.mes as string),
    gap: s["gap_yoy"],
  }));

  // Gráfico 3: Volume × Receita Nominal (mostra inflação no varejo)
  const inflacaoData = serie.map((s) => ({
    mes: formatMes(s.mes as string),
    Volume: s[`${escopo}_volume_var_yoy`],
    "Receita nominal": s[`${escopo}_receita_nominal_var_yoy`],
  }));

  // Atividades — mês recente
  const atividadesMes = escopo === "restrito" ? data.atividades.restrito_mensal : data.atividades.ampliado_mensal;
  const atividadesRecentes = atividadesMes[data.mes_recente] ?? [];
  const rankingItems = atividadesRecentes.map((a) => ({
    nome: a.atividade,
    var_yoy: a.var_yoy,
    var_mom_sa: a.var_mom_sa,
    var_acum_12m: a.var_acum_12m,
    indice_sa: a.indice_sa,
  }));

  // Heatmap atividades × meses (todas)
  const mesesUlt = serie.slice(-12).map((s) => s.mes as string);
  const heatmapRows = atividadesRecentes.map((a) => a.atividade);
  const heatmapValues = atividadesRecentes.map((a) =>
    mesesUlt.map((m) => {
      const found = atividadesMes[m]?.find((x) => x.id === a.id);
      return found?.var_yoy ?? null;
    }),
  );
  const heatmapCols = mesesUlt.map((m) => formatMes(m).slice(0, 3));

  return (
    <div className="space-y-6">
      <CardHeader
        titulo="PMC — Comércio Varejista"
        subtitulo="IBGE / Pesquisa Mensal de Comércio. Base 2022=100. Volume é deflacionado (manchete); receita nominal carrega inflação."
        divulgadoEm={formatDivulgadoEm(data.gerado_em)}
        periodoReferencia={formatMes(data.mes_recente)}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPI
          label="Restrito Vol. — MoM SA"
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
          label="Restrito Vol. — YoY"
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
          label="Ampliado Vol. — YoY"
          value={ultimo?.ampliado_volume_var_yoy}
          unit="%"
          trend={
            typeof ultimo?.ampliado_volume_var_yoy === "number"
              ? (ultimo.ampliado_volume_var_yoy as number) >= 0
                ? "up"
                : "down"
              : "neutral"
          }
          hint="Inclui veículos + construção"
        />
        <KPI
          label="Gap (ampliado − restrito)"
          value={ultimo?.gap_yoy}
          unit="pp"
          trend={typeof ultimo?.gap_yoy === "number" ? (ultimo.gap_yoy >= 0 ? "up" : "down") : "neutral"}
          hint="Quanto autos/constr puxam"
        />
      </div>

      <Section
        titulo="Índice SA — Restrito × Ampliado"
        rightSlot={
          <div className="flex flex-wrap gap-2">
            <Toggle
              size="sm"
              value={tipo}
              onChange={setTipo}
              options={[
                { value: "volume", label: "Volume" },
                { value: "receita_nominal", label: "Receita nominal" },
              ]}
            />
            <Toggle size="sm" value={mesH.horizonte} onChange={mesH.setHorizonte as any} options={mesH.options as any} />
          </div>
        }
        hint="Restrito = comércio puro (9 atividades). Ampliado = adiciona veículos + materiais de construção (mais volátil). Quando as duas linhas descolam, veículos costuma ser o motivo."
      >
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
            <Line type="monotone" dataKey="restrito" name="Varejo restrito" stroke={COR_PRIMARIA} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="ampliado" name="Varejo ampliado" stroke={COR_ACENTO} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Section>

      <Section
        titulo="Gap ampliado − restrito (variação anual, pp)"
        hint="Quanto o varejo ampliado (incluindo autos e materiais de construção) supera o varejo restrito em pontos percentuais. Quando positivo, veículos/construção estão acelerando o consumo agregado."
      >
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={gapData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="pp" />
            <Tooltip
              formatter={(v: any) => (typeof v === "number" ? [`${v.toFixed(2)} pp`, "Gap"] : [v, "Gap"])}
            />
            <Bar dataKey="gap" radius={[2, 2, 0, 0]}>
              {gapData.map((d, i) => (
                <rect key={i} fill={(typeof d.gap === "number" ? d.gap : 0) >= 0 ? COR_POSITIVO : COR_NEGATIVO} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Section>

      <Section
        titulo="Volume × Receita nominal — variação anual"
        rightSlot={
          <Toggle
            size="sm"
            value={escopo}
            onChange={setEscopo}
            options={[
              { value: "restrito", label: "Restrito" },
              { value: "ampliado", label: "Ampliado" },
            ]}
          />
        }
        hint="O gap entre Receita nominal e Volume é aproximadamente a inflação nas vendas (cesta varejo). Útil pra ler pressão de preços no comércio."
      >
        <ResponsiveContainer width="100%" height={280}>
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
      </Section>

      <Section
        titulo={`Heatmap — atividades do comércio ${escopo} (variação anual %) — últimos 12 meses`}
      >
        <Heatmap rows={heatmapRows} cols={heatmapCols} values={heatmapValues} />
      </Section>

      <Section titulo={`Ranking de atividades (${escopo}) — ${formatMes(data.mes_recente)}`}>
        <RankingTable items={rankingItems} colunaPrincipal="var_yoy" labelPrincipal="Var. anual" />
      </Section>

      <footer className="text-[11px] text-zinc-500">{data.metadata.nota}</footer>
    </div>
  );
}
