import { describe, expect, it } from "vitest";
import { buildInviteEmail, escapeHtml } from "../invite";

const base = {
  orgName: "Kyron Pty Ltd",
  role: "event_manager",
  inviterName: "Kyle Bailey",
  loginUrl: "https://advancer.events/login",
};

describe("buildInviteEmail", () => {
  it("includes org, friendly role label, inviter and login URL", () => {
    const { subject, html, text } = buildInviteEmail(base);
    expect(subject).toBe("You've been invited to Kyron Pty Ltd on Advancer");
    expect(html).toContain("Kyron Pty Ltd");
    expect(html).toContain("Event manager");
    expect(html).toContain("Kyle Bailey");
    expect(html).toContain("https://advancer.events/login");
    expect(text).toContain("Kyle Bailey has invited you");
    expect(text).toContain("https://advancer.events/login");
  });

  it("handles a missing inviter name", () => {
    const { html, text } = buildInviteEmail({ ...base, inviterName: null });
    expect(text).toContain("You've been invited to join");
    expect(html).not.toContain("null");
  });

  it("falls back to the raw role when unmapped", () => {
    const { html } = buildInviteEmail({ ...base, role: "custom_role" });
    expect(html).toContain("custom_role");
  });

  it("escapes HTML in interpolated names", () => {
    const { html } = buildInviteEmail({
      ...base,
      orgName: `<script>alert("x")</script>`,
      inviterName: `Bob & "Co" <b>`,
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Bob &amp; &quot;Co&quot; &lt;b&gt;");
  });
});

describe("escapeHtml", () => {
  it("escapes the five specials", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
});
