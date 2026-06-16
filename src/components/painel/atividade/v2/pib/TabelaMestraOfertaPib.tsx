"use client";

import { useMemo } from "react";

import type { AtividadeCodaceData, AtividadePibData } from "@/lib/painel-atividade";
import { LABELS_PIB_FALLBACK } from "@/lib/painel-atividade";
import { ChartCard } from "@/components/painel/core";
import { fmtNum, fmtSignedPct } from "@/lib/format-br";
import { variationText } from "@/lib/az-chart-theme";
import { baixarCsv, fmtTrimCurto, num } from "../shared";

/**
 * Tabela mestra da oferta — a planilha de referência do trimestre mais recente:
 * uma linha por setor da oferta (17, ordem fixa da SCN), uma coluna por medida.
 * NÍVEL (índice de volume SA e R$ reais SA), VARIAÇÃO (YoY, acum. 4T, acum. ano,
 * QoQ SA, com sinal e cor) e PESO (% do PIB nominal). Tudo do último ponto de
 * cada série já presente no JSON — sem cálculo derivado, é o "raio-X" tabular
 * que acompanha os gráficos. Exporta o recorte em CSV (padrão Excel pt-BR).
 *
 * Setores em destaque (PIB, valor adicionado, impostos) recebem realce de linha
 * para separar o agregado dos componentes. `valores_reais_sa` e
 * `estrutura_nominal` são opcionais no tipo — colunas mostram "—" quando faltam.
 */

// 17 recortes da oferta em ordem fixa da SCN. `destaque` = agregados (realce).
const SETORES: { key: string; destaque?: boolean }[] = [
  { key: "agro" },
  { key: "industria", destaque: true },
  { key: "industria_extrativa" },
  { key: "industria_transformacao" },
  { key: "eletricidade_gas" },
  { key: "construcao" },
  { key: "servicos", destaque: true },
  { key: "comercio" },
  { key: "transporte" },
  { key: "informacao" },
  { key: "financeiras" },
  { key: "imobiliarias" },
  { key: "outros_servicos" },
  { key: "admin_publica" },
  { key: "valor_adicionado", destaque: true },
  { key: "impostos", destaque: true },
  { key: "pib", destaque: true },
];

type LinhaSetor = {
  key: string;
  rotulo: string;
  destaque: boolean;
  indiceSa: number | null;
  reaisSa: number | null;
  yoy: number | null;
  acum4t: number | null;
  acumAno: number | null;
  qoqSa: number | null;
  pesoPib: number | null;
};

/** Célula de taxa: sinal explícito + cor pela direção (verde subiu / vermelho caiu). */
function CelulaTaxa({ valor }: { valor: number | null }) {
  if (valor == null) return <td className="py-1.5 pr-3 text-right text-zinc-400">—</td>;
  return (
    <td className="py-1.5 pr-3 text-right font-semibold" style={{ color: variationText(valor) }}>
      {fmtSignedPct(valor, 1)}
    </td>
  );
}

