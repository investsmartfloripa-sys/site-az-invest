"use client";

import { useMemo, useState } from "react";

import type { CambioMacroData, CambioRealPonto } from "@/lib/painel-contas-externas";
import { AzSegmented, ChartCard, CockpitChip, tomPorSinal } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart, type AzRefArea, type AzRefLine } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND, AZ_CHART, AZ_SERIES } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtPct, fmtSignedPct } from "@/lib/format-br";
import { fmtSinal, isoMes } from "./cockpit-shared";

const INICIO_REGUA = "2000-01";

function media_dp(serie: ReadonlyArray<CambioRealPonto>): { media: number; dp: number } | null {
  const xs = serie.filter((p) => p.mes >= INICIO_REGUA).map((p) => p.indice);
  if (xs.length < 24) return null;
  const media = xs.reduce((a, b) => a + b, 0) / xs.length;
  const dp = Math.sqrt(xs.reduce((a, b) => a + (b - media) ** 2, 0) / (xs.length - 1));
  return { media, dp };
}

function var12(serie: ReadonlyArray<CambioRealPonto>): number | null {
  if (serie.length < 13) return null;
  const u = serie[serie.length - 1];
  const a = serie[serie.length - 13];
  return a.indice ? (u.indice / a.indice - 1) * 100 : null;
}

type LenteReal = "reer_ipca" | "reer_ipa" | "nominal" | "bilateral" | "ptax";

/** Card — câmbio real e nominal: REER (IPCA e IPA), efetivo nominal, real bilateral vs US$ e PTAX. */
export function CambioRealCard({ cambio }: { cambio: CambioMacroData }) {
  const ex = useMemo(() => cambio.extras ?? {}, [cambio.extras]);
  const opcoes = [
    { id: "reer_ipca", label: "REER (IPCA)" },
    ...(ex.reer_ipa ? [{ id: "reer_ipa", label: "REER (IPA)" }] : []),
    ...(ex.efetivo_nominal ? [{ id: "nominal", label: "Efetivo nominal" }] : []),
    ...(ex.real_usd_oficial ? [{ id: "bilateral", label: "Real × US$" }] : []),
    { id: "ptax", label: "PTAX" },
  ];
  const [lente, setLente] = useState<LenteReal>("reer_ipca");
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });

  const cfg = useMemo(() => {
    const idx = (serie: CambioRealPonto[], nome: string, sgs: string) => ({ serie, nome, sgs, indice: true });
    switch (lente) {
      case "reer_ipa":
        return idx(ex.reer_ipa?.serie ?? [], "Câmbio efetivo real (IPA-DI)", "SGS 11757 · jun/1994 = 100");
      case "nominal":
        return idx(ex.efetivo_nominal?.serie ?? [], "Câmbio efetivo nominal", "SGS 20360 · jun/1994 = 100");
      case "bilateral":
        return idx(ex.real_usd_oficial?.serie ?? [], "Câmbio real R$ × US$ (IPCA, BCB)", "SGS 11753 · jun/1994 = 100");
      case "ptax":
        return {
          serie: cambio.nominal.serie.map((p) => ({ mes: p.mes, indice: p.ptax_media })),
          nome: "PTAX venda — média mensal",
          sgs: "SGS 1 · R$/US$",
          indice: false,
        };
      default:
        return idx(cambio.cambio_real.reer.serie.filter((p) => p.mes >= "1999-01"), "Câmbio efetivo real (IPCA)", "SGS 11752 · jun/1994 = 100");
    }
  }, [lente, ex, cambio]);

  const pts = useMemo(() => cfg.serie.map((p) => [isoMes(p.mes), p.indice] as const), [cfg.serie]);
  const regua = cfg.indice ? media_dp(cfg.serie) : null;
  const u = cfg.serie[cfg.serie.length - 1];
  const v12 = var12(cfg.serie);
  const desvio = regua && u ? (u.indice / regua.media - 1) * 100 : null;
  const refLines: AzRefLine[] = regua ? [{ y: +regua.media.toFixed(1), color: AZ_CHART.zero, label: `média ${INICIO_REGUA.slice(0, 4)}+` }] : [];
  const refAreas: AzRefArea[] = regua ? [{ y1: regua.media - regua.dp, y2: regua.media + regua.dp, color: AZ_BRAND.azure, opacity: 0.06, label: "±1 dp" }] : [];

  return (
    <ChartCard
      id="cambio-real"
      title={`${cfg.nome}`}
      subtitle={`${cfg.sgs} · ${cfg.indice ? "alta = DEPRECIAÇÃO do real · régua média 2000+ ± 1 dp (calculada)" : "média mensal do dólar de venda"}`}
      toolbar={
        <>
          <AzSegmented ariaLabel="Medida de câmbio" options={opcoes} value={lente} onChange={(id) => setLente(id as LenteReal)} />
          <AzPeriodSelector value={period} onChange={setPeriod} min={pts[0]?.[0]} max={pts[pts.length - 1]?.[0]} periods={["5y", "10y", "max"]} />
        </>
      }
      footer={
        <div className="space-y-1.5">
          <p>
            <b>Convenção BCB.</b> Nos índices de câmbio efetivo e real, ALTA = depreciação do real (mais reais por unidade da
            cesta). O REER pondera os principais parceiros comerciais e deflaciona pelo IPCA (ou pelo IPA-DI, mais próximo
            dos comercializáveis); o efetivo nominal é a mesma cesta sem deflator; o real × US$ é o bilateral oficial.
          </p>
          <p>
            <b>Régua.</b> Média e desvio-padrão desde jan/2000 calculados no site — posição relativa ao próprio histórico, NÃO
            taxa de equilíbrio. A análise de valor justo (paridades, UIP) vive na aba Câmbio.
          </p>
        </div>
      }
      stampGiro={cambio.generated_at}
      stampDado={u ? u.mes.slice(0, 7) : null}
    >
      <div className="mb-2 flex flex-wrap gap-1.5">
        <CockpitChip tom={tomPorSinal(v12)}>
          {u ? fmtMesCurto(isoMes(u.mes)) : "—"} · {u ? fmtNum(u.indice, cfg.indice ? 1 : 4) : "—"} · {fmtSignedPct(v12, 1)} em 12m
        </CockpitChip>
        {desvio != null ? <CockpitChip tom={tomPorSinal(desvio)}>{fmtSignedPct(desvio, 1)} vs média 2000+</CockpitChip> : null}
      </div>
      <AzTimeSeriesChart        niceYTicks        series={[{ id: lente, label: cfg.nome, color: AZ_BRAND.azure, data: pts }]}
        unit={cfg.indice ? "index" : "none"}
        yAxisLabel={cfg.indice ? "índice" : "R$/US$"}
        period={period}
        height={260}
        showLegend={false}
        refLines={refLines}
        refAreas={refAreas}
      />
    </ChartCard>
  );
}

