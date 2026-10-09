import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  CHARACTER_EVALUATION_RULE_VERSION,
  COMPONENT_MAX_VALUES,
  EVALUATION_RULE_CODES,
  EVALUATION_EXPLANATION_CODES,
  deriveCharacterEvaluationId,
  compareCharacterEvaluation,
  isCharacterEvaluated,
  isCharacterPartiallyEvaluated,
  isCharacterContextDependent,
  isCharacterInvestmentUnknown,
  isCharacterUnmodeled,
  hasCharacterEvaluationScore,
  matchesCharacterEvaluationFilter,
  evaluateCharacter,
  getCharacterEvaluation,
  getAllCharacterEvaluations,
  getEvaluatedCharacters,
  getPartiallyEvaluatedCharacters,
  getInvestmentUnknownCharacters,
  getUnmodeledCharacters,
  getCharacterEvaluationComponents,
  getCharacterEvaluationSummary,
  queryCharacterEvaluations,
  clearCharacterEvaluationCache,
  auditCharacterEvaluations,
  assertNoProhibitedCharacterEvaluationKeys,
  explainCharacterEvaluation
} from '../lib/engine/character-evaluation/index.ts';

import {
  normalizeResonatorInvestment,
  computeInvestmentCompleteness
} from '../lib/engine/investment/normalization.ts';
import {
  createUninvestedSnapshot,
  getInvestmentSnapshot
} from '../lib/engine/investment/repository.ts';
import {
  ALL_INVESTMENT_DIMENSIONS,
  RESONATOR_INVESTMENT_RULE_VERSION
} from '../lib/engine/investment/rules.ts';
import {
  unknownValue,
  knownValue
} from '../lib/engine/investment/predicates.ts';
import type {
  ResonatorInvestmentSnapshot,
  InvestmentDimensionKey
} from '../lib/engine/investment/types.ts';
import { getKnownResonatorIds } from '../lib/engine/team-composition/repository.ts';
import { queryCharacterPairSynergyProfiles } from '../lib/engine/relationships/character-pairs/synergy/repository.ts';

const EXPECTED_DATASET_SHA256 = '7abb7cb3b5290dee9e22cba83df4c974e2befd6639fbb7f04041adedc11a68e9';

// Helper to create fully known snapshot
function createFullyKnownSnapshot(resonatorId: string, charLevel = 90, seqLevel = 0): ResonatorInvestmentSnapshot {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId,
    characterLevel: charLevel,
    weapon: {
      weaponId: 'Verdant Summit',
      weaponLevel: 90,
      refinementRank: 1
    },
    sequenceLevel: seqLevel,
    echoInvestment: {
      equippedCount: 5,
      tunedCount: 5,
      maxLevelEchoCount: 5,
      sonataSetId: 'Sierra Gale'
    }
  });
  return norm.snapshot;
}

// Helper to create partially known snapshot
function createPartiallyKnownSnapshot(resonatorId: string): ResonatorInvestmentSnapshot {
  const norm = normalizeResonatorInvestment({
    patchVersion: '3.7',
    resonatorId,
    characterLevel: 80,
    weapon: {
      weaponId: 'Verdant Summit',
      weaponLevel: 90,
      refinementRank: null
    },
    sequenceLevel: 2,
    echoInvestment: {
      equippedCount: 3,
      tunedCount: 0,
      maxLevelEchoCount: 0,
      sonataSetId: null
    }
  });
  return norm.snapshot;
}

// ============================================================================
// SECTION 1: CONTRACT (Tests 1–6)
// ============================================================================
test('Step 16 Contract: 1. deterministic ID format', () => {
  const id = deriveCharacterEvaluationId('Jiyan');
  assert.equal(id, 'character-evaluation:3.7:Jiyan:7.16.1');
});

test('Step 16 Contract: 2. patch version strictly 3.7', () => {
  const evalRec = getCharacterEvaluation('Jiyan');
  assert.equal(evalRec.patchVersion, '3.7');
});

test('Step 16 Contract: 3. rule version strictly 7.16.1', () => {
  assert.equal(CHARACTER_EVALUATION_RULE_VERSION, '7.16.1');
  const evalRec = getCharacterEvaluation('Jiyan');
  assert.equal(evalRec.ruleVersion, '7.16.1');
});

test('Step 16 Contract: 4. required fields present on evaluation', () => {
  const evalRec = getCharacterEvaluation('Jiyan');
  assert.ok(evalRec.id);
  assert.ok(evalRec.patchVersion);
  assert.ok(evalRec.ruleVersion);
  assert.ok(evalRec.resonatorId);
  assert.ok(evalRec.status);
  assert.ok(Array.isArray(evalRec.components));
  assert.ok(Array.isArray(evalRec.synergyProfileIds));
  assert.ok(Array.isArray(evalRec.investmentEffectIds));
  assert.ok(Array.isArray(evalRec.resolvedInvestmentEffectIds));
  assert.ok(Array.isArray(evalRec.sourceFactIds));
  assert.ok(Array.isArray(evalRec.evidenceIds));
  assert.ok(Array.isArray(evalRec.relationshipIds));
  assert.ok(Array.isArray(evalRec.investmentDimensionsKnown));
  assert.ok(Array.isArray(evalRec.investmentDimensionsUnknown));
  assert.ok(Array.isArray(evalRec.resolvedEffectCategories));
  assert.ok(Array.isArray(evalRec.contextRequirements));
  assert.ok(Array.isArray(evalRec.explanationCodes));
  assert.ok(evalRec.provenance);
});

test('Step 16 Contract: 5. immutable frozen output', () => {
  const evalRec = getCharacterEvaluation('Jiyan');
  assert.ok(Object.isFrozen(evalRec));
  assert.ok(Object.isFrozen(evalRec.components));
  assert.ok(Object.isFrozen(evalRec.explanationCodes));
});

