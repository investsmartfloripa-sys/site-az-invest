import Image from "next/image";
import Link from "next/link";

import { WhatsappContactCta } from "@/components/assessor/WhatsappContactCta";
import {
  InstagramIcon,
  LinkedinIcon,
} from "@/components/common/SocialIcons";
import { SITE_MAIN_MAX_WIDTH_CLASS } from "@/lib/site-layout";

export type AuthorHeroModel = {
  id: number;
  name: string;
  role: string;
  headline: string | null;
  photo: string | null;
  linkedin: string | null;
  instagram: string | null;
};

export type AuthorHeroProps = {
  author: AuthorHeroModel;
  whatsappDigits: string | null;
  fallbackWhatsappUrl: string;
  registerClickAction: (
    authorId: number,
    name: string,
    visitorPhone?: string,
  ) => Promise<string>;
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
}: {
  href: string;
  authorName: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`Instagram de ${authorName}`}
      className="flex h-11 w-11 items-center justify-center rounded-full border border-[#132960]/15 text-[#E4405F] transition hover:border-[#E4405F] hover:bg-gradient-to-br hover:from-[#feda75] hover:via-[#d62976] hover:to-[#4f5bd5] hover:text-white"
    >
      <InstagramIcon className="h-5 w-5" />
    </a>
  );
}

function LinkedinButton({
  href,
  authorName,
}: {
  href: string;
  authorName: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`LinkedIn de ${authorName}`}
      className="flex h-11 w-11 items-center justify-center rounded-full border border-[#132960]/15 text-[#0A66C2] transition hover:border-[#0A66C2] hover:bg-[#0A66C2] hover:text-white"
    >
      <LinkedinIcon className="h-5 w-5" />
    </a>
  );
}

function PhotoBlock({
  author,
  className,
  sizes,
}: {
  author: AuthorHeroModel;
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

export function AuthorHero({
  author,
  whatsappDigits,
  fallbackWhatsappUrl,
  registerClickAction,
}: AuthorHeroProps) {
  return (
    <section className="border-b border-[#132960]/10 bg-white">
      <div
        className={`mx-auto w-full ${SITE_MAIN_MAX_WIDTH_CLASS} px-4 py-5 md:px-6 md:py-8`}
      >
        <div className="mb-4">
          <BackLink />
        </div>

        <div className="flex flex-col items-center gap-4 text-center md:flex-row md:items-start md:gap-6 md:text-left">
          <PhotoBlock
            author={author}
            className="h-48 w-40 rounded-xl shadow-sm md:h-52 md:w-44"
            sizes="(min-width: 768px) 176px, 160px"
          />

          <div className="flex w-full flex-1 flex-col items-center gap-2 md:items-start md:gap-2">
            <h1 className="text-2xl font-semibold leading-tight text-[#132960] md:text-4xl">
              {author.name}
            </h1>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#FF5713] md:text-xs">
              {author.role}
            </p>
            {author.headline ? (
              <p className="max-w-2xl text-xs leading-snug text-zinc-600 md:text-sm md:leading-relaxed">
                {author.headline}
              </p>
            ) : null}

            <div className="flex w-full flex-col items-center gap-2 pt-1 sm:flex-row sm:flex-wrap md:items-center md:gap-3">
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
