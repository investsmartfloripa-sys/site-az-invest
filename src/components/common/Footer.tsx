import Image from "next/image";
import Link from "next/link";
import { navItems } from "@/data/home";
import { InstagramIcon, YoutubeIcon, WhatsappIcon } from "@/components/common/SocialIcons";

const socials = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/azinvestoficial",
    Icon: InstagramIcon,
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/channel/UCuMfW1AOhcbSP1zRG5hyBZQ",
    Icon: YoutubeIcon,
  },
  {
    label: "WhatsApp",
    href: "https://wa.me/5548999386708",
    Icon: WhatsappIcon,
  },
];

export function Footer() {
  return (
    <footer className="bg-[#132960] text-[#E8E7E5]">
      <div className="h-1 bg-[#027DFC]" />
      <div className="mx-auto grid w-full max-w-[90rem] grid-cols-1 gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 lg:gap-10 lg:px-8 lg:py-14">
        <div className="text-center sm:col-span-2 sm:text-left lg:col-span-1">
          <div className="mx-auto w-full max-w-[16rem] sm:mx-0">
            <Link href="/" className="block w-full">
              <Image
                src="/logo-az-branco.png"
                alt="AZ Invest - Investimentos de A a Z"
                width={951}
                height={310}
                className="h-auto w-full"
              />
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-[#E8E7E5]/70">
              Economia, mercado e educação financeira para investir com clareza.
            </p>
            <div className="mt-4 flex justify-center gap-3 sm:justify-start">
              {socials.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/25 text-white transition hover:border-[#027DFC] hover:text-[#027DFC]"
                >
                  <Icon className="h-[18px] w-[18px]" />
                </a>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 pt-5 sm:border-0 sm:pt-0">
          <h2 className="text-xl text-white">Atalhos</h2>
          <ul className="mt-4 space-y-2 text-sm text-[#E8E7E5]/70">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="transition-colors hover:text-[#027DFC]">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="border-t border-white/10 pt-5 sm:border-0 sm:pt-0">
          <h2 className="text-xl text-white">Entre em contato</h2>
          <p className="mt-4 text-sm text-[#E8E7E5]/70">
            <strong className="font-semibold text-white">Email:</strong> azinvest.equipe@gmail.com
          </p>
          <p className="break-words text-sm text-[#E8E7E5]/70">
            <strong className="font-semibold text-white">Telefone:</strong>{" "}
            <a href="tel:+5548999386708" className="hover:underline">
              (48) 99938-6708
            </a>
          </p>
          <Link
            href="https://wa.me/5548999386708"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm font-medium text-white hover:text-[#027DFC] hover:underline"
          >
            WhatsApp
          </Link>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto w-full max-w-[90rem] px-4 py-5 sm:px-6 lg:px-8">
          <p className="text-xs leading-relaxed text-[#E8E7E5]/60">
            A AZ Invest é uma plataforma de conteúdo sobre economia, mercado e educação financeira — análises, simuladores e um painel econômico atualizado para você investir com mais clareza.
          </p>
        </div>
      </div>
      <div className="bg-[#027DFC] px-3 py-2 text-center text-[11px] leading-relaxed text-white sm:text-xs">
        {new Date().getFullYear()} Todos os direitos reservados para INVESTIMENTOS DE A A Z
      </div>
    </footer>
  );
}
