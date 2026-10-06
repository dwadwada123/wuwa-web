/**
 * Team-vs-Stage Scoring Types & Contracts
 */

import type { PatchContext, OwnedRoster, RuleViolation } from '../../domain/types/index.ts';

export interface ScoreDimension {
  score: number; // Raw normalized score [0..100]
  maxScore: number; // 100
  weight: number; // Dimension weight contribution out of 1000
  weightedScore: number; // Math.round((score / maxScore) * weight)
  evidence: string[]; // Machine-readable rationale & facts
}

export interface TeamStageScore {
  candidateKey: string;
  stageKey: string;
  valid: boolean;
  totalScore: number; // Normalized aggregate score [0..1000]
  dimensions: {
    roleCoverage: ScoreDimension;
    elementalMatchup: ScoreDimension;
    enemyMatchup: ScoreDimension;
    stageBuffCompatibility: ScoreDimension;
    offensiveSynergy: ScoreDimension;
    sustain: ScoreDimension;
    resistanceUtility: ScoreDimension;
    coordinatedAttackSynergy: ScoreDimension;
    resourceSynergy: ScoreDimension;
  };
  evidence: string[];
  warnings: RuleViolation[];
}

export interface TeamScoringContext {
  patchContext: PatchContext;
  roster: OwnedRoster;
}
