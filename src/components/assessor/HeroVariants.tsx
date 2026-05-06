import Image from "next/image";
import Link from "next/link";

import { WhatsappContactCta } from "@/components/assessor/WhatsappContactCta";
import {
  InstagramIcon,
  LinkedinIcon,
} from "@/components/common/SocialIcons";

export type HeroAuthor = {
  id: number;
  name: string;
  role: string;
  headline: string | null;
  photo: string | null;
  linkedin: string | null;
  instagram: string | null;
};

export type HeroVariantProps = {
  author: HeroAuthor;
  whatsappDigits: string | null;
  fallbackWhatsappUrl: string;
  registerClickAction: (authorId: number, name: string) => Promise<string>;
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function BackLink() {
  return (
    <Link
      href="/nosso-time"
      className="inline-flex w-fit items-center gap-1 rounded-full border border-[#132960]/15 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#132960]/80 transition hover:border-[#027DFC]/40 hover:text-[#027DFC]"
    >
      {"<-"} Nosso time
    </Link>
  );
}

function InstagramButton({
  href,
  authorName,
  size = "md",
}: {
  href: string;
  authorName: string;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "sm" ? "h-9 w-9" : "h-11 w-11";
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`Instagram de ${authorName}`}
      className={`${sizeClass} flex items-center justify-center rounded-full border border-[#132960]/15 text-[#E4405F] transition hover:border-[#E4405F] hover:bg-gradient-to-br hover:from-[#feda75] hover:via-[#d62976] hover:to-[#4f5bd5] hover:text-white`}
    >
      <InstagramIcon className={iconSize} />
    </a>
  );
}

function LinkedinButton({
  href,
  authorName,
  size = "md",
}: {
  href: string;
  authorName: string;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "sm" ? "h-9 w-9" : "h-11 w-11";
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`LinkedIn de ${authorName}`}
      className={`${sizeClass} flex items-center justify-center rounded-full border border-[#132960]/15 text-[#0A66C2] transition hover:border-[#0A66C2] hover:bg-[#0A66C2] hover:text-white`}
    >
      <LinkedinIcon className={iconSize} />
    </a>
  );
}

function PhotoBlock({
  author,
  className,
  sizes,
}: {
  author: HeroAuthor;
  className: string;
  sizes: string;
}) {
  return (
    <div
      className={`relative flex-none overflow-hidden bg-[#132960] ${className}`}
    >
      {author.photo ? (
        <Image
          src={author.photo}
          alt={author.name}
          fill
          sizes={sizes}
          className="object-cover"
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-3xl font-semibold text-white">
          {initials(author.name)}
        </span>
      )}
    </div>
  );
}

/* ============================================================
 * Variant A: Vertical centralizado (correcao minima do atual)
 * Mobile: foto centralizada, conteudo abaixo, botao full-width.
 * Desktop: foto a esquerda, conteudo a direita.
 * ============================================================ */
