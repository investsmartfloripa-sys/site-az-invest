import { NextResponse } from "next/server";

import { type CountryRatesPayload, type GlobalCountryId } from "@/lib/global-rates";
import { getCountryCurve, getFuturesPolicy } from "@/lib/global-rates-server";

const VALID: GlobalCountryId[] = ["us", "jp", "de", "gb"];

/**
 * Curva soberana corrente (+ D-1) e, onde há futuros de juros de curto prazo, a
 * trajetória implícita da política monetária precificada PELO MERCADO (mesmo
 * princípio do DI→Selic da B3): EUA (Fed Funds futures), Alemanha/euro (€STR
 * futures) e Japão (TONA futures). Reino Unido fica só com a curva (sem tira de
 * SONIA gratuita). A curva e a política são buscadas em paralelo.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ country: string }> }) {
  const { country } = await ctx.params;
  if (!VALID.includes(country as GlobalCountryId)) {
    return NextResponse.json({ error: "país inválido" }, { status: 404 });
  }
  const id = country as GlobalCountryId;

  const [curve, policy] = await Promise.all([getCountryCurve(id), getFuturesPolicy(id)]);

  const payload: CountryRatesPayload = {
    country: id,
    curve,
    policy,
    error: curve == null ? "fonte indisponível no momento" : undefined,
  };
  return NextResponse.json(payload);
}
