/**
 * Wuthering Waves Engine Fact Aggregation & Query Layer Tests
 * Phase 6C Step 6: Engine Fact Aggregation & Semantic Consumption API
 *
 * Comprehensive regression tests for query filtering, canonical ordering,
 * grouping, context-aware querying, consumable-only extraction, diagnostics,
 * trust boundary validation, immutability, and production dataset reconciliation (Q1–Q35).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  queryEngineFacts,
  queryStaticFacts,
  queryContextualFacts,
  queryUnmodeledFacts,
  queryUnknownFacts,
  queryNotApplicableFacts,
  groupByEntity,
  groupByParameter,
  groupByCategory,
  groupByTarget,
  groupByElement,
  groupByConsumptionState,
  queryEngineFactsWithContext,
  getConsumableNumericFacts,
  diagnoseEngineFacts,
  auditProductionEngineFactQueries,
  matchesFilter,
  compareCanonicalFacts,
  sortCanonicalFacts,
  validateFactCollection,
  type EngineFactFilter
} from '../lib/engine/facts/query/index.ts';
import { runProductionFactNormalizationAudit } from '../lib/engine/facts/normalizer.ts';
import type { NormalizedEngineFact } from '../lib/engine/facts/types.ts';
import { PARSER_VERSION } from '../lib/semantics/parser.ts';

function createMockFact(overrides: Partial<NormalizedEngineFact> = {}): NormalizedEngineFact {
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
// PHASE 6C STEP 6: QUERY & AGGREGATION INVARIANTS (Q1–Q35)
// ----------------------------------------------------------------------------

test('Q1. Empty filter returns all valid patch-scoped facts', () => {
  const audit = runProductionFactNormalizationAudit();
  const results = queryEngineFacts(audit.facts);

  assert.strictEqual(results.length, 292);
  for (const f of results) {
    assert.strictEqual(f.patchVersion, '3.7');
  }
});

test('Q2. entityId filter works (single and multi-value)', () => {
  const audit = runProductionFactNormalizationAudit();

  const single = queryEngineFacts(audit.facts, { entityId: 'Changli' });
  assert.strictEqual(single.length, 5);
  for (const f of single) {
    assert.strictEqual(f.entityId, 'Changli');
  }

  const multi = queryEngineFacts(audit.facts, { entityId: ['Changli', 'Jiyan'] });
  assert.strictEqual(multi.length, 12);
  for (const f of multi) {
    assert.ok(f.entityId === 'Changli' || f.entityId === 'Jiyan');
  }
});

test('Q3. sourceCode filter works', () => {
  const audit = runProductionFactNormalizationAudit();
  const outroSkills = queryEngineFacts(audit.facts, { sourceCode: 'OUTRO_SKILL' });

  assert.ok(outroSkills.length > 0);
  for (const f of outroSkills) {
    assert.strictEqual(f.sourceCode, 'OUTRO_SKILL');
  }
});

test('Q4. parameter filter works', () => {
  const audit = runProductionFactNormalizationAudit();
  const critRate = queryEngineFacts(audit.facts, { parameter: 'CRIT_RATE_PERCENT' });

  assert.strictEqual(critRate.length, 20);
  for (const f of critRate) {
    assert.strictEqual(f.parameter, 'CRIT_RATE_PERCENT');
  }
});

test('Q5. category filter works', () => {
  const audit = runProductionFactNormalizationAudit();
  const dmgAmplify = queryEngineFacts(audit.facts, { category: 'DMG_AMPLIFY' });

  assert.strictEqual(dmgAmplify.length, 135);
  for (const f of dmgAmplify) {
    assert.strictEqual(f.category, 'DMG_AMPLIFY');
  }
});

test('Q6. target filter works', () => {
  const audit = runProductionFactNormalizationAudit();
  const teamBuffs = queryEngineFacts(audit.facts, { target: 'TEAM' });

  assert.strictEqual(teamBuffs.length, 60);
  for (const f of teamBuffs) {
    assert.strictEqual(f.target, 'TEAM');
  }
});

test('Q7. element filter works', () => {
  const audit = runProductionFactNormalizationAudit();
  const fusionEffects = queryEngineFacts(audit.facts, { element: 'Fusion' });

  assert.strictEqual(fusionEffects.length, 12);
  for (const f of fusionEffects) {
    assert.strictEqual(f.element, 'Fusion');
  }
});

test('Q8. consumptionState filter works and shorthand queries match', () => {
  const audit = runProductionFactNormalizationAudit();

  const staticFacts = queryStaticFacts(audit.facts);
  assert.strictEqual(staticFacts.length, 90);
  for (const f of staticFacts) {
    assert.strictEqual(f.consumptionState, 'CONSUMABLE_STATIC');
  }

  const contextualFacts = queryContextualFacts(audit.facts);
  assert.strictEqual(contextualFacts.length, 200);
  for (const f of contextualFacts) {
    assert.strictEqual(f.consumptionState, 'CONSUMABLE_CONTEXTUAL');
  }

  const unmodeledFacts = queryUnmodeledFacts(audit.facts);
  assert.strictEqual(unmodeledFacts.length, 2);
  for (const f of unmodeledFacts) {
    assert.strictEqual(f.consumptionState, 'UNMODELED');
  }

  const unknownFacts = queryUnknownFacts(audit.facts);
  assert.strictEqual(unknownFacts.length, 0);

  const naFacts = queryNotApplicableFacts(audit.facts);
  assert.strictEqual(naFacts.length, 0);
});

test('Q9. semanticStatus filter works', () => {
  const audit = runProductionFactNormalizationAudit();
  const safeExplicit = queryEngineFacts(audit.facts, { semanticStatus: 'SAFE_EXPLICIT' });

  assert.strictEqual(safeExplicit.length, 290);
  for (const f of safeExplicit) {
    assert.strictEqual(f.semanticStatus, 'SAFE_EXPLICIT');
  }
});

test('Q10. parameterSafety filter works', () => {
  const audit = runProductionFactNormalizationAudit();
  const directFacts = queryEngineFacts(audit.facts, { parameterSafety: 'DIRECT_ENGINE_FACT' });

  assert.strictEqual(directFacts.length, 217);
  for (const f of directFacts) {
    assert.strictEqual(f.parameterSafety, 'DIRECT_ENGINE_FACT');
  }

  const requiresContext = queryEngineFacts(audit.facts, { parameterSafety: 'REQUIRES_CONTEXT' });
  assert.strictEqual(requiresContext.length, 73);
});

test('Q11. patchVersion filter strictly scopes to requested patch', () => {
  const audit = runProductionFactNormalizationAudit();

  const patch37 = queryEngineFacts(audit.facts, { patchVersion: '3.7' });
  assert.strictEqual(patch37.length, 292);

  // Attempting to filter for non-3.7 patch against 3.7 collection fails trust gate
  assert.throws(() => {
    queryEngineFacts(audit.facts, { patchVersion: '3.6' });
  }, /Cross-patch fact rejected/);
});

test('Q12. Multiple filters use strict AND semantics', () => {
  const audit = runProductionFactNormalizationAudit();

  // ATK_PERCENT AND target = TEAM AND element = NONE
  const teamAtkBuffs = queryEngineFacts(audit.facts, {
    parameter: 'ATK_PERCENT',
    target: 'TEAM',
    element: 'NONE'
  });

  assert.ok(teamAtkBuffs.length > 0);
  for (const f of teamAtkBuffs) {
    assert.strictEqual(f.parameter, 'ATK_PERCENT');
    assert.strictEqual(f.target, 'TEAM');
    assert.strictEqual(f.element, 'NONE');
  }
});

test('Q13. Query results have deterministic ordering', () => {
  const audit = runProductionFactNormalizationAudit();
  const results = queryEngineFacts(audit.facts);

  for (let i = 0; i < results.length - 1; i++) {
    const current = results[i];
    const next = results[i + 1];
    assert.ok(
      current.factId.localeCompare(next.factId) <= 0,
      `Ordering violation: ${current.factId} should precede ${next.factId}`
    );
  }
});

test('Q14. Same query repeated 10 times returns identical results', () => {
  const audit = runProductionFactNormalizationAudit();
  const filter: EngineFactFilter = { target: 'TEAM', category: 'STAT_BUFF' };

  const base = queryEngineFacts(audit.facts, filter);
  for (let i = 0; i < 10; i++) {
    const current = queryEngineFacts(audit.facts, filter);
    assert.deepStrictEqual(base, current);
  }
});

test('Q15. Group-by-entity reconciles all 292 facts', () => {
  const audit = runProductionFactNormalizationAudit();
  const grouped = groupByEntity(audit.facts);

  let totalCount = 0;
  for (const [, facts] of grouped.entries()) {
    totalCount += facts.length;
  }
  assert.strictEqual(totalCount, 292);

  // Verify group key ordering is deterministic
  const keys = Array.from(grouped.keys());
  const sortedKeys = [...keys].sort((a, b) => a.localeCompare(b));
  assert.deepStrictEqual(keys, sortedKeys);
});

test('Q16. Group-by-parameter reconciles all 292 facts', () => {
  const audit = runProductionFactNormalizationAudit();
  const grouped = groupByParameter(audit.facts);

  let totalCount = 0;
  for (const [, facts] of grouped.entries()) {
    totalCount += facts.length;
  }
  assert.strictEqual(totalCount, 292);
  assert.strictEqual(grouped.get('ATK_PERCENT')?.length, 79);
});

test('Q17. Group-by-category reconciles all 292 facts', () => {
  const audit = runProductionFactNormalizationAudit();
  const grouped = groupByCategory(audit.facts);

  let totalCount = 0;
  for (const [, facts] of grouped.entries()) {
    totalCount += facts.length;
  }
  assert.strictEqual(totalCount, 292);
  assert.strictEqual(grouped.get('DMG_AMPLIFY')?.length, 135);
  assert.strictEqual(grouped.get('STAT_BUFF')?.length, 149);
});

test('Q18. Group-by-target reconciles all 292 facts', () => {
  const audit = runProductionFactNormalizationAudit();
  const grouped = groupByTarget(audit.facts);

  let totalCount = 0;
  for (const [, facts] of grouped.entries()) {
    totalCount += facts.length;
  }
  assert.strictEqual(totalCount, 292);
  assert.strictEqual(grouped.get('SELF')?.length, 179);
  assert.strictEqual(grouped.get('TEAM')?.length, 60);
  assert.strictEqual(grouped.get('NEXT_RESONATOR')?.length, 29);
  assert.strictEqual(grouped.get('ACTIVE_CHARACTER')?.length, 24);
});

test('Q19. Group-by-element reconciles all 292 facts', () => {
  const audit = runProductionFactNormalizationAudit();
  const grouped = groupByElement(audit.facts);

  let totalCount = 0;
  for (const [, facts] of grouped.entries()) {
    totalCount += facts.length;
  }
  assert.strictEqual(totalCount, 292);
  assert.strictEqual(grouped.get('NONE')?.length, 230);
  assert.strictEqual(grouped.get('All')?.length, 18);
  assert.strictEqual(grouped.get('Fusion')?.length, 12);
});

test('Q20. Group-by-consumption-state reconciles all 292 facts', () => {
  const audit = runProductionFactNormalizationAudit();
  const grouped = groupByConsumptionState(audit.facts);

  assert.strictEqual(grouped.get('CONSUMABLE_STATIC')?.length, 90);
  assert.strictEqual(grouped.get('CONSUMABLE_CONTEXTUAL')?.length, 200);
  assert.strictEqual(grouped.get('UNMODELED')?.length, 2);
  assert.strictEqual(grouped.get('UNKNOWN'), undefined);
  assert.strictEqual(grouped.get('NOT_APPLICABLE'), undefined);
});

test('Q21. Contextual query delegates to approved evaluator', () => {
  const fact = createMockFact({
    parameter: 'BASIC_ATTACK_DAMAGE_PERCENT',
    parameterSafety: 'REQUIRES_CONTEXT',
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    staticNumericValue: null,
    value: { type: 'EXACT', value: 25, unit: 'PERCENT' }
  });

  const resMatching = queryEngineFactsWithContext([fact], undefined, { actionType: 'BASIC_ATTACK' });
  assert.strictEqual(resMatching.length, 1);
  assert.strictEqual(resMatching[0].consumable, true);
  assert.strictEqual(resMatching[0].numericValue, 25);

  const resMismatched = queryEngineFactsWithContext([fact], undefined, { actionType: 'RESONANCE_SKILL' });
  assert.strictEqual(resMismatched.length, 1);
  assert.strictEqual(resMismatched[0].consumable, false);
  assert.strictEqual(resMismatched[0].reason, 'MISMATCHED_ACTION');
});

test('Q22. Contextual query never converts null to zero', () => {
  const fact = createMockFact({
    parameter: 'BASIC_ATTACK_DAMAGE_PERCENT',
    parameterSafety: 'REQUIRES_CONTEXT',
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    staticNumericValue: null
  });

  const res = queryEngineFactsWithContext([fact], undefined, {});
  assert.strictEqual(res[0].consumable, false);
  assert.strictEqual(res[0].numericValue, null);
  assert.notStrictEqual(res[0].numericValue, 0);
});

test('Q23. Consumable-only API excludes unresolved facts', () => {
  const staticFact = createMockFact({
    factId: 'f1_static',
    parameter: 'ATK_PERCENT',
    consumptionState: 'CONSUMABLE_STATIC',
    staticNumericValue: 15
  });
  const contextualFact = createMockFact({
    factId: 'f2_contextual',
    parameter: 'BASIC_ATTACK_DAMAGE_PERCENT',
    parameterSafety: 'REQUIRES_CONTEXT',
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    staticNumericValue: null,
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' }
  });

  // Without action context: contextual fact is excluded from consumable-only results
  const noContextConsumable = getConsumableNumericFacts([staticFact, contextualFact], {});
  assert.strictEqual(noContextConsumable.length, 1);
  assert.strictEqual(noContextConsumable[0].factId, 'f1_static');
  assert.strictEqual(noContextConsumable[0].numericValue, 15);

  // With action context: both resolve
  const withContextConsumable = getConsumableNumericFacts(
    [staticFact, contextualFact],
    { actionType: 'BASIC_ATTACK' }
  );
  assert.strictEqual(withContextConsumable.length, 2);
  assert.strictEqual(withContextConsumable[0].numericValue, 15);
  assert.strictEqual(withContextConsumable[1].numericValue, 20);
});

test('Q24. Diagnostic API preserves exact evaluation reason', () => {
  const fact = createMockFact({
    parameter: 'FUSION_DAMAGE_PERCENT',
    element: 'Fusion',
    consumptionState: 'CONSUMABLE_CONTEXTUAL',
    staticNumericValue: null,
    value: { type: 'EXACT', value: 12, unit: 'PERCENT' }
  });

  const diag = diagnoseEngineFacts([fact], { element: 'Glacio' });
  assert.strictEqual(diag.length, 1);
  assert.strictEqual(diag[0].consumable, false);
  assert.strictEqual(diag[0].reason, 'MISMATCHED_ELEMENT');
  assert.strictEqual(diag[0].numericValue, null);
});

test('Q25. Duplicate factId input is detected and rejected at trust boundary', () => {
  const fact1 = createMockFact({ factId: 'duplicate_id_test' });
  const fact2 = createMockFact({ factId: 'duplicate_id_test' });

  assert.throws(() => {
    queryEngineFacts([fact1, fact2]);
  }, /Duplicate factId detected/);
});

test('Q26. Cross-patch input is rejected at trust boundary', () => {
  const crossPatchFact = createMockFact({ patchVersion: '3.6' });

  assert.throws(() => {
    queryEngineFacts([crossPatchFact]);
  }, /Cross-patch fact rejected/);
});

test('Q27. Source facts are not mutated by querying or grouping', () => {
  const fact = createMockFact();
  const snapshot = JSON.stringify(fact);

  queryEngineFacts([fact]);
  groupByEntity([fact]);
  getConsumableNumericFacts([fact]);

  assert.strictEqual(JSON.stringify(fact), snapshot, 'Source fact must remain completely unmodified');
});

test('Q28. Nested semantic metadata is preserved intact', () => {
  const fact = createMockFact({
    duration: { durationSeconds: 12, removeOnSwap: true },
    stacking: { maxStacks: 4, durationPerStackSeconds: 6 }
  });

  const results = queryEngineFacts([fact]);
  assert.strictEqual(results[0].duration?.durationSeconds, 12);
  assert.strictEqual(results[0].duration?.removeOnSwap, true);
  assert.strictEqual(results[0].stacking?.maxStacks, 4);
});

test('Q29. Numeric aggregation does NOT occur (no totals calculated)', () => {
  const fact1 = createMockFact({ factId: 'f1', staticNumericValue: 10 });
  const fact2 = createMockFact({ factId: 'f2', staticNumericValue: 20 });

  const queryResult = queryEngineFacts([fact1, fact2]);
  // Query returns array of facts; no total property exists
  assert.strictEqual((queryResult as any).total, undefined);
  assert.strictEqual((queryResult as any).sum, undefined);
  assert.strictEqual((queryResult as any).average, undefined);
});

test('Q30. Canonical factId is preserved and never regenerated', () => {
  const fact = createMockFact({ factId: 'canonical_step2_signature_id' });
  const queryResult = queryEngineFacts([fact]);

  assert.strictEqual(queryResult[0].factId, 'canonical_step2_signature_id');
});

test('Q31. Same fact + same context produces identical evaluation result', () => {
  const fact = createMockFact();
  const context = { actionType: 'BASIC_ATTACK' as const };

  const r1 = queryEngineFactsWithContext([fact], undefined, context);
  const r2 = queryEngineFactsWithContext([fact], undefined, context);

  assert.deepStrictEqual(r1, r2);
});

test('Q32. Invalid provenance cannot enter trusted query results', () => {
  const invalidFact = createMockFact({
    provenance: { entityId: '', sourceProvenance: '' } as any
  });

  assert.throws(() => {
    queryEngineFacts([invalidFact]);
  }, /Invalid provenance/);
});

test('Q33. Unmodeled facts remain unmodeled and return null', () => {
  const unmodeled = createMockFact({
    consumptionState: 'UNMODELED',
    semanticStatus: 'UNMODELED',
    parameter: 'FORTE_RESOURCE',
    parameterSafety: 'CURRENTLY_UNMODELED',
    staticNumericValue: null
  });

  const res = queryEngineFactsWithContext([unmodeled], undefined, { actionType: 'BASIC_ATTACK' });
  assert.strictEqual(res[0].consumable, false);
  assert.strictEqual(res[0].numericValue, null);
  assert.strictEqual(res[0].state, 'UNMODELED');

  const consumableOnly = getConsumableNumericFacts([unmodeled]);
  assert.strictEqual(consumableOnly.length, 0, 'Unmodeled fact must never appear in consumable numeric facts');
});

test('Q34. UNKNOWN remains UNKNOWN and returns null', () => {
  const unknownFact = createMockFact({
    consumptionState: 'UNKNOWN',
    semanticStatus: 'UNKNOWN',
    staticNumericValue: null
  });

  const res = queryEngineFactsWithContext([unknownFact], undefined, {});
  assert.strictEqual(res[0].consumable, false);
  assert.strictEqual(res[0].numericValue, null);
  assert.strictEqual(res[0].state, 'UNKNOWN');
});

test('Q35. NOT_APPLICABLE remains NOT_APPLICABLE and returns null', () => {
  const naFact = createMockFact({
    consumptionState: 'NOT_APPLICABLE',
    semanticStatus: 'NOT_APPLICABLE',
    staticNumericValue: null
  });

  const res = queryEngineFactsWithContext([naFact], undefined, {});
  assert.strictEqual(res[0].consumable, false);
  assert.strictEqual(res[0].numericValue, null);
  assert.strictEqual(res[0].state, 'NOT_APPLICABLE');
});

test('Q36. Production query audit reconciles across all dimensions to exactly 292', () => {
  const metrics = auditProductionEngineFactQueries();

  assert.strictEqual(metrics.totalFacts, 292);

  const sumValues = (record: Record<string, number>) =>
    Object.values(record).reduce((sum, v) => sum + v, 0);

  assert.strictEqual(sumValues(metrics.byEntity), 292);
  assert.strictEqual(sumValues(metrics.byParameter), 292);
  assert.strictEqual(sumValues(metrics.byCategory), 292);
  assert.strictEqual(sumValues(metrics.byTarget), 292);
  assert.strictEqual(sumValues(metrics.byElement), 292);
  assert.strictEqual(sumValues(metrics.byConsumptionState), 292);
  assert.strictEqual(sumValues(metrics.byParameterSafety), 292);

  // Target distribution reconciliation
  assert.strictEqual(metrics.byTarget.SELF, 179);
  assert.strictEqual(metrics.byTarget.TEAM, 60);
  assert.strictEqual(metrics.byTarget.NEXT_RESONATOR, 29);
  assert.strictEqual(metrics.byTarget.ACTIVE_CHARACTER, 24);

  // Consumption state reconciliation
  assert.strictEqual(metrics.byConsumptionState.CONSUMABLE_STATIC, 90);
  assert.strictEqual(metrics.byConsumptionState.CONSUMABLE_CONTEXTUAL, 200);
  assert.strictEqual(metrics.byConsumptionState.UNMODELED, 2);

  // Parameter safety reconciliation
  assert.strictEqual(metrics.byParameterSafety.DIRECT_ENGINE_FACT, 217);
  assert.strictEqual(metrics.byParameterSafety.REQUIRES_CONTEXT, 73);
  assert.strictEqual(metrics.byParameterSafety.CURRENTLY_UNMODELED, 2);

  // Element breakdown reconciliation
  assert.strictEqual(metrics.byElement.NONE, 230);
  assert.strictEqual(metrics.byElement.All, 18);
  assert.strictEqual(metrics.byElement.Fusion, 12);
  assert.strictEqual(metrics.byElement.Havoc, 9);
  assert.strictEqual(metrics.byElement.Electro, 8);
  assert.strictEqual(metrics.byElement.Aero, 7);
  assert.strictEqual(metrics.byElement.Spectro, 6);
  assert.strictEqual(metrics.byElement.Glacio, 2);
});
