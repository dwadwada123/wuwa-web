import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyParameterSafety,
  classifySemanticEffectSafety,
  convertSemanticEffectToFact,
  convertExtractionResultToFacts,
  resolveFactForRank,
  isConditionStaticSafe,
  isStaticNumericEligible,
  getNumericValueSafe,
  getNumericValueWithContext,
  runProductionEngineIntegrationAudit
} from '../lib/engine/semantics/safety-gate.ts';
import type {
  EngineSemanticFact,
  EngineSemanticSafetyStatus,
  ParameterSafetyClassification,
  RuntimeEvaluationContext
} from '../lib/engine/semantics/types.ts';
import type {
  SemanticEffect,
  ExtractionResult,
  SourceReference,
  ExtractionProvenance,
  SemanticCondition
} from '../lib/domain/types/semantics.ts';
import type { Element } from '../lib/domain/types/common.ts';
import { extractSemantics } from '../lib/semantics/parser.ts';

function createMockSource(overrides: Partial<SourceReference> = {}): SourceReference {
  return {
    entityId: 'rover_spectro',
    entityName: 'Rover (Spectro)',
    sourceType: 'RESONATOR_ABILITY',
    sourceCode: 'skill',
    patchVersion: '3.7',
    sourceProvenance: 'patch_3_7_dataset.json#resonators/rover_spectro',
    originalDescription: 'Test ability description',
    ...overrides
  };
}

function createMockExtraction(): ExtractionProvenance {
  return {
    parserVersion: '3.7.0-semantic-parser.1',
    method: 'DETERMINISTIC_RULE_PARSER',
    extractionDate: '2026-10-08T00:00:00.000Z'
  };
}

// ----------------------------------------------------------------------------
// PHASE 6C STEP 3 FINAL HARDENING: STATIC CONDITION SAFETY REGRESSION TESTS (C1-C17)
// ----------------------------------------------------------------------------

test('C1. Unconditional DIRECT_ENGINE_FACT + EXACT is static eligible', () => {
  const effect: SemanticEffect = {
    id: 'c1_atk_buff',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' },
    condition: undefined,
    source: createMockSource(),
    extraction: createMockExtraction()
  };

  const fact = convertSemanticEffectToFact(effect);

  assert.strictEqual(fact.status, 'SAFE_EXPLICIT');
  assert.strictEqual(fact.parameterSafety, 'DIRECT_ENGINE_FACT');
  assert.strictEqual(isStaticNumericEligible(fact), true);

  const numeric = getNumericValueSafe(fact);
  assert.deepStrictEqual(numeric, { value: 20, unit: 'PERCENT' });
});

test('C2. Conditional trigger causes static rejection', () => {
  const effect: SemanticEffect = {
    id: 'c2_skill_trigger',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' },
    condition: { trigger: 'ON_RESONANCE_SKILL' },
    source: createMockSource(),
    extraction: createMockExtraction()
  };

  const fact = convertSemanticEffectToFact(effect);

  assert.strictEqual(isConditionStaticSafe(effect.condition), false);
  assert.strictEqual(isStaticNumericEligible(fact), false);
  assert.strictEqual(getNumericValueSafe(fact), null, 'getNumericValueSafe must return null, NEVER 0');

  // But resolves under valid context
  const withContext = getNumericValueWithContext(fact, { trigger: 'ON_RESONANCE_SKILL' });
  assert.deepStrictEqual(withContext, { value: 20, unit: 'PERCENT' });

  // And rejects under mismatched context
  const wrongContext = getNumericValueWithContext(fact, { trigger: 'ON_INTRO_SKILL' });
  assert.strictEqual(wrongContext, null);
});

test('C3. Runtime threshold condition causes static rejection', () => {
  const effect: SemanticEffect = {
    id: 'c3_threshold',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'DEF_PERCENT',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 30, unit: 'PERCENT' },
    condition: { rawCondition: 'When HP is below 50%' },
    source: createMockSource(),
    extraction: createMockExtraction()
  };

  const fact = convertSemanticEffectToFact(effect);

  assert.strictEqual(isConditionStaticSafe(effect.condition), false);
  assert.strictEqual(isStaticNumericEligible(fact), false);
  assert.strictEqual(getNumericValueSafe(fact), null);
  assert.strictEqual(getNumericValueWithContext(fact), null, 'Unmodeled raw threshold prose fails closed');
});

