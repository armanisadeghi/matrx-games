// utils/supabase/client.ts — the browser client, for Client Components.
//
// Construction, the auth-cookie options, and the globalThis-slot singleton
// (a per-module singleton silently splits auth state across this package's
// ESM and CJS graphs) all live in @ai-matrx/data/next, bound to this app's
// identity in utils/supabase/authCookie.ts. This file is this repo's
// established import name for that door and nothing more.

import { supabaseNext } from "@/utils/supabase/authCookie";

export function createClient() {
  return supabaseNext.browserClient();
}

// Convenience singleton for files that import { supabase } from '@/utils/supabase/client'
export const supabase = createClient();
