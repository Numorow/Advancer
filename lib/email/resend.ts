/**
 * Server-only email transport via the Resend HTTP API. Email is best-effort
 * everywhere in the app: this module never throws, and without RESEND_API_KEY
 * (local dev) it no-ops with a console warning so flows stay testable.
 */

export const EMAIL_FROM = "Advancer <no-reply@advancer.events>";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY not set — skipping send to ${msg.to} (“${msg.subject}”)`);
    return { ok: true, skipped: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        ...(msg.text ? { text: msg.text } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`[email] Resend ${res.status} sending to ${msg.to}: ${body.slice(0, 300)}`);
      return { ok: false, error: `Resend responded ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    console.warn(`[email] send to ${msg.to} failed:`, err);
    return { ok: false, error: err instanceof Error ? err.message : "send failed" };
  }
}
