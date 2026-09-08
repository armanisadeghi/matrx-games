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
// One module in this app — everything else imports from here.
import { createNextSupabase } from "@ai-matrx/data/next";
import type { Database } from "@/types/database.types";

export const supabaseNext = createNextSupabase<Database>({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  apexDomain: "aimatrx.com",
  cookieName: "sb-matrx-auth",
});
```

| Door | Call |
|---|---|
| Client Component | `supabaseNext.browserClient()` |
| Server Component / Action | `supabaseNext.serverClient({ cookieStore: await cookies(), host })` |
| Route Handler | `supabaseNext.routeClient({ requestCookies: request.cookies, setCookie, host })` |
| Proxy / middleware | `await supabaseNext.middlewareSession({ host, requestCookies, createResponse, createRedirect })` |

**This repo has not adopted the package yet** — `utils/supabase/{client,server,middleware,adminClient}.ts`
still carry the hand-rolled bodies this doc used to teach (`CLAUDE.md` § Supabase
clients names their current import paths). Adopting `@ai-matrx/data/next` here is a
follow-up task, not a documentation fix; this file's job is to stop pointing new work
at the pattern the fleet is retiring.

## Project connection

```
NEXT_PUBLIC_SUPABASE_URL=https://eddtfkgtwbyhqdgmmofi.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_DQctohZrwd9MW-CixVJbew_eILhlDn0
```

(The publishable key is meant to be public — it is not a secret — but treat any
`SERVICE_ROLE`/`SECRET` key as one and never commit it here.)

## Agent Skills (optional)

```
npx skills add supabase/agent-skills
```
