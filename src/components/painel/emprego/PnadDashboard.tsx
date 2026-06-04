"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { PnadData } from "@/lib/painel-emprego";
import {
  Chip,
  DataTable,
  FMT_NUM_BR,
  Heatmap,
  KPICard,
  PieDistribution,
  RankingTable,
  Toggle,
  deltaPct,
  deltaPP,
  divergingScale,
  findSameTrimAnoAnterior,
  fmtPP,
  fmtPct,
  fmtTrim,
  sequentialScale,
} from "./shared";
import DataStamp from "@/components/painel/DataStamp";

const CORES = [
  "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
  "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
];

const CORES_POSICAO: Record<string, string> = {
  Empregado: "#3b82f6",
  Empregador: "#a855f7",
  "Conta própria": "#f97316",
  "Trab. familiar auxiliar": "#84cc16",
};

const CORES_SETOR_PNAD: Record<string, string> = {
  Agropecuária: "#84cc16",
  Indústria: "#3b82f6",
  Construção: "#f97316",
  Comércio: "#a855f7",
  "Transporte/armazenagem": "#06b6d4",
  "Alojamento/alimentação": "#ec4899",
  "Informação/financeiras": "#6366f1",
  "Adm pública/saúde/educação": "#10b981",
  "Outros serviços": "#94a3b8",
  "Serviços domésticos": "#fbbf24",
};

type Vista = "taxas" | "composicao" | "setor" | "cruzamentos" | "serie";

export function PnadDashboard({ data }: { data: PnadData }) {
  const [vista, setVista] = useState<Vista>("taxas");

  const trimRecente = data.taxas.serie[data.taxas.serie.length - 1];
  const trimAnoAnterior = findSameTrimAnoAnterior(data.taxas.serie, trimRecente.trim);

  // KPIs
  const desocAtual = trimRecente["Taxa de desocupação"] as number | undefined;
  const desocPrev = trimAnoAnterior?.["Taxa de desocupação"] as number | undefined;
  const partAtual = trimRecente["Taxa de participação na força de trabalho"] as number | undefined;
  const partPrev = trimAnoAnterior?.["Taxa de participação na força de trabalho"] as number | undefined;
  const informAtual = trimRecente["Taxa de informalidade"] as number | undefined;
  const informPrev = trimAnoAnterior?.["Taxa de informalidade"] as number | undefined;
  const subutilAtual = trimRecente["Taxa composta de subutilização"] as number | undefined;
  const subutilPrev = trimAnoAnterior?.["Taxa composta de subutilização"] as number | undefined;

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-[#132960]/15 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#132960]">PNAD — Mercado de Trabalho</h1>
            <p className="mt-1 text-xs text-zinc-500">
              IBGE / PNAD Contínua Trimestral · Trimestre de referência:{" "}
              <strong className="text-zinc-700">{fmtTrim(trimRecente.trim as string)}</strong>
            </p>
          </div>
          <Toggle
            value={vista}
            onChange={(v) => setVista(v as Vista)}
            options={[
              { value: "taxas", label: "Taxas" },
              { value: "composicao", label: "Composição" },
              { value: "setor", label: "Setor" },
              { value: "cruzamentos", label: "Cruzamentos" },
              { value: "serie", label: "Série completa" },
            ]}
          />
        </div>

        {/* KPIs sempre visíveis */}
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <KPICard
            label="Taxa de desocupação"
            value={fmtPct(desocAtual)}
            delta={deltaPP(desocAtual, desocPrev)}
            deltaUnit="p.p."
            invertColor // desocupação caindo é bom
            hint={`vs ${fmtTrim(trimAnoAnterior?.trim as string)}`}
          />
          <KPICard
            label="Taxa de participação"
            value={fmtPct(partAtual)}
            delta={deltaPP(partAtual, partPrev)}
            deltaUnit="p.p."
            hint="força de trabalho ÷ PIA"
          />
          <KPICard
            label="Taxa de informalidade"
            value={fmtPct(informAtual)}
            delta={deltaPP(informAtual, informPrev)}
            deltaUnit="p.p."
            invertColor
            hint="ocupados informais"
          />
          <KPICard
            label="Subutilização composta"
            value={fmtPct(subutilAtual)}
            delta={deltaPP(subutilAtual, subutilPrev)}
            deltaUnit="p.p."
            invertColor
            hint="desocup + sub + desal"
          />
        </div>
      </header>

      <div className="rounded-2xl border border-[#132960]/15 bg-white p-5 shadow-sm">
        {vista === "taxas" && <TaxasView data={data} />}
        {vista === "composicao" && <ComposicaoView data={data} />}
        {vista === "setor" && <SetorView data={data} />}
        {vista === "cruzamentos" && <CruzamentosView data={data} />}
        {vista === "serie" && <SerieCompletaView data={data} />}
        <p className="mt-2">
          <DataStamp
            giro={data.gerado_em}
            dado={
              vista === "composicao"
                ? data.composicao.serie[data.composicao.serie.length - 1]?.trim
                : vista === "setor"
                  ? data.setor.serie[data.setor.serie.length - 1]?.trim
                  : trimRecente.trim
            }
          />
        </p>
      </div>

      <footer className="text-xs text-zinc-500 border-t pt-3">
        {data.metadata.fonte}
        <br />
        <span className="text-zinc-400">Gerado em {data.gerado_em.slice(0, 19).replace("T", " ")} UTC</span>
      </footer>
    </div>
  );
}

