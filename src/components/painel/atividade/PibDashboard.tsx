"use client";

import { useMemo, useState } from "react";
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
  type AtividadeIbcBrData,
  type AtividadePibData,
  HORIZONTES_TRIMESTRAIS,
  HORIZONTES_MENSAIS,
  formatTrim,
  formatMes,
  tail,
} from "@/lib/painel-atividade";
import {
  CardHeader,
  CORES_SERIES,
  COR_ACENTO,
  COR_NEGATIVO,
  COR_POSITIVO,
  COR_PRIMARIA,
  KPI,
  Toggle,
  formatDivulgadoEm,
  useHorizonte,
} from "./AtividadeShell";
import DataStamp from "@/components/painel/DataStamp";

type Visao = "pib" | "ibcbr";
type Decomposicao = "nenhuma" | "oferta" | "demanda";

const SETORES_OFERTA: { key: string; label: string }[] = [
  { key: "agro", label: "Agro" },
  { key: "industria", label: "Indústria" },
  { key: "servicos", label: "Serviços" },
];
const COMPONENTES_DEMANDA: { key: string; label: string }[] = [
  { key: "consumo_familias", label: "Consumo famílias" },
  { key: "consumo_governo", label: "Consumo governo" },
  { key: "fbcf", label: "FBCF" },
  { key: "exportacoes", label: "Exportações" },
  { key: "importacoes", label: "Importações" },
];

export function PibDashboard({
  pib,
  ibcbr,
}: {
  pib: AtividadePibData;
  ibcbr: AtividadeIbcBrData | null;
}) {
  const [visao, setVisao] = useState<Visao>("pib");
  const [decomp, setDecomp] = useState<Decomposicao>("nenhuma");
  const trimH = useHorizonte(
    HORIZONTES_TRIMESTRAIS.map((h) => ({ value: h.label, label: h.label, n: h.n })) as any,
    "20T (5 anos)",
  );
  const mesH = useHorizonte(
    HORIZONTES_MENSAIS.map((h) => ({ value: h.label, label: h.label, n: h.n })) as any,
    "24m",
  );

  if (visao === "ibcbr" && ibcbr) {
    return (
      <IbcBrView ibcbr={ibcbr} pib={pib} mesH={mesH} visao={visao} setVisao={setVisao} />
    );
  }

  return (
    <PibView
      pib={pib}
      ibcbrDisponivel={!!ibcbr}
      visao={visao}
      setVisao={setVisao}
      trimH={trimH}
      decomp={decomp}
      setDecomp={setDecomp}
    />
  );
}

