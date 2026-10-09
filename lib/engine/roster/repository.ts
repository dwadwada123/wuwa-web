/**
 * Wuthering Waves Deterministic Owned Roster Eligibility Repository
 * Phase 7 Step 12: Deterministic Owned Roster Eligibility Contract
 *
 * Provides query, filtering, and summary operations over
 * TeamCompositionRosterEligibility evaluations against a given OwnedRosterSnapshot.
 */

import {
  getTeamCompositionRankings,
  getRankingByCandidateId
} from '../team-composition/ranking/repository.ts';
import {
  normalizeOwnedRoster,
  matchesTeamCompositionEligibilityFilter
} from './predicates.ts';
import {
  evaluateCandidateRosterEligibility,
  evaluateRosterEligibility
} from './eligibility.ts';
import type {
  OwnedRosterSnapshot,
  TeamCompositionRosterEligibility,
  TeamCompositionEligibilityFilter,
  TeamCompositionEligibilitySummary
} from './types.ts';

/**
 * Evaluates the eligibility of a single candidate by its Step 9 candidate ID under a roster.
 */
export function getEligibility(
  candidateId: string,
  roster: OwnedRosterSnapshot
): TeamCompositionRosterEligibility | undefined {
  const ranking = getRankingByCandidateId(candidateId);
  if (!ranking) return undefined;
  const normalized = normalizeOwnedRoster(roster);
  return evaluateCandidateRosterEligibility(ranking, normalized);
}

/**
 * Evaluates all 34,220 candidates against an owned roster snapshot.
 * Preserves the exact Step 11 ranking order.
 */
export function getAllCandidateEligibilities(
  roster: OwnedRosterSnapshot,
  filter?: TeamCompositionEligibilityFilter
): readonly TeamCompositionRosterEligibility[] {
  const rankings = getTeamCompositionRankings();
  let results = evaluateRosterEligibility(rankings, roster);

  if (filter) {
    results = results.filter((r) => matchesTeamCompositionEligibilityFilter(r, filter));
  }

  return results;
}

/**
 * Retrieves all eligible candidates (all 3 members owned).
 * Strictly preserves the original Step 11 ranking order!
 */
export function getEligibleCandidates(
  roster: OwnedRosterSnapshot,
  filter?: TeamCompositionEligibilityFilter
): readonly TeamCompositionRosterEligibility[] {
  return getAllCandidateEligibilities(roster, {
    ...filter,
    isEligible: true
  });
}

/**
 * Retrieves all ineligible candidates (partially owned or not owned).
 */
export function getIneligibleCandidates(
  roster: OwnedRosterSnapshot,
  filter?: TeamCompositionEligibilityFilter
): readonly TeamCompositionRosterEligibility[] {
  return getAllCandidateEligibilities(roster, {
    ...filter,
    isEligible: false
  });
}

/**
 * Retrieves all eligible candidates that have a valid Step 11 rank.
 * Strictly preserves the original Step 11 rank order (e.g. #2, #5, #9).
 * NEVER re-indexes or creates a new rank.
 */
export function getEligibleRankedCandidates(
  roster: OwnedRosterSnapshot
): readonly TeamCompositionRosterEligibility[] {
  return getAllCandidateEligibilities(roster, {
    isEligible: true,
    step11RankingStatus: 'RANKED'
  });
}

/**
 * Computes an objective summary of candidate feasibility under an owned roster snapshot.
 */
export function getEligibilitySummary(
  roster: OwnedRosterSnapshot
): TeamCompositionEligibilitySummary {
  const normalized = normalizeOwnedRoster(roster);
  const eligibilities = getAllCandidateEligibilities(roster);

  let eligibleCandidates = 0;
  let partiallyOwnedCandidates = 0;
  let notOwnedCandidates = 0;
  let invalidRosterCandidates = 0;
  let patchMismatchCandidates = 0;
  let rankedEligibleCandidates = 0;
  let unrankableEligibleCandidates = 0;

  for (const e of eligibilities) {
    switch (e.eligibilityStatus) {
      case 'ELIGIBLE':
        eligibleCandidates++;
        if (e.step11RankingStatus === 'RANKED') {
          rankedEligibleCandidates++;
        } else {
          unrankableEligibleCandidates++;
        }
        break;
      case 'PARTIALLY_OWNED':
        partiallyOwnedCandidates++;
        break;
      case 'NOT_OWNED':
        notOwnedCandidates++;
        break;
      case 'INVALID_ROSTER':
        invalidRosterCandidates++;
        break;
      case 'PATCH_MISMATCH':
        patchMismatchCandidates++;
        break;
    }
  }

  return Object.freeze({
    totalCandidates: eligibilities.length,
    eligibleCandidates,
    partiallyOwnedCandidates,
    notOwnedCandidates,
    invalidRosterCandidates,
    patchMismatchCandidates,
    rankedEligibleCandidates,
    unrankableEligibleCandidates,
    ownedResonatorCount: normalized.canonicalOwnedIds.length
  });
}
