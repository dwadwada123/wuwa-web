import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateNormalizedFactWithContext,
  evaluateNormalizedFacts,
  runProductionContextualAudit
} from '../lib/engine/facts/context/evaluator.ts';
import type {
  RuntimeEvaluationContext,
  ContextualEvaluationResult
} from '../lib/engine/facts/context/types.ts';
import type { NormalizedEngineFact } from '../lib/engine/facts/types.ts';
import { runProductionFactNormalizationAudit } from '../lib/engine/facts/normalizer.ts';
import { PARSER_VERSION } from '../lib/semantics/parser.ts';

function createMockNormalizedFact(overrides: Partial<NormalizedEngineFact> = {}): NormalizedEngineFact {
  return {
    factId: 'rover_spectro|skill|STAT_BUFF|SELF|ATK_PERCENT|NONE|EXACT:20:PERCENT|NO_COND|NO_DUR|NO_STACKING',
    entityId: 'rover_spectro',
    sourceCode: 'skill',
    patchVersion: '3.7',
    category: 'STAT_BUFF',
    parameter: 'ATK_PERCENT',
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' },
    staticNumericValue: 20,
    unit: 'PERCENT',
    target: 'SELF',
    element: 'NONE',
    semanticStatus: 'SAFE_EXPLICIT',
    parameterSafety: 'DIRECT_ENGINE_FACT',
    consumptionState: 'CONSUMABLE_STATIC',
    provenance: {
      entityId: 'rover_spectro',
      entityName: 'Rover (Spectro)',
      sourceType: 'RESONATOR_ABILITY',
      sourceCode: 'skill',
      patchVersion: '3.7',
      sourceProvenance: 'patch_3_7_dataset.json#resonators/rover_spectro',
      originalDescription: 'Increases ATK by 20%.'
    },
    extraction: {
      parserVersion: PARSER_VERSION,
      method: 'DETERMINISTIC_RULE_PARSER',
      extractionDate: '2026-10-08'
    },
    ...overrides
  };
}

// ----------------------------------------------------------------------------
// PHASE 6C STEP 5: CONTEXTUAL ENGINE FACT EVALUATION TESTS (C1–C30)
// ----------------------------------------------------------------------------

test('C1. Static fact remains consumable', () => {
  const fact = createMockNormalizedFact();
  const result = evaluateNormalizedFactWithContext(fact);

  assert.strictEqual(result.consumable, true);
  assert.strictEqual(result.numericValue, 20);
  assert.strictEqual(result.unit, 'PERCENT');
  assert.strictEqual(result.state, 'STATIC');
  assert.strictEqual(result.reason, 'STATIC_ELIGIBLE');
});

test('C2. Contextual fact without context fails closed', () => {
  const fact = createMockNormalizedFact({
    factId: 'camellya|skill|STAT_BUFF|SELF|BASIC_ATTACK_DAMAGE_PERCENT|NONE|EXACT:20:PERCENT|NO_COND|NO_DUR|NO_STACKING',
    parameter: 'BASIC_ATTACK_DAMAGE_PERCENT',
    parameterSafety: 'REQUIRES_CONTEXT',
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    staticNumericValue: null
  });

  const result = evaluateNormalizedFactWithContext(fact, undefined);

  assert.strictEqual(result.consumable, false);
  assert.strictEqual(result.numericValue, null);
  assert.notStrictEqual(result.numericValue, 0);
  assert.strictEqual(result.state, 'CONTEXTUAL');
  assert.strictEqual(result.reason, 'MISSING_ACTION');
});

test('C3. Basic Attack fact + BASIC_ATTACK context succeeds when valid', () => {
  const fact = createMockNormalizedFact({
    factId: 'camellya|skill|STAT_BUFF|SELF|BASIC_ATTACK_DAMAGE_PERCENT|NONE|EXACT:20:PERCENT|NO_COND|NO_DUR|NO_STACKING',
    parameter: 'BASIC_ATTACK_DAMAGE_PERCENT',
    parameterSafety: 'REQUIRES_CONTEXT',
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    staticNumericValue: null
  });

  const result = evaluateNormalizedFactWithContext(fact, { actionType: 'BASIC_ATTACK' });

  assert.strictEqual(result.consumable, true);
  assert.strictEqual(result.numericValue, 20);
  assert.strictEqual(result.unit, 'PERCENT');
  assert.strictEqual(result.state, 'CONTEXTUAL');
  assert.strictEqual(result.reason, 'CONTEXT_SATISFIED');
});

test('C4. Basic Attack fact + SKILL context fails', () => {
  const fact = createMockNormalizedFact({
    factId: 'camellya|skill|STAT_BUFF|SELF|BASIC_ATTACK_DAMAGE_PERCENT|NONE|EXACT:20:PERCENT|NO_COND|NO_DUR|NO_STACKING',
    parameter: 'BASIC_ATTACK_DAMAGE_PERCENT',
    parameterSafety: 'REQUIRES_CONTEXT',
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    staticNumericValue: null
  });

  const result = evaluateNormalizedFactWithContext(fact, { actionType: 'RESONANCE_SKILL' });

  assert.strictEqual(result.consumable, false);
  assert.strictEqual(result.numericValue, null);
  assert.strictEqual(result.reason, 'MISMATCHED_ACTION');
});

