/**
 * Wuthering Waves Team Composition Predicates & Canonical Helpers
 * Phase 7 Step 9: Deterministic Team Composition Candidate Contract
 *
 * Provides deterministic ID derivation, member canonicalization, sorting comparators,
 * type guards, and multi-criteria filters for TeamCompositionCandidates.
 */

import { TEAM_COMPOSITION_RULE_VERSION, TEAM_MEMBER_COUNT } from './rules.ts';
import type {
  TeamCompositionCandidate,
  TeamCompositionCandidateFilter
} from './types.ts';

/**
 * Normalizes and validates 3 Resonator IDs into deterministic canonical order.
 * Strictly verifies exactly 3 distinct, non-empty members.
 *
 * Order independence invariant:
 * canonicalizeTeamMembers(['C', 'A', 'B']) === ['A', 'B', 'C'].
 */
export function canonicalizeTeamMemberIds(
  members: readonly string[]
): readonly [string, string, string] {
  if (!Array.isArray(members) || members.length !== TEAM_MEMBER_COUNT) {
    throw new Error(
      `Team cardinality violation: Expected exactly ${TEAM_MEMBER_COUNT} members, got ${members?.length ?? 0}.`
    );
  }

  for (let i = 0; i < members.length; i++) {
    if (!members[i] || typeof members[i] !== 'string' || members[i].trim() === '') {
      throw new Error(`Team member validation failure: Invalid resonator ID at index ${i}: '${members[i]}'.`);
    }
  }

  const unique = new Set(members);
  if (unique.size !== TEAM_MEMBER_COUNT) {
    throw new Error(
      `Team distinctness violation: Duplicate members detected: [${members.join(', ')}].`
    );
  }

  const sorted = [...members].sort((a, b) => a.localeCompare(b));
  return Object.freeze([sorted[0], sorted[1], sorted[2]]) as readonly [string, string, string];
}

/** Alias for backward and naming compatibility */
export const canonicalizeTeamMembers = canonicalizeTeamMemberIds;

/**
 * Derives a deterministic canonical identifier for a team composition candidate.
 * Format: team-composition:<patchVersion>:<A>:<B>:<C>:<ruleVersion>
 *
 * Guaranteed order-independent:
 * deriveTeamCompositionCandidateId('3.7', ['C', 'A', 'B']) === deriveTeamCompositionCandidateId('3.7', ['A', 'B', 'C']).
 */
export function deriveTeamCompositionCandidateId(
  patchVersion: string,
  members: readonly string[],
  ruleVersion: string = TEAM_COMPOSITION_RULE_VERSION
): string {
  const [a, b, c] = canonicalizeTeamMembers(members);
  return `team-composition:${patchVersion}:${a}:${b}:${c}:${ruleVersion}`;
}

/**
 * Canonical comparator for TeamCompositionCandidate records.
 * Order:
 * 1. memberResonatorIds[0] ascending
 * 2. memberResonatorIds[1] ascending
 * 3. memberResonatorIds[2] ascending
 * 4. candidate ID ascending
 */
export function compareTeamCompositionCandidate(
  a: TeamCompositionCandidate,
  b: TeamCompositionCandidate
): number {
  if (a.memberResonatorIds[0] !== b.memberResonatorIds[0]) {
    return a.memberResonatorIds[0].localeCompare(b.memberResonatorIds[0]);
  }
  if (a.memberResonatorIds[1] !== b.memberResonatorIds[1]) {
    return a.memberResonatorIds[1].localeCompare(b.memberResonatorIds[1]);
  }
  if (a.memberResonatorIds[2] !== b.memberResonatorIds[2]) {
    return a.memberResonatorIds[2].localeCompare(b.memberResonatorIds[2]);
  }
  return a.id.localeCompare(b.id);
}

/**
 * Type guard: check if candidate has fully qualified status.
 */
export function isQualifiedCandidate(candidate: TeamCompositionCandidate): boolean {
  return candidate.qualificationStatus === 'QUALIFIED';
}

/**
 * Type guard: check if candidate is partially qualified.
 */
export function isPartiallyQualifiedCandidate(candidate: TeamCompositionCandidate): boolean {
  return candidate.qualificationStatus === 'PARTIALLY_QUALIFIED';
}

/**
 * Type guard: check if candidate is context-dependent.
 */
export function isContextDependentCandidate(candidate: TeamCompositionCandidate): boolean {
  return candidate.qualificationStatus === 'CONTEXT_DEPENDENT';
}

/**
 * Type guard: check if candidate is unmodeled.
 */
export function isUnmodeledCandidate(candidate: TeamCompositionCandidate): boolean {
  return candidate.qualificationStatus === 'UNMODELED';
}

/**
 * Type guard: check if candidate represents no pairwise evidence.
 */
export function isNoEvidenceCandidate(candidate: TeamCompositionCandidate): boolean {
  return candidate.qualificationStatus === 'NO_PAIRWISE_EVIDENCE';
}

/**
 * Type guard: check if candidate satisfies structural qualification (QUALIFIED or PARTIALLY_QUALIFIED).
 */
export function isStructurallyQualifiedCandidate(candidate: TeamCompositionCandidate): boolean {
  return (
    candidate.qualificationStatus === 'QUALIFIED' ||
    candidate.qualificationStatus === 'PARTIALLY_QUALIFIED'
  );
}

/**
 * Tests whether a TeamCompositionCandidate matches a given query filter.
 */
export function matchesTeamCompositionFilter(
  candidate: TeamCompositionCandidate,
  filter: TeamCompositionCandidateFilter
): boolean {
  if (filter.patchVersion && candidate.patchVersion !== filter.patchVersion) {
    return false;
  }

  if (filter.resonatorId) {
    if (!candidate.memberResonatorIds.includes(filter.resonatorId)) {
      return false;
    }
  }

  if (filter.memberResonatorIds && filter.memberResonatorIds.length > 0) {
    const hasAll = filter.memberResonatorIds.every((id) =>
      candidate.memberResonatorIds.includes(id)
    );
    if (!hasAll) {
      return false;
    }
  }

  if (filter.qualificationStatus && candidate.qualificationStatus !== filter.qualificationStatus) {
    return false;
  }

  if (filter.qualificationType && !candidate.qualificationTypes.includes(filter.qualificationType)) {
    return false;
  }

  if (filter.synergyCategory && !candidate.supportingSynergyCategories.includes(filter.synergyCategory)) {
    return false;
  }

  if (filter.minMatchedPairs !== undefined && candidate.matchedPairCount < filter.minMatchedPairs) {
    return false;
  }

  if (filter.minDirectionalEdges !== undefined && candidate.directionalEdgeCount < filter.minDirectionalEdges) {
    return false;
  }

  return true;
}
