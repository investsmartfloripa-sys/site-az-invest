import { Footer } from "@/components/common/Footer";
import { Header } from "@/components/common/Header";

export default function SimuladoresLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen text-[#132960]">
      <Header />
      {children}
      <Footer />
    </div>
  );
}
