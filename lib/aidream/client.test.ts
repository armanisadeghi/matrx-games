/**
 * Forcing test for the AI Dream agent door.
 *
 * Two things must stay true and neither is visible from reading the call site:
 * the agent-run path is decided by the PACKAGE's covered-surface allowlist (not
 * a literal typed in this repo), and a v2 endpoint that is absent or unhealthy
 * must be retried on v1 rather than surfacing as a failed game.
 *
 * The expected strings are literals on purpose. Deriving them from the same
 * package helper the code under test uses would prove nothing.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { agentRunPath } from "./client";

describe("agentRunPath", () => {
  it("reaches the v2 spine for an agent run", () => {
    expect(agentRunPath("abc-123")).toBe("/v2/ai/agents/abc-123");
  });

  it("encodes the interpolated id", () => {
    expect(agentRunPath("a/b")).toBe("/v2/ai/agents/a%2Fb");
  });
});

describe("callAgent falls back to v1 when the v2 endpoint is missing", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("retries the identical request on /ai/agents/... after a 404 on /v2", async () => {
    vi.stubEnv("AIDREAM_API_TOKEN", "test-token");
    vi.stubEnv("NEXT_PUBLIC_BACKEND_URL_PROD", "https://backend.test");

    const seen: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const href = String(url);
        seen.push(href);
        if (href.includes("/v2/")) {
          return new Response("no such route", { status: 404 });
        }
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
      "https://backend.test/v2/ai/agents/abc-123",
      "https://backend.test/ai/agents/abc-123",
    ]);
  });
});