test('C5. Skill fact + SKILL context succeeds when all conditions are satisfied', () => {
  const fact = createMockNormalizedFact({
    factId: 'changli|skill|STAT_BUFF|SELF|SKILL_DAMAGE_PERCENT|NONE|EXACT:25:PERCENT|ON_RESONANCE_SKILL_NO_RAW_NO_STACK_zone:false_buff:false|NO_DUR|NO_STACKING',
    parameter: 'SKILL_DAMAGE_PERCENT',
    parameterSafety: 'REQUIRES_CONTEXT',
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    condition: { trigger: 'ON_RESONANCE_SKILL' },
    staticNumericValue: null,
    value: { type: 'EXACT', value: 25, unit: 'PERCENT' }
  });

  const result = evaluateNormalizedFactWithContext(fact, {
    actionType: 'RESONANCE_SKILL',
    trigger: 'ON_RESONANCE_SKILL'
  });

  assert.strictEqual(result.consumable, true);
  assert.strictEqual(result.numericValue, 25);
  assert.strictEqual(result.reason, 'CONTEXT_SATISFIED');
});

test('C6. Skill fact + missing action fails', () => {
  const fact = createMockNormalizedFact({
    factId: 'changli|skill|STAT_BUFF|SELF|SKILL_DAMAGE_PERCENT|NONE|EXACT:25:PERCENT|NO_COND|NO_DUR|NO_STACKING',
    parameter: 'SKILL_DAMAGE_PERCENT',
    parameterSafety: 'REQUIRES_CONTEXT',
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    staticNumericValue: null
  });

  const result = evaluateNormalizedFactWithContext(fact, {});

  assert.strictEqual(result.consumable, false);
  assert.strictEqual(result.numericValue, null);
  assert.strictEqual(result.reason, 'MISSING_ACTION');
});

test('C7. Liberation fact + incorrect action fails', () => {
  const fact = createMockNormalizedFact({
    factId: 'jinhsi|liberation|STAT_BUFF|SELF|LIBERATION_DAMAGE_PERCENT|NONE|EXACT:30:PERCENT|NO_COND|NO_DUR|NO_STACKING',
    parameter: 'LIBERATION_DAMAGE_PERCENT',
    parameterSafety: 'REQUIRES_CONTEXT',
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    staticNumericValue: null
  });

  const result = evaluateNormalizedFactWithContext(fact, { actionType: 'BASIC_ATTACK' });

  assert.strictEqual(result.consumable, false);
  assert.strictEqual(result.numericValue, null);
  assert.strictEqual(result.reason, 'MISMATCHED_ACTION');
});

test('C8. Zone condition with zoneActive=true succeeds', () => {
  const fact = createMockNormalizedFact({
    factId: 'verina|skill|STAT_BUFF|SELF|ATK_PERCENT|NONE|EXACT:15:PERCENT|NO_TRIG_NO_RAW_NO_STACK_zone:true_buff:false|NO_DUR|NO_STACKING',
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    condition: { zoneActive: true },
    staticNumericValue: null
  });

  const result = evaluateNormalizedFactWithContext(fact, { zoneActive: true });

  assert.strictEqual(result.consumable, true);
  assert.strictEqual(result.numericValue, 20);
  assert.strictEqual(result.reason, 'CONTEXT_SATISFIED');
});

test('C9. Zone condition with zoneActive=false fails', () => {
  const fact = createMockNormalizedFact({
    factId: 'verina|skill|STAT_BUFF|SELF|ATK_PERCENT|NONE|EXACT:15:PERCENT|NO_TRIG_NO_RAW_NO_STACK_zone:true_buff:false|NO_DUR|NO_STACKING',
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    condition: { zoneActive: true },
    staticNumericValue: null
  });

  const result = evaluateNormalizedFactWithContext(fact, { zoneActive: false });

  assert.strictEqual(result.consumable, false);
  assert.strictEqual(result.numericValue, null);
  assert.strictEqual(result.reason, 'MISMATCHED_ZONE_STATE');
});

test('C10. Zone condition with missing zoneActive fails', () => {
  const fact = createMockNormalizedFact({
    factId: 'verina|skill|STAT_BUFF|SELF|ATK_PERCENT|NONE|EXACT:15:PERCENT|NO_TRIG_NO_RAW_NO_STACK_zone:true_buff:false|NO_DUR|NO_STACKING',
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    condition: { zoneActive: true },
    staticNumericValue: null
  });

  const result = evaluateNormalizedFactWithContext(fact, {});

  assert.strictEqual(result.consumable, false);
  assert.strictEqual(result.numericValue, null);
  assert.strictEqual(result.reason, 'MISSING_ZONE_STATE');
});

