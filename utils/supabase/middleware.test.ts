import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  middlewareSession: vi.fn(),
}));

vi.mock("@/utils/supabase/authCookie", () => ({
  supabaseNext: { middlewareSession: mocks.middlewareSession },
}));

import { updateSession } from "./middleware";

describe("games auth routing", () => {
  beforeEach(() => {
    mocks.middlewareSession.mockReset();
  });

  it("does not turn an auth outage into a login redirect", async () => {
    const redirect = vi.fn((url: URL) => NextResponse.redirect(url));
    mocks.middlewareSession.mockResolvedValue({
      user: null,
      authUnavailable: true,
      response: NextResponse.next(),
      redirect,
    });

    const response = await updateSession(
      new NextRequest("https://games.aimatrx.com/dashboard"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-pathname")).toBe("/dashboard");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("still redirects a verified signed-out request to login", async () => {
    const redirect = vi.fn((url: URL) => NextResponse.redirect(url));
    mocks.middlewareSession.mockResolvedValue({
      user: null,
      authUnavailable: false,
      response: NextResponse.next(),
      redirect,
    });

    const response = await updateSession(
      new NextRequest("https://games.aimatrx.com/dashboard?from=smoke"),
    );

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("redirectTo")).toBe(
      "/dashboard?from=smoke",
    );
    expect(redirect).toHaveBeenCalledOnce();
  });
});
