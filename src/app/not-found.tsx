import Link from "next/link";

import { Footer } from "@/components/common/Footer";
import { Header } from "@/components/common/Header";

export const metadata = {
  title: "Pagina nao encontrada | AZ Invest",
  description: "A pagina que voce procura nao existe ou foi movida.",
};

export default function NotFound() {
  return (
    <div className="min-h-screen text-[#132960]">
      <Header />
      <main className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-4 py-20 text-center md:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#FF5713]">
          Erro 404
        </p>
        <h1 className="text-5xl font-semibold leading-tight text-[#027DFC] md:text-6xl">
          Pagina nao encontrada
        </h1>
        <p className="max-w-xl text-sm text-zinc-600 md:text-base">
          O endereco que voce digitou nao existe, foi movido ou esta temporariamente
          indisponivel. Use os atalhos abaixo para voltar ao conteudo.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="rounded-full bg-[#027DFC] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0268d6]"
          >
            Voltar para a home
          </Link>
          <Link
            href="/blog"
            className="rounded-full border border-[#132960]/25 px-5 py-2.5 text-sm font-semibold text-[#132960] transition hover:bg-[#132960]/5"
          >
            Ler o blog
          </Link>
          <Link
            href="/painel-economico"
            className="rounded-full border border-[#132960]/25 px-5 py-2.5 text-sm font-semibold text-[#132960] transition hover:bg-[#132960]/5"
          >
            Painel economico
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
