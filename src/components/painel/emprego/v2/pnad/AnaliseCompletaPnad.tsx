"use client";

import { useMemo } from "react";

import type { PnadData } from "@/lib/painel-emprego";
import { ChartCard } from "@/components/painel/core";
import { fmtPct } from "@/lib/format-br";
import { baixarCsv, fmtTrimCurto, num, trimIsoCentral } from "@/components/painel/atividade/v2/shared";
import { PNAD_KEYS, findTrim } from "./shared";

/**
 * Bloco 06 — esmiuçamento profissional: tabela dos últimos 8 trimestres com
 * as taxas-síntese e export CSV da série COMPLETA (todas as taxas + carteira
 * + massa de rendimento) no padrão Excel pt-BR. Substitui a aba-gaveta
 * "Série completa" do dashboard antigo.
 */

const COLUNAS: { key: string; label: string }[] = [
  { key: PNAD_KEYS.desocupacao, label: "Desocup." },
  { key: PNAD_KEYS.desocupacaoSa, label: "Dessaz.*" },
  { key: PNAD_KEYS.participacao, label: "Particip." },
  { key: PNAD_KEYS.nivelOcupacao, label: "Nível ocup." },
  { key: PNAD_KEYS.informalidade, label: "Informal." },
  { key: PNAD_KEYS.subutilizacao, label: "Subutil." },
];

export function AnaliseCompletaPnad({ data, geradoEm }: { data: PnadData; geradoEm: string }) {
  const tabela = useMemo(() => data.taxas.serie.slice(-8).reverse(), [data.taxas.serie]);
  const ultTrim = data.taxas.serie[data.taxas.serie.length - 1]?.trim ?? data.trim_recente;

  const csvTaxasCarteira = () => {
    const carteira = data.carteira?.serie ?? [];
    const header = [
      "trimestre",
      "desocupacao_pct",
      "desocupacao_sa_pct",
      "participacao_pct",
      "nivel_ocupacao_pct",
      "informalidade_pct",
      "subutilizacao_composta_pct",
      "taxa_combinada_pct",
      "com_carteira_mil",
      "sem_carteira_mil",
    ];
    const rows = data.taxas.serie.map((r) => {
      const c = findTrim(carteira, r.trim);
      return [
        r.trim,
        num(r, PNAD_KEYS.desocupacao),
        num(r, PNAD_KEYS.desocupacaoSa),
        num(r, PNAD_KEYS.participacao),
        num(r, PNAD_KEYS.nivelOcupacao),
        num(r, PNAD_KEYS.informalidade),
        num(r, PNAD_KEYS.subutilizacao),
        num(r, PNAD_KEYS.combinada),
        num(c, "com_carteira_mil"),
        num(c, "sem_carteira_mil"),
      ];
    });
    baixarCsv(`pnad-taxas-carteira-${ultTrim}.csv`, header, rows);
  };

  const csvMassa = () => {
    const serie = data.massa_rendimento?.serie ?? [];
    if (serie.length === 0) return;
    const rows = serie.map((r) => [r.mes, r.massa_real_mi, r.massa_yoy_pct]);
    baixarCsv(`pnad-massa-rendimento-${serie[serie.length - 1].mes}.csv`, ["mes", "massa_real_mi", "massa_yoy_pct"], rows);
  };

  return (
    <ChartCard
      title="Análise completa — últimos 8 trimestres"
      subtitle="As taxas-síntese lado a lado e o export da série completa (taxas, carteira e massa de rendimento) em CSV no padrão Excel pt-BR."
      footer="*Dessazonalização própria (STL robusta) — estimativa da casa, não há SA oficial da PNAD. 'Nível ocup.' e participação são % da PIA; informalidade e desocupação, % de bases distintas (ocupados e força de trabalho) — compare variações, não níveis entre colunas."
      stampGiro={geradoEm}
      stampDado={ultTrim ? trimIsoCentral(ultTrim) : null}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-xs">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-[10px] uppercase tracking-wider text-zinc-400">
              <th className="py-1.5 pr-2 font-semibold">Trimestre</th>
              {COLUNAS.map((c) => (
                <th key={c.key} className="py-1.5 pr-2 text-right font-semibold">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tabela.map((r) => (
              <tr key={r.trim} className="border-b border-zinc-100">
                <td className="py-1.5 pr-2 font-semibold text-[#132960]">{fmtTrimCurto(r.trim)}</td>
                {COLUNAS.map((c) => {
                  const v = num(r, c.key);
                  return (
                    <td key={c.key} className="py-1.5 pr-2 text-right tabular-nums text-zinc-700">
                      {v != null ? fmtPct(v, 1) : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={csvTaxasCarteira}
          className="rounded-lg border border-[#132960]/15 px-3 py-1.5 text-xs font-semibold text-[#132960] transition hover:bg-[#132960]/5"
        >
          Baixar taxas + carteira (CSV)
        </button>
        {data.massa_rendimento?.serie?.length ? (
          <button
            type="button"
            onClick={csvMassa}
            className="rounded-lg border border-[#132960]/15 px-3 py-1.5 text-xs font-semibold text-[#132960] transition hover:bg-[#132960]/5"
          >
            Baixar massa de rendimento (CSV)
          </button>
        ) : null}
      </div>
    </ChartCard>
  );
}
