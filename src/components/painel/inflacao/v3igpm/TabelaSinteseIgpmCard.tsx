"use client";

import type { ReactNode } from "react";

import type { TabelaSinteseIgpmBlock } from "@/lib/painel-igpm";
import { ChartCard } from "@/components/painel/core";
import { AZ_CHART } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtSignedNum } from "@/lib/format-br";
import { baixarCsv } from "../v2/shared";

/**
 * Tabela-síntese estilo Carta de Conjuntura (IPEA), espelho do card do IPCA:
 * família IGP (IGP-M, IGP-10, IGP-DI) e componentes com peso EFETIVO encadeado
 * + resíduo estrutural × [m-2, m-1, mês, acum. ano, 12m, peso]. TODO valor vem
 * pré-computado do builder (tabela_sintese) — zero conta aqui. Linhas de
 * janela própria (IGP-10/IGP-DI) carregam o próprio mês entre parênteses.
 * Semântica de inflação: alta em vermelho (pressão), queda em azul.
 *
 * A seção "origem do IPA" (família IPA-DI) NÃO entra aqui por decisão
 * editorial (relatório ago/2026): é assunto do atacado e vive no card
 * próprio da tab IPA-M (OrigemIpaCard) — misturar família IPA-DI na síntese
 * do IGP-M deslocava a leitura.
 */

/** Janela de coleta de cada índice da família IGP — o que os diferencia. */
const JANELA_COLETA: Record<string, string> = {
  igpm: "IGP-M: preços coletados do dia 21 do mês anterior ao dia 20 do mês de referência",
  igp10: "IGP-10: prévia — coleta do dia 11 do mês anterior ao dia 10 do mês de referência",
  igpdi: "IGP-DI: mês civil fechado — coleta do dia 1º ao último dia do mês",
};

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
  const secoes = sintese.secoes.filter((sec) => sec.id !== "origem");

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
      footer="Fontes: FGV via BCB/SGS — 189 (IGP-M), 7447 (IGP-10), 190 (IGP-DI), 7450 (IPA-M), 7453 (IPC-M), 7456 (INCC-M). Peso (%) e contribuição dos componentes usam pesos EFETIVOS encadeados no pipeline (não os 60/30/10 de origem); o resíduo estrutural da aproximação é linha própria. A abertura do IPA por origem (agrícola × industrial, família IPA-DI) vive na tab IPA-M. Meses entre parênteses = série com janela de coleta própria."
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
              <FragmentoSecao key={sec.id} titulo={sec.titulo} linhas={sec.linhas} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
        <strong className="font-semibold text-zinc-600">Mesma cesta, três janelas de coleta:</strong> o{" "}
        <strong className="font-semibold text-zinc-600">IGP-10</strong> é a prévia (coleta do dia 11 do mês
        anterior ao dia 10), o <strong className="font-semibold text-zinc-600">IGP-M</strong> fecha a coleta no
        dia 20 (do dia 21 do mês anterior ao dia 20) e o{" "}
        <strong className="font-semibold text-zinc-600">IGP-DI</strong> cobre o mês civil inteiro (1º ao último
        dia). Por isso os três divergem no mesmo mês — quanto maior a diferença IGP-10 → IGP-DI, mais os preços
        mudaram dentro do mês.
      </p>
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
          <td
            className="whitespace-nowrap px-3 py-1.5 font-medium text-zinc-800"
            title={JANELA_COLETA[linha.id]}
          >
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
