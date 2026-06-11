import { fmtNum } from "@/lib/format-br";

/**
 * Box de indicador com transparência metodológica — generalização do
 * IndicadorBox do FiscalShell: badge de origem (CALCULADO quando derivado
 * por fórmula nossa · OFICIAL quando vem direto da fonte), fórmula em
 * destaque, narrativa de 1-2 linhas e glossário inline de siglas.
 *
 * Use quando o NÚMERO precisa de explicação (resultado primário, hiato,
 * carrego...). Para KPI simples com delta, prefira KpiCard.
 *
 * Server-safe: sem hooks.
 */
export type IndicadorBoxProps = {
  titulo: string;
  /** Valor (number é formatado pt-BR; string passa direto; null vira "—"). */
  valor: string | number | null | undefined;
  unidade?: string;
  /** Fonte oficial (ex.: "BCB SGS 13762"). Exibida sob o valor. */
  fonte?: string;
  /** Fórmula do cálculo — quando presente, badge default vira CALCULADO. */
  formula?: string;
  /** Força o badge; default: "calculado" se há fórmula, senão "oficial" se há fonte. */
  origem?: "calculado" | "oficial";
  /** 1-2 linhas explicando o que o indicador mede. */
  narrativa?: string;
  /** Glossário inline: expansão de cada sigla usada. */
  siglas?: Array<{ sigla: string; expansao: string }>;
  /** Leitura semântica do valor (cor): boa/ruim/neutra (default neutra = navy). */
  trend?: "boa" | "ruim" | "neutra";
  tamanho?: "md" | "lg";
};

/** Indicador com badge CALCULADO/OFICIAL, fórmula e glossário — padrão fiscal generalizado. */
export function IndicadorBox({
  titulo,
  valor,
  unidade,
  fonte,
  formula,
  origem,
  narrativa,
  siglas,
  trend = "neutra",
  tamanho = "md",
}: IndicadorBoxProps) {
  const badge = origem ?? (formula ? "calculado" : fonte ? "oficial" : undefined);
  const corValor =
    trend === "boa" ? "text-[#166B47]" : trend === "ruim" ? "text-[#9C2B24]" : "text-[#132960]";
  const valorFmt =
    valor == null || valor === "" ? "—" : typeof valor === "number" ? fmtNum(valor) : valor;

  return (
    <div className="flex flex-col rounded-xl border border-[#132960]/10 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-bold leading-tight text-[#132960]">{titulo}</h4>
        {badge === "calculado" ? (
          <span
            className="rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-violet-900"
            title="Indicador calculado pela AZ a partir das séries oficiais — veja a fórmula"
          >
            calculado
          </span>
        ) : badge === "oficial" ? (
          <span
            className="rounded bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-sky-900"
            title="Número publicado diretamente pela fonte oficial"
          >
            oficial
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex items-baseline gap-1">
        <span className={`${tamanho === "lg" ? "text-3xl" : "text-2xl"} font-bold tabular-nums ${corValor}`}>
          {valorFmt}
        </span>
        {unidade ? <span className="text-sm text-zinc-500">{unidade}</span> : null}
      </div>

      {formula ? <p className="mt-1.5 text-[10px] italic text-violet-700">Fórmula: {formula}</p> : null}
      {fonte ? <p className="mt-1.5 text-[10px] text-zinc-500">Fonte: {fonte}</p> : null}
      {narrativa ? <p className="mt-2 text-[11px] leading-relaxed text-zinc-700">{narrativa}</p> : null}
      {siglas && siglas.length > 0 ? (
        <div className="mt-2 border-t border-zinc-200 pt-2 text-[10px] text-zinc-600">
          {siglas.map(({ sigla, expansao }) => (
            <div key={sigla}>
              <strong className="text-zinc-800">{sigla}:</strong> {expansao}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
