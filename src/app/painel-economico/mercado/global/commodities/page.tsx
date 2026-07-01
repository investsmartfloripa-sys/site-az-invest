import type { Metadata } from "next";

import { CommoditiesDashboard } from "@/components/painel/commodities/CommoditiesDashboard";
import { PipelinePendingCard } from "@/components/painel/PipelinePendingCard";
import {
  EMPTY_HISTORY_SLICE,
  getCommoditiesReturnsPanorama,
  getHistorySlice,
} from "@/lib/painel-mercado-global";

export const metadata: Metadata = {
  title: "Commodities — Ativos de mercado",
  description:
    "Retornos de energia, metais e agro em USD e BRL por período, e histórico comparativo de 5 anos dos futuros (Brent, WTI, ouro, café, soja e mais).",
};

export const revalidate = 3600;

/** Tickers de futuros usados no histórico comparativo (presets Energia/Metais/Agro BR). */
const HISTORY_TICKERS = [
  { ticker: "BZ=F" },
  { ticker: "CL=F" },
  { ticker: "NG=F" },
  { ticker: "GC=F" },
  { ticker: "SI=F" },
  { ticker: "HG=F" },
  { ticker: "KC=F" },
  { ticker: "SB=F" },
  { ticker: "ZS=F" },
  { ticker: "ZC=F" },
];

export default async function CommoditiesPage() {
  const [panorama, history] = await Promise.all([
    getCommoditiesReturnsPanorama(),
    getHistorySlice(HISTORY_TICKERS).catch(() => EMPTY_HISTORY_SLICE),
  ]);

  const nothingLoaded = !panorama && history.series.length === 0;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#027DFC]">
          Ativos de mercado · Global · Commodities
        </p>
        <h2 className="text-2xl font-semibold text-[#132960]">Energia, metais e agro</h2>
        <p className="max-w-3xl text-sm text-zinc-600">
          Retornos dos 17 futuros acompanhados pelo pipeline em janelas de 1 dia a 1 ano, agrupados
          por setor e com leitura em <strong>dólar ou em real</strong> — a mesma commodity pode subir
          em US$ e cair em R$ quando o câmbio anda mais que o preço. Abaixo, o histórico de 5 anos
          permite comparar a trajetória dos futuros dentro de cada grupo.
        </p>
      </header>

      {nothingLoaded ? (
        <PipelinePendingCard
          blobPaths={["data/commodities_returns_panorama.json", "data/market_history_full.json"]}
          workflow="data-pipeline.yml / market-data.yml"
        />
      ) : (
        // Sem <Suspense>: AzPeriodSelector não usa mais useSearchParams (sem CSR
        // bailout) e um boundary aqui quebraria a hidratação no Next 16.2.4.
        <CommoditiesDashboard panorama={panorama} history={history} />
      )}

      <section className="rounded-2xl border border-[#132960]/10 bg-zinc-50/50 p-4 text-xs text-zinc-600">
        <p className="font-semibold uppercase tracking-wide text-zinc-500">Notas metodológicas</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>
            <strong>Futuros front-month contínuos</strong> do Yahoo Finance (ex.: <code>BZ=F</code>,{" "}
            <code>GC=F</code>): o retorno reflete o contrato mais próximo, sujeito a efeito de
            rolagem — não é idêntico ao retorno à vista.
          </li>
          <li>
            <strong>USD × BRL</strong>: o retorno em BRL converte o preço em dólar pela variação do
            USD/BRL no mesmo período (real forte reduz o retorno em R$ e vice-versa).
          </li>
          <li>
            <strong>Setores</strong>: Energia (Brent, WTI, gás), Metais (ouro, prata, cobre, platina,
            paládio, minério) e Agro consolidando Agrícola (soja, milho, trigo), Softs (café, açúcar,
            algodão) e Pecuária (boi gordo, suínos).
          </li>
          <li>
            <strong>Histórico comparativo</strong>: fechamentos diários de 5 anos em US$
            (market-data, 1x/dia útil), rebase 100 no início da janela selecionada.
          </li>
        </ul>
      </section>
    </div>
  );
}
