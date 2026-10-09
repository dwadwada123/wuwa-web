/**
 * Wuthering Waves Character Build Evaluation Contract Tests
 * Phase 7 Step 20: Deterministic Character Build Evaluation Contract
 *
 * Verifies all Contract Conformance, Upstream Consumption, Equipment Compatibility,
 * Echo Loadout Alignment, Build Completeness, Immutability, Total Deterministic Ordering,
 * Strict Boundary Separation, Repository APIs, Explanations, Error Safety,
 * Production Auditing, and 20-run Determinism across all 60 Resonators.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  CHARACTER_BUILD_EVALUATION_RULE_VERSION,
  CANONICAL_PATCH_VERSION,
  REQUIRED_STEP19_RULE_VERSION,
  REQUIRED_STEP13_RULE_VERSION,
  CANONICAL_RESONATOR_COUNT,
  CANONICAL_WEAPON_COUNT,
  CANONICAL_SONATA_COUNT,
  CANONICAL_RESONATOR_METADATA,
  CANONICAL_WEAPON_METADATA,
  CANONICAL_SONATA_METADATA,
  getCanonicalSonataMetadata,
  BUILD_EVALUATION_EXPLANATION_CODES,
  PROHIBITED_BUILD_EVALUATION_KEYS,
  OFFLINE_DETERMINISTIC_AUDIT_STAMP
} from '../lib/engine/character-build-evaluation/rules.ts';
import {
  deriveCharacterBuildEvaluationId,
  compareCharacterBuildEvaluations,
  matchesCharacterBuildEvaluationFilter
} from '../lib/engine/character-build-evaluation/predicates.ts';
import {
  evaluateCharacterBuild,
  buildCharacterBuildEvaluations
} from '../lib/engine/character-build-evaluation/builder.ts';
import {
  getCharacterBuildEvaluationResult,
  getAllCharacterBuildEvaluations,
  getCharacterBuildEvaluationByCharacterId,
  queryCharacterBuildEvaluations,
  clearCharacterBuildEvaluationCache
} from '../lib/engine/character-build-evaluation/repository.ts';
import {
  normalizeProhibitedKey,
  assertNoProhibitedBuildEvaluationKeys,
  auditSingleCharacterBuildEvaluation,
  auditCharacterBuildEvaluations,
  runProductionCharacterBuildEvaluationAudit
} from '../lib/engine/character-build-evaluation/audit.ts';
import { formatCharacterBuildExplanation } from '../lib/engine/character-build-evaluation/index.ts';

import { getCharacterDecisionContextResult } from '../lib/engine/character-decision-context/repository.ts';
import { createUninvestedSnapshot } from '../lib/engine/investment/repository.ts';
import { knownValue, unknownValue } from '../lib/engine/investment/predicates.ts';
import type {
  CharacterDecisionContext,
  ResonatorInvestmentSnapshot
} from '../lib/engine/character-build-evaluation/types.ts';

// ============================================================================
// SUITE 1: CONTRACT CONFORMANCE & CONSTANTS
// ============================================================================

test('Step 20 Suite 1.1: Rule version is strictly 7.20.1', () => {
  assert.equal(CHARACTER_BUILD_EVALUATION_RULE_VERSION, '7.20.1');
});

test('Step 20 Suite 1.2: Patch version is strictly 3.7', () => {
  assert.equal(CANONICAL_PATCH_VERSION, '3.7');
});

test('Step 20 Suite 1.3: Required upstream versions are 7.19.1 and 7.13.1', () => {
  assert.equal(REQUIRED_STEP19_RULE_VERSION, '7.19.1');
  assert.equal(REQUIRED_STEP13_RULE_VERSION, '7.13.1');
});

test('Step 20 Suite 1.4: Canonical entity counts match 60 Resonators, 66 Weapons, 12 Sonatas', () => {
  assert.equal(CANONICAL_RESONATOR_COUNT, 60);
  assert.equal(CANONICAL_WEAPON_COUNT, 66);
  assert.equal(CANONICAL_SONATA_COUNT, 12);
  assert.equal(Object.keys(CANONICAL_RESONATOR_METADATA).length, 60);
  assert.equal(Object.keys(CANONICAL_WEAPON_METADATA).length, 66);
  assert.equal(Object.keys(CANONICAL_SONATA_METADATA).length, 12);
});

test('Step 20 Suite 1.5: Deterministic ID derivation format', () => {
  const id = deriveCharacterBuildEvaluationId('Yangyang', '3.7', '7.20.1');
  assert.equal(id, 'char-build:3.7:Yangyang:7.20.1');
});

test('Step 20 Suite 1.6: Deterministic ID derivation validation', () => {
  assert.throws(() => deriveCharacterBuildEvaluationId(''), /resonatorId must be a non-empty string/);
  assert.throws(() => deriveCharacterBuildEvaluationId('Yangyang', ''), /patchVersion must be a non-empty string/);
  assert.throws(() => deriveCharacterBuildEvaluationId('Yangyang', '3.7', ''), /ruleVersion must be a non-empty string/);
});

// ============================================================================
// SUITE 2: UPSTREAM STEP 19 CONSUMPTION & METADATA BINDING
// ============================================================================

test('Step 20 Suite 2.1: Consumes canonical Step 19 decision contexts', () => {
  const step19Contexts = getCharacterDecisionContextResult().contexts;
  assert.equal(step19Contexts.length, 60);

  const yangyangCtx = step19Contexts.find((c) => c.characterId === 'Yangyang')!;
  assert.ok(yangyangCtx);

  const evalRec = evaluateCharacterBuild(yangyangCtx);
  assert.equal(evalRec.resonatorId, 'Yangyang');
  assert.equal(evalRec.element, 'Aero');
  assert.equal(evalRec.weaponType, 'Sword');
  assert.equal(evalRec.rarity, 4);
  assert.equal(evalRec.patchVersion, '3.7');
  assert.equal(evalRec.ruleVersion, '7.20.1');
  assert.equal(evalRec.status, 'BUILD_UNKNOWN');
  assert.equal(evalRec.decisionContextSummary.evaluationStatus, yangyangCtx.summary.evaluationStatus);
});

test('Step 20 Suite 2.2: Preserves upstream decision context summary without modification', () => {
  const step19Contexts = getCharacterDecisionContextResult().contexts;
  const ctx = step19Contexts[0];
  const evalRec = evaluateCharacterBuild(ctx);

  assert.deepEqual(evalRec.decisionContextSummary, ctx.summary);
});

test('Step 20 Suite 2.3: Rejects decision context with incompatible ruleVersion', () => {
  const step19Contexts = getCharacterDecisionContextResult().contexts;
  const ctx = {
    ...step19Contexts[0],
    ruleVersion: '7.18.1' as any
  };

  assert.throws(
    () => evaluateCharacterBuild(ctx),
    /Incompatible decisionContext ruleVersion '7.18.1'/
  );
});

test('Step 20 Suite 2.4: Rejects decision context with non-canonical Resonator ID', () => {
  const step19Contexts = getCharacterDecisionContextResult().contexts;
  const ctx = {
    ...step19Contexts[0],
    characterId: 'NonExistentChar'
  };

  assert.throws(
    () => evaluateCharacterBuild(ctx),
    /Invalid canonical Resonator ID 'NonExistentChar'/
  );
});

// ============================================================================
// SUITE 3: WEAPON EVALUATION & COMPATIBILITY INSPECTION
// ============================================================================

test('Step 3.1: Compatible weapon evaluation (Sword on Sword Resonator)', () => {
  const step19Contexts = getCharacterDecisionContextResult().contexts;
  const yangyangCtx = step19Contexts.find((c) => c.characterId === 'Yangyang')!;

  const snapshot: ResonatorInvestmentSnapshot = {
    ...createUninvestedSnapshot('Yangyang'),
    weapon: {
      weaponId: 'Emerald of Genesis',
      weaponLevel: knownValue(90),
      refinementRank: knownValue(1),
      compatibilityStatus: 'KNOWN_COMPATIBLE',
      provenance: {
        entityId: 'Emerald of Genesis',
        entityName: 'Emerald of Genesis',
        sourceType: 'RESONATOR_ABILITY',
        sourceCode: 'TEST',
        patchVersion: '3.7',
        sourceProvenance: 'test',
        originalDescription: 'test'
      }
    }
  };

  const evalRec = evaluateCharacterBuild(yangyangCtx, snapshot);
  assert.equal(evalRec.weaponEvaluation.isEquipped, true);
  assert.equal(evalRec.weaponEvaluation.weaponId, 'Emerald of Genesis');
  assert.equal(evalRec.weaponEvaluation.weaponType, 'Sword');
  assert.equal(evalRec.weaponEvaluation.resonatorWeaponType, 'Sword');
  assert.equal(evalRec.weaponEvaluation.compatibility, 'COMPATIBLE');
  assert.equal(evalRec.weaponEvaluation.weaponLevel, 90);
  assert.equal(evalRec.weaponEvaluation.isLevelMaxed, true);
  assert.equal(evalRec.weaponEvaluation.refinementRank, 1);
  assert.equal(evalRec.weaponEvaluation.isRefinementMaxed, false);
  assert.equal(evalRec.weaponEvaluation.baseAtkLvl90, 587.5);
  assert.equal(evalRec.weaponEvaluation.subStatType, 'CritRate');
  assert.equal(evalRec.weaponEvaluation.subStatValueLvl90, 0.243);
  assert.equal(evalRec.weaponEvaluation.passiveEffectCategory, 'STAT_BUFF');
  assert.equal(evalRec.weaponEvaluation.hasPassiveRefinementScaling, true);
  assert.ok(evalRec.explanationCodes.includes(BUILD_EVALUATION_EXPLANATION_CODES.WEAPON_COMPATIBLE));
  assert.ok(evalRec.explanationCodes.includes(BUILD_EVALUATION_EXPLANATION_CODES.WEAPON_LEVEL_MAXED));
});

test('Step 3.2: Incompatible weapon evaluation (Rectifier on Sword Resonator)', () => {
  const step19Contexts = getCharacterDecisionContextResult().contexts;
  const yangyangCtx = step19Contexts.find((c) => c.characterId === 'Yangyang')!;

  const snapshot: ResonatorInvestmentSnapshot = {
    ...createUninvestedSnapshot('Yangyang'),
    weapon: {
      weaponId: 'Blooming Jadehaven',
      weaponLevel: knownValue(90),
      refinementRank: knownValue(5),
      compatibilityStatus: 'INCOMPATIBLE',
      provenance: {
        entityId: 'Blooming Jadehaven',
        entityName: 'Blooming Jadehaven',
        sourceType: 'RESONATOR_ABILITY',
        sourceCode: 'TEST',
        patchVersion: '3.7',
        sourceProvenance: 'test',
        originalDescription: 'test'
      }
    }
  };

  const evalRec = evaluateCharacterBuild(yangyangCtx, snapshot);
  assert.equal(evalRec.weaponEvaluation.isEquipped, true);
  assert.equal(evalRec.weaponEvaluation.weaponType, 'Rectifier');
  assert.equal(evalRec.weaponEvaluation.resonatorWeaponType, 'Sword');
  assert.equal(evalRec.weaponEvaluation.compatibility, 'INCOMPATIBLE');
  assert.equal(evalRec.status, 'INCOMPATIBLE_WEAPON');
  assert.ok(evalRec.explanationCodes.includes(BUILD_EVALUATION_EXPLANATION_CODES.STATUS_INCOMPATIBLE_WEAPON));
  assert.ok(evalRec.explanationCodes.includes(BUILD_EVALUATION_EXPLANATION_CODES.WEAPON_INCOMPATIBLE));
});

test('Step 3.3: Non-canonical weapon ID produces UNKNOWN compatibility', () => {
  const step19Contexts = getCharacterDecisionContextResult().contexts;
  const yangyangCtx = step19Contexts.find((c) => c.characterId === 'Yangyang')!;

  const snapshot: ResonatorInvestmentSnapshot = {
    ...createUninvestedSnapshot('Yangyang'),
    weapon: {
      weaponId: 'Fictional Blade',
      weaponLevel: knownValue(90),
      refinementRank: knownValue(1),
      compatibilityStatus: 'UNKNOWN',
      provenance: {
        entityId: 'Fictional Blade',
        entityName: 'Fictional Blade',
        sourceType: 'RESONATOR_ABILITY',
        sourceCode: 'TEST',
        patchVersion: '3.7',
        sourceProvenance: 'test',
        originalDescription: 'test'
      }
    }
  };

  const evalRec = evaluateCharacterBuild(yangyangCtx, snapshot);
  assert.equal(evalRec.weaponEvaluation.isEquipped, true);
  assert.equal(evalRec.weaponEvaluation.compatibility, 'UNKNOWN');
  assert.equal(evalRec.weaponEvaluation.baseAtkLvl90, null);
});

test('Step 3.4: Un-equipped weapon produces NOT_EQUIPPED', () => {
  const step19Contexts = getCharacterDecisionContextResult().contexts;
  const yangyangCtx = step19Contexts.find((c) => c.characterId === 'Yangyang')!;

  const snapshot = createUninvestedSnapshot('Yangyang');
  const evalRec = evaluateCharacterBuild(yangyangCtx, snapshot);

  assert.equal(evalRec.weaponEvaluation.isEquipped, false);
  assert.equal(evalRec.weaponEvaluation.compatibility, 'NOT_EQUIPPED');
  assert.equal(evalRec.weaponEvaluation.weaponId, null);
  assert.equal(evalRec.weaponEvaluation.weaponLevel, null);
  assert.equal(evalRec.weaponEvaluation.isLevelMaxed, null);
  assert.equal(evalRec.weaponEvaluation.refinementRank, null);
  assert.equal(evalRec.weaponEvaluation.isRefinementMaxed, null);
});

// ============================================================================
// SUITE 4: ECHO LOADOUT & SONATA ALIGNMENT
// ============================================================================

test('Step 4.1: Elemental-aligned Sonata set (Sierra Gale on Aero Resonator Yangyang)', () => {
  const step19Contexts = getCharacterDecisionContextResult().contexts;
  const yangyangCtx = step19Contexts.find((c) => c.characterId === 'Yangyang')!;

  const snapshot: ResonatorInvestmentSnapshot = {
    ...createUninvestedSnapshot('Yangyang'),
    echoInvestment: {
      equippedCount: knownValue(5),
      tunedCount: knownValue(5),
      maxLevelEchoCount: knownValue(5),
      sonataSetId: 'SIERRA_GALE',
      provenance: {
        entityId: 'SIERRA_GALE',
        entityName: 'Sierra Gale',
        sourceType: 'RESONATOR_ABILITY',
        sourceCode: 'TEST',
        patchVersion: '3.7',
        sourceProvenance: 'test',
        originalDescription: 'test'
      }
    }
  };

  const evalRec = evaluateCharacterBuild(yangyangCtx, snapshot);
  assert.equal(evalRec.echoEvaluation.hasLoadout, true);
  assert.equal(evalRec.echoEvaluation.equippedCount, 5);
  assert.equal(evalRec.echoEvaluation.isEquippedCountMaxed, true);
  assert.equal(evalRec.echoEvaluation.tunedCount, 5);
  assert.equal(evalRec.echoEvaluation.isTunedCountMaxed, true);
  assert.equal(evalRec.echoEvaluation.maxLevelCount, 5);
  assert.equal(evalRec.echoEvaluation.isMaxLevelCountMaxed, true);
  assert.equal(evalRec.echoEvaluation.activeSonataSetCode, 'SIERRA_GALE');
  assert.equal(evalRec.echoEvaluation.activeSonataSetName, 'Sierra Gale');
  assert.equal(evalRec.echoEvaluation.sonataAlignment, 'ELEMENT_ALIGNED');
  assert.ok(evalRec.echoEvaluation.twoPieceEffectDescription);
  assert.ok(evalRec.echoEvaluation.fivePieceEffectDescription);
  assert.ok(evalRec.explanationCodes.includes(BUILD_EVALUATION_EXPLANATION_CODES.SONATA_ELEMENT_ALIGNED));
});

test('Step 4.2: Universal Sonata set (Moonlit Clouds on any Resonator)', () => {
  const step19Contexts = getCharacterDecisionContextResult().contexts;
  const yangyangCtx = step19Contexts.find((c) => c.characterId === 'Yangyang')!;

  const snapshot: ResonatorInvestmentSnapshot = {
    ...createUninvestedSnapshot('Yangyang'),
    echoInvestment: {
      equippedCount: knownValue(5),
      tunedCount: knownValue(4),
      maxLevelEchoCount: knownValue(3),
      sonataSetId: 'MOONLIT_CLOUDS',
      provenance: {
        entityId: 'MOONLIT_CLOUDS',
        entityName: 'Moonlit Clouds',
        sourceType: 'RESONATOR_ABILITY',
        sourceCode: 'TEST',
        patchVersion: '3.7',
        sourceProvenance: 'test',
        originalDescription: 'test'
      }
    }
  };

  const evalRec = evaluateCharacterBuild(yangyangCtx, snapshot);
  assert.equal(evalRec.echoEvaluation.activeSonataSetCode, 'MOONLIT_CLOUDS');
  assert.equal(evalRec.echoEvaluation.activeSonataSetName, 'Moonlit Clouds');
  assert.equal(evalRec.echoEvaluation.sonataAlignment, 'UNIVERSAL');
  assert.ok(evalRec.explanationCodes.includes(BUILD_EVALUATION_EXPLANATION_CODES.SONATA_UNIVERSAL));
});

test('Step 4.3: Misaligned elemental Sonata set (Freezing Frost on Aero Resonator Yangyang)', () => {
  const step19Contexts = getCharacterDecisionContextResult().contexts;
  const yangyangCtx = step19Contexts.find((c) => c.characterId === 'Yangyang')!;

  const snapshot: ResonatorInvestmentSnapshot = {
    ...createUninvestedSnapshot('Yangyang'),
    echoInvestment: {
      equippedCount: knownValue(5),
      tunedCount: knownValue(5),
      maxLevelEchoCount: knownValue(5),
      sonataSetId: 'FREEZING_FROST',
      provenance: {
        entityId: 'FREEZING_FROST',
        entityName: 'Freezing Frost',
        sourceType: 'RESONATOR_ABILITY',
        sourceCode: 'TEST',
        patchVersion: '3.7',
        sourceProvenance: 'test',
        originalDescription: 'test'
      }
    }
  };

  const evalRec = evaluateCharacterBuild(yangyangCtx, snapshot);
  assert.equal(evalRec.echoEvaluation.activeSonataSetCode, 'FREEZING_FROST');
  assert.equal(evalRec.echoEvaluation.sonataAlignment, 'MISALIGNED');
  assert.ok(evalRec.explanationCodes.includes(BUILD_EVALUATION_EXPLANATION_CODES.SONATA_MISALIGNED));
});

test('Step 4.4: Un-equipped Echo loadout produces NOT_EQUIPPED', () => {
  const step19Contexts = getCharacterDecisionContextResult().contexts;
  const yangyangCtx = step19Contexts.find((c) => c.characterId === 'Yangyang')!;

  const snapshot = createUninvestedSnapshot('Yangyang');
  const evalRec = evaluateCharacterBuild(yangyangCtx, snapshot);

  assert.equal(evalRec.echoEvaluation.hasLoadout, false);
  assert.equal(evalRec.echoEvaluation.equippedCount, null);
  assert.equal(evalRec.echoEvaluation.activeSonataSetCode, null);
  assert.equal(evalRec.echoEvaluation.sonataAlignment, 'NOT_EQUIPPED');
});

// ============================================================================
// SUITE 5: BUILD COMPLETENESS METRICS & STATUS TAXONOMY
// ============================================================================

test('Step 5.1: Fully equipped character build has 1.0000 completeness ratio', () => {
  const step19Contexts = getCharacterDecisionContextResult().contexts;
  const yangyangCtx = step19Contexts.find((c) => c.characterId === 'Yangyang')!;

  const fullSnapshot: ResonatorInvestmentSnapshot = {
    ...createUninvestedSnapshot('Yangyang'),
    weapon: {
      weaponId: 'Emerald of Genesis',
      weaponLevel: knownValue(90),
      refinementRank: knownValue(5),
      compatibilityStatus: 'KNOWN_COMPATIBLE',
      provenance: {
        entityId: 'Emerald of Genesis',
        entityName: 'Emerald of Genesis',
        sourceType: 'RESONATOR_ABILITY',
        sourceCode: 'TEST',
        patchVersion: '3.7',
        sourceProvenance: 'test',
        originalDescription: 'test'
      }
    },
    echoInvestment: {
      equippedCount: knownValue(5),
      tunedCount: knownValue(5),
      maxLevelEchoCount: knownValue(5),
      sonataSetId: 'SIERRA_GALE',
      provenance: {
        entityId: 'SIERRA_GALE',
        entityName: 'Sierra Gale',
        sourceType: 'RESONATOR_ABILITY',
        sourceCode: 'TEST',
        patchVersion: '3.7',
        sourceProvenance: 'test',
        originalDescription: 'test'
      }
    }
  };

  const evalRec = evaluateCharacterBuild(yangyangCtx, fullSnapshot);
  assert.equal(evalRec.status, 'FULLY_EQUIPPED');
  assert.equal(evalRec.completeness.totalAspects, 6);
  assert.equal(evalRec.completeness.knownAspects, 6);
  assert.equal(evalRec.completeness.unknownAspects, 0);
  assert.equal(evalRec.completeness.completenessRatio, 1.0);
  assert.ok(evalRec.explanationCodes.includes(BUILD_EVALUATION_EXPLANATION_CODES.STATUS_FULLY_EQUIPPED));
  assert.ok(evalRec.explanationCodes.includes(BUILD_EVALUATION_EXPLANATION_CODES.WEAPON_REFINEMENT_MAXED));
  assert.ok(evalRec.explanationCodes.includes(BUILD_EVALUATION_EXPLANATION_CODES.ECHOES_FULLY_MAXED));
});

test('Step 5.2: Partially equipped character build has intermediate completeness ratio', () => {
  const step19Contexts = getCharacterDecisionContextResult().contexts;
  const yangyangCtx = step19Contexts.find((c) => c.characterId === 'Yangyang')!;

  const partialSnapshot: ResonatorInvestmentSnapshot = {
    ...createUninvestedSnapshot('Yangyang'),
    weapon: {
      weaponId: 'Emerald of Genesis',
      weaponLevel: knownValue(80),
      refinementRank: knownValue(1),
      compatibilityStatus: 'KNOWN_COMPATIBLE',
      provenance: {
        entityId: 'Emerald of Genesis',
        entityName: 'Emerald of Genesis',
        sourceType: 'RESONATOR_ABILITY',
        sourceCode: 'TEST',
        patchVersion: '3.7',
        sourceProvenance: 'test',
        originalDescription: 'test'
      }
    }
  };

  const evalRec = evaluateCharacterBuild(yangyangCtx, partialSnapshot);
  assert.equal(evalRec.status, 'PARTIALLY_EQUIPPED');
  assert.equal(evalRec.completeness.knownAspects, 3);
  assert.equal(evalRec.completeness.completenessRatio, 0.5);
});

test('Step 5.3: Unequipped snapshot produces UNEQUIPPED status', () => {
  const step19Contexts = getCharacterDecisionContextResult().contexts;
  const yangyangCtx = step19Contexts.find((c) => c.characterId === 'Yangyang')!;

  const uninvested = createUninvestedSnapshot('Yangyang');
  const evalRec = evaluateCharacterBuild(yangyangCtx, uninvested);

  assert.equal(evalRec.status, 'UNEQUIPPED');
  assert.ok(evalRec.explanationCodes.includes(BUILD_EVALUATION_EXPLANATION_CODES.STATUS_UNEQUIPPED));
});

test('Step 5.4: Absent snapshot produces BUILD_UNKNOWN and null completenessRatio', () => {
  const step19Contexts = getCharacterDecisionContextResult().contexts;
  const yangyangCtx = step19Contexts.find((c) => c.characterId === 'Yangyang')!;

  const evalRec = evaluateCharacterBuild(yangyangCtx, null);
  assert.equal(evalRec.status, 'BUILD_UNKNOWN');
  assert.equal(evalRec.completeness.completenessRatio, null);
  assert.ok(evalRec.explanationCodes.includes(BUILD_EVALUATION_EXPLANATION_CODES.STATUS_BUILD_UNKNOWN));
});

// ============================================================================
// SUITE 6: IMMUTABILITY & OBJECT FREEZING
// ============================================================================

test('Step 6.1: Single CharacterBuildEvaluation and all nested objects are frozen', () => {
  const step19Contexts = getCharacterDecisionContextResult().contexts;
  const evalRec = evaluateCharacterBuild(step19Contexts[0]);

  assert.ok(Object.isFrozen(evalRec));
  assert.ok(Object.isFrozen(evalRec.weaponEvaluation));
  assert.ok(Object.isFrozen(evalRec.echoEvaluation));
  assert.ok(Object.isFrozen(evalRec.completeness));
  assert.ok(Object.isFrozen(evalRec.completeness.aspectDetails));
  assert.ok(Object.isFrozen(evalRec.explanationCodes));
  assert.ok(Object.isFrozen(evalRec.provenance));
});

test('Step 6.2: Result container and all arrays/summaries are frozen', () => {
  const result = getCharacterBuildEvaluationResult();

  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.evaluations));
  assert.ok(Object.isFrozen(result.summary));
  assert.ok(Object.isFrozen(result.audit));
});

// ============================================================================
// SUITE 7: PROHIBITED KEY ENFORCEMENT & NORMALIZATION
// ============================================================================

test('Step 7.1: normalizeProhibitedKey correctly normalizes delimiters and casing', () => {
  assert.equal(normalizeProhibitedKey('dps'), 'dps');
  assert.equal(normalizeProhibitedKey('DPS'), 'dps');
  assert.equal(normalizeProhibitedKey('characterPower'), 'characterpower');
  assert.equal(normalizeProhibitedKey('character_power'), 'characterpower');
  assert.equal(normalizeProhibitedKey('character-power'), 'characterpower');
  assert.equal(normalizeProhibitedKey('Team_Score'), 'teamscore');
  assert.equal(normalizeProhibitedKey('tier-score'), 'tierscore');
});

test('Step 7.2: assertNoProhibitedBuildEvaluationKeys catches root prohibited keys', () => {
  assert.throws(
    () => assertNoProhibitedBuildEvaluationKeys({ dps: 12000 }),
    /Prohibited key 'dps'/
  );
  assert.throws(
    () => assertNoProhibitedBuildEvaluationKeys({ characterPower: 99 }),
    /Prohibited key 'characterPower'/
  );
  assert.throws(
    () => assertNoProhibitedBuildEvaluationKeys({ team_score: 85 }),
    /Prohibited key 'team_score'/
  );
  assert.throws(
    () => assertNoProhibitedBuildEvaluationKeys({ metaRank: 'S' }),
    /Prohibited key 'metaRank'/
  );
});

test('Step 7.3: assertNoProhibitedBuildEvaluationKeys catches nested prohibited keys', () => {
  assert.throws(
    () => assertNoProhibitedBuildEvaluationKeys({ nested: { deep: { combatPower: 500 } } }),
    /Prohibited key 'combatPower'/
  );
  assert.throws(
    () => assertNoProhibitedBuildEvaluationKeys({ items: [{ gearScore: 100 }] }),
    /Prohibited key 'gearScore'/
  );
});

test('Step 7.4: Production result container contains zero prohibited keys', () => {
  const result = getCharacterBuildEvaluationResult();
  assert.doesNotThrow(() => assertNoProhibitedBuildEvaluationKeys(result, 'result'));
});

// ============================================================================
// SUITE 8: REPOSITORY APIS & FILTERING
// ============================================================================

test('Step 8.1: getCharacterBuildEvaluationResult returns exactly 60 Resonator evaluations', () => {
  const result = getCharacterBuildEvaluationResult();
  assert.equal(result.evaluations.length, 60);
  assert.equal(result.summary.totalEvaluations, 60);
  assert.equal(result.audit.totalEvaluations, 60);
  assert.equal(result.audit.uniqueCharacterIds, 60);
  assert.equal(result.audit.canonicalResonatorCoverage, 1.0);
});

test('Step 8.2: getAllCharacterBuildEvaluations returns exactly 60 records', () => {
  const all = getAllCharacterBuildEvaluations();
  assert.equal(all.length, 60);
});

test('Step 8.3: getCharacterBuildEvaluationByCharacterId retrieves individual Resonator', () => {
  const yangyang = getCharacterBuildEvaluationByCharacterId('Yangyang');
  assert.ok(yangyang);
  assert.equal(yangyang?.resonatorId, 'Yangyang');

  const invalid = getCharacterBuildEvaluationByCharacterId('UnknownChar');
  assert.equal(invalid, null);
});

test('Step 8.4: queryCharacterBuildEvaluations filters by element', () => {
  const aero = queryCharacterBuildEvaluations({ element: 'Aero' });
  assert.ok(aero.length > 0);
  for (const ev of aero) {
    assert.equal(ev.element, 'Aero');
  }
});

test('Step 8.5: queryCharacterBuildEvaluations filters by weaponType', () => {
  const swords = queryCharacterBuildEvaluations({ weaponType: 'Sword' });
  assert.ok(swords.length > 0);
  for (const ev of swords) {
    assert.equal(ev.weaponType, 'Sword');
  }
});

test('Step 8.6: clearCharacterBuildEvaluationCache properly resets the memoized result', () => {
  const r1 = getCharacterBuildEvaluationResult();
  clearCharacterBuildEvaluationCache();
  const r2 = getCharacterBuildEvaluationResult();

  assert.notEqual(r1, r2);
  assert.deepEqual(r1, r2);
});

// ============================================================================
// SUITE 9: ADVERSARIAL CASES & ERROR INTEGRITY
// ============================================================================

test('Step 9.1: Rejects cross-patch patchId', () => {
  assert.throws(
    () => buildCharacterBuildEvaluations({ patchId: '3.6' }),
    /Invalid patchId '3.6'/
  );
});

test('Step 9.2: Rejects duplicate decision context in catalog', () => {
  const step19Contexts = getCharacterDecisionContextResult().contexts;
  const duplicates = [step19Contexts[0], step19Contexts[0]];

  assert.throws(
    () => buildCharacterBuildEvaluations({ decisionContexts: duplicates }),
    /Duplicate decisionContext record/
  );
});

test('Step 9.3: Rejects duplicate investment snapshot in catalog', () => {
  const snap = createUninvestedSnapshot('Yangyang');
  assert.throws(
    () => buildCharacterBuildEvaluations({ investmentSnapshots: [snap, snap] }),
    /Duplicate investmentSnapshot record/
  );
});

test('Step 9.4: Rejects non-canonical character ID in characterIds list', () => {
  assert.throws(
    () => buildCharacterBuildEvaluations({ characterIds: ['FakeChar'] }),
    /Invalid canonical Resonator ID 'FakeChar'/
  );
});

test('Step 9.5: Evaluates mismatched snapshot patchVersion as PATCH_MISMATCH status', () => {
  const step19Contexts = getCharacterDecisionContextResult().contexts;
  const yangyangCtx = step19Contexts.find((c) => c.characterId === 'Yangyang')!;

  const badSnapshot: any = {
    ...createUninvestedSnapshot('Yangyang'),
    patchVersion: '3.6'
  };

  const evalRec = evaluateCharacterBuild(yangyangCtx, badSnapshot);
  assert.equal(evalRec.status, 'PATCH_MISMATCH');
  assert.ok(evalRec.explanationCodes.includes(BUILD_EVALUATION_EXPLANATION_CODES.STATUS_PATCH_MISMATCH));
});

test('Step 9.6: Evaluates mismatched resonator ID as INVALID status', () => {
  const step19Contexts = getCharacterDecisionContextResult().contexts;
  const yangyangCtx = step19Contexts.find((c) => c.characterId === 'Yangyang')!;

  const mismatchedSnapshot = createUninvestedSnapshot('Chixia');

  const evalRec = evaluateCharacterBuild(yangyangCtx, mismatchedSnapshot);
  assert.equal(evalRec.status, 'INVALID');
  assert.ok(evalRec.explanationCodes.includes(BUILD_EVALUATION_EXPLANATION_CODES.STATUS_INVALID));
});

// ============================================================================
// SUITE 10: PRODUCTION AUDITING & INVARIANT VERIFICATION
// ============================================================================

test('Step 10.1: auditSingleCharacterBuildEvaluation passes for all 60 production evaluations', () => {
  const evals = getAllCharacterBuildEvaluations();
  for (let i = 0; i < evals.length; i++) {
    assert.doesNotThrow(() => auditSingleCharacterBuildEvaluation(evals[i], i));
  }
});

test('Step 10.2: runProductionCharacterBuildEvaluationAudit passes all invariants without error', () => {
  assert.doesNotThrow(() => runProductionCharacterBuildEvaluationAudit());
});

test('Step 10.3: Format explanation utility produces clean, un-scored description', () => {
  const evals = getAllCharacterBuildEvaluations();
  const explanation = formatCharacterBuildExplanation(evals[0]);

  assert.ok(explanation.includes('Character:'));
  assert.ok(explanation.includes('Build Status:'));
  assert.ok(explanation.includes('Weapon:'));
  assert.ok(explanation.includes('Echo Loadout:'));
  assert.doesNotThrow(() => assertNoProhibitedBuildEvaluationKeys({ text: explanation }));
});

// ============================================================================
// SUITE 11: 20-RUN DETERMINISM & PERMUTATION INVARIANCE
// ============================================================================

test('Step 11.1: 20 consecutive build evaluation runs produce identical SHA-256 hash', () => {
  let firstHash: string | null = null;

  for (let run = 0; run < 20; run++) {
    clearCharacterBuildEvaluationCache();
    const result = getCharacterBuildEvaluationResult();
    const json = JSON.stringify(result);
    const hash = crypto.createHash('sha256').update(json).digest('hex');

    if (firstHash === null) {
      firstHash = hash;
    } else {
      assert.equal(
        hash,
        firstHash,
        `Determinism failed at run ${run + 1}: expected ${firstHash}, got ${hash}`
      );
    }
  }

  assert.ok(firstHash !== null);
});

test('Step 11.2: Permuting input decision contexts preserves deterministic output order', () => {
  const normalResult = getCharacterBuildEvaluationResult();

  const reversedContexts = [...getCharacterDecisionContextResult().contexts].reverse();
  const permutedResult = buildCharacterBuildEvaluations({ decisionContexts: reversedContexts });

  assert.equal(normalResult.evaluations.length, permutedResult.evaluations.length);
  for (let i = 0; i < normalResult.evaluations.length; i++) {
    assert.equal(
      normalResult.evaluations[i].id,
      permutedResult.evaluations[i].id,
      `Order mismatch at index ${i}`
    );
  }
});

// ============================================================================
// SUITE 12: ALL 5 WEAPON TYPES COMPATIBILITY & STATS VERIFICATION
// ============================================================================

test('Step 12.1: Broadblade compatibility on Broadblade Resonator (Jiyan)', () => {
  const step19Contexts = getCharacterDecisionContextResult().contexts;
  const jiyanCtx = step19Contexts.find((c) => c.characterId === 'Jiyan')!;
  assert.equal(jiyanCtx.evaluation.resonatorId, 'Jiyan');

  const snapshot: ResonatorInvestmentSnapshot = {
    ...createUninvestedSnapshot('Jiyan'),
    weapon: {
      weaponId: 'Verdant Summit', // Broadblade 5-star
      weaponLevel: knownValue(90),
      refinementRank: knownValue(1),
      compatibilityStatus: 'KNOWN_COMPATIBLE',
      provenance: {
        entityId: 'Verdant Summit',
        entityName: 'Verdant Summit',
        sourceType: 'RESONATOR_ABILITY',
        sourceCode: 'TEST',
        patchVersion: '3.7',
        sourceProvenance: 'test',
        originalDescription: 'test'
      }
    }
  };

  const evalRec = evaluateCharacterBuild(jiyanCtx, snapshot);
  assert.equal(evalRec.weaponEvaluation.weaponType, 'Broadblade');
  assert.equal(evalRec.weaponEvaluation.compatibility, 'COMPATIBLE');
  assert.equal(evalRec.weaponEvaluation.baseAtkLvl90, 587.5);
  assert.equal(evalRec.weaponEvaluation.subStatType, 'CritDMG');
  assert.equal(evalRec.weaponEvaluation.subStatValueLvl90, 0.486);
});

test('Step 12.2: Pistols compatibility on Pistols Resonator (Chixia)', () => {
  const step19Contexts = getCharacterDecisionContextResult().contexts;
  const chixiaCtx = step19Contexts.find((c) => c.characterId === 'Chixia')!;

  const snapshot: ResonatorInvestmentSnapshot = {
    ...createUninvestedSnapshot('Chixia'),
    weapon: {
      weaponId: 'Static Mist', // Pistols 5-star
      weaponLevel: knownValue(90),
      refinementRank: knownValue(1),
      compatibilityStatus: 'KNOWN_COMPATIBLE',
      provenance: {
        entityId: 'Static Mist',
        entityName: 'Static Mist',
        sourceType: 'RESONATOR_ABILITY',
        sourceCode: 'TEST',
        patchVersion: '3.7',
        sourceProvenance: 'test',
        originalDescription: 'test'
      }
    }
  };

  const evalRec = evaluateCharacterBuild(chixiaCtx, snapshot);
  assert.equal(evalRec.weaponEvaluation.weaponType, 'Pistols');
  assert.equal(evalRec.weaponEvaluation.compatibility, 'COMPATIBLE');
  assert.equal(evalRec.weaponEvaluation.baseAtkLvl90, 587.5);
  assert.equal(evalRec.weaponEvaluation.subStatType, 'CritRate');
});

test('Step 12.3: Gauntlets compatibility on Gauntlets Resonator (Jianxin)', () => {
  const step19Contexts = getCharacterDecisionContextResult().contexts;
  const jianxinCtx = step19Contexts.find((c) => c.characterId === 'Jianxin')!;

  const snapshot: ResonatorInvestmentSnapshot = {
    ...createUninvestedSnapshot('Jianxin'),
    weapon: {
      weaponId: 'Abyss Surges', // Gauntlets 5-star
      weaponLevel: knownValue(90),
      refinementRank: knownValue(1),
      compatibilityStatus: 'KNOWN_COMPATIBLE',
      provenance: {
        entityId: 'Abyss Surges',
        entityName: 'Abyss Surges',
        sourceType: 'RESONATOR_ABILITY',
        sourceCode: 'TEST',
        patchVersion: '3.7',
        sourceProvenance: 'test',
        originalDescription: 'test'
      }
    }
  };

  const evalRec = evaluateCharacterBuild(jianxinCtx, snapshot);
  assert.equal(evalRec.weaponEvaluation.weaponType, 'Gauntlets');
  assert.equal(evalRec.weaponEvaluation.compatibility, 'COMPATIBLE');
  assert.equal(evalRec.weaponEvaluation.baseAtkLvl90, 587.5);
  assert.equal(evalRec.weaponEvaluation.subStatType, 'EnergyRegen');
});

test('Step 12.4: Rectifier compatibility on Rectifier Resonator (Baizhi)', () => {
  const step19Contexts = getCharacterDecisionContextResult().contexts;
  const baizhiCtx = step19Contexts.find((c) => c.characterId === 'Baizhi')!;

  const snapshot: ResonatorInvestmentSnapshot = {
    ...createUninvestedSnapshot('Baizhi'),
    weapon: {
      weaponId: 'Cosmic Ripples', // Rectifier 5-star
      weaponLevel: knownValue(90),
      refinementRank: knownValue(1),
      compatibilityStatus: 'KNOWN_COMPATIBLE',
      provenance: {
        entityId: 'Cosmic Ripples',
        entityName: 'Cosmic Ripples',
        sourceType: 'RESONATOR_ABILITY',
        sourceCode: 'TEST',
        patchVersion: '3.7',
        sourceProvenance: 'test',
        originalDescription: 'test'
      }
    }
  };

  const evalRec = evaluateCharacterBuild(baizhiCtx, snapshot);
  assert.equal(evalRec.weaponEvaluation.weaponType, 'Rectifier');
  assert.equal(evalRec.weaponEvaluation.compatibility, 'COMPATIBLE');
  assert.equal(evalRec.weaponEvaluation.baseAtkLvl90, 587.5);
  assert.equal(evalRec.weaponEvaluation.subStatType, 'EnergyRegen');
});

// ============================================================================
// SUITE 13: ADVANCED QUERY FILTERING & SUBSET EVALUATION
// ============================================================================

test('Step 13.1: buildCharacterBuildEvaluations with custom characterIds subset', () => {
  const result = buildCharacterBuildEvaluations({
    characterIds: ['Yangyang', 'Chixia']
  });

  assert.equal(result.evaluations.length, 2);
  assert.equal(result.evaluations[0].resonatorId, 'Chixia');
  assert.equal(result.evaluations[1].resonatorId, 'Yangyang');
  assert.equal(result.audit.uniqueCharacterIds, 2);
  assert.equal(result.audit.totalEvaluations, 2);
});

test('Step 13.2: queryCharacterBuildEvaluations filters by status', () => {
  const result = getCharacterBuildEvaluationResult();
  const unknownBuilds = queryCharacterBuildEvaluations({ status: 'BUILD_UNKNOWN' });

  assert.equal(unknownBuilds.length, 60);
  for (const ev of unknownBuilds) {
    assert.equal(ev.status, 'BUILD_UNKNOWN');
  }
});

test('Step 13.3: queryCharacterBuildEvaluations filters by weaponCompatibility', () => {
  const notEquipped = queryCharacterBuildEvaluations({ weaponCompatibility: 'NOT_EQUIPPED' });
  assert.equal(notEquipped.length, 60);
  for (const ev of notEquipped) {
    assert.equal(ev.weaponEvaluation.compatibility, 'NOT_EQUIPPED');
  }
});

test('Step 13.4: queryCharacterBuildEvaluations filters by sonataAlignment', () => {
  const notEquipped = queryCharacterBuildEvaluations({ sonataAlignment: 'NOT_EQUIPPED' });
  assert.equal(notEquipped.length, 60);
  for (const ev of notEquipped) {
    assert.equal(ev.echoEvaluation.sonataAlignment, 'NOT_EQUIPPED');
  }
});

test('Step 13.5: queryCharacterBuildEvaluations filters by isFullyEquipped', () => {
  const full = queryCharacterBuildEvaluations({ isFullyEquipped: true });
  assert.equal(full.length, 0); // In default uninvested catalog, none are fully equipped
});

test('Step 13.6: queryCharacterBuildEvaluations filters by characterId', () => {
  const yangyangOnly = queryCharacterBuildEvaluations({ characterId: 'Yangyang' });
  assert.equal(yangyangOnly.length, 1);
  assert.equal(yangyangOnly[0].resonatorId, 'Yangyang');
});

// ============================================================================
// SUITE 14: EPISTEMIC FIDELITY (UNKNOWN != 0)
// ============================================================================

test('Step 14.1: Unknown weapon level and refinement do not default to 0 or 1', () => {
  const step19Contexts = getCharacterDecisionContextResult().contexts;
  const yangyangCtx = step19Contexts.find((c) => c.characterId === 'Yangyang')!;

  const snapshot: ResonatorInvestmentSnapshot = {
    ...createUninvestedSnapshot('Yangyang'),
    weapon: {
      weaponId: 'Emerald of Genesis',
      weaponLevel: unknownValue('UNKNOWN'),
      refinementRank: unknownValue('UNKNOWN'),
      compatibilityStatus: 'KNOWN_COMPATIBLE',
      provenance: {
        entityId: 'Emerald of Genesis',
        entityName: 'Emerald of Genesis',
        sourceType: 'RESONATOR_ABILITY',
        sourceCode: 'TEST',
        patchVersion: '3.7',
        sourceProvenance: 'test',
        originalDescription: 'test'
      }
    }
  };

  const evalRec = evaluateCharacterBuild(yangyangCtx, snapshot);
  assert.equal(evalRec.weaponEvaluation.weaponLevel, null);
  assert.notEqual(evalRec.weaponEvaluation.weaponLevel, 0);
  assert.notEqual(evalRec.weaponEvaluation.weaponLevel, 1);
  assert.equal(evalRec.weaponEvaluation.refinementRank, null);
  assert.notEqual(evalRec.weaponEvaluation.refinementRank, 0);
  assert.notEqual(evalRec.weaponEvaluation.refinementRank, 1);
  assert.equal(evalRec.weaponEvaluation.isLevelMaxed, null);
  assert.equal(evalRec.weaponEvaluation.isRefinementMaxed, null);
});

test('Step 14.2: Unknown echo loadout counts do not default to 0', () => {
  const step19Contexts = getCharacterDecisionContextResult().contexts;
  const yangyangCtx = step19Contexts.find((c) => c.characterId === 'Yangyang')!;

  const snapshot: ResonatorInvestmentSnapshot = {
    ...createUninvestedSnapshot('Yangyang'),
    echoInvestment: {
      equippedCount: unknownValue('UNKNOWN'),
      tunedCount: unknownValue('UNKNOWN'),
      maxLevelEchoCount: unknownValue('UNKNOWN'),
      sonataSetId: null,
      provenance: {
        entityId: 'TEST',
        entityName: 'TEST',
        sourceType: 'RESONATOR_ABILITY',
        sourceCode: 'TEST',
        patchVersion: '3.7',
        sourceProvenance: 'test',
        originalDescription: 'test'
      }
    }
  };

  const evalRec = evaluateCharacterBuild(yangyangCtx, snapshot);
  assert.equal(evalRec.echoEvaluation.equippedCount, null);
  assert.notEqual(evalRec.echoEvaluation.equippedCount, 0);
  assert.equal(evalRec.echoEvaluation.tunedCount, null);
  assert.notEqual(evalRec.echoEvaluation.tunedCount, 0);
  assert.equal(evalRec.echoEvaluation.maxLevelCount, null);
  assert.notEqual(evalRec.echoEvaluation.maxLevelCount, 0);
});

// ============================================================================
// SUITE 15: ADVERSARIAL INVARIANTS & AUDIT VERIFICATION
// ============================================================================

test('Step 15.1: getCanonicalSonataMetadata resolves canonical Sonata by both code and display name', () => {
  const byCode = getCanonicalSonataMetadata('FREEZING_FROST');
  assert.ok(byCode);
  assert.equal(byCode.name, 'Freezing Frost');
  assert.equal(byCode.element, 'Glacio');

  const byName = getCanonicalSonataMetadata('Freezing Frost');
  assert.ok(byName);
  assert.equal(byName.code, 'FREEZING_FROST');
  assert.equal(byName.element, 'Glacio');

  const caseInsensitive = getCanonicalSonataMetadata('freezing frost');
  assert.ok(caseInsensitive);
  assert.equal(caseInsensitive.code, 'FREEZING_FROST');

  assert.equal(getCanonicalSonataMetadata('Nonexistent Sonata Set'), null);
});

test('Step 15.2: Invariant B - knownAspects + unknownAspects === 6 holds across all 60 production Resonators', () => {
  const result = getCharacterBuildEvaluationResult();
  assert.equal(result.evaluations.length, 60);
  for (const ev of result.evaluations) {
    assert.equal(
      ev.completeness.knownAspects + ev.completeness.unknownAspects,
      6,
      `Invariant violation for Resonator ${ev.resonatorId}`
    );
    assert.equal(ev.completeness.totalAspects, 6);
  }
});

test('Step 15.3: Invariant B - knownAspects + unknownAspects === 6 holds for unequipped snapshot and produces completenessRatio 0.0000', () => {
  const step19Contexts = getCharacterDecisionContextResult().contexts;
  const yangyangCtx = step19Contexts.find((c) => c.characterId === 'Yangyang')!;
  const uninvested = createUninvestedSnapshot('Yangyang');
  const evalRec = evaluateCharacterBuild(yangyangCtx, uninvested);

  assert.equal(evalRec.status, 'UNEQUIPPED');
  assert.equal(evalRec.completeness.knownAspects, 0);
  assert.equal(evalRec.completeness.unknownAspects, 6);
  assert.equal(evalRec.completeness.knownAspects + evalRec.completeness.unknownAspects, 6);
  assert.equal(evalRec.completeness.completenessRatio, 0.0000);
});

test('Step 15.4: Invariant B - Absent snapshot produces completenessRatio null (distinguished from unequipped 0.0000)', () => {
  const step19Contexts = getCharacterDecisionContextResult().contexts;
  const yangyangCtx = step19Contexts.find((c) => c.characterId === 'Yangyang')!;
  const evalRec = evaluateCharacterBuild(yangyangCtx, null);

  assert.equal(evalRec.status, 'BUILD_UNKNOWN');
  assert.equal(evalRec.completeness.knownAspects, 0);
  assert.equal(evalRec.completeness.unknownAspects, 6);
  assert.equal(evalRec.completeness.knownAspects + evalRec.completeness.unknownAspects, 6);
  assert.equal(evalRec.completeness.completenessRatio, null);
});

test('Step 15.5: Invariant B - Contradictory incompatible weapon with complete echoes produces completenessRatio 1.0000 and status INCOMPATIBLE_WEAPON', () => {
  const step19Contexts = getCharacterDecisionContextResult().contexts;
  const yangyangCtx = step19Contexts.find((c) => c.characterId === 'Yangyang')!;

  const incompatibleSnapshot: ResonatorInvestmentSnapshot = {
    ...createUninvestedSnapshot('Yangyang'),
    weapon: {
      weaponId: 'Stringmaster', // Rectifier on Sword Resonator Yangyang
      weaponLevel: knownValue(90),
      refinementRank: knownValue(5),
      compatibilityStatus: 'INCOMPATIBLE',
      provenance: {
        entityId: 'Stringmaster',
        entityName: 'Stringmaster',
        sourceType: 'RESONATOR_ABILITY',
        sourceCode: 'TEST',
        patchVersion: '3.7',
        sourceProvenance: 'test',
        originalDescription: 'test'
      }
    },
    echoInvestment: {
      equippedCount: knownValue(5),
      tunedCount: knownValue(5),
      maxLevelEchoCount: knownValue(5),
      sonataSetId: 'Sierra Gale',
      provenance: {
        entityId: 'TEST',
        entityName: 'TEST',
        sourceType: 'RESONATOR_ABILITY',
        sourceCode: 'TEST',
        patchVersion: '3.7',
        sourceProvenance: 'test',
        originalDescription: 'test'
      }
    }
  };

  const evalRec = evaluateCharacterBuild(yangyangCtx, incompatibleSnapshot);
  assert.equal(evalRec.status, 'INCOMPATIBLE_WEAPON');
  assert.equal(evalRec.weaponEvaluation.compatibility, 'INCOMPATIBLE');
  assert.equal(evalRec.completeness.knownAspects, 6);
  assert.equal(evalRec.completeness.unknownAspects, 0);
  assert.equal(evalRec.completeness.knownAspects + evalRec.completeness.unknownAspects, 6);
  assert.equal(evalRec.completeness.completenessRatio, 1.0000);
});

test('Step 15.6: Invariant A - buildCharacterBuildEvaluations rejects empty array characterIds: []', () => {
  assert.throws(
    () => buildCharacterBuildEvaluations({ characterIds: [] }),
    /characterIds cannot be an empty array/
  );
});

test('Step 15.7: Invariant A - buildCharacterBuildEvaluations rejects extra decisionContexts outside requested characterIds', () => {
  const allContexts = getCharacterDecisionContextResult().contexts;
  const yangyangCtx = allContexts.find((c) => c.characterId === 'Yangyang')!;
  const chixiaCtx = allContexts.find((c) => c.characterId === 'Chixia')!;

  assert.throws(
    () =>
      buildCharacterBuildEvaluations({
        characterIds: ['Yangyang'],
        decisionContexts: [yangyangCtx, chixiaCtx]
      }),
    /Extra decision context record for character 'Chixia' not present in requested target characters/
  );
});

test('Step 15.8: Invariant A - buildCharacterBuildEvaluations rejects extra investmentSnapshots outside requested characterIds', () => {
  const allContexts = getCharacterDecisionContextResult().contexts;
  const yangyangCtx = allContexts.find((c) => c.characterId === 'Yangyang')!;
  const yangyangInv = createUninvestedSnapshot('Yangyang');
  const chixiaInv = createUninvestedSnapshot('Chixia');

  assert.throws(
    () =>
      buildCharacterBuildEvaluations({
        characterIds: ['Yangyang'],
        decisionContexts: [yangyangCtx],
        investmentSnapshots: [yangyangInv, chixiaInv]
      }),
    /Extra investment snapshot record for character 'Chixia' not present in requested target characters/
  );
});

test('Step 15.9: Invariant D - Unrecognized/unmodeled Sonata set never silently becomes UNIVERSAL or ELEMENT_ALIGNED', () => {
  const step19Contexts = getCharacterDecisionContextResult().contexts;
  const yangyangCtx = step19Contexts.find((c) => c.characterId === 'Yangyang')!;

  const unmodeledSonataSnapshot: ResonatorInvestmentSnapshot = {
    ...createUninvestedSnapshot('Yangyang'),
    echoInvestment: {
      equippedCount: knownValue(5),
      tunedCount: knownValue(5),
      maxLevelEchoCount: knownValue(5),
      sonataSetId: 'MYTHICAL_UNMODELED_SET_999',
      provenance: {
        entityId: 'TEST',
        entityName: 'TEST',
        sourceType: 'RESONATOR_ABILITY',
        sourceCode: 'TEST',
        patchVersion: '3.7',
        sourceProvenance: 'test',
        originalDescription: 'test'
      }
    }
  };

  const evalRec = evaluateCharacterBuild(yangyangCtx, unmodeledSonataSnapshot);
  assert.equal(evalRec.echoEvaluation.sonataAlignment, 'UNKNOWN');
  assert.notEqual(evalRec.echoEvaluation.sonataAlignment, 'UNIVERSAL');
  assert.notEqual(evalRec.echoEvaluation.sonataAlignment, 'ELEMENT_ALIGNED');
  assert.equal(evalRec.completeness.aspectDetails.SONATA_SET_KNOWN, 'UNKNOWN');
});

test('Step 15.10: Invariant F - Prohibited-key checks reject variations with case, hyphen, underscore, whitespace', () => {
  const variations = [
    'team_score',
    'TEAM_SCORE',
    'team-score',
    'teamScore',
    '  team_score  ',
    'combat_power',
    'combat-power',
    'COMBAT_POWER',
    'overall_score',
    'overall-score',
    'OVERALL_SCORE',
    'dps',
    'DPS',
    'meta_rank',
    'meta-rank'
  ];

  for (const variant of variations) {
    assert.throws(
      () => {
        assertNoProhibitedBuildEvaluationKeys({
          testProp: 'valid',
          nested: {
            [variant]: 100
          }
        });
      },
      /Prohibited key .* detected/,
      `Failed to reject prohibited key variant '${variant}'`
    );
  }
});

test('Step 15.11: Invariant F - Input order permutation of investmentSnapshots produces byte-identical output', () => {
  const inv1 = createUninvestedSnapshot('Yangyang');
  const inv2 = createUninvestedSnapshot('Chixia');
  const inv3 = createUninvestedSnapshot('Baizhi');

  const resForward = buildCharacterBuildEvaluations({
    characterIds: ['Baizhi', 'Chixia', 'Yangyang'],
    investmentSnapshots: [inv1, inv2, inv3]
  });

  const resReverse = buildCharacterBuildEvaluations({
    characterIds: ['Baizhi', 'Chixia', 'Yangyang'],
    investmentSnapshots: [inv3, inv2, inv1]
  });

  assert.equal(JSON.stringify(resForward), JSON.stringify(resReverse));
});

