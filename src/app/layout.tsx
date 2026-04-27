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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://site-az-invest.vercel.app";
const SITE_DESCRIPTION =
  "Conteudos sobre economia, educacao financeira e investimentos para te ajudar a investir melhor.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Investimentos de A a Z",
    template: "%s | AZ Invest",
  },
  description: SITE_DESCRIPTION,
  applicationName: "AZ Invest",
  openGraph: {
    title: "Investimentos de A a Z",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: "Investimentos de A a Z",
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Investimentos de A a Z",
    description: SITE_DESCRIPTION,
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
