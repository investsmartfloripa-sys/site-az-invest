"use client";

import {
  Area,
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
import type { CodaceFaixa, ProbitAzContribuicao, ProbitAzData, ProbitAzLabelPt } from "@/lib/painel-visao-geral";
import { formatMes, resumoProbabilidade } from "@/lib/painel-visao-geral";
import DataStamp from "@/components/painel/DataStamp";
import { MethodInfo } from "@/components/painel/core/MethodInfo";

import { rotuloFaixaCodace } from "./codace-rotulos";

type Modelo = {
  key: string;
  label: string;
  color: string;
  valor: number | null | undefined;
};

function corPara(p: number | null | undefined) {
  if (p === null || p === undefined) return "#71717a";
  return p >= 0.65 ? "#DC2626" : p >= 0.35 ? "#F59E0B" : "#10B981";
}

function medianaEstatistica(vs: number[]): number | null {
  if (vs.length === 0) return null;
  const ord = vs.slice().sort((a, b) => a - b);
  const m = Math.floor(ord.length / 2);
  return ord.length % 2 === 0 ? (ord[m - 1] + ord[m]) / 2 : ord[m];
}

// Gauge semicircular SVG (speedometer) — thresholds 65/35 de Chauvet-Hamilton (2006)
function GaugeSpeedometer({ valor, label }: { valor: number; label: string }) {
  // valor 0-1, semicirculo de -90 (esquerda) a +90 (direita) - 180 total
  const v = Math.max(0, Math.min(1, valor));
  const corPonteiro = corPara(v);

  // Geometria - viewBox amplo o suficiente pra TUDO caber
  const W = 280;
  const H = 220;
  const cx = W / 2; // 140
  const cy = 150;   // base do semicirculo - deixa espaco em baixo pro texto
  const rOut = 110;
  const rIn = 78;

  // Helper: arc path - startDeg/endDeg em graus desde topo (12h), sentido horario
  function arcPath(startDeg: number, endDeg: number, radius: number, innerRadius: number) {
    // semicirculo do topo: 0deg = 12h = (cx, cy-r); 90deg = 3h; -90deg = 9h
    // Para gauge horizontal queremos -90 (esq) -> +90 (dir)
    // Convertendo: gauge angle (0..180 da esq pra dir) - 90 = SVG angle
    const sa = ((startDeg - 90) * Math.PI) / 180;
    const ea = ((endDeg - 90) * Math.PI) / 180;
    const x1 = cx + radius * Math.cos(sa);
    const y1 = cy + radius * Math.sin(sa);
    const x2 = cx + radius * Math.cos(ea);
    const y2 = cy + radius * Math.sin(ea);
    const x3 = cx + innerRadius * Math.cos(ea);
    const y3 = cy + innerRadius * Math.sin(ea);
    const x4 = cx + innerRadius * Math.cos(sa);
    const y4 = cy + innerRadius * Math.sin(sa);
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`;
  }

  // Mapeando gauge: 0% -> 0deg (esq), 100% -> 180deg (dir)
  // 35% -> 63deg, 65% -> 117deg
  const angDeg = v * 180; // 0..180
  const angSvgRad = ((angDeg - 90) * Math.PI) / 180; // -90 (esq) a +90 (dir)

  // Ponta do ponteiro a 90% do raio externo
  const pX = cx + (rOut - 8) * Math.cos(angSvgRad);
  const pY = cy + (rOut - 8) * Math.sin(angSvgRad);

  // Helper pra posicionar texto em um angulo
  function posAt(deg: number, r: number) {
    const a = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }
  const lbl0 = posAt(0, rOut + 14);
  const lbl35 = posAt(63, rOut + 14);
  const lbl65 = posAt(117, rOut + 14);
  const lbl100 = posAt(180, rOut + 14);

  // Tick marks pra cada 10%
  const ticks = [10, 20, 30, 40, 50, 60, 70, 80, 90];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[300px]">
      {/* Sombra do gauge (fundo cinza claro) */}
      <path d={arcPath(0, 180, rOut + 2, rIn - 2)} fill="#f4f4f5" />

      {/* 3 faixas — thresholds 65/35 (Chauvet-Hamilton 2006) */}
      <path d={arcPath(0, 63, rOut, rIn)} fill="#10B981" />
      <path d={arcPath(63, 117, rOut, rIn)} fill="#F59E0B" />
      <path d={arcPath(117, 180, rOut, rIn)} fill="#DC2626" />

      {/* Linhas brancas entre faixas pra dar definicao */}
      {[63, 117].map((d) => {
        const p1 = posAt(d, rIn);
        const p2 = posAt(d, rOut);
        return <line key={d} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="white" strokeWidth={2} />;
      })}

      {/* Tick marks pequenos */}
      {ticks.map((pct) => {
        const d = (pct / 100) * 180;
        const t1 = posAt(d, rOut - 4);
        const t2 = posAt(d, rOut + 2);
        return <line key={pct} x1={t1.x} y1={t1.y} x2={t2.x} y2={t2.y} stroke="#ffffff" strokeWidth={1} opacity={0.6} />;
      })}

      {/* Labels 0%, 35%, 65%, 100% */}
      <text x={lbl0.x} y={lbl0.y + 3} fontSize={11} fontWeight={600} fill="#52525b" textAnchor="middle">0%</text>
      <text x={lbl35.x} y={lbl35.y + 3} fontSize={11} fontWeight={600} fill="#10B981" textAnchor="middle">35%</text>
      <text x={lbl65.x} y={lbl65.y + 3} fontSize={11} fontWeight={600} fill="#F59E0B" textAnchor="middle">65%</text>
      <text x={lbl100.x} y={lbl100.y + 3} fontSize={11} fontWeight={600} fill="#52525b" textAnchor="middle">100%</text>

      {/* Ponteiro */}
      <line x1={cx} y1={cy} x2={pX} y2={pY} stroke={corPonteiro} strokeWidth={4} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={8} fill="white" stroke={corPonteiro} strokeWidth={2.5} />
      <circle cx={cx} cy={cy} r={3} fill={corPonteiro} />

      {/* Valor central GRANDE - bem abaixo do pivot pra nao colidir com ponteiro */}
      <text x={cx} y={cy + 42} fontSize={32} fontWeight={800} fill={corPonteiro} textAnchor="middle">{Math.round(v * 100)}%</text>
      {/* Label embaixo */}
      <text x={cx} y={cy + 60} fontSize={11} fill="#71717a" textAnchor="middle" fontWeight={500}>{label}</text>
    </svg>
  );
}

// Tabela técnica completa (códigos crus, betas) — sempre atrás de <details>
function TabelaTecnicaContribuicoes({ contribs }: { contribs: ProbitAzContribuicao[] }) {
  return (
    <table className="mt-2 w-full text-[10px]">
      <thead>
        <tr className="border-b border-zinc-200 text-zinc-500">
          <th className="text-left py-1">Série (código)</th>
          <th className="text-right">Coef.</th>
          <th className="text-right">Valor (desvios)</th>
          <th className="text-right">Contribuição</th>
        </tr>
      </thead>
      <tbody>
        {contribs.map((c, i) => (
          <tr key={i} className="border-b border-zinc-100">
            <td className="py-1 font-mono text-[9px]">{c.feature}</td>
            <td className="text-right">{c.beta.toFixed(2)}</td>
            <td className="text-right">{c.x_std.toFixed(2)}</td>
            <td className="text-right font-semibold" style={{ color: c.contrib_z >= 0 ? "#DC2626" : "#10B981" }}>
              {c.contrib_z >= 0 ? "+" : ""}{c.contrib_z.toFixed(2)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Barras horizontais divergentes agrupadas por grupo econômico (labels_pt do JSON)
function ContribuicoesPorGrupo({
  contribs,
  labels,
}: {
  contribs: ProbitAzContribuicao[];
  labels: Record<string, ProbitAzLabelPt>;
}) {
  const maxAbs = Math.max(0.01, ...contribs.map((c) => Math.abs(c.contrib_z)));
  const grupos = new Map<string, { rotulo: string; contrib: number }[]>();
  for (const c of contribs) {
    const lab = labels[c.feature];
    const grupo = lab?.grupo ?? "Outros";
    const rotulo = lab?.rotulo ?? c.feature;
    const arr = grupos.get(grupo) ?? [];
    arr.push({ rotulo, contrib: c.contrib_z });
    grupos.set(grupo, arr);
  }
  return (
    <div className="mt-2 space-y-3">
      {Array.from(grupos.entries()).map(([grupo, itens]) => (
        <div key={grupo}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{grupo}</div>
          <div className="mt-1 space-y-1">
            {itens.map((item, i) => {
              const pct = Math.round((Math.abs(item.contrib) / maxAbs) * 100);
              const positivo = item.contrib >= 0;
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-44 shrink-0 truncate text-[10px] text-zinc-700" title={item.rotulo}>{item.rotulo}</span>
                  <div className="flex h-3 flex-1 items-center">
                    <div className="flex w-1/2 justify-end">
                      {!positivo && <div className="h-2 rounded-l bg-emerald-500/80" style={{ width: `${pct}%` }} />}
                    </div>
                    <div className="h-3 w-px bg-zinc-300" />
                    <div className="w-1/2">
                      {positivo && <div className="h-2 rounded-r bg-rose-500/80" style={{ width: `${pct}%` }} />}
                    </div>
                  </div>
                  <span className="w-12 shrink-0 text-right text-[10px] font-semibold" style={{ color: positivo ? "#DC2626" : "#10B981" }}>
                    {positivo ? "+" : ""}{item.contrib.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-[9px] text-zinc-400">
        Barras para a direita (vermelho) elevam a probabilidade de recessão; para a esquerda (verde), reduzem.
      </p>
    </div>
  );
}

export function CardProbitAz({
  data,
  codace = [],
}: {
  data: ProbitAzData | null;
  codace?: CodaceFaixa[];
}) {
  if (!data || !data.serie || data.serie.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-900">Probabilidade de recessão — ensemble</h3>
        <p className="mt-2 text-sm text-zinc-500">Aguardando pipeline gerar dados...</p>
      </div>
    );
  }

  // FONTE ÚNICA: probabilidades.mediana / sinal_principal do JSON
  const resumo = resumoProbabilidade(data);
  const ultimaAz = data.probabilidades;
  const diffusion = ultimaAz?.diffusion ?? null;
  const gapHp = ultimaAz?.gap_hp ?? null;
  const probitFin = ultimaAz?.probit_fin ?? null;
  const probAz = ultimaAz?.probit_az ?? null;

  const corPrincipal = corPara(resumo.valor);

  // Credencial honesta: AUC só quando o pipeline publica backtest OOS de verdade
  const aucOos = typeof data.metadata?.auc_backtest_OOS === "number" ? data.metadata.auc_backtest_OOS : null;
  const aucNota = typeof data.metadata?.auc_nota === "string" ? data.metadata.auc_nota : null;

  const serieFinal = (data.serie ?? []).map((p) => {
    const vs = [p.diffusion, p.gap_hp, p.probit_fin, p.probit_az].filter((v): v is number => typeof v === "number");
    const minV = vs.length > 0 ? Math.min(...vs) : null;
    const maxV = vs.length > 0 ? Math.max(...vs) : null;
    return {
      mes: p.mes,
      diffusion: p.diffusion ?? undefined,
      banda: minV !== null && maxV !== null ? ([minV, maxV] as [number, number]) : null,
      mediana: typeof p.mediana === "number" ? p.mediana : medianaEstatistica(vs),
    };
  });

  const ultimas2 = serieFinal.filter((p) => p.mediana !== null && p.mediana !== undefined).slice(-2);
  const todasAlerta = ultimas2.length >= 2 && ultimas2.every((p) => (p.mediana ?? 0) >= 0.65);
  const todasCalmas = ultimas2.length >= 2 && ultimas2.every((p) => (p.mediana ?? 1) < 0.35);
  const estadoHist = todasAlerta ? "ALERTA" : todasCalmas ? "ESTÁVEL" : "CAUTELA";
  const corHist = estadoHist === "ALERTA" ? "#DC2626" : estadoHist === "ESTÁVEL" ? "#10B981" : "#F59E0B";

  const modelos: Modelo[] = [
    { key: "diffusion", label: "Difusão de coincidentes", color: "#F59E0B", valor: diffusion },
    { key: "gap_hp", label: "Gap HP", color: "#10B981", valor: gapHp },
    { key: "probit_fin", label: "Probit Financeiro", color: "#3B82F6", valor: probitFin },
    { key: "probit_az", label: "Probit Misto AZ", color: "#DC2626", valor: probAz },
  ];

  const hachuraStart = "2020-06";
  const primeiroMes = serieFinal[0]?.mes ?? "2003-01";
  const ultimoMes = serieFinal[serieFinal.length - 1]?.mes ?? "2026-12";
  const faixasVisiveis = codace.filter((f) => f.vale >= primeiroMes);

  const gaugeLabel = resumo.usaFallback
    ? `Probit AZ · ${formatMes(resumo.mes ?? "")}`
    : `Mediana de ${resumo.nModelos} de 4 modelos · ${formatMes(resumo.mes ?? "")}`;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm border-l-4" style={{ borderLeftColor: corPrincipal }}>
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <h3 className="text-base font-bold text-[#132960]">
            Termômetro de recessão — mediana de {resumo.nModelos} de 4 modelos causais
            <MethodInfo className="ml-1.5 align-middle">
              Quatro metodologias da literatura (Moore 1950, Hamilton 2018, Estrella-Mishkin 1998,
              Issler-Vahid 2006).
            </MethodInfo>
          </h3>
          <p className="text-[10px] text-zinc-500 mt-0.5 leading-tight">
            {aucOos !== null ? (
              <>Backtest fora da amostra: AUC <strong>{aucOos.toFixed(2)}</strong>.</>
            ) : (
              <span title={aucNota ?? undefined}>Backtest formal em construção — sem credencial de acerto até validação fora da amostra.</span>
            )}
          </p>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded" style={{ backgroundColor: corHist + "22", color: corHist }}>
            HISTERESE: {estadoHist}
          </span>
          <MethodInfo align="right" className="ml-1.5 align-middle">
            Chauvet-Hamilton (2006) · 65/35 · 2m persist.
          </MethodInfo>
        </div>
      </div>

      {/* Aviso de fallback: mediana indisponível (n<3) — exibe probit_az isolado, nunca apaga */}
      {resumo.usaFallback && (
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-800">
          ⚠ <strong>{resumo.nModelos} de 4 modelos disponíveis</strong> — mediana indisponível nesta rodada; exibindo o Probit AZ isolado.
        </div>
      )}

      {/* GRID 2 colunas: Gauge à esquerda + Fan chart à direita */}
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 items-start">
        {/* Coluna esquerda: Gauge */}
        <div className="flex flex-col items-center bg-zinc-50 rounded-lg p-3 border border-zinc-100">
          {resumo.valor !== null && resumo.valor !== undefined ? (
            <GaugeSpeedometer valor={resumo.valor} label={gaugeLabel} />
          ) : (
            <p className="py-10 text-center text-xs text-zinc-400">Nenhum modelo disponível nesta rodada — aguardando pipeline.</p>
          )}
          <div className="mt-2 grid grid-cols-2 gap-1.5 w-full">
            {modelos.map((m) => (
              <div key={m.key} className="rounded border bg-white px-2 py-1 border-l-[3px]" style={{ borderLeftColor: m.color }}>
                <div className="text-[8px] uppercase tracking-wider font-bold leading-none" style={{ color: m.color }}>
                  {m.label}
                </div>
                <div className="text-sm font-bold text-zinc-900">
                  {m.valor !== null && m.valor !== undefined ? `${Math.round(m.valor * 100)}%` : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Coluna direita: Fan chart — mediana grossa + banda mín–máx dos modelos */}
        <div className="min-w-0">
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={serieFinal} margin={{ top: 14, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="mes"
                tick={{ fontSize: 9 }}
                tickFormatter={(v) => formatMes(String(v))}
                minTickGap={36}
              />
              <YAxis tick={{ fontSize: 9 }} domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
              <Tooltip
                formatter={(v: unknown) => {
                  if (typeof v === "number") return `${Math.round(v * 100)}%`;
                  if (Array.isArray(v)) return v.map((x) => (typeof x === "number" ? `${Math.round(x * 100)}%` : "—")).join(" a ");
                  return "—";
                }}
                labelFormatter={(l: unknown) => formatMes(String(l ?? ""))}
              />
              <ReferenceLine y={0.65} stroke="#DC2626" strokeDasharray="4 4" opacity={0.4} />
              <ReferenceLine y={0.35} stroke="#10B981" strokeDasharray="4 4" opacity={0.4} />
              {faixasVisiveis.map((f, i) => (
                <ReferenceArea
                  key={`cod-${i}`}
                  x1={f.pico > primeiroMes ? f.pico : primeiroMes}
                  x2={f.vale}
                  fill="#9CA3AF"
                  fillOpacity={0.22}
                  label={{ value: rotuloFaixaCodace(f.pico), position: "insideTop", fontSize: 8, fill: "#6B7280" }}
                />
              ))}
              <ReferenceArea x1={hachuraStart} x2={ultimoMes} fill="#9CA3AF" fillOpacity={0.06} strokeOpacity={0} />
              <Area
                type="monotone"
                dataKey="banda"
                stroke="none"
                fill="#132960"
                fillOpacity={0.14}
                name="Faixa mín–máx dos modelos"
                connectNulls
                isAnimationActive={false}
              />
              <Line type="monotone" dataKey="diffusion" stroke="#F59E0B" strokeWidth={0.9} dot={false} connectNulls opacity={0.6} name="% de coincidentes em queda (janela 4m)" />
              <Line type="monotone" dataKey="mediana" stroke="#132960" strokeWidth={2.4} dot={false} connectNulls name="Mediana" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-[9px] text-zinc-500 flex-wrap">
        <span className="inline-flex items-center gap-1"><span className="w-3 h-[2px]" style={{ backgroundColor: "#132960" }}></span><strong className="text-zinc-700">Mediana</strong></span>
        <span>·</span>
        <span>sombra azul = faixa mín–máx dos modelos</span>
        <span>·</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-[2px]" style={{ backgroundColor: "#F59E0B" }}></span>% de coincidentes em queda (janela 4m)</span>
        <span>·</span>
        <span>faixas cinza = recessões CODACE oficiais</span>
        <span>·</span>
        <span>hachura pós-jun/2020 = sem datação CODACE</span>
      </div>

      {data.contribuicoes_top15 && data.contribuicoes_top15.length > 0 && (
        <div className="mt-3 border-t border-zinc-100 pt-3">
          <h4 className="text-xs font-semibold text-zinc-800">
            O que puxa o Probit AZ em {formatMes(ultimaAz?.mes ?? "")}
          </h4>
          {data.labels_pt && Object.keys(data.labels_pt).length > 0 ? (
            <>
              <ContribuicoesPorGrupo contribs={data.contribuicoes_top15} labels={data.labels_pt} />
              <details className="mt-2">
                <summary className="cursor-pointer text-[10px] text-[#132960] hover:underline">
                  Tabela técnica completa (códigos das séries e coeficientes)
                </summary>
                <TabelaTecnicaContribuicoes contribs={data.contribuicoes_top15} />
              </details>
            </>
          ) : (
            <details className="mt-1">
              <summary className="cursor-pointer text-[10px] text-[#132960] hover:underline">
                Detalhamento técnico das contribuições (códigos das séries)
              </summary>
              <p className="mt-1 text-[9px] text-zinc-400">
                Rótulos em português em preparação no pipeline; abaixo, os códigos crus das séries.
              </p>
              <TabelaTecnicaContribuicoes contribs={data.contribuicoes_top15} />
            </details>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-[9px] text-zinc-500 leading-tight">
          <strong>Refs:</strong> Moore 1950 (Diffusion) · Hodrick-Prescott 1997 / Ravn-Uhlig 2002 + Hamilton 2018 (Gap) · Estrella-Mishkin 1998 + Wright 2006 + Mendonça-Galvão-Lima 2018 (Probit Fin) · Issler-Vahid 2006 (Probit AZ) · Bates-Granger 1969 (ensembles) · Chauvet-Hamilton 2006 (histerese 65/35).
        </p>
        <DataStamp giro={data.gerado_em} dado={serieFinal[serieFinal.length - 1]?.mes} />
      </div>
    </section>
  );
}
