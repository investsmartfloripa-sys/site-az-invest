"use client";

import { useMemo } from "react";

import type { AtividadeCodaceData } from "@/lib/painel-atividade";
import type { CagedQuebrasData, CagedTotalData } from "@/lib/painel-emprego";
import { DashboardScaffold, KpiCard, type DashboardBloco } from "@/components/painel/core";
import { fmtMesCurto, fmtMesLongo, fmtNum } from "@/lib/format-br";
import { findMes, fmtMil, mesmoMesAnoAnterior, somaYtd, tendenciaMm3, ultimoCom } from "./shared";
import { MomentumCard } from "./MomentumCard";
import { YtdCard } from "./YtdCard";
import { FluxosCard } from "./FluxosCard";
import { SalarioRealCard } from "./SalarioRealCard";
import { AberturaCaged } from "./AberturaCaged";
import { HeatmapSazonalCard } from "./HeatmapSazonalCard";
import { AnaliseCompletaCaged } from "./AnaliseCompletaCaged";

/**
 * Painel CAGED v2 — template narrativo AZ (manchete em prosa → 4 KPIs →
 * âncora de momentum → blocos numerados → ficha técnica).
 *
 * Regras herdadas da crítica do revisor:
 * - saldo é fluxo com sinal: Δ SEMPRE absoluto (mil postos), nunca %;
 * - a manchete lê o momentum DESSAZONALIZADO (STL própria), não o cru;
 * - share só de admissões; sem pizza de saldo; sem "top 5 meses".
 */

