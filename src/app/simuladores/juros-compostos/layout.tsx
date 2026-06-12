import { metadataSimulador } from "@/lib/simulador-metadata";

export const metadata = metadataSimulador("juros-compostos");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
