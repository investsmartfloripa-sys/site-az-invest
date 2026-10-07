"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import DataStamp from "@/components/painel/DataStamp";
import {
  PlDecomposicaoCard,
  PlDispersaoCard,
  PlVariaveisCard,
  grupoDispersao,
} from "@/components/painel/acoes/AcoesPlModeloDetalhe";
import { AcoesPremioNtnb } from "@/components/painel/acoes/AcoesPremioNtnb";
import { PL_CORES, rotuloMes } from "@/components/painel/acoes/plModeloShared";
import {
  AzPeriodSelector,
  resolvePeriodRange,
  type AzPeriodValue,
} from "@/components/painel/charts";
import { Divisor, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { MethodInfo } from "@/components/painel/core/MethodInfo";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import {
  buildTimeTicks,
  diffDaysUTC,
  fmtMesCurto,
  fmtNum,
  fmtSignedNum,
  formatTimeTickLabel,
  isoFromUTC,
  parseIsoUTC,
} from "@/lib/format-br";
import type { AcoesValuationData, IbovPlModeloData, IbovPlModeloRow } from "@/lib/painel-acoes";

/** Linha do gráfico: mês do histórico ou mês projetado (proj_*: pelas implícitas do dia). */
type Linha = IbovPlModeloRow & {
  t: number;
  projetado?: boolean;
  proj_juros?: number | null;
  proj_completo?: number | null;
  proj_selic?: number | null;
  proj_fed?: number | null;
};

const fmtTaxa = (v: number | null | undefined) => (v != null ? `${fmtNum(v, 2)}%` : "—");

function PlTooltip({
  active,
  payload,
  mean,
  sd,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
  mean: number;
  sd: number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const r = payload[0]?.payload as Linha | undefined;
  if (!r) return null;
  if (r.projetado) {
    return (
      <div
        style={{
          background: AZ_BRAND.navy,
          borderRadius: 8,
          color: "#fff",
          fontSize: 12,
          boxShadow: "0 4px 12px rgba(19,41,96,.25)",
          padding: "8px 12px",
          maxWidth: 300,
        }}
      >
        <p style={{ color: "#94A3B8", fontWeight: 600, margin: 0, marginBottom: 4 }}>
          {fmtMesCurto(r.date)} · projeção
        </p>
        {(
          [
            ["Justificado — completo", r.proj_completo, PL_CORES.completo],
            ["Justificado — só juros", r.proj_juros, PL_CORES.juros],
          ] as Array<[string, number | null | undefined, string]>
        ).map(([nome, v, cor]) => (
          <p key={nome} style={{ display: "flex", alignItems: "center", gap: 6, margin: 0, whiteSpace: "nowrap" }}>
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%", background: cor, flexShrink: 0 }} />
            <span style={{ color: "#C7D2E8" }}>{nome}</span>
            <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", marginLeft: "auto" }}>
              {v != null ? `${fmtNum(v, 1)}x` : "—"}
            </span>
          </p>
        ))}
        <p style={{ margin: "4px 0 0", color: "#C7D2E8" }}>
          Selic implícita <strong style={{ color: "#fff" }}>{fmtTaxa(r.proj_selic)}</strong> · Fed implícita{" "}
          <strong style={{ color: "#fff" }}>{fmtTaxa(r.proj_fed)}</strong>
        </p>
      </div>
    );
  }
  const z = r.pl != null && sd > 0 ? (r.pl - mean) / sd : null;
  const itens: Array<[string, number | null, string]> = [
    ["P/L observado", r.pl, PL_CORES.obs],
    ["Justificado — completo", r.fit_completo, PL_CORES.completo],
    ["Justificado — só juros", r.fit_juros, PL_CORES.juros],
  ];
  const partes = (
    [
      ["prejuízo", r.excl_prejuizo],
      ["sem dado", r.excl_sem_dado],
      ["P/L fora de 2–100x", r.excl_teto],
    ] as Array<[string, number | null]>
  ).filter(([, v]) => v != null && v > 0.05);
  return (
    <div
      style={{
        background: AZ_BRAND.navy,
        borderRadius: 8,
        color: "#fff",
        fontSize: 12,
        boxShadow: "0 4px 12px rgba(19,41,96,.25)",
        padding: "8px 12px",
        maxWidth: 300,
      }}
    >
      <p style={{ color: "#94A3B8", fontWeight: 600, margin: 0, marginBottom: 4 }}>{rotuloMes(r)}</p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {itens.map(([nome, v, cor]) => (
          <li key={nome} style={{ display: "flex", alignItems: "center", gap: 6, padding: "1px 0", whiteSpace: "nowrap" }}>
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%", background: cor, flexShrink: 0 }} />
            <span style={{ color: "#C7D2E8" }}>{nome}</span>
            <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", marginLeft: "auto" }}>
              {v != null ? `${fmtNum(v, 1)}x` : "—"}
            </span>
          </li>
        ))}
      </ul>
      {z != null ? (
        <p style={{ margin: "4px 0 0", color: "#C7D2E8" }}>
          z do observado: <strong style={{ color: "#fff" }}>{fmtSignedNum(z, 2)}σ</strong>
        </p>
      ) : (
        <p style={{ margin: "4px 0 0", color: "#C7D2E8" }}>Sem P/L: menos de 60% do índice no cálculo</p>
      )}
      {r.excl != null && r.excl > 0.05 ? (
        <p style={{ margin: "2px 0 0", color: "#C7D2E8", whiteSpace: "normal" }}>
          Peso fora do cálculo {fmtNum(r.excl, 1)}%
          {partes.length ? ` · ${partes.map(([n, v]) => `${n} ${fmtNum(v, 1)}%`).join(" · ")}` : ""}
        </p>
      ) : null}
    </div>
  );
}

function Amostra({ cor, tracejado, pontilhado }: { cor: string; tracejado?: boolean; pontilhado?: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-block h-0.5 w-4 align-middle"
      style={
        pontilhado
          ? { backgroundImage: `repeating-linear-gradient(90deg, ${cor} 0 2px, transparent 2px 5px)` }
          : tracejado
            ? { backgroundImage: `repeating-linear-gradient(90deg, ${cor} 0 5px, transparent 5px 8px)` }
            : { backgroundColor: cor }
      }
    />
  );
}

/** Histórico + meses projetados. O 1º ponto da projeção é hoje: entra na linha do mês corrente,
 *  para as linhas pontilhadas saírem do justificado de hoje. */
function montarLinhas(m: IbovPlModeloData): { hist: Linha[]; proj: Linha[] } {
  const hist: Linha[] = m.serie.map((r) => ({ ...r, t: parseIsoUTC(r.date) }));
  const pts = m.projecao?.pontos ?? [];
  if (pts.length < 2 || !hist.length) return { hist, proj: [] };
  const vazio = Object.fromEntries(m.variaveis.map((v) => [v.key, null]));
  const proj: Linha[] = [];
  pts.forEach((p, i) => {
    const extra = { proj_juros: p.juros, proj_completo: p.completo, proj_selic: p.selic, proj_fed: p.fed };
    const ult = hist[hist.length - 1];
    if (i === 0 && ult.mes === p.mes) {
      Object.assign(ult, extra);
      return;
    }
    proj.push({
      ...(vazio as Record<string, null>),
      date: p.date,
      mes: p.mes,
      parcial: false,
      na_amostra: false,
      pl: null,
      fit_juros: null,
      fit_completo: null,
      excl: null,
      excl_teto: null,
      excl_prejuizo: null,
      excl_sem_dado: null,
      ...extra,
      projetado: true,
      t: parseIsoUTC(p.date),
    } as Linha);
  });
  return { hist, proj };
}

function PlJustificadoCard({ m }: { m: IbovPlModeloData }) {
  const { hist: rows, proj } = useMemo(() => montarLinhas(m), [m]);
  const [win, setWin] = useState<AzPeriodValue>({ id: "max" }); // abre sempre no histórico inteiro
  const dMin = rows[0]?.date;
  const dMax = rows[rows.length - 1]?.date;
  const vis = useMemo(() => {
    if (!rows.length) return [];
    const { from, to } = resolvePeriodRange(win, rows[0].date, rows[rows.length - 1].date);
    const h = rows.filter((r) => r.date >= from && r.date <= to);
    // A projeção acompanha qualquer janela que chegue até hoje.
    return h.length && h[h.length - 1].date === rows[rows.length - 1].date ? [...h, ...proj] : h;
  }, [rows, proj, win]);
  const temProj = vis.some((r) => r.projetado);
  const pj = m.projecao;
  const pFim = pj?.pontos[pj.pontos.length - 1];
  const span = vis.length > 1 ? Math.max(1, diffDaysUTC(vis[0].date, vis[vis.length - 1].date)) : 1;
  const xTicks = useMemo(
    () => buildTimeTicks(vis.map((r) => r.date), span).map((iso) => parseIsoUTC(iso)).filter((t) => Number.isFinite(t)),
    [vis, span],
  );
  const s = m.pl_stats;
  const h = m.hoje;
  const [lo, hi] = useMemo(() => {
    const vals = vis
      .flatMap((r) => [r.pl, r.fit_juros, r.fit_completo, r.proj_juros ?? null, r.proj_completo ?? null])
      .filter((v): v is number => v != null && Number.isFinite(v));
    const a = Math.min(...vals, s.minus1);
    const b = Math.max(...vals, s.plus1);
    const pad = (b - a) * 0.08 || 1;
    return [Math.floor(a - pad), Math.ceil(b + pad)];
  }, [vis, s]);
  const dentro = (v: number) => v >= lo && v <= hi;

  return (
    <article className="rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm md:p-5">
      <header className="flex flex-wrap items-start justify-between gap-2 pb-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            P/L do Ibovespa × P/L justificado pelos juros ({fmtMesCurto(h.data)})
            <MethodInfo className="ml-1.5 align-middle">
              P/L observado: lucro por ação reportado nos últimos 12 meses (calendário de resultados,
              pela data de anúncio) contra o preço, agregado pela média harmônica com os pesos atuais
              do Ibovespa; último dia útil de cada mês. P/L justificado: o que a relação histórica
              entre lucro sobre preço (o inverso do P/L) e juros reais prevê para as condições do mês — o modelo
              é estimado no lucro sobre preço porque, pela fórmula de Gordon, é ele que anda em linha reta com os
              juros; o P/L faz curva. &quot;Só juros&quot; usa Selic real,
              juro real de 5 e de 30 anos; o &quot;modelo completo&quot; acrescenta a mudança esperada da Selic,
              o juro real americano de 10 anos, a Fed Funds real, o cupom cambial real e a tendência do juro
              americano. Projeção (pontilhado): a Selic implícita e a Fed implícita do dia, as mesmas do
              Panorama, fazem o papel da Selic e da Fed Funds nos meses seguintes; as demais variáveis ficam
              no nível de hoje. Reestimado a cada
              fechamento de mês (amostra {fmtMesCurto(m.amostra.inicio)}–{fmtMesCurto(m.amostra.fim)},{" "}
              {m.amostra.n} meses). Meses em que menos de 60% do índice tem lucro positivo ficam sem P/L.
              Não é recomendação.
            </MethodInfo>
          </h3>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Mensal desde {fmtMesCurto(s.inicio)} · média e bandas de ±1σ/±2σ de todo o histórico
          </p>
        </div>
        <AzPeriodSelector
          value={win}
          onChange={setWin}
          min={dMin}
          max={dMax}
          periods={["ytd", "1y", "5y", "10y", "max"]}
        />
      </header>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-2 text-[11px] text-zinc-600">
        <span className="inline-flex items-center gap-1.5">
          <Amostra cor={PL_CORES.obs} />
          P/L observado <strong className="tabular-nums text-[#132960]">{fmtNum(h.pl, 1)}x</strong>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Amostra cor={PL_CORES.completo} />
          Justificado — modelo completo{" "}
          <strong className="tabular-nums text-[#132960]">{fmtNum(h.justificado_completo, 1)}x</strong>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Amostra cor={PL_CORES.juros} tracejado />
          Justificado — só juros <strong className="tabular-nums text-[#132960]">{fmtNum(h.justificado_juros, 1)}x</strong>
        </span>
        {temProj && pFim ? (
          <span className="inline-flex items-center gap-1.5">
            <Amostra cor={PL_CORES.completo} pontilhado />
            Projeção pelas implícitas de hoje · {fmtMesCurto(pFim.date)}:{" "}
            {pFim.completo != null ? (
              <>
                completo <strong className="tabular-nums text-[#132960]">{fmtNum(pFim.completo, 1)}x</strong> ·{" "}
              </>
            ) : null}
            só juros <strong className="tabular-nums text-[#132960]">{fmtNum(pFim.juros, 1)}x</strong>
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5 text-zinc-500">
          <Amostra cor={PL_CORES.media} tracejado />
          média {fmtNum(s.mean, 1)}x
        </span>
        <span className="inline-flex items-center gap-1.5 text-zinc-500">
          <span aria-hidden className="inline-block h-2.5 w-3 rounded-sm" style={{ backgroundColor: "rgba(2,125,252,0.14)" }} />
          ±1σ
          <span aria-hidden className="ml-1 inline-block h-2.5 w-3 rounded-sm" style={{ backgroundColor: "rgba(2,125,252,0.06)" }} />
          ±2σ
        </span>
      </div>

      {m.avisos.length ? (
        <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          {m.avisos.join(" ")}
        </p>
      ) : null}

      <div style={{ height: 320 }} className="w-full">
        {vis.length < 2 ? (
          <div className="flex h-full items-center justify-center text-xs italic text-zinc-400">sem dados na janela</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={vis} margin={{ top: 8, right: 30, bottom: 0, left: 0 }}>
              <CartesianGrid {...azGridProps()} />
              <XAxis
                {...azXAxisProps()}
                dataKey="t"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                ticks={xTicks.length ? xTicks : undefined}
                tickFormatter={(t) => formatTimeTickLabel(isoFromUTC(Number(t)), span)}
                minTickGap={28}
              />
              <YAxis
                {...azYAxisProps()}
                domain={[lo, hi]}
                allowDataOverflow
                width={40}
                tickFormatter={(v) => `${fmtNum(Number(v), 0)}x`}
              />
              <ReferenceArea y1={Math.max(s.minus2, lo)} y2={Math.min(s.plus2, hi)} fill={PL_CORES.banda} fillOpacity={0.06} ifOverflow="hidden" />
              <ReferenceArea y1={s.minus1} y2={s.plus1} fill={PL_CORES.banda} fillOpacity={0.08} ifOverflow="hidden" />
              <ReferenceLine
                y={s.mean}
                stroke={PL_CORES.media}
                strokeDasharray="4 3"
                ifOverflow="hidden"
                label={{ value: "média", position: "right", fontSize: 10, fill: PL_CORES.media }}
              />
              {(
                [
                  ["+1σ", s.plus1],
                  ["−1σ", s.minus1],
                  ["+2σ", s.plus2],
                  ["−2σ", s.minus2],
                ] as Array<[string, number]>
              )
                .filter(([, v]) => dentro(v))
                .map(([rot, v]) => (
                  <ReferenceLine
                    key={rot}
                    y={v}
                    stroke={PL_CORES.media}
                    strokeOpacity={0.35}
                    strokeDasharray="2 4"
                    ifOverflow="hidden"
                    label={{ value: rot, position: "right", fontSize: 9, fill: PL_CORES.media }}
                  />
                ))}
              {temProj ? (
                <ReferenceArea
                  x1={rows[rows.length - 1].t}
                  x2={vis[vis.length - 1].t}
                  fill={AZ_BRAND.navy}
                  fillOpacity={0.05}
                  ifOverflow="hidden"
                  label={{ value: "projeção", position: "insideTop", fontSize: 10, fill: PL_CORES.media }}
                />
              ) : null}
              <Tooltip content={<PlTooltip mean={s.mean} sd={s.sd} />} cursor={{ stroke: AZ_BRAND.navy, strokeOpacity: 0.25 }} />
              {temProj ? (
                <Line
                  type="linear"
                  dataKey="proj_juros"
                  name="Projeção — só juros"
                  stroke={PL_CORES.juros}
                  strokeWidth={1.8}
                  strokeDasharray="2 3"
                  dot={false}
                  isAnimationActive={false}
                />
              ) : null}
              {temProj ? (
                <Line
                  type="linear"
                  dataKey="proj_completo"
                  name="Projeção — completo"
                  stroke={PL_CORES.completo}
                  strokeWidth={2}
                  strokeDasharray="2 3"
                  dot={false}
                  isAnimationActive={false}
                />
              ) : null}
              <Line
                type="linear"
                dataKey="fit_juros"
                name="Justificado — só juros"
                stroke={PL_CORES.juros}
                strokeWidth={1.6}
                strokeDasharray="6 4"
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="linear"
                dataKey="fit_completo"
                name="Justificado — completo"
                stroke={PL_CORES.completo}
                strokeWidth={1.8}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="linear"
                dataKey="pl"
                name="P/L observado"
                stroke={PL_CORES.obs}
                strokeWidth={2.2}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
      <p className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-400">
        <span>
          Modelo estimado com dados até {fmtMesCurto(m.estimado_ate)} · linhas interrompidas = meses sem
          P/L confiável
          {temProj && pj
            ? ` · projeção: Selic implícita de ${fmtTaxa(pj.pontos[0].selic)} a ${fmtTaxa(pFim?.selic)}${
                pj.fed ? ` e Fed implícita de ${fmtTaxa(pj.pontos[0].fed)} a ${fmtTaxa(pFim?.fed)}` : ""
              }, demais variáveis paradas`
            : ""}{" "}
          · não é recomendação
        </span>
        <DataStamp giro={m.generated_at} dado={m.last_data_date} />
      </p>
    </article>
  );
}

/**
 * Seção Valuation da aba Analítico (Bolsa): P/L do Ibovespa contra o P/L que os juros
 * reais justificam (modelo de build_ibov_pl_modelo.py), dispersões, prêmio vs NTN-B e,
 * atrás do botão, as variáveis do modelo e a decomposição do justificado.
 */
export function AcoesPlModelo({ modelo, valuation }: { modelo: IbovPlModeloData; valuation: AcoesValuationData | null }) {
  const [verModelo, setVerModelo] = useState(false);
  const nOutras = modelo.dispersao.filter((d) => grupoDispersao(modelo, d.key) === "outras").length;
  const temOutras = nOutras > 0;
  // Juros (3 painéis) + demais (4 ou 5): a linha se divide na proporção, todo painel com a mesma largura.
  const grade =
    nOutras >= 5
      ? { linha: "xl:grid-cols-8", juros: "xl:col-span-3", outras: "xl:col-span-5" }
      : { linha: "xl:grid-cols-7", juros: "xl:col-span-3", outras: "xl:col-span-4" };

  return (
    <div className="space-y-4">
      <Divisor
        label="Valuation — P/L × juros reais"
        info="O P/L do Ibovespa comparado com a própria história (média e desvios) e com o P/L que os juros reais justificam. Acima do justificado, a bolsa está mais cara do que os juros explicam; abaixo, mais barata."
      />
      <PlJustificadoCard m={modelo} />

      <Divisor
        label="Modelo — variáveis e coeficientes"
        info={`As ${modelo.variaveis.length} variáveis do modelo completo, como entram na regressão (média mensal), e a conta que leva do lucro sobre preço médio da amostra ao P/L justificado de hoje.`}
        right={
          <button
            type="button"
            onClick={() => setVerModelo((v) => !v)}
            aria-expanded={verModelo}
            className="rounded-full border border-[#132960]/20 bg-white px-3 py-1 text-[11px] font-semibold text-[#132960] transition hover:border-[#132960]/40 hover:bg-zinc-50"
          >
            {verModelo ? "Ocultar variáveis" : "Ver as variáveis explicativas"}
          </button>
        }
      />
      {verModelo ? (
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
          <PlVariaveisCard m={modelo} />
          <PlDecomposicaoCard m={modelo} />
        </div>
      ) : null}

      <div className={`grid grid-cols-1 items-stretch gap-4 ${temOutras ? grade.linha : ""}`}>
        <div className={temOutras ? grade.juros : ""}>
          <PlDispersaoCard m={modelo} grupo="juros" />
        </div>
        {temOutras ? (
          <div className={grade.outras}>
            <PlDispersaoCard m={modelo} grupo="outras" />
          </div>
        ) : null}
      </div>
      {valuation && valuation.status === "ok" ? <AcoesPremioNtnb data={valuation} /> : null}
    </div>
  );
}
