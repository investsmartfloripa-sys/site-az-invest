"use client";

import { useState } from "react";

import type { FiiDividend } from "@/lib/painel-fii";

function formatDateBR(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00Z");
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "UTC" });
}
function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

const INITIAL_ROWS = 12;

export function FiiDetailDividends({ dividends }: { dividends: FiiDividend[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? dividends : dividends.slice(0, INITIAL_ROWS);
  const hasMore = dividends.length > INITIAL_ROWS;

  return (
    <section
      aria-label="Rendimentos pagos"
      className="rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm md:p-6"
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Rendimentos</h3>
      {dividends.length === 0 ? (
        <p className="mt-3 text-xs italic text-zinc-400">Sem histórico de rendimentos pago via yfinance.</p>
      ) : (
        <>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#132960]/10 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  <th scope="col" className="px-2 py-2 text-left">Data com</th>
                  <th scope="col" className="px-2 py-2 text-left">Pagamento</th>
                  <th scope="col" className="px-2 py-2 text-right">Valor (R$)</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((d, i) => (
                  <tr key={d.data_com + i} className="border-b border-zinc-100 hover:bg-zinc-50/60">
                    <td className="px-2 py-2 text-zinc-700">{formatDateBR(d.data_com)}</td>
                    <td className="px-2 py-2 text-zinc-500">{formatDateBR(d.pagamento)}</td>
                    <td className="px-2 py-2 text-right tabular-nums font-semibold text-[#132960]">
                      {formatBRL(d.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasMore ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-3 text-[11px] font-semibold text-[#027DFC] hover:underline"
            >
              {expanded ? "Mostrar menos ▲" : `Mostrar todos os ${dividends.length} pagamentos ▼`}
            </button>
          ) : null}
          <p className="mt-2 text-[10px] text-zinc-400">
            Data de pagamento é estimativa (~14 dias após a data ex). Para pagamento exato, consulte o
            relatório gerencial da gestora.
          </p>
        </>
      )}
    </section>
  );
}
