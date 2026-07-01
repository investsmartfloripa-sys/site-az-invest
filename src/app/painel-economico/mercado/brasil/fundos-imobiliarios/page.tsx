import { FiiArtigosMaisLidos } from "@/components/painel/fii/FiiArtigosMaisLidos";
import { FiiComunidadeCta } from "@/components/painel/fii/FiiComunidadeCta";
import { FiiMacroCharts } from "@/components/painel/fii/FiiMacroCharts";
import { FiiNoticias } from "@/components/painel/fii/FiiNoticias";
import { FundosImobiliariosClient } from "@/components/painel/fii/FundosImobiliariosClient";
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
    "Panorama dos FIIs: IFIX vs CDI/IBOV/IMA-B, comparador de FIIs em retorno total, simulador de carteira e screener completo com DY, P/VP, PL e liquidez.",
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
          Clique nos FIIs do screener para compará-los no gráfico (retorno total, com proventos),
          simule uma carteira e explore os múltiplos por ticker (DY 12m, P/VP, PL, liquidez).
        </p>
      </header>

      {/* Hero IFIX + comparador + tabela + simulador + screener (seleção) */}
      <FundosImobiliariosClient ifix={ifix} screener={screener} />

      {/* Macro charts (P/VP histórico + Prêmio NTN-B vs DY tijolo) */}
      {macroCharts && macroCharts.status === "ok" ? (
        <FiiMacroCharts data={macroCharts} />
      ) : null}

      {/* Blocos editoriais */}
      <FiiNoticias posts={noticias} />
      <FiiArtigosMaisLidos posts={artigos} />

      {/* CTA Comunidade + Form */}
      <FiiComunidadeCta />

      {/* Notas metodológicas saíram do rodapé (poluição visual): cada uma vive
          no ícone (?) do card correspondente — hero (XFIX11/benchmarks),
          screener (composição IFIX + CVM + DY) e simulador (metodologia). */}
    </div>
  );
}