function PibView({
  pib,
  ibcbrDisponivel,
  visao,
  setVisao,
  trimH,
  decomp,
  setDecomp,
}: {
  pib: AtividadePibData;
  ibcbrDisponivel: boolean;
  visao: Visao;
  setVisao: (v: Visao) => void;
  trimH: ReturnType<typeof useHorizonte>;
  decomp: Decomposicao;
  setDecomp: (d: Decomposicao) => void;
}) {
  const serieFull = pib.variacao.serie;
  const serie = useMemo(() => tail(serieFull, trimH.n), [serieFull, trimH.n]);
  const ultimo = serie[serie.length - 1];

  const yoyPib = ultimo?.yoy_pib as number | null;
  const qoqPib = ultimo?.qoq_sa_pib as number | null;
  const acumAno = ultimo?.acum_ano_pib as number | null;
  const acum4t = ultimo?.acum_4t_pib as number | null;

  // Dados para o gráfico principal: barras qoq_sa_pib + linha yoy_pib
  const chartData = serie.map((s) => ({
    trim: formatTrim(s.trim),
    qoq: s.qoq_sa_pib,
    yoy: s.yoy_pib,
  }));

  // Decomposição (se ativa)
  const decompData =
    decomp === "oferta"
      ? serie.map((s) => ({
          trim: formatTrim(s.trim),
          ...Object.fromEntries(SETORES_OFERTA.map((x) => [x.label, s[`yoy_${x.key}`]])),
        }))
      : decomp === "demanda"
        ? serie.map((s) => ({
            trim: formatTrim(s.trim),
            ...Object.fromEntries(COMPONENTES_DEMANDA.map((x) => [x.label, s[`yoy_${x.key}`]])),
          }))
        : null;

  // Focus PIB: mediana do ano corrente + ano +1 ao longo do tempo
  const anoAtual = parseInt(pib.trim_recente.slice(0, 4), 10);
  const focusAtual = pib.focus[String(anoAtual)] ?? [];
  const focusProximo = pib.focus[String(anoAtual + 1)] ?? [];
  const ultimoFocusAtual = focusAtual[focusAtual.length - 1];
  const ultimoFocusProximo = focusProximo[focusProximo.length - 1];

  return (
    <div className="space-y-6">
      <CardHeader
        titulo="PIB — Produto Interno Bruto"
        subtitulo="IBGE / Contas Nacionais Trimestrais — variações reais com ajuste sazonal e contra mesmo período do ano anterior."
        divulgadoEm={formatDivulgadoEm(pib.gerado_em)}
        periodoReferencia={formatTrim(pib.trim_recente)}
        rightSlot={
          <Toggle
            value={visao}
            onChange={setVisao}
            options={[
              { value: "pib", label: "PIB trimestral" },
              ...(ibcbrDisponivel ? [{ value: "ibcbr", label: "IBC-Br (mensal)" }] : []),
            ] as any}
          />
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPI
          label="Variação SA (trim/trim ant.)"
          value={qoqPib}
          unit="%"
          trend={typeof qoqPib === "number" ? (qoqPib >= 0 ? "up" : "down") : "neutral"}
          hint="Dessazonalizada — manchete"
        />
        <KPI
          label="Variação anual (trim/4 trim atrás)"
          value={yoyPib}
          unit="%"
          trend={typeof yoyPib === "number" ? (yoyPib >= 0 ? "up" : "down") : "neutral"}
        />
        <KPI label="Acumulada no ano" value={acumAno} unit="%" hint={`Trim atual: ${formatTrim(pib.trim_recente)}`} />
        <KPI label="Acumulada 4 trim." value={acum4t} unit="%" hint="Proxy de PIB anualizado" />
      </div>

      <section className="rounded-2xl border border-[#132960]/15 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[#132960]">
            PIB total — variação trimestral SA (barras) e variação anual (linha)
          </h2>
          <Toggle
            size="sm"
            value={trimH.horizonte}
            onChange={trimH.setHorizonte as any}
            options={trimH.options as any}
          />
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis dataKey="trim" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} unit="%" />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="%" />
            <Tooltip
              formatter={(v: any, name: any) =>
                typeof v === "number" ? [`${v.toFixed(2)}%`, String(name)] : [v, String(name)]
              }
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar
              yAxisId="left"
              dataKey="qoq"
              name="Variação SA trim/trim anterior"
              fill={COR_ACENTO}
              radius={[2, 2, 0, 0]}
            />
            <Line
              yAxisId="right"
              dataKey="yoy"
              type="monotone"
              name="Variação anual (vs mesmo trim. ano anterior)"
              stroke={COR_PRIMARIA}
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="mt-2">
          <DataStamp giro={pib.gerado_em} dado={serie[serie.length - 1]?.trim} />
        </p>
      </section>

      {/* Decomposição */}
      <section className="rounded-2xl border border-[#132960]/15 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[#132960]">Decomposição (variação anual %)</h2>
          <Toggle
            size="sm"
            value={decomp}
            onChange={setDecomp}
            options={[
              { value: "nenhuma", label: "Total" },
              { value: "oferta", label: "Ótica da oferta" },
              { value: "demanda", label: "Ótica da demanda" },
            ]}
          />
        </div>
        {decomp === "nenhuma" ? (
          <p className="text-sm text-zinc-500">Selecione "Ótica da oferta" ou "Ótica da demanda" para ver a decomposição.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={decompData ?? []} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="trim" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip
                formatter={(v: any, name: any) =>
                  typeof v === "number" ? [`${v.toFixed(2)}%`, name as string] : [v, name as string]
                }
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {(decomp === "oferta" ? SETORES_OFERTA : COMPONENTES_DEMANDA).map((c, i) => (
                <Line
                  key={c.label}
                  type="monotone"
                  dataKey={c.label}
                  stroke={CORES_SERIES[i % CORES_SERIES.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        )}
        <p className="mt-2">
          <DataStamp giro={pib.gerado_em} dado={serie[serie.length - 1]?.trim} />
        </p>
      </section>

      {/* Focus PIB */}
      {(ultimoFocusAtual || ultimoFocusProximo) && (
        <section className="rounded-2xl border border-[#132960]/15 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-[#132960]">Expectativas Focus (PIB anual)</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ultimoFocusAtual && (
              <KPI
                label={`Mediana Focus para ${anoAtual}`}
                value={ultimoFocusAtual.mediana}
                unit="%"
                hint={`Última coleta: ${ultimoFocusAtual.data}`}
              />
            )}
            {ultimoFocusProximo && (
              <KPI
                label={`Mediana Focus para ${anoAtual + 1}`}
                value={ultimoFocusProximo.mediana}
                unit="%"
                hint={`Última coleta: ${ultimoFocusProximo.data}`}
              />
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-[11px] text-zinc-400">
              Fonte: BCB Olinda (boletim Focus). A mediana é a estimativa central das instituições consultadas.
            </p>
            <DataStamp giro={pib.gerado_em} dado={(ultimoFocusAtual ?? ultimoFocusProximo)?.data} />
          </div>
        </section>
      )}

      <footer className="text-[11px] text-zinc-500">{pib.metadata.nota}</footer>
    </div>
  );
}

function IbcBrView({
  ibcbr,
  pib,
  mesH,
  visao,
  setVisao,
}: {
  ibcbr: AtividadeIbcBrData;
  pib: AtividadePibData;
  mesH: ReturnType<typeof useHorizonte>;
  visao: Visao;
  setVisao: (v: Visao) => void;
}) {
  const serie = useMemo(() => tail(ibcbr.serie, mesH.n), [ibcbr.serie, mesH.n]);
  const ultimo = serie[serie.length - 1];

  const chartData = serie.map((s) => ({
    mes: formatMes(s.mes),
    indice_sa: s.indice_sa,
    mm3: s.indice_sa_mm3,
  }));

  return (
    <div className="space-y-6">
      <CardHeader
        titulo="IBC-Br — Proxy mensal do PIB"
        subtitulo="Índice de Atividade Econômica do BCB. Proxy mensal do PIB, base 2002=100."
        divulgadoEm={formatDivulgadoEm(ibcbr.gerado_em)}
        periodoReferencia={formatMes(ibcbr.mes_recente)}
        rightSlot={
          <Toggle
            value={visao}
            onChange={setVisao}
            options={[
              { value: "pib", label: "PIB trimestral" },
              { value: "ibcbr", label: "IBC-Br (mensal)" },
            ] as any}
          />
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPI label="Índice SA" value={ultimo?.indice_sa} hint="Base 2002=100" />
        <KPI
          label="Variação mensal (MoM SA)"
          value={ultimo?.var_mom}
          unit="%"
          trend={typeof ultimo?.var_mom === "number" ? (ultimo.var_mom >= 0 ? "up" : "down") : "neutral"}
        />
        <KPI
          label="Variação anual"
          value={ultimo?.var_yoy}
          unit="%"
          trend={typeof ultimo?.var_yoy === "number" ? (ultimo.var_yoy >= 0 ? "up" : "down") : "neutral"}
        />
        <KPI label="Média móvel 3m" value={ultimo?.indice_sa_mm3} hint="Suavização editorial" />
      </div>

      <section className="rounded-2xl border border-[#132960]/15 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[#132960]">IBC-Br — Índice com ajuste sazonal</h2>
          <Toggle
            size="sm"
            value={mesH.horizonte}
            onChange={mesH.setHorizonte as any}
            options={mesH.options as any}
          />
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
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
              dataKey="indice_sa"
              name="IBC-Br SA"
              stroke={COR_PRIMARIA}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="mm3"
              name="Média móvel 3m"
              stroke={COR_ACENTO}
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="mt-2">
          <DataStamp giro={ibcbr.gerado_em} dado={serie[serie.length - 1]?.mes} />
        </p>
      </section>


      <footer className="text-[11px] text-zinc-500">{ibcbr.metadata.nota}</footer>
    </div>
  );
}
