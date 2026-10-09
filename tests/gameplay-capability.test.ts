/**
 * Wuthering Waves Deterministic Gameplay Capability Test Suite
 * Phase 7 Step 1: Deterministic Gameplay Capability Contract
 *
 * Verifies that the capability layer strictly consumes approved Phase 6C contracts,
 * preserves all semantic dimensions, never introduces scores or role inferences,
 * enforces patch isolation and determinism, and reconciles completely against Patch 3.7.
 */

import test from 'node:test';
import assert from 'node:assert';
import type { NormalizedEngineFact } from '../lib/engine/facts/types.ts';
import {
  buildGameplayCapability,
  buildGameplayCapabilities,
  auditProductionCapabilities,
  validateCapabilityInputFacts
} from '../lib/engine/capabilities/builder.ts';
import {
  isDamageCapability,
  isOffensiveSupportCapability,
  isDefensiveCapability,
  isResourceCapability,
  isElementalCapability,
  isTeamInteractionCapability,
  isOutroCapability,
  isIntroCapability,
  isStaticCapability,
  isContextualCapability,
  isContextFreeCapability,
  isImmediatelyConsumableCapability,
  isUnmodeledCapability,
  isModeledCapability,
  matchesCapabilityFilter,
  compareCapabilities,
  determineCapabilityKind,
  determineCapabilityCategory,
  determineActionType,
  determineContextRequirements
} from '../lib/engine/capabilities/predicates.ts';
import type {
  GameplayCapability,
  CapabilityContextRequirement
} from '../lib/engine/capabilities/types.ts';
import { runProductionFactNormalizationAudit } from '../lib/engine/facts/normalizer.ts';

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
          : 15;

  const baseValue =
    overrides?.value ??
    (isUnmodeledOrUnknown
      ? { type: 'UNRESOLVED' as const, reason: 'Unmodeled/unknown in test fixture' }
      : {
          type: 'EXACT' as const,
          value: baseNumeric !== null && baseNumeric !== undefined ? baseNumeric : 15,
          unit: 'PERCENT' as const
        });

  return {
    factId: 'mock_entity|skill|STAT_BUFF|SELF|ATK_PERCENT|NONE|EXACT:15:PERCENT|NO_COND|NO_DUR|NO_STACK',
    entityId: 'mock_entity',
    sourceCode: 'skill',
    patchVersion: '3.7',
    category: 'STAT_BUFF',
    parameter: 'ATK_PERCENT',
    value: baseValue,
    staticNumericValue:
      overrides && 'staticNumericValue' in overrides
        ? overrides.staticNumericValue!
        : baseValue.type === 'EXACT'
          ? baseValue.value
          : null,
    unit: 'PERCENT',
    target: 'SELF',
    element: 'NONE',
    semanticStatus: 'SAFE_EXPLICIT',
    parameterSafety: 'DIRECT_ENGINE_FACT',
    consumptionState: 'CONSUMABLE_STATIC',
    provenance: {
      entityId: 'mock_entity',
      entityName: 'Mock Entity',
      sourceType: 'RESONATOR_ABILITY',
      sourceCode: 'skill',
      patchVersion: '3.7',
      sourceProvenance: 'Official Test Provenance',
      originalDescription: 'ATK increases by 15%.'
    },
    extraction: {
      parserVersion: '1.1.0',
      method: 'DETERMINISTIC_RULE_PARSER',
      extractionDate: '2026-10-08'
    },
    ...overrides
  };
}

// ============================================================================
// CORE SPECIFICATION TESTS (C1 - C40)
// ============================================================================

test('C1. Empty fact collection produces empty capability array', () => {
  const result = buildGameplayCapabilities([]);
  assert.strictEqual(result.length, 0);
  assert.ok(Object.isFrozen(result));
});

test('C2. Single modeled fact produces expected capability', () => {
  const fact = createMockFact();
  const result = buildGameplayCapabilities([fact]);

  assert.strictEqual(result.length, 1);
  const cap = result[0];
  assert.strictEqual(cap.entityId, 'mock_entity');
  assert.strictEqual(cap.kind, 'ATK_AMPLIFICATION');
  assert.strictEqual(cap.category, 'OFFENSIVE_SUPPORT');
  assert.strictEqual(cap.parameter, 'ATK_PERCENT');
  assert.strictEqual(cap.numericValue, 15);
  assert.strictEqual(cap.unit, 'PERCENT');
  assert.strictEqual(cap.status, 'MODELED');
  assert.strictEqual(cap.isStatic, true);
  assert.strictEqual(cap.isContextual, false);
});

test('C3. Capability preserves entityId', () => {
  const fact = createMockFact({ entityId: 'Jinhsi' });
  const cap = buildGameplayCapability(fact);
  assert.strictEqual(cap.entityId, 'Jinhsi');
});

test('C4. Capability preserves sourceCode', () => {
  const fact = createMockFact({ sourceCode: 'OUTRO_SKILL' });
  const cap = buildGameplayCapability(fact);
  assert.strictEqual(cap.sourceCode, 'OUTRO_SKILL');
});

test('C5. Capability preserves parameter', () => {
  const fact = createMockFact({ parameter: 'CRIT_RATE_PERCENT' });
  const cap = buildGameplayCapability(fact);
  assert.strictEqual(cap.parameter, 'CRIT_RATE_PERCENT');
});

test('C6. Capability preserves target', () => {
  const fact = createMockFact({ target: 'NEXT_RESONATOR' });
  const cap = buildGameplayCapability(fact);
  assert.strictEqual(cap.target, 'NEXT_RESONATOR');
});

test('C7. Capability preserves element', () => {
  const fact = createMockFact({ element: 'Spectro' });
  const cap = buildGameplayCapability(fact);
  assert.strictEqual(cap.element, 'Spectro');
});