test('C11. Buff condition with explicit matching state succeeds', () => {
  const fact = createMockNormalizedFact({
    factId: 'yinlin|skill|STAT_BUFF|SELF|CRIT_RATE_PERCENT|NONE|EXACT:10:PERCENT|NO_TRIG_NO_RAW_NO_STACK_zone:false_buff:true|NO_DUR|NO_STACKING',
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    condition: { buffActive: true },
    staticNumericValue: null,
    value: { type: 'EXACT', value: 10, unit: 'PERCENT' }
  });

  const result = evaluateNormalizedFactWithContext(fact, { buffActive: true });

  assert.strictEqual(result.consumable, true);
  assert.strictEqual(result.numericValue, 10);
  assert.strictEqual(result.reason, 'CONTEXT_SATISFIED');
});

test('C12. Buff condition without state fails', () => {
  const fact = createMockNormalizedFact({
    factId: 'yinlin|skill|STAT_BUFF|SELF|CRIT_RATE_PERCENT|NONE|EXACT:10:PERCENT|NO_TRIG_NO_RAW_NO_STACK_zone:false_buff:true|NO_DUR|NO_STACKING',
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    condition: { buffActive: true },
    staticNumericValue: null
  });

  const result = evaluateNormalizedFactWithContext(fact, {});

  assert.strictEqual(result.consumable, false);
  assert.strictEqual(result.numericValue, null);
  assert.strictEqual(result.reason, 'MISSING_BUFF_STATE');
});

test('C13. Stack condition with explicit stack count evaluates deterministically', () => {
  const fact = createMockNormalizedFact({
    factId: 'jiyan|skill|STAT_BUFF|SELF|CRIT_RATE_PERCENT|NONE|EXACT:12:PERCENT|NO_TRIG_NO_RAW_3_zone:false_buff:false|NO_DUR|NO_STACKING',
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    condition: { stackCount: 3, stackOperator: 'AT_LEAST' },
    staticNumericValue: null,
    value: { type: 'EXACT', value: 12, unit: 'PERCENT' }
  });

  const result = evaluateNormalizedFactWithContext(fact, { stackCount: 3 });

  assert.strictEqual(result.consumable, true);
  assert.strictEqual(result.numericValue, 12);
  assert.strictEqual(result.reason, 'CONTEXT_SATISFIED');
});

test('C14. Stack condition without stack count fails', () => {
  const fact = createMockNormalizedFact({
    factId: 'jiyan|skill|STAT_BUFF|SELF|CRIT_RATE_PERCENT|NONE|EXACT:12:PERCENT|NO_TRIG_NO_RAW_3_zone:false_buff:false|NO_DUR|NO_STACKING',
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    condition: { stackCount: 3, stackOperator: 'AT_LEAST' },
    staticNumericValue: null
  });

  const missingResult = evaluateNormalizedFactWithContext(fact, {});
  assert.strictEqual(missingResult.consumable, false);
  assert.strictEqual(missingResult.reason, 'MISSING_STACK_COUNT');

  const insufficientResult = evaluateNormalizedFactWithContext(fact, { stackCount: 2 });
  assert.strictEqual(insufficientResult.consumable, false);
  assert.strictEqual(insufficientResult.reason, 'INSUFFICIENT_STACKS');
});

test('C15. Raw/unknown condition fails closed', () => {
  const rawFact = createMockNormalizedFact({
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    condition: { rawCondition: 'When HP drops below 40%' },
    staticNumericValue: null
  });
  const rawRes = evaluateNormalizedFactWithContext(rawFact, { actionType: 'BASIC_ATTACK' });
  assert.strictEqual(rawRes.consumable, false);
  assert.strictEqual(rawRes.reason, 'UNRESOLVED_RAW_CONDITION');

  const unknownFact = createMockNormalizedFact({
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    condition: { unknownProp: true } as any,
    staticNumericValue: null
  });
  const unknownRes = evaluateNormalizedFactWithContext(unknownFact, { actionType: 'BASIC_ATTACK' });
  assert.strictEqual(unknownRes.consumable, false);
  assert.strictEqual(unknownRes.reason, 'UNKNOWN_CONDITION_FIELD');
});

test('C16. Explicit R1 resolves only R1', () => {
  const fact = createMockNormalizedFact({
    factId: 'weapon_sword|passive|STAT_BUFF|SELF|ATK_PERCENT|NONE|MULTI_RANK:R1:[EXACT:12:PERCENT],R5:[EXACT:24:PERCENT]:PERCENT|NO_COND|NO_DUR|NO_STACKING',
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    value: {
      type: 'MULTI_RANK',
      unit: 'PERCENT',
      ranks: {
        R1: { type: 'EXACT', value: 12, unit: 'PERCENT' },
        R5: { type: 'EXACT', value: 24, unit: 'PERCENT' }
      }
    },
    staticNumericValue: null
  });

  const result = evaluateNormalizedFactWithContext(fact, { refinementRank: 'R1' });

  assert.strictEqual(result.consumable, true);
  assert.strictEqual(result.numericValue, 12);
  assert.strictEqual(result.resolvedRank, 'R1');
  assert.strictEqual(result.reason, 'CONTEXT_SATISFIED');
});

