import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { isReleaseCover, type PostCardData } from "@/components/common/PostCard";
import { BOLETIM_BASE_PATH, BOLETIM_KICKER, BOLETIM_SECTION_LABEL } from "@/data/blog-categories";
import { listBriefings, type Briefing } from "@/lib/cafe-com-mercado";
import { listDossies, type Dossie } from "@/lib/dossies";
import { periodoLegivel } from "@/lib/periodicos-releases";
import { findPosts, mapPost } from "@/lib/posts";
import { INDICADOR_LABEL, PAINEL_PATH, type ChartIndicador } from "@/lib/publisher/chart-catalog";
import { boletinsWhere } from "@/lib/workspace/posts";

/**
 * Bloco "Periódicos" — os formatos recorrentes da casa numa anatomia só de card:
 * capa sangrada no topo → kicker → descrição → link.
 *
 * - Café com Mercado (diário, Markdown em `content/cafe-com-mercado`);
 * - Dossiês macro mensal e semanal (Markdown em `content/dossie-*`);
 * - Boletins — os posts que o Publisher grava a cada divulgação de indicador
 *   (categoria própria no banco; nunca se misturam aos artigos).
 *
 * Capa de Café e de boletim já traz a manchete gravada na arte, então o card
 * não repete o título. Formato sem arte (dossiê) ganha uma capa tipográfica na
 * mesma proporção — é isso que mantém todos os cards da linha com a mesma altura.
 *
 * `variant="home"` monta uma linha só, um card por formato (até 4 colunas);
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

/** `flex-col` no card + `mt-auto` no link: rodapés alinhados entre cards da mesma linha. */
const CARD_CLASSES = "az-card group flex flex-col overflow-hidden transition hover:border-[#027DFC]/40";
const CARD_BODY_CLASSES = "flex flex-1 flex-col gap-2 p-4 md:p-5";
/** Proporção das artes de release (1600×840) e da capa do Café (1200×630). */
const COVER_CLASSES = "relative aspect-[40/21] w-full overflow-hidden bg-[#132960]";
const COVER_SIZES = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw";
const KICKER_CLASSES = "text-xs font-semibold uppercase tracking-wider text-[#027DFC]";
const TITLE_CLASSES =
  "text-lg font-semibold leading-snug text-[#132960] line-clamp-2 group-hover:text-[#027DFC]";
const DESCRIPTION_CLASSES = "line-clamp-3 text-base leading-relaxed text-zinc-700";
const CARD_LINK_CLASSES = "text-base font-semibold text-[#027DFC]";
const SECTION_LINK_CLASSES = "whitespace-nowrap text-sm font-semibold text-[#027DFC] hover:underline";
/** "Ler boletim →" — deriva de BOLETIM_KICKER porque o nome do formato é provisório. */
const LER_BOLETIM = `Ler ${BOLETIM_KICKER.toLowerCase()} →`;

