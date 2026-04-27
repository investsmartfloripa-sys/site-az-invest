import type { Metadata } from "next";
import { Michroma, Raleway } from "next/font/google";
import "./globals.css";

const headingFont = Michroma({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400"],
});

const bodyFont = Raleway({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://investimentosdeaz.com.br"),
  title: "Investimentos de A a Z",
  description:
    "Conteudos sobre economia, educacao financeira e investimentos para te ajudar a investir melhor.",
  openGraph: {
    title: "Investimentos de A a Z",
    description:
      "Conteudos sobre economia, educacao financeira e investimentos para te ajudar a investir melhor.",
    url: "https://investimentosdeaz.com.br",
    siteName: "Investimentos de A a Z",
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Investimentos de A a Z",
    description:
      "Conteudos sobre economia, educacao financeira e investimentos para te ajudar a investir melhor.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${headingFont.variable} ${bodyFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
