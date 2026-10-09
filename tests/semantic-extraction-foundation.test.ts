import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractSemantics,
  generateSemanticEffectId,
  PARSER_VERSION,
  classifyTarget,
  extractDurationSeconds,
  extractRemoveOnSwap,
  classifyTrigger
} from '../lib/semantics/parser.ts';
import {
  RECOGNIZED_SEMANTIC_PARAMETERS,
  RECOGNIZED_VALUE_STATES,
  isSemanticParameter
} from '../lib/semantics/taxonomy.ts';
import { EXTRACTION_GOLDEN_FIXTURES } from './fixtures/semantic-extraction-fixtures.ts';

// ----------------------------------------------------------------------------
// PHASE 6C STEP 1: SEMANTIC EXTRACTION FOUNDATION TEST SUITE
// ----------------------------------------------------------------------------

test('1. Exact percentage parsing produces EXACT SemanticValue with unit PERCENT', () => {
  const result = extractSemantics('Increases ATK by 20% for 10s.', {
    entityId: 'test_char',
    sourceCode: 'S1',
    patchVersion: '3.7'
  });

  assert.strictEqual(result.status, 'COMPLETE');
  assert.strictEqual(result.effects.length, 1);
  const eff = result.effects[0];
  assert.strictEqual(eff.parameter, 'ATK_PERCENT');
  assert.strictEqual(eff.value.type, 'EXACT');
  if (eff.value.type === 'EXACT') {
    assert.strictEqual(eff.value.value, 20);
    assert.strictEqual(eff.value.unit, 'PERCENT');
  }
});

test('2. Decimal percentage parsing correctly retains floating point precision', () => {
  const result = extractSemantics('Increases Energy Regen by 12.8% and Crit. Rate by 12.5%.', {
    entityId: 'weapon_emerald',
    sourceCode: 'Passive',
    patchVersion: '3.7'
  });

  assert.strictEqual(result.status, 'COMPLETE');
  assert.strictEqual(result.effects.length, 2);

  const er = result.effects.find((e) => e.parameter === 'ENERGY_REGEN_PERCENT');
  assert.ok(er);
  assert.strictEqual(er.value.type, 'EXACT');
  if (er.value.type === 'EXACT') {
    assert.strictEqual(er.value.value, 12.8);
    assert.strictEqual(er.value.unit, 'PERCENT');
  }

  const cr = result.effects.find((e) => e.parameter === 'CRIT_RATE_PERCENT');
  assert.ok(cr);
  assert.strictEqual(cr.value.type, 'EXACT');
  if (cr.value.type === 'EXACT') {
    assert.strictEqual(cr.value.value, 12.5);
    assert.strictEqual(cr.value.unit, 'PERCENT');
  }
});

test('3. Integer parsing correctly extracts charges and resource discounts', () => {
  const result = extractSemantics(
    'Resonance Skill Windqueller gains 1 additional charge, and its Resolve cost is decreased by 15.',
    {
      entityId: 'jiyan',
      entityName: 'Jiyan',
      sourceType: 'RESONATOR_SEQUENCE',
      sourceCode: 'S1',
      patchVersion: '3.7'
    }
  );

  assert.strictEqual(result.status, 'COMPLETE');
  assert.strictEqual(result.effects.length, 2);

  const charges = result.effects.find((e) => e.parameter === 'SKILL_CHARGES');
  assert.ok(charges);
  assert.strictEqual(charges.value.type, 'EXACT');
  if (charges.value.type === 'EXACT') {
    assert.strictEqual(charges.value.value, 1);
    assert.strictEqual(charges.value.unit, 'CHARGES');
  }

  const resolve = result.effects.find((e) => e.parameter === 'FORTE_RESOURCE');
  assert.ok(resolve);
  assert.strictEqual(resolve.value.type, 'EXACT');
  if (resolve.value.type === 'EXACT') {
    assert.strictEqual(resolve.value.value, -15);
    assert.strictEqual(resolve.value.unit, 'FLAT');
  }
});

