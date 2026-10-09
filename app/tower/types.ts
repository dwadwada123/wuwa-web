/**
 * Tower of Adversity UI & View Models
 * Phase 7 Step 25: Application Service & Inventory Adapter Integration
 *
 * Grounded strictly in pure domain models and deterministic Step 24 engine outputs.
 * Strict client isolation: only lean, factual view models reach the browser.
 */

import type {
  RecommendationViewModel,
  RecommendationStageViewModel,
  RecommendationTowerGroupViewModel,
  RecommendationTeamViewModel,
  RecommendationTeamMemberViewModel,
  RecommendationVigorLedgerEntryViewModel,
  StageScopeType,
  RecommendationErrorCode,
} from '@/lib/services/recommendation/types';

import type {
  OptimizationStatus,
  OptimizationOptimality,
  OptimizationMode,
} from '@/lib/engine/optimization/types';
import type {
  ExplanationReason,
  StageScoreBreakdown,
  VigorExplanation,
  OptimalityExplanation,
} from '@/lib/engine/explanation/types';

export type {
  StageScopeType,
  RecommendationViewModel,
  RecommendationStageViewModel,
  RecommendationTowerGroupViewModel,
  RecommendationTeamViewModel,
  RecommendationTeamMemberViewModel,
  RecommendationVigorLedgerEntryViewModel,
  RecommendationErrorCode,
};

// Authoritative Step 25 types for Tower UI
export type TowerOptimizationViewModel = RecommendationViewModel;
export type StageCardViewModel = RecommendationStageViewModel;
export type TowerGroupViewModel = RecommendationTowerGroupViewModel;

export interface AvailableCycleMeta {
  id: string;
  patchId: string;
  patchVersion: string;
  cycleName: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export interface RunOptimizationInput {
  cycleId?: string;
  scope: StageScopeType;
  selectedTowerId?: string;
  selectedStageIds?: string[];
  targetK?: number;
  allowPartial?: boolean;
}

export interface RunOptimizationResponse {
  success: boolean;
  code?: RecommendationErrorCode | 'EMPTY_INVENTORY' | 'CYCLE_NOT_FOUND' | 'ERROR';
  error?: string;
  data?: TowerOptimizationViewModel;
}

/* =========================================================================
 * Legacy Heuristic Types (Preserved for legacy test harness compatibility)
 * ========================================================================= */

export interface StageResonatorViewModel {
  id: string;
  name: string;
  element: string;
  weaponType: string;
  rarity: number;
  role: string;
  level?: number;
  waveband?: number;
  equippedWeapon?: {
    id: string;
    name: string;
    rarity: number;
    weaponType: string;
    level?: number;
    refinement?: number;
  } | null;
}

export interface EnemyInstanceSummary {
  id: string;
  name: string;
  enemyClass: string;
  level: number;
  resistances: Array<{ element: string; ratio: number }>;
}

export interface AreaEffectSummary {
  id: string;
  name: string;
  description: string;
  category: string;
}

export interface LegacyStageCardViewModel {
  stageId: string;
  stageKey: string;
  towerName: string;
  floor: number;
  stageIndex: number;
  vigorCost: number;
  stageScore: number;
  scoreBreakdown: StageScoreBreakdown;
  selectedTeam: StageResonatorViewModel[];
  enemySummary: EnemyInstanceSummary[];
  areaBuffs: AreaEffectSummary[];
  challengeGoals: Array<{ targetTimeSeconds: number; points: number }>;
  primaryReasons: ExplanationReason[];
  supportingReasons: ExplanationReason[];
  tradeoffs: ExplanationReason[];
  resourceImpact: {
    stageCost: number;
    characterVigorConsumed: number;
    summary: string;
    members: Array<{
      resonatorId: string;
      name: string;
      stageCost: number;
      usedBeforeStage: number;
      usedAfterStage: number;
      capacity: number;
      remainingAfterStage: number;
    }>;
  };
}

export interface LegacyTowerGroupViewModel {
  towerId: string;
  towerName: string;
  towerOrder: number;
  stages: LegacyStageCardViewModel[];
}

export interface LegacyTowerOptimizationViewModel {
  cycle: {
    id: string;
    name: string;
    patchVersion: string;
    snapshotDate: string;
    startTime: string;
    endTime: string;
  };
  scope: StageScopeType;
  status: OptimizationStatus;
  mode: OptimizationMode;
  optimality?: OptimizationOptimality;
  optimalityExplanation: OptimalityExplanation;
  totalScore: number;
  globalPrimaryUpperBound?: number;
  stagesCount: number;
  assignedStagesCount: number;
  distinctTeamsCount: number;
  totalVigorConsumed: number;
  bottleneckResonators: string[];
  vigorSummary: VigorExplanation;
  globalTradeoffs: ExplanationReason[];
  summaryReasons: ExplanationReason[];
  towers: LegacyTowerGroupViewModel[];
  infeasibilityReasons?: string[];
  metrics: {
    searchStatesExplored: number;
    prunedStatesCount: number;
    durationMs: number;
  };
}
