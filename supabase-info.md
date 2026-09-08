# Supabase client setup

🚨 **Do not hand-write `createBrowserClient` / `createServerClient` / the cookie-refresh
middleware.** This file used to be the raw Supabase dashboard scaffold (install
`@supabase/supabase-js`, hand-copy `utils/supabase/{client,server,middleware}.ts` with
the cookie `getAll`/`setAll` dance duplicated three times) — that is exactly the twin
`@ai-matrx/data/next` now owns for every Matrx Next.js app: ONE factory
(`createNextSupabase`) for all five places a Next app needs a Supabase client (browser,
Server Component, Route Handler, proxy/middleware, OAuth callback), so the auth-cookie
options can never drift between them. Full API + the "why five places, one factory"
rationale: `aidream/apps/shared/data/README.md` § `@ai-matrx/data/next`.

```ts
// utils/supabase/authCookie.ts — the ONE module in this app that wires it.
import { createNextSupabase } from "@ai-matrx/data/next";
import type { Database } from "@/types/database.types";

export const supabaseNext = createNextSupabase<Database>({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  apexDomain: "aimatrx.com",
  // 🚨 Games runs its OWN Supabase project — a DIFFERENT auth authority from
  // Matrx Main — so it must NOT share Matrx Main's `sb-matrx-auth` key.
  cookieName: "sb-matrx-games-auth",
  // The @supabase/ssr default key this app used before adopting the package:
  // named here so a live session migrates once instead of logging out.
  legacyCookieName: "sb-eddtfkgtwbyhqdgmmofi-auth-token",
});
```

| Door | Call |
|---|---|
| Client Component | `supabaseNext.browserClient()` |
| Server Component / Action | `supabaseNext.serverClient({ cookieStore: await cookies(), host })` |
| Route Handler | `supabaseNext.routeClient({ requestCookies: request.cookies, setCookie, host })` |
| Proxy / middleware | `await supabaseNext.middlewareSession({ host, requestCookies, createResponse, createRedirect })` |

**Adopted 2026-09-07.** `utils/supabase/{client,server,middleware}.ts` and the AI Matrx
OAuth callback route now hold no client construction at all — they are thin doors over
`supabaseNext`, and `utils/supabase/middleware.ts` keeps only THIS app's routing policy
(where an authed user lands, which routes require a session). `adminClient.ts` is the one
exception and is NOT a twin: it is the service-role client (`@supabase/supabase-js`), a
different capability with no cookies and no session. `@supabase/ssr` is no longer a direct
dependency of this repo — the package owns it.

Guards: `pnpm check:package-twins` fails on any local `createBrowserClient` /
`createServerClient` definition, and `utils/supabase/authCookie.test.ts` pins the identity
values (cookie name, legacy key, host-only off the apex).

## Project connection

```
NEXT_PUBLIC_SUPABASE_URL=https://eddtfkgtwbyhqdgmmofi.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_DQctohZrwd9MW-CixVJbew_eILhlDn0
```

(The publishable key is meant to be public — it is not a secret — but treat any
`SERVICE_ROLE`/`SECRET` key as one and never commit it here.)

## Agent Skills (optional)

```
npx skills add supabase/agent-skills
```
