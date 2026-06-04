import Link from "next/link";

import DataStamp from "@/components/painel/DataStamp";
import { listBriefings } from "@/lib/cafe-com-mercado";
import { listPautas } from "@/lib/pauta-da-semana";
import type { PanoramaData } from "@/lib/painel-data";

type Mover = { name: string; pct: number };

function pickMovers(data: PanoramaData): { up: Mover | null; down: Mover | null } {
  const rows = data.assetPanorama.data?.by_period?.["1d"]?.data ?? [];
  let up: Mover | null = null;
  let down: Mover | null = null;
  for (const row of rows) {
    const name = String(row.name ?? "");
    const ticker = String(row.ticker ?? "");
    if (!name || ticker === "BRL=X") continue;
    const v = row.return_brl_pct;
    const pct = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(pct)) continue;
    if (up == null || pct > up.pct) up = { name, pct };
    if (down == null || pct < down.pct) down = { name, pct };
  }
  return { up, down };
}

function findAsset(data: PanoramaData, names: string[]): number | null {
  const rows = data.assetPanorama.data?.by_period?.["1d"]?.data ?? [];
  for (const row of rows) {
    const name = String(row.name ?? "");
    if (names.some((n) => name.toLowerCase().includes(n.toLowerCase()))) {
      const v = row.return_brl_pct;
      const pct = typeof v === "number" ? v : Number(v);
      if (Number.isFinite(pct)) return pct;
    }
  }
  return null;
}

function fmtSigned(pct: number): string {
  const s = pct >= 0 ? "+" : "−";
  return `${s}${Math.abs(pct).toFixed(1).replace(".", ",")}%`;
}

/**
 * Faixa "resumo do dia": frase gerada dos próprios dados do Blob +
 * atalhos pros dois periódicos da casa (Café com Mercado e Pauta da
 * Semana) — que deixaram de ter seção própria no Panorama.
 */
export async function PanoramaResumo({ data }: { data: PanoramaData }) {
  const { up, down } = pickMovers(data);
  const usd = findAsset(data, ["USD/BRL"]);

  const parts: string[] = [];
  if (up) parts.push(`maior alta do dia é ${up.name} (${fmtSigned(up.pct)} em BRL)`);
  if (down) parts.push(`maior queda é ${down.name} (${fmtSigned(down.pct)})`);
  if (usd != null)
    parts.push(`dólar ${usd >= 0 ? "sobe" : "cai"} ${fmtSigned(Math.abs(usd)).replace("+", "").replace("−", "")} ante o real`);

  let cafeHref: string | null = null;
  let pautaHref: string | null = null;
  try {
    const [cafes, pautas] = await Promise.all([listBriefings(1), listPautas(1)]);
    cafeHref = cafes[0] ? `/cafe-com-mercado/${cafes[0].date}` : null;
    pautaHref = pautas[0] ? `/pauta-da-semana/${pautas[0].slug}` : null;
  } catch {
    // sem periodicos, a faixa segue só com a frase
  }

  if (parts.length === 0 && !cafeHref && !pautaHref) return null;

  const dateLabel = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

  const sentence = parts.join("; ");

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-[#132960]/10 bg-white px-4 py-2.5 shadow-sm">
      <span className="rounded bg-[#eaf2ff] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0C447C]">
        Resumo {dateLabel}
      </span>
      {sentence ? (
        <p className="min-w-0 flex-1 basis-64 text-sm text-[#33415C]">
          Entre os ativos acompanhados, {sentence}.
        </p>
      ) : null}
      <span className="flex shrink-0 items-center gap-3 text-xs font-semibold">
        {cafeHref ? (
          <Link href={cafeHref} className="whitespace-nowrap text-[#027DFC] hover:underline">
            Café com Mercado →
          </Link>
        ) : null}
        {pautaHref ? (
          <Link href={pautaHref} className="whitespace-nowrap text-[#027DFC] hover:underline">
            Pauta da Semana →
          </Link>
        ) : null}
      </span>
      {/* Fonte intradiária (cron 15min): generated_at carrega os minutos do dado. */}
      <DataStamp
        giro={data.assetPanorama.meta.generatedAt ?? null}
        dado={data.assetPanorama.meta.generatedAt ?? null}
      />
    </div>
  );
}