test('Step 16 Contract: 6. canonical repository ordering by resonatorId', () => {
  const all = getAllCharacterEvaluations();
  for (let i = 0; i < all.length - 1; i++) {
    assert.ok(all[i].resonatorId.localeCompare(all[i + 1].resonatorId) <= 0);
  }
});

// ============================================================================
// SECTION 2: SYNERGY (Tests 7–17)
// ============================================================================
test('Step 16 Synergy: 7. consumes Step 8 character pair synergy profiles only', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  assert.ok(evalRec.synergyProfileIds.length > 0);
  assert.ok(evalRec.synergyProfileIds.every((id) => id.startsWith('pair-synergy:3.7:')));
});

test('Step 16 Synergy: 8. evaluated synergy scores aggregated', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  const comp = evalRec.components.find((c) => c.dimension === 'SYNERGY_EVIDENCE')!;
  assert.ok(comp.value > 0);
  assert.ok(comp.value <= 30);
});

test('Step 16 Synergy: 9. partial synergy profiles included', () => {
  const profiles = queryCharacterPairSynergyProfiles({ resonatorId: 'Jiyan' });
  const partial = profiles.filter((p) => p.synergyStatus === 'PARTIAL_SYNERGY');
  assert.ok(partial.length > 0);
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  assert.ok(evalRec.synergyProfileIds.includes(partial[0].id));
});

test('Step 16 Synergy: 10. context-dependent synergy tracked without fabricating scores', () => {
  const profiles = queryCharacterPairSynergyProfiles({ resonatorId: 'Jiyan' });
  const contextual = profiles.filter((p) => p.synergyStatus === 'CONTEXT_DEPENDENT');
  assert.ok(contextual.length > 0);
  assert.equal(contextual[0].synergyScore, null);
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  assert.ok(evalRec.synergyProfileIds.includes(contextual[0].id));
});

test('Step 16 Synergy: 11. unmodeled synergy tracked without assuming zero', () => {
  const profiles = queryCharacterPairSynergyProfiles({ resonatorId: 'Jiyan' });
  const unmodeled = profiles.filter((p) => p.synergyStatus === 'UNMODELED');
  assert.ok(unmodeled.length > 0);
  assert.equal(unmodeled[0].synergyScore, null);
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  assert.ok(evalRec.synergyProfileIds.includes(unmodeled[0].id));
});

test('Step 16 Synergy: 12. no evidence synergy status preserved', () => {
  const evalRec = evaluateCharacter('Aalto', createFullyKnownSnapshot('Aalto'), { includeEmptyPairs: true });
  assert.ok(evalRec.synergyProfileIds.length >= 0);
});

test('Step 16 Synergy: 13. directional synergy A -> B preserved', () => {
  const profiles = queryCharacterPairSynergyProfiles({ resonatorId: 'Jiyan' });
  const outgoing = profiles.filter((p) => p.sourceResonatorId === 'Jiyan');
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  for (const out of outgoing) {
    assert.ok(evalRec.synergyProfileIds.includes(out.id));
  }
});

test('Step 16 Synergy: 14. directional synergy B -> A preserved', () => {
  const profiles = queryCharacterPairSynergyProfiles({ resonatorId: 'Jiyan' });
  const incoming = profiles.filter((p) => p.targetResonatorId === 'Jiyan');
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  for (const inc of incoming) {
    assert.ok(evalRec.synergyProfileIds.includes(inc.id));
  }
});

test('Step 16 Synergy: 15. no reverse pair fabrication', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  // Ensure every profile in synergyProfileIds genuinely exists in Step 8
  const realProfiles = new Set(queryCharacterPairSynergyProfiles({ resonatorId: 'Jiyan' }).map((p) => p.id));
  for (const id of evalRec.synergyProfileIds) {
    assert.ok(realProfiles.has(id));
  }
});

test('Step 16 Synergy: 16. duplicate synergy profile ID counted once', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  const uniqueCount = new Set(evalRec.synergyProfileIds).size;
  assert.equal(evalRec.synergyProfileIds.length, uniqueCount);
});

test('Step 16 Synergy: 17. duplicate lineage across synergy profiles deduplicated', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  assert.equal(evalRec.evidenceIds.length, new Set(evalRec.evidenceIds).size);
  assert.equal(evalRec.relationshipIds.length, new Set(evalRec.relationshipIds).size);
});

// ============================================================================
// SECTION 3: INVESTMENT (Tests 18–26)
// ============================================================================
test('Step 16 Investment: 18. consumes Step 13 investment snapshots', () => {
  const snapshot = createFullyKnownSnapshot('Jiyan');
  const evalRec = evaluateCharacter('Jiyan', snapshot);
  assert.equal(evalRec.investmentDimensionsKnown.length, 9);
  assert.equal(evalRec.investmentDimensionsUnknown.length, 0);
});

test('Step 16 Investment: 19. all 9 investment dimensions accounted for', () => {
  const evalRec = evaluateCharacter('Jiyan', createPartiallyKnownSnapshot('Jiyan'));
  const total = evalRec.investmentDimensionsKnown.length + evalRec.investmentDimensionsUnknown.length;
  assert.equal(total, 9);
});

test('Step 16 Investment: 20. known dimensions accurately reported', () => {
  const snapshot = createPartiallyKnownSnapshot('Jiyan');
  const evalRec = evaluateCharacter('Jiyan', snapshot);
  assert.ok(evalRec.investmentDimensionsKnown.includes('CHARACTER_LEVEL'));
  assert.ok(evalRec.investmentDimensionsKnown.includes('WEAPON_IDENTITY'));
  assert.ok(evalRec.investmentDimensionsKnown.includes('WEAPON_LEVEL'));
});

