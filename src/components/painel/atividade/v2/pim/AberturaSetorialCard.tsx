"use client";

import { useMemo, useState } from "react";

import type { AtividadePimData, PimAtividadeItem } from "@/lib/painel-atividade";
import { AzSegmented, ChartCard, Heatmap, RankingTable, steppedDivergingScale, type RankingTableRow } from "@/components/painel/core";
import { fmtMesCurto, fmtSignedPct } from "@/lib/format-br";
import { mesIso } from "../shared";

/**
 * Abertura setorial — as ~24 atividades CNAE da PIM em duas vistas:
 * - Mapa: heatmap atividades × últimos 12 meses, células = YoY mm3 calculada
 *   no front. Linhas em ORDEM FIXA por código CNAE (estável mês a mês — a
 *   posição de cada atividade nunca muda, ao contrário de rankings por
 *   amplitude que reordenam a cada divulgação) e escala de cor SIMÉTRICA e
 *   constante (steppedDivergingScale).
 * - Tabela: ranking do mês mais recente por YoY mm3, com o acumulado em 12
 *   meses como nota.
 */

type Modo = "mapa" | "tabela";

const MAX_ROTULO = 24;

/** Encurta o nome CNAE p/ caber na linha do heatmap (remove o prefixo "Fabricação de"). */
function rotuloCurto(nome: string): string {
  let s = nome.replace(/^fabrica[çc][ãa]o de /i, "").trim();
  if (s.length > 0) s = s.charAt(0).toUpperCase() + s.slice(1);
  if (s.length > MAX_ROTULO) s = `${s.slice(0, MAX_ROTULO - 1).trimEnd()}…`;
  return s;
}

const ESCALA = steppedDivergingScale();

