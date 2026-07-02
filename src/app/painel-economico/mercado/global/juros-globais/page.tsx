import Link from "next/link";

import { GlobalRatesComparator } from "@/components/painel/juros-globais/GlobalRatesComparator";

export const metadata = {
  title: "Juros globais — Ativos de mercado",
  description:
    "Curvas soberanas de EUA, Japão, Alemanha e Reino Unido comparadas por prazo, com dados diários das fontes oficiais (FRED, MOF, Bundesbank e Bank of England).",
};

// ISR: a página é estática; o comparador busca as curvas ao vivo no cliente
// (rotas /api/global-rates/*, revalidadas ao longo do dia). Sem loading.tsx /
// <Suspense> aqui — quebraria a hidratação do componente interativo.
export const revalidate = 3600;

export default function JurosGlobaisPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#027DFC]">
          Ativos de mercado · Global · Juros globais
        </p>
        <h2 className="text-2xl font-semibold text-[#132960]">Juros soberanos pelo mundo</h2>
        <p className="max-w-3xl text-sm text-zinc-600">
          Compare a curva de juros soberana de cada país <strong>equalizando por prazo</strong>: escolha um
          vencimento (2, 5, 10, 20 ou 30 anos) e veja todos os países lado a lado; deixe só um país selecionado
          para abrir vários vencimentos ao mesmo tempo. Os dados vêm das fontes oficiais e se atualizam ao longo
          do dia, no mesmo espírito da{" "}
          <Link href="/painel-economico/mercado/brasil/renda-fixa" className="underline hover:text-[#027DFC]">
            curva de renda fixa brasileira
          </Link>
          . A leitura ao vivo da curva DI/IPCA+ do Brasil e das implícitas de política monetária fica no{" "}
          <Link href="/painel-economico/panorama#juros" className="underline hover:text-[#027DFC]">
            Panorama
          </Link>
          .
        </p>
      </header>

      <GlobalRatesComparator />

      {/* Notas metodológicas saíram do rodapé (poluição visual): vivem no
          ícone (?) do header do comparador, fonte por fonte. */}
    </div>
  );
}
