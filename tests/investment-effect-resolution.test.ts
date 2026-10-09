import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  INVESTMENT_EFFECT_RESOLUTION_RULE_VERSION,
  STANDARD_INVESTMENT_EFFECT_IDS,
  CANONICAL_RESONATOR_BASE_STATS_LVL90,
  CANONICAL_WEAPON_BASE_STATS_LVL90,
  CANONICAL_WEAPON_REFINEMENT_SCALING,
  CANONICAL_SONATA_EFFECT_VALUES,
  EFFECT_RESOLUTION_REASON_CODES,
  FORMULA_CHAR_BASE_HP_LVL90,
  FORMULA_CHAR_BASE_ATK_LVL90,
  FORMULA_CHAR_BASE_DEF_LVL90,
  FORMULA_WEAPON_BASE_ATK_LVL90,
  FORMULA_WEAPON_SUB_STAT_LVL90,
  FORMULA_WEAPON_REFINEMENT,
  FORMULA_SONATA_2PC,
  FORMULA_SONATA_5PC,
  resolveInvestmentEffect,
  resolveAllInvestmentEffects,
  getInvestmentEffect,
  getAllInvestmentEffects,
  getResolvedInvestmentEffects,
  getUnknownInvestmentEffects,
  getUnmodeledInvestmentEffects,
  getInvestmentEffectDependencies,
  getInvestmentResolutionSummary,
  auditInvestmentEffectResolutions,
  assertNoProhibitedEffectKeys,
  explainInvestmentEffectResolution,
  deriveInvestmentEffectId,
  isEffectReadyForFutureEvaluation,
  isInvestmentEffectResolved,
  isInvestmentEffectUnknown,
  isInvestmentEffectUnmodeled,
  isInvestmentEffectNotApplicable,
  isInvestmentEffectInvalid,
  isInvestmentEffectPatchMismatch,
  matchesInvestmentEffectFilter,
  compareInvestmentEffectResolution,
  hasStructuredRefinementScaling,
  isCanonicalSonataSet
} from '../lib/engine/investment/effects/index.ts';

import {
  knownValue,
  unknownValue,
  isCanonicalResonatorId,
  isCanonicalWeaponId,
  RESONATOR_INVESTMENT_RULE_VERSION
} from '../lib/engine/investment/index.ts';
import type {
  ResonatorInvestmentSnapshot,
  WeaponInvestmentSnapshot,
  EchoInvestmentSnapshot,
  InvestmentValue
} from '../lib/engine/investment/types.ts';

// ---------------------------------------------------------------------------
// TEST FIXTURE GENERATOR
// ---------------------------------------------------------------------------

function createTestSnapshot(
  resonatorId: string,
  overrides?: Partial<{
    characterLevel: InvestmentValue<number>;
    weapon: WeaponInvestmentSnapshot | null;
    sequenceLevel: InvestmentValue<number>;
    echoInvestment: EchoInvestmentSnapshot | null;
    patchVersion: '3.7';
  }>
): ResonatorInvestmentSnapshot {
  return {
    id: `resonator-investment:3.7:${resonatorId}:7.13.1`,
    patchVersion: overrides?.patchVersion ?? '3.7',
    ruleVersion: '7.13.1',
    resonatorId,
    characterLevel: overrides?.characterLevel ?? unknownValue(),
    weapon: overrides?.weapon !== undefined ? overrides.weapon : null,
    sequenceLevel: overrides?.sequenceLevel ?? unknownValue(),
    echoInvestment: overrides?.echoInvestment !== undefined ? overrides.echoInvestment : null,
    provenance: {
      entityId: resonatorId,
      entityName: resonatorId,
      sourceType: 'RESONATOR_ABILITY',
      patchVersion: '3.7',
      sourceProvenance: 'test',
      originalDescription: ''
    }
  };
}

function createWeaponSnapshot(
  weaponId: string,
  level?: number | null,
  refinement?: number | null
): WeaponInvestmentSnapshot {
  return {
    weaponId,
    weaponLevel: level !== undefined && level !== null ? knownValue(level) : unknownValue(),
    refinementRank: refinement !== undefined && refinement !== null ? knownValue(refinement) : unknownValue(),
    compatibilityStatus: 'KNOWN_COMPATIBLE',
    provenance: {
      entityId: weaponId,
      entityName: weaponId,
      sourceType: 'WEAPON_PASSIVE',
      patchVersion: '3.7',
      sourceProvenance: 'test',
      originalDescription: ''
    }
  };
}

function createEchoSnapshot(
  equippedCount?: number | null,
  sonataSetId?: string | null,
  tunedCount?: number | null,
  maxLevelCount?: number | null
): EchoInvestmentSnapshot {
  return {
    equippedCount: equippedCount !== undefined && equippedCount !== null ? knownValue(equippedCount) : unknownValue(),
    tunedCount: tunedCount !== undefined && tunedCount !== null ? knownValue(tunedCount) : unknownValue(),
    maxLevelEchoCount: maxLevelCount !== undefined && maxLevelCount !== null ? knownValue(maxLevelCount) : unknownValue(),
    sonataSetId: sonataSetId ?? null,
    provenance: {
      entityId: 'ECHO_SET',
      entityName: 'ECHO_SET',
      sourceType: 'ECHO_SKILL',
      patchVersion: '3.7',
      sourceProvenance: 'test',
      originalDescription: ''
    }
  };
}

// ---------------------------------------------------------------------------
// 1–10: DATA AVAILABILITY CONTRACT
// ---------------------------------------------------------------------------

test('1. Structured level formula detected: Level 90 base stats exist for all 60 resonators', () => {
  const keys = Object.keys(CANONICAL_RESONATOR_BASE_STATS_LVL90);
  assert.equal(keys.length, 60);
  assert.ok(keys.includes('Jiyan'));
  assert.ok(keys.includes('Verina'));
  assert.ok(keys.includes('Mortefi'));
});

test('2. Missing level formula classified: Levels 1..89 scaling curve is absent from canonical data', () => {
  const snap = createTestSnapshot('Jiyan', { characterLevel: knownValue(80) });
  const res = resolveInvestmentEffect('Jiyan', 'char-level-scaling', snap);
  assert.equal(res.status, 'UNMODELED');
  assert.equal(res.resolvedValue, null);
});

test('3. Structured weapon formula detected: Level 90 stats exist for all 66 weapons', () => {
  const keys = Object.keys(CANONICAL_WEAPON_BASE_STATS_LVL90);
  assert.equal(keys.length, 66);
  assert.ok(keys.includes('Verdant Summit'));
  assert.ok(keys.includes('Blooming Jadehaven'));
});

test('4. Missing weapon formula classified: Weapon levels 1..89 scaling is unmodeled', () => {
  const snap = createTestSnapshot('Jiyan', { weapon: createWeaponSnapshot('Verdant Summit', 80) });
  const res = resolveInvestmentEffect('Jiyan', 'weapon-level-scaling', snap);
  assert.equal(res.status, 'UNMODELED');
  assert.equal(res.resolvedValue, null);
});

