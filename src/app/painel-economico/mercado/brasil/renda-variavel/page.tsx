import { AcoesComunidadeCta } from "@/components/painel/acoes/AcoesComunidadeCta";
import { AcoesNoticias } from "@/components/painel/acoes/AcoesNoticias";
import { RendaVariavelClient } from "@/components/painel/acoes/RendaVariavelClient";
import {
  getAcoesIbov,
  getAcoesLogos,
  getAcoesScreener,
  getAcoesUltimasNoticias,
  getAcoesValuation,
  getFluxoInvestidores,
} from "@/lib/painel-acoes";

export const metadata = {
  title: "Ações Brasil (Ibovespa) — Ativos de mercado",
  description:
    "Panorama do Ibovespa: índice vs CDI/S&P 500/dólar, P/L histórico com bandas de desvio, prêmio de risco vs NTN-B e screener das ações do índice.",
};

export default async function RendaVariavelPage() {
  const [ibov, valuation, screener, noticias, fluxo, logos] = await Promise.all([
    getAcoesIbov(),
    getAcoesValuation(),
    getAcoesScreener(),
    getAcoesUltimasNoticias(),
    getFluxoInvestidores(),
    getAcoesLogos(),
  ]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#027DFC]">
          Ativos de mercado · Brasil · Renda variável
        </p>
        <h2 className="text-2xl font-semibold text-[#132960]">Ações Brasil — Ibovespa</h2>
        <p className="max-w-3xl text-sm text-zinc-600">
          Acompanhamento do Ibovespa e do valuation da bolsa brasileira. Na{" "}
          <strong>Visão geral</strong>, o índice comparado a CDI, S&amp;P 500 e dólar, e um screener
          com as ações do índice — clique para jogar qualquer papel no gráfico (retorno total, com
          dividendos). Na aba <strong>Analítico</strong>, o P/L histórico com bandas de desvio, o
          prêmio de risco contra a NTN-B e o fluxo de investidores.
        </p>
      </header>

      {/* Abas (Visão geral / Analítico) + comparador do hero com o screener */}
      <RendaVariavelClient
        ibov={ibov}
        valuation={valuation}
        fluxo={fluxo}
        screener={screener}
        logos={logos}
      />

      {/* Editorial (esconde se não houver posts) */}
      <AcoesNoticias posts={noticias} />

      {/* CTA Comunidade (esconde se não houver URL configurada) */}
      <AcoesComunidadeCta />

      {/* Notas metodológicas saíram do rodapé da página (poluição visual):
          cada uma vive no ícone (?) do card correspondente — hero (yfinance/
          benchmarks), valuation (P/L bottom-up e prêmio vs NTN-B), screener
          (universo B3 + yfinance) e tabela do comparador. */}
    </div>
  );
}
