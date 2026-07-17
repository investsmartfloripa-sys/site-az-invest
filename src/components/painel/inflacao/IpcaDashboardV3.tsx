"use client";

import { useMemo, useState } from "react";

import type { IpcaData } from "@/lib/painel-ipca";
import { KpiCard } from "@/components/painel/core";
import { fmtMesCurto, fmtMesLongo, fmtPct, fmtSignedPct } from "@/lib/format-br";
import { AnchorContribuicoes } from "./v2/AnchorContribuicoes";
import { NucleosCard } from "./v2/NucleosCard";
import { AberturaCards } from "./v2/AberturaCards";
import { DifusaoCard } from "./v2/DifusaoCard";
import { SazonalidadeCard } from "./v2/SazonalidadeCard";
import { InfluenciasCard } from "./v2/InfluenciasCard";
import { FocusCard } from "./v2/FocusCard";
import { AnaliseCompleta } from "./v2/AnaliseCompleta";
import { num } from "./v2/shared";
import { TabelaSinteseCard } from "./v3/TabelaSinteseCard";
import { GruposMesCard } from "./v3/GruposMesCard";
import { HeatmapGruposCard } from "./v3/HeatmapGruposCard";
import { TabelaHierarquicaCard } from "./v3/TabelaHierarquicaCard";
import { MomentumCard } from "./v3/MomentumCard";
import { TabelaNucleosCard } from "./v3/TabelaNucleosCard";
import { SerieLongaCard } from "./v3/SerieLongaCard";
import { AnualMetaCard } from "./v3/AnualMetaCard";
import { AncoragemCard } from "./v3/AncoragemCard";
import { FocusMensalCard } from "./v3/FocusMensalCard";
import { SurpresasCard } from "./v3/SurpresasCard";

/**
 * Painel IPCA v3 — tabs de ESCRUTÍNIO (padrão Termômetro de Ciclo/CAGED):
 * a série destrinchada em tabelas e gráficos, sem manchete narrativa.
 * Referências de repertório: Carta de Conjuntura (IPEA) e boletins FGV/IBRE.
 *
 * Regras herdadas do v2 (inegociáveis):
 * - todo acumulado/dessaz/SAAR nasce no builder (schema v3), nunca aqui;
 * - meta e réguas históricas visíveis em todo gráfico de nível;
 * - semântica de inflação: alta = vermelho (pressão), queda = azul.
 *
 * O contrato do robô de publicação (data/ipca_release.json) espelha a tab
 * "Leitura do mês" — o que se vê aqui é o que o robô lê lá.
 */

type Vista = "leitura" | "composicao" | "nucleos" | "tendencia" | "expectativas" | "series";

const TABS: { value: Vista; label: string; descr: string }[] = [
  {
    value: "leitura",
    label: "1. Leitura do mês",
    descr: "A última divulgação destrinchada: realizado × esperado (Focus da véspera), tabela-síntese por recorte, contribuição dos grupos, maiores influências e posição no padrão sazonal",
  },
  {
    value: "composicao",
    label: "2. Composição",
    descr: "De onde vem a inflação acumulada: contribuições ao 12m por grupo, heatmap grupos × meses e a abertura hierárquica grupo → subgrupo → item",
  },
  {
    value: "nucleos",
    label: "3. Núcleos & difusão",
    descr: "Tendência subjacente: 5 núcleos do BC em 12m, momentum dessazonalizado (SAAR 3m/6m), tabela por transformação, categorias econômicas e índice de difusão",
  },
  {
    value: "tendencia",
    label: "4. Tendência",
    descr: "Séries longas desde 1999: IPCA 12m contra a meta escalonada do CMN e o fechamento de cada ano-calendário contra a banda",
  },
  {
    value: "expectativas",
    label: "5. Expectativas",
    descr: "Focus completo: anos-calendário, 12 meses à frente (ancoragem), curtíssimo prazo mensal e o histórico de surpresas realizado × consenso",
  },
  {
    value: "series",
    label: "6. Série completa",
    descr: "Explorador da série com múltiplas transformações e download dos dados em CSV",
  },
];