test('5. Structured refinement values detected: exactly 16 weapons have structured R1..R5 tables', () => {
  const keys = Object.keys(CANONICAL_WEAPON_REFINEMENT_SCALING);
  assert.equal(keys.length, 16);
  assert.ok(hasStructuredRefinementScaling('Verdant Summit'));
  assert.ok(hasStructuredRefinementScaling('Blooming Jadehaven'));
});

test('6. Missing refinement values classified: remaining 50 weapons are prose-only and classified UNMODELED', () => {
  assert.equal(hasStructuredRefinementScaling('Broadblade#41'), false);
  const snap = createTestSnapshot('Jiyan', { weapon: createWeaponSnapshot('Broadblade#41', 90, 1) });
  const res = resolveInvestmentEffect('Jiyan', 'weapon-refinement', snap);
  assert.equal(res.status, 'UNMODELED');
  assert.equal(res.resolvedValue, null);
});

test('7. Structured Sequence numeric value detection: prose-only sequences in 3.7 dataset classified UNMODELED', () => {
  const snap = createTestSnapshot('Jiyan', { sequenceLevel: knownValue(2) });
  const res = resolveInvestmentEffect('Jiyan', 'sequence-node:S2', snap);
  assert.equal(res.status, 'UNMODELED');
  assert.equal(res.resolvedValue, null);
});

test('8. Prose-only Sequence classified UNMODELED when node is unlocked', () => {
  const snap = createTestSnapshot('Jiyan', { sequenceLevel: knownValue(1) });
  const res = resolveInvestmentEffect('Jiyan', 'sequence-node:S1', snap);
  assert.equal(res.status, 'UNMODELED');
  assert.equal(res.reasonCodes[0], EFFECT_RESOLUTION_REASON_CODES.SEQUENCE_NODE_PROSE_ONLY);
});

test('9. Structured Echo effect detected: 12 Sonatas have structured 2-pc and 5-pc effects', () => {
  const keys = Object.keys(CANONICAL_SONATA_EFFECT_VALUES);
  assert.equal(keys.length, 12);
  assert.ok(isCanonicalSonataSet('SIERRA_GALE'));
  assert.ok(isCanonicalSonataSet('Sierra Gale'));
});

test('10. Missing Echo formula classified: Echo level/substat curves classified UNMODELED', () => {
  const snap = createTestSnapshot('Jiyan', { echoInvestment: createEchoSnapshot(5, 'SIERRA_GALE', 5, 5) });
  const res = resolveInvestmentEffect('Jiyan', 'echo-stat-scaling', snap);
  assert.equal(res.status, 'UNMODELED');
  assert.equal(res.resolvedValue, null);
});

// ---------------------------------------------------------------------------
// 11–15: CHARACTER LEVEL RESOLUTION
// ---------------------------------------------------------------------------

test('11. Known level 90 resolves when formula exists', () => {
  const snap = createTestSnapshot('Jiyan', { characterLevel: knownValue(90) });
  const hpRes = resolveInvestmentEffect('Jiyan', 'char-base-hp', snap);
  const atkRes = resolveInvestmentEffect('Jiyan', 'char-base-atk', snap);
  const defRes = resolveInvestmentEffect('Jiyan', 'char-base-def', snap);

  assert.equal(hpRes.status, 'RESOLVED');
  assert.equal(hpRes.resolvedValue, CANONICAL_RESONATOR_BASE_STATS_LVL90['Jiyan'].hp);
  assert.equal(hpRes.unit, 'FLAT_HP');

  assert.equal(atkRes.status, 'RESOLVED');
  assert.equal(atkRes.resolvedValue, CANONICAL_RESONATOR_BASE_STATS_LVL90['Jiyan'].atk);
  assert.equal(atkRes.unit, 'FLAT_ATK');

  assert.equal(defRes.status, 'RESOLVED');
  assert.equal(defRes.resolvedValue, CANONICAL_RESONATOR_BASE_STATS_LVL90['Jiyan'].def);
  assert.equal(defRes.unit, 'FLAT_DEF');
});

test('12. Unknown level returns UNKNOWN with null resolvedValue', () => {
  const snap = createTestSnapshot('Jiyan', { characterLevel: unknownValue() });
  const res = resolveInvestmentEffect('Jiyan', 'char-base-hp', snap);
  assert.equal(res.status, 'UNKNOWN');
  assert.equal(res.resolvedValue, null);
  assert.equal(res.inputValue, null);
});

test('13. Invalid level (level 0) fails closed with INVALID', () => {
  const snap = createTestSnapshot('Jiyan', { characterLevel: knownValue(0) });
  const res = resolveInvestmentEffect('Jiyan', 'char-base-hp', snap);
  assert.equal(res.status, 'INVALID');
  assert.equal(res.resolvedValue, null);
});

test('14. Level boundary: level 1 is UNMODELED (no curve), level 90 is RESOLVED', () => {
  const snap1 = createTestSnapshot('Jiyan', { characterLevel: knownValue(1) });
  const res1 = resolveInvestmentEffect('Jiyan', 'char-base-hp', snap1);
  assert.equal(res1.status, 'UNMODELED');
  assert.equal(res1.inputValue, 1);

  const snap90 = createTestSnapshot('Jiyan', { characterLevel: knownValue(90) });
  const res90 = resolveInvestmentEffect('Jiyan', 'char-base-hp', snap90);
  assert.equal(res90.status, 'RESOLVED');
  assert.equal(res90.inputValue, 90);
});

test('15. Deterministic level resolution yields identical results across repeated evaluations', () => {
  const snap = createTestSnapshot('Jiyan', { characterLevel: knownValue(90) });
  const resA = resolveInvestmentEffect('Jiyan', 'char-base-atk', snap);
  const resB = resolveInvestmentEffect('Jiyan', 'char-base-atk', snap);
  assert.deepEqual(resA, resB);
});

// ---------------------------------------------------------------------------
// 16–24: WEAPON RESOLUTION
// ---------------------------------------------------------------------------

test('16. Known weapon at level 90 resolves base ATK and sub-stat', () => {
  const snap = createTestSnapshot('Jiyan', { weapon: createWeaponSnapshot('Verdant Summit', 90) });
  const atkRes = resolveInvestmentEffect('Jiyan', 'weapon-base-atk', snap);
  const subRes = resolveInvestmentEffect('Jiyan', 'weapon-sub-stat', snap);

  assert.equal(atkRes.status, 'RESOLVED');
  assert.equal(atkRes.resolvedValue, CANONICAL_WEAPON_BASE_STATS_LVL90['Verdant Summit'].baseAtk);
  assert.equal(atkRes.unit, 'FLAT_ATK');

  assert.equal(subRes.status, 'RESOLVED');
  assert.equal(subRes.resolvedValue, CANONICAL_WEAPON_BASE_STATS_LVL90['Verdant Summit'].subStatValue);
  assert.equal(subRes.unit, 'PERCENT');
});

