'use client';

import { useState } from 'react';
import type { StageCardViewModel } from '../types';
import type { ExplanationReason } from '@/lib/engine/explanation/types';

interface WhyThisTeamProps {
  stage: StageCardViewModel;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  STAGE_MATCHUP: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  ENEMY_MATCHUP: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  AREA_EFFECT: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  ROLE_COVERAGE: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  OFFENSIVE_SYNERGY: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
  SUSTAIN: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
  RESOURCE: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  VIGOR: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  GLOBAL_OPTIMIZATION: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  TRADEOFF: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
};

function ReasonPill({ reason }: { reason: ExplanationReason }) {
  const catStyle = CATEGORY_COLORS[reason.category] || {
    bg: 'bg-secondary/50',
    text: 'text-foreground',
    border: 'border-border',
  };

  return (
    <div className="rounded-lg border border-border/60 bg-secondary/20 p-3 space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
        >
          {reason.category}
        </span>
        <span className="text-xs font-semibold text-foreground tracking-tight">
          {reason.title}
        </span>
      </div>

      {reason.facts && (
        <div className="text-[11px] text-muted-foreground space-y-0.5 font-mono">
          {Object.entries(reason.facts).map(([k, v]) => {
            if (typeof v === 'object' && v !== null) {
              return (
                <div key={k} className="truncate">
                  <span className="text-muted-foreground/80">{k}:</span>{' '}
                  <span className="text-foreground/90">{JSON.stringify(v)}</span>
                </div>
              );
            }
            return (
              <div key={k} className="truncate">
                <span className="text-muted-foreground/80">{k}:</span>{' '}
                <span className="text-foreground/90">{String(v)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function WhyThisTeam({ stage }: WhyThisTeamProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Check if there is an opportunity cost tradeoff on this stage
  const tradeoffReason = stage.tradeoffs.find(
    (t) => t.code === 'STAGE_GLOBAL_OPPORTUNITY_TRADEOFF' || t.category === 'TRADEOFF'
  );
  const hasTradeoff = !!tradeoffReason;

  return (
    <div className="rounded-lg border border-border/60 bg-secondary/15 overflow-hidden">
      <button
        type="button"
        id={`why-team-btn-${stage.stageId}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={`why-team-panel-${stage.stageId}`}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-secondary/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">
            Why this team?
          </span>
          <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            {stage.primaryReasons.length + stage.supportingReasons.length} Deterministic Reasons
          </span>

          {hasTradeoff && (
            <span className="rounded bg-orange-500/15 border border-orange-500/30 px-2 py-0.5 text-[10px] font-semibold text-orange-400">
              Global Trade-off Active
            </span>
          )}
        </div>

        <span className="text-xs font-medium text-muted-foreground">
          {isOpen ? '▲ Collapse' : '▼ Inspect Why'}
        </span>
      </button>

      {isOpen && (
        <div
          id={`why-team-panel-${stage.stageId}`}
          role="region"
          aria-labelledby={`why-team-btn-${stage.stageId}`}
          className="p-4 pt-1 space-y-4 border-t border-border/40"
        >
          {/* 1. Global Trade-off Display (Requirement 11) */}
          {hasTradeoff && tradeoffReason && (
            <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-3.5 space-y-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-orange-400" />
                <h5 className="text-xs font-bold text-orange-300 uppercase tracking-wide">
                  Global Opportunity-Cost Trade-Off
                </h5>
              </div>

              <div className="text-xs text-orange-200/90 leading-relaxed space-y-1">
                <p>
                  The optimizer selected this team even though a higher local score was possible,
                  because reserving or deploying higher-scoring characters elsewhere maximizes the total
                  score across the full Tower cycle.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                  <div className="rounded bg-background/40 p-2">
                    <div className="text-muted-foreground text-[10px]">Stage Score Here</div>
                    <div className="text-foreground font-bold">{stage.stageScore}</div>
                  </div>
                  <div className="rounded bg-background/40 p-2">
                    <div className="text-muted-foreground text-[10px]">Local Peak Potential</div>
                    <div className="text-foreground font-bold">
                      {String((tradeoffReason.facts as any)?.maxLocalScore ?? stage.stageScore)}
                    </div>
                  </div>
                  <div className="rounded bg-background/40 p-2">
                    <div className="text-muted-foreground text-[10px]">Global Trade-Off Deficit</div>
                    <div className="text-orange-400 font-bold">
                      -{String((tradeoffReason.facts as any)?.scoreDeficit ?? 0)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. Primary Reasons */}
          <div>
            <h5 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Primary Selection Drivers
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {stage.primaryReasons.map((r, i) => (
                <ReasonPill key={`prim-${i}`} reason={r} />
              ))}
            </div>
          </div>

          {/* 3. Supporting Reasons */}
          {stage.supportingReasons.length > 0 && (
            <div>
              <h5 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Supporting Synergies &amp; Matchups
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {stage.supportingReasons.map((r, i) => (
                  <ReasonPill key={`supp-${i}`} reason={r} />
                ))}
              </div>
            </div>
          )}

          {/* 4. Score Dimensions Breakdown */}
          {stage.scoreBreakdown?.topContributors && stage.scoreBreakdown.topContributors.length > 0 && (
            <div>
              <h5 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Top Score Dimensions
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {stage.scoreBreakdown.topContributors.map((tc, idx) => (
                  <div
                    key={idx}
                    className="rounded border border-border/60 bg-secondary/30 p-2.5 flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">{tc.name}</span>
                      <span className="font-mono text-muted-foreground">
                        {Math.round(tc.weightedScore)} / {tc.maxWeight}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-secondary/80 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, Math.max(0, tc.percentageOfMax))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. Vigor Allocation Impact */}
          {stage.resourceImpact?.members && stage.resourceImpact.members.length > 0 && (
            <div className="rounded-lg border border-border/50 bg-secondary/20 p-3">
              <h5 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Stage Vigor Impact ({stage.vigorCost} Vigor per Member)
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-xs">
                {stage.resourceImpact.members.map((m) => (
                  <div key={m.resonatorId} className="rounded bg-background/50 p-2 space-y-1 border border-border/40">
                    <div className="font-bold text-foreground text-xs">{m.name}</div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Consumed:</span>
                      <span className="text-foreground">{m.usedAfterStage} / {m.capacity}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Reserve:</span>
                      <span className={m.remainingAfterStage === 0 ? 'text-amber-400 font-bold' : 'text-emerald-400'}>
                        {m.remainingAfterStage} Vigor
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
