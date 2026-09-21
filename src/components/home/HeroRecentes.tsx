import Image from "next/image";
import Link from "next/link";
import type { PostCardData } from "@/components/common/PostCard";
import { formatPostCategoryLabel, getPostCategorySolidPillClasses } from "@/data/blog-categories";

/** Título de seção da home: navy com sublinhado curto azure. */
const SECTION_TITLE_CLASSES =
  "text-3xl text-[#132960] after:mt-2 after:block after:h-1 after:w-12 after:rounded-full after:bg-[#027DFC] md:text-4xl";

/** Overlay navy sobre a capa — peso embaixo, onde fica o texto; não intercepta o clique na imagem. */
const COVER_OVERLAY_CLASSES =
  "pointer-events-none absolute inset-0 bg-gradient-to-t from-[#132960]/90 via-[#132960]/45 via-55% to-[#132960]/0";

/** Pill de categoria sobre o overlay: anel branco para não sumir no navy. */
const PILL_CLASSES = "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ring-white/50";

/**
 * Capas de release (IPCA, IGP-M…) já trazem a manchete gravada na arte, no cabeçalho
 * da imagem: o card mostra só a capa, sem sobrepor outro título.
 */
function isReleaseCover(post: PostCardData): boolean {
  return post.image.includes("/releases/");
}

export function HeroRecentes({ posts }: { posts: PostCardData[] }) {
  if (posts.length === 0) {
    return (
      <section className="space-y-4">
        <h1 className={SECTION_TITLE_CLASSES}>Artigos</h1>
        <p className="rounded-xl border border-[#132960]/20 bg-white p-4 text-sm text-zinc-600">
          Nenhuma postagem publicada ainda. Use a área restrita para publicar a primeira.
        </p>
      </section>
    );
  }

  const main = posts[0];
  const others = posts.slice(1, 4);
  const mainIsRelease = isReleaseCover(main);

  return (
    <section className="az-reveal space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className={SECTION_TITLE_CLASSES}>Artigos</h1>
        <Link href="/blog" className="whitespace-nowrap text-sm font-semibold text-[#027DFC] hover:underline">
          Ver todas
        </Link>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {/*
          Destaque: abaixo de md empilha (capa em cima, texto em card branco embaixo) para o
          título não ser cortado; de md para cima volta ao layout de capa cheia + overlay + texto
          branco absoluto. Mesmo JSX, só classes responsivas.
        */}
        <article className="relative flex flex-col overflow-hidden rounded-2xl border border-[#132960]/10 bg-white shadow-sm md:col-span-2 md:block md:border-0 md:bg-transparent md:shadow-none">
          <Link
            href={main.href}
            aria-label={main.title}
            className="relative block aspect-[16/10] w-full overflow-hidden md:aspect-auto md:h-full"
          >
            <Image
              src={main.image}
              alt={main.title}
              width={1024}
              height={666}
              priority
              sizes="(min-width: 768px) 66vw, 100vw"
              className={`h-full w-full object-cover ${mainIsRelease ? "object-top" : ""}`}
            />
            {mainIsRelease ? <span className="sr-only">{main.title}</span> : null}
          </Link>
          {mainIsRelease ? null : (
            <>
              <div className={`hidden md:block ${COVER_OVERLAY_CLASSES}`} />
              <div className="pointer-events-none p-4 md:absolute md:bottom-0 md:left-0 md:text-white">
                <span className={`${PILL_CLASSES} ${getPostCategorySolidPillClasses(main.category)}`}>
                  {formatPostCategoryLabel(main.category)}
                </span>
                <h2 className="mt-2 text-xl leading-snug text-[#132960] md:text-3xl md:text-white">
                  <Link href={main.href} className="pointer-events-auto">{main.title}</Link>
                </h2>
                <p className="mt-1 text-xs text-zinc-600 md:text-white">
                  {main.authorSlug ? (
                    <Link href={`/nosso-time/${main.authorSlug}`} className="pointer-events-auto hover:underline">
                      {main.authorName}
                    </Link>
                  ) : (
                    main.authorName
                  )}{" "}
                  | {main.date}
                </p>
              </div>
            </>
          )}
        </article>
        {/* Coluna direita: cards com flex-1 — esticam para preencher exatamente a altura do destaque. */}
        <div className="flex flex-col gap-3">
          {others.map((post) => {
            const release = isReleaseCover(post);
            return (
              <article key={post.id} className="relative min-h-36 flex-1 overflow-hidden rounded-2xl">
                <Link href={post.href} aria-label={post.title} className="absolute inset-0 block">
                  <Image
                    src={post.image}
                    alt={post.title}
                    fill
                    sizes="(min-width: 768px) 33vw, 100vw"
                    className={`object-cover ${release ? "object-top" : ""}`}
                  />
                  {release ? <span className="sr-only">{post.title}</span> : null}
                </Link>
                {release ? null : (
                  <>
                    <div className={COVER_OVERLAY_CLASSES} />
                    <div className="pointer-events-none absolute bottom-0 left-0 p-3 text-white">
                      <span className={`${PILL_CLASSES} ${getPostCategorySolidPillClasses(post.category)}`}>
                        {formatPostCategoryLabel(post.category)}
                      </span>
                      <h3 className="mt-1 text-lg leading-tight md:text-xl">
                        <Link href={post.href} className="pointer-events-auto">{post.title}</Link>
                      </h3>
                      <p className="mt-1 text-[10px]">
                        {post.authorSlug ? (
                          <Link href={`/nosso-time/${post.authorSlug}`} className="pointer-events-auto hover:underline">
                            {post.authorName}
                          </Link>
                        ) : (
                          post.authorName
                        )}{" "}
                        | {post.date}
                      </p>
                    </div>
                  </>
                )}
              </article>
            );
          })}
          {others.length === 0 ? (
            <article className="flex h-full min-h-44 items-center justify-center rounded-2xl border border-dashed border-[#132960]/30 bg-white text-sm text-zinc-500">
              Publique mais posts para preencher esse espaço.
            </article>
          ) : null}
        </div>
      </div>
    </section>
  );
}
