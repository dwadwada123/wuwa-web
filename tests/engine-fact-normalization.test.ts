import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeEngineFact,
  normalizeSemanticEffect,
  normalizeExtractionResult,
  runProductionFactNormalizationAudit,
  deriveCanonicalFactId
} from '../lib/engine/facts/normalizer.ts';
import { computeSemanticSignature } from '../lib/semantics/taxonomy.ts';
import { PARSER_VERSION } from '../lib/semantics/parser.ts';
import type {
  NormalizedEngineFact,
  EngineFactConsumptionState
} from '../lib/engine/facts/types.ts';
import {
  convertSemanticEffectToFact,
  convertExtractionResultToFacts
} from '../lib/engine/semantics/safety-gate.ts';
import type {
  SemanticEffect,
  SourceReference,
  ExtractionProvenance,
  ExtractionResult
} from '../lib/domain/types/semantics.ts';
import type { Element } from '../lib/domain/types/common.ts';

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
    parserVersion: PARSER_VERSION,
    method: 'DETERMINISTIC_RULE_PARSER',
    extractionDate: '2026-10-08'
  };
}

// ----------------------------------------------------------------------------
// PHASE 6C STEP 4: DETERMINISTIC ENGINE FACT NORMALIZATION TESTS (N1-N26)
// ----------------------------------------------------------------------------

test('N1. SAFE_EXPLICIT + DIRECT_ENGINE_FACT + EXACT -> CONSUMABLE_STATIC', () => {
  const effect: SemanticEffect = {
    id: 'n1_atk_buff',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' },
    source: createMockSource(),
    extraction: createMockExtraction()
  };

  const normalized = normalizeSemanticEffect(effect);

  assert.strictEqual(normalized.consumptionState, 'CONSUMABLE_STATIC');
  assert.strictEqual(normalized.staticNumericValue, 20);
  assert.strictEqual(normalized.unit, 'PERCENT');
  assert.strictEqual(normalized.semanticStatus, 'SAFE_EXPLICIT');
  assert.strictEqual(normalized.parameterSafety, 'DIRECT_ENGINE_FACT');
});

test('N2. SAFE_EXPLICIT + REQUIRES_CONTEXT -> CONSUMABLE_CONTEXTUAL', () => {
  const effect: SemanticEffect = {
    id: 'n2_basic_dmg',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'BASIC_ATTACK_DAMAGE_PERCENT',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 25, unit: 'PERCENT' },
    source: createMockSource(),
    extraction: createMockExtraction()
  };

  const normalized = normalizeSemanticEffect(effect);

  assert.strictEqual(normalized.consumptionState, 'CONSUMABLE_CONTEXTUAL');
  assert.strictEqual(normalized.staticNumericValue, null, 'Contextual fact must not expose static numeric value');
  assert.notStrictEqual(normalized.staticNumericValue, 0);
  assert.strictEqual(normalized.unit, 'PERCENT');
  assert.strictEqual(normalized.parameterSafety, 'REQUIRES_CONTEXT');
});

test('N3. Conditional trigger -> CONSUMABLE_CONTEXTUAL', () => {
  const effect: SemanticEffect = {
    id: 'n3_trigger',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' },
    condition: { trigger: 'ON_RESONANCE_SKILL' },
    source: createMockSource(),
    extraction: createMockExtraction()
  };

  const normalized = normalizeSemanticEffect(effect);

  assert.strictEqual(normalized.consumptionState, 'CONSUMABLE_CONTEXTUAL');
  assert.strictEqual(normalized.staticNumericValue, null);
  assert.strictEqual(normalized.condition?.trigger, 'ON_RESONANCE_SKILL');
});

test('N4. Runtime zone condition -> CONSUMABLE_CONTEXTUAL', () => {
  const effect: SemanticEffect = {
    id: 'n4_zone',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ENERGY_REGEN_PERCENT',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' },
    condition: { zoneActive: true },
    source: createMockSource(),
    extraction: createMockExtraction()
  };

  const normalized = normalizeSemanticEffect(effect);

  assert.strictEqual(normalized.consumptionState, 'CONSUMABLE_CONTEXTUAL');
  assert.strictEqual(normalized.staticNumericValue, null);
  assert.strictEqual(normalized.condition?.zoneActive, true);
});