test('C4. Runtime stack condition causes static rejection', () => {
  const effect: SemanticEffect = {
    id: 'c4_stack_cond',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'CRIT_RATE_PERCENT',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 12, unit: 'PERCENT' },
    condition: { stackCount: 3 },
    source: createMockSource(),
    extraction: createMockExtraction()
  };

  const fact = convertSemanticEffectToFact(effect);

  assert.strictEqual(isConditionStaticSafe(effect.condition), false);
  assert.strictEqual(isStaticNumericEligible(fact), false);
  assert.strictEqual(getNumericValueSafe(fact), null);

  // Resolves with matching stack context >= 3
  const withStack = getNumericValueWithContext(fact, { stackCount: 3 });
  assert.deepStrictEqual(withStack, { value: 12, unit: 'PERCENT' });

  // Rejects with insufficient stack context
  const insufficientStack = getNumericValueWithContext(fact, { stackCount: 2 });
  assert.strictEqual(insufficientStack, null);
});

test('C5. Runtime state condition (zoneActive / buffActive) causes static rejection', () => {
  const effectZone: SemanticEffect = {
    id: 'c5_zone',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ENERGY_REGEN_PERCENT',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 25, unit: 'PERCENT' },
    condition: { zoneActive: true },
    source: createMockSource(),
    extraction: createMockExtraction()
  };

  const factZone = convertSemanticEffectToFact(effectZone);
  assert.strictEqual(isConditionStaticSafe(effectZone.condition), false);
  assert.strictEqual(isStaticNumericEligible(factZone), false);
  assert.strictEqual(getNumericValueSafe(factZone), null);

  const withZone = getNumericValueWithContext(factZone, { zoneActive: true });
  assert.deepStrictEqual(withZone, { value: 25, unit: 'PERCENT' });

  const withoutZone = getNumericValueWithContext(factZone, { zoneActive: false });
  assert.strictEqual(withoutZone, null);

  // Buff state condition
  const effectBuff: SemanticEffect = {
    id: 'c5_buff',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 15, unit: 'PERCENT' },
    condition: { buffActive: true },
    source: createMockSource(),
    extraction: createMockExtraction()
  };

  const factBuff = convertSemanticEffectToFact(effectBuff);
  assert.strictEqual(isConditionStaticSafe(effectBuff.condition), false);
  assert.strictEqual(isStaticNumericEligible(factBuff), false);
  assert.strictEqual(getNumericValueSafe(factBuff), null);
});

test('C6. Unknown condition field causes static rejection', () => {
  const effect: SemanticEffect = {
    id: 'c6_unknown_cond',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' },
    condition: { unknownFutureConditionField: 'experimental_state' } as any,
    source: createMockSource(),
    extraction: createMockExtraction()
  };

  const fact = convertSemanticEffectToFact(effect);

  assert.strictEqual(isConditionStaticSafe(effect.condition), false, 'Unknown condition key must fail closed');
  assert.strictEqual(isStaticNumericEligible(fact), false);
  assert.strictEqual(getNumericValueSafe(fact), null);
  assert.strictEqual(getNumericValueWithContext(fact), null);
});

test('C7. Conditionless fact is static eligible when all other requirements pass', () => {
  const effect: SemanticEffect = {
    id: 'c7_unconditional',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'CRIT_DAMAGE_PERCENT',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 28, unit: 'PERCENT' },
    condition: undefined,
    source: createMockSource(),
    extraction: createMockExtraction()
  };

  const fact = convertSemanticEffectToFact(effect);

  assert.strictEqual(isConditionStaticSafe(effect.condition), true);
  assert.strictEqual(isStaticNumericEligible(fact), true);
  assert.deepStrictEqual(getNumericValueSafe(fact), { value: 28, unit: 'PERCENT' });
});

