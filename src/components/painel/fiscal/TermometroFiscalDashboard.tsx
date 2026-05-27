"use client";

import {
  CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import type { FiscalTermometroData, Matriz, Lever } from "@/lib/painel-fiscal";
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

// Heatmap-style — cor depende do nivel (mais alto = mais vermelho)
function corHeat(valor: number, vmax: number): string {
  const pct = Math.max(0, Math.min(1, valor / vmax));
  // gradiente verde (baixo) -> amarelo -> vermelho (alto)
  if (pct < 0.33) {
    // verde
    const t = pct / 0.33;
    const r = Math.round(220 - (220 - 250) * t);
    const g = Math.round(240 - (240 - 220) * t);
    const b = 220;
    return `rgb(${r},${g},${b})`;
  } else if (pct < 0.66) {
    // amarelo
    const t = (pct - 0.33) / 0.33;
    const r = 250;
    const g = Math.round(230 - (230 - 180) * t);
    const b = Math.round(180 - 180 * t);
    return `rgb(${r},${g},${b})`;
  } else {
    // vermelho
    const t = (pct - 0.66) / 0.34;
    const r = Math.round(250 - (250 - 200) * t);
    const g = Math.round(150 - 150 * t);
    const b = Math.round(150 - 150 * t);
    return `rgb(${r},${g},${b})`;
  }
}

function MatrizDalio({ matriz, eixoX, sufY = "%", sufX = "%", destacaBR = true }:
  { matriz: Matriz; eixoX: number[]; sufY?: string; sufX?: string; destacaBR?: boolean }) {
  const vmax = Math.max(...matriz.valores.flat().map(Math.abs));
  const brStart = matriz.brasil?.starting ?? null;
  const brX = matriz.brasil?.deficit ?? matriz.brasil?.gap_pp ?? null;

  // Encontra a célula BR mais próxima
  const idxY = brStart == null ? -1 : matriz.eixo_y_starting.reduce((bi, v, i) =>
    Math.abs(v - brStart) < Math.abs(matriz.eixo_y_starting[bi] - brStart) ? i : bi, 0);
  const idxX = brX == null ? -1 : eixoX.reduce((bi, v, i) =>
    Math.abs(v - brX) < Math.abs(eixoX[bi] - brX) ? i : bi, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="border border-zinc-200 bg-zinc-50 p-2 text-zinc-500"></th>
            {eixoX.map((v, i) => (
              <th key={i} className="border border-zinc-200 bg-zinc-50 p-2 font-semibold text-zinc-700">
                {v}{sufX}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matriz.valores.map((row, i) => (
            <tr key={i}>
              <th className="border border-zinc-200 bg-zinc-50 p-2 text-right font-semibold text-zinc-700">
                {matriz.eixo_y_starting[i]}{sufY}
              </th>
              {row.map((cell, j) => {
                const isBR = destacaBR && i === idxY && j === idxX;
                return (
                  <td
                    key={j}
                    className={`border p-2 text-center tabular-nums ${isBR ? "border-rose-600 border-2 font-bold text-rose-900" : "border-zinc-200 text-zinc-800"}`}
                    style={{ background: isBR ? "rgba(244,63,94,0.12)" : corHeat(Math.abs(cell), vmax) }}
                    title={isBR ? "Trajetoria atual do Brasil" : ""}
                  >
                    {cell}%
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LeverCard({ titulo, descricao, atual, alvo, delta, sufix }:
  { titulo: string; descricao: string; atual: number | undefined; alvo: number | undefined; delta?: number; sufix: string }) {
  return (
    <div className="rounded-2xl border border-[#132960]/15 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-bold text-[#132960]">{titulo}</h3>
      <p className="mt-1 text-xs text-zinc-600">{descricao}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-zinc-50 p-2">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">Atual</div>
          <div className="text-lg font-bold text-zinc-700">{fmt(atual, 2, sufix)}</div>
        </div>
        <div className="rounded-lg bg-rose-50 p-2">
          <div className="text-[10px] uppercase tracking-wide text-rose-700">Necessario</div>
          <div className="text-lg font-bold text-rose-800">{fmt(alvo, 2, sufix)}</div>
        </div>
      </div>
      {delta != null && (
        <div className="mt-2 text-xs text-zinc-600">
          Ajuste: <strong className="text-[#132960]">{fmtPP(delta)}</strong>
        </div>
      )}
    </div>
  );
}

export function TermometroFiscalDashboard({ data }: { data: FiscalTermometroData }) {
  const foto = data.foto_brasil;
  const traj = data.trajetoria_br_pct_receita ?? [];
  const trajData = traj.map((v, i) => ({ ano: i, valor: v }));

  const lev = data.levers;

  return (
    <div className="space-y-6">
      <CardHeader
        titulo="Termometro Fiscal"
        subtitulo='Aplicacao das formulas e tabelas de "How Countries Go Broke" (Ray Dalio, 2025) ao Brasil. Variaveis em tempo real via BCB SGS, Tesouro RTN e IBGE.'
      />

      {/* === FOTO ATUAL BRASIL === */}
      <Section titulo="Foto atual: variaveis do governo central brasileiro">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <KPI label="DBGG / PIB" value={fmt(foto.divida.dbgg_pct_pib, 1, "%")} hint="Divida bruta gov geral" />
          <KPI label="DBGG / Receita" value={fmt(foto.divida.dbgg_pct_receita, 0, "%")} hint="Metrica Dalio" trend="down" />
          <KPI label="Deficit primario" value={fmt(foto.deficit_primario.primary_deficit_pct_receita, 1, "%")} hint="% Receita liquida" trend="down" />
          <KPI label="Juros / Receita" value={fmt(foto.juros.juros_pct_receita, 1, "%")} hint="Metrica Dalio" trend="down" />
          <KPI label="Custo medio divida" value={fmt(foto.juros.taxa_nominal_efetiva_aa, 2, "%")} hint="Juros/Divida, anualizado" />
          <KPI label="i - g" value={fmtPP(foto.macro.gap_i_menos_g_pp)} hint="Juros - crescimento nominal" trend={foto.macro.gap_i_menos_g_pp > 0 ? "down" : "up"} />
        </div>
      </Section>

      {/* === TRAJETORIA BR PROXIMOS 10 ANOS === */}
      {traj.length > 0 && (
        <Section
          titulo="Trajetoria projetada do Brasil — proximos 10 anos"
          hint="Manter primary deficit, juros e crescimento atuais. Equacao iterativa do livro: R(t+1) = R(t) * (1+i)/(1+g) + primary_deficit."
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trajData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="ano" tick={{ fontSize: 11 }} label={{ value: "anos a partir de hoje", fontSize: 10, position: "insideBottom", offset: -2 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v: unknown) => (typeof v === "number" ? `${v.toFixed(1)}%` : "—")} />
                <ReferenceLine y={traj[0]} stroke="#475569" strokeDasharray="3 3" label={{ value: "Hoje", fontSize: 10, fill: "#475569", position: "left" }} />
                <Line type="monotone" dataKey="valor" stroke="#dc2626" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Section>
      )}

      {/* === MATRIZES === */}
      <Section
        titulo={data.matrizes.endlevel_por_deficit.titulo}
        hint={data.matrizes.endlevel_por_deficit.subtitulo + ". Quadrado vermelho: posicao do Brasil hoje."}
      >
        <MatrizDalio
          matriz={data.matrizes.endlevel_por_deficit}
          eixoX={data.matrizes.endlevel_por_deficit.eixo_x_deficit ?? []}
          sufY="%"
          sufX="%"
        />
        <p className="mt-2 text-[11px] text-zinc-500">
          Eixo Y: <strong>Divida atual / Receita</strong> (Starting D/I). Eixo X: <strong>Deficit primario / Receita</strong>. Valor: D/I apos 10 anos.
        </p>
      </Section>

      <Section
        titulo={data.matrizes.change_por_deficit.titulo}
        hint={data.matrizes.change_por_deficit.subtitulo + ". Pontos percentuais (pp) de variacao."}
      >
        <MatrizDalio
          matriz={data.matrizes.change_por_deficit}
          eixoX={data.matrizes.change_por_deficit.eixo_x_deficit ?? []}
          sufY="%"
          sufX="%"
          destacaBR={false}
        />
      </Section>

      <Section
        titulo={data.matrizes.endlevel_por_gap.titulo}
        hint={data.matrizes.endlevel_por_gap.subtitulo + ". Quadrado vermelho: Brasil hoje. (i - g) atual destacado."}
      >
        <MatrizDalio
          matriz={data.matrizes.endlevel_por_gap}
          eixoX={data.matrizes.endlevel_por_gap.eixo_x_gap_pp ?? []}
          sufY="%"
          sufX="pp"
        />
        <p className="mt-2 text-[11px] text-zinc-500">
          Eixo X: <strong>i − g</strong> (juros nominais menos crescimento nominal, em pp). Quando i &gt; g, divida cresce mesmo com primario neutro.
        </p>
      </Section>

      {/* === 4 LEVERS === */}
      {lev && (
        <Section
          titulo="Os 4 levers para estabilizar a divida brasileira"
          hint="Quanto cada alavanca (juros, inflacao, corte de despesa, aumento de receita) precisaria mexer isoladamente para que a Divida/Receita pare de crescer."
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            {lev.lever_juros && (
              <LeverCard
                titulo="1. Baixar juros"
                descricao="Taxa de juros nominal necessaria para Debt/Income parar de crescer (mantendo as outras variaveis)."
                atual={lev.lever_juros.i_atual_aa}
                alvo={lev.lever_juros.i_estavel_aa}
                delta={lev.lever_juros.delta_pp}
                sufix="%"
              />
            )}
            {lev.lever_inflacao && (
              <LeverCard
                titulo="2. Mais inflacao"
                descricao="Inflacao necessaria para subir o crescimento nominal o suficiente (erode divida via numerador)."
                atual={lev.lever_inflacao.inflacao_atual_aa}
                alvo={lev.lever_inflacao.inflacao_estavel_aa}
                delta={lev.lever_inflacao.delta_pp}
                sufix="%"
              />
            )}
            {lev.lever_corte_despesa && (
              <LeverCard
                titulo="3. Cortar despesa"
                descricao="Corte na despesa primaria total necessario para zerar o deficit consistente com r-g atual."
                atual={lev.lever_corte_despesa.despesa_atual_pct_receita}
                alvo={lev.lever_corte_despesa.despesa_alvo_pct_receita}
                delta={lev.lever_corte_despesa.corte_pct_da_despesa}
                sufix="%"
              />
            )}
            {lev.lever_aumento_receita && (
              <LeverCard
                titulo="4. Aumentar receita"
                descricao="Aumento de receita liquida necessario (mantendo despesa) para estabilizar Debt/Income."
                atual={100}
                alvo={100 + lev.lever_aumento_receita.aumento_pct_da_receita!}
                delta={lev.lever_aumento_receita.aumento_pct_da_receita}
                sufix="%"
              />
            )}
          </div>
        </Section>
      )}

      <Section titulo="Premissas e metodologia">
        <div className="space-y-2 text-xs text-zinc-700">
          <p>
            <strong>Premissas atuais:</strong> Debt/Receita = {fmt(data.premissas.debt_pct_receita, 0, "%")},
            Primary deficit = {fmt(data.premissas.primary_deficit_pct_receita, 1, "%")} da receita,
            i = {fmt(data.premissas.i_nominal_aa, 2, "%")} a.a., g = {fmt(data.premissas.g_nominal_aa, 2, "%")} a.a.
            Projecao iterativa de {data.premissas.anos_projecao} anos.
          </p>
          <p>{data.metodologia}</p>
          <p className="text-zinc-500">Ultima atualizacao: {new Date(data.gerado_em).toLocaleString("pt-BR")}.</p>
        </div>
      </Section>
    </div>
  );
}
