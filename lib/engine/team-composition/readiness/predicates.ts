/**
 * Wuthering Waves Deterministic Team Build Readiness Predicates
 * Phase 7 Step 14: Deterministic Team Build Readiness & Investment Applicability Contract
 *
 * Implements deterministic ID derivation, status evaluation predicates,
 * order-preserving comparators, and filter matchers.
 */

import { TEAM_BUILD_READINESS_RULE_VERSION } from './rules.ts';
import type {
  TeamBuildReadiness,
  TeamBuildReadinessFilter
} from './types.ts';

/**
 * Derives the authoritative deterministic ID for a TeamBuildReadiness record.
 * Format: team-build-readiness:<patchVersion>:<teamCandidateId>:<ruleVersion>
 *
 * Fully deterministic; does not use UUIDs, timestamps, or process randomness.
 */
export function deriveTeamBuildReadinessId(
  patchVersion: string,
  teamCandidateId: string,
  ruleVersion: string = TEAM_BUILD_READINESS_RULE_VERSION
): string {
  if (!patchVersion || typeof patchVersion !== 'string') {
    throw new Error('deriveTeamBuildReadinessId: patchVersion must be a non-empty string.');
  }
  if (!teamCandidateId || typeof teamCandidateId !== 'string') {
    throw new Error('deriveTeamBuildReadinessId: teamCandidateId must be a non-empty string.');
  }
  return `team-build-readiness:${patchVersion}:${teamCandidateId}:${ruleVersion}`;
}

/**
 * Returns true iff all 3 candidate members are owned by the user.
 */
export function isTeamFullyOwned(readiness: TeamBuildReadiness): boolean {
  return readiness.ownershipStatus === 'FULLY_OWNED';
}

/**
 * Returns true iff all applicable investment dimensions are KNOWN across all 3 members.
 */
export function isInvestmentFullyKnown(readiness: TeamBuildReadiness): boolean {
  return readiness.investmentStatus === 'INVESTMENT_COMPLETE';
}

/**
 * Returns true iff some investment dimensions are KNOWN and some are UNKNOWN.
 */
export function isInvestmentPartiallyKnown(readiness: TeamBuildReadiness): boolean {
  return readiness.investmentStatus === 'INVESTMENT_PARTIAL';
}

/**
 * Returns true iff at least one investment dimension is KNOWN across the 3 members.
 */
export function hasAnyKnownInvestment(readiness: TeamBuildReadiness): boolean {
  return readiness.investmentCompleteness.knownMemberDimensions > 0;
}

/**
 * Returns true iff at least one investment dimension is UNKNOWN across the 3 members.
 */
export function hasUnknownInvestment(readiness: TeamBuildReadiness): boolean {
  return readiness.investmentCompleteness.unknownMemberDimensions > 0;
}

/**
 * Returns true iff the team is fully owned AND has complete investment data
 * ready for consumption by future evaluation layers.
 * Factual state check only; NEVER a quality judgment!
 */
export function isReadyForFutureInvestmentEvaluation(readiness: TeamBuildReadiness): boolean {
  return readiness.isFullyOwned && readiness.investmentStatus === 'INVESTMENT_COMPLETE';
}

/**
 * Matches a TeamBuildReadiness record against a multi-criteria query filter.
 */
export function matchesTeamBuildReadinessFilter(
  record: TeamBuildReadiness,
  filter: TeamBuildReadinessFilter
): boolean {
  if (filter.ownershipStatus && record.ownershipStatus !== filter.ownershipStatus) {
    return false;
  }
  if (filter.investmentStatus && record.investmentStatus !== filter.investmentStatus) {
    return false;
  }
  if (filter.readinessStatus && record.readinessStatus !== filter.readinessStatus) {
    return false;
  }
  if (filter.isFullyOwned !== undefined && record.isFullyOwned !== filter.isFullyOwned) {
    return false;
  }
  if (filter.isReady !== undefined && record.isReady !== filter.isReady) {
    return false;
  }
  if (filter.step11RankingStatus && record.step11RankingStatus !== filter.step11RankingStatus) {
    return false;
  }
  if (filter.resonatorId && !record.memberResonatorIds.includes(filter.resonatorId)) {
    return false;
  }
  if (filter.minimumTeamCompleteness !== undefined) {
    if (
      record.investmentCompleteness.teamCompletenessRatio === null ||
      record.investmentCompleteness.teamCompletenessRatio < filter.minimumTeamCompleteness
    ) {
      return false;
    }
  }
  if (filter.maximumTeamCompleteness !== undefined) {
    if (
      record.investmentCompleteness.teamCompletenessRatio === null ||
      record.investmentCompleteness.teamCompletenessRatio > filter.maximumTeamCompleteness
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Comparator for TeamBuildReadiness objects.
 * Strictly preserves Step 11 evidence ranking order!
 * Order:
 * 1. RANKED comes before UNRANKABLE
 * 2. If both RANKED: preservedStep11Rank ASC (1 is highest)
 * 3. If both UNRANKABLE: canonical member IDs ASC, then teamCandidateId ASC
 */
export function compareTeamBuildReadiness(
  a: TeamBuildReadiness,
  b: TeamBuildReadiness
): number {
  if (a.step11RankingStatus === 'RANKED' && b.step11RankingStatus === 'UNRANKABLE') return -1;
  if (a.step11RankingStatus === 'UNRANKABLE' && b.step11RankingStatus === 'RANKED') return 1;

  if (a.step11RankingStatus === 'RANKED' && b.step11RankingStatus === 'RANKED') {
    if (a.preservedStep11Rank !== b.preservedStep11Rank) {
      if (a.preservedStep11Rank === null || b.preservedStep11Rank === null) {
        throw new Error('compareTeamBuildReadiness: null rank in RANKED status.');
      }
      return a.preservedStep11Rank - b.preservedStep11Rank;
    }
  }

  for (let i = 0; i < 3; i++) {
    const cmp = a.memberResonatorIds[i].localeCompare(b.memberResonatorIds[i]);
    if (cmp !== 0) return cmp;
  }
  return a.teamCandidateId.localeCompare(b.teamCandidateId);
}
