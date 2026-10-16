import type { NextConfig } from "next";

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
   * Rotas Next que continuam: consorcio, aposentadoria, pgbl, compromissadas, sucessao-seguro.
   */
  async redirects() {
    return [
      { source: "/simuladores", destination: "/simuladores/index.html", permanent: false },
      { source: "/simuladores/juros-compostos", destination: "/simuladores/juros-compostos.html", permanent: true },
      { source: "/simuladores/financiamento", destination: "/simuladores/financiamento-imovel-tr-price.html", permanent: true },
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
