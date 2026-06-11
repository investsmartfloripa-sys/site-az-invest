"use client";

import { useEffect, useMemo, useState } from "react";

import { ChartCard } from "@/components/painel/core";
import { AZ_CHART, variationText } from "@/lib/az-chart-theme";
import { fmtSignedPct } from "@/lib/format-br";

import { PRACAS_RELOGIO, type PracaRelogio } from "./mundo";

/**
 * Relógio dos Mercados — a faixa que dá vida à página: o dia das bolsas
 * segue o sol (Tóquio → Hong Kong → Mumbai → Frankfurt → Londres → NY).
 * Cada praça mostra hora local, estado AGORA (Aberto / Intervalo / Fechado +
 * "abre em Xh") e o retorno de 1 dia colorido.
 *
 * 100% client-side e SEM API: horários regulares de pregão fixos por praça
 * (mundo.ts) + fuso via Intl. Não considera feriados locais (nota no rodapé).
 *
 * Hidratação honesta: o relógio só calcula DEPOIS de montar (estado `agora`
 * começa null) — o HTML do servidor mostra placeholder, sem mismatch.
 */

type StatusPraca =
  | { kind: "aberto"; minutosParaFechar: number }
  | { kind: "intervalo"; minutosParaAbrir: number }
  | { kind: "fechado"; minutosParaAbrir: number; diasAdiante: number };

// Cache de formatadores por fuso (criar Intl.DateTimeFormat é caro).
const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmtTz(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    fmtCache.set(tz, f);
  }
  return f;
}

