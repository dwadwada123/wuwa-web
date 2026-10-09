import test from 'node:test';
import assert from 'node:assert/strict';
import { runProductionSemanticsAudit } from '../scripts/production-semantics-audit.ts';
import { extractSemantics, PARSER_VERSION } from '../lib/semantics/parser.ts';
import { PRODUCTION_SEMANTIC_FIXTURES } from './fixtures/production-semantic-fixtures.ts';
import { isSemanticParameter, computeSemanticSignature } from '../lib/semantics/taxonomy.ts';
import type { SemanticEffect } from '../lib/domain/types/semantics.ts';

// ----------------------------------------------------------------------------
// PHASE 6C STEP 2: PRODUCTION GAMEPLAY SEMANTICS EXTRACTION & COVERAGE AUDIT
// ----------------------------------------------------------------------------

test('1. Complete production extraction covers all 976 Patch 3.7 gameplay descriptions', () => {
  const report = runProductionSemanticsAudit();

  assert.strictEqual(report.totals.descriptionsAudited, 976);
  assert.strictEqual(report.totals.byType.abilities, 539);
  assert.strictEqual(report.totals.byType.sequences, 360);
  assert.strictEqual(report.totals.byType.weapons, 66);
  assert.strictEqual(report.totals.byType.areaEffects, 11);

  assert.strictEqual(report.totals.totalSemanticEffectsExtracted, 292);
  assert.strictEqual(report.totals.byStatus.COMPLETE, 133);
  assert.strictEqual(report.totals.byStatus.PARTIAL, 133);
  assert.strictEqual(report.totals.byStatus.UNRESOLVED, 337);
  assert.strictEqual(report.totals.byStatus.UNSUPPORTED, 373);
});

test('2. Sequence node coverage audits all 360 sequence nodes across S1-S6', () => {
  const report = runProductionSemanticsAudit();
  const seq = report.totals.bySequenceNode;

  for (const node of ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'] as const) {
    assert.strictEqual(seq[node].total, 60, `Sequence ${node} should have exactly 60 nodes`);
    const sum = seq[node].COMPLETE + seq[node].PARTIAL + seq[node].UNRESOLVED + seq[node].UNSUPPORTED;
    assert.strictEqual(sum, 60, `Sequence ${node} status sum should equal 60`);
  }

  assert.strictEqual(seq.S1.COMPLETE, 11);
  assert.strictEqual(seq.S1.PARTIAL, 10);
  assert.strictEqual(seq.S1.UNRESOLVED, 29);
  assert.strictEqual(seq.S1.UNSUPPORTED, 10);

  assert.strictEqual(seq.S2.COMPLETE, 8);
  assert.strictEqual(seq.S2.PARTIAL, 15);
  assert.strictEqual(seq.S2.UNRESOLVED, 21);
  assert.strictEqual(seq.S2.UNSUPPORTED, 16);

  assert.strictEqual(seq.S3.COMPLETE, 8);
  assert.strictEqual(seq.S3.PARTIAL, 12);
  assert.strictEqual(seq.S3.UNRESOLVED, 32);
  assert.strictEqual(seq.S3.UNSUPPORTED, 8);

  assert.strictEqual(seq.S4.COMPLETE, 25);
  assert.strictEqual(seq.S4.PARTIAL, 2);
  assert.strictEqual(seq.S4.UNRESOLVED, 29);
  assert.strictEqual(seq.S4.UNSUPPORTED, 4);

  assert.strictEqual(seq.S5.COMPLETE, 10);
  assert.strictEqual(seq.S5.PARTIAL, 6);
  assert.strictEqual(seq.S5.UNRESOLVED, 42);
  assert.strictEqual(seq.S5.UNSUPPORTED, 2);

  assert.strictEqual(seq.S6.COMPLETE, 10);
  assert.strictEqual(seq.S6.PARTIAL, 13);
  assert.strictEqual(seq.S6.UNRESOLVED, 37);
  assert.strictEqual(seq.S6.UNSUPPORTED, 0);

  // Sequences total
  const totalSeqComplete =
    seq.S1.COMPLETE + seq.S2.COMPLETE + seq.S3.COMPLETE + seq.S4.COMPLETE + seq.S5.COMPLETE + seq.S6.COMPLETE;
  const totalSeqPartial =
    seq.S1.PARTIAL + seq.S2.PARTIAL + seq.S3.PARTIAL + seq.S4.PARTIAL + seq.S5.PARTIAL + seq.S6.PARTIAL;
  const totalSeqUnresolved =
    seq.S1.UNRESOLVED + seq.S2.UNRESOLVED + seq.S3.UNRESOLVED + seq.S4.UNRESOLVED + seq.S5.UNRESOLVED + seq.S6.UNRESOLVED;
  const totalSeqUnsupported =
    seq.S1.UNSUPPORTED + seq.S2.UNSUPPORTED + seq.S3.UNSUPPORTED + seq.S4.UNSUPPORTED + seq.S5.UNSUPPORTED + seq.S6.UNSUPPORTED;

  assert.strictEqual(totalSeqComplete, 72);
  assert.strictEqual(totalSeqPartial, 58);
  assert.strictEqual(totalSeqUnresolved, 190);
  assert.strictEqual(totalSeqUnsupported, 40);
  assert.strictEqual(totalSeqComplete + totalSeqPartial + totalSeqUnresolved + totalSeqUnsupported, 360);
});