type LentePpc = "taxas" | "nivel";
const OPCOES_PPC = [
  { id: "taxas", label: "PTAX × PPC" },
  { id: "nivel", label: "Nível de preços relativo" },
];

/** Card — paridade do poder de compra (anual). */
export function PpcCard({ cambio }: { cambio: CambioMacroData }) {
  const ppc = cambio.extras?.ppc;
  const [lente, setLente] = useState<LentePpc>("taxas");
  if (!ppc || ppc.serie.length === 0) return null;
  const serie = ppc.serie;
  const d = (ano: string) => `${ano}-07-01`;
  const ptax = serie.filter((p) => p.ptax_media != null).map((p) => [d(p.ano), p.ptax_media as number] as const);
  const taxa = serie.map((p) => [d(p.ano), p.ppc] as const);
  const nivel = serie.filter((p) => p.nivel_precos_relativo != null).map((p) => [d(p.ano), +((p.nivel_precos_relativo as number) * 100).toFixed(1)] as const);
  const u = [...serie].reverse().find((p) => p.nivel_precos_relativo != null);
  const media = nivel.length ? nivel.reduce((a, b) => a + b[1], 0) / nivel.length : null;

  return (
    <ChartCard
      id="ppc"
      title={lente === "taxas" ? "Paridade do poder de compra — PTAX × taxa de PPC" : "Nível de preços do Brasil ÷ EUA, em dólar"}
      subtitle={
        lente === "taxas"
          ? `${ppc.fonte} · PTAX média anual (SGS 1) · R$/US$`
          : "PPC ÷ PTAX média anual × 100 · 100 = mesma cesta custa o mesmo em dólar · linha = média do período"
      }
      toolbar={<AzSegmented ariaLabel="Lente" options={OPCOES_PPC} value={lente} onChange={(id) => setLente(id as LentePpc)} />}
      footer={
        <div className="space-y-1.5">
          <p>
            <b>PPC.</b> Taxa de câmbio que igualaria o poder de compra de uma cesta ampla de bens e serviços nos dois países
            (Programa de Comparação Internacional). A distância entre a PTAX e a PPC é o nível de preços relativo: abaixo de
            100, o Brasil é &ldquo;barato&rdquo; em dólar.
          </p>
          <p>
            <b>Leitura.</b> Economias emergentes operam estruturalmente abaixo de 100 (efeito Balassa-Samuelson: serviços
            não comercializáveis mais baratos onde a renda é menor). Por isso o nível não é desalinhamento; o que se
            acompanha é a TENDÊNCIA do nível de preços relativo e a distância para a própria média. O ano corrente usa a PTAX
            média até o último dia disponível.
          </p>
          {ppc._nota ? <p>{ppc._nota}</p> : null}
        </div>
      }
      stampGiro={cambio.generated_at}
      stampDado={u ? u.ano : null}
    >
      <div className="mb-2 flex flex-wrap gap-1.5">
        {u ? (
          <>
            <CockpitChip tom="navy">
              {u.ano}
              {u.parcial ? " (parcial)" : ""} · PPC {fmtNum(u.ppc, 2)} · PTAX média {fmtNum(u.ptax_media, 2)} R$/US$
            </CockpitChip>
            <CockpitChip tom="navy">
              nível de preços {fmtPct((u.nivel_precos_relativo ?? 0) * 100, 0)} dos EUA
              {media != null ? ` · média ${fmtNum(media, 0)}` : ""}
            </CockpitChip>
          </>
        ) : null}
      </div>
      {lente === "taxas" ? (
        <AzTimeSeriesChart          niceYTicks          series={[
            { id: "ptax", label: "PTAX média anual", color: AZ_BRAND.azure, data: ptax },
            { id: "ppc", label: "Taxa de PPC", color: AZ_SERIES[2], data: taxa },
          ]}
          yAxisLabel="R$/US$"
          height={250}
          dots={2}
        />
      ) : (
        <AzTimeSeriesChart          niceYTicks          series={[{ id: "nivel", label: "Nível de preços relativo", color: AZ_BRAND.azure, data: nivel }]}
          yAxisLabel="EUA = 100"
          height={250}
          dots={2}
          showLegend={false}
          refLines={media != null ? [{ y: +media.toFixed(1), color: AZ_CHART.zero, label: "média" }] : undefined}
        />
      )}
    </ChartCard>
  );
}