test('17. Unknown weapon snapshot returns UNKNOWN', () => {
  const snap = createTestSnapshot('Jiyan', { weapon: null });
  const res = resolveInvestmentEffect('Jiyan', 'weapon-base-atk', snap);
  assert.equal(res.status, 'UNKNOWN');
  assert.equal(res.resolvedValue, null);
});

test('18. Unknown weapon level returns UNKNOWN', () => {
  const snap = createTestSnapshot('Jiyan', { weapon: createWeaponSnapshot('Verdant Summit', null) });
  const res = resolveInvestmentEffect('Jiyan', 'weapon-base-atk', snap);
  assert.equal(res.status, 'UNKNOWN');
  assert.equal(res.resolvedValue, null);
});

test('19. Unknown refinement returns UNKNOWN for structured weapon', () => {
  const snap = createTestSnapshot('Jiyan', { weapon: createWeaponSnapshot('Verdant Summit', 90, null) });
  const res = resolveInvestmentEffect('Jiyan', 'weapon-refinement', snap);
  assert.equal(res.status, 'UNKNOWN');
  assert.equal(res.resolvedValue, null);
});

test('20. R1 exact resolution returns exact R1 table value', () => {
  const snap = createTestSnapshot('Jiyan', { weapon: createWeaponSnapshot('Verdant Summit', 90, 1) });
  const res = resolveInvestmentEffect('Jiyan', 'weapon-refinement', snap);
  assert.equal(res.status, 'RESOLVED');
  assert.equal(res.inputValue, 1);
  assert.equal(res.resolvedValue, 12);
  assert.equal(res.unit, 'PERCENT');
});

test('21. R5 exact resolution returns exact R5 table value', () => {
  const snap = createTestSnapshot('Jiyan', { weapon: createWeaponSnapshot('Verdant Summit', 90, 5) });
  const res = resolveInvestmentEffect('Jiyan', 'weapon-refinement', snap);
  assert.equal(res.status, 'RESOLVED');
  assert.equal(res.inputValue, 5);
  assert.equal(res.resolvedValue, 24);
  assert.equal(res.unit, 'PERCENT');
});

test('22. Invalid refinement (rank 0 or 6) fails closed with INVALID', () => {
  const snap0 = createTestSnapshot('Jiyan', { weapon: createWeaponSnapshot('Verdant Summit', 90, 0) });
  assert.equal(resolveInvestmentEffect('Jiyan', 'weapon-refinement', snap0).status, 'INVALID');

  const snap6 = createTestSnapshot('Jiyan', { weapon: createWeaponSnapshot('Verdant Summit', 90, 6) });
  assert.equal(resolveInvestmentEffect('Jiyan', 'weapon-refinement', snap6).status, 'INVALID');
});

test('23. Cross-patch or unrecognized weapon ID fails closed with INVALID', () => {
  const snap = createTestSnapshot('Jiyan', { weapon: createWeaponSnapshot('Excalibur 3.8', 90, 1) });
  const res = resolveInvestmentEffect('Jiyan', 'weapon-base-atk', snap);
  assert.equal(res.status, 'INVALID');
  assert.equal(res.resolvedValue, null);
});

test('24. No R1 default: omitting refinement never defaults to R1', () => {
  const snap = createTestSnapshot('Jiyan', { weapon: createWeaponSnapshot('Verdant Summit', 90, null) });
  const res = resolveInvestmentEffect('Jiyan', 'weapon-refinement', snap);
  assert.equal(res.status, 'UNKNOWN');
  assert.notEqual(res.resolvedValue, 12);
  assert.equal(res.resolvedValue, null);
});

// ---------------------------------------------------------------------------
// 25–31: SEQUENCE RESOLUTION
// ---------------------------------------------------------------------------

test('25. S0 explicit: nodes S1..S6 are classified NOT_APPLICABLE (locked)', () => {
  const snap = createTestSnapshot('Jiyan', { sequenceLevel: knownValue(0) });
  for (let i = 1; i <= 6; i++) {
    const res = resolveInvestmentEffect('Jiyan', `sequence-node:S${i}`, snap);
    assert.equal(res.status, 'NOT_APPLICABLE');
    assert.equal(res.resolvedValue, null);
    assert.equal(res.reasonCodes[0], EFFECT_RESOLUTION_REASON_CODES.SEQUENCE_NODE_LOCKED);
  }
});

test('26. S6 explicit: all nodes S1..S6 are unlocked and classified UNMODELED (prose-only)', () => {
  const snap = createTestSnapshot('Jiyan', { sequenceLevel: knownValue(6) });
  for (let i = 1; i <= 6; i++) {
    const res = resolveInvestmentEffect('Jiyan', `sequence-node:S${i}`, snap);
    assert.equal(res.status, 'UNMODELED');
    assert.equal(res.resolvedValue, null);
    assert.equal(res.reasonCodes[0], EFFECT_RESOLUTION_REASON_CODES.SEQUENCE_NODE_PROSE_ONLY);
  }
});

test('27. S2 exact: S1 and S2 unlocked (UNMODELED), S3..S6 locked (NOT_APPLICABLE)', () => {
  const snap = createTestSnapshot('Jiyan', { sequenceLevel: knownValue(2) });
  assert.equal(resolveInvestmentEffect('Jiyan', 'sequence-node:S1', snap).status, 'UNMODELED');
  assert.equal(resolveInvestmentEffect('Jiyan', 'sequence-node:S2', snap).status, 'UNMODELED');
  assert.equal(resolveInvestmentEffect('Jiyan', 'sequence-node:S3', snap).status, 'NOT_APPLICABLE');
  assert.equal(resolveInvestmentEffect('Jiyan', 'sequence-node:S4', snap).status, 'NOT_APPLICABLE');
  assert.equal(resolveInvestmentEffect('Jiyan', 'sequence-node:S5', snap).status, 'NOT_APPLICABLE');
  assert.equal(resolveInvestmentEffect('Jiyan', 'sequence-node:S6', snap).status, 'NOT_APPLICABLE');
});

test('28. Unknown Sequence returns UNKNOWN for all nodes', () => {
  const snap = createTestSnapshot('Jiyan', { sequenceLevel: unknownValue() });
  const res = resolveInvestmentEffect('Jiyan', 'sequence-node:S1', snap);
  assert.equal(res.status, 'UNKNOWN');
  assert.equal(res.resolvedValue, null);
});

test('29. Invalid Sequence (seq -1 or 7) fails closed with INVALID', () => {
  const snapNeg = createTestSnapshot('Jiyan', { sequenceLevel: knownValue(-1) });
  assert.equal(resolveInvestmentEffect('Jiyan', 'sequence-node:S1', snapNeg).status, 'INVALID');

  const snap7 = createTestSnapshot('Jiyan', { sequenceLevel: knownValue(7) });
  assert.equal(resolveInvestmentEffect('Jiyan', 'sequence-node:S1', snap7).status, 'INVALID');
});

