"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
 *
 * IMPORTANTE: renderizado via portal no <body>. O editor vive dentro do
 * <form action={savePostDraftAction}> do post; como o diálogo tem seu próprio
 * <form> (URL/ALT + botão submit), deixá-lo na árvore do form do post criaria
 * <form> aninhado — HTML inválido. O navegador descarta o form interno e o botão
 * "Inserir imagem"/"Aplicar link" passa a submeter o form do post (salvar
 * rascunho) em vez de rodar o onSubmit do diálogo. O portal tira o <dialog> de
 * dentro do form, restaurando a inserção de imagem/link no meio do texto.
 */
export function EditorDialog({ open, title, onClose, children }: EditorDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Portal só existe no cliente (document indisponível no SSR).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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
  }, [open, mounted]);

  if (!mounted) return null;

  return createPortal(
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
    </dialog>,
    document.body,
  );
}
