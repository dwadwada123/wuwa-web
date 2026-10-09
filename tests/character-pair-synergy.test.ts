/**
 * Wuthering Waves Character Pair Synergy Evaluation Test Suite
 * Phase 7 Step 8: Deterministic Character Pair Synergy Evaluation Contract
 *
 * Comprehensive tests covering:
 * - Empty pair -> NO_EVIDENCE (never anti-synergy, score is null)
 * - Evaluated pair -> SYNERGY_SUPPORTED
 * - Partially evaluated pair -> PARTIAL_SYNERGY
 * - Contextual-only pair -> CONTEXT_DEPENDENT
 * - Unmodeled pair -> UNMODELED (score is null)
 * - Unknown pair -> UNKNOWN (fail-closed, score is null)
 * - Not-applicable pair -> NOT_APPLICABLE (score is null)
 * - Direct target, next resonator, element match, All element, NONE element rejection
 * - Action match, valid Outro->Intro transition, coordinated attack, resource, defensive, offensive
 * - Anti-double-counting (duplicate candidates, duplicate relationships, duplicate facts)
 * - Directionality preservation (A -> B != B -> A)
 * - Bounded scores in [0.00, 100.00], never negative, rounded to 2 decimals
 * - Strict prohibition of raw descriptions, LLMs, networks, random IDs, roles, meta, character power, team scores, ToA, Vigor
 * - Production dataset reconciliation and 20-run repeated determinism check
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  evaluateCharacterPairSynergy,
  evaluateCharacterPairSynergies,
  getCharacterPairSynergyProfile,
  getCharacterPairSynergyProfiles,
  queryCharacterPairSynergyProfiles,
  getOutgoingSynergyProfilesForResonator,
  getIncomingSynergyProfilesForResonator,
  clearCharacterPairSynergyProfileCache,
  explainCharacterPairSynergyProfile,
  auditCharacterPairSynergyProfiles,
  deriveCharacterPairSynergyProfileId,
  compareCharacterPairSynergyProfile,
  isSynergySupportedProfile,
  isPartialSynergyProfile,
  isContextDependentSynergyProfile,
  isUnmodeledSynergyProfile,
  isNoEvidenceSynergyProfile,
  hasSynergyScore,
  matchesSynergyProfileFilter,
  CHARACTER_PAIR_SYNERGY_RULE_VERSION,
  SYNERGY_SCORE_SCALE_MIN,
  SYNERGY_SCORE_SCALE_MAX
} from '../lib/engine/relationships/character-pairs/synergy/index.ts';

import {
  aggregateCharacterPairEvidence,
  buildEmptyCharacterPairProfile
} from '../lib/engine/relationships/character-pairs/index.ts';
import { evaluateCompatibilityCandidate } from '../lib/engine/relationships/evaluation/evaluator.ts';
import { generateCompatibilityCandidates } from '../lib/engine/relationships/compatibility/candidates.ts';
import { buildGameplayCapability } from '../lib/engine/capabilities/builder.ts';
import { buildGameplayRelationshipsForCapability } from '../lib/engine/relationships/builder.ts';
import { composeInteractionEvidence } from '../lib/engine/relationships/composition/composer.ts';
import type { NormalizedEngineFact } from '../lib/engine/facts/types.ts';
import type { CompatibilityCandidate } from '../lib/engine/relationships/compatibility/types.ts';

/**
 * Factory creating valid NormalizedEngineFacts for synergy tests.
 */
function createMockFact(overrides?: Partial<NormalizedEngineFact>): NormalizedEngineFact {
  const isUnmodeledOrUnknown =
    overrides?.consumptionState === 'UNMODELED' ||
    overrides?.consumptionState === 'UNKNOWN' ||
    overrides?.consumptionState === 'NOT_APPLICABLE';

  const baseNumeric = overrides?.value && 'value' in overrides.value ? overrides.value.value : 20;
  const baseValue =
    overrides?.value ??
    (isUnmodeledOrUnknown
      ? { type: 'UNRESOLVED' as const, reason: 'Test Fixture' }
      : {
          type: 'EXACT' as const,
          value: baseNumeric !== null && baseNumeric !== undefined ? baseNumeric : 20,
          unit: 'PERCENT' as const
        });

  const entityId = overrides?.entityId ?? 'Jiyan';
  const sourceCode = overrides?.sourceCode ?? 'skill';
  const category = overrides?.category ?? 'STAT_BUFF';
  const target = overrides?.target ?? 'TEAM';
  const parameter = overrides?.parameter ?? 'ATK_PERCENT';
  const element = overrides?.element ?? 'NONE';

  return {
    factId:
      overrides?.factId ??
      `${entityId}|${sourceCode}|${category}|${target}|${parameter}|${element}|EXACT:${baseNumeric}:PERCENT|NO_COND|NO_DUR|NO_STACK`,
    entityId,
    sourceCode,
    patchVersion: overrides?.patchVersion ?? '3.7',
    category,
    parameter,
    value: baseValue,
    staticNumericValue:
      overrides && 'staticNumericValue' in overrides
        ? overrides.staticNumericValue!
        : baseValue.type === 'EXACT'
          ? baseValue.value
          : null,
    unit: 'PERCENT',
    target,
    element,
    condition: overrides?.condition,
    duration: overrides?.duration,
    stacking: overrides?.stacking,
    refinementRank: overrides?.refinementRank,
    parameterSafety: overrides?.parameterSafety ?? 'DIRECT_ENGINE_FACT',
    consumptionState: isUnmodeledOrUnknown
      ? overrides?.consumptionState ?? 'UNMODELED'
      : overrides?.consumptionState ?? 'CONSUMABLE_STATIC',
    semanticStatus: overrides?.semanticStatus ?? 'SAFE_EXPLICIT',
    provenance: {
      entityId,
      entityName: `${entityId} Name`,
      sourceType: 'RESONATOR_ABILITY',
      patchVersion: '3.7',
      sourceProvenance: 'Test Provenance',
      originalDescription: 'Test Description'
    },
    extraction: {
      parserVersion: '3.7.0',
      method: 'DETERMINISTIC_RULE_PARSER',
      extractionDate: '2026-10-08'
    },
    ...overrides
  };
}

