import Image from "next/image";
import Link from "next/link";

import { BOLETIM_BASE_PATH, formatPostCategoryLabel, getPostCategorySolidPillClasses } from "@/data/blog-categories";
import { rotuloBoletim } from "@/lib/boletim-rotulo";

export type PostCardData = {
  id: number;
  title: string;
  slug: string;
  category: string;
  authorName: string;
  authorSlug?: string | null;
  authorPhoto?: string | null;
  date: string;
  image: string;
  excerpt?: string | null;
  /** URL pública (`/blog/…` ou `/boletins/…`) — vem de `postPath`. */
  href: string;
};

/**
 * Capas de release (IPCA, IGP-M…) já trazem a manchete gravada na arte: quem
 * mostra a capa não sobrepõe nem repete o título.
 */
export function isReleaseCover(post: Pick<PostCardData, "image">): boolean {
  return post.image.includes("/releases/");
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Boletim nas listas é cartão só de texto, como na home: as capas automáticas (tela
 * recortada do Painel, calendário genérico) pareciam imagem quebrada, e a etiqueta
 * "BOLETIM" não dizia o indicador (revisão de 12/11/2026).
 */
function BoletimTextoCard({ post }: { post: PostCardData }) {
  return (
    <article className="az-hover-lift relative flex flex-col gap-2 self-start rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm hover:shadow-md md:p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#027DFC]">{rotuloBoletim(post)}</p>
      <h3 className="line-clamp-3 text-lg font-semibold leading-snug text-[#132960]">
        <Link href={post.href} className="after:absolute after:inset-0 after:content-[''] hover:underline">
          {post.title}
        </Link>
      </h3>
      {post.excerpt ? <p className="line-clamp-3 text-sm leading-relaxed text-zinc-600">{post.excerpt}</p> : null}
      <p className="mt-1 text-sm font-semibold text-[#027DFC]">Ler boletim →</p>
    </article>
  );
}

export function PostCard({ post }: { post: PostCardData }) {
  if (post.href.startsWith(`${BOLETIM_BASE_PATH}/`)) return <BoletimTextoCard post={post} />;
  return (
    <article className="az-hover-lift flex flex-col self-start overflow-hidden rounded-2xl border border-[#132960]/15 bg-white shadow-sm hover:shadow-md">
      <Link href={post.href} className="block">
        <div className="relative aspect-[16/9] w-full overflow-hidden">
          <Image
            src={post.image}
            alt={post.title}
            fill
            sizes="(min-width: 768px) 33vw, 100vw"
            className="object-cover"
          />
          <span
            className={`absolute right-2 top-2 rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${getPostCategorySolidPillClasses(post.category)}`}
          >
            {formatPostCategoryLabel(post.category)}
          </span>
        </div>
      </Link>
      <div className="flex flex-col gap-2 p-4">
        {/* min-h reserva sempre 2 linhas (text-lg ≈ 1.75rem/linha) → parte branca
            do card com altura padronizada, independente do tamanho do título. */}
        <h3 className="line-clamp-2 min-h-[3.5rem] text-lg font-semibold text-[#132960]">
          <Link href={post.href} className="hover:underline">
            {post.title}
          </Link>
        </h3>
        <div className="flex items-center gap-2">
          <div className="relative h-8 w-8 flex-none overflow-hidden rounded-full bg-[#132960]">
            {post.authorPhoto ? (
              <Image
                src={post.authorPhoto}
                alt={post.authorName}
                fill
                sizes="32px"
                className="object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-white">
                {initials(post.authorName)}
              </span>
            )}
          </div>
          <div className="text-xs text-zinc-500">
            {post.authorSlug ? (
              <Link
                href={`/nosso-time/${post.authorSlug}`}
                className="font-semibold text-[#132960] hover:underline"
              >
                {post.authorName}
              </Link>
            ) : (
              <span className="font-semibold text-[#132960]">{post.authorName}</span>
            )}{" "}
            <span>| {post.date}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
