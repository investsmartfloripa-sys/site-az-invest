import Image from "next/image";
import Link from "next/link";
import { navItems } from "@/data/home";
import { getSession } from "@/lib/auth";
import { SITE_MAIN_MAX_WIDTH_CLASS } from "@/lib/site-layout";

export async function Header() {
  const session = await getSession();
  const loginHref = session ? "/area-restrita/painel" : "/area-restrita/login";
  const loginLabel = session ? "Painel" : "Login";
  const whatsappHref = "https://wa.me/5548999386708";

  return (
    <header className="border-b border-[#132960]/10 bg-[#132960] text-[#E8E7E5]">
      <div className={`mx-auto flex w-full ${SITE_MAIN_MAX_WIDTH_CLASS} items-center justify-between gap-4 px-4 py-4 md:px-8`}>
        <Link href="/" className="block">
          <Image
            src="https://investimentosdeaz.com.br/wp-content/uploads/2025/10/Logo-Horizontal-Fundos-azuis-escuro-1024x370.png"
            alt="Investimentos de A a Z"
            width={220}
            height={80}
            priority
            className="h-12 w-auto md:h-14"
          />
        </Link>

        <div className="flex items-center gap-2">
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Falar no WhatsApp"
            className="rounded-full border border-[#22c55e]/40 bg-[#22c55e]/15 px-3 py-2 text-xs font-semibold text-[#22c55e] transition hover:bg-[#22c55e]/25"
          >
            WhatsApp
          </a>
          <Link
            href={loginHref}
            className="rounded-full bg-[#FF5713] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#d94a10]"
          >
            {loginLabel}
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
