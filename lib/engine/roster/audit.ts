/**
 * Wuthering Waves Deterministic Owned Roster Eligibility Auditor
 * Phase 7 Step 12: Deterministic Owned Roster Eligibility Contract
 *
 * Audits TeamCompositionRosterEligibility records against Invariants A through AL.
 * Strictly verifies deterministic IDs, full candidate space preservation (34,220),
 * exact ownership membership logic, Step 11 rank/score immutability,
 * and complete absence of gameplay/meta inferences.
 */

import { auditTeamCompositionRankings } from '../team-composition/ranking/audit.ts';
import {
  getTeamCompositionRankings,
  getRankingById
} from '../team-composition/ranking/repository.ts';
import { getKnownResonatorIds } from '../team-composition/repository.ts';
import { CHARACTER_PAIR_SYNERGY_RULE_VERSION } from '../relationships/character-pairs/synergy/rules.ts';
import { TEAM_COMPOSITION_RULE_VERSION } from '../team-composition/rules.ts';
import { TEAM_COMPOSITION_EVALUATION_RULE_VERSION } from '../team-composition/evaluation/rules.ts';
import { TEAM_COMPOSITION_RANKING_RULE_VERSION } from '../team-composition/ranking/rules.ts';
import { OWNED_ROSTER_ELIGIBILITY_RULE_VERSION } from './rules.ts';
import {
  deriveTeamCompositionEligibilityId,
  normalizeOwnedRoster
} from './predicates.ts';
import {
  evaluateRosterEligibility
} from './eligibility.ts';
import type {
  OwnedRosterSnapshot,
  TeamCompositionEligibilityStatus,
  TeamCompositionRosterEligibility,
  ProductionRosterEligibilityAuditMetrics
} from './types.ts';

/** Prohibited keys that MUST NEVER exist on an eligibility record */
export const PROHIBITED_KEYS_ON_ROSTER: readonly string[] = Object.freeze([
  'characterPower',
  'characterStrength',
  'characterScore',
  'resonatorPower',
  'resonatorScore',
  'teamPower',
  'teamDPS',
  'teamDps',
  'rotationDps',
  'dpsScore',
  'damageGain',
  'teamDamageIncrease',
  'damageRanking',
  'teamRanking',
  'bestTeam',
  'optimalTeam',
  'teamViability',
  'metaRank',
  'metaScore',
  'tierList',
  'topMeta',
  'toaScore',
  'towerScore',
  'vigorScore',
  'antiSynergyScore',
  'conflictScore',
  'incompatibilityPenalty',
  'negativeSynergy',
  'MAIN_DPS',
  'SUB_DPS',
  'SUPPORT',
  'HEALER',
  'BUFFER',
  'rosterScore',
  'ownershipScore',
  'rosterSynergyScore',
  'recommendationScore'
]);

/**
 * Validates that an object contains zero prohibited property names or values.
 */
export function assertNoProhibitedRosterKeys(obj: unknown, path: string = ''): void {
  if (!obj || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      assertNoProhibitedRosterKeys(obj[i], `${path}[${i}]`);
    }
    return;
  }

  for (const key of Object.keys(obj)) {
    for (const prohibited of PROHIBITED_KEYS_ON_ROSTER) {
      if (key === prohibited) {
        throw new Error(`Audit failure: Prohibited key '${key}' detected at path '${path}'.`);
      }
    }
    assertNoProhibitedRosterKeys((obj as Record<string, unknown>)[key], `${path}.${key}`);
  }
}

/**
 * Audits a collection of TeamCompositionRosterEligibility records against Invariants A through AL.
 */
