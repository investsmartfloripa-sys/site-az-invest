"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { CornerDownRight, ExternalLink, MessageSquarePlus } from "lucide-react";
import { SubmitButton } from "@/components/workspace/SubmitButton";
import { ConfirmDialog } from "@/components/workspace/ConfirmDialog";
import {
  deleteCommentAction,
  replyToCommentAction,
} from "@/lib/workspace/comment-actions";

export type CommentReplyDTO = {
  id: number;
  name: string;
  content: string;
  createdAt: string;
  authorReply: boolean;
};

export type CommentDTO = {
  id: number;
  name: string;
  content: string;
  createdAt: string;
  post: { id: number; title: string; slug: string };
  replies: CommentReplyDTO[];
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function WorkspaceComments({ comments }: { comments: CommentDTO[] }) {
  if (comments.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-[#132960]/10 bg-white p-8 text-center">
        <p className="text-sm text-[#132960]/60">
          Ainda não há comentários nos seus textos.
        </p>
      </div>
    );
  }

  return (
    <ul className="mt-6 space-y-4">
      {comments.map((c) => (
        <CommentCard key={c.id} comment={c} />
      ))}
    </ul>
  );
}

function CommentCard({ comment }: { comment: CommentDTO }) {
  const [replyOpen, setReplyOpen] = useState(false);
  const answered = comment.replies.length > 0;

  return (
    <li className="rounded-2xl border border-[#132960]/10 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#132960]">{comment.name}</p>
          <p className="mt-0.5 text-xs text-[#132960]/50">
            {fmtDate(comment.createdAt)} ·{" "}
            <Link
              href={`/blog/${comment.post.slug}#comentarios`}
              target="_blank"
              className="inline-flex items-center gap-1 text-[#027DFC] hover:underline"
            >
              {comment.post.title}
              <ExternalLink aria-hidden className="h-3 w-3" />
            </Link>
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            answered
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-700"
          }`}
        >
          {answered ? "Respondido" : "Sem resposta"}
        </span>
      </div>

      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[#132960]/85">
        {comment.content}
      </p>

      {comment.replies.length > 0 ? (
        <ul className="mt-3 space-y-2 border-l-2 border-[#027DFC]/25 pl-3">
          {comment.replies.map((r) => (
            <li key={r.id}>
              <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-[#027DFC]">
                <CornerDownRight aria-hidden className="h-3.5 w-3.5" />
                {r.name}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    r.authorReply
                      ? "bg-[#166B47]/10 text-[#166B47]"
                      : "bg-[#027DFC]/10 text-[#027DFC]"
                  }`}
                >
                  {r.authorReply ? "Autor" : "AZ Invest"}
                </span>
                <span className="font-normal text-[#132960]/45">{fmtDate(r.createdAt)}</span>
              </p>
              <p className="mt-0.5 whitespace-pre-line text-sm leading-relaxed text-[#132960]/80">
                {r.content}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        {!replyOpen ? (
          <button
            type="button"
            onClick={() => setReplyOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#027DFC]/10 px-3 py-1.5 text-xs font-semibold text-[#027DFC] transition hover:bg-[#027DFC]/15"
          >
            <MessageSquarePlus aria-hidden className="h-3.5 w-3.5" />
            {answered ? "Responder novamente" : "Responder"}
          </button>
        ) : null}

        <form action={deleteCommentAction}>
          <input type="hidden" name="commentId" value={comment.id} />
          <ConfirmDialog
            title="Excluir comentário"
            description="O comentário (e qualquer resposta) será removido do blog em definitivo. Esta ação não pode ser desfeita."
            confirmLabel="Excluir"
            triggerLabel="Excluir"
            triggerClassName="rounded-md border border-[#9C2B24]/30 px-3 py-1.5 text-xs font-medium text-[#9C2B24] transition hover:bg-[#9C2B24]/10"
          />
        </form>
      </div>

      {replyOpen ? (
        <form action={replyToCommentAction} className="mt-3 space-y-2">
          <input type="hidden" name="commentId" value={comment.id} />
          <textarea
            name="content"
            required
            minLength={2}
            maxLength={2000}
            rows={3}
            autoFocus
            placeholder="Escreva a resposta da AZ Invest…"
            className="w-full rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-sm text-[#132960] outline-none focus:border-[#027DFC]"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setReplyOpen(false)}
              className="rounded-md border border-[#132960]/20 px-3 py-1.5 text-xs font-medium text-[#132960]/75 transition hover:bg-[#132960]/5"
            >
              Cancelar
            </button>
            <SubmitButton
              formAction={replyToCommentAction}
              className="rounded-md bg-[#027DFC] px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-[#0268d4]"
            >
              Enviar resposta
            </SubmitButton>
            <ReplyCloser onSettled={() => setReplyOpen(false)} />
          </div>
        </form>
      ) : null}
    </li>
  );
}

/**
 * Fecha o formulário de resposta quando a server action termina (pending→done),
 * mesmo sem navegação — a revalidação atualiza a lista com a nova resposta.
 */
function ReplyCloser({ onSettled }: { onSettled: () => void }) {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending) onSettled();
    wasPending.current = pending;
  }, [pending, onSettled]);
  return null;
}
