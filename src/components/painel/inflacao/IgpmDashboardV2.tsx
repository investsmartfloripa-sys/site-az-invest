"use client";

import { useMemo } from "react";

import type { IgpmData } from "@/lib/painel-igpm";
import { DashboardScaffold, KpiCard, type DashboardBloco } from "@/components/painel/core";
import { fmtMesCurto, fmtMesLongo, fmtNum, fmtPct, fmtSignedPct } from "@/lib/format-br";
import { leituraSazonal } from "./v2/shared";
import { AnchorDecomposicao } from "./v2igpm/AnchorDecomposicao";
import { ComponentesCard } from "./v2igpm/ComponentesCard";
import { AntecipaIpcaCard } from "./v2igpm/AntecipaIpcaCard";
import { AluguelCard } from "./v2igpm/AluguelCard";
import { AnaliseCompletaIgpm } from "./v2igpm/AnaliseCompletaIgpm";
import { leituraAluguel, leituraSpreadCurta, num } from "./v2igpm/shared";

/**
 * Painel IGP-M v2 — mesmo molde narrativo do IPCA v2 (DashboardScaffold):
 * manchete em prosa + 4 KPIs com régua + âncora de decomposição + blocos
 * numerados + análise completa + ficha técnica.
 *
 * Regras de ouro herdadas do plano 2026-06-11:
 * - acumulado 12m SEMPRE composto e SEMPRE vindo do builder (o "12m
 *   empilhado" por soma aritmética dava 1,46% vs 1,00% — aposentado);
 * - decomposição com pesos EFETIVOS encadeados e resíduo EXPLÍCITO
 *   (os fixos 60/30/10 escondiam 0,24 p.p. já na leitura mensal);
 * - IPCA aparece como referência em cinza tracejado (régua, não protagonista);
 * - títulos afirmativos gerados por regra (thresholds em v2igpm/shared.ts);
 * - estatísticas históricas truncadas ao pós-Real (jan/1996+).
 *
 * Requer igpm.json com schema_version >= 2 (a page faz o fallback pro v1).
 */
