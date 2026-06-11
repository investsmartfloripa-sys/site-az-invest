"use client";

import { useMemo } from "react";

import type { AluguelBlock } from "@/lib/painel-igpm";
import { ChartCard } from "@/components/painel/core";
import { AZ_CHART, variationText } from "@/lib/az-chart-theme";
import { fmtBRL, fmtMesCurto, fmtPct, fmtSignedPct } from "@/lib/format-br";
import { ALUGUEL_ILUSTRATIVO, leituraAluguel } from "./shared";

/**
 * Bloco 03 — "IGP-M na vida real": o leigo chega ao painel por UMA razão —
 * aluguel/contratos. Tabela dos últimos 5 reajustes anuais (IGP-M 12m no mês
 * de aniversário) contra o que seria pelo IPCA, num aluguel ilustrativo.
 *
 * Regra contratual de mercado embutida (crítica do revisor): cláusula de
 * não-redução — IGP-M 12m negativo congela o aluguel ("fica estável"),
 * não reduz. Os anos de 2023-24 mostram exatamente isso.
 */
export function AluguelCard({ aluguel, geradoEm }: { aluguel: AluguelBlock; geradoEm: string }) {
  const rows = useMemo(
    () =>
      aluguel.reajustes.map((r) => ({
        ...r,
        novoIgpm: ALUGUEL_ILUSTRATIVO * (1 + r.aplicado_pct / 100),
        novoIpca: ALUGUEL_ILUSTRATIVO * (1 + Math.max(r.ipca_12m, 0) / 100),
      })),
    [aluguel.reajustes],
  );

  // Acumulado dos 5 reajustes (composto sobre os percentuais do builder).
  const acumulado = useMemo(() => {
    let igpm = 1;
    let ipca = 1;
    for (const r of rows) {
      igpm *= 1 + r.aplicado_pct / 100;
      ipca *= 1 + Math.max(r.ipca_12m, 0) / 100;
    }
    return { igpm: (igpm - 1) * 100, ipca: (ipca - 1) * 100 };
  }, [rows]);

  const atual = rows[0];
  if (!atual) return null;

  const titulo = `Reajuste pelo IGP-M hoje: ${leituraAluguel(atual.igpm_12m)}`;

  return (
    <ChartCard
      title={titulo}
      subtitle={`Quem tem contrato corrigido pelo IGP-M paga quanto a mais — e quanto seria pelo IPCA? Reajustes anuais no aniversário de ${fmtMesCurto(aluguel.mes_referencia)} sobre um aluguel ilustrativo de ${fmtBRL(ALUGUEL_ILUSTRATIVO, 0)}.`}
      footer={`Cláusula de não-redução (padrão de mercado): IGP-M 12m negativo congela o aluguel — por isso 2023 e 2024 aplicam 0%. Acumulado dos ${rows.length} reajustes: IGP-M ${fmtSignedPct(acumulado.igpm, 1)} vs IPCA ${fmtSignedPct(acumulado.ipca, 1)}.`}
      stampGiro={geradoEm}
      stampDado={aluguel.mes_referencia}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500">
              <th className="px-3 py-2 font-semibold">Aniversário</th>
              <th className="px-3 py-2 text-right font-semibold">IGP-M 12m</th>
              <th className="px-3 py-2 text-right font-semibold">Reajuste aplicado</th>
              <th className="px-3 py-2 text-right font-semibold">IPCA 12m</th>
              <th className="px-3 py-2 text-right font-semibold">Aluguel c/ IGP-M</th>
              <th className="px-3 py-2 text-right font-semibold">Seria c/ IPCA</th>
              <th className="px-3 py-2 text-right font-semibold">Diferença/mês</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((r) => {
              const dif = r.novoIgpm - r.novoIpca;
              return (
                <tr key={r.ano} className="hover:bg-zinc-50">
                  <td className="whitespace-nowrap px-3 py-2 font-semibold text-[#132960]">
                    {fmtMesCurto(r.mes)}
                  </td>
                  <td
                    className="whitespace-nowrap px-3 py-2 text-right tabular-nums"
                    style={{ color: variationText(r.igpm_12m) }}
                  >
                    {fmtSignedPct(r.igpm_12m, 2)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-700">
                    {r.clausula_nao_reducao ? (
                      <span title="IGP-M negativo: cláusula de não-redução segura o reajuste em zero">
                        0% <span className="text-[10px] text-zinc-400">(estável)</span>
                      </span>
                    ) : (
                      fmtPct(r.aplicado_pct, 2)
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-700">
                    {fmtSignedPct(r.ipca_12m, 2)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-700">
                    {fmtBRL(r.novoIgpm)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-700">
                    {fmtBRL(r.novoIpca)}
                  </td>
                  <td
                    className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums"
                    style={{ color: dif > 0 ? AZ_CHART.negText : dif < 0 ? AZ_CHART.posText : undefined }}
                  >
                    {dif > 0 ? "+" : ""}
                    {fmtBRL(dif)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">
        Cada linha é um contrato hipotético independente reajustado naquele aniversário (não é a trajetória
        de um mesmo contrato). Diferença em vermelho = IGP-M cobrou mais que o IPCA; verde = cobrou menos.
      </p>
    </ChartCard>
  );
}
