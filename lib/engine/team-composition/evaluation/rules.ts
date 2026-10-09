/**
 * Wuthering Waves Deterministic Team Composition Candidate Evaluation Rules
 * Phase 7 Step 10: Deterministic Team Composition Candidate Evaluation & Scoring Contract
 *
 * Centralizes rule versioning, component weights, dimension lookup tables,
 * and provenance defaults for evaluating team composition evidence strength.
 *
 * CRITICAL ARCHITECTURAL CONSTRAINTS:
 * 1. Rule Version: Strictly '7.10.1'.
 * 2. Total score scale: Strictly bounded within [0.00, 100.00], rounded to 2 decimal places.
 * 3. Evidence strength only: Scores evaluate structured evidence from Steps 6-9,
 *    never character power, team DPS, rotation viability, or ToA fitness.
 * 4. Maximum component points:
 *    - PAIR_EVIDENCE_STRENGTH: 35.0
 *    - EVIDENCE_COVERAGE: 20.0
 *    - INDEPENDENT_LINEAGE_COVERAGE: 15.0
 *    - DIRECTIONAL_SUPPORT: 10.0
 *    - SYNERGY_CATEGORY_DIVERSITY: 10.0
 *    - CONTEXT_CERTAINTY: 10.0
 *    Sum: Exactly 100.0
 */

import type { SourceReference } from '../../capabilities/types.ts';
import type { TeamCompositionEvaluationStatus } from './types.ts';

/**
 * Authoritative Step 10 rule version.
 */
export const TEAM_COMPOSITION_EVALUATION_RULE_VERSION = '7.10.1';

/**
 * Scale limits for aggregated team composition evidence score.
 */
export const TEAM_EVALUATION_SCORE_SCALE_MIN = 0.0;
export const TEAM_EVALUATION_SCORE_SCALE_MAX = 100.0;

/**
 * Maximum point allocations per evidence dimension.
 * Pure evidence-strength rule weights; NOT gameplay combat weights.
 */
export const MAX_PAIR_EVIDENCE_STRENGTH = 35.0;
export const MAX_EVIDENCE_COVERAGE = 20.0;
export const MAX_INDEPENDENT_LINEAGE_COVERAGE = 15.0;
export const MAX_DIRECTIONAL_SUPPORT = 10.0;
export const MAX_SYNERGY_CATEGORY_DIVERSITY = 10.0;
export const MAX_CONTEXT_CERTAINTY = 10.0;

/**
 * Deterministic evidence coverage points based on matched unordered pair count (0 to 3).
 * Represents how much of the 3-pair structure is connected by approved evidence.
 */
export const EVIDENCE_COVERAGE_BY_PAIR_COUNT: Readonly<Record<number, number>> = Object.freeze({
  0: 0.0,
  1: 5.0,
  2: 12.0,
  3: 20.0
});

/**
 * Deterministic independent lineage coverage points based on distinct deduplicated lineages.
 * Capped at 15.0 points for 3+ lineages.
 */
export const INDEPENDENT_LINEAGE_POINTS_BY_COUNT: Readonly<Record<number, number>> = Object.freeze({
  0: 0.0,
  1: 5.0,
  2: 10.0
});
export const INDEPENDENT_LINEAGE_POINTS_MAX = 15.0;

/**
 * Deterministic directional support points based on directional edge count (0 to 6).
 */
export const DIRECTIONAL_SUPPORT_POINTS_BY_EDGE_COUNT: Readonly<Record<number, number>> = Object.freeze({
  0: 0.0,
  1: 2.0,
  2: 4.0,
  3: 6.0,
  4: 8.0,
  5: 9.0,
  6: 10.0
});

/**
 * Deterministic category diversity points based on distinct approved synergy categories.
 */
export const CATEGORY_DIVERSITY_POINTS_BY_COUNT: Readonly<Record<number, number>> = Object.freeze({
  0: 0.0,
  1: 3.0,
  2: 6.0,
  3: 8.0
});
export const CATEGORY_DIVERSITY_POINTS_MAX = 10.0;

/**
 * Deterministic context certainty points based on applicability status.
 */
export const CONTEXT_CERTAINTY_POINTS = Object.freeze({
  FULLY_EVALUATED_CONTEXT_FREE: 10.0,
  EVALUATED_CONTEXT_SATISFIED: 8.0,
  PARTIALLY_EVALUATED: 5.0,
  BLOCKED: 0.0
});

/**
 * Returns deterministic evidence coverage score for a given matched unordered pair count.
 */
export function getEvidenceCoverageScore(matchedPairCount: number): number {
  if (matchedPairCount <= 0) return 0.0;
  if (matchedPairCount === 1) return 5.0;
  if (matchedPairCount === 2) return 12.0;
  return 20.0;
}

/**
 * Returns deterministic independent lineage score for a given lineage count.
 */
export function getIndependentLineageScore(lineageCount: number): number {
  if (lineageCount <= 0) return 0.0;
  if (lineageCount === 1) return 5.0;
  if (lineageCount === 2) return 10.0;
  return 15.0;
}

/**
 * Returns deterministic directional support score for a given directional edge count (0 to 6).
 */
export function getDirectionalSupportScore(edgeCount: number): number {
  if (edgeCount <= 0) return 0.0;
  if (edgeCount === 1) return 2.0;
  if (edgeCount === 2) return 4.0;
  if (edgeCount === 3) return 6.0;
  if (edgeCount === 4) return 8.0;
  if (edgeCount === 5) return 9.0;
  return 10.0;
}

/**
 * Returns deterministic synergy category diversity score for distinct category count.
 */
export function getCategoryDiversityScore(categoryCount: number): number {
  if (categoryCount <= 0) return 0.0;
  if (categoryCount === 1) return 3.0;
  if (categoryCount === 2) return 6.0;
  if (categoryCount === 3) return 8.0;
  return 10.0;
}

/**
 * Returns deterministic context certainty score for an evaluation status.
 */
export function getContextCertaintyScore(
  status: TeamCompositionEvaluationStatus,
  isContextFree: boolean
): number {
  if (status === 'EVALUATED') {
    return isContextFree
      ? CONTEXT_CERTAINTY_POINTS.FULLY_EVALUATED_CONTEXT_FREE
      : CONTEXT_CERTAINTY_POINTS.EVALUATED_CONTEXT_SATISFIED;
  }
  if (status === 'PARTIALLY_EVALUATED') {
    return CONTEXT_CERTAINTY_POINTS.PARTIALLY_EVALUATED;
  }
  return CONTEXT_CERTAINTY_POINTS.BLOCKED;
}

/**
 * Fallback empty provenance object for evaluations without positive evidence.
 */
export const EMPTY_TEAM_EVALUATION_PROVENANCE: SourceReference = Object.freeze({
  entityId: 'SYSTEM',
  entityName: 'Deterministic Engine Empty Team Composition Evaluation',
  sourceType: 'RESONATOR_ABILITY',
  sourceCode: 'NO_EVIDENCE',
  patchVersion: '3.7',
  sourceProvenance: 'Wuthering Waves Deterministic Compatibility Engine (Patch 3.7)',
  originalDescription: ''
});
