"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle, TriangleAlert } from "lucide-react";

type ConfirmDialogProps = {
  /** Título curto da ação, ex.: "Excluir texto". */
  title: string;
  /** Descrição do impacto da ação (o que acontece e se é reversível). */
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Texto do botão que abre o diálogo. */
  triggerLabel: string;
  triggerClassName?: string;
  disabled?: boolean;
  /**
   * Server action disparada na confirmação. Quando omitida, o submit usa o
   * `action` do <form> pai (o componente PRECISA estar dentro do form que
   * carrega os inputs hidden da exclusão).
   */
  formAction?: (formData: FormData) => void | Promise<void>;
};

function ConfirmButton({
  label,
  formAction,
  onSettled,
}: {
  label: string;
  formAction?: (formData: FormData) => void | Promise<void>;
  onSettled: () => void;
}) {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);

  // Fecha o diálogo quando a action termina sem navegar (ex.: validação
  // barrou no servidor e a página não mudou).
  useEffect(() => {
    if (wasPending.current && !pending) onSettled();
    wasPending.current = pending;
  }, [pending, onSettled]);

  return (
    <button
      type="submit"
      formAction={formAction}
      disabled={pending}
      aria-busy={pending}
      className="inline-flex items-center justify-center gap-2 rounded-md bg-[#9C2B24] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#82231d] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" /> : null}
      {label}
    </button>
  );
}

/**
 * Confirmação de ação destrutiva com <dialog> nativo (sem dependência nova).
 * Deve ser renderizado DENTRO do <form> da exclusão: o botão de confirmar é um
 * submit do form pai (ou da `formAction` passada).
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Excluir",
  cancelLabel = "Cancelar",
  triggerLabel,
  triggerClassName = "",
  disabled = false,
  formAction,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  function open() {
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        disabled={disabled}
        className={triggerClassName}
      >
        {triggerLabel}
      </button>

      <dialog
        ref={dialogRef}
        onClick={(e) => {
          // Clique no backdrop (o próprio <dialog>) fecha; Esc já é nativo.
          if (e.target === dialogRef.current) close();
        }}
        className="m-auto w-[calc(100vw-2rem)] max-w-md rounded-2xl border border-[#132960]/10 bg-white p-0 text-[#132960] shadow-2xl backdrop:bg-[#132960]/50 backdrop:backdrop-blur-[2px]"
      >
        <div className="p-6">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#9C2B24]/10">
              <TriangleAlert aria-hidden className="h-5 w-5 text-[#9C2B24]" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-[#132960]">{title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-[#132960]/70">
                {description}
              </p>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={close}
              className="rounded-md border border-[#132960]/20 px-4 py-2 text-sm font-medium text-[#132960]/75 transition hover:bg-[#132960]/5"
            >
              {cancelLabel}
            </button>
            <ConfirmButton label={confirmLabel} formAction={formAction} onSettled={close} />
          </div>
        </div>
      </dialog>
    </>
  );
}