test('C17. Missing rank does not default to R1', () => {
  const fact = createMockNormalizedFact({
    factId: 'weapon_sword|passive|STAT_BUFF|SELF|ATK_PERCENT|NONE|MULTI_RANK:R1:[EXACT:12:PERCENT],R5:[EXACT:24:PERCENT]:PERCENT|NO_COND|NO_DUR|NO_STACKING',
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    value: {
      type: 'MULTI_RANK',
      unit: 'PERCENT',
      ranks: {
        R1: { type: 'EXACT', value: 12, unit: 'PERCENT' },
        R5: { type: 'EXACT', value: 24, unit: 'PERCENT' }
      }
    },
    staticNumericValue: null
  });

  const result = evaluateNormalizedFactWithContext(fact, {});

  assert.strictEqual(result.consumable, false);
  assert.strictEqual(result.numericValue, null);
  assert.strictEqual(result.reason, 'MISSING_REFINEMENT_RANK');
});

test('C18. Invalid rank fails', () => {
  const fact = createMockNormalizedFact({
    factId: 'weapon_sword|passive|STAT_BUFF|SELF|ATK_PERCENT|NONE|MULTI_RANK:R1:[EXACT:12:PERCENT],R5:[EXACT:24:PERCENT]:PERCENT|NO_COND|NO_DUR|NO_STACKING',
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    value: {
      type: 'MULTI_RANK',
      unit: 'PERCENT',
      ranks: {
        R1: { type: 'EXACT', value: 12, unit: 'PERCENT' },
        R5: { type: 'EXACT', value: 24, unit: 'PERCENT' }
      }
    },
    staticNumericValue: null
  });

  const invalidRankRes = evaluateNormalizedFactWithContext(fact, { refinementRank: 'R6' as any });
  assert.strictEqual(invalidRankRes.consumable, false);
  assert.strictEqual(invalidRankRes.reason, 'INVALID_REFINEMENT_RANK');

  const missingRankRes = evaluateNormalizedFactWithContext(fact, { refinementRank: 'R3' });
  assert.strictEqual(missingRankRes.consumable, false);
  assert.strictEqual(missingRankRes.reason, 'INVALID_REFINEMENT_RANK');
});

test('C19. Duration metadata is preserved', () => {
  const fact = createMockNormalizedFact({
    duration: { durationSeconds: 15, removeOnSwap: false }
  });

  const result = evaluateNormalizedFactWithContext(fact);

  assert.strictEqual(result.duration?.durationSeconds, 15);
  assert.strictEqual(result.duration?.removeOnSwap, false);
});

test('C20. removeOnSwap metadata is preserved', () => {
  const fact = createMockNormalizedFact({
    duration: { durationSeconds: 30, removeOnSwap: true }
  });

  const result = evaluateNormalizedFactWithContext(fact);

  assert.strictEqual(result.duration?.durationSeconds, 30);
  assert.strictEqual(result.duration?.removeOnSwap, true);
});

test('C21. UNMODELED returns null numeric value', () => {
  const fact = createMockNormalizedFact({
    consumptionState: 'UNMODELED',
    semanticStatus: 'UNMODELED',
    parameter: 'FORTE_RESOURCE',
    parameterSafety: 'CURRENTLY_UNMODELED',
    staticNumericValue: null
  });

  const result = evaluateNormalizedFactWithContext(fact, { actionType: 'BASIC_ATTACK' });

  assert.strictEqual(result.consumable, false);
  assert.strictEqual(result.numericValue, null);
  assert.notStrictEqual(result.numericValue, 0);
  assert.strictEqual(result.state, 'UNMODELED');
  assert.strictEqual(result.reason, 'UNMODELED_PARAMETER');
});

test('C22. UNKNOWN returns null numeric value', () => {
  const fact = createMockNormalizedFact({
    consumptionState: 'UNKNOWN',
    semanticStatus: 'UNKNOWN',
    staticNumericValue: null
  });

  const result = evaluateNormalizedFactWithContext(fact, { actionType: 'BASIC_ATTACK' });

  assert.strictEqual(result.consumable, false);
  assert.strictEqual(result.numericValue, null);
  assert.notStrictEqual(result.numericValue, 0);
  assert.strictEqual(result.state, 'UNKNOWN');
  assert.strictEqual(result.reason, 'UNKNOWN_SEMANTICS');
});

