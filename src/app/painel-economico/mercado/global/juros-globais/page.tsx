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

      <section className="rounded-2xl border border-[#132960]/10 bg-zinc-50/50 p-4 text-xs text-zinc-600">
        <p className="font-semibold uppercase tracking-wide text-zinc-500">Notas metodológicas</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>
            <strong>EUA (Treasury)</strong>: yields de maturidade constante do Tesouro americano, via FRED
            (séries DGS2/5/10/20/30), fechamento diário (D-1).
          </li>
          <li>
            <strong>Japão (JGB)</strong>: taxas de referência dos títulos do governo japonês publicadas pelo
            Ministério das Finanças (JGB CME), prazos de 1 a 40 anos.
          </li>
          <li>
            <strong>Alemanha (Bund)</strong>: curva estimada (modelo Svensson) dos títulos federais alemães
            publicada pelo Deutsche Bundesbank — referência da zona do euro.
          </li>
          <li>
            <strong>Reino Unido (Gilt)</strong>: par yields nominais dos gilts publicados pelo Bank of England
            (5, 10 e 20 anos — prazos disponíveis gratuitamente).
          </li>
          <li>
            O histórico é mostrado com amostragem semanal para leveza; o último ponto reflete o fechamento mais
            recente de cada fonte. França e China foram deixadas de fora por não terem curva diária completa de
            fonte pública gratuita reproduzível em tempo real.
          </li>
        </ul>
      </section>
    </div>
  );
}
