/**
 * Wuthering Waves Deterministic Character-Level Evidence Aggregation Types
 * Phase 7 Step 7: Deterministic Character-Level Evidence Aggregation Contract
 *
 * Defines contracts for aggregating already-approved candidate evaluations (Step 6)
 * into directional evidence profiles connecting two specific Resonators.
 *
 * CRITICAL ARCHITECTURAL INVARIANTS:
 * 1. EVIDENCE AGGREGATION != SYNERGY SCORE != CHARACTER POWER SCORE.
 *    A profile describes deterministic gameplay evidence connecting Resonator A and Resonator B.
 *    It does NOT rank characters, score teams, compute DPS, or infer community roles.
 * 2. DIRECTIONAL PRESERVATION: A -> B is distinct from B -> A. Symmetry is never assumed.
 * 3. NO NEW PAIRWISE INFERENCE: Only aggregates evidence established through Steps 1-6.
 * 4. ANTI-DOUBLE-COUNTING: Multiple candidate evaluations originating from the same underlying
 *    evidence record or source fact do not artificially multiply pair evidence scores.
 * 5. EPISTEMIC FIDELITY:
 *    - EMPTY (no candidates) is NOT incompatibility or anti-synergy; score is null.
 *    - UNMODELED, UNKNOWN, MISSING_CONTEXT, NOT_APPLICABLE strictly yield null pair evidence score.
 *    - PARTIALLY_EVALUATED accurately captures pairs with mixed evaluated & contextual candidates.
 * 6. ZERO NETWORK, ZERO LLM, ZERO RANDOMNESS, ZERO TIMESTAMPS.
 */

import type { SourceReference } from '../../capabilities/types.ts';
import type {
  CandidateQualificationType,
  CandidateQualificationNature,
  CandidateMatchedDimension,
  CandidateMatchedDimensionKind
} from '../compatibility/types.ts';
import type {
  CompatibilityCandidateEvaluation,
  CandidateEvaluationStatus,
  CandidateEvaluationDimension,
  CandidateEvaluationRuleCode
} from '../evaluation/types.ts';

export type {
  SourceReference,
  CandidateQualificationType,
  CandidateQualificationNature,
  CandidateMatchedDimension,
  CandidateMatchedDimensionKind,
  CompatibilityCandidateEvaluation,
  CandidateEvaluationStatus,
  CandidateEvaluationDimension,
  CandidateEvaluationRuleCode
};

/**
 * Closed status taxonomy for character pair evidence profile.
 * Strictly distinguishes evaluated, partially evaluated, contextual, unmodeled, and empty states.
 */
export type CharacterPairProfileStatus =
  | 'EVALUATED'
  | 'PARTIALLY_EVALUATED'
  | 'MISSING_CONTEXT'
  | 'CONTEXT_MISMATCH'
  | 'UNMODELED'
  | 'UNKNOWN'
  | 'NOT_APPLICABLE'
  | 'EMPTY';

/**
 * Summary of structured numerical evidence scores for a character pair.
 * Strictly represents evidence strength metrics; NOT character power or team quality.
 */
export interface CharacterPairEvidenceScoreSummary {
  /** Total count of candidate evaluations with active numerical scores */
  readonly evaluatedCandidateCount: number;
  /** Count of distinct Step 4 InteractionEvidence records supporting this pair */
  readonly uniqueEvidenceCount: number;
  /** Count of distinct Step 3 GameplayRelationship records supporting this pair */
  readonly uniqueRelationshipCount: number;
  /** Count of distinct Step 1/Semantic source fact IDs supporting this pair */
  readonly uniqueSourceFactCount: number;
  /** Count of independent evaluated evidence records after lineage deduplication */
  readonly independentEvaluatedEvidenceCount: number;
  /** Strongest single candidate evaluation score, or null if no evaluated candidates */
  readonly maxCandidateScore: number | null;
  /** Average candidate evaluation score across deduplicated independent evidence, or null */
  readonly averageCandidateScore: number | null;
  /**
   * Authoritative lineage-deduplicated pair evidence score bounded in [0, 100],
   * or null if status is MISSING_CONTEXT, UNMODELED, UNKNOWN, NOT_APPLICABLE, or EMPTY.
   */
  readonly pairEvidenceScore: number | null;
}

/**
 * Multi-dimensional component distribution across candidates connecting the pair.
 */
export interface CharacterPairComponentSummary {
  readonly countsByQualificationType: Readonly<Record<CandidateQualificationType, number>>;
  readonly countsByQualificationNature: Readonly<Record<CandidateQualificationNature, number>>;
  readonly countsByDimensionKind: Readonly<Record<CandidateMatchedDimensionKind, number>>;
  readonly countsByRuleCode: Readonly<Record<string, number>>;
}

/**
 * Runtime applicability accounting across candidates connecting the pair.
 */
export interface CharacterPairApplicabilitySummary {
  readonly evaluatedCount: number;
  readonly missingContextCount: number;
  readonly contextMismatchCount: number;
  readonly unmodeledCount: number;
  readonly unknownCount: number;
  readonly notApplicableCount: number;
  readonly missingContextDimensions: readonly string[];
}