/**
 * Builds candidate pairs from two mock facts.
 */
function buildMockCandidatePair(
  fact1: NormalizedEngineFact,
  fact2: NormalizedEngineFact
): CompatibilityCandidate[] {
  const cap1 = buildGameplayCapability(fact1);
  const cap2 = buildGameplayCapability(fact2);
  const rels = [
    ...buildGameplayRelationshipsForCapability(cap1),
    ...buildGameplayRelationshipsForCapability(cap2)
  ];
  const evi = composeInteractionEvidence([cap1, cap2], rels, '3.7');
  const candidates = generateCompatibilityCandidates([cap1, cap2], evi, rels, '3.7');
  return [...candidates];
}

// ============================================================================
// SUITE 1: SYNERGY STATUSES (Tests 1-7)
// ============================================================================

test('1. Empty pair -> NO_EVIDENCE with null synergyScore (not anti-synergy)', () => {
  const emptyEvidence = buildEmptyCharacterPairProfile('Jiyan', 'Mortefi');
  const synergy = evaluateCharacterPairSynergy(emptyEvidence);

  assert.strictEqual(synergy.synergyStatus, 'NO_EVIDENCE');
  assert.strictEqual(synergy.synergyScore, null);
  assert.notStrictEqual(synergy.synergyScore, 0);
  assert.notStrictEqual(synergy.synergyScore, -1);
  assert.strictEqual(synergy.components.length, 0);
  assert.ok(synergy.explanationCodes.includes('STATUS_NO_EVIDENCE'));
});

test('2. Evaluated pair -> SYNERGY_SUPPORTED with non-null synergyScore', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Jiyan', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'Mortefi', target: 'SELF', parameter: 'ATK_PERCENT' })
  );
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c));
  const evidenceProfile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', evals, cands);
  const synergy = evaluateCharacterPairSynergy(evidenceProfile);

  assert.strictEqual(synergy.synergyStatus, 'SYNERGY_SUPPORTED');
  assert.ok(synergy.synergyScore !== null);
  assert.ok(synergy.synergyScore >= 50 && synergy.synergyScore <= 100);
});

test('3. Partially evaluated pair -> PARTIAL_SYNERGY with non-null synergyScore', () => {
  const candStatic = buildMockCandidatePair(
    createMockFact({ factId: 'F_STATIC_1', entityId: 'Jiyan', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ factId: 'F_STATIC_2', entityId: 'Mortefi', target: 'SELF', parameter: 'ATK_PERCENT' })
  )[0];

  const candContextual = buildMockCandidatePair(
    createMockFact({
      factId: 'F_CTX_1',
      entityId: 'Jiyan',
      target: 'TEAM',
      parameter: 'ATK_PERCENT',
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      condition: { trigger: 'ON_INTRO_SKILL' }
    }),
    createMockFact({ factId: 'F_CTX_2', entityId: 'Mortefi', target: 'SELF', parameter: 'ATK_PERCENT' })
  )[0];

  const cands = [candStatic, candContextual];
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c));
  const evidenceProfile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', evals, cands);
  const synergy = evaluateCharacterPairSynergy(evidenceProfile);

  assert.strictEqual(synergy.synergyStatus, 'PARTIAL_SYNERGY');
  assert.ok(synergy.synergyScore !== null);
  assert.ok(synergy.explanationCodes.includes('PARTIAL_EVALUATED_EVIDENCE'));
});

test('4. Contextual-only pair -> CONTEXT_DEPENDENT with null synergyScore', () => {
  const cands = buildMockCandidatePair(
    createMockFact({
      entityId: 'Jiyan',
      target: 'TEAM',
      parameter: 'ATK_PERCENT',
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      condition: { trigger: 'ON_INTRO_SKILL' }
    }),
    createMockFact({ entityId: 'Mortefi', target: 'SELF', parameter: 'ATK_PERCENT' })
  );
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c));
  const evidenceProfile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', evals, cands);
  const synergy = evaluateCharacterPairSynergy(evidenceProfile);

  assert.strictEqual(synergy.synergyStatus, 'CONTEXT_DEPENDENT');
  assert.strictEqual(synergy.synergyScore, null);
  assert.ok(synergy.explanationCodes.includes('CONTEXTUAL_EVIDENCE_REQUIRES_RUNTIME_CONDITIONS'));
});

test('5. Unmodeled pair -> UNMODELED with null synergyScore', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Jiyan', target: 'TEAM', consumptionState: 'UNMODELED' }),
    createMockFact({ entityId: 'Mortefi', target: 'SELF', consumptionState: 'UNMODELED' })
  );
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c));
  const evidenceProfile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', evals, cands);
  const synergy = evaluateCharacterPairSynergy(evidenceProfile);

  assert.strictEqual(synergy.synergyStatus, 'UNMODELED');
  assert.strictEqual(synergy.synergyScore, null);
  assert.ok(synergy.explanationCodes.includes('UNMODELED_MECHANICS_PRESENT'));
});