test('N5. Runtime buff condition -> CONSUMABLE_CONTEXTUAL', () => {
  const effect: SemanticEffect = {
    id: 'n5_buff',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 15, unit: 'PERCENT' },
    condition: { buffActive: true },
    source: createMockSource(),
    extraction: createMockExtraction()
  };

  const normalized = normalizeSemanticEffect(effect);

  assert.strictEqual(normalized.consumptionState, 'CONSUMABLE_CONTEXTUAL');
  assert.strictEqual(normalized.staticNumericValue, null);
  assert.strictEqual(normalized.condition?.buffActive, true);
});

test('N6. Runtime stack condition -> CONSUMABLE_CONTEXTUAL', () => {
  const effect: SemanticEffect = {
    id: 'n6_stack',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'CRIT_RATE_PERCENT',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 10, unit: 'PERCENT' },
    condition: { stackCount: 3 },
    source: createMockSource(),
    extraction: createMockExtraction()
  };

  const normalized = normalizeSemanticEffect(effect);

  assert.strictEqual(normalized.consumptionState, 'CONSUMABLE_CONTEXTUAL');
  assert.strictEqual(normalized.staticNumericValue, null);
  assert.strictEqual(normalized.condition?.stackCount, 3);
});

test('N7. UNKNOWN -> UNKNOWN', () => {
  const fact = convertSemanticEffectToFact({
    id: 'n7_unknown',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'GENERIC_DAMAGE_PERCENT',
    valueState: 'UNKNOWN',
    value: { type: 'UNRESOLVED', rawText: 'damage is increased greatly', reason: 'Unquantified bonus' },
    source: createMockSource(),
    extraction: createMockExtraction()
  });

  const normalized = normalizeEngineFact(fact);

  assert.strictEqual(normalized.consumptionState, 'UNKNOWN');
  assert.strictEqual(normalized.semanticStatus, 'UNKNOWN');
  assert.strictEqual(normalized.staticNumericValue, null);
  assert.notStrictEqual(normalized.staticNumericValue, 0);
});

test('N8. UNMODELED -> UNMODELED', () => {
  const fact = convertSemanticEffectToFact({
    id: 'n8_unmodeled',
    category: 'RESOURCE_GRANT',
    target: 'SELF',
    parameter: 'FORTE_RESOURCE',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 25, unit: 'FLAT' },
    source: createMockSource(),
    extraction: createMockExtraction()
  });

  const normalized = normalizeEngineFact(fact);

  assert.strictEqual(normalized.consumptionState, 'UNMODELED');
  assert.strictEqual(normalized.semanticStatus, 'UNMODELED');
  assert.strictEqual(normalized.staticNumericValue, null);
  assert.notStrictEqual(normalized.staticNumericValue, 0);
});

test('N9. NOT_APPLICABLE -> NOT_APPLICABLE', () => {
  const fact = convertSemanticEffectToFact({
    id: 'n9_cooking',
    category: 'SPECIAL_MECHANIC',
    target: 'TEAM',
    parameter: 'UNRESOLVED_PARAMETER',
    valueState: 'NOT_APPLICABLE',
    value: { type: 'UNRESOLVED', rawText: 'cooking dishes', reason: 'Non-combat cooking utility' },
    source: createMockSource({ sourceCode: 'inherent_2' }),
    extraction: createMockExtraction()
  });

  const normalized = normalizeEngineFact(fact);

  assert.strictEqual(normalized.consumptionState, 'NOT_APPLICABLE');
  assert.strictEqual(normalized.semanticStatus, 'NOT_APPLICABLE');
  assert.strictEqual(normalized.staticNumericValue, null);
});

test('N10. MULTI_RANK without rank -> not static (CONSUMABLE_CONTEXTUAL)', () => {
  const effect: SemanticEffect = {
    id: 'n10_weapon',
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
    source: createMockSource({ sourceType: 'WEAPON_PASSIVE' }),
    extraction: createMockExtraction()
  };

  const normalized = normalizeSemanticEffect(effect);

  assert.strictEqual(normalized.consumptionState, 'CONSUMABLE_CONTEXTUAL');
  assert.strictEqual(normalized.staticNumericValue, null, 'Unresolved multi-rank cannot be static');
  assert.strictEqual(normalized.refinementRank, undefined);
  assert.strictEqual(normalized.value.type, 'MULTI_RANK');
});

