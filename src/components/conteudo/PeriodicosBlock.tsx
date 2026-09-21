import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { PostCardData } from "@/components/common/PostCard";
import { BOLETIM_BASE_PATH, BOLETIM_KICKER, BOLETIM_SECTION_LABEL } from "@/data/blog-categories";
import { listBriefings, type Briefing } from "@/lib/cafe-com-mercado";
import { listDossies, type Dossie } from "@/lib/dossies";
import { periodoLegivel } from "@/lib/periodicos-releases";
import { findPosts, mapPost } from "@/lib/posts";
import { INDICADOR_LABEL, PAINEL_PATH, type ChartIndicador } from "@/lib/publisher/chart-catalog";
import { boletinsWhere } from "@/lib/workspace/posts";

/**
 * Bloco "Periódicos" — os formatos recorrentes da casa numa anatomia só de card:
 *
 * - Café com Mercado (diário, Markdown em `content/cafe-com-mercado`);
 * - Dossiês macro mensal e semanal (Markdown em `content/dossie-*`);
 * - Boletins — os posts que o Publisher grava a cada divulgação de indicador
 *   (categoria própria no banco; nunca se misturam aos artigos).
 *
 * `variant="home"` monta uma grade compacta com o último de cada formato;
 * `variant="hub"` (página /conteudo) abre três grupos com subtítulo e arquivo.
 *
 * Formato sem conteúdo simplesmente não aparece — nada de "ainda não publicado"
 * em página pública. Cada fonte falha em silêncio (→ []) porque a home não pode
 * quebrar por causa de um bloco secundário; se todas vierem vazias, o bloco
 * inteiro some.
 */

/** Mesmo sistema de título de seção de HeroRecentes: navy com sublinhado curto azure. */
const SECTION_TITLE_CLASSES =
  "text-3xl text-[#132960] after:mt-2 after:block after:h-1 after:w-12 after:rounded-full after:bg-[#027DFC] md:text-4xl";

const CARD_CLASSES = "az-card flex flex-col gap-1.5 p-4 md:p-5 transition hover:border-[#027DFC]/40";
const KICKER_CLASSES = "text-[11px] font-semibold uppercase tracking-wider text-[#027DFC]";
const TITLE_CLASSES =
  "text-base font-semibold leading-snug text-[#132960] line-clamp-2 group-hover:text-[#027DFC]";
const DESCRIPTION_CLASSES = "line-clamp-2 text-sm text-zinc-700";
const CARD_LINK_CLASSES = "text-sm font-semibold text-[#027DFC]";
const SECTION_LINK_CLASSES = "whitespace-nowrap text-sm font-semibold text-[#027DFC] hover:underline";
/** "Ler boletim →" — deriva de BOLETIM_KICKER porque o nome do formato é provisório. */
const LER_BOLETIM = `Ler ${BOLETIM_KICKER.toLowerCase()} →`;

/** Colunas da grade (md+) conforme quantos formatos têm conteúdo. */
const GRID_COLS: Record<number, string> = {
  1: "md:grid-cols-2",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
};

/** Qualquer falha de fonte vira lista vazia — o bloco degrada, a página não. */
async function seguro<T>(rotulo: string, carregar: () => Promise<T[]>): Promise<T[]> {
  try {
    return await carregar();
  } catch (err) {
    console.error(`[PeriodicosBlock] ${rotulo} falhou`, err);
    return [];
  }
}

/** "sexta-feira" + "2026-09-18" → "sexta, 18/09/2026". */
function kickerCafe(b: Briefing): string {
  const dia = b.weekday.replace(/-feira$/, "");
  const data = b.date.split("-").reverse().join("/");
  return `Café com Mercado · ${dia ? `${dia}, ` : ""}${data}`;
}

/** Indicador da divulgação, pelo prefixo do slug que o Publisher grava. */
function indicadorDoSlug(slug: string): ChartIndicador | null {
  if (slug.startsWith("ipca-")) return "ipca";
  if (slug.startsWith("igpm-")) return "igpm";
  return null;
}

