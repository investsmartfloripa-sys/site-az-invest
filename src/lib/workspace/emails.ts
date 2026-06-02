import { Resend } from "resend";
import { getSiteUrl } from "@/lib/site-url";

function esc(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function resendClient() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

function fromAddress() {
  return process.env.EMAIL_FROM || "noreply@azinvest.com.br";
}

export async function sendWorkspaceEmail(input: {
  to: string;
  subject: string;
  html: string;
}) {
  const client = resendClient();
  if (!client) return { ok: false as const, reason: "no_resend" };

  await client.emails.send({
    from: fromAddress(),
    to: input.to,
    subject: input.subject,
    html: input.html,
  });

  return { ok: true as const };
}

export async function notifyAdminPendingReview(post: { title: string; authorName: string }) {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL;
  if (!adminEmail) return;

  const base = getSiteUrl();
  await sendWorkspaceEmail({
    to: adminEmail,
    subject: `[AZ] Novo texto para revisão: ${post.title}`,
    html: `<p>O autor <strong>${esc(post.authorName)}</strong> enviou o texto <strong>${esc(post.title)}</strong> para revisão.</p>
      <p><a href="${base}/area-restrita/revisao">Abrir fila de revisão</a></p>`,
  });
}

export async function notifyAuthorReviewResult(input: {
  to: string;
  title: string;
  approved: boolean;
  note?: string | null;
}) {
  const base = getSiteUrl();
  const status = input.approved ? "aprovado e publicado" : "devolvido para correção";
  await sendWorkspaceEmail({
    to: input.to,
    subject: `[AZ] Seu texto foi ${input.approved ? "aprovado" : "rejeitado"}: ${input.title}`,
    html: `<p>Seu texto <strong>${esc(input.title)}</strong> foi <strong>${status}</strong>.</p>
      ${input.note ? `<p><strong>Observação do editor:</strong> ${esc(input.note)}</p>` : ""}
      <p><a href="${base}/area-restrita/conteudo">Ver meus textos</a></p>`,
  });
}

export async function sendPasswordResetEmail(input: { to: string; token: string }) {
  const base = getSiteUrl();
  const url = `${base}/area-restrita/recuperar-senha?token=${encodeURIComponent(input.token)}`;
  await sendWorkspaceEmail({
    to: input.to,
    subject: "[AZ] Redefinir senha",
    html: `<p>Clique no link para definir uma nova senha (válido por 1 hora):</p>
      <p><a href="${url}">${url}</a></p>`,
  });
}

export async function sendInviteEmail(input: { to: string; token: string; name?: string | null }) {
  const base = getSiteUrl();
  const url = `${base}/area-restrita/ativar?token=${encodeURIComponent(input.token)}`;
  await sendWorkspaceEmail({
    to: input.to,
    subject: "[AZ] Convite para o workspace",
    html: `<p>Olá${input.name ? ` ${esc(input.name)}` : ""}, você foi convidado para o workspace editorial da AZ Invest.</p>
      <p><a href="${url}">Ativar conta e definir senha</a></p>`,
  });
}