/**
 * Deterministic explanation of a character pair profile.
 */
export interface CharacterPairProfileExplanation {
  readonly profileId: string;
  readonly sourceResonatorId: string;
  readonly targetResonatorId: string;
  readonly status: CharacterPairProfileStatus;
  readonly pairEvidenceScore: number | null;
  readonly summary: string;
  readonly supportedDimensions: readonly string[];
  readonly explanationCodes: readonly string[];
}

/**
 * Authoritative CharacterPairEvidenceProfile contract.
 * Aggregates all deterministic candidate evaluations connecting sourceResonatorId -> targetResonatorId.
 */
export interface CharacterPairEvidenceProfile {
  /** Deterministic identifier: pair:3.7:<sourceResonatorId>:<targetResonatorId>:7.7.1 */
  readonly id: string;
  /** Strictly Patch 3.7 */
  readonly patchVersion: '3.7';
  /** Evaluator rule version: 7.7.1 */
  readonly ruleVersion: '7.7.1';

  /** Originating source Resonator */
  readonly sourceResonatorId: string;
  /** Beneficiary or target Resonator */
  readonly targetResonatorId: string;

  /** Aggregate epistemic status */
  readonly status: CharacterPairProfileStatus;

  /** Canonical list of Step 5 CompatibilityCandidate IDs */
  readonly candidateIds: readonly string[];
  /** Canonical list of Step 6 CompatibilityCandidateEvaluation IDs */
  readonly evaluationIds: readonly string[];
  /** Canonical list of Step 4 InteractionEvidence IDs */
  readonly evidenceIds: readonly string[];
  /** Canonical list of Step 3 GameplayRelationship IDs */
  readonly relationshipIds: readonly string[];
  /** Canonical list of underlying source fact IDs */
  readonly sourceFactIds: readonly string[];

  /** Distinct qualification types represented in this pair */
  readonly qualificationTypes: readonly CandidateQualificationType[];
  /** Distinct qualification natures represented in this pair */
  readonly qualificationNatures: readonly CandidateQualificationNature[];
  /** Distinct mechanical dimensions matched between the resonators */
  readonly matchedDimensions: readonly CandidateMatchedDimension[];

  /** Structured distribution summaries */
  readonly componentSummary: CharacterPairComponentSummary;
  /** Numerical evidence scores and lineage metrics */
  readonly evidenceScoreSummary: CharacterPairEvidenceScoreSummary;
  /** Contextual applicability summary */
  readonly applicabilitySummary: CharacterPairApplicabilitySummary;

  /** Machine-readable explanation codes */
  readonly explanationCodes: readonly string[];
  /** Source provenance preserved from underlying lineage */
  readonly provenance: SourceReference;
}

/**
 * Query filter for character pair evidence profiles.
 */
export interface CharacterPairProfileFilter {
  readonly patchVersion?: '3.7';
  readonly sourceResonatorId?: string;
  readonly targetResonatorId?: string;
  readonly resonatorId?: string; // matches either source or target
  readonly status?: CharacterPairProfileStatus;
  readonly hasScore?: boolean;
  readonly qualificationType?: CandidateQualificationType;
  readonly qualificationNature?: CandidateQualificationNature;
  readonly matchedDimensionKind?: CandidateMatchedDimensionKind;
  readonly minScore?: number;
  readonly maxScore?: number;
}

/**
 * Options for character pair aggregation operations.
 */
export interface CharacterPairAggregationOptions {
  /**
   * If true, generates profiles for all possible resonator pairs including empty ones.
   * Default: false (materializes only pairs with modeled candidates; empty pairs generated on demand).
   */
  readonly includeEmptyPairs?: boolean;
  /**
   * Explicit rule version override. Default: '7.7.1'.
   */
  readonly ruleVersion?: '7.7.1';
}

/**
 * Production accounting and audit metrics for Step 7.
 */
export interface ProductionPairAuditMetrics {
  readonly totalUpstreamCandidates: number;
  readonly totalUpstreamEvaluations: number;
  readonly includedResonatorCandidates: number;
  readonly excludedNonResonatorCandidates: number;

  readonly totalModeledPairs: number;
  readonly totalMaterializedPairs: number;
  readonly uniquePairIds: number;
  readonly duplicatePairIds: number;

  readonly pairsWithScore: number;
  readonly pairsWithoutScore: number;

  readonly pairScoreMin: number | null;
  readonly pairScoreMax: number | null;
  readonly pairScoreAverage: number | null;
  readonly pairScoreMedian: number | null;

  readonly pairsByStatus: Readonly<Record<CharacterPairProfileStatus, number>>;
  readonly scoreDistribution: Readonly<Record<string, number>>;

  readonly uniqueResonatorsRepresented: number;
  readonly maxCandidatesPerPair: number;
  readonly maxEvidencePerPair: number;
  readonly maxSourceFactsPerPair: number;

  readonly profiles: readonly CharacterPairEvidenceProfile[];
}