test('C23. NOT_APPLICABLE returns null numeric value', () => {
  const fact = createMockNormalizedFact({
    consumptionState: 'NOT_APPLICABLE',
    semanticStatus: 'NOT_APPLICABLE',
    staticNumericValue: null
  });

  const result = evaluateNormalizedFactWithContext(fact, { actionType: 'BASIC_ATTACK' });

  assert.strictEqual(result.consumable, false);
  assert.strictEqual(result.numericValue, null);
  assert.strictEqual(result.state, 'NOT_APPLICABLE');
  assert.strictEqual(result.reason, 'NON_COMBAT_UTILITY');
});

test('C24. Cross-patch fact is rejected', () => {
  const fact = createMockNormalizedFact({
    patchVersion: '3.6'
  });

  const result = evaluateNormalizedFactWithContext(fact);

  assert.strictEqual(result.consumable, false);
  assert.strictEqual(result.numericValue, null);
  assert.strictEqual(result.reason, 'CROSS_PATCH_REJECTED');
});

test('C25. Invalid provenance is rejected', () => {
  const fact = createMockNormalizedFact({
    provenance: { entityId: '', originalDescription: '' } as any
  });

  const result = evaluateNormalizedFactWithContext(fact);

  assert.strictEqual(result.consumable, false);
  assert.strictEqual(result.numericValue, null);
  assert.strictEqual(result.reason, 'INVALID_PROVENANCE');
});

test('C26. NaN/Infinity can never escape evaluator', () => {
  const nanFact = createMockNormalizedFact({
    consumptionState: 'CONSUMABLE_STATIC',
    staticNumericValue: NaN
  });
  const nanRes = evaluateNormalizedFactWithContext(nanFact);
  assert.strictEqual(nanRes.consumable, false);
  assert.strictEqual(nanRes.numericValue, null);
  assert.strictEqual(nanRes.reason, 'NON_FINITE_NUMERIC');

  const infFact = createMockNormalizedFact({
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    parameter: 'BASIC_ATTACK_DAMAGE_PERCENT',
    parameterSafety: 'REQUIRES_CONTEXT',
    value: { type: 'EXACT', value: Infinity, unit: 'PERCENT' },
    staticNumericValue: null
  });
  const infRes = evaluateNormalizedFactWithContext(infFact, { actionType: 'BASIC_ATTACK' });
  assert.strictEqual(infRes.consumable, false);
  assert.strictEqual(infRes.numericValue, null);
  assert.strictEqual(infRes.reason, 'NON_FINITE_NUMERIC');
});

test('C27. Same fact + same context produces byte-identical result', () => {
  const fact = createMockNormalizedFact();
  const context: RuntimeEvaluationContext = { actionType: 'BASIC_ATTACK', refinementRank: 'R1' };

  const res1 = evaluateNormalizedFactWithContext(fact, context);
  const res2 = evaluateNormalizedFactWithContext(fact, context);

  assert.deepStrictEqual(res1, res2);
});

test('C28. 10 repeated evaluations produce identical results', () => {
  const fact = createMockNormalizedFact();
  const context: RuntimeEvaluationContext = { actionType: 'BASIC_ATTACK' };

  const base = evaluateNormalizedFactWithContext(fact, context);
  for (let i = 0; i < 10; i++) {
    const next = evaluateNormalizedFactWithContext(fact, context);
    assert.deepStrictEqual(base, next);
  }
});

test('C29. No mutation of source NormalizedEngineFact', () => {
  const fact = createMockNormalizedFact({
    value: {
      type: 'MULTI_RANK',
      unit: 'PERCENT',
      ranks: {
        R1: { type: 'EXACT', value: 10, unit: 'PERCENT' },
        R2: { type: 'EXACT', value: 12, unit: 'PERCENT' }
      }
    },
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    staticNumericValue: null
  });

  const snapshot = JSON.stringify(fact);
  evaluateNormalizedFactWithContext(fact, { refinementRank: 'R1' });
  const afterEvaluation = JSON.stringify(fact);

  assert.strictEqual(snapshot, afterEvaluation, 'Evaluator must not mutate source fact');
});

test('C30. Canonical factId remains unchanged through contextual evaluation', () => {
  const fact = createMockNormalizedFact({
    factId: 'canonical_signature_test_123',
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    parameter: 'BASIC_ATTACK_DAMAGE_PERCENT',
    parameterSafety: 'REQUIRES_CONTEXT',
    staticNumericValue: null
  });

  const result = evaluateNormalizedFactWithContext(fact, { actionType: 'BASIC_ATTACK' });

  assert.strictEqual(result.factId, 'canonical_signature_test_123');
});

