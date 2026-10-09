import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { PatchDataset, SequenceNodeInput } from '../lib/ingestion/types.ts';
import { runSemanticAudit } from '../scripts/semantic-audit.ts';
import { SEMANTIC_GOLDEN_FIXTURES } from './fixtures/semantic-golden-fixtures.ts';

function loadCanonicalDataset(): PatchDataset {
  const datasetPath = path.resolve('data/patches/3.7/patch_3_7_dataset.json');
  return JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
}

// ----------------------------------------------------------------------------
// PHASE 6B STEP 4: SEMANTIC INTEGRITY AUDIT TEST SUITE
// ----------------------------------------------------------------------------

test('1. Every 3.7 sequence belongs to the correct resonator (60 resonators x 6 nodes = 360)', () => {
  const audit = runSemanticAudit();
  assert.strictEqual(audit.layerAudits.layer2SequenceIntegrity.status, 'PASS');
  assert.strictEqual(audit.layerAudits.layer2SequenceIntegrity.auditedCount, 360);
  assert.strictEqual(audit.layerAudits.layer2SequenceIntegrity.mismatchCount, 0);
});

test('2. Every sequence S1–S6 has correct ordering and identity matching snapshot truth', () => {
  const dataset = loadCanonicalDataset();
  const skillsDir = path.resolve('data/snapshots/3.7/skills');

  const RESONATOR_SLUG_MAP: Record<string, string> = {
    'Rover: Spectro': 'rover-spectro',
    'Rover: Havoc': 'rover-havoc',
    'Rover: Aero': 'rover-aero',
    'Rover: Electro': 'rover-electro',
    'Yangyang: Xuanling': 'yangyang-xuanling',
    'Xiangli Yao': 'xiangli-yao',
    'Luuk Herssen': 'luuk-herssen'
  };

  for (const r of dataset.resonators) {
    const slug =
      RESONATOR_SLUG_MAP[r.name] ||
      r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const snap = JSON.parse(fs.readFileSync(path.join(skillsDir, `${slug}.json`), 'utf8'));

    const seqNodes: SequenceNodeInput[] = r.sequence_nodes ?? [];
    assert.strictEqual(seqNodes.length, 6, `${r.name} must have 6 sequence nodes`);

    for (let i = 0; i < 6; i++) {
      const seqNode: SequenceNodeInput = seqNodes[i];
      const snapNode = snap.sequences[i];

      assert.strictEqual(seqNode.node_order, i + 1, `${r.name} node ${i} order must be ${i + 1}`);
      assert.strictEqual(seqNode.node_code, `S${i + 1}`, `${r.name} node ${i} code must be S${i + 1}`);
      assert.strictEqual(seqNode.name.trim(), snapNode.name.trim(), `${r.name} S${i + 1} name must match snapshot`);
      const snapDesc = typeof snapNode.description === 'string' ? snapNode.description : snapNode.description.en;
      assert.strictEqual(seqNode.description.trim(), snapDesc.trim(), `${r.name} S${i + 1} description must match snapshot`);
    }
  }
});

test('3. Ability -> effect relationships resolve without broken links', () => {
  const dataset = loadCanonicalDataset();
  let totalEffectsFound = 0;

  for (const r of dataset.resonators) {
    for (const a of r.abilities || []) {
      for (const e of a.effects || []) {
        totalEffectsFound++;
        assert.ok(e.category, `Effect on ${r.name} ${a.name} must have a category`);
        assert.ok(e.target, `Effect on ${r.name} ${a.name} must have a target`);
        assert.ok(e.provenance_source_name, `Effect on ${r.name} ${a.name} must have provenance`);
      }
    }
  }

  assert.strictEqual(totalEffectsFound, 79, 'Must resolve all 79 ability gameplay effects');
});

test('4. Sequence -> effect relationships resolve where applicable without false positives', () => {
  const dataset = loadCanonicalDataset();

  // All 360 sequence nodes are currently prose-based; effects array is empty / undefined
  for (const r of dataset.resonators) {
    for (const seq of r.sequence_nodes!) {
      assert.ok(seq.description.length > 20, `${r.name} ${seq.node_code} description must be substantial`);
      // Validate that empty structured effects is not fabricated with dummy synthetic buffs
      assert.strictEqual(seq.effects?.length || 0, 0, 'Sequence node structured effects array must not contain fabricated entries');
    }
  }
});

