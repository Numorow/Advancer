import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES: EmailOtpType[] = ["signup", "recovery", "invite", "email_change", "email"];

/** Only ever redirect within the app — guards open-redirect via ?next=. */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

/**
 * Lands Supabase auth email links (signup confirmation, password recovery).
 * Supports both link shapes so it works before AND after the email templates
 * are customised: `?token_hash=…&type=…` (recommended template) and `?code=…`
 * (default ConfirmationURL / PKCE).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  const supabase = await createClient();
  let ok = false;

  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  const dest = request.nextUrl.clone();
  dest.search = "";
  if (ok) {
    dest.pathname = next;
  } else {
    dest.pathname = "/login";
    dest.searchParams.set("error", "link_expired");
  }
  return NextResponse.redirect(dest);
}
