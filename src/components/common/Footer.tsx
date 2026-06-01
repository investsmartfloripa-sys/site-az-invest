import Image from "next/image";
import Link from "next/link";
import { navItems } from "@/data/home";

export function Footer() {
  return (
    <footer className="bg-white">
      <div className="mx-auto grid w-full max-w-[90rem] grid-cols-1 gap-8 px-4 py-10 text-[#132960] sm:grid-cols-2 sm:px-6 lg:grid-cols-3 lg:gap-10 lg:px-8 lg:py-14">
        <div className="text-center sm:col-span-2 sm:text-left lg:col-span-1">
          <Link href="/" className="inline-block">
            <Image
              src="/logo-az.png"
              alt="AZ Invest - Investimentos de A a Z"
              width={951}
              height={310}
              className="h-12 w-auto md:h-14"
            />
          </Link>
        </div>
        <div className="border-t border-[#132960]/10 pt-5 sm:border-0 sm:pt-0">
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
        <div className="border-t border-[#132960]/10 pt-5 sm:border-0 sm:pt-0">
          <h2 className="text-xl">Entre em contato</h2>
          <p className="mt-4 text-sm text-[#132960]/80">
            <strong>Email:</strong> azinvest.equipe@gmail.com
          </p>
          <p className="break-words text-sm text-[#132960]/80">
            <strong>Telefone:</strong>{" "}
            <a href="tel:+5548999386708" className="hover:underline">
              (48) 99938-6708
            </a>
          </p>
          <Link
            href="https://wa.me/5548999386708"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm font-medium text-[#132960] hover:underline"
          >
            WhatsApp
          </Link>
        </div>
      </div>
      <div className="bg-[#027DFC] px-3 py-2 text-center text-[11px] leading-relaxed text-white sm:text-xs">
        {new Date().getFullYear()} Todos os direitos reservados para INVESTIMENTOS DE A A Z
      </div>
    </footer>
  );
}
