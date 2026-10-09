/**
 * Wuthering Waves Deterministic Team Build Readiness Repository
 * Phase 7 Step 14: Deterministic Team Build Readiness & Investment Applicability Contract
 *
 * Provides query, lookup, filtering, and summary operations over TeamBuildReadiness evaluations.
 */

import {
  getTeamCompositionRankings,
  getRankingByCandidateId
} from '../ranking/repository.ts';
import {
  getEligibility,
  getAllCandidateEligibilities
} from '../../roster/repository.ts';
import { getKnownResonatorIds } from '../repository.ts';
import {
  getInvestmentSnapshot,
  createUninvestedSnapshot
} from '../../investment/repository.ts';
import {
  evaluateTeamBuildReadiness
} from './evaluator.ts';
import {
  matchesTeamBuildReadinessFilter
} from './predicates.ts';
import type {
  OwnedRosterSnapshot,
  ResonatorInvestmentSnapshot
} from '../../investment/types.ts';
import type {
  TeamBuildReadiness,
  TeamBuildReadinessFilter,
  TeamBuildReadinessSummary,
  TeamInvestmentCompleteness
} from './types.ts';

/**
 * Helper to build an in-memory lookup map of investment snapshots for all canonical Resonators.
 */
function buildResonatorInvestmentMap(
  customInvestments?: readonly ResonatorInvestmentSnapshot[]
): Map<string, ResonatorInvestmentSnapshot> {
  const map = new Map<string, ResonatorInvestmentSnapshot>();
  const known = getKnownResonatorIds();

  for (const resId of known) {
    map.set(resId, getInvestmentSnapshot(resId, customInvestments) ?? createUninvestedSnapshot(resId));
  }

  return map;
}

/**
 * Evaluates the build readiness of a single candidate by its Step 9 candidate ID.
 */
export function getTeamBuildReadiness(
  teamCandidateId: string,
  roster: OwnedRosterSnapshot,
  customInvestments?: readonly ResonatorInvestmentSnapshot[]
): TeamBuildReadiness | undefined {
  const ranking = getRankingByCandidateId(teamCandidateId);
  if (!ranking) return undefined;

  const eligibility = getEligibility(teamCandidateId, roster);
  if (!eligibility) return undefined;

  const [m1, m2, m3] = ranking.memberResonatorIds;
  const snap1 = getInvestmentSnapshot(m1, customInvestments) ?? createUninvestedSnapshot(m1);
  const snap2 = getInvestmentSnapshot(m2, customInvestments) ?? createUninvestedSnapshot(m2);
  const snap3 = getInvestmentSnapshot(m3, customInvestments) ?? createUninvestedSnapshot(m3);

  return evaluateTeamBuildReadiness(ranking, eligibility, [snap1, snap2, snap3]);
}

/**
 * Evaluates all 34,220 candidates against an owned roster snapshot and optional investment snapshots.
 * Strictly preserves the original Step 11 ranking order!
 */
export function getAllTeamBuildReadiness(
  roster: OwnedRosterSnapshot,
  customInvestments?: readonly ResonatorInvestmentSnapshot[],
  filter?: TeamBuildReadinessFilter
): readonly TeamBuildReadiness[] {
  const rankings = getTeamCompositionRankings();
  const eligibilities = getAllCandidateEligibilities(roster);
  const investmentMap = buildResonatorInvestmentMap(customInvestments);

  const results: TeamBuildReadiness[] = [];

  for (let i = 0; i < rankings.length; i++) {
    const ranking = rankings[i];
    const eligibility = eligibilities[i];
    const [m1, m2, m3] = ranking.memberResonatorIds;

    const snap1 = investmentMap.get(m1) ?? createUninvestedSnapshot(m1);
    const snap2 = investmentMap.get(m2) ?? createUninvestedSnapshot(m2);
    const snap3 = investmentMap.get(m3) ?? createUninvestedSnapshot(m3);

    const record = evaluateTeamBuildReadiness(ranking, eligibility, [snap1, snap2, snap3]);

    if (!filter || matchesTeamBuildReadinessFilter(record, filter)) {
      results.push(record);
    }
  }

  return Object.freeze(results);
}

/**
 * Retrieves all ready teams (fully owned candidates).
 * Strictly preserves Step 11 ranking order.
 */
export function getReadyTeams(
  roster: OwnedRosterSnapshot,
  customInvestments?: readonly ResonatorInvestmentSnapshot[],
  filter?: TeamBuildReadinessFilter
): readonly TeamBuildReadiness[] {
  return getAllTeamBuildReadiness(roster, customInvestments, {
    ...filter,
    isReady: true
  });
}

