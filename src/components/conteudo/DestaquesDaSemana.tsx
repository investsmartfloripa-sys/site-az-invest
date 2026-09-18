import Image from "next/image";
import Link from "next/link";
import { formatDateBR, listBriefings } from "@/lib/cafe-com-mercado";
import { listDossies } from "@/lib/dossies";
import { listReleasesRecentes } from "@/lib/periodicos-releases";

/**
 * Bloco "Periódicos". Duas metades:
 *
 * - ESQUERDA: o último Café com Mercado (diário), com a capa da edição.
 * - DIREITA: os demais formatos empilhados — dossiê mensal, dossiê semanal e as
 *   divulgações do Publisher.
 *
 * Mensal e semanal ainda não são publicados no repo (as rotinas entregam HTML
 * local), então caem no estado vazio enquanto as pastas `content/dossie-mensal`
 * e `content/dossie-semanal` não existirem. As divulgações já leem dado real do
 * Blob. Nenhum card quebra a home se a fonte falhar — todos degradam para o
 * estado vazio.
 */

function Vazio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="az-card flex flex-col gap-1.5 p-4 md:p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        {titulo}
      </p>
      <p className="text-sm text-zinc-600">{texto}</p>
    </div>
  );
}

export async function DestaquesDaSemana() {
  const [cafes, mensais, semanais, releases] = await Promise.all([
    listBriefings(1),
    listDossies("mensal", 1),
    listDossies("semanal", 1),
    listReleasesRecentes(),
  ]);
  const cafe = cafes[0] ?? null;
  const mensal = mensais[0] ?? null;
  const semanal = semanais[0] ?? null;

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

      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
        {/* ── Metade esquerda: Café com Mercado ───────────────────────── */}
        {cafe ? (
          cafe.image ? (
            <Link
              href={`/cafe-com-mercado/${cafe.date}`}
              aria-label={cafe.title}
              className="az-card group block overflow-hidden p-0 transition hover:border-[#027DFC]/40"
            >
              <div className="relative aspect-[1200/630] w-full">
                <Image
                  src={cafe.image}
                  alt={cafe.imageAlt || cafe.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 400px"
                  className="object-cover"
                />
              </div>
            </Link>
          ) : (
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
          )
        ) : (
          <Vazio titulo="Café com Mercado" texto="Sem briefing publicado ainda." />
        )}

        {/* ── Metade direita: mensal, semanal e divulgações ───────────── */}
        <div className="flex flex-col gap-3">
          {/* Dossiê Mensal */}
          {mensal ? (
            <Link
              href={mensal.href}
              className="az-card group flex flex-col gap-1.5 p-4 transition hover:border-[#027DFC]/40 md:p-5"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#027DFC]">
                Dossiê Mensal · {mensal.periodo}
              </p>
              <h3 className="text-base font-semibold leading-snug text-[#132960] group-hover:text-[#027DFC]">
                {mensal.title}
              </h3>
              {mensal.description ? (
                <p className="line-clamp-2 text-sm text-zinc-700">{mensal.description}</p>
              ) : null}
            </Link>
          ) : (
            <Vazio
              titulo="Dossiê Mensal"
              texto="Visão consolidada do mês, com o mapa de projeções por casa. Ainda não publicado aqui."
            />
          )}

          {/* Dossiê Semanal */}
          {semanal ? (
            <Link
              href={semanal.href}
              className="az-card group flex flex-col gap-1.5 p-4 transition hover:border-[#027DFC]/40 md:p-5"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#027DFC]">
                Dossiê Semanal · {semanal.periodo}
              </p>
              <h3 className="text-base font-semibold leading-snug text-[#132960] group-hover:text-[#027DFC]">
                {semanal.title}
              </h3>
              {semanal.description ? (
                <p className="line-clamp-2 text-sm text-zinc-700">{semanal.description}</p>
              ) : null}
            </Link>
          ) : (
            <Vazio
              titulo="Dossiê Semanal"
              texto="O que mudou na semana, por região, com gráficos ao vivo. Ainda não publicado aqui."
            />
          )}

          {/* Divulgações — o que o Publisher gera a cada release */}
          {releases.length > 0 ? (
            <div className="az-card flex flex-col gap-2.5 p-4 md:p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#027DFC]">
                Divulgações
              </p>
              <ul className="flex flex-col gap-2">
                {releases.map((r) => (
                  <li key={r.indicador}>
                    <Link
                      href={r.href}
                      className="group flex items-baseline justify-between gap-3"
                    >
                      <span className="text-sm font-semibold text-[#132960] group-hover:text-[#027DFC]">
                        {r.label}
                        <span className="font-normal text-zinc-600"> · {r.periodo}</span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                        {r.totalGraficos} gráficos
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <Vazio
              titulo="Divulgações"
              texto="Gráficos de IPCA e IGP-M a cada divulgação. Nenhuma disponível no momento."
            />
          )}
        </div>
      </div>
    </section>
  );
}
