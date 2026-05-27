"use client";

import {
  LineChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";

import type { CreditoData, IcfData } from "@/lib/painel-visao-geral";
import { formatMes } from "@/lib/painel-visao-geral";

function CardIcf({ data }: { data: IcfData | null }) {
  if (!data || data.serie.length === 0) return null;
  return (
    <div className="rounded-2xl border-2 border-[#132960]/20 bg-gradient-to-br from-white to-zinc-50 p-5 shadow-sm">
      <h3 className="text-base font-semibold text-zinc-900">E1 — Índice de Condições Financeiras (próprio)</h3>
      <p className="text-xs text-zinc-500">
        Z-score combinado: Selic real ex-ante (sinal invertido) + Ibov 6m + REER. {">"}{" "}
        +1 = estimulativas; {"<"} -1 = restritivas.
      </p>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data.serie}>
          <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
          <XAxis dataKey="mes" tick={{ fontSize: 10 }} interval={Math.max(1, Math.floor(data.serie.length / 12))} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip
            formatter={(v: unknown) => (typeof v === "number" ? v.toFixed(2) : String(v ?? ""))}
            labelFormatter={(l: unknown) => formatMes(String(l ?? ""))}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine y={1} stroke="#059669" strokeDasharray="2 4" />
          <ReferenceLine y={0} stroke="#000" strokeDasharray="2 4" />
          <ReferenceLine y={-1} stroke="#DC2626" strokeDasharray="2 4" />
          <Line type="monotone" dataKey="icf_zscore" stroke="#132960" strokeWidth={2.5} dot={false} name="ICF (z-score)" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function CardSelicReal({ data }: { data: IcfData | null }) {
  if (!data || data.serie.length === 0) return null;
  const dados = data.serie.slice(-120).map((p) => ({
    mes: p.mes,
    selic_real: p.selic_real_ex_ante_pct,
  }));
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-zinc-900">E3 — Selic real ex-ante</h3>
      <p className="text-xs text-zinc-500">Selic meta menos IPCA esperado 12m (Focus). Acima de ~4% costuma antecede freio.</p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={dados}>
          <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
          <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
          <Tooltip
            formatter={(v: unknown) => (typeof v === "number" ? `${v.toFixed(2)}%` : String(v ?? ""))}
            labelFormatter={(l: unknown) => formatMes(String(l ?? ""))}
          />
          <ReferenceLine y={4} stroke="#DC2626" strokeDasharray="2 4" label={{ value: "4% — restritivo", fontSize: 9, fill: "#DC2626" }} />
          <ReferenceLine y={0} stroke="#000" strokeDasharray="2 4" />
          <Line type="monotone" dataKey="selic_real" stroke="#DC2626" strokeWidth={2} dot={false} name="Selic real ex-ante" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function CardConcessoes({ data }: { data: CreditoData | null }) {
  if (!data) return null;
  const pf = data.concessoes.pf_total_real_12m_var_pct ?? [];
  const pj = data.concessoes.pj_total_real_12m_var_pct ?? [];
  const todos = new Set<string>();
  for (const arr of [pf, pj]) for (const p of arr) todos.add(p.mes);
  const dados = Array.from(todos)
    .sort()
    .slice(-60)
    .map((mes) => ({
      mes,
      pf: pf.find((p) => p.mes === mes)?.valor ?? null,
      pj: pj.find((p) => p.mes === mes)?.valor ?? null,
    }));
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-zinc-900">E4 — Concessões reais 12m (BCB)</h3>
      <p className="text-xs text-zinc-500">
        Variação real a/a das concessões PF e PJ. Queda sustentada antecede atividade em 3-6 meses.
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={dados}>
          <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
          <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
          <Tooltip
            formatter={(v: unknown) => (typeof v === "number" ? `${v.toFixed(1)}%` : String(v ?? ""))}
            labelFormatter={(l: unknown) => formatMes(String(l ?? ""))}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine y={0} stroke="#000" strokeDasharray="2 4" />
          <Line type="monotone" dataKey="pf" stroke="#2563EB" dot={false} strokeWidth={1.5} name="PF" connectNulls />
          <Line type="monotone" dataKey="pj" stroke="#DC2626" dot={false} strokeWidth={1.5} name="PJ" connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function CardCreditoPib({ data }: { data: CreditoData | null }) {
  if (!data || data.credito_pib.length === 0) return null;
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-zinc-900">E5 — Crédito ampliado / PIB</h3>
      <p className="text-xs text-zinc-500">Indicador estrutural — trajetória de alavancagem.</p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data.credito_pib.slice(-120)}>
          <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
          <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
          <Tooltip
            formatter={(v: unknown) => (typeof v === "number" ? `${v.toFixed(1)}%` : String(v ?? ""))}
            labelFormatter={(l: unknown) => formatMes(String(l ?? ""))}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="credito_total_pct_pib" stroke="#132960" strokeWidth={2} dot={false} name="Total" connectNulls />
          <Line type="monotone" dataKey="credito_familias_pct_pib" stroke="#2563EB" strokeWidth={1.5} dot={false} name="Famílias" connectNulls />
          <Line type="monotone" dataKey="credito_empresas_pct_pib" stroke="#DC2626" strokeWidth={1.5} dot={false} name="Empresas" connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BlocoECondicoesFinanceiras({
  icf,
  credito,
}: {
  icf: IcfData | null;
  credito: CreditoData | null;
}) {
  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-xl font-bold text-[#132960]">5. O crédito está apertando? (condições financeiras)</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Estímulo ou aperto? ICF próprio, Selic real ex-ante, concessões e crédito/PIB.
        </p>
      </header>
      <CardIcf data={icf} />
      <CardSelicReal data={icf} />
      <CardConcessoes data={credito} />
      <CardCreditoPib data={credito} />
    </section>
  );
}
