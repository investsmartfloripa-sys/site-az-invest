"use client";

import { useMemo, useState } from "react";

import type { AtividadePmcData, PmcAtividadeItem } from "@/lib/painel-atividade";
import { AzSegmented, ChartCard, Heatmap, RankingTable, steppedDivergingScale, type RankingTableRow } from "@/components/painel/core";
import { fmtMesCurto, fmtSignedPct } from "@/lib/format-br";
import { mesIso } from "../shared";

/**
 * Abertura por atividade — "quem puxa e quem trava o varejo?".
 *
 * Mapa: atividades × últimos 12 meses, YoY suavizada (mm3 calculada aqui, por
 * id, sobre as aberturas mensais do blob). Linhas em ORDEM FIXA por código
 * SIDRA crescente — estável entre meses e entre células, para o olho comparar
 * na horizontal (persistência) e na vertical (amplitude).
 * Tabela: ranking do último mês com o acumulado 12m de contexto.
 */

type Escopo = "restrito" | "ampliado";
type Visao = "mapa" | "tabela";

const ESCOPO_OPCOES = [
  { id: "restrito", label: "Restrito" },
  { id: "ampliado", label: "Ampliado" },
];

const VISAO_OPCOES = [
  { id: "mapa", label: "Mapa" },
  { id: "tabela", label: "Tabela" },
];

/** Degraus do mapa (p.p., simétricos): ±1 (neutro), ±3, ±8 — YoY por atividade é bem mais volátil que o agregado. */
const DEGRAUS = [1, 3, 8];

function truncar(nome: string, max = 24): string {
  return nome.length > max ? `${nome.slice(0, max - 1).trimEnd()}…` : nome;
}

/** Ordena ids numericamente quando ambos são numéricos (códigos SIDRA), senão lexicográfico. */
function ordemId(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return a.localeCompare(b, "pt-BR");
}

type Modelo = {
  /** Últimos 12 meses ("YYYY-MM", crescente). */
  meses: string[];
  /** Rótulos das colunas do mapa (mês curto). */
  cols: string[];
  /** Rótulos das linhas (nomes truncados, deduplicados, ordem fixa por id). */
  rows: string[];
  data: Record<string, Record<string, number | null>>;
  ranking: RankingTableRow[];
  altas: number;
  total: number;
};

function montarModelo(fonte: Record<string, PmcAtividadeItem[]>): Modelo {
  const mesesAll = Object.keys(fonte).sort();
  const meses = mesesAll.slice(-12);
  const cols = meses.map((m) => fmtMesCurto(m));

  // União de ids nos últimos 12 meses; nome mais recente vence.
  const nomes = new Map<string, string>();
  for (const m of meses) {
    for (const it of fonte[m] ?? []) nomes.set(it.id, it.atividade);
  }
  const ids = [...nomes.keys()].sort(ordemId);

  // var_yoy por id × mês (todos os meses do blob, p/ mm3 das primeiras colunas).
  const porId = new Map<string, Map<string, number>>();
  for (const m of mesesAll) {
    for (const it of fonte[m] ?? []) {
      if (it.var_yoy == null) continue;
      let mm = porId.get(it.id);
      if (!mm) {
        mm = new Map();
        porId.set(it.id, mm);
      }
      mm.set(m, it.var_yoy);
    }
  }

  // mm3 honesta: só com as 3 observações presentes (senão célula vazia).
  const mm3 = (id: string, mes: string): number | null => {
    const idx = mesesAll.indexOf(mes);
    if (idx < 2) return null;
    const serieId = porId.get(id);
    if (!serieId) return null;
    let soma = 0;
    for (let j = idx - 2; j <= idx; j++) {
      const v = serieId.get(mesesAll[j]);
      if (v == null) return null;
      soma += v;
    }
    return +(soma / 3).toFixed(2);
  };

  // Linhas com rótulo único (truncar pode colidir — anexa contador).
  const usados = new Map<string, number>();
  const rows: string[] = [];
  const data: Record<string, Record<string, number | null>> = {};
  const labelPorId = new Map<string, string>();
  for (const id of ids) {
    let label = truncar(nomes.get(id) ?? id);
    const n = usados.get(label) ?? 0;
    usados.set(label, n + 1);
    if (n > 0) label = `${label} (${n + 1})`;
    labelPorId.set(id, label);
    rows.push(label);
    const linha: Record<string, number | null> = {};
    for (let i = 0; i < meses.length; i++) linha[cols[i]] = mm3(id, meses[i]);
    data[label] = linha;
  }

  // Ranking do último mês (YoY mm3; acumulado 12m como contexto no hint).
  const mesUlt = meses[meses.length - 1];
  const itensUlt = new Map((fonte[mesUlt] ?? []).map((it) => [it.id, it]));
  const ranking: RankingTableRow[] = [];
  let altas = 0;
  for (const id of ids) {
    const v = mm3(id, mesUlt);
    if (v == null) continue;
    if (v > 0) altas++;
    const acum = itensUlt.get(id)?.var_acum_12m;
    ranking.push({
      label: labelPorId.get(id) ?? id,
      value: v,
      hint: acum != null ? `12m: ${fmtSignedPct(acum, 1)}` : undefined,
    });
  }
  ranking.sort((a, b) => b.value - a.value);

  return { meses, cols, rows, data, ranking, altas, total: ranking.length };
}

