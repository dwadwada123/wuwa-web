'use client';

import type { RecommendationVigorLedgerEntryViewModel } from '@/lib/services/recommendation/types';

interface VigorSummaryTableProps {
  ledger: readonly RecommendationVigorLedgerEntryViewModel[];
  totalVigorConsumed: number;
}

export function VigorSummaryTable({ ledger, totalVigorConsumed }: VigorSummaryTableProps) {
  if (!ledger || ledger.length === 0) {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-6 text-center text-sm text-muted-foreground">
        No Vigor usage data available.
      </div>
    );
  }

  const totalCapacity = ledger.reduce((acc, r) => acc + r.startingVigor, 0);
  const utilizationPercentage = totalCapacity > 0 ? Math.round((totalVigorConsumed / totalCapacity) * 100) : 0;
  const bottlenecks = ledger.filter((r) => r.vigorConsumed > 0 && r.vigorRemaining === 0);

  return (
    <div className="rounded-xl border border-border/80 bg-card p-5 space-y-4 shadow-sm">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/50 pb-4">
        <div>
          <h3 className="text-base font-bold text-foreground tracking-tight">
            Vigor Allocation Summary
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Authoritative stamina accounting across all participating Resonators.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-1.5 text-right font-mono">
            <div className="text-[10px] text-muted-foreground uppercase font-semibold">
              Consumed / Capacity
            </div>
            <div className="text-xs font-bold text-foreground">
              {totalVigorConsumed} / {totalCapacity} ({utilizationPercentage}%)
            </div>
          </div>
        </div>
      </div>

      {/* Bottlenecks banner if any */}
      {bottlenecks.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 flex items-start gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-400 mt-1 shrink-0" />
          <div>
            <span className="font-bold">Fully Exhausted Resonators: </span>
            <span>
              {bottlenecks.length} character(s) reached 0 stamina reserve:{' '}
              <strong className="text-amber-200">
                {bottlenecks.map((b) => b.resonatorId).join(', ')}
              </strong>
            </span>
          </div>
        </div>
      )}

      {/* Vigor Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse" aria-label="Vigor allocation summary">
          <caption className="sr-only">Authoritative stamina accounting across all participating Resonators</caption>
          <thead>
            <tr className="border-b border-border text-muted-foreground uppercase font-bold text-[10px] tracking-wider">
              <th className="py-2.5 px-3">Resonator</th>
              <th className="py-2.5 px-3 text-center">Used</th>
              <th className="py-2.5 px-3 text-center">Starting</th>
              <th className="py-2.5 px-3 text-center">Remaining</th>
              <th className="py-2.5 px-3">Assigned Stages</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 font-mono">
            {ledger.map((r) => {
              const isBottleneck = r.vigorConsumed > 0 && r.vigorRemaining === 0;
              const isUnused = r.vigorConsumed === 0;

              return (
                <tr
                  key={r.resonatorId}
                  className={`hover:bg-secondary/20 transition-colors ${
                    isBottleneck ? 'bg-amber-500/5' : ''
                  }`}
                >
                  <td className="py-2.5 px-3 font-sans font-semibold text-foreground">
                    <div className="flex items-center gap-1.5">
                      <span>{r.resonatorId}</span>
                      {isBottleneck && (
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.2 text-[9px] font-bold text-amber-400 uppercase font-sans">
                          Exhausted
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-foreground">
                    {r.vigorConsumed}
                  </td>
                  <td className="py-2.5 px-3 text-center text-muted-foreground">
                    {r.startingVigor}
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold">
                    <span
                      className={
                        r.vigorRemaining === 0
                          ? 'text-amber-400'
                          : isUnused
                          ? 'text-muted-foreground'
                          : 'text-emerald-400'
                      }
                    >
                      {r.vigorRemaining}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-sans">
                    {r.assignedStageIds.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1">
                        {r.assignedStageIds.map((stId, i) => (
                          <span
                            key={i}
                            className="rounded bg-secondary/80 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground border border-border/50"
                          >
                            {stId}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-[11px] italic">
                        Unassigned
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
