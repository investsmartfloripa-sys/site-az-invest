/**
 * Helpers do dashboard Contas Externas v2 (template narrativo AZ).
 *
 * Reaproveita os helpers de Atividade v2 (num, baixarCsv, codaceAreas,
 * mesIso, ultimo) e adiciona o que é específico da área: formatação US$ bi,
 * recorte de período em séries mensais {mes: "YYYY-MM"}, faixas dos períodos
 * de superávit da conta corrente e o card de pipeline pendente.
 *
 * Convenções da área (revisor, 2026-06):
 * - ACUMULADO 12m é o default analítico — fluxo mensal bruto é dominado pela
 *   sazonalidade de soja/remessas e não vira manchete;
 * - réguas editoriais declaradas: banda ±2% PIB da TC é GUIA EDITORIAL (não
 *   literatura); déficit > 4% do PIB é a referência assimétrica de risco;
 *   regra de bolso do FMI p/ reservas = 3 MESES de importação.
 */

import { resolvePeriodRange, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import type { AzXRefArea } from "@/components/painel/charts/AzTimeSeriesChart";
import type { CoberturaIdpPonto } from "@/lib/painel-contas-externas";
import { AZ_CHART } from "@/lib/az-chart-theme";
import { fmtNum } from "@/lib/format-br";
import { mesIso } from "@/components/painel/atividade/v2/shared";

export { baixarCsv, codaceAreas, mesIso, num, ultimo } from "@/components/painel/atividade/v2/shared";

const MINUS = "−"; // menos tipográfico (U+2212), padrão format-br

/** "US$ 12,3 bi" — negativo com menos tipográfico: "−US$ 12,3 bi". */
export function fmtUsBi(v: number | null | undefined, dec = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v < 0 ? MINUS : ""}US$ ${fmtNum(Math.abs(v), dec)} bi`;
}

/** US$ bi com sinal explícito: "+US$ 1,2 bi" / "−US$ 0,8 bi" (zero sem sinal). */
export function fmtUsBiSigned(v: number | null | undefined, dec = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (v === 0) return `US$ ${fmtNum(0, dec)} bi`;
  return `${v > 0 ? "+" : MINUS}US$ ${fmtNum(Math.abs(v), dec)} bi`;
}

/** Recorta uma série mensal {mes: "YYYY-MM"} pela janela do AzPeriodSelector. */
export function filtraPeriodoMes<T extends { mes: string }>(serie: ReadonlyArray<T>, period: AzPeriodValue): T[] {
  if (serie.length === 0) return [];
  const min = mesIso(serie[0].mes);
  const max = mesIso(serie[serie.length - 1].mes);
  const { from, to } = resolvePeriodRange(period, min, max);
  return serie.filter((r) => {
    const iso = mesIso(r.mes);
    return iso >= from && iso <= to;
  });
}

/**
 * Faixas verticais dos períodos em que a TC esteve SUPERAVITÁRIA (a razão de
 * cobertura não tem leitura: não há déficit a financiar). Verde a 8%; só a
 * faixa mais longa leva rótulo p/ não poluir o gráfico.
 */
export function superavitAreas(serie: ReadonlyArray<CoberturaIdpPonto>): AzXRefArea[] {
  const runs: { x1: string; x2: string; len: number }[] = [];
  let inicio: string | null = null;
  let fim: string | null = null;
  let len = 0;
  const fecha = () => {
    if (inicio != null && fim != null) runs.push({ x1: mesIso(inicio), x2: mesIso(fim), len });
    inicio = null;
    fim = null;
    len = 0;
  };
  for (const p of serie) {
    const superavit = typeof p.tc_pct_pib === "number" && p.tc_pct_pib >= 0;
    if (superavit) {
      if (inicio == null) inicio = p.mes;
      fim = p.mes;
      len++;
    } else {
      fecha();
    }
  }
  fecha();
  const maisLonga = runs.reduce((best, r) => (best == null || r.len > best.len ? r : best), null as { x1: string; x2: string; len: number } | null);
  return runs.map((r) => ({
    x1: r.x1,
    x2: r.x2,
    color: AZ_CHART.pos,
    opacity: 0.08,
    label: r === maisLonga ? "TC em superávit" : undefined,
  }));
}

/** Card-aviso de bloco v2 ainda não publicado pelo pipeline (degrade gracioso). */
export function PipelinePendente({ oQue }: { oQue: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-[#132960]/20 bg-white p-6 text-center text-sm text-zinc-400">
      O pipeline ainda não publicou {oQue} (schema v2). Rode o workflow contas-externas-pipeline.yml.
    </div>
  );
}