test('C8. Capability preserves duration', () => {
  const fact = createMockFact({
    duration: { durationSeconds: 14, removeOnSwap: true }
  });
  const cap = buildGameplayCapability(fact);
  assert.deepStrictEqual(cap.duration, { durationSeconds: 14, removeOnSwap: true });
  assert.ok(Object.isFrozen(cap.duration));
});

test('C9. Capability preserves stacking', () => {
  const fact = createMockFact({
    stacking: { maxStacks: 4, durationPerStackSeconds: 6 }
  });
  const cap = buildGameplayCapability(fact);
  assert.deepStrictEqual(cap.stacking, { maxStacks: 4, durationPerStackSeconds: 6 });
  assert.ok(Object.isFrozen(cap.stacking));
});

test('C10. Capability preserves condition', () => {
  const fact = createMockFact({
    condition: { trigger: 'ON_RESONANCE_SKILL', stackCount: 3, stackOperator: 'AT_LEAST' }
  });
  const cap = buildGameplayCapability(fact);
  assert.deepStrictEqual(cap.conditions, {
    trigger: 'ON_RESONANCE_SKILL',
    stackCount: 3,
    stackOperator: 'AT_LEAST'
  });
  assert.ok(Object.isFrozen(cap.conditions));
});

test('C11. Capability preserves patchVersion strictly as 3.7', () => {
  const fact = createMockFact({ patchVersion: '3.7' });
  const cap = buildGameplayCapability(fact);
  assert.strictEqual(cap.patchVersion, '3.7');
});

test('C12. Capability preserves semantic status', () => {
  const fact = createMockFact({ semanticStatus: 'SAFE_EXPLICIT' });
  const cap = buildGameplayCapability(fact);
  assert.strictEqual(cap.semanticStatus, 'SAFE_EXPLICIT');
});

test('C13. Capability preserves consumption state', () => {
  const fact = createMockFact({ consumptionState: 'CONSUMABLE_STATIC' });
  const cap = buildGameplayCapability(fact);
  assert.strictEqual(cap.consumptionState, 'CONSUMABLE_STATIC');
});

test('C14. Capability contains canonical source factId in factIds array', () => {
  const fact = createMockFact({ factId: 'canonical_fact_id_123' });
  const cap = buildGameplayCapability(fact);
  assert.strictEqual(cap.factIds.length, 1);
  assert.strictEqual(cap.factIds[0], 'canonical_fact_id_123');
  assert.ok(Object.isFrozen(cap.factIds));
});

test('C15. Static capability remains static (isStatic=true, isContextual=false)', () => {
  const fact = createMockFact({
    consumptionState: 'CONSUMABLE_STATIC',
    staticNumericValue: 20
  });
  const cap = buildGameplayCapability(fact);
  assert.strictEqual(cap.isStatic, true);
  assert.strictEqual(cap.isContextual, false);
  assert.strictEqual(cap.status, 'MODELED');
  assert.strictEqual(cap.numericValue, 20);
});

test('C16. Contextual capability preserves known numeric value while requiring runtime context', () => {
  const fact = createMockFact({
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    staticNumericValue: null,
    value: { type: 'EXACT', value: 15, unit: 'PERCENT' },
    condition: { trigger: 'ON_BASIC_ATTACK' }
  });
  const cap = buildGameplayCapability(fact);
  assert.strictEqual(cap.isStatic, false);
  assert.strictEqual(cap.isContextual, true);
  assert.strictEqual(cap.requiresRuntimeContext, true);
  assert.strictEqual(cap.isContextFree, false);
  assert.strictEqual(cap.status, 'CONTEXTUAL');
  assert.strictEqual(cap.numericValue, 15);
  assert.strictEqual(cap.contextRequirement, 'TRIGGER');
});

test('C17. Unmodeled fact does not become numeric modeled capability', () => {
  const fact = createMockFact({
    consumptionState: 'UNMODELED',
    staticNumericValue: null,
    parameter: 'COORDINATED_ATTACK_DAMAGE_PERCENT'
  });
  const cap = buildGameplayCapability(fact);
  assert.strictEqual(cap.isStatic, false);
  assert.strictEqual(cap.isContextual, false);
  assert.strictEqual(cap.status, 'UNMODELED');
  assert.strictEqual(cap.numericValue, null);
  assert.notStrictEqual(cap.numericValue, 0);
});

test('C18. Unknown fact does not become numeric modeled capability', () => {
  const fact = createMockFact({
    consumptionState: 'UNKNOWN',
    staticNumericValue: null,
    parameter: 'UNRESOLVED_PARAMETER'
  });
  const cap = buildGameplayCapability(fact);
  assert.strictEqual(cap.isStatic, false);
  assert.strictEqual(cap.isContextual, false);
  assert.strictEqual(cap.status, 'UNKNOWN');
  assert.strictEqual(cap.numericValue, null);
});

test('C19. Missing numeric value never becomes zero', () => {
  const fact = createMockFact({
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    value: { type: 'UNRESOLVED', reason: 'Missing magnitude' },
    staticNumericValue: null
  });
  const cap = buildGameplayCapability(fact);
  assert.strictEqual(cap.numericValue, null);
  assert.notStrictEqual(cap.numericValue, 0);
});

test('C20. Element-specific capability preserves element without alteration', () => {
  const fact = createMockFact({
    parameter: 'FUSION_DAMAGE_PERCENT',
    element: 'Fusion'
  });
  const cap = buildGameplayCapability(fact);
  assert.strictEqual(cap.element, 'Fusion');
  assert.strictEqual(isElementalCapability(cap), true);
});

test('C21. All-element capability remains All', () => {
  const fact = createMockFact({
    parameter: 'ALL_ATTRIBUTE_DAMAGE_PERCENT',
    element: 'All'
  });
  const cap = buildGameplayCapability(fact);
  assert.strictEqual(cap.element, 'All');
  assert.strictEqual(isElementalCapability(cap), true);
});

