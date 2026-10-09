/**
 * Wuthering Waves Compatibility Candidate Evaluation Predicates & Identifiers
 * Phase 7 Step 6: Deterministic Compatibility Candidate Evaluation & Scoring Contract
 *
 * Provides deterministic ID derivation, canonical sorting comparators,
 * type guards, and multi-dimensional filter matching for candidate evaluations.
 */

import type {
  CompatibilityCandidateEvaluation,
  CompatibilityEvaluationFilter
} from './types.ts';

/**
 * Derives a deterministic canonical evaluation identifier.
 * Format: eval:<patchVersion>:<candidateId>:<ruleVersion>
 *
 * ZERO RANDOMNESS: Guaranteed identical ID across runs for identical candidate and rule version.
 */
export function deriveCompatibilityEvaluationId(
  patchVersion: string,
  candidateId: string,
  ruleVersion: string
): string {
  return `eval:${patchVersion}:${candidateId}:${ruleVersion}`;
}

/**
 * Canonical sorting comparator for CompatibilityCandidateEvaluation records.
 * Deterministic tie-breaking order:
 * 1. Has numerical score first (nulls sort last)
 * 2. Total score descending
 * 3. Candidate ID ascending
 * 4. Evaluation status ascending
 * 5. Evaluation ID ascending
 */
export function compareCompatibilityEvaluation(
  a: CompatibilityCandidateEvaluation,
  b: CompatibilityCandidateEvaluation
): number {
  // 1. Numerical score presence (scored items come first)
  const aHasScore = a.totalScore !== null;
  const bHasScore = b.totalScore !== null;
  if (aHasScore !== bHasScore) {
    return aHasScore ? -1 : 1;
  }

  // 2. Score descending
  if (a.totalScore !== null && b.totalScore !== null) {
    if (a.totalScore !== b.totalScore) {
      return b.totalScore - a.totalScore;
    }
  }

  // 3. Candidate ID ascending
  const candCmp = a.candidateId.localeCompare(b.candidateId);
  if (candCmp !== 0) return candCmp;

  // 4. Status ascending
  const statusCmp = a.evaluationStatus.localeCompare(b.evaluationStatus);
  if (statusCmp !== 0) return statusCmp;

  // 5. Evaluation ID ascending
  return a.id.localeCompare(b.id);
}

/**
 * Type guard for successfully evaluated candidates with numerical scores.
 */
export function isApplicableEvaluation(
  e: CompatibilityCandidateEvaluation
): e is CompatibilityCandidateEvaluation & { totalScore: number } {
  return e.evaluationStatus === 'EVALUATED' && e.totalScore !== null;
}

/**
 * Type guard for evaluations with non-null numeric scores.
 */
export function hasNumericEvaluationScore(
  e: CompatibilityCandidateEvaluation
): e is CompatibilityCandidateEvaluation & { totalScore: number } {
  return e.totalScore !== null;
}

/**
 * Type guard for MISSING_CONTEXT evaluations.
 */
export function isMissingContextEvaluation(e: CompatibilityCandidateEvaluation): boolean {
  return e.evaluationStatus === 'MISSING_CONTEXT';
}

/**
 * Type guard for CONTEXT_MISMATCH evaluations.
 */
export function isContextMismatchEvaluation(e: CompatibilityCandidateEvaluation): boolean {
  return e.evaluationStatus === 'CONTEXT_MISMATCH';
}

/**
 * Type guard for UNMODELED evaluations.
 */
export function isUnmodeledEvaluation(e: CompatibilityCandidateEvaluation): boolean {
  return e.evaluationStatus === 'UNMODELED';
}

/**
 * Type guard for UNKNOWN evaluations.
 */
export function isUnknownEvaluation(e: CompatibilityCandidateEvaluation): boolean {
  return e.evaluationStatus === 'UNKNOWN';
}

/**
 * Type guard for NOT_APPLICABLE evaluations.
 */
export function isNotApplicableEvaluation(e: CompatibilityCandidateEvaluation): boolean {
  return e.evaluationStatus === 'NOT_APPLICABLE';
}

/**
 * Helper to match single value or array of values.
 */
function matchesValueOrArray<T>(
  fieldValue: T | undefined,
  filterValue: T | readonly T[] | undefined
): boolean {
  if (filterValue === undefined) return true;
  if (fieldValue === undefined) return false;
  if (Array.isArray(filterValue)) {
    return filterValue.includes(fieldValue);
  }
  return fieldValue === filterValue;
}

/**
 * Pure predicate testing whether an evaluation satisfies a multi-dimensional filter.
 * AND semantics across distinct fields; OR semantics within array parameters.
 */
export function matchesEvaluationFilter(
  evaluation: CompatibilityCandidateEvaluation,
  filter: CompatibilityEvaluationFilter
): boolean {
  if (filter.patchVersion !== undefined && evaluation.patchVersion !== filter.patchVersion) {
    return false;
  }

  if (filter.ruleVersion !== undefined && evaluation.ruleVersion !== filter.ruleVersion) {
    return false;
  }

  if (!matchesValueOrArray(evaluation.candidateId, filter.candidateId)) {
    return false;
  }

  if (!matchesValueOrArray(evaluation.candidate.sourceEntityId, filter.sourceEntityId)) {
    return false;
  }

  if (!matchesValueOrArray(evaluation.candidate.targetEntityId, filter.targetEntityId)) {
    return false;
  }

  if (!matchesValueOrArray(evaluation.evaluationStatus, filter.evaluationStatus)) {
    return false;
  }

  if (filter.hasNumericScore !== undefined) {
    const hasScore = evaluation.totalScore !== null;
    if (hasScore !== filter.hasNumericScore) {
      return false;
    }
  }

  if (filter.minScore !== undefined) {
    if (evaluation.totalScore === null || evaluation.totalScore < filter.minScore) {
      return false;
    }
  }

  if (filter.maxScore !== undefined) {
    if (evaluation.totalScore === null || evaluation.totalScore > filter.maxScore) {
      return false;
    }
  }

  if (filter.dimension !== undefined) {
    const hasDim = evaluation.components.some((c) =>
      matchesValueOrArray(c.dimension, filter.dimension)
    );
    if (!hasDim) return false;
  }

  if (filter.ruleCode !== undefined) {
    const hasCode = evaluation.components.some((c) =>
      matchesValueOrArray(c.ruleCode, filter.ruleCode)
    );
    if (!hasCode) return false;
  }

  return true;
}