/**
 * "Boletim IPCA · julho de 2026". O mês de referência vem do slug
 * (`ipca-2026-07`); sem esse padrão, cai na data de publicação do post.
 */
function kickerBoletim(post: PostCardData, ind: ChartIndicador | null): string {
  const rotulo = ind ? `${BOLETIM_KICKER} ${INDICADOR_LABEL[ind]}` : BOLETIM_KICKER;
  const mesRef = /-(\d{4}-\d{2})(?:-|$)/.exec(post.slug)?.[1];
  return `${rotulo} · ${mesRef ? periodoLegivel(mesRef) : post.date}`;
}

type PeriodicoCardProps = {
  href: string;
  kicker: string;
  /** Omitido no Café com capa: a manchete já está gravada na arte. */
  title?: string;
  description?: string;
  linkLabel: string;
  /** Capa 1200×630 no topo do card (Café). */
  cover?: { src: string; alt: string };
};

/** A anatomia única: kicker → título → descrição → link, tudo dentro de um <Link>. */
function PeriodicoCard({ href, kicker, title, description, linkLabel, cover }: PeriodicoCardProps) {
  return (
    <Link href={href} className={`${CARD_CLASSES} group`}>
      {cover ? (
        <div className="relative mb-1.5 aspect-[1200/630] w-full overflow-hidden rounded-xl">
          <Image
            src={cover.src}
            alt={cover.alt}
            fill
            sizes="(max-width: 768px) 100vw, 400px"
            className="object-cover"
          />
        </div>
      ) : null}
      <p className={KICKER_CLASSES}>{kicker}</p>
      {title ? <h3 className={TITLE_CLASSES}>{title}</h3> : null}
      {description ? <p className={DESCRIPTION_CLASSES}>{description}</p> : null}
      <p className={`mt-auto pt-1 ${CARD_LINK_CLASSES}`}>{linkLabel}</p>
    </Link>
  );
}

function CafeCard({ briefing }: { briefing: Briefing }) {
  return (
    <PeriodicoCard
      href={`/cafe-com-mercado/${briefing.date}`}
      kicker={kickerCafe(briefing)}
      title={briefing.image ? undefined : briefing.title}
      description={briefing.description || undefined}
      linkLabel="Ler briefing →"
      cover={briefing.image ? { src: briefing.image, alt: briefing.imageAlt || briefing.title } : undefined}
    />
  );
}

function DossieCard({ dossie }: { dossie: Dossie }) {
  return (
    <PeriodicoCard
      href={dossie.href}
      kicker={`Dossiê ${dossie.tipo === "mensal" ? "Mensal" : "Semanal"} · ${dossie.periodo}`}
      title={dossie.title}
      description={dossie.description || undefined}
      linkLabel="Ler dossiê →"
    />
  );
}

/**
 * Boletim tem DOIS destinos (o post e o painel ao vivo do indicador), então o
 * card é um <article> com dois <Link> — nunca <a> dentro de <a>.
 */
function BoletimCard({ post }: { post: PostCardData }) {
  const ind = indicadorDoSlug(post.slug);
  return (
    <article className={CARD_CLASSES}>
      <p className={KICKER_CLASSES}>{kickerBoletim(post, ind)}</p>
      <h3 className={TITLE_CLASSES}>
        <Link href={post.href} className="hover:text-[#027DFC]">
          {post.title}
        </Link>
      </h3>
      {post.excerpt ? <p className={DESCRIPTION_CLASSES}>{post.excerpt}</p> : null}
      <div className="mt-auto flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 pt-1">
        <Link href={post.href} className={`${CARD_LINK_CLASSES} hover:underline`}>
          {LER_BOLETIM}
        </Link>
        {ind ? (
          <Link
            href={PAINEL_PATH[ind]}
            className="text-xs font-semibold text-[#132960]/60 hover:text-[#027DFC]"
          >
            Painel do {INDICADOR_LABEL[ind]} ↗
          </Link>
        ) : null}
      </div>
    </article>
  );
}

