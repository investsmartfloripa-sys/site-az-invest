import { ChartCard, isDarkBg, steppedDivergingScale } from "@/components/painel/core";
import { variationText } from "@/lib/az-chart-theme";
import { fmtSignedPct } from "@/lib/format-br";
import {
  PANORAMA_PERIODS,
  type PanoramaPeriodKey,
  type WorldIndicesReturnsPayload,
} from "@/lib/painel-mercado-global";

import { INDICES_MUNDO, REGIOES, type RegiaoId } from "./mundo";

/**
 * O mundo por região — Américas / Europa / Ásia-Pacífico, cada índice com
 * bandeira + heatstrip horizontal das 5 janelas (1D/1S/1M/3M/1A). Substitui a
 * tabela pivotada como leitura principal (a tabela completa segue colapsável
 * no fim da página, como esmiuçamento).
 *
 * Server-safe: sem hooks.
 */

/**
 * Escala discreta POR JANELA (steppedDivergingScale, família AZ): um ±1% em
 * um dia é notícia, em um ano é ruído — cada coluna tem a própria régua.
 * Degraus (em %, espelhados p/ o negativo) documentados na ficha técnica.
 */
const DEGRAUS: Record<PanoramaPeriodKey, number[]> = {
  "1d": [0.3, 1, 2],
  "1wk": [0.5, 1.5, 3],
  "1mo": [1, 3, 6],
  "3mo": [2, 6, 12],
  "1y": [5, 15, 30],
};

const ESCALAS = Object.fromEntries(
  PANORAMA_PERIODS.map((p) => [p.id, steppedDivergingScale(DEGRAUS[p.id])]),
) as Record<PanoramaPeriodKey, (v: number) => string>;

type LinhaIndice = {
  ticker: string;
  flag: string;
  pais: string;
  indice: string;
  retornos: Partial<Record<PanoramaPeriodKey, number | null>>;
};

/** Pivota o by_period (período → lista) em linhas por região, ordenadas pelo 1D do dia. */
function linhasPorRegiao(payload: WorldIndicesReturnsPayload): Record<RegiaoId, LinhaIndice[]> {
  const map = new Map<string, LinhaIndice & { regiao: RegiaoId }>();
  for (const { id } of PANORAMA_PERIODS) {
    for (const r of payload.by_period?.[id]?.data ?? []) {
      const meta = r?.ticker ? INDICES_MUNDO[r.ticker] : undefined;
      if (!meta) continue;
      let linha = map.get(r.ticker);
      if (!linha) {
        linha = { ticker: r.ticker, regiao: meta.regiao, flag: meta.flag, pais: meta.pais, indice: meta.indice, retornos: {} };
        map.set(r.ticker, linha);
      }
      linha.retornos[id] =
        typeof r.return_pct === "number" && Number.isFinite(r.return_pct) ? r.return_pct : null;
    }
  }
  const out: Record<RegiaoId, LinhaIndice[]> = { americas: [], europa: [], asia: [] };
  for (const linha of map.values()) out[linha.regiao].push(linha);
  for (const regiao of Object.keys(out) as RegiaoId[]) {
    out[regiao].sort((a, b) => (b.retornos["1d"] ?? -Infinity) - (a.retornos["1d"] ?? -Infinity));
  }
  return out;
}

function CelulaHeat({ periodo, valor }: { periodo: PanoramaPeriodKey; valor: number | null | undefined }) {
  if (valor == null) {
    return (
      <td className="px-0.5 py-0.5">
        <div className="flex h-7 min-w-[52px] items-center justify-center rounded-md bg-zinc-100 text-[10px] text-zinc-400">
          —
        </div>
      </td>
    );
  }
  const bg = ESCALAS[periodo](valor);
  const dark = isDarkBg(bg);
  return (
    <td className="px-0.5 py-0.5">
      <div
        className={`flex h-7 min-w-[52px] items-center justify-center rounded-md text-[10.5px] font-semibold tabular-nums ${
          dark ? "text-white" : "text-zinc-900"
        }`}
        style={{ background: bg }}
        title={fmtSignedPct(valor, 2)}
      >
        {fmtSignedPct(valor, 1)}
      </div>
    </td>
  );
}

function BlocoRegiao({ titulo, descricao, linhas }: { titulo: string; descricao: string; linhas: LinhaIndice[] }) {
  if (linhas.length === 0) return null;
  const com1d = linhas.filter((l) => l.retornos["1d"] != null);
  const media1d =
    com1d.length > 0 ? com1d.reduce((s, l) => s + (l.retornos["1d"] ?? 0), 0) / com1d.length : null;

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[#132960]">{titulo}</h3>
          <p className="text-[10px] text-zinc-500">{descricao}</p>
        </div>
        {media1d != null ? (
          <span
            className="rounded-full bg-zinc-50 px-2 py-0.5 text-[10px] font-semibold tabular-nums"
            style={{ color: variationText(media1d) }}
          >
            média 1D {fmtSignedPct(media1d, 1)}
          </span>
        ) : null}
      </div>
      <div className="mt-1.5 overflow-x-auto">
        <table className="w-full min-w-[440px] border-collapse">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-zinc-500">
              <th className="px-1 py-1 text-left font-semibold">Índice</th>
              {PANORAMA_PERIODS.map((p) => (
                <th key={p.id} className="px-0.5 py-1 text-center font-semibold">
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.ticker} className="border-t border-zinc-100">
                <td className="max-w-[180px] py-0.5 pr-2">
                  <span className="flex items-center gap-1.5">
                    {/* Bandeira via flagcdn — padrão FlagYTick (emoji não renderiza no Chrome/Windows). */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://flagcdn.com/w20/${l.flag}.png`}
                      alt=""
                      width={16}
                      height={11}
                      className="shrink-0 rounded-[2px]"
                      loading="lazy"
                    />
                    <span className="truncate text-xs text-[#132960]">
                      <span className="font-semibold">{l.pais}</span>
                      <span className="text-zinc-500"> · {l.indice}</span>
                    </span>
                  </span>
                </td>
                {PANORAMA_PERIODS.map((p) => (
                  <CelulaHeat key={p.id} periodo={p.id} valor={l.retornos[p.id]} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type Props = {
  panorama: WorldIndicesReturnsPayload;
};

/** Três blocos regionais com heatstrip das 5 janelas — a fotografia do mundo. */
export function RegioesHeatstrips({ panorama }: Props) {
  const porRegiao = linhasPorRegiao(panorama);

  return (
    <ChartCard
      title="A fotografia do mundo — cinco janelas por praça"
      subtitle="Do dia (1D) ao ano (1A): células mais escuras = movimento mais forte para a janela; cada coluna tem a própria régua"
      footer={
        <>
          Retornos em moeda local; Brasil via EWZ (ETF em US$ listado em NY). Degraus de cor por
          janela na ficha técnica. Fonte: Yahoo Finance, giro a cada 15 min.
        </>
      }
      stampGiro={panorama.generated_at}
      stampDado={panorama.generated_at}
    >
      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {REGIOES.map((r) => (
          <BlocoRegiao key={r.id} titulo={r.label} descricao={r.descricao} linhas={porRegiao[r.id]} />
        ))}
      </div>
    </ChartCard>
  );
}