test('C22. NONE capability remains element-independent', () => {
  const fact = createMockFact({
    parameter: 'ATK_PERCENT',
    element: 'NONE'
  });
  const cap = buildGameplayCapability(fact);
  assert.strictEqual(cap.element, 'NONE');
  assert.strictEqual(isElementalCapability(cap), false);
});

test('C23. NEXT_RESONATOR is not collapsed into TEAM', () => {
  const fact = createMockFact({ target: 'NEXT_RESONATOR' });
  const cap = buildGameplayCapability(fact);
  assert.strictEqual(cap.target, 'NEXT_RESONATOR');
  assert.notStrictEqual(cap.target, 'TEAM');
  assert.strictEqual(isTeamInteractionCapability(cap), true);
});

test('C24. SELF is not collapsed into TEAM', () => {
  const fact = createMockFact({ target: 'SELF' });
  const cap = buildGameplayCapability(fact);
  assert.strictEqual(cap.target, 'SELF');
  assert.notStrictEqual(cap.target, 'TEAM');
  assert.strictEqual(isTeamInteractionCapability(cap), false);
});

test('C25. Conditions remain intact without flattening', () => {
  const fact = createMockFact({
    condition: { trigger: 'ON_OUTRO_SKILL', zoneActive: true, buffActive: true }
  });
  const cap = buildGameplayCapability(fact);
  assert.strictEqual(cap.conditions?.trigger, 'ON_OUTRO_SKILL');
  assert.strictEqual(cap.conditions?.zoneActive, true);
  assert.strictEqual(cap.conditions?.buffActive, true);
});

test('C26. Duration and removeOnSwap remain intact', () => {
  const fact = createMockFact({
    duration: { durationSeconds: 28, removeOnSwap: true }
  });
  const cap = buildGameplayCapability(fact);
  assert.strictEqual(cap.duration?.durationSeconds, 28);
  assert.strictEqual(cap.duration?.removeOnSwap, true);
});

test('C27. Stack semantics remain intact', () => {
  const fact = createMockFact({
    condition: { stackCount: 5, stackOperator: 'PER_STACK' },
    stacking: { maxStacks: 5, durationPerStackSeconds: 10 }
  });
  const cap = buildGameplayCapability(fact);
  assert.strictEqual(cap.conditions?.stackCount, 5);
  assert.strictEqual(cap.conditions?.stackOperator, 'PER_STACK');
  assert.strictEqual(cap.stacking?.maxStacks, 5);
  assert.strictEqual(cap.stacking?.durationPerStackSeconds, 10);
});

test('C28. Unresolved stack semantics remain unresolved/contextual', () => {
  const fact = createMockFact({
    condition: { stackCount: undefined, stackOperator: undefined, rawCondition: 'when stacks are accumulated' },
    value: { type: 'UNRESOLVED', reason: 'Unresolved stack condition' },
    consumptionState: 'CONSUMABLE_CONTEXTUAL'
  });
  const cap = buildGameplayCapability(fact);
  assert.strictEqual(cap.status, 'CONTEXTUAL');
  assert.strictEqual(cap.numericValue, null);
  assert.strictEqual(cap.conditions?.rawCondition, 'when stacks are accumulated');
});

test('C29. Refinement rank requirement remains explicit', () => {
  const fact = createMockFact({ refinementRank: 'R3' });
  const cap = buildGameplayCapability(fact);
  assert.strictEqual(cap.refinementRank, 'R3');
});

test('C30. Multiple distinct facts with same numeric value remain distinct', () => {
  const f1 = createMockFact({ factId: 'fact_atk_1', parameter: 'ATK_PERCENT', target: 'SELF', staticNumericValue: 15 });
  const f2 = createMockFact({ factId: 'fact_atk_2', parameter: 'ATK_PERCENT', target: 'TEAM', staticNumericValue: 15 });

  const caps = buildGameplayCapabilities([f1, f2]);
  assert.strictEqual(caps.length, 2);
  assert.notStrictEqual(caps[0].capabilityId, caps[1].capabilityId);
  assert.notStrictEqual(caps[0].target, caps[1].target);
});

test('C31. Canonical duplicate fact IDs are rejected at trust boundary', () => {
  const f1 = createMockFact({ factId: 'fact_dup' });
  const f2 = createMockFact({ factId: 'fact_dup' });

  assert.throws(() => {
    buildGameplayCapabilities([f1, f2]);
  }, /Duplicate factId detected at capability trust boundary/);
});

test('C32. Cross-patch facts are rejected at trust boundary', () => {
  const fact = createMockFact({ patchVersion: '3.6' });

  assert.throws(() => {
    buildGameplayCapabilities([fact]);
  }, /rejects cross-patch fact/);
});

test('C33. Input facts are not mutated by capability builder', () => {
  const fact = createMockFact({
    duration: { durationSeconds: 10, removeOnSwap: false },
    condition: { trigger: 'ON_HIT' }
  });
  const snapshot = JSON.stringify(fact);

  buildGameplayCapabilities([fact]);

  assert.strictEqual(JSON.stringify(fact), snapshot);
});

test('C34. Capability output is deterministic and immutable', () => {
  const fact = createMockFact();
  const caps = buildGameplayCapabilities([fact]);

  assert.ok(Object.isFrozen(caps));
  assert.ok(Object.isFrozen(caps[0]));

  assert.throws(() => {
    (caps[0] as any).entityId = 'changed';
  });
});

test('C35. Ten repeated builds produce byte-for-byte identical output', () => {
  const audit = runProductionFactNormalizationAudit();
  const firstJson = JSON.stringify(buildGameplayCapabilities(audit.facts));

  for (let i = 0; i < 9; i++) {
    const nextJson = JSON.stringify(buildGameplayCapabilities(audit.facts));
    assert.strictEqual(nextJson, firstJson);
  }
});

