"use client";

import { useMemo, useState } from "react";

import type { AtividadeCodaceData, AtividadePibData } from "@/lib/painel-atividade";
import { ChartCard, IndicadorBox } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart, type AzSeriesPoint } from "@/components/painel/charts/AzTimeSeriesChart";
import { fmtSignedNum } from "@/lib/format-br";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import { fmtTrimCurto, num, trimIsoCentral } from "../shared";

/**
 * Vazamento de renda ao exterior — quanto o que o BRASIL ganha (Renda Nacional
 * Bruta) fica ABAIXO do que ele PRODUZ (PIB). A diferença sai pelas contas com o
 * resto do mundo (na SCN, ela é PIB + salários líquidos + rendas de propriedade
 * líquidas = RNB). No Brasil o PIB é maior que a RNB: parte da renda gerada aqui
 * remunera capital estrangeiro (juros, lucros e dividendos remetidos) e vaza.
 *
 * Hero (variant): a razão RNB / PIB (%) no tempo — vinda direto de
 * `contas_economicas_pct_pib` (a chave da RNB já em % do PIB) ou, em fallback,
 * calculada de `contas_economicas` (RNB ÷ PIB × 100). RefLine em 100 = "sem
 * vazamento" (RNB = PIB): tudo abaixo da linha é renda que escapa. O
 * IndicadorBox abre o gap atual (RNB/PIB − 100, em p.p.) e isola o componente
 * principal — as rendas de propriedade líquidas recebidas do exterior.
 *
 * `contas_economicas_pct_pib` é opcional; se faltar, derivamos da série em R$.
 * Trata ausência total sem quebrar (mensagem de carga indisponível).
 */

// Chaves EXATAS de contas_economicas (com acentos reais — confirmadas no JSON).
const K_PIB = "Produto Interno Bruto";
const K_RNB = "(=) Renda nacional bruta";
const K_RENDAS_PROP = "(+) Rendas de propriedade (líquidas recebidas do exterior)";
const K_SALARIOS = "(+) Salários (líquidos recebidos do exterior)";