export function IpcaDashboardV3({ data }: { data: IpcaData }) {
  const [vista, setVista] = useState<Vista>("leitura");
  const mesRef = data.mes_recente;
  const tabAtiva = TABS.find((t) => t.value === vista) ?? TABS[0];

  const derivados = useMemo(() => {
    const ultima = data.ipca_cheio.serie.find((r) => r.mes === mesRef);
    const ipcaM = num(ultima, "IPCA cheio");
    const ipca12m = num(ultima, "IPCA 12m");
    const sazMes = data.sazonalidade?.por_mes[mesRef.slice(5, 7)];
    const medianaSaz = sazMes?.mediana ?? null;
    const nucU = data.nucleos.serie_12m?.[data.nucleos.serie_12m.length - 1];
    const mediaNucleos = nucU ? num(nucU, "media_nucleos") : null;
    const difU = data.difusao.serie[data.difusao.serie.length - 1];
    const difusaoM = typeof difU?.difusao === "number" ? difU.difusao : null;
    const difMedia = data.difusao.media_historica?.media ?? null;
    const esperado = data.focus_mensal?.vespera?.mediana ?? null;
    const surpresa = ipcaM != null && esperado != null ? ipcaM - esperado : null;
    return { ipcaM, ipca12m, medianaSaz, mediaNucleos, difusaoM, difMedia, esperado, surpresa };
  }, [data, mesRef]);

  const { ipcaM, ipca12m, medianaSaz, mediaNucleos, difusaoM, difMedia, esperado, surpresa } = derivados;

  const stamps = [data.gerado_em].filter(Boolean);
  const atualizadoEm = stamps.length
    ? new Date(stamps[0]).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      })
    : null;

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-[#132960]/10 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-[#132960]">Painel IPCA</h1>
            <p className="mt-1 text-sm text-zinc-600">
              A série destrinchada em seis vistas: leitura da divulgação, composição, núcleos, tendência, expectativas e
              a série completa.
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Referência: {fmtMesLongo(mesRef)} · IPCA-15 até {fmtMesCurto(data.ipca_15.mes_recente)}
            </p>
          </div>
          {atualizadoEm ? (
            <span className="text-[10px] text-zinc-500" title="Última geração do JSON do pipeline">
              Atualizado: {atualizadoEm} UTC · pipeline diário
            </span>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="IPCA do mês"
          value={fmtSignedPct(ipcaM, 2)}
          delta={surpresa ?? (ipcaM != null && medianaSaz != null ? ipcaM - medianaSaz : null)}
          deltaUnit="p.p."
          deltaHint={surpresa != null ? "vs Focus véspera" : "vs padrão do mês"}
          invertColor
          hint={
            esperado != null
              ? `Focus véspera: ${fmtSignedPct(esperado, 2)}`
              : medianaSaz != null
                ? `mediana hist.: ${fmtSignedPct(medianaSaz, 2)}`
                : undefined
          }
        />
        <KpiCard
          label="IPCA 12 meses"
          value={fmtPct(ipca12m, 2)}
          delta={ipca12m != null ? ipca12m - 3.0 : null}
          deltaUnit="p.p."
          deltaHint="vs meta 3,0%"
          invertColor
          hint="banda: 1,5% a 4,5%"
        />
        <KpiCard
          label="Núcleos 12m (média)"
          value={fmtPct(mediaNucleos, 2)}
          delta={mediaNucleos != null ? mediaNucleos - 3.0 : null}
          deltaUnit="p.p."
          deltaHint="vs meta 3,0%"
          invertColor
          hint="EX0 · EX3 · MS · DP · P"
        />
        <KpiCard
          label="Difusão do mês"
          value={fmtPct(difusaoM, 1)}
          delta={difusaoM != null && difMedia != null ? difusaoM - difMedia : null}
          deltaUnit="p.p."
          deltaHint={`vs média ${data.difusao.media_historica?.desde.slice(0, 4) ?? "hist."}+`}
          invertColor
          hint="% de subitens em alta"
        />
      </div>

      {/* Tabs (espelha padrão Termômetro de Ciclo/CAGED) */}
      <div className="space-y-1">
        <div className="flex flex-wrap gap-1 border-b border-zinc-200">
          {TABS.map((t) => {
            const ativa = t.value === vista;
            return (
              <button
                key={t.value}
                onClick={() => setVista(t.value)}
                className={`relative -mb-px px-3 py-2 text-sm font-semibold transition md:px-4 ${
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
        <p className="px-1 text-[11px] text-zinc-500">{tabAtiva.descr}</p>
      </div>

      <div>
        {vista === "leitura" ? (
          <div className="space-y-6">
            {data.tabela_sintese ? <TabelaSinteseCard sintese={data.tabela_sintese} geradoEm={data.gerado_em} /> : null}
            {data.abertura_hierarquica ? (
              <GruposMesCard hierarquia={data.abertura_hierarquica} mesRef={mesRef} geradoEm={data.gerado_em} />
            ) : null}
            <InfluenciasCard data={data} />
            <SazonalidadeCard data={data} />
          </div>
        ) : null}

        {vista === "composicao" ? (
          <div className="space-y-6">
            <AnchorContribuicoes indice={data.ipca_cheio} geradoEm={data.gerado_em} />
            <HeatmapGruposCard indice={data.ipca_cheio} geradoEm={data.gerado_em} />
            {data.abertura_hierarquica ? (
              <TabelaHierarquicaCard hierarquia={data.abertura_hierarquica} mesRef={mesRef} geradoEm={data.gerado_em} />
            ) : null}
          </div>
        ) : null}

        {vista === "nucleos" ? (
          <div className="space-y-6">
            <NucleosCard nucleos={data.nucleos} geradoEm={data.gerado_em} />
            {data.momentum ? <MomentumCard momentum={data.momentum} geradoEm={data.gerado_em} /> : null}
            {data.tabela_sintese ? (
              <TabelaNucleosCard sintese={data.tabela_sintese} momentum={data.momentum} geradoEm={data.gerado_em} />
            ) : null}
            <AberturaCards categorias={data.categorias} nucleos={data.nucleos} geradoEm={data.gerado_em} />
            <DifusaoCard difusao={data.difusao} geradoEm={data.gerado_em} />
          </div>
        ) : null}

        {vista === "tendencia" ? (
          <div className="space-y-6">
            {data.serie_longa ? <SerieLongaCard longa={data.serie_longa} geradoEm={data.gerado_em} /> : null}
            {data.serie_longa ? <AnualMetaCard longa={data.serie_longa} geradoEm={data.gerado_em} /> : null}
          </div>
        ) : null}

        {vista === "expectativas" ? (
          <div className="space-y-6">
            {data.focus && Object.keys(data.focus).length > 0 ? (
              <FocusCard focus={data.focus} geradoEm={data.gerado_em} />
            ) : null}
            {data.focus_12m && data.focus_12m.length > 0 ? (
              <AncoragemCard focus12m={data.focus_12m} geradoEm={data.gerado_em} />
            ) : null}
            {data.focus_mensal ? (
              <FocusMensalCard focusMensal={data.focus_mensal} realizadoMes={ipcaM} geradoEm={data.gerado_em} />
            ) : null}
            {data.focus_mensal && data.focus_mensal.surpresas.length > 0 ? (
              <SurpresasCard focusMensal={data.focus_mensal} geradoEm={data.gerado_em} />
            ) : null}
          </div>
        ) : null}

        {vista === "series" ? (
          <div className="space-y-6">
            <AnaliseCompleta data={data} />
          </div>
        ) : null}
      </div>

      <details className="group rounded-2xl border border-[#132960]/10 bg-white p-4 shadow-sm">
        <summary className="cursor-pointer select-none text-sm font-semibold text-[#132960] marker:text-[#027DFC]">
          Ficha técnica — fontes e metodologia
        </summary>
        <div className="mt-3 space-y-2 text-xs leading-relaxed text-zinc-600">
          <p>
            <strong>Fontes e séries.</strong> IBGE/SIDRA tabela 7060 (IPCA: v63 variação mensal, v66 peso, v69 acumulada
            no ano, v2265 acumulada 12m; Índice geral + 9 grupos na janela de 72m; TODOS os níveis c315 no mês corrente
            p/ hierarquia e influências) e tabela 7062 (IPCA-15: v355/v357/v1120). BCB/SGS: 433 (IPCA mensal desde 1980;
            série longa desde 1999), 13522 (12m oficial), núcleos 4466 (MA), 16121 (MS), 11427 (EX0), 27838 (EX3), 27839
            (DP), 28751 (P), difusão 21379, categorias 4448 (livres), 4449 (monitorados), 11428 (serviços), 27864
            (comercializáveis). BCB/Olinda: ExpectativasMercadoAnuais, ExpectativaMercadoMensais (baseCalculo = 0) e
            ExpectativasMercadoInflacao12Meses (suavizada). Última observação: {fmtMesLongo(mesRef)}.
          </p>
          <p>
            <strong>Metodologia — honestidade de cálculo.</strong> Todo acumulado de 12 meses é COMPOSTO (Π(1+v/100)−1),
            nunca soma aritmética; contribuições 12m encadeadas com resíduo realocado pró-rata p/ fechar com o oficial.
            Momentum: dessazonalização STL sobre o log do índice encadeado (período 12, robusta) — método próprio, NÃO o
            X-13 do BCB — e SAAR = janela de 3/6 meses dessaz anualizada geometricamente; ajuste desde 2004, publicação
            desde 2012. Surpresa inflacionária = realizado − mediana da última pesquisa Focus antes da divulgação (o BC
            encerra a coleta do mês no release do IBGE). Metas do CMN por resolução (2003-04 nas versões ajustadas);
            regime de meta CONTÍNUA de 3,0% ± 1,5 p.p. desde 2025.
          </p>
          <p>
            <strong>Réguas.</strong> Meta contínua 3,0% ± 1,5 p.p. em todo gráfico de nível; difusão contra média ± dp
            desde {data.difusao.media_historica?.desde ?? "2012-01"}; sazonalidade por mês civil na janela{" "}
            {data.sazonalidade?.janela ?? "—"} (mediana/mín–máx); “em linha” = desvio ≤ 0,05 p.p.
          </p>
          <p>
            <strong>Contrato de máquina.</strong> A leitura do mês é publicada também em JSON estável
            (data/ipca_release.json, schema v1): headline, expectativa da véspera + surpresa, posição sazonal
            (percentil), grupos, núcleos (12m e SAAR), difusão, top influências e Focus adiante — insumo de automações
            editoriais.
          </p>
          <p>Pipeline: data-pipeline/python/build_ipca.py (schema v3) · atualização diária via GitHub Actions.</p>
        </div>
      </details>
    </div>
  );
}