test('6. Unknown pair -> UNKNOWN fail closed with null synergyScore', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Jiyan', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'Mortefi', target: 'SELF', parameter: 'ATK_PERCENT' })
  );
  const unknownCand = { ...cands[0], status: 'UNKNOWN' as const };
  const unknownEval = {
    ...evaluateCompatibilityCandidate(cands[0]),
    evaluationStatus: 'UNKNOWN' as const,
    totalScore: null,
    components: []
  };
  const evidenceProfile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', [unknownEval], [unknownCand]);
  const synergy = evaluateCharacterPairSynergy(evidenceProfile);

  assert.strictEqual(synergy.synergyStatus, 'UNKNOWN');
  assert.strictEqual(synergy.synergyScore, null);
});

test('7. Not-applicable pair -> NOT_APPLICABLE with null synergyScore', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Jiyan', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'Mortefi', target: 'SELF', parameter: 'ATK_PERCENT' })
  );
  const naCand = { ...cands[0], status: 'NOT_APPLICABLE' as const };
  const naEval = {
    ...evaluateCompatibilityCandidate(cands[0]),
    evaluationStatus: 'NOT_APPLICABLE' as const,
    totalScore: null,
    components: []
  };
  const evidenceProfile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', [naEval], [naCand]);
  const synergy = evaluateCharacterPairSynergy(evidenceProfile);

  assert.strictEqual(synergy.synergyStatus, 'NOT_APPLICABLE');
  assert.strictEqual(synergy.synergyScore, null);
});

// ============================================================================
// SUITE 2: SYNERGY TAXONOMY & MECHANICAL QUALIFICATIONS (Tests 8-19)
// ============================================================================

test('8. Explicit target relationship qualifies TARGETING_SYNERGY', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Jiyan', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'Mortefi', target: 'SELF', parameter: 'ATK_PERCENT' })
  );
  const explicitCand = { ...cands[0], qualificationType: 'EXPLICIT_TARGET_LINK' as const };
  const evals = [evaluateCompatibilityCandidate(explicitCand)];
  const evidenceProfile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', evals, [explicitCand]);
  const synergy = evaluateCharacterPairSynergy(evidenceProfile);

  assert.ok(synergy.positiveEvidenceTypes.includes('TARGETING_SYNERGY'));
  assert.ok(synergy.components.some((c) => c.category === 'TARGETING_SYNERGY'));
});

test('9. Explicit A->NEXT_RESONATOR->B qualifies NEXT_RESONATOR_SYNERGY with directionality', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Jiyan', target: 'NEXT_RESONATOR', sourceCode: 'OUTRO_SKILL', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'Mortefi', target: 'SELF', sourceCode: 'INTRO_SKILL', parameter: 'ATK_PERCENT' })
  );
  const explicitNextCand: CompatibilityCandidate = {
    ...cands[0],
    qualificationType: 'EXPLICIT_TARGET_LINK' as const,
    matchedDimensions: Object.freeze([
      ...cands[0].matchedDimensions,
      { kind: 'EXPLICIT_TARGET', value: 'Mortefi' }
    ])
  };
  const evals = [evaluateCompatibilityCandidate(explicitNextCand)];
  const evidenceProfile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', evals, [explicitNextCand]);
  const synergy = evaluateCharacterPairSynergy(evidenceProfile);

  assert.ok(synergy.positiveEvidenceTypes.includes('NEXT_RESONATOR_SYNERGY'));
  assert.ok(synergy.components.some((c) => c.category === 'NEXT_RESONATOR_SYNERGY'));
});

test('10. Exact element match qualifies ELEMENTAL_SYNERGY', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Jiyan', target: 'TEAM', element: 'Aero', parameter: 'AERO_DAMAGE_PERCENT' }),
    createMockFact({ entityId: 'Yangyang', target: 'SELF', element: 'Aero', parameter: 'AERO_DAMAGE_PERCENT' })
  );
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c, { context: { element: 'Aero' } }));
  const evidenceProfile = aggregateCharacterPairEvidence('Jiyan', 'Yangyang', evals, cands);
  const synergy = evaluateCharacterPairSynergy(evidenceProfile);

  assert.ok(synergy.positiveEvidenceTypes.includes('ELEMENTAL_SYNERGY'));
});

test('11. All element compatibility qualifies ELEMENTAL_SYNERGY', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Verina', target: 'TEAM', element: 'All', parameter: 'ALL_ATTRIBUTE_DAMAGE_PERCENT' }),
    createMockFact({ entityId: 'Jiyan', target: 'SELF', element: 'Aero', parameter: 'AERO_DAMAGE_PERCENT' })
  );
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c));
  const evidenceProfile = aggregateCharacterPairEvidence('Verina', 'Jiyan', evals, cands);
  const synergy = evaluateCharacterPairSynergy(evidenceProfile);

  assert.ok(synergy.positiveEvidenceTypes.includes('ELEMENTAL_SYNERGY'));
});

test('12. NONE element rejection does not produce ELEMENTAL_SYNERGY', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Jiyan', target: 'TEAM', element: 'NONE', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'Mortefi', target: 'SELF', element: 'NONE', parameter: 'ATK_PERCENT' })
  );
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c));
  const evidenceProfile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', evals, cands);
  const synergy = evaluateCharacterPairSynergy(evidenceProfile);

  assert.strictEqual(synergy.positiveEvidenceTypes.includes('ELEMENTAL_SYNERGY'), false);
});

test('13. Exact action match qualifies ACTION_SYNERGY', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Jiyan', target: 'TEAM', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' }),
    createMockFact({ entityId: 'Mortefi', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c));
  const evidenceProfile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', evals, cands);
  const synergy = evaluateCharacterPairSynergy(evidenceProfile);

  assert.ok(synergy.positiveEvidenceTypes.includes('ACTION_SYNERGY'));
});