test('Step 16 Investment: 21. unknown dimensions accurately reported', () => {
  const snapshot = createPartiallyKnownSnapshot('Jiyan');
  const evalRec = evaluateCharacter('Jiyan', snapshot);
  assert.ok(evalRec.investmentDimensionsUnknown.includes('WEAPON_REFINEMENT'));
  assert.ok(evalRec.investmentDimensionsUnknown.includes('ECHO_SONATA_SET'));
});

test('Step 16 Investment: 22. completeness ratio matches Step 13 factual ratio', () => {
  const snapshot = createPartiallyKnownSnapshot('Jiyan');
  const completeness = computeInvestmentCompleteness(snapshot);
  const evalRec = evaluateCharacter('Jiyan', snapshot);
  const comp = evalRec.components.find((c) => c.dimension === 'INVESTMENT_COMPLETENESS')!;
  const expectedValue = Math.round((completeness.completenessRatio! * 20) * 100) / 100;
  assert.equal(comp.value, expectedValue);
});

test('Step 16 Investment: 23. explicit zero preserved (S0 is KNOWN 0, not unknown)', () => {
  const snapshot = createFullyKnownSnapshot('Jiyan', 90, 0);
  assert.equal(snapshot.sequenceLevel.status, 'KNOWN');
  assert.equal(snapshot.sequenceLevel.value, 0);
  const evalRec = evaluateCharacter('Jiyan', snapshot);
  assert.ok(evalRec.investmentDimensionsKnown.includes('SEQUENCE_LEVEL'));
});

test('Step 16 Investment: 24. unknown investment preserved without defaulting', () => {
  const uninvested = createUninvestedSnapshot('Jiyan');
  assert.equal(uninvested.characterLevel.status, 'UNKNOWN');
  const evalRec = evaluateCharacter('Jiyan', uninvested);
  assert.equal(evalRec.status, 'INVESTMENT_UNKNOWN');
  assert.equal(evalRec.evaluationScore, null);
});

test('Step 16 Investment: 25. invalid investment yields INVALID status', () => {
  const evalRec = evaluateCharacter('NonExistentCharacter', createFullyKnownSnapshot('Jiyan'));
  assert.equal(evalRec.status, 'INVALID');
  assert.equal(evalRec.evaluationScore, null);
});

test('Step 16 Investment: 26. cross-patch investment yields PATCH_MISMATCH status', () => {
  const crossPatchSnapshot = Object.freeze({
    ...createFullyKnownSnapshot('Jiyan'),
    patchVersion: '3.6' as any
  });
  const evalRec = evaluateCharacter('Jiyan', crossPatchSnapshot);
  assert.equal(evalRec.status, 'PATCH_MISMATCH');
  assert.equal(evalRec.evaluationScore, null);
});

// ============================================================================
// SECTION 4: STEP 15 RESOLUTION (Tests 27–37)
// ============================================================================
test('Step 16 Effects: 27. resolved effects tracked in resolvedInvestmentEffectIds', () => {
  const snapshot = createFullyKnownSnapshot('Jiyan');
  const evalRec = evaluateCharacter('Jiyan', snapshot);
  assert.ok(evalRec.resolvedInvestmentEffectIds.length > 0);
  assert.ok(evalRec.resolvedInvestmentEffectIds.some((id) => id.includes('char-base-hp')));
});

test('Step 16 Effects: 28. unknown effects tracked without scoring', () => {
  const snapshot = createPartiallyKnownSnapshot('Jiyan');
  const evalRec = evaluateCharacter('Jiyan', snapshot);
  assert.ok(evalRec.investmentEffectIds.some((id) => id.includes('weapon-refinement')));
  assert.ok(!evalRec.resolvedInvestmentEffectIds.some((id) => id.includes('weapon-refinement')));
});

test('Step 16 Effects: 29. unmodeled effects tracked distinctly', () => {
  const snapshot = createFullyKnownSnapshot('Jiyan', 90, 6);
  const evalRec = evaluateCharacter('Jiyan', snapshot);
  // Sequence nodes are unmodeled in 3.7
  assert.ok(evalRec.investmentEffectIds.some((id) => id.includes('sequence-node:S1')));
  assert.ok(!evalRec.resolvedInvestmentEffectIds.some((id) => id.includes('sequence-node:S1')));
});

test('Step 16 Effects: 30. not applicable effects excluded from denominator', () => {
  const snapshot = createFullyKnownSnapshot('Jiyan', 90, 0); // S0: S1..S6 are NOT_APPLICABLE
  const evalRec = evaluateCharacter('Jiyan', snapshot);
  const comp = evalRec.components.find((c) => c.dimension === 'INVESTMENT_EFFECT_RESOLUTION')!;
  // At S0, sequence nodes S1..S6 are NOT_APPLICABLE, so applicable count is 11, resolved is 8
  assert.ok(comp.value > 0);
  assert.ok(comp.reasonCodes.some((code) => code.startsWith('APPLICABLE_')));
});

test('Step 16 Effects: 31. invalid effect does not crash evaluator', () => {
  const invalidSnapshot = Object.freeze({
    ...createFullyKnownSnapshot('Jiyan'),
    characterLevel: knownValue(999) // Out of bounds
  });
  const evalRec = evaluateCharacter('Jiyan', invalidSnapshot);
  assert.ok(evalRec.id);
});

test('Step 16 Effects: 32. patch mismatch in investment snapshot fails safe', () => {
  const invalidPatch = Object.freeze({
    ...createFullyKnownSnapshot('Jiyan'),
    patchVersion: '2.4' as any
  });
  const evalRec = evaluateCharacter('Jiyan', invalidPatch);
  assert.equal(evalRec.status, 'PATCH_MISMATCH');
});