test('3. Weapon passives and area effects coverage audits', () => {
  const report = runProductionSemanticsAudit();

  const weaponRecords = report.records.filter((r) => r.entityType === 'WEAPON_PASSIVE');
  assert.strictEqual(weaponRecords.length, 66);

  const areaRecords = report.records.filter((r) => r.entityType === 'AREA_EFFECT');
  assert.strictEqual(areaRecords.length, 11);
});

test('4. Zero critical false-positives: damage formula ratios and scaling multipliers are not parsed as stat buffs', () => {
  // Test Luuk Herssen canonical outro text
  const luukResult = extractSemantics("Deal Spectro DMG equal to 500% of Luuk Herssen's ATK.", {
    entityId: 'Luuk Herssen',
    sourceCode: 'OUTRO_SKILL',
    patchVersion: '3.7'
  });
  assert.strictEqual(luukResult.status, 'UNRESOLVED');
  assert.strictEqual(luukResult.effects.length, 0);

  // Test heal scaling phrase
  const healRatioResult = extractSemantics('Restores HP to all team members equal to 120% of ATK.', {
    entityId: 'test_healer',
    sourceCode: 'RESONANCE_LIBERATION',
    patchVersion: '3.7'
  });
  assert.strictEqual(healRatioResult.status, 'UNRESOLVED');
  assert.strictEqual(healRatioResult.effects.length, 0);

  // Test damage scaling phrase
  const dmgRatioResult = extractSemantics('Deals Fusion DMG by 350% of DEF to target.', {
    entityId: 'test_subdps',
    sourceCode: 'RESONANCE_SKILL',
    patchVersion: '3.7'
  });
  assert.strictEqual(dmgRatioResult.status, 'UNRESOLVED');
  assert.strictEqual(dmgRatioResult.effects.length, 0);
});

test('5. Duplicate detection & semantic identity: zero accidental duplicate effects across all records', () => {
  const report = runProductionSemanticsAudit();

  assert.strictEqual(report.totals.duplicateAudit.accidentalDuplicates, 0);
  assert.strictEqual(report.totals.duplicateAudit.totalUniqueIds, 292);
  assert.strictEqual(report.totals.duplicateAudit.legitimateDistinctEffects, 292);
});

test('6. Range and value consistency: all numeric effects are valid and non-zero', () => {
  const report = runProductionSemanticsAudit();

  for (const rec of report.records) {
    for (const eff of rec.result.effects) {
      if (eff.value.type === 'EXACT') {
        assert.ok(
          typeof eff.value.value === 'number' && !isNaN(eff.value.value) && eff.value.value !== 0,
          `Exact value must be non-zero in ${rec.entityId}`
        );
        assert.ok(
          eff.value.unit === 'PERCENT' || eff.value.unit === 'FLAT' || eff.value.unit === 'CHARGES' || eff.value.unit === 'SECONDS',
          `Unit must be valid in ${rec.entityId}`
        );
      } else if (eff.value.type === 'RANGE') {
        assert.ok(eff.value.min <= eff.value.max, `Range min must be <= max in ${rec.entityId}`);
      }
    }
  }
});

test('7. Duration and Swap removal validation', () => {
  const report = runProductionSemanticsAudit();

  assert.strictEqual(report.totals.durationCount, 192);
  assert.strictEqual(report.totals.swapRemovalCount, 32);

  for (const rec of report.records) {
    for (const eff of rec.result.effects) {
      if (eff.duration?.durationSeconds !== undefined) {
        assert.ok(eff.duration.durationSeconds >= 0, `Duration must be >= 0 in ${rec.entityId}`);
      }
    }
  }
});

