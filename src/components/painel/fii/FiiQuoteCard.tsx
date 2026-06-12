import { MarketCard } from "@/components/painel/market/MarketCard";
import { variationText } from "@/lib/az-chart-theme";
import { fmtBRL, fmtDataBR, fmtNum, fmtPct, fmtSignedPct } from "@/lib/format-br";
import type { FiiDetailEntry } from "@/lib/painel-fii";

/** Valores grandes abreviados: R$ 1,23 Bi / R$ 45,60 M (decimais pt-BR via fmtNum). */
function formatBig(value: number | null | undefined, currency = ""): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const prefix = currency ? `${currency} ` : "";
  if (abs >= 1e9) return `${prefix}${fmtNum(value / 1e9, 2)} Bi`;
  if (abs >= 1e6) return `${prefix}${fmtNum(value / 1e6, 2)} M`;
  return `${prefix}${fmtNum(value, 0)}`;
}

function formatInt(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("pt-BR");
}

type Props = {
  entry: FiiDetailEntry;
  generatedAt?: string | null;
};

/**
 * Card ESQUERDO do topo da página de FII individual — espelha o card "Cotação"
 * da página de ativo de ações (/painel-economico/mercado/ativo/[ticker]):
 * cotação grande + variação do dia, range 52 semanas e, no lugar do grid de
 * retornos por período (que ações usam), os INDICADORES PADRÃO DO FII que já
 * existiam no FiiDetailHero/FiiDetailIndicators — DY 12m, último rendimento,
 * patrimônio líquido, P/VP, segmento e nº de cotistas. Reaproveita os dados de
 * `entry` (hero + indicators + ficha); não busca fonte nova.
 *
 * É server component (sem estado): toda interatividade do topo vive no card da
 * direita (AtivoHeroChart, com seletor de período e comparação).
 */
