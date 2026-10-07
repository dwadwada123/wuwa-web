'use client';

import type { StageScopeType } from '../types';

export interface ScopeStageInfo {
  id: string;
  stageIndex: number;
  vigorCost: number;
  towerId: string;
  towerName: string;
}

export interface ScopeTowerInfo {
  id: string;
  name: string;
  stages: ScopeStageInfo[];
}

interface ScopeSelectorProps {
  scope: StageScopeType;
  onChangeScope: (scope: StageScopeType) => void;
  towers: ScopeTowerInfo[];
  selectedTowerId: string;
  onSelectTower: (towerId: string) => void;
  selectedStageIds: string[];
  onToggleStage: (stageId: string) => void;
  disabled?: boolean;
}

export function ScopeSelector({
  scope,
  onChangeScope,
  towers,
  selectedTowerId,
  onSelectTower,
  selectedStageIds,
  onToggleStage,
  disabled = false,
}: ScopeSelectorProps) {
  const totalStagesCount = towers.reduce((acc, t) => acc + t.stages.length, 0);

  return (
    <div className="rounded-xl border border-border/80 bg-card p-5 space-y-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/50 pb-3">
        <div>
          <h3 className="text-sm font-bold text-foreground">
            Stage Optimization Scope
          </h3>
          <p className="text-xs text-muted-foreground">
            Select whether to optimize the entire cycle rotation, a single tower, or custom floors.
          </p>
        </div>

        {/* Scope Pill Toggle */}
        <div
          role="radiogroup"
          aria-label="Optimization stage scope"
          className="inline-flex rounded-lg border border-border bg-secondary/40 p-1"
        >
          {(
            [
              { id: 'FULL_CYCLE', label: 'Full Cycle' },
              { id: 'TOWER', label: 'Single Tower' },
              { id: 'CUSTOM', label: 'Custom Stages' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={scope === item.id}
              onClick={() => onChangeScope(item.id)}
              disabled={disabled}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                scope === item.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scope Details */}
      {scope === 'FULL_CYCLE' && (
        <div className="rounded-lg bg-secondary/20 p-3 border border-border/50 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Optimizing all {totalStagesCount} stages across all {towers.length} towers simultaneously.
          </span>
          <span className="font-bold text-foreground font-mono">
            {totalStagesCount} Stages Included
          </span>
        </div>
      )}

      {scope === 'TOWER' && (
        <div className="space-y-3 pt-1">
          <span className="text-xs font-medium text-muted-foreground">
            Choose Target Tower:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {towers.map((t) => {
              const isSelected = selectedTowerId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelectTower(t.id)}
                  disabled={disabled}
                  className={`rounded-lg border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    isSelected
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : 'border-border/70 bg-secondary/30 hover:bg-secondary/50'
                  } disabled:opacity-50`}
                >
                  <div className="text-xs font-bold text-foreground">{t.name}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {t.stages.length} Floors
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {scope === 'CUSTOM' && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Select individual stages to optimize:</span>
            <span className="font-mono font-bold text-foreground">
              {selectedStageIds.length} Selected
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {towers.map((t) => (
              <div
                key={t.id}
                className="rounded-lg border border-border/60 bg-secondary/20 p-3 space-y-2"
              >
                <div className="text-xs font-bold text-foreground">{t.name}</div>
                <div className="space-y-1.5">
                  {t.stages.map((st) => {
                    const isChecked = selectedStageIds.includes(st.id);
                    return (
                      <label
                        key={st.id}
                        className="flex items-center gap-2 text-xs text-foreground/90 cursor-pointer hover:text-foreground"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => onToggleStage(st.id)}
                          disabled={disabled}
                          className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                        />
                        <span>Floor {st.stageIndex}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          ({st.vigorCost}v)
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
