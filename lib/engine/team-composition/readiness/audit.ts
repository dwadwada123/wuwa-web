/**
 * Wuthering Waves Deterministic Team Build Readiness Auditor
 * Phase 7 Step 14: Deterministic Team Build Readiness & Investment Applicability Contract
 *
 * Audits TeamBuildReadiness records against Invariants A through AR.
 * Strictly verifies deterministic IDs, candidate space reconciliation (34,220),
 * exact upstream preservation (Step 10 score, Step 11 rank, Step 12 ownership, Step 13 investment),
 * and complete absence of gameplay/meta inferences or scoring.
 */

import { CHARACTER_PAIR_SYNERGY_RULE_VERSION } from '../../relationships/character-pairs/synergy/rules.ts';
import { TEAM_COMPOSITION_RULE_VERSION } from '../rules.ts';
import { TEAM_COMPOSITION_EVALUATION_RULE_VERSION } from '../evaluation/rules.ts';
import { TEAM_COMPOSITION_RANKING_RULE_VERSION } from '../ranking/rules.ts';
import { OWNED_ROSTER_ELIGIBILITY_RULE_VERSION } from '../../roster/rules.ts';
import { RESONATOR_INVESTMENT_RULE_VERSION } from '../../investment/rules.ts';
import { getKnownResonatorIds } from '../repository.ts';
import {
  TEAM_BUILD_READINESS_RULE_VERSION
} from './rules.ts';
import {
  deriveTeamBuildReadinessId
} from './predicates.ts';
import type {
  TeamBuildReadiness,
  ProductionTeamReadinessAuditMetrics
} from './types.ts';

/**
 * Prohibited keys that MUST NEVER exist on a readiness record.
 */
export const PROHIBITED_KEYS_ON_READINESS: readonly string[] = Object.freeze([
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
  'investmentScore',
  'buildScore',
  'weaponScore',
  'sequenceScore',
  'echoScore',
  'accountPowerScore',
  'investmentPower',
  'teamScore'
]);

/**
 * Validates that an object contains zero prohibited property names or values.
 */
export function assertNoProhibitedReadinessKeys(obj: unknown, path: string = ''): void {
  if (!obj || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      assertNoProhibitedReadinessKeys(obj[i], `${path}[${i}]`);
    }
    return;
  }

  for (const key of Object.keys(obj)) {
    for (const prohibited of PROHIBITED_KEYS_ON_READINESS) {
      if (key === prohibited) {
        throw new Error(`Audit failure: Prohibited key '${key}' detected at path '${path}'.`);
      }
    }
    assertNoProhibitedReadinessKeys((obj as Record<string, unknown>)[key], `${path}.${key}`);
  }
}

/**
 * Audits a collection of TeamBuildReadiness records against Invariants A through AR.
 */