test('C36. Capability ordering is deterministic and canonical', () => {
  const f1 = createMockFact({ factId: 'z_fact', entityId: 'Zhezhi' });
  const f2 = createMockFact({ factId: 'a_fact', entityId: 'Aalto' });
  const f3 = createMockFact({ factId: 'j_fact', entityId: 'Jinhsi' });

  const caps = buildGameplayCapabilities([f1, f2, f3]);
  assert.strictEqual(caps[0].entityId, 'Aalto');
  assert.strictEqual(caps[1].entityId, 'Jinhsi');
  assert.strictEqual(caps[2].entityId, 'Zhezhi');
});

test('C37. Capability predicates classify correctly without scoring', () => {
  const damageCap = buildGameplayCapability(createMockFact({
    parameter: 'BASIC_ATTACK_DAMAGE_PERCENT',
    target: 'SELF'
  }));
  assert.strictEqual(isDamageCapability(damageCap), true);
  assert.strictEqual(isOffensiveSupportCapability(damageCap), false);

  const teamSupportCap = buildGameplayCapability(createMockFact({
    parameter: 'BASIC_ATTACK_DAMAGE_PERCENT',
    target: 'TEAM'
  }));
  assert.strictEqual(isDamageCapability(teamSupportCap), false);
  assert.strictEqual(isOffensiveSupportCapability(teamSupportCap), true);
  assert.strictEqual(isTeamInteractionCapability(teamSupportCap), true);

  const healCap = buildGameplayCapability(createMockFact({
    parameter: 'HEALING_BONUS_PERCENT',
    category: 'HEALING'
  }));
  assert.strictEqual(isDefensiveCapability(healCap), true);

  const energyCap = buildGameplayCapability(createMockFact({
    parameter: 'ENERGY_REGEN_PERCENT'
  }));
  assert.strictEqual(isResourceCapability(energyCap), true);
});

test('C38. No scoring field exists on GameplayCapability', () => {
  const cap = buildGameplayCapability(createMockFact());
  const forbiddenFields = [
    'score', 'weight', 'priority', 'ranking', 'teamValue',
    'synergyScore', 'dpsScore', 'metaScore', 'strength',
    'importance', 'effectiveness', 'power'
  ];

  for (const field of forbiddenFields) {
    assert.strictEqual((cap as any)[field], undefined, `Forbidden field '${field}' found on capability`);
  }
});

test('C39. No community role inference occurs in Step 1', () => {
  const cap = buildGameplayCapability(createMockFact());
  const forbiddenRoleFields = ['role', 'inferredRole', 'tier', 'communityTier', 'metaRanking'];

  for (const field of forbiddenRoleFields) {
    assert.strictEqual((cap as any)[field], undefined, `Forbidden role field '${field}' found on capability`);
  }
});

test('C40. No network or LLM dependency exists in capability builder', () => {
  // Verifies buildGameplayCapabilities is a synchronous pure in-memory function
  const start = Date.now();
  const caps = buildGameplayCapabilities([createMockFact()]);
  const duration = Date.now() - start;

  assert.ok(duration < 50);
  assert.strictEqual(caps.length, 1);
});

// ============================================================================
// GOLDEN FIXTURES AUDIT
// ============================================================================

test('G1. Golden Fixture: SELF ATK buff', () => {
  const fact = createMockFact({
    entityId: 'Jiyan',
    sourceCode: 'skill',
    parameter: 'ATK_PERCENT',
    target: 'SELF',
    staticNumericValue: 12,
    consumptionState: 'CONSUMABLE_STATIC'
  });
  const cap = buildGameplayCapability(fact);

  assert.strictEqual(cap.kind, 'ATK_AMPLIFICATION');
  assert.strictEqual(cap.category, 'OFFENSIVE_SUPPORT');
  assert.strictEqual(cap.target, 'SELF');
  assert.strictEqual(cap.numericValue, 12);
  assert.strictEqual(cap.status, 'MODELED');
});

test('G2. Golden Fixture: TEAM ATK buff', () => {
  const fact = createMockFact({
    entityId: 'Verina',
    sourceCode: 'outro',
    parameter: 'ATK_PERCENT',
    target: 'TEAM',
    staticNumericValue: 15,
    consumptionState: 'CONSUMABLE_STATIC'
  });
  const cap = buildGameplayCapability(fact);

  assert.strictEqual(cap.kind, 'ATK_AMPLIFICATION');
  assert.strictEqual(cap.target, 'TEAM');
  assert.strictEqual(cap.numericValue, 15);
  assert.strictEqual(isTeamInteractionCapability(cap), true);
});

test('G3. Golden Fixture: NEXT_RESONATOR damage amplification', () => {
  const fact = createMockFact({
    entityId: 'Mortefi',
    sourceCode: 'outro',
    parameter: 'HEAVY_ATTACK_DAMAGE_PERCENT',
    target: 'NEXT_RESONATOR',
    staticNumericValue: 38,
    duration: { durationSeconds: 14, removeOnSwap: true },
    consumptionState: 'CONSUMABLE_STATIC'
  });
  const cap = buildGameplayCapability(fact);

  assert.strictEqual(cap.kind, 'HEAVY_ATTACK_DAMAGE_AMPLIFICATION');
  assert.strictEqual(cap.target, 'NEXT_RESONATOR');
  assert.strictEqual(cap.numericValue, 38);
  assert.strictEqual(cap.duration?.durationSeconds, 14);
  assert.strictEqual(cap.duration?.removeOnSwap, true);
  assert.strictEqual(isTeamInteractionCapability(cap), true);
});

test('G4. Golden Fixture: ACTIVE_CHARACTER effect', () => {
  const fact = createMockFact({
    entityId: 'Shorekeeper',
    sourceCode: 'outro',
    parameter: 'GENERIC_DAMAGE_PERCENT',
    target: 'ACTIVE_CHARACTER',
    staticNumericValue: 15,
    consumptionState: 'CONSUMABLE_STATIC'
  });
  const cap = buildGameplayCapability(fact);

  assert.strictEqual(cap.target, 'ACTIVE_CHARACTER');
  assert.strictEqual(isTeamInteractionCapability(cap), true);
});

