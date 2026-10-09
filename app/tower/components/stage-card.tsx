'use client';

import type { RecommendationStageViewModel } from '@/lib/services/recommendation/types';
import { TeamDisplay } from './team-display';

interface StageCardProps {
  stage: RecommendationStageViewModel;
}

export function StageCard({ stage }: StageCardProps) {
  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-sm space-y-4 hover:border-border transition-colors">
      {/* Header: Floor, Tower, Vigor Cost, and Assignment Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="rounded-md bg-secondary px-2.5 py-1 text-xs font-bold text-foreground">
            Floor {stage.floor}
          </span>
          <span className="text-sm font-semibold text-foreground">
            {stage.towerName}
          </span>
          <span className="inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400 font-mono">
            {stage.vigorCost} Vigor Cost
          </span>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {stage.isAssigned ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Assigned
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Unassigned: {stage.unassignedReason || 'No team'}
            </span>
          )}
        </div>
      </div>

      {/* Buff Alignment Context */}
      <div className="rounded-lg border border-border/60 bg-secondary/20 p-3 space-y-1 text-xs">
        <div className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground flex items-center justify-between">
          <span>Stage Buff Compatibility</span>
          <span className="font-mono text-foreground font-semibold">
            {stage.buffMatchedMemberCount} / 3 Members Matched
          </span>
        </div>
        <div className="text-muted-foreground text-[11px]">
          Matched Beneficial Elements:{' '}
          <span className="text-foreground font-semibold">
            {stage.matchedBeneficialElements.length > 0
              ? stage.matchedBeneficialElements.join(', ')
              : 'None'}
          </span>
        </div>
      </div>

      {/* Team Details */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Assigned Composition
          </span>
          {stage.team && (
            <div className="flex items-center gap-2">
              <span className="rounded bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                Build: {stage.team.status}
              </span>
            </div>
          )}
        </div>

        {stage.team ? (
          <TeamDisplay members={stage.team.members} />
        ) : (
          <div className="rounded-lg border border-dashed border-border/80 p-4 text-center text-xs text-muted-foreground">
            No team assigned to this stage
          </div>
        )}
      </div>
    </div>
  );
}