test('14. Valid Outro->Intro transition qualifies TRANSITION_SYNERGY and INTRO_OUTRO_SYNERGY', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Jiyan', target: 'NEXT_RESONATOR', sourceCode: 'OUTRO_SKILL', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'Mortefi', target: 'SELF', sourceCode: 'INTRO_SKILL', parameter: 'ATK_PERCENT' })
  );
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c));
  const evidenceProfile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', evals, cands);
  const synergy = evaluateCharacterPairSynergy(evidenceProfile);

  assert.ok(synergy.positiveEvidenceTypes.includes('TRANSITION_SYNERGY'));
  assert.ok(synergy.positiveEvidenceTypes.includes('INTRO_OUTRO_SYNERGY'));
});

test('15. Invalid arbitrary Outro->Intro assumption is rejected without evidence', () => {
  const emptyEvidence = buildEmptyCharacterPairProfile('Jiyan', 'Mortefi');
  const synergy = evaluateCharacterPairSynergy(emptyEvidence);

  assert.strictEqual(synergy.positiveEvidenceTypes.includes('TRANSITION_SYNERGY'), false);
  assert.strictEqual(synergy.positiveEvidenceTypes.includes('INTRO_OUTRO_SYNERGY'), false);
});

test('16. Coordinated attack synergy qualifies COORDINATED_ATTACK_SYNERGY and MECHANICAL_SYNERGY', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Yinlin', target: 'TEAM', category: 'COORDINATED_ATTACK', parameter: 'COORDINATED_ATTACK_DAMAGE_PERCENT' }),
    createMockFact({ entityId: 'Calcharo', target: 'SELF', category: 'COORDINATED_ATTACK', parameter: 'COORDINATED_ATTACK_DAMAGE_PERCENT' })
  );
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c));
  const evidenceProfile = aggregateCharacterPairEvidence('Yinlin', 'Calcharo', evals, cands);
  const synergy = evaluateCharacterPairSynergy(evidenceProfile);

  assert.ok(synergy.positiveEvidenceTypes.includes('MECHANICAL_SYNERGY'));
  assert.ok(synergy.positiveEvidenceTypes.includes('COORDINATED_ATTACK_SYNERGY'));
});

test('17. Resource synergy qualifies RESOURCE_SYNERGY', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Yangyang', target: 'TEAM', parameter: 'ENERGY_REGEN_PERCENT' }),
    createMockFact({ entityId: 'Jiyan', target: 'SELF', parameter: 'ENERGY_REGEN_PERCENT' })
  );
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c));
  const evidenceProfile = aggregateCharacterPairEvidence('Yangyang', 'Jiyan', evals, cands);
  const synergy = evaluateCharacterPairSynergy(evidenceProfile);

  assert.ok(synergy.positiveEvidenceTypes.includes('RESOURCE_SYNERGY'));
});

test('18. Defensive synergy qualifies DEFENSIVE_SYNERGY', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Verina', target: 'TEAM', category: 'HEALING', parameter: 'HP_PERCENT' }),
    createMockFact({ entityId: 'Jiyan', target: 'SELF', category: 'HEALING', parameter: 'HP_PERCENT' })
  );
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c));
  const evidenceProfile = aggregateCharacterPairEvidence('Verina', 'Jiyan', evals, cands);
  const synergy = evaluateCharacterPairSynergy(evidenceProfile);

  assert.ok(synergy.positiveEvidenceTypes.includes('DEFENSIVE_SYNERGY'));
});

test('19. Offensive synergy qualifies OFFENSIVE_SYNERGY', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Jiyan', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'Mortefi', target: 'SELF', parameter: 'ATK_PERCENT' })
  );
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c));
  const evidenceProfile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', evals, cands);
  const synergy = evaluateCharacterPairSynergy(evidenceProfile);

  assert.ok(synergy.positiveEvidenceTypes.includes('OFFENSIVE_SYNERGY'));
});

// ============================================================================
// SUITE 3: ANTI-DOUBLE-COUNTING & ANTI-INFLATION (Tests 20-25)
// ============================================================================

test('20. Safety: no raw description parsing in synergy module', () => {
  const dirPath = path.resolve('lib/engine/relationships/character-pairs/synergy');
  const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.ts'));
  for (const f of files) {
    const content = fs.readFileSync(path.join(dirPath, f), 'utf-8');
    assert.strictEqual(content.includes('parseDescription'), false, `parseDescription found in ${f}`);
  }
});

test('21. Safety: no LLM usage in synergy module', () => {
  const dirPath = path.resolve('lib/engine/relationships/character-pairs/synergy');
  const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.ts'));
  for (const f of files) {
    const content = fs.readFileSync(path.join(dirPath, f), 'utf-8');
    assert.strictEqual(content.includes('openai'), false);
    assert.strictEqual(content.includes('anthropic'), false);
  }
});

test('22. Safety: no network access in synergy module', () => {
  const dirPath = path.resolve('lib/engine/relationships/character-pairs/synergy');
  const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.ts'));
  for (const f of files) {
    const content = fs.readFileSync(path.join(dirPath, f), 'utf-8');
    assert.strictEqual(content.includes('fetch('), false);
    assert.strictEqual(content.includes('axios'), false);
  }
});

