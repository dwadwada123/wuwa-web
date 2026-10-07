'use client';

import type { TowerOptimizationViewModel } from '../types';
import { OptimalityBadge } from './optimality-badge';

interface OptimizationSummaryProps {
  data: TowerOptimizationViewModel;
}

export function OptimizationSummary({ data }: OptimizationSummaryProps) {
  const isPrimaryProven = data.optimality === 'PRIMARY_PROVEN';
  const isFullProven = data.optimality === 'FULL_LEXICOGRAPHIC_PROVEN';

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-7 shadow-lg space-y-6">
      {/* Title & Optimality Badges */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              ToA Optimization Results
            </h2>
            <OptimalityBadge
              status={data.status}
              mode={data.mode}
              optimality={data.optimality}
              explanation={data.optimalityExplanation}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {data.optimalityExplanation.description}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start lg:self-auto font-mono text-xs">
          <span className="rounded-lg bg-secondary/60 border border-border px-3 py-1.5 text-muted-foreground">
            {data.metrics.durationMs}ms solve
          </span>
          <span className="rounded-lg bg-secondary/60 border border-border px-3 py-1.5 text-muted-foreground">
            {data.metrics.searchStatesExplored} states
          </span>
        </div>
      </div>

      {/* Primary KPI Grid (Requirement 7) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Score */}
        <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Score
          </div>
          <div className="mt-1.5 text-xl font-extrabold text-foreground font-mono">
            {data.totalScore}
            {data.globalPrimaryUpperBound !== undefined ? (
              <span className="text-xs font-normal text-muted-foreground ml-1">
                / {data.globalPrimaryUpperBound}
              </span>
            ) : null}
          </div>
        </div>

        {/* Primary Objective Provenance */}
        <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Primary Objective
          </div>
          <div
            className={`mt-1.5 text-base font-bold tracking-tight ${
              isPrimaryProven || isFullProven
                ? 'text-teal-400'
                : 'text-amber-400'
            }`}
          >
            {isPrimaryProven || isFullProven ? 'PROVEN' : 'NOT PROVEN'}
          </div>
        </div>

        {/* Full Tie-Break Optimality */}
        <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Full Tie-Break
          </div>
          <div
            className={`mt-1.5 text-base font-bold tracking-tight ${
              isFullProven ? 'text-emerald-400' : 'text-muted-foreground'
            }`}
          >
            {isFullProven ? 'PROVEN' : 'NOT PROVEN'}
          </div>
        </div>

        {/* Stages Assigned */}
        <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Assigned Stages
          </div>
          <div className="mt-1.5 text-xl font-extrabold text-foreground font-mono">
            {data.assignedStagesCount} / {data.stagesCount}
          </div>
        </div>

        {/* Total Vigor Consumed */}
        <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Character-Vigor
          </div>
          <div className="mt-1.5 text-xl font-extrabold text-foreground font-mono">
            {data.totalVigorConsumed}{' '}
            <span className="text-xs font-normal text-muted-foreground">total</span>
          </div>
        </div>

        {/* Distinct Teams */}
        <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Distinct Teams
          </div>
          <div className="mt-1.5 text-xl font-extrabold text-foreground font-mono">
            {data.distinctTeamsCount}
          </div>
        </div>
      </div>

      {/* Global Tradeoffs & Opportunity-Cost Evidence */}
      {data.globalTradeoffs.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border/40">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Global Optimization Evidence &amp; Trade-offs
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.globalTradeoffs.map((gt, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-border/70 bg-secondary/20 p-3 space-y-1 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded bg-primary/20 text-primary font-bold px-1.5 py-0.5 text-[10px]">
                    {gt.category}
                  </span>
                  <span className="font-bold text-foreground">{gt.title}</span>
                </div>
                {gt.facts?.explanation ? (
                  <p className="text-muted-foreground leading-relaxed text-[11px]">
                    {String(gt.facts.explanation)}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