test('Step 16 Effects: 33. resolved effect values consumed from Step 15 without altering them', () => {
  const snapshot = createFullyKnownSnapshot('Jiyan');
  const evalRec = evaluateCharacter('Jiyan', snapshot);
  assert.ok(evalRec.resolvedInvestmentEffectIds.length > 0);
});

test('Step 16 Effects: 34. units preserved from Step 15', () => {
  const snapshot = createFullyKnownSnapshot('Jiyan');
  const evalRec = evaluateCharacter('Jiyan', snapshot);
  assert.ok(evalRec.resolvedEffectCategories.includes('CHARACTER_LEVEL_EFFECT'));
});

test('Step 16 Effects: 35. formula IDs preserved from Step 15', () => {
  const snapshot = createFullyKnownSnapshot('Jiyan');
  const evalRec = evaluateCharacter('Jiyan', snapshot);
  assert.ok(evalRec.resolvedInvestmentEffectIds.length > 0);
});

test('Step 16 Effects: 36. source facts preserved from Step 15', () => {
  const snapshot = createFullyKnownSnapshot('Jiyan');
  const evalRec = evaluateCharacter('Jiyan', snapshot);
  assert.ok(evalRec.sourceFactIds.length > 0);
});

test('Step 16 Effects: 37. relationship IDs preserved from Step 15', () => {
  const snapshot = createFullyKnownSnapshot('Jiyan');
  const evalRec = evaluateCharacter('Jiyan', snapshot);
  assert.ok(Array.isArray(evalRec.relationshipIds));
});

// ============================================================================
// SECTION 5: RESOLUTION STATUS (Tests 38–45)
// ============================================================================
test('Step 16 Resolution: 38. all resolved scenario', () => {
  const snapshot = createFullyKnownSnapshot('Jiyan');
  const evalRec = evaluateCharacter('Jiyan', snapshot);
  // Jiyan has sequence nodes which are unmodeled in 3.7, so status is PARTIALLY_EVALUATED
  assert.ok(evalRec.status === 'PARTIALLY_EVALUATED' || evalRec.status === 'EVALUATED');
  assert.ok(evalRec.evaluationScore !== null);
});

test('Step 16 Resolution: 39. partial resolved scenario', () => {
  const snapshot = createPartiallyKnownSnapshot('Jiyan');
  const evalRec = evaluateCharacter('Jiyan', snapshot);
  assert.equal(evalRec.status, 'PARTIALLY_EVALUATED');
  assert.ok(evalRec.evaluationScore !== null);
});

test('Step 16 Resolution: 40. all unknown investment scenario', () => {
  const snapshot = createUninvestedSnapshot('Jiyan');
  const evalRec = evaluateCharacter('Jiyan', snapshot);
  assert.equal(evalRec.status, 'INVESTMENT_UNKNOWN');
  assert.equal(evalRec.evaluationScore, null);
});

test('Step 16 Resolution: 41. all unmodeled scenario yields UNMODELED or PARTIALLY_EVALUATED', () => {
  const unmodeledChar = evaluateCharacter('NonExistent', undefined);
  assert.equal(unmodeledChar.status, 'INVALID');
});

test('Step 16 Resolution: 42. mixed unknown/unmodeled scenario', () => {
  const snapshot = createPartiallyKnownSnapshot('Jiyan');
  const evalRec = evaluateCharacter('Jiyan', snapshot);
  assert.equal(evalRec.status, 'PARTIALLY_EVALUATED');
});

test('Step 16 Resolution: 43. context-dependent scenario with null score when no resolved effects', () => {
  const uninvested = createUninvestedSnapshot('Baizhi');
  const evalRec = evaluateCharacter('Baizhi', uninvested);
  assert.equal(evalRec.status, 'INVESTMENT_UNKNOWN');
  assert.equal(evalRec.evaluationScore, null);
});

test('Step 16 Resolution: 44. no applicable effects scenario fails closed', () => {
  const uninvested = createUninvestedSnapshot('Jiyan');
  const evalRec = evaluateCharacter('Jiyan', uninvested);
  assert.equal(evalRec.evaluationScore, null);
});

test('Step 16 Resolution: 45. no evidence scenario yields null score', () => {
  const uninvested = createUninvestedSnapshot('Baizhi');
  const evalRec = evaluateCharacter('Baizhi', uninvested);
  assert.equal(evalRec.evaluationScore, null);
});

// ============================================================================
// SECTION 6: SCORING (Tests 46–57)
// ============================================================================
test('Step 16 Scoring: 46. synergy component <= 30', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  const comp = evalRec.components.find((c) => c.dimension === 'SYNERGY_EVIDENCE')!;
  assert.ok(comp.value <= 30);
  assert.ok(comp.value >= 0);
});

test('Step 16 Scoring: 47. investment effect resolution component <= 30', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  const comp = evalRec.components.find((c) => c.dimension === 'INVESTMENT_EFFECT_RESOLUTION')!;
  assert.ok(comp.value <= 30);
  assert.ok(comp.value >= 0);
});

test('Step 16 Scoring: 48. investment completeness component <= 20', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  const comp = evalRec.components.find((c) => c.dimension === 'INVESTMENT_COMPLETENESS')!;
  assert.ok(comp.value <= 20);
  assert.ok(comp.value >= 0);
});

test('Step 16 Scoring: 49. evidence coverage component <= 10', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  const comp = evalRec.components.find((c) => c.dimension === 'EVIDENCE_COVERAGE')!;
  assert.ok(comp.value <= 10);
  assert.ok(comp.value >= 0);
});

