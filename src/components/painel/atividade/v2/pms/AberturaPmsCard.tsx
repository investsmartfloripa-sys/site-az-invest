"use client";

import { useMemo, useState } from "react";

import type { AtividadePmsData, PmsCategoriaItem } from "@/lib/painel-atividade";
import { AzSegmented, ChartCard, Heatmap, RankingTable, steppedDivergingScale } from "@/components/painel/core";
import { fmtMesCurto, fmtSignedPct } from "@/lib/format-br";
import { mesIso } from "../shared";

/**
 * Abertura setorial da PMS — 20 segmentos (8163) ou 29 atividades (8688).
 * Mapa de calor dos últimos 12 meses em YoY mm3 (calculada no front) com
 * linhas em ORDEM FIXA por id (classificação IBGE — estável entre meses,
 * nunca reordenada por amplitude) ou ranking do mês mais recente.
 * A difusão (% de categorias com YoY mm3 > 0) vai no TÍTULO do card.
 */

type Detalhe = "segmentos" | "atividades";
type Vista = "mapa" | "tabela";

const TRUNC = 24;

function truncar(nome: string): string {
  return nome.length > TRUNC ? `${nome.slice(0, TRUNC - 1).trimEnd()}…` : nome;
}

type Preparado = {
  mesRef: string;
  cols: string[];
  rows: string[];
  data: Record<string, Record<string, number | null>>;
  ranking: { label: string; value: number; hint?: string }[];
  difusao: { n: number; total: number } | null;
};

function preparar(serieMensal: Record<string, PmsCategoriaItem[]>): Preparado | null {
  const meses = Object.keys(serieMensal).sort();
  if (meses.length === 0) return null;
  const mesRef = meses[meses.length - 1];
  const meses12 = meses.slice(-12);

  // Índice mes → posição e mes → (id → var_yoy) p/ a mm3 por categoria.
  const idxDoMes = new Map(meses.map((m, i) => [m, i] as const));
  const yoyPorMes = new Map<string, Map<string, number | null>>();
  for (const m of meses) {
    const mapa = new Map<string, number | null>();
    for (const it of serieMensal[m] ?? []) mapa.set(it.id, it.var_yoy);
    yoyPorMes.set(m, mapa);
  }

  const mm3 = (id: string, mes: string): number | null => {
    const idx = idxDoMes.get(mes);
    if (idx == null || idx < 2) return null;
    let soma = 0;
    for (let j = idx - 2; j <= idx; j++) {
      const v = yoyPorMes.get(meses[j])?.get(id);
      if (typeof v !== "number" || !Number.isFinite(v)) return null;
      soma += v;
    }
    return +(soma / 3).toFixed(2);
  };

  // Ordem FIXA por id crescente (classificação IBGE) — estável entre meses.
  const itensRef = [...(serieMensal[mesRef] ?? [])].sort((a, b) => {
    const na = Number(a.id);
    const nb = Number(b.id);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.id < b.id ? -1 : 1;
  });
  if (itensRef.length === 0) return null;

  const cols = meses12.map((m) => fmtMesCurto(m));
  const rows: string[] = [];
  const data: Record<string, Record<string, number | null>> = {};
  const usados = new Set<string>();
  const ranking: { label: string; value: number; hint?: string }[] = [];
  let positivos = 0;
  let total = 0;

  for (const it of itensRef) {
    let label = truncar(it.categoria);
    let sufixo = 2;
    while (usados.has(label)) label = `${truncar(it.categoria)} (${sufixo++})`;
    usados.add(label);
    rows.push(label);

    const linha: Record<string, number | null> = {};
    meses12.forEach((m, i) => {
      linha[cols[i]] = mm3(it.id, m);
    });
    data[label] = linha;

    const vRef = mm3(it.id, mesRef);
    total += 1;
    if (vRef != null && vRef > 0) positivos += 1;
    if (vRef != null) {
      ranking.push({
        label,
        value: vRef,
        hint: it.var_acum_12m != null ? `acum. 12m ${fmtSignedPct(it.var_acum_12m, 1)}` : undefined,
      });
    }
  }
  ranking.sort((a, b) => b.value - a.value);

  return { mesRef, cols, rows, data, ranking, difusao: total > 0 ? { n: positivos, total } : null };
}

export function AberturaPmsCard({ pms, geradoEm }: { pms: AtividadePmsData; geradoEm: string }) {
  const [detalhe, setDetalhe] = useState<Detalhe>("segmentos");
  const [vista, setVista] = useState<Vista>("mapa");

  const prep = useMemo(
    () => preparar(detalhe === "segmentos" ? pms.segmentos.serie_mensal : pms.atividades.serie_mensal),
    [pms, detalhe],
  );

  const escala = useMemo(() => steppedDivergingScale(), []);

  const titulo = prep?.difusao
    ? `Expansão em ${prep.difusao.n} de ${prep.difusao.total} ${detalhe} em ${fmtMesCurto(prep.mesRef)}`
    : "Abertura setorial da PMS";

  return (
    <ChartCard
      title={titulo}
      subtitle="Quem puxa e quem trava o agregado? Variação interanual do volume por categoria, suavizada por média móvel de 3 meses — mapa dos últimos 12 meses ou ranking do mês mais recente."
      toolbar={
        <>
          <AzSegmented
            ariaLabel="Nível de detalhe da abertura"
            options={[
              { id: "segmentos", label: "Segmentos" },
              { id: "atividades", label: "Atividades" },
            ]}
            value={detalhe}
            onChange={(id) => setDetalhe(id as Detalhe)}
          />
          <AzSegmented
            ariaLabel="Forma de visualização"
            options={[
              { id: "mapa", label: "Mapa" },
              { id: "tabela", label: "Tabela" },
            ]}
            value={vista}
            onChange={(id) => setVista(id as Vista)}
          />
        </>
      }
      footer="SIDRA 8163 (20 segmentos) e 8688 (29 atividades e subdivisões) — volume, base 2022 = 100. YoY mm3 calculada no site sobre a variação oficial. Difusão do título: nº de categorias com YoY mm3 positiva no mês mais recente. Nomes truncados — passe o mouse na célula para o valor exato."
      stampGiro={geradoEm}
      stampDado={prep ? mesIso(prep.mesRef) : null}
    >
      {!prep ? (
        <p className="flex h-48 items-center justify-center text-sm text-zinc-400">Sem abertura disponível neste mês.</p>
      ) : vista === "mapa" ? (
        <Heatmap
          rows={prep.rows}
          cols={prep.cols}
          data={prep.data}
          colorScale={escala}
          caption="YoY do volume em %, média móvel de 3 meses — a mm3 amortece efeitos de base e dilui meses extremos. Linhas em ordem fixa da classificação IBGE (estável entre meses, não reordenada por destaque); escala divergente simétrica."
          cellWidth={44}
        />
      ) : (
        <RankingTable
          title={`${detalhe === "segmentos" ? "Segmentos" : "Atividades"} — YoY mm3 em ${fmtMesCurto(prep.mesRef)}`}
          rows={prep.ranking}
          valueFmt={(v) => fmtSignedPct(v, 1)}
        />
      )}
    </ChartCard>
  );
}
