import { formatDadoLabel, formatGiroDia } from "@/lib/data-stamp";

/**
 * Carimbo discreto de datas exibido no rodapé dos cards de gráfico:
 *   "Giro 04/06/26 · Dado mai/26"
 *
 * - giro: quando o pipeline gravou o JSON no Blob (precisão de dia).
 * - dado: data da observação mais recente da série plotada (precisão máxima
 *   disponível: minutos p/ intradiário, dia p/ diário, mês/trimestre p/ macro).
 */
export default function DataStamp({
  giro,
  dado,
  className = "",
}: {
  giro?: string | Date | null;
  dado?: string | Date | null;
  className?: string;
}) {
  const giroFmt = formatGiroDia(giro);
  const dadoFmt = formatDadoLabel(dado);
  if (!giroFmt && !dadoFmt) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap text-[10px] font-normal leading-none text-zinc-400 ${className}`}
    >
      {giroFmt ? <span>Giro {giroFmt}</span> : null}
      {giroFmt && dadoFmt ? <span aria-hidden>·</span> : null}
      {dadoFmt ? <span>Dado {dadoFmt}</span> : null}
    </span>
  );
}
