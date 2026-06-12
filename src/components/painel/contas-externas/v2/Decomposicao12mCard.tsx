"use client";

import { useMemo, useState } from "react";

import type { Bp12mPonto, BpDecomposicaoPonto } from "@/lib/painel-contas-externas";
import { ChartCard } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AZ_SERIES, variationText } from "@/lib/az-chart-theme";
import { addMonthsUTC, fmtMesCurto } from "@/lib/format-br";
import { Stacked12mChart, type StackSerie } from "./Stacked12mChart";
import { filtraPeriodoMes, fmtUsBi, fmtUsBiSigned, mesIso, num, ultimo } from "./shared";

/**
 * Bloco 01 — "o comércio paga a conta dos lucros?". Decomposição do saldo em
 * transações correntes ACUMULADO 12m (a janela que tira a sazonalidade de
 * soja e remessas do caminho) em bens, serviços e rendas + linha do total.
 *
 * O fluxo mensal bruto NÃO vira gráfico aqui (vício eliminado): sobrevive só
 * como "eco mensal" — o mês vs o mesmo mês do ano anterior, em texto.
 */

const STACKS: StackSerie[] = [
  { key: "bens", label: "Bens", color: AZ_SERIES[0] },
  { key: "servicos", label: "Serviços", color: AZ_SERIES[2] },
  { key: "renda_primaria", label: "Renda primária (lucros e juros)", color: AZ_SERIES[4] },
  { key: "renda_secundaria", label: "Renda secundária (remessas)", color: AZ_SERIES[3] },
];

export function Decomposicao12mCard({
  decomposicao12m,
  decomposicaoMensal36m,
  geradoEm,
}: {
  decomposicao12m: Bp12mPonto[];
  decomposicaoMensal36m: BpDecomposicaoPonto[];
  geradoEm: string;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "5y" });

  const rows = useMemo(() => filtraPeriodoMes(decomposicao12m, period), [decomposicao12m, period]);
  const minIso = decomposicao12m.length > 0 ? mesIso(decomposicao12m[0].mes) : "";
  const maxIso = decomposicao12m.length > 0 ? mesIso(decomposicao12m[decomposicao12m.length - 1].mes) : "";

  // Eco mensal: TC do mês vs MESMO mês do ano anterior (série em US$ milhões → bi).
  const eco = useMemo(() => {
    const s = decomposicaoMensal36m;
    if (s.length === 0) return null;
    const ult = s[s.length - 1];
    const atual = num(ult, "saldo_total");
    if (atual == null) return null;
    const alvo = addMonthsUTC(mesIso(ult.mes), -12).slice(0, 7);
    const ant = s.find((r) => r.mes === alvo);
    const anterior = ant ? num(ant, "saldo_total") : null;
    return {
      mes: ult.mes,
      atual: atual / 1000,
      anterior: anterior != null ? anterior / 1000 : null,
    };
  }, [decomposicaoMensal36m]);

  const titulo = useMemo(() => {
    const u = decomposicao12m.length > 0 ? decomposicao12m[decomposicao12m.length - 1] : null;
    const bens = num(u, "bens");
    const total = num(u, "total");
    if (u == null || bens == null || total == null) return "De onde vem o saldo em conta corrente (12m)";
    const resto = total - bens; // serviços + rendas (líquido)
    return `O comércio gera ${fmtUsBi(bens)} em 12 meses — ${total >= 0 ? "e paga" : "mas não paga"} a conta de ${fmtUsBi(Math.abs(resto))} de serviços e rendas`;
  }, [decomposicao12m]);

  const ultTotal = ultimo(decomposicao12m, "total");

  return (
    <ChartCard
      title={titulo}
      subtitle="Saldo em transações correntes acumulado em 12 meses, US$ bilhões — positivos acima do zero, negativos abaixo; a linha navy é o saldo total."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer="Acumulado 12m de bens (SGS 22707), serviços (22719), renda primária (22800) e renda secundária (22838); a soma fecha com a TC (22701) — identidade auditada no pipeline com tolerância absoluta. O fluxo mensal bruto não vira gráfico: soja no 1º semestre e remessas de lucros no fim do ano dominam a leitura."
      stampGiro={geradoEm}
      stampDado={ultTotal ? mesIso(ultTotal.row.mes) : null}
    >
      <Stacked12mChart rows={rows} stacks={STACKS} totalKey="total" totalLabel="Saldo TC (12m)" height={360} />

      {eco ? (
        <div className="mt-3 rounded-xl border border-[#132960]/10 bg-zinc-50/50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Eco mensal</p>
          <p className="mt-1 text-xs text-zinc-700">
            Transações correntes de {fmtMesCurto(mesIso(eco.mes))}:{" "}
            <strong className="tabular-nums" style={{ color: variationText(eco.atual, 0) }}>
              {fmtUsBi(eco.atual)}
            </strong>
            {eco.anterior != null ? (
              <>
                {" "}· mesmo mês do ano anterior: <span className="tabular-nums">{fmtUsBi(eco.anterior)}</span> →{" "}
                {eco.atual - eco.anterior >= 0 ? "melhora" : "piora"} de{" "}
                <span className="tabular-nums">{fmtUsBiSigned(eco.atual - eco.anterior)}</span>. A comparação correta do
                fluxo mensal é sempre contra o mesmo mês do ano anterior — mês contra mês vizinho mede sazonalidade, não
                tendência.
              </>
            ) : (
              <> — sem o mesmo mês do ano anterior na janela publicada.</>
            )}
          </p>
        </div>
      ) : null}
    </ChartCard>
  );
}
