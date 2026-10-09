/**
 * Wuthering Waves Deterministic End-to-End Recommendation Orchestration Types
 * Phase 7 Step 24: Deterministic End-to-End Recommendation Orchestration Contract
 *
 * Defines contracts, input snapshots, provenance structures, status definitions,
 * and result containers for composing Steps 19–23 into an end-to-end recommendation pipeline.
 */

import type { CharacterBuildEvaluation } from '../character-build-evaluation/types.ts';
import type { TeamPortfolio, TeamPortfolioResult } from '../team-portfolio/types.ts';
import type { ToAAllocation, ToAAllocationResult, ToAStageDefinition } from '../toa-allocation/types.ts';
import type { OwnedRosterSnapshot } from '../roster/types.ts';
import type { ResonatorInvestmentSnapshot } from '../investment/types.ts';

export type {
  CharacterBuildEvaluation,
  TeamPortfolio,
  TeamPortfolioResult,
  ToAAllocation,
  ToAAllocationResult,
  ToAStageDefinition,
  OwnedRosterSnapshot,
  ResonatorInvestmentSnapshot
};

/**
 * Deterministic status taxonomy for End-to-End Recommendation Orchestration.
 * Strictly distinguishes solution quality, full target coverage, and equipment completeness.
 */
export type RecommendationOrchestrationStatus =
  | 'OPTIMAL_RECOMMENDATION'     // Complete ToA coverage, optimal lexicographic schedule, 100% fully equipped portfolio teams
  | 'FEASIBLE_RECOMMENDATION'    // Complete ToA coverage, valid complete schedule, but one or more teams carry partial/fallback equipment
  | 'PARTIAL_RECOMMENDATION'     // Incomplete stage coverage permitted under allowPartial: true
  | 'NO_FEASIBLE_ALLOCATION'     // Valid portfolio selected, but cannot schedule requested ToA stages within Vigor constraints
  | 'NO_FEASIBLE_PORTFOLIO'      // Valid candidates exist, but cannot form target K disjoint teams within owned roster
  | 'INSUFFICIENT_ROSTER'        // Owned roster has fewer than 3 Resonators (cannot form even 1 team)
  | 'UPSTREAM_EVALUATION_FAILED' // An upstream engine rejected inputs or failed invariant verification
  | 'INVALID_INPUT';             // Input snapshot failed validation at orchestration boundary

/**
 * Validated summary of input constraints and snapshot identity.
 */
export interface ValidatedInputSnapshotSummary {
  /** Patch identifier (strictly '3.7') */
  readonly patchVersion: '3.7';
  /** Season identifier (strictly 'season:40') */
  readonly seasonId: 'season:40';
  /** Count of valid canonical owned Resonators */
  readonly ownedResonatorCount: number;
  /** Lexicographically sorted canonical owned Resonator IDs */
  readonly ownedResonatorIds: readonly string[];
  /** Count of provided investment snapshots */
  readonly investmentSnapshotCount: number;
  /** Preserved investment snapshot inputs for canonical auditability */
  readonly investmentSnapshots: readonly ResonatorInvestmentSnapshot[];
  /** Target portfolio size K (teams) */
  readonly targetK: number;
  /** Target ToA stage count */
  readonly targetStageCount: number;
  /** Target ToA stage identifiers */
  readonly targetStageIds: readonly string[];
  /** Whether partial scheduling is permitted */
  readonly allowPartial: boolean;
  /** Deterministic SHA-256 fingerprint of input constraints */
  readonly snapshotFingerprint: string;
}

/**
 * Flexible input parameter shape for deriveSnapshotFingerprint.
 */
export interface SnapshotFingerprintInput {
  readonly patchVersion?: string;
  readonly seasonId?: string;
  readonly ownedResonatorCount?: number;
  readonly ownedResonatorIds: readonly string[];
  readonly investmentSnapshotCount?: number;
  readonly investmentSnapshots?: readonly ResonatorInvestmentSnapshot[];
  readonly targetK: number;
  readonly targetStageCount?: number;
  readonly targetStageIds: readonly string[];
  readonly allowPartial: boolean;
}