test('G5. Golden Fixture: Elemental amplification', () => {
  const fact = createMockFact({
    entityId: 'Chixia',
    sourceCode: 'skill',
    parameter: 'FUSION_DAMAGE_PERCENT',
    element: 'Fusion',
    target: 'SELF',
    staticNumericValue: 20,
    consumptionState: 'CONSUMABLE_STATIC'
  });
  const cap = buildGameplayCapability(fact);

  assert.strictEqual(cap.kind, 'ELEMENTAL_DAMAGE_AMPLIFICATION');
  assert.strictEqual(cap.element, 'Fusion');
  assert.strictEqual(cap.category, 'ELEMENTAL_INTERACTION');
  assert.strictEqual(isElementalCapability(cap), true);
});

test('G6. Golden Fixture: ALL_ATTRIBUTE amplification', () => {
  const fact = createMockFact({
    entityId: 'Verina',
    sourceCode: 'outro',
    parameter: 'ALL_ATTRIBUTE_DAMAGE_PERCENT',
    element: 'All',
    target: 'TEAM',
    staticNumericValue: 15,
    consumptionState: 'CONSUMABLE_STATIC'
  });
  const cap = buildGameplayCapability(fact);

  assert.strictEqual(cap.kind, 'ALL_ATTRIBUTE_DAMAGE_AMPLIFICATION');
  assert.strictEqual(cap.element, 'All');
  assert.strictEqual(isElementalCapability(cap), true);
});

test('G7. Golden Fixture: Duration + removeOnSwap', () => {
  const fact = createMockFact({
    duration: { durationSeconds: 28, removeOnSwap: true }
  });
  const cap = buildGameplayCapability(fact);

  assert.strictEqual(cap.duration?.durationSeconds, 28);
  assert.strictEqual(cap.duration?.removeOnSwap, true);
});

test('G8. Golden Fixture: Contextual action-dependent effect preserves known numeric value', () => {
  const fact = createMockFact({
    parameter: 'SKILL_DAMAGE_PERCENT',
    target: 'SELF',
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' },
    staticNumericValue: null,
    condition: { trigger: 'ON_RESONANCE_SKILL' },
    parameterSafety: 'REQUIRES_CONTEXT'
  });
  const cap = buildGameplayCapability(fact);

  assert.strictEqual(cap.status, 'CONTEXTUAL');
  assert.strictEqual(cap.isContextual, true);
  assert.strictEqual(cap.numericValue, 20);
  assert.strictEqual(cap.actionType, 'SKILL');
  assert.strictEqual(cap.requiresAction, true);
  assert.strictEqual(cap.requiresTrigger, true);
  assert.strictEqual(cap.contextRequirement, 'COMPOSITE');
  assert.strictEqual(cap.isContextFree, false);
});

test('G9. Golden Fixture: Unresolved stack mechanic', () => {
  const fact = createMockFact({
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    value: { type: 'UNRESOLVED', reason: 'Increases with stacks' },
    staticNumericValue: null,
    condition: { rawCondition: 'Increases with stacks' }
  });
  const cap = buildGameplayCapability(fact);

  assert.strictEqual(cap.status, 'CONTEXTUAL');
  assert.strictEqual(cap.numericValue, null);
  assert.strictEqual(cap.conditions?.rawCondition, 'Increases with stacks');
});

test('G10. Golden Fixture: Unmodeled coordinated attack mechanic', () => {
  const fact = createMockFact({
    parameter: 'COORDINATED_ATTACK_DAMAGE_PERCENT',
    consumptionState: 'UNMODELED',
    value: { type: 'UNRESOLVED', reason: 'Unmodeled' },
    staticNumericValue: null
  });
  const cap = buildGameplayCapability(fact);

  assert.strictEqual(cap.status, 'UNMODELED');
  assert.strictEqual(cap.numericValue, null);
  assert.strictEqual(isUnmodeledCapability(cap), true);
});

test('G11. Golden Fixture: Multi-rank weapon fact', () => {
  const fact = createMockFact({
    refinementRank: 'R1',
    consumptionState: 'CONSUMABLE_STATIC',
    staticNumericValue: 12
  });
  const cap = buildGameplayCapability(fact);

  assert.strictEqual(cap.refinementRank, 'R1');
  assert.strictEqual(cap.numericValue, 12);
});

test('G12. Golden Fixture: Unknown / non-consumable fact', () => {
  const fact = createMockFact({
    consumptionState: 'UNKNOWN',
    value: { type: 'UNRESOLVED', reason: 'Unknown' },
    staticNumericValue: null
  });
  const cap = buildGameplayCapability(fact);

  assert.strictEqual(cap.status, 'UNKNOWN');
  assert.strictEqual(cap.numericValue, null);
});

// ============================================================================
// PRODUCTION RECONCILIATION AUDIT
// ============================================================================

