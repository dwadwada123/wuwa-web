'use client';

import type { StageCardViewModel } from '../types';
import { TeamDisplay } from './team-display';
import { WhyThisTeam } from './why-this-team';

interface StageCardProps {
  stage: StageCardViewModel;
}

export function StageCard({ stage }: StageCardProps) {
  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-sm space-y-4 hover:border-border transition-colors">
      {/* Header: Tower, Floor, Vigor Cost, and Stage Score */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="rounded-md bg-secondary px-2.5 py-1 text-xs font-bold text-foreground">
            Floor {stage.floor}
          </span>
          <span className="text-sm font-semibold text-foreground">
            {stage.towerName}
          </span>
          <span className="inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400">
            {stage.vigorCost} Vigor Cost
          </span>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs text-muted-foreground">Stage Score:</span>
          <span className="rounded-md bg-primary/10 border border-primary/20 px-2.5 py-1 text-sm font-extrabold text-primary font-mono">
            {stage.stageScore}
          </span>
        </div>
      </div>

      {/* Stage Context: Area Buffs & Enemies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
        {/* Area Buffs */}
        <div className="rounded-lg border border-border/60 bg-secondary/20 p-3 space-y-1.5">
          <span className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Area Buffs &amp; Mechanics
          </span>
          {stage.areaBuffs.length > 0 ? (
            <div className="space-y-1.5">
              {stage.areaBuffs.map((ab, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="font-semibold text-foreground text-xs">{ab.name}</div>
                  <div className="text-muted-foreground text-[11px] leading-relaxed">
                    {ab.description}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground text-[11px] italic">No active area buffs</div>
          )}
        </div>

        {/* Enemy Summary */}
        <div className="rounded-lg border border-border/60 bg-secondary/20 p-3 space-y-1.5">
          <span className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
            Enemy Profile
          </span>
          {stage.enemySummary.length > 0 ? (
            <div className="space-y-1.5">
              {stage.enemySummary.map((en, idx) => (
                <div key={idx} className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">{en.name}</span>
                    <span className="text-muted-foreground font-mono text-[11px]">
                      Lv. {en.level} • {en.enemyClass}
                    </span>
                  </div>
                  {en.resistances && en.resistances.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 pt-0.5">
                      <span className="text-[10px] text-muted-foreground">Resistances:</span>
                      {en.resistances.map((r, ri) => (
                        <span
                          key={ri}
                          className="rounded bg-secondary/60 px-1 py-0.2 text-[10px] font-mono text-muted-foreground"
                        >
                          {r.element}: {Math.round(r.ratio * 100)}%
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground text-[11px] italic">No enemy data available</div>
          )}
        </div>
      </div>

      {/* Selected Team */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Assigned Team
          </span>
          <span className="text-xs text-muted-foreground">
            3 Resonators • Standard 3-slot Composition
          </span>
        </div>
        <TeamDisplay members={stage.selectedTeam} />
      </div>

      {/* Why This Team Collapsible */}
      <WhyThisTeam stage={stage} />
    </div>
  );
}
