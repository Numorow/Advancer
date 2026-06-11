import { describe, it, expect } from "vitest";
import { buildContentSecurityPolicy } from "../csp";
import { THEME_BOOT_HASH } from "../theme-boot";

const SUPABASE = "https://lzjxkfonvdsxkfzfmvph.supabase.co";

function directives(csp: string): Record<string, string> {
  return Object.fromEntries(
    csp.split(";").map((d) => {
      const [name, ...rest] = d.trim().split(" ");
      return [name, rest.join(" ")];
    }),
  );
}

describe("buildContentSecurityPolicy", () => {
  it("embeds the per-request nonce in script-src", () => {
    const csp = buildContentSecurityPolicy({ nonce: "abc123", supabaseUrl: SUPABASE, dev: false });
    expect(directives(csp)["script-src"]).toContain("'nonce-abc123'");
    expect(directives(csp)["script-src"]).toContain("'strict-dynamic'");
  });

  it("authorises the inline theme-boot script by hash", () => {
    const csp = buildContentSecurityPolicy({ nonce: "n", supabaseUrl: SUPABASE, dev: false });
    expect(directives(csp)["script-src"]).toContain(`'${THEME_BOOT_HASH}'`);
  });

  it("allows the supabase origin for REST/storage and its wss origin for realtime", () => {
    const d = directives(buildContentSecurityPolicy({ nonce: "n", supabaseUrl: SUPABASE, dev: false }));
    expect(d["connect-src"]).toContain(SUPABASE);
    expect(d["connect-src"]).toContain("wss://lzjxkfonvdsxkfzfmvph.supabase.co");
    expect(d["img-src"]).toContain(SUPABASE);
  });

  it("permits data: images for TOTP QR codes", () => {
    const d = directives(buildContentSecurityPolicy({ nonce: "n", supabaseUrl: SUPABASE, dev: false }));
    expect(d["img-src"]).toContain("data:");
  });

  it("locks down framing, base-uri, forms and objects", () => {
    const d = directives(buildContentSecurityPolicy({ nonce: "n", supabaseUrl: SUPABASE, dev: false }));
    expect(d["frame-ancestors"]).toBe("'none'");
    expect(d["object-src"]).toBe("'none'");
    expect(d["base-uri"]).toBe("'self'");
    expect(d["form-action"]).toBe("'self'");
  });

  it("only relaxes for HMR in dev — no unsafe-eval or ws: in production", () => {
    const prod = directives(buildContentSecurityPolicy({ nonce: "n", supabaseUrl: SUPABASE, dev: false }));
    expect(prod["script-src"]).not.toContain("'unsafe-eval'");
    expect(prod["connect-src"]).not.toContain("ws:");

    const dev = directives(buildContentSecurityPolicy({ nonce: "n", supabaseUrl: SUPABASE, dev: true }));
    expect(dev["script-src"]).toContain("'unsafe-eval'");
    expect(dev["connect-src"]).toContain("ws:");
  });

  it("never emits 'unsafe-inline' for scripts", () => {
    const csp = buildContentSecurityPolicy({ nonce: "n", supabaseUrl: SUPABASE, dev: true });
    expect(directives(csp)["script-src"]).not.toContain("'unsafe-inline'");
  });
});
