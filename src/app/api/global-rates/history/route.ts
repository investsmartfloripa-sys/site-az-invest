import { NextResponse } from "next/server";

import { COMPARATOR_TENORS, type CountryHistory, type GlobalCountryId } from "@/lib/global-rates";
import { getCountryHistory } from "@/lib/global-rates-server";

const COUNTRIES: GlobalCountryId[] = ["br", "us", "jp", "de", "gb", "co", "cl", "cn"];

/**
 * Histórico por prazo (downsample semanal) de TODOS os países do comparador
 * "Juros Globais". Janela default ~3 anos (teto 30 — as fontes aguentam:
 * FRED desde 1962, MOF desde 1974, Bundesbank/BoE décadas); cada país degrada
 * p/ ausente em falha.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const yearsParam = Number(url.searchParams.get("years"));
  const windowYears = Number.isFinite(yearsParam) && yearsParam > 0 && yearsParam <= 30 ? yearsParam : 3;
  const cutoffISO = new Date(Date.now() - windowYears * 365.2425 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const tenors = [...COMPARATOR_TENORS];

  const results = await Promise.all(
    COUNTRIES.map((c) => getCountryHistory(c, tenors, cutoffISO).catch(() => null)),
  );
  const countries = results.filter((r): r is CountryHistory => r != null);

  return NextResponse.json({
    tenors,
    cutoff: cutoffISO,
    generatedAt: new Date().toISOString(),
    countries,
  });
}
