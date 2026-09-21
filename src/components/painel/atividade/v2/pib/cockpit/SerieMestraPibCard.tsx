"use client";

/**
 * COCKPIT PIB — série-mestra do PIB a preços de mercado, uma transformação por
 * vez (YoY · acum. 4T · acum. ano · índice SA), recessões CODACE ao fundo,
 * tabela colapsável dos últimos 8 trimestres × 4 medidas e export CSV (série e
 * contribuições). Fontes: SIDRA 5932 (variações) e SIDRA 1621 (índice SA).
 * Adapta AnaliseCompletaPib.tsx ao padrão cockpit (§10): título fixo, número no
 * chip, editorial atrás do (?).
 */

import { useMemo, useState } from "react";

import type { AtividadeCodaceData, AtividadePibData } from "@/lib/painel-atividade";
import { AzSegmented, ChartCard, CockpitChip, tomPorSinal, type AzSegmentedOption } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart, type AzRefLine } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND, AZ_CHART, variationText } from "@/lib/az-chart-theme";
import { fmtNum, fmtSignedNum, fmtSignedPct } from "@/lib/format-br";
import { baixarCsv, codaceAreas, fmtTrimCurto, num } from "../../shared";
import { BTN_CSV_CLASS, blocoDoPib, lentePib, seriePib, type LentePib, type LentePibId } from "../cockpit-shared";

type LenteMestraId = Extract<LentePibId, "yoy" | "acum_4t" | "acum_ano" | "idx_sa">;

const LENTES_MESTRA: readonly LenteMestraId[] = ["yoy", "acum_4t", "acum_ano", "idx_sa"];

const OPCOES_LENTE: AzSegmentedOption[] = LENTES_MESTRA.map((id) => ({ id, label: lentePib(id).label }));

/** Colunas da tabela (chaves do bloco `variacao`, ordem de leitura da CNT). */
const COLUNAS_TABELA: ReadonlyArray<{ key: string; label: string }> = [
  { key: "qoq_sa_pib", label: "QoQ SA" },
  { key: "yoy_pib", label: "YoY" },
  { key: "acum_ano_pib", label: "Acum. ano" },
  { key: "acum_4t_pib", label: "Acum. 4T" },
];

/** Linha do zero — só nas lentes de variação (no índice ficaria fora do domínio e não apareceria). */
const REF_ZERO: AzRefLine[] = [{ y: 0, color: AZ_CHART.zero, dashed: true }];

type UltimoEAnterior = { trim: string; valor: number; trimAnt: string | null; valorAnt: number | null };

/** Último valor não-nulo do PIB na lente + o valor não-nulo imediatamente anterior (p/ o Δ do chip). */
function ultimoEAnterior(pib: AtividadePibData, lente: LentePib): UltimoEAnterior | null {
  const rows = blocoDoPib(pib, lente.bloco);
  const campo = lente.chave("pib");
  let i = rows.length - 1;
  while (i >= 0 && num(rows[i], campo) == null) i--;
  if (i < 0) return null;
  const valor = num(rows[i], campo);
  if (valor == null) return null;
  let j = i - 1;
  while (j >= 0 && num(rows[j], campo) == null) j--;
  return {
    trim: String(rows[i].trim),
    valor,
    trimAnt: j >= 0 ? String(rows[j].trim) : null,
    valorAnt: j >= 0 ? num(rows[j], campo) : null,
  };
}

