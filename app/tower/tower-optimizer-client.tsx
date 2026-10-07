'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import type {
  AvailableCycleMeta,
  StageScopeType,
  TowerOptimizationViewModel,
} from './types';
import { runTowerOptimizationAction } from './actions';
import { CycleSelector } from './components/cycle-selector';
import { ScopeSelector, type ScopeTowerInfo } from './components/scope-selector';
import { OptimizationSummary } from './components/optimization-summary';
import { VigorSummaryTable } from './components/vigor-summary-table';
import { TowerSection } from './components/tower-section';

interface TowerOptimizerClientProps {
  availableCycles: AvailableCycleMeta[];
  initialCycleId: string;
  scopeTowers: ScopeTowerInfo[];
  ownedResonatorsCount: number;
}

export function TowerOptimizerClient({
  availableCycles,
  initialCycleId,
  scopeTowers,
  ownedResonatorsCount,
}: TowerOptimizerClientProps) {
  const [selectedCycleId, setSelectedCycleId] = useState<string>(initialCycleId);
  const [scope, setScope] = useState<StageScopeType>('FULL_CYCLE');
  const [selectedTowerId, setSelectedTowerId] = useState<string>(
    scopeTowers[0]?.id || ''
  );
  const [selectedStageIds, setSelectedStageIds] = useState<string[]>(
    scopeTowers.flatMap((t) => t.stages.map((s) => s.id))
  );

  const [isPending, startTransition] = useTransition();
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [results, setResults] = useState<TowerOptimizationViewModel | null>(null);

  const isInventoryInsufficient = ownedResonatorsCount < 3;

  const handleToggleStage = (stageId: string) => {
    setSelectedStageIds((prev) =>
      prev.includes(stageId)
        ? prev.filter((id) => id !== stageId)
        : [...prev, stageId]
    );
  };

  const handleRunOptimization = () => {
    if (isInventoryInsufficient) return;

    setErrorMessage(null);
    setLoadingStep('Initializing server-side engine execution…');

    startTransition(async () => {
      try {
        setLoadingStep('Evaluating roster, stage fit, and global constraints…');
        const res = await runTowerOptimizationAction({
          cycleId: selectedCycleId,
          scope,
          selectedTowerId: scope === 'TOWER' ? selectedTowerId : undefined,
          selectedStageIds: scope === 'CUSTOM' ? selectedStageIds : undefined,
        });

        if (!res.success) {
          setErrorMessage(res.error || 'Optimization failed to complete.');
          setResults(null);
        } else if (res.data) {
          setResults(res.data);
        }
      } catch (err: any) {
        setErrorMessage(
          err.message || 'An unexpected error occurred while running optimization.'
        );
        setResults(null);
      } finally {
        setLoadingStep('');
      }
    });
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Tower of Adversity Optimizer
            </h1>
            <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              Deterministic Engine
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Solve multi-stage Vigor assignments and inspect deterministic team synergy explanations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/inventory"
            className="rounded-lg bg-primary/15 border border-primary/30 px-3.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/25 transition-colors"
          >
            Inventory ({ownedResonatorsCount} Owned)
          </Link>
          <Link
            href="/account"
            className="rounded-lg border border-border px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Account
          </Link>
          <Link
            href="/"
            className="rounded-lg bg-secondary px-3.5 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            Home
          </Link>
        </div>
      </div>

      {/* Insufficient Inventory Warning Banner (Requirement 16) */}
      {isInventoryInsufficient && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-3 w-3 rounded-full bg-amber-400" />
            <h3 className="text-sm font-bold text-amber-300">
              Insufficient Resonators in Roster
            </h3>
          </div>
          <p className="text-xs text-amber-200/90 leading-relaxed">
            You currently have only <strong>{ownedResonatorsCount}</strong> Resonator(s) marked
            as owned. A valid Tower of Adversity team requires at least 3 Resonators. Please add
            more Resonators to your inventory before optimizing.
          </p>
          <div>
            <Link
              href="/inventory"
              className="inline-flex items-center rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-bold text-background hover:bg-amber-400 transition-colors shadow-sm"
            >
              Add Resonators in Inventory →
            </Link>
          </div>
        </div>
      )}

      {/* Error Message Banner (Requirement 15) */}
      {errorMessage && (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold">Error:</span>
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs underline hover:text-destructive/80 shrink-0 ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Configuration Controls */}
      <div className="space-y-4">
        {/* Cycle Selection */}
        <CycleSelector
          availableCycles={availableCycles}
          selectedCycleId={selectedCycleId}
          onSelectCycle={setSelectedCycleId}
          disabled={isPending}
        />

        {/* Scope Selection */}
        <ScopeSelector
          scope={scope}
          onChangeScope={setScope}
          towers={scopeTowers}
          selectedTowerId={selectedTowerId}
          onSelectTower={setSelectedTowerId}
          selectedStageIds={selectedStageIds}
          onToggleStage={handleToggleStage}
          disabled={isPending}
        />

        {/* Action Execution Bar (Requirement 14) */}
        <div className="rounded-xl border border-border/80 bg-card p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Optimizer Execution Mode
            </div>
            <div className="text-sm font-semibold text-foreground flex items-center gap-2 mt-0.5">
              <span>BEST_EFFORT</span>
              <span className="text-xs text-muted-foreground font-normal">
                (200,000 Branch &amp; Bound search-state budget)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isPending && (
              <span className="text-xs text-primary animate-pulse font-medium">
                {loadingStep || 'Optimizing…'}
              </span>
            )}

            <button
              onClick={handleRunOptimization}
              disabled={isPending || isInventoryInsufficient}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                  Running Optimization…
                </span>
              ) : (
                'Run Optimization →'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Optimization Results Section (Requirements 6 - 13) */}
      {results && (
        <div className="space-y-8 pt-4 border-t border-border">
          {/* 1. Global Optimization Summary */}
          <OptimizationSummary data={results} />

          {/* 2. Vigor Allocation Summary Table */}
          <VigorSummaryTable vigor={results.vigorSummary} />

          {/* 3. Tower & Floor Hierarchy (Requirement 6) */}
          <div className="space-y-8">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Tower Stage Assignments
                </h2>
                <p className="text-xs text-muted-foreground">
                  Selected 3-resonator team assignments with stage scores and deterministic selection evidence.
                </p>
              </div>
            </div>

            {results.towers.map((tower) => (
              <TowerSection key={tower.towerId} tower={tower} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
