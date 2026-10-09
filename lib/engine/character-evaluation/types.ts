/**
 * Wuthering Waves Deterministic Investment-Aware Character Evaluation Types
 * Phase 7 Step 16: Deterministic Investment-Aware Character Evaluation Contract
 *
 * Defines contracts for evaluating objective character-level evidence availability
 * under a supplied Resonator investment snapshot.
 *
 * CRITICAL ARCHITECTURAL BOUNDARIES:
 * 1. EVIDENCE EVALUATION ONLY, NEVER CHARACTER POWER:
 *    The evaluation score measures ONLY the strength and completeness of modeled,
 *    approved deterministic gameplay evidence under the supplied investment state.
 *    It does NOT measure character power, DPS, rotation damage, meta value, combat strength, or tier.
 * 2. DIRECTIONAL SYNERGY INTEGRITY: Consumes Step 8 pairwise synergy preserving A -> B directionality.
 * 3. NO NEW INFERENCE: Consumes only approved Steps 8, 12, 13, 14, 15 contracts.
 * 4. STRICT PATCH ISOLATION: Bound strictly to Patch 3.7.
 * 5. PURE & OFFLINE: Zero network, zero LLMs, zero random IDs, zero timestamps.
 * 6. UNKNOWN ≠ ZERO: Unknown investment values are never coerced to 0, minimum investment, or default builds.
 * 7. UNMODELED ≠ ZERO: Unmodeled mechanics or missing formulas strictly produce null/unmodeled state.
 * 8. NOT_APPLICABLE IS NOT UNKNOWN: Locked nodes at low sequence are not penalized as unknown investment.
 */

import type { SourceReference } from '../capabilities/types.ts';
import type { InvestmentDimensionKey, ResonatorInvestmentSnapshot } from '../investment/types.ts';
import type { InvestmentEffectResolution } from '../investment/effects/types.ts';
import type { CharacterPairSynergyProfile } from '../relationships/character-pairs/synergy/types.ts';

export type {
  SourceReference,
  InvestmentDimensionKey,
  ResonatorInvestmentSnapshot,
  InvestmentEffectResolution,
  CharacterPairSynergyProfile
};

/**
 * Closed status taxonomy for character evaluation.
 * Strictly reflects epistemic availability and completeness of deterministic evidence.
 */
export type CharacterEvaluationStatus =
  | 'EVALUATED'
  | 'PARTIALLY_EVALUATED'
  | 'CONTEXT_DEPENDENT'
  | 'INVESTMENT_UNKNOWN'
  | 'UNMODELED'
  | 'UNKNOWN'
  | 'NOT_APPLICABLE'
  | 'INVALID'
  | 'PATCH_MISMATCH'
  | 'NO_EVIDENCE';

/**
 * Closed taxonomy of evaluation score dimensions.
 * Bounded sub-scores measuring specific evidence domains.
 */
export type CharacterEvaluationDimension =
  | 'SYNERGY_EVIDENCE'
  | 'INVESTMENT_EFFECT_RESOLUTION'
  | 'INVESTMENT_COMPLETENESS'
  | 'EVIDENCE_COVERAGE'
  | 'CONTEXT_CERTAINTY';

/**
 * Structured score component contributing to a character's evaluation.
 * Every positive component is traceable to specific evidence lineage and deterministic rules.
 */
export interface CharacterEvaluationComponent {
  /** Evaluation dimension */
  readonly dimension: CharacterEvaluationDimension;
  /** Machine-readable rule code governing this component */
  readonly ruleCode: string;
  /** Deterministic score value in [0, maxValue] */
  readonly value: number;
  /** Maximum possible score for this component */
  readonly maxValue: number;
  /** Step 8 CharacterPairSynergyProfile IDs supporting this component */
  readonly synergyProfileIds: readonly string[];
  /** Step 15 InvestmentEffectResolution IDs supporting this component */
  readonly investmentEffectIds: readonly string[];
  /** Step 4 InteractionEvidence IDs supporting this component */
  readonly evidenceIds: readonly string[];
  /** Step 3 GameplayRelationship IDs supporting this component */
  readonly relationshipIds: readonly string[];
  /** Underlying source fact IDs supporting this component */
  readonly sourceFactIds: readonly string[];
  /** Machine-readable reason codes explaining this component value */
  readonly reasonCodes: readonly string[];
}

/**
 * Authoritative CharacterEvaluation contract.
 * Aggregates deterministic character-level gameplay evidence and investment resolution state.
 */
