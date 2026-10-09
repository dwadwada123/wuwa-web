/**
 * Wuthering Waves Compatibility Candidate Evaluation Types
 * Phase 7 Step 6: Deterministic Compatibility Candidate Evaluation & Scoring Contract
 *
 * Defines deterministic contracts for numerical evidence evaluation of approved
 * CompatibilityCandidate records.
 *
 * CENTRAL INVARIANTS:
 * 1. EVIDENCE STRENGTH != SYNERGY SCORE: Scores represent deterministic evidence strength, NOT community opinion, meta, or character power.
 * 2. BOUNDED SCALE: Evidence score is strictly finite and bounded within [0, 100].
 * 3. NO MAGIC SCORES: Every score contribution is traceable to an explicit documented rule code and rule version.
 * 4. PURE & OFFLINE: Zero network calls, zero LLMs, zero random IDs, zero timestamps.
 * 5. EPISTEMIC SAFETY: UNMODELED, UNKNOWN, NOT_APPLICABLE, MISSING_CONTEXT, and CONTEXT_MISMATCH strictly yield totalScore: null.
 * 6. NO DOUBLE-COUNTING: Multiple relationships or capabilities from the same underlying fact lineage are scored once.
 */

import type {
  CompatibilityCandidate,
  CandidateQualificationType,
  CandidateQualificationNature,
  CandidateDirectionality,
  CandidateApplicabilityResult
} from '../compatibility/types.ts';
import type {
  SourceReference,
  RuntimeEvaluationContext
} from '../../capabilities/types.ts';

export type {
  CompatibilityCandidate,
  CandidateQualificationType,
  CandidateQualificationNature,
  CandidateDirectionality,
  CandidateApplicabilityResult,
  SourceReference,
  RuntimeEvaluationContext
};

/**
 * Closed, strongly-typed taxonomy of candidate evaluation dimensions.
 * Strictly describes deterministic evidence properties, never community rankings or meta power.
 */
export type CandidateEvaluationDimension =
  | 'EVIDENCE_DIRECTNESS'      // How directly candidate is supported (explicit link vs dimensional)
  | 'EVIDENCE_COVERAGE'        // Multi-dimensional breadth of supporting evidence
  | 'MECHANICAL_SPECIFICITY'   // Specific mechanical dimension match vs broad scope
  | 'CONTEXT_CERTAINTY'        // Static context-free certainty vs contextual applicability
  | 'TARGET_SPECIFICITY'       // Specificity of targeting mechanics (explicit / next resonator / team)
  | 'ACTION_MATCH'             // Exact action type match
  | 'ELEMENT_MATCH'            // Exact canonical element match
  | 'TRANSITION_MATCH'         // Structured Outro-to-Intro transition match
  | 'RESOURCE_MATCH'           // Structured resource / cooldown support match
  | 'DEFENSIVE_MATCH'          // Structured healing / shielding survivability match
  | 'OFFENSIVE_MATCH'          // Structured offensive stat / shred amplification match
  | 'MECHANICAL_MATCH';        // Structured coordinated attack / state match

/**
 * Closed, strongly-typed machine-readable rule codes for score components.
 */
export type CandidateEvaluationRuleCode =
  | 'DIRECT_EXPLICIT_LINK'
  | 'DIMENSIONAL_DIRECT_LINK'
  | 'DIMENSIONAL_BROAD_LINK'
  | 'ACTION_EXACT_MATCH'
  | 'ELEMENT_EXACT_MATCH'
  | 'ELEMENT_ALL_MATCH'
  | 'TRANSITION_OUTRO_INTRO_MATCH'
  | 'TARGET_SCOPE_MATCH'
  | 'RESOURCE_PROVISION_MATCH'
  | 'DEFENSIVE_PROVISION_MATCH'
  | 'OFFENSIVE_AMPLIFICATION_MATCH'
  | 'MECHANICAL_COORDINATED_MATCH'
  | 'MULTI_DIMENSION_COVERAGE'
  | 'CERTAINTY_STATIC_CONTEXT_FREE'
  | 'CERTAINTY_CONTEXT_SATISFIED'
  | 'SAFE_EFFECT_MAGNITUDE_BONUS';

/**
 * Deterministic status explaining the candidate evaluation outcome.
 */
export type CandidateEvaluationStatus =
  | 'EVALUATED'        // Successfully evaluated with deterministic numerical score
  | 'MISSING_CONTEXT'  // Required runtime context dimensions absent; score strictly null
  | 'CONTEXT_MISMATCH' // Provided context conflicted with requirements; score strictly null
  | 'UNMODELED'        // Unmodeled combat gauge / mechanic; score strictly null
  | 'UNKNOWN'          // Indeterminate semantics; score strictly null
  | 'NOT_APPLICABLE';  // Non-combat utility or flavor; score strictly null

/**
 * Individual, fully auditable numerical component of an evaluation.
 * Every point is traceable to a specific dimension, rule code, and evidence lineage.
 */
export interface CompatibilityScoreComponent {
  /** Evaluation dimension this component addresses */
  readonly dimension: CandidateEvaluationDimension;

  /** Numerical score awarded by this rule */
  readonly value: number;

  /** Maximum possible score for this component under current rule */
  readonly maxValue: number;

