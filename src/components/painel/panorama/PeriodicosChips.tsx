import Link from "next/link";

import { formatDateBR, listBriefings } from "@/lib/cafe-com-mercado";
import { listDossies } from "@/lib/dossies";

/**
 * Dois botões-card finos lado a lado: Café com Mercado e Dossiê Mensal.
 * O card inteiro é o link; sem repetir o nome do periódico no título.
 */
export async function PeriodicosChips() {
  let cafe: { date: string } | null = null;
  let mensal: { href: string; periodo: string } | null = null;
  try {
    const [cafes, mensais] = await Promise.all([listBriefings(1), listDossies("mensal", 1)]);
    cafe = cafes[0] ?? null;
    mensal = mensais[0] ?? null;
  } catch {
    return null;
  }

  if (!cafe && !mensal) return null;

  const cardClass =
    "group flex items-center justify-between gap-3 rounded-xl border border-[#132960]/10 bg-white px-4 py-2.5 shadow-sm transition hover:border-[#027DFC]/50 hover:shadow";

  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {cafe ? (
        <Link href={`/cafe-com-mercado/${cafe.date}`} className={cardClass}>
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-[#027DFC]">
              Café com Mercado
            </span>
            <span className="truncate text-sm text-[#33415C]">{formatDateBR(cafe.date)}</span>
          </span>
          <span aria-hidden className="shrink-0 text-[#027DFC] transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </Link>
      ) : null}
      {mensal ? (
        <Link href={mensal.href} className={cardClass}>
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-[#027DFC]">
              Dossiê Mensal
            </span>
            <span className="truncate text-sm text-[#33415C]">{mensal.periodo}</span>
          </span>
          <span aria-hidden className="shrink-0 text-[#027DFC] transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </Link>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-[#132960]/15 bg-white/60 px-4 py-2.5">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-zinc-400">
              Dossiê Mensal
            </span>
            <span className="truncate text-sm text-zinc-400">em breve</span>
          </span>
        </div>
      )}
    </div>
  );
}
