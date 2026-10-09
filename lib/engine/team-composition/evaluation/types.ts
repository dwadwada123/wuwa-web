/**
 * Wuthering Waves Deterministic Team Composition Candidate Evaluation Types
 * Phase 7 Step 10: Deterministic Team Composition Candidate Evaluation & Scoring Contract
 *
 * Defines contracts for evaluating the strength of structured team composition evidence
 * for approved Step 9 TeamCompositionCandidate models.
 *
 * CRITICAL ARCHITECTURAL BOUNDARIES:
 * 1. TEAM COMPOSITION EVIDENCE SCORE != TEAM POWER != TEAM DPS != TOA FITNESS.
 *    The score represents: "How strongly is this 3-character team composition supported by
 *    deterministic structured evidence already approved by Steps 6-9?"
 *    It does NOT represent character power, team strength, rotation DPS, or meta viability.
 * 2. BOUNDED SCALE: Scores are strictly bounded within [0.00, 100.00], rounded to 2 decimal places.
 * 3. EPISTEMIC FIDELITY: NO_EVIDENCE, MISSING_CONTEXT, CONTEXT_MISMATCH, UNMODELED, UNKNOWN,
 *    and NOT_APPLICABLE strictly yield totalScore: null.
 * 4. ANTI-DOUBLE-COUNTING: Underlying fact/evidence lineages are deduplicated.
 * 5. NO INFERENCE: Consumes only approved Step 9 candidates and Step 8 synergy profiles.
 * 6. PURE & OFFLINE: Zero network, zero LLMs, zero random IDs, zero timestamps.
 */

import type { SourceReference, RuntimeEvaluationContext } from '../../capabilities/types.ts';
import type {
  CharacterPairSynergyStatus,
  CharacterPairSynergyCategory
} from '../../relationships/character-pairs/synergy/types.ts';
import type {
  TeamCompositionQualificationStatus,
  TeamApplicabilitySummary
} from '../types.ts';

export type {
  SourceReference,
  RuntimeEvaluationContext,
  CharacterPairSynergyStatus,
  CharacterPairSynergyCategory,
  TeamCompositionQualificationStatus,
  TeamApplicabilitySummary
};

/**
 * Closed, strongly-typed evaluation status taxonomy for team composition candidates.
 * Strictly reflects epistemic certainty of modeled team evidence.
 */
export type TeamCompositionEvaluationStatus =
  | 'EVALUATED'            // All required evidence for team-level evaluation is deterministically evaluable
  | 'PARTIALLY_EVALUATED'  // Positive evaluable evidence exists alongside contextual/unresolved evidence
  | 'MISSING_CONTEXT'      // Usable evidence requires runtime context that is currently missing (score: null)
  | 'CONTEXT_MISMATCH'     // Explicitly provided runtime context conflicts with requirements (score: null)
  | 'UNMODELED'            // Supporting pairwise evidence is explicitly UNMODELED (score: null)
  | 'UNKNOWN'              // Unknown upstream semantics; fail-closed (score: null)
  | 'NOT_APPLICABLE'       // Upstream evidence explicitly establishes NOT_APPLICABLE (score: null)
  | 'NO_EVIDENCE';         // No qualifying pairwise synergy evidence (< 2 pairs) (score: null)

/**
 * Closed, strongly-typed taxonomy of team composition evidence evaluation dimensions.
 * Strictly describes structured evidence strength, never meta power or subjective viability.
 */
export type TeamCompositionEvaluationDimension =
  | 'PAIR_EVIDENCE_STRENGTH'        // Strongest approved pairwise synergy evidence score
  | 'EVIDENCE_COVERAGE'             // Number of connected unordered pair slots (0 to 3)
  | 'INDEPENDENT_LINEAGE_COVERAGE'  // Number of distinct independent evidence lineages (capped at 15)
  | 'DIRECTIONAL_SUPPORT'           // Number of distinct directional pairwise profiles (0 to 6)
  | 'SYNERGY_CATEGORY_DIVERSITY'    // Breadth of distinct mechanical synergy categories
  | 'CONTEXT_CERTAINTY';            // Epistemic certainty of applicability conditions

/**
 * Machine-readable rule codes explaining each numerical component.
 */
export type TeamCompositionEvaluationRuleCode =
  | 'RULE_PAIR_EVIDENCE_STRENGTH'
  | 'RULE_EVIDENCE_COVERAGE'
  | 'RULE_INDEPENDENT_LINEAGE_COVERAGE'
  | 'RULE_DIRECTIONAL_SUPPORT'
  | 'RULE_SYNERGY_CATEGORY_DIVERSITY'
  | 'RULE_CONTEXT_CERTAINTY';

/**
 * Individual, fully auditable numerical component of a team composition evaluation.
 * Every point is traceable to a specific dimension, rule code, and evidence lineage.
 */
export interface TeamCompositionScoreComponent {
  /** Dimension of structured evidence evaluated */
  readonly dimension: TeamCompositionEvaluationDimension;
  /** Machine-readable rule code */
  readonly ruleCode: TeamCompositionEvaluationRuleCode;
  /** Points awarded under this rule */
  readonly value: number;
  /** Maximum possible points for this dimension */
  readonly maxValue: number;
  /** Step 4 InteractionEvidence IDs supporting this component */
  readonly evidenceIds: readonly string[];
  /** Step 3 GameplayRelationship IDs supporting this component */
  readonly relationshipIds: readonly string[];
  /** Underlying source fact IDs supporting this component */
  readonly sourceFactIds: readonly string[];
  /** Explanation reason codes */
  readonly reasonCodes: readonly string[];
}

