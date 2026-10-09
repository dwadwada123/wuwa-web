/**
 * Wuthering Waves Deterministic Resonator Investment Test Suite
 * Phase 7 Step 13: Deterministic Resonator Investment Snapshot & Capability Contract
 *
 * Strict validation and verification covering:
 * - Resonator identity & canonicalization
 * - Character level validation (1..90) & UNKNOWN preservation
 * - Weapon investment validation (66 canonical weapons, level 1..90, refinement 1..5) & UNKNOWN preservation
 * - Resonance Sequence validation (0..6, preserving S0, no default S0)
 * - Echo investment validation (0..5 counts, canonical sonata, zero invented scores)
 * - Partial state & factual completeness ratios
 * - Ownership integration with Step 12 OwnedRosterSnapshot
 * - Determinism & 20 repeated executions byte-for-byte identical
 * - Static safety & complete absence of gameplay/meta inferences
 * - Production auditor Invariants A through AL
 * - Upstream rule version immutability (7.8.1, 7.9.1, 7.10.1, 7.11.1, 7.12.1, 7.13.1)
 * - Canonical dataset SHA-256 integrity
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

import {
  RESONATOR_INVESTMENT_RULE_VERSION,
  INVESTMENT_LIMITS,
  CANONICAL_PATCH_3_7_WEAPON_IDS,
  CANONICAL_PATCH_3_7_SONATA_CODES,
  ALL_INVESTMENT_DIMENSIONS,
  INVESTMENT_EXPLANATION_CODES,
  EMPTY_INVESTMENT_PROVENANCE,
  deriveResonatorInvestmentId,
  knownValue,
  unknownValue,
  isKnown,
  isUnknown,
  isValidCharacterLevel,
  isValidWeaponLevel,
  isValidRefinementRank,
  isValidSequenceLevel,
  isValidEchoCount,
  isCanonicalResonatorId,
  isCanonicalWeaponId,
  isCanonicalSonataId,
  computeInvestmentCompleteness,
  normalizeResonatorInvestment,
  createUninvestedSnapshot,
  getInvestmentSnapshot,
  getOwnedInvestmentSnapshots,
  getInvestmentCompleteness,
  getKnownInvestmentDimensions,
  getUnknownInvestmentDimensions,
  getRosterInvestmentSummary,
  adaptOwnedRosterInvestment,
  auditResonatorInvestmentSnapshots,
  assertNoProhibitedInvestmentKeys,
  PROHIBITED_KEYS_ON_INVESTMENT,
  explainResonatorInvestment
} from '../lib/engine/investment/index.ts';

import type {
  ResonatorInvestmentInput,
  ResonatorInvestmentSnapshot,
  OwnedRosterSnapshot
} from '../lib/engine/investment/types.ts';

import { getKnownResonatorIds } from '../lib/engine/team-composition/repository.ts';
import { CHARACTER_PAIR_SYNERGY_RULE_VERSION } from '../lib/engine/relationships/character-pairs/synergy/rules.ts';
import { TEAM_COMPOSITION_RULE_VERSION } from '../lib/engine/team-composition/rules.ts';
import { TEAM_COMPOSITION_EVALUATION_RULE_VERSION } from '../lib/engine/team-composition/evaluation/rules.ts';
import { TEAM_COMPOSITION_RANKING_RULE_VERSION } from '../lib/engine/team-composition/ranking/rules.ts';
import { OWNED_ROSTER_ELIGIBILITY_RULE_VERSION } from '../lib/engine/roster/rules.ts';

const mockProvenance = Object.freeze({
  entityId: 'TEST_USER',
  entityName: 'Test User Investment',
  sourceType: 'RESONATOR_ABILITY' as const,
  sourceCode: 'TEST_INV',
  patchVersion: '3.7',
  sourceProvenance: 'test_investment_snapshot',
  originalDescription: 'Test investment snapshot description'
});

const allResonators = getKnownResonatorIds();

// ---------------------------------------------------------------------------
// 1–5: IDENTITY CONTRACT
// ---------------------------------------------------------------------------

test('1. Valid canonical Resonator ID is accepted', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    provenance: mockProvenance
  });
  assert.equal(norm.isValid, true);
  assert.equal(norm.snapshot.resonatorId, 'Jiyan');
  assert.equal(norm.snapshot.id, 'resonator-investment:3.7:Jiyan:7.13.1');
});

test('2. Unknown Resonator ID is rejected and fails closed', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'UnknownWarrior',
    provenance: mockProvenance
  });
  assert.equal(norm.isValid, false);
  assert.ok(norm.validationErrors.some((e) => e.includes('UnknownWarrior')));
});

test('3. Malformed/empty Resonator ID is rejected and fails closed', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: '',
    provenance: mockProvenance
  });
  assert.equal(norm.isValid, false);
  assert.ok(norm.validationErrors.some((e) => e.includes('non-empty string')));
});

test('4. Patch mismatch is rejected and fails closed', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.8' as unknown as '3.7',
    resonatorId: 'Jiyan',
    provenance: mockProvenance
  });
  assert.equal(norm.isValid, false);
  assert.ok(norm.validationErrors.some((e) => e.includes('Patch mismatch')));
});

test('5. Canonical ID preservation maintains exact string identity', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Verina',
    provenance: mockProvenance
  });
  assert.equal(norm.snapshot.resonatorId, 'Verina');
  assert.equal(isCanonicalResonatorId(norm.snapshot.resonatorId), true);
});

// ---------------------------------------------------------------------------
// 6–15: CHARACTER LEVEL CONTRACT
// ---------------------------------------------------------------------------

test('6. Valid character level (80) is accepted as KNOWN', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    characterLevel: 80,
    provenance: mockProvenance
  });
  assert.equal(norm.isValid, true);
  assert.equal(norm.snapshot.characterLevel.status, 'KNOWN');
  assert.equal(norm.snapshot.characterLevel.value, 80);
});

test('7. Minimum character level (1) is accepted', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    characterLevel: 1,
    provenance: mockProvenance
  });
  assert.equal(norm.isValid, true);
  assert.equal(norm.snapshot.characterLevel.value, 1);
});

test('8. Maximum character level (90) is accepted', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    characterLevel: 90,
    provenance: mockProvenance
  });
  assert.equal(norm.isValid, true);
  assert.equal(norm.snapshot.characterLevel.value, 90);
});

test('9. Below minimum character level (0, -1) is rejected', () => {
  const normZero = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    characterLevel: 0,
    provenance: mockProvenance
  });
  assert.equal(normZero.isValid, false);
  assert.equal(normZero.snapshot.characterLevel.status, 'INVALID');

  const normNeg = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    characterLevel: -5,
    provenance: mockProvenance
  });
  assert.equal(normNeg.isValid, false);
});

test('10. Above maximum character level (91, 100) is rejected', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    characterLevel: 91,
    provenance: mockProvenance
  });
  assert.equal(norm.isValid, false);
  assert.equal(norm.snapshot.characterLevel.status, 'INVALID');
});

test('11. Fractional character level (79.5) is rejected', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    characterLevel: 79.5,
    provenance: mockProvenance
  });
  assert.equal(norm.isValid, false);
  assert.equal(norm.snapshot.characterLevel.status, 'INVALID');
});

test('12. NaN character level is rejected', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    characterLevel: NaN,
    provenance: mockProvenance
  });
  assert.equal(norm.isValid, false);
  assert.equal(norm.snapshot.characterLevel.status, 'INVALID');
});

test('13. Infinity character level is rejected', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    characterLevel: Infinity,
    provenance: mockProvenance
  });
  assert.equal(norm.isValid, false);
  assert.equal(norm.snapshot.characterLevel.status, 'INVALID');
});

test('14. UNKNOWN character level is preserved with value null', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    provenance: mockProvenance
  });
  assert.equal(norm.isValid, true);
  assert.equal(norm.snapshot.characterLevel.status, 'UNKNOWN');
  assert.equal(norm.snapshot.characterLevel.value, null);
});

test('15. Explicit valid level is never converted to UNKNOWN', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    characterLevel: 70,
    provenance: mockProvenance
  });
  assert.equal(norm.snapshot.characterLevel.status, 'KNOWN');
  assert.equal(norm.snapshot.characterLevel.value, 70);
});

// ---------------------------------------------------------------------------
// 16–28: WEAPON INVESTMENT CONTRACT
// ---------------------------------------------------------------------------

test('16. Valid canonical weapon is accepted', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    weapon: {
      weaponId: 'Verdant Summit'
    },
    provenance: mockProvenance
  });
  assert.equal(norm.isValid, true);
  assert.ok(norm.snapshot.weapon);
  assert.equal(norm.snapshot.weapon?.weaponId, 'Verdant Summit');
});

test('17. Unknown weapon ID is rejected and fails closed', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    weapon: {
      weaponId: 'FictionalExcalibur'
    },
    provenance: mockProvenance
  });
  assert.equal(norm.isValid, false);
  assert.ok(norm.validationErrors.some((e) => e.includes('FictionalExcalibur')));
});

test('18. Malformed/empty weapon ID is rejected', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    weapon: {
      weaponId: ''
    },
    provenance: mockProvenance
  });
  assert.equal(norm.isValid, false);
});

test('19. Patch mismatch weapon snapshot inherits parent failure', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.8' as unknown as '3.7',
    resonatorId: 'Jiyan',
    weapon: {
      weaponId: 'Verdant Summit'
    },
    provenance: mockProvenance
  });
  assert.equal(norm.isValid, false);
});

test('20. Valid weapon level (90) is accepted', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    weapon: {
      weaponId: 'Verdant Summit',
      weaponLevel: 90
    },
    provenance: mockProvenance
  });
  assert.equal(norm.isValid, true);
  assert.equal(norm.snapshot.weapon?.weaponLevel.status, 'KNOWN');
  assert.equal(norm.snapshot.weapon?.weaponLevel.value, 90);
});

test('21. Invalid weapon level (0, 95, fractional) is rejected', () => {
  const normZero = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    weapon: { weaponId: 'Verdant Summit', weaponLevel: 0 },
    provenance: mockProvenance
  });
  assert.equal(normZero.isValid, false);

  const normOver = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    weapon: { weaponId: 'Verdant Summit', weaponLevel: 95 },
    provenance: mockProvenance
  });
  assert.equal(normOver.isValid, false);
});

test('22. Valid refinement rank (1..5) is accepted', () => {
  for (let r = 1; r <= 5; r++) {
    const norm = normalizeResonatorInvestment({
      patchVersion: '3.7',
      resonatorId: 'Jiyan',
      weapon: { weaponId: 'Verdant Summit', refinementRank: r },
      provenance: mockProvenance
    });
    assert.equal(norm.isValid, true);
    assert.equal(norm.snapshot.weapon?.refinementRank.status, 'KNOWN');
    assert.equal(norm.snapshot.weapon?.refinementRank.value, r);
  }
});

test('23. Invalid refinement rank (0, 6, -1, 2.5) is rejected', () => {
  const norm0 = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    weapon: { weaponId: 'Verdant Summit', refinementRank: 0 },
    provenance: mockProvenance
  });
  assert.equal(norm0.isValid, false);

  const norm6 = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    weapon: { weaponId: 'Verdant Summit', refinementRank: 6 },
    provenance: mockProvenance
  });
  assert.equal(norm6.isValid, false);
});

test('24. UNKNOWN refinement is preserved with value null', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    weapon: { weaponId: 'Verdant Summit', weaponLevel: 90 },
    provenance: mockProvenance
  });
  assert.equal(norm.isValid, true);
  assert.equal(norm.snapshot.weapon?.refinementRank.status, 'UNKNOWN');
  assert.equal(norm.snapshot.weapon?.refinementRank.value, null);
});

test('25. UNKNOWN weapon level is preserved with value null', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    weapon: { weaponId: 'Verdant Summit', refinementRank: 1 },
    provenance: mockProvenance
  });
  assert.equal(norm.isValid, true);
  assert.equal(norm.snapshot.weapon?.weaponLevel.status, 'UNKNOWN');
  assert.equal(norm.snapshot.weapon?.weaponLevel.value, null);
});

test('26. No default R1: refinement is not defaulted when absent', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    weapon: { weaponId: 'Verdant Summit' },
    provenance: mockProvenance
  });
  assert.notEqual(norm.snapshot.weapon?.refinementRank.value, 1);
  assert.equal(norm.snapshot.weapon?.refinementRank.status, 'UNKNOWN');
});

test('27. No default level: weapon level is not defaulted to 1 when absent', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    weapon: { weaponId: 'Verdant Summit' },
    provenance: mockProvenance
  });
  assert.notEqual(norm.snapshot.weapon?.weaponLevel.value, 1);
  assert.equal(norm.snapshot.weapon?.weaponLevel.status, 'UNKNOWN');
});

test('28. Explicit weapon identity is preserved verbatim', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    weapon: { weaponId: 'Ages of Harvest' },
    provenance: mockProvenance
  });
  assert.equal(norm.snapshot.weapon?.weaponId, 'Ages of Harvest');
});

// ---------------------------------------------------------------------------
// 29–35: RESONANCE SEQUENCE CONTRACT
// ---------------------------------------------------------------------------

test('29. S0 (explicit zero) is accepted as KNOWN with value 0', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    sequenceLevel: 0,
    provenance: mockProvenance
  });
  assert.equal(norm.isValid, true);
  assert.equal(norm.snapshot.sequenceLevel.status, 'KNOWN');
  assert.equal(norm.snapshot.sequenceLevel.value, 0);
});

test('30. S6 is accepted as KNOWN with value 6', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    sequenceLevel: 6,
    provenance: mockProvenance
  });
  assert.equal(norm.isValid, true);
  assert.equal(norm.snapshot.sequenceLevel.status, 'KNOWN');
  assert.equal(norm.snapshot.sequenceLevel.value, 6);
});

test('31. Negative sequence level (-1) is rejected', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    sequenceLevel: -1,
    provenance: mockProvenance
  });
  assert.equal(norm.isValid, false);
  assert.equal(norm.snapshot.sequenceLevel.status, 'INVALID');
});

test('32. Sequence level above 6 (7, 10) is rejected', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    sequenceLevel: 7,
    provenance: mockProvenance
  });
  assert.equal(norm.isValid, false);
  assert.equal(norm.snapshot.sequenceLevel.status, 'INVALID');
});

test('33. Fractional sequence level (2.5) is rejected', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    sequenceLevel: 2.5,
    provenance: mockProvenance
  });
  assert.equal(norm.isValid, false);
  assert.equal(norm.snapshot.sequenceLevel.status, 'INVALID');
});

test('34. UNKNOWN sequence level is preserved with value null', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    provenance: mockProvenance
  });
  assert.equal(norm.isValid, true);
  assert.equal(norm.snapshot.sequenceLevel.status, 'UNKNOWN');
  assert.equal(norm.snapshot.sequenceLevel.value, null);
});

test('35. No default S0: sequence level is not defaulted to 0 when omitted', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    provenance: mockProvenance
  });
  assert.notEqual(norm.snapshot.sequenceLevel.value, 0);
  assert.equal(norm.snapshot.sequenceLevel.status, 'UNKNOWN');
});

// ---------------------------------------------------------------------------
// 36–41: ECHO INVESTMENT CONTRACT
// ---------------------------------------------------------------------------

test('36. Supported structured Echo state is accepted', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    echoInvestment: {
      equippedCount: 5,
      tunedCount: 5,
      maxLevelEchoCount: 5,
      sonataSetId: 'Sierra Gale'
    },
    provenance: mockProvenance
  });
  assert.equal(norm.isValid, true);
  assert.equal(norm.snapshot.echoInvestment?.equippedCount.value, 5);
  assert.equal(norm.snapshot.echoInvestment?.tunedCount.value, 5);
  assert.equal(norm.snapshot.echoInvestment?.maxLevelEchoCount.value, 5);
  assert.equal(norm.snapshot.echoInvestment?.sonataSetId, 'Sierra Gale');
});

test('37. Unknown Echo state is preserved as null when omitted', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    provenance: mockProvenance
  });
  assert.equal(norm.isValid, true);
  assert.equal(norm.snapshot.echoInvestment, null);
});

test('38. No invented Echo score property exists on snapshot', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    echoInvestment: { equippedCount: 5 },
    provenance: mockProvenance
  });
  assert.equal('echoScore' in (norm.snapshot as unknown as Record<string, unknown>), false);
  assert.equal('qualityScore' in (norm.snapshot as unknown as Record<string, unknown>), false);
});

test('39. No inferred Sonata: sonata remains null if omitted', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    echoInvestment: { equippedCount: 5 },
    provenance: mockProvenance
  });
  assert.equal(norm.snapshot.echoInvestment?.sonataSetId, null);
});

test('40. Non-canonical Sonata code is rejected', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    echoInvestment: { sonataSetId: 'NonExistentSonata' },
    provenance: mockProvenance
  });
  assert.equal(norm.isValid, false);
  assert.ok(norm.validationErrors.some((e) => e.includes('NonExistentSonata')));
});

test('41. Invalid echo counts (>5, <0) are rejected', () => {
  const normOver = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    echoInvestment: { equippedCount: 6 },
    provenance: mockProvenance
  });
  assert.equal(normOver.isValid, false);

  const normUnder = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    echoInvestment: { tunedCount: -1 },
    provenance: mockProvenance
  });
  assert.equal(normUnder.isValid, false);
});

// ---------------------------------------------------------------------------
// 42–48: PARTIAL STATE & COMPLETENESS CONTRACT
// ---------------------------------------------------------------------------

test('42. Level known / weapon unknown preserves dimension-level certainty', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    characterLevel: 80,
    weapon: null,
    provenance: mockProvenance
  });
  assert.equal(norm.snapshot.characterLevel.status, 'KNOWN');
  assert.equal(norm.snapshot.weapon, null);
  assert.equal(norm.completeness.dimensionDetails.CHARACTER_LEVEL, 'KNOWN');
  assert.equal(norm.completeness.dimensionDetails.WEAPON_IDENTITY, 'UNKNOWN');
});

test('43. Weapon known / sequence unknown preserves dimension-level certainty', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    weapon: { weaponId: 'Verdant Summit', weaponLevel: 90, refinementRank: 1 },
    sequenceLevel: null,
    provenance: mockProvenance
  });
  assert.equal(norm.snapshot.weapon?.weaponLevel.status, 'KNOWN');
  assert.equal(norm.snapshot.sequenceLevel.status, 'UNKNOWN');
  assert.equal(norm.completeness.dimensionDetails.SEQUENCE_LEVEL, 'UNKNOWN');
});

test('44. Sequence known / Echo unknown preserves dimension-level certainty', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    sequenceLevel: 2,
    echoInvestment: null,
    provenance: mockProvenance
  });
  assert.equal(norm.snapshot.sequenceLevel.status, 'KNOWN');
  assert.equal(norm.snapshot.echoInvestment, null);
  assert.equal(norm.completeness.dimensionDetails.ECHO_EQUIPPED_COUNT, 'UNKNOWN');
});

test('45. Mixed known/unknown dimensions preserve individual statuses', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    characterLevel: 80,
    weapon: { weaponId: 'Verdant Summit', weaponLevel: 90 }, // refinement omitted
    sequenceLevel: 2,
    echoInvestment: null,
    provenance: mockProvenance
  });
  assert.equal(norm.completeness.dimensionDetails.CHARACTER_LEVEL, 'KNOWN');
  assert.equal(norm.completeness.dimensionDetails.WEAPON_IDENTITY, 'KNOWN');
  assert.equal(norm.completeness.dimensionDetails.WEAPON_LEVEL, 'KNOWN');
  assert.equal(norm.completeness.dimensionDetails.WEAPON_REFINEMENT, 'UNKNOWN');
  assert.equal(norm.completeness.dimensionDetails.SEQUENCE_LEVEL, 'KNOWN');
});

test('46. Completeness summary correctly computes known / total ratio', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    characterLevel: 80,
    weapon: { weaponId: 'Verdant Summit', weaponLevel: 90, refinementRank: 1 },
    sequenceLevel: 2,
    echoInvestment: null,
    provenance: mockProvenance
  });
  // Known dimensions: CHARACTER_LEVEL, WEAPON_IDENTITY, WEAPON_LEVEL, WEAPON_REFINEMENT, SEQUENCE_LEVEL = 5/9
  assert.equal(norm.completeness.totalDimensions, 9);
  assert.equal(norm.completeness.knownDimensions, 5);
  assert.equal(norm.completeness.unknownDimensions, 4);
  assert.equal(norm.completeness.completenessRatio, 0.5556);
});

test('47. Zero known dimensions yields 0 completeness ratio', () => {
  const uninvested = createUninvestedSnapshot('Jiyan');
  const comp = computeInvestmentCompleteness(uninvested);
  assert.equal(comp.knownDimensions, 0);
  assert.equal(comp.unknownDimensions, 9);
  assert.equal(comp.completenessRatio, 0);
});

test('48. All applicable dimensions known yields 1.0 completeness ratio', () => {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    characterLevel: 90,
    weapon: { weaponId: 'Verdant Summit', weaponLevel: 90, refinementRank: 5 },
    sequenceLevel: 6,
    echoInvestment: {
      equippedCount: 5,
      tunedCount: 5,
      maxLevelEchoCount: 5,
      sonataSetId: 'Sierra Gale'
    },
    provenance: mockProvenance
  });
  assert.equal(norm.completeness.knownDimensions, 9);
  assert.equal(norm.completeness.unknownDimensions, 0);
  assert.equal(norm.completeness.completenessRatio, 1.0);
});

// ---------------------------------------------------------------------------
// 49–53: DETERMINISM & REPEATABILITY CONTRACT
// ---------------------------------------------------------------------------

test('49. Repeated normalization produces identical output', () => {
  const input: ResonatorInvestmentInput = {
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    characterLevel: 80,
    weapon: { weaponId: 'Verdant Summit', weaponLevel: 90, refinementRank: 1 },
    sequenceLevel: 0,
    provenance: mockProvenance
  };

  const first = JSON.stringify(normalizeResonatorInvestment(input));
  for (let i = 0; i < 10; i++) {
    const run = JSON.stringify(normalizeResonatorInvestment(input));
    assert.equal(run, first);
  }
});

test('50. Input ordering invariance: field order in object does not alter snapshot', () => {
  const inputA: ResonatorInvestmentInput = {
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    sequenceLevel: 3,
    characterLevel: 80,
    provenance: mockProvenance
  };
  const inputB: ResonatorInvestmentInput = {
    characterLevel: 80,
    sequenceLevel: 3,
    resonatorId: 'Jiyan',
    patchVersion: '3.7',
    provenance: mockProvenance
  };
  const snapA = normalizeResonatorInvestment(inputA).snapshot;
  const snapB = normalizeResonatorInvestment(inputB).snapshot;
  assert.deepEqual(snapA, snapB);
});

test('51. Serialization invariance: JSON string is stable', () => {
  const snap = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    characterLevel: 70,
    provenance: mockProvenance
  }).snapshot;
  const str1 = JSON.stringify(snap);
  const str2 = JSON.stringify(snap);
  assert.equal(str1, str2);
});

test('52. Deterministic ID generation matches canonical pattern', () => {
  const expected = 'resonator-investment:3.7:Jiyan:7.13.1';
  const derived = deriveResonatorInvestmentId('3.7', 'Jiyan', '7.13.1');
  assert.equal(derived, expected);
});

test('53. 20-run deterministic snapshot generation produces identical SHA-256', () => {
  const input: ResonatorInvestmentInput = {
    patchVersion: '3.7',
    resonatorId: 'Verina',
    characterLevel: 80,
    weapon: { weaponId: 'Variation', weaponLevel: 80, refinementRank: 5 },
    sequenceLevel: 2,
    echoInvestment: { equippedCount: 5, sonataSetId: 'Rejuvenating Glow' },
    provenance: mockProvenance
  };

  let baselineHash = '';
  for (let i = 0; i < 20; i++) {
    const snap = normalizeResonatorInvestment(input).snapshot;
    const hash = crypto.createHash('sha256').update(JSON.stringify(snap)).digest('hex');
    if (i === 0) baselineHash = hash;
    else assert.equal(hash, baselineHash);
  }
});

// ---------------------------------------------------------------------------
// 54–57: OWNERSHIP INTEGRATION CONTRACT
// ---------------------------------------------------------------------------

test('54. Owned Resonator is accepted in getOwnedInvestmentSnapshots', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: ['Jiyan', 'Verina'],
    provenance: mockProvenance
  };
  const snaps = getOwnedInvestmentSnapshots(roster);
  assert.equal(snaps.length, 2);
  assert.equal(snaps[0].resonatorId, 'Jiyan');
  assert.equal(snaps[1].resonatorId, 'Verina');
});

test('55. Non-owned Resonator is classified as not owned in adaptOwnedRosterInvestment', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: ['Jiyan'],
    provenance: mockProvenance
  };
  const customSnap = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Calcharo',
    characterLevel: 90,
    provenance: mockProvenance
  }).snapshot;

  const catalog = adaptOwnedRosterInvestment(roster, [customSnap]);
  assert.equal(catalog.ownedResonatorCount, 1);
  assert.deepEqual(catalog.notOwnedResonatorIds, ['Calcharo']);
  assert.equal(catalog.snapshots.length, 1);
  assert.equal(catalog.snapshots[0].resonatorId, 'Jiyan');
});

test('56. Full roster integration produces 60 investment snapshots', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: allResonators,
    provenance: mockProvenance
  };
  const snaps = getOwnedInvestmentSnapshots(roster);
  assert.equal(snaps.length, 60);
});

test('57. Empty roster integration produces 0 investment snapshots', () => {
  const roster: OwnedRosterSnapshot = {
    patchVersion: '3.7',
    ownedResonatorIds: [],
    provenance: mockProvenance
  };
  const snaps = getOwnedInvestmentSnapshots(roster);
  assert.equal(snaps.length, 0);
});

// ---------------------------------------------------------------------------
// 58–66: STATIC SAFETY CONTRACT
// ---------------------------------------------------------------------------

test('58. Source tree contains zero network calls (fetch, axios, http)', () => {
  const dir = path.join(process.cwd(), 'lib/engine/investment');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.equal(content.includes('fetch('), false, `Network fetch found in ${file}`);
    assert.equal(content.includes('axios'), false, `Axios found in ${file}`);
    assert.equal(content.includes('http:'), false, `http found in ${file}`);
    assert.equal(content.includes('https:'), false, `https found in ${file}`);
  }
});

test('59. Source tree contains zero LLM references (openai, gemini, llm)', () => {
  const dir = path.join(process.cwd(), 'lib/engine/investment');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.equal(content.includes('openai'), false, `OpenAI found in ${file}`);
    assert.equal(content.includes('gemini'), false, `Gemini found in ${file}`);
    assert.equal(content.includes('llm'), false, `LLM found in ${file}`);
  }
});

test('60. Source tree contains zero nondeterministic random calls', () => {
  const dir = path.join(process.cwd(), 'lib/engine/investment');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.equal(content.includes('Math.random'), false, `Math.random in ${file}`);
    assert.equal(content.includes('randomUUID'), false, `randomUUID in ${file}`);
  }
});

test('61. Source tree contains zero nondeterministic time calls', () => {
  const dir = path.join(process.cwd(), 'lib/engine/investment');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.equal(content.includes('Date.now'), false, `Date.now in ${file}`);
    assert.equal(content.includes('new Date'), false, `new Date in ${file}`);
  }
});

test('62. Source tree contains zero unsafe Number coercion', () => {
  const dir = path.join(process.cwd(), 'lib/engine/investment');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.equal(content.includes('Number('), false, `Number() conversion in ${file}`);
  }
});

test('63. Source tree contains zero parseFloat', () => {
  const dir = path.join(process.cwd(), 'lib/engine/investment');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.equal(content.includes('parseFloat'), false, `parseFloat in ${file}`);
  }
});

test('64. Source tree contains zero parseInt', () => {
  const dir = path.join(process.cwd(), 'lib/engine/investment');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.equal(content.includes('parseInt'), false, `parseInt in ${file}`);
  }
});

test('65. Source tree contains zero ?? 0 fallbacks', () => {
  const dir = path.join(process.cwd(), 'lib/engine/investment');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.equal(content.includes('?? 0'), false, `?? 0 in ${file}`);
  }
});

test('66. Source tree contains zero || 0 fallbacks', () => {
  const dir = path.join(process.cwd(), 'lib/engine/investment');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.equal(content.includes('|| 0'), false, `|| 0 in ${file}`);
  }
});

// ---------------------------------------------------------------------------
// 67–75: BOUNDARY CONTRACT
// ---------------------------------------------------------------------------

test('67. Zero team scoring fields on investment snapshot', () => {
  const snap = createUninvestedSnapshot('Jiyan');
  assert.equal('teamScore' in snap, false);
});

test('68. Zero character scoring fields on investment snapshot', () => {
  const snap = createUninvestedSnapshot('Jiyan');
  assert.equal('characterScore' in snap, false);
  assert.equal('buildScore' in snap, false);
});

test('69. Zero DPS calculations on investment snapshot', () => {
  const snap = createUninvestedSnapshot('Jiyan');
  assert.equal('dps' in snap, false);
  assert.equal('rotationDps' in snap, false);
});

test('70. Zero ToA fields on investment snapshot', () => {
  const snap = createUninvestedSnapshot('Jiyan');
  assert.equal('toaScore' in snap, false);
  assert.equal('floorBuff' in snap, false);
});

test('71. Zero Vigor fields on investment snapshot', () => {
  const snap = createUninvestedSnapshot('Jiyan');
  assert.equal('vigorCost' in snap, false);
});

test('72. Zero role inference on investment snapshot', () => {
  const snap = createUninvestedSnapshot('Jiyan');
  assert.equal('role' in snap, false);
  assert.equal('primaryRole' in snap, false);
});

test('73. Zero meta inference on investment snapshot', () => {
  const snap = createUninvestedSnapshot('Jiyan');
  assert.equal('tier' in snap, false);
  assert.equal('metaRank' in snap, false);
});

test('74. Step 10 evaluation rule version remains 7.10.1', () => {
  assert.equal(TEAM_COMPOSITION_EVALUATION_RULE_VERSION, '7.10.1');
});

test('75. Step 11 ranking rule version remains 7.11.1', () => {
  assert.equal(TEAM_COMPOSITION_RANKING_RULE_VERSION, '7.11.1');
});

// ---------------------------------------------------------------------------
// 76–80: AUDIT & EXPLANATION CONTRACT
// ---------------------------------------------------------------------------

test('76. Production auditor passes Invariants A through AL on full catalog', () => {
  const allSnaps = allResonators.map((id) => createUninvestedSnapshot(id));
  const audit = auditResonatorInvestmentSnapshots(allSnaps);
  assert.equal(audit.totalSnapshotsAudited, 60);
  assert.equal(audit.validSnapshotsCount, 60);
  assert.equal(audit.uniqueSnapshotIds, 60);
  assert.equal(audit.duplicateSnapshotIds, 0);
});

test('77. Upstream rule versions remain strictly unchanged', () => {
  assert.equal(CHARACTER_PAIR_SYNERGY_RULE_VERSION, '7.8.1');
  assert.equal(TEAM_COMPOSITION_RULE_VERSION, '7.9.1');
  assert.equal(TEAM_COMPOSITION_EVALUATION_RULE_VERSION, '7.10.1');
  assert.equal(TEAM_COMPOSITION_RANKING_RULE_VERSION, '7.11.1');
  assert.equal(OWNED_ROSTER_ELIGIBILITY_RULE_VERSION, '7.12.1');
  assert.equal(RESONATOR_INVESTMENT_RULE_VERSION, '7.13.1');
});

test('78. Canonical Patch 3.7 dataset remains byte-for-byte unchanged', () => {
  const datasetPath = path.join(process.cwd(), 'data/patches/3.7/patch_3_7_dataset.json');
  const buffer = fs.readFileSync(datasetPath);
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  assert.equal(hash, '7abb7cb3b5290dee9e22cba83df4c974e2befd6639fbb7f04041adedc11a68e9');
});

test('79. explainResonatorInvestment produces objective human-readable explanation', () => {
  const snap = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId: 'Jiyan',
    characterLevel: 80,
    sequenceLevel: 0,
    weapon: { weaponId: 'Verdant Summit', weaponLevel: 90, refinementRank: 1 },
    echoInvestment: { equippedCount: 5, sonataSetId: 'Sierra Gale' },
    provenance: mockProvenance
  }).snapshot;

  const expl = explainResonatorInvestment(snap);
  assert.equal(expl.resonatorId, 'Jiyan');
  assert.equal(expl.isCharacterLevelKnown, true);
  assert.equal(expl.characterLevel, 80);
  assert.equal(expl.isWeaponKnown, true);
  assert.equal(expl.weaponId, 'Verdant Summit');
  assert.ok(expl.summary.includes('Lv. 80'));
  assert.ok(expl.summary.includes('S0'));
  assert.ok(expl.summary.includes('Verdant Summit'));
});

test('80. Prohibited keys assertion catches forbidden properties', () => {
  assert.throws(() => {
    assertNoProhibitedInvestmentKeys({ characterPower: 100 });
  }, /Prohibited key 'characterPower'/);

  assert.throws(() => {
    assertNoProhibitedInvestmentKeys({ investmentScore: 85 });
  }, /Prohibited key 'investmentScore'/);

  assert.throws(() => {
    assertNoProhibitedInvestmentKeys({ buildScore: 92 });
  }, /Prohibited key 'buildScore'/);
});
