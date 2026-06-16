"use client";

import { useMemo } from "react";

import type { AtividadeCodaceData, AtividadePibData } from "@/lib/painel-atividade";
import { ChartCard } from "@/components/painel/core";
import { fmtNum } from "@/lib/format-br";
import { baixarCsv, fmtTrimCurto, num } from "../shared";

/**
 * Tabela mestra da conta financeira — a planilha de referência do trimestre mais
 * recente pela ótica das CONTAS FINANCEIRAS das Contas Econômicas Integradas
 * (SIDRA 2205). Uma linha por instrumento financeiro (B.9 capacidade/necessidade
 * de financiamento, IDP investimento direto no país e a sequência canônica
 * F.1 → F.8 com seus subitens) e três colunas: AQUISIÇÃO de ativos, EMISSÃO de
 * passivos e o LÍQUIDO (ativo − passivo). Tudo no acumulado em 4 trimestres
 * (fluxo anualizado) do último ponto da série — sem cálculo derivado, é o
 * "raio-X" tabular da conta financeira que acompanha os gráficos. Exporta o
 * recorte em CSV (padrão Excel pt-BR).
 *
 * B.9 (em realce) é quase sempre negativo no Brasil = necessidade de
 * financiamento externo; a linha TOTAL (também em realce) fecha a conta:
 * total de ativos − total de passivos ≡ B.9. Subitens (F.31/F.32, F.41/F.42,
 * F.81/F.89) ficam indentados sob o instrumento-pai. Valores em R$ bilhões
 * (a série traz R$ milhões → dividimos por 1000). `conta_financeira` é opcional
 * no payload — quando ausente, o card mostra "sem dados".
 */

// Sequência das contas financeiras (CEI trimestrais, SIDRA 2205), na ordem
// canônica. `<k>_ativo / <k>_passivo / <k>_liquido` são as colunas no JSON.
// `destaque` = subtotal/resultado da cascata (realce). `sub` = subitem indentado.
// `rotulo` é fixo (labels_financeiro do JSON traz códigos SIDRA, não texto).
const INSTRUMENTOS: { key: string; rotulo: string; destaque?: boolean; sub?: boolean }[] = [
  { key: "b9", rotulo: "B.9 — Capacidade (+) / necessidade (−) líquida de financiamento", destaque: true },
  { key: "idp", rotulo: "IDP — Investimento direto no país" },
  { key: "f1", rotulo: "F.1 — Ouro monetário e DES" },
  { key: "f2", rotulo: "F.2 — Moeda e depósitos" },
  { key: "f3", rotulo: "F.3 — Títulos de dívida" },
  { key: "f31", rotulo: "F.31 — Títulos de curto prazo", sub: true },
  { key: "f32", rotulo: "F.32 — Títulos de longo prazo", sub: true },
  { key: "f4", rotulo: "F.4 — Empréstimos" },
  { key: "f41", rotulo: "F.41 — Empréstimos de curto prazo", sub: true },
  { key: "f42", rotulo: "F.42 — Empréstimos de longo prazo", sub: true },
  { key: "f5", rotulo: "F.5 — Participações de capital e fundos de investimento" },
  { key: "f6", rotulo: "F.6 — Seguros, previdência e garantias padronizadas" },
  { key: "f7", rotulo: "F.7 — Derivativos financeiros e opções de compra de ações" },
  { key: "f8", rotulo: "F.8 — Outras contas a receber / a pagar" },
  { key: "f81", rotulo: "F.81 — Créditos comerciais e adiantamentos", sub: true },
  { key: "f89", rotulo: "F.89 — Outras contas a receber / a pagar (n.e.)", sub: true },
];

type LinhaFin = {
  key: string;
  rotulo: string;
  destaque: boolean;
  sub: boolean;
  ativo: number | null;
  passivo: number | null;
  liquido: number | null;
};

type RowFin = Record<string, unknown> & { trim?: string };

/** Lê a chave (em R$ milhões) e devolve em R$ bilhões; null preserva o "—". */
function bi(row: RowFin | null, key: string): number | null {
  const v = num(row, key);
  return v == null ? null : v / 1000;
}

/** Célula de valor em R$ bi: sinal explícito, 1 casa; em branco quando ausente. */
function CelulaValor({ valor }: { valor: number | null }) {
  if (valor == null) return <td className="py-1.5 pr-3 text-right text-zinc-400">—</td>;
  return <td className="py-1.5 pr-3 text-right">{fmtNum(valor, 1)}</td>;
}

