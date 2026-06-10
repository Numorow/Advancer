import { describe, it, expect } from "vitest";
import { isLinkActive, newShareToken, portalUrl } from "../links";

const NOW = "2026-06-10T12:00:00.000Z";

describe("newShareToken", () => {
  it("makes long, URL-safe, unique tokens", () => {
    const a = newShareToken();
    const b = newShareToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(a).not.toBe(b);
  });
});

describe("isLinkActive", () => {
  it("active when not revoked and not expired", () => {
    expect(isLinkActive({ revokedAt: null, expiresAt: null }, NOW)).toBe(true);
    expect(isLinkActive({ revokedAt: null, expiresAt: "2026-07-01T00:00:00.000Z" }, NOW)).toBe(true);
  });

  it("revoked links are dead regardless of expiry", () => {
    expect(isLinkActive({ revokedAt: "2026-06-01T00:00:00.000Z", expiresAt: null }, NOW)).toBe(false);
  });

  it("expired links are dead (boundary counts as expired)", () => {
    expect(isLinkActive({ revokedAt: null, expiresAt: "2026-06-01T00:00:00.000Z" }, NOW)).toBe(false);
    expect(isLinkActive({ revokedAt: null, expiresAt: NOW }, NOW)).toBe(false);
  });
});

describe("portalUrl", () => {
  it("joins origin and token, tolerating a trailing slash", () => {
    expect(portalUrl("https://advancer.events", "abc")).toBe("https://advancer.events/portal/abc");
    expect(portalUrl("https://advancer.events/", "abc")).toBe("https://advancer.events/portal/abc");
  });
});
