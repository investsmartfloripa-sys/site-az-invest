"use client";

import { useState } from "react";

/**
 * Logo da empresa (SVG do TradingView, via data/acoes_logos.json). Usa <img>
 * puro — os logos são SVG externos e o next/image bloqueia SVG por padrão
 * (dangerouslyAllowSVG). Se a URL faltar ou falhar o carregamento, cai num
 * badge com as iniciais do ticker, para a tabela nunca ter "buraco".
 */
type Props = {
  ticker: string;
  name?: string | null;
  src?: string | null;
  /** Lado do quadrado em px. Default 28. */
  size?: number;
  className?: string;
};

export function CompanyLogo({ ticker, name, src, size = 28, className = "" }: Props) {
  const [failed, setFailed] = useState(false);
  const initials = (ticker || name || "?").replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "?";
  const showImg = Boolean(src) && !failed;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-white ring-1 ring-[#132960]/10 ${className}`}
      style={{ width: size, height: size }}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src as string}
          alt={name ? `Logo ${name}` : `Logo ${ticker}`}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain p-0.5"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className="font-semibold leading-none text-[#132960]"
          style={{ fontSize: Math.max(9, Math.round(size * 0.36)) }}
          aria-label={name ? `Logo ${name}` : `Logo ${ticker}`}
        >
          {initials}
        </span>
      )}
    </span>
  );
}
