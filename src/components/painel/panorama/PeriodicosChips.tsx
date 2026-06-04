import Link from "next/link";

import { formatDateBR, listBriefings } from "@/lib/cafe-com-mercado";
import { listPautas } from "@/lib/pauta-da-semana";

/**
 * Faixa fina dos periódicos no topo do Panorama (no lugar do antigo
 * resumo automático): kicker + título do Café com Mercado do dia e
 * atalho pra Pauta da Semana quando houver.
 */
export async function PeriodicosChips() {
  let cafe: { date: string; title: string } | null = null;
  let pautaHref: string | null = null;
  try {
    const [cafes, pautas] = await Promise.all([listBriefings(1), listPautas(1)]);
    cafe = cafes[0] ?? null;
    pautaHref = pautas[0] ? `/pauta-da-semana/${pautas[0].slug}` : null;
  } catch {
    return null;
  }

  if (!cafe && !pautaHref) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-[#132960]/10 bg-white px-4 py-2.5 shadow-sm">
      {cafe ? (
        <>
          <span className="rounded bg-[#eaf2ff] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0C447C]">
            Café com Mercado · {formatDateBR(cafe.date)}
          </span>
          <Link
            href={`/cafe-com-mercado/${cafe.date}`}
            className="group min-w-0 flex-1 basis-64 truncate text-sm text-[#33415C] hover:text-[#027DFC]"
          >
            {cafe.title}
            <span aria-hidden className="ml-1 inline-block text-[#027DFC] transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        </>
      ) : null}
      {pautaHref ? (
        <Link
          href={pautaHref}
          className="shrink-0 whitespace-nowrap text-xs font-semibold text-[#027DFC] hover:underline"
        >
          Pauta da Semana →
        </Link>
      ) : null}
    </div>
  );
}
