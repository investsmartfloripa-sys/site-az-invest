"use client";

import { useMemo, useState, type ReactNode } from "react";

import type { SinteseLinha, TabelaSinteseBlock } from "@/lib/painel-ipca";
import { AzSegmented, ChartCard } from "@/components/painel/core";
import { AZ_CHART } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtSignedNum } from "@/lib/format-br";
import { baixarCsv } from "../v2/shared";

/**
 * Tabela-síntese estilo Carta de Conjuntura (IPEA): cheio, IPCA-15, grupos,
 * categorias e difusão × uma janela longa de meses + acumulados e peso.
 * TODO valor vem pré-computado do builder (tabela_sintese) — zero conta aqui.
 * Semântica de inflação: alta em vermelho (pressão), queda em azul.
 *
 * Revisão ago/2026 (relatório do editor): a janela passou de 3 para 13 meses
 * (um ciclo sazonal completo + o mês corrente, então cada mês fica ao lado do
 * seu par do ano anterior) e ganhou alternador OBSERVADO × DESSAZONALIZADO.
 * JSON anterior à revisão não tem `meses_serie` — nesse caso a tabela cai de
 * volta nos três meses de sempre e o alternador não aparece.
 */

type Modo = "observado" | "dessaz";

const MODOS = [
  { id: "observado", label: "Observado" },
  { id: "dessaz", label: "Dessazonalizado" },
];

function celula(v: number | null | undefined, opts?: { pct?: boolean; destaque?: boolean }): ReactNode {
  if (v == null) return <span className="text-zinc-300">—</span>;
  const texto = opts?.pct ? `${fmtNum(v, 1)}%` : fmtSignedNum(v, 2);
  const cor = opts?.pct ? undefined : v > 0 ? AZ_CHART.negText : v < 0 ? AZ_CHART.neutral : undefined;
  return (
    <span className={opts?.destaque ? "font-bold" : undefined} style={{ color: cor }}>
      {texto}
    </span>
  );
}

/**
 * Valor da linha no mês, no modo pedido. `undefined` = a linha não tem dessaz.
 *
 * No modo observado a `serie` é a fonte, mas ela só existe no JSON a partir de
 * ago/2026 — sem o fallback para m2/m1/m0 a tabela inteira vira travessão
 * enquanto o pipeline não republica.
 */
function valorNoMes(
  linha: SinteseLinha,
  mes: string,
  modo: Modo,
  meses3: [string, string, string],
): number | null | undefined {
  if (modo === "dessaz") {
    if (linha.serie_sa == null) return undefined;
    return linha.serie_sa[mes] ?? null;
  }
  if (linha.serie) return linha.serie[mes] ?? null;
  const [m2, m1, m0] = meses3;
  if (mes === m0) return linha.m0;
  if (mes === m1) return linha.m1;
  if (mes === m2) return linha.m2;
  return null;
}