/**
 * Authoritative provenance record for End-to-End Recommendation.
 */
export interface RecommendationOrchestrationProvenance {
  readonly source: 'DERIVED_END_TO_END_RECOMMENDATION';
  readonly patchVersion: '3.7';
  readonly ruleVersion: '7.24.1';
  readonly seasonId: 'season:40';
  readonly snapshotFingerprint: string;
  readonly step19RuleVersion: '7.19.1';
  readonly step20RuleVersion: '7.20.1';
  readonly step21RuleVersion: '7.21.1';
  readonly step22RuleVersion: '7.22.1';
  readonly step23RuleVersion: '7.23.1';
  readonly portfolioId: string | null;
  readonly toaAllocationId: string | null;
  readonly allowPartial: boolean;
  readonly allRequestedStagesCovered: boolean;
  readonly hasFallbackEquipment: boolean;
}

/**
 * Quantitative metrics summarizing the end-to-end recommendation pipeline.
 */
export interface RecommendationOrchestrationMetrics {
  readonly patchVersion: '3.7';
  readonly ruleVersion: '7.24.1';
  readonly seasonId: 'season:40';
  readonly ownedResonatorCount: number;
  readonly evaluatedCharacterCount: number;
  readonly selectedTeamCount: number;
  readonly targetTeamCount: number;
  readonly assignedStageCount: number;
  readonly targetStageCount: number;
  readonly stageCoverageRatio: number;
  readonly totalVigorConsumed: number;
  readonly distinctResonatorsUsedCount: number;
  readonly verifiedAt: string;
}

/**
 * Core auditable EndToEndRecommendation domain model.
 */
export interface EndToEndRecommendation {
  /** Deterministic unique identifier */
  readonly id: string;
  readonly patchVersion: '3.7';
  readonly ruleVersion: '7.24.1';
  readonly seasonId: 'season:40';
  readonly status: RecommendationOrchestrationStatus;
  readonly inputSnapshot: ValidatedInputSnapshotSummary;
  readonly characterBuildEvaluations: readonly CharacterBuildEvaluation[];
  readonly portfolio: TeamPortfolio | null;
  readonly toaAllocation: ToAAllocation | null;
  readonly explanationCodes: readonly string[];
  readonly infeasibilityReasons?: readonly string[];
  readonly provenance: RecommendationOrchestrationProvenance;
}

/**
 * Public result container for Step 24 recommendation orchestration.
 */
export interface RecommendationOrchestrationResult {
  readonly patchId: '3.7';
  readonly ruleVersion: '7.24.1';
  readonly seasonId: 'season:40';
  readonly recommendation: EndToEndRecommendation;
  readonly metrics: RecommendationOrchestrationMetrics;
}

/**
 * Input configuration for orchestrating end-to-end recommendations.
 */
export interface RecommendationOrchestrationInput {
  /** Patch identifier (strictly '3.7') */
  readonly patchId?: string;
  /** Rule version (strictly '7.24.1') */
  readonly ruleVersion?: string;
  /** Season identifier (strictly 'season:40') */
  readonly seasonId?: string;
  /** User-owned Resonator roster snapshot or ID list */
  readonly ownedRoster?: readonly string[] | OwnedRosterSnapshot;
  /** Optional investment snapshots for owned Resonators */
  readonly investmentSnapshots?: readonly ResonatorInvestmentSnapshot[];
  /** Desired portfolio size K (default: 3) */
  readonly targetK?: number;
  /** Target ToA stage IDs (default: all 12 Season 40 stages) */
  readonly targetStageIds?: readonly string[];
  /** Allow partial scheduling if Vigor or candidate pool is exhausted (default: false) */
  readonly allowPartial?: boolean;
}
