import { Resend } from "resend";

export type AuthorLeadEmailInput = {
  author: {
    id: number;
    name: string;
    email: string | null;
    slug: string;
  };
  lead: {
    name: string;
    email: string;
    phone?: string | null;
    message: string;
  };
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHtml({ author, lead }: AuthorLeadEmailInput) {
  const safe = {
    authorName: escapeHtml(author.name),
    name: escapeHtml(lead.name),
    email: escapeHtml(lead.email),
    phone: escapeHtml(lead.phone || ""),
    message: escapeHtml(lead.message).replace(/\n/g, "<br />"),
  };

  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #132960; max-width: 560px; margin: 0 auto; padding: 24px;">
    <div style="background: linear-gradient(135deg, #132960, #027DFC); color: #fff; padding: 20px 24px; border-radius: 12px 12px 0 0;">
      <h2 style="margin:0; font-size: 20px;">Novo contato pelo site - AZ Invest</h2>
      <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.85;">Para: ${safe.authorName}</p>
    </div>
    <div style="border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 20px 24px; background: #fff;">
      <p style="margin: 0 0 12px; font-size: 14px;"><strong>Nome:</strong> ${safe.name}</p>
      <p style="margin: 0 0 12px; font-size: 14px;"><strong>E-mail:</strong> <a href="mailto:${safe.email}" style="color:#027DFC;">${safe.email}</a></p>
      ${safe.phone ? `<p style="margin: 0 0 12px; font-size: 14px;"><strong>Telefone:</strong> ${safe.phone}</p>` : ""}
      <p style="margin: 16px 0 6px; font-size: 14px;"><strong>Mensagem:</strong></p>
      <div style="padding: 12px 14px; background:#f8fafc; border:1px solid #e5e7eb; border-radius: 8px; font-size: 14px; line-height: 1.5; color:#0f172a;">${safe.message}</div>
      <p style="margin-top: 18px; font-size: 12px; color:#475569;">
        Voce pode responder direto neste e-mail que ira para ${safe.email}.
      </p>
    </div>
    <p style="margin-top: 14px; font-size: 11px; color:#94a3b8; text-align:center;">
      Enviado automaticamente pelo site Investimentos de A a Z.
    </p>
  </div>
  `;
}

export async function sendAuthorLeadEmail(
  input: AuthorLeadEmailInput,
): Promise<"SENT" | "FAILED" | "SKIPPED"> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) return "SKIPPED";
  if (!input.author.email) return "SKIPPED";

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: [input.author.email],
      replyTo: input.lead.email,
      subject: `Novo contato pelo site - ${input.lead.name}`,
      html: buildHtml(input),
    });
    if (error) {
      console.error("[email] resend error", error);
      return "FAILED";
    }
    return "SENT";
  } catch (err) {
    console.error("[email] unexpected error", err);
    return "FAILED";
  }
}
