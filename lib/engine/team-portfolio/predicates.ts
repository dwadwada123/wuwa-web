/**
 * Wuthering Waves Team Portfolio Predicates & Utilities
 * Phase 7 Step 22: Deterministic Team Portfolio Selection & Optimization Contract
 *
 * Implements deterministic identifier derivation, mutual disjointness verification,
 * and canonical ordering for TeamPortfolio records.
 */

import {
  TEAM_PORTFOLIO_RULE_VERSION,
  CANONICAL_PATCH_VERSION,
  MIN_PORTFOLIO_TARGET_K,
  MAX_PORTFOLIO_TARGET_K,
  TEAM_MEMBER_COUNT
} from './rules.ts';
import { isCanonicalResonatorId } from '../investment/predicates.ts';
import type {
  TeamPortfolio,
  TeamBuildEvaluation
} from './types.ts';

/**
 * Derives the authoritative deterministic ID for a TeamPortfolio record.
 * Format: team-portfolio:<patchVersion>:<targetK>:<teamId1>:::<teamId2>::...:<ruleVersion>
 *
 * Fully deterministic; does not use UUIDs, timestamps, or random seeds.
 */
export function deriveTeamPortfolioId(
  teamIds: readonly string[],
  targetK: number,
  patchVersion: string = CANONICAL_PATCH_VERSION,
  ruleVersion: string = TEAM_PORTFOLIO_RULE_VERSION
): string {
  if (targetK < MIN_PORTFOLIO_TARGET_K || targetK > MAX_PORTFOLIO_TARGET_K) {
    throw new Error(
      `deriveTeamPortfolioId: targetK must be between ${MIN_PORTFOLIO_TARGET_K} and ${MAX_PORTFOLIO_TARGET_K}, got ${targetK}.`
    );
  }
  if (!patchVersion || typeof patchVersion !== 'string' || patchVersion.trim() === '') {
    throw new Error('deriveTeamPortfolioId: patchVersion must be a non-empty string.');
  }
  if (!ruleVersion || typeof ruleVersion !== 'string' || ruleVersion.trim() === '') {
    throw new Error('deriveTeamPortfolioId: ruleVersion must be a non-empty string.');
  }

  if (!teamIds || teamIds.length === 0) {
    return `team-portfolio:${patchVersion.trim()}:${targetK}:INFEASIBLE:${ruleVersion.trim()}`;
  }

  const sortedTeamIds = [...teamIds].sort((a, b) => a.localeCompare(b));
  return `team-portfolio:${patchVersion.trim()}:${targetK}:${sortedTeamIds.join(':::')}:${ruleVersion.trim()}`;
}

/**
 * Strictly verifies whether a collection of TeamBuildEvaluations is mutually disjoint
 * (no two teams share any Resonator).
 */
export function areTeamsMutuallyDisjoint(
  teams: readonly TeamBuildEvaluation[]
): boolean {
  if (!teams || teams.length <= 1) return true;

  const seenResonators = new Set<string>();
  for (const team of teams) {
    for (const memberId of team.memberResonatorIds) {
      if (seenResonators.has(memberId)) {
        return false;
      }
      seenResonators.add(memberId);
    }
  }
  return true;
}

/**
 * Extracts and canonicalizes all distinct member Resonator IDs across a collection of teams.
 * Returns sorted lexicographical tuple of IDs.
 */
export function extractPortfolioMemberIds(
  teams: readonly TeamBuildEvaluation[]
): readonly string[] {
  if (!teams || teams.length === 0) return Object.freeze([]);

  const memberIds: string[] = [];
  for (const team of teams) {
    for (const memberId of team.memberResonatorIds) {
      memberIds.push(memberId);
    }
  }
  return Object.freeze(memberIds.sort((a, b) => a.localeCompare(b)));
}

/**
 * Validates whether an individual candidate team is constructible from player's owned roster.
 */
export function isTeamEligibleForRoster(
  team: TeamBuildEvaluation,
  ownedResonatorIds: ReadonlySet<string>
): boolean {
  if (team.status === 'PATCH_MISMATCH' || team.status === 'INVALID') {
    return false;
  }
  for (const memberId of team.memberResonatorIds) {
    if (!isCanonicalResonatorId(memberId) || !ownedResonatorIds.has(memberId)) {
      return false;
    }
  }
  return true;
}

/**
 * Deterministically compares two TeamPortfolios for sorting.
 */
export function compareTeamPortfolios(a: TeamPortfolio, b: TeamPortfolio): number {
  if (a.targetTeamCount !== b.targetTeamCount) {
    return a.targetTeamCount - b.targetTeamCount;
  }
  if (a.selectedTeamCount !== b.selectedTeamCount) {
    return b.selectedTeamCount - a.selectedTeamCount; // more teams first
  }
  const cmpKnown =
    b.completeness.knownPortfolioAspects - a.completeness.knownPortfolioAspects;
  if (cmpKnown !== 0) return cmpKnown;
  return a.id.localeCompare(b.id);
}