test('30. Prose-only Sequence never fabricates synthetic numbers', () => {
  const snap = createTestSnapshot('Jiyan', { sequenceLevel: knownValue(6) });
  const res = resolveInvestmentEffect('Jiyan', 'sequence-node:S3', snap);
  assert.equal(res.resolvedValue, null);
  assert.notEqual(res.resolvedValue, 0);
});

test('31. No inferred Sequence from ownership state', () => {
  const snap = createTestSnapshot('Jiyan'); // owned character, but sequenceLevel omitted
  const res = resolveInvestmentEffect('Jiyan', 'sequence-node:S1', snap);
  assert.equal(res.status, 'UNKNOWN');
  assert.notEqual(res.status, 'RESOLVED');
});

// ---------------------------------------------------------------------------
// 32–41: ECHO & SONATA RESOLUTION
// ---------------------------------------------------------------------------

test('32. Known equipped count >= 2 with known Sonata resolves 2-pc effect', () => {
  const snap = createTestSnapshot('Jiyan', {
    echoInvestment: createEchoSnapshot(2, 'SIERRA_GALE')
  });
  const res = resolveInvestmentEffect('Jiyan', 'sonata-2pc', snap);
  assert.equal(res.status, 'RESOLVED');
  assert.equal(res.resolvedValue, 0.1);
  assert.equal(res.unit, 'PERCENT');
  assert.equal(res.formulaId, FORMULA_SONATA_2PC.formulaId);
});

test('33. Known equipped count < 2 with known Sonata is NOT_APPLICABLE', () => {
  const snap = createTestSnapshot('Jiyan', {
    echoInvestment: createEchoSnapshot(1, 'SIERRA_GALE')
  });
  const res = resolveInvestmentEffect('Jiyan', 'sonata-2pc', snap);
  assert.equal(res.status, 'NOT_APPLICABLE');
  assert.equal(res.resolvedValue, null);
});

test('34. Known equipped count >= 5 with known Sonata resolves 5-pc effect', () => {
  const snap = createTestSnapshot('Jiyan', {
    echoInvestment: createEchoSnapshot(5, 'SIERRA_GALE')
  });
  const res = resolveInvestmentEffect('Jiyan', 'sonata-5pc', snap);
  assert.equal(res.status, 'RESOLVED');
  assert.equal(res.resolvedValue, 0.3);
  assert.equal(res.unit, 'PERCENT');
  assert.equal(res.formulaId, FORMULA_SONATA_5PC.formulaId);
});

test('35. Unknown Echo count returns UNKNOWN for Sonata effects', () => {
  const snap = createTestSnapshot('Jiyan', {
    echoInvestment: createEchoSnapshot(null, 'SIERRA_GALE')
  });
  const res = resolveInvestmentEffect('Jiyan', 'sonata-2pc', snap);
  assert.equal(res.status, 'UNKNOWN');
  assert.equal(res.resolvedValue, null);
});

test('36. Known Sonata name (case-insensitive) resolves correctly', () => {
  const snap = createTestSnapshot('Jiyan', {
    echoInvestment: createEchoSnapshot(5, 'Sierra Gale')
  });
  const res = resolveInvestmentEffect('Jiyan', 'sonata-2pc', snap);
  assert.equal(res.status, 'RESOLVED');
  assert.equal(res.resolvedValue, 0.1);
});

test('37. Unknown Sonata set returns UNKNOWN for Sonata effects', () => {
  const snap = createTestSnapshot('Jiyan', {
    echoInvestment: createEchoSnapshot(5, null)
  });
  const res = resolveInvestmentEffect('Jiyan', 'sonata-2pc', snap);
  assert.equal(res.status, 'UNKNOWN');
  assert.equal(res.resolvedValue, null);
});

test('38. Invalid Sonata set returns INVALID', () => {
  const snap = createTestSnapshot('Jiyan', {
    echoInvestment: createEchoSnapshot(5, 'NON_EXISTENT_SET')
  });
  const res = resolveInvestmentEffect('Jiyan', 'sonata-2pc', snap);
  assert.equal(res.status, 'INVALID');
  assert.equal(res.resolvedValue, null);
});

test('39. No Echo quality inference: tuned/maxLevel count do not invent stat multipliers', () => {
  const snap = createTestSnapshot('Jiyan', {
    echoInvestment: createEchoSnapshot(5, 'SIERRA_GALE', 5, 5)
  });
  const res = resolveInvestmentEffect('Jiyan', 'echo-stat-scaling', snap);
  assert.equal(res.status, 'UNMODELED');
  assert.equal(res.resolvedValue, null);
});

test('40. No main-stat inference from echo counts', () => {
  const snap = createTestSnapshot('Jiyan', {
    echoInvestment: createEchoSnapshot(5, 'SIERRA_GALE', 5, 5)
  });
  const all = resolveAllInvestmentEffects('Jiyan', snap);
  assert.ok(!all.some((r) => r.effectId === 'echo-main-stat-crit'));
});

test('41. No sub-stat inference from echo counts', () => {
  const snap = createTestSnapshot('Jiyan', {
    echoInvestment: createEchoSnapshot(5, 'SIERRA_GALE', 5, 5)
  });
  const all = resolveAllInvestmentEffects('Jiyan', snap);
  assert.ok(!all.some((r) => r.effectId === 'echo-substat-rolls'));
});

// ---------------------------------------------------------------------------
// 42–47: RESOLUTION STATES
// ---------------------------------------------------------------------------

test('42. RESOLVED state has finite numeric value and non-null formula', () => {
  const snap = createTestSnapshot('Jiyan', { characterLevel: knownValue(90) });
  const res = resolveInvestmentEffect('Jiyan', 'char-base-hp', snap);
  assert.equal(res.status, 'RESOLVED');
  assert.ok(typeof res.resolvedValue === 'number' && Number.isFinite(res.resolvedValue));
  assert.ok(res.formulaId !== null);
});

test('43. UNKNOWN state has null resolvedValue', () => {
  const snap = createTestSnapshot('Jiyan', { characterLevel: unknownValue() });
  const res = resolveInvestmentEffect('Jiyan', 'char-base-hp', snap);
  assert.equal(res.status, 'UNKNOWN');
  assert.equal(res.resolvedValue, null);
});

test('44. UNMODELED state has null resolvedValue', () => {
  const snap = createTestSnapshot('Jiyan', { characterLevel: knownValue(80) });
  const res = resolveInvestmentEffect('Jiyan', 'char-level-scaling', snap);
  assert.equal(res.status, 'UNMODELED');
  assert.equal(res.resolvedValue, null);
});

test('45. NOT_APPLICABLE state has null resolvedValue', () => {
  const snap = createTestSnapshot('Jiyan', { sequenceLevel: knownValue(0) });
  const res = resolveInvestmentEffect('Jiyan', 'sequence-node:S1', snap);
  assert.equal(res.status, 'NOT_APPLICABLE');
  assert.equal(res.resolvedValue, null);
});

