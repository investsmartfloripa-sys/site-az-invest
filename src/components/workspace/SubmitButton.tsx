"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";

type SubmitButtonProps = {
  children: React.ReactNode;
  /**
   * Quando o form tem vários botões de submit (salvar / enviar / publicar),
   * passe o mesmo server action usado no atributo `formAction` para que o
   * spinner apareça apenas no botão que disparou o envio. Em forms com um
   * único botão pode ser omitido.
   */
  formAction?: (formData: FormData) => void | Promise<void>;
  className?: string;
  disabled?: boolean;
  /** Disparado no clique, antes do submit (ex.: limpar dirty-state do editor). */
  onClick?: () => void;
};

/**
 * Botão de submit com estado de envio (useFormStatus): mostra spinner e
 * desabilita enquanto a server action roda. Use dentro de um <form action={...}>.
 */
export function SubmitButton({
  children,
  formAction,
  className = "",
  disabled = false,
  onClick,
}: SubmitButtonProps) {
  const { pending, action } = useFormStatus();
  const isThisPending = pending && (formAction ? action === formAction : true);

  return (
    <button
      type="submit"
      formAction={formAction}
      onClick={onClick}
      disabled={disabled || pending}
      aria-busy={isThisPending}
      className={`inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {isThisPending ? (
        <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" />
      ) : null}
      {children}
    </button>
  );
}
