/**
 * Canonical Team Representation & Deduplication
 *
 * Provides deterministic canonical identity and member ordering
 * so that any permutation of 3 resonators maps to the exact same canonical candidate.
 */

import type {
  ResonatorBuild,
  TeamCandidate,
} from '../../domain/types/index.ts';

/**
 * Creates a deterministic canonical team key by sorting resonator IDs.
 * Format: "res-id-1:res-id-2:res-id-3"
 */
export function createCanonicalTeamKey(resonatorIds: string[]): string {
  return [...resonatorIds].sort((a, b) => a.localeCompare(b)).join(':');
}

/**
 * Normalizes team members into deterministic canonical order based on resonator ID.
 */
export function canonicalizeTeamMembers(
  members: ResonatorBuild[]
): [ResonatorBuild, ResonatorBuild, ResonatorBuild] {
  if (members.length !== 3) {
    throw new Error(`Cannot canonicalize team: expected 3 members, got ${members.length}.`);
  }

  const sorted = [...members].sort((a, b) =>
    a.resonator.id.localeCompare(b.resonator.id)
  );

  return [sorted[0], sorted[1], sorted[2]];
}

/**
 * Generates the canonical key directly from a TeamCandidate.
 */
export function getCandidateKey(candidate: TeamCandidate): string {
  const ids = candidate.members.map((m) => m.resonator.id);
  return createCanonicalTeamKey(ids);
}

/**
 * Checks if two team candidates represent the exact same team regardless of member order.
 */
export function isSameTeam(a: TeamCandidate, b: TeamCandidate): boolean {
  return getCandidateKey(a) === getCandidateKey(b);
}