  /** Machine-readable rule code explaining the formula applied */
  readonly ruleCode: CandidateEvaluationRuleCode;

  /** IDs of Step 4 InteractionEvidence records supporting this component */
  readonly evidenceIds: readonly string[];

  /** IDs of Step 3 GameplayRelationships supporting this component */
  readonly relationshipIds: readonly string[];

  /** Explanation reason codes */
  readonly reasonCodes: readonly string[];
}

/**
 * Immutable CompatibilityCandidateEvaluation domain model.
 * Represents the structured, deterministic numerical evaluation of an approved CompatibilityCandidate.
 */
export interface CompatibilityCandidateEvaluation {
  /** Deterministic canonical identifier: eval:3.7:<candidateId>:<ruleVersion> */
  readonly id: string;

  /** Reference to evaluated candidate identifier */
  readonly candidateId: string;

  /** Strictly Patch 3.7 */
  readonly patchVersion: '3.7';

  /** Evaluator logic version (e.g. '7.6.1') */
  readonly ruleVersion: string;

  /**
   * Final aggregated evidence score in [0, 100] if applicable;
   * strictly null for UNMODELED, UNKNOWN, NOT_APPLICABLE, MISSING_CONTEXT, or CONTEXT_MISMATCH.
   */
  readonly totalScore: number | null;

  /** Epistemic evaluation status */
  readonly evaluationStatus: CandidateEvaluationStatus;

  /** Traceable, explainable component breakdown */
  readonly components: readonly CompatibilityScoreComponent[];

  /** Reference to original CompatibilityCandidate */
  readonly candidate: CompatibilityCandidate;

  /** Canonical evidence references */
  readonly evidenceIds: readonly string[];

  /** Canonical relationship references */
  readonly relationshipIds: readonly string[];

  /** Runtime applicability outcome from Step 2 / Step 5 */
  readonly applicability: CandidateApplicabilityResult;

  /** Deterministic explanation codes */
  readonly explanationCodes: readonly string[];

  /** Provenance lineage from underlying source */
  readonly provenance: SourceReference;
}

/**
 * Options for configuring candidate evaluation.
 */
export interface CompatibilityEvaluationOptions {
  /** Optional runtime combat context for contextual capabilities */
  readonly context?: RuntimeEvaluationContext;

  /** Target evaluator rule version (defaults to active rule version) */
  readonly ruleVersion?: string;
}

/**
 * Multi-dimensional filter for querying compatibility candidate evaluations.
 */
export interface CompatibilityEvaluationFilter {
  readonly patchVersion?: '3.7';
  readonly ruleVersion?: string;
  readonly candidateId?: string | readonly string[];
  readonly sourceEntityId?: string | readonly string[];
  readonly targetEntityId?: string | readonly string[];
  readonly evaluationStatus?: CandidateEvaluationStatus | readonly CandidateEvaluationStatus[];
  readonly minScore?: number;
  readonly maxScore?: number;
  readonly dimension?: CandidateEvaluationDimension | readonly CandidateEvaluationDimension[];
  readonly ruleCode?: CandidateEvaluationRuleCode | readonly CandidateEvaluationRuleCode[];
  readonly hasNumericScore?: boolean;
}

/**
 * Deterministic machine-structured explanation of an evaluation.
 * For presentation only; never an input into the engine.
 */
export interface CompatibilityEvaluationExplanation {
  readonly evaluationId: string;
  readonly candidateId: string;
  readonly sourceEntityId: string;
  readonly targetEntityId: string;
  readonly status: CandidateEvaluationStatus;
  readonly totalScore: number | null;
  readonly ruleVersion: string;
  readonly summary: string;
  readonly componentBreakdown: readonly {
    readonly dimension: CandidateEvaluationDimension;
    readonly ruleCode: CandidateEvaluationRuleCode;
    readonly points: number;
    readonly maxPoints: number;
    readonly explanation: string;
  }[];
  readonly missingDimensions: readonly string[];
  readonly mismatchedDimensions: readonly string[];
}

/**
 * Comprehensive production audit metrics for Patch 3.7 candidate evaluations.
 */
export interface ProductionEvaluationAuditMetrics {
  readonly totalInputCapabilities: number;
  readonly totalInputRelationships: number;
  readonly totalInputEvidence: number;
  readonly totalInputCandidates: number;
  readonly totalEvaluations: number;
  readonly uniqueEvaluationIds: number;
  readonly duplicateEvaluationIds: number;
  readonly evaluationsWithScore: number;
  readonly evaluationsWithoutScore: number;
  readonly scoreMin: number | null;
  readonly scoreMax: number | null;
  readonly scoreAverage: number | null;
  readonly scoreMedian: number | null;
  readonly scoreDistribution: Readonly<Record<string, number>>;
  readonly evaluationsByStatus: Readonly<Record<CandidateEvaluationStatus, number>>;
  readonly evaluationsByRuleCode: Readonly<Record<string, number>>;
  readonly evaluationsByDimension: Readonly<Record<string, number>>;
  readonly evaluationsUsingMagnitude: number;
  readonly evaluationsWithoutMagnitude: number;
  readonly evaluationsByCandidateType: Readonly<Record<string, number>>;
  readonly evaluations: readonly CompatibilityCandidateEvaluation[];
}
