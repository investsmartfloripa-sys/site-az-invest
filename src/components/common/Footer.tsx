import Link from "next/link";
import { navItems } from "@/data/home";

export function Footer() {
  return (
    <footer className="bg-white">
      <div className="mx-auto grid w-full max-w-5xl gap-10 px-4 py-14 text-[#132960] md:grid-cols-3 md:px-8">
        <div>
          <h2 className="text-5xl">AZ INVEST</h2>
        </div>
        <div>
          <h2 className="text-xl">Atalhos</h2>
          <ul className="mt-4 space-y-2 text-sm text-[#132960]/80">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-[#027DFC] transition-colors">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-xl">
            Entre em contato
          </h2>
          <p className="mt-4 text-sm text-[#132960]/80">
            <strong>Email:</strong> azinvest.equipe@gmail.com
          </p>
          <p className="text-sm text-[#132960]/80">Contato: 48 00003-5708</p>
          <Link href="#" className="mt-3 inline-block text-sm font-medium text-[#132960] hover:underline">
            Linkedin
          </Link>
        </div>
      </div>
      <div className="bg-[#027DFC] py-2 text-center text-xs text-white">
        2025 Todos os direitos reservados para INVESTIMENTOS DE A A Z
      </div>
    </footer>
  );
}