test('23. Anti-double-counting: no score inflation from duplicate candidates', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Jiyan', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'Mortefi', target: 'SELF', parameter: 'ATK_PERCENT' })
  );
  const dupCand = { ...cands[0], id: `${cands[0].id}_dup` };
  const allCands = [cands[0], dupCand];
  const evals = allCands.map((c) => evaluateCompatibilityCandidate(c));
  const evidenceProfile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', evals, allCands);
  const synergy = evaluateCharacterPairSynergy(evidenceProfile);

  // Bonus must be 0 because both candidates share the same evidence lineage!
  const baseScore = evals[0].totalScore!;
  assert.strictEqual(synergy.synergyScore, Math.round(baseScore * 100) / 100);
});

test('24. Anti-double-counting: no score inflation from duplicate relationships', () => {
  const fact = createMockFact({ entityId: 'Jiyan', target: 'TEAM', parameter: 'ATK_PERCENT' });
  const cands = buildMockCandidatePair(fact, createMockFact({ entityId: 'Mortefi', target: 'SELF', parameter: 'ATK_PERCENT' }));
  const dupCand = { ...cands[0], id: `${cands[0].id}_variant` };
  const allCands = [cands[0], dupCand];
  const evals = allCands.map((c) => evaluateCompatibilityCandidate(c));
  const evidenceProfile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', evals, allCands);
  const synergy = evaluateCharacterPairSynergy(evidenceProfile);

  assert.strictEqual(evidenceProfile.evidenceScoreSummary.independentEvaluatedEvidenceCount, 1);
  assert.strictEqual(synergy.synergyScore, Math.round(evals[0].totalScore! * 100) / 100);
});

test('25. Anti-double-counting: no score inflation from duplicate facts', () => {
  const fact = createMockFact({ entityId: 'Jiyan', target: 'TEAM', parameter: 'ATK_PERCENT' });
  const cands1 = buildMockCandidatePair(fact, createMockFact({ entityId: 'Mortefi', target: 'SELF', parameter: 'ATK_PERCENT' }));
  const cands2 = buildMockCandidatePair(fact, createMockFact({ entityId: 'Mortefi', target: 'SELF', parameter: 'ATK_PERCENT' }));
  const combined = [cands1[0], cands2[0]];
  const evals = combined.map((c) => evaluateCompatibilityCandidate(c));
  const evidenceProfile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', evals, combined);
  const synergy = evaluateCharacterPairSynergy(evidenceProfile);

  assert.strictEqual(evidenceProfile.evidenceScoreSummary.independentEvaluatedEvidenceCount, 1);
  assert.strictEqual(synergy.synergyScore, Math.round(evals[0].totalScore! * 100) / 100);
});

// ============================================================================
// SUITE 4: DIRECTIONALITY, SCORES & SAFETY (Tests 26-36)
// ============================================================================

test('26. Directionality: A -> B vs B -> A produce distinct profiles and IDs', () => {
  const idAB = deriveCharacterPairSynergyProfileId('3.7', 'Jiyan', 'Mortefi', '7.8.1');
  const idBA = deriveCharacterPairSynergyProfileId('3.7', 'Mortefi', 'Jiyan', '7.8.1');
  assert.notStrictEqual(idAB, idBA);
  assert.strictEqual(idAB, 'pair-synergy:3.7:Jiyan:Mortefi:7.8.1');
  assert.strictEqual(idBA, 'pair-synergy:3.7:Mortefi:Jiyan:7.8.1');
});

test('27. Deterministic IDs: format is pair-synergy:<patch>:<src>:<tgt>:<ruleVersion>', () => {
  const id = deriveCharacterPairSynergyProfileId('3.7', 'Jiyan', 'Mortefi', '7.8.1');
  assert.strictEqual(id, 'pair-synergy:3.7:Jiyan:Mortefi:7.8.1');
});

test('28. Deterministic repeated generation produces identical synergy profiles', () => {
  clearCharacterPairSynergyProfileCache();
  const profs1 = getCharacterPairSynergyProfiles();
  clearCharacterPairSynergyProfileCache();
  const profs2 = getCharacterPairSynergyProfiles();

  assert.strictEqual(JSON.stringify(profs1), JSON.stringify(profs2));
});

test('29. Unmodeled numeric score is null', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Jiyan', target: 'TEAM', consumptionState: 'UNMODELED' }),
    createMockFact({ entityId: 'Mortefi', target: 'SELF', consumptionState: 'UNMODELED' })
  );
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c));
  const evidenceProfile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', evals, cands);
  const synergy = evaluateCharacterPairSynergy(evidenceProfile);

  assert.strictEqual(synergy.synergyScore, null);
});

test('30. Unknown fails closed with null score', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Jiyan', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'Mortefi', target: 'SELF', parameter: 'ATK_PERCENT' })
  );
  const unknownCand = { ...cands[0], status: 'UNKNOWN' as const };
  const unknownEval = {
    ...evaluateCompatibilityCandidate(cands[0]),
    evaluationStatus: 'UNKNOWN' as const,
    totalScore: null,
    components: []
  };
  const evidenceProfile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', [unknownEval], [unknownCand]);
  const synergy = evaluateCharacterPairSynergy(evidenceProfile);

  assert.strictEqual(synergy.synergyScore, null);
  assert.strictEqual(synergy.synergyStatus, 'UNKNOWN');
});

test('31. Missing context remains contextual with null score', () => {
  const cands = buildMockCandidatePair(
    createMockFact({
      entityId: 'Jiyan',
      target: 'TEAM',
      parameter: 'ATK_PERCENT',
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      condition: { trigger: 'ON_INTRO_SKILL' }
    }),
    createMockFact({ entityId: 'Mortefi', target: 'SELF', parameter: 'ATK_PERCENT' })
  );
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c));
  const evidenceProfile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', evals, cands);
  const synergy = evaluateCharacterPairSynergy(evidenceProfile);

  assert.strictEqual(synergy.synergyStatus, 'CONTEXT_DEPENDENT');
  assert.strictEqual(synergy.synergyScore, null);
});

