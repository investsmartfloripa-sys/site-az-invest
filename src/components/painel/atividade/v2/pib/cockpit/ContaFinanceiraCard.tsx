"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import type { AtividadeCodaceData, AtividadePibData } from "@/lib/painel-atividade";
import { AzSegmented, ChartCard, CockpitChip } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart, type AzRefLine, type AzSeriesPoint, type AzTimeSeries } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND, AZ_CHART } from "@/lib/az-chart-theme";
import { fmtBRL, fmtPct } from "@/lib/format-br";
import { fmtTrimCurto, num, trimIsoCentral } from "../../shared";

/**
 * COCKPIT do PIB — conta financeira (SIDRA 2205, desde 2010): B.9 (capacidade
 * (+) / necessidade (−) líquida de financiamento — o SALDO da conta) e IDP
 * (investimento direto no país, lado passivo), em R$ bilhões correntes,
 * acumulado em 4 trimestres (default) ou trimestral. Chips: último B.9, último
 * IDP e cobertura IDP ÷ |B.9| (calculada no cliente). Adapta o antigo
 * CapacidadeFinanciamentoPib e absorve QualidadeFinanciamentoPib.
 */

type Recorte = "acum4t" | "tri";

/** Linha da conta financeira como o builder grava (campos `<k>_ativo|_passivo|_liquido` + `trim`). */
type LinhaFin = NonNullable<AtividadePibData["conta_financeira"]>["serie"][number];

const ROTULO_RECORTE: Record<Recorte, string> = { acum4t: "acum. 4T", tri: "trim." };

/** Linha do zero: navy (o rust default do refLine é a cor da série B.9). */
const REF_LINES: AzRefLine[] = [{ y: 0, color: AZ_CHART.zero }];

/** R$ milhões → R$ bilhões, 1 casa (o tooltip do chart usa fmtNum sem `dec`; 1 casa evita "−299,402"). */
function paraBi(v: number): number {
  return +(v / 1000).toFixed(1);
}

/** Série trimestral da conta financeira → pontos [ISO mês central, R$ bi]. */
function toPontos(rows: ReadonlyArray<LinhaFin>, campo: string): AzSeriesPoint[] {
  const out: AzSeriesPoint[] = [];
  for (const r of rows) {
    const trim = r.trim;
    const v = num(r, campo);
    if (typeof trim !== "string" || v == null) continue;
    out.push([trimIsoCentral(trim), paraBi(v)]);
  }
  return out;
}

/** Último trimestre com B.9 e IDP publicados (R$ milhões) — base dos chips e da cobertura. */
function ultimoPar(rows: ReadonlyArray<LinhaFin>): { trim: string; b9: number | null; idp: number | null } | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    const b9 = num(r, "b9_passivo");
    const idp = num(r, "idp_passivo");
    if (typeof r.trim === "string" && (b9 != null || idp != null)) return { trim: r.trim, b9, idp };
  }
  return null;
}

/** "−R$ 299,4 bi" / "R$ 473,1 bi" / "—". */
function fmtBi(v: number | null): string {
  return v == null ? "—" : `${fmtBRL(v, 1)} bi`;
}