export function IgpmDashboardV2({ data }: { data: IgpmData }) {
  const mesRef = data.mes_recente;

  const derivados = useMemo(() => {
    const igpmMes = data.overview.ultimo_mensal;
    const igpm12m = data.overview.ultimo_12m;

    const sazMes = data.overview.sazonalidade_pos96?.[mesRef.slice(5, 7)];
    const medianaSaz = sazMes?.mediana ?? null;

    // IPCA 12m mais recente disponível (o IGP-M sai antes do IPCA no mês corrente).
    let ipca12m: number | null = null;
    let ipcaMes: string | null = null;
    for (let i = data.comparativo_ipca.length - 1; i >= 0; i--) {
      const r = data.comparativo_ipca[i];
      if (r.ipca_12m != null) {
        ipca12m = r.ipca_12m;
        ipcaMes = r.mes;
        break;
      }
    }

    const ipa = data.componentes["IPA-M"];
    const incc = data.componentes["INCC-M"];

    const decompU = data.decomposicao?.serie[data.decomposicao.serie.length - 1];
    const pesoIpa = decompU ? num(decompU, "IPA-M (peso efetivo)") : null;

    return {
      igpmMes,
      igpm12m,
      medianaSaz,
      ipca12m,
      ipcaMes,
      ipa12m: ipa?.ultimo_12m ?? null,
      ipaMedia: ipa?.estatisticas_12m?.media ?? null,
      ipaPercentil: ipa?.estatisticas_12m?.percentil_atual ?? null,
      incc12m: incc?.ultimo_12m ?? null,
      inccMedia: incc?.estatisticas_12m?.media ?? null,
      percentil12m: data.overview.estatisticas_12m?.percentil_atual ?? null,
      pesoIpa,
    };
  }, [data, mesRef]);

  const {
    igpmMes,
    igpm12m,
    medianaSaz,
    ipca12m,
    ipcaMes,
    ipa12m,
    ipaMedia,
    ipaPercentil,
    incc12m,
    inccMedia,
    percentil12m,
    pesoIpa,
  } = derivados;

  // ── Manchete em prosa, gerada por regra (thresholds em v2igpm/shared.ts) ──
  const manchete = useMemo(() => {
    if (igpmMes == null || igpm12m == null) return null;
    const partes: string[] = [];
    const relSaz = medianaSaz != null ? leituraSazonal(igpmMes, medianaSaz) : null;
    partes.push(
      `O IGP-M de ${fmtMesCurto(mesRef)} veio em ${fmtSignedPct(igpmMes, 2)}` +
        (relSaz != null && medianaSaz != null
          ? relSaz === "em linha"
            ? `, em linha com o padrão do mês (mediana pós-96: ${fmtSignedPct(medianaSaz, 2)})`
            : `, ${relSaz} do padrão do mês (mediana pós-96: ${fmtSignedPct(medianaSaz, 2)})`
          : ""),
    );
    if (ipca12m != null) {
      partes.push(
        `em 12 meses acumula ${fmtSignedPct(igpm12m, 2)}, ${leituraSpreadCurta(igpm12m, ipca12m)} (${fmtPct(ipca12m, 2)}${ipcaMes && ipcaMes !== mesRef ? ` até ${fmtMesCurto(ipcaMes)}` : ""})`,
      );
    } else {
      partes.push(`em 12 meses acumula ${fmtSignedPct(igpm12m, 2)}`);
    }
    if (ipa12m != null && pesoIpa != null) {
      partes.push(
        `o atacado (IPA, ${fmtSignedPct(ipa12m, 1)} em 12m e ${fmtPct(pesoIpa, 0)} do peso efetivo) é quem dá o tom`,
      );
    }
    partes.push(`para contratos, ${leituraAluguel(igpm12m)}`);
    return `${partes.join("; ")}.`;
  }, [igpmMes, igpm12m, medianaSaz, ipca12m, ipcaMes, ipa12m, pesoIpa, mesRef]);

  // ── KPIs (máx. 4) — todos com régua explícita no badge ───────────────────
  const kpis = [
    <KpiCard
      key="mes"
      label="IGP-M do mês"
      value={fmtSignedPct(igpmMes, 2)}
      delta={igpmMes != null && medianaSaz != null ? igpmMes - medianaSaz : null}
      deltaUnit="p.p."
      deltaHint="vs padrão do mês"
      invertColor
      hint={medianaSaz != null ? `mediana pós-96: ${fmtSignedPct(medianaSaz, 2)}` : undefined}
    />,
    <KpiCard
      key="12m"
      label="IGP-M 12 meses"
      value={fmtSignedPct(igpm12m, 2)}
      delta={igpm12m != null && ipca12m != null ? igpm12m - ipca12m : null}
      deltaUnit="p.p."
      deltaHint={`vs IPCA 12m${ipcaMes && ipcaMes !== mesRef ? ` (${fmtMesCurto(ipcaMes)})` : ""}`}
      invertColor
      hint={
        percentil12m != null
          ? `composto no pipeline · percentil ${fmtNum(percentil12m, 0)} do pós-96`
          : "composto no pipeline"
      }
    />,
    <KpiCard
      key="ipa"
      label="IPA-M 12m (atacado)"
      value={fmtSignedPct(ipa12m, 2)}
      delta={ipa12m != null && ipaMedia != null ? ipa12m - ipaMedia : null}
      deltaUnit="p.p."
      deltaHint="vs média pós-96"
      invertColor
      hint={
        pesoIpa != null
          ? `o motor do índice — peso efetivo ${fmtPct(pesoIpa, 0)}`
          : "o motor do índice"
      }
    />,
    <KpiCard
      key="incc"
      label="INCC-M 12m (construção)"
      value={fmtSignedPct(incc12m, 2)}
      delta={incc12m != null && inccMedia != null ? incc12m - inccMedia : null}
      deltaUnit="p.p."
      deltaHint="vs média pós-96"
      invertColor
      hint="indexa contratos de obra e incorporação"
    />,
  ];

  // ── Blocos numerados (esmiuçamento) ───────────────────────────────────────
  const blocos: DashboardBloco[] = [
    {
      id: "componentes",
      eyebrow: "Composição",
      titulo: "Componentes em 12 meses",
      descricao: "Atacado, varejo FGV e construção lado a lado — com o IPCA como régua cruzada.",
      children: <ComponentesCard data={data} />,
    },
  ];

  if (data.antecipacao) {
    blocos.push({
      id: "antecipacao",
      eyebrow: "Atacado → varejo",
      titulo: "O IGP-M antecipa o IPCA?",
      descricao:
        "A pergunta clássica do índice — respondida com correlação cruzada calculada no pipeline, não com tese.",
      children: (
        <AntecipaIpcaCard antecipacao={data.antecipacao} geradoEm={data.gerado_em} mesRecente={mesRef} />
      ),
    });
  }

  if (data.aluguel && data.aluguel.reajustes.length > 0) {
    blocos.push({
      id: "aluguel",
      eyebrow: "IGP-M na vida real",
      titulo: "Aluguel na prática",
      descricao: "O que o painel inteiro significa para quem tem contrato indexado — em reais.",
      children: <AluguelCard aluguel={data.aluguel} geradoEm={data.gerado_em} />,
    });
  }

  blocos.push({
    id: "analise-completa",
    eyebrow: "Esmiuçamento",
    titulo: "Análise completa",
    descricao: "A mesma série em múltiplas transformações + tabela mensal e download dos dados em CSV.",
    children: <AnaliseCompletaIgpm data={data} />,
  });

  return (
    <DashboardScaffold
      header={{
        titulo: "Painel IGP-M",
        subtitulo:
          "O índice dos contratos — aluguel, energia, telecom. Leitura rápida no topo, esmiuçamento profissional abaixo.",
        referencia: `Referência: ${fmtMesLongo(mesRef)} · FGV via BCB/SGS`,
      }}
      manchete={manchete}
      kpis={kpis}
      anchor={
        data.decomposicao ? (
          <AnchorDecomposicao decomposicao={data.decomposicao} geradoEm={data.gerado_em} />
        ) : undefined
      }
      blocos={blocos}
      fichaTecnica={
        <div className="space-y-2">
          <p>
            <strong>Fontes e séries.</strong> FGV via BCB/SGS: 189 (IGP-M variação mensal), 7450 (IPA-M), 7456
            (IPC-M), 7465 (INCC-M); referência cruzada IBGE via SGS 433 (IPCA mensal) e 13522 (IPCA 12m).
            Pesos de origem do IGP-M: IPA 60%, IPC 30%, INCC 10% (base ago/1994). Última observação:{" "}
            {fmtMesLongo(mesRef)}. Nota de auditoria: o código SGS 192, usado pela versão anterior como
            “IGP-M 12m”, NÃO corresponde a essa série e foi aposentado.
          </p>
          <p>
            <strong>Metodologia — honestidade de cálculo.</strong> Todo acumulado de 12 meses é COMPOSTO
            (Π(1+v/100)−1) no pipeline, nunca soma aritmética — validado contra valores oficiais FGV publicados
            (dez/2020: 23,14; mai/2021: 37,04; dez/2023: −3,18…) e com a rotina conferida no IPCA (composto do
            SGS 433 vs 12m oficial 13522, diferença máx. de 0,01 p.p.). A decomposição da âncora usa pesos
            EFETIVOS encadeados: w = peso de origem × número-índice encadeado do componente, renormalizado mês
            a mês (o peso efetivo do IPA hoje é ~{pesoIpa != null ? fmtPct(pesoIpa, 0) : "69%"}, não 60%); o
            resíduo estrutural fica explícito como segmento próprio — com pesos fixos ele chegava a 0,53 p.p. e
            ficava invisível.
          </p>
          <p>
            <strong>Réguas e thresholds editoriais.</strong> Estatísticas, sazonalidade e percentis truncados a
            jan/1996 (pós-Real estabilizado). Spread vs IPCA: “em linha” = |IGP-M 12m − IPCA 12m| ≤ 0,3 p.p.
            Antecipação: título afirmativo só com correlação máxima ≥ 0,6 (lags de 0 a 6 meses, janelas
            pós-1996 e pós-2016, calculadas no pipeline). Aluguel: cláusula contratual de não-redução — IGP-M
            12m negativo congela o reajuste em zero. “Em linha com o padrão do mês” = desvio ≤ 0,05 p.p. da
            mediana do mês civil.
          </p>
          <p>
            <strong>Próxima fase.</strong> Repasse cambial IPA-M × dólar (SGS 3698) no lugar da sazonalidade do
            atacado, recessões CODACE sombreadas nas janelas longas e sub-painéis por componente no molde v2.
          </p>
          <p>Pipeline: data-pipeline/python/build_igpm.py (schema v2) · atualização diária via GitHub Actions.</p>
        </div>
      }
    />
  );
}
