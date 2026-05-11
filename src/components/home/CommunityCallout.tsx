export function CommunityCallout() {
  const url = process.env.NEXT_PUBLIC_WHATSAPP_COMMUNITY_URL?.trim();
  const hasLink = Boolean(url);

  return (
    <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#132960] via-[#0e1f49] to-[#027DFC] px-6 py-10 text-white shadow-sm md:px-12 md:py-14">
      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[1.2fr_1fr] md:items-center">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/70">
            Comunidade AZ Invest
          </p>
          <h2 className="text-3xl font-semibold leading-tight md:text-4xl">
            Fique por dentro de todas as novidades.
          </h2>
          <p className="text-sm leading-relaxed text-white/85 md:text-base">
            Entre na nossa comunidade no WhatsApp e receba alertas, analises e
            materiais selecionados direto no seu celular, junto de quem pensa
            investimentos com a gente.
          </p>
        </div>
        <div className="flex md:justify-end">
          {hasLink ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#22c55e] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-[#16a34a]"
            >
              Entrar na comunidade
            </a>
          ) : (
            <span
              aria-disabled="true"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white/15 px-6 py-3 text-sm font-semibold text-white/80"
            >
              Link em breve
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
