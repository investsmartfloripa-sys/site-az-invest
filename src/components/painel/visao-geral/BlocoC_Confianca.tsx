"use client";

import {
  LineChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";

import type { CniData, FecomercioData, FgvConfiancaData, PmiData } from "@/lib/painel-visao-geral";
import { formatMes } from "@/lib/painel-visao-geral";

function CardFgvConfianca({ data }: { data: FgvConfiancaData | null }) {
  if (!data) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-center">
        <h3 className="text-base font-semibold text-zinc-500">C1 — Confiança FGV-IBRE</h3>
        <p className="mt-2 text-xs text-zinc-400">Scraper em construção.</p>
      </div>
    );
  }
  const todosMeses = new Set<string>();
  for (const arr of [data.ice, data.ici, data.icom, data.ics, data.icst, data.icc]) {
    for (const p of arr) todosMeses.add(p.mes);
  }
  const dados = Array.from(todosMeses)
    .sort()
    .map((mes) => ({
      mes,
      ice: data.ice.find((p) => p.mes === mes)?.valor ?? null,
      ici: data.ici.find((p) => p.mes === mes)?.valor ?? null,
      icom: data.icom.find((p) => p.mes === mes)?.valor ?? null,
      ics: data.ics.find((p) => p.mes === mes)?.valor ?? null,
      icst: data.icst.find((p) => p.mes === mes)?.valor ?? null,
      icc: data.icc.find((p) => p.mes === mes)?.valor ?? null,
    }));
  if (dados.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
        <h3 className="text-base font-semibold text-amber-900">C1 — Confiança FGV-IBRE</h3>
        <p className="mt-2 text-xs text-amber-700">Pipeline rodou mas séries vazias (status: {data.freshness_status}).</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-zinc-900">Confiança FGV-IBRE — sondagens</h3>
        <p className="text-xs text-zinc-500">
          ICE (composto), ICI (indústria), ICOM (comércio), ICS (serviços), ICST (construção), ICC (consumidor). Linha 100
          = neutro.
        </p>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={dados} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
          <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
          <XAxis dataKey="mes" tick={{ fontSize: 10 }} interval={Math.max(1, Math.floor(dados.length / 12))} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip
            formatter={(v: unknown) => (typeof v === "number" ? v.toFixed(1) : String(v ?? ""))}
            labelFormatter={(l: unknown) => formatMes(String(l ?? ""))}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine y={100} stroke="#000" strokeDasharray="2 4" />
          <Line type="monotone" dataKey="ice" stroke="#132960" strokeWidth={2.5} dot={false} name="ICE" connectNulls />
          <Line type="monotone" dataKey="ici" stroke="#DC2626" strokeWidth={1.2} dot={false} name="ICI" connectNulls />
          <Line type="monotone" dataKey="icom" stroke="#F59E0B" strokeWidth={1.2} dot={false} name="ICOM" connectNulls />
          <Line type="monotone" dataKey="ics" stroke="#059669" strokeWidth={1.2} dot={false} name="ICS" connectNulls />
          <Line type="monotone" dataKey="icst" stroke="#7C3AED" strokeWidth={1.2} dot={false} name="ICST" connectNulls />
          <Line type="monotone" dataKey="icc" stroke="#2563EB" strokeWidth={1.2} dot={false} name="ICC" connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function CardCniPmi({ cni, pmi }: { cni: CniData | null; pmi: PmiData | null }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-900">CNI — ICEI + INEC</h3>
        {cni && cni.icei.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={cni.icei.map((p) => ({
                mes: p.mes,
                icei: p.valor,
                inec: cni.inec.find((q) => q.mes === p.mes)?.valor ?? null,
              }))}
            >
              <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
              <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(v: unknown) => (typeof v === "number" ? v.toFixed(1) : String(v ?? ""))}
                labelFormatter={(l: unknown) => formatMes(String(l ?? ""))}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={50} stroke="#000" strokeDasharray="2 4" />
              <Line type="monotone" dataKey="icei" stroke="#DC2626" dot={false} strokeWidth={1.5} name="ICEI" connectNulls />
              <Line type="monotone" dataKey="inec" stroke="#2563EB" dot={false} strokeWidth={1.5} name="INEC" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="mt-3 text-xs text-zinc-500">Aguardando pipeline CNI.</p>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-900">S&P Global PMI Brasil</h3>
        {pmi && pmi.serie.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={pmi.serie}>
              <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
              <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} domain={[35, 65]} />
              <Tooltip
                formatter={(v: unknown) => (typeof v === "number" ? v.toFixed(1) : String(v ?? ""))}
                labelFormatter={(l: unknown) => formatMes(String(l ?? ""))}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={50} stroke="#000" strokeDasharray="2 4" />
              <Line type="monotone" dataKey="manufatura" stroke="#DC2626" dot={false} strokeWidth={1.5} connectNulls name="Manuf." />
              <Line type="monotone" dataKey="servicos" stroke="#2563EB" dot={false} strokeWidth={1.5} connectNulls name="Serv." />
              <Line type="monotone" dataKey="composto" stroke="#000000" dot={false} strokeWidth={2} connectNulls name="Composto" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="mt-3 text-xs text-zinc-500">Aguardando PMI mensal (atualiza dia 1 e 3).</p>
        )}
      </div>
    </div>
  );
}

function CardFecomercio({ data }: { data: FecomercioData | null }) {
  if (!data || (data.icec.length === 0 && data.icf.length === 0)) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-center">
        <h3 className="text-base font-semibold text-zinc-500">C4 — Fecomercio SP (ICEC + ICF)</h3>
        <p className="mt-2 text-xs text-zinc-400">Aguardando pipeline.</p>
      </div>
    );
  }
  const todosMeses = new Set<string>();
  for (const arr of [data.icec, data.icf]) for (const p of arr) todosMeses.add(p.mes);
  const dados = Array.from(todosMeses)
    .sort()
    .map((mes) => ({
      mes,
      icec: data.icec.find((p) => p.mes === mes)?.valor ?? null,
      icf: data.icf.find((p) => p.mes === mes)?.valor ?? null,
    }));
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-zinc-900">Fecomercio SP — ICEC + ICF</h3>
      <p className="mt-1 text-xs text-zinc-500">
        ICEC (empresário do comércio) e ICF (intenção de consumo das famílias). Linha 100 = neutro.
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={dados}>
          <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
          <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip
            formatter={(v: unknown) => (typeof v === "number" ? v.toFixed(1) : String(v ?? ""))}
            labelFormatter={(l: unknown) => formatMes(String(l ?? ""))}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine y={100} stroke="#000" strokeDasharray="2 4" />
          <Line type="monotone" dataKey="icec" stroke="#F59E0B" dot={false} strokeWidth={1.5} name="ICEC" connectNulls />
          <Line type="monotone" dataKey="icf" stroke="#2563EB" dot={false} strokeWidth={1.5} name="ICF" connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BlocoCConfianca({
  fgvConfianca,
  cni,
  pmi,
  fecomercio,
}: {
  fgvConfianca: FgvConfiancaData | null;
  cni: CniData | null;
  pmi: PmiData | null;
  fecomercio: FecomercioData | null;
}) {
  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-xl font-bold text-[#132960]">Bloco C — Confiança</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Sondagens FGV-IBRE, CNI, S&amp;P PMI e Fecomercio SP. Quando os 4 concordam, sinal forte; quando divergem,
          incerteza.
        </p>
      </header>
      <CardFgvConfianca data={fgvConfianca} />
      <CardCniPmi cni={cni} pmi={pmi} />
      <CardFecomercio data={fecomercio} />
    </section>
  );
}
