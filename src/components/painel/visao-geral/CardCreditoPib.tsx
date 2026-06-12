"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";

import type { CreditoData } from "@/lib/painel-visao-geral";
import { formatMes } from "@/lib/painel-visao-geral";
import DataStamp from "@/components/painel/DataStamp";

export function CardCreditoPib({ data }: { data: CreditoData | null }) {
  if (!data || data.credito_pib.length === 0) return null;
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-zinc-900">Crédito ampliado / PIB</h3>
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
      <p className="mt-2"><DataStamp giro={data.gerado_em} dado={data.credito_pib[data.credito_pib.length - 1]?.mes} /></p>
    </div>
  );
}