test('8. Target taxonomy validation', () => {
  const report = runProductionSemanticsAudit();
  const validTargets = new Set(['SELF', 'NEXT_RESONATOR', 'TEAM', 'ACTIVE_CHARACTER', 'ENEMY']);

  for (const [target, count] of Object.entries(report.totals.targetCounts)) {
    assert.ok(validTargets.has(target), `Target ${target} is invalid`);
    assert.ok(count > 0, `Target count for ${target} must be positive`);
  }

  assert.strictEqual(report.totals.targetCounts.SELF, 179);
  assert.strictEqual(report.totals.targetCounts.TEAM, 60);
  assert.strictEqual(report.totals.targetCounts.NEXT_RESONATOR, 29);
  assert.strictEqual(report.totals.targetCounts.ACTIVE_CHARACTER, 24);
});

test('9. Parameter taxonomy validation', () => {
  const report = runProductionSemanticsAudit();

  for (const [param, count] of Object.entries(report.totals.parameterCounts)) {
    assert.ok(isSemanticParameter(param), `Parameter ${param} must belong to SemanticParameter taxonomy`);
    assert.ok(count > 0, `Parameter count for ${param} must be > 0`);
  }
});

test('10. Production golden fixtures: all 6 canonical Patch 3.7 fixtures match expected semantics', () => {
  for (const [key, fixture] of Object.entries(PRODUCTION_SEMANTIC_FIXTURES)) {
    const result = extractSemantics(fixture.inputRawText, fixture.context);

    assert.strictEqual(
      result.status,
      fixture.expectedStatus,
      `Fixture ${key} (${fixture.name}) status mismatch: got ${result.status}, expected ${fixture.expectedStatus}`
    );

    assert.strictEqual(
      result.effects.length,
      fixture.expectedEffectCount,
      `Fixture ${key} (${fixture.name}) effect count mismatch: got ${result.effects.length}, expected ${fixture.expectedEffectCount}`
    );

    for (let i = 0; i < fixture.expectedParameters.length; i++) {
      assert.strictEqual(
        result.effects[i].parameter,
        fixture.expectedParameters[i],
        `Fixture ${key} parameter mismatch at index ${i}`
      );
    }

    for (let i = 0; i < fixture.expectedTargets.length; i++) {
      assert.strictEqual(
        result.effects[i].target,
        fixture.expectedTargets[i],
        `Fixture ${key} target mismatch at index ${i}`
      );
    }

    if (fixture.expectedDurations) {
      for (let i = 0; i < fixture.expectedDurations.length; i++) {
        assert.strictEqual(
          result.effects[i].duration?.durationSeconds,
          fixture.expectedDurations[i],
          `Fixture ${key} duration mismatch at index ${i}`
        );
      }
    }

    if (fixture.expectedRemoveOnSwap) {
      for (let i = 0; i < fixture.expectedRemoveOnSwap.length; i++) {
        assert.strictEqual(
          Boolean(result.effects[i].duration?.removeOnSwap),
          fixture.expectedRemoveOnSwap[i],
          `Fixture ${key} removeOnSwap mismatch at index ${i}`
        );
      }
    }
  }
});

test('11. Deterministic reproducibility: rerun produces identical output without deviation', () => {
  const report1 = runProductionSemanticsAudit();
  const report2 = runProductionSemanticsAudit();

  assert.strictEqual(report1.totals.descriptionsAudited, report2.totals.descriptionsAudited);
  assert.strictEqual(report1.totals.totalSemanticEffectsExtracted, report2.totals.totalSemanticEffectsExtracted);
  assert.deepStrictEqual(report1.totals.byStatus, report2.totals.byStatus);
  assert.deepStrictEqual(report1.totals.byType, report2.totals.byType);
  assert.deepStrictEqual(report1.totals.bySequenceNode, report2.totals.bySequenceNode);
  assert.deepStrictEqual(report1.totals.parameterCounts, report2.totals.parameterCounts);
  assert.deepStrictEqual(report1.totals.targetCounts, report2.totals.targetCounts);
  assert.deepStrictEqual(report1.totals.triggerCounts, report2.totals.triggerCounts);
  assert.strictEqual(report1.totals.durationCount, report2.totals.durationCount);
  assert.strictEqual(report1.totals.swapRemovalCount, report2.totals.swapRemovalCount);
  assert.deepStrictEqual(report1.totals.unresolvedCategories, report2.totals.unresolvedCategories);
});

