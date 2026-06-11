import { describe, expect, it } from "vitest";
import { mfaRedirect, type MfaPolicyInput } from "../mfa-policy";

function input(over: Partial<MfaPolicyInput>): MfaPolicyInput {
  return {
    path: "/",
    role: "event_manager",
    currentLevel: "aal1",
    nextLevel: "aal1",
    hasVerifiedTotp: false,
    ...over,
  };
}

describe("mfaRedirect", () => {
  it("lets a plain member through everywhere", () => {
    expect(mfaRedirect(input({}))).toBeNull();
    expect(mfaRedirect(input({ path: "/events/x/budget" }))).toBeNull();
    expect(mfaRedirect(input({ role: "viewer" }))).toBeNull();
  });

  it("sends an enrolled-but-unchallenged session to the challenge, any role", () => {
    expect(
      mfaRedirect(input({ currentLevel: "aal1", nextLevel: "aal2", hasVerifiedTotp: true })),
    ).toBe("/auth/mfa?next=%2F");
    expect(
      mfaRedirect(
        input({
          role: "viewer",
          path: "/events/abc",
          currentLevel: "aal1",
          nextLevel: "aal2",
          hasVerifiedTotp: true,
        }),
      ),
    ).toBe("/auth/mfa?next=%2Fevents%2Fabc");
  });

  it("lets an aal2 session through", () => {
    expect(
      mfaRedirect(
        input({ role: "owner", currentLevel: "aal2", nextLevel: "aal2", hasVerifiedTotp: true }),
      ),
    ).toBeNull();
  });

  it("forces factor-less owners/admins to the security page", () => {
    expect(mfaRedirect(input({ role: "owner" }))).toBe("/settings/security?enrol=required");
    expect(mfaRedirect(input({ role: "admin", path: "/events/x" }))).toBe(
      "/settings/security?enrol=required",
    );
  });

  it("does NOT force other roles to enrol", () => {
    for (const role of ["event_manager", "operations_manager", "accounts", "site_manager", "viewer", "none"]) {
      expect(mfaRedirect(input({ role }))).toBeNull();
    }
  });

  it("loop guard: /settings/security stays reachable for the factor-less admin", () => {
    expect(mfaRedirect(input({ role: "owner", path: "/settings/security" }))).toBeNull();
    expect(mfaRedirect(input({ role: "owner", path: "/settings/security?enrol=required" }))).toBeNull();
  });

  it("loop guard: /auth/* is always exempt (challenge, reset, signout)", () => {
    expect(
      mfaRedirect(
        input({ path: "/auth/mfa", currentLevel: "aal1", nextLevel: "aal2", hasVerifiedTotp: true }),
      ),
    ).toBeNull();
    expect(mfaRedirect(input({ role: "owner", path: "/auth/signout" }))).toBeNull();
    expect(
      mfaRedirect(
        input({ path: "/auth/reset", currentLevel: "aal1", nextLevel: "aal2", hasVerifiedTotp: true }),
      ),
    ).toBeNull();
  });

  it("challenge wins over enrol-nag when both would apply", () => {
    // (admin who enrolled, fresh aal1 session, hitting settings/security)
    expect(
      mfaRedirect(
        input({
          role: "admin",
          path: "/settings/security",
          currentLevel: "aal1",
          nextLevel: "aal2",
          hasVerifiedTotp: true,
        }),
      ),
    ).toBe("/auth/mfa?next=%2Fsettings%2Fsecurity");
  });
});
