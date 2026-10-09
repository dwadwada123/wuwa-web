/**
 * Wuthering Waves Deterministic Owned Roster Eligibility Predicates
 * Phase 7 Step 12: Deterministic Owned Roster Eligibility Contract
 *
 * Implements deterministic ID derivation, roster normalization and validation,
 * order-preserving comparators, type guards, and query filter matchers.
 */

import { getKnownResonatorIds } from '../team-composition/repository.ts';
import {
  OWNED_ROSTER_ELIGIBILITY_RULE_VERSION,
  EMPTY_ROSTER_ELIGIBILITY_PROVENANCE
} from './rules.ts';
import type {
  OwnedRosterSnapshot,
  NormalizedOwnedRoster,
  TeamCompositionRosterEligibility,
  TeamCompositionEligibilityFilter
} from './types.ts';

/**
 * Derives the authoritative deterministic ID for a team composition roster eligibility record.
 * Format: team-roster-eligibility:<patchVersion>:<candidateId>:<ruleVersion>
 *
 * Fully deterministic; does not use UUIDs, timestamps, or process IDs.
 */
export function deriveTeamCompositionEligibilityId(
  patchVersion: string,
  candidateId: string,
  ruleVersion: string = OWNED_ROSTER_ELIGIBILITY_RULE_VERSION
): string {
  if (!patchVersion || typeof patchVersion !== 'string') {
    throw new Error('deriveTeamCompositionEligibilityId: patchVersion must be a non-empty string.');
  }
  if (!candidateId || typeof candidateId !== 'string') {
    throw new Error('deriveTeamCompositionEligibilityId: candidateId must be a non-empty string.');
  }
  return `team-roster-eligibility:${patchVersion}:${candidateId}:${ruleVersion}`;
}

/**
 * Validates and normalizes an input OwnedRosterSnapshot into a canonical, deduplicated structure.
 *
 * Rules:
 * 1. Strictly Patch 3.7.
 * 2. All Resonator IDs must exist in the canonical Patch 3.7 dataset (60 known Resonators).
 * 3. Unknown Resonator IDs fail closed (isValid: false).
 * 4. Duplicate IDs are deduplicated deterministically.
 * 5. Input ordering does NOT affect canonical ordering (sorted via localeCompare).
 * 6. Empty roster is valid input.
 */
export function normalizeOwnedRoster(
  roster: OwnedRosterSnapshot,
  knownResonatorIdsInput?: readonly string[]
): NormalizedOwnedRoster {
  if (!roster || typeof roster !== 'object') {
    return Object.freeze({
      patchVersion: '3.7',
      canonicalOwnedIds: Object.freeze([]),
      ownedIdSet: new Set<string>(),
      invalidIds: Object.freeze([]),
      isValid: false,
      validationError: 'Invalid roster snapshot: expected an object.',
      provenance: EMPTY_ROSTER_ELIGIBILITY_PROVENANCE
    });
  }

  // 1. Strict patch validation
  if (roster.patchVersion !== '3.7') {
    return Object.freeze({
      patchVersion: (roster.patchVersion as string) || 'UNKNOWN_PATCH',
      canonicalOwnedIds: Object.freeze([]),
      ownedIdSet: new Set<string>(),
      invalidIds: Object.freeze([]),
      isValid: false,
      validationError: `Patch mismatch: Expected '3.7', got '${roster.patchVersion}'.`,
      provenance: roster.provenance
    });
  }

  if (!Array.isArray(roster.ownedResonatorIds)) {
    return Object.freeze({
      patchVersion: '3.7',
      canonicalOwnedIds: Object.freeze([]),
      ownedIdSet: new Set<string>(),
      invalidIds: Object.freeze([]),
      isValid: false,
      validationError: 'Invalid ownedResonatorIds: expected an array.',
      provenance: roster.provenance
    });
  }

  const knownIds = knownResonatorIdsInput ?? getKnownResonatorIds();
  const knownSet = new Set(knownIds);

  const invalidIds: string[] = [];
  const validSet = new Set<string>();

  for (const rawId of roster.ownedResonatorIds) {
    if (typeof rawId !== 'string' || rawId.trim() === '') {
      invalidIds.push(String(rawId));
      continue;
    }
    const trimmed = rawId.trim();
    if (!knownSet.has(trimmed)) {
      invalidIds.push(trimmed);
    } else {
      validSet.add(trimmed);
    }
  }

  // If any invalid or unrecognized Resonator IDs were encountered, fail closed
  if (invalidIds.length > 0) {
    const sortedInvalid = Object.freeze(invalidIds.sort((a, b) => a.localeCompare(b)));
    return Object.freeze({
      patchVersion: '3.7',
      canonicalOwnedIds: Object.freeze([]),
      ownedIdSet: new Set<string>(),
      invalidIds: sortedInvalid,
      isValid: false,
      validationError: `Unrecognized or invalid Resonator IDs in roster: [${sortedInvalid.join(', ')}].`,
      provenance: roster.provenance
    });
  }

  const canonicalSorted = Object.freeze(Array.from(validSet).sort((a, b) => a.localeCompare(b)));

  return Object.freeze({
    patchVersion: '3.7',
    canonicalOwnedIds: canonicalSorted,
    ownedIdSet: new Set(canonicalSorted),
    invalidIds: Object.freeze([]),
    isValid: true,
    provenance: roster.provenance
  });
}

