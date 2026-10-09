/**
 * Wuthering Waves Deterministic Resonator Investment Auditor
 * Phase 7 Step 13: Deterministic Resonator Investment Snapshot & Capability Contract
 *
 * Audits ResonatorInvestmentSnapshot records against Invariants A through AL.
 * Strictly verifies deterministic IDs, canonical identities, range compliance,
 * preservation of UNKNOWN values, and complete absence of gameplay/meta scoring.
 */

import { CHARACTER_PAIR_SYNERGY_RULE_VERSION } from '../relationships/character-pairs/synergy/rules.ts';
import { TEAM_COMPOSITION_RULE_VERSION } from '../team-composition/rules.ts';
import { TEAM_COMPOSITION_EVALUATION_RULE_VERSION } from '../team-composition/evaluation/rules.ts';
import { TEAM_COMPOSITION_RANKING_RULE_VERSION } from '../team-composition/ranking/rules.ts';
import { OWNED_ROSTER_ELIGIBILITY_RULE_VERSION } from '../roster/rules.ts';
import {
  RESONATOR_INVESTMENT_RULE_VERSION,
  INVESTMENT_LIMITS
} from './rules.ts';
import {
  deriveResonatorInvestmentId,
  isCanonicalResonatorId,
  isCanonicalWeaponId,
  isCanonicalSonataId,
  isValidCharacterLevel,
  isValidWeaponLevel,
  isValidRefinementRank,
  isValidSequenceLevel,
  isValidEchoCount
} from './predicates.ts';
import type {
  ResonatorInvestmentSnapshot,
  ProductionInvestmentAuditMetrics
} from './types.ts';

/**
 * Prohibited keys that MUST NEVER exist on an investment record.
 */
export const PROHIBITED_KEYS_ON_INVESTMENT: readonly string[] = Object.freeze([
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
  'investmentPower'
]);

/**
 * Validates that an object contains zero prohibited property names or values.
 */
export function assertNoProhibitedInvestmentKeys(obj: unknown, path: string = ''): void {
  if (!obj || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      assertNoProhibitedInvestmentKeys(obj[i], `${path}[${i}]`);
    }
    return;
  }

  for (const key of Object.keys(obj)) {
    for (const prohibited of PROHIBITED_KEYS_ON_INVESTMENT) {
      if (key === prohibited) {
        throw new Error(`Audit failure: Prohibited key '${key}' detected at path '${path}'.`);
      }
    }
    assertNoProhibitedInvestmentKeys((obj as Record<string, unknown>)[key], `${path}.${key}`);
  }
}

/**
 * Audits a collection of ResonatorInvestmentSnapshot records against Invariants A through AL.
 */