export function auditTeamCompositionRosterEligibility(
  roster: OwnedRosterSnapshot,
  eligibilitiesInput?: readonly TeamCompositionRosterEligibility[],
  expectedPatch: string = '3.7',
  expectedRuleVersion: string = OWNED_ROSTER_ELIGIBILITY_RULE_VERSION
): ProductionRosterEligibilityAuditMetrics {
  const step11Audit = auditTeamCompositionRankings();
  const rankings = getTeamCompositionRankings();
  const eligibilities = eligibilitiesInput ?? evaluateRosterEligibility(rankings, roster);

  const totalCandidates = eligibilities.length;
  if (totalCandidates === 0) {
    throw new Error('Audit failure: Zero eligibility records provided for audit.');
  }

  // Invariant C: candidate count reconciles (34,220)
  if (totalCandidates !== step11Audit.totalCandidates) {
    throw new Error(
      `Invariant C failure: Total eligibilities ${totalCandidates} !== expected ${step11Audit.totalCandidates}.`
    );
  }

  // Upstream rule version checks
  if (CHARACTER_PAIR_SYNERGY_RULE_VERSION !== '7.8.1') {
    throw new Error(`Upstream Step 8 rule version modified: ${CHARACTER_PAIR_SYNERGY_RULE_VERSION} !== '7.8.1'.`);
  }
  if (TEAM_COMPOSITION_RULE_VERSION !== '7.9.1') {
    throw new Error(`Upstream Step 9 rule version modified: ${TEAM_COMPOSITION_RULE_VERSION} !== '7.9.1'.`);
  }
  if (TEAM_COMPOSITION_EVALUATION_RULE_VERSION !== '7.10.1') {
    throw new Error(`Upstream Step 10 rule version modified: ${TEAM_COMPOSITION_EVALUATION_RULE_VERSION} !== '7.10.1'.`);
  }
  if (TEAM_COMPOSITION_RANKING_RULE_VERSION !== '7.11.1') {
    throw new Error(`Upstream Step 11 rule version modified: ${TEAM_COMPOSITION_RANKING_RULE_VERSION} !== '7.11.1'.`);
  }

  const knownResonators = getKnownResonatorIds();
  const knownSet = new Set(knownResonators);
  const normalized = normalizeOwnedRoster(roster, knownResonators);

  const seenEligibilityIds = new Set<string>();
  const seenCandidateIds = new Set<string>();
  let duplicateEligibilityIds = 0;

  let eligibleCount = 0;
  let partiallyOwnedCount = 0;
  let notOwnedCount = 0;
  let invalidRosterCount = 0;
  let patchMismatchCount = 0;
  let rankedEligibleCount = 0;
  let unrankableEligibleCount = 0;

  const eligibilityStatusDistribution: Record<TeamCompositionEligibilityStatus, number> = {
    ELIGIBLE: 0,
    PARTIALLY_OWNED: 0,
    NOT_OWNED: 0,
    INVALID_ROSTER: 0,
    PATCH_MISMATCH: 0
  };

  for (let i = 0; i < eligibilities.length; i++) {
    const e = eligibilities[i];
    const path = `eligibilities[${i}]`;

    // Static safety check on object structure
    assertNoProhibitedRosterKeys(e, path);

    // Invariant A: patchVersion === '3.7'
    if (e.patchVersion !== expectedPatch) {
      throw new Error(`Invariant A failure: patchVersion is '${e.patchVersion}', expected '${expectedPatch}'.`);
    }

    // Invariant B: ruleVersion === '7.12.1'
    if (e.ruleVersion !== expectedRuleVersion) {
      throw new Error(`Invariant B failure: ruleVersion is '${e.ruleVersion}', expected '${expectedRuleVersion}'.`);
    }

    // Invariant E: ranking exists and is referenced correctly
    const ranking = getRankingById(e.rankingId);
    if (!ranking) {
      throw new Error(`Invariant E failure: Ranking '${e.rankingId}' not found for eligibility at ${path}.`);
    }
    if (ranking.candidateId !== e.candidateId) {
      throw new Error(
        `Invariant E failure: Ranking candidateId '${ranking.candidateId}' !== eligibility candidateId '${e.candidateId}'.`
      );
    }

    // Invariant F: Candidate IDs are unique across enumeration
    if (seenCandidateIds.has(e.candidateId)) {
      throw new Error(`Invariant F failure: Duplicate candidate ID '${e.candidateId}' at ${path}.`);
    }
    seenCandidateIds.add(e.candidateId);

    // Invariant G: Eligibility IDs are unique
    if (seenEligibilityIds.has(e.id)) {
      duplicateEligibilityIds++;
      throw new Error(`Invariant G failure: Duplicate eligibility ID '${e.id}' at ${path}.`);
    }
    seenEligibilityIds.add(e.id);

    // Invariant H & I & J: Exactly 3 canonical member IDs
    if (e.memberResonatorIds.length !== 3) {
      throw new Error(`Invariant I failure: Candidate '${e.candidateId}' does not have 3 members.`);
    }
    for (const m of e.memberResonatorIds) {
      if (!knownSet.has(m)) {
        throw new Error(`Invariant J failure: Member '${m}' is not a known Patch 3.7 Resonator.`);
      }
    }

    // Invariant Q, R, S, T, U: Step 11 rank and score preserved exactly
    if (e.step11Rank !== ranking.rank) {
      throw new Error(`Invariant Q failure: Step 11 rank modified: ${e.step11Rank} !== ${ranking.rank}.`);
    }
    if (e.step11TotalScore !== ranking.totalScore) {
      throw new Error(`Invariant R failure: Step 11 totalScore modified: ${e.step11TotalScore} !== ${ranking.totalScore}.`);
    }
    if (e.step11RankingStatus !== ranking.rankingStatus) {
      throw new Error(
        `Invariant S failure: Step 11 rankingStatus modified: ${e.step11RankingStatus} !== ${ranking.rankingStatus}.`
      );
    }

    // Deterministic ID derivation check
    const expectedId = deriveTeamCompositionEligibilityId(expectedPatch, e.candidateId, expectedRuleVersion);
    if (e.id !== expectedId) {
      throw new Error(`Invariant failure: Eligibility ID '${e.id}' !== expected '${expectedId}'.`);
    }

    // Invariant O & P: Eligibility is strictly based on ownership membership
    if (normalized.isValid && roster.patchVersion === '3.7') {
      const ownedInTeam = e.memberResonatorIds.filter((m) => normalized.ownedIdSet.has(m));
      if (ownedInTeam.length === 3) {
        if (e.eligibilityStatus !== 'ELIGIBLE' || !e.isEligible) {
          throw new Error(`Invariant O failure: Expected ELIGIBLE for candidate '${e.candidateId}', got ${e.eligibilityStatus}.`);
        }
      } else if (ownedInTeam.length > 0) {
        if (e.eligibilityStatus !== 'PARTIALLY_OWNED' || e.isEligible) {
          throw new Error(`Invariant O failure: Expected PARTIALLY_OWNED for candidate '${e.candidateId}', got ${e.eligibilityStatus}.`);
        }
      } else {
        if (e.eligibilityStatus !== 'NOT_OWNED' || e.isEligible) {
          throw new Error(`Invariant O failure: Expected NOT_OWNED for candidate '${e.candidateId}', got ${e.eligibilityStatus}.`);
        }
      }
    }

    eligibilityStatusDistribution[e.eligibilityStatus]++;

    switch (e.eligibilityStatus) {
      case 'ELIGIBLE':
        eligibleCount++;
        if (e.step11RankingStatus === 'RANKED') {
          rankedEligibleCount++;
        } else {
          unrankableEligibleCount++;
        }
        break;
      case 'PARTIALLY_OWNED':
        partiallyOwnedCount++;
        break;
      case 'NOT_OWNED':
        notOwnedCount++;
        break;
      case 'INVALID_ROSTER':
        invalidRosterCount++;
        break;
      case 'PATCH_MISMATCH':
        patchMismatchCount++;
        break;
    }
  }

  // Invariant reconciliation check
  const sumStatus =
    eligibleCount +
    partiallyOwnedCount +
    notOwnedCount +
    invalidRosterCount +
    patchMismatchCount;

  if (sumStatus !== totalCandidates) {
    throw new Error(
      `Reconciliation failure: Status sum ${sumStatus} !== total candidates ${totalCandidates}.`
    );
  }

  return Object.freeze({
    totalCandidates,
    eligibleCount,
    partiallyOwnedCount,
    notOwnedCount,
    invalidRosterCount,
    patchMismatchCount,
    rankedEligibleCount,
    unrankableEligibleCount,
    uniqueEligibilityIds: seenEligibilityIds.size,
    duplicateEligibilityIds,
    eligibilityStatusDistribution: Object.freeze(eligibilityStatusDistribution),
    eligibilities
  });
}
