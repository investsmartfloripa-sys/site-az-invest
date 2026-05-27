import type { VisaoGeralPayload } from "@/lib/painel-visao-geral";
import { formatMes } from "@/lib/painel-visao-geral";

import { BlocoACicloAtual } from "./BlocoA_CicloAtual";
import { BlocoBAntecedentes } from "./BlocoB_Antecedentes";
import { BlocoCConfianca } from "./BlocoC_Confianca";
import { BlocoDHardData } from "./BlocoD_HardData";
import { BlocoECondicoesFinanceiras } from "./BlocoE_CondicoesFinanceiras";
import { FraseManchete } from "./FraseManchete";
import { HeroKpis } from "./HeroKpis";

function FichaTecnica({ payload }: { payload: VisaoGeralPayload }) {
  const fontes = [
    { bloco: "IBC-Br (atividade)", mes: payload.ibcbr?.mes_recente, fonte: "BCB SGS 24363 / 24364", url: "https://dadosabertos.bcb.gov.br/dataset/24363-indice-de-atividade-economica-do-banco-central---ibc-br" },
    { bloco: "CODACE cronologia", mes: null, fonte: "FGV-IBRE - CODACE", url: "https://portalibre.fgv.br/codace-cronologia" },
    { bloco: "Hiato HP+Hamilton", mes: payload.hiato?.mes_recente, fonte: "Calculo proprio sobre IBC-Br", url: "https://www.bcb.gov.br/content/ri/relatorioinflacao/202406/ri202406b10p.pdf" },
    { bloco: "Probabilidade de recessao (5 modelos)", mes: payload.recessao?.mes_recente, fonte: "Calculo proprio", url: "https://blogdoibre.fgv.br/posts/barometros-globais-e-probabilidades-de-recessao-no-atual-cenario-de-aperto-monetario" },
    { bloco: "OECD CLI Brasil", mes: payload.oecdCli?.mes_recente, fonte: "OECD.Stat - BRALOLITOAASTSAM", url: "https://sdmx.oecd.org/" },
    { bloco: "FGV antecedentes", mes: null, fonte: "Portal IBRE - scraper XLSX", url: "https://portalibre.fgv.br/iace-e-icce" },
    { bloco: "FGV confiancas", mes: null, fonte: "Portal IBRE - sondagens", url: "https://portalibre.fgv.br/en/confianca-empresarial" },
    { bloco: "CNI (ICEI + INEC)", mes: null, fonte: "Portal da Industria", url: "https://www.portaldaindustria.com.br/estatisticas/" },
    { bloco: "PMI Brasil (S&P Global)", mes: null, fonte: "S&P Global press release", url: "https://www.pmi.spglobal.com/" },
    { bloco: "Fecomercio SP (ICEC + ICF)", mes: null, fonte: "Fecomercio SP - pesquisas", url: "https://www.fecomercio.com.br/pesquisas/indices" },
    { bloco: "ANFAVEA veiculos", mes: payload.anfavea?.mes_recente, fonte: "ANFAVEA - XLSX consolidado", url: "https://anfavea.com.br/site/edicoes-em-excel/" },
    { bloco: "ANP combustiveis", mes: payload.anp?.mes_recente, fonte: "ANP - dados abertos", url: "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos" },
    { bloco: "EPE energia", mes: payload.epe?.mes_recente, fonte: "EPE - Resenha Mensal", url: "https://www.epe.gov.br/pt/publicacoes-dados-abertos/publicacoes/consumo-de-energia-eletrica" },
    { bloco: "Hard data (ABCR/ABPO/SNIC/Aco/FENABRAVE)", mes: null, fonte: "Scrapers defensivos", url: "https://www.empapel.org.br/publicacoes/boletim-estatistico/" },
    { bloco: "Credito e agregados", mes: null, fonte: "BCB SGS 20662, 20635, 20571, 20572, 27788-27791", url: "https://dadosabertos.bcb.gov.br/" },
    { bloco: "ICF proprio", mes: payload.icf?.mes_recente, fonte: "Calculo proprio: Selic real + Ibov 6m + REER", url: "https://www.bcb.gov.br/" },
  ];
  return (
    <details className="rounded-xl border border-zinc-200 bg-white p-4 text-sm">
      <summary className="cursor-pointer font-semibold text-zinc-900">Ficha tecnica e fontes</summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="border-b border-zinc-200 text-left text-zinc-600">
            <tr><th className="py-2 pr-3">Bloco</th><th className="py-2 pr-3">Ultima obs.</th><th className="py-2 pr-3">Fonte primaria</th></tr>
          </thead>
          <tbody>
            {fontes.map((f) => (
              <tr key={f.bloco} className="border-b border-zinc-100">
                <td className="py-2 pr-3 font-medium text-zinc-900">{f.bloco}</td>
                <td className="py-2 pr-3 text-zinc-600">{f.mes ? formatMes(f.mes) : "—"}</td>
                <td className="py-2 pr-3 text-zinc-600">{f.url ? <a className="text-[#027DFC] hover:underline" href={f.url} target="_blank" rel="noopener noreferrer">{f.fonte}</a> : f.fonte}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[11px] text-zinc-500">Pipeline diario roda as 22:00 UTC. Cada bloco tem flag de freshness (fresh/stale/missing) - quando uma fonte atrasa, o painel segue rendendo com o resto.</p>
      </div>
    </details>
  );
}

export function VisaoGeralDashboard({ payload }: { payload: VisaoGeralPayload }) {
  const codaceMensal = payload.codace?.mensal ?? [];
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-[#132960]">Termometro do Ciclo Brasileiro</h1>
        <p className="text-sm text-zinc-600">Sintese prospectiva da atividade economica brasileira. Combina indicadores antecedentes, hard data fisico e condicoes financeiras com cinco modelos diferentes de probabilidade de recessao.</p>
      </header>
      <FraseManchete payload={payload} />
      <HeroKpis payload={payload} />
      <BlocoACicloAtual payload={payload} />
      <BlocoBAntecedentes oecdCli={payload.oecdCli} fgvAntecedentes={payload.fgvAntecedentes} codace={codaceMensal} />
      <BlocoCConfianca fgvConfianca={payload.fgvConfianca} cni={payload.cni} pmi={payload.pmi} fecomercio={payload.fecomercio} />
      <BlocoDHardData anfavea={payload.anfavea} anp={payload.anp} epe={payload.epe} hardData={payload.hardData} />
      <BlocoECondicoesFinanceiras icf={payload.icf} credito={payload.credito} />
      <FichaTecnica payload={payload} />
    </div>
  );
}
