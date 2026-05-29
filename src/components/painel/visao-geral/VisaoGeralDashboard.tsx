"use client";

import { useState } from "react";

import type { VisaoGeralPayload } from "@/lib/painel-visao-geral";
import { formatMes } from "@/lib/painel-visao-geral";

import { BlocoACicloAtual } from "./BlocoA_CicloAtual";
import { BlocoBAntecedentes } from "./BlocoB_Antecedentes";
import { BlocoCConfianca } from "./BlocoC_Confianca";
import { BlocoDHardData } from "./BlocoD_HardData";
import { BlocoECondicoesFinanceiras } from "./BlocoE_CondicoesFinanceiras";
import { FraseManchete } from "./FraseManchete";
import { HeroKpis } from "./HeroKpis";
import { TermometroSintese } from "./TermometroSintese";

type Vista = "geral" | "antecedentes" | "coincidentes";

const TABS: { value: Vista; label: string; descr: string }[] = [
  { value: "geral", label: "1. Geral", descr: "Termômetro Síntese + 5 modelos de probabilidade de recessão + hiato HP+Hamilton + ICF próprio (Hatzius) + crédito/PIB" },
  { value: "antecedentes", label: "2. Antecedentes", descr: "Séries que lideram o PIB em 3-12 meses: OCDE CLI, sondagens FGV/CNI, PIM duráveis/capital, slope DI, Ibov real, EMBI+, Selic real, concessões reais, FENABRAVE" },
  { value: "coincidentes", label: "3. Coincidentes", descr: "Séries que movem com o PIB: quartet TCB (PIM-PF produção, PMC vendas, PNAD emprego), IBC-Br, EPE, ANP, papelão, aço, ANFAVEA, PMS serviços" },
];