test('12. Provenance and patch isolation across all audit records', () => {
  const report = runProductionSemanticsAudit();

  for (const rec of report.records) {
    assert.strictEqual(rec.result.sourceReference?.patchVersion, '3.7');
    assert.strictEqual(rec.result.parserVersion, PARSER_VERSION);
    assert.ok(rec.entityId.length > 0, 'entityId must be non-empty');
    assert.ok(rec.sourceCode.length > 0, 'sourceCode must be non-empty');
  }
});

// ----------------------------------------------------------------------------
// REMEDIATION TEST SUITE: COVERAGE ACCOUNTING & SEMANTIC DUPLICATE IDENTITY
// ----------------------------------------------------------------------------

test('13. Coverage accounting model: mutually exclusive description partitions partition exactly 976', () => {
  const report = runProductionSemanticsAudit();
  const acc = report.totals.accounting;

  // Mutually exclusive descriptions
  assert.strictEqual(acc.descriptions.total, 976);
  const sumDescriptions =
    acc.descriptions.complete +
    acc.descriptions.partial +
    acc.descriptions.unresolved +
    acc.descriptions.unsupported;
  assert.strictEqual(sumDescriptions, 976);
  assert.strictEqual(acc.descriptions.complete, 133);
  assert.strictEqual(acc.descriptions.partial, 133);
  assert.strictEqual(acc.descriptions.unresolved, 337);
  assert.strictEqual(acc.descriptions.unsupported, 373);
});

test('14. Coverage accounting model: numeric percentage tokens partition cleanly across description states', () => {
  const report = runProductionSemanticsAudit();
  const nt = report.totals.accounting.numericTokens;

  assert.strictEqual(nt.totalExplicitPercentageTokens, 1010);
  const sumTokens =
    nt.percentageTokensInCompleteDescriptions +
    nt.percentageTokensInPartialDescriptions +
    nt.percentageTokensInUnresolvedDescriptions +
    nt.percentageTokensInUnsupportedDescriptions;
  assert.strictEqual(sumTokens, 1010);
  assert.strictEqual(nt.percentageTokensInCompleteDescriptions, 144);
  assert.strictEqual(nt.percentageTokensInPartialDescriptions, 351);
  assert.strictEqual(nt.percentageTokensInUnresolvedDescriptions, 515);
  assert.strictEqual(nt.percentageTokensInUnsupportedDescriptions, 0);

  assert.strictEqual(nt.totalParsedNumericEffects, 292);
  assert.strictEqual(nt.totalParsedExplicitDurations, 192);
  assert.strictEqual(nt.totalParsedSwapRemovals, 32);
});

test('15. Coverage accounting model: semantic fragments partition by origin and sum to 1,181', () => {
  const report = runProductionSemanticsAudit();
  const frags = report.totals.accounting.fragments;

  assert.strictEqual(frags.totalUnmodeledFragments, 1181);
  const sumFrags =
    frags.fromPartialDescriptions + frags.fromUnresolvedDescriptions + frags.fromUnsupportedDescriptions;
  assert.strictEqual(sumFrags, 1181);
  assert.strictEqual(frags.fromPartialDescriptions, 353);
  assert.strictEqual(frags.fromUnresolvedDescriptions, 455);
  assert.strictEqual(frags.fromUnsupportedDescriptions, 373);
});

test('16. Coverage accounting model: single-label category partition sums to exactly 1,181 fragments', () => {
  const report = runProductionSemanticsAudit();
  const single = report.totals.accounting.singleLabelCategories;

  const totalCategorized = Object.values(single).reduce((sum, count) => sum + count, 0);
  assert.strictEqual(totalCategorized, 1181);

  assert.strictEqual(single['Crowd Control & Displacement'], 167);
  assert.strictEqual(single['Stateful Combat Stacks'], 129);
  assert.strictEqual(single['Non-Combat Utility'], 58);
  assert.strictEqual(single['Forte Resource & Gauge Mechanics'], 42);
  assert.strictEqual(single['Dynamic / Scaling Healing'], 37);
  assert.strictEqual(single['Shield Generation & Absorption'], 19);
  assert.strictEqual(single['Coordinated & Entity Triggers'], 14);
  assert.strictEqual(single['Cooldown Dynamics'], 12);
  assert.strictEqual(single['Other Unmodeled Mechanic'], 703);
});

