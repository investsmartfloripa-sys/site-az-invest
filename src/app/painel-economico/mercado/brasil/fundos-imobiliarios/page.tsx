import { FiiArtigosMaisLidos } from "@/components/painel/fii/FiiArtigosMaisLidos";
import { FiiComunidadeCta } from "@/components/painel/fii/FiiComunidadeCta";
import { FiiMacroCharts } from "@/components/painel/fii/FiiMacroCharts";
import { FiiNoticias } from "@/components/painel/fii/FiiNoticias";
import { FiiScreener } from "@/components/painel/fii/FiiScreener";
import { IfixHero } from "@/components/painel/fii/IfixHero";
import {
  getFiiArtigosMaisLidos,
  getFiiIfix,
  getFiiMacroCharts,
  getFiiScreener,
  getFiiUltimasNoticias,
} from "@/lib/painel-fii";

export const metadata = {
  title: "Fundos Imobiliários — Ativos de mercado",
  description:
    "Panorama dos FIIs: IFIX vs CDI/IBOV/IMA-B, retornos por segmento e screener completo com DY, P/VP, PL e liquidez.",
};

export default async function FundosImobiliariosPage() {
  const [ifix, screener, noticias, artigos, macroCharts] = await Promise.all([
    getFiiIfix(),
    getFiiScreener(),
    getFiiUltimasNoticias(),
    getFiiArtigosMaisLidos(),
    getFiiMacroCharts(),
  ]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#027DFC]">
          Ativos de mercado · Brasil · Fundos Imobiliários
        </p>
        <h2 className="text-2xl font-semibold text-[#132960]">Panorama FIIs</h2>
        <p className="max-w-3xl text-sm text-zinc-600">
          Acompanhamento diário do IFIX e do universo de Fundos Imobiliários listados na B3.
          Comparação com índices de renda fixa (IMA-B, IMA-B5+), CDI e Ibovespa, e screener
          com múltiplos por ticker (DY 12m, P/VP, PL, liquidez).
        </p>
      </header>

      {/* Hero IFIX */}
      {ifix && ifix.status === "ok" ? (
        <IfixHero data={ifix} />
      ) : (
        <section
          aria-label="IFIX"
          className="rounded-2xl border border-[#132960]/15 bg-white p-6 shadow-sm"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">IFIX</p>
          <p className="mt-2 text-sm text-zinc-500">
            Pipeline em construção — dados serão preenchidos no próximo deploy.
          </p>
        </section>
      )}

      {/* Macro charts (P/VP histórico + Prêmio NTN-B vs DY tijolo) */}
      {macroCharts && macroCharts.status === "ok" ? (
        <FiiMacroCharts data={macroCharts} />
      ) : null}

      {/* Blocos editoriais */}
      <FiiNoticias posts={noticias} />
      <FiiArtigosMaisLidos posts={artigos} />

      {/* Screener */}
      {screener && screener.status === "ok" ? (
        <FiiScreener data={screener} />
      ) : (
        <section
          aria-label="Screener de FIIs"
          className="rounded-2xl border border-[#132960]/15 bg-white p-6 shadow-sm"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Screener</p>
          <p className="mt-2 text-sm text-zinc-500">
            Pipeline em construção — universo IFIX + métricas via CVM.
          </p>
        </section>
      )}

      {/* CTA Comunidade + Form */}
      <FiiComunidadeCta />

      <section className="rounded-2xl border border-[#132960]/10 bg-white p-4 text-xs text-zinc-600">
        <p className="font-semibold uppercase tracking-wide text-zinc-500">Notas metodológicas</p>
        <ul className="mt-2 space-y-1 list-disc pl-4">
          <li>
            <strong>IFIX (histórico)</strong>: XFIX11 (ETF que replica o IFIX) via yfinance,
            reescalado para a escala do índice. A B3 não disponibiliza histórico do índice puro
            por API pública.
          </li>
          <li>
            <strong>Composição IFIX</strong>: B3 indexProxy <code>GetPortfolioDay</code> (carteira
            teórica diária).
          </li>
          <li>
            <strong>P/VP e PL</strong>: CVM Dados Abertos — Informe Mensal FII
            (<code>fii-doc-inf_mensal</code>). Defasagem típica de ~30 dias após o fim do mês de
            referência.
          </li>
          <li>
            <strong>DY 12m</strong>: soma dos dividendos pagos nos últimos 12 meses (yfinance)
            sobre o preço atual.
          </li>
          <li>
            <strong>Benchmarks</strong>: CDI BCB SGS 12, IBOV <code>^BVSP</code> yfinance, IMA-B
            via <code>IMAB11</code> e IMA-B5+ via <code>B5P211</code> (ETFs proxy, com leve
            tracking error em relação ao índice ANBIMA puro).
          </li>
        </ul>
      </section>
    </div>
  );
}
