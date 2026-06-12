"use client";

import { useMemo } from "react";

import type { CagedQuebraPonto, CagedQuebrasData, CagedTotalData } from "@/lib/painel-emprego";
import { ChartCard } from "@/components/painel/core";
import { fmtBRL, fmtMesCurto, fmtNum } from "@/lib/format-br";
import { baixarCsv, mesIso } from "@/components/painel/atividade/v2/shared";

/**
 * "Análise completa" — tabela dos últimos 12 meses (consolidado oficial +
 * colunas de microdado, com nota de fonte distinta) e a série inteira em CSV
 * padrão Excel pt-BR.
 */

function fmtMilCell(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return fmtNum(v / 1000, 1);
}

export function AnaliseCompletaCaged({
  total,
  quebras,
  geradoEm,
}: {
  total: CagedTotalData;
  quebras: CagedQuebrasData | null;
  geradoEm: string;
}) {
  const qPorMes = useMemo(() => {
    const map = new Map<string, CagedQuebraPonto>();
    if (quebras) for (const q of quebras.serie) map.set(q.mes, q);
    return map;
  }, [quebras]);

  const linhas = useMemo(() => [...total.serie.slice(-12)].reverse(), [total.serie]);

  const baseMes = quebras?.deflator_base_mes ?? null;

  const csvCompleto = () => {
    const header = [
      "mes",
      "saldo",
      "saldo_sa",
      "saldo_sa_mm3",
      "saldo_mm12",
      "admissoes",
      "desligamentos",
      "salario_medio_admissao",
      "salario_adm_real",
      "salario_mediana_adm_real",
      "salario_adm_real_yoy_pct",
      "pct_desligamentos_a_pedido",
    ];
    const rows = total.serie.map((t) => {
      const q = qPorMes.get(t.mes);
      return [
        t.mes,
        t.saldo,
        t.saldo_sa ?? null,
        t.saldo_sa_mm3 ?? null,
        t.saldo_mm12,
        t.admissoes,
        t.demissoes,
        q?.salario_medio_admissao ?? null,
        q?.salario_adm_real ?? null,
        q?.salario_mediana_adm_real ?? null,
        q?.salario_adm_real_yoy_pct ?? null,
        q?.pct_desligamentos_a_pedido ?? null,
      ];
    });
    baixarCsv(`caged-serie-${total.mes_recente}.csv`, header, rows);
  };

  const ult = total.serie[total.serie.length - 1];

  return (
    <ChartCard
      title="Análise completa — últimos 12 meses e série inteira em CSV"
      subtitle="Saldo, dessazonalizado, momentum e fluxos do consolidado oficial; salário real de admissão do microdado (fonte distinta — ver nota)."
      footer={
        <>
          Colunas de saldo/admissões/desligamentos: consolidado oficial MTE via IPEADATA. Coluna marcada com * vem dos
          MICRODADOS PDET (declarações no prazo, ~40–50% de cobertura)
          {baseMes ? `, em R$ de ${fmtMesCurto(baseMes)}` : ""}. SA e mm3 SA: dessazonalização própria (STL).
        </>
      }
      stampGiro={geradoEm}
      stampDado={ult ? mesIso(ult.mes) : null}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-xs">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-[10px] uppercase tracking-wider text-zinc-400">
              <th className="py-1.5 pr-2 font-semibold">Mês</th>
              <th className="py-1.5 pr-2 text-right font-semibold">Saldo (mil)</th>
              <th className="py-1.5 pr-2 text-right font-semibold">SA (mil)</th>
              <th className="py-1.5 pr-2 text-right font-semibold">mm3 SA (mil)</th>
              <th className="py-1.5 pr-2 text-right font-semibold">Admissões (mil)</th>
              <th className="py-1.5 pr-2 text-right font-semibold">Desligamentos (mil)</th>
              <th className="py-1.5 text-right font-semibold">Sal. adm. real*</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((r) => {
              const q = qPorMes.get(r.mes);
              return (
                <tr key={r.mes} className="border-b border-zinc-100">
                  <td className="py-1.5 pr-2 font-semibold text-[#132960]">{fmtMesCurto(r.mes)}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-zinc-700">{fmtMilCell(r.saldo)}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-zinc-700">{fmtMilCell(r.saldo_sa)}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-zinc-700">{fmtMilCell(r.saldo_sa_mm3)}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-zinc-700">{fmtMilCell(r.admissoes)}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-zinc-700">{fmtMilCell(r.demissoes)}</td>
                  <td className="py-1.5 text-right tabular-nums text-zinc-700">{fmtBRL(q?.salario_adm_real ?? null, 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={csvCompleto}
          className="rounded-lg border border-[#132960]/15 px-3 py-1.5 text-xs font-semibold text-[#132960] transition hover:bg-[#132960]/5"
        >
          Baixar série completa (CSV)
        </button>
      </div>
    </ChartCard>
  );
}
