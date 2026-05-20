"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { FiscalClassicosData, PontoMensal, PontoMensalPct } from "@/lib/painel-fiscal";

function formatMes(s: string): string {
  if (!s) return "";
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const [y, m] = s.split("-");
  return `${meses[parseInt(m, 10) - 1]}/${y.slice(2)}`;
}

function fmtPct(v: number | null | undefined, casas = 1): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${v.toFixed(casas)}%`;
}
function fmtNumero(v: number | null | undefined, casas = 0): string {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}
function fmtUSDBilhoes(v: number | null | undefined): string {
  if (v == null) return "—";
  return `US$ ${(v / 1000).toFixed(0)} bi`;
}

function ultimoValor<T extends { valor?: number | null; valor_pct?: number | null }>(serie: T[]): number | null {
  for (let i = serie.length - 1; i >= 0; i--) {
    const r = serie[i];
    const v = r.valor ?? r.valor_pct ?? null;
    if (v != null) return v;
  }
  return null;
}

// Recharts tooltip helpers (typed as unknown -> string)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtTipPct = (v: any): string => (typeof v === "number" ? `${v.toFixed(2)}%` : "—");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtTipNum1 = (v: any): string => (typeof v === "number" ? v.toFixed(1) : "—");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtTipUSDBi = (v: any): string => (typeof v === "number" ? `US$ ${(v / 1000).toFixed(0)} bi` : "—");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtTipLabel = (label: any): string => formatMes(String(label ?? ""));

type KpiCardProps = {
  titulo: string;
  valor: string;
  subtitulo?: string;
  tendencia?: "boa" | "ruim" | "neutra";
};
function KpiCard({ titulo, valor, subtitulo, tendencia }: KpiCardProps) {
  const corValor =
    tendencia === "boa" ? "text-emerald-700" :
    tendencia === "ruim" ? "text-rose-700" :
    "text-[#132960]";
  return (
    <div className="rounded-xl border border-[#132960]/10 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{titulo}</div>
      <div className={`mt-1 text-2xl font-bold ${corValor}`}>{valor}</div>
      {subtitulo && <div className="mt-0.5 text-xs text-zinc-500">{subtitulo}</div>}
    </div>
  );
}

function mergePctSerie(serie: PontoMensalPct[], key: string): Array<Record<string, number | string | null>> {
  return serie.map((r) => ({ mes: r.data, [key]: r.valor_pct }));
}
function mergeMensal(serie: PontoMensal[], key: string): Array<Record<string, number | string | null>> {
  return serie.map((r) => ({ mes: r.data, [key]: r.valor }));
}
function mergeSeries(series: Array<Array<Record<string, number | string | null>>>): Array<Record<string, number | string | null>> {
  const mapa = new Map<string, Record<string, number | string | null>>();
  series.forEach((s) =>
    s.forEach((r) => {
      const m = (r.mes as string) ?? "";
      if (!mapa.has(m)) mapa.set(m, { mes: m });
      Object.assign(mapa.get(m)!, r);
    }),
  );
  return Array.from(mapa.values()).sort((a, b) => String(a.mes).localeCompare(String(b.mes)));
}

const COR_DBGG = "#dc2626";
const COR_DLSP = "#0369a1";
const COR_PRIMARIO = "#0d9488";
const COR_JUROS = "#b91c1c";
const COR_NFSP = "#7c2d12";
const COR_NOMINAL = "#4338ca";
const COR_REER = "#a16207";
const COR_RESERVAS = "#15803d";

export function FiscalDashboard({ data }: { data: FiscalClassicosData }) {
  const [periodo, setPeriodo] = useState<"5a" | "10a" | "max">("10a");

  const dataLimite = useMemo(() => {
    if (periodo === "max") return "0000-01";
    const anos = periodo === "5a" ? 5 : 10;
    const d = new Date();
    d.setFullYear(d.getFullYear() - anos);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, [periodo]);

  const filtra = <T extends { data: string }>(s: T[]) => s.filter((r) => r.data >= dataLimite);

  const dividaCombo = useMemo(() => {
    const dbgg = mergeMensal(filtra(data.divida.dbgg_pct), "DBGG");
    const dlsp = mergeMensal(filtra(data.divida.dlsp_total_pct), "DLSP");
    return mergeSeries([dbgg, dlsp]);
  }, [data, dataLimite]);

  const resultadoCombo = useMemo(() => {
    const prim = mergePctSerie(filtra(data.resultado_fiscal.primario_sp_12m_pct_pib), "Primário");
    const juros = mergeMensal(filtra(data.resultado_fiscal.juros_nominais_sp_12m_pct_pib), "Juros nominais");
    const nominal = mergePctSerie(filtra(data.resultado_fiscal.nominal_sp_12m_pct_pib), "Nominal");
    return mergeSeries([prim, juros, nominal]);
  }, [data, dataLimite]);

  const nfspCombo = useMemo(() => mergeMensal(filtra(data.resultado_fiscal.nfsp_sp_12m_pct_pib), "NFSP"), [data, dataLimite]);
  const reerCombo = useMemo(() => mergeMensal(filtra(data.stress.reer_index), "REER"), [data, dataLimite]);
  const reservasCombo = useMemo(
    () => filtra(data.stress.reservas_usd_mm_mensal).map((r) => ({ mes: r.data, valor: r.valor })),
    [data, dataLimite],
  );
  const selicRealCombo = useMemo(
    () =>
      filtra(data.monetaria.selic_real_ex_post_pct).map((r) => ({
        mes: r.data,
        "Selic nominal": r.selic_nominal_pct,
        "IPCA 12m": r.ipca_12m_pct,
        "Selic real": r.selic_real_pct,
      })),
    [data, dataLimite],
  );

  const dbgg_recente = ultimoValor(data.divida.dbgg_pct);
  const dlsp_recente = ultimoValor(data.divida.dlsp_total_pct);
  const primario_recente = ultimoValor(data.resultado_fiscal.primario_sp_12m_pct_pib);
  const juros_recente = ultimoValor(data.resultado_fiscal.juros_nominais_sp_12m_pct_pib);
  const nfsp_recente = ultimoValor(data.resultado_fiscal.nfsp_sp_12m_pct_pib);
  const reer_recente = ultimoValor(data.stress.reer_index);
  const reservas_recente = ultimoValor(data.stress.reservas_usd_mm_mensal);
  const selic_real_recente = data.destaques.selic_real_recente?.selic_real_pct ?? null;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#132960]">Fiscal — Brasil</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Diagnóstico fiscal brasileiro: dívida, resultado primário, juros, indicadores de stress.
            Atualizado diariamente via BCB SGS, Focus e IBGE.
          </p>
        </div>
        <a
          href="/painel-economico/economia/brasil/fiscal/termometro-fiscal"
          className="rounded-lg border border-[#132960]/20 bg-[#132960] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0a1b3e]"
        >
          Termômetro Fiscal (framework Dalio) →
        </a>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard titulo="DBGG / PIB" valor={fmtPct(dbgg_recente)} subtitulo="Dívida bruta gov. geral" tendencia={dbgg_recente && dbgg_recente > 80 ? "ruim" : "neutra"} />
        <KpiCard titulo="DLSP / PIB" valor={fmtPct(dlsp_recente)} subtitulo="Dívida líquida setor público" />
        <KpiCard titulo="Primário SP 12m" valor={fmtPct(primario_recente)} subtitulo="Positivo = superávit" tendencia={primario_recente && primario_recente > 0 ? "boa" : "ruim"} />
        <KpiCard titulo="Juros nominais 12m" valor={fmtPct(juros_recente)} subtitulo="% PIB" tendencia={juros_recente && juros_recente > 7 ? "ruim" : "neutra"} />
        <KpiCard titulo="NFSP 12m" valor={fmtPct(nfsp_recente)} subtitulo="Necessidade financiamento" tendencia={nfsp_recente && nfsp_recente > 5 ? "ruim" : "neutra"} />
        <KpiCard titulo="Selic real ex-post" valor={fmtPct(selic_real_recente)} subtitulo="a.a. (Selic nominal − IPCA 12m)" tendencia={selic_real_recente && selic_real_recente > 6 ? "ruim" : "neutra"} />
        <KpiCard titulo="REER" valor={fmtNumero(reer_recente, 1)} subtitulo="Câmbio real efetivo (índice)" />
        <KpiCard titulo="Reservas internacionais" valor={fmtUSDBilhoes(reservas_recente)} subtitulo="Estoque último dia útil" />
      </div>

      <div className="flex justify-end gap-2">
        {(["5a", "10a", "max"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriodo(p)}
            className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
              periodo === p ? "bg-[#132960] text-white" : "border border-[#132960]/20 bg-white text-[#132960] hover:bg-zinc-50"
            }`}
          >
            {p === "5a" ? "5 anos" : p === "10a" ? "10 anos" : "Máx"}
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-[#132960]/10 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-[#132960]">Trajetória da dívida</h2>
        <p className="mt-1 text-xs text-zinc-500">
          DBGG (Dívida Bruta do Governo Geral) e DLSP (Dívida Líquida do Setor Público), em % do PIB. Fonte: BCB SGS 13762 e 4513.
        </p>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dividaCombo}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="mes" tickFormatter={formatMes} tick={{ fontSize: 11 }} />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={fmtTipPct} labelFormatter={fmtTipLabel} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={80} stroke="#dc2626" strokeDasharray="3 3" />
              <ReferenceLine y={100} stroke="#7f1d1d" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="DBGG" stroke={COR_DBGG} strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="DLSP" stroke={COR_DLSP} strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-2xl border border-[#132960]/10 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-[#132960]">Resultado fiscal (12 meses, % PIB)</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Primário (positivo = superávit), juros nominais e resultado nominal do setor público. Fonte: BCB SGS 5727 / 5718.
        </p>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={resultadoCombo}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="mes" tickFormatter={formatMes} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={fmtTipPct} labelFormatter={fmtTipLabel} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={0} stroke="#475569" />
              <Line type="monotone" dataKey="Primário" stroke={COR_PRIMARIO} strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="Juros nominais" stroke={COR_JUROS} strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="Nominal" stroke={COR_NOMINAL} strokeWidth={2} strokeDasharray="3 3" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-2xl border border-[#132960]/10 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-[#132960]">NFSP — Necessidade de financiamento do setor público</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Buraco fiscal anual em % do PIB. Soma primário + juros. Fonte: BCB SGS 5727.
        </p>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={nfspCombo}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="mes" tickFormatter={formatMes} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={fmtTipPct} labelFormatter={fmtTipLabel} />
              <ReferenceLine y={5} stroke="#f59e0b" strokeDasharray="3 3" />
              <ReferenceLine y={8} stroke="#dc2626" strokeDasharray="3 3" />
              <Area type="monotone" dataKey="NFSP" stroke={COR_NFSP} fill={COR_NFSP} fillOpacity={0.25} strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-2xl border border-[#132960]/10 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-[#132960]">Selic real ex-post (a.a.)</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Juros reais = (1+Selic) / (1+IPCA 12m) − 1. Termômetro do prêmio de risco e do esforço monetário.
        </p>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={selicRealCombo}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="mes" tickFormatter={formatMes} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={fmtTipPct} labelFormatter={fmtTipLabel} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={0} stroke="#475569" />
              <Line type="monotone" dataKey="Selic nominal" stroke="#64748b" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="IPCA 12m" stroke="#a16207" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="Selic real" stroke={COR_DBGG} strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#132960]/10 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-[#132960]">Câmbio real efetivo (REER)</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Índice (média histórica = 100). Quanto menor, mais desvalorizada a moeda — sinal precoce de stress. Fonte: BCB SGS 11752.
          </p>
          <div className="mt-4 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={reerCombo}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" tickFormatter={formatMes} tick={{ fontSize: 11 }} />
                <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={fmtTipNum1} labelFormatter={fmtTipLabel} />
                <ReferenceLine y={100} stroke="#475569" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="REER" stroke={COR_REER} strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-[#132960]/10 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-[#132960]">Reservas internacionais</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Estoque mensal (último dia útil) em US$ milhões. Fonte: BCB SGS 13621.
          </p>
          <div className="mt-4 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={reservasCombo}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" tickFormatter={formatMes} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={fmtTipUSDBi} labelFormatter={fmtTipLabel} />
                <Area type="monotone" dataKey="valor" stroke={COR_RESERVAS} fill={COR_RESERVAS} fillOpacity={0.2} strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <footer className="text-xs text-zinc-500">
        Última atualização: {new Date(data.gerado_em).toLocaleString("pt-BR")}. Pipeline diário 9h BRT.
      </footer>
    </div>
  );
}
