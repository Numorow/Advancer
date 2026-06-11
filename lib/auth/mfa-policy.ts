import { isAdminRole } from "@/lib/org/members";

/**
 * MFA enforcement policy (M20): owners/admins must have a verified TOTP
 * factor; anyone who has enrolled must complete the challenge each session.
 * Pure so the redirect matrix — especially the loop-guard exemptions — is
 * unit-testable.
 */

export type Aal = "aal1" | "aal2" | null;

export interface MfaPolicyInput {
  /** Current request path (from the x-pathname header set in proxy.ts). */
  path: string;
  role: string;
  currentLevel: Aal;
  nextLevel: Aal;
  hasVerifiedTotp: boolean;
}

/**
 * Where to send the user, or null to let the request through.
 *
 * Exemptions are the redirect-loop guard: /auth/* hosts the challenge page,
 * reset flow and sign-out (all must be reachable at aal1), and
 * /settings/security is where a factor-less admin is sent to enrol.
 */
export function mfaRedirect(input: MfaPolicyInput): string | null {
  if (input.path.startsWith("/auth")) return null;

  // Enrolled (any role): the session must be stepped up to aal2.
  if (input.currentLevel === "aal1" && input.nextLevel === "aal2") {
    return `/auth/mfa?next=${encodeURIComponent(input.path)}`;
  }

  // Admins/owners must enrol; the security page itself stays reachable.
  if (
    isAdminRole(input.role) &&
    !input.hasVerifiedTotp &&
    !input.path.startsWith("/settings/security")
  ) {
    return "/settings/security?enrol=required";
  }

  return null;
}