test('C31. Production contextual audit runs cleanly across all 292 Patch 3.7 facts', () => {
  const audit = runProductionContextualAudit();

  assert.strictEqual(audit.totalFacts, 292);

  // Zero-context audit: strictly 68 non-element static facts consumable, all 224 others return null (including 44 element-specific facts)
  assert.strictEqual(audit.zeroContextAudit.staticConsumable, 68);
  assert.strictEqual(audit.zeroContextAudit.contextualPending, 222);
  assert.strictEqual(audit.zeroContextAudit.unmodeled, 2);
  assert.strictEqual(audit.zeroContextAudit.unknown, 0);
  assert.strictEqual(audit.zeroContextAudit.notApplicable, 0);
  assert.strictEqual(audit.zeroContextAudit.numericOutputs, 68);
  assert.strictEqual(audit.zeroContextAudit.nullOutputs, 224);

  // Representative context audit: all 90 static (68 non-element + 22 element-specific) + 200 contextual resolve; 2 unmodeled remain null
  assert.strictEqual(audit.representativeContextAudit.totalEvaluated, 292);
  assert.strictEqual(audit.representativeContextAudit.successfullyResolved, 290);
  assert.strictEqual(audit.representativeContextAudit.unmodeled, 2);
  assert.strictEqual(audit.representativeContextAudit.stillUnresolved, 0);
  assert.strictEqual(audit.representativeContextAudit.numericOutputs, 290);
  assert.strictEqual(audit.representativeContextAudit.nullOutputs, 2);

  assert.strictEqual(audit.crossPatchRejected, 0);
  assert.strictEqual(audit.invalidProvenanceRejected, 0);
});

// ----------------------------------------------------------------------------
// PHASE 6C STEP 5 REMEDIATION: ELEMENT CONTEXT SAFETY TESTS (E1–E9)
// ----------------------------------------------------------------------------

test('E1. Fusion-specific fact + Fusion context succeeds', () => {
  const fact = createMockNormalizedFact({
    factId: 'changli|skill|DMG_AMPLIFY|SELF|FUSION_DAMAGE_PERCENT|Fusion|EXACT:20:PERCENT|NO_COND|NO_DUR|NO_STACKING',
    parameter: 'FUSION_DAMAGE_PERCENT',
    element: 'Fusion',
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    staticNumericValue: null,
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' }
  });

  const res = evaluateNormalizedFactWithContext(fact, { element: 'Fusion' });
  assert.strictEqual(res.consumable, true);
  assert.strictEqual(res.numericValue, 20);
  assert.strictEqual(res.reason, 'CONTEXT_SATISFIED');
});

test('E2. Fusion-specific fact + Glacio context fails closed', () => {
  const fact = createMockNormalizedFact({
    factId: 'changli|skill|DMG_AMPLIFY|SELF|FUSION_DAMAGE_PERCENT|Fusion|EXACT:20:PERCENT|NO_COND|NO_DUR|NO_STACKING',
    parameter: 'FUSION_DAMAGE_PERCENT',
    element: 'Fusion',
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    staticNumericValue: null,
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' }
  });

  const res = evaluateNormalizedFactWithContext(fact, { element: 'Glacio' });
  assert.strictEqual(res.consumable, false);
  assert.strictEqual(res.numericValue, null);
  assert.notStrictEqual(res.numericValue, 0);
  assert.strictEqual(res.reason, 'MISMATCHED_ELEMENT');
});

test('E3. Fusion-specific fact + missing element fails closed', () => {
  const fact = createMockNormalizedFact({
    factId: 'changli|skill|DMG_AMPLIFY|SELF|FUSION_DAMAGE_PERCENT|Fusion|EXACT:20:PERCENT|NO_COND|NO_DUR|NO_STACKING',
    parameter: 'FUSION_DAMAGE_PERCENT',
    element: 'Fusion',
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    staticNumericValue: null,
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' }
  });

  const resEmpty = evaluateNormalizedFactWithContext(fact, {});
  assert.strictEqual(resEmpty.consumable, false);
  assert.strictEqual(resEmpty.numericValue, null);
  assert.notStrictEqual(resEmpty.numericValue, 0);
  assert.strictEqual(resEmpty.reason, 'MISSING_ELEMENT');

  const resUndefined = evaluateNormalizedFactWithContext(fact, undefined);
  assert.strictEqual(resUndefined.consumable, false);
  assert.strictEqual(resUndefined.numericValue, null);
  assert.notStrictEqual(resUndefined.numericValue, 0);
  assert.strictEqual(resUndefined.reason, 'MISSING_ELEMENT');
});

test('E4. Glacio-specific fact + Fusion context fails closed', () => {
  const fact = createMockNormalizedFact({
    factId: 'sanhua|skill|DMG_AMPLIFY|SELF|GLACIO_DAMAGE_PERCENT|Glacio|EXACT:18:PERCENT|NO_COND|NO_DUR|NO_STACKING',
    parameter: 'GLACIO_DAMAGE_PERCENT',
    element: 'Glacio',
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    staticNumericValue: null,
    value: { type: 'EXACT', value: 18, unit: 'PERCENT' }
  });

  const res = evaluateNormalizedFactWithContext(fact, { element: 'Fusion' });
  assert.strictEqual(res.consumable, false);
  assert.strictEqual(res.numericValue, null);
  assert.notStrictEqual(res.numericValue, 0);
  assert.strictEqual(res.reason, 'MISMATCHED_ELEMENT');
});

