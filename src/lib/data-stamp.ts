/**
 * Helpers de formatação de datas de giro (pipeline) e de dado (observação)
 * usados pelo carimbo discreto dos gráficos públicos (DataStamp) e pelo
 * dashboard "Saúde dos dados" da área logada.
 */

const MESES_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Fuso fixo do site (público BR): mesma saída no SSR (UTC) e no client. */
const TZ = "America/Sao_Paulo";

// (datas YYYY-MM / YYYY-MM-DD de séries são formatadas por regex, sem fuso)

function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

type Parts = { dia: string; mes: string; ano2: string; hora: string; min: string };

function partsSP(d: Date): Parts {
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) map[p.type] = p.value;
  return {
    dia: map.day ?? "",
    mes: map.month ?? "",
    ano2: (map.year ?? "").slice(2),
    hora: map.hour === "24" ? "00" : (map.hour ?? ""),
    min: map.minute ?? "",
  };
}

/** Giro com precisão de DIA: "04/06/26" (horário de Brasília). */
export function formatGiroDia(value: string | Date | null | undefined): string | null {
  const d = parseDate(value);
  if (!d) return null;
  const p = partsSP(d);
  return `${p.dia}/${p.mes}/${p.ano2}`;
}

/** Giro com precisão de minuto (dashboard): "04/06 09:12" (horário de Brasília). */
export function formatGiroMinuto(value: string | Date | null | undefined): string | null {
  const d = parseDate(value);
  if (!d) return null;
  const p = partsSP(d);
  return `${p.dia}/${p.mes} ${p.hora}:${p.min}`;
}

/**
 * Data do DADO com a maior precisão disponível no rótulo cru:
 *  - ISO com hora ("2026-06-04T14:32:00Z") → "04/06 14:32"
 *  - data ("2026-06-04")                   → "04/06/26"
 *  - mês ("2026-05")                       → "mai/26"
 *  - trimestre ("2026-T1" | "2026Q1")      → "T1/26"
 *  - outro                                 → valor cru
 */
export function formatDadoLabel(raw: string | Date | null | undefined): string | null {
  if (raw == null) return null;
  if (raw instanceof Date) return formatDadoMinuto(raw);
  const value = raw.trim();
  if (!value) return null;

  const tri = value.match(/^(\d{4})[-\s]?[TQ](\d{1,2})$/i);
  if (tri) return `T${Number(tri[2])}/${tri[1].slice(2)}`;

  const mes = value.match(/^(\d{4})-(\d{2})$/);
  if (mes) {
    const m = Number(mes[2]);
    if (m >= 1 && m <= 12) return `${MESES_PT[m - 1]}/${mes[1].slice(2)}`;
    return value;
  }

  const dia = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dia) return `${dia[3]}/${dia[2]}/${dia[1].slice(2)}`;

  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value)) {
    const d = parseDate(value);
    if (d) return formatDadoMinuto(d);
  }

  return value;
}

/** Dado intradiário com minutos: "04/06 14:32" (horário de Brasília). */
export function formatDadoMinuto(value: string | Date | null | undefined): string | null {
  const d = parseDate(value);
  if (!d) return null;
  const p = partsSP(d);
  return `${p.dia}/${p.mes} ${p.hora}:${p.min}`;
}

/** Idade relativa: "há 12 min" / "há 5 h" / "há 3 dias". */
export function relativeAge(value: string | Date | null | undefined, now: Date = new Date()): string | null {
  const d = parseDate(value);
  if (!d) return null;
  const min = Math.max(0, Math.round((now.getTime() - d.getTime()) / 60000));
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.round(h / 24)} dias`;
}

/**
 * Última data de uma série plotada (array de pontos com campo de data).
 * Aceita campos comuns: date | data | dia | mes | mês | period | ref.
 * Retorna o rótulo cru da última observação (para formatDadoLabel).
 */
export function lastSeriesDate(
  series: Array<Record<string, unknown>> | null | undefined,
  field?: string,
): string | null {
  if (!series || series.length === 0) return null;
  const candidates = field ? [field] : ["date", "data", "dia", "mes", "month", "period", "ref", "trimestre"];
  const last = series[series.length - 1];
  if (!last || typeof last !== "object") return null;
  for (const key of candidates) {
    const v = (last as Record<string, unknown>)[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}
