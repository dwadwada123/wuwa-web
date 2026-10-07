'use client';

import type { VigorExplanation } from '@/lib/engine/explanation/types';

interface VigorSummaryTableProps {
  vigor: VigorExplanation;
}

export function VigorSummaryTable({ vigor }: VigorSummaryTableProps) {
  if (!vigor || !vigor.resonators || vigor.resonators.length === 0) {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-6 text-center text-sm text-muted-foreground">
        No Vigor usage data available.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/80 bg-card p-5 space-y-4 shadow-sm">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/50 pb-4">
        <div>
          <h3 className="text-base font-bold text-foreground tracking-tight">
            Vigor Allocation Summary
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Authoritative stamina accounting across all owned Resonators.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-1.5 text-right font-mono">
            <div className="text-[10px] text-muted-foreground uppercase font-semibold">
              Consumed / Capacity
            </div>
            <div className="text-xs font-bold text-foreground">
              {vigor.totalVigorConsumed} / {vigor.totalRosterVigorCapacity} (
              {vigor.utilizationPercentage}%)
            </div>
          </div>
        </div>
      </div>

      {/* Bottlenecks banner if any */}
      {vigor.bottleneckResonators.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 flex items-start gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-400 mt-1 shrink-0" />
          <div>
            <span className="font-bold">Bottleneck Resonators: </span>
            <span>
              {vigor.bottleneckResonators.length} character(s) reached full stamina exhaustion
              (0 remaining):{' '}
              <strong className="text-amber-200">
                {vigor.bottleneckResonators.join(', ')}
              </strong>
            </span>
          </div>
        </div>
      )}

      {/* Vigor Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border text-muted-foreground uppercase font-bold text-[10px] tracking-wider">
              <th className="py-2.5 px-3">Resonator</th>
              <th className="py-2.5 px-3 text-center">Used</th>
              <th className="py-2.5 px-3 text-center">Capacity</th>
              <th className="py-2.5 px-3 text-center">Remaining</th>
              <th className="py-2.5 px-3">Stage Assignments</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 font-mono">
            {vigor.resonators.map((r) => {
              const isBottleneck = r.used > 0 && r.remaining === 0;
              const isUnused = r.used === 0;

              return (
                <tr
                  key={r.resonatorId}
                  className={`hover:bg-secondary/20 transition-colors ${
                    isBottleneck ? 'bg-amber-500/5' : ''
                  }`}
                >
                  <td className="py-2.5 px-3 font-sans font-semibold text-foreground">
                    <div className="flex items-center gap-1.5">
                      <span>{r.name}</span>
                      {isBottleneck && (
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.2 text-[9px] font-bold text-amber-400 uppercase font-sans">
                          Exhausted
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-foreground">
                    {r.used}
                  </td>
                  <td className="py-2.5 px-3 text-center text-muted-foreground">
                    {r.capacity}
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold">
                    <span
                      className={
                        r.remaining === 0
                          ? 'text-amber-400'
                          : isUnused
                          ? 'text-muted-foreground'
                          : 'text-emerald-400'
                      }
                    >
                      {r.remaining}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-sans">
                    {r.stagesAssigned.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1">
                        {r.stagesAssigned.map((st, i) => (
                          <span
                            key={i}
                            className="rounded bg-secondary/80 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground border border-border/50"
                          >
                            Floor {st.stageIndex} ({st.vigorCost}v)
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
