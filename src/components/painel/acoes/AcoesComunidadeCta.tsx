/**
 * CTA da comunidade (WhatsApp) para o painel de Ações.
 * Esconde-se por completo se NEXT_PUBLIC_WHATSAPP_COMMUNITY_URL não estiver definido
 * — evita "link em breve" em produção. Sem formulário de lead nesta versão
 * (não depende do banco; pode ganhar form com migration própria depois).
 */
const COMMUNITY_LABEL = "Entrar na comunidade AZ Invest no WhatsApp";

export function AcoesComunidadeCta() {
  const whatsappUrl = process.env.NEXT_PUBLIC_WHATSAPP_COMMUNITY_URL?.trim() || "";
  if (!whatsappUrl) return null;

  return (
    <section
      aria-label="Comunidade de ações no WhatsApp"
      className="rounded-2xl border border-[#132960]/15 bg-gradient-to-br from-[#0e1f49] to-[#132960] p-4 text-white shadow-sm md:p-6"
    >
      <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70">
            Comunidade AZ Invest
          </p>
          <h3 className="mt-1 text-xl font-bold leading-tight md:text-2xl">
            Acompanhe a bolsa com a gente
          </h3>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-white/85">
            Entre na comunidade no WhatsApp e receba{" "}
            <strong className="font-semibold text-white">
              análises e leituras de mercado sobre ações e Ibovespa
            </strong>{" "}
            direto no celular.
          </p>
        </div>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={COMMUNITY_LABEL}
          className="inline-flex w-full shrink-0 items-center justify-center rounded-md bg-[#F26B2C] px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#dd5c1f] active:bg-[#cf5318] md:w-auto"
        >
          Entrar na comunidade →
        </a>
      </div>
    </section>
  );
}
