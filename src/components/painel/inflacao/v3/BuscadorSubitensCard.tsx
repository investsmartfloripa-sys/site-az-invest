"use client";

import { useMemo, useState } from "react";

import type { IpcaData } from "@/lib/painel-ipca";
import { ChartCard } from "@/components/painel/core";
import { AZ_CHART } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtSignedNum, fmtSignedPct } from "@/lib/format-br";

/**
 * Explorador dos ~440 subitens do IPCA do mês: campo de busca + ordenação por
 * variação, peso ou contribuição. Card de primeira classe (antes ficava
 * escondido dentro de "Maiores influências"). Dados do mês corrente do JSON.
 */

type SortKey = "contrib_pp" | "var" | "peso";

export function BuscadorSubitensCard({ data }: { data: IpcaData }) {
  const { mes, top_altas, top_quedas, todos } = data.maiores_influencias;
  const subitens = todos && todos.length > 0 ? todos : [...top_altas, ...top_quedas];

  const [filtro, setFiltro] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("contrib_pp");
  const [asc, setAsc] = useState(false);

  const visiveis = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    return subitens
      .filter((x) => f === "" || x.subitem.toLowerCase().includes(f))
      .slice()
      .sort((a, b) => (asc ? a[sortBy] - b[sortBy] : b[sortBy] - a[sortBy]));
  }, [subitens, filtro, sortBy, asc]);

  const setSort = (k: SortKey) => {
    if (k === sortBy) setAsc((v) => !v);
    else {
      setSortBy(k);
      setAsc(false);
    }
  };

  return (
    <ChartCard title="Busca por subitem" stampGiro={data.gerado_em} stampDado={mes}>
      <input
        type="text"
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        placeholder={`Buscar entre ${subitens.length} subitens do IPCA de ${fmtMesCurto(mes)}…`}
        className="mb-3 w-full max-w-sm rounded-md border border-[#132960]/20 px-3 py-1.5 text-xs focus:border-[#132960] focus:outline-none"
      />
      <div className="max-h-[520px] overflow-auto rounded-lg border border-zinc-100">
        <table className="min-w-full text-xs">
          <thead className="sticky top-0 bg-zinc-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-zinc-700">Subitem</th>
              {(
                [
                  ["var", "Var. mês (%)"],
                  ["peso", "Peso (%)"],
                  ["contrib_pp", "Contrib. (p.p.)"],
                ] as Array<[SortKey, string]>
              ).map(([key, label]) => (
                <th
                  key={key}
                  className="cursor-pointer whitespace-nowrap px-3 py-2 text-right font-semibold text-zinc-700 hover:text-[#132960]"
                  onClick={() => setSort(key)}
                >
                  {label} {sortBy === key ? (asc ? "↑" : "↓") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white">
            {visiveis.map((x, i) => (
              <tr key={`${x.subitem}-${i}`} className="hover:bg-zinc-50">
                <td className="whitespace-nowrap px-3 py-1.5 text-zinc-700">{x.subitem}</td>
                <td
                  className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums"
                  style={{ color: x.var > 0 ? AZ_CHART.negText : x.var < 0 ? AZ_CHART.neutral : undefined }}
                >
                  {fmtSignedPct(x.var, 2)}
                </td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-zinc-700">
                  {fmtNum(x.peso, 2)}
                </td>
                <td
                  className="whitespace-nowrap px-3 py-1.5 text-right font-semibold tabular-nums"
                  style={{ color: x.contrib_pp > 0 ? AZ_CHART.negText : x.contrib_pp < 0 ? AZ_CHART.neutral : undefined }}
                >
                  {fmtSignedNum(x.contrib_pp, 3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}