test('46. INVALID state fails closed with null resolvedValue', () => {
  const snap = createTestSnapshot('Jiyan', { characterLevel: knownValue(100) });
  const res = resolveInvestmentEffect('Jiyan', 'char-base-hp', snap);
  assert.equal(res.status, 'INVALID');
  assert.equal(res.resolvedValue, null);
});

test('47. PATCH_MISMATCH state fails closed with null resolvedValue', () => {
  const snap = createTestSnapshot('Jiyan', { patchVersion: '3.6' as any });
  const res = resolveInvestmentEffect('Jiyan', 'char-base-hp', snap);
  assert.equal(res.status, 'PATCH_MISMATCH');
  assert.equal(res.resolvedValue, null);
});

// ---------------------------------------------------------------------------
// 48–54: UNITS & UNIT SAFETY
// ---------------------------------------------------------------------------

test('48. Percent unit is explicitly assigned for percentage effects', () => {
  const snap = createTestSnapshot('Jiyan', {
    weapon: createWeaponSnapshot('Verdant Summit', 90, 1)
  });
  const res = resolveInvestmentEffect('Jiyan', 'weapon-refinement', snap);
  assert.equal(res.unit, 'PERCENT');
});

test('49. Flat stat unit is explicitly assigned for base stats (FLAT_HP, FLAT_ATK, FLAT_DEF)', () => {
  const snap = createTestSnapshot('Jiyan', { characterLevel: knownValue(90) });
  assert.equal(resolveInvestmentEffect('Jiyan', 'char-base-hp', snap).unit, 'FLAT_HP');
  assert.equal(resolveInvestmentEffect('Jiyan', 'char-base-atk', snap).unit, 'FLAT_ATK');
  assert.equal(resolveInvestmentEffect('Jiyan', 'char-base-def', snap).unit, 'FLAT_DEF');
});

test('50. Weapon base ATK uses FLAT_ATK unit', () => {
  const snap = createTestSnapshot('Jiyan', {
    weapon: createWeaponSnapshot('Verdant Summit', 90)
  });
  assert.equal(resolveInvestmentEffect('Jiyan', 'weapon-base-atk', snap).unit, 'FLAT_ATK');
});

test('51. Sonata set bonuses use PERCENT unit', () => {
  const snap = createTestSnapshot('Jiyan', {
    echoInvestment: createEchoSnapshot(5, 'SIERRA_GALE')
  });
  assert.equal(resolveInvestmentEffect('Jiyan', 'sonata-2pc', snap).unit, 'PERCENT');
  assert.equal(resolveInvestmentEffect('Jiyan', 'sonata-5pc', snap).unit, 'PERCENT');
});

test('52. Unresolved effects strictly have null unit', () => {
  const snap = createTestSnapshot('Jiyan', { characterLevel: unknownValue() });
  const res = resolveInvestmentEffect('Jiyan', 'char-base-hp', snap);
  assert.equal(res.unit, null);
});

test('53. Incompatible unit combination rejection: no dimensional addition in Step 15', () => {
  const snap = createTestSnapshot('Jiyan', {
    characterLevel: knownValue(90),
    weapon: createWeaponSnapshot('Verdant Summit', 90, 1)
  });
  const hpRes = resolveInvestmentEffect('Jiyan', 'char-base-hp', snap);
  const refRes = resolveInvestmentEffect('Jiyan', 'weapon-refinement', snap);
  assert.notEqual(hpRes.unit, refRes.unit);
  // Invariant assertion: Step 15 never performs arithmetic between effects
});

test('54. Missing unit rejection: every RESOLVED effect must declare a non-null unit', () => {
  const snap = createTestSnapshot('Jiyan', {
    characterLevel: knownValue(90),
    weapon: createWeaponSnapshot('Verdant Summit', 90, 1),
    echoInvestment: createEchoSnapshot(5, 'SIERRA_GALE')
  });
  const resolved = getResolvedInvestmentEffects('Jiyan', snap);
  for (const r of resolved) {
    assert.ok(r.unit !== null, `Resolved effect ${r.effectId} must declare a unit`);
  }
});

// ---------------------------------------------------------------------------
// 55–60: FORMULA CONTRACT
// ---------------------------------------------------------------------------

test('55. Formula ID is preserved on RESOLVED records', () => {
  const snap = createTestSnapshot('Jiyan', { characterLevel: knownValue(90) });
  const res = resolveInvestmentEffect('Jiyan', 'char-base-hp', snap);
  assert.equal(res.formulaId, FORMULA_CHAR_BASE_HP_LVL90.formulaId);
});

test('56. Formula version matches Step 15 rule version (7.15.1)', () => {
  assert.equal(FORMULA_CHAR_BASE_HP_LVL90.formulaVersion, '7.15.1');
  assert.equal(FORMULA_WEAPON_REFINEMENT.formulaVersion, '7.15.1');
  assert.equal(FORMULA_SONATA_2PC.formulaVersion, '7.15.1');
});

test('57. Source facts are preserved on RESOLVED records', () => {
  const snap = createTestSnapshot('Jiyan', { characterLevel: knownValue(90) });
  const res = resolveInvestmentEffect('Jiyan', 'char-base-hp', snap);
  assert.ok(res.sourceFactIds.length > 0);
  assert.equal(res.sourceFactIds[0], 'fact:patch-3-7:resonator-base-hp-lvl90');
});

test('58. All dependencies known required for RESOLVED state', () => {
  const snap = createTestSnapshot('Jiyan', {
    weapon: createWeaponSnapshot('Verdant Summit', 90, null) // refinement unknown
  });
  const res = resolveInvestmentEffect('Jiyan', 'weapon-refinement', snap);
  assert.notEqual(res.status, 'RESOLVED');
  assert.equal(res.status, 'UNKNOWN');
});

test('59. Missing dependency fails closed without fallback', () => {
  const snap = createTestSnapshot('Jiyan', { weapon: null });
  const res = resolveInvestmentEffect('Jiyan', 'weapon-refinement', snap);
  assert.equal(res.status, 'UNKNOWN');
  assert.equal(res.resolvedValue, null);
});

test('60. Deterministic formula result produces exact expected magnitude', () => {
  const snap = createTestSnapshot('Jiyan', {
    weapon: createWeaponSnapshot('Verdant Summit', 90, 3)
  });
  const res = resolveInvestmentEffect('Jiyan', 'weapon-refinement', snap);
  assert.equal(res.resolvedValue, 18);
});

// ---------------------------------------------------------------------------
// 61–65: PROVENANCE
// ---------------------------------------------------------------------------

test('61. Provenance is preserved on every evaluated record', () => {
  const snap = createTestSnapshot('Jiyan');
  const res = resolveInvestmentEffect('Jiyan', 'char-base-hp', snap);
  assert.ok(res.provenance);
  assert.equal(res.provenance.patchVersion, '3.7');
  assert.equal(res.provenance.entityId, 'Jiyan');
});

