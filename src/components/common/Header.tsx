import Image from "next/image";
import Link from "next/link";
import { navItems } from "@/data/home";
import { SITE_MAIN_MAX_WIDTH_CLASS } from "@/lib/site-layout";

export async function Header() {
  return (
    <header className="border-b border-[#132960]/10 bg-[#132960] text-[#E8E7E5]">
      <div className={`mx-auto flex w-full ${SITE_MAIN_MAX_WIDTH_CLASS} items-center justify-between gap-4 px-4 py-4 md:px-8`}>
        <Link href="/" className="block">
          <Image
            src="/logo-az-branco.png"
            alt="AZ Invest - Investimentos de A a Z"
            width={951}
            height={310}
            priority
            className="h-12 w-auto md:h-14"
          />
        </Link>

        <div className="flex items-center">
          <Link
            href="/area-restrita/login"
            className="rounded-full bg-[#FF5713] px-7 py-2.5 text-sm font-semibold text-white transition hover:bg-[#d94a10] md:px-8 md:py-3 md:text-base"
          >
            Login
          </Link>
        </div>
      </div>

      <nav className="border-t border-white/10 bg-[#0e1f49]">
        <div className={`mx-auto flex w-full ${SITE_MAIN_MAX_WIDTH_CLASS} items-center gap-6 overflow-x-auto px-4 py-3 text-xs font-semibold uppercase tracking-wider md:px-8`}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap text-white/80 transition-colors hover:text-[#027DFC]"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      <div className="h-1 bg-[#027DFC]" />
    </header>
  );
}