test('N11. MULTI_RANK with explicit valid rank -> deterministic resolved fact', () => {
  const effect: SemanticEffect = {
    id: 'n11_weapon',
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
    source: createMockSource({ sourceType: 'WEAPON_PASSIVE' }),
    extraction: createMockExtraction()
  };

  // 1. Resolve R1
  const r1Normalized = normalizeSemanticEffect(effect, { refinementRank: 'R1' });
  assert.strictEqual(r1Normalized.consumptionState, 'CONSUMABLE_STATIC');
  assert.strictEqual(r1Normalized.staticNumericValue, 12);
  assert.strictEqual(r1Normalized.refinementRank, 'R1');

  // 2. Resolve R5
  const r5Normalized = normalizeSemanticEffect(effect, { refinementRank: 'R5' });
  assert.strictEqual(r5Normalized.consumptionState, 'CONSUMABLE_STATIC');
  assert.strictEqual(r5Normalized.staticNumericValue, 24);
  assert.strictEqual(r5Normalized.refinementRank, 'R5');

  // Distinct identities
  assert.notStrictEqual(r1Normalized.factId, r5Normalized.factId);
});

test('N12. Target preservation: targets remain strictly segregated', () => {
  const targets = ['SELF', 'TEAM', 'NEXT_RESONATOR', 'ACTIVE_CHARACTER', 'ENEMY'] as const;

  for (const target of targets) {
    const effect: SemanticEffect = {
      id: `n12_${target}`,
      category: 'STAT_BUFF',
      target,
      parameter: 'ATK_PERCENT',
      valueState: 'PARSED',
      value: { type: 'EXACT', value: 15, unit: 'PERCENT' },
      source: createMockSource(),
      extraction: createMockExtraction()
    };

    const normalized = normalizeSemanticEffect(effect);
    assert.strictEqual(normalized.target, target);
  }
});

test('N13. Element preservation: elements are strictly preserved', () => {
  const elements: Array<Element | 'All'> = ['Fusion', 'Electro', 'Aero', 'Glacio', 'Spectro', 'Havoc', 'All'];

  for (const elem of elements) {
    const effect: SemanticEffect = {
      id: `n13_${elem}`,
      category: 'DMG_AMPLIFY',
      target: 'NEXT_RESONATOR',
      parameter: 'FUSION_DAMAGE_PERCENT',
      element: elem,
      valueState: 'PARSED',
      value: { type: 'EXACT', value: 20, unit: 'PERCENT' },
      source: createMockSource({ entityId: 'mortefi', sourceCode: 'outro' }),
      extraction: createMockExtraction()
    };

    const normalized = normalizeSemanticEffect(effect);
    assert.strictEqual(normalized.element, elem);
  }

  // Absent element remains NONE
  const noneEffect: SemanticEffect = {
    id: 'n13_none',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 10, unit: 'PERCENT' },
    source: createMockSource(),
    extraction: createMockExtraction()
  };
  const noneNorm = normalizeSemanticEffect(noneEffect);
  assert.strictEqual(noneNorm.element, 'NONE');
});

test('N14. Condition preservation: conditions are preserved exactly without flattening to boolean', () => {
  const effect: SemanticEffect = {
    id: 'n14_cond',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' },
    condition: {
      trigger: 'ON_RESONANCE_SKILL',
      rawCondition: 'After casting Resonance Skill',
      stackCount: 2,
      buffActive: false,
      zoneActive: false
    },
    source: createMockSource(),
    extraction: createMockExtraction()
  };

  const normalized = normalizeSemanticEffect(effect);
  assert.ok(normalized.condition);
  assert.strictEqual(normalized.condition.trigger, 'ON_RESONANCE_SKILL');
  assert.strictEqual(normalized.condition.rawCondition, 'After casting Resonance Skill');
  assert.strictEqual(normalized.condition.stackCount, 2);
});

test('N15. Duration preservation: duration is preserved and never converted to permanent', () => {
  const effect: SemanticEffect = {
    id: 'n15_dur',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' },
    duration: { durationSeconds: 12, removeOnSwap: false },
    source: createMockSource(),
    extraction: createMockExtraction()
  };

  const normalized = normalizeSemanticEffect(effect);
  assert.strictEqual(normalized.duration?.durationSeconds, 12);
  assert.strictEqual(normalized.duration?.removeOnSwap, false);
});

test('N16. removeOnSwap preservation: swap removal flag remains intact', () => {
  const effect: SemanticEffect = {
    id: 'n16_swap',
    category: 'DMG_AMPLIFY',
    target: 'NEXT_RESONATOR',
    parameter: 'FUSION_DAMAGE_PERCENT',
    element: 'Fusion',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' },
    duration: { durationSeconds: 14, removeOnSwap: true },
    source: createMockSource({ entityId: 'mortefi', sourceCode: 'outro' }),
    extraction: createMockExtraction()
  };

  const normalized = normalizeSemanticEffect(effect);
  assert.strictEqual(normalized.duration?.removeOnSwap, true);
});