export function TabelaMestraFinanceiraPib({
  pib,
  geradoEm,
}: {
  pib: AtividadePibData;
  codace?: AtividadeCodaceData | null;
  geradoEm: string;
}) {
  // conta_financeira não está declarada no tipo — acesso via cast seguro.
  const cf = (pib as unknown as {
    conta_financeira?: { serie?: RowFin[]; serie_acum4t?: RowFin[] };
  }).conta_financeira;

  // Usamos a série acumulada em 4 trimestres (fluxo anualizado) p/ leitura limpa.
  const serie = cf?.serie_acum4t ?? [];
  const ult = serie.length > 0 ? serie[serie.length - 1] : null;

  const trimRef = String((ult?.trim as string | undefined) ?? pib.trim_recente);

  const linhas = useMemo<LinhaFin[]>(
    () =>
      INSTRUMENTOS.map((i) => ({
        key: i.key,
        rotulo: i.rotulo,
        destaque: !!i.destaque,
        sub: !!i.sub,
        ativo: bi(ult, `${i.key}_ativo`),
        passivo: bi(ult, `${i.key}_passivo`),
        liquido: bi(ult, `${i.key}_liquido`),
      })),
    [ult],
  );

  // Linha de TOTAL: total de ativos (aquisição) e de passivos (emissão); o
  // líquido (ativos − passivos) reproduz a B.9. As chaves no JSON são duplas
  // (total_ativo_ativo / total_passivo_passivo).
  const totalAtivo = bi(ult, "total_ativo_ativo");
  const totalPassivo = bi(ult, "total_passivo_passivo");
  const totalLiquido =
    totalAtivo == null || totalPassivo == null ? null : totalAtivo - totalPassivo;

  const baixar = () => {
    baixarCsv(
      `pib-tabela-mestra-financeira-${trimRef}.csv`,
      ["instrumento", "ativo_rs_bilhoes_acum4t", "passivo_rs_bilhoes_acum4t", "liquido_rs_bilhoes_acum4t"],
      [
        ...linhas.map((l) => [l.rotulo, l.ativo, l.passivo, l.liquido]),
        ["TOTAL — Variação líquida de ativos / passivos financeiros", totalAtivo, totalPassivo, totalLiquido],
      ],
    );
  };

  if (!cf || serie.length === 0) {
    return (
      <ChartCard
        title="Tabela mestra da conta financeira"
        subtitle="Aquisição de ativos, emissão de passivos e líquido por instrumento financeiro (acum. 4T)."
        footer="Fonte: IBGE/SIDRA — Contas Econômicas Integradas, conta financeira por instrumento (2205)."
        stampGiro={geradoEm}
      >
        <p className="py-6 text-center text-sm text-zinc-400">
          Conta financeira indisponível nesta carga — sem dados.
        </p>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title={`Tabela mestra da conta financeira — ${fmtTrimCurto(trimRef)}`}
      subtitle="Cada instrumento financeiro (B.9, IDP e a sequência F.1 a F.8) por aquisição de ativos, emissão de passivos e líquido, no acumulado de 4 trimestres. B.9 e o total em realce; subitens indentados sob o instrumento-pai. Valores em R$ bilhões — B.9 negativo = necessidade de financiamento."
      toolbar={
        <button
          type="button"
          onClick={baixar}
          className="rounded-lg border border-[#132960]/20 bg-white px-2.5 py-1 text-xs font-semibold text-[#132960] transition-colors hover:bg-zinc-50"
        >
          Baixar CSV
        </button>
      }
      footer="Fonte: IBGE/SIDRA — Contas Econômicas Integradas das Contas Nacionais Trimestrais, conta financeira por instrumento (2205). Fluxos acumulados em 4 trimestres, em R$ bilhões correntes. Ativo = variação líquida na aquisição de ativos financeiros; Passivo = variação líquida na emissão de passivos; Líquido = ativo − passivo. B.9 (capacidade/necessidade líquida de financiamento) é negativo quando a economia precisa de financiamento externo; a linha TOTAL fecha a conta (total de ativos − total de passivos ≡ B.9). IDP = investimento direto no país. Sequência F na ordem canônica do SCN 2008."
      stampGiro={geradoEm}
      stampDado={trimRef}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-xs tabular-nums">
          <thead>
            <tr className="border-b border-[#132960]/15 text-left text-[11px] uppercase tracking-wide text-zinc-500">
              <th className="py-2 pr-3 font-semibold">Instrumento</th>
              <th className="py-2 pr-3 text-right font-semibold">Ativo (R$ bi)</th>
              <th className="py-2 pr-3 text-right font-semibold">Passivo (R$ bi)</th>
              <th className="py-2 text-right font-semibold">Líquido (R$ bi)</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr
                key={l.key}
                className={`border-b border-zinc-100 ${
                  l.destaque ? "bg-[#132960]/[0.035] font-medium text-[#132960]" : "text-zinc-700"
                }`}
              >
                <td
                  className={`py-1.5 pr-3 ${
                    l.destaque
                      ? "font-semibold text-[#132960]"
                      : l.sub
                        ? "pl-5 font-normal text-zinc-500"
                        : "font-medium text-[#132960]"
                  }`}
                >
                  {l.rotulo}
                </td>
                <CelulaValor valor={l.ativo} />
                <CelulaValor valor={l.passivo} />
                <td
                  className={`py-1.5 text-right ${
                    l.liquido == null ? "text-zinc-400" : "font-semibold"
                  }`}
                >
                  {l.liquido == null ? "—" : fmtNum(l.liquido, 1)}
                </td>
              </tr>
            ))}

            {/* Linha de fechamento: total da conta financeira (realce). */}
            <tr className="border-t-2 border-[#132960]/30 bg-[#132960]/[0.06] font-semibold text-[#132960]">
              <td className="py-2 pr-3">Total — variação líquida de ativos / passivos</td>
              <td className="py-2 pr-3 text-right">
                {totalAtivo == null ? "—" : fmtNum(totalAtivo, 1)}
              </td>
              <td className="py-2 pr-3 text-right">
                {totalPassivo == null ? "—" : fmtNum(totalPassivo, 1)}
              </td>
              <td className="py-2 text-right">
                {totalLiquido == null ? "—" : fmtNum(totalLiquido, 1)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}
