"use client";

import { useMemo, useState } from "react";

import type { AtividadeCodaceData, AtividadePibData } from "@/lib/painel-atividade";
import { ChartCard, AzSegmented, RankingTable, KpiCard, type RankingTableRow } from "@/components/painel/core";
import { fmtSignedNum } from "@/lib/format-br";
import { fmtTrimCurto, num } from "../shared";

/**
 * Reconciliação financeira do PIB — a "outra metade" das Contas Nacionais. A
 * conta financeira (SIDRA 2205, desde 2010-T1) decompõe a capacidade/necessidade
 * líquida de financiamento da economia (B.9) por instrumento financeiro
 * F.1…F.8. Para cada instrumento, em fluxo acumulado em 4 trimestres (R$):
 *   - ATIVO  = aquisição líquida de ativos financeiros (saída de poupança, o
 *              país emprestando/aplicando no resto do mundo e entre setores);
 *   - PASSIVO = incorrência líquida de passivos (entrada de financiamento);
 *   - LÍQUIDO = ativo − passivo = a contribuição do instrumento ao B.9.
 *
 * A IDENTIDADE da conta: ΣF.1…F.8 (líquido) = B.9. B.9 ≈ negativo significa
 * NECESSIDADE de financiamento (a economia tomou mais passivo do que adquiriu
 * ativo); positivo = CAPACIDADE (poupador líquido). A nota de reconciliação
 * (KpiCard) fecha essa soma contra o B.9 publicado.
 *
 * `conta_financeira` não está declarado em AtividadePibData — acessado via cast.
 * Trata ausência (carga sem a conta financeira) com placeholder.
 */

type CfRow = Record<string, number | string | null | undefined> & { trim: string };

type ContaFinanceira = {
  serie?: CfRow[];
  serie_acum4t?: CfRow[];
};

// Instrumentos de nível-1 (F.1…F.8) cuja soma de líquidos = B.9.
// f3=f31+f32, f4=f41+f42, f8=f81+f89 são subníveis — fora da soma p/ não duplicar.
// Rótulos no padrão do Sistema de Contas Nacionais (a SIDRA só publica códigos).
const INSTRUMENTOS: { key: string; rotulo: string }[] = [
  { key: "f1", rotulo: "F.1 Ouro monetário e DES" },
  { key: "f2", rotulo: "F.2 Numerário e depósitos" },
  { key: "f3", rotulo: "F.3 Títulos de dívida" },
  { key: "f4", rotulo: "F.4 Empréstimos" },
  { key: "f5", rotulo: "F.5 Participações de capital e fundos" },
  { key: "f6", rotulo: "F.6 Seguros e previdência" },
  { key: "f7", rotulo: "F.7 Derivativos financeiros" },
  { key: "f8", rotulo: "F.8 Outras contas a receber/pagar" },
];

type Recorte = "liquido" | "ativo" | "passivo";

// R$ milhões → R$ bilhões p/ leitura (todos os valores da conta vêm em R$ milhões).
const milToBi = (v: number) => v / 1000;

type Linha = {
  key: string;
  rotulo: string;
  ativo: number;
  passivo: number;
  liquido: number;
};

