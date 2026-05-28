import Link from "next/link";

import type { FiiEditorialPost } from "@/lib/painel-fii";

const DUMMY_LIST: FiiEditorialPost[] = [
  {
    slug: "#",
    title: "Guia completo: por onde começar a investir em FIIs",
    excerpt: null,
    coverImage: null,
    authorName: "Equipe AZ Invest",
    createdAt: new Date().toISOString(),
  },
  {
    slug: "#",
    title: "DY ou ganho de capital? O trade-off central dos FIIs",
    excerpt: null,
    coverImage: null,
    authorName: "Equipe AZ Invest",
    createdAt: new Date().toISOString(),
  },
  {
    slug: "#",
    title: "FII de logística: entendendo o vetor de demanda industrial",
    excerpt: null,
    coverImage: null,
    authorName: "Equipe AZ Invest",
    createdAt: new Date().toISOString(),
  },
  {
    slug: "#",
    title: "FIIs de papel (CRI): o que olhar nos relatórios mensais",
    excerpt: null,
    coverImage: null,
    authorName: "Equipe AZ Invest",
    createdAt: new Date().toISOString(),
  },
  {
    slug: "#",
    title: "Vacância em FIIs de lajes corporativas: como interpretar",
    excerpt: null,
    coverImage: null,
    authorName: "Equipe AZ Invest",
    createdAt: new Date().toISOString(),
  },
];

type Props = {
  posts: FiiEditorialPost[];
};

export function FiiArtigosMaisLidos({ posts }: Props) {
  const items = posts.length > 0 ? posts : DUMMY_LIST;

  return (
    <section
      aria-label="Artigos mais lidos sobre FIIs"
      className="rounded-2xl border border-[#132960]/10 bg-white p-4 md:p-6"
    >
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Artigos mais lidos
      </h3>
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {items.slice(0, 5).map((p, i) => (
          <li key={p.slug + i} className="flex items-start gap-2">
            <span className="font-mono text-xs font-semibold text-[#027DFC] tabular-nums">
              {String(i + 1).padStart(2, "0")}.
            </span>
            <Link
              href={p.slug !== "#" ? `/blog/${p.slug}` : "#"}
              className="line-clamp-3 text-xs text-[#132960] transition hover:text-[#027DFC] hover:underline"
            >
              {p.title}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