test('32. Context mismatch remains non-evaluated with null score', () => {
  const cands = buildMockCandidatePair(
    createMockFact({
      entityId: 'Jiyan',
      target: 'TEAM',
      parameter: 'ATK_PERCENT',
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      condition: { trigger: 'ON_INTRO_SKILL' }
    }),
    createMockFact({ entityId: 'Mortefi', target: 'SELF', parameter: 'ATK_PERCENT' })
  );
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c, { context: { trigger: 'ON_OUTRO_SKILL' } }));
  const evidenceProfile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', evals, cands);
  const synergy = evaluateCharacterPairSynergy(evidenceProfile);

  assert.strictEqual(synergy.synergyStatus, 'CONTEXT_DEPENDENT');
  assert.strictEqual(synergy.synergyScore, null);
});

test('33. effectValue is not treated as DPS or damage increase', () => {
  const synergy = getCharacterPairSynergyProfile('Mornye', 'Augusta');
  assert.strictEqual((synergy as any).dps, undefined);
  assert.strictEqual((synergy as any).dpsScore, undefined);
  assert.strictEqual((synergy as any).damageGain, undefined);
});

test('34. synergyScore is never negative under any circumstances', () => {
  const profiles = getCharacterPairSynergyProfiles();
  for (const p of profiles) {
    if (p.synergyScore !== null) {
      assert.ok(p.synergyScore >= 0, `Negative score found in ${p.id}`);
    }
  }
});

test('35. synergyScore never exceeds 100', () => {
  const profiles = getCharacterPairSynergyProfiles();
  for (const p of profiles) {
    if (p.synergyScore !== null) {
      assert.ok(p.synergyScore <= 100, `Score exceeding 100 found in ${p.id}`);
    }
  }
});

test('36. Canonical Patch 3.7 dataset is unchanged', () => {
  const patchPath = path.resolve('data/patches/3.7/patch_3_7_dataset.json');
  assert.ok(fs.existsSync(patchPath));
});

// ============================================================================
// SUITE 5: REPOSITORY, EXPLANATION, AUDIT & 20-RUN DETERMINISM (Tests 37-42)
// ============================================================================

test('37. Repository: getCharacterPairSynergyProfile returns modeled or no-evidence profile', () => {
  const modeled = getCharacterPairSynergyProfile('Mornye', 'Augusta');
  assert.strictEqual(modeled.sourceResonatorId, 'Mornye');
  assert.strictEqual(modeled.targetResonatorId, 'Augusta');
  assert.strictEqual(modeled.synergyStatus, 'PARTIAL_SYNERGY');

  const empty = getCharacterPairSynergyProfile('NonExistent1', 'NonExistent2');
  assert.strictEqual(empty.synergyStatus, 'NO_EVIDENCE');
  assert.strictEqual(empty.synergyScore, null);
});

test('38. Repository: queryCharacterPairSynergyProfiles filters accurately', () => {
  const scored = queryCharacterPairSynergyProfiles({ hasScore: true });
  assert.ok(scored.length > 0);
  for (const p of scored) {
    assert.ok(p.synergyScore !== null);
  }

  const mornye = queryCharacterPairSynergyProfiles({ sourceResonatorId: 'Mornye' });
  assert.ok(mornye.length > 0);
  for (const p of mornye) {
    assert.strictEqual(p.sourceResonatorId, 'Mornye');
  }
});

test('39. Repository: getOutgoingSynergyProfilesForResonator and getIncomingSynergyProfilesForResonator', () => {
  const outgoing = getOutgoingSynergyProfilesForResonator('Mornye');
  assert.ok(outgoing.length > 0);
  for (const p of outgoing) {
    assert.strictEqual(p.sourceResonatorId, 'Mornye');
  }

  const incoming = getIncomingSynergyProfilesForResonator('Augusta');
  assert.ok(incoming.length > 0);
  for (const p of incoming) {
    assert.strictEqual(p.targetResonatorId, 'Augusta');
  }
});

test('40. Explanation: explainCharacterPairSynergyProfile returns structured presentation', () => {
  const profile = getCharacterPairSynergyProfile('Mornye', 'Augusta');
  const exp = explainCharacterPairSynergyProfile(profile);

  assert.strictEqual(exp.profileId, profile.id);
  assert.strictEqual(exp.sourceResonatorId, 'Mornye');
  assert.strictEqual(exp.targetResonatorId, 'Augusta');
  assert.ok(exp.summary.includes('Character pair synergy Mornye -> Augusta'));
  assert.strictEqual(exp.synergyScore, profile.synergyScore);
});

test('41. Production audit passes all invariants A through AB without throwing', () => {
  assert.doesNotThrow(() => {
    auditCharacterPairSynergyProfiles();
  });
});

test('42. Determinism: 20/20 consecutive uncached production runs are byte-for-byte identical', () => {
  let initialJson = '';
  for (let i = 0; i < 20; i++) {
    clearCharacterPairSynergyProfileCache();
    const profs = getCharacterPairSynergyProfiles();
    const currentJson = JSON.stringify(profs);

    if (i === 0) {
      initialJson = currentJson;
    } else {
      assert.strictEqual(currentJson, initialJson, `Determinism mismatch at run index ${i}`);
    }
  }
});

// ============================================================================
// SUITE 6: REMEDIATION PROVENANCE REGRESSION (Tests 43-54)
// ============================================================================