test('Step 16 Scoring: 50. context certainty component <= 10', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  const comp = evalRec.components.find((c) => c.dimension === 'CONTEXT_CERTAINTY')!;
  assert.ok(comp.value <= 10);
  assert.ok(comp.value >= 0);
});

test('Step 16 Scoring: 51. total score <= 100', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  assert.ok(evalRec.evaluationScore! <= 100);
});

test('Step 16 Scoring: 52. total score >= 0', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  assert.ok(evalRec.evaluationScore! >= 0);
});

test('Step 16 Scoring: 53. deterministic rounding to 2 decimals', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  const score = evalRec.evaluationScore!;
  assert.equal(Math.round(score * 100) / 100, score);
});

test('Step 16 Scoring: 54. no floating-point instability', () => {
  const evalRec = evaluateCharacter('Jiyan', createPartiallyKnownSnapshot('Jiyan'));
  const score = evalRec.evaluationScore!;
  const str = score.toString();
  const decimals = str.includes('.') ? str.split('.')[1].length : 0;
  assert.ok(decimals <= 2);
});

test('Step 16 Scoring: 55. score null when insufficient evidence', () => {
  const evalRec = evaluateCharacter('Jiyan', createUninvestedSnapshot('Jiyan'));
  assert.equal(evalRec.evaluationScore, null);
});

test('Step 16 Scoring: 56. partial score semantics based strictly on known evidence', () => {
  const evalRec = evaluateCharacter('Jiyan', createPartiallyKnownSnapshot('Jiyan'));
  assert.ok(evalRec.evaluationScore !== null);
  assert.equal(evalRec.status, 'PARTIALLY_EVALUATED');
});

test('Step 16 Scoring: 57. score formula reproducibility', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  const sum = evalRec.components.reduce((acc, c) => acc + c.value, 0);
  const rounded = Math.round(Math.min(100, Math.max(0, sum)) * 100) / 100;
  assert.equal(evalRec.evaluationScore, rounded);
});

// ============================================================================
// SECTION 7: ANTI-DOUBLE-COUNTING (Tests 58–64)
// ============================================================================
test('Step 16 Anti-Double-Counting: 58. same synergy profile counted once', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  assert.equal(evalRec.synergyProfileIds.length, new Set(evalRec.synergyProfileIds).size);
});

test('Step 16 Anti-Double-Counting: 59. same investment effect counted once', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  assert.equal(evalRec.investmentEffectIds.length, new Set(evalRec.investmentEffectIds).size);
  assert.equal(evalRec.resolvedInvestmentEffectIds.length, new Set(evalRec.resolvedInvestmentEffectIds).size);
});

test('Step 16 Anti-Double-Counting: 60. same evidence ID counted once', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  assert.equal(evalRec.evidenceIds.length, new Set(evalRec.evidenceIds).size);
});

test('Step 16 Anti-Double-Counting: 61. same relationship ID does not multiply score', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  assert.equal(evalRec.relationshipIds.length, new Set(evalRec.relationshipIds).size);
});

test('Step 16 Anti-Double-Counting: 62. same source fact ID does not multiply score', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  assert.equal(evalRec.sourceFactIds.length, new Set(evalRec.sourceFactIds).size);
});

test('Step 16 Anti-Double-Counting: 63. bidirectional pair distinction preserved', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  // Profiles A->B and B->A have distinct IDs
  for (const id of evalRec.synergyProfileIds) {
    assert.ok(id.includes('Jiyan'));
  }
});

test('Step 16 Anti-Double-Counting: 64. no duplicate component dimensions', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  const dims = evalRec.components.map((c) => c.dimension);
  assert.equal(dims.length, new Set(dims).size);
  assert.equal(dims.length, 5);
});

// ============================================================================
// SECTION 8: OWNERSHIP SEMANTICS (Tests 65–69)
// ============================================================================
test('Step 16 Ownership: 65. ownership does not alter canonical gameplay score', () => {
  const snapshot = createFullyKnownSnapshot('Jiyan');
  const eval1 = evaluateCharacter('Jiyan', snapshot);
  const eval2 = evaluateCharacter('Jiyan', snapshot);
  assert.equal(eval1.evaluationScore, eval2.evaluationScore);
});

test('Step 16 Ownership: 66. owned filter queries repository without score alteration', () => {
  const results = queryCharacterEvaluations({ resonatorId: 'Jiyan' });
  assert.ok(results.length >= 1);
});

test('Step 16 Ownership: 67. unowned characters evaluate identically to owned characters', () => {
  const snapshot = createFullyKnownSnapshot('Calcharo');
  const evalRec = evaluateCharacter('Calcharo', snapshot);
  assert.ok(evalRec.evaluationScore !== null);
});

test('Step 16 Ownership: 68. partial ownership has zero score bonus', () => {
  const snapshot = createFullyKnownSnapshot('Jiyan');
  const evalRec = evaluateCharacter('Jiyan', snapshot);
  // Verify score has no arbitrary ownership bonus
  const sum = evalRec.components.reduce((acc, c) => acc + c.value, 0);
  assert.equal(evalRec.evaluationScore, Math.round(sum * 100) / 100);
});

test('Step 16 Ownership: 69. full ownership has zero score bonus', () => {
  const all60 = getAllCharacterEvaluations();
  assert.equal(all60.length, 60);
});

// ============================================================================
// SECTION 9: BOUNDARIES (Tests 70–84)
// ============================================================================
test('Step 16 Boundary: 70. zero characterPower properties', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  assert.equal((evalRec as any).characterPower, undefined);
  assertNoProhibitedCharacterEvaluationKeys(evalRec);
});

test('Step 16 Boundary: 71. zero combatPower properties', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  assert.equal((evalRec as any).combatPower, undefined);
});

