"use client";

import { useMemo, useState } from "react";

import type { AberturaHierarquica, TabelaSinteseBlock } from "@/lib/painel-ipca";
import { AzSegmented, ChartCard } from "@/components/painel/core";
import { AZ_CHART } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtPct, fmtSignedNum, fmtSignedPct } from "@/lib/format-br";
import { META } from "../v2/shared";

/**
 * Os 9 grupos do IPCA em UM card (revisão ago/2026 do editor: antes eram dois
 * cards lado a lado, "quanto subiu" e "quanto pesou").
 *
 * Revisão 12/11/2026: deixou de ser um gráfico de colunas com dois eixos Y (proibido pelo
 * padrão dos gráficos), com legenda de quadrados pretos que não batiam com as barras e nomes
 * girados 45 graus que saíam cortados no celular. Agora é uma tabela com barras: uma linha por
 * grupo, o nome na horizontal e duas colunas, cada uma com a própria escala — variação de
 * preço (%) e contribuição ao índice (pontos percentuais). No celular o nome vai em cima.
 *
 * Semântica de inflação: alta = vermelho (pressão), queda = azul.
 */

type Horizonte = "mes" | "acum_12m";

const HORIZONTES = [
  { id: "mes", label: "No mês" },
  { id: "acum_12m", label: "Em 12 meses" },
];