test('17. Coverage accounting model: multi-label occurrences exceed single-label assignments due to concept overlap', () => {
  const report = runProductionSemanticsAudit();
  const single = report.totals.accounting.singleLabelCategories;
  const multi = report.totals.accounting.multiLabelOccurrences;

  // Stacks that also mention healing/shields exceed single-label assignment
  assert.ok(multi['Stateful Combat Stacks'] >= single['Stateful Combat Stacks']);
  assert.strictEqual(multi['Stateful Combat Stacks'], 153);
  assert.strictEqual(single['Stateful Combat Stacks'], 129);

  // Healing occurrences in multi-label exceed single-label
  assert.ok(multi['Dynamic / Scaling Healing'] >= single['Dynamic / Scaling Healing']);
  assert.strictEqual(multi['Dynamic / Scaling Healing'], 49);
  assert.strictEqual(single['Dynamic / Scaling Healing'], 37);

  // Coordinated trigger occurrences in multi-label exceed single-label
  assert.ok(multi['Coordinated & Entity Triggers'] >= single['Coordinated & Entity Triggers']);
  assert.strictEqual(multi['Coordinated & Entity Triggers'], 35);
  assert.strictEqual(single['Coordinated & Entity Triggers'], 14);
});

test('18. One description can contain multiple distinct unresolved fragments', () => {
  // Test Yangyang S3 canonical description which has 2 sentences and multiple unmodeled mechanics
  const result = extractSemantics(
    "Resonance Skill DMG Bonus is increased by 40%. The Wind Field's pulling effect on surrounding targets is enhanced, and the pulling range is expanded by 33%.",
    {
      entityId: 'Yangyang',
      sourceCode: 'S3',
      patchVersion: '3.7'
    }
  );

  assert.strictEqual(result.status, 'PARTIAL');
  assert.strictEqual(result.effects.length, 1);
  // Unmodeled mechanical sentence is isolated into unresolvedFragments
  assert.ok(result.unresolvedFragments.length >= 1);
  assert.ok(
    result.unresolvedFragments.some((frag) => frag.includes('pulling') || frag.includes('pulling range')),
    'Must capture unconsumed pulling mechanics as unresolved fragment'
  );
});

test('19. Safe Duplicate Identity: Distinct conditions with identical parameter & value do not collide', () => {
  const mockEffectA: SemanticEffect = {
    id: 'sem_p3_7_test_s1_atk_percent_0',
    source: {
      entityId: 'test_resonator',
      entityName: 'Test Resonator',
      sourceType: 'RESONATOR_SEQUENCE',
      sourceCode: 'S1',
      patchVersion: '3.7',
      sourceProvenance: 'Provenance',
      originalDescription: 'Test Description'
    },
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    value: { type: 'EXACT', value: 10, unit: 'PERCENT' },
    valueState: 'PARSED',
    condition: { trigger: 'ON_BASIC_ATTACK' },
    extraction: { parserVersion: '1.1.0', method: 'DETERMINISTIC_RULE_PARSER', extractionDate: '2026-10-08' }
  };

  const mockEffectB: SemanticEffect = {
    ...mockEffectA,
    id: 'sem_p3_7_test_s1_atk_percent_1',
    condition: { trigger: 'ON_RESONANCE_SKILL' }
  };

  const sigA = computeSemanticSignature(mockEffectA);
  const sigB = computeSemanticSignature(mockEffectB);

  assert.notStrictEqual(sigA, sigB, 'Effects with distinct triggers must produce distinct signatures');
});

test('20. Safe Duplicate Identity: Distinct targets with identical parameter & value do not collide', () => {
  const mockEffectSelf: SemanticEffect = {
    id: 'sem_p3_7_test_s2_atk_percent_0',
    source: {
      entityId: 'test_resonator',
      entityName: 'Test Resonator',
      sourceType: 'RESONATOR_SEQUENCE',
      sourceCode: 'S2',
      patchVersion: '3.7',
      sourceProvenance: 'Provenance',
      originalDescription: 'Test Description'
    },
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' },
    valueState: 'PARSED',
    extraction: { parserVersion: '1.1.0', method: 'DETERMINISTIC_RULE_PARSER', extractionDate: '2026-10-08' }
  };

  const mockEffectTeam: SemanticEffect = {
    ...mockEffectSelf,
    id: 'sem_p3_7_test_s2_atk_percent_1',
    target: 'TEAM'
  };

  const sigSelf = computeSemanticSignature(mockEffectSelf);
  const sigTeam = computeSemanticSignature(mockEffectTeam);

  assert.notStrictEqual(sigSelf, sigTeam, 'Effects with distinct targets must produce distinct signatures');
});

