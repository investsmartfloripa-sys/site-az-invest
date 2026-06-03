import type { Metadata } from "next";
import { Michroma, Raleway } from "next/font/google";
import "./globals.css";
import { getSiteUrl } from "@/lib/site-url";
import { AnalyticsBeacon } from "@/components/analytics/AnalyticsBeacon";

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

const SITE_URL = getSiteUrl();
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
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: "Investimentos de A a Z",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: "Investimentos de A a Z",
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary",
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
      <body className="min-h-full flex flex-col">
        <AnalyticsBeacon />
        {children}
      </body>
    </html>
  );
}