export function GruposMesCard({
  hierarquia,
  sintese,
  mesRef,
  geradoEm,
}: {
  hierarquia: AberturaHierarquica;
  /** Traz a variação % por grupo (mês e 12m). Sem ela, o card mostra só contribuição. */
  sintese?: TabelaSinteseBlock;
  mesRef: string;
  geradoEm: string;
}) {
  const [horizonte, setHorizonte] = useState<Horizonte>("mes");

  const rows = useMemo(() => {
    // Variação % por grupo vem da síntese; contribuição do mês, da hierarquia.
    const linhasSintese = sintese?.secoes.find((s) => s.id === "grupos")?.linhas ?? [];
    const varPorNome = new Map(
      linhasSintese.map((l) => [l.nome, horizonte === "mes" ? l.m0 : l.acum_12m] as const),
    );
    const contribPorNome = new Map(hierarquia.grupos.map((g) => [g.nome, g.contrib_pp] as const));
    const contrib12PorNome = new Map(
      linhasSintese.map((l) => [l.nome, l.contrib_pp ?? null] as const),
    );

    const nomes = linhasSintese.length > 0 ? linhasSintese.map((l) => l.nome) : hierarquia.grupos.map((g) => g.nome);

    return nomes
      .map((nome) => ({
        nome,
        variacao: varPorNome.get(nome) ?? null,
        // Contribuição de 12 meses só existe no mês corrente na hierarquia;
        // no horizonte de 12m usamos a da síntese quando o builder mandou.
        contrib: horizonte === "mes" ? (contribPorNome.get(nome) ?? null) : (contrib12PorNome.get(nome) ?? null),
      }))
      .filter((r) => r.variacao != null || r.contrib != null)
      .sort((a, b) => (b.variacao ?? b.contrib ?? 0) - (a.variacao ?? a.contrib ?? 0));
  }, [hierarquia, sintese, horizonte]);

  const temVar = rows.some((r) => r.variacao != null);
  const temContrib = rows.some((r) => r.contrib != null);
  if (rows.length === 0) return null;

  const unidadeVar = horizonte === "mes" ? "no mês" : "em 12 meses";
  const meta = horizonte === "acum_12m" ? META : null;
  const escalaVar = escala(rows.map((r) => r.variacao), meta);
  const escalaContrib = escala(rows.map((r) => r.contrib), null);
  const duasColunas = temVar && temContrib;
  const gradeSm = duasColunas ? "sm:grid-cols-[minmax(8rem,13rem)_1fr_1fr]" : "sm:grid-cols-[minmax(8rem,13rem)_1fr]";
  const gradeCel = duasColunas ? "grid-cols-2" : "grid-cols-1";

  return (
    <ChartCard
      title={`Os 9 grupos do IPCA (${horizonte === "mes" ? fmtMesCurto(mesRef) : "12 meses"})`}
      subtitle="Duas leituras do mesmo grupo: quanto o preço dele subiu e quanto isso empurrou o IPCA, já descontado o peso do grupo na cesta. Cada coluna tem a própria escala."
      toolbar={
        <AzSegmented
          ariaLabel="Horizonte dos grupos"
          options={HORIZONTES}
          value={horizonte}
          onChange={(id) => setHorizonte(id as Horizonte)}
        />
      }
      footer={
        <>
          <p className="mb-1.5">
            <strong>Por que duas colunas.</strong> Variação e contribuição têm unidades diferentes e ordens de grandeza
            muito distantes: um grupo pode subir perto de 1% {unidadeVar} e contribuir com só 0,15 ponto percentual para
            o índice. Na mesma escala, a contribuição viraria um traço; por isso cada coluna tem a sua.
          </p>
          <p>
            <strong>Como usar.</strong> Grupo com variação alta e contribuição baixa subiu muito mas pesa pouco no
            orçamento — barulho, não pressão. O contrário é o que de fato move o IPCA. A soma da coluna de
            contribuição do mês fecha com o índice cheio. Em 12 meses, a linha tracejada marca a meta de{" "}
            {fmtPct(META, 1)}.
          </p>
        </>
      }
      stampGiro={geradoEm}
      stampDado={mesRef}
    >
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: AZ_CHART.neg }} aria-hidden />
          alta de preço
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: AZ_CHART.neutral }} aria-hidden />
          queda
        </span>
        {meta != null ? (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-5 border-t-2 border-dashed border-[#132960]" aria-hidden />
            meta de {fmtPct(META, 1)}
          </span>
        ) : null}
      </div>

      <div role="table" aria-label="Variação e contribuição dos 9 grupos do IPCA" className="text-sm">
        <div role="row" className={`grid ${gradeCel} ${gradeSm} gap-x-4 border-b border-zinc-200 pb-1.5`}>
          <span
            role="columnheader"
            className="hidden text-[11px] font-semibold uppercase tracking-wider text-zinc-500 sm:block"
          >
            Grupo
          </span>
          {temVar ? (
            <span role="columnheader" className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Variação {unidadeVar} (%)
            </span>
          ) : null}
          {temContrib ? (
            <span role="columnheader" className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Contribuição (p.p.)
            </span>
          ) : null}
        </div>
        {rows.map((r) => (
          <div
            key={r.nome}
            role="row"
            className={`grid ${gradeCel} ${gradeSm} items-center gap-x-4 gap-y-1 border-b border-zinc-100 py-2 last:border-0`}
          >
            <span role="rowheader" className="col-span-full font-medium text-[#334155] sm:col-span-1">
              {r.nome}
            </span>
            {temVar ? (
              <BarraCelula valor={r.variacao} escala={escalaVar} meta={meta} fmt={(v) => fmtSignedPct(v, 2)} />
            ) : null}
            {temContrib ? (
              <BarraCelula valor={r.contrib} escala={escalaContrib} meta={null} fmt={(v) => fmtSignedNum(v, 2)} clara />
            ) : null}
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

type Escala = { lo: number; hi: number };

/** Escala de uma coluna: sempre inclui o zero (e a meta, quando houver). */
function escala(valores: ReadonlyArray<number | null>, meta: number | null): Escala {
  const nums = valores.filter((v): v is number => v != null && Number.isFinite(v));
  if (meta != null) nums.push(meta);
  const lo = Math.min(0, ...nums);
  const hi = Math.max(0, ...nums);
  return hi - lo > 0 ? { lo, hi } : { lo: 0, hi: 1 };
}

/** Barra horizontal a partir do zero, com o valor com sinal à direita. */
function BarraCelula({
  valor,
  escala: { lo, hi },
  meta,
  fmt,
  clara = false,
}: {
  valor: number | null;
  escala: Escala;
  meta: number | null;
  fmt: (v: number) => string;
  /** Contribuição: mesma cor da variação, mais clara (é a leitura derivada). */
  clara?: boolean;
}) {
  const pos = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const zero = pos(0);
  if (valor == null || !Number.isFinite(valor)) {
    return (
      <div role="cell" className="text-right text-xs text-zinc-500">
        sem dado
      </div>
    );
  }
  const x = pos(valor);
  const cor = valor > 0 ? AZ_CHART.neg : AZ_CHART.neutral;
  return (
    <div role="cell" className="flex min-w-0 items-center gap-2">
      <div className="relative h-4 min-w-0 flex-1">
        <div className="absolute inset-y-0 w-px bg-[#132960]/50" style={{ left: `${zero}%` }} aria-hidden />
        <div
          className="absolute inset-y-0.5 rounded-sm"
          style={{
            left: `${Math.min(zero, x)}%`,
            width: `${Math.max(Math.abs(x - zero), 0.5)}%`,
            background: cor,
            opacity: clara ? 0.5 : 1,
          }}
          aria-hidden
        />
        {meta != null ? (
          <div
            className="absolute -inset-y-0.5 border-l-2 border-dashed border-[#132960]"
            style={{ left: `${pos(meta)}%` }}
            aria-hidden
          />
        ) : null}
      </div>
      <span className="w-14 shrink-0 text-right text-xs font-semibold tabular-nums text-[#334155]">{fmt(valor)}</span>
    </div>
  );
}
