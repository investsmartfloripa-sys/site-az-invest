"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

function brl(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export default function FinanciamentoPage() {
  const [propertyValue, setPropertyValue] = useState(500000);
  const [downPayment, setDownPayment] = useState(150000);
  const [loanRate, setLoanRate] = useState(11);
  const [investRate, setInvestRate] = useState(13);
  const [years, setYears] = useState(20);

  const result = useMemo(() => {
    const principal = propertyValue - downPayment;
    const months = years * 12;
    const monthlyLoan = loanRate / 100 / 12;
    const monthlyInvest = investRate / 100 / 12;

    const installment =
      months > 0 && monthlyLoan > 0
        ? (principal * monthlyLoan) / (1 - Math.pow(1 + monthlyLoan, -months))
        : 0;
    const totalPaid = installment * months;
    const interestPaid = totalPaid - principal;

    const investedDownPayment = downPayment * Math.pow(1 + monthlyInvest, months);

    return {
      installment,
      totalPaid,
      interestPaid,
      investedDownPayment,
    };
  }, [propertyValue, downPayment, loanRate, investRate, years]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 md:px-8">
        <Link
          href="/simuladores"
          className="text-xs font-semibold text-[#132960] hover:underline"
        >
          {"<-"} Voltar para Simuladores
        </Link>

        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#027DFC]">
            Simulador
          </p>
          <h1 className="text-4xl text-[#027DFC] md:text-5xl">Financiamento x investimento</h1>
          <p className="text-sm text-zinc-600">
            Compare o custo total do financiamento com o que voce ganharia investindo a entrada
            durante o mesmo prazo.
          </p>
        </header>

        <section className="grid gap-6 rounded-2xl border border-[#132960]/15 bg-white p-6 md:grid-cols-2">
          <div className="space-y-4">
            <Field label="Valor do imovel (R$)">
              <input
                type="number"
                min={0}
                value={propertyValue}
                onChange={(event) => setPropertyValue(Number(event.target.value))}
                className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
              />
            </Field>
            <Field label="Entrada (R$)">
              <input
                type="number"
                min={0}
                max={propertyValue}
                value={downPayment}
                onChange={(event) => setDownPayment(Number(event.target.value))}
                className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
              />
            </Field>
            <Field label="Taxa do financiamento (% a.a.)">
              <input
                type="number"
                step={0.25}
                min={0}
                value={loanRate}
                onChange={(event) => setLoanRate(Number(event.target.value))}
                className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
              />
            </Field>
            <Field label="Rendimento do investimento (% a.a.)">
              <input
                type="number"
                step={0.25}
                min={0}
                value={investRate}
                onChange={(event) => setInvestRate(Number(event.target.value))}
                className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
              />
            </Field>
            <Field label="Prazo (anos)">
              <input
                type="number"
                min={1}
                max={35}
                value={years}
                onChange={(event) => setYears(Number(event.target.value))}
                className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
              />
            </Field>
          </div>

          <div className="space-y-3">
            <ResultRow label="Parcela mensal" value={brl(result.installment)} accent />
            <ResultRow label="Total pago no financiamento" value={brl(result.totalPaid)} />
            <ResultRow label="Juros pagos" value={brl(result.interestPaid)} />
            <ResultRow
              label="Entrada investida ao final do prazo"
              value={brl(result.investedDownPayment)}
            />
            <p className="text-xs text-zinc-500">
              Calculo simplificado pela tabela Price. Nao considera correcao monetaria, seguros e
              impostos.
            </p>
          </div>
        </section>
      </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function ResultRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-xl border p-4 ${
        accent ? "border-[#027DFC] bg-[#027DFC]/5" : "border-[#132960]/15 bg-white"
      }`}
    >
      <span className="text-sm text-zinc-600">{label}</span>
      <span className={`text-xl font-semibold ${accent ? "text-[#027DFC]" : "text-[#132960]"}`}>
        {value}
      </span>
    </div>
  );
}