test('4. Range parsing preserves min and max without midpoint or boundary loss', () => {
  const result = extractSemantics('Reduces target enemy Electro Resistance by 10% to 24%.', {
    entityId: 'blooming_jadehaven',
    sourceType: 'WEAPON_PASSIVE',
    sourceCode: 'Passive',
    patchVersion: '3.7'
  });

  assert.strictEqual(result.status, 'COMPLETE');
  assert.strictEqual(result.effects.length, 1);
  const eff = result.effects[0];
  assert.strictEqual(eff.parameter, 'ELECTRO_RES_SHRED_PERCENT');
  assert.strictEqual(eff.value.type, 'RANGE');
  if (eff.value.type === 'RANGE') {
    assert.strictEqual(eff.value.min, 10);
    assert.strictEqual(eff.value.max, 24);
    assert.strictEqual(eff.value.unit, 'PERCENT');
  }
});

test('5. Duration parsing extracts duration in seconds accurately', () => {
  const d30 = extractDurationSeconds('Grants 15% All-Attribute DMG Amplification for 30s.');
  assert.strictEqual(d30, 30);

  const d14 = extractDurationSeconds('Lasting 14 seconds or until swapped out.');
  assert.strictEqual(d14, 14);

  const d10 = extractDurationSeconds('When skill hits, increases ATK by 12% for 10s.');
  assert.strictEqual(d10, 10);

  const none = extractDurationSeconds('Permanently increases HP by 10%.');
  assert.strictEqual(none, undefined);
});

test('6. Trigger parsing classifies Outro, Skill, Liberation, and Basic Attack triggers', () => {
  assert.strictEqual(classifyTrigger('After using Outro Skill, incoming character...'), 'ON_OUTRO_SKILL');
  assert.strictEqual(classifyTrigger('When Resonance Skill hits an enemy, wielder gains...'), 'ON_RESONANCE_SKILL');
  assert.strictEqual(classifyTrigger('Releasing Resonance Liberation increases...'), 'ON_RESONANCE_LIBERATION');
  assert.strictEqual(classifyTrigger('Upon Basic Attack hit, ATK increases...'), 'ON_BASIC_ATTACK');
  assert.strictEqual(classifyTrigger('Upon Heavy Attack hit...'), 'ON_HEAVY_ATTACK');
  assert.strictEqual(classifyTrigger('When Intro Skill hits...'), 'ON_INTRO_SKILL');
});

test('7. Target preservation correctly distinguishes SELF, NEXT_RESONATOR, TEAM, ACTIVE, ENEMY', () => {
  assert.strictEqual(classifyTarget('Reduces target enemy Electro Resistance'), 'ENEMY');
  assert.strictEqual(classifyTarget('The incoming Resonator gains 38% DMG'), 'NEXT_RESONATOR');
  assert.strictEqual(classifyTarget('Grants 15% DMG to all team members'), 'TEAM');
  assert.strictEqual(classifyTarget('Whichever active character is on the field'), 'ACTIVE_CHARACTER');
  assert.strictEqual(classifyTarget('Wielder gains 12% ATK', 'SELF'), 'SELF');
});

test('8. Removal condition preservation captures removeOnSwap reliably', () => {
  assert.strictEqual(extractRemoveOnSwap('Until the character leaves the field.'), true);
  assert.strictEqual(extractRemoveOnSwap('For 14s or until switched out.'), true);
  assert.strictEqual(extractRemoveOnSwap('Expires when the character is swapped out.'), true);
  assert.strictEqual(extractRemoveOnSwap('Lasts for 30s across all team members.'), false);
});

test('9. Element-specific parameter parsing preserves exact elements without generic flattening', () => {
  const electro = extractSemantics('Increases Electro DMG by 20%.');
  assert.strictEqual(electro.effects[0].parameter, 'ELECTRO_DAMAGE_PERCENT');

  const fusion = extractSemantics('Increases Fusion DMG by 15%.');
  assert.strictEqual(fusion.effects[0].parameter, 'FUSION_DAMAGE_PERCENT');

  const glacio = extractSemantics('Increases Glacio DMG by 25%.');
  assert.strictEqual(glacio.effects[0].parameter, 'GLACIO_DAMAGE_PERCENT');

  const aero = extractSemantics('Increases Aero DMG by 12%.');
  assert.strictEqual(aero.effects[0].parameter, 'AERO_DAMAGE_PERCENT');

  const spectro = extractSemantics('Increases Spectro DMG by 30%.');
  assert.strictEqual(spectro.effects[0].parameter, 'SPECTRO_DAMAGE_PERCENT');

  const havoc = extractSemantics('Increases Havoc DMG by 18%.');
  assert.strictEqual(havoc.effects[0].parameter, 'HAVOC_DAMAGE_PERCENT');

  const all = extractSemantics('Grants 15% All-Attribute DMG Amplification.');
  assert.strictEqual(all.effects[0].parameter, 'ALL_ATTRIBUTE_DAMAGE_PERCENT');
});