test('C8. REQUIRES_CONTEXT parameter causes static rejection', () => {
  const effect: SemanticEffect = {
    id: 'c8_skill_dmg',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'SKILL_DAMAGE_PERCENT',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' },
    condition: undefined,
    source: createMockSource(),
    extraction: createMockExtraction()
  };

  const fact = convertSemanticEffectToFact(effect);

  assert.strictEqual(fact.parameterSafety, 'REQUIRES_CONTEXT');
  assert.strictEqual(isStaticNumericEligible(fact), false);
  assert.strictEqual(getNumericValueSafe(fact), null);

  const withContext = getNumericValueWithContext(fact, { actionType: 'RESONANCE_SKILL' });
  assert.deepStrictEqual(withContext, { value: 20, unit: 'PERCENT' });
});

test('C9. SAFE_EXPLICIT + DIRECT_ENGINE_FACT + conditional condition causes static rejection', () => {
  const effect: SemanticEffect = {
    id: 'c9_cond_fusion',
    category: 'DMG_AMPLIFY',
    target: 'NEXT_RESONATOR',
    parameter: 'FUSION_DAMAGE_PERCENT',
    element: 'Fusion',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' },
    condition: { trigger: 'ON_OUTRO_SKILL' },
    source: createMockSource({ entityId: 'mortefi', sourceCode: 'outro' }),
    extraction: createMockExtraction()
  };

  const fact = convertSemanticEffectToFact(effect);

  assert.strictEqual(fact.status, 'SAFE_EXPLICIT');
  assert.strictEqual(fact.parameterSafety, 'DIRECT_ENGINE_FACT');
  assert.strictEqual(isStaticNumericEligible(fact), false);
  assert.strictEqual(getNumericValueSafe(fact), null);
});

test('C10. SAFE_DERIVED + DIRECT_ENGINE_FACT + fully static condition is eligible only if derived formula is explicitly supported', () => {
  // 1. With valid supported formula
  const effectWithFormula: SemanticEffect = {
    id: 'c10_derived_valid',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    valueState: 'DERIVED',
    value: { type: 'EXACT', value: 15, unit: 'PERCENT' },
    condition: undefined,
    source: createMockSource(),
    extraction: createMockExtraction()
  };

  const factWithFormula = convertSemanticEffectToFact(effectWithFormula);
  assert.strictEqual(factWithFormula.status, 'SAFE_DERIVED');
  assert.strictEqual(isStaticNumericEligible(factWithFormula), true);
  assert.deepStrictEqual(getNumericValueSafe(factWithFormula), { value: 15, unit: 'PERCENT' });

  // 2. With empty / invalid formula -> must be rejected
  const factInvalidFormula: EngineSemanticFact = {
    ...factWithFormula,
    derivationFormula: ''
  };
  assert.strictEqual(isStaticNumericEligible(factInvalidFormula), false);
  assert.strictEqual(getNumericValueSafe(factInvalidFormula), null);
});

test('C11. MULTI_RANK without rank is rejected', () => {
  const effect: SemanticEffect = {
    id: 'c11_multi_rank',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    valueState: 'PARSED',
    value: {
      type: 'MULTI_RANK',
      unit: 'PERCENT',
      ranks: {
        R1: { type: 'EXACT', value: 12, unit: 'PERCENT' },
        R5: { type: 'EXACT', value: 24, unit: 'PERCENT' }
      }
    },
    condition: undefined,
    source: createMockSource({ sourceType: 'WEAPON_PASSIVE' }),
    extraction: createMockExtraction()
  };

  const fact = convertSemanticEffectToFact(effect);

  assert.strictEqual(isStaticNumericEligible(fact), false);
  assert.strictEqual(getNumericValueSafe(fact), null);
  assert.strictEqual(getNumericValueWithContext(fact), null);
});

test('C12. MULTI_RANK with explicit rank + fully static condition is eligible only when all other requirements pass', () => {
  const effect: SemanticEffect = {
    id: 'c12_multi_rank',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    valueState: 'PARSED',
    value: {
      type: 'MULTI_RANK',
      unit: 'PERCENT',
      ranks: {
        R1: { type: 'EXACT', value: 12, unit: 'PERCENT' },
        R5: { type: 'EXACT', value: 24, unit: 'PERCENT' }
      }
    },
    condition: undefined,
    source: createMockSource({ sourceType: 'WEAPON_PASSIVE' }),
    extraction: createMockExtraction()
  };

  const fact = convertSemanticEffectToFact(effect);

  // Resolving R1 produces an EXACT, unconditional DIRECT_ENGINE_FACT
  const r1Fact = resolveFactForRank(fact, 'R1');
  assert.strictEqual(isStaticNumericEligible(r1Fact), true);
  assert.deepStrictEqual(getNumericValueSafe(r1Fact), { value: 12, unit: 'PERCENT' });

  // Resolving an unavailable rank returns UNMODELED, which is statically rejected
  const r2Fact = resolveFactForRank(fact, 'R2');
  assert.strictEqual(r2Fact.status, 'UNMODELED');
  assert.strictEqual(isStaticNumericEligible(r2Fact), false);
  assert.strictEqual(getNumericValueSafe(r2Fact), null);
});

