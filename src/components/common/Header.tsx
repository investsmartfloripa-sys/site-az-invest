import Image from "next/image";
import Link from "next/link";
import { articleCategories, navItems } from "@/data/home";
import { getSession } from "@/lib/auth";

export async function Header() {
  const session = await getSession();
  const loginHref = session ? "/area-restrita/painel" : "/area-restrita/login";
  const loginLabel = session ? "Painel" : "Login";

  return (
    <header className="border-b border-[#132960]/10 bg-[#132960] text-[#E8E7E5]">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-8">
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

        <div className="hidden flex-1 justify-end md:flex">
          <div className="relative w-full max-w-xs">
            <input
              type="text"
              placeholder="Pesquisar..."
              className="h-9 w-full rounded-full border border-white/25 bg-white px-4 text-xs text-black placeholder:text-zinc-500"
            />
          </div>
        </div>

        <Link
          href={loginHref}
          className="rounded-full bg-[#FF5713] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#d94a10]"
        >
          {loginLabel}
        </Link>
      </div>

      <nav className="border-t border-white/10 bg-[#0e1f49]">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-6 overflow-x-auto px-4 py-3 text-xs font-semibold uppercase tracking-wider md:px-8">
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

      <div className="hidden border-t border-white/10 bg-[#0a1838] md:block">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap gap-x-5 gap-y-2 px-4 py-2 text-[11px] font-medium text-white/60 md:px-8">
          <span className="text-white/40">Categorias:</span>
          {articleCategories.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-white">
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="h-1 bg-[#027DFC]" />
    </header>
  );
}