test('E5. Element-independent fact does not incorrectly require element context', () => {
  const atkFact = createMockNormalizedFact({
    parameter: 'ATK_PERCENT',
    element: 'NONE',
    consumptionState: 'CONSUMABLE_STATIC',
    staticNumericValue: 25,
    value: { type: 'EXACT', value: 25, unit: 'PERCENT' }
  });

  // Evaluated without element context -> succeeds
  const resNoElem = evaluateNormalizedFactWithContext(atkFact, {});
  assert.strictEqual(resNoElem.consumable, true);
  assert.strictEqual(resNoElem.numericValue, 25);
  assert.strictEqual(resNoElem.reason, 'STATIC_ELIGIBLE');

  // Evaluated with element context -> still succeeds
  const resWithElem = evaluateNormalizedFactWithContext(atkFact, { element: 'Fusion' });
  assert.strictEqual(resWithElem.consumable, true);
  assert.strictEqual(resWithElem.numericValue, 25);
  assert.strictEqual(resWithElem.reason, 'STATIC_ELIGIBLE');
});

test('E6. All-element semantic fact follows its explicit semantics', () => {
  const allFact = createMockNormalizedFact({
    factId: 'rover|all_dmg|DMG_AMPLIFY|SELF|ALL_ATTRIBUTE_DAMAGE_PERCENT|All|EXACT:15:PERCENT|NO_COND|NO_DUR|NO_STACKING',
    parameter: 'ALL_ATTRIBUTE_DAMAGE_PERCENT',
    element: 'All',
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    staticNumericValue: null,
    value: { type: 'EXACT', value: 15, unit: 'PERCENT' }
  });

  // Resolves for Fusion
  const resFusion = evaluateNormalizedFactWithContext(allFact, { element: 'Fusion' });
  assert.strictEqual(resFusion.consumable, true);
  assert.strictEqual(resFusion.numericValue, 15);

  // Resolves for Glacio
  const resGlacio = evaluateNormalizedFactWithContext(allFact, { element: 'Glacio' });
  assert.strictEqual(resGlacio.consumable, true);
  assert.strictEqual(resGlacio.numericValue, 15);

  // Resolves for All
  const resAll = evaluateNormalizedFactWithContext(allFact, { element: 'All' });
  assert.strictEqual(resAll.consumable, true);
  assert.strictEqual(resAll.numericValue, 15);
});

test('E7. Element mismatch never returns numeric 0', () => {
  const fact = createMockNormalizedFact({
    parameter: 'FUSION_DAMAGE_PERCENT',
    element: 'Fusion',
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    staticNumericValue: null,
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' }
  });

  const res = evaluateNormalizedFactWithContext(fact, { element: 'Aero' });
  assert.strictEqual(res.numericValue, null);
  assert.notStrictEqual(res.numericValue, 0);
});

test('E8. Element mismatch returns deterministic reason code', () => {
  const fact = createMockNormalizedFact({
    parameter: 'FUSION_DAMAGE_PERCENT',
    element: 'Fusion',
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    staticNumericValue: null,
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' }
  });

  const resElectro = evaluateNormalizedFactWithContext(fact, { element: 'Electro' });
  assert.strictEqual(resElectro.reason, 'MISMATCHED_ELEMENT');

  const resSpectro = evaluateNormalizedFactWithContext(fact, { element: 'Spectro' });
  assert.strictEqual(resSpectro.reason, 'MISMATCHED_ELEMENT');

  const resMissing = evaluateNormalizedFactWithContext(fact, {});
  assert.strictEqual(resMissing.reason, 'MISSING_ELEMENT');
});

test('E9. Repeated element evaluation is deterministic', () => {
  const fact = createMockNormalizedFact({
    parameter: 'FUSION_DAMAGE_PERCENT',
    element: 'Fusion',
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    staticNumericValue: null,
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' }
  });

  const base = evaluateNormalizedFactWithContext(fact, { element: 'Fusion' });
  for (let i = 0; i < 10; i++) {
    const next = evaluateNormalizedFactWithContext(fact, { element: 'Fusion' });
    assert.deepStrictEqual(base, next);
  }
});

// ----------------------------------------------------------------------------
// PHASE 6C STEP 5 REMEDIATION: STACK COUNT SEMANTICS TESTS (S1–S8)
// ----------------------------------------------------------------------------

test('S1. Missing stack state fails closed', () => {
  const stackFact = createMockNormalizedFact({
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    condition: { stackCount: 3, stackOperator: 'AT_LEAST' },
    staticNumericValue: null,
    value: { type: 'EXACT', value: 30, unit: 'PERCENT' }
  });

  const resMissing = evaluateNormalizedFactWithContext(stackFact, {});
  assert.strictEqual(resMissing.consumable, false);
  assert.strictEqual(resMissing.numericValue, null);
  assert.notStrictEqual(resMissing.numericValue, 0);
  assert.strictEqual(resMissing.reason, 'MISSING_STACK_COUNT');
});

