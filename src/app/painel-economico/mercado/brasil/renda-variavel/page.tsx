import { AcoesComunidadeCta } from "@/components/painel/acoes/AcoesComunidadeCta";
import { AcoesNoticias } from "@/components/painel/acoes/AcoesNoticias";
import { AcoesScreener } from "@/components/painel/acoes/AcoesScreener";
import { AcoesValuation } from "@/components/painel/acoes/AcoesValuation";
import { IbovHero } from "@/components/painel/acoes/IbovHero";
import {
  getAcoesIbov,
  getAcoesScreener,
  getAcoesUltimasNoticias,
  getAcoesValuation,
} from "@/lib/painel-acoes";

export const metadata = {
  title: "Ações Brasil (Ibovespa) — Ativos de mercado | AZ Invest",
  description:
    "Panorama do Ibovespa: índice vs CDI/S&P 500/dólar, P/L histórico com bandas de desvio, prêmio de risco vs NTN-B e screener das ações do índice.",
};

export default async function RendaVariavelPage() {
  const [ibov, valuation, screener, noticias] = await Promise.all([
    getAcoesIbov(),
    getAcoesValuation(),
    getAcoesScreener(),
    getAcoesUltimasNoticias(),
  ]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#027DFC]">
          Ativos de mercado · Brasil · Renda variável
        </p>
        <h2 className="text-2xl font-semibold text-[#132960]">Ações Brasil — Ibovespa</h2>
        <p className="max-w-3xl text-sm text-zinc-600">
          Acompanhamento do Ibovespa e do valuation da bolsa brasileira: o índice comparado a CDI,
          S&amp;P 500 e dólar, o P/L histórico com média e bandas de desvio, o prêmio de risco das
          ações contra o juro real da NTN-B, e um screener com as ações do índice (P/L, P/VP, DY,
          ROE, valor de mercado e peso).
        </p>
      </header>

      {/* Hero Ibovespa */}
      {ibov && ibov.status === "ok" ? (
        <IbovHero data={ibov} />
      ) : (
        <section
          aria-label="Ibovespa"
          className="rounded-2xl border border-[#132960]/15 bg-white p-6 shadow-sm"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Ibovespa</p>
          <p className="mt-2 text-sm text-zinc-500">
            Pipeline em construção — dados serão preenchidos no próximo deploy.
          </p>
        </section>
      )}

      {/* Valuation: P/L com bandas + prêmio vs NTN-B */}
      {valuation && valuation.status === "ok" ? <AcoesValuation data={valuation} /> : null}

      {/* Editorial (esconde se não houver posts) */}
      <AcoesNoticias posts={noticias} />

      {/* Screener das ações do Ibovespa */}
      {screener && screener.status === "ok" ? (
        <AcoesScreener data={screener} />
      ) : (
        <section
          aria-label="Screener de ações"
          className="rounded-2xl border border-[#132960]/15 bg-white p-6 shadow-sm"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Screener</p>
          <p className="mt-2 text-sm text-zinc-500">
            Em construção — universo Ibovespa com P/L, P/VP, DY, ROE, valor de mercado e peso no
            índice.
          </p>
        </section>
      )}

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