test('C13. UNKNOWN returns null, NEVER 0', () => {
  const fact: EngineSemanticFact = {
    status: 'UNKNOWN',
    entityId: 'char_unknown',
    sourceCode: 's1',
    patchVersion: '3.7',
    reason: 'Unparseable condition'
  };

  assert.strictEqual(isStaticNumericEligible(fact), false);
  assert.strictEqual(getNumericValueSafe(fact), null);
  assert.notStrictEqual(getNumericValueSafe(fact), 0);
  assert.strictEqual(getNumericValueWithContext(fact), null);
});

test('C14. UNMODELED returns null, NEVER 0', () => {
  const fact: EngineSemanticFact = {
    status: 'UNMODELED',
    entityId: 'char_unmodeled',
    sourceCode: 's2',
    patchVersion: '3.7',
    parameter: 'FORTE_RESOURCE',
    parameterSafety: 'CURRENTLY_UNMODELED',
    reason: 'Gauge state machine'
  };

  assert.strictEqual(isStaticNumericEligible(fact), false);
  assert.strictEqual(getNumericValueSafe(fact), null);
  assert.notStrictEqual(getNumericValueSafe(fact), 0);
  assert.strictEqual(getNumericValueWithContext(fact), null);
});

test('C15. NOT_APPLICABLE returns null, NEVER 0', () => {
  const fact: EngineSemanticFact = {
    status: 'NOT_APPLICABLE',
    entityId: 'baizhi',
    sourceCode: 'inherent_2',
    patchVersion: '3.7',
    reason: 'Cooking dish crafting'
  };

  assert.strictEqual(isStaticNumericEligible(fact), false);
  assert.strictEqual(getNumericValueSafe(fact), null);
  assert.notStrictEqual(getNumericValueSafe(fact), 0);
  assert.strictEqual(getNumericValueWithContext(fact), null);
});

test('C16. Missing numeric value returns null, NEVER 0', () => {
  const effect: SemanticEffect = {
    id: 'c16_missing_val',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    valueState: 'UNMODELED',
    value: { type: 'UNRESOLVED', rawText: 'scaling with energy', reason: 'Unmodeled formula' },
    condition: undefined,
    source: createMockSource(),
    extraction: createMockExtraction()
  };

  const fact = convertSemanticEffectToFact(effect);

  assert.strictEqual(isStaticNumericEligible(fact), false);
  assert.strictEqual(getNumericValueSafe(fact), null);
  assert.notStrictEqual(getNumericValueSafe(fact), 0);
});

test('C17. Deterministic repeated execution yields identical result', () => {
  const effect: SemanticEffect = {
    id: 'c17_deterministic',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 16, unit: 'PERCENT' },
    condition: undefined,
    source: createMockSource(),
    extraction: createMockExtraction()
  };

  const f1 = convertSemanticEffectToFact(effect);
  const f2 = convertSemanticEffectToFact(effect);

  assert.deepStrictEqual(f1, f2);
  assert.strictEqual(isStaticNumericEligible(f1), isStaticNumericEligible(f2));
  assert.deepStrictEqual(getNumericValueSafe(f1), getNumericValueSafe(f2));

  const m1 = runProductionEngineIntegrationAudit();
  const m2 = runProductionEngineIntegrationAudit();
  assert.deepStrictEqual(m1, m2);
});

// ----------------------------------------------------------------------------
// REMAINING DOMAIN & PRODUCTION INTEGRATION TESTS
// ----------------------------------------------------------------------------