test('62. Source fact lineage preserved on RESOLVED records', () => {
  const snap = createTestSnapshot('Jiyan', { characterLevel: knownValue(90) });
  const res = resolveInvestmentEffect('Jiyan', 'char-base-atk', snap);
  assert.equal(res.sourceFactIds[0], 'fact:patch-3-7:resonator-base-atk-lvl90');
});

test('63. Investment lineage preserved through input value', () => {
  const snap = createTestSnapshot('Jiyan', { characterLevel: knownValue(90) });
  const res = resolveInvestmentEffect('Jiyan', 'char-base-hp', snap);
  assert.equal(res.inputValue, 90);
});

test('64. Relationship lineage is exposed as empty array when unlinked', () => {
  const snap = createTestSnapshot('Jiyan');
  const res = resolveInvestmentEffect('Jiyan', 'char-base-hp', snap);
  assert.ok(Array.isArray(res.relationshipIds));
});

test('65. No fake provenance: provenance references valid patch and entity', () => {
  const snap = createTestSnapshot('Jiyan');
  const res = resolveInvestmentEffect('Jiyan', 'char-base-hp', snap);
  assert.equal(res.provenance.patchVersion, '3.7');
  assert.ok(res.provenance.sourceProvenance.length > 0);
});

// ---------------------------------------------------------------------------
// 66–74: STATIC SAFETY CONTRACT
// ---------------------------------------------------------------------------

test('66. Source tree contains zero network calls (fetch, axios, http)', () => {
  const dir = path.join(process.cwd(), 'lib/engine/investment/effects');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.equal(content.includes('fetch('), false, `Network fetch found in ${file}`);
    assert.equal(content.includes('axios'), false, `Axios found in ${file}`);
    assert.equal(content.includes('http:'), false, `http found in ${file}`);
    assert.equal(content.includes('https:'), false, `https found in ${file}`);
  }
});

test('67. Source tree contains zero LLM references (openai, gemini, llm)', () => {
  const dir = path.join(process.cwd(), 'lib/engine/investment/effects');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.equal(content.includes('openai'), false, `OpenAI found in ${file}`);
    assert.equal(content.includes('gemini'), false, `Gemini found in ${file}`);
    assert.equal(content.includes('llm'), false, `LLM found in ${file}`);
  }
});

test('68. Source tree contains zero nondeterministic random calls', () => {
  const dir = path.join(process.cwd(), 'lib/engine/investment/effects');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.equal(content.includes('Math.random'), false, `Math.random in ${file}`);
    assert.equal(content.includes('randomUUID'), false, `randomUUID in ${file}`);
  }
});

test('69. Source tree contains zero nondeterministic time calls', () => {
  const dir = path.join(process.cwd(), 'lib/engine/investment/effects');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.equal(content.includes('Date.now'), false, `Date.now in ${file}`);
    assert.equal(content.includes('new Date'), false, `new Date in ${file}`);
  }
});

test('70. Source tree contains zero parseFloat', () => {
  const dir = path.join(process.cwd(), 'lib/engine/investment/effects');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.equal(content.includes('parseFloat'), false, `parseFloat in ${file}`);
  }
});

test('71. Source tree contains zero parseInt', () => {
  const dir = path.join(process.cwd(), 'lib/engine/investment/effects');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.equal(content.includes('parseInt'), false, `parseInt in ${file}`);
  }
});

test('72. Source tree contains zero unsafe numeric fallbacks', () => {
  const dir = path.join(process.cwd(), 'lib/engine/investment/effects');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.equal(content.includes('?? 0'), false, `?? 0 in ${file}`);
    assert.equal(content.includes('|| 0'), false, `|| 0 in ${file}`);
  }
});

test('73. Source tree contains zero ?? 0 fallbacks in rules and resolver', () => {
  const resolverContent = fs.readFileSync(path.resolve('lib/engine/investment/effects/resolver.ts'), 'utf8');
  assert.equal(resolverContent.includes('?? 0'), false);
});

test('74. Source tree contains zero || 0 fallbacks in rules and resolver', () => {
  const resolverContent = fs.readFileSync(path.resolve('lib/engine/investment/effects/resolver.ts'), 'utf8');
  assert.equal(resolverContent.includes('|| 0'), false);
});

// ---------------------------------------------------------------------------
// 75–87: BOUNDARY CONTRACT
// ---------------------------------------------------------------------------

test('75. Zero investment scoring properties on record', () => {
  const snap = createTestSnapshot('Jiyan', { characterLevel: knownValue(90) });
  const res = resolveInvestmentEffect('Jiyan', 'char-base-hp', snap);
  assert.equal((res as any).investmentScore, undefined);
});

test('76. Zero character scoring properties on record', () => {
  const snap = createTestSnapshot('Jiyan', { characterLevel: knownValue(90) });
  const res = resolveInvestmentEffect('Jiyan', 'char-base-hp', snap);
  assert.equal((res as any).characterScore, undefined);
});

test('77. Zero team scoring properties on record', () => {
  const snap = createTestSnapshot('Jiyan', { characterLevel: knownValue(90) });
  const res = resolveInvestmentEffect('Jiyan', 'char-base-hp', snap);
  assert.equal((res as any).teamScore, undefined);
});

test('78. Zero character power properties on record', () => {
  const snap = createTestSnapshot('Jiyan', { characterLevel: knownValue(90) });
  const res = resolveInvestmentEffect('Jiyan', 'char-base-hp', snap);
  assert.equal((res as any).characterPower, undefined);
  assert.equal((res as any).combatPower, undefined);
});

test('79. Zero DPS properties on record', () => {
  const snap = createTestSnapshot('Jiyan', { characterLevel: knownValue(90) });
  const res = resolveInvestmentEffect('Jiyan', 'char-base-hp', snap);
  assert.equal((res as any).DPS, undefined);
  assert.equal((res as any).dps, undefined);
});

test('80. Zero damage calculation on record', () => {
  const snap = createTestSnapshot('Jiyan', { characterLevel: knownValue(90) });
  const res = resolveInvestmentEffect('Jiyan', 'char-base-hp', snap);
  assert.equal((res as any).damage, undefined);
  assert.equal((res as any).rotationDps, undefined);
});

test('81. Zero team generation occurs in Step 15', () => {
  // Step 15 resolver operates only on individual resonator investment
  const snap = createTestSnapshot('Jiyan');
  const all = resolveAllInvestmentEffects('Jiyan', snap);
  assert.equal(all.length, 17);
});

test('82. Zero optimization / candidate selection occurs', () => {
  const snap = createTestSnapshot('Jiyan');
  const summary = getInvestmentResolutionSummary('Jiyan', snap);
  assert.equal((summary as any).bestBuild, undefined);
  assert.equal((summary as any).optimalWeapon, undefined);
});

test('83. Zero reranking occurs in Step 15', () => {
  const snap = createTestSnapshot('Jiyan');
  const all = resolveAllInvestmentEffects('Jiyan', snap);
  assert.equal((all[0] as any).rank, undefined);
});

