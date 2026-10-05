import Link from "next/link";

import { GlobalRatesComparator } from "@/components/painel/juros-globais/GlobalRatesComparator";
import { PolicyRatesChart } from "@/components/painel/juros-globais/PolicyRatesChart";

export const metadata = {
  title: "Juros globais — Ativos de mercado",
  description:
    "Taxas básicas de juros dos bancos centrais em perspectiva (BIS) e curvas soberanas de Brasil, EUA, Japão, Alemanha, Reino Unido, Colômbia, Chile e China comparadas por prazo, com dados das fontes oficiais.",
};

// ISR: a página é estática; os gráficos buscam os dados ao vivo no cliente
// (rotas /api/global-rates/*, revalidadas ao longo do dia). Sem loading.tsx /
// <Suspense> aqui — quebraria a hidratação dos componentes interativos.
export const revalidate = 3600;

export default function JurosGlobaisPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#027DFC]">
          Ativos de mercado · Global · Juros globais
        </p>
        <h2 className="text-2xl font-semibold text-[#132960]">Juros pelo mundo</h2>
        <p className="max-w-3xl text-sm text-zinc-600">
          Primeiro, a <strong>taxa básica de cada banco central</strong> em perspectiva: quem está subindo, quem
          está cortando e quem parou. Depois, compare a curva de juros soberana de cada país{" "}
          <strong>equalizando por prazo</strong>: escolha um vencimento (2, 5, 10, 20 ou 30 anos) e veja todos os
          países lado a lado; deixe só um país selecionado para abrir vários vencimentos ao mesmo tempo. A leitura
          ao vivo da{" "}
          <Link href="/painel-economico/mercado/brasil/renda-fixa" className="underline hover:text-[#027DFC]">
            curva de renda fixa brasileira
          </Link>{" "}
          e das implícitas de política monetária fica no{" "}
          <Link href="/painel-economico/panorama#juros" className="underline hover:text-[#027DFC]">
            Panorama
          </Link>
          .
        </p>
      </header>

      <PolicyRatesChart />

      <GlobalRatesComparator />

      {/* Notas metodológicas saíram do rodapé (poluição visual): vivem no
          ícone (?) do header de cada gráfico, fonte por fonte. */}
    </div>
  );
}