test('18. Target preservation: SELF, TEAM, NEXT_RESONATOR, ACTIVE_CHARACTER, ENEMY remain distinct', () => {
  const targets = ['SELF', 'TEAM', 'NEXT_RESONATOR', 'ACTIVE_CHARACTER', 'ENEMY'] as const;

  for (const target of targets) {
    const effect: SemanticEffect = {
      id: `eff_${target}`,
      category: 'STAT_BUFF',
      target,
      parameter: 'ATK_PERCENT',
      valueState: 'PARSED',
      value: { type: 'EXACT', value: 15, unit: 'PERCENT' },
      source: createMockSource({ sourceCode: 'outro' }),
      extraction: createMockExtraction()
    };

    const fact = convertSemanticEffectToFact(effect);
    assert.strictEqual(fact.status, 'SAFE_EXPLICIT');
    if (fact.status === 'SAFE_EXPLICIT') {
      assert.strictEqual(fact.target, target);
    }
  }

  assert.notStrictEqual('TEAM', 'SELF');
  assert.notStrictEqual('NEXT_RESONATOR', 'TEAM');
  assert.notStrictEqual('ACTIVE_CHARACTER', 'SELF');
});

test('19. Element preservation: explicit element is preserved and never inferred blindly', () => {
  const elements: Array<Element | 'All'> = ['Fusion', 'Electro', 'Aero', 'Glacio', 'Spectro', 'Havoc', 'All'];

  for (const elem of elements) {
    const effect: SemanticEffect = {
      id: `eff_${elem}`,
      category: 'DMG_AMPLIFY',
      target: 'NEXT_RESONATOR',
      parameter: 'FUSION_DAMAGE_PERCENT',
      element: elem,
      valueState: 'PARSED',
      value: { type: 'EXACT', value: 20, unit: 'PERCENT' },
      source: createMockSource({ entityId: 'mortefi', sourceCode: 'outro' }),
      extraction: createMockExtraction()
    };

    const fact = convertSemanticEffectToFact(effect);
    if (fact.status === 'SAFE_EXPLICIT') {
      assert.strictEqual(fact.element, elem);
    }
  }

  const noneEffect: SemanticEffect = {
    id: 'eff_none',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 10, unit: 'PERCENT' },
    source: createMockSource(),
    extraction: createMockExtraction()
  };
  const noneFact = convertSemanticEffectToFact(noneEffect);
  if (noneFact.status === 'SAFE_EXPLICIT') {
    assert.strictEqual(noneFact.element, 'NONE');
  }
});

test('20. Duration and swap preservation remain intact', () => {
  const effect: SemanticEffect = {
    id: 'test_duration_swap',
    category: 'DMG_AMPLIFY',
    target: 'NEXT_RESONATOR',
    parameter: 'FUSION_DAMAGE_PERCENT',
    element: 'Fusion',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' },
    duration: {
      durationSeconds: 14,
      removeOnSwap: true
    },
    source: createMockSource({ entityId: 'mortefi', sourceCode: 'outro' }),
    extraction: createMockExtraction()
  };

  const fact = convertSemanticEffectToFact(effect);
  assert.strictEqual(fact.status, 'SAFE_EXPLICIT');
  if (fact.status === 'SAFE_EXPLICIT') {
    assert.strictEqual(fact.duration?.durationSeconds, 14);
    assert.strictEqual(fact.duration?.removeOnSwap, true);
  }
});

test('21. Stacking preservation: maxStacks and stack dynamics remain intact', () => {
  const effect: SemanticEffect = {
    id: 'test_stacking_buff',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 4, unit: 'PERCENT' },
    stacking: {
      maxStacks: 5
    },
    source: createMockSource({
      entityId: 'weapon_autumntrace',
      sourceType: 'WEAPON_PASSIVE',
      sourceCode: 'passive'
    }),
    extraction: createMockExtraction()
  };

  const fact = convertSemanticEffectToFact(effect);
  assert.strictEqual(fact.status, 'SAFE_EXPLICIT');
  if (fact.status === 'SAFE_EXPLICIT') {
    assert.strictEqual(fact.stacking?.maxStacks, 5);
  }
});