type LenteFund = "termos" | "icbr" | "juro";

/** Card — fundamentos do câmbio: termos de troca, commodities (IC-Br) e diferencial de juro real. */
export function FundamentosCambioCard({ cambio }: { cambio: CambioMacroData }) {
  const ex = cambio.extras ?? {};
  const opcoes = [
    ...(ex.termos_troca ? [{ id: "termos", label: "Termos de troca" }] : []),
    ...(ex.icbr_usd ? [{ id: "icbr", label: "IC-Br (US$)" }] : []),
    ...(ex.juro_real ? [{ id: "juro", label: "Juro real" }] : []),
  ];
  const [lente, setLente] = useState<LenteFund>((opcoes[0]?.id as LenteFund) ?? "juro");
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "10y" });
  if (opcoes.length === 0) return null;

  const juro = ex.juro_real?.serie ?? [];
  const serieIdx = lente === "termos" ? ex.termos_troca?.serie ?? [] : ex.icbr_usd?.serie ?? [];
  const ptsIdx = serieIdx.map((p) => [isoMes(p.mes), p.indice] as const);
  const br = juro.map((p) => [isoMes(p.mes), p.real_br] as const);
  const us = juro.map((p) => [isoMes(p.mes), p.real_eua] as const);
  const dif = juro.map((p) => [isoMes(p.mes), p.diferencial_real_pp] as const);
  const pts = lente === "juro" ? dif : ptsIdx;
  const uJ = juro[juro.length - 1];
  const uI = serieIdx[serieIdx.length - 1];
  const v12 = var12(serieIdx);
  const aJ = juro.length > 12 ? juro[juro.length - 13] : undefined;

  const titulo =
    lente === "termos"
      ? "Termos de troca — preço das exportações ÷ importações"
      : lente === "icbr"
        ? "Índice de Commodities Brasil (IC-Br) em US$"
        : "Juro real ex post — Brasil, EUA e diferencial";
  const sub =
    lente === "termos"
      ? `${ex.termos_troca?.fonte ?? "FUNCEX"} · ${ex.termos_troca?.base ?? ""} · mensal`
      : lente === "icbr"
        ? "BCB/SGS 29042 · dez/2005 = 100 · commodities agro, metal e energia ponderadas pela pauta"
        : "(1 + Selic meta) ÷ (1 + IPCA 12m) − 1 vs (1 + Fed Funds) ÷ (1 + CPI 12m) − 1 · % a.a. · p.p.";

  return (
    <ChartCard
      id="fundamentos-cambio"
      title={titulo}
      subtitle={sub}
      toolbar={
        <>
          <AzSegmented ariaLabel="Fundamento" options={opcoes} value={lente} onChange={(id) => setLente(id as LenteFund)} />
          <AzPeriodSelector value={period} onChange={setPeriod} min={pts[0]?.[0]} max={pts[pts.length - 1]?.[0]} periods={["5y", "10y", "max"]} />
        </>
      }
      footer={
        <div className="space-y-1.5">
          <p>
            <b>Termos de troca</b> (FUNCEX): razão entre os índices de preço das exportações e das importações. Alta = o país
            compra mais importações com a mesma quantidade exportada — historicamente associada a apreciação do real.
          </p>
          <p>
            <b>IC-Br</b> (BCB): preços em dólar das commodities relevantes para a inflação brasileira; é o principal canal
            externo do câmbio de um exportador de commodities.
          </p>
          <p>
            <b>Juro real ex post</b>: calculado no builder por Fisher com a inflação passada de 12 meses (não é a taxa ex ante
            dos títulos). O diferencial real é o que remunera o carregamento em reais descontada a inflação dos dois lados.
          </p>
        </div>
      }
      stampGiro={cambio.generated_at}
      stampDado={lente === "juro" ? (uJ ? uJ.mes.slice(0, 7) : null) : uI ? uI.mes.slice(0, 7) : null}
    >
      <div className="mb-2 flex flex-wrap gap-1.5">
        {lente === "juro" && uJ ? (
          <>
            <CockpitChip tom="navy">
              {fmtMesCurto(isoMes(uJ.mes))} · Brasil {fmtPct(uJ.real_br, 1)} · EUA {fmtPct(uJ.real_eua, 1)}
            </CockpitChip>
            <CockpitChip tom={tomPorSinal(aJ ? uJ.diferencial_real_pp - aJ.diferencial_real_pp : null)}>
              diferencial {fmtNum(uJ.diferencial_real_pp, 1)} p.p.{aJ ? ` · ${fmtSinal(uJ.diferencial_real_pp - aJ.diferencial_real_pp, 1)} em 12m` : ""}
            </CockpitChip>
          </>
        ) : uI ? (
          <CockpitChip tom={tomPorSinal(v12)}>
            {fmtMesCurto(isoMes(uI.mes))} · {fmtNum(uI.indice, 1)} · {fmtSignedPct(v12, 1)} em 12m
          </CockpitChip>
        ) : null}
      </div>
      {lente === "juro" ? (
        <AzTimeSeriesChart          niceYTicks          series={[
            { id: "dif", label: "Diferencial real (p.p.)", color: AZ_BRAND.navy, data: dif },
            { id: "br", label: "Brasil", color: AZ_SERIES[3], data: br },
            { id: "us", label: "EUA", color: AZ_SERIES[4], data: us },
          ]}
          unit="%"
          yAxisLabel="% a.a. / p.p."
          period={period}
          height={250}
          refLines={[{ y: 0, color: AZ_CHART.zero, dashed: false }]}
        />
      ) : (
        <AzTimeSeriesChart          niceYTicks          series={[{ id: lente, label: titulo, color: AZ_BRAND.azure, data: ptsIdx }]}
          unit="index"
          yAxisLabel="índice"
          period={period}
          height={250}
          showLegend={false}
        />
      )}
    </ChartCard>
  );
}
