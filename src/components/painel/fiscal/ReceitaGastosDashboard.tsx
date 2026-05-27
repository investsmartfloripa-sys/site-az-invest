"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart,
} from "recharts";

import type { FiscalClassicosData, PontoMensalPct } from "@/lib/painel-fiscal";
import { CORES_SERIES, CardHeader, KPI, Section, Toggle, useHorizonte } from "./FiscalShell";

const HORIZONTES = [
  { value: "5a", label: "5 anos", n: 60 },
  { value: "10a", label: "10 anos", n: 120 },
  { value: "max", label: "Max", n: 9999 },
] as const;

const BASES = [
  { value: "pib", label: "% PIB" },
  { value: "receita", label: "% Receita" },
] as const;
type Base = (typeof BASES)[number]["value"];

function fmtMes(s: string): string {
  if (!s) return "";
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const [y, m] = s.split("-");
  return `${meses[parseInt(m, 10) - 1]}/${y.slice(2)}`;
}
function fmtPct(v: number | null | undefined, casas = 1): string {
  if (v == null) return "—";
  return `${v.toFixed(casas)}%`;
}
function ultPct(s: PontoMensalPct[] | null | undefined): number | null {
  if (!s) return null;
  for (let i = s.length - 1; i >= 0; i--) {
    const v = s[i].valor_pct;
    if (v != null) return v;
  }
  return null;
}
function ultMensal(s: { valor: number | null }[] | null | undefined): number | null {
  if (!s) return null;
  for (let i = s.length - 1; i >= 0; i--) {
    const v = s[i].valor;
    if (v != null) return v;
  }
  return null;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtTipPct = (v: any): string => (typeof v === "number" ? `${v.toFixed(2)}%` : "—");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtTipLabel = (s: any): string => fmtMes(String(s ?? ""));

function tail<T>(s: T[], n: number): T[] {
  return s.slice(Math.max(0, s.length - n));
}

function mergePct(series: { data: string; valor_pct: number | null }[][], keys: string[]) {
  const mapa = new Map<string, Record<string, number | string | null>>();
  series.forEach((s, idx) => {
    s.forEach((r) => {
      if (!mapa.has(r.data)) mapa.set(r.data, { mes: r.data });
      mapa.get(r.data)![keys[idx]] = r.valor_pct;
    });
  });
  return Array.from(mapa.values()).sort((a, b) => String(a.mes).localeCompare(String(b.mes)));
}

export function ReceitaGastosDashboard({ data }: { data: FiscalClassicosData }) {
  const horizonte = useHorizonte(HORIZONTES, "10a");
  const [base, setBase] = useState<Base>("pib");

  // KPIs - "% PIB" sempre exibidos (base mais comum no Brasil)
  const receita_pct = ultPct(data.receita_e_gastos.receita_liquida_pct_pib);
  const despesa_pct = ultPct(data.receita_e_gastos.despesa_total_pct_pib);
  const primario_pct = ultPct(data.receita_e_gastos.primario_central_pct_pib);
  const juros_pct = ultPct(data.receita_e_gastos.juros_central_pct_pib);
  const juros_pct_rec = ultPct(data.receita_e_gastos.juros_pct_receita);
  const nfsp_pct = ultMensal(data.receita_e_gastos.nfsp_sp_12m_pct_pib);

  // Serie de resultado fiscal (12m, % PIB ou % Receita)
  const serieResultado = useMemo(() => {
    if (base === "pib") {
      return mergePct(
        [
          tail(data.receita_e_gastos.primario_central_pct_pib, horizonte.n),
          tail(data.receita_e_gastos.juros_central_pct_pib, horizonte.n),
          tail(
            data.receita_e_gastos.nfsp_sp_12m_pct_pib.map((r) => ({ data: r.data, valor_pct: r.valor })),
            horizonte.n,
          ),
        ],
        ["Primario", "Juros nominais", "NFSP"],
      );
    }
    return mergePct(
      [
        tail(data.receita_e_gastos.primario_pct_receita, horizonte.n),
        tail(data.receita_e_gastos.juros_pct_receita, horizonte.n),
        tail(data.receita_e_gastos.despesa_pct_receita.map((r) => ({ data: r.data, valor_pct: r.valor_pct })), horizonte.n),
      ],
      ["Primario", "Juros nominais", "Despesa total"],
    );
  }, [data, horizonte.n, base]);

  // Decomposicao de despesa (12m, % PIB ou % Receita)
  const serieDecomp = useMemo(() => {
    if (base === "pib") {
      return mergePct(
        [
          tail(data.receita_e_gastos.previdencia_12m_pct_pib, horizonte.n),
          tail(data.receita_e_gastos.pessoal_12m_pct_pib, horizonte.n),
        ],
        ["Previdencia", "Pessoal"],
      );
    }
    return mergePct(
      [
        tail(data.receita_e_gastos.previdencia_12m_pct_receita, horizonte.n),
        tail(data.receita_e_gastos.pessoal_12m_pct_receita, horizonte.n),
      ],
      ["Previdencia", "Pessoal"],
    );
  }, [data, horizonte.n, base]);

  // Receita vs despesa
  const serieReceitaDespesa = useMemo(() => {
    return mergePct(
      [
        tail(data.receita_e_gastos.receita_liquida_pct_pib, horizonte.n),
        tail(data.receita_e_gastos.despesa_total_pct_pib, horizonte.n),
      ],
      ["Receita liquida", "Despesa total"],
    );
  }, [data, horizonte.n]);

  return (
    <div className="space-y-6">
      <CardHeader
        titulo="Receita e gastos do governo central"
        subtitulo="Receita liquida do Tesouro, despesa primaria, juros nominais e resultado primario. Fonte: STN/RTN + BCB."
        rightSlot={
          <div className="flex gap-2">
            <Toggle value={base} onChange={(v) => setBase(v as Base)} options={[...BASES]} size="sm" />
            <Toggle value={horizonte.horizonte} onChange={horizonte.setHorizonte} options={[...HORIZONTES]} />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPI label="Receita liquida" value={fmtPct(receita_pct)} hint="% PIB (12m)" />
        <KPI label="Despesa total" value={fmtPct(despesa_pct)} hint="% PIB (12m)" trend={despesa_pct && despesa_pct > 20 ? "down" : "neutral"} />
        <KPI label="Primario gov central" value={fmtPct(primario_pct)} hint="% PIB (12m). + = superavit" trend={primario_pct && primario_pct > 0 ? "up" : "down"} />
        <KPI label="Juros nominais" value={fmtPct(juros_pct)} hint="% PIB (12m)" trend={juros_pct && juros_pct > 7 ? "down" : "neutral"} />
        <KPI label="Juros / Receita" value={fmtPct(juros_pct_rec)} hint="% Receita (metrica Dalio)" trend={juros_pct_rec && juros_pct_rec > 30 ? "down" : "neutral"} />
        <KPI label="NFSP SP" value={fmtPct(nfsp_pct)} hint="Necessidade fin. setor publico (12m % PIB)" />
      </div>

      <Section
        titulo="Receita vs despesa (% PIB, 12m)"
        hint="Gap entre as duas linhas e o deficit primario do governo central. Fonte: Tesouro RTN."
      >
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={serieReceitaDespesa}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="mes" tickFormatter={fmtMes} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={fmtTipPct} labelFormatter={fmtTipLabel} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Receita liquida" stroke={CORES_SERIES[2]} strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="Despesa total" stroke={CORES_SERIES[3]} strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section titulo={`Resultado fiscal 12m (${base === "pib" ? "% PIB" : "% Receita"})`}>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={serieResultado}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="mes" tickFormatter={fmtMes} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={fmtTipPct} labelFormatter={fmtTipLabel} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={0} stroke="#475569" />
              <Line type="monotone" dataKey="Primario" stroke={CORES_SERIES[2]} strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="Juros nominais" stroke={CORES_SERIES[3]} strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey={base === "pib" ? "NFSP" : "Despesa total"} stroke={CORES_SERIES[5]} strokeWidth={2} strokeDasharray="3 3" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section titulo={`Decomposicao de despesa: previdencia e pessoal (${base === "pib" ? "% PIB" : "% Receita"})`}>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={serieDecomp}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="mes" tickFormatter={fmtMes} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={fmtTipPct} labelFormatter={fmtTipLabel} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="Previdencia" stackId="1" stroke={CORES_SERIES[0]} fill={CORES_SERIES[0]} fillOpacity={0.35} />
              <Area type="monotone" dataKey="Pessoal" stackId="1" stroke={CORES_SERIES[1]} fill={CORES_SERIES[1]} fillOpacity={0.35} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <p className="text-xs text-zinc-500">
        Ultima atualizacao: {new Date(data.gerado_em).toLocaleString("pt-BR")}.
      </p>
    </div>
  );
}
