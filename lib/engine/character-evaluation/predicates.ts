/**
 * Wuthering Waves Character Evaluation Predicates & Canonical Helpers
 * Phase 7 Step 16: Deterministic Investment-Aware Character Evaluation Contract
 *
 * Provides deterministic ID derivation, canonical sorting comparators, type guards,
 * and filter predicates for CharacterEvaluation records.
 */

import { CHARACTER_EVALUATION_RULE_VERSION } from './rules.ts';
import type {
  CharacterEvaluation,
  CharacterEvaluationFilter,
  CharacterEvaluationStatus
} from './types.ts';

/**
 * Derives a deterministic canonical identifier for a CharacterEvaluation record.
 * Format: character-evaluation:3.7:<resonatorId>:<ruleVersion>
 */
export function deriveCharacterEvaluationId(
  resonatorId: string,
  ruleVersion: string = CHARACTER_EVALUATION_RULE_VERSION
): string {
  return `character-evaluation:3.7:${resonatorId}:${ruleVersion}`;
}

/**
 * Canonical string sorting helper.
 */
export function canonicalSortStrings(items: readonly string[]): readonly string[] {
  return Object.freeze(Array.from(new Set(items)).sort((a, b) => a.localeCompare(b)));
}

/**
 * Canonical comparator for CharacterEvaluation records.
 * Order:
 * 1. resonatorId ascending
 * 2. evaluationScore descending (non-null before null)
 * 3. id ascending
 */
export function compareCharacterEvaluation(
  a: CharacterEvaluation,
  b: CharacterEvaluation
): number {
  if (a.resonatorId !== b.resonatorId) {
    return a.resonatorId.localeCompare(b.resonatorId);
  }

  const scoreA = a.evaluationScore;
  const scoreB = b.evaluationScore;

  if (scoreA !== null && scoreB !== null) {
    if (scoreA !== scoreB) {
      return scoreB - scoreA; // descending
    }
  } else if (scoreA !== null && scoreB === null) {
    return -1; // non-null first
  } else if (scoreA === null && scoreB !== null) {
    return 1;
  }

  return a.id.localeCompare(b.id);
}

/**
 * Type guard: check if evaluation is fully evaluated with non-null score.
 */
export function isCharacterEvaluated(evaluation: CharacterEvaluation): boolean {
  return evaluation.status === 'EVALUATED' && evaluation.evaluationScore !== null;
}

/**
 * Type guard: check if evaluation is partially evaluated with non-null score.
 */
export function isCharacterPartiallyEvaluated(evaluation: CharacterEvaluation): boolean {
  return evaluation.status === 'PARTIALLY_EVALUATED' && evaluation.evaluationScore !== null;
}

/**
 * Type guard: check if evaluation is blocked by context dependencies.
 */
export function isCharacterContextDependent(evaluation: CharacterEvaluation): boolean {
  return evaluation.status === 'CONTEXT_DEPENDENT';
}

/**
 * Type guard: check if evaluation is blocked by unknown investment dimensions.
 */
export function isCharacterInvestmentUnknown(evaluation: CharacterEvaluation): boolean {
  return evaluation.status === 'INVESTMENT_UNKNOWN';
}

/**
 * Type guard: check if evaluation is blocked by unmodeled mechanics.
 */
export function isCharacterUnmodeled(evaluation: CharacterEvaluation): boolean {
  return evaluation.status === 'UNMODELED';
}

/**
 * Type guard: check if evaluation has an active finite numerical evaluation score.
 */
export function hasCharacterEvaluationScore(evaluation: CharacterEvaluation): boolean {
  return evaluation.evaluationScore !== null && Number.isFinite(evaluation.evaluationScore);
}

/**
 * Evaluates whether a CharacterEvaluation matches a filter.
 */
export function matchesCharacterEvaluationFilter(
  evaluation: CharacterEvaluation,
  filter: CharacterEvaluationFilter
): boolean {
  if (filter.resonatorId && evaluation.resonatorId !== filter.resonatorId) {
    return false;
  }
  if (filter.status && evaluation.status !== filter.status) {
    return false;
  }
  if (filter.hasScore !== undefined) {
    const hasScore = hasCharacterEvaluationScore(evaluation);
    if (filter.hasScore !== hasScore) {
      return false;
    }
  }

  const score = evaluation.evaluationScore;
  if (filter.minScore !== undefined) {
    if (score === null || score < filter.minScore) {
      return false;
    }
  }
  if (filter.maxScore !== undefined) {
    if (score === null || score > filter.maxScore) {
      return false;
    }
  }

  return true;
}