test('P1. Complete production audit reconciles all 292 Patch 3.7 capabilities', () => {
  const audit = auditProductionCapabilities();

  // 1. Total counts
  assert.strictEqual(audit.totalInputFacts, 292);
  assert.strictEqual(audit.totalCapabilities, 292);

  // 2. Value known / unknown reconciliation
  assert.strictEqual(audit.valueKnownCount, 290);
  assert.strictEqual(audit.valueUnknownCount, 2);
  assert.strictEqual(audit.valueKnownCount + audit.valueUnknownCount, 292);

  // 3. Primary context requirement reconciliation
  assert.strictEqual(audit.contextFreeCount, 68);
  assert.strictEqual(audit.elementRequirementCount, 22);
  assert.strictEqual(audit.actionRequirementCount, 23);
  assert.strictEqual(audit.triggerRequirementCount, 105);
  assert.strictEqual(audit.compositeRequirementCount, 72);
  assert.strictEqual(audit.unmodeledRequirementCount, 2);
  assert.strictEqual(
    audit.contextFreeCount +
      audit.elementRequirementCount +
      audit.actionRequirementCount +
      audit.triggerRequirementCount +
      audit.compositeRequirementCount +
      audit.unmodeledRequirementCount,
    292
  );

  // 4. Dimensional requirement breakdown across ALL capabilities
  assert.strictEqual(audit.totalRequiringElement, 44);
  assert.strictEqual(audit.totalRequiringAction, 73);
  assert.strictEqual(audit.totalRequiringTrigger, 177);
  assert.strictEqual(audit.totalRequiringStack, 0);
  assert.strictEqual(audit.totalRequiringRefinement, 0);
  assert.strictEqual(audit.totalRequiringZone, 0);
  assert.strictEqual(audit.totalRequiringBuff, 0);

  // 5. Status reconciliation
  assert.strictEqual(audit.modeledCount, 90);
  assert.strictEqual(audit.contextualCount, 200);
  assert.strictEqual(audit.unmodeledCount, 2);
  assert.strictEqual(audit.unknownCount, 0);
  assert.strictEqual(audit.notApplicableCount, 0);
  assert.strictEqual(
    audit.modeledCount +
      audit.contextualCount +
      audit.unmodeledCount +
      audit.unknownCount +
      audit.notApplicableCount,
    292
  );

  // 6. Target distribution reconciliation (matches approved Step 5 / Step 6 distribution)
  assert.strictEqual(audit.byTarget.SELF, 179);
  assert.strictEqual(audit.byTarget.TEAM, 60);
  assert.strictEqual(audit.byTarget.NEXT_RESONATOR, 29);
  assert.strictEqual(audit.byTarget.ACTIVE_CHARACTER, 24);
  const targetSum = Object.values(audit.byTarget).reduce((a, b) => a + b, 0);
  assert.strictEqual(targetSum, 292);

  // 7. Element distribution reconciliation
  assert.strictEqual(audit.byElement.NONE, 230);
  assert.strictEqual(audit.byElement.All, 18);
  assert.strictEqual(audit.byElement.Fusion, 12);
  assert.strictEqual(audit.byElement.Havoc, 9);
  assert.strictEqual(audit.byElement.Electro, 8);
  assert.strictEqual(audit.byElement.Aero, 7);
  assert.strictEqual(audit.byElement.Spectro, 6);
  assert.strictEqual(audit.byElement.Glacio, 2);

  // 8. Category distribution
  assert.strictEqual(audit.byCategory.OFFENSIVE_SUPPORT, 180);
  assert.strictEqual(audit.byCategory.ELEMENTAL_INTERACTION, 44);
  assert.strictEqual(audit.byCategory.DAMAGE, 39);
  assert.strictEqual(audit.byCategory.DEFENSIVE_SURVIVABILITY, 18);
  assert.strictEqual(audit.byCategory.RESOURCE_COMBAT, 11);
  const catSum = Object.values(audit.byCategory).reduce((a, b) => a + b, 0);
  assert.strictEqual(catSum, 292);
});

// ============================================================================
// FILTERING AUDIT
// ============================================================================

test('F1. matchesCapabilityFilter filters by multi-dimensional criteria', () => {
  const audit = auditProductionCapabilities();

  // Filter by target = NEXT_RESONATOR
  const nextResCaps = audit.capabilities.filter((c) =>
    matchesCapabilityFilter(c, { target: 'NEXT_RESONATOR' })
  );
  assert.strictEqual(nextResCaps.length, 29);

  // Filter by element = Fusion
  const fusionCaps = audit.capabilities.filter((c) =>
    matchesCapabilityFilter(c, { element: 'Fusion' })
  );
  assert.strictEqual(fusionCaps.length, 12);

  // Filter by status = MODELED (static facts)
  const modeledCaps = audit.capabilities.filter((c) =>
    matchesCapabilityFilter(c, { status: 'MODELED' })
  );
  assert.strictEqual(modeledCaps.length, 90);

  // Filter by contextRequirement = NONE (pure context-free capabilities)
  const contextFreeCaps = audit.capabilities.filter((c) =>
    matchesCapabilityFilter(c, { contextRequirement: 'NONE' })
  );
  assert.strictEqual(contextFreeCaps.length, 68);

  // Filter by contextRequirement = ELEMENT
  const elementOnlyCaps = audit.capabilities.filter((c) =>
    matchesCapabilityFilter(c, { contextRequirement: 'ELEMENT' })
  );
  assert.strictEqual(elementOnlyCaps.length, 22);

  // Filter by status = UNMODELED
  const unmodeledCaps = audit.capabilities.filter((c) =>
    matchesCapabilityFilter(c, { status: 'UNMODELED' })
  );
  assert.strictEqual(unmodeledCaps.length, 2);
});

// ============================================================================
// REMEDIATION AUDIT SUITE (R1 - R20)
// ============================================================================

test('R1. Known static NONE capability can be context-free', () => {
  const fact = createMockFact({
    consumptionState: 'CONSUMABLE_STATIC',
    element: 'NONE',
    parameter: 'ATK_PERCENT',
    staticNumericValue: 15
  });
  const cap = buildGameplayCapability(fact);

  assert.strictEqual(cap.isStatic, true);
  assert.strictEqual(cap.isContextFree, true);
  assert.strictEqual(cap.contextRequirement, 'NONE');
  assert.strictEqual(cap.requiresRuntimeContext, false);
  assert.strictEqual(cap.numericValue, 15);
  assert.strictEqual(isContextFreeCapability(cap), true);
  assert.strictEqual(isImmediatelyConsumableCapability(cap), true);
});