test('N17. Stacking preservation: maxStacks and durationPerStack remain intact', () => {
  const effect: SemanticEffect = {
    id: 'n17_stack',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 4, unit: 'PERCENT' },
    stacking: { maxStacks: 5, durationPerStackSeconds: 6 },
    source: createMockSource({ sourceType: 'WEAPON_PASSIVE' }),
    extraction: createMockExtraction()
  };

  const normalized = normalizeSemanticEffect(effect);
  assert.strictEqual(normalized.stacking?.maxStacks, 5);
  assert.strictEqual(normalized.stacking?.durationPerStackSeconds, 6);
});

test('N18. Provenance preservation: source entity, code, patch, and description remain intact', () => {
  const effect: SemanticEffect = {
    id: 'n18_prov',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'CRIT_RATE_PERCENT',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 8, unit: 'PERCENT' },
    source: createMockSource({
      entityId: 'jinhsi',
      entityName: 'Jinhsi',
      sourceCode: 'inherent_1',
      originalDescription: 'Increases Crit. Rate by 8%.'
    }),
    extraction: createMockExtraction()
  };

  const normalized = normalizeSemanticEffect(effect);
  assert.strictEqual(normalized.provenance.entityId, 'jinhsi');
  assert.strictEqual(normalized.provenance.entityName, 'Jinhsi');
  assert.strictEqual(normalized.provenance.sourceCode, 'inherent_1');
  assert.strictEqual(normalized.provenance.originalDescription, 'Increases Crit. Rate by 8%.');
  assert.strictEqual(normalized.extraction.parserVersion, PARSER_VERSION);
});

test('N19. Patch isolation: facts from non-3.7 patch remain NOT_APPLICABLE', () => {
  const effect: SemanticEffect = {
    id: 'n19_patch36',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' },
    source: createMockSource({ patchVersion: '3.6' }),
    extraction: createMockExtraction()
  };

  const normalized = normalizeSemanticEffect(effect);
  assert.strictEqual(normalized.consumptionState, 'NOT_APPLICABLE');
  assert.strictEqual(normalized.staticNumericValue, null);
});

test('N20. No-zero invariant: unavailable states NEVER produce numeric 0', () => {
  const testCases: SemanticEffect[] = [
    // REQUIRES_CONTEXT
    {
      id: 'z1',
      category: 'STAT_BUFF',
      target: 'SELF',
      parameter: 'BASIC_ATTACK_DAMAGE_PERCENT',
      valueState: 'PARSED',
      value: { type: 'EXACT', value: 20, unit: 'PERCENT' },
      source: createMockSource(),
      extraction: createMockExtraction()
    },
    // UNMODELED
    {
      id: 'z2',
      category: 'RESOURCE_GRANT',
      target: 'SELF',
      parameter: 'FORTE_RESOURCE',
      valueState: 'PARSED',
      value: { type: 'EXACT', value: 25, unit: 'FLAT' },
      source: createMockSource(),
      extraction: createMockExtraction()
    },
    // UNKNOWN
    {
      id: 'z3',
      category: 'STAT_BUFF',
      target: 'SELF',
      parameter: 'ATK_PERCENT',
      valueState: 'UNKNOWN',
      value: { type: 'UNRESOLVED', reason: 'unknown' },
      source: createMockSource(),
      extraction: createMockExtraction()
    },
    // NOT_APPLICABLE
    {
      id: 'z4',
      category: 'SPECIAL_MECHANIC',
      target: 'TEAM',
      parameter: 'UNRESOLVED_PARAMETER',
      valueState: 'NOT_APPLICABLE',
      value: { type: 'UNRESOLVED', reason: 'cooking' },
      source: createMockSource(),
      extraction: createMockExtraction()
    }
  ];

  for (const tc of testCases) {
    const norm = normalizeSemanticEffect(tc);
    assert.strictEqual(norm.staticNumericValue, null, `Fact ${tc.id} must have null static value`);
    assert.notStrictEqual(norm.staticNumericValue, 0, `Fact ${tc.id} must NEVER be 0`);
  }
});