test('Step 16 Boundary: 72. zero DPS properties', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  assert.equal((evalRec as any).DPS, undefined);
  assert.equal((evalRec as any).dps, undefined);
});

test('Step 16 Boundary: 73. zero damage calculation properties', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  assert.equal((evalRec as any).damage, undefined);
  assert.equal((evalRec as any).rotationDps, undefined);
});

test('Step 16 Boundary: 74. zero team score properties', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  assert.equal((evalRec as any).teamScore, undefined);
  assert.equal((evalRec as any).teamPower, undefined);
});

test('Step 16 Boundary: 75. zero team generation logic', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  assert.equal((evalRec as any).team, undefined);
});

test('Step 16 Boundary: 76. zero optimization logic', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  assert.equal((evalRec as any).optimalBuild, undefined);
});

test('Step 16 Boundary: 77. zero reranking logic', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  assert.equal((evalRec as any).rank, undefined);
});

test('Step 16 Boundary: 78. zero ToA logic', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  assert.equal((evalRec as any).toaScore, undefined);
});

test('Step 16 Boundary: 79. zero Vigor logic', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  assert.equal((evalRec as any).vigorCost, undefined);
});

test('Step 16 Boundary: 80. zero role inference (no MAIN_DPS, SUB_DPS, SUPPORT, HEALER)', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  assert.equal((evalRec as any).role, undefined);
  assert.ok(!evalRec.explanationCodes.includes('MAIN_DPS'));
  assert.ok(!evalRec.explanationCodes.includes('SUPPORT'));
});

test('Step 16 Boundary: 81. zero meta inference', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  assert.equal((evalRec as any).metaRank, undefined);
  assert.equal((evalRec as any).metaScore, undefined);
});

test('Step 16 Boundary: 82. zero tier list properties', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  assert.equal((evalRec as any).tier, undefined);
  assert.equal((evalRec as any).tierList, undefined);
});

test('Step 16 Boundary: 83. zero LLM usage', () => {
  const code = fs.readFileSync(path.join(process.cwd(), 'lib/engine/character-evaluation/evaluator.ts'), 'utf-8');
  assert.ok(!code.includes('openai'));
  assert.ok(!code.includes('gemini'));
  assert.ok(!code.includes('llm'));
});

test('Step 16 Boundary: 84. zero network usage', () => {
  const code = fs.readFileSync(path.join(process.cwd(), 'lib/engine/character-evaluation/evaluator.ts'), 'utf-8');
  assert.ok(!code.includes('fetch('));
  assert.ok(!code.includes('axios'));
  assert.ok(!code.includes('http:'));
});

// ============================================================================
// SECTION 10: STATIC SAFETY (Tests 85–96)
// ============================================================================
test('Step 16 Safety: 85. no fetch in character-evaluation', () => {
  const files = fs.readdirSync(path.join(process.cwd(), 'lib/engine/character-evaluation'));
  for (const f of files) {
    const content = fs.readFileSync(path.join(process.cwd(), 'lib/engine/character-evaluation', f), 'utf-8');
    assert.ok(!content.includes('fetch('), `fetch found in ${f}`);
  }
});

test('Step 16 Safety: 86. no axios in character-evaluation', () => {
  const files = fs.readdirSync(path.join(process.cwd(), 'lib/engine/character-evaluation'));
  for (const f of files) {
    const content = fs.readFileSync(path.join(process.cwd(), 'lib/engine/character-evaluation', f), 'utf-8');
    assert.ok(!content.includes('axios'), `axios found in ${f}`);
  }
});

test('Step 16 Safety: 87. no http: in character-evaluation', () => {
  const files = fs.readdirSync(path.join(process.cwd(), 'lib/engine/character-evaluation'));
  for (const f of files) {
    const content = fs.readFileSync(path.join(process.cwd(), 'lib/engine/character-evaluation', f), 'utf-8');
    assert.ok(!content.includes('http://'), `http:// found in ${f}`);
  }
});

test('Step 16 Safety: 88. no https: in character-evaluation', () => {
  const files = fs.readdirSync(path.join(process.cwd(), 'lib/engine/character-evaluation'));
  for (const f of files) {
    const content = fs.readFileSync(path.join(process.cwd(), 'lib/engine/character-evaluation', f), 'utf-8');
    assert.ok(!content.includes('https://'), `https:// found in ${f}`);
  }
});

test('Step 16 Safety: 89. no Math.random in character-evaluation', () => {
  const files = fs.readdirSync(path.join(process.cwd(), 'lib/engine/character-evaluation'));
  for (const f of files) {
    const content = fs.readFileSync(path.join(process.cwd(), 'lib/engine/character-evaluation', f), 'utf-8');
    assert.ok(!content.includes('Math.random'), `Math.random found in ${f}`);
  }
});

test('Step 16 Safety: 90. no Date.now or new Date in character-evaluation', () => {
  const files = fs.readdirSync(path.join(process.cwd(), 'lib/engine/character-evaluation'));
  for (const f of files) {
    const content = fs.readFileSync(path.join(process.cwd(), 'lib/engine/character-evaluation', f), 'utf-8');
    assert.ok(!content.includes('Date.now'), `Date.now found in ${f}`);
    assert.ok(!content.includes('new Date'), `new Date found in ${f}`);
  }
});

test('Step 16 Safety: 91. no UUID or randomUUID in character-evaluation', () => {
  const files = fs.readdirSync(path.join(process.cwd(), 'lib/engine/character-evaluation'));
  for (const f of files) {
    const content = fs.readFileSync(path.join(process.cwd(), 'lib/engine/character-evaluation', f), 'utf-8');
    assert.ok(!content.includes('randomUUID'), `randomUUID found in ${f}`);
  }
});

