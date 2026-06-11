"use client";

import { useMemo, useState } from "react";

import type { CambioMacroData } from "@/lib/painel-contas-externas";
import { AzSegmented, ChartCard } from "@/components/painel/core";
import { AzTimeSeriesChart } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND, AZ_CHART } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtPct, fmtSignedPct } from "@/lib/format-br";
import { indicePoints, leituraDesvio } from "./shared";

/**
 * Bloco 01 — "o real está caro ou barato em termos reais?".
 *
 * Toggle entre o bilateral construído (PTAX × CPI EUA ÷ IPCA, base 100 em
 * 2000-01) e o REER oficial (SGS 11752, jun/1994=100). Régua: média histórica
 * 2000+ com banda de ±1 desvio-padrão — HONESTIDADE: média histórica NÃO é
 * taxa de equilíbrio, é referência de posição relativa.
 *
 * CONVENÇÃO (rodapé fixo): ALTA do índice = DEPRECIAÇÃO real do BRL — vale
 * p/ as DUAS séries. Não inverter a leitura.
 */

type Visao = "bilateral" | "reer";

export function CambioRealCard({ data }: { data: CambioMacroData }) {
  const [visao, setVisao] = useState<Visao>("bilateral");

  const bilateral = data.cambio_real.bilateral;
  const reer = data.cambio_real.reer;

  const pontosBilateral = useMemo(() => indicePoints(bilateral.serie), [bilateral.serie]);
  const pontosReer = useMemo(() => indicePoints(reer.serie), [reer.serie]);

  const bloco = visao === "bilateral" ? bilateral : reer;
  const pontos = visao === "bilateral" ? pontosBilateral : pontosReer;

  const desvio = bilateral.desvio_vs_media_pct;
  const dpPct = bilateral.media_hist > 0 ? (bilateral.dp_hist / bilateral.media_hist) * 100 : 0;
  const leitura = leituraDesvio(desvio, dpPct);

  const titulo =
    visao === "bilateral"
      ? leitura === "em linha"
        ? `Câmbio real em linha com a média histórica (${fmtSignedPct(desvio, 1)})`
        : `Real ${fmtPct(Math.abs(desvio), 1)} ${leitura} que a média histórica`
      : `REER em ${fmtNum(reer.ultimo.indice, 1)} — alta do índice = depreciação real`;

  const subtitulo =
    visao === "bilateral"
      ? `USD/BRL real construído: PTAX × (CPI EUA ÷ IPCA), base 100 em ${fmtMesCurto(bilateral.base_100)}. Banda = média ${bilateral.janela_regua} ± 1 dp.`
      : `Câmbio efetivo real oficial do BCB (SGS ${reer.sgs}, IPCA, jun/1994 = 100) — cesta dos principais parceiros comerciais. Banda = média ${reer.janela_regua} ± 1 dp.`;

  return (
    <ChartCard
      title={titulo}
      subtitle={subtitulo}
      toolbar={
        <AzSegmented
          ariaLabel="Série de câmbio real"
          options={[
            { id: "bilateral", label: "Bilateral (EUA)" },
            { id: "reer", label: "REER (BCB 11752)" },
          ]}
          value={visao}
          onChange={(id) => setVisao(id as Visao)}
        />
      }
      footer={
        <span>
          <strong>Convenção (vale p/ as duas séries): ALTA do índice = DEPRECIAÇÃO real do BRL</strong> — mais
          reais por dólar depois de descontar a inflação dos dois lados. A média histórica (
          {fmtNum(bloco.media_hist, 1)} ± {fmtNum(bloco.dp_hist, 1)}) é régua de posição relativa,{" "}
          <em>não</em> taxa de equilíbrio: acima da banda = real historicamente depreciado; abaixo =
          historicamente apreciado.
        </span>
      }
      stampGiro={data.generated_at}
      stampDado={bloco.ultimo.mes}
    >
      <AzTimeSeriesChart
        series={[
          {
            id: visao,
            label: visao === "bilateral" ? "Câmbio real bilateral USD/BRL (base 100)" : "REER (jun/1994 = 100)",
            color: AZ_BRAND.azure,
            data: pontos,
          },
        ]}
        unit="index"
        height={320}
        refAreas={[
          {
            y1: bloco.media_hist - bloco.dp_hist,
            y2: bloco.media_hist + bloco.dp_hist,
            color: AZ_CHART.ticks,
            opacity: 0.08,
            label: "média ± 1 dp",
          },
        ]}
        refLines={[
          {
            y: bloco.media_hist,
            label: `média ${bloco.janela_regua}: ${fmtNum(bloco.media_hist, 0)}`,
            color: AZ_BRAND.navy,
          },
        ]}
        showLegend={false}
      />
    </ChartCard>
  );
}