test('10. Damage-type parsing preserves specific attack categories', () => {
  const basic = extractSemantics('38% Basic Attack DMG Amplification.');
  assert.strictEqual(basic.effects[0].parameter, 'BASIC_ATTACK_DAMAGE_PERCENT');

  const heavy = extractSemantics('Heavy Attack DMG is increased by 30%.');
  assert.strictEqual(heavy.effects[0].parameter, 'HEAVY_ATTACK_DAMAGE_PERCENT');

  const skill = extractSemantics('Resonance Skill DMG is increased by 38%.');
  assert.strictEqual(skill.effects[0].parameter, 'SKILL_DAMAGE_PERCENT');

  const lib = extractSemantics('Resonance Liberation DMG is increased by 20%.');
  assert.strictEqual(lib.effects[0].parameter, 'LIBERATION_DAMAGE_PERCENT');

  const coord = extractSemantics('Coordinated Attack DMG is increased by 15%.');
  assert.strictEqual(coord.effects[0].parameter, 'COORDINATED_ATTACK_DAMAGE_PERCENT');

  // Generic damage remains generic, not Basic Attack
  const gen = extractSemantics('Increases damage by 30% for 10s.');
  assert.strictEqual(gen.effects[0].parameter, 'GENERIC_DAMAGE_PERCENT');
});

test('11. Multiple effects in one description extract independently with common context', () => {
  const result = extractSemantics('+15% ATK and +10% Energy Regen for 10s.', {
    entityId: 'multi_node',
    sourceCode: 'S4',
    patchVersion: '3.7'
  });

  assert.strictEqual(result.status, 'COMPLETE');
  assert.strictEqual(result.effects.length, 2);

  const atk = result.effects.find((e) => e.parameter === 'ATK_PERCENT');
  const er = result.effects.find((e) => e.parameter === 'ENERGY_REGEN_PERCENT');

  assert.ok(atk);
  assert.ok(er);
  assert.strictEqual(atk.duration?.durationSeconds, 10);
  assert.strictEqual(er.duration?.durationSeconds, 10);
});

test('12. Unsupported prose marks status UNSUPPORTED and creates zero false effects', () => {
  const result = extractSemantics('Enemies hit are knocked into the air and pushed backward.', {
    entityId: 'crowd_control_skill',
    sourceCode: 'Skill',
    patchVersion: '3.7'
  });

  assert.strictEqual(result.status, 'UNSUPPORTED');
  assert.strictEqual(result.effects.length, 0);
  assert.strictEqual(result.unresolvedFragments.length, 1);
});

test('13. Ambiguous qualitative claims produce UNRESOLVED and never fabricate numbers', () => {
  const claims = [
    'Greatly increases damage.',
    'Power increases significantly during combat.',
    'Enhances attacks against weakened foes.',
    'Vastly improves combat prowess.',
    'Greatly increases Heavy Attack DMG.'
  ];

  for (const claim of claims) {
    const result = extractSemantics(claim, {
      entityId: 'vague_node',
      sourceCode: 'S2',
      patchVersion: '3.7'
    });

    assert.strictEqual(
      result.status,
      'UNRESOLVED',
      `"${claim}" must be UNRESOLVED`
    );
    assert.strictEqual(
      result.effects.length,
      0,
      `"${claim}" must not generate synthetic numeric effects`
    );
    assert.ok(result.unresolvedFragments.length > 0);
  }
});

test('14. Deterministic output guarantee: Repeated calls yield byte-for-byte identical results', () => {
  const text = 'The incoming Resonator gains 38% Basic Attack DMG Amplification for 14s or until switched out.';
  const context = {
    entityId: 'sanhua',
    entityName: 'Sanhua',
    sourceType: 'RESONATOR_ABILITY' as const,
    sourceCode: 'OutroSkill',
    sourceProvenance: 'api-v2.encore.moe Client Datamine (Patch 3.7)',
    patchVersion: '3.7',
    defaultTarget: 'NEXT_RESONATOR' as const
  };

  const run1 = extractSemantics(text, context);
  const run2 = extractSemantics(text, context);

  assert.deepStrictEqual(run1, run2);
  assert.strictEqual(JSON.stringify(run1), JSON.stringify(run2));
});

