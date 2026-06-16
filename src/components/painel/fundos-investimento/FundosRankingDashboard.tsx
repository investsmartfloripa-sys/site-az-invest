"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import DataStamp from "@/components/painel/DataStamp";
import { fmtNum, fmtPct, fmtSignedPct } from "@/lib/format-br";
import { fundoSlug } from "@/lib/painel-fundos-investimento-data";
import type {
  FundoCategoria,
  FundoJanela,
  FundoRetornos,
  FundoRow,
  FundosRanking,
} from "@/lib/painel-fundos-investimento-data";

const MINUS = "−";
/** Troca o hífen-menos do Intl pelo menos tipográfico da casa (U+2212). */
const tm = (s: string) => s.replace(/-/g, MINUS);

const JANELAS: ReadonlyArray<{ id: FundoJanela; label: string }> = [
  { id: "3m", label: "3M" },
  { id: "6m", label: "6M" },
  { id: "ytd", label: "No ano" },
  { id: "12m", label: "12M" },
];

type SortKey = "nome" | "retorno" | "vol_12m" | "sharpe_12m" | "drawdown_12m";
type SortDir = "asc" | "desc";

function retorno(row: FundoRow, janela: FundoJanela): number | null {
  const v = row.retornos?.[janela];
  return v == null || !Number.isFinite(v) ? null : v;
}

function sortValue(row: FundoRow, key: SortKey, janela: FundoJanela): number | string | null {
  switch (key) {
    case "nome":
      return row.nome;
    case "retorno":
      return retorno(row, janela);
    case "vol_12m":
      return row.vol_12m;
    case "sharpe_12m":
      return row.sharpe_12m;
    case "drawdown_12m":
      return row.drawdown_12m;
  }
}

function compareRows(a: FundoRow, b: FundoRow, key: SortKey, dir: SortDir, janela: FundoJanela): number {
  const va = sortValue(a, key, janela);
  const vb = sortValue(b, key, janela);
  if (va == null && vb == null) return 0;
  if (va == null) return 1;
  if (vb == null) return -1;
  const sign = dir === "asc" ? 1 : -1;
  if (typeof va === "string" && typeof vb === "string") return va.localeCompare(vb, "pt-BR") * sign;
  return ((va as number) - (vb as number)) * sign;
}

/** Cor do retorno relativa ao CDI: verde supera, vermelho fica abaixo. */
function retClass(ret: number | null, cdi: number | null): string {
  if (ret == null) return "text-zinc-400";
  if (cdi != null) {
    if (ret > cdi) return "text-[#16A34A]";
    if (ret < cdi) return "text-[#DC2626]";
    return "text-[#132960]";
  }
  if (ret > 0) return "text-[#16A34A]";
  if (ret < 0) return "text-[#DC2626]";
  return "text-[#132960]";
}

function bestBy(funds: FundoRow[], pick: (f: FundoRow) => number | null): FundoRow | null {
  let best: FundoRow | null = null;
  let bestV = -Infinity;
  for (const f of funds) {
    const v = pick(f);
    if (v == null || !Number.isFinite(v)) continue;
    if (v > bestV) {
      bestV = v;
      best = f;
    }
  }
  return best;
}

function HighlightCard({ tag, fund, value }: { tag: string; fund: FundoRow | null; value: string }) {
  return (
    <article className="rounded-xl border border-[#132960]/15 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#027DFC]">{tag}</p>
      {fund ? (
        <>
          <p className="mt-1 truncate text-sm font-semibold text-[#132960]" title={fund.nome}>
            {fund.nome}
          </p>
          <p className="truncate text-[11px] text-zinc-500">{fund.gestora ?? "—"}</p>
          <p className="mt-2 text-lg font-semibold tabular-nums text-[#132960]">{value}</p>
        </>
      ) : (
        <p className="mt-2 text-sm text-zinc-400">Sem dados.</p>
      )}
    </article>
  );
}

