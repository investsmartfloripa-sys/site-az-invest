import { metadataSimulador } from "@/lib/simulador-metadata";

export const metadata = metadataSimulador("sucessao-seguro");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
