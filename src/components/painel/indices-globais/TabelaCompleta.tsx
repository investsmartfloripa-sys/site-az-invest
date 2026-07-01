import DataStamp from "@/components/painel/DataStamp";
import { MethodInfo } from "@/components/painel/core/MethodInfo";
import { variationText } from "@/lib/az-chart-theme";
import { fmtSignedPct } from "@/lib/format-br";
import {
  PANORAMA_PERIODS,
  type PanoramaPeriodKey,
  type WorldIndicesReturnsPayload,
} from "@/lib/painel-mercado-global";

/**
 * Tabela completa (esmiuçamento) — a antiga tabela pivotada desenvolvidos ×
 * emergentes, agora COLAPSADA num <details>: a leitura principal virou a
 * fotografia por região; quem quer a planilha inteira abre aqui.
 *
 * Server-safe: sem hooks.
 */

type TableRow = {
  ticker: string;
  name: string;
  returns: Partial<Record<PanoramaPeriodKey, number | null>>;
};

/** Pivota o by_period (período → lista) em linhas por índice com coluna por período. */
function buildTable(payload: WorldIndicesReturnsPayload): { developed: TableRow[]; emerging: TableRow[] } {
  const map = new Map<string, TableRow & { group: string }>();
  for (const { id } of PANORAMA_PERIODS) {
    for (const r of payload.by_period?.[id]?.data ?? []) {
      if (!r?.ticker) continue;
      let entry = map.get(r.ticker);
      if (!entry) {
        entry = { ticker: r.ticker, name: r.name ?? r.ticker, group: r.group ?? "emerging", returns: {} };
        map.set(r.ticker, entry);
      }
      entry.returns[id] =
        typeof r.return_pct === "number" && Number.isFinite(r.return_pct) ? r.return_pct : null;
    }
  }
  const all = [...map.values()].sort((a, b) => (b.returns["1y"] ?? -Infinity) - (a.returns["1y"] ?? -Infinity));
  return {
    developed: all.filter((r) => r.group === "developed"),
    emerging: all.filter((r) => r.group !== "developed"),
  };
}

function ReturnCell({ value }: { value: number | null | undefined }) {
  if (value == null) return <td className="px-2 py-1.5 text-right text-zinc-400">—</td>;
  return (
    <td className="px-2 py-1.5 text-right font-semibold tabular-nums" style={{ color: variationText(value, 0) }}>
      {fmtSignedPct(value, 1)}
    </td>
  );
}

function GroupRows({ title, rows }: { title: string; rows: TableRow[] }) {
  return (
    <>
      <tr>
        <td colSpan={PANORAMA_PERIODS.length + 1} className="px-2 pb-1 pt-3">
          <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">{title}</span>
        </td>
      </tr>
      {rows.map((r) => (
        <tr key={r.ticker} className="border-t border-zinc-100">
          <td className="max-w-[220px] truncate px-2 py-1.5 text-[#132960]">{r.name}</td>
          {PANORAMA_PERIODS.map((p) => (
            <ReturnCell key={p.id} value={r.returns[p.id]} />
          ))}
        </tr>
      ))}
    </>
  );
}

type Props = {
  panorama: WorldIndicesReturnsPayload;
};

/** <details> com a tabela pivotada completa (16 índices × 5 janelas). */
export function TabelaCompleta({ panorama }: Props) {
  const table = buildTable(panorama);
  const total = table.developed.length + table.emerging.length;
  if (total === 0) return null;

  return (
    <details className="group rounded-2xl border border-[#132960]/10 bg-white p-4 shadow-sm">
      <summary className="cursor-pointer select-none text-sm font-semibold text-[#132960] marker:text-[#027DFC]">
        Ver tabela completa — {total} índices × {PANORAMA_PERIODS.length} janelas
      </summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-zinc-500">
              <th className="px-2 py-1.5 text-left font-semibold">Índice</th>
              {PANORAMA_PERIODS.map((p) => (
                <th key={p.id} className="px-2 py-1.5 text-right font-semibold">
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <GroupRows title="Desenvolvidos" rows={table.developed} />
            <GroupRows title="Emergentes" rows={table.emerging} />
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-2 pt-1">
        <MethodInfo className="align-middle">
          Variação em moeda local, ordenada pelo retorno de 12 meses; Brasil via EWZ (ETF em US$
          listado em NY). Fonte: Yahoo Finance, giro a cada 15 min.
        </MethodInfo>
        <DataStamp giro={panorama.generated_at} dado={panorama.generated_at} />
      </div>
    </details>
  );
}
