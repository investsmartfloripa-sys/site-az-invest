"use client";

import { useMemo, useState } from "react";
import {
  Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ReferenceArea, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
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

function anoAtual(): string {
  return String(new Date().getFullYear());
}

// === Card da Regra Fiscal (meta LDO + arcabouço) ===
function RegraFiscalCard({ data }: { data: FiscalClassicosData }) {
  const ano = anoAtual();
  const meta = data.metas_ldo?.anos?.[ano];
  const primarioAtual = ultPct(data.receita_e_gastos.primario_central_pct_pib);
  if (!meta || primarioAtual == null) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-600">
        Meta LDO {ano}: não disponível.
      </div>
    );
  }
  const dentro = primarioAtual >= meta.banda_inf && primarioAtual <= meta.banda_sup;
  const acima = primarioAtual > meta.banda_sup;
  const status = dentro ? "dentro" : acima ? "acima" : "abaixo";
  const statusBg = dentro ? "bg-emerald-50 border-emerald-300" : "bg-rose-50 border-rose-300";
  const statusTxt = dentro ? "text-emerald-900" : "text-rose-900";
  const statusLabel = dentro ? "DENTRO da banda" : acima ? "ACIMA do teto da banda" : "ABAIXO do piso da banda";

  return (
    <div className={`rounded-2xl border-2 ${statusBg} p-5 shadow-sm`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className={`text-sm font-bold uppercase tracking-wide ${statusTxt}`}>Meta primária LDO {ano} (gov central)</h3>
          <p className="mt-1 text-xs text-zinc-700">Convenção: primário positivo = superávit, em % PIB. Banda ±0,25pp segundo arcabouço fiscal (LC 200/2023).</p>
        </div>
        <span className={`rounded-full border-2 px-3 py-1 text-xs font-bold uppercase ${statusBg} ${statusTxt}`}>
          {statusLabel}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg bg-white/70 p-3">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">Centro da meta</div>
          <div className="text-xl font-bold text-zinc-700">{fmtPct(meta.centro, 2)}</div>
        </div>
        <div className="rounded-lg bg-white/70 p-3">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">Banda</div>
          <div className="text-xl font-bold text-zinc-700">
            {fmtPct(meta.banda_inf, 2)} a {fmtPct(meta.banda_sup, 2)}
          </div>
        </div>
        <div className="rounded-lg bg-white/70 p-3">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">Realizado 12m</div>
          <div className={`text-xl font-bold ${statusTxt}`}>{fmtPct(primarioAtual, 2)}</div>
        </div>
        <div className="rounded-lg bg-white/70 p-3">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">Gap vs centro</div>
          <div className={`text-xl font-bold ${statusTxt}`}>
            {(primarioAtual - meta.centro >= 0 ? "+" : "") + (primarioAtual - meta.centro).toFixed(2)} pp
          </div>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-zinc-500">{data.metas_ldo?._fonte}</p>
    </div>
  );
}

