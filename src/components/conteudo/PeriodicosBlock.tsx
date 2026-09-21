import Image from "next/image";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { isReleaseCover, type PostCardData } from "@/components/common/PostCard";
import { BOLETIM_BASE_PATH, BOLETIM_KICKER, BOLETIM_SECTION_LABEL } from "@/data/blog-categories";
import { listBriefings, type Briefing } from "@/lib/cafe-com-mercado";
import { listDossies, type Dossie } from "@/lib/dossies";
import { periodoLegivel } from "@/lib/periodicos-releases";
import { findPosts, mapPost } from "@/lib/posts";
import { INDICADOR_LABEL, PAINEL_PATH, type ChartIndicador } from "@/lib/publisher/chart-catalog";
import { boletinsWhere } from "@/lib/workspace/posts";

/**
 * Bloco "Periódicos" — os formatos recorrentes da casa, um grupo por formato,
 * cada grupo com título próprio e link para o arquivo:
 *
 * - Café com Mercado (diário, Markdown em `content/cafe-com-mercado`);
 * - Dossiês macro mensal e semanal (Markdown em `content/dossie-*`);
 * - Boletins — os posts que o Publisher grava a cada divulgação de indicador
 *   (categoria própria no banco; nunca se misturam aos artigos).
 *
 * Como o título do grupo já diz o formato, o kicker do card carrega só o que
 * varia dentro dele (data, cadência e período, indicador e mês).
 *
 * `variant="home"`: duas colunas — o Café é o card cheio com a capa em cima;
 * ao lado, um grupo só chamado "Boletins" reúne dossiês e boletins (decisão do
 * dono: para o leitor é tudo boletim) em cards só de texto, do mais recente
 * para o mais antigo, que juntos preenchem a altura do Café.
 * `variant="hub"` (página /conteudo): três grupos (Café, Dossiês, Boletins),
 * com cards cheios e mais itens por formato.
 *
 * Formato sem conteúdo simplesmente não aparece — nada de "ainda não publicado"
 * em página pública. Cada fonte falha em silêncio (→ []) porque a home não pode
 * quebrar por causa de um bloco secundário; se todas vierem vazias, o bloco
 * inteiro some.
 */

/** Mesmo sistema de título de seção de HeroRecentes: navy com sublinhado curto azure. */
const SECTION_TITLE_CLASSES =
  "text-3xl text-[#132960] after:mt-2 after:block after:h-1 after:w-12 after:rounded-full after:bg-[#027DFC] md:text-4xl";

/** Card cheio: capa sangrada no topo, corpo embaixo; `flex-1` preenche a coluna na home. */
const CARD_CLASSES =
  "az-card group flex flex-1 flex-col overflow-hidden transition hover:border-[#027DFC]/40";
const CARD_BODY_CLASSES = "flex flex-1 flex-col gap-2 p-4 md:p-5";
/** Card só de texto. `relative` ancora o link esticado do título. */
const TEXT_CARD_CLASSES =
  "az-card group relative flex flex-col gap-1.5 p-4 transition hover:border-[#027DFC]/40 md:p-5";
/** Proporção das artes de release (1600×840) e da capa do Café (1200×630). */
const COVER_CLASSES = "relative aspect-[40/21] w-full overflow-hidden bg-[#132960]";
const COVER_SIZES = "(min-width: 768px) 33vw, 100vw";
const KICKER_CLASSES = "text-xs font-semibold uppercase tracking-wider text-[#027DFC]";
const TITLE_CLASSES =
  "text-lg font-semibold leading-snug text-[#132960] line-clamp-2 group-hover:text-[#027DFC]";
/** Card de texto vive só do título: um degrau acima. */
const TEXT_CARD_TITLE_CLASSES =
  "text-xl font-semibold leading-snug text-[#132960] line-clamp-2 group-hover:text-[#027DFC]";
/** 4 linhas: na home o Café estica até a coluna dos boletins, e texto preenche melhor que vazio. */
const DESCRIPTION_CLASSES = "line-clamp-4 text-base leading-relaxed text-zinc-700";
const CARD_LINK_CLASSES = "text-base font-semibold text-[#027DFC]";
const SECONDARY_LINK_CLASSES = "text-sm font-semibold text-[#132960]/60 hover:text-[#027DFC]";
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

/** "sexta-feira" + "2026-09-18" → "Sexta, 18/09/2026". */
function kickerCafe(b: Briefing): string {
  const dia = b.weekday.replace(/-feira$/, "");
  const data = b.date.split("-").reverse().join("/");
  return dia ? `${dia[0].toUpperCase()}${dia.slice(1)}, ${data}` : data;
}

/** "Dossiê Mensal · Agosto de 2026" — na home divide o grupo com os boletins, então leva o nome. */
function kickerDossie(d: Dossie): string {
  return `Dossiê ${d.tipo === "mensal" ? "Mensal" : "Semanal"} · ${d.periodo}`;
}

/** Indicador da divulgação, pelo prefixo do slug que o Publisher grava. */
function indicadorDoSlug(slug: string): ChartIndicador | null {
  if (slug.startsWith("ipca-")) return "ipca";
  if (slug.startsWith("igpm-")) return "igpm";
  return null;
}

/**
 * "IPCA · julho de 2026". O mês de referência vem do slug (`ipca-2026-07`);
 * sem esse padrão, cai na data de publicação do post.
 */
