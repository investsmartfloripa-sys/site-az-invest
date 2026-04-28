import type { NextConfig } from "next";

const blobBase = process.env.NEXT_PUBLIC_BLOB_BASE_URL ?? "";
let blobHostname: string | null = null;
try {
  if (blobBase) {
    blobHostname = new URL(blobBase).hostname;
  }
} catch {
  blobHostname = null;
}

const nextConfig: NextConfig = {
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