test('N21. Stable deterministic identity derived from canonical semantic signature', () => {
  const effect: SemanticEffect = {
    id: 'n21_identity',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 16, unit: 'PERCENT' },
    source: createMockSource({ entityId: 'yangyang', sourceCode: 'skill' }),
    extraction: createMockExtraction()
  };

  const norm1 = normalizeSemanticEffect(effect);
  const norm2 = normalizeSemanticEffect(effect);

  assert.strictEqual(norm1.factId, norm2.factId);
  assert.ok(norm1.factId.includes('yangyang|skill|STAT_BUFF|SELF|ATK_PERCENT'));
});

test('N22. Repeated normalization produces identical byte-for-byte output', () => {
  const audit1 = runProductionFactNormalizationAudit();
  const audit2 = runProductionFactNormalizationAudit();

  assert.deepStrictEqual(audit1, audit2);
});

test('N23. No duplicate normalized facts across production dataset', () => {
  const audit = runProductionFactNormalizationAudit();
  const idSet = new Set<string>();

  for (const f of audit.facts) {
    assert.strictEqual(idSet.has(f.factId), false, `Duplicate factId found: ${f.factId}`);
    idSet.add(f.factId);
  }

  assert.strictEqual(idSet.size, 292);
});

test('N24. All 292 production effects accounted for exactly once', () => {
  const audit = runProductionFactNormalizationAudit();

  assert.strictEqual(audit.totalExtractedEffects, 292);

  // Consumption state reconciliation
  assert.strictEqual(audit.byConsumptionState.CONSUMABLE_STATIC, 90);
  assert.strictEqual(audit.byConsumptionState.CONSUMABLE_CONTEXTUAL, 200);
  assert.strictEqual(audit.byConsumptionState.UNMODELED, 2);
  assert.strictEqual(audit.byConsumptionState.UNKNOWN, 0);
  assert.strictEqual(audit.byConsumptionState.NOT_APPLICABLE, 0);

  const stateSum =
    audit.byConsumptionState.CONSUMABLE_STATIC +
    audit.byConsumptionState.CONSUMABLE_CONTEXTUAL +
    audit.byConsumptionState.UNMODELED +
    audit.byConsumptionState.UNKNOWN +
    audit.byConsumptionState.NOT_APPLICABLE;
  assert.strictEqual(stateSum, 292);

  // Parameter safety reconciliation
  assert.strictEqual(audit.byParameterSafety.DIRECT_ENGINE_FACT, 217);
  assert.strictEqual(audit.byParameterSafety.REQUIRES_CONTEXT, 73);
  assert.strictEqual(audit.byParameterSafety.CURRENTLY_UNMODELED, 2);
  assert.strictEqual(audit.byParameterSafety.NOT_ENGINE_CONSUMABLE, 0);

  const paramSafetySum =
    audit.byParameterSafety.DIRECT_ENGINE_FACT +
    audit.byParameterSafety.REQUIRES_CONTEXT +
    audit.byParameterSafety.CURRENTLY_UNMODELED +
    audit.byParameterSafety.NOT_ENGINE_CONSUMABLE;
  assert.strictEqual(paramSafetySum, 292);

  // Semantic status reconciliation
  assert.strictEqual(audit.bySemanticStatus.SAFE_EXPLICIT, 290);
  assert.strictEqual(audit.bySemanticStatus.SAFE_DERIVED, 0);
  assert.strictEqual(audit.bySemanticStatus.UNKNOWN, 0);
  assert.strictEqual(audit.bySemanticStatus.UNMODELED, 2);
  assert.strictEqual(audit.bySemanticStatus.NOT_APPLICABLE, 0);

  const statusSum =
    audit.bySemanticStatus.SAFE_EXPLICIT +
    audit.bySemanticStatus.SAFE_DERIVED +
    audit.bySemanticStatus.UNKNOWN +
    audit.bySemanticStatus.UNMODELED +
    audit.bySemanticStatus.NOT_APPLICABLE;
  assert.strictEqual(statusSum, 292);

  // Target distribution reconciliation
  assert.strictEqual(audit.byTarget.SELF, 179);
  assert.strictEqual(audit.byTarget.TEAM, 60);
  assert.strictEqual(audit.byTarget.NEXT_RESONATOR, 29);
  assert.strictEqual(audit.byTarget.ACTIVE_CHARACTER, 24);
  const targetSum =
    audit.byTarget.SELF +
    audit.byTarget.TEAM +
    audit.byTarget.NEXT_RESONATOR +
    audit.byTarget.ACTIVE_CHARACTER;
  assert.strictEqual(targetSum, 292);
});