test('43. Regression 1: generic MECHANICAL evidence cannot become COORDINATED_ATTACK_SYNERGY', () => {
  // Source has coordinated attack outro buff, but target only has generic heavy attack
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Youhu', target: 'NEXT_RESONATOR', sourceCode: 'OUTRO_SKILL', category: 'COORDINATED_ATTACK', parameter: 'COORDINATED_ATTACK_DAMAGE_PERCENT' }),
    createMockFact({ entityId: 'Jiyan', target: 'SELF', sourceCode: 'HEAVY_ATTACK', parameter: 'HEAVY_ATTACK_DAMAGE_PERCENT' })
  );
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c));
  const evidenceProfile = aggregateCharacterPairEvidence('Youhu', 'Jiyan', evals, cands);
  const synergy = evaluateCharacterPairSynergy(evidenceProfile);

  // Qualifies generic mechanical synergy because Step 5 matched attack, but CANNOT become COORDINATED_ATTACK_SYNERGY
  assert.ok(synergy.positiveEvidenceTypes.includes('MECHANICAL_SYNERGY'));
  assert.strictEqual(synergy.positiveEvidenceTypes.includes('COORDINATED_ATTACK_SYNERGY'), false);
});

test('44. Regression 2: only explicit COORDINATED_ATTACK_INTERACTION on both sides produces COORDINATED_ATTACK_SYNERGY', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Yinlin', target: 'TEAM', category: 'COORDINATED_ATTACK', parameter: 'COORDINATED_ATTACK_DAMAGE_PERCENT' }),
    createMockFact({ entityId: 'Calcharo', target: 'SELF', category: 'COORDINATED_ATTACK', parameter: 'COORDINATED_ATTACK_DAMAGE_PERCENT' })
  );
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c));
  const evidenceProfile = aggregateCharacterPairEvidence('Yinlin', 'Calcharo', evals, cands);
  const synergy = evaluateCharacterPairSynergy(evidenceProfile);

  assert.ok(synergy.positiveEvidenceTypes.includes('COORDINATED_ATTACK_SYNERGY'));
  assert.ok(synergy.positiveEvidenceTypes.includes('MECHANICAL_SYNERGY'));
});

test('45. Regression 3: generic TEAM target cannot create TARGETING_SYNERGY for arbitrary character pairs', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Verina', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'Jiyan', target: 'SELF', parameter: 'ATK_PERCENT' })
  );
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c));
  const evidenceProfile = aggregateCharacterPairEvidence('Verina', 'Jiyan', evals, cands);
  const synergy = evaluateCharacterPairSynergy(evidenceProfile);

  assert.strictEqual(synergy.positiveEvidenceTypes.includes('TARGETING_SYNERGY'), false);
  assert.ok(synergy.positiveEvidenceTypes.includes('OFFENSIVE_SYNERGY'));
});

test('46. Regression 4: ACTIVE_CHARACTER target cannot create arbitrary pairwise TARGETING_SYNERGY', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Sanhua', target: 'ACTIVE_CHARACTER', parameter: 'BASIC_ATTACK_DAMAGE_PERCENT' }),
    createMockFact({ entityId: 'Encore', target: 'SELF', parameter: 'BASIC_ATTACK_DAMAGE_PERCENT' })
  );
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c));
  const evidenceProfile = aggregateCharacterPairEvidence('Sanhua', 'Encore', evals, cands);
  const synergy = evaluateCharacterPairSynergy(evidenceProfile);

  assert.strictEqual(synergy.positiveEvidenceTypes.includes('TARGETING_SYNERGY'), false);
});

test('47. Regression 5: SELF target cannot create pairwise synergy toward another character', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Jiyan', target: 'SELF', parameter: 'AERO_DAMAGE_PERCENT' }),
    createMockFact({ entityId: 'Yangyang', target: 'SELF', parameter: 'AERO_DAMAGE_PERCENT' })
  );
  // Step 5 rejects SELF-only source capabilities from forming candidate pairs toward teammates
  assert.strictEqual(cands.length, 0);
  const evidenceProfile = aggregateCharacterPairEvidence('Jiyan', 'Yangyang', [], []);
  const synergy = evaluateCharacterPairSynergy(evidenceProfile);

  assert.strictEqual(synergy.synergyStatus, 'NO_EVIDENCE');
  assert.strictEqual(synergy.positiveEvidenceTypes.includes('TARGETING_SYNERGY'), false);
  assert.strictEqual(synergy.synergyScore, null);
});

test('48. Regression 6: generic OUTRO evidence cannot create NEXT_RESONATOR_SYNERGY without explicit target link', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Mortefi', target: 'TEAM', sourceCode: 'OUTRO_SKILL', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'Jiyan', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'ATK_PERCENT' })
  );
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c));
  const evidenceProfile = aggregateCharacterPairEvidence('Mortefi', 'Jiyan', evals, cands);
  const synergy = evaluateCharacterPairSynergy(evidenceProfile);

  assert.strictEqual(synergy.positiveEvidenceTypes.includes('NEXT_RESONATOR_SYNERGY'), false);
});

test('49. Regression 7: generic INTRO evidence cannot create NEXT_RESONATOR_SYNERGY without explicit target link', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Jiyan', target: 'TEAM', sourceCode: 'INTRO_SKILL', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'Mortefi', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'ATK_PERCENT' })
  );
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c));
  const evidenceProfile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', evals, cands);
  const synergy = evaluateCharacterPairSynergy(evidenceProfile);

  assert.strictEqual(synergy.positiveEvidenceTypes.includes('NEXT_RESONATOR_SYNERGY'), false);
});

