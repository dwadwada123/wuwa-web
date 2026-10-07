/**
 * Tower of Adversity Optimization UI & View Models
 *
 * Grounded in pure domain models and deterministic engine outputs.
 * Strict client isolation: only lean view models reach the browser.
 */

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

export type StageScopeType = 'FULL_CYCLE' | 'TOWER' | 'CUSTOM';

export interface AvailableCycleMeta {
  id: string;
  patchId: string;
  patchVersion: string;
  cycleName: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

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

export interface StageCardViewModel {
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

export interface TowerGroupViewModel {
  towerId: string;
  towerName: string;
  towerOrder: number;
  stages: StageCardViewModel[];
}

export interface TowerOptimizationViewModel {
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
  towers: TowerGroupViewModel[];
  infeasibilityReasons?: string[];
  metrics: {
    searchStatesExplored: number;
    prunedStatesCount: number;
    durationMs: number;
  };
}

export interface RunOptimizationInput {
  cycleId?: string;
  scope: StageScopeType;
  selectedTowerId?: string;
  selectedStageIds?: string[];
}

export interface RunOptimizationResponse {
  success: boolean;
  code?: 'UNAUTHENTICATED' | 'EMPTY_INVENTORY' | 'NO_VALID_CANDIDATES' | 'CYCLE_NOT_FOUND' | 'ERROR';
  error?: string;
  data?: TowerOptimizationViewModel;
}