test('21. Safe Duplicate Identity: Distinct duration / swap removal flags do not collide', () => {
  const mockEffectPersistent: SemanticEffect = {
    id: 'sem_p3_7_test_s3_atk_percent_0',
    source: {
      entityId: 'test_resonator',
      entityName: 'Test Resonator',
      sourceType: 'RESONATOR_SEQUENCE',
      sourceCode: 'S3',
      patchVersion: '3.7',
      sourceProvenance: 'Provenance',
      originalDescription: 'Test Description'
    },
    category: 'STAT_BUFF',
    target: 'NEXT_RESONATOR',
    parameter: 'ATK_PERCENT',
    value: { type: 'EXACT', value: 15, unit: 'PERCENT' },
    valueState: 'PARSED',
    duration: { durationSeconds: 14, removeOnSwap: false },
    extraction: { parserVersion: '1.1.0', method: 'DETERMINISTIC_RULE_PARSER', extractionDate: '2026-10-08' }
  };

  const mockEffectSwap: SemanticEffect = {
    ...mockEffectPersistent,
    id: 'sem_p3_7_test_s3_atk_percent_1',
    duration: { durationSeconds: 14, removeOnSwap: true }
  };

  const sigPersistent = computeSemanticSignature(mockEffectPersistent);
  const sigSwap = computeSemanticSignature(mockEffectSwap);

  assert.notStrictEqual(sigPersistent, sigSwap, 'Effects with distinct swap-removal behavior must produce distinct signatures');
});

test('22. Accidental Duplicate Detection: Identical semantic signatures correctly trigger duplicate warning', () => {
  const mockEffectA: SemanticEffect = {
    id: 'sem_p3_7_test_s4_atk_percent_0',
    source: {
      entityId: 'test_resonator',
      entityName: 'Test Resonator',
      sourceType: 'RESONATOR_SEQUENCE',
      sourceCode: 'S4',
      patchVersion: '3.7',
      sourceProvenance: 'Provenance',
      originalDescription: 'Test Description'
    },
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' },
    valueState: 'PARSED',
    duration: { durationSeconds: 10 },
    extraction: { parserVersion: '1.1.0', method: 'DETERMINISTIC_RULE_PARSER', extractionDate: '2026-10-08' }
  };

  // Simulating duplicate rule firing on same clause
  const mockDuplicateMatch: SemanticEffect = {
    ...mockEffectA,
    id: 'sem_p3_7_test_s4_atk_percent_1'
  };

  const sigA = computeSemanticSignature(mockEffectA);
  const sigDup = computeSemanticSignature(mockDuplicateMatch);

  assert.strictEqual(sigA, sigDup, 'Identical semantic effects must produce identical signatures for detection');
});

test('23. Safe Duplicate Identity: Distinct elements with same parameter & value do not collide', () => {
  const baseEffect: SemanticEffect = {
    id: 'sem_p3_7_test_s5_fusion_0',
    source: {
      entityId: 'test_resonator',
      entityName: 'Test Resonator',
      sourceType: 'RESONATOR_SEQUENCE',
      sourceCode: 'S5',
      patchVersion: '3.7',
      sourceProvenance: 'Provenance',
      originalDescription: 'Test Description'
    },
    category: 'DMG_AMPLIFY',
    target: 'SELF',
    parameter: 'FUSION_DAMAGE_PERCENT',
    element: 'Fusion',
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' },
    valueState: 'PARSED',
    extraction: { parserVersion: '1.1.0', method: 'DETERMINISTIC_RULE_PARSER', extractionDate: '2026-10-08' }
  };

  const electroEffect: SemanticEffect = {
    ...baseEffect,
    id: 'sem_p3_7_test_s5_electro_0',
    parameter: 'ELECTRO_DAMAGE_PERCENT',
    element: 'Electro'
  };

  const aeroEffect: SemanticEffect = {
    ...baseEffect,
    id: 'sem_p3_7_test_s5_aero_0',
    parameter: 'AERO_DAMAGE_PERCENT',
    element: 'Aero'
  };

  const allAttrEffect: SemanticEffect = {
    ...baseEffect,
    id: 'sem_p3_7_test_s5_all_0',
    parameter: 'ALL_ATTRIBUTE_DAMAGE_PERCENT',
    element: 'All'
  };

  const sigFusion = computeSemanticSignature(baseEffect);
  const sigElectro = computeSemanticSignature(electroEffect);
  const sigAero = computeSemanticSignature(aeroEffect);
  const sigAll = computeSemanticSignature(allAttrEffect);

  assert.notStrictEqual(sigFusion, sigElectro);
  assert.notStrictEqual(sigFusion, sigAero);
  assert.notStrictEqual(sigFusion, sigAll);
  assert.notStrictEqual(sigElectro, sigAero);
});