export function TabelaMestraOfertaPib({
  pib,
  geradoEm,
}: {
  pib: AtividadePibData;
  codace?: AtividadeCodaceData | null;
  geradoEm: string;
}) {
  const labels = pib.labels ?? {};

  // Último ponto (mais recente não-nulo) de cada série; chaves por recorte abaixo.
  const indiceUlt = pib.indice_volume.serie[pib.indice_volume.serie.length - 1] ?? null;
  const variacaoUlt = pib.variacao.serie[pib.variacao.serie.length - 1] ?? null;
  const reaisSerie = pib.valores_reais_sa?.serie ?? [];
  const reaisUlt = reaisSerie[reaisSerie.length - 1] ?? null;
  const estruturaSerie = pib.estrutura_nominal?.serie ?? [];
  const estruturaUlt = estruturaSerie[estruturaSerie.length - 1] ?? null;

  // Trimestre de referência: o mais recente entre as séries disponíveis.
  const trimRef = String(
    (variacaoUlt?.trim as string | undefined) ??
      (indiceUlt?.trim as string | undefined) ??
      pib.trim_recente,
  );

  const linhas = useMemo<LinhaSetor[]>(
    () =>
      SETORES.map((s) => ({
        key: s.key,
        rotulo: labels[s.key] ?? LABELS_PIB_FALLBACK[s.key] ?? s.key,
        destaque: !!s.destaque,
        indiceSa: num(indiceUlt, `sa_${s.key}`),
        reaisSa: num(reaisUlt, s.key),
        yoy: num(variacaoUlt, `yoy_${s.key}`),
        acum4t: num(variacaoUlt, `acum_4t_${s.key}`),
        acumAno: num(variacaoUlt, `acum_ano_${s.key}`),
        qoqSa: num(variacaoUlt, `qoq_sa_${s.key}`),
        pesoPib: num(estruturaUlt, `${s.key}_pct_pib`),
      })),
    // labels é estável dentro do render; depende só dos pontos do último trim
    [indiceUlt, reaisUlt, variacaoUlt, estruturaUlt, labels],
  );

  const baixar = () => {
    baixarCsv(
      `pib-tabela-mestra-oferta-${trimRef}.csv`,
      [
        "setor",
        "indice_volume_sa_base1995",
        "valor_real_sa_rs_milhoes_precos1995",
        "yoy_pct",
        "acum_4t_pct",
        "acum_ano_pct",
        "qoq_sa_pct",
        "peso_pct_pib_nominal",
      ],
      linhas.map((l) => [
        l.rotulo,
        l.indiceSa,
        l.reaisSa,
        l.yoy,
        l.acum4t,
        l.acumAno,
        l.qoqSa,
        l.pesoPib,
      ]),
    );
  };

  const temReais = reaisSerie.length > 0;
  const temPeso = estruturaSerie.length > 0;

  return (
    <ChartCard
      title={`Tabela mestra da oferta — ${fmtTrimCurto(trimRef)}`}
      subtitle="Os 17 setores da oferta (ordem da SCN) × nível, variação e peso, no trimestre mais recente. Nas taxas, verde = expansão e vermelho = queda; PIB, valor adicionado e impostos em realce."
      toolbar={
        <button
          type="button"
          onClick={baixar}
          className="rounded-lg border border-[#132960]/20 bg-white px-2.5 py-1 text-xs font-semibold text-[#132960] transition-colors hover:bg-zinc-50"
        >
          Baixar CSV
        </button>
      }
      footer="Fonte: IBGE/SIDRA — Contas Nacionais Trimestrais. Índice de volume com ajuste sazonal, base 1995 = 100 (1621). Valor real com ajuste sazonal, encadeado a preços de 1995, R$ (6613). Variações reais em % (5932): YoY = vs mesmo trimestre do ano anterior; acum. 4T = últimos 12 meses; acum. ano = no ano corrente; QoQ SA = vs trimestre anterior com ajuste sazonal. Peso = % do PIB nominal (1846). Setores em ordem fixa da SCN."
      stampGiro={geradoEm}
      stampDado={trimRef}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-xs tabular-nums">
          <thead>
            <tr className="border-b border-[#132960]/15 text-left text-[11px] uppercase tracking-wide text-zinc-500">
              <th className="py-2 pr-3 font-semibold">Setor</th>
              <th className="py-2 pr-3 text-right font-semibold">Índice vol. SA</th>
              <th className="py-2 pr-3 text-right font-semibold">R$ real SA (mi)</th>
              <th className="py-2 pr-3 text-right font-semibold">YoY</th>
              <th className="py-2 pr-3 text-right font-semibold">Acum. 4T</th>
              <th className="py-2 pr-3 text-right font-semibold">Acum. ano</th>
              <th className="py-2 pr-3 text-right font-semibold">QoQ SA</th>
              <th className="py-2 text-right font-semibold">Peso %PIB</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr
                key={l.key}
                className={`border-b border-zinc-100 ${
                  l.destaque ? "bg-[#132960]/[0.035] font-medium text-[#132960]" : "text-zinc-700"
                }`}
              >
                <td className={`py-1.5 pr-3 ${l.destaque ? "font-semibold" : "font-medium text-[#132960]"}`}>
                  {l.rotulo}
                </td>
                <td className="py-1.5 pr-3 text-right">{fmtNum(l.indiceSa, 1)}</td>
                <td className="py-1.5 pr-3 text-right">{fmtNum(l.reaisSa, 0)}</td>
                <CelulaTaxa valor={l.yoy} />
                <CelulaTaxa valor={l.acum4t} />
                <CelulaTaxa valor={l.acumAno} />
                <CelulaTaxa valor={l.qoqSa} />
                <td className="py-1.5 text-right">{l.pesoPib == null ? "—" : `${fmtNum(l.pesoPib, 1)}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(!temReais || !temPeso) && (
        <p className="mt-2 text-[11px] text-zinc-400">
          {!temReais && "Coluna R$ real SA indisponível nesta carga. "}
          {!temPeso && "Coluna Peso %PIB indisponível nesta carga."}
        </p>
      )}
    </ChartCard>
  );
}
