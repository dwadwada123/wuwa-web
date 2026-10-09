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
          allowPartial: true,
        });

        if (!res.success) {
          setErrorMessage(res.error || 'Recommendation failed to complete.');
          setResults(null);
        } else if (res.data) {
          setResults(res.data);
        }
      } catch (err: any) {
        setErrorMessage(
          err.message || 'An unexpected error occurred while running recommendation.'
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
            Solve multi-stage Vigor allocations and inspect factual deterministic recommendations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-secondary/80 border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground">
            {ownedResonatorsCount} Resonators Available
          </span>
        </div>
      </div>

      {/* Insufficient Inventory Warning Banner */}
      {isInventoryInsufficient && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 space-y-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="flex h-3 w-3 rounded-full bg-amber-400 animate-ping" />
            <h3 className="text-sm font-bold text-amber-300">
              Roster Chưa Đủ Nhân Vật Để Tạo Đội Hình
            </h3>
          </div>
          <p className="text-xs text-amber-200/90 leading-relaxed">
            Bạn hiện chỉ có <strong>{ownedResonatorsCount}</strong> nhân vật trong Roster. Tower of Adversity yêu cầu tối thiểu <strong>3 nhân vật</strong> để lập thành 1 đội hình hợp lệ tham gia chiến đấu. Vui lòng bổ sung thêm ít nhất <strong>{3 - ownedResonatorsCount} nhân vật</strong> nữa vào Roster trước khi thực hiện tối ưu hóa tự động.
          </p>
          <div>
            <Link
              href="/inventory"
              prefetch={true}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-background hover:bg-amber-400 transition-colors shadow-sm"
            >
              <span>+ Thêm Nhân Vật Trong Kho Roster →</span>
            </Link>
          </div>
        </div>
      )}

      {/* Error Message Banner */}
      {errorMessage && (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold">Lỗi:</span>
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-xs underline hover:text-destructive/80 shrink-0 ml-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive rounded"
          >
            Đóng
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

        {/* Dedicated Auto-Build Team from Roster Section (Requirement 4) */}
        <div className="rounded-2xl border-2 border-primary/40 bg-gradient-to-r from-card via-card/90 to-primary/10 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-5 shadow-lg shadow-primary/5">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/15 border border-primary/30 px-3 py-0.5 text-xs font-bold text-primary">
              <span>⚡ TÍNH NĂNG CHỦ ĐẠO</span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-foreground tracking-tight">
              Tự Động Xây Team Từ Roster Đang Sở Hữu
            </h2>
            <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
              Sử dụng danh sách {ownedResonatorsCount} nhân vật bạn thực sự sở hữu và Recommendation Engine Phase 7 để tự động phân bổ đội hình tối ưu, gán vai trò từng thành viên và tính toán thể lực Vigor cho từng tầng tháp.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {isPending && (
              <span className="text-xs text-primary animate-pulse font-medium">
                {loadingStep || 'Đang tính toán đề xuất…'}
              </span>
            )}

            <button
              type="button"
              id="btn-auto-build-team"
              onClick={handleRunOptimization}
              disabled={isPending || isInventoryInsufficient}
              aria-label="Tự động xây team từ roster"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-extrabold text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                  Đang tạo team tự động…
                </span>
              ) : (
                <>
                  <span>⚡ Tự động xây team từ Roster</span>
                  <span>→</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Recommendation Results Section */}
      {results && (
        <div className="space-y-8 pt-4 border-t border-border">
          {/* 1. Orchestration Summary */}
          <OptimizationSummary data={results} />

          {/* 2. Vigor Allocation Summary Table */}
          <VigorSummaryTable
            ledger={results.vigorLedger}
            totalVigorConsumed={results.metrics.totalVigorConsumed}
          />

          {/* 3. Tower & Floor Stage Assignments */}
          <div className="space-y-8">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Tower Stage Assignments
                </h2>
                <p className="text-xs text-muted-foreground">
                  Authoritative stage assignments with team compositions and member build statuses.
                </p>
              </div>
            </div>

            {results.towers.map((tower) => (
              <TowerSection
                key={tower.towerId}
                tower={tower}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