test('24. Safe Duplicate Identity: Distinct categories with same parameter & value do not collide', () => {
  const buffEffect: SemanticEffect = {
    id: 'sem_p3_7_test_cat_0',
    source: {
      entityId: 'test_resonator',
      entityName: 'Test Resonator',
      sourceType: 'RESONATOR_SEQUENCE',
      sourceCode: 'S1',
      patchVersion: '3.7',
      sourceProvenance: 'Provenance',
      originalDescription: 'Test Description'
    },
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' },
    valueState: 'PARSED',
    extraction: { parserVersion: '1.1.0', method: 'DETERMINISTIC_RULE_PARSER', extractionDate: '2026-10-08' }
  };

  const grantEffect: SemanticEffect = {
    ...buffEffect,
    category: 'RESOURCE_GRANT'
  };

  const sigBuff = computeSemanticSignature(buffEffect);
  const sigGrant = computeSemanticSignature(grantEffect);

  assert.notStrictEqual(sigBuff, sigGrant, 'Different gameplay categories must produce distinct signatures');
});

test('25. Safe Duplicate Identity: Distinct duration magnitudes do not collide', () => {
  const shortDur: SemanticEffect = {
    id: 'sem_p3_7_test_dur_0',
    source: {
      entityId: 'test_resonator',
      entityName: 'Test Resonator',
      sourceType: 'RESONATOR_SEQUENCE',
      sourceCode: 'S1',
      patchVersion: '3.7',
      sourceProvenance: 'Provenance',
      originalDescription: 'Test Description'
    },
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    value: { type: 'EXACT', value: 20, unit: 'PERCENT' },
    valueState: 'PARSED',
    duration: { durationSeconds: 10 },
    extraction: { parserVersion: '1.1.0', method: 'DETERMINISTIC_RULE_PARSER', extractionDate: '2026-10-08' }
  };

  const longDur: SemanticEffect = {
    ...shortDur,
    duration: { durationSeconds: 15 }
  };

  const sigShort = computeSemanticSignature(shortDur);
  const sigLong = computeSemanticSignature(longDur);

  assert.notStrictEqual(sigShort, sigLong, 'Different duration lengths must produce distinct signatures');
});

test('26. Safe Duplicate Identity: Distinct stacking constraints do not collide', () => {
  const stack3: SemanticEffect = {
    id: 'sem_p3_7_test_stack_0',
    source: {
      entityId: 'test_resonator',
      entityName: 'Test Resonator',
      sourceType: 'RESONATOR_SEQUENCE',
      sourceCode: 'S1',
      patchVersion: '3.7',
      sourceProvenance: 'Provenance',
      originalDescription: 'Test Description'
    },
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    value: { type: 'EXACT', value: 5, unit: 'PERCENT' },
    valueState: 'PARSED',
    stacking: { maxStacks: 3, durationPerStackSeconds: 10 },
    extraction: { parserVersion: '1.1.0', method: 'DETERMINISTIC_RULE_PARSER', extractionDate: '2026-10-08' }
  };

  const stack4: SemanticEffect = {
    ...stack3,
    stacking: { maxStacks: 4, durationPerStackSeconds: 10 }
  };

  const sigStack3 = computeSemanticSignature(stack3);
  const sigStack4 = computeSemanticSignature(stack4);

  assert.notStrictEqual(sigStack3, sigStack4, 'Different maxStacks must produce distinct signatures');
});

