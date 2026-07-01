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

      <section className="rounded-2xl border border-[#132960]/10 bg-white p-4 text-xs text-zinc-600">
        <p className="font-semibold uppercase tracking-wide text-zinc-500">Notas metodológicas</p>
        <ul className="mt-2 space-y-1 list-disc pl-4">
          <li>
            <strong>Ibovespa (histórico)</strong>: <code>^BVSP</code> via yfinance. Benchmarks em base
            100: CDI (BCB SGS 12), S&amp;P 500 (<code>^GSPC</code>, em USD) e USD/BRL.
          </li>
          <li>
            <strong>P/L do índice</strong>: bottom-up — 1 / Σ(peso·earnings yield) dos papéis do
            Ibovespa. Pesos da carteira teórica B3 (<code>GetPortfolioDay</code>); EPS TTM (resultado
            anual + trimestral) e preço via yfinance. Bandas = média ± 1σ e ± 2σ da janela.
          </li>
          <li>
            <strong>Prêmio de risco</strong>: earnings yield (1/P-L) ou dividend yield do Ibovespa
            menos o juro real da NTN-B ~10 anos (curva IPCA ANBIMA, <code>treasury_history</code>,
            interpolada por prazo).
          </li>
          <li>
            <strong>Screener</strong>: carteira teórica do Ibovespa (B3). P/L, P/VP, DY, ROE e valor
            de mercado via yfinance; setor por catálogo curado.
          </li>
          <li>
            A série de valuation começa onde há histórico de lucros confiável e cresce a cada
            atualização (não retroage décadas). Indicadores — <strong>não são recomendação</strong>.
          </li>
        </ul>
      </section>
    </div>
  );
}