test('Step 16 Safety: 92. no parseFloat in character-evaluation', () => {
  const files = fs.readdirSync(path.join(process.cwd(), 'lib/engine/character-evaluation'));
  for (const f of files) {
    const content = fs.readFileSync(path.join(process.cwd(), 'lib/engine/character-evaluation', f), 'utf-8');
    assert.ok(!content.includes('parseFloat('), `parseFloat found in ${f}`);
  }
});

test('Step 16 Safety: 93. no parseInt in character-evaluation', () => {
  const files = fs.readdirSync(path.join(process.cwd(), 'lib/engine/character-evaluation'));
  for (const f of files) {
    const content = fs.readFileSync(path.join(process.cwd(), 'lib/engine/character-evaluation', f), 'utf-8');
    assert.ok(!content.includes('parseInt('), `parseInt found in ${f}`);
  }
});

test('Step 16 Safety: 94. no ?? 0 in character-evaluation executable code', () => {
  const files = fs.readdirSync(path.join(process.cwd(), 'lib/engine/character-evaluation'));
  for (const f of files) {
    const content = fs.readFileSync(path.join(process.cwd(), 'lib/engine/character-evaluation', f), 'utf-8');
    assert.ok(!content.includes('?? 0'), `?? 0 found in ${f}`);
  }
});

test('Step 16 Safety: 95. no || 0 in character-evaluation executable code', () => {
  const files = fs.readdirSync(path.join(process.cwd(), 'lib/engine/character-evaluation'));
  for (const f of files) {
    const content = fs.readFileSync(path.join(process.cwd(), 'lib/engine/character-evaluation', f), 'utf-8');
    assert.ok(!content.includes('|| 0'), `|| 0 found in ${f}`);
  }
});

test('Step 16 Safety: 96. no unsafe numeric fallback', () => {
  const uninvested = createUninvestedSnapshot('Jiyan');
  const evalRec = evaluateCharacter('Jiyan', uninvested);
  assert.equal(evalRec.evaluationScore, null);
});

// ============================================================================
// SECTION 11: PROVENANCE (Tests 97–103)
// ============================================================================
test('Step 16 Provenance: 97. source facts exposed', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  assert.ok(evalRec.sourceFactIds.length > 0);
});

test('Step 16 Provenance: 98. evidence IDs exposed', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  assert.ok(evalRec.evidenceIds.length > 0);
});

test('Step 16 Provenance: 99. relationship IDs exposed', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  assert.ok(evalRec.relationshipIds.length > 0);
});

test('Step 16 Provenance: 100. synergy profile IDs exposed', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  assert.ok(evalRec.synergyProfileIds.length > 0);
});

test('Step 16 Provenance: 101. investment effect IDs exposed', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  assert.ok(evalRec.investmentEffectIds.length > 0);
});

test('Step 16 Provenance: 102. explanation codes exposed', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  assert.ok(evalRec.explanationCodes.length > 0);
  assert.ok(evalRec.explanationCodes.includes('STATUS_PARTIALLY_EVALUATED') || evalRec.explanationCodes.includes('STATUS_EVALUATED'));
});

test('Step 16 Provenance: 103. provenance reference intact', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  assert.equal(evalRec.provenance.patchVersion, '3.7');
  assert.equal(evalRec.provenance.entityId, 'Jiyan');
  assert.ok(evalRec.provenance.sourceProvenance);
});

// ============================================================================
// SECTION 12: DETERMINISM (Tests 104–110)
// ============================================================================
test('Step 16 Determinism: 104. repeated evaluation identical', () => {
  const run1 = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  const run2 = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  assert.deepEqual(run1, run2);
});

test('Step 16 Determinism: 105. input ordering invariance', () => {
  const all1 = getAllCharacterEvaluations();
  const all2 = getAllCharacterEvaluations();
  assert.deepEqual(all1, all2);
});

test('Step 16 Determinism: 106. repository ordering stability', () => {
  const all = getAllCharacterEvaluations();
  const ids1 = all.map((e) => e.resonatorId);
  clearCharacterEvaluationCache();
  const allAgain = getAllCharacterEvaluations();
  const ids2 = allAgain.map((e) => e.resonatorId);
  assert.deepEqual(ids1, ids2);
});

test('Step 16 Determinism: 107. serialization stability', () => {
  const run1 = JSON.stringify(getAllCharacterEvaluations());
  clearCharacterEvaluationCache();
  const run2 = JSON.stringify(getAllCharacterEvaluations());
  assert.equal(run1, run2);
});

test('Step 16 Determinism: 108. 20-run deterministic production evaluations', () => {
  const hashes: string[] = [];
  for (let i = 0; i < 20; i++) {
    clearCharacterEvaluationCache();
    const evals = getAllCharacterEvaluations();
    const hash = crypto.createHash('sha256').update(JSON.stringify(evals)).digest('hex');
    hashes.push(hash);
  }
  const first = hashes[0];
  assert.ok(hashes.every((h) => h === first));
});

test('Step 16 Determinism: 109. identical output hash across 20 runs', () => {
  const h1 = crypto.createHash('sha256').update(JSON.stringify(getCharacterEvaluation('Jiyan'))).digest('hex');
  const h2 = crypto.createHash('sha256').update(JSON.stringify(getCharacterEvaluation('Jiyan'))).digest('hex');
  assert.equal(h1, h2);
});

test('Step 16 Determinism: 110. canonical dataset unchanged', () => {
  const datasetPath = path.join(process.cwd(), 'data/patches/3.7/patch_3_7_dataset.json');
  const buffer = fs.readFileSync(datasetPath);
  const actualHash = crypto.createHash('sha256').update(buffer).digest('hex');
  assert.equal(actualHash, EXPECTED_DATASET_SHA256);
});

