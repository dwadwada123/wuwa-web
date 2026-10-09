/**
 * Wuthering Waves Deterministic Character Pair Synergy Evaluation Types
 * Phase 7 Step 8: Deterministic Character Pair Synergy Evaluation Contract
 *
 * Defines contracts for evaluating deterministic gameplay synergy profiles
 * between two specific Resonators based strictly on approved Step 7 evidence.
 *
 * CRITICAL ARCHITECTURAL BOUNDARIES:
 * 1. SYNERGY != CHARACTER POWER != TEAM SCORE.
 *    A synergy result means: "There is deterministic, structured evidence that these two
 *    characters have a beneficial gameplay relationship under the modeled rules."
 *    It does NOT mean the pair is meta, universally optimal, or has a final DPS increase.
 * 2. DIRECTIONAL SEMANTICS: A -> B is distinct from B -> A. Symmetry is never assumed.
 * 3. NO NEW INFERENCE: Consumes only approved Step 7 CharacterPairEvidenceProfiles.
 * 4. NO ANTI-SYNERGY: Absence of evidence is NO_EVIDENCE, never anti-synergy or negative scores.
 * 5. ANTI-DOUBLE-COUNTING: Underlying gameplay facts cannot multiply synergy strength.
 * 6. EPISTEMIC FIDELITY: CONTEXT_DEPENDENT, UNMODELED, UNKNOWN, NOT_APPLICABLE, NO_EVIDENCE
 *    strictly produce synergyScore: null.
 * 7. PURE & OFFLINE: Zero network, zero LLMs, zero random IDs, zero timestamps.
 */

import type { SourceReference } from '../../../capabilities/types.ts';
import type {
  CandidateQualificationType,
  CandidateQualificationNature,
  CandidateMatchedDimension,
  CandidateMatchedDimensionKind
} from '../../compatibility/types.ts';
import type {
  CharacterPairProfileStatus,
  CharacterPairApplicabilitySummary,
  CharacterPairEvidenceProfile
} from '../types.ts';

export type {
  SourceReference,
  CandidateQualificationType,
  CandidateQualificationNature,
  CandidateMatchedDimension,
  CandidateMatchedDimensionKind,
  CharacterPairProfileStatus,
  CharacterPairApplicabilitySummary,
  CharacterPairEvidenceProfile
};

/**
 * Closed status taxonomy for character pair synergy evaluation.
 * Strictly reflects epistemic certainty of modeled beneficial relationships.
 */
export type CharacterPairSynergyStatus =
  | 'SYNERGY_SUPPORTED'   // Sufficient evaluated deterministic evidence supporting beneficial relationship
  | 'PARTIAL_SYNERGY'     // Some evaluated evidence exists, but other evidence remains contextual or unmodeled
  | 'CONTEXT_DEPENDENT'   // Structured evidence exists but requires runtime conditions not currently satisfied
  | 'UNMODELED'           // Upstream evidence is explicitly marked UNMODELED
  | 'UNKNOWN'             // Upstream evidence is UNKNOWN; fail-closed
  | 'NOT_APPLICABLE'      // Upstream evidence is NOT_APPLICABLE; excluded from combat synergy
  | 'NO_EVIDENCE';        // No modeled pair evidence established (strictly NOT anti-synergy)

/**
 * Closed, deterministic taxonomy of synergy categories.
 * Strictly describes mechanical synergy dimensions; ZERO subjective or meta labels.
 */
export type CharacterPairSynergyCategory =
  | 'OFFENSIVE_SYNERGY'
  | 'ELEMENTAL_SYNERGY'
  | 'ACTION_SYNERGY'
  | 'TRANSITION_SYNERGY'
  | 'RESOURCE_SYNERGY'
  | 'DEFENSIVE_SYNERGY'
  | 'MECHANICAL_SYNERGY'
  | 'TARGETING_SYNERGY'
  | 'COORDINATED_ATTACK_SYNERGY'
  | 'NEXT_RESONATOR_SYNERGY'
  | 'INTRO_OUTRO_SYNERGY';

/**
 * Individual structured synergy component contributing to a pair's synergy profile.
 * Every component is traceable to specific evidence lineage and deterministic rules.
 */
export interface CharacterPairSynergyComponent {
  /** Closed mechanical synergy category */
  readonly category: CharacterPairSynergyCategory;
  /** Machine-readable rule code explaining why this synergy is qualified */
  readonly ruleCode: string;
  /** Concise deterministic mechanical summary (presentation only) */
  readonly summary: string;
  /** Step 4 InteractionEvidence IDs supporting this synergy component */
  readonly evidenceIds: readonly string[];
  /** Step 3 GameplayRelationship IDs supporting this synergy component */
  readonly relationshipIds: readonly string[];
  /** Step 1/Semantic fact IDs supporting this synergy component */
  readonly sourceFactIds: readonly string[];
  /** Whether this component has active evaluated evidence (vs contextual/unmodeled) */
  readonly isEvaluated: boolean;
}

/**
 * Explanation of a character pair synergy profile for presentation / inspection.
 */
