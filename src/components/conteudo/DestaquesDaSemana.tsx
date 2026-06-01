import Link from "next/link";
import { formatDateBR, listBriefings } from "@/lib/cafe-com-mercado";
import { listPautas } from "@/lib/pauta-da-semana";

/**
 * Bloco com 2 cards lado a lado: último Café com Mercado + última Pauta da Semana.
 * Aparece na home e no topo do Panorama. Se algum dos formatos estiver vazio, o card vira placeholder.
 */
export async function DestaquesDaSemana() {
  const [cafes, pautas] = await Promise.all([listBriefings(1), listPautas(1)]);
  const cafe = cafes[0] ?? null;
  const pauta = pautas[0] ?? null;

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-2xl font-semibold text-[#132960] md:text-3xl">
          Periódicos
        </h2>
        <Link
          href="/conteudo"
          className="text-sm font-semibold text-[#027DFC] hover:underline"
        >
          Ver todo o conteúdo →
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Café com Mercado */}
        {cafe ? (
          <Link
            href={`/cafe-com-mercado/${cafe.date}`}
            className="az-card group flex flex-col gap-2 p-5 transition hover:border-[#027DFC]/40 md:p-6"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-[#027DFC]">
              Café com Mercado · {cafe.weekday ? `${cafe.weekday}, ` : ""}
              {formatDateBR(cafe.date)}
            </p>
            <h3 className="text-lg font-semibold text-[#132960] group-hover:text-[#027DFC] md:text-xl">
              {cafe.title}
            </h3>
            {cafe.description ? (
              <p className="line-clamp-3 text-sm text-zinc-700">{cafe.description}</p>
            ) : null}
            <p className="mt-auto pt-2 text-sm font-semibold text-[#027DFC]">
              Ler briefing →
            </p>
          </Link>
        ) : (
          <div className="az-card flex flex-col gap-2 p-5 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Café com Mercado
            </p>
            <p className="text-sm text-zinc-700">Sem briefing publicado ainda.</p>
          </div>
        )}

        {/* Pauta da Semana */}
        {pauta ? (
          <Link
            href={`/pauta-da-semana/${pauta.slug}`}
            className="az-card group flex flex-col gap-2 p-5 transition hover:border-[#027DFC]/40 md:p-6"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-[#027DFC]">
              Pauta da Semana · Semana de {formatDateBR(pauta.date)}
            </p>
            <h3 className="text-lg font-semibold text-[#132960] group-hover:text-[#027DFC] md:text-xl">
              {pauta.title}
            </h3>
            {pauta.description ? (
              <p className="line-clamp-3 text-sm text-zinc-700">{pauta.description}</p>
            ) : null}
            <div className="mt-auto flex items-center gap-3 pt-2 text-sm font-semibold">
              <span className="text-[#027DFC]">Ler pauta →</span>
              {pauta.videoUrl ? (
                <span className="text-[#FF5713]">▶ assistir</span>
              ) : null}
            </div>
          </Link>
        ) : (
          <div className="az-card flex flex-col gap-2 p-5 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Pauta da Semana
            </p>
            <p className="text-sm text-zinc-700">
              A primeira pauta semanal sai em breve.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
