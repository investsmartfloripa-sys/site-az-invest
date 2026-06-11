"use client";

import { useMemo, useState } from "react";

import type { AntecipacaoBlock } from "@/lib/painel-igpm";
import { AzSegmented, ChartCard } from "@/components/painel/core";
import { AzTimeSeriesChart, type AzSeriesPoint } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND, AZ_CHART } from "@/lib/az-chart-theme";
import { addMonthsUTC, fmtNum } from "@/lib/format-br";
import { CORR_FORTE, mesIso } from "./shared";

/**
 * Bloco 02 — "o IGP-M antecipa o IPCA — o atacado de hoje é o varejo de amanhã?".
 *
 * IPA-M 12m × IPCA 12m com toggle de deslocamento do IPA pela defasagem de
 * correlação máxima (calculada no BUILDER, não aqui — lags 0-6m em duas
 * janelas). Honestidade em primeiro lugar (crítica do revisor): o título só
 * afirma antecedência se a correlação máxima passa do threshold documentado
 * (0,6); a associação é dominada pelo episódio 2020-21 e correlação não é
 * garantia de repasse — está dito no rodapé.
 */
export function AntecipaIpcaCard({
  antecipacao,
  geradoEm,
  mesRecente,
}: {
  antecipacao: AntecipacaoBlock;
  geradoEm: string;
  mesRecente: string;
}) {
  const [deslocado, setDeslocado] = useState(true);

  const lagOtimo = antecipacao.melhor_lag_pos2016 ?? antecipacao.melhor_lag;
  const corrOtima = antecipacao.melhor_corr_pos2016 ?? antecipacao.melhor_corr_pos96;

  const { ipaCru, ipaDeslocado, ipca } = useMemo(() => {
    const cru: AzSeriesPoint[] = [];
    const desl: AzSeriesPoint[] = [];
    const ip: AzSeriesPoint[] = [];
    for (const r of antecipacao.serie) {
      const iso = mesIso(r.mes);
      if (r.ipa_12m != null) {
        cru.push([iso, r.ipa_12m]);
        desl.push([addMonthsUTC(iso, lagOtimo), r.ipa_12m]);
      }
      if (r.ipca_12m != null) ip.push([iso, r.ipca_12m]);
    }
    return { ipaCru: cru, ipaDeslocado: desl, ipca: ip };
  }, [antecipacao.serie, lagOtimo]);

  const corrForte = corrOtima != null && corrOtima >= CORR_FORTE;
  const titulo = corrForte
    ? `O atacado tende a anteceder o IPCA em ~${lagOtimo} meses`
    : "IGP-M e IPCA medem inflações diferentes — relação fraca";
  const subtitulo = corrForte
    ? `O IPA de hoje aparece no varejo de amanhã? A correlação máxima entre IPA-M 12m e IPCA 12m ocorre com o IPCA defasado em ${lagOtimo} meses (${fmtNum(corrOtima, 2)} desde ${antecipacao.janela_recente.slice(0, 4)}).`
    : "O IPA de hoje aparece no varejo de amanhã? A correlação defasada é baixa — o gráfico responde melhor por que os dois índices descolam (câmbio e commodities no atacado).";

  return (
    <ChartCard
      title={titulo}
      subtitle={subtitulo}
      toolbar={
        <AzSegmented
          ariaLabel="Deslocamento do IPA"
          options={[
            { id: "real", label: "Tempo real" },
            { id: "desl", label: `IPA adiantado +${lagOtimo}m` },
          ]}
          value={deslocado ? "desl" : "real"}
          onChange={(id) => setDeslocado(id === "desl")}
        />
      }
      footer={
        <span>
          Correlações calculadas no pipeline (IPCA defasado em +k meses):{" "}
          {antecipacao.lags
            .map((l) => `${l.lag}m ${l.corr_pos2016 != null ? fmtNum(l.corr_pos2016, 2) : "—"}`)
            .join(" · ")}{" "}
          (janela {antecipacao.janela_recente.slice(0, 4)}+; pós-{antecipacao.janela_total.slice(0, 4)}: máx{" "}
          {antecipacao.melhor_corr_pos96 != null ? fmtNum(antecipacao.melhor_corr_pos96, 2) : "—"} em{" "}
          {antecipacao.melhor_lag}m). Honestidade: a associação é dominada pelo episódio 2020-21
          (câmbio+commodities) — correlação não é garantia de repasse.
        </span>
      }
      stampGiro={geradoEm}
      stampDado={mesRecente}
    >
      <AzTimeSeriesChart
        series={[
          deslocado
            ? { id: "ipa", label: `IPA 12m (adiantado +${lagOtimo}m)`, color: AZ_BRAND.azure, data: ipaDeslocado }
            : { id: "ipa", label: "IPA 12m", color: AZ_BRAND.azure, data: ipaCru },
          { id: "ipca", label: "IPCA 12m", color: AZ_BRAND.rust, data: ipca },
        ]}
        unit="%"
        height={300}
      />
      <p className="mt-1 text-[11px] text-zinc-500">
        Escala única de propósito: a amplitude muito maior do IPA{" "}
        <em>é</em> a mensagem (atacado vive de câmbio e commodities;{" "}
        <span style={{ color: AZ_CHART.ticks }}>o varejo amortece</span>).
      </p>
    </ChartCard>
  );
}
