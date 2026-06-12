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

import type { IcfData } from "@/lib/painel-visao-geral";
import { formatMes } from "@/lib/painel-visao-geral";
import DataStamp from "@/components/painel/DataStamp";

export function CardIcf({ data }: { data: IcfData | null }) {
  if (!data || data.serie.length === 0) return null;
  return (
    <div className="rounded-2xl border-2 border-[#132960]/20 bg-gradient-to-br from-white to-zinc-50 p-5 shadow-sm">
      <h3 className="text-base font-semibold text-zinc-900">Índice de Condições Financeiras (próprio)</h3>
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
      <p className="mt-2"><DataStamp giro={data.gerado_em} dado={data.serie[data.serie.length - 1]?.mes} /></p>
    </div>
  );
}
