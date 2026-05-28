"use client";

import { useMemo } from "react";
import {
  Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import type { FiscalClassicosData, PontoMensal } from "@/lib/painel-fiscal";
import { CORES_SERIES, CardHeader, KPI, Section, Toggle, useHorizonte } from "./FiscalShell";

const HORIZONTES = [
  { value: "5a", label: "5 anos", n: 60 },
  { value: "10a", label: "10 anos", n: 120 },
  { value: "max", label: "Max", n: 9999 },
] as const;

function formatMes(s: string): string {
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
const fmtTipLabel = (s: any): string => formatMes(String(s ?? ""));

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

// build: 2026-05-28 v3
export function DividaDashboard({ data }: { data: FiscalClassicosData }) {
  const horizonte = useHorizonte(HORIZONTES, "10a");

  const dbgg_recente = ultimoValor(data.divida.dbgg_pct_pib);
  const dlsp_recente = ultimoValor(data.divida.dlsp_total_pct_pib);
  const dlsp_central_recente = ultimoValor(data.divida.dlsp_gov_central_pct_pib);

  // Composição DPMFi (% indexador) — último valor de cada
  const comp = data.composicao_dpmfi;
  const pct_selic = comp ? ultimoValor(comp.selic_pct) : null;
  const pct_prefix = comp ? ultimoValor(comp.prefixado_pct) : null;
  const pct_cambio = comp ? ultimoValor(comp.cambio_pct) : null;
  // IPCA é residual (não há série SGS direta — calculado como 100 - outros)
  const soma_conhecidos = (pct_selic ?? 0) + (pct_prefix ?? 0) + (pct_cambio ?? 0) +
                          (comp ? (ultimoValor(comp.tr_pct ?? []) ?? 0) : 0) +
                          (comp ? (ultimoValor(comp.outros_pct ?? []) ?? 0) : 0);
  const pct_ipca = soma_conhecidos > 0 ? Math.max(0, 100 - soma_conhecidos) : null;

  // Wedge entre DBGG e DLSP (créditos do gov, reservas)
  const wedge = (dbgg_recente != null && dlsp_recente != null) ? dbgg_recente - dlsp_recente : null;

  const serieTotal = useMemo(() => {
    return merge([
      tail(data.divida.dbgg_pct_pib, horizonte.n),
      tail(data.divida.dlsp_total_pct_pib, horizonte.n),
      tail(data.divida.dlsp_gov_central_pct_pib, horizonte.n),
    ], ["DBGG", "DLSP total", "DLSP gov central"]);
  }, [data, horizonte.n]);

  // Série da composição DPMFi
  const serieComp = useMemo(() => {
    if (!comp) return [];
    return merge([
      tail(comp.selic_pct, horizonte.n),
      tail(comp.prefixado_pct, horizonte.n),
      tail(comp.cambio_pct, horizonte.n),
    ], ["Selic/LFT", "Prefixado", "Câmbio"]);
  }, [comp, horizonte.n]);

  // Crédito total economia
  const credito = data.credito_economia?.credito_total_pct_pib;
  const credito_recente = credito ? ultimoValor(credito) : null;
  const divida_total_economia = (dbgg_recente != null && credito_recente != null) ? dbgg_recente + credito_recente : null;

  return (
    <div className="space-y-6">
      <CardHeader
        titulo="Dívida pública"
        subtitulo="Trajetória da dívida bruta (DBGG) e dívida líquida (DLSP) + composição da DPMFi por indexador. Fonte: BCB SGS séries 13762, 4513, 4503, 4174-4180."
        rightSlot={<Toggle value={horizonte.horizonte} onChange={horizonte.setHorizonte} options={[...HORIZONTES]} />}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KPI label="DBGG / PIB" value={fmtPct(dbgg_recente)} hint="Dívida bruta gov geral" trend={dbgg_recente && dbgg_recente > 80 ? "down" : "neutral"} />
        <KPI label="DLSP total / PIB" value={fmtPct(dlsp_recente)} hint="Dívida líquida setor público" />
        <KPI label="DLSP gov central / PIB" value={fmtPct(dlsp_central_recente)} hint="Dívida líquida governo central" />
        <KPI label="Wedge DBGG − DLSP" value={fmtPct(wedge)} hint="Créditos BNDES + reservas + ativos" trend="up" />
        <KPI label="Crédito setor privado / PIB" value={fmtPct(credito_recente)} hint="Famílias + empresas. Big Debt Cycle Dalio." />
        <KPI label="Dívida total economia / PIB" value={fmtPct(divida_total_economia)} hint="Gov + privado (proxy)" />
      </div>

      <Section titulo="Trajetória DBGG e DLSP" hint="Linhas tracejadas vermelhas: 80% (atenção FMI) e 100% (limite Reinhart-Rogoff).">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={serieTotal}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="mes" tickFormatter={formatMes} tick={{ fontSize: 11 }} />
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

      {/* === COMPOSIÇÃO DA DPMFi POR INDEXADOR === */}
      {comp && serieComp.length > 0 && (
        <Section
          titulo="Composição da DPMFi por indexador"
          hint="Dívida Pública Mobiliária Federal interna por tipo de indexador. Selic/LFT = exposta a aperto monetário. Câmbio = exposta a desvalorização. Fonte: BCB SGS 4174-4180."
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KPI label="Selic / LFT" value={fmtPct(pct_selic)} hint="Risco direto da Selic" trend={pct_selic && pct_selic > 50 ? "down" : "neutral"} />
            <KPI label="IPCA (NTN-B)" value={fmtPct(pct_ipca)} hint="Calculado por resíduo" />
            <KPI label="Prefixado" value={fmtPct(pct_prefix)} hint="Custo fixo — saudável" trend={pct_prefix && pct_prefix > 25 ? "up" : "down"} />
            <KPI label="Câmbio" value={fmtPct(pct_cambio)} hint="Brasil estruturalmente baixo" trend={pct_cambio && pct_cambio > 5 ? "down" : "up"} />
          </div>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={serieComp}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" tickFormatter={formatMes} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={fmtTipPct} labelFormatter={fmtTipLabel} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="Selic/LFT" stroke={CORES_SERIES[3]} fill={CORES_SERIES[3]} fillOpacity={0.4} strokeWidth={2} />
                <Area type="monotone" dataKey="Prefixado" stroke={CORES_SERIES[2]} fill={CORES_SERIES[2]} fillOpacity={0.4} strokeWidth={2} />
                <Area type="monotone" dataKey="Câmbio" stroke={CORES_SERIES[5]} fill={CORES_SERIES[5]} fillOpacity={0.4} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-xs text-zinc-600">
            <strong>Leitura Dalio:</strong> dívida em Selic é o canal direto da política monetária pro custo da dívida — quando o BC sobe juros, o estoque encarece automaticamente. Prefixado isola desse choque. Brasil tem virtude estrutural na exposição cambial muito baixa (3% vs Argentina 60%+).
          </p>
        </Section>
      )}

      <p className="text-xs text-zinc-500">
        Última atualização: {new Date(data.gerado_em).toLocaleString("pt-BR")}.
      </p>
    </div>
  );
}
