import { fetchPainelBlob } from "@/lib/painel-blob";
import { PAINEL_PATH, type ChartIndicador } from "@/lib/publisher/chart-catalog";

/**
 * Última divulgação publicada pelo Publisher, por indicador.
 *
 * O motor de imagens grava, a cada divulgação, `releases/<ind>/<mes>/<id>.png`
 * mais um `manifest.json` do mês e um `latest.json` que aponta para ele. Aqui só
 * resolvemos esses dois saltos — nunca chutar o mês no caminho.
 *
 * Silencioso por design: qualquer falha devolve `null` e o card cai no estado
 * vazio, porque a home não pode quebrar por causa de um bloco secundário.
 */

export type ReleaseResumo = {
  indicador: ChartIndicador;
  /** Rótulo curto do indicador. Ex.: "IPCA". */
  label: string;
  /** Mês de referência no formato "AAAA-MM". */
  mesReferencia: string;
  /** Rótulo pronto para exibição. Ex.: "agosto de 2026". */
  periodo: string;
  /** Quantos gráficos saíram na divulgação. */
  totalGraficos: number;
  /** Rota do painel interativo do indicador. */
  href: string;
  /** ISO 8601 de quando o motor gerou as imagens. */
  geradoEm: string;
};

const LABEL: Record<ChartIndicador, string> = { ipca: "IPCA", igpm: "IGP-M" };

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "2026-07" → "julho de 2026". Usado também no kicker dos boletins (PeriodicosBlock). */
export function periodoLegivel(mesRef: string): string {
  const [ano, mes] = mesRef.split("-");
  const i = Number(mes) - 1;
  return MESES[i] ? `${MESES[i]} de ${ano}` : mesRef;
}

type LatestJson = { mes_referencia?: unknown; manifest_path?: unknown; gerado_em?: unknown };
type ManifestJson = { charts?: unknown; gerado_em?: unknown };

/** TTL generoso: divulgação é mensal. A purga por tag é quem entrega o dado novo. */
const TTL = 60 * 60 * 6;

async function lerRelease(indicador: ChartIndicador): Promise<ReleaseResumo | null> {
  try {
    const resLatest = await fetchPainelBlob(`releases/${indicador}/latest.json`, TTL);
    if (!resLatest?.ok) return null;
    const latest = (await resLatest.json()) as LatestJson;

    const mesReferencia = typeof latest.mes_referencia === "string" ? latest.mes_referencia : "";
    const manifestPath = typeof latest.manifest_path === "string" ? latest.manifest_path : "";
    if (!mesReferencia || !manifestPath) return null;

    const resManifest = await fetchPainelBlob(manifestPath, TTL);
    if (!resManifest?.ok) return null;
    const manifest = (await resManifest.json()) as ManifestJson;
    const totalGraficos = Array.isArray(manifest.charts) ? manifest.charts.length : 0;

    return {
      indicador,
      label: LABEL[indicador],
      mesReferencia,
      periodo: periodoLegivel(mesReferencia),
      totalGraficos,
      href: PAINEL_PATH[indicador],
      geradoEm:
        typeof latest.gerado_em === "string"
          ? latest.gerado_em
          : typeof manifest.gerado_em === "string"
            ? manifest.gerado_em
            : "",
    };
  } catch {
    return null;
  }
}

/** Divulgações mais recentes, da mais nova para a mais antiga. */
export async function listReleasesRecentes(): Promise<ReleaseResumo[]> {
  const indicadores: ChartIndicador[] = ["ipca", "igpm"];
  const lidos = await Promise.all(indicadores.map(lerRelease));
  return lidos
    .filter((r): r is ReleaseResumo => r !== null)
    .sort((a, b) => b.geradoEm.localeCompare(a.geradoEm));
}
