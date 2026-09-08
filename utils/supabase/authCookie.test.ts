// The identity wiring of @ai-matrx/data/next in THIS app is a contract, not a
// preference: every door (browser, Server Component, Route Handler, proxy) has
// to agree on ONE cookie name, and Matrx Games authenticates against its OWN
// Supabase project — a different auth authority from Matrx Main. If this file
// ever goes red, sessions written by one door are invisible to the others, or
// a Games session is being stored under Matrx Main's key.
//
// The package's own behaviour (cookie construction, migration, the split-jar
// heal, the middleware pass) is tested IN the package. This tests only what
// this repo supplies: the values.

import { beforeAll, describe, expect, it, vi } from "vitest";

type AuthCookieModule = typeof import("./authCookie");

let mod: AuthCookieModule;

beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://eddtfkgtwbyhqdgmmofi.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test_key");
  mod = await import("./authCookie");
});

describe("matrx-games Supabase identity", () => {
  it("uses a Games-specific cookie name, never Matrx Main's", () => {
    expect(mod.AUTH_COOKIE_NAME).toBe("sb-matrx-games-auth");
    // The package default belongs to the Matrx Main auth authority. Sharing it
    // would hand a session issued by one project to a client talking to the
    // other, and every read would answer anonymous.
    expect(mod.AUTH_COOKIE_NAME).not.toBe("sb-matrx-auth");
  });

  it("migrates the storage key this app used before adopting the package", () => {
    // Dropping this silently logs out every browser holding a Games session.
    expect(mod.LEGACY_AUTH_COOKIE_NAME).toBe("sb-eddtfkgtwbyhqdgmmofi-auth-token");
    expect(mod.supabaseNext.authCookie.legacyCookieName).toBe(
      mod.LEGACY_AUTH_COOKIE_NAME,
    );
  });

  it("issues a HOST-ONLY cookie off the apex, and spans it on the apex", () => {
    // A browser silently rejects a Set-Cookie whose Domain does not cover the
    // current host, so a domain-wide cookie on localhost / *.vercel.app would
    // break auth everywhere this app currently runs.
    expect(mod.supabaseNext.optionsForHost("localhost:3000").domain).toBeUndefined();
    expect(
      mod.supabaseNext.optionsForHost(
        "matrx-games-armani-sadeghis-projects.vercel.app",
      ).domain,
    ).toBeUndefined();
    expect(mod.supabaseNext.optionsForHost("games.aimatrx.com").domain).toBe(
      ".aimatrx.com",
    );
  });

  it("recognizes its own chunked auth cookies and nothing else", () => {
    expect(mod.supabaseNext.authCookie.isCurrentCookie("sb-matrx-games-auth")).toBe(true);
    expect(mod.supabaseNext.authCookie.isCurrentCookie("sb-matrx-games-auth.0")).toBe(true);
    expect(mod.supabaseNext.authCookie.isCurrentCookie("sb-matrx-auth")).toBe(false);
  });
});
