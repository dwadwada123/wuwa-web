import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    redirect("/auth/login");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  const claims = data.claims;
  const userId = (claims.sub as string) || "Unknown";
  const email = (claims.email as string) || "No email on record";
  const role = (claims.role as string) || "authenticated";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-12">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Account Overview
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Authenticated Session Verified
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-500">
            Active
          </span>
        </div>

        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
            <span className="text-xs font-medium text-muted-foreground">User ID (UUID)</span>
            <p className="mt-1 font-mono text-xs break-all text-foreground">{userId}</p>
          </div>

          <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
            <span className="text-xs font-medium text-muted-foreground">Email Address</span>
            <p className="mt-1 text-sm font-medium text-foreground">{email}</p>
          </div>

          <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
            <span className="text-xs font-medium text-muted-foreground">Role</span>
            <p className="mt-1 text-sm font-medium text-foreground capitalize">{role}</p>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              &larr; Home
            </Link>
            <Link
              href="/inventory"
              className="rounded-lg bg-primary/20 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/30 transition-colors"
            >
              Manage Inventory
            </Link>
          </div>

          <form action={signOut}>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
            >
              Sign Out
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
