"use client";

import { useMemo } from "react";

import type { MomentumBlock, TabelaSinteseBlock } from "@/lib/painel-ipca";
import { ChartCard } from "@/components/painel/core";
import { AZ_CHART } from "@/lib/az-chart-theme";
import { fmtNum, fmtSignedNum } from "@/lib/format-br";

/**
 * Núcleos por transformação (tabela do RTI/BCB): variação do mês, SAAR 3m e
 * 6m dessazonalizados e 12m composto — cada núcleo numa linha, IPCA como
 * régua. Tudo pré-computado no builder (síntese + momentum).
 */

function Num({ v, dec = 2 }: { v: number | null | undefined; dec?: number }) {
  if (v == null) return <span className="text-zinc-300">—</span>;
  return (
    <span
      className="tabular-nums"
      style={{ color: v > 4.5 ? AZ_CHART.negText : v < 1.5 ? AZ_CHART.neutral : undefined }}
      title={v > 4.5 ? "acima do teto da meta" : v < 1.5 ? "abaixo do piso da meta" : undefined}
    >
      {fmtNum(v, dec)}
    </span>
  );
}

export function TabelaNucleosCard({
  sintese,
  momentum,
  geradoEm,
}: {
  sintese: TabelaSinteseBlock;
  momentum: MomentumBlock | undefined;
  geradoEm: string;
}) {
  const linhas = useMemo(() => {
    const secoes = Object.fromEntries(sintese.secoes.map((s) => [s.id, s.linhas]));
    const ultimo = (sid: string, campo: "saar_3m" | "saar_6m") => {
      const serie = momentum?.series[sid];
      const p = serie?.[serie.length - 1];
      return p?.[campo] ?? null;
    };
    const out: Array<{ id: string; nome: string; mes: number | null; saar3: number | null; saar6: number | null; acum12: number | null; regua?: boolean }> = [];
    const ipca = (secoes.indice ?? []).find((l) => l.id === "ipca");
    if (ipca) {
      out.push({ id: "ipca", nome: "IPCA cheio", mes: ipca.m0, saar3: ultimo("ipca", "saar_3m"), saar6: ultimo("ipca", "saar_6m"), acum12: ipca.acum_12m, regua: true });
    }
    for (const linha of secoes.nucleos ?? []) {
      const sid = linha.id.startsWith("nucleo_") ? linha.id.replace("nucleo_", "").toUpperCase() : linha.id;
      out.push({
        id: linha.id,
        nome: linha.nome,
        mes: linha.m0,
        saar3: linha.id === "nucleos_media" ? (momentum?.media_nucleos_saar3m.at(-1)?.saar_3m ?? null) : ultimo(sid, "saar_3m"),
        saar6: linha.id === "nucleos_media" ? null : ultimo(sid, "saar_6m"),
        acum12: linha.acum_12m,
      });
    }
    for (const linha of secoes.categorias ?? []) {
      out.push({
        id: linha.id,
        nome: linha.nome,
        mes: linha.m0,
        saar3: ultimo(linha.id, "saar_3m"),
        saar6: ultimo(linha.id, "saar_6m"),
        acum12: linha.acum_12m,
      });
    }
    return out;
  }, [sintese, momentum]);

  const mesRef = sintese.mes_recente;

  return (
    <ChartCard
      title="Núcleos e categorias por transformação"
      stampGiro={geradoEm}
      stampDado={mesRef}
    >
      <div className="overflow-x-auto rounded-lg border border-zinc-100">
        <table className="min-w-full text-xs">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-zinc-700">Medida</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-zinc-700">Mês (%)</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-zinc-700">SAAR 3m dessaz (%)</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-zinc-700">SAAR 6m dessaz (%)</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-zinc-700">12 meses (%)</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {linhas.map((linha) => (
              <tr
                key={linha.id}
                className={`border-t border-zinc-50 ${linha.regua ? "bg-[#f8fafc] font-semibold" : "hover:bg-zinc-50/60"}`}
              >
                <td className="whitespace-nowrap px-3 py-1.5 text-zinc-800">{linha.nome}</td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right">
                  {linha.mes != null ? (
                    <span className="tabular-nums" style={{ color: linha.mes > 0 ? AZ_CHART.negText : linha.mes < 0 ? AZ_CHART.neutral : undefined }}>
                      {fmtSignedNum(linha.mes, 2)}
                    </span>
                  ) : (
                    <span className="text-zinc-300">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right"><Num v={linha.saar3} /></td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right"><Num v={linha.saar6} /></td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right"><Num v={linha.acum12} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}