export function ContaFinanceiraCard({
  pib,
  // codace aceito por simetria com os demais cards do cockpit (props padrão); a conta financeira não usa CODACE.
  geradoEm,
}: {
  pib: AtividadePibData;
  codace?: AtividadeCodaceData | null;
  geradoEm: string;
}) {
  const [recorte, setRecorte] = useState<Recorte>("acum4t");
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "10y" });

  const cf = pib.conta_financeira;
  const rows = useMemo<ReadonlyArray<LinhaFin>>(
    () => (recorte === "acum4t" ? (cf?.serie_acum4t ?? []) : (cf?.serie ?? [])),
    [cf, recorte],
  );

  // Séries plotadas: B.9 vive em b9_passivo (é o saldo; b9_ativo/b9_liquido vêm nulos), IDP em idp_passivo.
  const series = useMemo<AzTimeSeries[]>(
    () => [
      { id: "b9", label: "B.9 (saldo)", color: AZ_BRAND.rust, data: toPontos(rows, "b9_passivo") },
      { id: "idp", label: "IDP", color: AZ_BRAND.azure, data: toPontos(rows, "idp_passivo") },
    ],
    [rows],
  );

  const { minIso, maxIso } = useMemo(() => {
    let lo = "";
    let hi = "";
    for (const s of series) {
      for (const [d] of s.data) {
        if (!lo || d < lo) lo = d;
        if (!hi || d > hi) hi = d;
      }
    }
    return { minIso: lo, maxIso: hi };
  }, [series]);

  // Chips: último B.9 e IDP do recorte ativo; cobertura = IDP ÷ |B.9| × 100, só quando há necessidade (B.9 < 0).
  const ult = useMemo(() => ultimoPar(rows), [rows]);
  const b9Bi = ult?.b9 != null ? paraBi(ult.b9) : null;
  const idpBi = ult?.idp != null ? paraBi(ult.idp) : null;
  const cobertura =
    ult?.b9 != null && ult.idp != null && ult.b9 < 0 ? +((ult.idp / Math.abs(ult.b9)) * 100).toFixed(1) : null;
  const trimDado = ult?.trim ?? pib.trim_recente;
  const semDados = series.every((s) => s.data.length === 0);

  return (
    <ChartCard
      id="pib-conta-financeira"
      title="Conta financeira — B.9 e IDP (R$ bi)"
      subtitle="SIDRA 2205 · capacidade (+) / necessidade (−) líquida de financiamento e investimento direto no país · acumulado em 4 trimestres (default) ou trimestral · R$ bilhões correntes"
      toolbar={
        <>
          <AzSegmented
            ariaLabel="Frequência da conta financeira"
            options={[
              { id: "acum4t", label: "Acum. 4T" },
              { id: "tri", label: "Trimestral" },
            ]}
            value={recorte}
            onChange={(id) => setRecorte(id === "tri" ? "tri" : "acum4t")}
          />
          <AzPeriodSelector
            value={period}
            onChange={setPeriod}
            min={minIso || undefined}
            max={maxIso || undefined}
            periods={["5y", "10y", "max"]}
          />
        </>
      }
      footer={
        <div className="space-y-1.5">
          <p>
            <strong>O que é:</strong> conta financeira das Contas Nacionais Trimestrais (IBGE/SIDRA, tabela 2205,
            desde 2010), em R$ bilhões correntes. <strong>B.9</strong> = capacidade (+) / necessidade (−) líquida de
            financiamento da economia: a diferença entre a poupança bruta e o investimento, igual ao saldo das
            transações com o resto do mundo. <strong>Convenção de sinal:</strong> B.9 negativo = a poupança interna
            não cobre o investimento e o país recorre a financiamento externo (necessidade); positivo = credor líquido
            frente ao exterior. No Brasil, o acumulado em 4 trimestres tem sido negativo em toda a série publicada
            desde 2010 (o trimestral isolado fica positivo em alguns 2ºs trimestres, ex.: 2020 e 2021).
          </p>
          <p>
            <strong>Campos do payload:</strong> por construção do builder, o B.9 vive no campo <em>passivo</em>{" "}
            (<code>b9_passivo</code>) — ele é o SALDO da conta, não uma captação; por isso a série é rotulada
            &quot;B.9 (saldo)&quot;. <strong>IDP</strong> = investimento direto no país (participação no capital e
            empréstimos intercompanhia recebidos do exterior), lado passivo (<code>idp_passivo</code>) — o capital
            produtivo, de longo prazo, que financia a necessidade.
          </p>
          <p>
            <strong>Cobertura IDP / |B.9|:</strong> razão entre o IDP e o tamanho da necessidade de financiamento,
            calculada pela AZ no recorte ativo. Acima de 100% = a necessidade é integralmente financiada por capital
            produtivo (o restante da conta financeira é saída líquida ou acúmulo de ativos); abaixo de 100% = parte
            da necessidade depende de carteira, dívida ou outros fluxos, tipicamente mais voláteis. Só é calculada
            quando B.9 &lt; 0 (com capacidade de financiamento, mostra &quot;—&quot;); no recorte trimestral a razão
            é ruidosa — a leitura de referência é a acumulada em 4 trimestres.
          </p>
          <p>
            <strong>Recortes:</strong> Acum. 4T = soma móvel de 4 trimestres (fluxo anualizado, sem sazonalidade;
            os 3 primeiros trimestres de 2010 vêm nulos); Trimestral = fluxo do trimestre. A casa mensal e mais rica
            dessa pergunta (transações correntes, IDP, carteira, reservas) é a aba{" "}
            <Link href="/painel-economico/economia/brasil/contas-externas" className="font-semibold text-[#027DFC] underline">
              Contas Externas
            </Link>
            .
          </p>
        </div>
      }
      stampGiro={geradoEm}
      stampDado={trimDado}
    >
      <div className="mb-2 flex flex-wrap gap-1.5">
        <CockpitChip cor={AZ_BRAND.rust} title="Capacidade (+) / necessidade (−) líquida de financiamento, saldo da conta financeira">
          B.9 {fmtBi(b9Bi)} ({ROTULO_RECORTE[recorte]} {fmtTrimCurto(trimDado)})
        </CockpitChip>
        <CockpitChip cor={AZ_BRAND.azure} title="Investimento direto no país (passivo)">
          IDP {fmtBi(idpBi)}
        </CockpitChip>
        <CockpitChip
          tom="navy"
          title={
            cobertura == null
              ? "IDP ÷ |B.9| × 100 — calculada só quando há necessidade de financiamento (B.9 < 0)"
              : "IDP ÷ |B.9| × 100, calculado pela AZ no recorte ativo"
          }
        >
          cobertura IDP/|B.9| {cobertura == null ? "—" : fmtPct(cobertura, 0)}
        </CockpitChip>
      </div>
      {semDados ? (
        <p className="flex items-center justify-center text-center text-sm text-zinc-400" style={{ height: 240 }}>
          Conta financeira (SIDRA 2205) ausente nesta carga — o builder não gravou o bloco conta_financeira.
        </p>
      ) : (
        <AzTimeSeriesChart
          series={series}
          unit="none"
          yAxisLabel="R$ bi"
          period={period}
          height={240}
          refLines={REF_LINES}
          variant="default"
          showLegend
          dots={false}
        />
      )}
    </ChartCard>
  );
}
