import Image from "next/image";
import Link from "next/link";

import { formatPostCategoryLabel, getPostCategorySolidPillClasses } from "@/data/blog-categories";

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
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function PostCard({ post }: { post: PostCardData }) {
  return (
    <article className="az-hover-lift flex h-full flex-col overflow-hidden rounded-2xl border border-[#132960]/15 bg-white shadow-sm hover:shadow-md">
      <Link href={`/blog/${post.slug}`} className="block">
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
      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="line-clamp-2 text-lg font-semibold text-[#132960]">
          <Link href={`/blog/${post.slug}`} className="hover:underline">
            {post.title}
          </Link>
        </h3>
        {post.excerpt ? (
          <p className="line-clamp-3 text-sm text-zinc-600">{post.excerpt}</p>
        ) : null}
        <div className="mt-auto flex items-center gap-2 pt-2">
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
