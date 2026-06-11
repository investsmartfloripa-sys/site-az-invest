import type { Metadata } from "next";
import Link from "next/link";

import { ContasExternasDashboard } from "@/components/painel/contas-externas/ContasExternasDashboard";
import { loadContasExternas, loadContasExternasComex } from "@/lib/painel-contas-externas";

export const metadata: Metadata = {
  title: "Contas Externas — AZ Invest",
  description:
    "Balanço de pagamentos, investimento direto, reservas internacionais e comércio exterior por produto e destino. Dados BCB (BPM6) e SECEX/MDIC (Comex Stat), atualização automática diária.",
};

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export default async function PainelContasExternasPage() {
  const [data, comex] = await Promise.all([loadContasExternas(), loadContasExternasComex()]);

  if (!data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        Não foi possível carregar os dados de Contas Externas agora. Tente recarregar em alguns minutos.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sub-páginas de Contas Externas (mesmo padrão de cards de Atividade). */}
      <Link
        href="/painel-economico/economia/brasil/contas-externas/cambio"
        className="group block rounded-2xl border border-[#132960]/15 bg-white p-5 shadow-sm transition hover:border-[#027DFC] hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#132960] group-hover:text-[#027DFC]">Câmbio econômico</h2>
            <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
              BCB/SGS + FRED — sub-área de Contas Externas
            </p>
            <p className="mt-2 text-sm text-zinc-600">
              O real está caro ou barato em termos reais? Câmbio real (REER e bilateral deflacionado), paridade de
              juros Selic−Fed e o teste da UIP na prática.
            </p>
          </div>
          <span
            className="text-xl text-zinc-300 transition group-hover:translate-x-1 group-hover:text-[#027DFC]"
            aria-hidden="true"
          >
            →
          </span>
        </div>
      </Link>

      <ContasExternasDashboard data={data} comex={comex} />
    </div>
  );
}
