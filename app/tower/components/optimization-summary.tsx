'use client';

import type { RecommendationViewModel } from '@/lib/services/recommendation/types';
import { OptimalityBadge } from './optimality-badge';

interface OptimizationSummaryProps {
  data: RecommendationViewModel;
}

export function OptimizationSummary({ data }: OptimizationSummaryProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-7 shadow-lg space-y-6">
      {/* Title & Status Badges */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              ToA Recommendation Results
            </h2>
            <OptimalityBadge
              status={data.recommendationStatus}
              allocationStatus={data.allocationStatus}
              portfolioStatus={data.portfolioStatus}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground font-mono">
            <span className="rounded bg-secondary/80 px-2 py-0.5 border border-border/50">
              Contract: {data.serviceRuleVersion}
            </span>
            <span className="rounded bg-secondary/80 px-2 py-0.5 border border-border/50">
              Engine: {data.engineRuleVersion}
            </span>
            <span className="rounded bg-secondary/80 px-2 py-0.5 border border-border/50">
              Patch: {data.patchId}
            </span>
            <span className="rounded bg-secondary/80 px-2 py-0.5 border border-border/50">
              Season: {data.seasonId}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start lg:self-auto font-mono text-xs">
          <span className="rounded-lg bg-secondary/60 border border-border px-3 py-1.5 text-muted-foreground">
            {data.metrics.executionDurationMs.toFixed(1)}ms execution
          </span>
          <span
            className="rounded-lg bg-secondary/60 border border-border px-3 py-1.5 text-muted-foreground truncate max-w-[180px]"
            title={data.provenance.fingerprint}
          >
            FP: {data.provenance.fingerprint.slice(0, 10)}…
          </span>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Stages Assigned */}
        <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Stage Coverage
          </div>
          <div className="mt-1.5 text-xl font-extrabold text-foreground font-mono">
            {data.metrics.assignedStageCount} / {data.metrics.targetStageCount}
            <span className="text-xs font-normal text-muted-foreground ml-1.5">
              ({Math.round(data.metrics.stageCoverageRatio * 100)}%)
            </span>
          </div>
        </div>

        {/* Selected Teams */}
        <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Selected Teams
          </div>
          <div className="mt-1.5 text-xl font-extrabold text-foreground font-mono">
            {data.metrics.selectedTeamCount}
          </div>
        </div>

        {/* Total Vigor Consumed */}
        <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Total Vigor Used
          </div>
          <div className="mt-1.5 text-xl font-extrabold text-foreground font-mono">
            {data.metrics.totalVigorConsumed}
          </div>
        </div>

        {/* Distinct Resonators */}
        <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Resonators Deployed
          </div>
          <div className="mt-1.5 text-xl font-extrabold text-foreground font-mono">
            {data.metrics.distinctResonatorsUsedCount}
          </div>
        </div>
      </div>

      {/* Infeasibility Reasons if present */}
      {data.infeasibilityReasons.length > 0 && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-rose-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-rose-300">
              Infeasibility Diagnostics
            </h4>
          </div>
          <ul className="list-disc list-inside text-xs text-rose-200/90 space-y-1 font-mono">
            {data.infeasibilityReasons.map((reason, idx) => (
              <li key={idx}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Deterministic Formatted Explanation */}
      {data.formattedExplanation && (
        <div className="space-y-2 pt-2 border-t border-border/40">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Authoritative Orchestration Explanation
          </div>
          <pre className="rounded-xl border border-border/70 bg-secondary/20 p-4 text-xs font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed overflow-x-auto">
            {data.formattedExplanation}
          </pre>
        </div>
      )}
    </div>
  );
}