const WEEKDAY_IDX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function partesNoFuso(d: Date, tz: string): { wd: number; minutos: number; hhmm: string } {
  const parts = fmtTz(tz).formatToParts(d);
  let wd = 0;
  let hh = 0;
  let mm = 0;
  for (const p of parts) {
    if (p.type === "weekday") wd = WEEKDAY_IDX[p.value] ?? 0;
    else if (p.type === "hour") hh = Number(p.value);
    else if (p.type === "minute") mm = Number(p.value);
  }
  return { wd, minutos: hh * 60 + mm, hhmm: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}` };
}

const DIA_UTIL = (wd: number) => wd >= 1 && wd <= 5;

/**
 * Estado da praça no relógio local: dentro de sessão = aberto; entre sessões
 * do mesmo dia = intervalo (almoço de Tóquio/HK); senão fechado, contando os
 * minutos até a PRÓXIMA abertura (pula fim de semana). Aritmética em minutos
 * locais — atravessar virada de DST pode errar em ±1h, aceitável p/ um badge.
 */
function statusDaPraca(praca: PracaRelogio, agora: Date): StatusPraca {
  const { wd, minutos } = partesNoFuso(agora, praca.tz);
  const sessoes = praca.sessoes;

  if (DIA_UTIL(wd)) {
    for (const [ini, fim] of sessoes) {
      if (minutos >= ini && minutos < fim) return { kind: "aberto", minutosParaFechar: fim - minutos };
    }
    const primeira = sessoes[0][0];
    const ultima = sessoes[sessoes.length - 1][1];
    if (minutos >= primeira && minutos < ultima) {
      const proxima = sessoes.find(([ini]) => ini > minutos);
      if (proxima) return { kind: "intervalo", minutosParaAbrir: proxima[0] - minutos };
    }
    if (minutos < primeira) return { kind: "fechado", minutosParaAbrir: primeira - minutos, diasAdiante: 0 };
  }

  // Fechado pós-pregão ou fim de semana: procura o próximo dia útil.
  for (let d = 1; d <= 7; d += 1) {
    if (DIA_UTIL((wd + d) % 7)) {
      return { kind: "fechado", minutosParaAbrir: d * 1440 + sessoes[0][0] - minutos, diasAdiante: d };
    }
  }
  return { kind: "fechado", minutosParaAbrir: 0, diasAdiante: 0 }; // inalcançável
}

function fmtDuracao(min: number): string {
  if (min < 75) return `${Math.max(1, Math.round(min))}min`;
  return `${Math.round(min / 60)}h`;
}

function rotuloStatus(s: StatusPraca): { texto: string; detalhe: string | null; cor: string; dot: string } {
  switch (s.kind) {
    case "aberto":
      return {
        texto: "Aberto",
        detalhe: `fecha em ${fmtDuracao(s.minutosParaFechar)}`,
        cor: AZ_CHART.posText,
        dot: AZ_CHART.pos,
      };
    case "intervalo":
      return {
        texto: "Intervalo",
        detalhe: `retoma em ${fmtDuracao(s.minutosParaAbrir)}`,
        cor: "#A16207",
        dot: "#D97706",
      };
    case "fechado":
      return {
        texto: "Fechado",
        detalhe: s.diasAdiante > 1 ? "abre na 2ª-feira" : `abre em ${fmtDuracao(s.minutosParaAbrir)}`,
        cor: "#64748B",
        dot: "#94A3B8",
      };
  }
}

type Props = {
  /** Retorno 1d por ticker da cesta intradiária (null/ausente = "—"). */
  retornos1d: Partial<Record<string, number | null>>;
  /** generated_at do panorama (DataStamp "Giro"). */
  geradoEm?: string | null;
  /** Data do fechamento usado nos 1d (DataStamp "Dado"). */
  dataDado?: string | null;
};

/** Faixa horizontal das 6 praças — rola no mobile (snap), respira no desktop. */
export function RelogioMercados({ retornos1d, geradoEm, dataDado }: Props) {
  const [agora, setAgora] = useState<Date | null>(null);

  useEffect(() => {
    setAgora(new Date());
    const id = window.setInterval(() => setAgora(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const cards = useMemo(
    () =>
      PRACAS_RELOGIO.map((praca) => {
        const ret = retornos1d[praca.ticker];
        const retorno = typeof ret === "number" && Number.isFinite(ret) ? ret : null;
        if (agora == null) return { praca, retorno, hhmm: null as string | null, status: null as StatusPraca | null };
        return { praca, retorno, hhmm: partesNoFuso(agora, praca.tz).hhmm, status: statusDaPraca(praca, agora) };
      }),
    [agora, retornos1d],
  );

  return (
    <ChartCard
      title="Relógio dos mercados — o dia segue o sol"
      subtitle="De Tóquio a Nova York: estado do pregão agora, hora local e a variação de 1 dia de cada praça"
      footer={
        <>
          Horários regulares de pregão local fixos por praça (TSE, HKEX, NSE, Xetra, LSE e NYSE);
          não considera feriados locais. Retorno de 1 dia da cesta intradiária, em moeda local.
        </>
      }
      stampGiro={geradoEm}
      stampDado={dataDado}
    >
      <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 md:snap-none">
        {cards.map(({ praca, retorno, hhmm, status }, i) => {
          const rotulo = status ? rotuloStatus(status) : null;
          return (
            <div key={praca.id} className="flex shrink-0 items-center gap-2 md:flex-1">
              <div className="w-[148px] shrink-0 snap-start rounded-xl border border-[#132960]/10 bg-zinc-50/60 p-3 md:w-auto md:flex-1">
                <div className="flex items-center gap-1.5">
                  {/* Bandeira via flagcdn — mesmo padrão do FlagYTick do MarketsPanel
                      (emoji de bandeira não renderiza no Chrome/Windows). */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://flagcdn.com/w20/${praca.flag}.png`}
                    alt=""
                    width={18}
                    height={13}
                    className="rounded-[2px]"
                    loading="lazy"
                  />
                  <span className="truncate text-sm font-semibold text-[#132960]">{praca.cidade}</span>
                </div>
                <div className="mt-0.5 flex items-baseline justify-between gap-1">
                  <span className="truncate text-[10px] text-zinc-500">{praca.indice}</span>
                  <span className="text-[10px] tabular-nums text-zinc-400">{hhmm ?? "--:--"}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: rotulo?.cor ?? "#94A3B8" }}>
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${status?.kind === "aberto" ? "animate-pulse" : ""}`}
                    style={{ background: rotulo?.dot ?? "#CBD5E1" }}
                    aria-hidden
                  />
                  <span>{rotulo?.texto ?? "—"}</span>
                  {rotulo?.detalhe ? <span className="font-normal text-zinc-500">· {rotulo.detalhe}</span> : null}
                </div>
                <div
                  className="mt-1 text-lg font-bold tabular-nums"
                  style={{ color: retorno != null ? variationText(retorno) : "#A1A1AA" }}
                >
                  {retorno != null ? fmtSignedPct(retorno, 1) : "—"}
                  <span className="ml-1 text-[10px] font-normal text-zinc-400">1D</span>
                </div>
              </div>
              {i < cards.length - 1 ? (
                <span aria-hidden className="shrink-0 text-zinc-300">
                  →
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </ChartCard>
  );
}
