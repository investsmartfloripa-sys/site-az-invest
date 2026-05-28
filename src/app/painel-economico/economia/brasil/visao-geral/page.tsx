import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Visão Geral — em construção | AZ Invest",
  description:
    "Síntese executiva consolidada com leitura unificada do cenário brasileiro. Em construção.",
};

export const dynamic = "force-dynamic";

export default function VisaoGeralBrasilPlaceholder() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[#132960]">Visão Geral — Brasil</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Síntese executiva consolidada de atividade, inflação, fiscal, monetária e externo. Em construção.
        </p>
      </header>

      <div className="rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-12 text-center">
        <div className="text-5xl">🏗️</div>
        <h2 className="mt-4 text-lg font-semibold text-zinc-700">Em construção</h2>
        <p className="mt-2 max-w-md mx-auto text-sm text-zinc-500">
          Esta página vai consolidar o cenário macro brasileiro em uma leitura única. Por enquanto, acesse os termômetros detalhados nas seções abaixo.
        </p>
        <div className="mt-6 inline-flex flex-wrap gap-3 justify-center">
          <Link href="/painel-economico/economia/brasil/termometro-ciclo" className="rounded-md bg-[#132960] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a1a40]">
            Termômetro de Ciclo →
          </Link>
          <Link href="/painel-economico/economia/brasil/fiscal" className="rounded-md border border-[#132960] px-4 py-2 text-sm font-semibold text-[#132960] hover:bg-zinc-100">
            Fiscal
          </Link>
          <Link href="/painel-economico/economia/brasil/familias" className="rounded-md border border-[#132960] px-4 py-2 text-sm font-semibold text-[#132960] hover:bg-zinc-100">
            Famílias
          </Link>
        </div>
      </div>
    </div>
  );
}
