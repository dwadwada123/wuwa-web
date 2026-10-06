/**
 * Global Tower of Adversity Optimization Types
 */

import type {
  ToAStage,
  TeamCandidate,
  OwnedRoster,
  PatchContext,
} from '../../domain/types/index.ts';
import type { TeamStageScore } from '../scoring/types.ts';

export interface StageAssignment {
  stageId: string;
  stageIndex: number;
  vigorCost: number;
  teamKey: string;
  team: TeamCandidate;
  teamScore: TeamStageScore;
}

export interface ResonatorVigorUsage {
  resonatorId: string;
  used: number;
  capacity: number;
  remaining: number;
}

export interface OptimizationObjectiveBreakdown {
  primaryScore: number;
  minStageScore: number;
  totalStageBuffScore: number;
  totalVigorConsumed: number;
  distinctTeamsCount: number;
  canonicalAssignmentKey: string;
}

export interface OptimizationEvidence {
  stageId: string;
  stageIndex: number;
  teamKey: string;
  stageScore: number;
  elementalMatchupScore: number;
  stageBuffScore: number;
  offensiveSynergyScore: number;
  vigorCost: number;
  resonatorsUsed: string[];
  globalReason: string;
}

export interface OptimizationMetrics {
  stagesCount: number;
  candidateStageMatrixSize: number;
  searchStatesExplored: number;
  prunedStatesCount: number;
  durationMs: number;
}

export type OptimizationStatus = 'OPTIMAL' | 'INFEASIBLE';

export interface ToAOptimizationResult {
  status: OptimizationStatus;
  totalScore: number;
  assignments: StageAssignment[];
  vigorUsage: ResonatorVigorUsage[];
  totalVigorConsumed: number;
  distinctTeamsCount: number;
  objectiveBreakdown: OptimizationObjectiveBreakdown;
  evidence: OptimizationEvidence[];
  infeasibilityReasons?: string[];
  metrics: OptimizationMetrics;
}

export interface ToAOptimizationContext {
  cycleId: string;
  patchId: string;
  stages: ToAStage[];
  candidates?: TeamCandidate[];
  scores?: TeamStageScore[] | Map<string, TeamStageScore>;
  roster: OwnedRoster;
  defaultVigorCapacity?: number; // default: 10
  vigorCapacities?: Map<string, number> | Record<string, number>;
  maxCandidatesPerStage?: number; // optional limit for safe candidate reduction in large searches
}