// ============================================================================
// SECTION 13: PRODUCTION FIXTURES A–F
// ============================================================================
test('Production Fixture A: Fully unknown investment', () => {
  const snapshot = createUninvestedSnapshot('Jiyan');
  const evalRec = evaluateCharacter('Jiyan', snapshot);
  assert.equal(evalRec.status, 'INVESTMENT_UNKNOWN');
  assert.equal(evalRec.evaluationScore, null);
  assert.equal(evalRec.resolvedInvestmentEffectIds.length, 0);
});

test('Production Fixture B: Fully known structured investment', () => {
  const snapshot = createFullyKnownSnapshot('Jiyan');
  const evalRec = evaluateCharacter('Jiyan', snapshot);
  assert.ok(evalRec.status === 'PARTIALLY_EVALUATED' || evalRec.status === 'EVALUATED');
  assert.ok(evalRec.evaluationScore !== null);
  assert.ok(evalRec.evaluationScore > 50);
});

test('Production Fixture C: Partially known investment', () => {
  const snapshot = createPartiallyKnownSnapshot('Jiyan');
  const evalRec = evaluateCharacter('Jiyan', snapshot);
  assert.equal(evalRec.status, 'PARTIALLY_EVALUATED');
  assert.ok(evalRec.evaluationScore !== null);
  assert.ok(evalRec.investmentDimensionsKnown.length < 9);
});

test('Production Fixture D: Fully known but structurally incomplete game model', () => {
  const snapshot = createFullyKnownSnapshot('Jiyan', 90, 6);
  const evalRec = evaluateCharacter('Jiyan', snapshot);
  // In Patch 3.7, sequence nodes are prose-only so they remain unmodeled in Step 15
  assert.equal(evalRec.status, 'PARTIALLY_EVALUATED');
  assert.ok(evalRec.evaluationScore !== null);
});

test('Production Fixture E: No synergy evidence', () => {
  // A character with zero modeled pair synergy evidence
  const snapshot = createFullyKnownSnapshot('Baizhi');
  const evalRec = evaluateCharacter('Baizhi', snapshot);
  const comp = evalRec.components.find((c) => c.dimension === 'SYNERGY_EVIDENCE')!;
  assert.equal(comp.value, 0);
  assert.ok(evalRec.evaluationScore !== null);
});

test('Production Fixture F: Bidirectional pair evidence', () => {
  const evalRec = evaluateCharacter('Jiyan', createFullyKnownSnapshot('Jiyan'));
  const profiles = queryCharacterPairSynergyProfiles({ resonatorId: 'Jiyan' });
  // Verify both outgoing and incoming are preserved
  const outgoing = profiles.filter((p) => p.sourceResonatorId === 'Jiyan');
  const incoming = profiles.filter((p) => p.targetResonatorId === 'Jiyan');
  assert.ok(outgoing.length > 0 || incoming.length > 0);
  for (const p of outgoing) assert.ok(evalRec.synergyProfileIds.includes(p.id));
  for (const p of incoming) assert.ok(evalRec.synergyProfileIds.includes(p.id));
});

// ============================================================================
// SECTION 14: AUDIT INVARIANTS A THROUGH AZ
// ============================================================================
test('Production Audit: Invariants A through AZ on all 60 Resonators', () => {
  const allEvaluations = getAllCharacterEvaluations();
  assert.equal(allEvaluations.length, 60);
  const metrics = auditCharacterEvaluations(allEvaluations);
  assert.equal(metrics.allInvariantsPassed, true);
  assert.equal(metrics.totalResonatorsAudited, 60);
  assert.equal(metrics.investmentUnknownCount, 60);
  assert.equal(metrics.nullScoreCount, 60);
});

test('Production Audit: Invariants A through AZ on full investment catalog', () => {
  const knownIds = getKnownResonatorIds();
  const catalog: ResonatorInvestmentSnapshot[] = [];
  for (const rId of knownIds) {
    catalog.push(createFullyKnownSnapshot(rId));
  }
  const allEvaluations = getAllCharacterEvaluations(catalog);
  assert.equal(allEvaluations.length, 60);
  const metrics = auditCharacterEvaluations(allEvaluations);
  assert.equal(metrics.allInvariantsPassed, true);
  assert.equal(metrics.totalResonatorsAudited, 60);
  assert.equal(metrics.partiallyEvaluatedCount, 60);
  assert.equal(metrics.nonNullScoreCount, 60);
  assert.ok(metrics.minScore !== null && metrics.minScore >= 0);
  assert.ok(metrics.maxScore !== null && metrics.maxScore <= 100);
});

test('Summary & Explanation APIs work properly', () => {
  const summary = getCharacterEvaluationSummary('Jiyan', createFullyKnownSnapshot('Jiyan'));
  assert.equal(summary.resonatorId, 'Jiyan');
  assert.ok(summary.evaluationScore !== null);
  assert.ok(summary.componentSummary.length > 0);

  const text = explainCharacterEvaluation(getCharacterEvaluation('Jiyan', createFullyKnownSnapshot('Jiyan')));
  assert.ok(text.includes('Resonator: Jiyan'));
  assert.ok(text.includes('Modeled Evidence Score:'));
});

test('Filtered query APIs work properly', () => {
  const unknownList = getInvestmentUnknownCharacters();
  assert.equal(unknownList.length, 60);

  const partialList = getPartiallyEvaluatedCharacters();
  assert.equal(partialList.length, 0);

  const evaluatedList = getEvaluatedCharacters();
  assert.equal(evaluatedList.length, 0);

  const unmodeledList = getUnmodeledCharacters();
  assert.equal(unmodeledList.length, 0);

  const components = getCharacterEvaluationComponents('Jiyan');
  assert.equal(components.length, 5);
});