function kickerBoletim(post: PostCardData, ind: ChartIndicador | null): string {
  const rotulo = ind ? INDICADOR_LABEL[ind] : BOLETIM_KICKER;
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
 * Capa para formato sem arte (hub): painel navy com o título em branco, na
 * mesma proporção das capas de imagem. Barra azure no topo ecoa as artes.
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

/** Card cheio: capa → kicker → descrição → link, tudo dentro de um <Link>. */
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

type TextoCardProps = {
  href: string;
  kicker: string;
  title: string;
  linkLabel: string;
  /** Link secundário (ex.: painel do indicador), fora do link esticado. */
  extra?: ReactNode;
  /** Num grupo com mais de um, cada card cresce para a pilha somar a altura do Café. */
  preencher: boolean;
};

/**
 * Card só de texto (home): kicker → título → link, sem resumo. O link do
 * título é "esticado" e cobre o card inteiro; o secundário sobe em z-10 para
 * continuar clicável — sem <a> dentro de <a>.
 */
function TextoCard({ href, kicker, title, linkLabel, extra, preencher }: TextoCardProps) {
  return (
    <article className={`${TEXT_CARD_CLASSES} ${preencher ? "flex-1" : ""}`}>
      <p className={KICKER_CLASSES}>{kicker}</p>
      <h3 className={TEXT_CARD_TITLE_CLASSES}>
        <Link href={href} className="after:absolute after:inset-0 after:content-['']">
          {title}
        </Link>
      </h3>
      <div className="mt-auto flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 pt-1">
        <span className={CARD_LINK_CLASSES}>{linkLabel}</span>
        {extra ? <span className="relative z-10">{extra}</span> : null}
      </div>
    </article>
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

function DossieCard({ dossie, compacto }: { dossie: Dossie; compacto?: { preencher: boolean } }) {
  const comum = {
    href: dossie.href,
    kicker: kickerDossie(dossie),
    title: dossie.title,
    linkLabel: "Ler dossiê →",
  };
  return compacto ? (
    <TextoCard {...comum} preencher={compacto.preencher} />
  ) : (
    <PeriodicoCard {...comum} description={dossie.description || undefined} />
  );
}

/**
 * Boletim tem DOIS destinos (o post e o painel ao vivo do indicador), então o
 * card é um <article> com mais de um <Link> — nunca <a> dentro de <a>.
 */
function BoletimCard({ post, compacto }: { post: PostCardData; compacto?: { preencher: boolean } }) {
  const ind = indicadorDoSlug(post.slug);
  const painel = ind ? (
    <Link href={PAINEL_PATH[ind]} className={SECONDARY_LINK_CLASSES}>
      Painel do {INDICADOR_LABEL[ind]} ↗
    </Link>
  ) : null;

  if (compacto) {
    return (
      <TextoCard
        href={post.href}
        kicker={kickerBoletim(post, ind)}
        title={post.title}
        linkLabel={LER_BOLETIM}
        extra={painel}
        preencher={compacto.preencher}
      />
    );
  }

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
          {painel}
        </div>
      </div>
    </article>
  );
}

/**
 * Grupo de formato: título + link para o arquivo (quando existe) + cards
 * empilhados. É `flex-col` para que, na home, os cards com `flex-1` preencham a
 * altura da linha.
 */
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
  const [cafes, mensais, semanais, posts] = await Promise.all([
    seguro("listBriefings", () => listBriefings(home ? 1 : 3)),
    seguro("listDossies(mensal)", () => listDossies("mensal", home ? 1 : 2)),
    seguro("listDossies(semanal)", () => listDossies("semanal", home ? 1 : 2)),
    seguro("findPosts(boletins)", () =>
      findPosts({
        where: boletinsWhere,
        orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
        take: home ? 2 : 4,
      }),
    ),
  ]);

  // Dossiês juntos: mensal em cima, semanal embaixo.
  const dossies: Dossie[] = [...mensais, ...semanais];
  // O card usa a data formatada; a ISO fica só para ordenar na home.
  const boletins = posts.map((p) => ({
    card: mapPost(p),
    publishedAt: (p.publishedAt ?? p.createdAt).toISOString(),
  }));

  if (cafes.length === 0 && dossies.length === 0 && boletins.length === 0) {
    return null;
  }

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

  if (home) {
    // Um grupo só, do mais recente para o mais antigo. Card de texto só cresce
    // quando há mais de um: sozinho, cresceria em branco até a altura do Café.
    const itens = [
      ...dossies.map((d) => ({
        key: `${d.tipo}-${d.slug}`,
        publishedAt: d.publishedAt,
        render: (preencher: boolean) => <DossieCard dossie={d} compacto={{ preencher }} />,
      })),
      ...boletins.map((b) => ({
        key: `post-${b.card.id}`,
        publishedAt: b.publishedAt,
        render: (preencher: boolean) => <BoletimCard post={b.card} compacto={{ preencher }} />,
      })),
    ].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    if (itens.length > 0) {
      const preencher = itens.length > 1;
      grupos.push(
        <Grupo key="boletins" titulo={BOLETIM_SECTION_LABEL} arquivoHref={BOLETIM_BASE_PATH}>
          {itens.map((i) => (
            <Fragment key={i.key}>{i.render(preencher)}</Fragment>
          ))}
        </Grupo>,
      );
    }
  } else {
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
          {boletins.map((b) => (
            <BoletimCard key={b.card.id} post={b.card} />
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
      {/* Home: colunas esticam (os cards de texto preenchem a altura do Café). Hub: cada grupo na sua altura. */}
      <div
        className={`grid grid-cols-1 ${home ? "gap-6 md:gap-5" : "items-start gap-4"} ${GRID_COLS[grupos.length]}`}
      >
        {grupos}
      </div>
    </section>
  );
}