export function ReconciliacaoFinanceiraPib({
  pib,
  // codace aceito por simetria com os demais cards da face; não usado (sem eixo de tempo aqui).
  geradoEm,
}: {
  pib: AtividadePibData;
  codace?: AtividadeCodaceData | null;
  geradoEm: string;
}) {
  const [recorte, setRecorte] = useState<Recorte>("liquido");

  const cf = (pib as unknown as { conta_financeira?: ContaFinanceira }).conta_financeira;
  const serie = cf?.serie_acum4t ?? [];

  const { linhas, somaLiquido, b9, trimRef, semDado } = useMemo(() => {
    const ult = serie.length ? serie[serie.length - 1] : null;
    if (!ult) {
      return { linhas: [] as Linha[], somaLiquido: null as number | null, b9: null as number | null, trimRef: "", semDado: true };
    }

    const out: Linha[] = [];
    let somaLiquido = 0;
    for (const inst of INSTRUMENTOS) {
      const ativo = num(ult, `${inst.key}_ativo`) ?? 0;
      const passivo = num(ult, `${inst.key}_passivo`) ?? 0;
      // líquido = ativo − passivo; campo *_liquido vem null em vários instrumentos.
      const liquido = num(ult, `${inst.key}_liquido`) ?? ativo - passivo;
      somaLiquido += liquido;
      out.push({ key: inst.key, rotulo: inst.rotulo, ativo, passivo, liquido });
    }

    // B.9 publicado: a SIDRA grava o saldo na coluna _passivo (ativo/liquido vêm null).
    const b9 = num(ult, "b9_liquido") ?? num(ult, "b9_passivo") ?? num(ult, "b9_ativo");

    const trimRef = String(ult.trim ?? pib.trim_recente);
    return { linhas: out, somaLiquido, b9, trimRef, semDado: false };
  }, [serie, pib.trim_recente]);

  // Valor plotado segundo o recorte (em R$ bi).
  const valorDe = (l: Linha) => milToBi(recorte === "ativo" ? l.ativo : recorte === "passivo" ? l.passivo : l.liquido);

  const rows: RankingTableRow[] = useMemo(() => {
    return [...linhas]
      .sort((a, b) => valorDe(b) - valorDe(a))
      .map((l) => ({ label: l.rotulo, value: valorDe(l) }));
    // valorDe depende de recorte; linhas é estável dentro do render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas, recorte]);

  // Escala comum entre os recortes p/ as barras divergentes ficarem comparáveis.
  const maxAbs = useMemo(
    () => Math.max(0.0001, ...rows.map((r) => Math.abs(r.value))),
    [rows],
  );

  const tituloRecorte =
    recorte === "ativo"
      ? "Aquisição líquida de ativos (saída)"
      : recorte === "passivo"
        ? "Incorrência líquida de passivos (entrada)"
        : "Líquido por instrumento (= B.9)";

  // Reconciliação: ΣF.1…F.8 (líquido) vs B.9 publicado. Resíduo = arredondamento SIDRA.
  const somaBi = somaLiquido != null ? milToBi(somaLiquido) : null;
  const b9Bi = b9 != null ? milToBi(b9) : null;
  const residuo = somaBi != null && b9Bi != null ? somaBi - b9Bi : null;
  const necessidade = b9Bi != null && b9Bi < 0;

  return (
    <ChartCard
      title="A conta financeira fecha o PIB: B.9 por instrumento"
      subtitle={`Fluxo acumulado em 4 trimestres até ${fmtTrimCurto(trimRef || pib.trim_recente)} (R$ bilhões). Para cada instrumento F.1…F.8: ativo (saída), passivo (entrada) e líquido (ativo − passivo). A soma dos líquidos é a capacidade/necessidade líquida de financiamento da economia (B.9).`}
      toolbar={
        <AzSegmented
          ariaLabel="Recorte da conta financeira"
          options={[
            { id: "liquido", label: "Líquido" },
            { id: "ativo", label: "Ativo" },
            { id: "passivo", label: "Passivo" },
          ]}
          value={recorte}
          onChange={(id) => setRecorte(id === "ativo" ? "ativo" : id === "passivo" ? "passivo" : "liquido")}
        />
      }
      footer="Fonte: IBGE/SIDRA — Contas Nacionais Trimestrais, conta financeira por instrumento (2205). Acumulado móvel de 4 trimestres, R$ milhões convertidos em bilhões. Ativo = aquisição líquida de ativos financeiros; passivo = incorrência líquida de passivos; líquido = ativo − passivo. ΣF.1…F.8 (líquido) = B.9 (capacidade/necessidade líquida de financiamento): negativo = necessidade de financiamento, positivo = capacidade. F.3, F.4 e F.8 incluem subníveis (F.31/F.32, F.41/F.42, F.81/F.89) não somados aqui para evitar dupla contagem."
      stampGiro={geradoEm}
      stampDado={trimRef || pib.trim_recente}
    >
      {semDado ? (
        <p className="flex h-48 items-center justify-center text-center text-sm text-zinc-400">
          Conta financeira (SIDRA 2205) indisponível nesta carga.
        </p>
      ) : (
        <>
          <RankingTable
            title={tituloRecorte}
            rows={rows}
            maxAbs={maxAbs}
            valueFmt={(v) => fmtSignedNum(v, 1)}
          />

          {/* Reconciliação contábil: a soma fecha o B.9. */}
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <KpiCard
              label="Σ líquidos F.1…F.8"
              value={somaBi != null ? fmtSignedNum(somaBi, 1) : "—"}
              unit="R$ bi"
              hint="soma das barras (líquido)"
            />
            <KpiCard
              label={necessidade ? "B.9 — necessidade de financiamento" : "B.9 — capacidade de financiamento"}
              value={b9Bi != null ? fmtSignedNum(b9Bi, 1) : "—"}
              unit="R$ bi"
              hint="publicado (SIDRA 2205)"
            />
            <KpiCard
              label="Resíduo da reconciliação"
              value={residuo != null ? fmtSignedNum(residuo, 1) : "—"}
              unit="R$ bi"
              hint="Σ − B.9 (arredondamento)"
            />
          </div>

          <p className="mt-2 px-1 text-[11px] text-zinc-400">
            {recorte === "liquido"
              ? "A barra de cada instrumento é sua contribuição líquida ao B.9. À direita (verde) o instrumento adicionou poupança líquida ao sistema; à esquerda (vermelho) drenou — a soma fecha o B.9 acima."
              : recorte === "ativo"
                ? "Mostra apenas a aquisição líquida de ativos financeiros (saída de recursos) por instrumento. Para a contribuição ao B.9, use o recorte Líquido."
                : "Mostra apenas a incorrência líquida de passivos (entrada de financiamento) por instrumento. Para a contribuição ao B.9, use o recorte Líquido."}
          </p>
        </>
      )}
    </ChartCard>
  );
}