test('22. Patch isolation: facts from non-3.7 patch are strictly rejected', () => {
  const effect: SemanticEffect = {
    id: 'test_patch_36_buff',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' },
    source: createMockSource({ patchVersion: '3.6' }),
    extraction: createMockExtraction()
  };

  const fact = convertSemanticEffectToFact(effect);
  assert.strictEqual(fact.status, 'NOT_APPLICABLE');
  assert.ok(fact.reason.includes('Patch isolation rejection'));
  assert.strictEqual(isStaticNumericEligible(fact), false);
  assert.strictEqual(getNumericValueSafe(fact), null);
});

test('23. Provenance preservation: source entity, code, patch, and reference remain intact', () => {
  const effect: SemanticEffect = {
    id: 'test_prov_buff',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'CRIT_RATE_PERCENT',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 8, unit: 'PERCENT' },
    source: createMockSource({
      entityId: 'jinhsi',
      sourceCode: 'inherent_1',
      originalDescription: 'Increases Crit. Rate by 8%.'
    }),
    extraction: createMockExtraction()
  };

  const fact = convertSemanticEffectToFact(effect);
  assert.strictEqual(fact.entityId, 'jinhsi');
  assert.strictEqual(fact.sourceCode, 'inherent_1');
  assert.strictEqual(fact.patchVersion, '3.7');
  if (fact.status === 'SAFE_EXPLICIT') {
    assert.strictEqual(fact.provenance.originalDescription, 'Increases Crit. Rate by 8%.');
  }
});

test('24. Unsupported and unmodeled mechanics are converted to UNMODELED facts, never 0', () => {
  const extractionResult: ExtractionResult = {
    effects: [],
    unresolvedFragments: [
      'Pulls nearby enemies towards the center',
      'Inflicts Stagnation for 3s',
      'Cooked dishes have a 20% chance of yielding additional product'
    ],
    status: 'UNSUPPORTED',
    originalText: 'Pulls nearby enemies towards the center and Inflicts Stagnation for 3s',
    parserVersion: '3.7.0-semantic-parser.1',
    sourceReference: createMockSource({
      entityId: 'yangyang',
      sourceCode: 'liberation'
    })
  };

  const facts = convertExtractionResultToFacts(extractionResult);
  assert.strictEqual(facts.length, 3);
  assert.strictEqual(facts[0].status, 'UNMODELED');
  assert.strictEqual(facts[1].status, 'UNMODELED');
  assert.strictEqual(facts[2].status, 'NOT_APPLICABLE'); // Non-combat cooking

  for (const f of facts) {
    assert.strictEqual(isStaticNumericEligible(f), false);
    assert.strictEqual(getNumericValueSafe(f), null);
    assert.strictEqual(getNumericValueWithContext(f), null);
  }
});