test('15. Parser version is explicitly exposed and stamped on every extraction record', () => {
  assert.strictEqual(PARSER_VERSION, '1.1.0');

  const result = extractSemantics('Increases ATK by 12%.');
  assert.strictEqual(result.parserVersion, '1.1.0');
  assert.strictEqual(result.effects[0].extraction.parserVersion, '1.1.0');
  assert.strictEqual(result.effects[0].extraction.method, 'DETERMINISTIC_RULE_PARSER');
});

test('16. Provenance preservation: Source provenance and extraction method are strictly decoupled', () => {
  const rawProvenance = 'api-v2.encore.moe Client Datamine (Patch 3.7)';
  const result = extractSemantics('Increases ATK by 12%.', {
    entityId: 'char_a',
    sourceProvenance: rawProvenance
  });

  const eff = result.effects[0];
  // Source provenance is preserved
  assert.strictEqual(eff.source.sourceProvenance, rawProvenance);
  // Extraction provenance is separate deterministic rule parser
  assert.strictEqual(eff.extraction.method, 'DETERMINISTIC_RULE_PARSER');
  assert.notStrictEqual(eff.extraction.method as string, rawProvenance);
});

test('17. Patch preservation: All extracted records belong to Patch 3.7', () => {
  const result = extractSemantics('Increases ATK by 12%.', {
    patchVersion: '3.7'
  });

  assert.strictEqual(result.effects[0].source.patchVersion, '3.7');
  assert.ok(result.effects[0].id.includes('p3_7'));
});

test('18. Zero LLM or network dependency: extractSemantics is a synchronous pure function', () => {
  const startTime = Date.now();
  for (let i = 0; i < 500; i++) {
    extractSemantics('+38% Basic Attack DMG for 14s or until switched out.');
  }
  const duration = Date.now() - startTime;
  // 500 iterations must take less than 150ms locally
  assert.ok(duration < 150, `500 iterations took ${duration}ms, must be under 150ms`);
});

test('19. No false-zero conversion: Missing or unparsed prose never produces value: 0', () => {
  const ambiguous = extractSemantics('Power increases significantly.');
  assert.strictEqual(ambiguous.effects.length, 0);

  // Even if an unresolved fragment is recorded, it does not set combat_value = 0
  for (const eff of ambiguous.effects) {
    if (eff.value.type === 'EXACT') {
      assert.notStrictEqual(eff.value.value, 0);
    }
  }
});

test('20. Semantic Extraction Golden Fixtures match 100% of expected mechanics', () => {
  for (const [key, fixture] of Object.entries(EXTRACTION_GOLDEN_FIXTURES)) {
    const result = extractSemantics(fixture.inputRawText, fixture.context);

    assert.strictEqual(
      result.status,
      fixture.expectedStatus,
      `Fixture ${key} status mismatch`
    );
    assert.strictEqual(
      result.effects.length,
      fixture.expectedEffectCount,
      `Fixture ${key} effect count mismatch`
    );

    for (let i = 0; i < fixture.expectedParameters.length; i++) {
      const eff = result.effects[i];
      assert.strictEqual(
        eff.parameter,
        fixture.expectedParameters[i],
        `Fixture ${key} effect[${i}] parameter mismatch`
      );
      assert.strictEqual(
        eff.target,
        fixture.expectedTargets[i],
        `Fixture ${key} effect[${i}] target mismatch`
      );

      if (fixture.expectedDurations && fixture.expectedDurations[i] !== undefined) {
        assert.strictEqual(
          eff.duration?.durationSeconds,
          fixture.expectedDurations[i],
          `Fixture ${key} effect[${i}] duration mismatch`
        );
      }

      if (fixture.expectedRemoveOnSwap && fixture.expectedRemoveOnSwap[i] !== undefined) {
        assert.strictEqual(
          eff.duration?.removeOnSwap ?? false,
          fixture.expectedRemoveOnSwap[i],
          `Fixture ${key} effect[${i}] removeOnSwap mismatch`
        );
      }
    }
  }
});