export function FiiQuoteCard({ entry, generatedAt }: Props) {
  const { hero, indicators, ficha } = entry;

  // Detecção de evento societário (desdobramento/amortização): se a cotação
  // oscilou mais de 50% no melhor caso dos últimos 12m, é quase certo que houve
  // evento — o banner avisa que o histórico não pode ser lido de cabeça.
  const corporateEvent =
    hero.max_12m != null && hero.min_12m != null && hero.price != null && hero.max_12m > 0
      ? (hero.max_12m - hero.min_12m) / hero.max_12m > 0.5
      : false;

  // Range 52 semanas (máx/mín 12m da cotação) — mesma barra do card de ações.
  const { price, min_12m: low, max_12m: high } = hero;
  const rangePct =
    price != null && low != null && high != null && high > low
      ? Math.min(100, Math.max(0, ((price - low) / (high - low)) * 100))
      : null;

  const dayChange = hero.change_pct_1d;

  // Indicadores padrão do FII (rótulos/valores reaproveitados do FiiDetailHero).
  const stats: Array<{ label: string; value: string; sub?: string; tooltip?: string }> = [
    {
      label: "Dividend Yield (12m)",
      value: fmtPct(hero.dy_12m_pct, 2),
      tooltip: entry.dy_atypical ? "DY > 18% pode incluir amortização de capital." : undefined,
    },
    {
      label: "Último rendimento",
      value: hero.last_dividend_brl != null ? fmtBRL(hero.last_dividend_brl, 4) : "—",
      sub: hero.last_dividend_date ? fmtDataBR(hero.last_dividend_date) : undefined,
    },
    {
      label: "Patrimônio líquido",
      value: formatBig(hero.pl, "R$"),
      sub: hero.pl_ref_date ? `ref ${fmtDataBR(hero.pl_ref_date)}` : undefined,
    },
    {
      label: "P/VP",
      value: hero.pvp != null ? fmtNum(hero.pvp, 3) : "—",
      sub:
        hero.pvp == null
          ? "VP/cota indisponível"
          : entry.pvp_warning
          ? "P/VP < 0,7 — possível distress"
          : undefined,
      tooltip:
        hero.pvp == null
          ? "Valor Patrimonial por cota reportado pela CVM em escala inconsistente para este FII. Ratio omitido para evitar exibir P/VP incorreto."
          : entry.pvp_warning
          ? "P/VP < 0,7 pode indicar distress (vacância alta, problema de crédito da carteira CRI). Verifique relatório gerencial."
          : undefined,
    },
    { label: "Segmento", value: ficha.segment || "—" },
    { label: "Nº de cotistas", value: formatInt(indicators.num_cotistas) },
  ];

  return (
    <MarketCard
      title="Cotação"
      subtitle={hero.price_date ? `Última: ${fmtDataBR(hero.price_date)}` : undefined}
      stampGiro={generatedAt ?? null}
      stampDado={
        entry.price_series_daily[entry.price_series_daily.length - 1]?.date ?? hero.price_date
      }
    >
      <div className="space-y-4">
        {entry.dy_atypical || corporateEvent ? (
          <div
            role="alert"
            className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"
          >
            <p className="font-semibold uppercase tracking-wide text-amber-800">
              Atenção — leia antes de interpretar os números
            </p>
            <ul className="mt-1 list-disc pl-5 leading-relaxed">
              {entry.dy_atypical ? (
                <li>
                  <strong>DY 12m acima de 18%</strong>: pode incluir{" "}
                  <strong>devolução de capital</strong> (amortização extraordinária) tratada como
                  rendimento pelo provedor de dados. Confira a tabela de Rendimentos abaixo.
                </li>
              ) : null}
              {corporateEvent ? (
                <li>
                  <strong>Variação de cotação superior a 50% nos últimos 12 meses</strong>: indica
                  provável <strong>desdobramento, agrupamento ou evento societário</strong> — o
                  histórico do gráfico pode não ser comparável diretamente.
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}

        {/* Cotação grande + variação do dia (mesmo formato do card de ações) */}
        <div>
          <p className="text-4xl font-semibold tabular-nums text-[#132960]">
            {price != null ? `R$ ${fmtNum(price, 2)}` : "—"}
          </p>
          <p
            className={`mt-1 text-sm font-semibold ${dayChange == null ? "text-zinc-400" : ""}`}
            style={dayChange != null ? { color: variationText(dayChange) } : undefined}
          >
            {dayChange != null ? `${fmtSignedPct(dayChange, 2)} hoje` : "—"}
          </p>
        </div>

        {/* Indicadores padrão do FII (no lugar do grid de retornos das ações) */}
        <dl className="grid grid-cols-2 gap-2 text-xs">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-lg border border-[#132960]/10 px-2.5 py-2"
              title={s.tooltip}
            >
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                {s.label}
              </dt>
              <dd
                className={`mt-0.5 text-sm font-semibold tabular-nums text-[#132960] ${
                  s.tooltip ? "cursor-help" : ""
                }`}
              >
                {s.value}
                {s.tooltip ? <span className="text-amber-700">*</span> : null}
              </dd>
              {s.sub ? <p className="text-[10px] text-zinc-500">{s.sub}</p> : null}
            </div>
          ))}
        </dl>

        {/* Range 52 semanas: mín—máx com marcador da cotação atual */}
        {rangePct != null && low != null && high != null ? (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Range 52 semanas
            </p>
            <div
              className="relative mt-2 h-1.5 rounded-full bg-gradient-to-r from-[#BE3B33]/25 via-zinc-200 to-[#1E8A5C]/25"
              role="img"
              aria-label={`Cotação atual a ${rangePct.toFixed(0)}% do caminho entre a mínima e a máxima de 52 semanas`}
            >
              <span
                aria-hidden
                className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#027DFC] shadow-md"
                style={{ left: `${rangePct}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-baseline justify-between text-[10px] tabular-nums text-zinc-500">
              <span>
                mín <span className="font-semibold text-[#132960]">R$ {fmtNum(low, 2)}</span>
              </span>
              <span>
                máx <span className="font-semibold text-[#132960]">R$ {fmtNum(high, 2)}</span>
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </MarketCard>
  );
}
