"use client";

import {
  CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import type { FiscalTermometroData, Matriz, IndicadorSemaforo, Nivel } from "@/lib/painel-fiscal";
import { CardHeader, KPI, Section } from "./FiscalShell";

function fmt(v: number | null | undefined, casas = 1, suf = ""): string {
  if (v == null) return "—";
  return `${v.toFixed(casas)}${suf}`;
}
function fmtPP(v: number | null | undefined, casas = 2): string {
  if (v == null) return "—";
  const s = v >= 0 ? "+" : "";
  return `${s}${v.toFixed(casas)} pp`;
}

const NIVEL_BG: Record<Nivel, string> = {
  verde: "bg-emerald-50 border-emerald-300",
  amarelo: "bg-amber-50 border-amber-300",
  vermelho: "bg-rose-50 border-rose-300",
  break: "bg-red-100 border-red-500",
  sem_dado: "bg-zinc-50 border-zinc-200",
};
const NIVEL_DOT: Record<Nivel, string> = {
  verde: "bg-emerald-500",
  amarelo: "bg-amber-500",
  vermelho: "bg-rose-500",
  break: "bg-red-700",
  sem_dado: "bg-zinc-300",
};
const NIVEL_TXT: Record<Nivel, string> = {
  verde: "text-emerald-900",
  amarelo: "text-amber-900",
  vermelho: "text-rose-900",
  break: "text-red-900",
  sem_dado: "text-zinc-500",
};
const NIVEL_LABEL: Record<Nivel, string> = {
  verde: "Verde",
  amarelo: "Atenção",
  vermelho: "Crítico",
  break: "BREAK",
  sem_dado: "Sem dado",
};

function IndicadorPill({ id, ind }: { id: string; ind: IndicadorSemaforo }) {
  const valor = ind.valor;
  return (
    <div className={`rounded-lg border-2 p-3 ${NIVEL_BG[ind.nivel]}`}>
      <div className="flex items-start justify-between gap-2">
        <h4 className={`text-[11px] font-semibold leading-tight ${NIVEL_TXT[ind.nivel]}`}>{ind.titulo}</h4>
        <span className={`inline-block h-2 w-2 rounded-full ${NIVEL_DOT[ind.nivel]} flex-shrink-0 mt-1`} title={NIVEL_LABEL[ind.nivel]} />
      </div>
      <div className={`mt-2 text-xl font-bold tabular-nums ${NIVEL_TXT[ind.nivel]}`}>
        {fmt(valor, ind.unidade === " pp" ? 2 : (valor != null && Math.abs(valor) > 100 ? 0 : 2), ind.unidade)}
      </div>
      <details className="mt-2 text-[10px]">
        <summary className="cursor-pointer opacity-70 hover:opacity-100">faixas Dalio</summary>
        <div className="mt-1 grid grid-cols-4 gap-0.5 text-center text-[9px]">
          <div className="rounded bg-emerald-100 px-1 py-0.5">V {ind.direcao === "maior_pior" ? "<" : ">"}{fmt(ind.verde, 1, ind.unidade)}</div>
          <div className="rounded bg-amber-100 px-1 py-0.5">A {ind.direcao === "maior_pior" ? "<" : ">"}{fmt(ind.amarelo, 1, ind.unidade)}</div>
          <div className="rounded bg-rose-100 px-1 py-0.5">C {ind.direcao === "maior_pior" ? "<" : ">"}{fmt(ind.vermelho, 1, ind.unidade)}</div>
          <div className="rounded bg-red-200 px-1 py-0.5 font-bold">B {ind.direcao === "maior_pior" ? "≥" : "≤"}{fmt(ind.break, 1, ind.unidade)}</div>
        </div>
        <p className="mt-1 leading-snug opacity-80">{ind.narrativa}</p>
      </details>
    </div>
  );
}

function ScoreHero({ score }: { score: { score_medio: number | null; nivel_geral: Nivel; n: number; total: number } }) {
  return (
    <div className={`rounded-2xl border-2 p-6 ${NIVEL_BG[score.nivel_geral]}`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className={`text-xs font-medium uppercase tracking-wide opacity-70 ${NIVEL_TXT[score.nivel_geral]}`}>Score consolidado Dalio</div>
          <div className={`mt-1 text-4xl font-bold ${NIVEL_TXT[score.nivel_geral]}`}>
            {score.score_medio?.toFixed(2) ?? "—"}<span className="ml-2 text-lg font-normal opacity-70">/ 4.0</span>
          </div>
          <div className={`mt-1 text-sm font-bold uppercase ${NIVEL_TXT[score.nivel_geral]}`}>
            {NIVEL_LABEL[score.nivel_geral]} ({score.n} de {score.total} indicadores)
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <div className="rounded-lg bg-white/70 px-3 py-1.5">
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" /> Verde = 1
          </div>
          <div className="rounded-lg bg-white/70 px-3 py-1.5">
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-500" /> Amarelo = 2
          </div>
          <div className="rounded-lg bg-white/70 px-3 py-1.5">
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-500" /> Vermelho = 3
          </div>
          <div className="rounded-lg bg-white/70 px-3 py-1.5">
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-700" /> Break = 4
          </div>
        </div>
      </div>
    </div>
  );
}

function SemaforoPorCategoria({ indicadores, categorias }: { indicadores: Record<string, IndicadorSemaforo>; categorias: string[] }) {
  const porCategoria: Record<string, Array<[string, IndicadorSemaforo]>> = {};
  Object.entries(indicadores).forEach(([id, ind]) => {
    if (!porCategoria[ind.categoria]) porCategoria[ind.categoria] = [];
    porCategoria[ind.categoria].push([id, ind]);
  });
  return (
    <div className="space-y-4">
      {categorias.map((cat) => {
        const items = porCategoria[cat];
        if (!items?.length) return null;
        return (
          <div key={cat}>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[#132960]">{cat}</h3>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
              {items.map(([id, ind]) => (<IndicadorPill key={id} id={id} ind={ind} />))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

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

function LeverCard({ numero, titulo, descricao, atual, alvo, delta, sufix, baseLabel, viavel }:
  { numero: number; titulo: string; descricao: string; atual: number | undefined; alvo: number | undefined; delta?: number; sufix: string; baseLabel: string; viavel?: "alta" | "media" | "baixa" }) {
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
        <div className="mt-1 text-xs text-zinc-700">Ajuste: <strong className="text-[#132960]">{fmtPP(delta)}</strong></div>
      )}
    </div>
  );
}

export function TermometroFiscalDashboard({ data }: { data: FiscalTermometroData }) {
  const foto = data.foto_brasil;
  const traj = data.trajetoria_br_pct_receita ?? [];
  const trajData = traj.map((v, i) => ({ ano: i, valor: v }));
  const lev = data.levers;
  const score = data.score_semaforo;
  const indicadores = data.indicadores_semaforo;
  const categorias = data.categorias_ordem ?? [];

  return (
    <div className="space-y-6">
      <CardHeader
        titulo="Termômetro Fiscal"
        subtitulo='Aplicação das fórmulas e tabelas de "How Countries Go Broke" (Ray Dalio, 2025) ao Brasil. Dados em tempo real via BCB SGS, Tesouro RTN e IBGE.'
      />

      {/* === LEIA ISTO PRIMEIRO === */}
      <Section titulo="Leia isto primeiro (em 30 segundos)">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs">
            <div className="mb-1 font-bold text-[#132960]">Por que Dívida/Receita?</div>
            <p className="text-zinc-700">Dalio usa receita do governo no denominador (não PIB) porque é a fonte real de pagamento. Brasil: dívida = <strong>4,3× a receita líquida</strong> do gov central.</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs">
            <div className="mb-1 font-bold text-[#132960]">O que é &quot;estabilizar&quot;?</div>
            <p className="text-zinc-700">Dívida/Receita para de crescer (não diminui). É o mínimo para evitar bola de neve. Hoje r−g = <strong>+3,1pp</strong>, dívida cresce mesmo com primário neutro.</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs">
            <div className="mb-1 font-bold text-[#132960]">Os 4 Levers</div>
            <p className="text-zinc-700">Cortar juros, aceitar mais inflação, cortar despesa, ou aumentar receita. Quanto cada um teria que mexer isoladamente — abaixo.</p>
          </div>
        </div>
      </Section>

      {/* === SCORE HERO + SEMÁFORO POR CATEGORIA === */}
      {score && <ScoreHero score={score} />}

      {indicadores && categorias.length > 0 && (
        <Section titulo="Termômetro: 20 indicadores Dalio semaforizados" hint="Cada indicador tem 4 faixas — verde / atenção / crítico / break — baseadas em casos históricos do livro. Brasil hoje classificado em cada um.">
          <SemaforoPorCategoria indicadores={indicadores} categorias={categorias} />
        </Section>
      )}

      {/* === TRAJETÓRIA 10 ANOS === */}
      {traj.length > 0 && (
        <Section titulo="Trajetória projetada do Brasil — próximos 10 anos" hint="Mantidos primário, juros e crescimento atuais. Equação iterativa do livro.">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trajData} margin={{ left: 0, right: 24, top: 8, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="ano" tick={{ fontSize: 11 }} label={{ value: "anos a partir de hoje", fontSize: 10, position: "insideBottom", offset: -8 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v: unknown) => (typeof v === "number" ? `${v.toFixed(1)}% da receita` : "—")} />
                <ReferenceLine y={traj[0]} stroke="#475569" strokeDasharray="3 3" label={{ value: `Hoje ${traj[0].toFixed(0)}%`, fontSize: 10, fill: "#475569", position: "left" }} />
                <ReferenceLine y={traj[traj.length-1]} stroke="#dc2626" strokeDasharray="3 3" label={{ value: `Em 10y ${traj[traj.length-1].toFixed(0)}%`, fontSize: 10, fill: "#dc2626", position: "right" }} />
                <Line type="monotone" dataKey="valor" stroke="#dc2626" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-900">
            <strong>Leitura:</strong> mantidas as variáveis atuais (déficit primário {fmt(foto.deficit_primario.primary_deficit_pct_receita, 1)}% da receita, custo médio {fmt(foto.juros.taxa_nominal_efetiva_aa, 2)}% a.a., crescimento nominal {fmt(foto.macro.g_nominal_aa_pct, 2)}%), dívida brasileira em proporção da receita cresce de <strong>{traj[0].toFixed(0)}% para {traj[traj.length-1].toFixed(0)}%</strong> em 10 anos.
          </div>
        </Section>
      )}

      {/* === MATRIZES === */}
      <Section titulo={data.matrizes.endlevel_por_deficit.titulo}>
        <MatrizDalio
          matriz={data.matrizes.endlevel_por_deficit}
          eixoX={data.matrizes.endlevel_por_deficit.eixo_x_deficit ?? []}
          labelY="Dívida/Receita HOJE" labelX="Déficit primário anual (% Receita)"
          sufY="%" sufX="%"
          premissaTexto="Cenário simplificado do livro — assume juros nominais = crescimento nominal (i = g). Isola o efeito do déficit primário acumulado. Valor da célula = Dívida/Receita depois de 10 anos."
        />
      </Section>

      <Section titulo={data.matrizes.endlevel_por_gap.titulo}>
        <MatrizDalio
          matriz={data.matrizes.endlevel_por_gap}
          eixoX={data.matrizes.endlevel_por_gap.eixo_x_gap_pp ?? []}
          labelY="Dívida/Receita HOJE" labelX="Gap r − g (pontos percentuais)"
          sufY="%" sufX="pp"
          premissaTexto={`Cenário realista — assume déficit primário constante (Brasil hoje: ${data.premissas.primary_deficit_pct_receita}% da receita). Varia o gap r−g.`}
        />
      </Section>

      {/* === 4 LEVERS === */}
      {lev && (
        <Section titulo="Os 4 Levers para estabilizar a dívida brasileira" hint='Dalio: "todo governo com dívida em moeda própria tem 4 alavancas". Cada card mostra o ajuste isolado necessário.'>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            {lev.lever_juros && (
              <LeverCard numero={1} titulo="Baixar juros"
                descricao="Taxa nominal efetiva da dívida que estabilizaria Dívida/Receita."
                atual={lev.lever_juros.i_atual_aa} alvo={lev.lever_juros.i_estavel_aa} delta={lev.lever_juros.delta_pp}
                sufix="% a.a." baseLabel="custo médio efetivo da DPF" viavel="baixa" />
            )}
            {lev.lever_inflacao && (
              <LeverCard numero={2} titulo="Mais inflação"
                descricao="Inflação que subiria crescimento nominal o suficiente para erodir a dívida."
                atual={lev.lever_inflacao.inflacao_atual_aa} alvo={lev.lever_inflacao.inflacao_estavel_aa} delta={lev.lever_inflacao.delta_pp}
                sufix="% a.a." baseLabel="IPCA 12m" viavel="baixa" />
            )}
            {lev.lever_corte_despesa && (
              <LeverCard numero={3} titulo="Cortar despesa"
                descricao="Corte na despesa primária total para fechar o gap consistente com r−g atual."
                atual={lev.lever_corte_despesa.despesa_atual_pct_receita} alvo={lev.lever_corte_despesa.despesa_alvo_pct_receita} delta={lev.lever_corte_despesa.corte_pct_da_despesa}
                sufix="% Receita" baseLabel="despesa primária / Receita líquida" viavel="baixa" />
            )}
            {lev.lever_aumento_receita && (
              <LeverCard numero={4} titulo="Aumentar receita"
                descricao="Aumento da receita líquida (mantendo despesa) para estabilizar Dívida/Receita."
                atual={0} alvo={lev.lever_aumento_receita.aumento_pct_da_receita} delta={lev.lever_aumento_receita.aumento_pct_da_receita}
                sufix="%" baseLabel="ajuste sobre receita atual" viavel="baixa" />
            )}
          </div>
          <div className="mt-3 rounded-lg border-l-4 border-rose-500 bg-rose-50 p-3 text-xs text-rose-900">
            <strong>Leitura combinada:</strong> nenhum lever sozinho resolve o caso brasileiro hoje em magnitudes plausíveis politicamente — Dalio prevê que países nesse perfil precisam combinar dois ou mais ao longo do tempo. Caso histórico mais próximo: Reino Unido 1976 (aumento de impostos + corte de gastos + bailout do FMI).
          </div>
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
              <li>i = {fmt(data.premissas.i_nominal_aa, 2, "%")} a.a. (juros 12m ÷ DBGG)</li>
              <li>g = {fmt(data.premissas.g_nominal_aa, 2, "%")} a.a. (PIB real + IPCA 12m)</li>
            </ul>
          </div>
          <p>{data.metodologia}</p>
          <p className="text-zinc-500">Última atualização: {new Date(data.gerado_em).toLocaleString("pt-BR")}.</p>
        </div>
      </Section>
    </div>
  );
}
