"use client";

import { useState } from "react";

import { saveFiiLead } from "./fii-lead-action";

const COMMUNITY_LABEL = "Entrar na comunidade AZ Invest no WhatsApp";

export function FiiComunidadeCta() {
  const whatsappUrl = process.env.NEXT_PUBLIC_WHATSAPP_COMMUNITY_URL?.trim() || "";
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await saveFiiLead(formData);
      if (res.ok) {
        setDone(true);
      } else {
        setError(res.error || "Não foi possível registrar agora. Tente novamente em instantes.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      aria-label="Comunidade FII e inscrição"
      className="rounded-2xl border border-[#132960]/15 bg-gradient-to-br from-[#0e1f49] to-[#132960] p-4 text-white shadow-sm md:p-6"
    >
      <div className="grid gap-6 md:grid-cols-2">
        {/* CTA Comunidade — esquerda */}
        <div className="flex flex-col justify-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70">
            Comunidade AZ Invest
          </p>
          <h3 className="mt-2 text-xl font-bold leading-tight md:text-2xl">
            Quer saber tudo sobre FIIs?
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-white/85">
            Entre na nossa comunidade no WhatsApp e receba{" "}
            <strong className="font-semibold text-white">
              alertas, análises e materiais selecionados sobre FIIs
            </strong>{" "}
            direto no seu celular.
          </p>
          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={COMMUNITY_LABEL}
              className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-[#F26B2C] px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#dd5c1f] active:bg-[#cf5318] md:w-auto"
            >
              Entrar na comunidade →
            </a>
          ) : (
            <span
              aria-disabled="true"
              className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-white/15 px-6 py-3 text-sm font-semibold text-white/85 md:w-auto"
            >
              Link em breve
            </span>
          )}
        </div>

        {/* Form inscrição — direita */}
        <div className="rounded-xl bg-white p-4 text-[#132960] md:p-5">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-[#027DFC]">
            Inscreva-se
          </h4>
          <p className="mt-1 text-xs text-zinc-500">
            Receba conteúdo exclusivo sobre FIIs no seu e-mail.
          </p>
          {done ? (
            <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
              ✓ Inscrição registrada. Em breve você recebe nosso conteúdo.
            </div>
          ) : (
            <form action={handleSubmit} className="mt-3 grid gap-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  required
                  name="name"
                  type="text"
                  placeholder="Nome"
                  className="rounded-md border border-zinc-200 px-3 py-2 text-xs text-[#132960] placeholder:text-zinc-400 focus:border-[#027DFC] focus:outline-none"
                />
                <input
                  required
                  name="email"
                  type="email"
                  placeholder="E-mail"
                  className="rounded-md border border-zinc-200 px-3 py-2 text-xs text-[#132960] placeholder:text-zinc-400 focus:border-[#027DFC] focus:outline-none"
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  name="aporteMensal"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="Aporte mensal (R$)"
                  className="rounded-md border border-zinc-200 px-3 py-2 text-xs text-[#132960] placeholder:text-zinc-400 focus:border-[#027DFC] focus:outline-none"
                />
                <input
                  name="patrimonio"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="Patrimônio investido (R$)"
                  className="rounded-md border border-zinc-200 px-3 py-2 text-xs text-[#132960] placeholder:text-zinc-400 focus:border-[#027DFC] focus:outline-none"
                />
              </div>
              {error ? (
                <p className="text-[11px] font-semibold text-red-600">{error}</p>
              ) : null}
              <button
                type="submit"
                disabled={submitting}
                className="mt-1 inline-flex items-center justify-center rounded-md bg-[#F26B2C] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#dd5c1f] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Enviando…" : "Quero receber"}
              </button>
              <p className="text-[10px] text-zinc-400">
                Ao inscrever-se, você concorda em receber comunicações da AZ Invest. Pode cancelar
                quando quiser.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
