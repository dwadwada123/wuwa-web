/**
 * Wuthering Waves Deterministic Owned Roster Eligibility Types
 * Phase 7 Step 12: Deterministic Owned Roster Eligibility Contract
 *
 * Defines contracts for evaluating whether an existing Step 9/10/11 team composition candidate
 * is constructible from the user's owned Resonator roster snapshot.
 *
 * CRITICAL ARCHITECTURAL BOUNDARIES:
 * 1. OWNERSHIP IS A FEASIBILITY CONSTRAINT, NOT A SCORE.
 *    Step 12 answers ONLY: "Is this already-existing 3-Resonator team candidate fully constructible
 *    from the user's owned Resonator roster?" It does NOT answer: "Which team is best for the user?"
 * 2. NO OPTIMIZATION / NO RECOMMENDATION: Step 12 does not select a subset of best teams.
 * 3. NO SCORING / NO RERANKING: Step 11 ranks and Step 10 evidence scores are copied verbatim.
 * 4. STRICT PATCH ISOLATION: Bound strictly to Patch 3.7.
 * 5. PURE & OFFLINE: Zero network, zero LLMs, zero random IDs, zero timestamps.
 */

import type { SourceReference } from '../capabilities/types.ts';
import type {
  TeamCompositionQualificationStatus,
  TeamCompositionQualificationType
} from '../team-composition/types.ts';
import type { TeamCompositionEvaluationStatus } from '../team-composition/evaluation/types.ts';
import type { TeamCompositionRankingStatus } from '../team-composition/ranking/types.ts';

export type {
  SourceReference,
  TeamCompositionQualificationStatus,
  TeamCompositionQualificationType,
  TeamCompositionEvaluationStatus,
  TeamCompositionRankingStatus
};

/**
 * Deterministic input contract representing a snapshot of owned Resonator identities.
 * Pure feasibility input: contains zero build scores, zero levels, zero equipment.
 */
export interface OwnedRosterSnapshot {
  /** Strictly Patch 3.7 */
  readonly patchVersion: '3.7';
  /** Array of owned Resonator entity IDs */
  readonly ownedResonatorIds: readonly string[];
  /** Source provenance reference */
  readonly provenance: SourceReference;
}

/**
 * Normalized and validated owned roster snapshot.
 * Canonicalizes, validates against canonical Patch 3.7 dataset, and deduplicates IDs.
 */
export interface NormalizedOwnedRoster {
  /** Patch 3.7 or mismatch patch version string */
  readonly patchVersion: string;
  /** Canonical sorted list of valid owned Resonator IDs */
  readonly canonicalOwnedIds: readonly string[];
  /** Fast O(1) membership lookup set */
  readonly ownedIdSet: ReadonlySet<string>;
  /** Invalid or unrecognized Resonator IDs if any */
  readonly invalidIds: readonly string[];
  /** Whether the roster passed strict canonical validation */
  readonly isValid: boolean;
  /** Explanatory validation error if invalid */
  readonly validationError?: string;
  /** Source provenance preserved from input snapshot */
  readonly provenance: SourceReference;
}

/**
 * Closed eligibility status taxonomy.
 * Reflects strict objective feasibility of constructing a 3-character candidate.
 */
export type TeamCompositionEligibilityStatus =
  | 'ELIGIBLE'        // All 3 candidate members are owned
  | 'PARTIALLY_OWNED' // Exactly 1 or 2 candidate members are owned
  | 'NOT_OWNED'       // Exactly 0 candidate members are owned
  | 'INVALID_ROSTER'  // Supplied roster contains invalid/unknown IDs or malformed structure
  | 'PATCH_MISMATCH'; // Roster patchVersion !== '3.7'

/**
 * Authoritative TeamCompositionRosterEligibility contract.
 * Represents deterministic feasibility of an existing Step 11 candidate under an owned roster.
 */
export interface TeamCompositionRosterEligibility {
  /** Deterministic identifier: team-roster-eligibility:3.7:<candidateId>:7.12.1 */
  readonly id: string;
  /** Strictly Patch 3.7 */
  readonly patchVersion: '3.7';
  /** Eligibility rule version: 7.12.1 */
  readonly ruleVersion: '7.12.1';

