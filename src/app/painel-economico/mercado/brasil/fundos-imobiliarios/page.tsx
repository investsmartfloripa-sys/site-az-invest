import { Divisor } from "@/components/painel/core";
import { FiiAbas } from "@/components/painel/fii/FiiAbas";
import { FiiArtigosMaisLidos } from "@/components/painel/fii/FiiArtigosMaisLidos";
import { FiiComunidadeCta } from "@/components/painel/fii/FiiComunidadeCta";
import { FiiMacroCharts } from "@/components/painel/fii/FiiMacroCharts";
import { FiiNoticias } from "@/components/painel/fii/FiiNoticias";
import { FiiTijoloModelo, TijoloIfixCard } from "@/components/painel/fii/FiiTijoloModelo";
import { FundosImobiliariosClient } from "@/components/painel/fii/FundosImobiliariosClient";
import {
  getFiiArtigosMaisLidos,
  getFiiIfix,
  getFiiMacroCharts,
  getFiiScreener,
  getFiiTijoloModelo,
  getFiiUltimasNoticias,
} from "@/lib/painel-fii";

export const metadata = {
  title: "Fundos Imobiliários — Ativos de mercado",
  description:
    "Panorama dos FIIs: IFIX vs CDI/IBOV/IMA-B, índice de FIIs de tijolo vs IFIX, comparador de FIIs em retorno total, simulador de carteira, screener com DY, P/VP, PL e liquidez e, na aba Analítico, o índice de tijolo contra o nível que os juros justificam.",
};

export default async function FundosImobiliariosPage() {
  const [ifix, screener, noticias, artigos, macroCharts, tijolo] = await Promise.all([
    getFiiIfix(),
    getFiiScreener(),
    getFiiUltimasNoticias(),
    getFiiArtigosMaisLidos(),
    getFiiMacroCharts(),
    getFiiTijoloModelo(),
  ]);
  const temMacro = !!macroCharts && macroCharts.status === "ok";

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#027DFC]">
          Ativos de mercado · Brasil · Fundos Imobiliários
        </p>
        <h2 className="text-2xl font-semibold text-[#132960]">Panorama FIIs</h2>
        <p className="max-w-3xl text-sm text-zinc-600">
          Na <strong>Visão geral</strong>, o IFIX, o nosso índice de FIIs de tijolo e o universo de FIIs
          listados na B3: clique nos FIIs do screener para compará-los no gráfico (retorno total, com
          proventos), simule uma carteira e explore os múltiplos por ticker. Na aba{" "}
          <strong>Analítico</strong>, onde o índice de tijolo deveria estar pelos juros, com projeção pela
          Selic implícita e um simulador de cenário.
        </p>
      </header>

      <FiiAbas
        visao={
          <FundosImobiliariosClient
            ifix={ifix}
            screener={screener}
            tijolo={tijolo ? <TijoloIfixCard modelo={tijolo} /> : null}
          />
        }
        analitico={
          <>
            {tijolo ? (
              <FiiTijoloModelo modelo={tijolo} />
            ) : (
              <section className="rounded-2xl border border-[#132960]/15 bg-white p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Índice de tijolo × juros</p>
                <p className="mt-2 text-sm text-zinc-500">Em atualização — o dado volta na próxima rodada do pipeline.</p>
              </section>
            )}
            {temMacro ? (
              <div className="space-y-4">
                <Divisor
                  label="Tijolo × papel — P/VP e prêmio sobre a NTN-B"
                  info="Mediana dos 25 FIIs mais líquidos de cada grupo, pela classificação de segmento do screener."
                />
                <FiiMacroCharts data={macroCharts} />
              </div>
            ) : null}
          </>
        }
      />

      {/* Blocos editoriais */}
      <FiiNoticias posts={noticias} />
      <FiiArtigosMaisLidos posts={artigos} />

      {/* CTA Comunidade + Form */}
      <FiiComunidadeCta />

      {/* Notas metodológicas saíram do rodapé (poluição visual): cada uma vive
          no ícone (?) do card correspondente — hero (XFIX11/benchmarks),
          screener (composição IFIX + CVM + DY), simulador (metodologia) e índice de tijolo. */}
    </div>
  );
}