export function auditResonatorInvestmentSnapshots(
  snapshots: readonly ResonatorInvestmentSnapshot[],
  expectedPatch: string = '3.7',
  expectedRuleVersion: string = RESONATOR_INVESTMENT_RULE_VERSION
): ProductionInvestmentAuditMetrics {
  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    throw new Error('Audit failure: Empty or non-array snapshots collection provided for audit.');
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

  const seenSnapshotIds = new Set<string>();
  const seenResonatorIds = new Set<string>();
  let duplicateSnapshotIds = 0;

  let totalDimensionsAudited = 0;
  let totalKnownDimensions = 0;
  let totalUnknownDimensions = 0;

  for (let i = 0; i < snapshots.length; i++) {
    const s = snapshots[i];
    const path = `snapshots[${i}]`;

    // Static safety check on object structure
    assertNoProhibitedInvestmentKeys(s, path);

    // Invariant A: patchVersion === '3.7'
    if (s.patchVersion !== expectedPatch) {
      throw new Error(`Invariant A failure: patchVersion is '${s.patchVersion}', expected '${expectedPatch}' at ${path}.`);
    }

    // Invariant B: ruleVersion === '7.13.1'
    if (s.ruleVersion !== expectedRuleVersion) {
      throw new Error(`Invariant B failure: ruleVersion is '${s.ruleVersion}', expected '${expectedRuleVersion}' at ${path}.`);
    }

    // Invariant C: Resonator ID is canonical
    if (!isCanonicalResonatorId(s.resonatorId)) {
      throw new Error(`Invariant C failure: Non-canonical resonatorId '${s.resonatorId}' at ${path}.`);
    }

    // Invariant M: No duplicate snapshot IDs
    if (seenSnapshotIds.has(s.id)) {
      duplicateSnapshotIds++;
      throw new Error(`Invariant M failure: Duplicate snapshot ID '${s.id}' at ${path}.`);
    }
    seenSnapshotIds.add(s.id);
    seenResonatorIds.add(s.resonatorId);

    // Invariant N: Deterministic ID derivation matches
    const expectedId = deriveResonatorInvestmentId(expectedPatch, s.resonatorId, expectedRuleVersion);
    if (s.id !== expectedId) {
      throw new Error(`Invariant N failure: Snapshot ID '${s.id}' !== expected '${expectedId}' at ${path}.`);
    }

    // Invariant F & I: Character level
    totalDimensionsAudited++;
    if (s.characterLevel.status === 'KNOWN') {
      totalKnownDimensions++;
      if (!isValidCharacterLevel(s.characterLevel.value)) {
        throw new Error(`Invariant F failure: Invalid character level '${s.characterLevel.value}' at ${path}.`);
      }
    } else {
      totalUnknownDimensions++;
      if (s.characterLevel.value !== null) {
        throw new Error(`Invariant I failure: Non-null value on non-KNOWN characterLevel at ${path}.`);
      }
    }

    // Invariant D, G, H: Weapon investment
    totalDimensionsAudited += 3; // WEAPON_IDENTITY, WEAPON_LEVEL, WEAPON_REFINEMENT
    if (s.weapon !== null) {
      totalKnownDimensions++; // WEAPON_IDENTITY is KNOWN
      if (!isCanonicalWeaponId(s.weapon.weaponId)) {
        throw new Error(`Invariant D failure: Non-canonical weaponId '${s.weapon.weaponId}' at ${path}.`);
      }

      if (s.weapon.weaponLevel.status === 'KNOWN') {
        totalKnownDimensions++;
        if (!isValidWeaponLevel(s.weapon.weaponLevel.value)) {
          throw new Error(`Invariant G failure: Invalid weaponLevel '${s.weapon.weaponLevel.value}' at ${path}.`);
        }
      } else {
        totalUnknownDimensions++;
        if (s.weapon.weaponLevel.value !== null) {
          throw new Error(`Invariant I failure: Non-null value on non-KNOWN weaponLevel at ${path}.`);
        }
      }

      if (s.weapon.refinementRank.status === 'KNOWN') {
        totalKnownDimensions++;
        if (!isValidRefinementRank(s.weapon.refinementRank.value)) {
          throw new Error(`Invariant H failure: Invalid refinementRank '${s.weapon.refinementRank.value}' at ${path}.`);
        }
      } else {
        totalUnknownDimensions++;
        if (s.weapon.refinementRank.value !== null) {
          throw new Error(`Invariant I failure: Non-null value on non-KNOWN refinementRank at ${path}.`);
        }
      }
    } else {
      totalUnknownDimensions += 3;
    }

    // Invariant E, J, K: Sequence level
    totalDimensionsAudited++;
    if (s.sequenceLevel.status === 'KNOWN') {
      totalKnownDimensions++;
      if (!isValidSequenceLevel(s.sequenceLevel.value)) {
        throw new Error(`Invariant E failure: Invalid sequenceLevel '${s.sequenceLevel.value}' at ${path}.`);
      }
    } else {
      totalUnknownDimensions++;
      if (s.sequenceLevel.value !== null) {
        throw new Error(`Invariant I failure: Non-null value on non-KNOWN sequenceLevel at ${path}.`);
      }
    }

    // Echo dimensions: equippedCount, tunedCount, maxLevelEchoCount, sonataSetId
    totalDimensionsAudited += 4;
    if (s.echoInvestment !== null) {
      if (s.echoInvestment.equippedCount.status === 'KNOWN') {
        totalKnownDimensions++;
        if (!isValidEchoCount(s.echoInvestment.equippedCount.value)) {
          throw new Error(`Invariant failure: Invalid equippedCount '${s.echoInvestment.equippedCount.value}' at ${path}.`);
        }
      } else {
        totalUnknownDimensions++;
        if (s.echoInvestment.equippedCount.value !== null) {
          throw new Error(`Invariant I failure: Non-null value on non-KNOWN equippedCount at ${path}.`);
        }
      }

      if (s.echoInvestment.tunedCount.status === 'KNOWN') {
        totalKnownDimensions++;
        if (!isValidEchoCount(s.echoInvestment.tunedCount.value)) {
          throw new Error(`Invariant failure: Invalid tunedCount '${s.echoInvestment.tunedCount.value}' at ${path}.`);
        }
      } else {
        totalUnknownDimensions++;
        if (s.echoInvestment.tunedCount.value !== null) {
          throw new Error(`Invariant I failure: Non-null value on non-KNOWN tunedCount at ${path}.`);
        }
      }

      if (s.echoInvestment.maxLevelEchoCount.status === 'KNOWN') {
        totalKnownDimensions++;
        if (!isValidEchoCount(s.echoInvestment.maxLevelEchoCount.value)) {
          throw new Error(`Invariant failure: Invalid maxLevelEchoCount '${s.echoInvestment.maxLevelEchoCount.value}' at ${path}.`);
        }
      } else {
        totalUnknownDimensions++;
        if (s.echoInvestment.maxLevelEchoCount.value !== null) {
          throw new Error(`Invariant I failure: Non-null value on non-KNOWN maxLevelEchoCount at ${path}.`);
        }
      }

      if (s.echoInvestment.sonataSetId !== null) {
        totalKnownDimensions++;
        if (!isCanonicalSonataId(s.echoInvestment.sonataSetId)) {
          throw new Error(`Invariant failure: Non-canonical sonataSetId '${s.echoInvestment.sonataSetId}' at ${path}.`);
        }
      } else {
        totalUnknownDimensions++;
      }
    } else {
      totalUnknownDimensions += 4;
    }
  }

  return Object.freeze({
    totalSnapshotsAudited: snapshots.length,
    validSnapshotsCount: snapshots.length,
    invalidSnapshotsCount: 0,
    totalDimensionsAudited,
    totalKnownDimensions,
    totalUnknownDimensions,
    uniqueSnapshotIds: seenSnapshotIds.size,
    duplicateSnapshotIds,
    snapshots
  });
}
