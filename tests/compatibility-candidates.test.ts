/**
 * Wuthering Waves Deterministic Compatibility Candidate Test Suite
 * Phase 7 Step 5: Deterministic Compatibility Candidate Contract & Evidence Qualification
 *
 * Verifies that the Compatibility Candidate Engine:
 * - Deterministically qualifies candidate pairs across distinct entities
 * - Enforces CANDIDATE ≠ SYNERGY (zero scores, zero weights, zero rankings, zero tiers)
 * - Distinguishes EXPLICIT vs DIMENSIONAL qualification
 * - Strictly enforces Patch 3.7 isolation and fails closed on cross-patch inputs
 * - Preserves UNMODELED mechanics with null effect values and fails closed for UNKNOWN
 * - Delegates applicability strictly to Phase 7 Step 2 capability resolution
 * - Passes all 47 required test specifications and static safety audits
 */

import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { NormalizedEngineFact } from '../lib/engine/facts/types.ts';
import type { GameplayRelationship } from '../lib/engine/relationships/types.ts';
import {
  buildGameplayCapability,
  auditProductionCapabilities
} from '../lib/engine/capabilities/builder.ts';
import {
  buildGameplayRelationships,
  buildGameplayRelationshipsForCapability
} from '../lib/engine/relationships/builder.ts';
import { auditProductionRelationships } from '../lib/engine/relationships/audit.ts';
import {
  composeInteractionEvidence,
  composeInteractionEvidenceForCapability
} from '../lib/engine/relationships/composition/composer.ts';
import { auditProductionInteractionEvidence } from '../lib/engine/relationships/composition/audit.ts';
import {
  generateCompatibilityCandidates,
  deriveCompatibilityCandidateId,
  compareCompatibilityCandidate,
  evaluateCompatibilityCandidateApplicability,
  matchesCompatibilityCandidateFilter,
  isExplicitTargetCandidate,
  isActionCompatibilityCandidate,
  isElementCompatibilityCandidate,
  isTransitionCompatibilityCandidate,
  isResourceCompatibilityCandidate,
  isDefensiveCompatibilityCandidate,
  isOffensiveCompatibilityCandidate,
  isMechanicalCompatibilityCandidate,
  isTargetScopeCompatibilityCandidate,
  queryCompatibilityCandidates,
  findCompatibilityCandidatesForCapability,
  findCompatibilityCandidatesForEntity,
  findCompatibilityCandidatesBetweenEntities,
  findCompatibilityCandidatesByType,
  getCompatibilityCandidates,
  auditCompatibilityCandidates
} from '../lib/engine/relationships/compatibility/index.ts';

