/**
 * Wuthering Waves Character Build Evaluation Predicates
 * Phase 7 Step 20: Deterministic Character Build Evaluation Contract
 *
 * Implements deterministic ID derivation, sorting comparators, and multi-dimensional
 * filtering predicates for CharacterBuildEvaluation records.
 */

import {
  CHARACTER_BUILD_EVALUATION_RULE_VERSION,
  CANONICAL_PATCH_VERSION
} from './rules.ts';
import type {
  CharacterBuildEvaluation,
  CharacterBuildEvaluationFilter
} from './types.ts';

/**
 * Derives the authoritative deterministic ID for a CharacterBuildEvaluation record.
 * Format: char-build:<patchVersion>:<resonatorId>:<ruleVersion>
 *
 * Fully deterministic; does not use UUIDs, timestamps, or random seeds.
 */
export function deriveCharacterBuildEvaluationId(
  resonatorId: string,
  patchVersion: string = CANONICAL_PATCH_VERSION,
  ruleVersion: string = CHARACTER_BUILD_EVALUATION_RULE_VERSION
): string {
  if (!resonatorId || typeof resonatorId !== 'string' || resonatorId.trim() === '') {
    throw new Error('deriveCharacterBuildEvaluationId: resonatorId must be a non-empty string.');
  }
  if (!patchVersion || typeof patchVersion !== 'string' || patchVersion.trim() === '') {
    throw new Error('deriveCharacterBuildEvaluationId: patchVersion must be a non-empty string.');
  }
  if (!ruleVersion || typeof ruleVersion !== 'string' || ruleVersion.trim() === '') {
    throw new Error('deriveCharacterBuildEvaluationId: ruleVersion must be a non-empty string.');
  }

  return `char-build:${patchVersion.trim()}:${resonatorId.trim()}:${ruleVersion.trim()}`;
}

/**
 * Deterministically compares two CharacterBuildEvaluation records for sorting.
 * Orders primarily by resonatorId ASC, then by id ASC.
 */
export function compareCharacterBuildEvaluations(
  a: CharacterBuildEvaluation,
  b: CharacterBuildEvaluation
): number {
  const cmp = a.resonatorId.localeCompare(b.resonatorId);
  if (cmp !== 0) return cmp;
  return a.id.localeCompare(b.id);
}

/**
 * Tests whether a CharacterBuildEvaluation matches the supplied filter criteria.
 */
export function matchesCharacterBuildEvaluationFilter(
  evaluation: CharacterBuildEvaluation,
  filter?: CharacterBuildEvaluationFilter
): boolean {
  if (!filter) return true;

  if (filter.patchVersion !== undefined && evaluation.patchVersion !== filter.patchVersion) {
    return false;
  }

  if (filter.characterId !== undefined && evaluation.resonatorId !== filter.characterId) {
    return false;
  }

  if (filter.status !== undefined && evaluation.status !== filter.status) {
    return false;
  }

  if (
    filter.weaponCompatibility !== undefined &&
    evaluation.weaponEvaluation.compatibility !== filter.weaponCompatibility
  ) {
    return false;
  }

  if (
    filter.sonataAlignment !== undefined &&
    evaluation.echoEvaluation.sonataAlignment !== filter.sonataAlignment
  ) {
    return false;
  }

  if (filter.isFullyEquipped !== undefined) {
    const isFull = evaluation.status === 'FULLY_EQUIPPED';
    if (isFull !== filter.isFullyEquipped) return false;
  }

  if (filter.minCompletenessRatio !== undefined) {
    if (
      evaluation.completeness.completenessRatio === null ||
      evaluation.completeness.completenessRatio < filter.minCompletenessRatio
    ) {
      return false;
    }
  }

  if (filter.element !== undefined && evaluation.element !== filter.element) {
    return false;
  }

  if (filter.weaponType !== undefined && evaluation.weaponType !== filter.weaponType) {
    return false;
  }

  return true;
}