/**
 * Authoritative TeamCompositionCandidateEvaluation contract.
 * Represents the deterministic evidence evaluation of an approved Step 9 candidate.
 */
export interface TeamCompositionCandidateEvaluation {
  /** Deterministic identifier: team-composition-evaluation:3.7:<candidateId>:7.10.1 */
  readonly id: string;
  /** ID of the evaluated Step 9 TeamCompositionCandidate */
  readonly candidateId: string;
  /** Strictly Patch 3.7 */
  readonly patchVersion: '3.7';
  /** Evaluation rule version: 7.10.1 */
  readonly ruleVersion: '7.10.1';

  /** Epistemic evaluation status */
  readonly evaluationStatus: TeamCompositionEvaluationStatus;

  /**
   * Deterministic evidence strength score in [0.00, 100.00].
   * Strictly null when status is NO_EVIDENCE, MISSING_CONTEXT, CONTEXT_MISMATCH,
   * UNMODELED, UNKNOWN, or NOT_APPLICABLE.
   * NOT character power, NOT team DPS, NOT ToA fitness.
   */
  readonly totalScore: number | null;

  /** Structured, explainable score components */
  readonly components: readonly TeamCompositionScoreComponent[];

  /** Preserved Step 9 qualification status */
  readonly candidateQualificationStatus: TeamCompositionQualificationStatus;

  /** Canonical list of supporting Step 8 CharacterPairSynergyProfile IDs */
  readonly pairSynergyProfileIds: readonly string[];
  /** Canonical list of supporting Step 7 CharacterPairEvidenceProfile IDs */
  readonly pairEvidenceProfileIds: readonly string[];
  /** Canonical list of underlying Step 4 InteractionEvidence IDs */
  readonly evidenceIds: readonly string[];
  /** Canonical list of underlying Step 3 GameplayRelationship IDs */
  readonly relationshipIds: readonly string[];
  /** Canonical list of underlying source fact IDs */
  readonly sourceFactIds: readonly string[];

  /** Structural diagnostics preserved from Step 9 */
  readonly matchedPairCount: number;
  readonly directionalEdgeCount: number;
  readonly independentEvidenceLineageCount: number;

  /** Missing runtime context requirements if contextual */
  readonly contextRequirements: readonly string[];
  /** Applicability summary preserved from Step 9 */
  readonly applicabilitySummary: TeamApplicabilitySummary;

  /** Machine-readable explanation codes */
  readonly explanationCodes: readonly string[];
  /** Source provenance preserved from underlying lineage */
  readonly provenance: SourceReference;
}

/**
 * Options for team composition candidate evaluation.
 */
export interface TeamCompositionEvaluationOptions {
  /** Explicit rule version override. Default: '7.10.1'. */
  readonly ruleVersion?: '7.10.1';
  /** Optional runtime evaluation context */
  readonly context?: RuntimeEvaluationContext;
  /** Whether to materialize blocked / no-evidence evaluations (default: true). */
  readonly includeBlockedEvaluations?: boolean;
}

/**
 * Multi-criteria query filter for team composition evaluations.
 */
export interface TeamCompositionEvaluationFilter {
  readonly patchVersion?: '3.7';
  readonly candidateId?: string;
  readonly resonatorId?: string; // matches any member
  readonly evaluationStatus?: TeamCompositionEvaluationStatus;
  readonly hasScore?: boolean;
  readonly minScore?: number;
  readonly maxScore?: number;
  readonly minMatchedPairs?: number;
  readonly minDirectionalEdges?: number;
}

/**
 * Presentation explanation for a team composition evaluation.
 */
export interface TeamCompositionEvaluationExplanation {
  readonly evaluationId: string;
  readonly candidateId: string;
  readonly evaluationStatus: TeamCompositionEvaluationStatus;
  readonly totalScore: number | null;
  readonly summary: string;
  readonly componentBreakdown: Readonly<Record<string, number>>;
  readonly explanationCodes: readonly string[];
}

/**
 * Production audit and reconciliation metrics for Step 10.
 */
export interface ProductionTeamEvaluationAuditMetrics {
  readonly totalResonators: number;
  readonly theoreticalTeams: number;
  readonly totalMaterializedEvaluations: number;
  readonly uniqueEvaluationIds: number;
  readonly duplicateEvaluationIds: number;

  readonly evaluatedCount: number;
  readonly partiallyEvaluatedCount: number;
  readonly missingContextCount: number;
  readonly contextMismatchCount: number;
  readonly unmodeledCount: number;
  readonly unknownCount: number;
  readonly notApplicableCount: number;
  readonly noEvidenceCount: number;

  readonly evaluationsWithScore: number;
  readonly evaluationsWithoutScore: number;

  readonly minScore: number | null;
  readonly maxScore: number | null;
  readonly averageScore: number | null;
  readonly medianScore: number | null;

  readonly scoreDistribution: Readonly<Record<string, number>>;
  readonly dimensionContributionAverages: Readonly<Record<TeamCompositionEvaluationDimension, number>>;

  readonly evaluations: readonly TeamCompositionCandidateEvaluation[];
}
