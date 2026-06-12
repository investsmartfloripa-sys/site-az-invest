"use client";

import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import type { FiscalTermometroData, Matriz, IndicadorSemaforo, Nivel } from "@/lib/painel-fiscal";
import { CardHeader, KPI, Section } from "./FiscalShell";
import { SimuladorTrajetoria } from "./SimuladorTrajetoria";
import DataStamp from "@/components/painel/DataStamp";

function fmt(v: number | null | undefined, casas = 1, suf = ""): string {
  if (v == null) return "—";
  return `${v.toFixed(casas)}${suf}`;
}
function fmtPP(v: number | null | undefined, casas = 2): string {
  if (v == null) return "—";
  const s = v >= 0 ? "+" : "";
  return `${s}${v.toFixed(casas)} pp`;
}

const NIVEL_COR: Record<Nivel, { bg: string; bgFill: string; border: string; text: string; dot: string; label: string }> = {
  verde: { bg: "bg-emerald-50", bgFill: "bg-emerald-500", border: "border-emerald-300", text: "text-emerald-900", dot: "bg-emerald-500", label: "Verde" },
  amarelo: { bg: "bg-amber-50", bgFill: "bg-amber-500", border: "border-amber-300", text: "text-amber-900", dot: "bg-amber-500", label: "Atenção" },
  vermelho: { bg: "bg-rose-50", bgFill: "bg-rose-500", border: "border-rose-300", text: "text-rose-900", dot: "bg-rose-500", label: "Crítico" },
  break: { bg: "bg-red-100", bgFill: "bg-red-700", border: "border-red-500", text: "text-red-900", dot: "bg-red-700", label: "BREAK" },
  sem_dado: { bg: "bg-zinc-50", bgFill: "bg-zinc-300", border: "border-zinc-200", text: "text-zinc-500", dot: "bg-zinc-300", label: "Sem dado" },
};

// ============================================================================
// Glossario de siglas — exibido inline no card de cada indicador
// ============================================================================
const GLOSSARIO_SIGLAS: Record<string, string> = {
  DBGG: "Dívida Bruta do Governo Geral (gov. central + estados + municípios). Métrica padrão do FMI.",
  DLSP: "Dívida Líquida do Setor Público (DBGG − créditos públicos − ativos).",
  DPMFi: "Dívida Pública Mobiliária Federal interna (títulos do Tesouro).",
  LFT: "Letra Financeira do Tesouro — título indexado à Selic.",
  REER: "Real Effective Exchange Rate (câmbio real efetivo) — média ponderada pelas trocas comerciais.",
  NFSP: "Necessidade de Financiamento do Setor Público — déficit nominal anual.",
  PIB: "Produto Interno Bruto.",
  IPCA: "Índice de Preços ao Consumidor Amplo (inflação oficial).",
  Selic: "Taxa básica de juros do Banco Central.",
};

// ============================================================================
// Indicadores derivados (calculados, não vem direto de uma série)
// ============================================================================
const DERIVADOS: Record<string, { formula: string }> = {
  dbgg_pct_receita: { formula: "DBGG (R$) ÷ Receita líquida 12m do Tesouro" },
  divida_total_economia_pct_pib: { formula: "DBGG + crédito ao setor privado (BCB SGS 20622)" },
  custo_medio_aa_pct: { formula: "Juros nominais 12m ÷ DLSP média — taxa implícita da DLSP (convenção BCB)" },
  primario_estabilizador_pct_pib: { formula: "(i − g) × Dívida / (1 + g) — equação de Blanchard: superávit que estabiliza a dívida" },
  r_menos_g_pp: { formula: "Taxa implícita da DLSP (r) − crescimento nominal do PIB 12m YoY (g)" },
  selic_real_ex_post_pct: { formula: "((1 + Selic) ÷ (1 + IPCA 12m)) − 1" },
  lever_juros_delta_pp: { formula: "Diferença entre a taxa implícita da DLSP e o i* que estabiliza Dívida/Receita" },
  lever_inflacao_delta_pp: { formula: "Inflação adicional necessária para o crescimento nominal cobrir o gap" },
  lever_corte_despesa_pct: { formula: "(despesa atual − despesa alvo Blanchard) ÷ despesa atual" },
  lever_aumento_receita_pct: { formula: "Aumento da receita necessária para zerar gap fiscal estrutural" },
};

