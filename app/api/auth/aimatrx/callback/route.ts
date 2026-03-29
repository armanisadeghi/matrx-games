import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  exchangeCodeForTokens,
  fetchUserInfo,
} from "@/lib/auth/aimatrx-oauth";
import { createAdminClient } from "@/utils/supabase/adminClient";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (oauthError) {
    const msg = errorDescription ?? oauthError;
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(msg)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("Missing authorization code or state")}`
    );
  }

  const storedState = request.cookies.get("aimatrx_oauth_state")?.value;
  const codeVerifier = request.cookies.get("aimatrx_code_verifier")?.value;

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("Invalid state — possible CSRF. Please try again.")}`
    );
  }

  if (!codeVerifier) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("Missing PKCE verifier. Please try again.")}`
    );
  }

  try {
    const redirectUri = `${origin}/api/auth/aimatrx/callback`;

    // 1. Exchange authorization code for tokens with AI Matrx
    const tokens = await exchangeCodeForTokens(code, redirectUri, codeVerifier);

    // 2. Get user identity from AI Matrx
    const userInfo = await fetchUserInfo(tokens.access_token);

    if (!userInfo.email) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent("AI Matrx account has no email address")}`
      );
    }

    // 3. Ensure user exists in this project's Supabase
    const adminClient = createAdminClient();

    const { error: createError } = await adminClient.auth.admin.createUser({
      email: userInfo.email,
      email_confirm: true,
      user_metadata: {
        display_name:
          userInfo.name ?? userInfo.email.split("@")[0] ?? "Player",
        avatar_url: userInfo.picture,
        aimatrx_user_id: userInfo.sub,
      },
    });

    // 4. Generate a magic link token (server-side only, never sent via email)
    const { data: linkData, error: linkError } =
      await adminClient.auth.admin.generateLink({
        type: "magiclink",
        email: userInfo.email,
      });

    if (linkError || !linkData) {
      throw linkError ?? new Error("Failed to generate sign-in link");
    }

    // 5. Create a local session by verifying the magic link OTP
    const forwardedHost = request.headers.get("x-forwarded-host");
    const isLocalEnv = process.env.NODE_ENV === "development";

    let redirectTarget: string;
    if (isLocalEnv) {
      redirectTarget = `${origin}/`;
    } else if (forwardedHost) {
      redirectTarget = `https://${forwardedHost}/`;
    } else {
      redirectTarget = `${origin}/`;
    }

    const response = NextResponse.redirect(redirectTarget);

    response.cookies.delete("aimatrx_oauth_state");
    response.cookies.delete("aimatrx_code_verifier");

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      (
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        ""
      ).trim(),
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { data: sessionData, error: verifyError } =
      await supabase.auth.verifyOtp({
        token_hash: linkData.properties.hashed_token,
        type: "magiclink",
      });

    if (verifyError) {
      throw verifyError;
    }

    // 6. If user already existed, sync their AI Matrx profile data
    if (createError && sessionData?.user) {
      const existingMeta = sessionData.user.user_metadata ?? {};
      await adminClient.auth.admin.updateUserById(sessionData.user.id, {
        user_metadata: {
          ...existingMeta,
          aimatrx_user_id: userInfo.sub,
          display_name: existingMeta.display_name ?? userInfo.name,
          avatar_url: existingMeta.avatar_url ?? userInfo.picture,
        },
      });
    }

    return response;
  } catch (err) {
    console.error("AI Matrx OAuth callback error:", err);
    const message =
      err instanceof Error ? err.message : "Authentication failed";
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(message)}`
    );
  }
}
