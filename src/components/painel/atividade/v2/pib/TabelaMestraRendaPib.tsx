"use client";

import { useMemo } from "react";

import type { AtividadeCodaceData, AtividadePibData } from "@/lib/painel-atividade";
import { ChartCard } from "@/components/painel/core";
import { fmtNum } from "@/lib/format-br";
import { baixarCsv, fmtTrimCurto, num } from "../shared";

/**
 * Tabela mestra da renda — a planilha de referência do trimestre mais recente
 * pela ótica da RENDA (Contas Econômicas Integradas resumidas, SIDRA 2072).
 * Uma linha por conta da sequência canônica (PIB → Renda nacional bruta →
 * Renda nacional disponível → Poupança → Capacidade/necessidade de
 * financiamento) e duas colunas: valor em R$ (`contas_economicas`) e a mesma
 * conta como % do PIB (`contas_economicas_pct_pib`, PIB = 100). Tudo do último
 * ponto de cada série — sem cálculo derivado, é o "raio-X" tabular da renda que
 * acompanha os gráficos. Exporta o recorte em CSV (padrão Excel pt-BR).
 *
 * As linhas de RESULTADO (chave começa com "(=") recebem realce; os fluxos que
 * entram/saem ("(+)" / "(-)") ficam indentados, deixando à vista a cascata
 * PIB → ... → financiamento.
 */

// As 12 contas da renda, na ORDEM EXATA da sequência das CEI (SIDRA 2072).
// `resultado` = subtotal da cascata (linhas "(=", em realce).
// As chaves são as strings literais do JSON contas_economicas (com acentos).
const CONTAS: { key: string; resultado?: boolean }[] = [
  { key: "Produto Interno Bruto", resultado: true },
  { key: "(+) Salários (líquidos recebidos do exterior)" },
  { key: "(+) Rendas de propriedade (líquidas recebidas do exterior)" },
  { key: "(=) Renda nacional bruta", resultado: true },
  { key: "(+) Outras transferências correntes (líquidas recebidas do exterior)" },
  { key: "(=) Renda nacional disponível bruta", resultado: true },
  { key: "(-) Despesa de consumo final" },
  { key: "(=) Poupança bruta", resultado: true },
  { key: "(-) Formação bruta de capital" },
  { key: "(+) Cessão de ativos não financeiros não produzidos (aquisições líquidas)" },
  { key: "(+) Transferências de capital (líquidas recebidas do exterior)" },
  { key: "(=) Capacidade / necessidade líquida de financiamento", resultado: true },
];

type LinhaRenda = {
  key: string;
  resultado: boolean;
  reais: number | null;
  pctPib: number | null;
};

export function TabelaMestraRendaPib({
  pib,
  geradoEm,
}: {
  pib: AtividadePibData;
  codace?: AtividadeCodaceData | null;
  geradoEm: string;
}) {
  // Séries de renda: valores em R$ (milhões correntes) e em % do PIB nominal.
  // O tipo das séries não declara "trim" — em runtime ele existe (cast seguro).
  const reaisSerie =
    (pib.contas_economicas?.serie as unknown as Array<Record<string, unknown>>) ?? [];
  const pctSerie =
    (pib.contas_economicas_pct_pib?.serie as unknown as Array<Record<string, unknown>>) ?? [];

  const reaisUlt = reaisSerie[reaisSerie.length - 1] ?? null;
  const pctUlt = pctSerie[pctSerie.length - 1] ?? null;

  // Trimestre de referência: o mais recente entre as séries de renda disponíveis.
  const trimRef = String(
    (reaisUlt?.["trim"] as string | undefined) ??
      (pctUlt?.["trim"] as string | undefined) ??
      pib.trim_recente,
  );

  const linhas = useMemo<LinhaRenda[]>(
    () =>
      CONTAS.map((c) => ({
        key: c.key,
        resultado: !!c.resultado,
        reais: num(reaisUlt, c.key),
        pctPib: num(pctUlt, c.key),
      })),
    [reaisUlt, pctUlt],
  );

  const baixar = () => {
    baixarCsv(
      `pib-tabela-mestra-renda-${trimRef}.csv`,
      ["conta", "valor_rs_milhoes_correntes", "pct_pib_nominal"],
      linhas.map((l) => [l.key, l.reais, l.pctPib]),
    );
  };

  const temReais = reaisSerie.length > 0;
  const temPct = pctSerie.length > 0;

  return (
    <ChartCard
      title={`Tabela mestra da renda — ${fmtTrimCurto(trimRef)}`}
      subtitle="A sequência da renda da economia, do PIB à capacidade (ou necessidade) de financiamento, no trimestre mais recente. Em R$ correntes e como % do PIB; as linhas de resultado (=) destacam cada subtotal da cascata."
      toolbar={
        <button
          type="button"
          onClick={baixar}
          className="rounded-lg border border-[#132960]/20 bg-white px-2.5 py-1 text-xs font-semibold text-[#132960] transition-colors hover:bg-zinc-50"
        >
          Baixar CSV
        </button>
      }
      footer="Fonte: IBGE/SIDRA — Contas Econômicas Integradas das Contas Nacionais Trimestrais (2072). Valores correntes em R$ milhões; % do PIB calculado sobre o PIB nominal do trimestre (PIB = 100). Sequência: PIB (+) salários e rendas de propriedade líquidas do exterior = renda nacional bruta (+) transferências correntes = renda nacional disponível bruta (−) consumo final = poupança bruta (−) formação bruta de capital (+) demais ativos e transferências de capital = capacidade / necessidade líquida de financiamento."
      stampGiro={geradoEm}
      stampDado={trimRef}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-xs tabular-nums">
          <thead>
            <tr className="border-b border-[#132960]/15 text-left text-[11px] uppercase tracking-wide text-zinc-500">
              <th className="py-2 pr-3 font-semibold">Conta</th>
              <th className="py-2 pr-3 text-right font-semibold">R$ milhões</th>
              <th className="py-2 text-right font-semibold">% do PIB</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr
                key={l.key}
                className={`border-b border-zinc-100 ${
                  l.resultado
                    ? "bg-[#132960]/[0.035] font-medium text-[#132960]"
                    : "text-zinc-700"
                }`}
              >
                <td
                  className={`py-1.5 pr-3 ${
                    l.resultado ? "font-semibold text-[#132960]" : "pl-3 font-medium"
                  }`}
                >
                  {l.key}
                </td>
                <td className="py-1.5 pr-3 text-right">{fmtNum(l.reais, 0)}</td>
                <td className="py-1.5 text-right">
                  {l.pctPib == null ? "—" : `${fmtNum(l.pctPib, 1)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(!temReais || !temPct) && (
        <p className="mt-2 text-[11px] text-zinc-400">
          {!temReais && "Coluna R$ milhões indisponível nesta carga. "}
          {!temPct && "Coluna % do PIB indisponível nesta carga."}
        </p>
      )}
    </ChartCard>
  );
}
