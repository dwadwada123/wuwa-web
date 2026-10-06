/**
 * Deterministic ToA Optimization Explanation Layer Types
 *
 * Grounded in domain models, score breakdowns, Vigor allocations, and optimizer results.
 */

import type {
  OptimizationStatus,
  OptimizationOptimality,
} from '../optimization/types.ts';

export type ExplanationReasonCategory =
  | 'STAGE_MATCHUP'
  | 'ENEMY_MATCHUP'
  | 'AREA_EFFECT'
  | 'ROLE_COVERAGE'
  | 'OFFENSIVE_SYNERGY'
  | 'SUSTAIN'
  | 'RESOURCE'
  | 'VIGOR'
  | 'GLOBAL_OPTIMIZATION'
  | 'TRADEOFF';

export type ExplanationImportance = 'PRIMARY' | 'SECONDARY' | 'INFO';

export interface ExplanationReason {
  code: string;
  category: ExplanationReasonCategory;
  importance: ExplanationImportance;
  title: string;
  facts: Record<string, unknown>;
}

export type ExplanationEvidenceSource =
  | 'RULE_ENGINE'
  | 'TEAM_SCORING'
  | 'OPTIMIZER'
  | 'GAME_DATA';

export interface ExplanationEvidence {
  source: ExplanationEvidenceSource;
  code: string;
  facts: Record<string, unknown>;
}

export interface DimensionScoreExplanation {
  score: number; // Raw normalized score [0..100]
  maxScore: number; // 100
  weight: number; // Dimension weight contribution out of 1000
  weightedScore: number; // Raw * Weight / Max
  evidence: string[];
}

export interface TopDimensionContributor {
  dimensionKey: string;
  name: string;
  weightedScore: number;
  maxWeight: number;
  percentageOfMax: number;
}

export interface StageScoreBreakdown {
  totalScore: number;
  maxTotalScore: number;
  dimensions: {
    roleCoverage: DimensionScoreExplanation;
    elementalMatchup: DimensionScoreExplanation;
    enemyMatchup: DimensionScoreExplanation;
    stageBuffCompatibility: DimensionScoreExplanation;
    offensiveSynergy: DimensionScoreExplanation;
    sustain: DimensionScoreExplanation;
    resistanceUtility: DimensionScoreExplanation;
    coordinatedAttackSynergy: DimensionScoreExplanation;
    resourceSynergy: DimensionScoreExplanation;
  };
  topContributors: TopDimensionContributor[];
}

export interface MemberVigorImpact {
  resonatorId: string;
  name: string;
  stageCost: number;
  usedBeforeStage: number;
  usedAfterStage: number;
  capacity: number;
  remainingAfterStage: number;
}

export interface ResourceExplanation {
  stageCost: number;
  characterVigorConsumed: number;
  members: MemberVigorImpact[];
  summary: string;
}

export interface StageExplanation {
  stageKey: string;
  towerName: string;
  floor: number;

  selectedTeamKey: string;
  score: number;
  scoreBreakdown: StageScoreBreakdown;

  primaryReasons: ExplanationReason[];
  supportingReasons: ExplanationReason[];
  tradeoffs: ExplanationReason[];
  resourceImpact: ResourceExplanation;
}

export interface ResonatorVigorSummary {
  resonatorId: string;
  name: string;
  used: number;
  capacity: number;
  remaining: number;
  stagesAssigned: Array<{
    stageId: string;
    stageIndex: number;
    vigorCost: number;
  }>;
}

export interface VigorExplanation {
  totalVigorConsumed: number;
  totalRosterVigorCapacity: number;
  utilizationPercentage: number;
  resonators: ResonatorVigorSummary[];
  bottleneckResonators: string[]; // Resonators with 0 remaining Vigor
  unexhaustedResonators: string[]; // Resonators with > 0 remaining Vigor
  summary: string;
}

export interface OptimalityExplanation {
  status: OptimizationStatus;
  optimality?: OptimizationOptimality;
  title: string;
  description: string;
  isGloballyOptimalPrimary: boolean;
  isFullLexicographicOptimal: boolean;
  achievedScore: number;
  globalPrimaryUpperBound?: number;
}

export interface GlobalOptimizationExplanation {
  status: OptimizationStatus;
  optimality?: OptimizationOptimality;
  optimalityExplanation: OptimalityExplanation;

  summaryReasons: ExplanationReason[];

  stages: StageExplanation[];

  totalScore: number;
  globalPrimaryUpperBound?: number;

  vigor: VigorExplanation;

  globalTradeoffs: ExplanationReason[];

  evidence: ExplanationEvidence[];
}