export interface CharacterEvaluation {
  /** Deterministic identifier: character-evaluation:3.7:<resonatorId>:7.16.1 */
  readonly id: string;
  /** Strictly Patch 3.7 */
  readonly patchVersion: '3.7';
  /** Rule version: strictly '7.16.1' */
  readonly ruleVersion: '7.16.1';

  /** Canonical Resonator entity ID */
  readonly resonatorId: string;

  /** Authoritative evaluation status */
  readonly status: CharacterEvaluationStatus;

  /**
   * Deterministic modeled evidence evaluation score in [0.00, 100.00].
   * Strictly null when status is not EVALUATED or PARTIALLY_EVALUATED.
   * NEVER represents character power, DPS, meta rank, or combat strength.
   */
  readonly evaluationScore: number | null;

  /** Structured score components summing to evaluationScore (or empty if score is null) */
  readonly components: readonly CharacterEvaluationComponent[];

  /** Canonical list of Step 8 CharacterPairSynergyProfile IDs involving this Resonator */
  readonly synergyProfileIds: readonly string[];

  /** Canonical list of Step 15 InvestmentEffectResolution IDs evaluated */
  readonly investmentEffectIds: readonly string[];

  /** Canonical list of Step 15 InvestmentEffectResolution IDs with status RESOLVED */
  readonly resolvedInvestmentEffectIds: readonly string[];

  /** Canonical list of underlying source fact IDs */
  readonly sourceFactIds: readonly string[];

  /** Canonical list of Step 4 InteractionEvidence IDs */
  readonly evidenceIds: readonly string[];

  /** Canonical list of Step 3 GameplayRelationship IDs */
  readonly relationshipIds: readonly string[];

  /** Known investment dimensions from Step 13 */
  readonly investmentDimensionsKnown: readonly InvestmentDimensionKey[];

  /** Unknown investment dimensions from Step 13 */
  readonly investmentDimensionsUnknown: readonly InvestmentDimensionKey[];

  /** Distinct functional categories of resolved investment effects */
  readonly resolvedEffectCategories: readonly string[];

  /** Runtime evaluation context dimensions required by unfulfilled evidence */
  readonly contextRequirements: readonly string[];

  /** Machine-readable explanation codes */
  readonly explanationCodes: readonly string[];

  /** Provenance lineage */
  readonly provenance: SourceReference;
}

/**
 * Concise deterministic summary of a CharacterEvaluation record.
 */
export interface CharacterEvaluationSummary {
  readonly resonatorId: string;
  readonly status: CharacterEvaluationStatus;
  readonly evaluationScore: number | null;
  readonly synergyProfileCount: number;
  readonly resolvedInvestmentEffectCount: number;
  readonly unknownInvestmentEffectCount: number;
  readonly unmodeledInvestmentEffectCount: number;
  readonly knownInvestmentDimensionCount: number;
  readonly unknownInvestmentDimensionCount: number;
  readonly investmentCompletenessRatio: number;
  readonly componentSummary: readonly CharacterEvaluationComponent[];
  readonly explanationCodes: readonly string[];
  readonly provenance: SourceReference;
}

/**
 * Query filter for character evaluation records.
 */
export interface CharacterEvaluationFilter {
  readonly status?: CharacterEvaluationStatus;
  readonly resonatorId?: string;
  readonly hasScore?: boolean;
  readonly minScore?: number;
  readonly maxScore?: number;
}

/**
 * Evaluation options for character evaluation.
 */
export interface CharacterEvaluationOptions {
  readonly ruleVersion?: '7.16.1';
  readonly includeEmptyPairs?: boolean;
}

/**
 * Production audit metrics for Step 16.
 */
export interface ProductionCharacterEvaluationAuditMetrics {
  readonly totalResonatorsAudited: number;
  readonly evaluatedCount: number;
  readonly partiallyEvaluatedCount: number;
  readonly contextDependentCount: number;
  readonly investmentUnknownCount: number;
  readonly unmodeledCount: number;
  readonly unknownCount: number;
  readonly notApplicableCount: number;
  readonly invalidCount: number;
  readonly noEvidenceCount: number;
  readonly nonNullScoreCount: number;
  readonly nullScoreCount: number;
  readonly minScore: number | null;
  readonly maxScore: number | null;
  readonly avgScore: number | null;
  readonly medianScore: number | null;
  readonly scoreBuckets: {
    readonly '0-19.99': number;
    readonly '20-39.99': number;
    readonly '40-59.99': number;
    readonly '60-79.99': number;
    readonly '80-100': number;
  };
  readonly allInvariantsPassed: boolean;
}