test('S2. Explicit valid stack state behaves exactly according to the canonical semantic meaning', () => {
  const stackFact = createMockNormalizedFact({
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    condition: { stackCount: 3, stackOperator: 'AT_LEAST' },
    staticNumericValue: null,
    value: { type: 'EXACT', value: 30, unit: 'PERCENT' }
  });

  const resValid = evaluateNormalizedFactWithContext(stackFact, { stackCount: 3 });
  assert.strictEqual(resValid.consumable, true);
  assert.strictEqual(resValid.numericValue, 30);
  assert.strictEqual(resValid.reason, 'CONTEXT_SATISFIED');
});

test('S3. Insufficient stack state fails when a minimum threshold is explicitly modeled', () => {
  const stackFact = createMockNormalizedFact({
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    condition: { stackCount: 3, stackOperator: 'AT_LEAST' },
    staticNumericValue: null,
    value: { type: 'EXACT', value: 30, unit: 'PERCENT' }
  });

  const resInsufficient = evaluateNormalizedFactWithContext(stackFact, { stackCount: 2 });
  assert.strictEqual(resInsufficient.consumable, false);
  assert.strictEqual(resInsufficient.numericValue, null);
  assert.strictEqual(resInsufficient.reason, 'INSUFFICIENT_STACKS');
});

test('S4. Exact-stack condition does not incorrectly behave as >=', () => {
  const exactFact = createMockNormalizedFact({
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    condition: { stackCount: 3, stackOperator: 'EXACT' },
    staticNumericValue: null,
    value: { type: 'EXACT', value: 30, unit: 'PERCENT' }
  });

  // stackCount = 4 (greater than 3) must NOT pass as >=
  const resGreater = evaluateNormalizedFactWithContext(exactFact, { stackCount: 4 });
  assert.strictEqual(resGreater.consumable, false);
  assert.strictEqual(resGreater.numericValue, null);
  assert.strictEqual(resGreater.reason, 'MISMATCHED_STACK_COUNT');

  // stackCount = 3 passes exactly
  const resExact = evaluateNormalizedFactWithContext(exactFact, { stackCount: 3 });
  assert.strictEqual(resExact.consumable, true);
  assert.strictEqual(resExact.numericValue, 30);
  assert.strictEqual(resExact.reason, 'CONTEXT_SATISFIED');
});

test('S5. Per-stack semantics are not incorrectly interpreted as activation threshold', () => {
  const perStackFact = createMockNormalizedFact({
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    condition: { stackCount: 1, stackOperator: 'PER_STACK' },
    staticNumericValue: null,
    value: { type: 'EXACT', value: 5, unit: 'PERCENT' }
  });

  const resPerStack = evaluateNormalizedFactWithContext(perStackFact, { stackCount: 3 });
  assert.strictEqual(resPerStack.consumable, false);
  assert.strictEqual(resPerStack.numericValue, null);
  assert.strictEqual(resPerStack.reason, 'UNRESOLVED_STACK_SCALING');
});

test('S6. Unsupported/ambiguous stack semantics remain null', () => {
  const ambiguousFact = createMockNormalizedFact({
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    condition: { stackCount: 3 }, // NO stackOperator!
    staticNumericValue: null,
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' }
  });

  const resAmbiguous = evaluateNormalizedFactWithContext(ambiguousFact, { stackCount: 3 });
  assert.strictEqual(resAmbiguous.consumable, false);
  assert.strictEqual(resAmbiguous.numericValue, null);
  assert.strictEqual(resAmbiguous.reason, 'UNRESOLVED_STACK_SEMANTICS');
});

test('S7. Stack evaluation never falls back to zero', () => {
  const stackFact = createMockNormalizedFact({
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    condition: { stackCount: 3, stackOperator: 'AT_LEAST' },
    staticNumericValue: null,
    value: { type: 'EXACT', value: 30, unit: 'PERCENT' }
  });

  const resZero = evaluateNormalizedFactWithContext(stackFact, { stackCount: 0 });
  assert.strictEqual(resZero.consumable, false);
  assert.strictEqual(resZero.numericValue, null);
  assert.notStrictEqual(resZero.numericValue, 0);
});

test('S8. Stack evaluation is deterministic', () => {
  const stackFact = createMockNormalizedFact({
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    condition: { stackCount: 3, stackOperator: 'AT_LEAST' },
    staticNumericValue: null,
    value: { type: 'EXACT', value: 30, unit: 'PERCENT' }
  });

  const baseStack = evaluateNormalizedFactWithContext(stackFact, { stackCount: 3 });
  for (let i = 0; i < 10; i++) {
    const nextStack = evaluateNormalizedFactWithContext(stackFact, { stackCount: 3 });
    assert.deepStrictEqual(baseStack, nextStack);
  }
});
