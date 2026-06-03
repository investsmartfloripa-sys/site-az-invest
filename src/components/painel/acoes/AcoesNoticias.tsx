import Image from "next/image";
import Link from "next/link";

import type { AcoesEditorialPost } from "@/lib/painel-acoes";

const FALLBACK_IMG =
  "/capa-padrao.svg";

type Props = {
  posts: AcoesEditorialPost[];
  title?: string;
};

export function AcoesNoticias({ posts, title = "Últimas notícias" }: Props) {
  if (posts.length === 0) return null;

  return (
    <section
      aria-label="Conteúdo sobre ações"
      className="rounded-2xl border border-[#132960]/10 bg-zinc-50/40 p-4 md:p-6"
    >
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</h3>
        <Link
          href="/blog?categoria=acoes"
          className="text-[11px] font-semibold text-[#027DFC] hover:underline"
        >
          Ver mais →
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {posts.slice(0, 4).map((p, i) => (
          <Link
            key={p.slug + i}
            href={`/blog/${p.slug}`}
            className="group flex flex-col overflow-hidden rounded-xl border border-[#132960]/10 bg-white transition hover:border-[#027DFC]/40 hover:shadow-sm"
          >
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-zinc-100">
              <Image
                src={p.coverImage || FALLBACK_IMG}
                alt={p.title}
                fill
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                className="object-cover transition group-hover:scale-105"
              />
            </div>
            <div className="flex-1 p-2.5">
              <p className="line-clamp-2 text-xs font-semibold text-[#132960]">{p.title}</p>
              {p.excerpt ? (
                <p className="mt-1 line-clamp-2 text-[10px] text-zinc-500">{p.excerpt}</p>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
