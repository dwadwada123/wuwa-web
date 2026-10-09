/**
 * Wuthering Waves Deterministic Team Build Readiness & Investment Applicability Types
 * Phase 7 Step 14: Deterministic Team Build Readiness & Investment Applicability Contract
 *
 * Defines contracts representing the objective build readiness and investment information availability
 * for existing 3-Resonator Team Composition Candidates.
 *
 * CRITICAL ARCHITECTURAL BOUNDARIES:
 * 1. READINESS IS AN INPUT/DATA AVAILABILITY STATE, NOT A GAMEPLAY SCORE.
 *    Step 14 answers ONLY: "For an already-existing 3-Resonator candidate, is the team constructible
 *    from the user's owned roster, and what objective investment information is known for its members?"
 * 2. NO SCORING / NO POWER: Zero team power, zero character power, zero DPS, zero rotation damage.
 * 3. NO RECOMMENDATIONS / NO SELECTION: Step 14 does not choose best teams or advise builds.
 * 4. STRICT CONSUMPTION OF STEPS 9–13: Consumes candidates, evaluations, rankings, eligibility, and investments.
 * 5. PURE & OFFLINE: Zero network, zero LLMs, zero random IDs, zero timestamps.
 * 6. OWNERSHIP ≠ INVESTMENT: A team can be fully owned with zero investment information known.
 */

import type { SourceReference } from '../../capabilities/types.ts';
import type { TeamCompositionRankingStatus } from '../ranking/types.ts';
import type { ResonatorInvestmentSnapshot, InvestmentDimensionKey } from '../../investment/types.ts';
import type { OwnedRosterSnapshot } from '../../roster/types.ts';

export type {
  SourceReference,
  TeamCompositionRankingStatus,
  ResonatorInvestmentSnapshot,
  InvestmentDimensionKey,
  OwnedRosterSnapshot
};

/**
 * Objective ownership status of a team composition candidate.
 * Derived strictly from Step 12 OwnedRosterEligibility authority.
 */
export type TeamOwnershipStatus =
  | 'FULLY_OWNED'     // All 3 candidate members are owned
  | 'PARTIALLY_OWNED' // Exactly 1 or 2 members are owned
  | 'NOT_OWNED'       // Exactly 0 members are owned
  | 'INVALID'         // Upstream roster/input invalid
  | 'PATCH_MISMATCH'; // Roster or candidate patchVersion !== '3.7'

/**
 * Objective investment data availability status across the 3 candidate members.
 * Derived strictly from Step 13 ResonatorInvestmentSnapshot records.
 */
export type TeamInvestmentStatus =
  | 'INVESTMENT_COMPLETE'   // All applicable Step 13 dimensions for all 3 members are KNOWN
  | 'INVESTMENT_PARTIAL'    // At least 1 dimension KNOWN and at least 1 applicable dimension UNKNOWN
  | 'INVESTMENT_UNKNOWN'    // No applicable investment dimension is KNOWN across all 3 members
  | 'INVESTMENT_UNAVAILABLE'; // Upstream eligibility/patch failure prevents evaluation

/**
 * Authoritative combined build readiness status.
 * Reflects ownership feasibility and investment information availability.
 * Priority: PATCH_MISMATCH > INVALID > NOT_OWNED > PARTIALLY_OWNED > READY statuses.
 */
export type TeamBuildReadinessStatus =
  | 'READY'                          // Fully owned and all investment dimensions known
  | 'READY_WITH_PARTIAL_INVESTMENT'  // Fully owned with partial investment dimensions known
  | 'READY_WITH_UNKNOWN_INVESTMENT'  // Fully owned with zero investment dimensions known
  | 'PARTIALLY_OWNED'                // 1 or 2 members owned (cannot be constructed)
  | 'NOT_OWNED'                      // 0 members owned (cannot be constructed)
  | 'INVALID'                        // Roster/input validation error
  | 'PATCH_MISMATCH';                // Patch mismatch

/**
 * Factual data completeness aggregation across the 3 candidate members.
 * Pure information availability metric; NEVER a gameplay or build quality score!
 */
export interface TeamInvestmentCompleteness {
  /** Total applicable dimensions across all 3 members (typically 27) */
  readonly totalMemberDimensions: number;
  /** Number of dimensions with status === 'KNOWN' across all 3 members */
  readonly knownMemberDimensions: number;
  /** Number of dimensions with status !== 'KNOWN' across all 3 members */
  readonly unknownMemberDimensions: number;
  /** Completeness ratio per member in [0.0000, 1.0000]: [memberA, memberB, memberC] */
  readonly memberCompletenessRatios: readonly [number, number, number];
  /** Overall team completeness ratio in [0.0000, 1.0000] or null */
  readonly teamCompletenessRatio: number | null;
}

/**
 * Authoritative Step 14 TeamBuildReadiness contract.
 * Represents the objective build readiness and investment information state of a team candidate.
 */