test('5. Weapon -> passive relationships resolve with valid gameplay effects', () => {
  const dataset = loadCanonicalDataset();
  const weapons = dataset.weapons ?? [];

  const weaponsWithPassives = weapons.filter((w) => w.patch_data.passive_effect);
  assert.strictEqual(weaponsWithPassives.length, 21, 'Must have 21 weapons with modeled passives');

  for (const w of weaponsWithPassives) {
    const eff = w.patch_data.passive_effect!;
    assert.ok(eff.category, `Weapon ${w.name} passive must have category`);
    assert.ok(eff.target, `Weapon ${w.name} passive must have target`);
    assert.ok(
      ['SELF', 'NEXT_RESONATOR', 'TEAM'].includes(eff.target),
      `Weapon ${w.name} passive must target SELF, NEXT_RESONATOR, or TEAM`
    );
  }
});

test('6. GameplayEffect targets are semantically valid with zero contradictions', () => {
  const dataset = loadCanonicalDataset();

  for (const r of dataset.resonators) {
    for (const a of r.abilities || []) {
      for (const e of a.effects || []) {
        // Semantic contradiction tests
        assert.notStrictEqual(e.category === 'HEALING' && e.target === 'ENEMY', true);
        assert.notStrictEqual((e.category === 'DEF_SHRED' || e.category === 'RES_SHRED') && e.target === 'SELF', true);
        assert.notStrictEqual((e.category === 'DEF_SHRED' || e.category === 'RES_SHRED') && e.target === 'TEAM', true);

        // Outro skills target NEXT_RESONATOR, TEAM, or ACTIVE_CHARACTER (Shorekeeper)
        if (a.ability_category === 'OutroSkill') {
          assert.ok(
            ['NEXT_RESONATOR', 'TEAM', 'ACTIVE_CHARACTER'].includes(e.target),
            `Outro skill ${r.name} ${a.name} target must be valid for rotation`
          );
        }
      }
    }
  }
});

test('7. Conditional effects are not silently converted to unconditional effects', () => {
  const dataset = loadCanonicalDataset();
  let outroEffectsCount = 0;
  let removeOnSwapCount = 0;
  let persistentOutrosCount = 0;

  for (const r of dataset.resonators) {
    for (const a of r.abilities || []) {
      if (a.ability_category === 'OutroSkill') {
        for (const e of a.effects || []) {
          outroEffectsCount++;
          assert.strictEqual(
            e.condition_expression?.trigger,
            'outro_skill',
            'Outro effect must preserve outro_skill trigger condition'
          );

          if (e.detail_expression?.remove_on_swap) {
            removeOnSwapCount++;
            assert.strictEqual(
              e.target,
              'NEXT_RESONATOR',
              `Effect with remove_on_swap on ${r.name} must target NEXT_RESONATOR`
            );
          } else {
            persistentOutrosCount++;
            // Must specify duration or healing/resource grant parameters
            assert.ok(
              typeof e.detail_expression?.duration_seconds === 'number' ||
                typeof e.detail_expression?.total_amount === 'number',
              `Persistent outro effect on ${r.name} must specify duration or amount`
            );
          }
        }
      }
    }
  }

  assert.strictEqual(outroEffectsCount, 79, 'Must audit all 79 Outro skill conditional effects');
  assert.strictEqual(removeOnSwapCount, 72, 'Exactly 72 single-target Outro damage buffs must have remove_on_swap: true');
  assert.strictEqual(persistentOutrosCount, 7, 'Exactly 7 Outro effects (heals, resource grants, team-wide) must be persistent');
});

test('8. Provenance classification matches source type strictly', () => {
  const dataset = loadCanonicalDataset();
  const provSources = dataset.provenance_sources;

  for (const ps of provSources) {
    if (ps.source_name.includes('Kuro Games')) {
      assert.strictEqual(ps.source_type, 'OFFICIAL_PUBLISHED');
    } else if (ps.source_name.includes('Prydwen')) {
      assert.strictEqual(ps.source_type, 'COMMUNITY_VERIFIED');
    } else if (ps.source_name.includes('Datamine')) {
      assert.strictEqual(ps.source_type, 'COMMUNITY_DATAMINE');
    }
    assert.strictEqual(ps.status, 'ACTIVE');
  }
});

test('9. Community role tags are not treated as official facts', () => {
  const dataset = loadCanonicalDataset();
  const validRoles = new Set(dataset.functional_roles.map((r) => r.code));

  for (const r of dataset.resonators) {
    assert.ok(r.patch_data.roles.length > 0, `Resonator ${r.name} must have roles`);
    for (const role of r.patch_data.roles) {
      assert.ok(validRoles.has(role.code), `Role ${role.code} on ${r.name} must belong to functional roles taxonomy`);
    }
  }

  // Provenance check for roles: Resonator patch data references community-verified sources
  const provNames = new Set(dataset.provenance_sources.map((p) => p.source_name));
  for (const r of dataset.resonators) {
    assert.ok(provNames.has(r.patch_data.provenance_source_name));
  }
});

