import DataStamp from "@/components/painel/DataStamp";
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

/** Faixa "resumo do dia" gerada dos próprios dados do Blob (sem editor). */
export function PanoramaResumo({ data }: { data: PanoramaData }) {
  const { up, down } = pickMovers(data);
  const usd = findAsset(data, ["USD/BRL"]);

  const parts: string[] = [];
  if (up) parts.push(`maior alta do dia é ${up.name} (${fmtSigned(up.pct)} em BRL)`);
  if (down) parts.push(`maior queda é ${down.name} (${fmtSigned(down.pct)})`);
  if (usd != null)
    parts.push(`dólar ${usd >= 0 ? "sobe" : "cai"} ${fmtSigned(Math.abs(usd)).replace("+", "").replace("−", "")} ante o real`);

  if (parts.length === 0) return null;

  const dateLabel = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

  const sentence = parts.join("; ");

  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-[#132960]/10 bg-white px-4 py-2.5 shadow-sm">
      <span className="rounded bg-[#eaf2ff] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0C447C]">
        Resumo {dateLabel}
      </span>
      <p className="min-w-0 flex-1 text-sm text-[#33415C]">
        Entre os ativos acompanhados, {sentence}.
      </p>
      {/* Fonte intradiária (cron 15min): generated_at carrega os minutos do dado. */}
      <DataStamp
        giro={data.assetPanorama.meta.generatedAt ?? null}
        dado={data.assetPanorama.meta.generatedAt ?? null}
      />
    </div>
  );
}
