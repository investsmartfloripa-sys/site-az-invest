"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import type { FiscalClassicosData, PontoMensal } from "@/lib/painel-fiscal";
import { CORES_SERIES, CardHeader, KPI, Section, Toggle, useHorizonte } from "./FiscalShell";

const HORIZONTES = [
  { value: "5a", label: "5 anos", n: 60 },
  { value: "10a", label: "10 anos", n: 120 },
  { value: "max", label: "Max", n: 9999 },
] as const;

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
function ultimoValor<T extends { valor?: number | null }>(s: T[]): number | null {
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

function merge(series: PontoMensal[][], keys: string[]): Array<Record<string, number | string | null>> {
  const mapa = new Map<string, Record<string, number | string | null>>();
  series.forEach((s, idx) => {
    s.forEach((r) => {
      if (!mapa.has(r.data)) mapa.set(r.data, { mes: r.data });
      mapa.get(r.data)![keys[idx]] = r.valor;
    });
  });
  return Array.from(mapa.values()).sort((a, b) => String(a.mes).localeCompare(String(b.mes)));
}

export function DividaDashboard({ data }: { data: FiscalClassicosData }) {
  const horizonte = useHorizonte(HORIZONTES, "10a");

  const dbgg_recente = ultimoValor(data.divida.dbgg_pct_pib);
  const dlsp_recente = ultimoValor(data.divida.dlsp_total_pct_pib);
  const dlsp_central_recente = ultimoValor(data.divida.dlsp_gov_central_pct_pib);

  const serieTotal = useMemo(() => {
    const m = merge([
      tail(data.divida.dbgg_pct_pib, horizonte.n),
      tail(data.divida.dlsp_total_pct_pib, horizonte.n),
      tail(data.divida.dlsp_gov_central_pct_pib, horizonte.n),
    ], ["DBGG", "DLSP total", "DLSP gov central"]);
    return m;
  }, [data, horizonte.n]);

  return (
    <div className="space-y-6">
      <CardHeader
        titulo="Dívida pública"
        subtitulo="Trajetória da dívida bruta (DBGG) e dívida líquida (DLSP). Fonte: BCB SGS series 13762, 4513 e 4503."
        rightSlot={<Toggle value={horizonte.horizonte} onChange={horizonte.setHorizonte} options={[...HORIZONTES]} />}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <KPI label="DBGG / PIB" value={fmtPct(dbgg_recente)} hint="Dívida bruta do governo geral" trend={dbgg_recente && dbgg_recente > 80 ? "down" : "neutral"} />
        <KPI label="DLSP total / PIB" value={fmtPct(dlsp_recente)} hint="Dívida líquida do setor público" />
        <KPI label="DLSP gov central / PIB" value={fmtPct(dlsp_central_recente)} hint="Dívida líquida do governo central" />
      </div>

      <Section titulo="Trajetória DBGG e DLSP">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={serieTotal}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="mes" tickFormatter={fmtMes} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={fmtTipPct} labelFormatter={fmtTipLabel} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={80} stroke="#dc2626" strokeDasharray="3 3" />
              <ReferenceLine y={100} stroke="#7f1d1d" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="DBGG" stroke={CORES_SERIES[3]} strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="DLSP total" stroke={CORES_SERIES[0]} strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="DLSP gov central" stroke={CORES_SERIES[4]} strokeWidth={2} dot={false} strokeDasharray="3 3" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <p className="text-xs text-zinc-500">
        Última atualização: {new Date(data.gerado_em).toLocaleString("pt-BR")}.
      </p>
    </div>
  );
}
