# Tasks From Lead Developer, Arman

1. ~~We need to make sure that we properly set up the auth to use our main Supabase Auth form AI Matrx as the OAuth to allow users to login.~~
   - ~~People should be able to play the games without logging in but they will need to log in so they can have all history saved, high scores, and all of the other features. (The OAuth is through supabase and it's very simple)~~
   - ~~See OAuth usage example here: /Users/armanisadeghi/code/matrx-dm~~
   - **STATUS: DONE** — OAuth 2.1 PKCE flow implemented:
     - `lib/auth/aimatrx-oauth.ts` — PKCE utilities (code verifier, challenge, token exchange, userinfo)
     - `app/api/auth/aimatrx/route.ts` — Initiates OAuth redirect to AI Matrx
     - `app/api/auth/aimatrx/callback/route.ts` — Handles callback, creates/syncs local user, establishes session
     - `app/login/page.tsx` + `login-form.tsx` — Login page with "Continue with AI Matrx" button + guest option
     - Guest play works without auth. Auth only required for `/dashboard`, `/profile`, `/history`
   - **REMAINING**: Register OAuth client in AI Matrx Supabase dashboard to get `AIMATRX_OAUTH_CLIENT_ID` and `AIMATRX_OAUTH_CLIENT_SECRET`, then add to Vercel env vars along with redirect URI `https://gamematrx.com/api/auth/aimatrx/callback`

2.
