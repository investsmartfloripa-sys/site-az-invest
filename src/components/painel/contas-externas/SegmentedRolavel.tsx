"use client";

import { AzSegmented, type AzSegmentedOption } from "@/components/painel/core";

/**
 * AzSegmented que rola para o lado quando não cabe. O segmentado padrão divide a largura disponível em
 * colunas iguais; no celular, com rótulos longos ("Meses de importação", "Efetivo nominal"), os
 * botões ficavam mais estreitos que o texto e os rótulos se sobrepunham (revisão de 12/11/2026).
 * Aqui o segmentado tem a largura natural e o contêiner, limitado à largura da tela, rola.
 */
export function SegmentedRolavel(props: {
  options: AzSegmentedOption[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
}) {
  return (
    <div className="max-w-[calc(100vw-4rem)] overflow-x-auto">
      <div className="w-max">
        <AzSegmented {...props} />
      </div>
    </div>
  );
}
