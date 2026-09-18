import Image from "next/image";
import Link from "next/link";
import { HeaderMeasure } from "@/components/common/HeaderMeasure";
import { DesktopNav, MobileMenu } from "@/components/common/NavLinks";
import { SITE_MAIN_MAX_WIDTH_CLASS } from "@/lib/site-layout";

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-[#132960] text-[#E8E7E5] shadow-[0_2px_12px_rgba(19,41,96,0.25)]">
      <div
        className={`mx-auto flex w-full ${SITE_MAIN_MAX_WIDTH_CLASS} items-center justify-between gap-3 px-4 py-4 md:gap-4 md:px-8`}
      >
        <Link href="/" className="block shrink-0">
          <Image
            src="/logo-az-branco.png"
            alt="AZ Invest - Investimentos de A a Z"
            width={951}
            height={310}
            priority
            className="h-12 w-auto md:h-14"
          />
        </Link>

        {/* Uma linha só: nav inline (lg+) · Login · hambúrguer (< lg). O painel mobile é absoluto e sai do fluxo. */}
        <div className="flex items-center gap-2 md:gap-3 lg:gap-8">
          <DesktopNav />
          <Link
            href="/area-restrita/login"
            className="rounded-full bg-[#FF5713] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#d94a10] md:px-8 md:py-3 md:text-base"
          >
            Login
          </Link>
          <MobileMenu />
        </div>
      </div>

      <HeaderMeasure />
    </header>
  );
}