export function HeroVariantA({
  author,
  whatsappDigits,
  fallbackWhatsappUrl,
  registerClickAction,
}: HeroVariantProps) {
  return (
    <section className="border-b border-[#132960]/10 bg-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-12">
        <div className="mb-6">
          <BackLink />
        </div>

        <div className="flex flex-col items-center gap-6 text-center md:flex-row md:items-center md:gap-8 md:text-left">
          <PhotoBlock
            author={author}
            className="h-56 w-44 rounded-2xl shadow-sm md:h-64 md:w-48"
            sizes="(min-width: 768px) 192px, 176px"
          />

          <div className="flex w-full flex-1 flex-col items-center gap-3 md:items-start">
            <h1 className="text-3xl font-semibold leading-tight text-[#132960] md:text-5xl">
              {author.name}
            </h1>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#FF5713] md:text-sm">
              {author.role}
            </p>
            {author.headline ? (
              <p className="max-w-2xl text-sm leading-relaxed text-zinc-600 md:text-base">
                {author.headline}
              </p>
            ) : null}

            <div className="flex w-full flex-col items-center gap-3 pt-2 sm:flex-row sm:flex-wrap md:items-center">
              {whatsappDigits ? (
                <WhatsappContactCta
                  authorId={author.id}
                  authorName={author.name}
                  whatsappUrl={fallbackWhatsappUrl}
                  registerClickAction={registerClickAction}
                  variant="primary"
                  className="!w-full sm:!w-auto"
                />
              ) : null}

              <div className="flex items-center gap-3">
                {author.instagram ? (
                  <InstagramButton
                    href={author.instagram}
                    authorName={author.name}
                  />
                ) : null}
                {author.linkedin ? (
                  <LinkedinButton
                    href={author.linkedin}
                    authorName={author.name}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
 * Variant B: Horizontal compacto
 * Foto sempre a esquerda (pequena no mobile, maior no desktop).
 * CTAs em uma linha cheia abaixo do bloco foto+nome.
 * ============================================================ */
export function HeroVariantB({
  author,
  whatsappDigits,
  fallbackWhatsappUrl,
  registerClickAction,
}: HeroVariantProps) {
  return (
    <section className="border-b border-[#132960]/10 bg-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-12">
        <div className="mb-6">
          <BackLink />
        </div>

        <div className="flex items-start gap-4 md:items-center md:gap-8">
          <PhotoBlock
            author={author}
            className="h-32 w-24 rounded-xl shadow-sm md:h-64 md:w-48 md:rounded-2xl"
            sizes="(min-width: 768px) 192px, 96px"
          />

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <h1 className="text-2xl font-semibold leading-tight text-[#132960] md:text-5xl">
              {author.name}
            </h1>
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#FF5713] md:text-sm">
              {author.role}
            </p>
            {author.headline ? (
              <p className="hidden text-sm leading-relaxed text-zinc-600 md:block md:text-base">
                {author.headline}
              </p>
            ) : null}
          </div>
        </div>

        {author.headline ? (
          <p className="mt-4 text-sm leading-relaxed text-zinc-600 md:hidden">
            {author.headline}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-3 md:mt-6">
          {whatsappDigits ? (
            <WhatsappContactCta
              authorId={author.id}
              authorName={author.name}
              whatsappUrl={fallbackWhatsappUrl}
              registerClickAction={registerClickAction}
              variant="primary"
              className="!w-full sm:!w-auto"
            />
          ) : null}
          <div className="flex items-center gap-2">
            {author.instagram ? (
              <InstagramButton
                href={author.instagram}
                authorName={author.name}
              />
            ) : null}
            {author.linkedin ? (
              <LinkedinButton
                href={author.linkedin}
                authorName={author.name}
              />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
 * Variant C: Foto banner no topo
 * Foto cobre full-width como banner. Conteudo abaixo.
 * Look estilo perfil de rede social.
 * ============================================================ */
export function HeroVariantC({
  author,
  whatsappDigits,
  fallbackWhatsappUrl,
  registerClickAction,
}: HeroVariantProps) {
  return (
    <section className="border-b border-[#132960]/10 bg-white">
      <div className="mx-auto w-full max-w-6xl px-0 md:px-8 md:pt-8">
        <div className="px-4 md:px-0">
          <div className="mb-4">
            <BackLink />
          </div>
        </div>

        <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#132960] md:aspect-[21/9] md:rounded-2xl">
          {author.photo ? (
            <Image
              src={author.photo}
              alt={author.name}
              fill
              sizes="(min-width: 1280px) 1152px, 100vw"
              priority
              className="object-cover"
              style={{ objectPosition: "center 25%" }}
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-6xl font-semibold text-white">
              {initials(author.name)}
            </span>
          )}
        </div>

        <div className="px-4 py-6 md:px-0 md:py-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#FF5713] md:text-sm">
            {author.role}
          </p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight text-[#132960] md:text-5xl">
            {author.name}
          </h1>
          {author.headline ? (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-600 md:text-base">
              {author.headline}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {whatsappDigits ? (
              <WhatsappContactCta
                authorId={author.id}
                authorName={author.name}
                whatsappUrl={fallbackWhatsappUrl}
                registerClickAction={registerClickAction}
                variant="primary"
                className="!w-full sm:!w-auto"
              />
            ) : null}
            <div className="flex items-center gap-2">
              {author.instagram ? (
                <InstagramButton
                  href={author.instagram}
                  authorName={author.name}
                />
              ) : null}
              {author.linkedin ? (
                <LinkedinButton
                  href={author.linkedin}
                  authorName={author.name}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
 * Variant D: Card unico compacto (premium)
 * Tudo dentro de um card com sombra. Hierarquia clara.
 * Mobile: foto pequena + nome em linha; CTA full-width abaixo.
 * Desktop: foto maior, layout horizontal mais espacoso.
 * ============================================================ */
export function HeroVariantD({
  author,
  whatsappDigits,
  fallbackWhatsappUrl,
  registerClickAction,
}: HeroVariantProps) {
  return (
    <section className="bg-[#f8fafc] py-6 md:py-10">
      <div className="mx-auto w-full max-w-6xl px-4 md:px-8">
        <div className="mb-4">
          <BackLink />
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#132960]/10 bg-white shadow-sm">
          <div className="flex flex-col gap-5 p-5 md:flex-row md:items-center md:gap-8 md:p-8">
            <PhotoBlock
              author={author}
              className="h-32 w-24 self-start rounded-xl md:h-56 md:w-44 md:rounded-2xl"
              sizes="(min-width: 768px) 176px, 96px"
            />

            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#FF5713] md:text-sm">
                {author.role}
              </p>
              <h1 className="text-2xl font-semibold leading-tight text-[#132960] md:text-4xl">
                {author.name}
              </h1>
              {author.headline ? (
                <p className="text-sm leading-relaxed text-zinc-600 md:text-base">
                  {author.headline}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-[#132960]/10 bg-[#fafbfd] px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-8">
            <div className="flex items-center gap-2">
              {author.instagram ? (
                <InstagramButton
                  href={author.instagram}
                  authorName={author.name}
                  size="sm"
                />
              ) : null}
              {author.linkedin ? (
                <LinkedinButton
                  href={author.linkedin}
                  authorName={author.name}
                  size="sm"
                />
              ) : null}
            </div>

            {whatsappDigits ? (
              <WhatsappContactCta
                authorId={author.id}
                authorName={author.name}
                whatsappUrl={fallbackWhatsappUrl}
                registerClickAction={registerClickAction}
                variant="primary"
                className="!w-full sm:!w-auto"
              />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
