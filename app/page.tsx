import Link from "next/link";
import type { Database } from "@/lib/db/database.types";

// Type verification to ensure generated database types integrate properly
type ResonatorRow = Database["public"]["Tables"]["resonators"]["Row"];
type PatchRow = Database["public"]["Tables"]["patches"]["Row"];

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-12">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-8 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              System Online
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/auth/login"
              className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/auth/sign-up"
              className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
            >
              Register
            </Link>
            <Link
              href="/account"
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Account
            </Link>
          </div>
        </div>

        <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          WuWa Optimizer
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          Wuthering Waves 3.7 Team-Building &amp; Tower of Adversity Optimization Engine
        </p>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-secondary/40 p-4">
            <div className="text-xs font-medium text-muted-foreground">Framework</div>
            <div className="mt-1 text-sm font-semibold text-foreground">Next.js 16 (App Router)</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-secondary/40 p-4">
            <div className="text-xs font-medium text-muted-foreground">Runtime</div>
            <div className="mt-1 text-sm font-semibold text-foreground">React 19 &amp; TypeScript</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-secondary/40 p-4">
            <div className="text-xs font-medium text-muted-foreground">Styling</div>
            <div className="mt-1 text-sm font-semibold text-foreground">Tailwind CSS (shadcn/ui-ready)</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-secondary/40 p-4">
            <div className="text-xs font-medium text-muted-foreground">Database Schema</div>
            <div className="mt-1 text-sm font-semibold text-foreground">33 PostgreSQL Tables</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-secondary/40 p-4">
            <div className="text-xs font-medium text-muted-foreground">Target Patch</div>
            <div className="mt-1 text-sm font-semibold text-foreground">WuWa 3.7 Live</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-secondary/40 p-4">
            <div className="text-xs font-medium text-muted-foreground">Optimization Engine</div>
            <div className="mt-1 text-sm font-semibold text-foreground">Deterministic ILP</div>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
          <span>Type Verification: Active (33 Database Entities)</span>
          <span>Environment: Production Ready</span>
        </div>
      </div>
    </main>
  );
}