export interface CharacterPairSynergyProfileExplanation {
  readonly profileId: string;
  readonly sourceResonatorId: string;
  readonly targetResonatorId: string;
  readonly synergyStatus: CharacterPairSynergyStatus;
  readonly synergyScore: number | null;
  readonly summary: string;
  readonly supportedCategories: readonly CharacterPairSynergyCategory[];
  readonly explanationCodes: readonly string[];
}

/**
 * Authoritative CharacterPairSynergyProfile contract.
 * Aggregates and qualifies deterministic synergy connecting sourceResonatorId -> targetResonatorId.
 */
export interface CharacterPairSynergyProfile {
  /** Deterministic identifier: pair-synergy:3.7:<sourceResonatorId>:<targetResonatorId>:7.8.1 */
  readonly id: string;
  /** Strictly Patch 3.7 */
  readonly patchVersion: '3.7';
  /** Evaluator rule version: 7.8.1 */
  readonly ruleVersion: '7.8.1';

  /** Originating source Resonator */
  readonly sourceResonatorId: string;
  /** Beneficiary or target Resonator */
  readonly targetResonatorId: string;

  /** Step 7 Evidence profile status */
  readonly status: CharacterPairProfileStatus;
  /** Authoritative Step 8 synergy qualification status */
  readonly synergyStatus: CharacterPairSynergyStatus;

  /**
   * Deterministic strength of modeled positive pairwise synergy evidence in [0.00, 100.00].
   * Strictly null when synergyStatus is CONTEXT_DEPENDENT, UNMODELED, UNKNOWN, NOT_APPLICABLE, or NO_EVIDENCE.
   * NOT character power, NOT DPS, NOT team score.
   */
  readonly synergyScore: number | null;

  /** Structured, explainable synergy components */
  readonly components: readonly CharacterPairSynergyComponent[];

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

  /** Qualification types preserved from Step 7 */
  readonly qualificationTypes: readonly CandidateQualificationType[];
  /** Matched dimensions preserved from Step 7 */
  readonly matchedDimensions: readonly CandidateMatchedDimension[];

  /** Distinct positive synergy categories established for this pair */
  readonly positiveEvidenceTypes: readonly CharacterPairSynergyCategory[];
  /** Missing context requirement dimensions if evidence is contextual */
  readonly contextRequirements: readonly string[];
  /** Runtime applicability summary preserved from Step 7 */
  readonly applicabilitySummary: CharacterPairApplicabilitySummary;

  /** Machine-readable explanation codes */
  readonly explanationCodes: readonly string[];
  /** Source provenance preserved from underlying lineage */
  readonly provenance: SourceReference;
}

/**
 * Query filter for character pair synergy profiles.
 */
export interface CharacterPairSynergyProfileFilter {
  readonly patchVersion?: '3.7';
  readonly sourceResonatorId?: string;
  readonly targetResonatorId?: string;
  readonly resonatorId?: string; // matches either source or target
  readonly synergyStatus?: CharacterPairSynergyStatus;
  readonly hasScore?: boolean;
  readonly category?: CharacterPairSynergyCategory;
  readonly minScore?: number;
  readonly maxScore?: number;
}

/**
 * Options for character pair synergy evaluation.
 */
export interface CharacterPairSynergyEvaluationOptions {
  /** Explicit rule version override. Default: '7.8.1'. */
  readonly ruleVersion?: '7.8.1';
  /** Whether to materialize NO_EVIDENCE profiles for all possible resonator combinations. */
  readonly includeEmptyPairs?: boolean;
}

/**
 * Production audit and reconciliation metrics for Step 8.
 */
export interface ProductionSynergyAuditMetrics {
  readonly totalResonators: number;
  readonly theoreticalDirectionalPairs: number;
  readonly pairsWithEvidence: number;
  readonly noEvidencePairs: number;

  readonly totalModeledProfiles: number;
  readonly totalMaterializedProfiles: number;
  readonly uniqueProfileIds: number;
  readonly duplicateProfileIds: number;

  readonly synergySupportedCount: number;
  readonly partialSynergyCount: number;
  readonly contextDependentCount: number;
  readonly unmodeledCount: number;
  readonly unknownCount: number;
  readonly notApplicableCount: number;
  readonly noEvidenceCount: number;

  readonly profilesWithScore: number;
  readonly profilesWithoutScore: number;

  readonly synergyScoreMin: number | null;
  readonly synergyScoreMax: number | null;
  readonly synergyScoreAverage: number | null;
  readonly synergyScoreMedian: number | null;

  readonly scoreDistribution: Readonly<Record<string, number>>;
  readonly synergyCategoryDistribution: Readonly<Record<CharacterPairSynergyCategory, number>>;

  readonly uniqueCandidatesRepresented: number;
  readonly uniqueEvaluationsRepresented: number;
  readonly uniqueEvidenceRepresented: number;
  readonly uniqueRelationshipsRepresented: number;
  readonly uniqueSourceFactsRepresented: number;

  readonly profiles: readonly CharacterPairSynergyProfile[];
}
