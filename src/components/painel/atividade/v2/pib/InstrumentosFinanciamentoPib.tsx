"use client";

import { useMemo } from "react";

import type { AtividadeCodaceData, AtividadePibData } from "@/lib/painel-atividade";
import { ChartCard, RankingTable, type RankingTableRow } from "@/components/painel/core";
import { fmtNum } from "@/lib/format-br";
import { num } from "../shared";

/**
 * Quem financia o país, e com qual instrumento — leitura da CONTA FINANCEIRA das
 * Contas Nacionais Trimestrais (SIDRA 2205, série iniciada em 2010). O recorte é
 * o PASSIVO por instrumento financeiro: a variação de PASSIVOS é a ENTRADA de
 * recursos na economia (o resto do mundo / outros setores adquirem haveres
 * contra o país — ou seja, financiam o país). Lemos a soma móvel de 4 trimestres
 * (`serie_acum4t`) para um fluxo anualizado, em R$ bilhões, e ordenamos os
 * instrumentos F.2…F.8 pela magnitude do fluxo.
 *
 * Sinal importa: passivo positivo = captação líquida (entrada de recursos);
 * negativo = amortização líquida (saída). A barra fica verde quando entra
 * financiamento e vermelha quando o instrumento devolve recursos ao exterior.
 *
 * Destaques de leitura: F.5 (participações de capital / equity — o "dinheiro de
 * sócio") e F.3 (títulos de dívida — o "dinheiro de credor"), os dois principais
 * canais de financiamento de mercado.
 *
 * `conta_financeira` NÃO está declarado no tipo AtividadePibData — acessamos via
 * cast e tratamos ausência (carga sem a conta financeira → placeholder).
 */

// Instrumentos de financiamento a exibir (passivo, fluxo acum-4T).
// F.1 (ouro/DES) fica de fora por não ser canal de financiamento do país.
const INSTRUMENTOS: { key: string; destaque?: "equity" | "titulos" }[] = [
  { key: "f2" },
  { key: "f3", destaque: "titulos" },
  { key: "f4" },
  { key: "f5", destaque: "equity" },
  { key: "f6" },
  { key: "f7" },
  { key: "f8" },
];

// Rótulos legíveis dos instrumentos (labels_financeiro do JSON traz só códigos
// SIDRA, não nomes) — convenção do SCN/MBP6 para a conta financeira.
const ROTULO_INSTRUMENTO: Record<string, string> = {
  f2: "F.2 — Moeda e depósitos",
  f3: "F.3 — Títulos de dívida",
  f4: "F.4 — Empréstimos",
  f5: "F.5 — Participações de capital (equity)",
  f6: "F.6 — Seguros e previdência",
  f7: "F.7 — Derivativos financeiros",
  f8: "F.8 — Outras contas a receber/pagar",
};

type Row = Record<string, unknown> & { trim?: string };

type ContaFinanceira = {
  serie?: Row[];
  serie_acum4t?: Row[];
};

type LinhaInstrumento = {
  key: string;
  rotulo: string;
  /** Fluxo de passivo (entrada de recursos) em R$ bilhões — com sinal. */
  bi: number;
  destaque?: "equity" | "titulos";
};

export function InstrumentosFinanciamentoPib({
  pib,
  // codace aceito por simetria com os demais cards da face; não usado (snapshot de fluxo anualizado, sem eixo de tempo).
  geradoEm,
}: {
  pib: AtividadePibData;
  codace?: AtividadeCodaceData | null;
  geradoEm: string;
}) {
  const cf = (
    pib as unknown as {
      conta_financeira?: ContaFinanceira;
      labels_financeiro?: Record<string, string>;
    }
  ).conta_financeira;

  const { linhas, trimRef, semDado } = useMemo(() => {
    const serie = cf?.serie_acum4t ?? [];
    const ult = serie.length ? serie[serie.length - 1] : null;

    const out: LinhaInstrumento[] = [];
    if (ult) {
      for (const inst of INSTRUMENTOS) {
        const v = num(ult, `${inst.key}_passivo`);
        if (v == null) continue;
        out.push({
          key: inst.key,
          rotulo: ROTULO_INSTRUMENTO[inst.key] ?? inst.key,
          bi: +(v / 1000).toFixed(1), // R$ milhões → R$ bilhões
          destaque: inst.destaque,
        });
      }
    }

    // Ordena pela magnitude do fluxo (maior captação no topo).
    out.sort((a, b) => Math.abs(b.bi) - Math.abs(a.bi));

    const trimRef = String(ult?.trim ?? pib.trim_recente);
    return { linhas: out, trimRef, semDado: out.length === 0 };
  }, [cf, pib.trim_recente]);

  const rows: RankingTableRow[] = linhas.map((l) => ({
    label: l.rotulo,
    value: l.bi,
    hint:
      l.destaque === "equity"
        ? "sócio (equity)"
        : l.destaque === "titulos"
          ? "credor (dívida)"
          : undefined,
  }));

  // Escala comum das mini-barras: maior magnitude de fluxo entre os instrumentos.
  const maxAbs = Math.max(0.0001, ...linhas.map((l) => Math.abs(l.bi)));

  return (
    <ChartCard
      title="Quem financia o país, e com qual instrumento"
      subtitle="Entrada de recursos por instrumento financeiro (variação do passivo, soma móvel de 4 trimestres), em R$ bilhões. Barras ordenadas pela magnitude do fluxo. Positivo = captação líquida (entra financiamento); negativo = amortização líquida. F.5 é dinheiro de sócio (equity); F.3 é dinheiro de credor (títulos de dívida)."
      footer="Fonte: IBGE/SIDRA — Contas Nacionais Trimestrais, conta financeira por instrumento (2205), desde 2010. Passivo = haveres adquiridos por terceiros contra a economia, ou seja, recursos que financiam o país; fluxo anualizado pela soma dos últimos 4 trimestres. Sinal pela convenção do SCN/MBP6 (F.2 moeda e depósitos; F.3 títulos de dívida; F.4 empréstimos; F.5 participações de capital; F.6 seguros e previdência; F.7 derivativos; F.8 outras contas)."
      stampGiro={geradoEm}
      stampDado={trimRef}
    >
      {!cf || semDado ? (
        <p className="flex h-48 items-center justify-center text-center text-sm text-zinc-400">
          Sem dados de conta financeira (instrumentos de financiamento) nesta carga.
        </p>
      ) : (
        <RankingTable
          title="Entrada de recursos por instrumento (passivo, acum. 4T)"
          rows={rows}
          maxAbs={maxAbs}
          valueFmt={(v) => `${v >= 0 ? "+" : "−"}R$ ${fmtNum(Math.abs(v), 1)} bi`}
        />
      )}
    </ChartCard>
  );
}