/** Grupo do hub: subtítulo + link para o arquivo (quando existe) + cards empilhados. */
function Grupo({
  titulo,
  arquivoHref,
  children,
}: {
  titulo: string;
  arquivoHref?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-lg font-semibold text-[#132960]">{titulo}</h3>
        {arquivoHref ? (
          <Link href={arquivoHref} className={SECTION_LINK_CLASSES}>
            Ver arquivo →
          </Link>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export async function PeriodicosBlock({ variant }: { variant: "home" | "hub" }) {
  const home = variant === "home";
  const [cafes, mensais, semanais, boletins] = await Promise.all([
    seguro("listBriefings", () => listBriefings(home ? 1 : 3)),
    seguro("listDossies(mensal)", () => listDossies("mensal", home ? 1 : 2)),
    seguro("listDossies(semanal)", () => listDossies("semanal", home ? 1 : 2)),
    seguro("findPosts(boletins)", () =>
      findPosts({
        where: boletinsWhere,
        orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
        take: home ? 2 : 4,
      }).then((posts) => posts.map(mapPost)),
    ),
  ]);

  // Dossiês juntos numa coluna só: mensal em cima, semanal embaixo.
  const dossies: Dossie[] = [...mensais, ...semanais];

  if (cafes.length === 0 && dossies.length === 0 && boletins.length === 0) {
    return null;
  }

  // Só entra coluna de formato que tem conteúdo; a grade se ajusta ao total.
  const colunas: ReactNode[] = [];
  if (home) {
    if (cafes.length > 0) {
      colunas.push(<CafeCard key="cafe" briefing={cafes[0]} />);
    }
    if (dossies.length > 0) {
      colunas.push(
        <div key="dossies" className="flex flex-col gap-3">
          {dossies.map((d) => (
            <DossieCard key={`${d.tipo}-${d.slug}`} dossie={d} />
          ))}
        </div>,
      );
    }
    if (boletins.length > 0) {
      colunas.push(
        <div key="boletins" className="flex flex-col gap-3">
          {boletins.map((p) => (
            <BoletimCard key={p.id} post={p} />
          ))}
        </div>,
      );
    }
  } else {
    if (cafes.length > 0) {
      colunas.push(
        <Grupo key="cafe" titulo="Café com Mercado" arquivoHref="/cafe-com-mercado">
          {cafes.map((b) => (
            <CafeCard key={b.date} briefing={b} />
          ))}
        </Grupo>,
      );
    }
    if (dossies.length > 0) {
      colunas.push(
        <Grupo key="dossies" titulo="Dossiês">
          {dossies.map((d) => (
            <DossieCard key={`${d.tipo}-${d.slug}`} dossie={d} />
          ))}
        </Grupo>,
      );
    }
    if (boletins.length > 0) {
      colunas.push(
        <Grupo key="boletins" titulo={BOLETIM_SECTION_LABEL} arquivoHref={BOLETIM_BASE_PATH}>
          {boletins.map((p) => (
            <BoletimCard key={p.id} post={p} />
          ))}
        </Grupo>,
      );
    }
  }

  return (
    <section id="periodicos" className="scroll-mt-24 space-y-4">
      {/* h2 em Michroma é largo: com flex-wrap o link cai para a linha de baixo no celular. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className={SECTION_TITLE_CLASSES}>Periódicos</h2>
        {home ? (
          <Link href="/conteudo" className={SECTION_LINK_CLASSES}>
            Ver todo o conteúdo →
          </Link>
        ) : null}
      </div>
      <div className={`grid grid-cols-1 items-start gap-4 ${GRID_COLS[colunas.length]}`}>
        {colunas}
      </div>
    </section>
  );
}