function CategoriaTabela({
  categoria,
  janela,
  cdiJanela,
}: {
  categoria: FundoCategoria;
  janela: FundoJanela;
  cdiJanela: number | null;
}) {
  const [sortKey, setSortKey] = useState<SortKey>(
    categoria.metric_default === "sharpe_12m" ? "sharpe_12m" : "retorno",
  );
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const arr = [...categoria.funds];
    arr.sort((a, b) => compareRows(a, b, sortKey, sortDir, janela));
    return arr;
  }, [categoria.funds, sortKey, sortDir, janela]);

  const bestSharpe = useMemo(() => bestBy(categoria.funds, (f) => f.sharpe_12m), [categoria.funds]);
  const bestRet12 = useMemo(() => bestBy(categoria.funds, (f) => retorno(f, "12m")), [categoria.funds]);

  const acimaCdi = useMemo(() => {
    if (cdiJanela == null) return null;
    return categoria.funds.filter((f) => {
      const r = retorno(f, janela);
      return r != null && r > cdiJanela;
    }).length;
  }, [categoria.funds, janela, cdiJanela]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "nome" ? "asc" : "desc");
    }
  }

  const janelaLabel = JANELAS.find((j) => j.id === janela)?.label ?? janela.toUpperCase();
  const cols: Array<{ key: SortKey; label: string; num: boolean }> = [
    { key: "nome", label: "Fundo", num: false },
    { key: "retorno", label: `Retorno ${janelaLabel}`, num: true },
    { key: "vol_12m", label: "Vol. 12M", num: true },
    { key: "sharpe_12m", label: "Sharpe 12M", num: true },
    { key: "drawdown_12m", label: "Drawdown 12M", num: true },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <HighlightCard
          tag="Melhor Sharpe (12M)"
          fund={bestSharpe}
          value={bestSharpe ? tm(fmtNum(bestSharpe.sharpe_12m, 2)) : "—"}
        />
        <HighlightCard
          tag="Maior retorno (12M)"
          fund={bestRet12}
          value={bestRet12 ? fmtSignedPct(retorno(bestRet12, "12m")) : "—"}
        />
      </div>

      {acimaCdi != null ? (
        <p className="text-[11px] text-zinc-500">
          <span className="font-semibold text-[#132960]">{acimaCdi}</span> de {categoria.funds.length}{" "}
          fundos superaram o CDI em {janelaLabel}.{" "}
          <span className="text-[#16A34A]">Verde</span> = acima do CDI ·{" "}
          <span className="text-[#DC2626]">vermelho</span> = abaixo.
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[#132960]/10 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              {cols.map((c) => {
                const active = c.key === sortKey;
                return (
                  <th key={c.key} scope="col" className={`px-2 py-2 ${c.num ? "text-right" : "text-left"}`}>
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className={`inline-flex items-center gap-1 transition hover:text-[#132960] ${active ? "text-[#132960]" : ""}`}
                    >
                      {c.label}
                      <span aria-hidden className="text-[8px]">
                        {active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={cols.length} className="px-2 py-6 text-center text-zinc-400">
                  Sem fundos nesta categoria.
                </td>
              </tr>
            ) : (
              sorted.map((f, i) => {
                const ret = retorno(f, janela);
                return (
                  <tr key={f.id} className="border-b border-zinc-100 transition hover:bg-zinc-50/60">
                    <td className="px-2 py-2">
                      <span className="flex items-baseline gap-2">
                        <span className="w-4 shrink-0 text-[10px] tabular-nums text-zinc-400">{i + 1}</span>
                        <span className="min-w-0">
                          <Link
                            href={`/painel-economico/mercado/brasil/fundos-investimento/${fundoSlug(f)}`}
                            className="block truncate font-semibold text-[#132960] transition hover:text-[#027DFC] hover:underline"
                            title={`Ver ${f.nome}`}
                          >
                            {f.nome}
                          </Link>
                          <span className="block truncate text-[10px] text-zinc-500" title={f.gestora ?? ""}>
                            {f.gestora ?? "—"}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className={`px-2 py-2 text-right font-semibold tabular-nums ${retClass(ret, cdiJanela)}`}>
                      {fmtSignedPct(ret)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-[#132960]">{fmtPct(f.vol_12m)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-[#132960]">{tm(fmtNum(f.sharpe_12m, 2))}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-zinc-500">{tm(fmtPct(f.drawdown_12m))}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function FundosRankingDashboard({ data }: { data: FundosRanking }) {
  const categorias = data.categories ?? [];
  const [activeKey, setActiveKey] = useState<string>(categorias[0]?.key ?? "");
  const [janela, setJanela] = useState<FundoJanela>("12m");

  const ativa = categorias.find((c) => c.key === activeKey) ?? categorias[0] ?? null;
  const cdi: FundoRetornos | undefined = data.cdi;
  const cdiJanela = cdi?.[janela] ?? null;

  if (!ativa) {
    return (
      <section className="rounded-2xl border border-[#132960]/15 bg-white p-6 text-sm text-zinc-500">
        Nenhuma categoria de fundo disponível no momento.
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm md:p-6">
      <div className="flex flex-wrap items-center gap-3 pb-2">
        {/* Categorias */}
        <div role="tablist" aria-label="Categoria de fundo" className="inline-flex flex-wrap gap-1">
          {categorias.map((c) => {
            const active = c.key === ativa.key;
            return (
              <button
                key={c.key}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => setActiveKey(c.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? "bg-[#132960] text-white"
                    : "border border-[#132960]/20 bg-white text-[#132960] hover:bg-zinc-50"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        {/* Janela do retorno */}
        <div
          role="group"
          aria-label="Janela do retorno"
          className="ml-auto inline-flex flex-wrap items-center gap-1"
        >
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Janela</span>
          {JANELAS.map((j) => {
            const active = j.id === janela;
            return (
              <button
                key={j.id}
                type="button"
                aria-pressed={active}
                onClick={() => setJanela(j.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                  active
                    ? "bg-[#027DFC] text-white"
                    : "border border-[#132960]/20 bg-white text-[#132960] hover:bg-zinc-50"
                }`}
              >
                {j.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Benchmark CDI da janela selecionada */}
      {cdiJanela != null ? (
        <p className="pb-3 text-[11px] text-zinc-500">
          Benchmark{" "}
          <span className="rounded bg-[#132960]/5 px-1.5 py-0.5 font-semibold text-[#132960]">
            CDI {JANELAS.find((j) => j.id === janela)?.label}: {fmtSignedPct(cdiJanela)}
          </span>{" "}
          — o retorno é colorido em relação a esse CDI.
        </p>
      ) : null}

      <CategoriaTabela categoria={ativa} janela={janela} cdiJanela={cdiJanela} />

      <p className="mt-3 text-[10px] text-zinc-400">
        Universo acompanhado pela AZ Invest (curado, não é toda a base CVM). Retorno, volatilidade,
        Sharpe e drawdown via <strong>Mais Retorno</strong> (Data API), dados D-1. Sharpe e a cor do
        retorno usam o <strong>CDI</strong> como referência livre de risco. Não é recomendação de
        investimento.
      </p>
      <p className="mt-2 text-right">
        <DataStamp giro={data.generated_at} dado={data.data_date ?? undefined} />
      </p>
    </section>
  );
}
