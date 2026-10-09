/**
 * Wuthering Waves Character Evaluation Rules & Constants
 * Phase 7 Step 16: Deterministic Investment-Aware Character Evaluation Contract
 *
 * Defines canonical constants, bounded scoring weights, explanation codes,
 * and provenance generators for Step 16.
 */

import type { SourceReference } from '../capabilities/types.ts';
import type { CharacterEvaluationDimension } from './types.ts';

/**
 * Authoritative rule version for Step 16.
 */
export const CHARACTER_EVALUATION_RULE_VERSION = '7.16.1';

/**
 * Maximum score limits per evaluation dimension.
 * Strictly bounded and sum to exactly 100.00.
 */
export const COMPONENT_MAX_VALUES: Readonly<Record<CharacterEvaluationDimension, number>> = Object.freeze({
  SYNERGY_EVIDENCE: 30,
  INVESTMENT_EFFECT_RESOLUTION: 30,
  INVESTMENT_COMPLETENESS: 20,
  EVIDENCE_COVERAGE: 10,
  CONTEXT_CERTAINTY: 10
});

/**
 * Rule codes governing evaluation components.
 */
export const EVALUATION_RULE_CODES = Object.freeze({
  SYNERGY_EVIDENCE: 'RULE_SYNERGY_EVIDENCE_AGGREGATION',
  INVESTMENT_EFFECT_RESOLUTION: 'RULE_INVESTMENT_EFFECT_RESOLUTION_AGGREGATION',
  INVESTMENT_COMPLETENESS: 'RULE_INVESTMENT_COMPLETENESS_AGGREGATION',
  EVIDENCE_COVERAGE: 'RULE_EVIDENCE_COVERAGE_BOUNDED',
  CONTEXT_CERTAINTY: 'RULE_CONTEXT_CERTAINTY_BOUNDED'
} as const);

/**
 * High-level machine-readable reason and explanation codes.
 */
export const EVALUATION_EXPLANATION_CODES = Object.freeze({
  STATUS_EVALUATED: 'STATUS_EVALUATED',
  STATUS_PARTIALLY_EVALUATED: 'STATUS_PARTIALLY_EVALUATED',
  STATUS_CONTEXT_DEPENDENT: 'STATUS_CONTEXT_DEPENDENT',
  STATUS_INVESTMENT_UNKNOWN: 'STATUS_INVESTMENT_UNKNOWN',
  STATUS_UNMODELED: 'STATUS_UNMODELED',
  STATUS_UNKNOWN: 'STATUS_UNKNOWN',
  STATUS_NOT_APPLICABLE: 'STATUS_NOT_APPLICABLE',
  STATUS_INVALID: 'STATUS_INVALID',
  STATUS_PATCH_MISMATCH: 'STATUS_PATCH_MISMATCH',
  STATUS_NO_EVIDENCE: 'STATUS_NO_EVIDENCE',

  // Synergy explanation codes
  SYNERGY_EVIDENCE_EVALUATED: 'SYNERGY_EVIDENCE_EVALUATED',
  SYNERGY_EVIDENCE_ABSENT: 'SYNERGY_EVIDENCE_ABSENT',
  DIRECTIONAL_SYNERGY_PRESERVED: 'DIRECTIONAL_SYNERGY_PRESERVED',

  // Investment resolution codes
  INVESTMENT_EFFECTS_RESOLVED: 'INVESTMENT_EFFECTS_RESOLVED',
  INVESTMENT_EFFECTS_PARTIAL: 'INVESTMENT_EFFECTS_PARTIAL',
  INVESTMENT_EFFECTS_UNKNOWN: 'INVESTMENT_EFFECTS_UNKNOWN',
  INVESTMENT_EFFECTS_UNMODELED: 'INVESTMENT_EFFECTS_UNMODELED',
  INVESTMENT_EFFECTS_NOT_APPLICABLE_EXCLUDED: 'INVESTMENT_EFFECTS_NOT_APPLICABLE_EXCLUDED',

  // Investment completeness codes
  INVESTMENT_COMPLETENESS_COMPLETE: 'INVESTMENT_COMPLETENESS_COMPLETE',
  INVESTMENT_COMPLETENESS_PARTIAL: 'INVESTMENT_COMPLETENESS_PARTIAL',
  INVESTMENT_COMPLETENESS_EMPTY: 'INVESTMENT_COMPLETENESS_EMPTY',

  // Coverage codes
  EVIDENCE_COVERAGE_HIGH: 'EVIDENCE_COVERAGE_HIGH',
  EVIDENCE_COVERAGE_MEDIUM: 'EVIDENCE_COVERAGE_MEDIUM',
  EVIDENCE_COVERAGE_LOW: 'EVIDENCE_COVERAGE_LOW',
  EVIDENCE_COVERAGE_NONE: 'EVIDENCE_COVERAGE_NONE',

  // Context certainty codes
  CONTEXT_FREE: 'CONTEXT_FREE',
  CONTEXT_KNOWN: 'CONTEXT_KNOWN',
  CONTEXT_PARTIAL: 'CONTEXT_PARTIAL',
  CONTEXT_BLOCKED: 'CONTEXT_BLOCKED'
} as const);

/**
 * Creates canonical source provenance for Step 16 CharacterEvaluation.
 */
export function createDefaultStep16Provenance(resonatorId: string): SourceReference {
  return Object.freeze({
    entityId: resonatorId,
    entityName: resonatorId,
    sourceCode: `character-evaluation:3.7:${resonatorId}:${CHARACTER_EVALUATION_RULE_VERSION}`,
    patchVersion: '3.7',
    sourceType: 'RESONATOR_ABILITY',
    sourceProvenance: 'lib/engine/character-evaluation/evaluator.ts',
    originalDescription: `Character evaluation for ${resonatorId}`
  });
}
