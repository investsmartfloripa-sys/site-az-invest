"use client";

import { useMemo, useState } from "react";

import type { AnalisePonto, IgpmData } from "@/lib/painel-igpm";
import { AzSegmented, ChartCard } from "@/components/painel/core";
import { AzTimeSeriesChart, type AzSeriesPoint } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND, AZ_CHART, variationText } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtSignedPct } from "@/lib/format-br";
import { baixarCsv, mesIso } from "./shared";

/**
 * Bloco final — "Análise completa": o esmiuçamento profissional.
 *
 * A MESMA série (IGP-M cheio) em três transformações — variação mensal,
 * acumulado 12m composto e número-índice (base 100 no início da janela) — +
 * tabela mensal completa (IGP-M, componentes, 12m, IPCA, spread) e export
 * CSV client-side. O toggle só troca a transformação, nunca a pergunta.
 */

type Transformacao = "mensal" | "12m" | "indice";

function TabelaMensal({ serie }: { serie: AnalisePonto[] }) {
  const rows = useMemo(() => [...serie].reverse(), [serie]);
  return (
    <div className="mt-3 max-h-96 overflow-auto rounded-lg border border-zinc-100">
      <table className="min-w-full text-xs">
        <thead className="sticky top-0 bg-zinc-50">
          <tr>
            <th className="px-3 py-2 text-left font-semibold text-zinc-700">Mês</th>
            {["IGP-M", "IPA-M", "IPC-M", "INCC-M", "IGP-M 12m", "IPCA 12m", "Spread 12m"].map((h) => (
              <th key={h} className="whitespace-nowrap px-3 py-2 text-right font-semibold text-zinc-700">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 bg-white">
          {rows.map((r) => (
            <tr key={r.mes} className="hover:bg-zinc-50">
              <td className="whitespace-nowrap px-3 py-1.5 font-medium text-zinc-700">{fmtMesCurto(r.mes)}</td>
              {[r.igpm, r.ipa, r.ipc, r.incc, r.igpm_12m, r.ipca_12m].map((v, i) => (
                <td
                  key={i}
                  className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums"
                  style={{ color: v != null && i === 0 ? variationText(v) : undefined }}
                >
                  {fmtSignedPct(v, 2)}
                </td>
              ))}
              <td
                className="whitespace-nowrap px-3 py-1.5 text-right font-semibold tabular-nums"
                style={{
                  color:
                    r.spread_12m != null
                      ? r.spread_12m > 0
                        ? AZ_CHART.negText
                        : AZ_CHART.posText
                      : undefined,
                }}
              >
                {fmtSignedPct(r.spread_12m, 2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AnaliseCompletaIgpm({ data }: { data: IgpmData }) {
  const [transf, setTransf] = useState<Transformacao>("12m");
  const serie = useMemo(() => data.analise?.serie ?? [], [data.analise?.serie]);

  const { mensal, acum12m, indice } = useMemo(() => {
    const mensalPts: AzSeriesPoint[] = [];
    const acumPts: AzSeriesPoint[] = [];
    const indicePts: AzSeriesPoint[] = [];
    let idx = 100;
    let primeiro = true;
    for (const r of serie) {
      const iso = mesIso(r.mes);
      if (r.igpm != null) {
        mensalPts.push([iso, r.igpm]);
        idx = primeiro ? 100 : idx * (1 + r.igpm / 100);
        primeiro = false;
        indicePts.push([iso, Number(idx.toFixed(4))]);
      }
      if (r.igpm_12m != null) acumPts.push([iso, r.igpm_12m]);
    }
    return { mensal: mensalPts, acum12m: acumPts, indice: indicePts };
  }, [serie]);

  const baixarSerieCsv = () => {
    baixarCsv(
      `igpm-serie-${data.mes_recente}.csv`,
      ["mes", "igpm_var_mensal_pct", "ipa_m_pct", "ipc_m_pct", "incc_m_pct", "igpm_acum_12m_pct", "ipca_acum_12m_pct", "spread_12m_pp"],
      serie.map((r) => [r.mes, r.igpm, r.ipa, r.ipc, r.incc, r.igpm_12m, r.ipca_12m, r.spread_12m]),
    );
  };

  const baixarDecomposicaoCsv = () => {
    const dec = data.decomposicao;
    if (!dec) return;
    const comps = dec.componentes;
    baixarCsv(
      `igpm-decomposicao-${data.mes_recente}.csv`,
      [
        "mes",
        "igpm_pct",
        ...comps.map((c) => `${c.toLowerCase()}_contrib_pp`),
        ...comps.map((c) => `${c.toLowerCase()}_peso_efetivo_pct`),
        "residuo_pp",
      ],
      dec.serie.map((r) => [
        r.mes,
        typeof r["IGP-M"] === "number" ? (r["IGP-M"] as number) : null,
        ...comps.map((c) => (typeof r[`${c} (contrib)`] === "number" ? (r[`${c} (contrib)`] as number) : null)),
        ...comps.map((c) =>
          typeof r[`${c} (peso efetivo)`] === "number" ? (r[`${c} (peso efetivo)`] as number) : null,
        ),
        typeof r.residuo_pp === "number" ? (r.residuo_pp as number) : null,
      ]),
    );
  };

  if (serie.length === 0) return null;

  const config: Record<Transformacao, { pts: AzSeriesPoint[]; label: string; unit: "%" | "index"; subtitulo: string }> = {
    mensal: {
      pts: mensal,
      label: "IGP-M — variação mensal",
      unit: "%",
      subtitulo: "Variação % mês a mês — a leitura mais ruidosa (decêndios, câmbio).",
    },
    "12m": {
      pts: acum12m,
      label: "IGP-M — acumulado 12 meses",
      unit: "%",
      subtitulo: "Acumulado 12m composto no pipeline (validado contra os valores oficiais FGV) — a leitura que indexa contratos.",
    },
    indice: {
      pts: indice,
      label: "IGP-M — número-índice",
      unit: "index",
      subtitulo: `Nível de preços, base 100 em ${serie.length > 0 ? fmtMesCurto(serie[0].mes) : "—"} — o acumulado da janela.`,
    },
  };
  const atual = config[transf];

  return (
    <details className="group">
      <summary className="cursor-pointer select-none rounded-xl border border-[#132960]/10 bg-white px-4 py-3 text-sm font-semibold text-[#132960] shadow-sm marker:text-[#027DFC]">
        Abrir análise completa — transformações, tabela mensal e download CSV
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
                Baixar CSV — série mensal (10 anos)
              </button>
              {data.decomposicao ? (
                <button
                  type="button"
                  onClick={baixarDecomposicaoCsv}
                  className="rounded-lg border border-[#132960]/20 bg-white px-2.5 py-1 text-xs font-semibold text-[#132960] transition-colors hover:bg-zinc-50"
                >
                  Baixar CSV — decomposição (pesos efetivos)
                </button>
              ) : null}
            </span>
          }
          stampGiro={data.gerado_em}
          stampDado={data.mes_recente}
        >
          <AzTimeSeriesChart
            series={[{ id: "igpm", label: atual.label, color: AZ_BRAND.azure, data: atual.pts }]}
            unit={atual.unit}
            height={300}
          />
        </ChartCard>

        <details className="group mt-3 rounded-lg border border-zinc-100 bg-zinc-50/60 p-3">
          <summary className="cursor-pointer select-none text-xs font-semibold text-[#132960] marker:text-[#027DFC]">
            Ver tabela mensal completa ({serie.length} meses — IGP-M, componentes, 12m, IPCA, spread)
          </summary>
          <TabelaMensal serie={serie} />
        </details>

        <p className="mt-2 text-[11px] text-zinc-500">
          CSVs gerados no navegador a partir dos dados já carregados (separador “;”, decimal vírgula, UTF-8
          com BOM). Spread 12m em vermelho = IGP-M acima do IPCA.
        </p>
      </div>
    </details>
  );
}