/**
 * Retrieves all partially owned teams (1 or 2 members owned).
 */
export function getPartiallyOwnedTeams(
  roster: OwnedRosterSnapshot,
  customInvestments?: readonly ResonatorInvestmentSnapshot[],
  filter?: TeamBuildReadinessFilter
): readonly TeamBuildReadiness[] {
  return getAllTeamBuildReadiness(roster, customInvestments, {
    ...filter,
    ownershipStatus: 'PARTIALLY_OWNED'
  });
}

/**
 * Retrieves all teams where no investment information is known.
 */
export function getInvestmentUnknownTeams(
  roster: OwnedRosterSnapshot,
  customInvestments?: readonly ResonatorInvestmentSnapshot[],
  filter?: TeamBuildReadinessFilter
): readonly TeamBuildReadiness[] {
  return getAllTeamBuildReadiness(roster, customInvestments, {
    ...filter,
    investmentStatus: 'INVESTMENT_UNKNOWN'
  });
}

/**
 * Retrieves all teams where all investment dimensions are known.
 */
export function getFullyKnownInvestmentTeams(
  roster: OwnedRosterSnapshot,
  customInvestments?: readonly ResonatorInvestmentSnapshot[],
  filter?: TeamBuildReadinessFilter
): readonly TeamBuildReadiness[] {
  return getAllTeamBuildReadiness(roster, customInvestments, {
    ...filter,
    investmentStatus: 'INVESTMENT_COMPLETE'
  });
}

/**
 * Retrieves factual investment completeness for a specific candidate.
 */
export function getTeamInvestmentCompleteness(
  teamCandidateId: string,
  roster: OwnedRosterSnapshot,
  customInvestments?: readonly ResonatorInvestmentSnapshot[]
): TeamInvestmentCompleteness | undefined {
  const readiness = getTeamBuildReadiness(teamCandidateId, roster, customInvestments);
  return readiness?.investmentCompleteness;
}

/**
 * Computes an objective summary of build readiness and investment availability across the candidate space.
 */
export function getTeamBuildReadinessSummary(
  roster: OwnedRosterSnapshot,
  customInvestments?: readonly ResonatorInvestmentSnapshot[]
): TeamBuildReadinessSummary {
  const allRecords = getAllTeamBuildReadiness(roster, customInvestments);

  let fullyOwnedCount = 0;
  let partiallyOwnedCount = 0;
  let notOwnedCount = 0;
  let readyCount = 0;
  let readyPartialCount = 0;
  let readyUnknownCount = 0;
  let investmentCompleteCount = 0;
  let investmentPartialCount = 0;
  let investmentUnknownCount = 0;
  let investmentUnavailableCount = 0;
  let sumRatios = 0;

  for (const r of allRecords) {
    if (r.ownershipStatus === 'FULLY_OWNED') fullyOwnedCount++;
    else if (r.ownershipStatus === 'PARTIALLY_OWNED') partiallyOwnedCount++;
    else if (r.ownershipStatus === 'NOT_OWNED') notOwnedCount++;

    if (r.readinessStatus === 'READY') readyCount++;
    else if (r.readinessStatus === 'READY_WITH_PARTIAL_INVESTMENT') readyPartialCount++;
    else if (r.readinessStatus === 'READY_WITH_UNKNOWN_INVESTMENT') readyUnknownCount++;

    if (r.investmentStatus === 'INVESTMENT_COMPLETE') investmentCompleteCount++;
    else if (r.investmentStatus === 'INVESTMENT_PARTIAL') investmentPartialCount++;
    else if (r.investmentStatus === 'INVESTMENT_UNKNOWN') investmentUnknownCount++;
    else if (r.investmentStatus === 'INVESTMENT_UNAVAILABLE') investmentUnavailableCount++;

    if (r.investmentCompleteness.teamCompletenessRatio !== null) {
      sumRatios += r.investmentCompleteness.teamCompletenessRatio;
    }
  }

  const avgRatio =
    allRecords.length > 0
      ? Math.round((sumRatios / allRecords.length) * 10000) / 10000
      : null;

  return Object.freeze({
    totalCandidates: allRecords.length,
    fullyOwnedCount,
    partiallyOwnedCount,
    notOwnedCount,
    readyCount,
    readyPartialCount,
    readyUnknownCount,
    investmentCompleteCount,
    investmentPartialCount,
    investmentUnknownCount,
    investmentUnavailableCount,
    averageCompletenessRatio: avgRatio
  });
}
