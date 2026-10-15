/**
 * Forcing test for the AI Dream agent door.
 *
 * Two things must stay true and neither is visible from reading the call site:
 * the agent-run path is decided by the PACKAGE's covered-surface allowlist, not
 * a literal typed in this repo. The package now sends this agent route directly
 * to its canonical endpoint; it does not probe a retired v2 route first.
 *
 * The expected strings are literals on purpose. Deriving them from the same
 * package helper the code under test uses would prove nothing.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

describe("callAgent uses the canonical agent endpoint", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("posts the request directly to /ai/agents/...", async () => {
    vi.stubEnv("AIDREAM_API_TOKEN", "test-token");
    vi.stubEnv("NEXT_PUBLIC_BACKEND_URL_PROD", "https://backend.test");

    const seen: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const href = String(url);
        seen.push(href);
        return new Response("ok", { status: 200 });
      }),
    );

    // The module reads the token at LOAD time, and this file already imported
    // it once for `agentRunPath`. Drop the cached copy so the stubs are in
    // place for the fresh evaluation.
    vi.resetModules();
    const { callAgent } = await import("./client");
    const res = await callAgent("abc-123", { user_input: "hello" });

    expect(res.status).toBe(200);
    expect(seen).toEqual([
      "https://backend.test/ai/agents/abc-123",
    ]);
  });
});
