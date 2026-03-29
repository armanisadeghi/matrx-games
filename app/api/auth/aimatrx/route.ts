import { NextResponse, type NextRequest } from "next/server";
import {
  generatePKCEParams,
  buildAuthorizeURL,
} from "@/lib/auth/aimatrx-oauth";

export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);
  const redirectUri = `${origin}/api/auth/aimatrx/callback`;

  const { codeVerifier, codeChallenge, state } = await generatePKCEParams();
  const authorizeURL = buildAuthorizeURL(redirectUri, codeChallenge, state);

  const response = NextResponse.redirect(authorizeURL);

  response.cookies.set("aimatrx_code_verifier", codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  response.cookies.set("aimatrx_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return response;
}