export function TabelaSinteseCard({ sintese, geradoEm }: { sintese: TabelaSinteseBlock; geradoEm: string }) {
  const [modo, setModo] = useState<Modo>("observado");

  const [m2, m1, m0] = sintese.meses;
  const meses3: [string, string, string] = [m2, m1, m0];
  // JSON novo traz a janela longa; o antigo (cache/publisher) só os 3 meses.
  const temJanelaLonga = (sintese.meses_serie?.length ?? 0) > 0;
  const meses = temJanelaLonga ? (sintese.meses_serie as string[]) : [m2, m1, m0];

  // Núcleos ficam FORA da síntese (têm card próprio na aba Núcleos & difusão).
  const secoes = useMemo(() => sintese.secoes.filter((sec) => sec.id !== "nucleos"), [sintese.secoes]);

  const temAlgumaDessaz = useMemo(
    () => temJanelaLonga && secoes.some((sec) => sec.linhas.some((l) => l.serie_sa != null)),
    [secoes, temJanelaLonga],
  );

  const exportarCsv = () => {
    const header = ["Seção", "Linha", ...meses.map(fmtMesCurto), "No ano", "12 meses", "Peso (%)"];
    const rows = secoes.flatMap((sec) =>
      sec.linhas.map((linha) => [
        sec.titulo,
        linha.nome,
        ...meses.map((m) => {
          const v = valorNoMes(linha, m, modo, meses3);
          return v === undefined ? "" : v;
        }),
        linha.acum_ano,
        linha.acum_12m,
        linha.peso,
      ]),
    );
    baixarCsv(`ipca-tabela-sintese-${modo}-${sintese.mes_recente}.csv`, header, rows);
  };

  return (
    <ChartCard
      title={`Tabela-síntese — ${meses.length} meses (${fmtMesCurto(m0)})`}
      subtitle={
        modo === "dessaz"
          ? "Valores dessazonalizados: o padrão típico de cada mês do ano foi removido, então os meses ficam comparáveis entre si."
          : "Todos os recortes do IPCA lado a lado, mês a mês. Use “Dessazonalizado” para comparar meses sem o efeito do calendário."
      }
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          {temAlgumaDessaz ? (
            <AzSegmented
              ariaLabel="Observado ou dessazonalizado"
              options={MODOS}
              value={modo}
              onChange={(id) => setModo(id as Modo)}
            />
          ) : null}
          <button
            type="button"
            onClick={exportarCsv}
            className="rounded-md border border-[#132960]/20 px-2.5 py-1 text-[11px] font-semibold text-[#132960] transition hover:bg-[#eef2f8]"
          >
            Baixar CSV
          </button>
        </div>
      }
      footer={
        <>
          <p className="mb-1.5">
            <strong>Observado</strong> é a variação que o IBGE publicou. <strong>Dessazonalizado</strong> remove o
            padrão que se repete todo ano no mesmo mês (reajuste escolar em fevereiro, entressafra, bandeira tarifária),
            via STL sobre o log do índice encadeado — o que sobra é o movimento que não era esperado pelo calendário.
            Sem isso, comparar o IPCA de janeiro com o de junho engana.
          </p>
          <p>
            Duas linhas não têm versão dessazonalizada, de propósito: a <strong>média dos 5 núcleos</strong> (a média
            das séries dessazonalizadas não é a dessazonalizada da média) e a <strong>difusão</strong> (é contagem de
            subitens em alta, não variação de preço). Acumulado no ano e em 12 meses são sempre observados e compostos.
          </p>
        </>
      }
      stampGiro={geradoEm}
      stampDado={m0}
    >
      <div className="overflow-x-auto rounded-lg border border-zinc-100">
        <table className="min-w-full text-xs">
          <thead className="sticky top-0 bg-zinc-50">
            <tr>
              <th className="sticky left-0 z-10 bg-zinc-50 px-3 py-2 text-left font-semibold text-zinc-700">Recorte</th>
              {meses.map((m, i) => (
                <th
                  key={m}
                  className={`whitespace-nowrap px-3 py-2 text-right font-semibold ${
                    i === meses.length - 1 ? "text-[#132960]" : "text-zinc-700"
                  }`}
                >
                  {fmtMesCurto(m)}
                </th>
              ))}
              <th className="whitespace-nowrap border-l border-zinc-200 px-3 py-2 text-right font-semibold text-zinc-700">
                No ano
              </th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-zinc-700">12 meses</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-zinc-700">Peso (%)</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {secoes.map((sec) => (
              <FragmentoSecao
                key={sec.id}
                titulo={sec.titulo}
                linhas={sec.linhas}
                meses={meses}
                meses3={meses3}
                modo={modo}
                pct={sec.id === "difusao"}
              />
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
  meses,
  meses3,
  modo,
  pct,
}: {
  titulo: string;
  linhas: SinteseLinha[];
  meses: string[];
  meses3: [string, string, string];
  modo: Modo;
  pct: boolean;
}) {
  const nCols = meses.length + 4;
  return (
    <>
      <tr className="border-t border-zinc-100 bg-[#f8fafc]">
        <td colSpan={nCols} className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          {titulo}
        </td>
      </tr>
      {linhas.map((linha) => {
        const semDessaz = modo === "dessaz" && linha.serie_sa == null;
        return (
          <tr key={linha.id} className="border-t border-zinc-50 hover:bg-zinc-50/60">
            <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-1.5 font-medium text-zinc-800">
              {linha.nome}
              {linha.mes_proprio ? (
                <span className="ml-1 text-[10px] font-normal text-zinc-400">({fmtMesCurto(linha.mes_proprio)})</span>
              ) : null}
              {semDessaz ? (
                <span className="ml-1 text-[10px] font-normal text-zinc-400" title="Sem versão dessazonalizada">
                  (só observado)
                </span>
              ) : null}
            </td>
            {meses.map((m, i) => (
              <td key={m} className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
                {celula(valorNoMes(linha, m, modo, meses3) ?? null, { pct, destaque: i === meses.length - 1 })}
              </td>
            ))}
            <td className="whitespace-nowrap border-l border-zinc-200 px-3 py-1.5 text-right tabular-nums">
              {pct ? <span className="text-zinc-300">—</span> : celula(linha.acum_ano)}
            </td>
            <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
              {pct ? <span className="text-zinc-300">—</span> : celula(linha.acum_12m)}
            </td>
            <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-zinc-600">
              {linha.peso != null ? fmtNum(linha.peso, 2) : <span className="text-zinc-300">—</span>}
            </td>
          </tr>
        );
      })}
    </>
  );
}
