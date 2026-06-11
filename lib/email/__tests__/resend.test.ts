import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendEmail, EMAIL_FROM } from "../resend";

const msg = { to: "person@example.com", subject: "Hi", html: "<p>Hi</p>", text: "Hi" };

describe("sendEmail", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("no-ops with skipped=true when RESEND_API_KEY is missing", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await sendEmail(msg);
    expect(res).toEqual({ ok: true, skipped: true });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
  });

  it("POSTs the expected Resend payload", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_123");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));
    const res = await sendEmail(msg);
    expect(res).toEqual({ ok: true });
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer re_test_123" });
    expect(JSON.parse(String(init?.body))).toEqual({
      from: EMAIL_FROM,
      to: ["person@example.com"],
      subject: "Hi",
      html: "<p>Hi</p>",
      text: "Hi",
    });
  });

  it("returns ok=false (never throws) on API error", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_123");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 422 }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await sendEmail(msg);
    expect(res.ok).toBe(false);
    expect(res.error).toContain("422");
    expect(warn).toHaveBeenCalled();
  });

  it("returns ok=false on network failure", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_123");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await sendEmail(msg);
    expect(res).toEqual({ ok: false, error: "offline" });
  });
});