test('N25. Unknown condition properties remain detectable', () => {
  const effect: SemanticEffect = {
    id: 'n25_unknown_prop',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' },
    condition: { unmodeledSpecialState: 'active' } as any,
    source: createMockSource(),
    extraction: createMockExtraction()
  };

  const normalized = normalizeSemanticEffect(effect);

  assert.strictEqual(normalized.consumptionState, 'CONSUMABLE_CONTEXTUAL');
  assert.strictEqual(normalized.staticNumericValue, null);
  assert.ok(normalized.condition);
  assert.strictEqual((normalized.condition as any).unmodeledSpecialState, 'active');
});

test('N26. Semantic field preservation audit verifies zero information loss', () => {
  const fullEffect: SemanticEffect = {
    id: 'n26_full',
    category: 'DMG_AMPLIFY',
    target: 'NEXT_RESONATOR',
    parameter: 'FUSION_DAMAGE_PERCENT',
    element: 'Fusion',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' },
    condition: { trigger: 'ON_OUTRO_SKILL', rawCondition: 'On Outro Skill' },
    duration: { durationSeconds: 14, removeOnSwap: true },
    stacking: { maxStacks: 1 },
    source: createMockSource({
      entityId: 'mortefi',
      entityName: 'Mortefi',
      sourceCode: 'outro',
      sourceType: 'RESONATOR_ABILITY',
      patchVersion: '3.7',
      sourceProvenance: 'patch_3_7_dataset.json#resonators/mortefi/outro',
      originalDescription: 'Next character deals 20% more Fusion DMG.'
    }),
    extraction: createMockExtraction()
  };

  const norm = normalizeSemanticEffect(fullEffect);

  // Field-by-field preservation verification
  assert.strictEqual(norm.entityId, fullEffect.source.entityId);
  assert.strictEqual(norm.sourceCode, fullEffect.source.sourceCode);
  assert.strictEqual(norm.patchVersion, fullEffect.source.patchVersion);
  assert.strictEqual(norm.category, fullEffect.category);
  assert.strictEqual(norm.parameter, fullEffect.parameter);
  assert.deepStrictEqual(norm.value, fullEffect.value);
  assert.strictEqual(norm.target, fullEffect.target);
  assert.strictEqual(norm.element, fullEffect.element);
  assert.deepStrictEqual(norm.condition, fullEffect.condition);
  assert.deepStrictEqual(norm.duration, fullEffect.duration);
  assert.deepStrictEqual(norm.stacking, fullEffect.stacking);
  assert.deepStrictEqual(norm.provenance, fullEffect.source);
  assert.deepStrictEqual(norm.extraction, fullEffect.extraction);
});

// ----------------------------------------------------------------------------
// PHASE 6C STEP 4 FINAL REMEDIATION: IDENTITY REGRESSION TESTS (I1–I14)
// ----------------------------------------------------------------------------

test('I1. Same semantic effect -> identical factId across repeated normalization', () => {
  const effect: SemanticEffect = {
    id: 'i1_effect',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' },
    condition: { trigger: 'ON_RESONANCE_SKILL' },
    duration: { durationSeconds: 10, removeOnSwap: false },
    stacking: { maxStacks: 2 },
    source: createMockSource({ entityId: 'jinhsi', sourceCode: 'skill' }),
    extraction: createMockExtraction()
  };

  const norm1 = normalizeSemanticEffect(effect);
  const norm2 = normalizeSemanticEffect(effect);

  assert.strictEqual(norm1.factId, norm2.factId);
  assert.strictEqual(norm1.factId, computeSemanticSignature(effect));
});

test('I2. Different value -> different factId', () => {
  const base: SemanticEffect = {
    id: 'i2_base',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' },
    source: createMockSource(),
    extraction: createMockExtraction()
  };

  const variant: SemanticEffect = {
    ...base,
    id: 'i2_variant',
    value: { type: 'EXACT', value: 25, unit: 'PERCENT' }
  };

  const norm1 = normalizeSemanticEffect(base);
  const norm2 = normalizeSemanticEffect(variant);

  assert.notStrictEqual(norm1.factId, norm2.factId);
});

