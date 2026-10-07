import { type NextRequest, NextResponse } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // Validate next URL to avoid open redirect vulnerabilities
  const rawNext = searchParams.get("next");
  const next =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/account";

  // Build base redirect URL respecting forwarded headers (e.g. Vercel reverse proxy)
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const baseUrl = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : origin;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    const errorUrl = new URL(
      next === "/auth/update-password" ? "/auth/update-password" : "/auth/login",
      baseUrl
    );
    errorUrl.searchParams.set("error", "config_missing");
    return NextResponse.redirect(errorUrl);
  }

  // Handle PKCE code exchange
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(next, baseUrl));
    }

    // On exchange error, route gracefully
    const errorUrl = new URL(
      next === "/auth/update-password" ? "/auth/update-password" : "/auth/login",
      baseUrl
    );
    errorUrl.searchParams.set("error", "invalid_link");
    return NextResponse.redirect(errorUrl);
  }

  // Handle token_hash / OTP flow
  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error) {
      return NextResponse.redirect(new URL(next, baseUrl));
    }

    const errorUrl = new URL(
      next === "/auth/update-password" ? "/auth/update-password" : "/auth/login",
      baseUrl
    );
    errorUrl.searchParams.set("error", "invalid_link");
    return NextResponse.redirect(errorUrl);
  }

  // No code or token found
  const errorUrl = new URL(
    next === "/auth/update-password" ? "/auth/update-password" : "/auth/login",
    baseUrl
  );
  errorUrl.searchParams.set("error", "invalid_link");
  return NextResponse.redirect(errorUrl);
}
