"use client";

import type { ReactNode } from "react";

import type { TabelaSinteseBlock } from "@/lib/painel-ipca";
import { ChartCard } from "@/components/painel/core";
import { AZ_CHART } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtSignedNum } from "@/lib/format-br";
import { baixarCsv } from "../v2/shared";

/**
 * Tabela-síntese estilo Carta de Conjuntura (IPEA): cheio, IPCA-15, grupos,
 * núcleos, categorias e difusão × [m-2, m-1, mês, acum. ano, 12m, peso].
 * TODO valor vem pré-computado do builder (tabela_sintese) — zero conta aqui.
 * Semântica de inflação: alta em vermelho (pressão), queda em azul.
 */

function celula(v: number | null, opts?: { pct?: boolean; destaque?: boolean }): ReactNode {
  if (v == null) return <span className="text-zinc-300">—</span>;
  const texto = opts?.pct ? `${fmtNum(v, 1)}%` : fmtSignedNum(v, 2);
  const cor = opts?.pct ? undefined : v > 0 ? AZ_CHART.negText : v < 0 ? AZ_CHART.neutral : undefined;
  return (
    <span className={opts?.destaque ? "font-bold" : undefined} style={{ color: cor }}>
      {texto}
    </span>
  );
}

export function TabelaSinteseCard({ sintese, geradoEm }: { sintese: TabelaSinteseBlock; geradoEm: string }) {
  const [m2, m1, m0] = sintese.meses;

  // Núcleos ficam FORA da síntese (têm tabela própria na aba Núcleos & difusão).
  const secoes = sintese.secoes.filter((sec) => sec.id !== "nucleos");

  const exportarCsv = () => {
    const header = ["Seção", "Linha", fmtMesCurto(m2), fmtMesCurto(m1), fmtMesCurto(m0), "No ano", "12 meses", "Peso (%)"];
    const rows = secoes.flatMap((sec) =>
      sec.linhas.map((linha) => [
        sec.titulo,
        linha.nome,
        linha.m2,
        linha.m1,
        linha.m0,
        linha.acum_ano,
        linha.acum_12m,
        linha.peso,
      ]),
    );
    baixarCsv(`ipca-tabela-sintese-${sintese.mes_recente}.csv`, header, rows);
  };

  return (
    <ChartCard
      title="Tabela-síntese do mês"
      toolbar={
        <button
          type="button"
          onClick={exportarCsv}
          className="rounded-md border border-[#132960]/20 px-2.5 py-1 text-[11px] font-semibold text-[#132960] transition hover:bg-[#eef2f8]"
        >
          Baixar CSV
        </button>
      }
      stampGiro={geradoEm}
      stampDado={m0}
    >
      <div className="overflow-x-auto rounded-lg border border-zinc-100">
        <table className="min-w-full text-xs">
          <thead className="sticky top-0 bg-zinc-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-zinc-700">Recorte</th>
              {[m2, m1, m0].map((m, i) => (
                <th
                  key={m}
                  className={`whitespace-nowrap px-3 py-2 text-right font-semibold ${i === 2 ? "text-[#132960]" : "text-zinc-700"}`}
                >
                  {fmtMesCurto(m)}
                </th>
              ))}
              <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-zinc-700">No ano</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-zinc-700">12 meses</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-zinc-700">Peso (%)</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {secoes.map((sec) => (
              <FragmentoSecao key={sec.id} titulo={sec.titulo} linhas={sec.linhas} pct={sec.id === "difusao"} />
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}

function FragmentoSecao({
  titulo,
  linhas,
  pct,
}: {
  titulo: string;
  linhas: TabelaSinteseBlock["secoes"][number]["linhas"];
  pct: boolean;
}) {
  return (
    <>
      <tr className="border-t border-zinc-100 bg-[#f8fafc]">
        <td colSpan={7} className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          {titulo}
        </td>
      </tr>
      {linhas.map((linha) => (
        <tr key={linha.id} className="border-t border-zinc-50 hover:bg-zinc-50/60">
          <td className="whitespace-nowrap px-3 py-1.5 font-medium text-zinc-800">
            {linha.nome}
            {linha.mes_proprio ? (
              <span className="ml-1 text-[10px] font-normal text-zinc-400">({fmtMesCurto(linha.mes_proprio)})</span>
            ) : null}
          </td>
          <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{celula(linha.m2, { pct })}</td>
          <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{celula(linha.m1, { pct })}</td>
          <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
            {celula(linha.m0, { pct, destaque: true })}
          </td>
          <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
            {pct ? <span className="text-zinc-300">—</span> : celula(linha.acum_ano)}
          </td>
          <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
            {pct ? <span className="text-zinc-300">—</span> : celula(linha.acum_12m)}
          </td>
          <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-zinc-600">
            {linha.peso != null ? fmtNum(linha.peso, 2) : <span className="text-zinc-300">—</span>}
          </td>
        </tr>
      ))}
    </>
  );
}
