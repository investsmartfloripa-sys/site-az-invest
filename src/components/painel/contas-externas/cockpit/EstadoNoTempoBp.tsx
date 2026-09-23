"use client";

import { useMemo } from "react";

import type { BpMestre } from "@/lib/painel-contas-externas";
import { MiniSpark } from "@/components/painel/core";
import { MethodInfo } from "@/components/painel/core/MethodInfo";
import DataStamp from "@/components/painel/DataStamp";
import { AZ_BRAND, AZ_CHART, variationText } from "@/lib/az-chart-theme";
import { fmtSignedPct } from "@/lib/format-br";
import { fmtSinal, fmtUsBiSigned, isoMes, pctPib, percentil, val } from "./cockpit-shared";

/** Linhas do BP acompanhadas em small multiples (a tabela mestra tem todas). */
const TILES: ReadonlyArray<{ key: string; label: string; sgs: string }> = [
  { key: "tc", label: "Transações correntes", sgs: "22701" },
  { key: "bens", label: "Balança de bens", sgs: "22707" },
  { key: "servicos", label: "Serviços", sgs: "22719" },
  { key: "renda_primaria", label: "Renda primária", sgs: "22800" },
  { key: "renda_secundaria", label: "Renda secundária", sgs: "22838" },
  { key: "idp", label: "IDP (passivo)", sgs: "22885" },
  { key: "ide", label: "IDE (ativo)", sgs: "22865" },
  { key: "carteira_passivos", label: "Carteira — passivos", sgs: "22924" },
  { key: "carteira_ativos", label: "Carteira — ativos", sgs: "22906" },
  { key: "oi_passivos", label: "Outros inv. — passivos", sgs: "22971" },
  { key: "reservas", label: "Ativos de reserva", sgs: "23043" },
  { key: "erros_omissoes", label: "Erros e omissões", sgs: "23060" },
];

const INICIO_REGUA = "2005-01-01";
const JANELA_SPARK = 60;

export function EstadoNoTempoBp({ bp, geradoEm }: { bp: BpMestre; geradoEm: string }) {
  const rows = bp.acum_12m;
  const tiles = useMemo(() => {
    const ult = rows[rows.length - 1];
    const ant = rows.length > 12 ? rows[rows.length - 13] : undefined;
    const regua = rows.filter((r) => r.mes >= INICIO_REGUA);
    return TILES.map((t) => {
      const v = val(ult, t.key);
      const va = val(ant, t.key);
      const pib = pctPib(ult, t.key);
      const hist = regua.map((r) => pctPib(r, t.key)).filter((x): x is number => x != null);
      const spark = rows
        .slice(-JANELA_SPARK)
        .map((r) => [isoMes(r.mes), val(r, t.key)] as const)
        .filter((p): p is readonly [string, number] => p[1] != null);
      return {
        ...t,
        v,
        pib,
        delta: v != null && va != null ? v - va : null,
        pct: pib != null ? percentil(hist, pib) : null,
        spark,
      };
    });
  }, [rows]);
  const ult = rows[rows.length - 1];

  return (
    <section className="rounded-2xl border border-[#132960]/10 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-[#132960] md:text-lg">
            Estado no tempo — 12 linhas do BP, acumulado 12m
            <MethodInfo className="ml-1.5 align-middle">
              Cada tile mostra o acumulado de 12 meses em US$ bi, o mesmo valor em % do PIB, a variação contra os 12 meses
              encerrados um ano antes (em US$ bi) e o percentil do % do PIB na distribuição desde jan/2005 (0 = o menor da
              série, 100 = o maior). A sparkline cobre os últimos 60 meses com a linha do zero. Verde/vermelho = direção
              literal da variação, sem juízo. Convenção BPM6: passivos e IDP positivos = entrada; ativos, IDE e reservas
              positivos = saída/acumulação.
            </MethodInfo>
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">US$ bi 12m · % PIB · Δ vs 12m antes · percentil desde 2005 · sparkline 60 meses</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.key} className="rounded-xl border border-[#132960]/10 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[11px] font-bold uppercase tracking-wide text-zinc-500" title={`SGS ${t.sgs}`}>
                {t.label}
              </span>
              {t.pct != null ? <span className="shrink-0 text-[10px] tabular-nums text-zinc-400">p{t.pct}</span> : null}
            </div>
            <div className="mt-1 flex items-baseline gap-2 tabular-nums">
              <span className="text-lg font-bold text-[#132960]">{fmtUsBiSigned(t.v, 1)}</span>
              <span className="text-[11px] text-zinc-500">{fmtSignedPct(t.pib, 1)} PIB</span>
            </div>
            <div className="text-[11px] font-semibold tabular-nums" style={{ color: t.delta != null ? variationText(t.delta) : AZ_CHART.ticks }}>
              {fmtSinal(t.delta, 1)} bi a/a
            </div>
            <MiniSpark data={t.spark} zeroLine color={AZ_BRAND.azure} height={36} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-end">
        <DataStamp giro={geradoEm} dado={ult?.mes.slice(0, 7)} />
      </div>
    </section>
  );
}
