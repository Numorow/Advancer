import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { buildContentSecurityPolicy } from "@/lib/security/csp";

const PUBLIC_PATHS = ["/login", "/auth", "/portal"];

export async function proxy(request: NextRequest) {
  // Per-request CSP nonce. Next.js reads it from the request's CSP header and
  // stamps it onto the scripts it injects; the dark-mode boot script reads it
  // back via headers() → x-nonce. See lib/security/csp.ts.
  const nonce = btoa(crypto.randomUUID());
  const csp = buildContentSecurityPolicy({
    nonce,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    dev: process.env.NODE_ENV === "development",
  });

  // Expose the path to server components/actions — requireContext reads it to
  // run the MFA policy without redirect loops. In-place header mutation is the
  // same mechanism the cookie bridge below relies on.
  request.headers.set("x-pathname", request.nextUrl.pathname);
  request.headers.set("x-nonce", nonce);
  request.headers.set("content-security-policy", csp);
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getClaims verifies the JWT locally (cached JWKS) once the project uses
  // asymmetric signing keys — no auth-server round trip per request. With
  // legacy symmetric keys it transparently falls back to a network check.
  // Server components remain the source of truth via auth.getUser().
  const { data, error } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    const redirect = NextResponse.redirect(url);
    if (error) clearStaleAuthCookies(request, redirect);
    return redirect;
  }

  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // A dead session cookie (expired access token, missing refresh token) makes
  // supabase-js retry a refresh and log "Invalid Refresh Token" on every
  // request. Drop it here so the browser stops re-sending it.
  if (error && !user) clearStaleAuthCookies(request, response);

  // Enforce the CSP on the rendered document. (Redirects above carry no body,
  // so they need none — their target gets its own policy on the next pass.)
  response.headers.set("content-security-policy", csp);
  return response;
}

/**
 * Supabase keeps the session in sb-<ref>-auth-token cookies (chunked .0/.1 when
 * large). A stale one can't be refreshed and makes every getClaims() emit an
 * "Invalid Refresh Token" error — delete them so the noise stops after one hit.
 */
function clearStaleAuthCookies(request: NextRequest, response: NextResponse) {
  for (const { name } of request.cookies.getAll()) {
    if (name.startsWith("sb-") && name.includes("-auth-token")) {
      response.cookies.delete(name);
    }
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