export function AberturaPmcCard({ pmc, geradoEm }: { pmc: AtividadePmcData; geradoEm: string }) {
  const [escopo, setEscopo] = useState<Escopo>("restrito");
  const [visao, setVisao] = useState<Visao>("mapa");

  const fonte = escopo === "restrito" ? pmc.atividades.restrito_mensal : pmc.atividades.ampliado_mensal;
  const modelo = useMemo(() => montarModelo(fonte), [fonte]);
  const escala = useMemo(() => steppedDivergingScale(DEGRAUS), []);

  const mesUlt = modelo.meses[modelo.meses.length - 1] ?? pmc.atividades.mes_recente;
  const titulo =
    modelo.total > 0
      ? `${modelo.altas} de ${modelo.total} atividades do varejo ${escopo} crescem sobre um ano antes`
      : "Abertura por atividade — varejo";

  return (
    <ChartCard
      title={titulo}
      subtitle="Quem puxa e quem trava o varejo? Variação interanual do volume por atividade, suavizada (mm3) — leia na horizontal para ver persistência, na vertical para ver amplitude."
      toolbar={
        <>
          <AzSegmented
            ariaLabel="Escopo do varejo"
            options={ESCOPO_OPCOES}
            value={escopo}
            onChange={(id) => setEscopo(id as Escopo)}
          />
          <AzSegmented
            ariaLabel="Visualização da abertura"
            options={VISAO_OPCOES}
            value={visao}
            onChange={(id) => setVisao(id as Visao)}
          />
        </>
      }
      footer="Aberturas por atividade da PMC (SIDRA 8881 restrito, ~11 atividades; 8883 ampliado, ~14) — últimos 60 meses publicados no blob. YoY suavizada por média móvel de 3 meses, calculada aqui por atividade; célula vazia = sem as 3 observações."
      stampGiro={geradoEm}
      stampDado={mesUlt ? mesIso(mesUlt) : null}
    >
      {visao === "mapa" ? (
        <Heatmap
          rows={modelo.rows}
          cols={modelo.cols}
          data={modelo.data}
          colorScale={escala}
          cellWidth={44}
          caption="Variação interanual do volume, média móvel de 3 meses, em p.p. Degraus simétricos: |YoY| < 1 = neutro; ±1, ±3 e ±8 escurecem verde (alta) ou vermelho (queda). Linhas em ordem fixa por código SIDRA — estável entre meses."
        />
      ) : (
        <RankingTable
          title={`YoY (mm3) por atividade — ${mesUlt ? fmtMesCurto(mesUlt) : ""}`}
          rows={modelo.ranking}
          valueFmt={(v) => fmtSignedPct(v, 1)}
        />
      )}
    </ChartCard>
  );
}