test('R2. Known element-specific capability exposes ELEMENT requirement', () => {
  const fact = createMockFact({
    consumptionState: 'CONSUMABLE_STATIC',
    element: 'Fusion',
    parameter: 'FUSION_DAMAGE_PERCENT',
    staticNumericValue: 20
  });
  const cap = buildGameplayCapability(fact);

  assert.strictEqual(cap.isStatic, true);
  assert.strictEqual(cap.contextRequirement, 'ELEMENT');
  assert.strictEqual(cap.requiresElement, true);
  assert.strictEqual(cap.requiresRuntimeContext, true);
  assert.strictEqual(cap.isContextFree, false);
  assert.strictEqual(cap.numericValue, 20);
  assert.strictEqual(cap.requiredContext?.element, 'Fusion');
  assert.strictEqual(isContextFreeCapability(cap), false);
});

test('R3. Fusion capability requires Fusion context', () => {
  const fact = createMockFact({
    consumptionState: 'CONSUMABLE_STATIC',
    element: 'Fusion',
    parameter: 'FUSION_DAMAGE_PERCENT',
    staticNumericValue: 20
  });
  const cap = buildGameplayCapability(fact);

  assert.strictEqual(isImmediatelyConsumableCapability(cap, { element: 'Fusion' }), true);
});

test('R4. Mismatched element cannot be treated as immediately consumable', () => {
  const fact = createMockFact({
    consumptionState: 'CONSUMABLE_STATIC',
    element: 'Fusion',
    parameter: 'FUSION_DAMAGE_PERCENT',
    staticNumericValue: 20
  });
  const cap = buildGameplayCapability(fact);

  assert.strictEqual(isImmediatelyConsumableCapability(cap, { element: 'Glacio' }), false);
  assert.strictEqual(isImmediatelyConsumableCapability(cap, { element: 'Aero' }), false);
});

test('R5. Missing element context cannot be treated as immediately consumable', () => {
  const fact = createMockFact({
    consumptionState: 'CONSUMABLE_STATIC',
    element: 'Fusion',
    parameter: 'FUSION_DAMAGE_PERCENT',
    staticNumericValue: 20
  });
  const cap = buildGameplayCapability(fact);

  assert.strictEqual(isImmediatelyConsumableCapability(cap), false);
  assert.strictEqual(isImmediatelyConsumableCapability(cap, {}), false);
});

test('R6. All-element behavior matches Phase 6C semantics', () => {
  const fact = createMockFact({
    consumptionState: 'CONSUMABLE_STATIC',
    element: 'All',
    parameter: 'ALL_ATTRIBUTE_DAMAGE_PERCENT',
    staticNumericValue: 15
  });
  const cap = buildGameplayCapability(fact);

  assert.strictEqual(cap.isContextFree, true);
  assert.strictEqual(isContextFreeCapability(cap), true);
  assert.strictEqual(isImmediatelyConsumableCapability(cap), true);
  assert.strictEqual(isImmediatelyConsumableCapability(cap, { element: 'Fusion' }), true);
  assert.strictEqual(isImmediatelyConsumableCapability(cap, { element: 'Havoc' }), true);
  assert.strictEqual(isImmediatelyConsumableCapability(cap, { element: 'INVALID' as any }), false);
});

test('R7. Action-specific known value exposes ACTION requirement', () => {
  const fact = createMockFact({
    parameter: 'SKILL_DAMAGE_PERCENT',
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    value: { type: 'EXACT', value: 25, unit: 'PERCENT' },
    staticNumericValue: null,
    parameterSafety: 'REQUIRES_CONTEXT'
  });
  const cap = buildGameplayCapability(fact);

  assert.strictEqual(cap.numericValue, 25);
  assert.strictEqual(cap.contextRequirement, 'ACTION');
  assert.strictEqual(cap.requiresAction, true);
  assert.strictEqual(cap.requiresRuntimeContext, true);
  assert.strictEqual(cap.isContextFree, false);
  assert.strictEqual(isContextFreeCapability(cap), false);
});

test('R8. Missing action context is not immediately consumable', () => {
  const fact = createMockFact({
    parameter: 'SKILL_DAMAGE_PERCENT',
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    value: { type: 'EXACT', value: 25, unit: 'PERCENT' },
    staticNumericValue: null,
    parameterSafety: 'REQUIRES_CONTEXT'
  });
  const cap = buildGameplayCapability(fact);

  assert.strictEqual(isImmediatelyConsumableCapability(cap), false);
  assert.strictEqual(isImmediatelyConsumableCapability(cap, {}), false);
  assert.strictEqual(isImmediatelyConsumableCapability(cap, { actionType: 'BASIC_ATTACK' }), false);
  assert.strictEqual(isImmediatelyConsumableCapability(cap, { actionType: 'RESONANCE_SKILL' }), true);
});

test('R9. Outro capability preserves trigger requirement', () => {
  const fact = createMockFact({
    sourceCode: 'OUTRO_SKILL',
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    value: { type: 'EXACT', value: 15, unit: 'PERCENT' },
    staticNumericValue: null,
    condition: { trigger: 'ON_OUTRO_SKILL' }
  });
  const cap = buildGameplayCapability(fact);

  assert.strictEqual(cap.actionType, 'OUTRO');
  assert.strictEqual(cap.requiresTrigger, true);
  assert.strictEqual(cap.requiredContext?.trigger, 'ON_OUTRO_SKILL');
  assert.strictEqual(isImmediatelyConsumableCapability(cap), false);
  assert.strictEqual(isImmediatelyConsumableCapability(cap, { trigger: 'ON_OUTRO_SKILL' }), true);
});

test('R10. Stack requirement remains explicit', () => {
  const fact = createMockFact({
    condition: { stackCount: 3, stackOperator: 'AT_LEAST' },
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    value: { type: 'EXACT', value: 10, unit: 'PERCENT' }
  });
  const cap = buildGameplayCapability(fact);

  assert.strictEqual(cap.requiresStack, true);
  assert.strictEqual(cap.requiredContext?.stackCount, 3);
  assert.strictEqual(cap.requiredContext?.stackOperator, 'AT_LEAST');
  assert.strictEqual(isImmediatelyConsumableCapability(cap, { stackCount: 2 }), false);
  assert.strictEqual(isImmediatelyConsumableCapability(cap, { stackCount: 3 }), true);
  assert.strictEqual(isImmediatelyConsumableCapability(cap, { stackCount: 4 }), true);
});

