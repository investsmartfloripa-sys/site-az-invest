"use client";

import { useMemo, useState } from "react";

import type { IpcaData } from "@/lib/painel-ipca";
import { AzSegmented, ChartCard } from "@/components/painel/core";
import { AzTimeSeriesChart, type AzSeriesPoint } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND, AZ_CHART } from "@/lib/az-chart-theme";
import { fmtMesCurto } from "@/lib/format-br";
import { META, META_PISO, META_TETO, baixarCsv, mesIso, num } from "./shared";

/**
 * Bloco 07 — "Análise completa": o esmiuçamento profissional.
 *
 * A MESMA série (IPCA cheio) em três transformações — variação mensal,
 * acumulado 12m oficial e número-índice (base 100 no início da janela) — +
 * export CSV client-side dos dados já carregados (série e subitens do mês).
 * O toggle só troca a transformação, nunca a pergunta.
 */

type Transformacao = "mensal" | "12m" | "indice";

export function AnaliseCompleta({ data }: { data: IpcaData }) {
  const [transf, setTransf] = useState<Transformacao>("12m");

  const serie = data.ipca_cheio.serie;

  const { mensal, acum12m, indice } = useMemo(() => {
    const mensalPts: AzSeriesPoint[] = [];
    const acumPts: AzSeriesPoint[] = [];
    const indicePts: AzSeriesPoint[] = [];
    let idx = 100;
    let primeiro = true;
    for (const row of serie) {
      const iso = mesIso(row.mes);
      const m = num(row, "IPCA cheio");
      const a = num(row, "IPCA 12m");
      if (m != null) {
        mensalPts.push([iso, m]);
        idx = primeiro ? 100 : idx * (1 + m / 100);
        primeiro = false;
        indicePts.push([iso, Number(idx.toFixed(4))]);
      }
      if (a != null) acumPts.push([iso, a]);
    }
    return { mensal: mensalPts, acum12m: acumPts, indice: indicePts };
  }, [serie]);

  const baixarSerieCsv = () => {
    const porMes = new Map<string, { m?: number; a?: number; i?: number }>();
    for (const [iso, v] of mensal) porMes.set(iso, { ...porMes.get(iso), m: v });
    for (const [iso, v] of acum12m) porMes.set(iso, { ...porMes.get(iso), a: v });
    for (const [iso, v] of indice) porMes.set(iso, { ...porMes.get(iso), i: v });
    const rows = [...porMes.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([iso, v]) => [iso.slice(0, 7), v.m ?? null, v.a ?? null, v.i ?? null]);
    baixarCsv(
      `ipca-serie-${data.mes_recente}.csv`,
      ["mes", "ipca_var_mensal_pct", "ipca_acum_12m_pct", "indice_base100"],
      rows,
    );
  };

  const baixarSubitensCsv = () => {
    const subitens = data.maiores_influencias.todos ?? [
      ...data.maiores_influencias.top_altas,
      ...data.maiores_influencias.top_quedas,
    ];
    baixarCsv(
      `ipca-subitens-${data.maiores_influencias.mes}.csv`,
      ["subitem", "var_mensal_pct", "peso_pct", "contrib_pp"],
      subitens.map((x) => [x.subitem, x.var, x.peso, x.contrib_pp]),
    );
  };

  const config: Record<
    Transformacao,
    { pts: AzSeriesPoint[]; label: string; unit: "%" | "index"; subtitulo: string }
  > = {
    mensal: {
      pts: mensal,
      label: "IPCA — variação mensal",
      unit: "%",
      subtitulo: "Variação % mês a mês — a leitura mais ruidosa (sazonal).",
    },
    "12m": {
      pts: acum12m,
      label: "IPCA — acumulado 12 meses",
      unit: "%",
      subtitulo: "Acumulado 12m oficial (v2265) — a leitura de cumprimento da meta.",
    },
    indice: {
      pts: indice,
      label: "IPCA — número-índice",
      unit: "index",
      subtitulo: `Nível de preços, base 100 em ${serie.length > 0 ? fmtMesCurto(serie[0].mes) : "—"} — o custo de vida acumulado da janela.`,
    },
  };
  const atual = config[transf];

  return (
    <details className="group">
      <summary className="cursor-pointer select-none rounded-xl border border-[#132960]/10 bg-white px-4 py-3 text-sm font-semibold text-[#132960] shadow-sm marker:text-[#027DFC]">
        Abrir análise completa — série em múltiplas transformações + download CSV
      </summary>
      <div className="mt-3">
        <ChartCard
          title={atual.label}
          subtitle={atual.subtitulo}
          toolbar={
            <AzSegmented
              ariaLabel="Transformação da série"
              options={[
                { id: "mensal", label: "Mensal" },
                { id: "12m", label: "Acum. 12m" },
                { id: "indice", label: "Índice (base 100)" },
              ]}
              value={transf}
              onChange={(id) => setTransf(id as Transformacao)}
            />
          }
          footer={
            <span className="flex flex-wrap items-center gap-2">
              <span>Mesma série, três leituras — o toggle troca a transformação, não a pergunta.</span>
              <button
                type="button"
                onClick={baixarSerieCsv}
                className="rounded-lg border border-[#132960]/20 bg-white px-2.5 py-1 text-xs font-semibold text-[#132960] transition-colors hover:bg-zinc-50"
              >
                Baixar CSV — série
              </button>
              <button
                type="button"
                onClick={baixarSubitensCsv}
                className="rounded-lg border border-[#132960]/20 bg-white px-2.5 py-1 text-xs font-semibold text-[#132960] transition-colors hover:bg-zinc-50"
              >
                Baixar CSV — subitens de {fmtMesCurto(data.maiores_influencias.mes)}
              </button>
            </span>
          }
          stampGiro={data.gerado_em}
          stampDado={data.mes_recente}
        >
          <AzTimeSeriesChart
            series={[{ id: "ipca", label: atual.label, color: AZ_BRAND.azure, data: atual.pts }]}
            unit={atual.unit}
            height={300}
            refAreas={
              transf === "12m"
                ? [{ y1: META_PISO, y2: META_TETO, color: AZ_CHART.ticks, opacity: 0.08, label: "banda da meta" }]
                : []
            }
            refLines={transf === "12m" ? [{ y: META, label: "meta 3,0%", color: AZ_BRAND.navy }] : []}
          />
        </ChartCard>
        <p className="mt-2 text-[11px] text-zinc-500">
          A tabela completa de subitens do mês (busca e ordenação) está no bloco “Maiores influências”, em “Ver
          tabela completa”. CSVs gerados no navegador a partir dos dados já carregados (separador “;”, decimal
          vírgula, UTF-8 com BOM).
        </p>
      </div>
    </details>
  );
}
