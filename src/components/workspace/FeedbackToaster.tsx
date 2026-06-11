"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { PASSWORD_MIN_LENGTH } from "@/lib/workspace/password-policy";

/**
 * Mensagens dos códigos usados no padrão atual de redirect-com-query das
 * server actions (?error=..., ?ok=1, ?submitted=1). Cobre o feedback via
 * toast sem refatorar as actions agora.
 */
const ERROR_MESSAGES: Record<string, { title: string; description?: string }> = {
  password: {
    title: "Senha rejeitada",
    description: `Use pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  },
  invalid: {
    title: "Não foi possível salvar",
    description: "Confira o título e a categoria do texto.",
  },
  author: {
    title: "Autor inválido",
    description: "Selecione um autor válido para o texto.",
  },
  published: {
    title: "Post publicado",
    description: "Peça à equipe editorial para abrir uma revisão.",
  },
  legacy: {
    title: "Salvamento bloqueado",
    description:
      "Este post legado precisa de migração: cole o conteúdo completo no editor antes de salvar, para não perder texto.",
  },
  no_author: {
    title: "Conta sem perfil de autor",
    description: "Peça ao admin para vincular seu perfil em Usuários.",
  },
  need_author: {
    title: "Nenhum autor cadastrado",
    description: "Cadastre um autor antes de criar um texto.",
  },
};

const GENERIC_ERROR = {
  title: "Algo deu errado",
  description: "Tente novamente em instantes.",
};

/**
 * Lê ?error= / ?ok= / ?submitted= da URL, dispara o toast correspondente e
 * limpa os parâmetros (para o toast não repetir em refresh/navegação).
 * Montado uma única vez no layout do workspace, dentro de <Suspense>.
 */
export function FeedbackToaster() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const lastFired = useRef<string | null>(null);

  const error = searchParams.get("error");
  const ok = searchParams.get("ok");
  const submitted = searchParams.get("submitted");

  useEffect(() => {
    if (!error && !ok && !submitted) return;

    // Evita toast duplicado no mesmo ciclo (StrictMode / re-render).
    const signature = `${pathname}?error=${error}&ok=${ok}&submitted=${submitted}`;
    if (lastFired.current !== signature) {
      lastFired.current = signature;

      if (error) {
        const message = ERROR_MESSAGES[error] ?? GENERIC_ERROR;
        toast.error(message.title, { description: message.description });
      }
      if (ok) {
        toast.success("Salvo com sucesso");
      }
      if (submitted) {
        toast.success("Texto enviado para revisão", {
          description: "O admin será notificado por e-mail.",
        });
      }
    }

    // Remove apenas os parâmetros de feedback, preservando o restante da URL.
    const next = new URLSearchParams(searchParams.toString());
    next.delete("error");
    next.delete("ok");
    next.delete("submitted");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [error, ok, submitted, pathname, router, searchParams]);

  return null;
}
