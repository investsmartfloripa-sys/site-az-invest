export function NewsletterForm() {
  return (
    <section className="bg-[#027DFC] px-4 py-8 sm:px-6 md:px-10 md:py-10">
      <div className="mx-auto grid w-full max-w-[90rem] gap-6 md:grid-cols-2">
        <div>
          <h2 className="text-3xl leading-tight text-[#132960] sm:text-4xl md:text-5xl md:leading-[0.95]">
            Nao perca as proximas publicacoes.
          </h2>
          <p className="mt-3 max-w-md text-sm text-white">
            Cadastre seu e-mail e receba uma notificacao quando entrar conteudo novo.
          </p>
        </div>
        <form className="w-full space-y-2 self-center">
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
            className="h-10 w-full bg-[#FF5713] text-sm font-semibold text-white transition hover:bg-[#d94a10]"
          >
            Enviar
          </button>
        </form>
      </div>
    </section>
  );
}