function FichaTecnica({ payload }: { payload: VisaoGeralPayload }) {
  const fontes = [
    { bloco: "IBC-Br (atividade)", mes: payload.ibcbr?.mes_recente, fonte: "BCB SGS 24363 / 24364", url: "https://dadosabertos.bcb.gov.br/dataset/24363-indice-de-atividade-economica-do-banco-central---ibc-br" },
    { bloco: "CODACE cronologia", mes: null, fonte: "FGV-IBRE - CODACE", url: "https://portalibre.fgv.br/codace-cronologia" },
    { bloco: "Hiato HP+Hamilton", mes: payload.hiato?.mes_recente, fonte: "Cálculo próprio sobre IBC-Br", url: "https://www.bcb.gov.br/" },
    { bloco: "Probabilidade de recessão", mes: payload.recessao?.mes_recente, fonte: "5 modelos: MS-AR + Probit + Gap HP + Diffusion + Bry-Boschan", url: "https://blogdoibre.fgv.br/" },
    { bloco: "OECD CLI Brasil", mes: payload.oecdCli?.mes_recente, fonte: "DBnomics - OECD MEI_CLI BR (em rodapé, defasagem >12m)", url: "https://db.nomics.world/" },
    { bloco: "FGV confianças", mes: null, fonte: "BCB SGS 21859-21866 (ICE/ICI/ICOM/ICS/ICST/ICA/ICC)", url: "https://portalibre.fgv.br/" },
    { bloco: "CNI (ICEI)", mes: null, fonte: "BCB SGS 7341-7343", url: "https://www.portaldaindustria.com.br/" },
    { bloco: "PIM-PF (oficial IBGE)", mes: payload.atividadePim?.mes_recente, fonte: "SIDRA tabela 8888 (base 2022=100)", url: "https://sidra.ibge.gov.br/" },
    { bloco: "ANFAVEA veículos", mes: payload.anfavea?.mes_recente, fonte: "ANFAVEA - XLSX consolidado", url: "https://anfavea.com.br/" },
    { bloco: "ANP combustíveis", mes: payload.anp?.mes_recente, fonte: "ANP - dados abertos", url: "https://www.gov.br/anp/" },
    { bloco: "EPE energia", mes: payload.epe?.mes_recente, fonte: "EPE - Resenha Mensal", url: "https://www.epe.gov.br/" },
    { bloco: "Hard data IPEADATA", mes: null, fonte: "Papelao ABPO + Aco bruto + FENABRAVE (espelho IPEA)", url: "http://ipeadata.gov.br" },
    { bloco: "Crédito e agregados", mes: null, fonte: "BCB SGS 20662, 20635, 20571, 20572, 27788-27791", url: "https://dadosabertos.bcb.gov.br/" },
    { bloco: "ICF próprio (Hatzius 50/25/25)", mes: payload.icf?.mes_recente, fonte: "Selic real ex-ante + Ibov 6m + REER (ref BCB WP 305)", url: "https://www.bcb.gov.br/" },
  ];
  return (
    <details className="rounded-xl border border-zinc-200 bg-white p-4 text-sm">
      <summary className="cursor-pointer font-semibold text-zinc-900">Ficha técnica e fontes</summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="border-b border-zinc-200 text-left text-zinc-600">
            <tr><th className="py-2 pr-3">Bloco</th><th className="py-2 pr-3">Última obs.</th><th className="py-2 pr-3">Fonte primária</th></tr>
          </thead>
          <tbody>
            {fontes.map((f) => (
              <tr key={f.bloco} className="border-b border-zinc-100">
                <td className="py-2 pr-3 font-medium text-zinc-900">{f.bloco}</td>
                <td className="py-2 pr-3 text-zinc-600">{f.mes ? formatMes(f.mes) : "-"}</td>
                <td className="py-2 pr-3 text-zinc-600">{f.url ? <a className="text-[#027DFC] hover:underline" href={f.url} target="_blank" rel="noopener noreferrer">{f.fonte}</a> : f.fonte}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[11px] text-zinc-500">Pipeline diário roda às 22:00 UTC. Cada bloco tem flag de freshness (fresh/stale/missing); quando uma fonte atrasa, o painel segue rendendo com o resto.</p>
      </div>
    </details>
  );
}

export function VisaoGeralDashboard({ payload }: { payload: VisaoGeralPayload }) {
  const [vista, setVista] = useState<Vista>("geral");
  const codaceMensal = payload.codace?.mensal ?? [];

  const tabAtiva = TABS.find((t) => t.value === vista) ?? TABS[0];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-[#132960]">Termômetro do Ciclo Brasileiro</h1>
          {(() => {
            const stamps = [
              payload.recessao?.gerado_em,
              payload.ibcbr?.gerado_em,
              payload.icf?.gerado_em,
              payload.atividadePim?.gerado_em,
            ].filter(Boolean) as string[];
            if (stamps.length === 0) return null;
            const maisRecente = stamps.sort().reverse()[0];
            const data = new Date(maisRecente);
            const fmt = data.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
            return (
              <span className="text-[10px] text-zinc-500" title="Última geração dos JSONs do pipeline">
                Atualizado: {fmt} UTC · pipeline diário 22:00 UTC
              </span>
            );
          })()}
        </div>
        <p className="text-sm text-zinc-600">Síntese prospectiva da atividade econômica brasileira. Combina indicadores antecedentes, hard data físico e condições financeiras com cinco modelos diferentes de probabilidade de recessão.</p>
      </header>

      <FraseManchete payload={payload} />
      <HeroKpis payload={payload} />

      {/* Tabs (espelha padrão CAGED/PNAD) */}
      <div className="space-y-1">
        <div className="flex flex-wrap gap-1 border-b border-zinc-200">
          {TABS.map((t) => {
            const ativa = t.value === vista;
            return (
              <button
                key={t.value}
                onClick={() => setVista(t.value)}
                className={`relative -mb-px px-4 py-2 text-sm font-semibold transition ${
                  ativa
                    ? "border-b-2 border-[#132960] text-[#132960]"
                    : "border-b-2 border-transparent text-zinc-500 hover:text-zinc-800"
                }`}
                aria-current={ativa ? "page" : undefined}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-zinc-500 px-1">{tabAtiva.descr}</p>
      </div>

      {/* Conteudo da tab ativa */}
      <div>
        {vista === "geral" && (
          <div className="space-y-6">
            <TermometroSintese payload={payload} />
            <BlocoACicloAtual payload={payload} />
            <BlocoECondicoesFinanceiras icf={payload.icf} credito={payload.credito} />
          </div>
        )}
        {vista === "antecedentes" && (
          <BlocoBAntecedentes oecdCli={payload.oecdCli} fgvAntecedentes={payload.fgvAntecedentes} codace={codaceMensal} icf={payload.icf} credito={payload.credito} ipeadata={payload.ipeadata} atividadePim={payload.atividadePim} fgvConfianca={payload.fgvConfianca} cni={payload.cni} antecedentesFin={payload.antecedentesFin} />
        )}
        {vista === "coincidentes" && (
          <BlocoDHardData anfavea={payload.anfavea} anp={payload.anp} epe={payload.epe} hardData={payload.hardData} ipeadata={payload.ipeadata} atividadePim={payload.atividadePim} atividadePmc={payload.atividadePmc} empregoPnad={payload.empregoPnad} atividadePms={payload.atividadePms} ibcbr={payload.ibcbr} pnadRenda={payload.pnadRenda} codace={codaceMensal} />
        )}
      </div>

      <FichaTecnica payload={payload} />
    </div>
  );
}