// ============================================================
// Vista: Taxas
// ============================================================
function TaxasView({ data }: { data: PnadData }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const indicadores = data.taxas.indicadores;
  const visiveis = indicadores.filter((i) => !hidden.has(i));

  const toggleHide = (k: string) => {
    const next = new Set(hidden);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setHidden(next);
  };

  return (
    <>
      <div style={{ width: "100%", height: 380 }}>
        <ResponsiveContainer>
          <LineChart data={data.taxas.serie} margin={{ top: 10, right: 24, bottom: 10, left: 0 }}>
            <CartesianGrid stroke="#eee" vertical={false} />
            <XAxis dataKey="trim" tickFormatter={fmtTrim} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, "auto"]} />
            <Tooltip
              labelFormatter={(label) => fmtTrim(String(label ?? ""))}
              formatter={(value, name) => {
                const v = typeof value === "number" ? value : Number(value);
                const nm = String(name ?? "");
                return Number.isFinite(v) ? [v.toFixed(1) + "%", nm] : ["—", nm];
              }}
            />
            {visiveis.map((ind) => (
              <Line
                key={ind}
                dataKey={ind}
                stroke={CORES[indicadores.indexOf(ind) % CORES.length]}
                strokeWidth={ind.startsWith("Taxa de desocupação") ? 2.5 : 1.5}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {indicadores.map((ind) => (
          <Chip
            key={ind}
            label={ind}
            color={CORES[indicadores.indexOf(ind) % CORES.length]}
            ativo={!hidden.has(ind)}
            onClick={() => toggleHide(ind)}
          />
        ))}
      </div>
    </>
  );
}

// ============================================================
// Vista: Composição (posição na ocupação)
// ============================================================
function ComposicaoView({ data }: { data: PnadData }) {
  const cats = data.composicao.categorias;
  const ultimo = data.composicao.serie[data.composicao.serie.length - 1];
  const anoAnterior = findSameTrimAnoAnterior(data.composicao.serie, ultimo.trim as string);

  const pieData = cats.map((c) => ({
    name: c,
    value: (ultimo[c] as number) ?? 0,
  }));

  const rankingData = cats.map((c) => {
    const curr = (ultimo[c] as number) ?? 0;
    const prev = (anoAnterior?.[c] as number | undefined) ?? undefined;
    return {
      label: c,
      value: curr,
      delta: prev != null ? curr - prev : null,
    };
  });

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div style={{ width: "100%", height: 360 }}>
            <ResponsiveContainer>
              <BarChart data={data.composicao.serie} margin={{ top: 10, right: 24, bottom: 10, left: 0 }}>
                <CartesianGrid stroke="#eee" vertical={false} />
                <XAxis dataKey="trim" tickFormatter={fmtTrim} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
                <Tooltip
                  labelFormatter={(label) => fmtTrim(String(label ?? ""))}
                  formatter={(value, name) => {
                    const v = typeof value === "number" ? value : Number(value);
                    const nm = String(name ?? "");
                    return Number.isFinite(v) ? [v.toFixed(1) + "%", nm] : ["—", nm];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {cats.map((cat) => (
                  <Bar key={cat} dataKey={cat} stackId="comp" fill={CORES_POSICAO[cat] ?? "#9ca3af"} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="space-y-4">
          <PieDistribution
            data={pieData}
            colors={CORES_POSICAO}
            title={`Distribuição em ${fmtTrim(ultimo.trim as string)}`}
            totalLabel="Total"
            valueFmt={(v) => v.toFixed(1) + "%"}
            height={200}
          />
          <RankingTable
            title="Variação YoY"
            data={rankingData}
            valueLabel="% ocupados"
            valueFmt={(v) => v.toFixed(1) + "%"}
            deltaLabel="p.p. YoY"
            deltaUnit="p.p."
            topN={4}
            colorAccent={(r) => CORES_POSICAO[r.label] ?? "#9ca3af"}
          />
        </div>
      </div>
    </>
  );
}

// ============================================================
// Vista: Setor
// ============================================================
function SetorView({ data }: { data: PnadData }) {
  const cats = data.setor.categorias;
  const ultimo = data.setor.serie[data.setor.serie.length - 1];
  const anoAnterior = findSameTrimAnoAnterior(data.setor.serie, ultimo.trim as string);

  const pieData = cats.map((c) => ({
    name: c,
    value: (ultimo[c] as number) ?? 0,
  }));

  const rankingData = cats.map((c) => {
    const curr = (ultimo[c] as number) ?? 0;
    const prev = (anoAnterior?.[c] as number | undefined) ?? undefined;
    return {
      label: c,
      value: curr,
      delta: prev != null && prev !== 0 ? ((curr - prev) / Math.abs(prev)) * 100 : null,
    };
  });

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div style={{ width: "100%", height: 380 }}>
            <ResponsiveContainer>
              <BarChart data={data.setor.serie} margin={{ top: 10, right: 24, bottom: 10, left: 0 }}>
                <CartesianGrid stroke="#eee" vertical={false} />
                <XAxis dataKey="trim" tickFormatter={fmtTrim} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => (v / 1000).toFixed(0) + "M"} />
                <Tooltip
                  labelFormatter={(label) => fmtTrim(String(label ?? ""))}
                  formatter={(value, name) => {
                    const v = typeof value === "number" ? value : Number(value);
                    const nm = String(name ?? "");
                    return Number.isFinite(v) ? [(v / 1000).toFixed(2) + " mi", nm] : ["—", nm];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {cats.map((cat) => (
                  <Bar key={cat} dataKey={cat} stackId="setor" fill={CORES_SETOR_PNAD[cat] ?? "#9ca3af"} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="space-y-4">
          <PieDistribution
            data={pieData}
            colors={CORES_SETOR_PNAD}
            title={`Distribuição em ${fmtTrim(ultimo.trim as string)}`}
            totalLabel="Ocupados (mil)"
            valueFmt={(v) => FMT_NUM_BR.format(Math.round(v))}
            height={200}
          />
          <RankingTable
            title="Top setores que mais cresceram"
            data={rankingData}
            valueLabel="mil pessoas"
            valueFmt={(v) => FMT_NUM_BR.format(Math.round(v))}
            deltaLabel="% YoY"
            deltaUnit="%"
            topN={3}
            bottomN={3}
            colorAccent={(r) => CORES_SETOR_PNAD[r.label] ?? "#9ca3af"}
          />
        </div>
      </div>
    </>
  );
}

// ============================================================
// Vista: Cruzamentos (heatmap + decomposição YoY)
// ============================================================
function CruzamentosView({ data }: { data: PnadData }) {
  // Heatmap: linhas = anos, colunas = trimestres, valores = taxa desocupação
  const { rows, cols, heatData, minV, maxV } = useMemo(() => {
    const heat: Record<string, Record<string, number | null>> = {};
    const yearsSet = new Set<string>();
    const colSet = new Set<string>();
    let mn = Infinity;
    let mx = -Infinity;
    for (const item of data.taxas.serie) {
      const trim = item.trim as string;
      const [y, t] = trim.split("-T");
      const v = item["Taxa de desocupação"] as number | undefined;
      yearsSet.add(y);
      const colKey = `${t}T`;
      colSet.add(colKey);
      heat[y] = heat[y] ?? {};
      heat[y][colKey] = v ?? null;
      if (v != null) {
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }
    }
    const colsArr = ["1T", "2T", "3T", "4T"].filter((c) => colSet.has(c));
    const rowsArr = Array.from(yearsSet).sort();
    return { rows: rowsArr, cols: colsArr, heatData: heat, minV: mn, maxV: mx };
  }, [data.taxas.serie]);

  const scale = useMemo(() => sequentialScale(minV, maxV, "orange"), [minV, maxV]);

  // Decomposição YoY: setor que mais variou (em mil pessoas)
  const cats = data.setor.categorias;
  const ultimo = data.setor.serie[data.setor.serie.length - 1];
  const anoAnterior = findSameTrimAnoAnterior(data.setor.serie, ultimo.trim as string);
  const decompData = cats
    .map((c) => {
      const curr = (ultimo[c] as number) ?? 0;
      const prev = (anoAnterior?.[c] as number) ?? 0;
      return { setor: c, delta: curr - prev };
    })
    .sort((a, b) => b.delta - a.delta);

  return (
    <div className="space-y-4">
      <Heatmap
        rows={rows}
        cols={cols}
        data={heatData}
        valueFmt={(v) => v.toFixed(1) + "%"}
        colorScale={scale}
        title="Sazonalidade — Taxa de desocupação (% por trimestre × ano)"
        caption="Cores mais escuras = desocupação maior. Útil pra ver padrões sazonais (3T-4T tipicamente menor) e quebras (pandemia em 2020)."
      />

      <div className="rounded-xl border border-zinc-200 bg-white p-3">
        <div className="mb-2 text-xs font-semibold text-zinc-700">
          Decomposição YoY — variação por setor ({fmtTrim(ultimo.trim as string)} vs {fmtTrim(anoAnterior?.trim as string)})
        </div>
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={decompData} layout="vertical" margin={{ top: 10, right: 60, bottom: 10, left: 130 }}>
              <CartesianGrid stroke="#eee" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v: number) => (v >= 0 ? "+" : "") + v.toFixed(0)} />
              <YAxis type="category" dataKey="setor" tick={{ fontSize: 10 }} width={130} />
              <Tooltip
                formatter={(value) => {
                  const v = typeof value === "number" ? value : Number(value);
                  const sign = v >= 0 ? "+" : "";
                  return [`${sign}${v.toFixed(0)} mil`, "Variação YoY"];
                }}
              />
              <Bar dataKey="delta">
                {decompData.map((d) => (
                  <BarCell key={d.setor} fill={d.delta >= 0 ? "#10b981" : "#ef4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-[10px] italic text-zinc-500">
          Cada barra representa a variação líquida em mil pessoas ocupadas no setor frente ao mesmo trimestre do ano anterior.
        </p>
      </div>
    </div>
  );
}

// Recharts não exporta Cell direto pelo nome "BarCell" — re-export pra uso interno
import { Cell as BarCell } from "recharts";

// ============================================================
// Vista: Série completa (tabela com 24 trim)
// ============================================================
function SerieCompletaView({ data }: { data: PnadData }) {
  // Junta taxas + composição + setor por trimestre numa tabela única
  const linhas = useMemo(() => {
    const map = new Map<string, Record<string, any>>();
    for (const item of data.taxas.serie) {
      map.set(item.trim as string, { ...item });
    }
    for (const item of data.composicao.serie) {
      const r = map.get(item.trim as string) || { ...item };
      for (const c of data.composicao.categorias) {
        r[`comp_${c}`] = item[c];
      }
      map.set(item.trim as string, r);
    }
    return Array.from(map.values()).sort((a, b) => String(b.trim).localeCompare(String(a.trim)));
  }, [data]);

  return (
    <DataTable
      title="Série completa PNAD Contínua Trimestral"
      data={linhas}
      exportFilename="pnad_serie_completa.csv"
      initialSortKey="trim"
      initialSortDir="desc"
      columns={[
        {
          key: "trim",
          label: "Trim",
          align: "left",
          sortable: true,
          fmt: (v) => fmtTrim(String(v)),
          numericValue: (r) => {
            const [y, t] = String(r.trim).split("-T");
            return parseInt(y, 10) * 10 + parseInt(t, 10);
          },
        },
        {
          key: "Taxa de desocupação",
          label: "Desocup.",
          fmt: (v) => fmtPct(typeof v === "number" ? v : null),
        },
        {
          key: "Taxa de participação na força de trabalho",
          label: "Participação",
          fmt: (v) => fmtPct(typeof v === "number" ? v : null),
        },
        {
          key: "Taxa de informalidade",
          label: "Informalidade",
          fmt: (v) => fmtPct(typeof v === "number" ? v : null),
        },
        {
          key: "Taxa combinada (desocup. + subocup. horas)",
          label: "Combinada",
          fmt: (v) => fmtPct(typeof v === "number" ? v : null),
        },
        {
          key: "Taxa composta de subutilização",
          label: "Subutiliz.",
          fmt: (v) => fmtPct(typeof v === "number" ? v : null),
        },
        {
          key: "comp_Empregado",
          label: "%Empregado",
          fmt: (v) => fmtPct(typeof v === "number" ? v : null),
        },
        {
          key: "comp_Conta própria",
          label: "%C.Própria",
          fmt: (v) => fmtPct(typeof v === "number" ? v : null),
        },
      ]}
      maxHeight={420}
    />
  );
}