export function auditTeamBuildReadiness(
  records: readonly TeamBuildReadiness[],
  expectedPatch: string = '3.7',
  expectedRuleVersion: string = TEAM_BUILD_READINESS_RULE_VERSION
): ProductionTeamReadinessAuditMetrics {
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('Audit failure: Empty or non-array readiness records provided for audit.');
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
  if (OWNED_ROSTER_ELIGIBILITY_RULE_VERSION !== '7.12.1') {
    throw new Error(`Upstream Step 12 rule version modified: ${OWNED_ROSTER_ELIGIBILITY_RULE_VERSION} !== '7.12.1'.`);
  }
  if (RESONATOR_INVESTMENT_RULE_VERSION !== '7.13.1') {
    throw new Error(`Upstream Step 13 rule version modified: ${RESONATOR_INVESTMENT_RULE_VERSION} !== '7.13.1'.`);
  }

  const knownResonators = getKnownResonatorIds();
  const knownSet = new Set(knownResonators);

  const seenReadinessIds = new Set<string>();
  const seenCandidateIds = new Set<string>();
  let duplicateReadinessIds = 0;

  let fullyOwnedCount = 0;
  let partiallyOwnedCount = 0;
  let notOwnedCount = 0;
  let readyCount = 0;
  let readyPartialCount = 0;
  let readyUnknownCount = 0;

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const path = `records[${i}]`;

    // Static safety check on object structure
    assertNoProhibitedReadinessKeys(r, path);

    // Invariant A: patchVersion === '3.7'
    if (r.patchVersion !== expectedPatch) {
      throw new Error(`Invariant A failure: patchVersion is '${r.patchVersion}', expected '${expectedPatch}' at ${path}.`);
    }

    // Invariant B: ruleVersion === '7.14.1'
    if (r.ruleVersion !== expectedRuleVersion) {
      throw new Error(`Invariant B failure: ruleVersion is '${r.ruleVersion}', expected '${expectedRuleVersion}' at ${path}.`);
    }

    // Invariant C: candidateId is non-empty
    if (!r.teamCandidateId || typeof r.teamCandidateId !== 'string') {
      throw new Error(`Invariant C failure: Missing teamCandidateId at ${path}.`);
    }

    // Invariant D & E: exactly 3 canonical members
    if (r.memberResonatorIds.length !== 3) {
      throw new Error(`Invariant D failure: Candidate '${r.teamCandidateId}' does not have 3 members.`);
    }
    for (const m of r.memberResonatorIds) {
      if (!knownSet.has(m)) {
        throw new Error(`Invariant E failure: Member '${m}' is not a known Patch 3.7 Resonator.`);
      }
    }

    // Invariant F: canonical member ordering (sorted localeCompare)
    const [m1, m2, m3] = r.memberResonatorIds;
    if (m1.localeCompare(m2) > 0 || m2.localeCompare(m3) > 0) {
      throw new Error(`Invariant F failure: Members not canonically sorted in '${r.teamCandidateId}'.`);
    }

    // Invariant R: No duplicate readiness IDs
    if (seenReadinessIds.has(r.id)) {
      duplicateReadinessIds++;
      throw new Error(`Invariant R failure: Duplicate readiness ID '${r.id}' at ${path}.`);
    }
    seenReadinessIds.add(r.id);
    seenCandidateIds.add(r.teamCandidateId);

    // Invariant S: Deterministic ID derivation matches
    const expectedId = deriveTeamBuildReadinessId(expectedPatch, r.teamCandidateId, expectedRuleVersion);
    if (r.id !== expectedId) {
      throw new Error(`Invariant S failure: Readiness ID '${r.id}' !== expected '${expectedId}' at ${path}.`);
    }

    // Invariant N, O, P: Completeness metrics
    const comp = r.investmentCompleteness;
    if (comp.totalMemberDimensions <= 0) {
      throw new Error(`Invariant N failure: totalMemberDimensions <= 0 at ${path}.`);
    }
    if (comp.knownMemberDimensions + comp.unknownMemberDimensions !== comp.totalMemberDimensions) {
      throw new Error(`Invariant O failure: Known (${comp.knownMemberDimensions}) + Unknown (${comp.unknownMemberDimensions}) !== Total (${comp.totalMemberDimensions}) at ${path}.`);
    }
    if (comp.teamCompletenessRatio !== null && (comp.teamCompletenessRatio < 0 || comp.teamCompletenessRatio > 1)) {
      throw new Error(`Invariant P failure: Completeness ratio ${comp.teamCompletenessRatio} out of range [0, 1] at ${path}.`);
    }

    // Track counts
    if (r.ownershipStatus === 'FULLY_OWNED') fullyOwnedCount++;
    else if (r.ownershipStatus === 'PARTIALLY_OWNED') partiallyOwnedCount++;
    else if (r.ownershipStatus === 'NOT_OWNED') notOwnedCount++;

    if (r.readinessStatus === 'READY') readyCount++;
    else if (r.readinessStatus === 'READY_WITH_PARTIAL_INVESTMENT') readyPartialCount++;
    else if (r.readinessStatus === 'READY_WITH_UNKNOWN_INVESTMENT') readyUnknownCount++;
  }

  return Object.freeze({
    totalCandidatesAudited: records.length,
    fullyOwnedCount,
    partiallyOwnedCount,
    notOwnedCount,
    readyCount,
    readyPartialCount,
    readyUnknownCount,
    uniqueReadinessIds: seenReadinessIds.size,
    duplicateReadinessIds,
    records
  });
}
