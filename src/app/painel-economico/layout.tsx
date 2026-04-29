import type { ReactNode } from "react";

import { Footer } from "@/components/common/Footer";
import { Header } from "@/components/common/Header";
import { PainelSectionShell } from "@/components/painel/PainelSectionShell";

type Props = {
  children: ReactNode;
};

export default function PainelEconomicoLayout({ children }: Props) {
  return (
    <div className="min-h-screen text-[#132960]">
      <Header />
      <main>
        <PainelSectionShell>{children}</PainelSectionShell>
      </main>
      <Footer />
    </div>
  );
}
