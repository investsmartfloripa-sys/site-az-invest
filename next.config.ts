import type { NextConfig } from "next";
import redirecionamentosSimuladores from "./src/data/simuladores-redirecionamentos.json";

/** Mesma ordem que `painelBlobBase()` em `src/lib/painel-blob.ts` (Vercel Build pode nao enxertar NEXT_PUBLIC). */
const blobBase =
  process.env.PAINEL_BLOB_PUBLIC_FALLBACK?.trim() ||
  process.env.NEXT_PUBLIC_BLOB_BASE_URL?.trim() ||
  "";
let blobHostname: string | null = null;
try {
  if (blobBase) {
    blobHostname = new URL(blobBase).hostname;
  }
} catch {
  blobHostname = null;
}

const nextConfig: NextConfig = {
  /**
   * Simuladores: o índice e as páginas novas são HTML estático em public/simuladores (gerador próprio).
   * As páginas usam links relativos, então o índice precisa abrir em /simuladores/index.html.
   * Rotas Next que continuam: consorcio, compromissadas.
   * pgbl e sucessao-seguro saíram em 19/10/2026 (contas erradas); começam em 307 e viram 308 se ficarem 30 dias sem reversão.
   * Em 24/10/2026 os 97 simuladores viraram 24: cada página absorvida por um simulador unificado (e a rota aposentadoria)
   * redireciona para ele com ?veio=<antigo>, que abre no modo da página antiga. A lista é gerada pelo gerador
   * (node tools/site.js <pasta do site>) em src/data/simuladores-redirecionamentos.json; também começa em 307.
   */
  async redirects() {
    return [
      { source: "/simuladores", destination: "/simuladores/index.html", permanent: false },
      { source: "/simuladores/pgbl", destination: "/simuladores/restituicao-imposto-de-renda.html", permanent: false },
      { source: "/simuladores/sucessao-seguro", destination: "/simuladores/custos-de-sucessao.html", permanent: false },
      ...redirecionamentosSimuladores.map((r) => ({ ...r, permanent: false })),
    ];
  },
  images: {
    remotePatterns: [
      ...(blobHostname
        ? [
            {
              protocol: "https" as const,
              hostname: blobHostname,
              pathname: "/**",
            },
          ]
        : []),
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "investimentosdeaz.com.br",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "i.pravatar.cc",
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com",
      },
      {
        protocol: "https",
        hostname: "yt3.ggpht.com",
      },
    ],
  },
};

export default nextConfig;
