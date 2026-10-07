'use client';

import type {
  OptimizationStatus,
  OptimizationOptimality,
  OptimizationMode,
} from '@/lib/engine/optimization/types';
import type { OptimalityExplanation } from '@/lib/engine/explanation/types';

interface OptimalityBadgeProps {
  status: OptimizationStatus;
  mode: OptimizationMode;
  optimality?: OptimizationOptimality;
  explanation?: OptimalityExplanation;
  detailed?: boolean;
}

export function OptimalityBadge({
  status,
  mode,
  optimality,
  explanation,
  detailed = false,
}: OptimalityBadgeProps) {
  if (status === 'INFEASIBLE') {
    return (
      <div className="space-y-1">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-400">
          <span className="h-2 w-2 rounded-full bg-rose-500" />
          No feasible assignment
        </span>
        {detailed && (
          <p className="text-xs text-rose-300/80">
            {explanation?.description ||
              'Roster capacity is insufficient to satisfy the Vigor requirements for all requested stages.'}
          </p>
        )}
      </div>
    );
  }

  // Determine label and color
  let label = 'Best solution found within search budget';
  let colorClasses = 'border-amber-500/30 bg-amber-500/10 text-amber-400';
  let dotColor = 'bg-amber-400';

  if (optimality === 'FULL_LEXICOGRAPHIC_PROVEN') {
    label = 'Fully proven optimal';
    colorClasses = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
    dotColor = 'bg-emerald-400';
  } else if (optimality === 'PRIMARY_PROVEN') {
    label = 'Primary objective proven';
    colorClasses = 'border-teal-500/30 bg-teal-500/10 text-teal-400';
    dotColor = 'bg-teal-400';
  }

  // Exact semantic explanation for BEST_FOUND + PRIMARY_PROVEN
  const isPrimaryProvenBestFound =
    status === 'BEST_FOUND' && optimality === 'PRIMARY_PROVEN';

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold ${colorClasses}`}
        >
          <span className={`h-2 w-2 rounded-full ${dotColor}`} />
          {label}
        </span>

        <span className="rounded border border-border/80 bg-secondary/50 px-2 py-0.5 text-[11px] font-mono text-muted-foreground uppercase">
          {mode} MODE
        </span>

        {status === 'BEST_FOUND' && (
          <span className="rounded border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-400">
            BEST_FOUND
          </span>
        )}
      </div>

      {detailed && (
        <p className="text-xs text-muted-foreground">
          {isPrimaryProvenBestFound
            ? 'Primary score proven optimal; full tie-break optimality was not proven within the search budget.'
            : explanation?.description ||
              (optimality === 'FULL_LEXICOGRAPHIC_PROVEN'
                ? 'Mathematically proven optimal across all primary and secondary lexicographic objectives.'
                : 'Best solution found within the search budget; global optimality not mathematically proven.')}
        </p>
      )}
    </div>
  );
}