export interface TeamBuildReadiness {
  /** Deterministic identifier: team-build-readiness:3.7:<teamCandidateId>:7.14.1 */
  readonly id: string;
  /** Strictly Patch 3.7 */
  readonly patchVersion: '3.7';
  /** Rule version: 7.14.1 */
  readonly ruleVersion: '7.14.1';

  /** ID of the evaluated Step 9 TeamCompositionCandidate */
  readonly teamCandidateId: string;
  /** Canonical sorted tuple of exactly 3 Resonator IDs */
  readonly memberResonatorIds: readonly [string, string, string];

  /** Authoritative ownership status derived from Step 12 */
  readonly ownershipStatus: TeamOwnershipStatus;
  /** Authoritative investment information availability derived from Step 13 */
  readonly investmentStatus: TeamInvestmentStatus;
  /** Authoritative composite build readiness status */
  readonly readinessStatus: TeamBuildReadinessStatus;

  /** True iff ownershipStatus === 'FULLY_OWNED' */
  readonly isFullyOwned: boolean;
  /** True iff team is fully owned (constructible by user) */
  readonly isReady: boolean;

  /** Immutable investment snapshots for each of the 3 members in canonical order */
  readonly memberInvestmentSnapshots: readonly [
    ResonatorInvestmentSnapshot,
    ResonatorInvestmentSnapshot,
    ResonatorInvestmentSnapshot
  ];

  /** Aggregate factual investment completeness across the 3 members */
  readonly investmentCompleteness: TeamInvestmentCompleteness;

  /** Preserved upstream lineage IDs */
  readonly step10EvaluationId: string;
  readonly step11RankingId: string | null;
  readonly step12EligibilityId: string;

  /** Preserved Step 10 total evidence score copied verbatim (or null) */
  readonly preservedStep10Score: number | null;
  /** Preserved Step 11 rank copied verbatim (or null) */
  readonly preservedStep11Rank: number | null;
  /** Preserved Step 11 ranking status */
  readonly step11RankingStatus: TeamCompositionRankingStatus;

  /** List of dimension keys that are KNOWN across all 3 members */
  readonly knownInvestmentDimensions: readonly InvestmentDimensionKey[];
  /** List of dimension keys that are UNKNOWN across all 3 members */
  readonly unknownInvestmentDimensions: readonly InvestmentDimensionKey[];

  /** Machine-readable explanation codes */
  readonly explanationCodes: readonly string[];
  /** Upstream source provenance */
  readonly provenance: SourceReference;
}

/**
 * Multi-criteria query filter for team build readiness records.
 */
export interface TeamBuildReadinessFilter {
  readonly ownershipStatus?: TeamOwnershipStatus;
  readonly investmentStatus?: TeamInvestmentStatus;
  readonly readinessStatus?: TeamBuildReadinessStatus;
  readonly isFullyOwned?: boolean;
  readonly isReady?: boolean;
  readonly step11RankingStatus?: TeamCompositionRankingStatus;
  readonly resonatorId?: string; // matches any of memberResonatorIds
  readonly minimumTeamCompleteness?: number;
  readonly maximumTeamCompleteness?: number;
}

/**
 * Summary metrics of build readiness across a candidate population.
 */
export interface TeamBuildReadinessSummary {
  readonly totalCandidates: number;
  readonly fullyOwnedCount: number;
  readonly partiallyOwnedCount: number;
  readonly notOwnedCount: number;
  readonly readyCount: number;
  readonly readyPartialCount: number;
  readonly readyUnknownCount: number;
  readonly investmentCompleteCount: number;
  readonly investmentPartialCount: number;
  readonly investmentUnknownCount: number;
  readonly investmentUnavailableCount: number;
  readonly averageCompletenessRatio: number | null;
}

/**
 * Presentation explanation for a team build readiness evaluation.
 */
export interface TeamBuildReadinessExplanation {
  readonly readinessId: string;
  readonly teamCandidateId: string;
  readonly members: readonly [string, string, string];
  readonly ownershipStatus: TeamOwnershipStatus;
  readonly investmentStatus: TeamInvestmentStatus;
  readonly readinessStatus: TeamBuildReadinessStatus;
  readonly isFullyOwned: boolean;
  readonly preservedStep11Rank: number | null;
  readonly preservedStep10Score: number | null;
  readonly completenessRatio: number | null;
  readonly summary: string;
}

/**
 * Production audit and reconciliation metrics for Step 14.
 */
export interface ProductionTeamReadinessAuditMetrics {
  readonly totalCandidatesAudited: number;
  readonly fullyOwnedCount: number;
  readonly partiallyOwnedCount: number;
  readonly notOwnedCount: number;
  readonly readyCount: number;
  readonly readyPartialCount: number;
  readonly readyUnknownCount: number;
  readonly uniqueReadinessIds: number;
  readonly duplicateReadinessIds: number;
  readonly records: readonly TeamBuildReadiness[];
}