test('27. MULTI_RANK canonicalization: insertion order does not affect signature', () => {
  const effectOrderA: SemanticEffect = {
    id: 'sem_p3_7_weapon_r_0',
    source: {
      entityId: 'test_weapon',
      entityName: 'Test Weapon',
      sourceType: 'WEAPON_REFINEMENT',
      sourceCode: 'Passive',
      patchVersion: '3.7',
      sourceProvenance: 'Provenance',
      originalDescription: 'Test Description'
    },
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    value: {
      type: 'MULTI_RANK',
      ranks: {
        R5: { type: 'EXACT', value: 24, unit: 'PERCENT' },
        R1: { type: 'EXACT', value: 12, unit: 'PERCENT' },
        R3: { type: 'EXACT', value: 18, unit: 'PERCENT' }
      },
      unit: 'PERCENT'
    },
    valueState: 'KNOWN',
    extraction: { parserVersion: '1.1.0', method: 'DETERMINISTIC_RULE_PARSER', extractionDate: '2026-10-08' }
  };

  const effectOrderB: SemanticEffect = {
    ...effectOrderA,
    value: {
      type: 'MULTI_RANK',
      ranks: {
        R1: { type: 'EXACT', value: 12, unit: 'PERCENT' },
        R3: { type: 'EXACT', value: 18, unit: 'PERCENT' },
        R5: { type: 'EXACT', value: 24, unit: 'PERCENT' }
      },
      unit: 'PERCENT'
    }
  };

  const sigA = computeSemanticSignature(effectOrderA);
  const sigB = computeSemanticSignature(effectOrderB);

  assert.strictEqual(sigA, sigB, 'Identical rank values with different key insertion order must produce identical signatures');
});

test('28. MULTI_RANK semantic difference: different rank values produce different signatures', () => {
  const effectA: SemanticEffect = {
    id: 'sem_p3_7_weapon_r_0',
    source: {
      entityId: 'test_weapon',
      entityName: 'Test Weapon',
      sourceType: 'WEAPON_REFINEMENT',
      sourceCode: 'Passive',
      patchVersion: '3.7',
      sourceProvenance: 'Provenance',
      originalDescription: 'Test Description'
    },
    category: 'STAT_BUFF',
    target: 'SELF',
    parameter: 'ATK_PERCENT',
    value: {
      type: 'MULTI_RANK',
      ranks: {
        R1: { type: 'EXACT', value: 12, unit: 'PERCENT' },
        R5: { type: 'EXACT', value: 24, unit: 'PERCENT' }
      },
      unit: 'PERCENT'
    },
    valueState: 'KNOWN',
    extraction: { parserVersion: '1.1.0', method: 'DETERMINISTIC_RULE_PARSER', extractionDate: '2026-10-08' }
  };

  const effectB: SemanticEffect = {
    ...effectA,
    value: {
      type: 'MULTI_RANK',
      ranks: {
        R1: { type: 'EXACT', value: 14, unit: 'PERCENT' }, // different R1
        R5: { type: 'EXACT', value: 24, unit: 'PERCENT' }
      },
      unit: 'PERCENT'
    }
  };

  const sigA = computeSemanticSignature(effectA);
  const sigB = computeSemanticSignature(effectB);

  assert.notStrictEqual(sigA, sigB, 'Different rank values must produce different signatures');
});

test('29. UNRESOLVED value identity: different unresolved reasons produce distinguishable signatures', () => {
  const unresolvedA: SemanticEffect = {
    id: 'sem_p3_7_test_unres_0',
    source: {
      entityId: 'test_char',
      entityName: 'Test Char',
      sourceType: 'RESONATOR_ABILITY',
      sourceCode: 'Skill',
      patchVersion: '3.7',
      sourceProvenance: 'Provenance',
      originalDescription: 'Test Description'
    },
    category: 'SPECIAL_MECHANIC',
    target: 'SELF',
    parameter: 'UNRESOLVED_PARAMETER',
    value: {
      type: 'UNRESOLVED',
      reason: 'Stateful stacking counter unmodeled',
      rawText: 'gains 1 stack each second'
    },
    valueState: 'UNMODELED',
    extraction: { parserVersion: '1.1.0', method: 'DETERMINISTIC_RULE_PARSER', extractionDate: '2026-10-08' }
  };

  const unresolvedB: SemanticEffect = {
    ...unresolvedA,
    value: {
      type: 'UNRESOLVED',
      reason: 'Formula ratio unmodeled',
      rawText: 'equal to 500% of ATK'
    }
  };

  const sigA = computeSemanticSignature(unresolvedA);
  const sigB = computeSemanticSignature(unresolvedB);

  assert.notStrictEqual(sigA, sigB, 'Different unresolved reasons and raw text must produce different signatures');
});