  /** ID of the evaluated Step 9 TeamCompositionCandidate */
  readonly candidateId: string;
  /** ID of the evaluated Step 11 TeamCompositionEvidenceRanking */
  readonly rankingId: string;
  /** ID of the evaluated Step 10 TeamCompositionCandidateEvaluation */
  readonly evaluationId: string;

  /** Canonical sorted tuple of exactly 3 distinct Resonator IDs: [minId, midId, maxId] */
  readonly memberResonatorIds: readonly [string, string, string];

  /** Authoritative objective eligibility status */
  readonly eligibilityStatus: TeamCompositionEligibilityStatus;

  /**
   * Boolean eligibility indicator.
   * Strictly true iff eligibilityStatus === 'ELIGIBLE' (all 3 members owned).
   * Strictly false otherwise.
   */
  readonly isEligible: boolean;

  /** Canonical list of candidate members present in the owned roster */
  readonly ownedMemberResonatorIds: readonly string[];
  /** Canonical list of candidate members missing from the owned roster */
  readonly missingMemberResonatorIds: readonly string[];

  /** Preserved Step 11 rank in [1, totalRankableCount] (or null if unrankable) */
  readonly step11Rank: number | null;
  /** Preserved Step 10 total evidence score in [0.00, 100.00] (or null if unrankable) */
  readonly step11TotalScore: number | null;
  /** Preserved Step 11 ranking status */
  readonly step11RankingStatus: TeamCompositionRankingStatus;

  /** Preserved Step 10 evaluation status */
  readonly evidenceEvaluationStatus: TeamCompositionEvaluationStatus;
  /** Preserved Step 9 qualification status */
  readonly candidateQualificationStatus: TeamCompositionQualificationStatus;

  /** Preserved underlying lineage IDs */
  readonly evidenceIds: readonly string[];
  readonly relationshipIds: readonly string[];
  readonly sourceFactIds: readonly string[];

  /** Machine-readable explanation codes explaining eligibility and status */
  readonly explanationCodes: readonly string[];

  /** Upstream source provenance */
  readonly provenance: SourceReference;
}

/**
 * Aggregate summary metrics for roster eligibility across the candidate space.
 */
export interface TeamCompositionEligibilitySummary {
  readonly totalCandidates: number;
  readonly eligibleCandidates: number;
  readonly partiallyOwnedCandidates: number;
  readonly notOwnedCandidates: number;
  readonly invalidRosterCandidates: number;
  readonly patchMismatchCandidates: number;
  readonly rankedEligibleCandidates: number;
  readonly unrankableEligibleCandidates: number;
  readonly ownedResonatorCount: number;
}

/**
 * Multi-criteria query filter for roster eligibility records.
 */
export interface TeamCompositionEligibilityFilter {
  readonly eligibilityStatus?: TeamCompositionEligibilityStatus;
  readonly isEligible?: boolean;
  readonly step11RankingStatus?: TeamCompositionRankingStatus;
  readonly minimumRank?: number;
  readonly maximumRank?: number;
  readonly minimumScore?: number;
  readonly maximumScore?: number;
  readonly resonatorId?: string; // matches any of memberResonatorIds
}

/**
 * Presentation explanation for a team composition candidate roster eligibility evaluation.
 */
export interface TeamCompositionRosterExplanation {
  readonly eligibilityId: string;
  readonly candidateId: string;
  readonly members: readonly [string, string, string];
  readonly eligibilityStatus: TeamCompositionEligibilityStatus;
  readonly isEligible: boolean;
  readonly step11Rank: number | null;
  readonly step11TotalScore: number | null;
  readonly ownedMembers: readonly string[];
  readonly missingMembers: readonly string[];
  readonly summary: string;
  readonly explanationCodes: readonly string[];
}

/**
 * Production audit and reconciliation metrics for Step 12.
 */
export interface ProductionRosterEligibilityAuditMetrics {
  readonly totalCandidates: number;
  readonly eligibleCount: number;
  readonly partiallyOwnedCount: number;
  readonly notOwnedCount: number;
  readonly invalidRosterCount: number;
  readonly patchMismatchCount: number;

  readonly rankedEligibleCount: number;
  readonly unrankableEligibleCount: number;

  readonly uniqueEligibilityIds: number;
  readonly duplicateEligibilityIds: number;

  readonly eligibilityStatusDistribution: Readonly<Record<TeamCompositionEligibilityStatus, number>>;
  readonly eligibilities: readonly TeamCompositionRosterEligibility[];
}
