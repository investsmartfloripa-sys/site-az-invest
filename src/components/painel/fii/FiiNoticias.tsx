import Image from "next/image";
import Link from "next/link";

import type { FiiEditorialPost } from "@/lib/painel-fii";

const DUMMY_FALLBACK_IMG =
  "https://investimentosdeaz.com.br/wp-content/uploads/2026/03/Seguros-1024x666.png";

// Dummies usados quando o blog ainda não tem nenhum post categorizado como FII.
// Permite visualizar o layout sem depender de conteúdo. Some assim que houver
// posts reais com `category` contendo "fii" / "imobili" / "fundos-imobiliarios".
const DUMMY_POSTS: FiiEditorialPost[] = [
  {
    slug: "#",
    title: "FIIs ainda sem cobertura editorial — exemplo de manchete",
    excerpt: "Quando o blog publicar artigos sobre FIIs, eles aparecem aqui automaticamente.",
    coverImage: null,
    authorName: "Equipe AZ Invest",
    createdAt: new Date().toISOString(),
  },
  {
    slug: "#",
    title: "IFIX e o ciclo de juros — leitura sugerida",
    excerpt: "Conteúdo de placeholder até integração do blog com a tag de FIIs.",
    coverImage: null,
    authorName: "Equipe AZ Invest",
    createdAt: new Date().toISOString(),
  },
  {
    slug: "#",
    title: "FIIs de tijolo vs FIIs de papel: quando cada um performa",
    excerpt: "Placeholder editorial — substitua publicando um post no blog com categoria FII.",
    coverImage: null,
    authorName: "Equipe AZ Invest",
    createdAt: new Date().toISOString(),
  },
  {
    slug: "#",
    title: "Como ler a renda recorrente de um FII (DY 12m)",
    excerpt: "Placeholder editorial — virá do blog assim que houver cobertura.",
    coverImage: null,
    authorName: "Equipe AZ Invest",
    createdAt: new Date().toISOString(),
  },
];

type Props = {
  posts: FiiEditorialPost[];
  /** Quando `false` (padrão), esconde o bloco se não houver posts reais.
   *  Pode passar `true` em dev pra ver o layout com dummies. */
  showDummies?: boolean;
};

export function FiiNoticias({ posts, showDummies = false }: Props) {
  if (posts.length === 0 && !showDummies) return null;
  const items = posts.length > 0 ? posts : DUMMY_POSTS;
  const showingDummies = posts.length === 0;

  return (
    <section
      aria-label="Últimas notícias sobre FIIs"
      className="rounded-2xl border border-[#132960]/10 bg-zinc-50/40 p-4 md:p-6"
    >
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Últimas notícias
        </h3>
        <Link
          href="/blog?categoria=fundos-imobiliarios"
          className="text-[11px] font-semibold text-[#027DFC] hover:underline"
        >
          Ver mais →
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.slice(0, 4).map((p, i) => (
          <Link
            key={p.slug + i}
            href={p.slug !== "#" ? `/blog/${p.slug}` : "#"}
            className="group flex flex-col overflow-hidden rounded-xl border border-[#132960]/10 bg-white transition hover:border-[#027DFC]/40 hover:shadow-sm"
          >
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-zinc-100">
              <Image
                src={p.coverImage || DUMMY_FALLBACK_IMG}
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

      {showingDummies ? (
        <p className="mt-3 text-[10px] italic text-zinc-400">
          Exibindo placeholders — nenhum post do blog ainda tem categoria contendo “fii”,
          “imobili” ou “fundos-imobiliarios”. Publique um post com essa categoria pra ele aparecer
          aqui automaticamente.
        </p>
      ) : null}
    </section>
  );
}