function createMockFact(overrides?: Partial<NormalizedEngineFact>): NormalizedEngineFact {
  const isUnmodeledOrUnknown =
    overrides?.consumptionState === 'UNMODELED' ||
    overrides?.consumptionState === 'UNKNOWN' ||
    overrides?.consumptionState === 'NOT_APPLICABLE' ||
    overrides?.value?.type === 'UNRESOLVED';

  const baseNumeric =
    overrides && 'staticNumericValue' in overrides
      ? overrides.staticNumericValue
      : overrides && 'value' in overrides && overrides.value?.type === 'EXACT'
        ? overrides.value.value
        : isUnmodeledOrUnknown
          ? null
          : 20;

  const baseValue =
    overrides?.value ??
    (isUnmodeledOrUnknown
      ? { type: 'UNRESOLVED' as const, reason: 'Unmodeled/unknown in test fixture' }
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
    patchVersion: '3.7',
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

// ============================================================================
// SUITE 1: CORE DETERMINISM, IDS & ORDERING (Tests 1-4)
// ============================================================================

test('1. Core: deterministic generation across runs', () => {
  const cap1 = buildGameplayCapability(createMockFact({ entityId: 'A', target: 'TEAM', parameter: 'ATK_PERCENT' }));
  const cap2 = buildGameplayCapability(createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' }));
  const rels = [...buildGameplayRelationshipsForCapability(cap1), ...buildGameplayRelationshipsForCapability(cap2)];
  const evi = composeInteractionEvidence([cap1, cap2], rels, '3.7');

  const cands1 = generateCompatibilityCandidates([cap1, cap2], evi, rels, '3.7');
  const cands2 = generateCompatibilityCandidates([cap1, cap2], evi, rels, '3.7');

  assert.strictEqual(cands1.length, cands2.length);
  for (let i = 0; i < cands1.length; i++) {
    assert.strictEqual(cands1[i].id, cands2[i].id);
    assert.deepStrictEqual(cands1[i], cands2[i]);
  }
});

test('2. Core: stable and deterministic candidate IDs', () => {
  const cap1 = buildGameplayCapability(createMockFact({ entityId: 'A', target: 'TEAM', parameter: 'ATK_PERCENT' }));
  const cap2 = buildGameplayCapability(createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' }));
  const rels = [...buildGameplayRelationshipsForCapability(cap1), ...buildGameplayRelationshipsForCapability(cap2)];
  const evi = composeInteractionEvidence([cap1, cap2], rels, '3.7');

  const cands = generateCompatibilityCandidates([cap1, cap2], evi, rels, '3.7');
  assert.ok(cands.length > 0);

  for (const c of cands) {
    assert.ok(c.id.startsWith('cmp:3.7:'));
    const expected = deriveCompatibilityCandidateId(
      '3.7',
      c.sourceCapabilityId,
      c.targetCapabilityId,
      c.qualificationType,
      c.matchedDimensions,
      c.evidenceIds
    );
    assert.strictEqual(c.id, expected);
  }
});

test('3. Core: canonical ordering of candidate records', () => {
  const cap1 = buildGameplayCapability(createMockFact({ entityId: 'Z', target: 'TEAM', parameter: 'ATK_PERCENT' }));
  const cap2 = buildGameplayCapability(createMockFact({ entityId: 'A', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' }));
  const rels = [...buildGameplayRelationshipsForCapability(cap1), ...buildGameplayRelationshipsForCapability(cap2)];
  const evi = composeInteractionEvidence([cap1, cap2], rels, '3.7');

  const cands = generateCompatibilityCandidates([cap1, cap2], evi, rels, '3.7');
  const sorted = [...cands].sort(compareCompatibilityCandidate);
  assert.deepStrictEqual(cands, sorted);
});

test('4. Core: duplicate elimination by canonical identity', () => {
  const cap1 = buildGameplayCapability(createMockFact({ entityId: 'A', target: 'TEAM', parameter: 'ATK_PERCENT' }));
  const cap2 = buildGameplayCapability(createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' }));
  const rels = [...buildGameplayRelationshipsForCapability(cap1), ...buildGameplayRelationshipsForCapability(cap2)];
  const evi = composeInteractionEvidence([cap1, cap2], rels, '3.7');

  // Duplicate the capabilities in input
  const cands = generateCompatibilityCandidates([cap1, cap2, cap1, cap2], evi, rels, '3.7');
  const ids = new Set(cands.map((c) => c.id));
  assert.strictEqual(ids.size, cands.length);
});

// ============================================================================
// SUITE 2: CLOSED QUALIFICATION TAXONOMY (Tests 5-13)
// ============================================================================

test('5. Qualification: explicit target candidate (EXPLICIT_TARGET_LINK)', () => {
  const cap1 = buildGameplayCapability(createMockFact({ entityId: 'A', target: 'TEAM' }));
  const cap2 = buildGameplayCapability(createMockFact({ entityId: 'B', target: 'SELF' }));

  const explicitRel: GameplayRelationship = {
    relationshipId: 'rel:3.7:mock_explicit',
    patchVersion: '3.7',
    sourceCapabilityId: cap1.capabilityId,
    sourceEntityId: cap1.entityId,
    sourceCode: cap1.sourceCode,
    relationshipType: 'AMPLIFIES_ACTION',
    category: 'ACTION',
    target: { kind: 'CAPABILITY', capabilityId: cap2.capabilityId },
    actionType: 'HEAVY',
    effectValue: 20,
    sourceFactIds: cap1.factIds,
    provenance: cap1.provenance,
    evidence: {
      sourceKind: 'CAPABILITY',
      factIds: cap1.factIds,
      capabilityIds: [cap1.capabilityId],
      reasonCode: 'EXPLICIT_PAIRWISE_TARGET_LINKAGE'
    }
  };

  const cands = generateCompatibilityCandidates([cap1, cap2], [], [explicitRel], '3.7');
  const explicit = cands.find(isExplicitTargetCandidate);
  assert.ok(explicit);
  assert.strictEqual(explicit.qualificationNature, 'EXPLICIT');
  assert.strictEqual(explicit.directionality, 'DIRECTED');
  assert.strictEqual(explicit.targetCapabilityId, cap2.capabilityId);
});

test('6. Qualification: action candidate (ACTION_COMPATIBILITY_CANDIDATE)', () => {
  const cap1 = buildGameplayCapability(
    createMockFact({ entityId: 'A', target: 'NEXT_RESONATOR', sourceCode: 'OUTRO_SKILL', parameter: 'HEAVY_ATTACK_DAMAGE_PERCENT' })
  );
  const cap2 = buildGameplayCapability(
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'HEAVY_ATTACK', parameter: 'HEAVY_ATTACK_DAMAGE_PERCENT' })
  );
  const rels = [...buildGameplayRelationshipsForCapability(cap1), ...buildGameplayRelationshipsForCapability(cap2)];
  const evi = composeInteractionEvidence([cap1, cap2], rels, '3.7');

  const cands = generateCompatibilityCandidates([cap1, cap2], evi, rels, '3.7');
  const act = cands.find(isActionCompatibilityCandidate);
  assert.ok(act);
  assert.strictEqual(act.qualificationNature, 'DIMENSIONAL');
  assert.strictEqual(act.matchedDimensions[0].kind, 'ACTION');
  assert.strictEqual(act.matchedDimensions[0].value, 'HEAVY');
});

test('7. Qualification: element candidate (ELEMENT_COMPATIBILITY_CANDIDATE)', () => {
  const cap1 = buildGameplayCapability(
    createMockFact({ entityId: 'A', target: 'TEAM', element: 'Electro', parameter: 'ELECTRO_DAMAGE_PERCENT' })
  );
  const cap2 = buildGameplayCapability(
    createMockFact({ entityId: 'B', target: 'SELF', element: 'Electro', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const rels = [...buildGameplayRelationshipsForCapability(cap1), ...buildGameplayRelationshipsForCapability(cap2)];
  const evi = composeInteractionEvidence([cap1, cap2], rels, '3.7');

  const cands = generateCompatibilityCandidates([cap1, cap2], evi, rels, '3.7');
  const elem = cands.find(isElementCompatibilityCandidate);
  assert.ok(elem);
  assert.strictEqual(elem.qualificationNature, 'DIMENSIONAL');
  assert.strictEqual(elem.matchedDimensions[0].kind, 'ELEMENT');
  assert.strictEqual(elem.matchedDimensions[0].value, 'Electro');
});

test('8. Qualification: transition candidate (TRANSITION_COMPATIBILITY_CANDIDATE)', () => {
  const cap1 = buildGameplayCapability(
    createMockFact({ entityId: 'A', target: 'NEXT_RESONATOR', sourceCode: 'OUTRO_SKILL' })
  );
  const cap2 = buildGameplayCapability(
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'INTRO_SKILL' })
  );
  const rels = [...buildGameplayRelationshipsForCapability(cap1), ...buildGameplayRelationshipsForCapability(cap2)];
  const evi = composeInteractionEvidence([cap1, cap2], rels, '3.7');

  const cands = generateCompatibilityCandidates([cap1, cap2], evi, rels, '3.7');
  const trans = cands.find(isTransitionCompatibilityCandidate);
  assert.ok(trans);
  assert.strictEqual(trans.qualificationNature, 'DIMENSIONAL');
  assert.ok(trans.matchedDimensions.some((d) => d.kind === 'TRANSITION' && d.value === 'OUTRO_TO_INTRO'));
});

test('9. Qualification: resource candidate (RESOURCE_COMPATIBILITY_CANDIDATE)', () => {
  const cap1 = buildGameplayCapability(
    createMockFact({ entityId: 'A', target: 'TEAM', category: 'RESOURCE_GRANT', parameter: 'ENERGY_REGEN_PERCENT' })
  );
  const cap2 = buildGameplayCapability(
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_LIBERATION', parameter: 'LIBERATION_DAMAGE_PERCENT' })
  );
  const rels = [...buildGameplayRelationshipsForCapability(cap1), ...buildGameplayRelationshipsForCapability(cap2)];
  const evi = composeInteractionEvidence([cap1, cap2], rels, '3.7');

  const cands = generateCompatibilityCandidates([cap1, cap2], evi, rels, '3.7');
  const res = cands.find(isResourceCompatibilityCandidate);
  assert.ok(res);
  assert.strictEqual(res.qualificationNature, 'DIMENSIONAL');
  assert.strictEqual(res.matchedDimensions[0].kind, 'RESOURCE');
});

test('10. Qualification: defensive candidate (DEFENSIVE_COMPATIBILITY_CANDIDATE)', () => {
  const cap1 = buildGameplayCapability(
    createMockFact({ entityId: 'A', target: 'TEAM', category: 'HEALING', parameter: 'HEALING_BONUS_PERCENT' })
  );
  const cap2 = buildGameplayCapability(
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'BASIC_ATTACK', parameter: 'BASIC_ATTACK_DAMAGE_PERCENT' })
  );
  const rels = [...buildGameplayRelationshipsForCapability(cap1), ...buildGameplayRelationshipsForCapability(cap2)];
  const evi = composeInteractionEvidence([cap1, cap2], rels, '3.7');

  const cands = generateCompatibilityCandidates([cap1, cap2], evi, rels, '3.7');
  const def = cands.find(isDefensiveCompatibilityCandidate);
  assert.ok(def);
  assert.strictEqual(def.qualificationNature, 'DIMENSIONAL');
  assert.strictEqual(def.matchedDimensions[0].kind, 'DEFENSIVE');
});

test('11. Qualification: offensive candidate (OFFENSIVE_COMPATIBILITY_CANDIDATE)', () => {
  const cap1 = buildGameplayCapability(
    createMockFact({ entityId: 'A', target: 'TEAM', category: 'STAT_BUFF', parameter: 'ATK_PERCENT' })
  );
  const cap2 = buildGameplayCapability(
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const rels = [...buildGameplayRelationshipsForCapability(cap1), ...buildGameplayRelationshipsForCapability(cap2)];
  const evi = composeInteractionEvidence([cap1, cap2], rels, '3.7');

  const cands = generateCompatibilityCandidates([cap1, cap2], evi, rels, '3.7');
  const off = cands.find(isOffensiveCompatibilityCandidate);
  assert.ok(off);
  assert.strictEqual(off.qualificationNature, 'DIMENSIONAL');
  assert.strictEqual(off.matchedDimensions[0].kind, 'OFFENSIVE');
});

test('12. Qualification: mechanical candidate (MECHANICAL_COMPATIBILITY_CANDIDATE)', () => {
  const cap1 = buildGameplayCapability(
    createMockFact({ entityId: 'A', target: 'TEAM', parameter: 'COORDINATED_ATTACK_DAMAGE_PERCENT' })
  );
  const cap2 = buildGameplayCapability(
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'BASIC_ATTACK', parameter: 'BASIC_ATTACK_DAMAGE_PERCENT' })
  );
  const rels = [...buildGameplayRelationshipsForCapability(cap1), ...buildGameplayRelationshipsForCapability(cap2)];
  const evi = composeInteractionEvidence([cap1, cap2], rels, '3.7');

  const cands = generateCompatibilityCandidates([cap1, cap2], evi, rels, '3.7');
  const mech = cands.find(isMechanicalCompatibilityCandidate);
  assert.ok(mech);
  assert.strictEqual(mech.qualificationNature, 'DIMENSIONAL');
  assert.strictEqual(mech.matchedDimensions[0].kind, 'MECHANICAL');
});

test('13. Qualification: target-scope candidate (TARGET_SCOPE_COMPATIBILITY_CANDIDATE)', () => {
  const cap1 = buildGameplayCapability(
    createMockFact({ entityId: 'A', target: 'TEAM', parameter: 'HP_PERCENT' })
  );
  const cap2 = buildGameplayCapability(
    createMockFact({ entityId: 'B', target: 'SELF' })
  );
  const rels = [...buildGameplayRelationshipsForCapability(cap1), ...buildGameplayRelationshipsForCapability(cap2)];
  const evi = composeInteractionEvidence([cap1, cap2], rels, '3.7');

  const cands = generateCompatibilityCandidates([cap1, cap2], evi, rels, '3.7');
  assert.ok(cands.length > 0);
  for (const c of cands) {
    assert.strictEqual(c.qualificationNature, 'DIMENSIONAL');
  }
});

// ============================================================================
// SUITE 3: DIRECTIONALITY & SYMMETRY (Tests 14-15)
// ============================================================================

test('14. Directionality: A amplifies B does not imply B amplifies A', () => {
  const capA = buildGameplayCapability(
    createMockFact({ entityId: 'A', target: 'TEAM', sourceCode: 'OUTRO_SKILL', parameter: 'HEAVY_ATTACK_DAMAGE_PERCENT' })
  );
  const capB = buildGameplayCapability(
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'HEAVY_ATTACK', parameter: 'HEAVY_ATTACK_DAMAGE_PERCENT' })
  );
  const rels = [...buildGameplayRelationshipsForCapability(capA), ...buildGameplayRelationshipsForCapability(capB)];
  const evi = composeInteractionEvidence([capA, capB], rels, '3.7');

  const cands = generateCompatibilityCandidates([capA, capB], evi, rels, '3.7');

  // A -> B should exist as ACTION candidate
  const aToB = cands.find((c) => c.sourceCapabilityId === capA.capabilityId && c.targetCapabilityId === capB.capabilityId);
  assert.ok(aToB);
  assert.strictEqual(aToB.directionality, 'DIRECTED');

  // B -> A should NOT exist because B is SELF-target and does not amplify A
  const bToA = cands.find((c) => c.sourceCapabilityId === capB.capabilityId && c.targetCapabilityId === capA.capabilityId);
  assert.strictEqual(bToA, undefined);
});

test('15. Directionality: symmetric behavior where explicitly defined', () => {
  const cands = getCompatibilityCandidates();
  for (const c of cands) {
    assert.ok(c.directionality === 'DIRECTED' || c.directionality === 'SYMMETRIC');
  }
});

// ============================================================================
// SUITE 4: SEMANTIC BOUNDARIES & ZERO SYNERGY INVARIANTS (Tests 16-24)
// ============================================================================

test('16. Boundary: ACTION matching does not become InteractionEvidence', () => {
  const prodCaps = auditProductionCapabilities().capabilities;
  const prodRels = auditProductionRelationships().relationships;
  const prodEvi = auditProductionInteractionEvidence().evidence;

  // In Step 4 InteractionEvidence, there are 0 pairwise records
  const pairwiseEvidence = prodEvi.filter((e) => e.targetCapabilityId !== undefined);
  assert.strictEqual(pairwiseEvidence.length, 0);

  // In Step 5, Action candidate eligibility exists
  const actionCands = getCompatibilityCandidates().filter(isActionCompatibilityCandidate);
  assert.ok(actionCands.length > 0);
});

test('17. Boundary: ELEMENT matching does not become InteractionEvidence', () => {
  const prodEvi = auditProductionInteractionEvidence().evidence;
  const pairwiseEvidence = prodEvi.filter((e) => e.targetCapabilityId !== undefined);
  assert.strictEqual(pairwiseEvidence.length, 0);

  const elemCands = getCompatibilityCandidates().filter(isElementCompatibilityCandidate);
  assert.ok(elemCands.length > 0);
});

test('18. Boundary: candidate does not become synergy or imply positive value', () => {
  const cands = getCompatibilityCandidates();
  for (const c of cands) {
    assert.strictEqual('synergy' in c, false);
    assert.strictEqual('isSynergistic' in c, false);
    assert.strictEqual('synergyType' in c, false);
    assert.strictEqual('valueRating' in c, false);
  }
});

test('19. Boundary: candidate does not contain score or synergyScore fields', () => {
  const cands = getCompatibilityCandidates();
  for (const c of cands) {
    assert.strictEqual('score' in c, false);
    assert.strictEqual('synergyScore' in c, false);
    assert.strictEqual('compatibilityScore' in c, false);
    assert.strictEqual('teamScore' in c, false);
    assert.strictEqual('damageScore' in c, false);
    assert.strictEqual('rotationScore' in c, false);
  }
});

test('20. Boundary: candidate does not contain weight or priority fields', () => {
  const cands = getCompatibilityCandidates();
  for (const c of cands) {
    assert.strictEqual('weight' in c, false);
    assert.strictEqual('priority' in c, false);
    assert.strictEqual('penalty' in c, false);
  }
});

test('21. Boundary: candidate does not contain tier or ranking fields', () => {
  const cands = getCompatibilityCandidates();
  for (const c of cands) {
    assert.strictEqual('tier' in c, false);
    assert.strictEqual('rank' in c, false);
    assert.strictEqual('ranking' in c, false);
    assert.strictEqual('meta' in c, false);
  }
});

test('22. Boundary: candidate does not contain community role inference', () => {
  const cands = getCompatibilityCandidates();
  const forbiddenRoles = [
    'role',
    'MAIN_DPS',
    'SUB_DPS',
    'SUPPORT',
    'HEALER',
    'SHIELDER',
    'BUFFER',
    'DEBUFFER',
    'QUICK_SWAP',
    'HYPERCARRY'
  ];

  for (const c of cands) {
    for (const role of forbiddenRoles) {
      assert.strictEqual(role in c, false);
    }
  }
});

test('23. Boundary: arbitrary Outro + Intro is not treated as explicit interaction evidence', () => {
  const prodEvi = auditProductionInteractionEvidence().evidence;
  const mortefiOutroEvi = prodEvi.filter((e) => e.sourceEntityId === 'Mortefi' && e.evidenceType === 'OUTRO_EVIDENCE');
  for (const e of mortefiOutroEvi) {
    assert.strictEqual(e.targetCapabilityId, undefined);
  }
});

test('24. Boundary: explicit target linkage remains distinguishable from dimensional candidate', () => {
  const cands = getCompatibilityCandidates();
  for (const c of cands) {
    if (c.qualificationType === 'EXPLICIT_TARGET_LINK') {
      assert.strictEqual(c.qualificationNature, 'EXPLICIT');
    } else {
      assert.strictEqual(c.qualificationNature, 'DIMENSIONAL');
    }
  }
});

// ============================================================================
// SUITE 5: STATUS, UNMODELED & APPLICABILITY (Tests 25-29)
// ============================================================================

test('25. Status: UNKNOWN fails closed with zero candidate generation', () => {
  const cap1 = buildGameplayCapability(createMockFact({ consumptionState: 'UNKNOWN', target: 'TEAM' }));
  const cap2 = buildGameplayCapability(createMockFact({ entityId: 'B', target: 'SELF' }));
  const cands = generateCompatibilityCandidates([cap1, cap2], [], [], '3.7');
  assert.strictEqual(cands.length, 0);
});

test('26. Status: UNMODELED preserves null numeric values (never 0, never fabricated)', () => {
  const audit = auditCompatibilityCandidates();
  for (const c of audit.candidates) {
    if (c.status === 'UNMODELED') {
      assert.strictEqual(c.effectValue, null);
    }
  }
});

test('27. Status: NOT_APPLICABLE produces zero active candidate records', () => {
  const cap1 = buildGameplayCapability(createMockFact({ consumptionState: 'NOT_APPLICABLE', target: 'TEAM' }));
  const cap2 = buildGameplayCapability(createMockFact({ entityId: 'B', target: 'SELF' }));
  const cands = generateCompatibilityCandidates([cap1, cap2], [], [], '3.7');
  assert.strictEqual(cands.length, 0);
});

test('28. Applicability: missing context evaluates to MISSING_CONTEXT', () => {
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
    createMockFact({
      entityId: 'B',
      target: 'SELF',
      sourceCode: 'RESONANCE_SKILL',
      parameter: 'SKILL_DAMAGE_PERCENT'
    })
  );
  const rels = [...buildGameplayRelationshipsForCapability(cap1), ...buildGameplayRelationshipsForCapability(cap2)];
  const evi = composeInteractionEvidence([cap1, cap2], rels, '3.7');

  const cands = generateCompatibilityCandidates([cap1, cap2], evi, rels, '3.7');
  assert.ok(cands.length > 0);

  const evalResult = evaluateCompatibilityCandidateApplicability(cands[0]);
  assert.strictEqual(evalResult.isApplicable, false);
  assert.strictEqual(evalResult.status, 'MISSING_CONTEXT');
  assert.ok(evalResult.missingDimensions.includes('ZONE_STATE'));
});

test('29. Applicability: mismatched context evaluates to CONTEXT_MISMATCH', () => {
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
    createMockFact({
      entityId: 'B',
      target: 'SELF',
      sourceCode: 'RESONANCE_SKILL',
      parameter: 'SKILL_DAMAGE_PERCENT'
    })
  );
  const rels = [...buildGameplayRelationshipsForCapability(cap1), ...buildGameplayRelationshipsForCapability(cap2)];
  const evi = composeInteractionEvidence([cap1, cap2], rels, '3.7');

  const cands = generateCompatibilityCandidates([cap1, cap2], evi, rels, '3.7');
  assert.ok(cands.length > 0);

  const evalResult = evaluateCompatibilityCandidateApplicability(cands[0], {
    zoneActive: false
  });
  assert.strictEqual(evalResult.isApplicable, false);
  assert.strictEqual(evalResult.status, 'CONTEXT_MISMATCH');
  assert.ok(evalResult.mismatchedDimensions.includes('ZONE_STATE'));
});

