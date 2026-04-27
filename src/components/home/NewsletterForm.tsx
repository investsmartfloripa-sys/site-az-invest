export function NewsletterForm() {
  return (
    <section className="rounded-none bg-[#027DFC] px-6 py-10 md:px-10">
      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
        <div>
          <h2 className="text-5xl leading-[0.95] text-[#132960]">Nao perca as proximas publicacoes.</h2>
          <p className="mt-3 text-sm text-white">
            Cadastre seu e-mail e receba uma notificacao quando entrar conteudo novo.
          </p>
        </div>
        <form className="space-y-2 self-center">
          <input
            type="text"
            placeholder="Nome"
            className="h-9 w-full border border-white/50 bg-white px-3 text-sm text-zinc-900 outline-none"
          />
          <input
            type="email"
            placeholder="E-mail"
            className="h-9 w-full border border-white/50 bg-white px-3 text-sm text-zinc-900 outline-none"
          />
          <button
            type="submit"
            className="h-9 w-full bg-[#FF5713] text-sm font-semibold text-white transition hover:bg-[#d94a10]"
          >
            Enviar
          </button>
        </form>
      </div>
    </section>
  );
}
