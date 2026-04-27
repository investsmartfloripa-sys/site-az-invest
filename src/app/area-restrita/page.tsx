import Link from "next/link";

export default function AreaRestritaPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4">
      <section className="w-full rounded-xl border border-[#132960]/20 bg-white p-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-[#027DFC]">Area restrita</p>
        <h1 className="mt-2 text-3xl text-[#132960]">Gestao do blog</h1>
        <p className="mt-3 text-zinc-600">
          Esta area e exclusiva para a equipe que publica e administra os textos do blog.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/area-restrita/login"
            className="rounded-md bg-[#132960] px-4 py-2 text-sm font-semibold text-white"
          >
            Fazer login
          </Link>
          <Link href="/" className="rounded-md border border-zinc-300 px-4 py-2 text-sm">
            Voltar para o site
          </Link>
        </div>
      </section>
    </main>
  );
}