export function VazamentoRendaPib({
  pib,
  // codace aceito por simetria com os demais cards da face; não usado (a leitura
  // é estrutural, não cíclica — uma faixa de recessão não acrescenta aqui).
  geradoEm,
}: {
  pib: AtividadePibData;
  codace?: AtividadeCodaceData | null;
  geradoEm: string;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });

  const { pts, minIso, maxIso, gapAtual, rendasPropAtual, salariosAtual, trimAtual, semDado } =
    useMemo(() => {
      const seriePct = pib.contas_economicas_pct_pib?.serie ?? [];
      const serieRs = pib.contas_economicas?.serie ?? [];
      const temPct = seriePct.length > 0;
      const base = temPct ? seriePct : serieRs;

      const pts: AzSeriesPoint[] = [];
      for (const r of base) {
        const d = trimIsoCentral(String(r.trim));
        let razao: number | null = null;
        if (temPct) {
          // Já em % do PIB: a chave da RNB é exatamente a razão buscada.
          razao = num(r, K_RNB);
        } else {
          const rnb = num(r, K_RNB);
          const pibV = num(r, K_PIB);
          razao = rnb != null && pibV != null && pibV > 0 ? +((rnb / pibV) * 100).toFixed(2) : null;
        }
        if (razao != null) pts.push([d, razao]);
      }

      if (pts.length === 0) {
        return {
          pts,
          minIso: "",
          maxIso: "",
          gapAtual: null as number | null,
          rendasPropAtual: null as number | null,
          salariosAtual: null as number | null,
          trimAtual: pib.trim_recente,
          semDado: true,
        };
      }

      // Último ponto da própria série usada no gráfico = a razão RNB/PIB atual.
      const razaoAtual = pts[pts.length - 1][1];
      const gapAtual = +(razaoAtual - 100).toFixed(2);

      // Componentes do gap, sempre em % do PIB. Se a série em % existe, lê direto;
      // senão, converte os valores em R$ pelo PIB do mesmo trimestre.
      const ultPct = temPct ? seriePct[seriePct.length - 1] : null;
      const ultRs = serieRs.length ? serieRs[serieRs.length - 1] : null;
      const pibRs = ultRs ? num(ultRs, K_PIB) : null;
      const emPctPib = (chave: string): number | null => {
        if (ultPct) return num(ultPct, chave);
        const v = ultRs ? num(ultRs, chave) : null;
        return v != null && pibRs != null && pibRs > 0 ? +((v / pibRs) * 100).toFixed(2) : null;
      };

      const trimAtual = String(
        (ultPct?.trim as string | undefined) ?? (ultRs?.trim as string | undefined) ?? pib.trim_recente,
      );

      return {
        pts,
        minIso: pts[0][0],
        maxIso: pts[pts.length - 1][0],
        gapAtual,
        rendasPropAtual: emPctPib(K_RENDAS_PROP),
        salariosAtual: emPctPib(K_SALARIOS),
        trimAtual,
        semDado: false,
      };
    }, [pib.contas_economicas_pct_pib, pib.contas_economicas, pib.trim_recente]);

  return (
    <ChartCard
      title="Parte da renda gerada no Brasil vaza para o exterior"
      subtitle="A Renda Nacional Bruta (o que os residentes ganham) fica abaixo do PIB (o que se produz aqui): a diferença remunera capital estrangeiro — juros, lucros e dividendos enviados ao resto do mundo. A linha mostra RNB como % do PIB; tudo abaixo de 100 é renda que escapa."
      toolbar={
        !semDado ? (
          <AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />
        ) : undefined
      }
      footer="Fonte: IBGE/SIDRA — Contas Econômicas Integradas / Contas Nacionais Trimestrais (2072, sequência da renda). Renda Nacional Bruta (RNB) = PIB + salários líquidos recebidos do exterior + rendas de propriedade líquidas recebidas do exterior. RNB/PIB < 100% indica renda gerada internamente que remunera fatores externos (saída líquida de renda primária). Em % do PIB nominal de cada trimestre."
      stampGiro={geradoEm}
      stampDado={trimAtual}
    >
      {semDado ? (
        <p className="flex h-48 items-center justify-center text-center text-sm text-zinc-400">
          Sem dados de contas econômicas (sequência da renda) nesta carga.
        </p>
      ) : (
        <div className="space-y-4">
          <AzTimeSeriesChart
            series={[
              { id: "rnb_pib", label: "Renda Nacional Bruta / PIB", color: AZ_BRAND.navy, data: pts },
            ]}
            unit="%"
            period={period}
            height={320}
            variant="hero"
            refLines={[{ y: 100, label: "RNB = PIB (sem vazamento)" }]}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <IndicadorBox
              titulo={`Vazamento de renda — ${fmtTrimCurto(trimAtual)}`}
              valor={gapAtual != null ? `${fmtSignedNum(gapAtual, 1)} p.p.` : null}
              fonte="IBGE/SIDRA 2072"
              formula="RNB / PIB − 100"
              origem="calculado"
              trend={gapAtual != null && gapAtual < -0.05 ? "ruim" : gapAtual != null && gapAtual > 0.05 ? "boa" : "neutra"}
              narrativa="Quanto a renda dos residentes (RNB) ficou abaixo (negativo) ou acima (positivo) do que a economia produziu (PIB). No Brasil é tipicamente negativo: parte da renda gerada aqui remunera capital estrangeiro e sai do país."
              siglas={[
                { sigla: "RNB", expansao: "Renda Nacional Bruta — renda apropriada pelos residentes" },
                { sigla: "p.p.", expansao: "pontos percentuais do PIB" },
              ]}
            />
            <IndicadorBox
              titulo="Componente principal: rendas de propriedade ao exterior"
              valor={rendasPropAtual != null ? `${fmtSignedNum(rendasPropAtual, 1)} p.p.` : null}
              fonte="IBGE/SIDRA 2072"
              origem="oficial"
              trend={rendasPropAtual != null && rendasPropAtual < -0.05 ? "ruim" : rendasPropAtual != null && rendasPropAtual > 0.05 ? "boa" : "neutra"}
              narrativa={
                salariosAtual != null
                  ? `Rendas de propriedade líquidas (juros, lucros e dividendos) recebidas do exterior, em % do PIB — o grande motor do vazamento. Salários líquidos do exterior somam ${fmtSignedNum(salariosAtual, 1)} p.p. e quase não pesam.`
                  : "Rendas de propriedade líquidas (juros, lucros e dividendos) recebidas do exterior, em % do PIB — o grande motor do vazamento. Negativo: a renda enviada supera a recebida."
              }
              siglas={[
                {
                  sigla: "Rendas de propriedade",
                  expansao: "juros, lucros e dividendos pagos/recebidos entre residentes e o resto do mundo",
                },
              ]}
            />
          </div>
        </div>
      )}
    </ChartCard>
  );
}
