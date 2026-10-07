"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface UpdatePasswordFormProps {
  initialError?: string | null;
}

export function UpdatePasswordForm({ initialError }: UpdatePasswordFormProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(
    initialError === "invalid_link"
      ? "The reset link is invalid or has expired. Please request a new password reset email."
      : null
  );
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [isSessionValid, setIsSessionValid] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function verifyRecoveryContext() {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
        if (mounted) {
          setError("Supabase credentials are not configured.");
          setCheckingSession(false);
        }
        return;
      }

      try {
        const supabase = createClient();

        // 1. Subscribe to auth events (e.g. PASSWORD_RECOVERY event or SIGNED_IN)
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
          if (!mounted) return;
          if (event === "PASSWORD_RECOVERY" || session) {
            setIsSessionValid(true);
            setError(null);
            setCheckingSession(false);
          }
        });

        // 2. Check if a session already exists (e.g. exchanged via callback or existing session)
        const { data: userData, error: userError } = await supabase.auth.getUser();

        if (mounted) {
          if (userData?.user && !userError) {
            setIsSessionValid(true);
          } else if (typeof window !== "undefined" && window.location.hash.includes("access_token")) {
            // Implicit flow tokens in URL hash - allow client to complete detection
            setIsSessionValid(true);
          } else if (initialError) {
            setIsSessionValid(false);
          } else {
            // Give a short grace period for URL hash / code auto-detection if present
            const hasAuthParams =
              typeof window !== "undefined" &&
              (window.location.search.includes("code=") ||
                window.location.hash.includes("access_token="));

            if (!hasAuthParams) {
              setIsSessionValid(false);
            }
          }
          setCheckingSession(false);
        }

        return () => {
          subscription.unsubscribe();
        };
      } catch {
        if (mounted) {
          setIsSessionValid(false);
          setCheckingSession(false);
        }
      }
    }

    verifyRecoveryContext();

    return () => {
      mounted = false;
    };
  }, [initialError]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!password || !confirmPassword) {
      setError("Please fill out both password fields.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        // Sanitize error messages and never expose raw stack traces or internal errors
        const msg = updateError.message.toLowerCase();
        if (msg.includes("password should be") || msg.includes("weak password") || msg.includes("pwned")) {
          setError("The password does not meet the required security policy.");
        } else if (msg.includes("jwt") || msg.includes("session") || msg.includes("auth")) {
          setError("The reset link is invalid or has expired. Please request a new password reset email.");
          setIsSessionValid(false);
        } else {
          setError("The password could not be updated. Please ensure it meets security requirements and try again.");
        }
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
    } catch {
      setError("An unexpected error occurred while updating your password. Please try again.");
      setLoading(false);
    }
  }

  // 1. Success State
  if (success) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Password Updated
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Your password has been updated successfully. You can now sign in with
            your new password.
          </p>

          <div className="mt-6 border-t border-border pt-4 text-center">
            <Link
              href="/auth/login"
              className="inline-flex w-full items-center justify-center rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Back to login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // 2. Checking Session State
  if (checkingSession) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl text-center">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full mb-4" />
          <p className="text-sm text-muted-foreground">
            Verifying recovery session...
          </p>
        </div>
      </main>
    );
  }

  // 3. Invalid or Expired Session State
  if (!isSessionValid) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Invalid or Expired Link
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {error ||
              "The reset link is invalid or has expired. Please request a new password reset email."}
          </p>

          <div className="mt-6 flex flex-col space-y-3 border-t border-border pt-4">
            <Link
              href="/auth/forgot-password"
              className="inline-flex w-full items-center justify-center rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Request New Reset Link
            </Link>
            <Link
              href="/auth/login"
              className="text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              &larr; Back to Sign In
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // 4. Active Recovery Form State
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Set New Password
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a strong password for your account
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive-foreground">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="new-password"
              className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5"
            >
              New Password
            </label>
            <input
              id="new-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-secondary/50 px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5"
            >
              Confirm New Password
            </label>
            <input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-secondary/50 px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Updating password..." : "Update Password"}
          </button>
        </form>

        <div className="mt-6 border-t border-border pt-4 text-center text-xs text-muted-foreground">
          <Link href="/auth/login" className="hover:text-foreground transition-colors">
            &larr; Back to Sign In
          </Link>
        </div>
      </div>
    </main>
  );
}