export function ReceitaGastosDashboard({ data }: { data: FiscalClassicosData }) {
  const horizonte = useHorizonte(HORIZONTES, "10a");
  const [base, setBase] = useState<Base>("pib");

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
        tail(data.receita_e_gastos.despesa_pct_receita, horizonte.n),
      ],
      ["Primario", "Juros nominais", "Despesa total"],
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

  // Decomposicao COMPLETA de despesa
  const serieDecomp = useMemo(() => {
    const keyBase = base === "pib" ? "pct_pib" : "pct_receita";
    const previdencia = data.receita_e_gastos[`previdencia_12m_${keyBase}` as const];
    const pessoal = data.receita_e_gastos[`pessoal_12m_${keyBase}` as const];
    const bpc = data.receita_e_gastos[`bpc_loas_12m_${keyBase}` as const];
    const abono = data.receita_e_gastos[`abono_seguro_12m_${keyBase}` as const];
    const fundeb = data.receita_e_gastos[`fundeb_12m_${keyBase}` as const];
    const subsidios = data.receita_e_gastos[`subsidios_12m_${keyBase}` as const];
    const discric = data.receita_e_gastos[`discricionarias_12m_${keyBase}` as const];

    const all: Array<{ data: string; valor_pct: number | null }[]> = [];
    const labels: string[] = [];
    if (previdencia) { all.push(tail(previdencia, horizonte.n)); labels.push("Previdência"); }
    if (pessoal) { all.push(tail(pessoal, horizonte.n)); labels.push("Pessoal"); }
    if (bpc) { all.push(tail(bpc, horizonte.n)); labels.push("BPC/LOAS"); }
    if (abono) { all.push(tail(abono, horizonte.n)); labels.push("Abono+seguro"); }
    if (fundeb) { all.push(tail(fundeb, horizonte.n)); labels.push("FUNDEB compl."); }
    if (subsidios) { all.push(tail(subsidios, horizonte.n)); labels.push("Subsídios"); }
    if (discric) { all.push(tail(discric, horizonte.n)); labels.push("Discricionárias"); }
    return { data: mergePct(all, labels), labels };
  }, [data, horizonte.n, base]);

  // KPIs decomposição (último ponto)
  const ult = (key: string) => {
    const s = (data.receita_e_gastos as unknown as Record<string, PontoMensalPct[] | undefined>)[key];
    return ultPct(s);
  };
  const previdencia_pct = ult("previdencia_12m_pct_pib");
  const pessoal_pct_kpi = ult("pessoal_12m_pct_pib");
  const bpc_pct = ult("bpc_loas_12m_pct_pib");
  const abono_pct = ult("abono_seguro_12m_pct_pib");

  return (
    <div className="space-y-6">
      <CardHeader
        titulo="Receita e gastos do governo central"
        subtitulo="Receita líquida do Tesouro (após transferências constitucionais), despesa primária e juros. Fonte: Tesouro Nacional/RTN."
        rightSlot={
          <div className="flex gap-2">
            <Toggle value={base} onChange={(v) => setBase(v as Base)} options={[...BASES]} size="sm" />
            <Toggle value={horizonte.horizonte} onChange={horizonte.setHorizonte} options={[...HORIZONTES]} />
          </div>
        }
      />

      {/* === REGRA FISCAL (meta LDO) === */}
      <RegraFiscalCard data={data} />

      {/* === KPIs principais === */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPI label="Receita líquida" value={fmtPct(receita_pct)} hint="% PIB (12m), após transferências constitucionais" />
        <KPI label="Despesa total" value={fmtPct(despesa_pct)} hint="% PIB (12m)" trend={despesa_pct && despesa_pct > 20 ? "down" : "neutral"} />
        <KPI label="Primário gov central" value={fmtPct(primario_pct)} hint="% PIB (12m); + = superávit" trend={primario_pct && primario_pct > 0 ? "up" : "down"} />
        <KPI label="Juros nominais" value={fmtPct(juros_pct)} hint="% PIB (12m)" trend={juros_pct && juros_pct > 7 ? "down" : "neutral"} />
        <KPI label="Juros / Receita" value={fmtPct(juros_pct_rec)} hint="Métrica Dalio: % da receita líquida" trend={juros_pct_rec && juros_pct_rec > 30 ? "down" : "neutral"} />
        <KPI label="NFSP setor público" value={fmtPct(nfsp_pct)} hint="Necessidade fin. SP consolidado (12m % PIB)" />
        <KPI label="Previdência" value={fmtPct(previdencia_pct)} hint="% PIB (12m)" />
        <KPI label="Pessoal" value={fmtPct(pessoal_pct_kpi)} hint="% PIB (12m)" />
      </div>

      <Section
        titulo="Receita vs despesa (% PIB, 12m)"
        hint="A área entre as linhas é o deficit primário do governo central. Fonte: Tesouro Nacional/RTN."
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

      <Section
        titulo={`Decomposição da despesa primária (${base === "pib" ? "% PIB" : "% Receita"})`}
        hint="Empilhamento das principais rubricas obrigatórias e discricionárias do gov central. Fonte: Tesouro Nacional/RTN, tabela 1.1."
      >
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={serieDecomp.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="mes" tickFormatter={fmtMes} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={fmtTipPct} labelFormatter={fmtTipLabel} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {serieDecomp.labels.map((lbl, i) => (
                <Area
                  key={lbl}
                  type="monotone"
                  dataKey={lbl}
                  stackId="1"
                  stroke={CORES_SERIES[i % CORES_SERIES.length]}
                  fill={CORES_SERIES[i % CORES_SERIES.length]}
                  fillOpacity={0.45}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-zinc-600">
          <span><strong>Previdência:</strong> {fmtPct(previdencia_pct)} PIB</span>
          <span><strong>Pessoal:</strong> {fmtPct(pessoal_pct_kpi)} PIB</span>
          {bpc_pct != null && <span><strong>BPC/LOAS:</strong> {fmtPct(bpc_pct)} PIB</span>}
          {abono_pct != null && <span><strong>Abono+seguro:</strong> {fmtPct(abono_pct)} PIB</span>}
        </div>
      </Section>

      <p className="text-xs text-zinc-500">
        Última atualização: {new Date(data.gerado_em).toLocaleString("pt-BR")}. Pipeline diário 9h BRT.
      </p>
    </div>
  );
}
