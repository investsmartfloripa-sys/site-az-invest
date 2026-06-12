import { ImageResponse } from "next/og";

import { formatPostCategoryLabel } from "@/data/blog-categories";
import { prisma } from "@/lib/prisma";

export const alt = "Artigo do AZ Invest";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Carrega Raleway Bold (TTF) do Google Fonts em runtime. Sem User-Agent de
 * browser o Google serve truetype (satori não lê woff2). Falhou? Devolve null
 * e a imagem cai no sans-serif padrão do ImageResponse.
 */
async function loadRaleway(): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      "https://fonts.googleapis.com/css2?family=Raleway:wght@700&display=swap",
    ).then((res) => (res.ok ? res.text() : ""));
    const url = css.match(/src:\s*url\((https:[^)]+)\)\s*format\(['"]?(?:truetype|opentype)['"]?\)/)?.[1];
    if (!url) return null;
    const fontRes = await fetch(url);
    if (!fontRes.ok) return null;
    return await fontRes.arrayBuffer();
  } catch {
    return null;
  }
}

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Fallback estático se o post não existir ou o banco estiver indisponível.
  let title = "Investimentos de A a Z";
  let category = "AZ Invest";
  try {
    const post = await prisma.post.findUnique({
      where: { slug },
      select: { title: true, category: true, status: true, published: true },
    });
    if (post && post.status === "APPROVED" && post.published) {
      title = post.title;
      category = formatPostCategoryLabel(post.category);
    }
  } catch {
    // segue com o fallback
  }

  if (title.length > 140) title = `${title.slice(0, 137)}…`;

  const raleway = await loadRaleway();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: "#132960",
          fontFamily: raleway ? "Raleway" : "sans-serif",
        }}
      >
        <div style={{ display: "flex" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "10px 28px",
              borderRadius: 9999,
              background: "#027DFC",
              color: "#ffffff",
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            {category}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            color: "#ffffff",
            fontSize: title.length > 80 ? 52 : 64,
            fontWeight: 700,
            lineHeight: 1.15,
            maxWidth: 1040,
          }}
        >
          {title}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <span style={{ color: "#ffffff", fontSize: 40, fontWeight: 700 }}>AZ</span>
            <span style={{ color: "#FF5713", fontSize: 40, fontWeight: 700, marginLeft: 12 }}>
              Invest
            </span>
          </div>
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 26 }}>
            investimentosdeaz.com.br
          </span>
        </div>
      </div>
    ),
    {
      ...size,
      ...(raleway
        ? { fonts: [{ name: "Raleway", data: raleway, style: "normal" as const, weight: 700 as const }] }
        : {}),
    },
  );
}