export function SerieMestraPibCard({
  pib,
  codace,
  geradoEm,
}: {
  pib: AtividadePibData;
  codace?: AtividadeCodaceData | null;
  geradoEm: string;
}) {
  const [lenteId, setLenteId] = useState<LenteMestraId>("yoy");
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "10y" });

  const lente = lentePib(lenteId);
  const ehVariacao = lente.grupo === "variacao";

  const points = useMemo(() => seriePib(pib, lente, "pib"), [pib, lente]);
  const minIso = points.length > 0 ? points[0][0] : "";
  const maxIso = points.length > 0 ? points[points.length - 1][0] : "";

  const xRefAreas = useMemo(() => codaceAreas(codace?.trimestral), [codace]);

  const ultimo = useMemo(() => ultimoEAnterior(pib, lente), [pib, lente]);
  const delta = ultimo && ultimo.valorAnt != null ? +(ultimo.valor - ultimo.valorAnt).toFixed(2) : null;

  const tabela = useMemo(() => pib.variacao.serie.slice(-8).reverse(), [pib.variacao.serie]);

  // --- CSV (mesma lógica do card antigo AnaliseCompletaPib) -----------------
  const csvSerie = () => {
    const header = ["trimestre", "qoq_sa", "yoy", "acum_ano", "acum_4t", "indice_sa"];
    const idxByTrim = new Map(pib.indice_volume.serie.map((r) => [r.trim, r]));
    const rows = pib.variacao.serie.map((r) => [
      r.trim,
      num(r, "qoq_sa_pib"),
      num(r, "yoy_pib"),
      num(r, "acum_ano_pib"),
      num(r, "acum_4t_pib"),
      num(idxByTrim.get(r.trim), "sa_pib"),
    ]);
    baixarCsv(`pib-serie-${pib.trim_recente}.csv`, header, rows);
  };

  const temContribuicoes = (pib.contribuicoes?.serie?.length ?? 0) > 0;
  const csvContribuicoes = () => {
    const serie = pib.contribuicoes?.serie ?? [];
    if (serie.length === 0) return;
    const keys = Object.keys(serie[serie.length - 1]).filter((k) => k !== "trim");
    const rows = serie.map((r) => [r.trim, ...keys.map((k) => num(r, k))]);
    baixarCsv(`pib-contribuicoes-${pib.trim_recente}.csv`, ["trimestre", ...keys], rows);
  };

  // --- Chip: último valor da lente ativa + Δ vs trimestre anterior ---------
  const chipTexto = ultimo
    ? [
        fmtTrimCurto(ultimo.trim),
        ehVariacao ? `${lente.label} ${fmtSignedPct(ultimo.valor, 1)}` : `índice SA ${fmtNum(ultimo.valor, 1)}`,
        delta != null && ultimo.trimAnt
          ? `${fmtSignedNum(delta, 1)} ${ehVariacao ? "p.p." : "pts"} vs ${fmtTrimCurto(ultimo.trimAnt)}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "— · sem observação nesta lente";

  const footer = (
    <div className="space-y-1.5">
      <p>
        <b>Fontes.</b> SIDRA 5932 (variações reais do PIB a preços de mercado: v6564 QoQ SA, v6561 YoY, v6562
        acumulada em 4 trimestres, v6563 acumulada no ano) e SIDRA 1621 (índice de volume com ajuste sazonal, média
        de 1995 = 100). Faixas cinza: recessões da cronologia trimestral do CODACE/FGV — a datação oficial é
        retroativa (última: 2020), contexto histórico e não detector de recessão corrente.
      </p>
      <p>
        <b>Transformações.</b> YoY = variação real vs o mesmo trimestre do ano anterior. Acum. 4T = soma dos últimos
        4 trimestres vs os 4 imediatamente anteriores (janela móvel de 12 meses). Acum. ano = trimestres do ano
        corrente até o divulgado vs o mesmo período do ano anterior (reinicia a cada 1T). Índice SA = nível do volume
        dessazonalizado, encadeado, média de 1995 = 100. QoQ SA (só na tabela) = variação real vs o trimestre
        anterior, com ajuste sazonal — a leitura de ritmo tem casa própria no card de variação trimestral.
      </p>
      <p>
        <b>Chip.</b> Último trimestre da lente ativa e a diferença vs o trimestre anterior (pontos percentuais nas
        variações; pontos de índice no nível). Verde = a medida subiu, vermelho = caiu, azul = estável — direção
        literal do número, sem julgamento. A linha tracejada em zero existe só nas lentes de variação e aparece
        quando a régua cruza o zero (na janela de 5 anos, toda positiva, ela fica fora do eixo).
      </p>
      <p>
        <b>Nível sem tendência.</b> O índice SA é exibido sem linha de PIB potencial: a estimativa por filtro HP
        saiu do site e só volta quando vier calculada do builder (não é derivada aqui no cliente).
      </p>
      <p>
        <b>CSV.</b> &ldquo;CSV série&rdquo; exporta, por trimestre, as 4 variações e o índice SA. &ldquo;CSV
        contribuições&rdquo; exporta as contribuições ao YoY em p.p. por ótica da oferta (agro, indústria, serviços,
        impostos, resíduo) e da demanda (consumo das famílias, governo, FBCF, exportações, importações já com sinal
        trocado, resíduo). Padrão Excel pt-BR.
      </p>
    </div>
  );

  return (
    <ChartCard
      id="pib-serie-mestra"
      title="PIB — série-mestra (4 transformações)"
      subtitle="SIDRA 5932 / 1621 · YoY · acum. 4T · acum. ano · índice SA, uma por vez · recessões CODACE · últimos 8 trimestres em tabela · CSV"
      toolbar={
        <>
          <AzSegmented
            ariaLabel="Transformação da série do PIB"
            options={OPCOES_LENTE}
            value={lenteId}
            onChange={(id) => setLenteId(id as LenteMestraId)}
          />
          <AzPeriodSelector
            value={period}
            onChange={setPeriod}
            min={minIso || undefined}
            max={maxIso || undefined}
            periods={["5y", "10y", "max"]}
          />
          <button type="button" onClick={csvSerie} className={BTN_CSV_CLASS}>
            CSV série
          </button>
          {temContribuicoes ? (
            <button type="button" onClick={csvContribuicoes} className={BTN_CSV_CLASS}>
              CSV contribuições
            </button>
          ) : null}
        </>
      }
      footer={footer}
      stampGiro={geradoEm}
      stampDado={ultimo?.trim ?? pib.trim_recente}
    >
      <div className="mb-2 flex flex-wrap gap-1.5">
        <CockpitChip tom={tomPorSinal(delta)} title={lente.fonte}>
          {chipTexto}
        </CockpitChip>
      </div>

      <AzTimeSeriesChart
        series={[{ id: "pib", label: `PIB · ${lente.label}`, color: AZ_BRAND.azure, data: points }]}
        unit={lente.unit}
        yAxisLabel={lente.yAxisLabel}
        period={period}
        height={240}
        showLegend={false}
        dots={2}
        xRefAreas={xRefAreas}
        refLines={ehVariacao ? REF_ZERO : undefined}
      />

      <details className="group mt-3 rounded-lg border border-[#132960]/10 bg-white px-3 py-2">
        <summary className="cursor-pointer select-none text-xs font-semibold text-[#132960] marker:text-[#027DFC]">
          Últimos 8 trimestres × 4 medidas
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-xs tabular-nums">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-[10px] uppercase tracking-wider text-zinc-400">
                <th className="py-1.5 pr-2 font-semibold">Trimestre</th>
                {COLUNAS_TABELA.map((c) => (
                  <th key={c.key} className="py-1.5 pl-2 text-right font-semibold">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tabela.map((r) => (
                <tr key={r.trim} className="border-b border-zinc-100">
                  <td className="py-1.5 pr-2 font-semibold text-[#132960]">{fmtTrimCurto(r.trim)}</td>
                  {COLUNAS_TABELA.map((c) => {
                    const v = num(r, c.key);
                    return (
                      <td
                        key={c.key}
                        className="py-1.5 pl-2 text-right font-semibold"
                        style={{ color: v != null ? variationText(v) : AZ_CHART.ticks }}
                      >
                        {v != null ? fmtSignedPct(v, 1) : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </ChartCard>
  );
}
