"use client";

import { useEffect, useRef } from "react";

type EditorDialogProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

/**
 * Modal genérico do editor com <dialog> nativo (mesmo padrão do ConfirmDialog,
 * sem dependência nova): Esc fecha, clique no backdrop fecha, foco vai para o
 * conteúdo ao abrir. Usado pelos diálogos de Link e Imagem.
 */
export function EditorDialog({ open, title, onClose, children }: EditorDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Abre/fecha o <dialog> nativo conforme a prop `open`.
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      // Foca o primeiro campo para acessibilidade de teclado.
      const focusable = el.querySelector<HTMLElement>(
        "input, textarea, select, button",
      );
      focusable?.focus();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={(e) => {
        // Esc dispara `cancel`; deixamos o onClose padronizar o estado React.
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      aria-label={title}
      className="m-auto w-[calc(100vw-2rem)] max-w-md rounded-2xl border border-[#132960]/10 bg-white p-0 text-[#132960] shadow-2xl backdrop:bg-[#132960]/50 backdrop:backdrop-blur-[2px]"
    >
      <div className="p-6">
        <h2 className="text-base font-semibold text-[#132960]">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </dialog>
  );
}
