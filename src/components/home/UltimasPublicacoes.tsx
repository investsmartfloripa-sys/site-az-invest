import Image from "next/image";
import Link from "next/link";
import type { PostCardData } from "@/components/common/PostCard";
import { formatPostCategoryLabel, getPostCategorySoftPillClasses } from "@/data/blog-categories";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function UltimasPublicacoes({ posts }: { posts: PostCardData[] }) {
  if (posts.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-4xl text-[#027DFC]">Últimas publicações</h2>
        <Link
          href="/blog"
          className="text-xs font-semibold text-[#132960] hover:underline whitespace-nowrap"
        >
          Ver todas
        </Link>
      </div>
      <ul className="grid gap-4">
        {posts.map((post) => (
          <li
            key={post.id}
            className="grid gap-3 overflow-hidden rounded-2xl border border-[#132960]/15 bg-white p-3 md:grid-cols-[200px_1fr] md:items-center"
          >
            <Link
              href={`/blog/${post.slug}`}
              className="relative block aspect-[4/3] overflow-hidden rounded-xl md:aspect-auto md:h-32"
            >
              <Image
                src={post.image}
                alt={post.title}
                fill
                sizes="(min-width: 768px) 200px, 100vw"
                className="object-cover"
              />
            </Link>
            <div className="space-y-2">
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${getPostCategorySoftPillClasses(post.category)}`}
              >
                {formatPostCategoryLabel(post.category)}
              </span>
              <h3 className="text-xl font-semibold text-[#132960]">
                <Link href={`/blog/${post.slug}`} className="hover:underline">
                  {post.title}
                </Link>
              </h3>
              {post.excerpt ? (
                <p className="line-clamp-2 text-sm text-zinc-600">{post.excerpt}</p>
              ) : null}
              <div className="flex items-center gap-2 pt-1">
                <div className="relative h-7 w-7 flex-none overflow-hidden rounded-full bg-[#132960]">
                  {post.authorPhoto ? (
                    <Image
                      src={post.authorPhoto}
                      alt={post.authorName}
                      fill
                      sizes="28px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-white">
                      {initials(post.authorName)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500">
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
                  | {post.date}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
