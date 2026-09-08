// utils/supabase/authCookie.ts — the ONE binding of @ai-matrx/data/next to
// THIS app's identity. Everything below is a VALUE: our Supabase project, our
// apex domain, our cookie names. Every hard part — cookie option construction,
// the browser singleton, the SSR/browser split, the swallowed Server-Component
// cookie write, the legacy storage-key migration, the split-jar heal, the
// "nothing may run between createServerClient and getUser()" rule, and the
// whole middleware session pass — lives in the package, where every other
// Matrx Next.js app inherits it. Full WHY lives in the package module headers
// and `aidream/apps/shared/data/README.md` § `@ai-matrx/data/next`.
//
// 🚨 Matrx Games runs its OWN Supabase project (eddtfkgtwbyhqdgmmofi), a
// DIFFERENT auth authority from Matrx Main. That is why the cookie NAME is
// games-specific instead of the package default `sb-matrx-auth`: two
// authorities must never share one storage key, or a session issued by one
// project is handed to the other and every read answers anonymous.

import { createNextSupabase } from "@ai-matrx/data/next";
import type { Database } from "@/types/database.types";

/**
 * The storage key @supabase/ssr used by default before this app adopted the
 * package (`sb-<project-ref>-auth-token`). Naming it here migrates a live
 * session onto the new key once, absent-only, instead of logging every signed-
 * in browser out; the package then clears the superseded key at the scope this
 * host issued it on.
 */
export const LEGACY_AUTH_COOKIE_NAME = "sb-eddtfkgtwbyhqdgmmofi-auth-token";

// The generic is not decoration: it is what makes every door in this app
// schema-typed at once. Regenerate with `pnpm types` after any schema change.
export const supabaseNext = createNextSupabase<Database>({
  // STATIC member accesses — Next only inlines NEXT_PUBLIC_* into client
  // bundles for those; a dynamic lookup is undefined in every browser bundle.
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  // The apex one Matrx login may span. This app is served today only from
  // localhost and *.vercel.app, where the package deliberately issues a
  // HOST-ONLY cookie (a browser silently rejects a Set-Cookie whose Domain
  // does not cover the current host) — so this value changes nothing until
  // Games is served from an aimatrx.com host.
  apexDomain: "aimatrx.com",
  cookieName: "sb-matrx-games-auth",
  legacyCookieName: LEGACY_AUTH_COOKIE_NAME,
});

export const AUTH_COOKIE_NAME = supabaseNext.cookieName;
