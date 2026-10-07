'use client';

import type { AvailableCycleMeta } from '../types';

interface CycleSelectorProps {
  availableCycles: AvailableCycleMeta[];
  selectedCycleId: string;
  onSelectCycle: (cycleId: string) => void;
  disabled?: boolean;
}

export function CycleSelector({
  availableCycles,
  selectedCycleId,
  onSelectCycle,
  disabled = false,
}: CycleSelectorProps) {
  const selected =
    availableCycles.find((c) => c.id === selectedCycleId) ||
    availableCycles[0];

  if (!selected) {
    return (
      <div className="rounded-xl border border-border/80 bg-card p-4 text-xs text-muted-foreground">
        No ToA cycle snapshots found.
      </div>
    );
  }

  const formatLocalDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="rounded-xl border border-border/80 bg-card p-5 space-y-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/50 pb-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Target ToA Cycle
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <h3 className="text-base font-bold text-foreground">
              {selected.cycleName}
            </h3>
            {selected.isActive && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Active Cycle
              </span>
            )}
          </div>
        </div>

        {/* Dropdown to switch cycle if multiple cycles exist */}
        {availableCycles.length > 1 && (
          <div className="flex items-center gap-2">
            <label htmlFor="cycle-select" className="text-xs text-muted-foreground">
              Switch Cycle:
            </label>
            <select
              id="cycle-select"
              value={selected.id}
              onChange={(e) => onSelectCycle(e.target.value)}
              disabled={disabled}
              className="rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            >
              {availableCycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.cycleName} (Patch {c.patchVersion})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Cycle & Patch Metadata Grid (Requirement 2) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
        <div className="rounded-lg bg-secondary/30 p-2.5 border border-border/50">
          <div className="text-[10px] text-muted-foreground uppercase font-sans font-semibold">
            Cycle Name
          </div>
          <div className="mt-1 font-bold text-foreground truncate" title={selected.cycleName}>
            {selected.cycleName}
          </div>
        </div>

        <div className="rounded-lg bg-secondary/30 p-2.5 border border-border/50">
          <div className="text-[10px] text-muted-foreground uppercase font-sans font-semibold">
            Patch Snapshot
          </div>
          <div className="mt-1 font-bold text-primary">
            Patch {selected.patchVersion}
          </div>
        </div>

        <div className="rounded-lg bg-secondary/30 p-2.5 border border-border/50">
          <div className="text-[10px] text-muted-foreground uppercase font-sans font-semibold">
            Start Date
          </div>
          <div className="mt-1 text-foreground">
            {formatLocalDate(selected.startTime)}
          </div>
        </div>

        <div className="rounded-lg bg-secondary/30 p-2.5 border border-border/50">
          <div className="text-[10px] text-muted-foreground uppercase font-sans font-semibold">
            End Date
          </div>
          <div className="mt-1 text-foreground">
            {formatLocalDate(selected.endTime)}
          </div>
        </div>
      </div>
    </div>
  );
}
