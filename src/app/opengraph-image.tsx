import { ImageResponse } from "next/og";

export const alt = "Investimentos de A a Z";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background:
            "linear-gradient(135deg, #0a1838 0%, #132960 50%, #1a4a9e 100%)",
          color: "#E8E7E5",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #027DFC 0%, #FF5713 100%)",
              color: "#FFFFFF",
              fontSize: 48,
              fontWeight: 800,
              letterSpacing: -2,
            }}
          >
            AZ
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 28,
              color: "#9FB6EA",
              letterSpacing: 4,
              textTransform: "uppercase",
            }}
          >
            Investimentos
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 88,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -3,
              color: "#FFFFFF",
            }}
          >
            <div style={{ display: "flex" }}>Investimentos</div>
            <div style={{ display: "flex" }}>de A a Z</div>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 32,
              color: "#9FB6EA",
              maxWidth: 900,
              lineHeight: 1.3,
            }}
          >
            Economia, educacao financeira e conteudo direto pra investir melhor.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 24,
            borderTop: "2px solid rgba(255,255,255,0.15)",
            color: "#9FB6EA",
            fontSize: 22,
          }}
        >
          <div style={{ display: "flex" }}>investimentosdeaz.com.br</div>
          <div style={{ display: "flex", color: "#FF5713", fontWeight: 700 }}>
            @azinvestoficial
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