export function CagedDashboardV2({
  total,
  quebras,
  codace,
}: {
  total: CagedTotalData;
  quebras: CagedQuebrasData | null;
  codace: AtividadeCodaceData | null;
}) {
  const serie = total.serie;
  const ult = serie[serie.length - 1];
  const mesRef = ult?.mes ?? total.mes_recente;
  const anoCorrente = parseInt(mesRef.slice(0, 4), 10);
  const mesNum = parseInt(mesRef.slice(5, 7), 10);

  const derivados = useMemo(() => {
    const anterior = findMes(serie, mesmoMesAnoAnterior(mesRef));
    const deltaAbs = ult?.saldo != null && anterior?.saldo != null ? ult.saldo - anterior.saldo : null;
    const sa = ultimoCom(serie, (r) => r.saldo_sa);
    const mm3 = tendenciaMm3(serie);
    const ytdAtual = somaYtd(serie, anoCorrente, mesNum);
    const ytdAnterior = somaYtd(serie, anoCorrente - 1, mesNum);
    return { anterior, deltaAbs, sa, mm3, ytdAtual, ytdAnterior };
  }, [serie, mesRef, ult, anoCorrente, mesNum]);

  const manchete = useMemo(() => {
    const { anterior, deltaAbs, mm3 } = derivados;
    if (ult?.saldo == null) return null;
    const partes: string[] = [];

    let abertura = `O mercado formal ${ult.saldo >= 0 ? "criou" : "fechou"} ${fmtMil(Math.abs(ult.saldo))} postos em ${fmtMesLongo(mesRef)}`;
    if (deltaAbs != null && anterior) {
      abertura +=
        Math.abs(deltaAbs) < 500
          ? ` — praticamente o mesmo que ${fmtMesCurto(anterior.mes)}`
          : ` — ${fmtNum(Math.abs(deltaAbs) / 1000, 1)} mil postos ${deltaAbs > 0 ? "a mais" : "a menos"} que ${fmtMesCurto(anterior.mes)}`;
    }
    partes.push(abertura);

    if (mm3) {
      const verbo = mm3.dir === "acelera" ? "acelera" : mm3.dir === "desacelera" ? "perde fôlego" : "mantém o ritmo";
      partes.push(`no ritmo dessazonalizado, o mercado formal ${verbo}: mm3 de ${fmtMil(mm3.valor)}/mês`);
    }

    // Sinais opostos cru × SA do mês de referência: explicitar a sazonalidade.
    const saMes = ult.saldo_sa;
    if (saMes != null && ult.saldo !== 0 && saMes !== 0 && Math.sign(saMes) !== Math.sign(ult.saldo)) {
      partes.push(
        ult.saldo > 0
          ? `atenção: o número cru é inflado pela sazonalidade do mês — dessazonalizado, o saldo é negativo (${fmtMil(saMes)})`
          : `atenção: o número cru é deprimido pela sazonalidade do mês — dessazonalizado, o saldo é positivo (${fmtMil(saMes)})`,
      );
    }

    return `${partes.join("; ")}.`;
  }, [derivados, ult, mesRef]);

  const kpis = useMemo(() => {
    const { anterior, deltaAbs, sa, mm3, ytdAtual, ytdAnterior } = derivados;
    return [
      <KpiCard
        key="saldo"
        label={`Saldo de ${fmtMesCurto(mesRef)}`}
        value={ult?.saldo != null ? fmtNum(ult.saldo / 1000, 1) : "—"}
        unit="mil"
        size="lg"
        delta={deltaAbs != null ? +(deltaAbs / 1000).toFixed(1) : undefined}
        deltaUnit="abs"
        deltaHint={anterior ? `mil vs ${fmtMesCurto(anterior.mes)}` : undefined}
        hint="admissões − desligamentos (cru)"
      />,
      <KpiCard
        key="sa"
        label="Saldo dessazonalizado"
        value={sa ? fmtNum(sa.valor / 1000, 1) : "—"}
        unit="mil"
        hint="estimativa própria (STL)"
      />,
      <KpiCard
        key="mm3"
        label="Momentum (mm3 SA)"
        value={mm3 ? fmtNum(mm3.valor / 1000, 1) : "—"}
        unit="mil/mês"
        hint="média móvel 3m do saldo SA"
      />,
      <KpiCard
        key="ytd"
        label="Acumulado no ano"
        value={ytdAtual != null ? fmtNum(ytdAtual / 1000, 1) : "—"}
        unit="mil"
        delta={ytdAtual != null && ytdAnterior != null ? +((ytdAtual - ytdAnterior) / 1000).toFixed(1) : undefined}
        deltaUnit="abs"
        deltaHint={`mil vs jan–${fmtMesCurto(`${anoCorrente - 1}${mesRef.slice(4)}`)}`}
        hint={`soma jan–${fmtMesCurto(mesRef)}`}
      />,
    ];
  }, [derivados, mesRef, ult, anoCorrente]);

  const blocos = useMemo<DashboardBloco[]>(() => {
    const out: DashboardBloco[] = [
      {
        id: "ytd",
        eyebrow: "Acumulado",
        titulo: "Em que pé está o ano?",
        descricao:
          "A corrida de cada ano-calendário: saldo acumulado de janeiro a dezembro — anos só se comparam no mesmo corte de meses.",
        children: <YtdCard total={total} geradoEm={total.gerado_em} />,
      },
      {
        id: "fluxos",
        eyebrow: "Giro",
        titulo: "O mercado está girando?",
        descricao:
          "Admissões e desligamentos em mm3 — a distância entre as linhas é o saldo; o % de desligamentos a pedido é o termômetro de confiança do trabalhador.",
        children: <FluxosCard total={total} quebras={quebras} codaceMensal={codace?.mensal} geradoEm={total.gerado_em} />,
      },
    ];
    if (quebras && quebras.serie.length > 0) {
      out.push({
        id: "salario-real",
        eyebrow: "Preço do trabalho",
        titulo: "Salário de admissão: ganhando da inflação?",
        descricao:
          "Salário médio e mediano de quem foi admitido, deflacionado pelo IPCA — e a variação interanual real, o elo com a inflação de serviços.",
        children: <SalarioRealCard quebras={quebras} geradoEm={quebras.gerado_em} />,
      });
      out.push({
        id: "abertura",
        eyebrow: "Composição",
        titulo: "Quem cria as vagas?",
        descricao: "Saldo acumulado em 12 meses por setor IBGE e por faixa salarial (microdado, cobertura parcial).",
        children: <AberturaCaged quebras={quebras} geradoEm={quebras.gerado_em} />,
      });
    }
    out.push(
      {
        id: "sazonal",
        eyebrow: "Sazonalidade",
        titulo: "Padrão sazonal",
        descricao: "Cada mês comparado com o histórico DELE mesmo, em desvios robustos — não com números crus.",
        children: <HeatmapSazonalCard total={total} geradoEm={total.gerado_em} />,
      },
      {
        id: "analise-completa",
        eyebrow: "Esmiuçamento",
        titulo: "Análise completa",
        descricao: "Tabela dos últimos 12 meses e a série inteira em CSV.",
        children: <AnaliseCompletaCaged total={total} quebras={quebras} geradoEm={total.gerado_em} />,
      },
    );
    return out;
  }, [total, quebras, codace]);

  return (
    <DashboardScaffold
      header={{
        titulo: "CAGED — Mercado Formal de Trabalho",
        subtitulo:
          "Saldo de admissões e desligamentos do Novo CAGED (MTE), com dessazonalização própria, abertura por setor e faixa salarial e salário real de admissão.",
        referencia: `Referência: ${fmtMesLongo(mesRef)}`,
      }}
      manchete={manchete}
      kpis={kpis}
      anchor={<MomentumCard total={total} codaceMensal={codace?.mensal} geradoEm={total.gerado_em} />}
      blocos={blocos}
      fichaTecnica={
        <div className="space-y-2">
          <p>
            <strong>Fontes e séries.</strong> Saldo, admissões e desligamentos: consolidado oficial do Novo CAGED (MTE) via
            IPEADATA (séries CAGED12_*). Abertura por setor IBGE e faixa salarial, salários de admissão/demissão e
            desligamentos a pedido: microdados do FTP PDET/MTE — apenas declarações no prazo, cobertura ~40–50% do saldo
            oficial (use para composição, nunca para o nível). Deflator: IPCA (BCB SGS 433)
            {quebras?.deflator_base_mes ? `; salários reais em R$ de ${fmtMesCurto(quebras.deflator_base_mes)}` : ""}.
            Recessões: cronologia CODACE/FGV.
          </p>
          <p>
            <strong>Metodologia — honestidade de cálculo.</strong> Dessazonalização PRÓPRIA do saldo (STL robusta a 2020) —
            o MTE não publica série SA do Novo CAGED; o momentum editorial é a mm3 do saldo SA, nunca o cru de
            janeiro/dezembro. Variações de saldo SEMPRE em Δ absoluto (mil postos): saldo é fluxo que troca de sinal e
            variação percentual engana. Share (%) apenas de ADMISSÕES (fluxo bruto) — saldo não comporta participação.
            Salário médio com teto de sanidade de 120 SM; mediana reportada onde disponível (robusta a outliers de
            declaração); sem controle de composição (o BCB usa versão ajustada no Relatório de Inflação). Faixa
            &quot;00&quot; (salário não informado) excluída das agregações. Heatmap sazonal em desvios robustos (mediana +
            MAD por mês) — 2020 não domina a escala.
          </p>
          <p>
            <strong>Réguas editoriais.</strong> Faixas cinzas = recessões CODACE/FGV — a cronologia é atualizada com anos de
            defasagem (última datação: 2020); ausência de faixa recente não significa ausência de risco. Pipeline:
            data-pipeline/python/build_emprego_caged_total.py e build_emprego_caged_quebras.py (schema v2).
          </p>
        </div>
      }
    />
  );
}