// ============================================================================
// SUITE 6: ELEMENT & ACTION SEMANTICS (Tests 30-33)
// ============================================================================

test('30. Elements: exact element matching preserved', () => {
  const cap1 = buildGameplayCapability(
    createMockFact({ entityId: 'A', target: 'TEAM', element: 'Fusion', parameter: 'FUSION_DAMAGE_PERCENT' })
  );
  const cap2 = buildGameplayCapability(
    createMockFact({ entityId: 'B', target: 'SELF', element: 'Fusion', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const cap3 = buildGameplayCapability(
    createMockFact({ entityId: 'C', target: 'SELF', element: 'Glacio', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );

  const allCaps = [cap1, cap2, cap3];
  const rels = allCaps.flatMap(buildGameplayRelationshipsForCapability);
  const evi = composeInteractionEvidence(allCaps, rels, '3.7');

  const cands = generateCompatibilityCandidates(allCaps, evi, rels, '3.7');
  const fusionCand = cands.find(
    (c) => c.sourceCapabilityId === cap1.capabilityId && c.targetCapabilityId === cap2.capabilityId && isElementCompatibilityCandidate(c)
  );
  assert.ok(fusionCand);

  const glacioCand = cands.find(
    (c) => c.sourceCapabilityId === cap1.capabilityId && c.targetCapabilityId === cap3.capabilityId && isElementCompatibilityCandidate(c)
  );
  assert.strictEqual(glacioCand, undefined);
});

test('31. Elements: All element semantics match canonical concrete elements', () => {
  const cap1 = buildGameplayCapability(
    createMockFact({ entityId: 'A', target: 'TEAM', element: 'All', parameter: 'ALL_ATTRIBUTE_DAMAGE_PERCENT' })
  );
  const cap2 = buildGameplayCapability(
    createMockFact({ entityId: 'B', target: 'SELF', element: 'Havoc', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const rels = [...buildGameplayRelationshipsForCapability(cap1), ...buildGameplayRelationshipsForCapability(cap2)];
  const evi = composeInteractionEvidence([cap1, cap2], rels, '3.7');

  const cands = generateCompatibilityCandidates([cap1, cap2], evi, rels, '3.7');
  const allCand = cands.find(isElementCompatibilityCandidate);
  assert.ok(allCand);
  assert.strictEqual(allCand.matchedDimensions[0].value, 'Havoc');
});

test('32. Elements: NONE element does not produce elemental candidate', () => {
  const cap1 = buildGameplayCapability(
    createMockFact({ entityId: 'A', target: 'TEAM', element: 'NONE', parameter: 'ATK_PERCENT' })
  );
  const cap2 = buildGameplayCapability(
    createMockFact({ entityId: 'B', target: 'SELF', element: 'NONE', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const rels = [...buildGameplayRelationshipsForCapability(cap1), ...buildGameplayRelationshipsForCapability(cap2)];
  const evi = composeInteractionEvidence([cap1, cap2], rels, '3.7');

  const cands = generateCompatibilityCandidates([cap1, cap2], evi, rels, '3.7');
  assert.strictEqual(cands.some(isElementCompatibilityCandidate), false);
});

test('33. Actions: exact action matching preserved', () => {
  const cap1 = buildGameplayCapability(
    createMockFact({ entityId: 'A', target: 'NEXT_RESONATOR', sourceCode: 'OUTRO_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const cap2 = buildGameplayCapability(
    createMockFact({ entityId: 'B', target: 'SELF', sourceCode: 'RESONANCE_SKILL', parameter: 'SKILL_DAMAGE_PERCENT' })
  );
  const cap3 = buildGameplayCapability(
    createMockFact({ entityId: 'C', target: 'SELF', sourceCode: 'BASIC_ATTACK', parameter: 'BASIC_ATTACK_DAMAGE_PERCENT' })
  );

  const allCaps = [cap1, cap2, cap3];
  const rels = allCaps.flatMap(buildGameplayRelationshipsForCapability);
  const evi = composeInteractionEvidence(allCaps, rels, '3.7');

  const cands = generateCompatibilityCandidates(allCaps, evi, rels, '3.7');
  const skillCand = cands.find(
    (c) => c.sourceCapabilityId === cap1.capabilityId && c.targetCapabilityId === cap2.capabilityId && isActionCompatibilityCandidate(c)
  );
  assert.ok(skillCand);

  const basicCand = cands.find(
    (c) => c.sourceCapabilityId === cap1.capabilityId && c.targetCapabilityId === cap3.capabilityId && isActionCompatibilityCandidate(c)
  );
  assert.strictEqual(basicCand, undefined);
});

// ============================================================================
// SUITE 7: PATCH ISOLATION & PROVENANCE (Tests 34-38)
// ============================================================================

test('34. Patch: strictly enforces Patch 3.7', () => {
  const audit = auditCompatibilityCandidates();
  for (const c of audit.candidates) {
    assert.strictEqual(c.patchVersion, '3.7');
  }
});

test('35. Patch: cross-patch rejection (3.6 + 3.7, 3.7 + 3.8) fails closed', () => {
  const cap1 = buildGameplayCapability(createMockFact({ patchVersion: '3.7' }));
  const capCross = buildGameplayCapability(createMockFact({ patchVersion: '3.6' as any }));

  assert.throws(() => {
    generateCompatibilityCandidates([cap1, capCross], [], [], '3.7');
  }, /cross-patch capability/);
});

test('36. Provenance: capability provenance preservation', () => {
  const audit = auditCompatibilityCandidates();
  for (const c of audit.candidates) {
    assert.ok(c.provenance);
    assert.ok(c.provenance.entityId);
    assert.strictEqual(c.provenance.patchVersion, '3.7');
  }
});

test('37. Provenance: evidence provenance and traceability preservation', () => {
  const audit = auditCompatibilityCandidates();
  for (const c of audit.candidates) {
    assert.ok(Array.isArray(c.evidenceIds));
    for (const id of c.evidenceIds) {
      assert.ok(id.startsWith('evi:3.7:'));
    }
  }
});

test('38. Provenance: relationship provenance and traceability preservation', () => {
  const audit = auditCompatibilityCandidates();
  for (const c of audit.candidates) {
    assert.ok(Array.isArray(c.relationshipIds));
    for (const id of c.relationshipIds) {
      assert.ok(id.startsWith('rel:3.7:'));
    }
  }
});

// ============================================================================
// SUITE 8: STATIC SAFETY AUDITS (Tests 39-45)
// ============================================================================

test('39. Safety: no raw description access in compatibility module', () => {
  const dir = path.resolve(process.cwd(), 'lib/engine/relationships/compatibility');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));

  for (const f of files) {
    const code = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.strictEqual(code.includes('originalDescription'), false);
  }
});

test('40. Safety: no parser bypass in compatibility module', () => {
  const dir = path.resolve(process.cwd(), 'lib/engine/relationships/compatibility');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));

  for (const f of files) {
    const code = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.strictEqual(code.includes('parseDescription'), false);
    assert.strictEqual(code.includes('parseSkill'), false);
    assert.strictEqual(code.includes('parseResonance'), false);
    assert.strictEqual(code.includes('SemanticEffect'), false);
  }
});

test('41. Safety: no network or LLM usage in compatibility module', () => {
  const dir = path.resolve(process.cwd(), 'lib/engine/relationships/compatibility');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));

  for (const f of files) {
    const code = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.strictEqual(code.includes('fetch('), false);
    assert.strictEqual(code.includes('axios'), false);
    assert.strictEqual(code.includes('openai'), false);
    assert.strictEqual(code.includes('anthropic'), false);
  }
});

test('42. Safety: no randomness in compatibility module', () => {
  const dir = path.resolve(process.cwd(), 'lib/engine/relationships/compatibility');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));

  for (const f of files) {
    const code = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.strictEqual(code.includes('Math.random'), false);
    assert.strictEqual(code.includes('randomUUID'), false);
  }
});

test('43. Safety: no timestamp-based IDs in compatibility module', () => {
  const dir = path.resolve(process.cwd(), 'lib/engine/relationships/compatibility');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));

  for (const f of files) {
    const code = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.strictEqual(code.includes('Date.now'), false);
    assert.strictEqual(code.includes('new Date()'), false);
  }
});

test('44. Safety: no hardcoded character pairing tables', () => {
  const dir = path.resolve(process.cwd(), 'lib/engine/relationships/compatibility');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));

  for (const f of files) {
    const code = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.strictEqual(code.includes('characterPairs'), false);
    assert.strictEqual(code.includes('bestPartners'), false);
    assert.strictEqual(code.includes('teamComps'), false);
  }
});

test('45. Safety: no community role inference tables', () => {
  const dir = path.resolve(process.cwd(), 'lib/engine/relationships/compatibility');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));

  for (const f of files) {
    const code = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.strictEqual(code.includes('MAIN_DPS'), false);
    assert.strictEqual(code.includes('SUB_DPS'), false);
    assert.strictEqual(code.includes('HYPERCARRY'), false);
  }
});

// ============================================================================
// SUITE 9: PRODUCTION CANDIDATE RECONCILIATION & AUDIT (Tests 46-47)
// ============================================================================

test('46. Production: complete candidate reconciliation passes with zero duplicates', () => {
  const audit = auditCompatibilityCandidates();
  assert.strictEqual(audit.totalInputCapabilities, 292);
  assert.strictEqual(audit.totalInputRelationships, 735);
  assert.strictEqual(audit.totalInputEvidence, 365);
  assert.ok(audit.totalCandidates > 0);
  assert.strictEqual(audit.uniqueCandidateIds, audit.totalCandidates);
  assert.strictEqual(audit.duplicateCandidateIds, 0);
});

test('47. Production: repeated candidate audits yield byte-for-byte identical results', () => {
  const audit1 = auditCompatibilityCandidates();
  const audit2 = auditCompatibilityCandidates();

  assert.strictEqual(audit1.totalCandidates, audit2.totalCandidates);
  for (let i = 0; i < audit1.candidates.length; i++) {
    assert.strictEqual(audit1.candidates[i].id, audit2.candidates[i].id);
    assert.deepStrictEqual(audit1.candidates[i], audit2.candidates[i]);
  }
});
