/**
 * Carimbo único do Panorama: "Atualizado às 13:16 de 12/11/2026" (horário de Brasília).
 *
 * Os cartões do Panorama usavam "Giro 12/11/26 · Dado 12/11 13:16" — as duas datas
 * vinham do MESMO horário de gravação, em 10 px e cinza claro. Aqui fica um rótulo só,
 * data dd/mm/aaaa, 12 px e cinza com contraste de leitura (revisão de 12/11/2026).
 */

const TZ = "America/Sao_Paulo";

/** Horário de gravação do pipeline. ISO sem fuso vem em UTC (mesma regra do data-stamp). */
function parseInstante(value: string | Date): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  let s = value.trim();
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s)) s = `${s.replace(" ", "T")}Z`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Texto do carimbo a partir de hora ("13:16") e data ("12/11/2026") já no horário de Brasília. */
export function textoAtualizado(hora: string | null, data: string): string {
  return hora ? `Atualizado às ${hora} de ${data}` : `Atualizado em ${data}`;
}

/** Texto do carimbo a partir de um instante (ISO/Date); null se não der para ler a data. */
export function rotuloAtualizado(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const d = parseInstante(value);
  if (!d) return null;
  const partes: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d)) {
    partes[p.type] = p.value;
  }
  const hora = partes.hour === "24" ? "00" : partes.hour;
  return textoAtualizado(`${hora}:${partes.minute}`, `${partes.day}/${partes.month}/${partes.year}`);
}

export function Atualizado({
  em,
  texto,
  className = "",
}: {
  /** Instante da atualização (ISO do pipeline ou Date). */
  em?: string | Date | null;
  /** Texto pronto (quando a fonte já traz hora local, como a B3). Tem precedência sobre `em`. */
  texto?: string | null;
  className?: string;
}) {
  const t = texto ?? rotuloAtualizado(em);
  if (!t) return null;
  return (
    <span suppressHydrationWarning className={`text-xs text-zinc-500 ${className}`}>
      {t}
    </span>
  );
}