/** Home: colunas conforme quantos cards há, para a linha fechar sem órfão. */
const HOME_GRID_COLS: Record<number, string> = {
  1: "sm:grid-cols-2",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

/** Hub: colunas conforme quantos grupos (formatos) têm conteúdo. */
const HUB_GRID_COLS: Record<number, string> = {
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

/**
 * "2026-09-18" → "Café com Mercado · 18/09/2026". Sem o dia da semana: a arte da
 * capa já o traz, e com ele o kicker vira duas linhas na coluna de 4 — desalinha
 * a descrição com a dos cards vizinhos.
 */
function kickerCafe(b: Briefing): string {
  return `Café com Mercado · ${b.date.split("-").reverse().join("/")}`;
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

function CapaImagem({ src, alt }: { src: string; alt: string }) {
  return (
    <div className={COVER_CLASSES}>
      <Image src={src} alt={alt} fill sizes={COVER_SIZES} className="object-cover" />
    </div>
  );
}

/**
 * Capa para formato sem arte: painel navy com o título em branco, na mesma
 * proporção das capas de imagem. Barra azure no topo ecoa o cabeçalho das artes.
 */
function CapaTipografica({ titulo }: { titulo: string }) {
  return (
    <div className={`${COVER_CLASSES} bg-gradient-to-br from-[#132960] to-[#0B1B45]`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(2,125,252,0.35),transparent_60%)]" />
      <div className="absolute inset-0 flex flex-col p-4 md:p-5">
        <span className="mb-3 block h-1 w-12 rounded-full bg-[#027DFC]" aria-hidden />
        <h3 className="line-clamp-3 text-xl font-bold leading-snug text-white">{titulo}</h3>
      </div>
    </div>
  );
}

type PeriodicoCardProps = {
  href: string;
  kicker: string;
  title: string;
  description?: string;
  linkLabel: string;
  /** Capa com a manchete gravada na arte; sem ela, o título vai na capa tipográfica. */
  cover?: { src: string; alt: string };
};

/** A anatomia única: capa → kicker → descrição → link, tudo dentro de um <Link>. */
function PeriodicoCard({ href, kicker, title, description, linkLabel, cover }: PeriodicoCardProps) {
  return (
    <Link href={href} className={CARD_CLASSES}>
      {cover ? <CapaImagem src={cover.src} alt={cover.alt} /> : <CapaTipografica titulo={title} />}
      <div className={CARD_BODY_CLASSES}>
        <p className={KICKER_CLASSES}>{kicker}</p>
        {description ? <p className={DESCRIPTION_CLASSES}>{description}</p> : null}
        <p className={`mt-auto pt-1 ${CARD_LINK_CLASSES}`}>{linkLabel}</p>
      </div>
    </Link>
  );
}

function CafeCard({ briefing }: { briefing: Briefing }) {
  return (
    <PeriodicoCard
      href={`/cafe-com-mercado/${briefing.date}`}
      kicker={kickerCafe(briefing)}
      title={briefing.title}
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
 * card é um <article> com mais de um <Link> — nunca <a> dentro de <a>.
 */
function BoletimCard({ post }: { post: PostCardData }) {
  const ind = indicadorDoSlug(post.slug);
  const release = isReleaseCover(post);
  return (
    <article className={CARD_CLASSES}>
      <Link href={post.href} aria-label={post.title} className="block">
        <CapaImagem src={post.image} alt={post.title} />
      </Link>
      <div className={CARD_BODY_CLASSES}>
        <p className={KICKER_CLASSES}>{kickerBoletim(post, ind)}</p>
        {release ? null : (
          <h3 className={TITLE_CLASSES}>
            <Link href={post.href}>{post.title}</Link>
          </h3>
        )}
        {post.excerpt ? <p className={DESCRIPTION_CLASSES}>{post.excerpt}</p> : null}
        <div className="mt-auto flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 pt-1">
          <Link href={post.href} className={`${CARD_LINK_CLASSES} hover:underline`}>
            {LER_BOLETIM}
          </Link>
          {ind ? (
            <Link
              href={PAINEL_PATH[ind]}
              className="text-sm font-semibold text-[#132960]/60 hover:text-[#027DFC]"
            >
              Painel do {INDICADOR_LABEL[ind]} ↗
            </Link>
          ) : null}
        </div>
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

  if (cafes.length === 0 && mensais.length === 0 && semanais.length === 0 && boletins.length === 0) {
    return null;
  }

  let grade: ReactNode;
  if (home) {
    // Uma linha só, um card por formato: Café + o dossiê mais recente (mensal ou
    // semanal) + os dois últimos boletins. Cap de 4 para a linha nunca quebrar.
    const dossie = [...mensais, ...semanais].sort((a, b) =>
      b.publishedAt.localeCompare(a.publishedAt),
    )[0];
    const cards: ReactNode[] = [];
    if (cafes.length > 0) cards.push(<CafeCard key="cafe" briefing={cafes[0]} />);
    if (dossie) cards.push(<DossieCard key={`${dossie.tipo}-${dossie.slug}`} dossie={dossie} />);
    for (const p of boletins) cards.push(<BoletimCard key={p.id} post={p} />);
    grade = (
      <div className={`grid grid-cols-1 gap-4 ${HOME_GRID_COLS[Math.min(cards.length, 4)]}`}>
        {cards}
      </div>
    );
  } else {
    // Dossiês juntos num grupo só: mensal em cima, semanal embaixo.
    const dossies: Dossie[] = [...mensais, ...semanais];
    const grupos: ReactNode[] = [];
    if (cafes.length > 0) {
      grupos.push(
        <Grupo key="cafe" titulo="Café com Mercado" arquivoHref="/cafe-com-mercado">
          {cafes.map((b) => (
            <CafeCard key={b.date} briefing={b} />
          ))}
        </Grupo>,
      );
    }
    if (dossies.length > 0) {
      grupos.push(
        <Grupo key="dossies" titulo="Dossiês">
          {dossies.map((d) => (
            <DossieCard key={`${d.tipo}-${d.slug}`} dossie={d} />
          ))}
        </Grupo>,
      );
    }
    if (boletins.length > 0) {
      grupos.push(
        <Grupo key="boletins" titulo={BOLETIM_SECTION_LABEL} arquivoHref={BOLETIM_BASE_PATH}>
          {boletins.map((p) => (
            <BoletimCard key={p.id} post={p} />
          ))}
        </Grupo>,
      );
    }
    grade = (
      <div className={`grid grid-cols-1 items-start gap-4 ${HUB_GRID_COLS[grupos.length]}`}>
        {grupos}
      </div>
    );
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
      {grade}
    </section>
  );
}