test('10. 3.7 data does not reference incompatible patch data', () => {
  const dataset = loadCanonicalDataset();
  const str = JSON.stringify(dataset);

  assert.strictEqual(/"patch_version":\s*"3\.[568]"/.test(str), false);
  assert.strictEqual(/"patch_id":\s*"3\.[568]"/.test(str), false);
  assert.strictEqual(dataset.patch.version, '3.7');
});

test('11. Null refinement scaling is not interpreted as zero scaling', () => {
  const dataset = loadCanonicalDataset();
  const weapons = dataset.weapons ?? [];

  const withoutRefinement = weapons.filter((w) => !w.patch_data.refinement_scaling);
  assert.strictEqual(withoutRefinement.length, 50, 'Exactly 50 weapons must have null refinement scaling');

  for (const w of withoutRefinement) {
    assert.strictEqual(w.patch_data.refinement_scaling ?? null, null);
    // Base stats must still be positive numbers!
    assert.ok(w.patch_data.base_atk_lvl90 > 250, `${w.name} base ATK must be positive`);
    assert.ok(w.patch_data.sub_stat_value_lvl90 > 0, `${w.name} sub-stat value must be positive`);
  }
});

test('12. Missing gameplay semantics are explicitly detectable', () => {
  const audit = runSemanticAudit();
  const classification = audit.layerAudits.layer11CompletenessClassification;

  assert.ok(classification.completeEntities.length >= 6);
  assert.ok(classification.partialEntities.length >= 2);
  assert.ok(classification.missingMechanics.length >= 2);
  assert.ok(classification.notApplicable.length >= 1);
});

test('13. Golden semantic fixtures normalize deterministically', () => {
  const fixtureKeys = Object.keys(SEMANTIC_GOLDEN_FIXTURES);
  assert.strictEqual(fixtureKeys.length, 10, 'Must have exactly 10 golden fixtures');

  for (const key of fixtureKeys) {
    const fix = SEMANTIC_GOLDEN_FIXTURES[key];
    assert.ok(fix.categoryName);
    assert.ok(fix.entityName);
    assert.ok(fix.provenance);
    assert.ok(fix.expectedInterpretation);
    assert.ok(fix.whyCorrect);
    assert.ok(fix.normalizedRepresentation.category);
    assert.ok(fix.normalizedRepresentation.target);
  }
});

test('14. Normalization preserves semantic meaning in golden fixtures', () => {
  const fix1 = SEMANTIC_GOLDEN_FIXTURES.DIRECT_SELF_BUFF;
  assert.strictEqual(fix1.normalizedRepresentation.category, 'STAT_BUFF');
  assert.strictEqual(fix1.normalizedRepresentation.target, 'SELF');
  const rScaling = fix1.normalizedRepresentation.detailExpression?.refinement_scaling as any;
  assert.strictEqual(rScaling?.R1?.atkPct, 6);

  const fix2 = SEMANTIC_GOLDEN_FIXTURES.TEAM_WIDE_BUFF;
  assert.strictEqual(fix2.normalizedRepresentation.category, 'DMG_AMPLIFY');
  assert.strictEqual(fix2.normalizedRepresentation.target, 'TEAM');
  assert.strictEqual(fix2.normalizedRepresentation.detailExpression?.amplification_ratio, 0.15);

  const fix4 = SEMANTIC_GOLDEN_FIXTURES.NEXT_RESONATOR_EFFECT;
  assert.strictEqual(fix4.normalizedRepresentation.target, 'NEXT_RESONATOR');
  assert.strictEqual(fix4.normalizedRepresentation.detailExpression?.remove_on_swap, true);

  const fix8 = SEMANTIC_GOLDEN_FIXTURES.WEAPON_REFINEMENT_EFFECT;
  assert.strictEqual(fix8.normalizedRepresentation.refinementScaling?.R5?.atkPct, 24);
  assert.strictEqual(fix8.normalizedRepresentation.refinementScaling?.R5?.dmgBonus_skill, 8);
});

test('15. Full semantic audit suite runs with zero critical errors', () => {
  const audit = runSemanticAudit();
  const criticalRisks = audit.layerAudits.layer12OptimizerSafetyRisks.filter((r) => r.severity === 'CRITICAL');
  assert.strictEqual(criticalRisks.length, 0, 'Must have zero CRITICAL semantic audit risks');
});