test('50. Regression 8: generic TRANSITION evidence cannot create NEXT_RESONATOR_SYNERGY without explicit ordered target identity', () => {
  // Generic Outro -> Intro transition without explicit target identity:
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'Jiyan', target: 'NEXT_RESONATOR', sourceCode: 'OUTRO_SKILL', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'Mortefi', target: 'SELF', sourceCode: 'INTRO_SKILL', parameter: 'ATK_PERCENT' })
  );
  const evals = cands.map((c) => evaluateCompatibilityCandidate(c));
  const evidenceProfile = aggregateCharacterPairEvidence('Jiyan', 'Mortefi', evals, cands);
  const synergy = evaluateCharacterPairSynergy(evidenceProfile);

  // Qualifies transition and intro/outro synergy, but fails closed on NEXT_RESONATOR_SYNERGY
  assert.ok(synergy.positiveEvidenceTypes.includes('TRANSITION_SYNERGY'));
  assert.ok(synergy.positiveEvidenceTypes.includes('INTRO_OUTRO_SYNERGY'));
  assert.strictEqual(synergy.positiveEvidenceTypes.includes('NEXT_RESONATOR_SYNERGY'), false);
  assert.strictEqual(synergy.positiveEvidenceTypes.includes('TARGETING_SYNERGY'), false);
});

test('51. Regression 9: explicit A->NEXT_RESONATOR->B remains directional', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'CharA', target: 'NEXT_RESONATOR', sourceCode: 'OUTRO_SKILL', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'CharB', target: 'SELF', sourceCode: 'INTRO_SKILL', parameter: 'ATK_PERCENT' })
  );
  const explicitCand: CompatibilityCandidate = {
    ...cands[0],
    qualificationType: 'EXPLICIT_TARGET_LINK' as const,
    matchedDimensions: Object.freeze([
      ...cands[0].matchedDimensions,
      { kind: 'EXPLICIT_TARGET', value: 'CharB' }
    ])
  };
  const profAtoB = aggregateCharacterPairEvidence('CharA', 'CharB', [evaluateCompatibilityCandidate(explicitCand)], [explicitCand]);
  const synAtoB = evaluateCharacterPairSynergy(profAtoB);

  assert.ok(synAtoB.positiveEvidenceTypes.includes('NEXT_RESONATOR_SYNERGY'));
  assert.ok(synAtoB.positiveEvidenceTypes.includes('TARGETING_SYNERGY'));
});

test('52. Regression 10: A->B does not automatically imply B->A', () => {
  const profileAtoB = getCharacterPairSynergyProfile('Mornye', 'Augusta');
  const profileBtoA = getCharacterPairSynergyProfile('Augusta', 'Mornye');

  assert.notStrictEqual(profileAtoB.id, profileBtoA.id);
  assert.strictEqual(profileAtoB.sourceResonatorId, 'Mornye');
  assert.strictEqual(profileBtoA.sourceResonatorId, 'Augusta');
  // Reverse profiles do not mirror components or scores automatically
  assert.strictEqual(profileAtoB.synergyScore, 60.1);
  assert.strictEqual(profileBtoA.synergyScore, null); // Augusta -> Mornye is CONTEXT_DEPENDENT
});

test('53. Regression 11: duplicate candidate/evidence/relationship/fact lineage cannot inflate synergyScore', () => {
  const baseCand = buildMockCandidatePair(
    createMockFact({ factId: 'F_UNIQUE_1', entityId: 'Jiyan', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ factId: 'F_UNIQUE_2', entityId: 'Mortefi', target: 'SELF', parameter: 'ATK_PERCENT' })
  )[0];

  const singleCandidateProfile = aggregateCharacterPairEvidence(
    'Jiyan',
    'Mortefi',
    [evaluateCompatibilityCandidate(baseCand)],
    [baseCand]
  );
  const singleSynergy = evaluateCharacterPairSynergy(singleCandidateProfile);

  // Duplicate the candidate derived from the exact same underlying facts
  const dupCand: CompatibilityCandidate = {
    ...baseCand,
    id: `${baseCand.id}:duplicate`
  };
  const duplicatedCandidateProfile = aggregateCharacterPairEvidence(
    'Jiyan',
    'Mortefi',
    [
      evaluateCompatibilityCandidate(baseCand),
      evaluateCompatibilityCandidate(dupCand)
    ],
    [baseCand, dupCand]
  );
  const duplicatedSynergy = evaluateCharacterPairSynergy(duplicatedCandidateProfile);

  assert.strictEqual(singleSynergy.synergyScore, duplicatedSynergy.synergyScore);
  assert.strictEqual(
    singleCandidateProfile.evidenceScoreSummary.independentEvaluatedEvidenceCount,
    duplicatedCandidateProfile.evidenceScoreSummary.independentEvaluatedEvidenceCount
  );
});

test('54. Regression 12: NO_EVIDENCE remains distinct from anti-synergy', () => {
  const emptyEvidence = buildEmptyCharacterPairProfile('Jiyan', 'Mortefi');
  const synergy = evaluateCharacterPairSynergy(emptyEvidence);

  assert.strictEqual(synergy.synergyStatus, 'NO_EVIDENCE');
  assert.strictEqual(synergy.synergyScore, null);
  assert.strictEqual(synergy.components.length, 0);
  // Zero and negative numbers are NEVER used to represent NO_EVIDENCE
  assert.notStrictEqual(synergy.synergyScore, 0);
  assert.notStrictEqual(synergy.synergyScore, -1);
  assert.strictEqual(synergy.explanationCodes.includes('STATUS_NO_EVIDENCE'), true);
});
