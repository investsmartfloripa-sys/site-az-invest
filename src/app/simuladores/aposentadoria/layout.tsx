import { metadataSimulador } from "@/lib/simulador-metadata";

export const metadata = metadataSimulador("aposentadoria");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