// ============================================================================
// TermometroVertical: régua à direita do valor com 4 faixas e ponto Brasil
// ============================================================================
function TermometroVertical({ ind }: { ind: IndicadorSemaforo }) {
  const faixas = [
    { nivel: "break" as const, valor: ind.break, label: "BREAK" },
    { nivel: "vermelho" as const, valor: ind.vermelho, label: "Crítico" },
    { nivel: "amarelo" as const, valor: ind.amarelo, label: "Atenção" },
    { nivel: "verde" as const, valor: ind.verde, label: "Verde" },
  ];
  // Para maior_pior, faixa de cima = pior. Para maior_melhor, faixa de cima = melhor.
  const direcaoLabel = ind.direcao === "maior_pior" ? ["Pior →", "Melhor →"] : ["Melhor →", "Pior →"];
  // Posiciona ponto Brasil na faixa correta
  const valorAtual = ind.valor;

  // Calcula em qual faixa cai o valor atual (0 a 3, de cima pra baixo)
  let posFaixa = -1;
  if (valorAtual != null) {
    if (ind.direcao === "maior_pior") {
      if (valorAtual >= ind.break) posFaixa = 0;
      else if (valorAtual >= ind.vermelho) posFaixa = 1;
      else if (valorAtual >= ind.amarelo) posFaixa = 2;
      else posFaixa = 3;
    } else {
      if (valorAtual <= ind.break) posFaixa = 0;
      else if (valorAtual <= ind.vermelho) posFaixa = 1;
      else if (valorAtual <= ind.amarelo) posFaixa = 2;
      else posFaixa = 3;
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-0.5">
      <div className="text-center text-[8px] font-semibold uppercase tracking-wider text-zinc-400">{direcaoLabel[0]}</div>
      {faixas.map((f, i) => {
        const cor = NIVEL_COR[f.nivel];
        const isBR = i === posFaixa;
        return (
          <div
            key={i}
            className={`relative flex h-7 items-center justify-between gap-1 rounded px-1.5 ${cor.bgFill} ${isBR ? "ring-2 ring-offset-1 ring-rose-700" : ""}`}
          >
            <span className="text-[9px] font-bold uppercase text-white drop-shadow">{f.label}</span>
            <span className="text-[9px] font-semibold tabular-nums text-white drop-shadow">
              {ind.direcao === "maior_pior" ? "≥" : "≤"}{f.valor.toFixed(0)}{ind.unidade.trim()}
            </span>
            {isBR && (
              <span className="absolute -left-2 top-1/2 -translate-y-1/2 text-rose-700" title="Brasil hoje">
                ▶
              </span>
            )}
          </div>
        );
      })}
      <div className="text-center text-[8px] font-semibold uppercase tracking-wider text-zinc-400">{direcaoLabel[1]}</div>
    </div>
  );
}

// ============================================================================
// IndicadorCard: card individual com termômetro vertical ao lado
// ============================================================================
function IndicadorCard({ id, ind }: { id: string; ind: IndicadorSemaforo }) {
  const cor = NIVEL_COR[ind.nivel];
  const valor = ind.valor;
  const isDerivado = id in DERIVADOS;

  // Detecta siglas no título e mostra glossário
  const siglasNoTitulo = Object.keys(GLOSSARIO_SIGLAS).filter((s) => ind.titulo.includes(s));

  return (
    <div className={`rounded-xl border-2 ${cor.border} ${cor.bg} p-4 shadow-sm`}>
      {/* Header com badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <h4 className={`text-sm font-bold leading-tight ${cor.text}`}>{ind.titulo}</h4>
          <div className="mt-1 flex flex-wrap gap-1">
            {isDerivado && (
              <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-violet-900" title="Indicador calculado, não vem direto de uma série">
                calculado
              </span>
            )}
            <span className={`rounded ${cor.dot} px-1.5 py-0.5 text-[9px] font-bold uppercase text-white`}>
              {cor.label}
            </span>
          </div>
        </div>
      </div>

      {/* Valor + Termometro vertical lado a lado */}
      <div className="mt-3 flex items-start gap-3">
        <div className="flex-1">
          <div className={`text-3xl font-bold tabular-nums ${cor.text}`}>
            {fmt(valor, valor != null && Math.abs(valor) > 100 ? 0 : 2, ind.unidade)}
          </div>
          {isDerivado && (
            <p className="mt-1 text-[10px] italic text-violet-700">
              Fórmula: {DERIVADOS[id].formula}
            </p>
          )}
        </div>
        <div className="w-32 flex-shrink-0">
          <TermometroVertical ind={ind} />
        </div>
      </div>

      {/* Narrativa Dalio */}
      <p className="mt-3 text-[11px] leading-relaxed text-zinc-700">{ind.narrativa}</p>

      {/* Glossário de siglas inline */}
      {siglasNoTitulo.length > 0 && (
        <div className="mt-2 border-t border-zinc-200 pt-2 text-[10px] text-zinc-600">
          {siglasNoTitulo.map((s) => (
            <div key={s}>
              <strong className="text-zinc-800">{s}:</strong> {GLOSSARIO_SIGLAS[s]}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Score como DISTRIBUIÇÃO (não nota inventada)
// ============================================================================
function DistribuicaoScore({ indicadores }: { indicadores: Record<string, IndicadorSemaforo> }) {
  const counts: Record<Nivel, number> = { verde: 0, amarelo: 0, vermelho: 0, break: 0, sem_dado: 0 };
  Object.values(indicadores).forEach((i) => { counts[i.nivel]++; });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const niveis: Nivel[] = ["verde", "amarelo", "vermelho", "break", "sem_dado"];

  return (
    <div className="rounded-2xl border-2 border-zinc-300 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-[#132960]">Distribuição dos indicadores</h3>
          <p className="mt-1 text-xs text-zinc-600">
            Como cada indicador está classificado pelas faixas Dalio (verde / atenção / crítico / break). <strong>Não é nota — é contagem.</strong>
          </p>
        </div>
        <div className="text-right text-xs text-zinc-500">{total} indicadores</div>
      </div>

      {/* Barra empilhada de proporção */}
      <div className="mt-4 flex h-8 w-full overflow-hidden rounded-lg border border-zinc-200">
        {niveis.map((n) => {
          const c = counts[n];
          if (c === 0) return null;
          const cor = NIVEL_COR[n];
          const pct = (c / total) * 100;
          return (
            <div
              key={n}
              className={`flex items-center justify-center ${cor.bgFill} text-[11px] font-bold text-white`}
              style={{ width: `${pct}%` }}
              title={`${cor.label}: ${c} indicadores`}
            >
              {pct > 8 && c}
            </div>
          );
        })}
      </div>

      {/* Legenda contagem */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-5">
        {niveis.map((n) => {
          const cor = NIVEL_COR[n];
          return (
            <div key={n} className={`flex items-center gap-2 rounded-lg ${cor.bg} px-2 py-1.5`}>
              <span className={`inline-block h-3 w-3 rounded ${cor.bgFill}`} />
              <span className={`flex-1 ${cor.text}`}>{cor.label}</span>
              <strong className={cor.text}>{counts[n]}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// SemaforoPorCategoria — agora com cards isolados (não grid colado)
// ============================================================================
function SemaforoPorCategoria({ indicadores, categorias }: { indicadores: Record<string, IndicadorSemaforo>; categorias: string[] }) {
  const porCategoria: Record<string, Array<[string, IndicadorSemaforo]>> = {};
  Object.entries(indicadores).forEach(([id, ind]) => {
    if (!porCategoria[ind.categoria]) porCategoria[ind.categoria] = [];
    porCategoria[ind.categoria].push([id, ind]);
  });

  // Traduções das categorias
  const TRAD: Record<string, string> = {
    "Carga": "A. Carga da dívida",
    "Capacidade": "B. Capacidade de pagamento",
    "Estrutura": "C. Estrutura da dívida",
    "Stress": "D. Sinais de stress",
    "Levers": "E. Alavancas (Levers) — quanto cada uma teria que mexer",
  };

  return (
    <div className="space-y-6">
      {categorias.map((cat) => {
        const items = porCategoria[cat];
        if (!items?.length) return null;
        return (
          <div key={cat}>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-[#132960]">{TRAD[cat] ?? cat}</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {items.map(([id, ind]) => (<IndicadorCard key={id} id={id} ind={ind} />))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// MatrizDalio (mantido)
// ============================================================================
function heatColor(t: number): string {
  const c = Math.max(0, Math.min(1, t));
  if (c < 0.5) {
    const k = c / 0.5;
    const r = Math.round(220 + (252 - 220) * k);
    const g = Math.round(252 - (252 - 230) * k);
    const b = Math.round(220 - (220 - 170) * k);
    return `rgb(${r},${g},${b})`;
  }
  const k = (c - 0.5) / 0.5;
  const r = Math.round(252 - (252 - 220) * k);
  const g = Math.round(230 - 230 * k * 0.6);
  const b = Math.round(170 - 170 * k);
  return `rgb(${r},${g},${b})`;
}

function MatrizDalio({ matriz, eixoX, labelY, labelX, sufY = "%", sufX = "%", destacaBR = true, premissaTexto }:
  { matriz: Matriz; eixoX: number[]; labelY: string; labelX: string; sufY?: string; sufX?: string; destacaBR?: boolean; premissaTexto?: string }) {
  const flat = matriz.valores.flat();
  const vmin = Math.min(...flat);
  const vmax = Math.max(...flat);
  const range = vmax - vmin || 1;
  const brStart = matriz.brasil?.starting ?? null;
  const brX = matriz.brasil?.deficit ?? matriz.brasil?.gap_pp ?? null;
  const idxY = brStart == null ? -1 : matriz.eixo_y_starting.reduce(
    (bi, v, i) => Math.abs(v - brStart) < Math.abs(matriz.eixo_y_starting[bi] - brStart) ? i : bi, 0);
  const idxX = brX == null ? -1 : eixoX.reduce(
    (bi, v, i) => Math.abs(v - brX) < Math.abs(eixoX[bi] - brX) ? i : bi, 0);

  return (
    <div className="space-y-2">
      {premissaTexto && (
        <div className="rounded-lg border-l-4 border-amber-400 bg-amber-50 p-3 text-xs text-amber-900">
          <strong className="uppercase tracking-wide">Premissa: </strong>{premissaTexto}
        </div>
      )}
      <div className="overflow-x-auto">
        <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500">
          <span className="font-semibold text-[#132960]">{labelX} →</span>
        </div>
        <table className="mt-1 w-full min-w-[640px] border-collapse text-xs">
          <thead>
            <tr>
              <th className="border border-zinc-200 bg-[#132960] p-2 text-left text-[10px] uppercase tracking-wider text-white">
                <span className="block text-[9px] opacity-80">↓</span>{labelY}
              </th>
              {eixoX.map((v, i) => {
                const isBR = destacaBR && i === idxX;
                return (
                  <th key={i} className={`border border-zinc-200 p-2 font-semibold ${isBR ? "bg-rose-600 text-white" : "bg-zinc-100 text-zinc-700"}`}>
                    {v}{sufX}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {matriz.valores.map((row, i) => {
              const isBRRow = destacaBR && i === idxY;
              return (
                <tr key={i}>
                  <th className={`border border-zinc-200 p-2 text-right font-semibold ${isBRRow ? "bg-rose-600 text-white" : "bg-zinc-100 text-zinc-700"}`}>
                    {matriz.eixo_y_starting[i]}{sufY}
                  </th>
                  {row.map((cell, j) => {
                    const isBR = destacaBR && i === idxY && j === idxX;
                    const t = (cell - vmin) / range;
                    return (
                      <td key={j}
                        className={`border p-2 text-center tabular-nums ${isBR ? "border-rose-600 border-[3px] font-bold text-rose-950 ring-2 ring-rose-600 ring-offset-1" : "border-zinc-200 text-zinc-800"}`}
                        style={{ background: isBR ? "#fecaca" : heatColor(t) }}>
                        {cell}%
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {destacaBR && matriz.brasil?.starting != null && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-700">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 border-[3px] border-rose-600 bg-rose-100"></span>
            <strong>Brasil hoje:</strong> linha {matriz.brasil.starting}{sufY} × coluna {matriz.brasil.deficit ?? matriz.brasil.gap_pp}{sufX}
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// LeverCard (mantido)
// ============================================================================
// Viabilidade derivada por regra simples (heurística AZ — antes era literal fixo):
// ajuste necessário ≤ 2 pp (juros/inflação) ou corte/aumento ≤ 5% (despesa/receita) → "media" (Possível);
// acima desses limites → "baixa" (Difícil). Avalia a magnitude do ajuste, não o mérito político.
function viabilidadeLever(ajuste: number | null | undefined, limite: number): "media" | "baixa" {
  if (ajuste == null) return "baixa";
  return Math.abs(ajuste) <= limite ? "media" : "baixa";
}

function LeverCard({ numero, titulo, descricao, atual, alvo, delta, deltaTexto, sufix, baseLabel, viavel }:
  { numero: number; titulo: string; descricao: string; atual: number | undefined; alvo: number | undefined; delta?: number; deltaTexto?: string; sufix: string; baseLabel: string; viavel?: "alta" | "media" | "baixa" }) {
  const viabilidadeBg = viavel === "baixa" ? "bg-rose-100 border-rose-300" : viavel === "media" ? "bg-amber-100 border-amber-300" : "bg-emerald-100 border-emerald-300";
  const viabilidadeTxt = viavel === "baixa" ? "Difícil" : viavel === "media" ? "Possível" : "Plausível";
  return (
    <div className="rounded-2xl border border-[#132960]/15 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-bold text-[#132960]">
            <span className="mr-1 text-zinc-400">{numero}.</span>{titulo}
          </h3>
          <p className="mt-1 text-xs text-zinc-600">{descricao}</p>
        </div>
        {viavel && (
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${viabilidadeBg}`}>{viabilidadeTxt}</span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-zinc-50 p-2">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">Atual</div>
          <div className="text-lg font-bold text-zinc-700">{fmt(atual, 2, sufix)}</div>
        </div>
        <div className="rounded-lg bg-rose-50 p-2">
          <div className="text-[10px] uppercase tracking-wide text-rose-700">Necessário</div>
          <div className="text-lg font-bold text-rose-800">{fmt(alvo, 2, sufix)}</div>
        </div>
      </div>
      <div className="mt-2 text-[10px] text-zinc-500">Base: {baseLabel}</div>
      {delta != null && (
        <div className="mt-1 text-xs text-zinc-700">Ajuste: <strong className="text-[#132960]">{deltaTexto ?? fmtPP(delta)}</strong></div>
      )}
    </div>
  );
}

// ============================================================================
// Component principal
// ============================================================================
export function TermometroFiscalDashboard({ data }: { data: FiscalTermometroData }) {
  const foto = data.foto_brasil;
  const traj = data.trajetoria_br_pct_receita ?? [];
  const lev = data.levers;
  const indicadores = data.indicadores_semaforo;
  const categorias = data.categorias_ordem ?? [];

  // Números do payload interpolados na prosa (antes hardcoded — o painel atualiza diariamente).
  const debtVsReceitaTxt = data.premissas.debt_pct_receita != null
    ? `${(data.premissas.debt_pct_receita / 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}×`
    : "—";
  const gapRG = lev?.gap_atual_pp ?? null;
  const gapRGTxt = gapRG != null
    ? `${gapRG >= 0 ? "+" : ""}${gapRG.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} pp`
    : "—";
  // Lever 4: atual = receita líquida % PIB; necessário = atual × (1 + aumento%).
  const aumentoReceitaPct = lev?.lever_aumento_receita?.aumento_pct_da_receita ?? null;
  const receitaAtualPctPib = foto.receita.receita_liquida_pct_pib;
  const receitaAlvoPctPib = receitaAtualPctPib != null && aumentoReceitaPct != null
    ? receitaAtualPctPib * (1 + aumentoReceitaPct / 100)
    : undefined;

  return (
    <div className="space-y-6">
      <CardHeader
        titulo="Termômetro Fiscal"
        subtitulo='Aplicação das fórmulas e tabelas de "How Countries Go Broke" (Ray Dalio, 2025) ao Brasil. Dados em tempo real via BCB SGS, Tesouro RTN e IBGE.'
      />

      <Section titulo="Leia isto primeiro (em 30 segundos)">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs">
            <div className="mb-1 font-bold text-[#132960]">Por que Dívida/Receita?</div>
            <p className="text-zinc-700">Dalio usa receita do governo no denominador (não PIB) porque é a fonte real de pagamento. Brasil: dívida = <strong>{debtVsReceitaTxt} a receita líquida</strong> do gov central.</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs">
            <div className="mb-1 font-bold text-[#132960]">O que é &quot;estabilizar&quot;?</div>
            <p className="text-zinc-700">Dívida/Receita para de crescer (não diminui). É o mínimo para evitar bola de neve. Hoje r−g = <strong>{gapRGTxt}</strong>{gapRG != null && gapRG > 0 ? ", dívida cresce mesmo com primário neutro." : "."}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs">
            <div className="mb-1 font-bold text-[#132960]">Os 4 Levers (alavancas)</div>
            <p className="text-zinc-700">Cortar juros, aceitar mais inflação, cortar despesa, ou aumentar receita. O simulador interativo abaixo permite testar combinações.</p>
          </div>
        </div>
      </Section>

      {/* === DISTRIBUIÇÃO DOS INDICADORES === */}
      {indicadores && Object.keys(indicadores).length > 0 && (
        <DistribuicaoScore indicadores={indicadores} />
      )}

      {/* === SEMÁFORO POR CATEGORIA === */}
      {indicadores && categorias.length > 0 && (
        <Section
          titulo="Indicadores Dalio semaforizados"
          hint={`${Object.keys(indicadores).length} indicadores em ${categorias.length} categorias. Ponto Brasil (▶) destacado na régua à direita de cada card.`}
        >
          <SemaforoPorCategoria indicadores={indicadores} categorias={categorias} />
          <p className="mt-2 text-[10px] text-zinc-500">
            Faixas calibradas pela AZ a partir dos casos históricos do livro (Reino Unido 1976, Japão pós-1990, Argentina 2001, EUA pós-2008) — não são números do livro.
          </p>
          <p className="mt-2"><DataStamp giro={data.gerado_em} dado={data.fonte_base} /></p>
        </Section>
      )}

      {/* === SIMULADOR INTERATIVO === */}
      <SimuladorTrajetoria defaults={{
        debt_pct_receita: data.premissas.debt_pct_receita ?? 435,
        debt_pct_pib: foto.divida.dbgg_pct_pib ?? 80,
        custo_medio_aa: foto.juros.taxa_nominal_efetiva_aa,
        pib_real_yoy: foto.macro.pib_real_yoy_pct,
        ipca_12m: foto.macro.ipca_12m_pct,
        primario_pct_pib: foto.deficit_primario.primary_deficit_pct_pib != null ? -foto.deficit_primario.primary_deficit_pct_pib : -1,
        receita_pct_pib: foto.receita.receita_liquida_pct_pib ?? 18,
      }} />

      {/* === MATRIZES === */}
      <Section titulo="Dívida/Receita após 10 anos (tabela do livro, cap. The Mechanics)">
        <MatrizDalio
          matriz={data.matrizes.endlevel_por_deficit}
          eixoX={data.matrizes.endlevel_por_deficit.eixo_x_deficit ?? []}
          labelY="Dívida/Receita HOJE" labelX="Déficit primário anual (% Receita)"
          sufY="%" sufX="%"
          premissaTexto="Cenário simplificado do livro — assume juros nominais = crescimento nominal (i = g). Isola o efeito do déficit primário acumulado. Valor da célula = Dívida/Receita depois de 10 anos."
        />
        <p className="mt-2"><DataStamp giro={data.gerado_em} dado={data.fonte_base} /></p>
      </Section>

      <Section titulo="Dívida/Receita após 10 anos — variando o gap r − g (tabela do livro)">
        <MatrizDalio
          matriz={data.matrizes.endlevel_por_gap}
          eixoX={data.matrizes.endlevel_por_gap.eixo_x_gap_pp ?? []}
          labelY="Dívida/Receita HOJE" labelX="Gap r − g (pontos percentuais)"
          sufY="%" sufX="pp"
          premissaTexto={`Cenário realista — assume déficit primário constante (Brasil hoje: ${data.premissas.primary_deficit_pct_receita}% da receita). Varia o gap r−g.`}
        />
        <p className="mt-2"><DataStamp giro={data.gerado_em} dado={data.fonte_base} /></p>
      </Section>

      {/* === 4 LEVERS === */}
      {lev && (
        <Section titulo="Os 4 Levers (alavancas) para estabilizar a dívida" hint='Dalio: "todo governo com dívida em moeda própria tem 4 alavancas". Cada card mostra o ajuste isolado necessário.'>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            {lev.lever_juros && (
              <LeverCard numero={1} titulo="Baixar juros"
                descricao="Taxa nominal efetiva da dívida que estabilizaria Dívida/Receita."
                atual={lev.lever_juros.i_atual_aa} alvo={lev.lever_juros.i_estavel_aa} delta={lev.lever_juros.delta_pp}
                sufix="% a.a." baseLabel="taxa implícita da DLSP (a.a.)"
                viavel={viabilidadeLever(lev.lever_juros.delta_pp, 2)} />
            )}
            {lev.lever_inflacao && (
              <LeverCard numero={2} titulo="Mais inflação"
                descricao="Inflação que subiria crescimento nominal o suficiente para erodir a dívida."
                atual={lev.lever_inflacao.inflacao_atual_aa} alvo={lev.lever_inflacao.inflacao_estavel_aa} delta={lev.lever_inflacao.delta_pp}
                sufix="% a.a." baseLabel="IPCA 12m"
                viavel={viabilidadeLever(lev.lever_inflacao.delta_pp, 2)} />
            )}
            {lev.lever_corte_despesa && (
              <LeverCard numero={3} titulo="Cortar despesa"
                descricao="Corte na despesa primária total para fechar o gap consistente com r−g atual."
                atual={lev.lever_corte_despesa.despesa_atual_pct_receita} alvo={lev.lever_corte_despesa.despesa_alvo_pct_receita} delta={lev.lever_corte_despesa.corte_pct_da_despesa}
                sufix="% Receita" baseLabel="despesa primária / Receita líquida"
                viavel={viabilidadeLever(lev.lever_corte_despesa.corte_pct_da_despesa, 5)} />
            )}
            {lev.lever_aumento_receita && (
              <LeverCard numero={4} titulo="Aumentar receita"
                descricao="Aumento da receita líquida (mantendo despesa) para estabilizar Dívida/Receita."
                atual={receitaAtualPctPib ?? undefined} alvo={receitaAlvoPctPib} delta={aumentoReceitaPct ?? undefined}
                deltaTexto={aumentoReceitaPct != null
                  ? `${aumentoReceitaPct >= 0 ? "+" : ""}${aumentoReceitaPct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% de arrecadação`
                  : undefined}
                sufix="% PIB" baseLabel="receita líquida / PIB"
                viavel={viabilidadeLever(aumentoReceitaPct, 5)} />
            )}
          </div>
          <div className="mt-3 rounded-lg border-l-4 border-rose-500 bg-rose-50 p-3 text-xs text-rose-900">
            <strong>Leitura combinada:</strong> nenhum lever sozinho resolve o caso brasileiro hoje em magnitudes plausíveis politicamente — Dalio prevê que países nesse perfil precisam combinar dois ou mais ao longo do tempo. Caso histórico mais próximo: Reino Unido 1976 (aumento de impostos + corte de gastos + bailout do FMI).
          </div>
          <p className="mt-2"><DataStamp giro={data.gerado_em} dado={data.fonte_base} /></p>
        </Section>
      )}

      {/* === PREMISSAS / METODOLOGIA === */}
      <Section titulo="Premissas e metodologia">
        <div className="space-y-2 text-xs text-zinc-700">
          <div>
            <strong>Variáveis de entrada (mês {data.fonte_base}):</strong>
            <ul className="ml-4 mt-1 list-disc space-y-0.5">
              <li>Dívida/Receita = {fmt(data.premissas.debt_pct_receita, 0, "%")} (DBGG ÷ Receita líquida Tesouro 12m)</li>
              <li>Déficit primário = {fmt(data.premissas.primary_deficit_pct_receita, 1, "%")} da receita</li>
              <li>i = {fmt(data.premissas.i_nominal_aa, 2, "%")} a.a. (taxa implícita da DLSP: juros nominais 12m ÷ DLSP média)</li>
              <li>g = {fmt(data.premissas.g_nominal_aa, 2, "%")} a.a. (PIB nominal 12m YoY)</li>
            </ul>
          </div>
          <p>{data.metodologia}</p>
          <p className="text-zinc-500">Última atualização: {new Date(data.gerado_em).toLocaleString("pt-BR")}.</p>
        </div>
      </Section>
    </div>
  );
}
