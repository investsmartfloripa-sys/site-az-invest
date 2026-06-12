/**
 * Chaves e helpers do painel PNAD v2 (sem JSX).
 *
 * As séries do JSON usam os rótulos PT literais do pipeline (SIDRA) como
 * chave — centralizadas aqui para evitar typo silencioso (`num()` devolve
 * null e a linha some do gráfico sem nenhum erro).
 */

export const PNAD_KEYS = {
  desocupacao: "Taxa de desocupação",
  participacao: "Taxa de participação na força de trabalho",
  informalidade: "Taxa de informalidade",
  subutilizacao: "Taxa composta de subutilização",
  combinada: "Taxa combinada (desocup. + subocup. horas)",
  /** v2 — % da PIA (mesma escala da participação). Pode faltar em cargas antigas do Blob. */
  nivelOcupacao: "Nível da ocupação",
  /** v2 — dessazonalização PRÓPRIA (STL robusta); não há SA oficial da PNAD. */
  desocupacaoSa: "desocupacao_sa",
  /** Share de conta própria na composição da ocupação (% dos ocupados). */
  contaPropria: "Conta própria",
} as const;

/** Trimestre-régua pré-pandemia (último trimestre "normal" antes do choque covid). */
export const TRIM_PRE_PANDEMIA = "2019-T4";

/** "2026-T1" → "2025-T1" (mesmo trimestre do ano anterior — convenção YoY da PNAD). */
export function trimAnoAnterior(trim: string): string {
  const m = trim.match(/^(\d{4})-T(\d{1,2})$/);
  if (!m) return trim;
  return `${parseInt(m[1], 10) - 1}-T${m[2]}`;
}

/** Localiza a linha de um trimestre exato na série (undefined se ausente). */
export function findTrim<T extends { trim: string }>(serie: ReadonlyArray<T>, trim: string): T | undefined {
  return serie.find((r) => r.trim === trim);
}

/** Mediana simples — null para array vazio. */
export function mediana(vals: ReadonlyArray<number>): number | null {
  if (vals.length === 0) return null;
  const s = [...vals].sort((a, b) => a - b);
  const meio = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[meio] : +((s[meio - 1] + s[meio]) / 2).toFixed(4);
}