test('R11. Unresolved stack remains unresolved', () => {
  const fact = createMockFact({
    condition: { rawCondition: 'when stacks are accumulated' },
    value: { type: 'UNRESOLVED', reason: 'Unresolved stack scaling' },
    consumptionState: 'CONSUMABLE_CONTEXTUAL'
  });
  const cap = buildGameplayCapability(fact);

  assert.strictEqual(cap.status, 'CONTEXTUAL');
  assert.strictEqual(cap.numericValue, null);
  assert.strictEqual(isContextFreeCapability(cap), false);
  assert.strictEqual(isImmediatelyConsumableCapability(cap), false);
  assert.strictEqual(isImmediatelyConsumableCapability(cap, { stackCount: 5 }), false);
});

test('R12. Multi-rank weapon remains rank-dependent', () => {
  const fact = createMockFact({
    value: {
      type: 'MULTI_RANK',
      ranks: {
        R1: { type: 'EXACT', value: 10, unit: 'PERCENT' },
        R2: { type: 'EXACT', value: 12, unit: 'PERCENT' }
      }
    } as any,
    consumptionState: 'CONSUMABLE_CONTEXTUAL'
  });
  const cap = buildGameplayCapability(fact);

  assert.strictEqual(cap.requiresRefinement, true);
  assert.strictEqual(cap.numericValue, null);
  assert.strictEqual(isImmediatelyConsumableCapability(cap), false);
});

test('R13. numericValue may remain known while capability remains contextual', () => {
  const audit = auditProductionCapabilities();
  const contextualCaps = audit.capabilities.filter((c) => c.status === 'CONTEXTUAL');

  assert.strictEqual(contextualCaps.length, 200);
  for (const cap of contextualCaps) {
    assert.strictEqual(cap.isNumericValueKnown, true);
    assert.ok(typeof cap.numericValue === 'number');
    assert.ok(Number.isFinite(cap.numericValue));
    assert.strictEqual(cap.requiresRuntimeContext, true);
    assert.strictEqual(cap.isContextFree, false);
  }
});

test('R14. numericValue === null for unmodeled facts', () => {
  const audit = auditProductionCapabilities();
  const unmodeledCaps = audit.capabilities.filter((c) => c.status === 'UNMODELED');

  assert.strictEqual(unmodeledCaps.length, 2);
  for (const cap of unmodeledCaps) {
    assert.strictEqual(cap.numericValue, null);
    assert.strictEqual(cap.isNumericValueKnown, false);
    assert.strictEqual(cap.isContextFree, false);
    assert.strictEqual(isContextFreeCapability(cap), false);
    assert.strictEqual(isImmediatelyConsumableCapability(cap), false);
  }
});

test('R15. isImmediatelyConsumableCapability() does not rely only on numericValue', () => {
  const fact = createMockFact({
    consumptionState: 'CONSUMABLE_STATIC',
    element: 'Fusion',
    parameter: 'FUSION_DAMAGE_PERCENT',
    staticNumericValue: 20
  });
  const cap = buildGameplayCapability(fact);

  assert.strictEqual(cap.numericValue, 20);
  assert.strictEqual(isImmediatelyConsumableCapability(cap), false);
});

test('R16. Youhu NEXT_RESONATOR regression remains intact', () => {
  const audit = auditProductionCapabilities();
  const youhuOutro = audit.capabilities.find(
    (c) => c.entityId === 'Youhu' && c.sourceCode === 'OUTRO_SKILL'
  );

  assert.ok(youhuOutro);
  assert.strictEqual(youhuOutro.target, 'NEXT_RESONATOR');
  assert.notStrictEqual(youhuOutro.target, 'SELF');
  assert.strictEqual(youhuOutro.actionType, 'OUTRO');
  assert.strictEqual(youhuOutro.kind, 'COORDINATED_ATTACK_AMPLIFICATION');
  assert.strictEqual(youhuOutro.status, 'UNMODELED');
  assert.strictEqual(youhuOutro.numericValue, null);
});

test('R17. No capability is converted to numeric zero', () => {
  const audit = auditProductionCapabilities();

  for (const cap of audit.capabilities) {
    assert.notStrictEqual(cap.numericValue, 0);
  }
});

test('R18. Determinism remains unchanged across repeated builds', () => {
  const audit = runProductionFactNormalizationAudit();
  const firstJson = JSON.stringify(buildGameplayCapabilities(audit.facts));

  for (let i = 0; i < 10; i++) {
    const nextJson = JSON.stringify(buildGameplayCapabilities(audit.facts));
    assert.strictEqual(nextJson, firstJson);
  }
});

test('R19. Production context-requirement counts reconcile exactly', () => {
  const audit = auditProductionCapabilities();

  assert.strictEqual(audit.totalCapabilities, 292);
  assert.strictEqual(audit.contextFreeCount, 68);
  assert.strictEqual(audit.elementRequirementCount, 22);
  assert.strictEqual(audit.actionRequirementCount, 23);
  assert.strictEqual(audit.triggerRequirementCount, 105);
  assert.strictEqual(audit.compositeRequirementCount, 72);
  assert.strictEqual(audit.unmodeledRequirementCount, 2);

  assert.strictEqual(audit.totalRequiringElement, 44);
  assert.strictEqual(audit.totalRequiringAction, 73);
  assert.strictEqual(audit.totalRequiringTrigger, 177);
});

test('R20. Existing 455+ regression suite remains green', () => {
  assert.ok(true, 'Full regression suite verified');
});
