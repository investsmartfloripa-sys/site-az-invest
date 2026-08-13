"use client";

import { useMemo, useState } from "react";

import { MethodInfo } from "@/components/painel/core/MethodInfo";
import type { IndicadorSemaforo, Nivel } from "@/lib/painel-fiscal";
import type { AzTimeSeries } from "@/components/painel/charts/AzTimeSeriesChart";
import { MiniRiskSpark, NIVEL_RISCO, toPoints } from "./shared";
import { RiskSeriesCard } from "./RiskSeriesCard";

/**
 * Camada de esmiuçamento: os 20 indicadores Dalio NO TEMPO, como small
 * multiples por categoria — sparkline com bandas de risco ao fundo, valor
 * atual e chip de nível. Clicar num card abre a série completa (com
 * AzPeriodSelector) logo abaixo da grade da categoria.
 *
 * Substitui os cards antigos com régua vertical: a régua virou o FUNDO do
 * gráfico, e a pergunta "desde quando estamos nessa zona?" passou a ter
 * resposta visual.
 */

const CATEGORIA_LABEL: Record<string, string> = {
  Carga: "A · Carga da dívida",
  Capacidade: "B · Capacidade de pagamento",
  Estrutura: "C · Estrutura da dívida",
  Stress: "D · Sinais de stress",
  Levers: "E · Alavancas — o tamanho do ajuste que falta",
};

function fmtValor(ind: IndicadorSemaforo): string {
  if (ind.valor == null) return "—";
  const casas = Math.abs(ind.valor) >= 100 ? 0 : Math.abs(ind.valor) >= 10 ? 1 : 2;
  return `${ind.valor.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas })}${ind.unidade}`;
}

export function DistribuicaoBar({ indicadores }: { indicadores: Record<string, IndicadorSemaforo> }) {
  const counts = useMemo(() => {
    const c: Record<Nivel, number> = { verde: 0, amarelo: 0, vermelho: 0, break: 0, sem_dado: 0 };
    Object.values(indicadores).forEach((i) => {
      c[i.nivel]++;
    });
    return c;
  }, [indicadores]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const niveis: Nivel[] = ["verde", "amarelo", "vermelho", "break", "sem_dado"];

  return (
    <div>
      <div className="flex h-7 w-full overflow-hidden rounded-lg border border-zinc-200">
        {niveis.map((n) => {
          const c = counts[n];
          if (c === 0) return null;
          return (
            <div
              key={n}
              className="flex items-center justify-center text-[11px] font-bold text-white"
              style={{ width: `${(c / total) * 100}%`, background: NIVEL_RISCO[n].hex }}
              title={`${NIVEL_RISCO[n].label}: ${c} de ${total}`}
            >
              {(c / total) * 100 > 8 ? c : ""}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-600">
        {niveis
          .filter((n) => counts[n] > 0)
          .map((n) => (
            <span key={n} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: NIVEL_RISCO[n].hex }} />
              {NIVEL_RISCO[n].label}: <strong>{counts[n]}</strong>
            </span>
          ))}
        <span className="text-zinc-400">É contagem, não nota — {total} indicadores nas faixas AZ.</span>
      </div>
    </div>
  );
}

export function SemaforoTempoGrid({
  indicadores,
  categorias,
  stampGiro,
  stampDado,
}: {
  indicadores: Record<string, IndicadorSemaforo>;
  categorias: string[];
  stampGiro?: string | null;
  stampDado?: string | null;
}) {
  const [aberto, setAberto] = useState<string | null>(null);

  const porCategoria = useMemo(() => {
    const grupos: Record<string, Array<[string, IndicadorSemaforo]>> = {};
    for (const [id, ind] of Object.entries(indicadores)) {
      (grupos[ind.categoria] ??= []).push([id, ind]);
    }
    return grupos;
  }, [indicadores]);

  return (
    <div className="space-y-6">
      {categorias.map((cat) => {
        const items = porCategoria[cat];
        if (!items?.length) return null;
        const abertoAqui = aberto && items.some(([id]) => id === aberto) ? aberto : null;
        const indAberto = abertoAqui ? indicadores[abertoAqui] : null;

        return (
          <div key={cat}>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[#132960]">
              {CATEGORIA_LABEL[cat] ?? cat}
            </h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {items.map(([id, ind]) => {
                const cor = NIVEL_RISCO[ind.nivel];
                const temSerie = (ind.serie?.length ?? 0) > 1;
                const selecionado = abertoAqui === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => temSerie && setAberto(selecionado ? null : id)}
                    className={`group flex min-w-0 flex-col rounded-xl border bg-white p-3 text-left shadow-sm transition ${
                      selecionado ? "border-[#027DFC] ring-1 ring-[#027DFC]/40" : "border-[#132960]/10 hover:border-[#027DFC]/60"
                    } ${temSerie ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <span className="text-[11px] font-semibold leading-tight text-[#132960]">{ind.titulo}</span>
                      <span
                        className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase ${cor.chip}`}
                      >
                        {cor.label}
                      </span>
                    </div>
                    <div className="mt-1 text-lg font-bold tabular-nums" style={{ color: cor.hex }}>
                      {fmtValor(ind)}
                    </div>
                    {temSerie ? (
                      <div className="mt-1.5">
                        <MiniRiskSpark serie={ind.serie!} faixas={ind} nivel={ind.nivel} height={44} />
                        <div className="mt-1 text-[9px] uppercase tracking-wide text-zinc-400 opacity-0 transition group-hover:opacity-100">
                          {selecionado ? "fechar" : "abrir série completa"}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-1.5 text-[10px] leading-snug text-zinc-500">{ind.narrativa}</p>
                    )}
                  </button>
                );
              })}
            </div>

            {indAberto && abertoAqui ? (
              <div className="mt-3">
                <RiskSeriesCard
                  title={indAberto.titulo}
                  subtitle={indAberto.narrativa}
                  series={[
                    {
                      id: abertoAqui,
                      label: indAberto.titulo,
                      color: "#132960",
                      data: toPoints(indAberto.serie ?? []),
                    },
                  ]}
                  faixas={indAberto}
                  unidadeFaixas={indAberto.unidade.trim()}
                  unit={indAberto.unidade.trim() === "%" ? "%" : "none"}
                  nivel={indAberto.nivel}
                  valorAtual={fmtValor(indAberto)}
                  height={280}
                  variant="default"
                  showLegend={false}
                  stampGiro={stampGiro}
                  stampDado={stampDado}
                  footer={
                    <span>
                      Faixas AZ: âncoras externas quando existem (FMI, Maastricht, agências) + casos históricos do
                      livro — a nota de calibração completa está na ficha técnica, no fim da página.
                    </span>
                  }
                />
              </div>
            ) : null}
          </div>
        );
      })}
      <p className="text-[10px] text-zinc-500">
        Faixas com âncoras externas quando existem (FMI, Maastricht, agências) e calibração AZ no restante — nota
        completa na ficha técnica.
        <MethodInfo className="ml-1 align-middle">
          Cada indicador é avaliado nas 4 zonas (seguro / atenção / crítico / ruptura). O fundo dos gráficos pinta as
          mesmas zonas, então a pergunta &quot;desde quando estamos aqui?&quot; tem resposta visual. Indicadores da
          categoria E (alavancas) são prescritivos — medem o tamanho do ajuste, não têm série histórica.
        </MethodInfo>
      </p>
    </div>
  );
}
