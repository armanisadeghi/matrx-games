// utils/supabase/middleware.ts — THIS APP'S auth-routing policy for the proxy.
//
// The Supabase session pass (client construction, the auth-cookie options, the
// legacy storage-key migration, the "nothing may run between
// createServerClient and getUser()" rule, migrated-session persistence,
// superseded-key clearing, the split-jar heal, no-store headers, and cookie
// carry-over onto redirects) all lives in @ai-matrx/data/next via
// `supabaseNext`. What remains here is what only THIS app can answer: where an
// authenticated user should land, and which routes require a session.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseNext } from "@/utils/supabase/authCookie";

/** Most of Matrx Games is guest-friendly; only these routes need a session. */
function routeRequiresAuthentication(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/history")
  );
}

export async function updateSession(request: NextRequest) {
  // The ENTIRE Supabase session pass, in one call. Every hazard it owns has
  // logged users out at random at least once; none of them belongs in an app.
  const session = await supabaseNext.middlewareSession({
    host: request.headers.get("host"),
    requestCookies: request.cookies,
    // See utils/supabase/server.ts — `request.cookies` cannot see a split jar.
    cookieHeader: request.headers.get("cookie"),
    createResponse: () => NextResponse.next({ request }),
    createRedirect: (url) => NextResponse.redirect(url),
  });
  const user = session.user;
  const pathname = request.nextUrl.pathname;

  // Redirect authenticated users away from login/signup.
  if (user && (pathname === "/login" || pathname === "/sign-up")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    // Through session.redirect: a bare NextResponse.redirect drops the
    // refreshed tokens this pass wrote and logs the user out next request.
    return session.redirect(url);
  }

  if (!user && routeRequiresAuthentication(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname + request.nextUrl.search);
    return session.redirect(url);
  }

  // IMPORTANT: return `session.response` — it carries every session cookie the
  // pass wrote. A fresh NextResponse here drops refreshed tokens on the floor.
  session.response.headers.set("x-pathname", pathname);

  return session.response;
}
