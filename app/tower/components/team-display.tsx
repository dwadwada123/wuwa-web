'use client';

import type { RecommendationTeamMemberViewModel } from '@/lib/services/recommendation/types';

interface TeamDisplayProps {
  members: readonly RecommendationTeamMemberViewModel[];
}

function getBuildStatusBadge(status: string) {
  switch (status) {
    case 'READY':
      return {
        className: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
        label: 'Build Ready',
      };
    case 'ACCEPTABLE':
      return {
        className: 'bg-teal-500/15 border-teal-500/30 text-teal-400',
        label: 'Acceptable',
      };
    case 'NOT_READY':
      return {
        className: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
        label: 'Not Ready',
      };
    case 'UNINVESTED':
    default:
      return {
        className: 'bg-secondary/80 border-border text-muted-foreground',
        label: status,
      };
  }
}

export function TeamDisplay({ members }: TeamDisplayProps) {
  if (!members || members.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/80 p-4 text-center text-xs text-muted-foreground">
        No team assigned to this stage
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
      {members.map((m, idx) => {
        const buildBadge = getBuildStatusBadge(m.buildStatus);

        return (
          <div
            key={`${m.resonatorId}-${idx}`}
            className="flex flex-col justify-between rounded-lg border border-border/70 bg-card/80 p-3 shadow-sm hover:border-border transition-colors"
          >
            <div>
              {/* Header: Resonator ID + Build status badge */}
              <div className="flex items-center justify-between gap-1 flex-wrap">
                <span className="font-bold text-sm text-foreground tracking-tight">
                  {m.resonatorId}
                </span>
                <span
                  className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${buildBadge.className}`}
                >
                  {buildBadge.label}
                </span>
              </div>

              {/* Badges */}
              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                {m.activeSonataCode && (
                  <span className="rounded bg-secondary/80 px-1.5 py-0.2 text-[10px] text-muted-foreground border border-border/40 font-mono">
                    Sonata: {m.activeSonataCode}
                  </span>
                )}
              </div>
            </div>

            {/* Bottom: Investment & Weapon */}
            <div className="mt-3 pt-2 border-t border-border/40 text-[11px] space-y-1">
              <div className="flex items-center justify-between text-muted-foreground font-mono">
                <span>Investment</span>
                <span className="text-foreground font-medium">
                  Lv. {m.characterLevel ?? 'UNKNOWN'} • S{m.sequenceLevel ?? 'UNKNOWN'}
                </span>
              </div>

              <div className="flex items-center justify-between text-muted-foreground truncate font-mono">
                <span className="shrink-0 mr-1">Weapon</span>
                {m.equippedWeaponId ? (
                  <span
                    className="font-medium text-foreground truncate"
                    title={m.equippedWeaponId}
                  >
                    {m.equippedWeaponId} (Lv. {m.weaponLevel ?? '?'}, R{m.weaponRefinement ?? '?'})
                  </span>
                ) : (
                  <span className="italic text-muted-foreground">None</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