test('I3. Different element -> different factId', () => {
  const base: SemanticEffect = {
    id: 'i3_base',
    category: 'DMG_AMPLIFY',
    target: 'NEXT_RESONATOR',
    parameter: 'FUSION_DAMAGE_PERCENT',
    element: 'Fusion',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' },
    source: createMockSource(),
    extraction: createMockExtraction()
  };

  const variant: SemanticEffect = {
    ...base,
    id: 'i3_variant',
    parameter: 'GLACIO_DAMAGE_PERCENT',
    element: 'Glacio'
  };

  const norm1 = normalizeSemanticEffect(base);
  const norm2 = normalizeSemanticEffect(variant);

  assert.notStrictEqual(norm1.factId, norm2.factId);
});

test('I4. Different target -> different factId', () => {
  const base: SemanticEffect = {
    id: 'i4_base',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' },
    source: createMockSource(),
    extraction: createMockExtraction()
  };

  const variant: SemanticEffect = {
    ...base,
    id: 'i4_variant',
    target: 'TEAM'
  };

  const norm1 = normalizeSemanticEffect(base);
  const norm2 = normalizeSemanticEffect(variant);

  assert.notStrictEqual(norm1.factId, norm2.factId);
});

test('I5. Different condition -> different factId', () => {
  const base: SemanticEffect = {
    id: 'i5_base',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' },
    condition: { trigger: 'ON_RESONANCE_SKILL' },
    source: createMockSource(),
    extraction: createMockExtraction()
  };

  const variant: SemanticEffect = {
    ...base,
    id: 'i5_variant',
    condition: { trigger: 'ON_RESONANCE_LIBERATION' }
  };

  const norm1 = normalizeSemanticEffect(base);
  const norm2 = normalizeSemanticEffect(variant);

  assert.notStrictEqual(norm1.factId, norm2.factId);
});

test('I6. Different duration -> different factId', () => {
  const base: SemanticEffect = {
    id: 'i6_base',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' },
    duration: { durationSeconds: 10, removeOnSwap: false },
    source: createMockSource(),
    extraction: createMockExtraction()
  };

  const variantDur: SemanticEffect = {
    ...base,
    id: 'i6_variant_dur',
    duration: { durationSeconds: 15, removeOnSwap: false }
  };

  const variantSwap: SemanticEffect = {
    ...base,
    id: 'i6_variant_swap',
    duration: { durationSeconds: 10, removeOnSwap: true }
  };

  const norm1 = normalizeSemanticEffect(base);
  const norm2 = normalizeSemanticEffect(variantDur);
  const norm3 = normalizeSemanticEffect(variantSwap);

  assert.notStrictEqual(norm1.factId, norm2.factId);
  assert.notStrictEqual(norm1.factId, norm3.factId);
});

test('I7. Different stacking -> different factId', () => {
  const base: SemanticEffect = {
    id: 'i7_base',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 4, unit: 'PERCENT' },
    stacking: { maxStacks: 3 },
    source: createMockSource(),
    extraction: createMockExtraction()
  };

  const variant: SemanticEffect = {
    ...base,
    id: 'i7_variant',
    stacking: { maxStacks: 5 }
  };

  const norm1 = normalizeSemanticEffect(base);
  const norm2 = normalizeSemanticEffect(variant);

  assert.notStrictEqual(norm1.factId, norm2.factId);
});

test('I8. Different parameter -> different factId', () => {
  const base: SemanticEffect = {
    id: 'i8_base',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' },
    source: createMockSource(),
    extraction: createMockExtraction()
  };

  const variant: SemanticEffect = {
    ...base,
    id: 'i8_variant',
    parameter: 'DEF_PERCENT'
  };

  const norm1 = normalizeSemanticEffect(base);
  const norm2 = normalizeSemanticEffect(variant);

  assert.notStrictEqual(norm1.factId, norm2.factId);
});

test('I9. Different sourceCode -> different factId', () => {
  const base: SemanticEffect = {
    id: 'i9_base',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' },
    source: createMockSource({ sourceCode: 'skill' }),
    extraction: createMockExtraction()
  };

  const variant: SemanticEffect = {
    ...base,
    id: 'i9_variant',
    source: createMockSource({ sourceCode: 'liberation' })
  };

  const norm1 = normalizeSemanticEffect(base);
  const norm2 = normalizeSemanticEffect(variant);

  assert.notStrictEqual(norm1.factId, norm2.factId);
});

test('I10. Different entityId -> different factId', () => {
  const base: SemanticEffect = {
    id: 'i10_base',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' },
    source: createMockSource({ entityId: 'jinhsi' }),
    extraction: createMockExtraction()
  };

  const variant: SemanticEffect = {
    ...base,
    id: 'i10_variant',
    source: createMockSource({ entityId: 'changli' })
  };

  const norm1 = normalizeSemanticEffect(base);
  const norm2 = normalizeSemanticEffect(variant);

  assert.notStrictEqual(norm1.factId, norm2.factId);
});