export function AberturaSetorialCard({ pim, geradoEm }: { pim: AtividadePimData; geradoEm: string }) {
  const [modo, setModo] = useState<Modo>("mapa");

  const meses = useMemo(() => Object.keys(pim.atividades.serie_mensal).sort(), [pim.atividades.serie_mensal]);
  const meses12 = useMemo(() => meses.slice(-12), [meses]);
  const mesUlt = meses.length > 0 ? meses[meses.length - 1] : null;

  // Índice mes → (id → item) p/ lookup O(1) no cálculo da mm3.
  const porMes = useMemo(() => {
    const m = new Map<string, Map<string, PimAtividadeItem>>();
    for (const mes of meses) {
      m.set(mes, new Map((pim.atividades.serie_mensal[mes] ?? []).map((it) => [it.id, it])));
    }
    return m;
  }, [pim.atividades.serie_mensal, meses]);

  // Ordem FIXA por código CNAE crescente — estável entre meses, nunca por amplitude.
  const atividadesFixas = useMemo(() => {
    const items = mesUlt ? pim.atividades.serie_mensal[mesUlt] ?? [] : [];
    return [...items].sort((a, b) => a.id.localeCompare(b.id, "pt-BR", { numeric: true }));
  }, [pim.atividades.serie_mensal, mesUlt]);

  // Rótulos curtos ÚNICOS (truncamento pode colidir — sufixa com · defensivamente).
  const rotulos = useMemo(() => {
    const usados = new Set<string>();
    const out = new Map<string, string>();
    for (const a of atividadesFixas) {
      let r = rotuloCurto(a.atividade);
      while (usados.has(r)) r = `${r}·`;
      usados.add(r);
      out.set(a.id, r);
    }
    return out;
  }, [atividadesFixas]);

  // YoY mm3 POR ATIVIDADE, calculada no front: média da var_yoy do mês e dos
  // 2 anteriores (por id); null se qualquer um dos 3 meses faltar.
  const mm3PorMes = useMemo(() => {
    const out = new Map<string, Map<string, number | null>>();
    const startIdx = meses.length - meses12.length;
    meses12.forEach((mes, k) => {
      const i = startIdx + k;
      const linha = new Map<string, number | null>();
      for (const a of atividadesFixas) {
        let soma = 0;
        let completo = true;
        for (let j = i - 2; j <= i; j++) {
          const v = j >= 0 ? porMes.get(meses[j])?.get(a.id)?.var_yoy : null;
          if (v == null) {
            completo = false;
            break;
          }
          soma += v;
        }
        linha.set(a.id, completo ? +(soma / 3).toFixed(2) : null);
      }
      out.set(mes, linha);
    });
    return out;
  }, [meses, meses12, atividadesFixas, porMes]);

  const heatRows = useMemo(() => atividadesFixas.map((a) => rotulos.get(a.id) ?? a.atividade), [atividadesFixas, rotulos]);
  const heatCols = useMemo(() => meses12.map((m) => fmtMesCurto(m)), [meses12]);
  const heatData = useMemo(() => {
    const out: Record<string, Record<string, number | null>> = {};
    for (const a of atividadesFixas) {
      const row: Record<string, number | null> = {};
      for (const mes of meses12) {
        row[fmtMesCurto(mes)] = mm3PorMes.get(mes)?.get(a.id) ?? null;
      }
      out[rotulos.get(a.id) ?? a.atividade] = row;
    }
    return out;
  }, [atividadesFixas, rotulos, meses12, mm3PorMes]);

  // Tabela: último mês, ordenada por YoY mm3 desc; hint = acumulado 12m.
  const ranking = useMemo<RankingTableRow[]>(() => {
    if (!mesUlt) return [];
    const linha = mm3PorMes.get(mesUlt);
    return atividadesFixas
      .flatMap((a) => {
        const v = linha?.get(a.id);
        if (v == null) return [];
        return [
          {
            label: rotulos.get(a.id) ?? a.atividade,
            value: v,
            hint: a.var_acum_12m != null ? `12m ${fmtSignedPct(a.var_acum_12m, 1)}` : undefined,
          },
        ];
      })
      .sort((a, b) => b.value - a.value);
  }, [mesUlt, mm3PorMes, atividadesFixas, rotulos]);

  const emAlta = ranking.filter((r) => r.value > 0).length;
  const titulo =
    ranking.length > 0
      ? `${emAlta} de ${ranking.length} atividades industriais crescem na tendência interanual`
      : "Abertura setorial — atividades CNAE";

  return (
    <ChartCard
      title={titulo}
      subtitle="Onde a indústria cresce — e onde encolhe? Mapa dos últimos 12 meses com as atividades em ordem fixa (código CNAE) e tabela do mês mais recente."
      toolbar={
        <AzSegmented
          ariaLabel="Mapa de calor ou tabela das atividades"
          options={[
            { id: "mapa", label: "Mapa" },
            { id: "tabela", label: "Tabela" },
          ]}
          value={modo}
          onChange={(id) => setModo(id as Modo)}
        />
      }
      footer="YoY mm3 por atividade calculada no painel: média da variação interanual do mês e dos dois anteriores (SIDRA 8888, ~24 atividades CNAE). Ordem das linhas FIXA por código CNAE — a posição de cada atividade não muda entre meses; escala de cor simétrica e constante (não reescala com os dados)."
      stampGiro={geradoEm}
      stampDado={mesUlt ? mesIso(mesUlt) : null}
    >
      {modo === "mapa" ? (
        <Heatmap
          rows={heatRows}
          cols={heatCols}
          data={heatData}
          colorScale={ESCALA}
          cellWidth={44}
          caption="Células: variação interanual média móvel de 3 meses (%), por atividade. Verde = produção acima de um ano antes; vermelho = abaixo; cinza = sem dado completo para a média."
        />
      ) : (
        <RankingTable
          title={`Atividades — ${mesUlt ? fmtMesCurto(mesUlt) : ""} (YoY mm3)`}
          rows={ranking}
          valueFmt={(v) => fmtSignedPct(v, 1)}
        />
      )}
    </ChartCard>
  );
}
