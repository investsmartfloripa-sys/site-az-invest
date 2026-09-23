/**
 * Helpers do COCKPIT de Contas Externas (balanço de pagamentos, schema v3).
 *
 * Unidades do payload: `bp_mestre.mensal` em US$ milhões; `bp_mestre.acum_12m`
 * em US$ bilhões com `pib` (PIB 12m em US$ bi) na mesma linha — % do PIB é
 * sempre `valor 12m ÷ pib × 100`, nunca recalculado de outra fonte.
 *
 * Convenção de sinal da conta financeira (BPM6/BCB): líquido = ativos −
 * passivos → NEGATIVO = entrada líquida de recursos. IDP e passivos: + = entrada.
 */

import type { AzSeriesPoint } from "@/components/painel/charts/AzTimeSeriesChart";
import { resolvePeriodRange, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import type { BpRegistro } from "@/lib/painel-contas-externas";
import { fmtNum } from "@/lib/format-br";

export { BTN_CSV_CLASS } from "@/components/painel/atividade/v2/pib/cockpit-shared";
export { baixarCsv, codaceAreas, fmtUsBi, fmtUsBiSigned, num } from "../v2/shared";

/** "YYYY-MM" ou "YYYY-MM-DD" → ISO de dia 01 (o mesIso de Atividade SEMPRE anexa "-01"). */
export function isoMes(m: string): string {
  return m.length === 7 ? `${m}-01` : m.slice(0, 10);
}

/** Recorta registros {mes} pela janela do AzPeriodSelector. */
export function recorta<T extends { mes: string }>(rows: ReadonlyArray<T>, period: AzPeriodValue): T[] {
  if (rows.length === 0) return [];
  const { from, to } = resolvePeriodRange(period, isoMes(rows[0].mes), isoMes(rows[rows.length - 1].mes));
  return rows.filter((r) => {
    const i = isoMes(r.mes);
    return i >= from && i <= to;
  });
}

const MINUS = "−";

/** Valor numérico de um registro do BP (null se ausente). */
export function val(r: BpRegistro | undefined | null, key: string): number | null {
  const v = r?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** % do PIB 12m (US$ bi ÷ US$ bi × 100). */
export function pctPib(r: BpRegistro | undefined | null, key: string): number | null {
  const v = val(r, key);
  const p = val(r, "pib");
  return v != null && p != null && p > 0 ? (v / p) * 100 : null;
}

/** Série [iso, valor] de uma chave; `emPib` converte para % do PIB 12m. */
export function serieBp(rows: ReadonlyArray<BpRegistro>, key: string, emPib = false, fator = 1): AzSeriesPoint[] {
  const out: AzSeriesPoint[] = [];
  for (const r of rows) {
    const v = emPib ? pctPib(r, key) : val(r, key);
    if (v != null) out.push([isoMes(r.mes), +(v * fator).toFixed(3)]);
  }
  return out;
}

/** Registro de 12 meses antes (mesmo mês do ano anterior) na série mensal. */
export function mesmoMesAnoAnterior<T extends { mes: string }>(rows: ReadonlyArray<T>, mes: string): T | undefined {
  const alvo = `${parseInt(mes.slice(0, 4), 10) - 1}${mes.slice(4)}`;
  return rows.find((r) => r.mes === alvo);
}

/** Percentil (0–100) do último valor na distribuição histórica (inclusive). */
export function percentil(valores: ReadonlyArray<number>, v: number): number | null {
  if (valores.length < 12) return null;
  const abaixo = valores.filter((x) => x <= v).length;
  return Math.round((abaixo / valores.length) * 100);
}

/** "−12,3" / "+4,5" com menos tipográfico e sinal explícito. */
export function fmtSinal(v: number | null | undefined, dec = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (v === 0) return fmtNum(0, dec);
  return `${v > 0 ? "+" : MINUS}${fmtNum(Math.abs(v), dec)}`;
}

/** US$ mi → "US$ 1,2 bi" com sinal. */
export function fmtMiComoBi(v: number | null | undefined, dec = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v > 0 ? "+" : v < 0 ? MINUS : ""}${fmtNum(Math.abs(v) / 1000, dec)}`;
}

/** Recorte de janela em anos a partir do último ponto (para percentis "desde"). */
export function desde<T extends { mes: string }>(rows: ReadonlyArray<T>, isoMin: string): T[] {
  return rows.filter((r) => r.mes >= isoMin);
}

/** Último registro do array. */
export function ultimoDe<T>(rows: ReadonlyArray<T> | undefined | null): T | undefined {
  return rows && rows.length ? rows[rows.length - 1] : undefined;
}

/** "2026-T1" → "1T26". */
export function fmtTrimPii(t: string): string {
  const [a, q] = t.split("-T");
  return `${q}T${a.slice(2)}`;
}

/** Ano-calendário corrente do dado (para Focus/realizado). */
export function anoDoMes(mes: string | null | undefined): number {
  return mes ? parseInt(mes.slice(0, 4), 10) : new Date().getUTCFullYear();
}
