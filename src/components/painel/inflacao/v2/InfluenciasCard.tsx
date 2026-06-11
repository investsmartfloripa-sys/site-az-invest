"use client";

import { useMemo, useState } from "react";

import type { Influencia, IpcaData } from "@/lib/painel-ipca";
import { ChartCard } from "@/components/painel/core";
import { DivergingReturnBars } from "@/components/painel/charts/DivergingReturnBars";
import { AZ_CHART } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtSignedNum, fmtSignedPct } from "@/lib/format-br";
import { num } from "./shared";

/**
 * Bloco 05 — "quais itens fizeram o IPCA deste mês?" — FUSÃO dos dois cards
 * redundantes do painel antigo (MaioresInfluencias + TabelaInfluencias).
 *
 * Barra divergente única: top 8 altas + top 8 quedas em p.p., com "Demais
 * itens" fechando a conta com o IPCA cheio (âncora no total — o leitor vê que
 * as barras SOMAM o índice). Cores na semântica de inflação (alta = vermelho,
 * pressão; queda = azul) — exceção documentada ao padrão verde/vermelho.
 * A tabela completa (~440 subitens, busca + sort) vira o modo expandido.
 *
 * Atenção de unidade (crítica do revisor): o total do mês é variação em %;
 * as barras são contribuições em p.p. (var × peso ÷ 100).
 */

type SortKey = "contrib_pp" | "var" | "peso";

function SubitensTable({ subitens }: { subitens: Influencia[] }) {
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
    <div className="mt-3">
      <input
        type="text"
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        placeholder={`Buscar entre ${subitens.length} subitens…`}
        className="mb-2 w-full max-w-xs rounded-md border border-[#132960]/20 px-3 py-1.5 text-xs focus:border-[#132960] focus:outline-none"
      />
      <div className="max-h-96 overflow-auto rounded-lg border border-zinc-100">
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
                  style={{
                    color: x.contrib_pp > 0 ? AZ_CHART.negText : x.contrib_pp < 0 ? AZ_CHART.neutral : undefined,
                  }}
                >
                  {fmtSignedNum(x.contrib_pp, 3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function InfluenciasCard({ data }: { data: IpcaData }) {
  const { mes, top_altas, top_quedas, todos } = data.maiores_influencias;
  const subitens = todos && todos.length > 0 ? todos : [...top_altas, ...top_quedas];

  const ipcaMes = num(
    data.ipca_cheio.serie.find((r) => r.mes === mes),
    "IPCA cheio",
  );

  const rows = useMemo(() => {
    const altas = top_altas.filter((x) => x.contrib_pp > 0).slice(0, 8);
    const quedas = top_quedas.filter((x) => x.contrib_pp < 0).slice(0, 8);
    const selecionados = [...altas, ...quedas];
    const out = selecionados.map((x) => ({ label: x.subitem, value: x.contrib_pp }));
    if (ipcaMes != null) {
      const demais = ipcaMes - selecionados.reduce((s, x) => s + x.contrib_pp, 0);
      out.push({ label: "Demais itens", value: Number(demais.toFixed(4)) });
    }
    return out.sort((a, b) => b.value - a.value);
  }, [top_altas, top_quedas, ipcaMes]);

  const titulo =
    top_altas.length > 0
      ? `${top_altas[0].subitem}${top_altas.length > 1 ? ` e ${top_altas[1].subitem}` : ""} puxaram o IPCA de ${fmtMesCurto(mes)}`
      : `Maiores influências de ${fmtMesCurto(mes)}`;

  return (
    <ChartCard
      title={titulo}
      subtitle="Quais itens fizeram o índice do mês? Top 8 altas e 8 quedas em pontos percentuais; “Demais itens” fecha a conta com o IPCA cheio."
      footer="Contribuição = variação × peso ÷ 100 (convenção do release do IBGE). Alta em vermelho (pressão) e queda em azul — semântica de inflação."
      stampGiro={data.gerado_em}
      stampDado={mes}
    >
      {ipcaMes != null ? (
        <p className="mb-2 text-xs text-zinc-600">
          IPCA do mês: <strong className="text-[#132960]">{fmtSignedPct(ipcaMes, 2)}</strong> (variação %) — as
          contribuições abaixo, em p.p., somam exatamente esse número.
        </p>
      ) : null}

      <DivergingReturnBars
        rows={rows}
        yAxisWidth={150}
        valueFmt={(v) => `${fmtSignedNum(v, 2)} p.p.`}
        axisFmt={(v) => fmtSignedNum(v, Math.abs(v) < 1 ? 2 : 1)}
        fillFor={(v) => (v > 0 ? AZ_CHART.neg : AZ_CHART.neutral)}
      />

      <details className="group mt-3 rounded-lg border border-zinc-100 bg-zinc-50/60 p-3">
        <summary className="cursor-pointer select-none text-xs font-semibold text-[#132960] marker:text-[#027DFC]">
          Ver tabela completa ({subitens.length} subitens do mês)
        </summary>
        <SubitensTable subitens={subitens} />
      </details>
    </ChartCard>
  );
}
