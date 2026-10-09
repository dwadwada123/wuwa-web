'use client';

import type {
  RecommendationStatus,
  ToAAllocationStatus,
  TeamPortfolioStatus,
} from '@/lib/services/recommendation/types';

interface OptimalityBadgeProps {
  status: RecommendationStatus;
  allocationStatus?: ToAAllocationStatus | null;
  portfolioStatus?: TeamPortfolioStatus | null;
}

export function OptimalityBadge({
  status,
  allocationStatus,
  portfolioStatus,
}: OptimalityBadgeProps) {
  let badgeColor = 'border-border bg-secondary text-foreground';
  let dotColor = 'bg-muted-foreground';
  let label = status as string;

  switch (status) {
    case 'OPTIMAL_RECOMMENDATION':
      badgeColor = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
      dotColor = 'bg-emerald-400';
      label = 'Optimal Recommendation';
      break;
    case 'FEASIBLE_RECOMMENDATION':
      badgeColor = 'border-teal-500/30 bg-teal-500/10 text-teal-400';
      dotColor = 'bg-teal-400';
      label = 'Feasible Recommendation';
      break;
    case 'PARTIAL_RECOMMENDATION':
      badgeColor = 'border-blue-500/30 bg-blue-500/10 text-blue-400';
      dotColor = 'bg-blue-400';
      label = 'Partial Recommendation';
      break;
    case 'NO_FEASIBLE_ALLOCATION':
      badgeColor = 'border-amber-500/30 bg-amber-500/10 text-amber-400';
      dotColor = 'bg-amber-400';
      label = 'No Feasible Allocation';
      break;
    case 'NO_FEASIBLE_PORTFOLIO':
      badgeColor = 'border-rose-500/30 bg-rose-500/10 text-rose-400';
      dotColor = 'bg-rose-400';
      label = 'No Feasible Portfolio';
      break;
    case 'INSUFFICIENT_ROSTER':
      badgeColor = 'border-amber-500/30 bg-amber-500/10 text-amber-400';
      dotColor = 'bg-amber-400';
      label = 'Insufficient Roster';
      break;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold ${badgeColor}`}
      >
        <span className={`h-2 w-2 rounded-full ${dotColor}`} />
        {label}
      </span>

      {allocationStatus && (
        <span className="rounded border border-border/80 bg-secondary/50 px-2 py-0.5 text-[11px] font-mono text-muted-foreground uppercase">
          Allocation: {allocationStatus}
        </span>
      )}

      {portfolioStatus && (
        <span className="rounded border border-border/80 bg-secondary/50 px-2 py-0.5 text-[11px] font-mono text-muted-foreground uppercase">
          Portfolio: {portfolioStatus}
        </span>
      )}
    </div>
  );
}
