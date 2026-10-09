/**
 * Wuthering Waves Deterministic Team Composition Evidence Ranking Types
 * Phase 7 Step 11: Deterministic Team Composition Evidence Ranking & Ordering Contract
 *
 * Defines contracts for establishing a deterministic ordering over approved Step 10
 * TeamCompositionCandidateEvaluation objects.
 *
 * CRITICAL ARCHITECTURAL BOUNDARIES:
 * 1. TEAM COMPOSITION EVIDENCE RANK != TEAM GAMEPLAY POWER != TEAM DPS != TOA FITNESS.
 *    A higher rank means only: "higher deterministic structured-evidence support according to Step 10".
 *    It does NOT mean "better team in actual gameplay".
 * 2. ORDERING ONLY: Step 11 is an ordering layer, NOT a new scoring layer.
 *    Step 10 score remains authoritative and immutable.
 * 3. FAIL-CLOSED STATUS GATING: Only candidates with non-null, finite Step 10 scores
 *    become RANKED (1..N). Blocked candidates strictly become UNRANKABLE (rank: null).
 * 4. FULL CANDIDATE SPACE: All 34,220 theoretical teams are preserved and representable.
 * 5. PURE & OFFLINE: Zero network, zero LLMs, zero random IDs, zero timestamps.
 */

import type { SourceReference } from '../../capabilities/types.ts';
import type { CharacterPairSynergyCategory } from '../../relationships/character-pairs/synergy/types.ts';
import type {
  TeamCompositionQualificationStatus,
  TeamCompositionQualificationType
} from '../types.ts';
import type { TeamCompositionEvaluationStatus } from '../evaluation/types.ts';

export type {
  SourceReference,
  CharacterPairSynergyCategory,
  TeamCompositionQualificationStatus,
  TeamCompositionQualificationType,
  TeamCompositionEvaluationStatus
};

/**
 * Closed ranking status taxonomy.
 * Distinguishes candidates with evaluable evidence from blocked candidates.
 */
export type TeamCompositionRankingStatus =
  | 'RANKED'      // Has valid finite Step 10 totalScore; participates in deterministic ordering (rank: 1..N)
  | 'UNRANKABLE'; // totalScore is null; evidence is missing context, unmodeled, or blocked (rank: null)

/**
 * Authoritative TeamCompositionEvidenceRanking contract.
 * Represents the deterministic evidence-based rank of a 3-character team candidate.
 */
export interface TeamCompositionEvidenceRanking {
  /** Deterministic identifier: team-composition-ranking:3.7:<candidateId>:7.11.1 */
  readonly id: string;
  /** Strictly Patch 3.7 */
  readonly patchVersion: '3.7';
  /** Ranking rule version: 7.11.1 */
  readonly ruleVersion: '7.11.1';

  /** ID of the evaluated Step 9 TeamCompositionCandidate */
  readonly candidateId: string;
  /** ID of the evaluated Step 10 TeamCompositionCandidateEvaluation */
  readonly evaluationId: string;

  /** Canonical sorted tuple of exactly 3 distinct Resonator IDs: [minId, midId, maxId] */
  readonly memberResonatorIds: readonly [string, string, string];

  /** Authoritative ranking status */
  readonly rankingStatus: TeamCompositionRankingStatus;

  /**
   * Deterministic rank in [1, totalRankableCount] for RANKED candidates.
   * Strictly null for UNRANKABLE candidates.
   * Higher rank (1 is highest) denotes stronger structured evidence support.
   * NOT team power, NOT DPS rank, NOT meta tier.
   */
  readonly rank: number | null;

  /** Total count of rankable candidates participating in this ranking (N) */
  readonly totalRankableCount: number;

  /** Total theoretical candidate population in Patch 3.7 (34,220) */
  readonly totalCandidateCount: number;

  /**
   * Immutable Step 10 totalScore in [0.00, 100.00].
   * Strictly null for UNRANKABLE candidates.
   */
  readonly totalScore: number | null;

  /** Preserved Step 10 evaluation status */
  readonly evaluationStatus: TeamCompositionEvaluationStatus;

  /** Preserved Step 9 qualification status */
  readonly candidateQualificationStatus: TeamCompositionQualificationStatus;

  /** Preserved diagnostic counts from Step 9 / Step 10 used in tie-breaking */
  readonly matchedPairCount: number;
  readonly directionalEdgeCount: number;
  readonly independentEvidenceLineageCount: number;

  /** Preserved structural qualification types */
  readonly qualificationTypes: readonly TeamCompositionQualificationType[];

  /** Preserved supporting synergy categories */
  readonly supportingSynergyCategories: readonly CharacterPairSynergyCategory[];

  /** Preserved underlying lineage IDs */
  readonly evidenceIds: readonly string[];
  readonly relationshipIds: readonly string[];
  readonly sourceFactIds: readonly string[];

  /** Machine-readable explanation codes explaining ranking and tie-breaks */
  readonly explanationCodes: readonly string[];

  /** Upstream source provenance */
  readonly provenance: SourceReference;
}

/**
 * Options for team composition candidate ranking.
 */
export interface TeamCompositionRankingOptions {
  /** Explicit rule version override. Default: '7.11.1'. */
  readonly ruleVersion?: '7.11.1';
  /** Whether to materialize unrankable candidates in full enumeration (default: true). */
  readonly includeUnrankable?: boolean;
}

/**
 * Multi-criteria query filter for team composition rankings.
 */
export interface TeamCompositionRankingFilter {
  readonly patchVersion?: '3.7';
  readonly rankingStatus?: TeamCompositionRankingStatus;
  readonly evaluationStatus?: TeamCompositionEvaluationStatus;
  readonly minimumScore?: number;
  readonly maximumScore?: number;
  readonly minimumRank?: number;
  readonly maximumRank?: number;
  readonly resonatorId?: string; // matches any member of the team
}

/**
 * Presentation explanation for a team composition candidate ranking.
 */
export interface TeamCompositionRankingExplanation {
  readonly rankingId: string;
  readonly candidateId: string;
  readonly members: readonly [string, string, string];
  readonly rankingStatus: TeamCompositionRankingStatus;
  readonly rank: number | null;
  readonly totalRankableCount: number;
  readonly totalScore: number | null;
  readonly summary: string;
  readonly explanationCodes: readonly string[];
}

/**
 * Production audit and reconciliation metrics for Step 11.
 */
export interface ProductionTeamRankingAuditMetrics {
  readonly totalCandidates: number;
  readonly totalRankableCount: number;
  readonly totalUnrankableCount: number;
  readonly rankedCount: number;
  readonly unrankableCount: number;

  readonly minRank: number | null;
  readonly maxRank: number | null;
  readonly uniqueRanksCount: number;
  readonly duplicateRanksCount: number;

  readonly minScore: number | null;
  readonly maxScore: number | null;

  readonly rankingStatusDistribution: Readonly<Record<TeamCompositionRankingStatus, number>>;
  readonly evaluationStatusDistribution: Readonly<Record<TeamCompositionEvaluationStatus, number>>;
  readonly unrankableReasonDistribution: Readonly<Record<string, number>>;

  readonly tieBreakStats: Readonly<{
    scoreTiesEncountered: number;
    resolvedByMatchedPairs: number;
    resolvedByIndependentLineages: number;
    resolvedByDirectionalEdges: number;
    resolvedByCategoryDiversity: number;
    resolvedByCanonicalMembers: number;
    resolvedByCandidateId: number;
  }>;

  readonly rankings: readonly TeamCompositionEvidenceRanking[];
}