test('84. Zero ToA properties exist on record', () => {
  const snap = createTestSnapshot('Jiyan');
  const res = resolveInvestmentEffect('Jiyan', 'char-base-hp', snap);
  assert.equal((res as any).toaFitness, undefined);
  assert.equal((res as any).towerScore, undefined);
});

test('85. Zero Vigor properties exist on record', () => {
  const snap = createTestSnapshot('Jiyan');
  const res = resolveInvestmentEffect('Jiyan', 'char-base-hp', snap);
  assert.equal((res as any).vigorCost, undefined);
});

test('86. Zero role inference on record', () => {
  const snap = createTestSnapshot('Jiyan');
  const res = resolveInvestmentEffect('Jiyan', 'char-base-hp', snap);
  assert.equal((res as any).role, undefined);
  assert.equal((res as any).functionalRole, undefined);
});

test('87. Zero meta inference on record', () => {
  const snap = createTestSnapshot('Jiyan');
  const res = resolveInvestmentEffect('Jiyan', 'char-base-hp', snap);
  assert.equal((res as any).metaRank, undefined);
  assert.equal((res as any).tier, undefined);
});

// ---------------------------------------------------------------------------
// 88–90: DETERMINISM CONTRACT
// ---------------------------------------------------------------------------

test('88. Repeated effect resolution produces identical output', () => {
  const snap = createTestSnapshot('Jiyan', {
    characterLevel: knownValue(90),
    weapon: createWeaponSnapshot('Verdant Summit', 90, 1)
  });
  const res1 = resolveAllInvestmentEffects('Jiyan', snap);
  const res2 = resolveAllInvestmentEffects('Jiyan', snap);
  assert.deepEqual(res1, res2);
});

test('89. Input ordering invariance: snapshot field insertion order does not affect results', () => {
  const snapA = createTestSnapshot('Jiyan', {
    characterLevel: knownValue(90),
    weapon: createWeaponSnapshot('Verdant Summit', 90, 1)
  });
  const snapB: ResonatorInvestmentSnapshot = {
    provenance: snapA.provenance,
    echoInvestment: snapA.echoInvestment,
    sequenceLevel: snapA.sequenceLevel,
    weapon: snapA.weapon,
    characterLevel: snapA.characterLevel,
    resonatorId: snapA.resonatorId,
    ruleVersion: snapA.ruleVersion,
    patchVersion: snapA.patchVersion,
    id: snapA.id
  };
  const resA = resolveAllInvestmentEffects('Jiyan', snapA);
  const resB = resolveAllInvestmentEffects('Jiyan', snapB);
  assert.deepEqual(resA, resB);
});

test('90. 20-run byte-identical production generation over sample resonator', () => {
  const snap = createTestSnapshot('Jiyan', {
    characterLevel: knownValue(90),
    weapon: createWeaponSnapshot('Verdant Summit', 90, 1),
    sequenceLevel: knownValue(2),
    echoInvestment: createEchoSnapshot(5, 'SIERRA_GALE')
  });

  const baseJson = JSON.stringify(resolveAllInvestmentEffects('Jiyan', snap));
  const baseHash = crypto.createHash('sha256').update(baseJson).digest('hex');

  for (let run = 1; run <= 20; run++) {
    const currentJson = JSON.stringify(resolveAllInvestmentEffects('Jiyan', snap));
    const currentHash = crypto.createHash('sha256').update(currentJson).digest('hex');
    assert.equal(currentHash, baseHash, `Run ${run} diverged from base hash`);
  }
});

// ---------------------------------------------------------------------------
// 91–96: PRODUCTION FIXTURES
// ---------------------------------------------------------------------------

test('91. Fixture A — Fully unknown investment: all effects are UNKNOWN or UNMODELED', () => {
  const snap = createTestSnapshot('Jiyan');
  const all = resolveAllInvestmentEffects('Jiyan', snap);

  assert.equal(all.length, 17);
  // Zero effects are RESOLVED
  const resolved = all.filter((r) => r.status === 'RESOLVED');
  assert.equal(resolved.length, 0);

  // Every effect has null resolvedValue
  for (const r of all) {
    assert.equal(r.resolvedValue, null);
  }
});

test('92. Fixture B — Known Sequence (S2): S1 and S2 are UNMODELED (prose-only), S3..S6 are NOT_APPLICABLE', () => {
  const snap = createTestSnapshot('Jiyan', { sequenceLevel: knownValue(2) });
  assert.equal(resolveInvestmentEffect('Jiyan', 'sequence-node:S1', snap).status, 'UNMODELED');
  assert.equal(resolveInvestmentEffect('Jiyan', 'sequence-node:S2', snap).status, 'UNMODELED');
  assert.equal(resolveInvestmentEffect('Jiyan', 'sequence-node:S3', snap).status, 'NOT_APPLICABLE');
  assert.equal(resolveInvestmentEffect('Jiyan', 'sequence-node:S4', snap).status, 'NOT_APPLICABLE');
  assert.equal(resolveInvestmentEffect('Jiyan', 'sequence-node:S5', snap).status, 'NOT_APPLICABLE');
  assert.equal(resolveInvestmentEffect('Jiyan', 'sequence-node:S6', snap).status, 'NOT_APPLICABLE');
});

test('93. Fixture C — Known Weapon (lvl 90), Unknown Refinement: base stats resolve, refinement is UNKNOWN', () => {
  const snap = createTestSnapshot('Jiyan', {
    weapon: createWeaponSnapshot('Verdant Summit', 90, null)
  });
  const atkRes = resolveInvestmentEffect('Jiyan', 'weapon-base-atk', snap);
  const subRes = resolveInvestmentEffect('Jiyan', 'weapon-sub-stat', snap);
  const refRes = resolveInvestmentEffect('Jiyan', 'weapon-refinement', snap);

  assert.equal(atkRes.status, 'RESOLVED');
  assert.equal(subRes.status, 'RESOLVED');
  assert.equal(refRes.status, 'UNKNOWN');
  assert.equal(refRes.resolvedValue, null);
});

test('94. Fixture D — Fully known structured investment: exactly structured effects resolve', () => {
  const snap = createTestSnapshot('Jiyan', {
    characterLevel: knownValue(90),
    weapon: createWeaponSnapshot('Verdant Summit', 90, 1),
    sequenceLevel: knownValue(0),
    echoInvestment: createEchoSnapshot(5, 'SIERRA_GALE')
  });

  const summary = getInvestmentResolutionSummary('Jiyan', snap);
  // Resolves: char-base-hp, char-base-atk, char-base-def, weapon-base-atk, weapon-sub-stat, weapon-refinement, sonata-2pc, sonata-5pc (total 8)
  assert.equal(summary.resolvedCount, 8);
  assert.ok(summary.resolvedEffectIds.includes('char-base-hp'));
  assert.ok(summary.resolvedEffectIds.includes('char-base-atk'));
  assert.ok(summary.resolvedEffectIds.includes('char-base-def'));
  assert.ok(summary.resolvedEffectIds.includes('weapon-base-atk'));
  assert.ok(summary.resolvedEffectIds.includes('weapon-sub-stat'));
  assert.ok(summary.resolvedEffectIds.includes('weapon-refinement'));
  assert.ok(summary.resolvedEffectIds.includes('sonata-2pc'));
  assert.ok(summary.resolvedEffectIds.includes('sonata-5pc'));

  // Missing formulas remain UNMODELED
  assert.ok(summary.unmodeledCount > 0);
  assert.ok(summary.unmodeledEffectIds.includes('char-level-scaling'));
});

