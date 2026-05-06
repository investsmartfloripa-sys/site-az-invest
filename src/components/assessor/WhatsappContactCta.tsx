"use client";

import { useState, useTransition } from "react";

type Props = {
  authorId: number;
  authorName: string;
  whatsappUrl: string;
  registerClickAction: (authorId: number, name: string) => Promise<string>;
  variant?: "primary" | "secondary";
  className?: string;
};

export function WhatsappContactCta({
  authorId,
  authorName,
  whatsappUrl,
  registerClickAction,
  variant = "primary",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const firstName = authorName.split(" ")[0];

  function handleOpen() {
    setOpen(true);
  }

  function handleClose() {
    if (pending) return;
    setOpen(false);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    startTransition(async () => {
      try {
        const url = await registerClickAction(authorId, trimmed);
        window.open(url || whatsappUrl, "_blank", "noopener,noreferrer");
      } catch {
        window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      } finally {
        setOpen(false);
        setName("");
      }
    });
  }

  const baseClass =
    variant === "primary"
      ? "inline-flex items-center justify-center gap-2 rounded-full bg-[#22c55e] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-[#16a34a]"
      : "inline-flex items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15";

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={[baseClass, className].filter(Boolean).join(" ")}
      >
        Falar com {firstName} no WhatsApp
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6"
          onClick={handleClose}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <h3 className="text-xl font-semibold text-[#132960]">
              Como voce se chama?
            </h3>
            <p className="mt-1 text-sm text-zinc-600">
              Vamos avisar {firstName} que voce esta entrando em contato.
            </p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Seu nome"
                className="h-11 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#027DFC] focus:ring-2 focus:ring-[#027DFC]/20"
                disabled={pending}
                required
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={pending}
                  className="h-11 rounded-md border border-zinc-300 px-4 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pending || !name.trim()}
                  className="h-11 rounded-md bg-[#22c55e] px-5 text-sm font-semibold text-white shadow transition hover:bg-[#16a34a] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pending ? "Abrindo..." : "Continuar para o WhatsApp"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
