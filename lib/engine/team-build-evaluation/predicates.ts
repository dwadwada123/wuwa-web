/**
 * Wuthering Waves Team Build Evaluation Predicates
 * Phase 7 Step 21: Deterministic Team Build Evaluation Contract
 *
 * Implements deterministic ID derivation, sorting comparators, and multi-dimensional
 * filtering predicates for TeamBuildEvaluation records.
 */

import {
  TEAM_BUILD_EVALUATION_RULE_VERSION,
  CANONICAL_PATCH_VERSION,
  TEAM_MEMBER_COUNT
} from './rules.ts';
import type {
  TeamBuildEvaluation,
  TeamBuildEvaluationFilter
} from './types.ts';

/**
 * Derives the authoritative deterministic ID for a TeamBuildEvaluation record.
 * Format: team-build:<patchVersion>:<member0>:<member1>:<member2>:<ruleVersion>
 *
 * Fully deterministic; does not use UUIDs, timestamps, or random seeds.
 */
export function deriveTeamBuildEvaluationId(
  members: readonly string[],
  patchVersion: string = CANONICAL_PATCH_VERSION,
  ruleVersion: string = TEAM_BUILD_EVALUATION_RULE_VERSION
): string {
  if (!Array.isArray(members) || members.length !== TEAM_MEMBER_COUNT) {
    throw new Error(
      `deriveTeamBuildEvaluationId: Expected exactly ${TEAM_MEMBER_COUNT} members, got ${members?.length ?? 0}.`
    );
  }
  for (let i = 0; i < members.length; i++) {
    if (!members[i] || typeof members[i] !== 'string' || members[i].trim() === '') {
      throw new Error(`deriveTeamBuildEvaluationId: Invalid member ID at index ${i}: '${members[i]}'.`);
    }
  }
  if (!patchVersion || typeof patchVersion !== 'string' || patchVersion.trim() === '') {
    throw new Error('deriveTeamBuildEvaluationId: patchVersion must be a non-empty string.');
  }
  if (!ruleVersion || typeof ruleVersion !== 'string' || ruleVersion.trim() === '') {
    throw new Error('deriveTeamBuildEvaluationId: ruleVersion must be a non-empty string.');
  }

  const sorted = [...members].sort((a, b) => a.localeCompare(b));
  return `team-build:${patchVersion.trim()}:${sorted[0]}:${sorted[1]}:${sorted[2]}:${ruleVersion.trim()}`;
}

/**
 * Deterministically compares two TeamBuildEvaluation records for sorting.
 * Orders lexicographically by memberResonatorIds[0], memberResonatorIds[1],
 * memberResonatorIds[2], then by id ASC.
 */
export function compareTeamBuildEvaluations(
  a: TeamBuildEvaluation,
  b: TeamBuildEvaluation
): number {
  const c0 = a.memberResonatorIds[0].localeCompare(b.memberResonatorIds[0]);
  if (c0 !== 0) return c0;
  const c1 = a.memberResonatorIds[1].localeCompare(b.memberResonatorIds[1]);
  if (c1 !== 0) return c1;
  const c2 = a.memberResonatorIds[2].localeCompare(b.memberResonatorIds[2]);
  if (c2 !== 0) return c2;
  return a.id.localeCompare(b.id);
}

/**
 * Tests whether a TeamBuildEvaluation matches the supplied filter criteria.
 */
export function matchesTeamBuildEvaluationFilter(
  evaluation: TeamBuildEvaluation,
  filter?: TeamBuildEvaluationFilter
): boolean {
  if (!filter) return true;

  if (filter.patchVersion !== undefined && evaluation.patchVersion !== filter.patchVersion) {
    return false;
  }

  if (filter.status !== undefined && evaluation.status !== filter.status) {
    return false;
  }

  if (
    filter.allCompatibleWeapons !== undefined &&
    evaluation.weaponAggregation.allCompatible !== filter.allCompatibleWeapons
  ) {
    return false;
  }

  if (
    filter.hasIncompatibleWeapon !== undefined &&
    evaluation.weaponAggregation.hasIncompatibleWeapon !== filter.hasIncompatibleWeapon
  ) {
    return false;
  }

  if (
    filter.hasDuplicateSonataSets !== undefined &&
    evaluation.sonataInteraction.hasDuplicateSonataSets !== filter.hasDuplicateSonataSets
  ) {
    return false;
  }

  if (filter.minTeamCompletenessRatio !== undefined) {
    if (
      evaluation.completeness.teamCompletenessRatio === null ||
      evaluation.completeness.teamCompletenessRatio < filter.minTeamCompletenessRatio
    ) {
      return false;
    }
  }

  if (filter.containsResonatorId !== undefined) {
    if (!evaluation.memberResonatorIds.includes(filter.containsResonatorId)) {
      return false;
    }
  }

  return true;
}