test('95. Fixture E — Invalid investment: fails closed with INVALID or PATCH_MISMATCH', () => {
  const snapInvLevel = createTestSnapshot('Jiyan', { characterLevel: knownValue(0) });
  assert.equal(resolveInvestmentEffect('Jiyan', 'char-base-hp', snapInvLevel).status, 'INVALID');

  const snapInvRef = createTestSnapshot('Jiyan', { weapon: createWeaponSnapshot('Verdant Summit', 90, 7) });
  assert.equal(resolveInvestmentEffect('Jiyan', 'weapon-refinement', snapInvRef).status, 'INVALID');

  const snapInvSeq = createTestSnapshot('Jiyan', { sequenceLevel: knownValue(-1) });
  assert.equal(resolveInvestmentEffect('Jiyan', 'sequence-node:S1', snapInvSeq).status, 'INVALID');

  const snapMismatch = createTestSnapshot('Jiyan', { patchVersion: '3.6' as any });
  assert.equal(resolveInvestmentEffect('Jiyan', 'char-base-hp', snapMismatch).status, 'PATCH_MISMATCH');
});

test('96. Production auditor passes Invariants A through AV on sample resolutions', () => {
  const snap = createTestSnapshot('Jiyan', {
    characterLevel: knownValue(90),
    weapon: createWeaponSnapshot('Verdant Summit', 90, 1),
    sequenceLevel: knownValue(0),
    echoInvestment: createEchoSnapshot(5, 'SIERRA_GALE')
  });
  const all = resolveAllInvestmentEffects('Jiyan', snap);
  const metrics = auditInvestmentEffectResolutions(all);

  assert.equal(metrics.totalEffectsAudited, 17);
  assert.equal(metrics.allInvariantsPassed, true);
  assert.equal(metrics.duplicateEffectIds, 0);
  assert.equal(metrics.resolvedCount, 8);
});

// ---------------------------------------------------------------------------
// 97–102: REPOSITORY & EXPLANATION APIS
// ---------------------------------------------------------------------------

test('97. Repository getInvestmentEffect returns expected effect', () => {
  const snap = createTestSnapshot('Jiyan', { characterLevel: knownValue(90) });
  const res = getInvestmentEffect('Jiyan', 'char-base-hp', snap);
  assert.equal(res.status, 'RESOLVED');
  assert.equal(res.effectId, 'char-base-hp');
});

test('98. Repository getAllInvestmentEffects applies filter predicates', () => {
  const snap = createTestSnapshot('Jiyan', {
    characterLevel: knownValue(90),
    weapon: createWeaponSnapshot('Verdant Summit', 90, 1)
  });
  const levelEffects = getAllInvestmentEffects('Jiyan', snap, { category: 'CHARACTER_LEVEL_EFFECT' });
  assert.equal(levelEffects.length, 4);
  assert.ok(levelEffects.every((e) => e.category === 'CHARACTER_LEVEL_EFFECT'));
});

test('99. Repository getUnknownInvestmentEffects filters only UNKNOWN status', () => {
  const snap = createTestSnapshot('Jiyan');
  const unknownList = getUnknownInvestmentEffects('Jiyan', snap);
  assert.ok(unknownList.length > 0);
  assert.ok(unknownList.every(isInvestmentEffectUnknown));
});

test('100. Repository getUnmodeledInvestmentEffects filters only UNMODELED status', () => {
  const snap = createTestSnapshot('Jiyan', { sequenceLevel: knownValue(6) });
  const unmodeledList = getUnmodeledInvestmentEffects('Jiyan', snap);
  assert.ok(unmodeledList.length > 0);
  assert.ok(unmodeledList.every(isInvestmentEffectUnmodeled));
});

test('101. getInvestmentEffectDependencies returns correct dimensions', () => {
  assert.deepEqual(getInvestmentEffectDependencies('char-base-hp'), ['CHARACTER_LEVEL']);
  assert.deepEqual(getInvestmentEffectDependencies('weapon-base-atk'), ['WEAPON_IDENTITY', 'WEAPON_LEVEL']);
  assert.deepEqual(getInvestmentEffectDependencies('weapon-refinement'), ['WEAPON_IDENTITY', 'WEAPON_REFINEMENT']);
  assert.deepEqual(getInvestmentEffectDependencies('sonata-2pc'), ['ECHO_SONATA_SET', 'ECHO_EQUIPPED_COUNT']);
});

test('102. explainInvestmentEffectResolution formats objective explanation', () => {
  const snap = createTestSnapshot('Jiyan', { characterLevel: knownValue(90) });
  const res = resolveInvestmentEffect('Jiyan', 'char-base-hp', snap);
  const explanation = explainInvestmentEffectResolution(res);
  assert.ok(explanation.includes(`RESOLVED: ${res.resolvedValue} FLAT_HP`));
  assert.ok(!explanation.includes('score'));
  assert.ok(!explanation.includes('power'));
});

// ---------------------------------------------------------------------------
// 103–105: UPSTREAM REPOSITORY & DATA INTEGRITY
// ---------------------------------------------------------------------------

test('103. Upstream rule versions remain strictly unchanged', () => {
  assert.equal(RESONATOR_INVESTMENT_RULE_VERSION, '7.13.1');
  assert.equal(INVESTMENT_EFFECT_RESOLUTION_RULE_VERSION, '7.15.1');
});

test('104. Canonical Patch 3.7 dataset remains byte-for-byte unchanged', () => {
  const datasetPath = path.join(process.cwd(), 'data/patches/3.7/patch_3_7_dataset.json');
  const fileBuffer = fs.readFileSync(datasetPath);
  const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  assert.equal(
    hash,
    '7abb7cb3b5290dee9e22cba83df4c974e2befd6639fbb7f04041adedc11a68e9',
    'Canonical patch_3_7_dataset.json must not be modified'
  );
});

test('105. assertNoProhibitedEffectKeys catches forbidden properties', () => {
  assert.doesNotThrow(() => assertNoProhibitedEffectKeys({ safeFact: 123 }));
  assert.throws(() => assertNoProhibitedEffectKeys({ characterPower: 999 }));
  assert.throws(() => assertNoProhibitedEffectKeys({ DPS: 1000 }));
  assert.throws(() => assertNoProhibitedEffectKeys({ nested: { teamScore: 50 } }));
});
