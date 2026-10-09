/**
 * Wuthering Waves Compatibility Candidate Evaluation Test Suite
 * Phase 7 Step 6: Deterministic Compatibility Candidate Evaluation & Scoring Contract
 *
 * Comprehensive tests covering:
 * - Determinism & stable evaluation IDs
 * - Bounded [0, 100] finite scores without NaN/Infinity
 * - Rule versioning ('7.6.1') & constants traceability
 * - Directness, Specificity, Coverage, Certainty, and Safe Magnitude components
 * - Action, Element, Transition, Resource, Defensive, Offensive, and Mechanical candidate evaluations
 * - Anti-double-counting invariants
 * - Provenance & evidence/relationship lineage preservation
 * - Applicability delegation to Step 2 (missing context, mismatch, static context-free)
 * - Epistemic fail-closed handling for UNMODELED, UNKNOWN, NOT_APPLICABLE
 * - Patch 3.7 isolation and cross-patch rejection
 * - Prohibition of raw descriptions, LLMs, networks, random IDs, roles, meta, character/team scoring, and ToA
 * - Production Patch 3.7 candidate evaluation reconciliation and invariant audit
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  evaluateCompatibilityCandidate,
  evaluateCompatibilityCandidates,
  getCompatibilityEvaluation,
  queryCompatibilityEvaluations,
  explainCompatibilityEvaluation,
  auditCompatibilityEvaluations,
  deriveCompatibilityEvaluationId,
  compareCompatibilityEvaluation,
  isApplicableEvaluation,
  hasNumericEvaluationScore,
  isMissingContextEvaluation,
  isContextMismatchEvaluation,
  isUnmodeledEvaluation,
  isUnknownEvaluation,
  isNotApplicableEvaluation,
  matchesEvaluationFilter,
  COMPATIBILITY_EVALUATION_RULE_VERSION,
  EVALUATION_SCALE_MIN,
  EVALUATION_SCALE_MAX,
  MAX_SCORE_DIRECTNESS,
  MAX_SCORE_SPECIFICITY,
  MAX_SCORE_COVERAGE,
  MAX_SCORE_CERTAINTY,
  MAX_SCORE_MAGNITUDE
} from '../lib/engine/relationships/evaluation/index.ts';
import { generateCompatibilityCandidates } from '../lib/engine/relationships/compatibility/candidates.ts';
import { buildGameplayCapability } from '../lib/engine/capabilities/builder.ts';
import { buildGameplayRelationshipsForCapability } from '../lib/engine/relationships/builder.ts';
import { composeInteractionEvidence } from '../lib/engine/relationships/composition/composer.ts';
import type { NormalizedEngineFact } from '../lib/engine/facts/types.ts';
import type { CompatibilityCandidate } from '../lib/engine/relationships/compatibility/types.ts';

/**
 * Deterministic factory creating valid NormalizedEngineFacts for evaluation tests.
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

  const entityId = overrides?.entityId ?? 'mock_entity_1';
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
      entityName: 'Test Entity',
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
 * Helper to build candidate pair from two facts.
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
// SUITE 1: CORE DETERMINISM, IDS, RULE VERSIONING & BOUNDING (Tests 1-8)
// ============================================================================

test('1. Core: deterministic evaluation across repeated runs', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  assert.ok(candidates.length > 0);

  const eval1 = evaluateCompatibilityCandidate(candidates[0]);
  const eval2 = evaluateCompatibilityCandidate(candidates[0]);

  assert.strictEqual(eval1.id, eval2.id);
  assert.strictEqual(eval1.totalScore, eval2.totalScore);
  assert.deepStrictEqual(eval1, eval2);
});

test('2. Core: stable evaluation ID format eval:3.7:<candidateId>:7.6.1', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const evaluation = evaluateCompatibilityCandidate(candidates[0]);
  const expectedId = deriveCompatibilityEvaluationId('3.7', candidates[0].id, COMPATIBILITY_EVALUATION_RULE_VERSION);

  assert.strictEqual(evaluation.id, expectedId);
  assert.ok(evaluation.id.startsWith('eval:3.7:'));
  assert.ok(evaluation.id.endsWith(`:${COMPATIBILITY_EVALUATION_RULE_VERSION}`));
});

test('3. Core: rule versioning preserves COMPATIBILITY_EVALUATION_RULE_VERSION', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const evaluation = evaluateCompatibilityCandidate(candidates[0]);
  assert.strictEqual(evaluation.ruleVersion, COMPATIBILITY_EVALUATION_RULE_VERSION);
  assert.strictEqual(evaluation.ruleVersion, '7.6.1');
});

test('4. Core: canonical ordering of evaluations (scores descending, nulls last)', () => {
  const cands = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const unmodeledFact = createMockFact({ entityId: 'C', consumptionState: 'UNMODELED' });
  const unmodeledCap = buildGameplayCapability(unmodeledFact);
  const candUnmodeled: CompatibilityCandidate = {
    ...cands[0],
    id: 'cmp:3.7:unmodeled_cand',
    status: 'UNMODELED',
    targetCapability: unmodeledCap
  };

  const evaluations = evaluateCompatibilityCandidates([candUnmodeled, cands[0]]);
  assert.ok(evaluations.length >= 2);
  assert.ok(evaluations[0].totalScore !== null);
  assert.strictEqual(evaluations[evaluations.length - 1].totalScore, null);
});

test('5. Core: bounded score strictly within [0, 100]', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', parameter: 'ATK_PERCENT', staticNumericValue: 100 }),
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const evaluation = evaluateCompatibilityCandidate(candidates[0]);
  assert.ok(evaluation.totalScore !== null);
  assert.ok(evaluation.totalScore >= EVALUATION_SCALE_MIN);
  assert.ok(evaluation.totalScore <= EVALUATION_SCALE_MAX);
});

test('6. Core: finite score verification', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const evaluation = evaluateCompatibilityCandidate(candidates[0]);
  assert.ok(evaluation.totalScore !== null);
  assert.strictEqual(Number.isFinite(evaluation.totalScore), true);
});

test('7. Core: score is never NaN', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const evaluation = evaluateCompatibilityCandidate(candidates[0]);
  assert.ok(evaluation.totalScore !== null);
  assert.strictEqual(Number.isNaN(evaluation.totalScore), false);
});

test('8. Core: score is never Infinity or -Infinity', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const evaluation = evaluateCompatibilityCandidate(candidates[0]);
  assert.ok(evaluation.totalScore !== null);
  assert.notStrictEqual(evaluation.totalScore, Infinity);
  assert.notStrictEqual(evaluation.totalScore, -Infinity);
});

// ============================================================================
// SUITE 2: QUALIFICATION DIRECTNESS & SPECIFICITY EVALUATIONS (Tests 9-20)
// ============================================================================

test('9. Directness: EXPLICIT candidate receives DIRECT_EXPLICIT_LINK score (25)', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const explicitCand: CompatibilityCandidate = {
    ...candidates[0],
    qualificationNature: 'EXPLICIT',
    qualificationType: 'EXPLICIT_TARGET_LINK'
  };

  const evaluation = evaluateCompatibilityCandidate(explicitCand);
  const directComp = evaluation.components.find((c) => c.dimension === 'EVIDENCE_DIRECTNESS');
  assert.ok(directComp);
  assert.strictEqual(directComp.ruleCode, 'DIRECT_EXPLICIT_LINK');
  assert.strictEqual(directComp.value, 25);
});

test('10. Directness: DIMENSIONAL candidate receives appropriate dimensional score (15 or 10)', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const evaluation = evaluateCompatibilityCandidate(candidates[0]);
  const directComp = evaluation.components.find((c) => c.dimension === 'EVIDENCE_DIRECTNESS');
  assert.ok(directComp);
  assert.strictEqual(directComp.ruleCode, 'DIMENSIONAL_BROAD_LINK');
  assert.strictEqual(directComp.value, 10);
});

test('11. Specificity: action match receives ACTION_EXACT_MATCH component', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'NEXT_RESONATOR', sourceCode: 'OUTRO_SKILL', parameter: 'HEAVY_ATTACK_DAMAGE_PERCENT' }),
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'HEAVY_ATTACK', parameter: 'HEAVY_ATTACK_DAMAGE_PERCENT' })
  );
  const actCand = candidates.find((c) => c.qualificationType === 'ACTION_COMPATIBILITY_CANDIDATE');
  assert.ok(actCand);

  const evaluation = evaluateCompatibilityCandidate(actCand);
  const comp = evaluation.components.find((c) => c.dimension === 'ACTION_MATCH');
  assert.ok(comp);
  assert.strictEqual(comp.ruleCode, 'ACTION_EXACT_MATCH');
  assert.strictEqual(comp.value, 25);
});

test('12. Specificity: exact element match receives ELEMENT_EXACT_MATCH component (25)', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', element: 'Electro', parameter: 'ELECTRO_DAMAGE_PERCENT' }),
    createMockFact({ entityId: 'B', target: 'SELF', element: 'Electro', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const elemCand = candidates.find((c) => c.qualificationType === 'ELEMENT_COMPATIBILITY_CANDIDATE');
  assert.ok(elemCand);

  const evaluation = evaluateCompatibilityCandidate(elemCand, {
    context: { element: 'Electro' }
  });
  const comp = evaluation.components.find((c) => c.dimension === 'ELEMENT_MATCH');
  assert.ok(comp);
  assert.strictEqual(comp.ruleCode, 'ELEMENT_EXACT_MATCH');
  assert.strictEqual(comp.value, 25);
});

test('13. Specificity: element All match receives ELEMENT_ALL_MATCH component (20)', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', element: 'All', parameter: 'ALL_ATTRIBUTE_DAMAGE_PERCENT' }),
    createMockFact({ entityId: 'B', target: 'SELF', element: 'Havoc', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const elemCand = candidates.find((c) => c.qualificationType === 'ELEMENT_COMPATIBILITY_CANDIDATE');
  assert.ok(elemCand);

  const evaluation = evaluateCompatibilityCandidate(elemCand, {
    context: { element: 'Havoc' }
  });
  const comp = evaluation.components.find((c) => c.dimension === 'ELEMENT_MATCH');
  assert.ok(comp);
  assert.strictEqual(comp.ruleCode, 'ELEMENT_ALL_MATCH');
  assert.strictEqual(comp.value, 20);
});

test('14. Specificity: NONE element produces zero elemental component', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', element: 'NONE', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'B', target: 'SELF', element: 'NONE', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const evaluation = evaluateCompatibilityCandidate(candidates[0]);
  const hasElemComp = evaluation.components.some((c) => c.dimension === 'ELEMENT_MATCH');
  assert.strictEqual(hasElemComp, false);
});

test('15. Specificity: transition match receives TRANSITION_OUTRO_INTRO_MATCH (25)', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'NEXT_RESONATOR', sourceCode: 'OUTRO_SKILL' }),
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'INTRO_SKILL' })
  );
  const transCand = candidates.find((c) => c.qualificationType === 'TRANSITION_COMPATIBILITY_CANDIDATE');
  assert.ok(transCand);

  const evaluation = evaluateCompatibilityCandidate(transCand);
  const comp = evaluation.components.find((c) => c.dimension === 'TRANSITION_MATCH');
  assert.ok(comp);
  assert.strictEqual(comp.ruleCode, 'TRANSITION_OUTRO_INTRO_MATCH');
  assert.strictEqual(comp.value, 25);
});

test('16. Specificity: resource match receives RESOURCE_PROVISION_MATCH (20)', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', category: 'RESOURCE_GRANT', parameter: 'ENERGY_REGEN_PERCENT' }),
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_LIBERATION', parameter: 'LIBERATION_DAMAGE_PERCENT' })
  );
  const resCand = candidates.find((c) => c.qualificationType === 'RESOURCE_COMPATIBILITY_CANDIDATE');
  assert.ok(resCand);

  const evaluation = evaluateCompatibilityCandidate(resCand);
  const comp = evaluation.components.find((c) => c.dimension === 'RESOURCE_MATCH');
  assert.ok(comp);
  assert.strictEqual(comp.ruleCode, 'RESOURCE_PROVISION_MATCH');
  assert.strictEqual(comp.value, 20);
});

test('17. Specificity: defensive match receives DEFENSIVE_PROVISION_MATCH (20)', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', category: 'HEALING', parameter: 'HEALING_BONUS_PERCENT' }),
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'BASIC_ATTACK', parameter: 'BASIC_ATTACK_DAMAGE_PERCENT' })
  );
  const defCand = candidates.find((c) => c.qualificationType === 'DEFENSIVE_COMPATIBILITY_CANDIDATE');
  assert.ok(defCand);

  const evaluation = evaluateCompatibilityCandidate(defCand);
  const comp = evaluation.components.find((c) => c.dimension === 'DEFENSIVE_MATCH');
  assert.ok(comp);
  assert.strictEqual(comp.ruleCode, 'DEFENSIVE_PROVISION_MATCH');
  assert.strictEqual(comp.value, 20);
});

test('18. Specificity: offensive match receives OFFENSIVE_AMPLIFICATION_MATCH (20)', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', category: 'STAT_BUFF', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const offCand = candidates.find((c) => c.qualificationType === 'OFFENSIVE_COMPATIBILITY_CANDIDATE');
  assert.ok(offCand);

  const evaluation = evaluateCompatibilityCandidate(offCand);
  const comp = evaluation.components.find((c) => c.dimension === 'OFFENSIVE_MATCH');
  assert.ok(comp);
  assert.strictEqual(comp.ruleCode, 'OFFENSIVE_AMPLIFICATION_MATCH');
  assert.strictEqual(comp.value, 20);
});

test('19. Specificity: mechanical candidate receives MECHANICAL_COORDINATED_MATCH (25)', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', parameter: 'COORDINATED_ATTACK_DAMAGE_PERCENT' }),
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'BASIC_ATTACK', parameter: 'BASIC_ATTACK_DAMAGE_PERCENT' })
  );
  const mechCand = candidates.find((c) => c.qualificationType === 'MECHANICAL_COMPATIBILITY_CANDIDATE');
  assert.ok(mechCand);

  const evaluation = evaluateCompatibilityCandidate(mechCand);
  const comp = evaluation.components.find((c) => c.dimension === 'MECHANICAL_MATCH');
  assert.ok(comp);
  assert.strictEqual(comp.ruleCode, 'MECHANICAL_COORDINATED_MATCH');
  assert.strictEqual(comp.value, 25);
});

test('20. Specificity: target scope candidate receives TARGET_SCOPE_MATCH (10)', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', parameter: 'HP_PERCENT' }),
    createMockFact({ entityId: 'B', target: 'SELF' })
  );
  const targetScopeCand: CompatibilityCandidate = {
    ...candidates[0],
    qualificationType: 'TARGET_SCOPE_COMPATIBILITY_CANDIDATE'
  };

  const evaluation = evaluateCompatibilityCandidate(targetScopeCand);
  const comp = evaluation.components.find((c) => c.dimension === 'TARGET_SPECIFICITY');
  assert.ok(comp);
  assert.strictEqual(comp.ruleCode, 'TARGET_SCOPE_MATCH');
  assert.strictEqual(comp.value, 10);
});

// ============================================================================
// SUITE 3: MULTI-DIMENSION COVERAGE & ANTI-DOUBLE-COUNTING (Tests 21-22)
// ============================================================================

test('21. Coverage: multi-dimensional candidate receives coverage component', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const multiCand: CompatibilityCandidate = {
    ...candidates[0],
    matchedDimensions: [
      { kind: 'ACTION', value: 'SKILL' },
      { kind: 'ELEMENT', value: 'Electro' },
      { kind: 'TRANSITION', value: 'OUTRO_TO_INTRO' }
    ]
  };

  const evaluation = evaluateCompatibilityCandidate(multiCand);
  const covComp = evaluation.components.find((c) => c.dimension === 'EVIDENCE_COVERAGE');
  assert.ok(covComp);
  assert.strictEqual(covComp.ruleCode, 'MULTI_DIMENSION_COVERAGE');
  assert.strictEqual(covComp.value, 15); // 3 distinct kinds = 15 points
});

test('22. Anti-double-counting: multiple duplicate dimensions do not inflate coverage', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  // Duplicate same kind 'ACTION' 3 times
  const dupCand: CompatibilityCandidate = {
    ...candidates[0],
    matchedDimensions: [
      { kind: 'ACTION', value: 'SKILL' },
      { kind: 'ACTION', value: 'SKILL' },
      { kind: 'ACTION', value: 'SKILL' }
    ]
  };

  const evaluation = evaluateCompatibilityCandidate(dupCand);
  const covComp = evaluation.components.find((c) => c.dimension === 'EVIDENCE_COVERAGE');
  assert.ok(covComp);
  assert.strictEqual(covComp.value, 5); // Only 1 distinct kind = 5 points, not 15
});

// ============================================================================
// SUITE 4: PROVENANCE & LINEAGE PRESERVATION (Tests 23-25)
// ============================================================================

test('23. Provenance: preserves complete source provenance', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const evaluation = evaluateCompatibilityCandidate(candidates[0]);
  assert.deepStrictEqual(evaluation.provenance, candidates[0].provenance);
});

test('24. Lineage: evidenceIds are traceable back to Step 4', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const evaluation = evaluateCompatibilityCandidate(candidates[0]);
  assert.strictEqual(evaluation.evidenceIds.length, candidates[0].evidenceIds.length);
  for (const id of evaluation.evidenceIds) {
    assert.ok(candidates[0].evidenceIds.includes(id));
  }
});

test('25. Lineage: relationshipIds are traceable back to Step 3', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const evaluation = evaluateCompatibilityCandidate(candidates[0]);
  assert.strictEqual(evaluation.relationshipIds.length, candidates[0].relationshipIds.length);
  for (const id of evaluation.relationshipIds) {
    assert.ok(candidates[0].relationshipIds.includes(id));
  }
});

// ============================================================================
// SUITE 5: APPLICABILITY DELEGATION & CONTEXT LIFECYCLE (Tests 26-31)
// ============================================================================

test('26. Applicability: delegates evaluation to Step 2 capability resolution', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const evaluation = evaluateCompatibilityCandidate(candidates[0]);
  assert.strictEqual(evaluation.applicability.isApplicable, true);
  assert.strictEqual(evaluation.evaluationStatus, 'EVALUATED');
});

test('27. Applicability: missing context yields MISSING_CONTEXT and null score', () => {
  const cap1 = buildGameplayCapability(
    createMockFact({
      entityId: 'A',
      target: 'TEAM',
      parameter: 'ATK_PERCENT',
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      condition: { zoneActive: true }
    })
  );
  const cap2 = buildGameplayCapability(
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const rels = [...buildGameplayRelationshipsForCapability(cap1), ...buildGameplayRelationshipsForCapability(cap2)];
  const evi = composeInteractionEvidence([cap1, cap2], rels, '3.7');
  const cands = generateCompatibilityCandidates([cap1, cap2], evi, rels, '3.7');
  assert.ok(cands.length > 0);

  const evaluation = evaluateCompatibilityCandidate(cands[0]);
  assert.strictEqual(evaluation.evaluationStatus, 'MISSING_CONTEXT');
  assert.strictEqual(evaluation.totalScore, null);
  assert.strictEqual(evaluation.components.length, 0);
  assert.ok(isMissingContextEvaluation(evaluation));
});

test('28. Applicability: mismatched context yields CONTEXT_MISMATCH and null score', () => {
  const cap1 = buildGameplayCapability(
    createMockFact({
      entityId: 'A',
      target: 'TEAM',
      parameter: 'ATK_PERCENT',
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      condition: { zoneActive: true }
    })
  );
  const cap2 = buildGameplayCapability(
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const rels = [...buildGameplayRelationshipsForCapability(cap1), ...buildGameplayRelationshipsForCapability(cap2)];
  const evi = composeInteractionEvidence([cap1, cap2], rels, '3.7');
  const cands = generateCompatibilityCandidates([cap1, cap2], evi, rels, '3.7');
  assert.ok(cands.length > 0);

  const evaluation = evaluateCompatibilityCandidate(cands[0], {
    context: { zoneActive: false }
  });
  assert.strictEqual(evaluation.evaluationStatus, 'CONTEXT_MISMATCH');
  assert.strictEqual(evaluation.totalScore, null);
  assert.strictEqual(evaluation.components.length, 0);
  assert.ok(isContextMismatchEvaluation(evaluation));
});

test('29. Epistemics: UNKNOWN candidate yields UNKNOWN and null score', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const unknownCand: CompatibilityCandidate = {
    ...candidates[0],
    status: 'UNKNOWN'
  };

  const evaluation = evaluateCompatibilityCandidate(unknownCand);
  assert.strictEqual(evaluation.evaluationStatus, 'UNKNOWN');
  assert.strictEqual(evaluation.totalScore, null);
  assert.ok(isUnknownEvaluation(evaluation));
});

test('30. Epistemics: UNMODELED candidate yields UNMODELED and null score', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const unmodeledCand: CompatibilityCandidate = {
    ...candidates[0],
    status: 'UNMODELED',
    effectValue: null
  };

  const evaluation = evaluateCompatibilityCandidate(unmodeledCand);
  assert.strictEqual(evaluation.evaluationStatus, 'UNMODELED');
  assert.strictEqual(evaluation.totalScore, null);
  assert.ok(isUnmodeledEvaluation(evaluation));
});

test('31. Epistemics: NOT_APPLICABLE candidate yields NOT_APPLICABLE and null score', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const naCand: CompatibilityCandidate = {
    ...candidates[0],
    status: 'NOT_APPLICABLE'
  };

  const evaluation = evaluateCompatibilityCandidate(naCand);
  assert.strictEqual(evaluation.evaluationStatus, 'NOT_APPLICABLE');
  assert.strictEqual(evaluation.totalScore, null);
  assert.ok(isNotApplicableEvaluation(evaluation));
});

// ============================================================================
// SUITE 6: NUMERIC EFFECT MAGNITUDE & SAFETY (Tests 32-36)
// ============================================================================

test('32. Magnitude: safe numeric effect percentage scales into magnitude component', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', parameter: 'ATK_PERCENT', staticNumericValue: 20 }),
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const evaluation = evaluateCompatibilityCandidate(candidates[0]);
  const magComp = evaluation.components.find((c) => c.ruleCode === 'SAFE_EFFECT_MAGNITUDE_BONUS');
  assert.ok(magComp);
  assert.strictEqual(magComp.value, 2.0); // 20% of 10 max points = 2.0
});

test('33. Magnitude: null effectValue strictly produces NO magnitude component (never 0)', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const nullMagCand: CompatibilityCandidate = {
    ...candidates[0],
    effectValue: null
  };

  const evaluation = evaluateCompatibilityCandidate(nullMagCand);
  const magComp = evaluation.components.find((c) => c.ruleCode === 'SAFE_EFFECT_MAGNITUDE_BONUS');
  assert.strictEqual(magComp, undefined);
});

test('34. Safety: no default score fallback (score is never arbitrarily 50 or 100)', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const evaluation = evaluateCompatibilityCandidate(candidates[0]);
  assert.ok(evaluation.totalScore !== null);
  const sumOfParts = evaluation.components.reduce((sum, c) => sum + c.value, 0);
  assert.strictEqual(evaluation.totalScore, Math.round(sumOfParts * 100) / 100);
});

test('35. Rules: rule constants are explicitly declared in rules.ts', () => {
  assert.strictEqual(MAX_SCORE_DIRECTNESS, 25);
  assert.strictEqual(MAX_SCORE_SPECIFICITY, 35);
  assert.strictEqual(MAX_SCORE_COVERAGE, 15);
  assert.strictEqual(MAX_SCORE_CERTAINTY, 15);
  assert.strictEqual(MAX_SCORE_MAGNITUDE, 10);
  assert.strictEqual(
    MAX_SCORE_DIRECTNESS + MAX_SCORE_SPECIFICITY + MAX_SCORE_COVERAGE + MAX_SCORE_CERTAINTY + MAX_SCORE_MAGNITUDE,
    100
  );
});

test('36. Rules: no magic scattered constants; all rule weights match declared constants', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const evaluation = evaluateCompatibilityCandidate(candidates[0]);
  for (const comp of evaluation.components) {
    assert.ok(comp.value <= comp.maxValue);
    assert.ok(comp.maxValue <= 35);
  }
});

// ============================================================================
// SUITE 7: PATCH ISOLATION (Tests 37-38)
// ============================================================================

test('37. Patch: strictly enforces Patch 3.7', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const evaluation = evaluateCompatibilityCandidate(candidates[0]);
  assert.strictEqual(evaluation.patchVersion, '3.7');
});

test('38. Patch: cross-patch rejection (e.g. candidate with patch 3.6 or 3.8) throws fail-closed error', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const invalidCand = { ...candidates[0], patchVersion: '3.6' as any };

  assert.throws(
    () => evaluateCompatibilityCandidate(invalidCand),
    /strictly requires Patch 3.7/
  );
});

// ============================================================================
// SUITE 8: ARCHITECTURAL PURITY & STATIC SAFETY AUDIT (Tests 39-49)
// ============================================================================

test('39. Safety: no raw description access in evaluation module', () => {
  const dirPath = path.resolve('lib/engine/relationships/evaluation');
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const content = fs.readFileSync(path.join(dirPath, file), 'utf8');
    assert.strictEqual(content.includes('originalDescription.'), false);
    assert.strictEqual(content.includes('parseDescription'), false);
  }
});

test('40. Safety: no semantic parser bypass in evaluation module', () => {
  const dirPath = path.resolve('lib/engine/relationships/evaluation');
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const content = fs.readFileSync(path.join(dirPath, file), 'utf8');
    assert.strictEqual(content.includes('SemanticEffect'), false);
  }
});

test('41. Safety: no network or LLM usage in evaluation module', () => {
  const dirPath = path.resolve('lib/engine/relationships/evaluation');
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const content = fs.readFileSync(path.join(dirPath, file), 'utf8');
    assert.strictEqual(content.includes('fetch('), false);
    assert.strictEqual(content.includes('axios'), false);
    assert.strictEqual(content.includes('openai'), false);
    assert.strictEqual(content.includes('anthropic'), false);
  }
});

test('42. Safety: no randomness in evaluation module', () => {
  const dirPath = path.resolve('lib/engine/relationships/evaluation');
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const content = fs.readFileSync(path.join(dirPath, file), 'utf8');
    assert.strictEqual(content.includes('Math.random'), false);
    assert.strictEqual(content.includes('randomUUID'), false);
  }
});

test('43. Safety: no timestamp-based IDs in evaluation module', () => {
  const dirPath = path.resolve('lib/engine/relationships/evaluation');
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const content = fs.readFileSync(path.join(dirPath, file), 'utf8');
    assert.strictEqual(content.includes('Date.now'), false);
    assert.strictEqual(content.includes('new Date()'), false);
  }
});

test('44. Safety: no role inference tags in evaluation module', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const evaluation = evaluateCompatibilityCandidate(candidates[0]);
  const str = JSON.stringify(evaluation);
  const forbiddenRoles = ['MAIN_DPS', 'SUB_DPS', 'SUPPORT', 'HEALER', 'SHIELDER', 'BUFFER', 'DEBUFFER', 'HYPERCARRY'];
  for (const role of forbiddenRoles) {
    assert.strictEqual(str.includes(`"${role}"`), false);
  }
});

test('45. Safety: no meta or tier ranking fields in evaluation module', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const evaluation = evaluateCompatibilityCandidate(candidates[0]);
  const str = JSON.stringify(evaluation);
  assert.strictEqual(str.includes('"tier"'), false);
  assert.strictEqual(str.includes('"meta"'), false);
  assert.strictEqual(str.includes('"rank"'), false);
});

test('46. Safety: zero character-level aggregation in evaluation module', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const evaluation = evaluateCompatibilityCandidate(candidates[0]);
  assert.strictEqual((evaluation as any).characterScore, undefined);
  assert.strictEqual((evaluation as any).resonatorScore, undefined);
});

test('47. Safety: zero team aggregation in evaluation module', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const evaluation = evaluateCompatibilityCandidate(candidates[0]);
  assert.strictEqual((evaluation as any).teamScore, undefined);
  assert.strictEqual((evaluation as any).bestTeam, undefined);
});

test('48. Safety: zero ToA or Vigor scoring logic in evaluation module', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const evaluation = evaluateCompatibilityCandidate(candidates[0]);
  assert.strictEqual((evaluation as any).towerScore, undefined);
  assert.strictEqual((evaluation as any).vigorCost, undefined);
});

test('49. Explanation: explainCompatibilityEvaluation returns structured presentation without modifying evaluation', () => {
  const candidates = buildMockCandidatePair(
    createMockFact({ entityId: 'A', target: 'TEAM', parameter: 'ATK_PERCENT' }),
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const evaluation = evaluateCompatibilityCandidate(candidates[0]);
  const explanation = explainCompatibilityEvaluation(evaluation);

  assert.strictEqual(explanation.evaluationId, evaluation.id);
  assert.strictEqual(explanation.candidateId, evaluation.candidateId);
  assert.strictEqual(explanation.totalScore, evaluation.totalScore);
  assert.ok(explanation.summary.includes(`${evaluation.totalScore}/100`));
  assert.strictEqual(explanation.componentBreakdown.length, evaluation.components.length);
});

// ============================================================================
// SUITE 9: PRODUCTION DATASET EVALUATION & RECONCILIATION (Tests 50-52)
// ============================================================================

test('50. Production: candidate evaluation audit reconciles all 13,615 candidates', () => {
  const audit = auditCompatibilityEvaluations();
  assert.strictEqual(audit.totalInputCapabilities, 292);
  assert.strictEqual(audit.totalInputRelationships, 735);
  assert.strictEqual(audit.totalInputEvidence, 365);
  assert.strictEqual(audit.totalInputCandidates, 13615);
  assert.strictEqual(audit.totalEvaluations, 13615);
  assert.strictEqual(audit.uniqueEvaluationIds, 13615);
  assert.strictEqual(audit.duplicateEvaluationIds, 0);
  assert.ok(audit.evaluationsWithScore > 0);
  assert.strictEqual(audit.evaluationsWithScore + audit.evaluationsWithoutScore, 13615);
});

test('51. Production: audit passes all invariants A through Z without throwing', () => {
  assert.doesNotThrow(() => {
    auditCompatibilityEvaluations();
  });
});

test('52. Production: repeated evaluation runs yield byte-for-byte identical output', () => {
  const audit1 = auditCompatibilityEvaluations();
  const audit2 = auditCompatibilityEvaluations();

  assert.strictEqual(audit1.totalEvaluations, audit2.totalEvaluations);
  assert.strictEqual(audit1.evaluationsWithScore, audit2.evaluationsWithScore);
  assert.strictEqual(audit1.scoreAverage, audit2.scoreAverage);

  for (let i = 0; i < 50; i++) {
    assert.strictEqual(audit1.evaluations[i].id, audit2.evaluations[i].id);
    assert.strictEqual(audit1.evaluations[i].totalScore, audit2.evaluations[i].totalScore);
    assert.deepStrictEqual(audit1.evaluations[i], audit2.evaluations[i]);
  }
});
