/**
 * Org-invite email builder. Pure (no IO) so it's unit-testable; the caller
 * sends the result through lib/email/resend. Styling is inline monochrome to
 * match the Kyron theme — no remote images, text wordmark only.
 */

export interface InviteEmailInput {
  orgName: string;
  role: string;
  inviterName: string | null;
  loginUrl: string;
}

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  event_manager: "Event manager",
  operations_manager: "Operations manager",
  accounts: "Accounts",
  site_manager: "Site manager",
  viewer: "Viewer",
};

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildInviteEmail(input: InviteEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const roleLabel = ROLE_LABEL[input.role] ?? input.role;
  const inviter = input.inviterName?.trim() || null;
  const subject = `You've been invited to ${input.orgName} on Advancer`;

  const invitedBy = inviter ? `${inviter} has invited you` : "You've been invited";
  const text = [
    `${invitedBy} to join ${input.orgName} on Advancer as ${roleLabel}.`,
    "",
    `Create your account (or sign in) with this email address and you'll be added automatically:`,
    input.loginUrl,
    "",
    "Advancer — A Kyron System",
  ].join("\n");

  const orgHtml = escapeHtml(input.orgName);
  const inviterHtml = inviter ? escapeHtml(inviter) : null;
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111114;">
    <div style="max-width:520px;margin:0 auto;padding:32px 20px;">
      <div style="font-size:15px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:20px;">Advancer</div>
      <div style="background:#ffffff;border:1px solid #e4e4e7;border-radius:8px;padding:28px;">
        <h1 style="margin:0 0 12px;font-size:18px;font-weight:600;">Join ${orgHtml} on Advancer</h1>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3f3f46;">
          ${inviterHtml ? `${inviterHtml} has invited you` : "You&#39;ve been invited"} to join
          <strong>${orgHtml}</strong> as <strong>${escapeHtml(roleLabel)}</strong>.
        </p>
        <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#3f3f46;">
          Create your account (or sign in) using this email address and you&#39;ll be added to the workspace automatically.
        </p>
        <a href="${escapeHtml(input.loginUrl)}"
           style="display:inline-block;background:#111114;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 22px;border-radius:6px;">
          Open Advancer
        </a>
      </div>
      <p style="margin:20px 0 0;font-size:12px;color:#71717a;">Advancer — A Kyron System</p>
    </div>
  </body>
</html>`;

  return { subject, html, text };
}
