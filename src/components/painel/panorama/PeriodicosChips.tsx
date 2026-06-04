import Link from "next/link";

import { formatDateBR, listBriefings } from "@/lib/cafe-com-mercado";
import { listPautas } from "@/lib/pauta-da-semana";

type Chip = {
  kicker: string;
  dateLabel: string;
  href: string;
};

/**
 * Atalhos compactos pros dois periódicos da casa, exibidos no header do
 * Panorama (no lugar da antiga seção "Periódicos"). Cards pequenos com
 * kicker + data e seta — estilo az-card reduzido.
 */
export async function PeriodicosChips() {
  const chips: Chip[] = [];
  try {
    const [cafes, pautas] = await Promise.all([listBriefings(1), listPautas(1)]);
    const cafe = cafes[0];
    const pauta = pautas[0];
    if (cafe) {
      chips.push({
        kicker: "Café com Mercado",
        dateLabel: formatDateBR(cafe.date),
        href: `/cafe-com-mercado/${cafe.date}`,
      });
    }
    if (pauta) {
      chips.push({
        kicker: "Pauta da Semana",
        dateLabel: formatDateBR(pauta.date),
        href: `/pauta-da-semana/${pauta.slug}`,
      });
    }
  } catch {
    return null;
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-stretch gap-2">
      {chips.map((chip) => (
        <Link
          key={chip.href}
          href={chip.href}
          className="group flex min-w-[150px] flex-col justify-center rounded-xl border border-[#132960]/15 bg-white px-3.5 py-2 shadow-sm transition hover:border-[#027DFC]/50 hover:shadow"
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#027DFC]">
            {chip.kicker}
          </span>
          <span className="flex items-baseline gap-1.5 text-xs text-zinc-600">
            {chip.dateLabel}
            <span aria-hidden className="text-[#027DFC] transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