/**
 * Comparator for TeamCompositionRosterEligibility objects.
 * Strictly preserves Step 11 evidence ranking order!
 * Order:
 * 1. RANKED comes before UNRANKABLE
 * 2. If both RANKED: step11Rank ASC (1 is highest)
 * 3. If both UNRANKABLE: canonical member IDs ASC, then candidateId ASC
 */
export function compareTeamCompositionRosterEligibility(
  a: TeamCompositionRosterEligibility,
  b: TeamCompositionRosterEligibility
): number {
  if (a.step11RankingStatus === 'RANKED' && b.step11RankingStatus === 'UNRANKABLE') return -1;
  if (a.step11RankingStatus === 'UNRANKABLE' && b.step11RankingStatus === 'RANKED') return 1;

  if (a.step11RankingStatus === 'RANKED' && b.step11RankingStatus === 'RANKED') {
    if (a.step11Rank !== b.step11Rank) {
      if (a.step11Rank === null || b.step11Rank === null) {
        throw new Error('compareTeamCompositionRosterEligibility: null rank in RANKED status.');
      }
      return a.step11Rank - b.step11Rank;
    }
  }

  for (let i = 0; i < 3; i++) {
    const cmp = a.memberResonatorIds[i].localeCompare(b.memberResonatorIds[i]);
    if (cmp !== 0) return cmp;
  }
  return a.candidateId.localeCompare(b.candidateId);
}

/**
 * Type guard verifying if a candidate is fully constructible from the owned roster.
 */
export function isEligibleCandidate(
  record: TeamCompositionRosterEligibility
): boolean {
  return record.isEligible && record.eligibilityStatus === 'ELIGIBLE';
}

/**
 * Type guard verifying if a candidate is partially owned (1 or 2 members owned).
 */
export function isPartiallyOwnedCandidate(
  record: TeamCompositionRosterEligibility
): boolean {
  return record.eligibilityStatus === 'PARTIALLY_OWNED';
}

/**
 * Type guard verifying if a candidate has 0 members owned.
 */
export function isNotOwnedCandidate(
  record: TeamCompositionRosterEligibility
): boolean {
  return record.eligibilityStatus === 'NOT_OWNED';
}

/**
 * Matches an eligibility record against a multi-criteria query filter.
 */
export function matchesTeamCompositionEligibilityFilter(
  record: TeamCompositionRosterEligibility,
  filter: TeamCompositionEligibilityFilter
): boolean {
  if (filter.eligibilityStatus && record.eligibilityStatus !== filter.eligibilityStatus) {
    return false;
  }
  if (filter.isEligible !== undefined && record.isEligible !== filter.isEligible) {
    return false;
  }
  if (filter.step11RankingStatus && record.step11RankingStatus !== filter.step11RankingStatus) {
    return false;
  }
  if (filter.minimumRank !== undefined) {
    if (record.step11Rank === null || record.step11Rank < filter.minimumRank) {
      return false;
    }
  }
  if (filter.maximumRank !== undefined) {
    if (record.step11Rank === null || record.step11Rank > filter.maximumRank) {
      return false;
    }
  }
  if (filter.minimumScore !== undefined) {
    if (record.step11TotalScore === null || record.step11TotalScore < filter.minimumScore) {
      return false;
    }
  }
  if (filter.maximumScore !== undefined) {
    if (record.step11TotalScore === null || record.step11TotalScore > filter.maximumScore) {
      return false;
    }
  }
  if (filter.resonatorId) {
    if (!record.memberResonatorIds.includes(filter.resonatorId)) {
      return false;
    }
  }
  return true;
}
