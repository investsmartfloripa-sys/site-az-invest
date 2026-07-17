"use client";

import type { ReactNode } from "react";

import type { TabelaSinteseIgpmBlock } from "@/lib/painel-igpm";
import { ChartCard } from "@/components/painel/core";
import { AZ_CHART } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtSignedNum } from "@/lib/format-br";
import { baixarCsv } from "../v2/shared";

/**
 * Tabela-síntese estilo Carta de Conjuntura (IPEA), espelho do card do IPCA:
 * família IGP (IGP-M, IGP-10, IGP-DI), componentes com peso EFETIVO encadeado
 * + resíduo estrutural e origem do IPA (se a identificação foi validada) ×
 * [m-2, m-1, mês, acum. ano, 12m, peso]. TODO valor vem pré-computado do
 * builder (tabela_sintese) — zero conta aqui. Linhas de janela própria
 * (IGP-10/IGP-DI/origem) carregam o próprio mês entre parênteses.
 * Semântica de inflação: alta em vermelho (pressão), queda em azul.
 */

function celula(v: number | null, opts?: { destaque?: boolean }): ReactNode {
  if (v == null) return <span className="text-zinc-300">—</span>;
  const cor = v > 0 ? AZ_CHART.negText : v < 0 ? AZ_CHART.neutral : undefined;
  return (
    <span className={opts?.destaque ? "font-bold" : undefined} style={{ color: cor }}>
      {fmtSignedNum(v, 2)}
    </span>
  );
}

export function TabelaSinteseIgpmCard({ sintese, geradoEm }: { sintese: TabelaSinteseIgpmBlock; geradoEm: string }) {
  const [m2, m1, m0] = sintese.meses;

  const exportarCsv = () => {
    const header = ["Seção", "Linha", fmtMesCurto(m2), fmtMesCurto(m1), fmtMesCurto(m0), "No ano", "12 meses", "Peso (%)"];
    const rows = sintese.secoes.flatMap((sec) =>
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
    baixarCsv(`igpm-tabela-sintese-${sintese.mes_recente}.csv`, header, rows);
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
      footer="Fontes: FGV via BCB/SGS — 189 (IGP-M), 7447 (IGP-10), 190 (IGP-DI), 7450 (IPA-M), 7456 (IPC-M), 7465 (INCC-M). Peso (%) e contribuição dos componentes usam pesos EFETIVOS encadeados no pipeline (não os 60/30/10 de origem); o resíduo estrutural da aproximação é linha própria. Origem do IPA: família IPA-DI (SGS 7459/7460), identificação revalidada a cada build contra o IPA-DI cheio (SGS 225) — a seção só aparece quando a validação passa. Meses entre parênteses = série com janela de coleta própria."
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
            {sintese.secoes.map((sec) => (
              <FragmentoSecao key={sec.id} titulo={sec.titulo} linhas={sec.linhas} />
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
}: {
  titulo: string;
  linhas: TabelaSinteseIgpmBlock["secoes"][number]["linhas"];
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
          <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{celula(linha.m2)}</td>
          <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{celula(linha.m1)}</td>
          <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
            {celula(linha.m0, { destaque: true })}
          </td>
          <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{celula(linha.acum_ano)}</td>
          <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{celula(linha.acum_12m)}</td>
          <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-zinc-600">
            {linha.peso != null ? fmtNum(linha.peso, 2) : <span className="text-zinc-300">—</span>}
          </td>
        </tr>
      ))}
    </>
  );
}
