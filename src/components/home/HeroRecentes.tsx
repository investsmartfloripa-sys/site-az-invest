import Image from "next/image";
import Link from "next/link";
import type { PostCardData } from "@/components/common/PostCard";
import { formatPostCategoryLabel, getPostCategorySolidPillClasses } from "@/data/blog-categories";

export function HeroRecentes({ posts }: { posts: PostCardData[] }) {
  if (posts.length === 0) {
    return (
      <section className="space-y-4">
        <h1 className="text-4xl text-[#027DFC]">Artigos</h1>
        <p className="rounded-xl border border-[#132960]/20 bg-white p-4 text-sm text-zinc-600">
          Nenhuma postagem publicada ainda. Use a área restrita para publicar a primeira.
        </p>
      </section>
    );
  }

  const main = posts[0];
  const others = posts.slice(1, 3);

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-4xl text-[#027DFC]">Artigos</h1>
        <Link
          href="/blog"
          className="text-xs font-semibold text-[#132960] hover:underline whitespace-nowrap"
        >
          Ver todas
        </Link>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <article className="relative overflow-hidden rounded-2xl md:col-span-2">
          <Image
            src={main.image}
            alt={main.title}
            width={1024}
            height={666}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-black/10" />
          <div className="absolute bottom-0 left-0 p-4 text-white">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${getPostCategorySolidPillClasses(main.category)}`}
            >
              {formatPostCategoryLabel(main.category)}
            </span>
            <h2 className="mt-2 text-3xl">
              <Link href={`/blog/${main.slug}`}>{main.title}</Link>
            </h2>
            <p className="mt-1 text-xs">
              {main.authorSlug ? (
                <Link href={`/nosso-time/${main.authorSlug}`} className="hover:underline">
                  {main.authorName}
                </Link>
              ) : (
                main.authorName
              )}{" "}
              | {main.date}
            </p>
          </div>
        </article>
        <div className="space-y-3">
          {others.map((post) => (
            <article key={post.id} className="relative overflow-hidden rounded-2xl">
              <Image
                src={post.image}
                alt={post.title}
                width={1024}
                height={666}
                className="h-44 w-full object-cover md:h-[177px]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-black/10" />
              <div className="absolute bottom-0 left-0 p-3 text-white">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${getPostCategorySolidPillClasses(post.category)}`}
                >
                  {formatPostCategoryLabel(post.category)}
                </span>
                <h3 className="mt-1 text-2xl leading-tight">
                  <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                </h3>
                <p className="mt-1 text-[10px]">
                  {post.authorSlug ? (
                    <Link href={`/nosso-time/${post.authorSlug}`} className="hover:underline">
                      {post.authorName}
                    </Link>
                  ) : (
                    post.authorName
                  )}{" "}
                  | {post.date}
                </p>
              </div>
            </article>
          ))}
          {others.length === 0 ? (
            <article className="flex h-full min-h-44 items-center justify-center rounded-2xl border border-dashed border-[#132960]/30 bg-white text-sm text-zinc-500">
              Publique mais posts para preencher esse espaco.
            </article>
          ) : null}
        </div>
      </div>
    </section>
  );
}