test('I11. Same semantic effect but different temporary extraction ID -> same canonical factId', () => {
  const effectA: SemanticEffect = {
    id: 'temp_random_id_12345',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' },
    source: createMockSource({ entityId: 'rover_spectro', sourceCode: 'skill' }),
    extraction: createMockExtraction()
  };

  const effectB: SemanticEffect = {
    ...effectA,
    id: 'temp_different_id_99999'
  };

  const normA = normalizeSemanticEffect(effectA);
  const normB = normalizeSemanticEffect(effectB);

  assert.strictEqual(normA.factId, normB.factId);
  assert.strictEqual(normA.factId, computeSemanticSignature(effectA));
});

test('I12. R1 vs R2 -> different resolved factId', () => {
  const weaponEffect: SemanticEffect = {
    id: 'i12_weapon',
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    valueState: 'PARSED',
    value: {
      type: 'MULTI_RANK',
      unit: 'PERCENT',
      ranks: {
        R1: { type: 'EXACT', value: 12, unit: 'PERCENT' },
        R2: { type: 'EXACT', value: 15, unit: 'PERCENT' },
        R3: { type: 'EXACT', value: 18, unit: 'PERCENT' },
        R4: { type: 'EXACT', value: 21, unit: 'PERCENT' },
        R5: { type: 'EXACT', value: 24, unit: 'PERCENT' }
      }
    },
    source: createMockSource({ sourceType: 'WEAPON_PASSIVE' }),
    extraction: createMockExtraction()
  };

  const normR1 = normalizeSemanticEffect(weaponEffect, { refinementRank: 'R1' });
  const normR2 = normalizeSemanticEffect(weaponEffect, { refinementRank: 'R2' });

  assert.notStrictEqual(normR1.factId, normR2.factId);
  assert.ok(normR1.factId.endsWith('#R1'));
  assert.ok(normR2.factId.endsWith('#R2'));
  assert.strictEqual(normR1.factId, `${computeSemanticSignature(weaponEffect)}#R1`);
  assert.strictEqual(normR2.factId, `${computeSemanticSignature(weaponEffect)}#R2`);
});

test('I13. Repeated normalization -> byte-for-byte identical factId', () => {
  const effect: SemanticEffect = {
    id: 'i13_effect',
    category: 'DMG_AMPLIFY',
    target: 'NEXT_RESONATOR',
    parameter: 'FUSION_DAMAGE_PERCENT',
    element: 'Fusion',
    valueState: 'PARSED',
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' },
    duration: { durationSeconds: 14, removeOnSwap: true },
    source: createMockSource({ entityId: 'mortefi', sourceCode: 'outro' }),
    extraction: createMockExtraction()
  };

  const id1 = normalizeSemanticEffect(effect).factId;
  const id2 = normalizeSemanticEffect(effect).factId;
  const id3 = normalizeSemanticEffect(effect).factId;

  assert.strictEqual(id1, id2);
  assert.strictEqual(id2, id3);
});

test('I14. All 292 production effects -> unique canonical fact IDs with zero accidental collisions', () => {
  const audit = runProductionFactNormalizationAudit();
  const seenIds = new Map<string, number>();

  for (const f of audit.facts) {
    const count = (seenIds.get(f.factId) || 0) + 1;
    seenIds.set(f.factId, count);
  }

  for (const [id, count] of seenIds.entries()) {
    assert.strictEqual(count, 1, `Collision detected for factId: ${id}`);
  }

  assert.strictEqual(seenIds.size, 292);
});

test('M1. Deterministic extraction metadata audit: zero runtime timestamps or dynamic environments', () => {
  const audit = runProductionFactNormalizationAudit();

  for (const f of audit.facts) {
    // 1. Parser version must be static canonical
    assert.strictEqual(f.extraction.parserVersion, PARSER_VERSION);
    // 2. Method must be static deterministic rule parser
    assert.strictEqual(f.extraction.method, 'DETERMINISTIC_RULE_PARSER');
    // 3. Extraction date must be static canonical release date milestone
    assert.strictEqual(f.extraction.extractionDate, '2026-10-08');

    // 4. Must NOT contain dynamic ISO datetime strings with runtime seconds/millis
    const json = JSON.stringify(f);
    assert.doesNotMatch(json, /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  }
});