test('25. Complete production engine integration audit metrics match exact Patch 3.7 accounting', () => {
  const metrics = runProductionEngineIntegrationAudit();

  // Total extracted effects
  assert.strictEqual(metrics.totalExtractedEffects, 292);

  // Safety status breakdown
  assert.strictEqual(metrics.safetyCounts.SAFE_EXPLICIT, 290);
  assert.strictEqual(metrics.safetyCounts.SAFE_DERIVED, 0);
  assert.strictEqual(metrics.safetyCounts.UNKNOWN, 0);
  assert.strictEqual(metrics.safetyCounts.UNMODELED, 2);
  assert.strictEqual(metrics.safetyCounts.NOT_APPLICABLE, 0);
  assert.strictEqual(
    metrics.safetyCounts.SAFE_EXPLICIT +
      metrics.safetyCounts.SAFE_DERIVED +
      metrics.safetyCounts.UNKNOWN +
      metrics.safetyCounts.UNMODELED +
      metrics.safetyCounts.NOT_APPLICABLE,
    292
  );

  // Parameter safety breakdown
  assert.strictEqual(metrics.parameterSafetyBreakdown.DIRECT_ENGINE_FACT, 217);
  assert.strictEqual(metrics.parameterSafetyBreakdown.REQUIRES_CONTEXT, 73);
  assert.strictEqual(metrics.parameterSafetyBreakdown.CURRENTLY_UNMODELED, 2);
  assert.strictEqual(metrics.parameterSafetyBreakdown.NOT_ENGINE_CONSUMABLE, 0);
  assert.strictEqual(
    metrics.parameterSafetyBreakdown.DIRECT_ENGINE_FACT +
      metrics.parameterSafetyBreakdown.REQUIRES_CONTEXT +
      metrics.parameterSafetyBreakdown.CURRENTLY_UNMODELED +
      metrics.parameterSafetyBreakdown.NOT_ENGINE_CONSUMABLE,
    292
  );

  // Static numeric eligibility breakdown
  assert.strictEqual(metrics.staticNumericEligibility.STATIC_NUMERIC_ELIGIBLE, 90);
  assert.strictEqual(metrics.staticNumericEligibility.STATIC_NUMERIC_REJECTED, 202);
  assert.strictEqual(
    metrics.staticNumericEligibility.STATIC_NUMERIC_ELIGIBLE +
      metrics.staticNumericEligibility.STATIC_NUMERIC_REJECTED,
    292
  );
  assert.strictEqual(metrics.staticNumericEligibility.rejectionBreakdown.REQUIRES_ACTION_CONTEXT, 73);
  assert.strictEqual(metrics.staticNumericEligibility.rejectionBreakdown.REQUIRES_TRIGGER_CONTEXT, 127);
  assert.strictEqual(metrics.staticNumericEligibility.rejectionBreakdown.UNMODELED_COMBAT_MECHANIC, 2);
  assert.strictEqual(
    metrics.staticNumericEligibility.rejectionBreakdown.REQUIRES_ACTION_CONTEXT +
      metrics.staticNumericEligibility.rejectionBreakdown.REQUIRES_TRIGGER_CONTEXT +
      metrics.staticNumericEligibility.rejectionBreakdown.UNMODELED_COMBAT_MECHANIC,
    202
  );

  // Target breakdown (total sum 292)
  const targetSum = Object.values(metrics.targetBreakdown).reduce((a, b) => a + b, 0);
  assert.strictEqual(targetSum, 292);
  assert.strictEqual(metrics.targetBreakdown.SELF, 179);
  assert.strictEqual(metrics.targetBreakdown.TEAM, 60);
  assert.strictEqual(metrics.targetBreakdown.NEXT_RESONATOR, 29);
  assert.strictEqual(metrics.targetBreakdown.ACTIVE_CHARACTER, 24);

  // Element breakdown (total sum 292)
  const elementSum = Object.values(metrics.elementBreakdown).reduce((a, b) => a + b, 0);
  assert.strictEqual(elementSum, 292);
  assert.strictEqual(metrics.elementBreakdown.NONE, 230);
  assert.strictEqual(metrics.elementBreakdown.Fusion, 12);
  assert.strictEqual(metrics.elementBreakdown.Havoc, 9);
  assert.strictEqual(metrics.elementBreakdown.Electro, 8);
  assert.strictEqual(metrics.elementBreakdown.Aero, 7);
  assert.strictEqual(metrics.elementBreakdown.Spectro, 6);
  assert.strictEqual(metrics.elementBreakdown.Glacio, 2);
  assert.strictEqual(metrics.elementBreakdown.All, 18);

  // Trigger breakdown (total sum 292)
  const triggerSum = Object.values(metrics.conditionTriggerBreakdown).reduce((a, b) => a + b, 0);
  assert.strictEqual(triggerSum, 292);
  assert.strictEqual(metrics.conditionTriggerBreakdown.UNCONDITIONAL, 114);
  assert.strictEqual(metrics.conditionTriggerBreakdown.ON_RESONANCE_SKILL, 82);
  assert.strictEqual(metrics.conditionTriggerBreakdown.ON_RESONANCE_LIBERATION, 42);
  assert.strictEqual(metrics.conditionTriggerBreakdown.ON_INTRO_SKILL, 30);
  assert.strictEqual(metrics.conditionTriggerBreakdown.ON_OUTRO_SKILL, 21);
  assert.strictEqual(metrics.conditionTriggerBreakdown.ON_BASIC_ATTACK, 2);
  assert.strictEqual(metrics.conditionTriggerBreakdown.ON_HEAVY_ATTACK, 1);

  // Rejection accounting: exactly 202 effects rejected from direct static engine fact usage
  assert.strictEqual(metrics.effectsRejectedFromDirectEngineUse.length, 202);
});
