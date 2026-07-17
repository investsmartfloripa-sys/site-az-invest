"use client";

import { useMemo, useState } from "react";

import type { IpcaData } from "@/lib/painel-ipca";
import { ChartCard } from "@/components/painel/core";
import { AZ_CHART } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtSignedNum, fmtSignedPct } from "@/lib/format-br";

/**
 * Explorador dos ~380 subitens do IPCA do mês: busca (por subitem, grupo,
 * subgrupo ou item) + ordenação. As colunas de localização (Grupo / Item)
 * situam cada subitem na hierarquia — vêm do builder junto com o código c315.
 */

type SortKey = "contrib_pp" | "var" | "peso" | "acum_12m";

export function BuscadorSubitensCard({ data }: { data: IpcaData }) {
  const { mes, top_altas, top_quedas, todos } = data.maiores_influencias;
  const subitens = todos && todos.length > 0 ? todos : [...top_altas, ...top_quedas];

  const [filtro, setFiltro] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("contrib_pp");
  const [asc, setAsc] = useState(false);

  // JSON antigo em cache pode não ter a hierarquia — as colunas se escondem.
  const temHierarquia = useMemo(() => subitens.some((x) => x.grupo != null), [subitens]);
  const temAcum = useMemo(() => subitens.some((x) => x.acum_12m != null), [subitens]);

  const visiveis = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    return subitens
      .filter(
        (x) =>
          f === "" ||
          x.subitem.toLowerCase().includes(f) ||
          (x.grupo ?? "").toLowerCase().includes(f) ||
          (x.subgrupo ?? "").toLowerCase().includes(f) ||
          (x.item ?? "").toLowerCase().includes(f),
      )
      .slice()
      .sort((a, b) => {
        const va = a[sortBy] ?? Number.NEGATIVE_INFINITY;
        const vb = b[sortBy] ?? Number.NEGATIVE_INFINITY;
        return asc ? (va as number) - (vb as number) : (vb as number) - (va as number);
      });
  }, [subitens, filtro, sortBy, asc]);

  const setSort = (k: SortKey) => {
    if (k === sortBy) setAsc((v) => !v);
    else {
      setSortBy(k);
      setAsc(false);
    }
  };

  const colunas: Array<[SortKey, string]> = [
    ["var", "Var. mês (%)"],
    ["peso", "Peso (%)"],
    ["contrib_pp", "Contrib. (p.p.)"],
    ...(temAcum ? ([["acum_12m", "12 meses (%)"]] as Array<[SortKey, string]>) : []),
  ];

  return (
    <ChartCard title="Busca por subitem" stampGiro={data.gerado_em} stampDado={mes}>
      <input
        type="text"
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        placeholder={`Buscar entre ${subitens.length} subitens do IPCA de ${fmtMesCurto(mes)} — por subitem, grupo ou item…`}
        className="mb-3 w-full max-w-md rounded-md border border-[#132960]/20 px-3 py-1.5 text-xs focus:border-[#132960] focus:outline-none"
      />
      <div className="max-h-[520px] overflow-auto rounded-lg border border-zinc-100">
        <table className="min-w-full text-xs">
          <thead className="sticky top-0 z-10 bg-zinc-50">
            <tr>
              {temHierarquia ? (
                <>
                  <th className="px-3 py-2 text-left font-semibold text-zinc-700">Grupo</th>
                  <th className="px-3 py-2 text-left font-semibold text-zinc-700">Item</th>
                </>
              ) : null}
              <th className="px-3 py-2 text-left font-semibold text-zinc-700">Subitem</th>
              {colunas.map(([key, label]) => (
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
              <tr key={`${x.codigo ?? x.subitem}-${i}`} className="hover:bg-zinc-50">
                {temHierarquia ? (
                  <>
                    <td className="whitespace-nowrap px-3 py-1.5 text-zinc-500">{x.grupo ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-zinc-500">{x.item ?? "—"}</td>
                  </>
                ) : null}
                <td className="whitespace-nowrap px-3 py-1.5 font-medium text-zinc-800">{x.subitem}</td>
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
                {temAcum ? (
                  <td
                    className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums"
                    style={{
                      color:
                        x.acum_12m != null && x.acum_12m > 0
                          ? AZ_CHART.negText
                          : x.acum_12m != null && x.acum_12m < 0
                            ? AZ_CHART.neutral
                            : undefined,
                    }}
                  >
                    {x.acum_12m != null ? fmtSignedNum(x.acum_12m, 2) : "—"}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}
