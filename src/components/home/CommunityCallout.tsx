import Image from "next/image";

const COMMUNITY_LABEL = "Entrar na comunidade AZ Invest no WhatsApp";

export function CommunityCallout() {
  const url = process.env.NEXT_PUBLIC_WHATSAPP_COMMUNITY_URL?.trim();
  const hasLink = Boolean(url);

  return (
    <section aria-label="Comunidade AZ Invest no WhatsApp">
      {/*
        Desktop / tablet (>= md): banner-imagem clicável, mantendo o layout do design.
        O bloco inteiro vira o CTA; o usuário pode tocar em qualquer ponto (inclusive
        no botão "Inscreva-se" desenhado na arte) para abrir a comunidade.
      */}
      <div className="hidden md:block">
        {hasLink ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={COMMUNITY_LABEL}
            className="group block overflow-hidden rounded-3xl shadow-sm transition-transform hover:scale-[1.01] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#027DFC]"
          >
            <Image
              src="/banner-comunidade.svg"
              alt="Entre na nossa comunidade no WhatsApp e receba alertas, análises e materiais selecionados direto no seu celular."
              width={912}
              height={240}
              sizes="(min-width: 1280px) 1024px, 100vw"
              className="h-auto w-full"
              priority={false}
            />
          </a>
        ) : (
          <div className="relative overflow-hidden rounded-3xl shadow-sm">
            <Image
              src="/banner-comunidade.svg"
              alt="Banner da comunidade AZ Invest no WhatsApp."
              width={912}
              height={240}
              sizes="(min-width: 1280px) 1024px, 100vw"
              className="h-auto w-full"
              priority={false}
            />
            <span
              aria-disabled="true"
              className="pointer-events-none absolute bottom-[14%] right-[6%] rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-[#0e1f49] shadow-md"
            >
              Link em breve
            </span>
          </div>
        )}
      </div>

      {/*
        Mobile (< md): a arte original ficaria ilegível abaixo de 700-800 px de largura,
        então recriamos o mesmo design em HTML — fundo azul com listras diagonais,
        marca da comunidade, título, descrição e CTA real — empilhado e tocável.
      */}
      <div className="md:hidden">
        <div className="relative overflow-hidden rounded-3xl bg-[#027DFC] text-white shadow-sm">
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, rgba(255,255,255,0.16) 0 1px, transparent 1px 18px)",
            }}
          />
          <div className="relative space-y-4 px-6 py-7 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/80">
              Comunidade AZ Invest
            </p>
            <h2 className="text-xl font-bold uppercase leading-tight">
              Fique por dentro de todas as novidades
            </h2>
            <p className="text-sm leading-relaxed text-white/90">
              Entre na nossa comunidade no WhatsApp e receba{" "}
              <strong className="font-semibold text-white">
                alertas, análises e materiais selecionados
              </strong>{" "}
              direto no seu celular, junto de quem pensa investimentos com a gente.
            </p>
            <div className="pt-1">
              {hasLink ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={COMMUNITY_LABEL}
                  className="inline-flex w-full items-center justify-center rounded-md bg-[#F26B2C] px-6 py-3 text-base font-semibold text-white shadow-md transition hover:bg-[#dd5c1f] active:bg-[#cf5318]"
                >
                  Inscreva-se
                </a>
              ) : (
                <span
                  aria-disabled="true"
                  className="inline-flex w-full items-center justify-center rounded-md bg-white/15 px-6 py-3 text-base font-semibold text-white/85"
                >
                  Link em breve
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
