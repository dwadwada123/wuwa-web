import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import child_process from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { validatePatchDataset } from '../lib/ingestion/validation.ts';
import { ingestPatchDataset, deterministicUuid } from '../lib/ingestion/engine.ts';
import type { PatchDataset } from '../lib/ingestion/types.ts';

const LOCAL_SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const LOCAL_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

function loadTestDataset(): PatchDataset {
  const filePath = path.resolve('data/patches/3.7/patch_3_7_dataset.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

test('Ingestion - Parsing and Structure Integrity', () => {
  const dataset = loadTestDataset();

  assert.equal(dataset.patch.version, '3.7');
  assert.equal(dataset.patch.release_date, '2026-09-30');
  assert.equal(dataset.resonators.length, 60, 'Complete 3.7 roster must contain exactly 60 unique Resonators');
  assert.ok(dataset.provenance_sources.length >= 3, 'Must have at least 3 verified provenance sources');
  assert.ok(dataset.functional_roles.length >= 5, 'Must have 5 functional roles');
  assert.ok(dataset.combat_tags.length >= 10, 'Must have at least 10 combat tags');

  // Verify Patch 3.7 additions are present
  const hsin = dataset.resonators.find(r => r.name === 'Hsin');
  assert.ok(hsin, 'Hsin must be present in 3.7 dataset');
  assert.equal(hsin.element, 'Electro');
  assert.equal(hsin.weapon_type, 'Rectifier');
  assert.equal(hsin.rarity, 5);

  const suoming = dataset.resonators.find(r => r.name === 'Suoming');
  assert.ok(suoming, 'Suoming must be present in 3.7 dataset');
  assert.equal(suoming.element, 'Electro');
  assert.equal(suoming.weapon_type, 'Sword');
  assert.equal(suoming.rarity, 5);

  // Verify ToA Season 40 data is present
  assert.equal(dataset.enemies?.length, 83, 'Enemies count must be 83 (70 existing + 13 ToA additions)');
  assert.ok(dataset.area_effects && dataset.area_effects.length >= 9, 'Must have at least 9 area effects');
  assert.equal(dataset.toa_cycles?.length, 1, 'Must have 1 ToA cycle');
});

test('Ingestion - Validation Layer Passes Valid Dataset', () => {
  const dataset = loadTestDataset();
  const result = validatePatchDataset(dataset);

  assert.equal(result.isValid, true, `Validation failed: ${JSON.stringify(result.errors)}`);
  assert.equal(result.errors.length, 0);
});

test('Ingestion - Validation Layer Rejects Unknown Element', () => {
  const dataset = loadTestDataset();
  // Corrupt element
  (dataset.resonators[0] as any).element = 'Pyro';

  const result = validatePatchDataset(dataset);
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some(e => e.message.includes('Unknown elemental value')));
});

test('Ingestion - Validation Layer Rejects Unknown Weapon Type', () => {
  const dataset = loadTestDataset();
  (dataset.resonators[0] as any).weapon_type = 'Bow';

  const result = validatePatchDataset(dataset);
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some(e => e.message.includes('Unknown weapon type')));
});

test('Ingestion - Validation Layer Rejects Invalid Rarity', () => {
  const dataset = loadTestDataset();
  (dataset.resonators[0] as any).rarity = 3;

  const result = validatePatchDataset(dataset);
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some(e => e.message.includes('Invalid rarity')));
});

test('Ingestion - Validation Layer Rejects Duplicate Resonator Identity', () => {
  const dataset = loadTestDataset();
  const clone = JSON.parse(JSON.stringify(dataset.resonators[0]));
  dataset.resonators.push(clone);

  const result = validatePatchDataset(dataset);
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some(e => e.message.includes('Duplicate Resonator identity')));
});

test('Ingestion - Validation Layer Rejects Duplicate Ability Code', () => {
  const dataset = loadTestDataset();
  const firstResonator = dataset.resonators[0];
  firstResonator.abilities.push({
    ...firstResonator.abilities[0]
  });

  const result = validatePatchDataset(dataset);
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some(e => e.message.includes('Duplicate ability code')));
});

test('Ingestion - Validation Layer Rejects Invalid Ability Category', () => {
  const dataset = loadTestDataset();
  (dataset.resonators[0].abilities[0] as any).ability_category = 'SuperUltimate';

  const result = validatePatchDataset(dataset);
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some(e => e.message.includes('Invalid ability category')));
});

test('Ingestion - Validation Layer Rejects Invalid Gameplay Effect Category', () => {
  const dataset = loadTestDataset();
  const outroAb = dataset.resonators.find(r => r.name === 'Yangyang')?.abilities.find(a => a.ability_category === 'OutroSkill');
  assert.ok(outroAb && outroAb.effects && outroAb.effects.length > 0);
  (outroAb.effects[0] as any).category = 'SUPER_CHARGE';

  const result = validatePatchDataset(dataset);
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some(e => e.message.includes('Invalid gameplay effect category')));
});

test('Ingestion - Validation Layer Rejects Invalid Gameplay Effect Target', () => {
  const dataset = loadTestDataset();
  const outroAb = dataset.resonators.find(r => r.name === 'Yangyang')?.abilities.find(a => a.ability_category === 'OutroSkill');
  assert.ok(outroAb && outroAb.effects && outroAb.effects.length > 0);
  (outroAb.effects[0] as any).target = 'ALL_UNITS';

  const result = validatePatchDataset(dataset);
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some(e => e.message.includes('Invalid gameplay effect target')));
});

test('Ingestion - Validation Layer Rejects Missing Provenance Reference', () => {
  const dataset = loadTestDataset();
  dataset.resonators[0].patch_data.provenance_source_name = 'Unregistered Source Phantom';

  const result = validatePatchDataset(dataset);
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some(e => e.message.includes('Missing or unregistered provenance source')));
});

test('Ingestion - Validation Layer Rejects Non-Positive Stats', () => {
  const dataset = loadTestDataset();
  dataset.resonators[0].patch_data.base_hp_lvl90 = 0;

  const result = validatePatchDataset(dataset);
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some(e => e.message.includes('base_hp_lvl90 must be > 0')));
});

test('Ingestion - Validation Layer Accepts OFFICIAL_PUBLISHED and COMMUNITY_DATAMINE', () => {
  const dataset = loadTestDataset();
  const kuro = dataset.provenance_sources.find(s => s.source_name.includes('Kuro Games'));
  const encore = dataset.provenance_sources.find(s => s.source_name.includes('encore.moe'));
  assert.ok(kuro, 'Kuro Games provenance must exist');
  assert.ok(encore, 'Encore provenance must exist');
  assert.equal(kuro.source_type, 'OFFICIAL_PUBLISHED');
  assert.equal(encore.source_type, 'COMMUNITY_DATAMINE');

  const result = validatePatchDataset(dataset);
  assert.equal(result.isValid, true);
});

test('Ingestion - Validation Layer Rejects Invalid Source Type', () => {
  const dataset = loadTestDataset();
  (dataset.provenance_sources[0] as any).source_type = 'UNOFFICIAL_LEAK';

  const result = validatePatchDataset(dataset);
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some(e => e.message.includes('Invalid source_type')));
});

test('Ingestion CLI - Remote Ingestion Requires --confirm-remote', () => {
  const proc = child_process.spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/ingest.ts', '--target', 'remote'], {
    encoding: 'utf8'
  });
  assert.equal(proc.status, 1);
  assert.ok(proc.stderr.includes('--confirm-remote'));
});

test('Ingestion - Valid Weapon Parsing', () => {
  const dataset = loadTestDataset();
  assert.ok(dataset.weapons && dataset.weapons.length >= 60, 'Should have at least 60 weapons');

  const jadehaven = dataset.weapons.find(w => w.name === 'Blooming Jadehaven');
  assert.ok(jadehaven, 'Blooming Jadehaven must exist');
  assert.equal(jadehaven.weapon_type, 'Rectifier');
  assert.equal(jadehaven.rarity, 5);
  assert.equal(jadehaven.patch_data.base_atk_lvl90, 587.50);
  assert.equal(jadehaven.patch_data.sub_stat_type, 'CritRate');
  assert.equal(jadehaven.patch_data.sub_stat_value_lvl90, 0.2430);

  const unspokenRue = dataset.weapons.find(w => w.name === 'Unspoken Rue');
  assert.ok(unspokenRue, 'Unspoken Rue must exist');
  assert.equal(unspokenRue.weapon_type, 'Sword');
  assert.equal(unspokenRue.rarity, 5);
  assert.equal(unspokenRue.patch_data.base_atk_lvl90, 587.50);
  assert.equal(unspokenRue.patch_data.sub_stat_type, 'CritRate');
  assert.equal(unspokenRue.patch_data.sub_stat_value_lvl90, 0.2430);
});

test('Ingestion - Invalid Weapon Taxonomy Rejected', () => {
  const dataset = loadTestDataset();
  (dataset.weapons![0] as any).weapon_type = 'Dagger';

  const result = validatePatchDataset(dataset);
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some(e => e.message.includes('Invalid weapon type')));
});

test('Ingestion - Duplicate Weapon Identity Rejected', () => {
  const dataset = loadTestDataset();
  const clone = JSON.parse(JSON.stringify(dataset.weapons![0]));
  dataset.weapons!.push(clone);

  const result = validatePatchDataset(dataset);
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some(e => e.message.includes('Duplicate weapon identity')));
});

test('Ingestion - Valid Echo Parsing', () => {
  const dataset = loadTestDataset();
  assert.ok(dataset.echoes && dataset.echoes.length >= 40, 'Should have at least 40 echoes');

  const formrender = dataset.echoes.find(e => e.name === 'Formrender');
  assert.ok(formrender, 'Formrender must exist');
  assert.equal(formrender.class_type, 'Elite');
  assert.equal(formrender.cost, 3);

  const soulfrayer = dataset.echoes.find(e => e.name === 'Soulfrayer');
  assert.ok(soulfrayer, 'Soulfrayer must exist');
  assert.equal(soulfrayer.class_type, 'Elite');
  assert.equal(soulfrayer.cost, 3);

  const skywatch = dataset.echoes.find(e => e.name === 'Skywatch Lancer');
  assert.ok(skywatch, 'Skywatch Lancer must exist');
  assert.equal(skywatch.class_type, 'Common');
  assert.equal(skywatch.cost, 1);

  const puppet = dataset.echoes.find(e => e.name === 'Bloomburst Puppet');
  assert.ok(puppet, 'Bloomburst Puppet must exist');
  assert.equal(puppet.class_type, 'Common');
  assert.equal(puppet.cost, 1);

  const serpent = dataset.echoes.find(e => e.name === 'Jade Nether Serpent');
  assert.ok(serpent, 'Jade Nether Serpent must exist');
  assert.equal(serpent.class_type, 'Common');
  assert.equal(serpent.cost, 1);

  const suhsin = dataset.echoes.find(e => e.name === 'Reminiscence: Suhsin the Inevitable');
  assert.ok(suhsin, 'Reminiscence: Suhsin the Inevitable must exist');
  assert.equal(suhsin.class_type, 'Calamity');
  assert.equal(suhsin.cost, 4);
});

test('Ingestion - Invalid Echo Cost/Class Rejected', () => {
  const dataset = loadTestDataset();
  (dataset.echoes![0] as any).cost = 2;

  const result = validatePatchDataset(dataset);
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some(e => e.message.includes('Invalid echo cost')));
});

test('Ingestion - Valid Sonata Parsing', () => {
  const dataset = loadTestDataset();
  assert.ok(dataset.sonatas && dataset.sonatas.length === 12, 'Must have exactly 12 Sonata sets');

  const swornVigil = dataset.sonatas.find(s => s.code === 'HEART_OF_SWORN_VIGIL');
  assert.ok(swornVigil, 'Heart of Sworn Vigil must exist');
  assert.equal(swornVigil.name, 'Heart of Sworn Vigil');
  assert.ok(swornVigil.patch_data.two_piece_effect);
  assert.ok(swornVigil.patch_data.five_piece_effect);

  const electricRef = dataset.sonatas.find(s => s.code === 'FLASH_OF_ELECTRIC_REFLECTION');
  assert.ok(electricRef, 'Flash of Electric Reflection must exist');
  assert.equal(electricRef.name, 'Flash of Electric Reflection');

  const tingedYearning = dataset.sonatas.find(s => s.code === 'FLOWER_OF_TINGED_YEARNING');
  assert.ok(tingedYearning, 'Flower of Tinged Yearning must exist');
  assert.equal(tingedYearning.name, 'Flower of Tinged Yearning');
});

test('Ingestion - Duplicate Sonata Code Rejected', () => {
  const dataset = loadTestDataset();
  const clone = JSON.parse(JSON.stringify(dataset.sonatas![0]));
  clone.name = 'Unique Sonata Name Clone';
  dataset.sonatas!.push(clone);

  const result = validatePatchDataset(dataset);
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some(e => e.message.includes('Duplicate sonata code')));
});

test('Ingestion - Patch-Consistent Gameplay-Effect References', () => {
  const dataset = loadTestDataset();
  for (const sonata of dataset.sonatas || []) {
    assert.ok(
      sonata.patch_data.two_piece_effect.category && sonata.patch_data.two_piece_effect.target,
      `Sonata ${sonata.name} 2pc effect missing valid taxonomy`
    );
    assert.ok(
      sonata.patch_data.five_piece_effect.category && sonata.patch_data.five_piece_effect.target,
      `Sonata ${sonata.name} 5pc effect missing valid taxonomy`
    );
  }
});

test('Ingestion - Deterministic UUID Generator Consistency', () => {
  const id1 = deterministicUuid('effect:test:1');
  const id2 = deterministicUuid('effect:test:1');
  const id3 = deterministicUuid('effect:test:2');

  assert.equal(id1, id2, 'Identical keys must produce identical UUIDs');
  assert.notEqual(id1, id3, 'Different keys must produce distinct UUIDs');
  assert.match(id1, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
});

test('Ingestion - Valid Enemy Parsing', () => {
  const dataset = loadTestDataset();
  assert.ok(dataset.enemies && dataset.enemies.length >= 60, 'Must have at least 60 enemies in dataset');
  assert.equal(dataset.enemies.length, 83, 'Patch 3.7 dataset must contain exactly 83 canonical enemies (70 existing + 13 ToA additions)');

  const classes = dataset.enemies.reduce((acc, e) => {
    acc[e.enemy_class] = (acc[e.enemy_class] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  assert.equal(classes.Calamity, 11, 'Must have 11 Calamity bosses');
  assert.equal(classes.Overlord, 5, 'Must have 5 Overlord bosses');
  assert.equal(classes.Elite, 28, 'Must have 28 Elite enemies');
  assert.equal(classes.Common, 39, 'Must have 39 Common enemies');

  // Verify key 3.7 additions
  assert.ok(dataset.enemies.some(e => e.name === 'Formrender' && e.enemy_class === 'Elite'));
  assert.ok(dataset.enemies.some(e => e.name === 'Soulfrayer' && e.enemy_class === 'Elite'));
  assert.ok(dataset.enemies.some(e => e.name === 'Skywatch Lancer' && e.enemy_class === 'Common'));
  assert.ok(dataset.enemies.some(e => e.name === 'Bloomburst Puppet' && e.enemy_class === 'Common'));
  assert.ok(dataset.enemies.some(e => e.name === 'Jade Nether Serpent' && e.enemy_class === 'Common'));
  assert.ok(dataset.enemies.some(e => e.name === 'Suhsin the Inevitable' && e.enemy_class === 'Calamity'));

  // Verify resistance completeness (7 elements per enemy)
  for (const enemy of dataset.enemies) {
    assert.ok(enemy.resistances, `Enemy ${enemy.name} must have resistances`);
    assert.equal(enemy.resistances.length, 7, `Enemy ${enemy.name} must have 7 elemental resistances`);
  }
});

test('Ingestion - Invalid Enemy Class Rejected', () => {
  const dataset = loadTestDataset();
  const corrupted = JSON.parse(JSON.stringify(dataset));
  corrupted.enemies[0].enemy_class = 'Mythic';

  const result = validatePatchDataset(corrupted);
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some(e => e.message.includes('Invalid enemy class: Mythic')));
});

test('Ingestion - Invalid Resistance Element Rejected', () => {
  const dataset = loadTestDataset();
  const corrupted = JSON.parse(JSON.stringify(dataset));
  corrupted.enemies[0].resistances[0].element = 'Dark';

  const result = validatePatchDataset(corrupted);
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some(e => e.message.includes('Invalid resistance element: Dark')));
});

test('Ingestion - Out-of-Range Resistance Rejected', () => {
  const dataset = loadTestDataset();
  const corruptedHigh = JSON.parse(JSON.stringify(dataset));
  corruptedHigh.enemies[0].resistances[0].resistance_ratio = 2.5;

  const resultHigh = validatePatchDataset(corruptedHigh);
  assert.equal(resultHigh.isValid, false);
  assert.ok(resultHigh.errors.some(e => e.message.includes('Resistance ratio must be a number between -1.0000 and 2.0000')));

  const corruptedLow = JSON.parse(JSON.stringify(dataset));
  corruptedLow.enemies[0].resistances[0].resistance_ratio = -1.5;

  const resultLow = validatePatchDataset(corruptedLow);
  assert.equal(resultLow.isValid, false);
  assert.ok(resultLow.errors.some(e => e.message.includes('Resistance ratio must be a number between -1.0000 and 2.0000')));
});

test('Ingestion - Invalid Modifier Type Rejected', () => {
  const dataset = loadTestDataset();
  const corrupted = JSON.parse(JSON.stringify(dataset));
  corrupted.enemies[0].modifiers.push({
    modifier_type: 'BERSERK_RAMPAGE',
    parameters: {},
    is_active: true,
    provenance_source_name: dataset.provenance_sources[0].source_name
  });

  const result = validatePatchDataset(corrupted);
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some(e => e.message.includes('Invalid modifier type: BERSERK_RAMPAGE')));
});

test('Ingestion - Missing Provenance on Enemy Data Rejected', () => {
  const dataset = loadTestDataset();
  const corrupted = JSON.parse(JSON.stringify(dataset));
  corrupted.enemies[0].resistances[0].provenance_source_name = 'Nonexistent Source';

  const result = validatePatchDataset(corrupted);
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some(e => e.message.includes('Missing or unregistered provenance source for resistance: Nonexistent Source')));
});

test('Ingestion - Duplicate Enemy Identity Rejected', () => {
  const dataset = loadTestDataset();
  const corrupted = JSON.parse(JSON.stringify(dataset));
  const clone = JSON.parse(JSON.stringify(corrupted.enemies[0]));
  corrupted.enemies.push(clone);

  const result = validatePatchDataset(corrupted);
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some(e => e.message.includes('Duplicate enemy identity') || e.message.includes('Duplicate enemy code')));
});

test('Ingestion - Deterministic UUID Generator for Enemies Consistency', () => {
  const id1 = deterministicUuid('enemy:CROWNLESS');
  const id2 = deterministicUuid('enemy:CROWNLESS');
  const id3 = deterministicUuid('enemy:BELL_BORNE_GEOCHELONE');

  assert.equal(id1, id2, 'Identical enemy codes must produce identical UUIDs');
  assert.notEqual(id1, id3, 'Distinct enemy codes must produce distinct UUIDs');
  assert.match(id1, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

  const resId1 = deterministicUuid('enemy_resistance:3.7:CROWNLESS:Havoc');
  const resId2 = deterministicUuid('enemy_resistance:3.7:CROWNLESS:Havoc');
  assert.equal(resId1, resId2);

  const modId1 = deterministicUuid('enemy_modifier:3.7:CROWNLESS:ENRAGE_RESISTANCE');
  const modId2 = deterministicUuid('enemy_modifier:3.7:CROWNLESS:ENRAGE_RESISTANCE');
  assert.equal(modId1, modId2);
});

test('Ingestion - Patch Consistency for Enemy Resistances and Modifiers', () => {
  const dataset = loadTestDataset();
  assert.equal(dataset.patch.version, '3.7');

  for (const enemy of dataset.enemies || []) {
    for (const res of enemy.resistances || []) {
      assert.ok(res.element, `Resistance must define element on enemy ${enemy.code}`);
      assert.ok(typeof res.resistance_ratio === 'number', `Resistance ratio must be numeric on enemy ${enemy.code}`);
      assert.ok(res.provenance_source_name, `Resistance must specify provenance on enemy ${enemy.code}`);
    }
    for (const mod of enemy.modifiers || []) {
      assert.ok(mod.modifier_type, `Modifier must specify modifier_type on enemy ${enemy.code}`);
      assert.ok(mod.provenance_source_name, `Modifier must specify provenance on enemy ${enemy.code}`);
    }
  }
});

test('Ingestion - Deterministic ToA Cycle Identity & Cross-Patch Compatibility', async () => {
  const supabase = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const cycleId1 = deterministicUuid('toa-cycle:season:40');
  const cycleId2 = deterministicUuid('toa-cycle:season:40');
  assert.equal(cycleId1, cycleId2, 'Same natural key must produce identical cycle ID repeatedly');

  // Verify cross-patch snapshot coexistence: Season 40 on Patch 3.6 and Patch 3.7
  const patch36Id = deterministicUuid('patch:3.6-test-fixture');
  const patch37Id = deterministicUuid('patch:3.7-test-fixture');

  try {
    const { error: patch36Error } = await supabase.from('patches').upsert({
      id: patch36Id,
      version: '3.6-test-fixture',
      release_date: '2026-08-15'
    }, { onConflict: 'version' });
    assert.equal(patch36Error, null, `Fixture patch 3.6 upsert error: ${patch36Error?.message}`);

    const { error: patch37Error } = await supabase.from('patches').upsert({
      id: patch37Id,
      version: '3.7-test-fixture',
      release_date: '2026-09-30'
    }, { onConflict: 'version' });
    assert.equal(patch37Error, null, `Fixture patch 3.7 upsert error: ${patch37Error?.message}`);

    // Insert Season 40 snapshot for 3.6
    const { error: cycle36Error } = await supabase.from('toa_cycles').upsert({
      id: cycleId1,
      patch_id: patch36Id,
      cycle_name: 'Hazard Zone (Season 40) - 3.6 Snapshot',
      start_time: '2026-09-14T04:00:00+08:00',
      end_time: '2026-10-12T03:59:59+08:00'
    }, { onConflict: 'id, patch_id' });
    assert.equal(cycle36Error, null, `Cycle 3.6 error: ${cycle36Error?.message}`);

    // Insert Season 40 snapshot for 3.7
    const { error: cycle37Error } = await supabase.from('toa_cycles').upsert({
      id: cycleId1,
      patch_id: patch37Id,
      cycle_name: 'Hazard Zone (Season 40) - 3.7 Snapshot',
      start_time: '2026-09-14T04:00:00+08:00',
      end_time: '2026-10-12T03:59:59+08:00'
    }, { onConflict: 'id, patch_id' });
    assert.equal(cycle37Error, null, `Cycle 3.7 error: ${cycle37Error?.message}`);

    // Verify both snapshots coexist with the same logical cycle ID
    const { data: rows, error: selectError } = await supabase
      .from('toa_cycles')
      .select('id, patch_id, cycle_name')
      .eq('id', cycleId1);

    assert.equal(selectError, null);
    assert.ok(rows && rows.length >= 2, 'Both patch snapshots must coexist for the same logical cycle');
  } finally {
    // Clean up test fixtures in correct order (child before parent)
    await supabase.from('toa_cycles').delete().in('patch_id', [patch36Id, patch37Id]);
    await supabase.from('patches').delete().in('id', [patch36Id, patch37Id]);
  }
});

test('Ingestion - ToA Structure Validation (Towers, Floors, Costs, Goals)', () => {
  const dataset = loadTestDataset();
  assert.ok(dataset.toa_cycles && dataset.toa_cycles.length === 1);

  const cycle = dataset.toa_cycles[0];
  assert.equal(cycle.cycle_code, 'season:40');
  assert.equal(cycle.cycle_name, 'Hazard Zone (Season 40)');
  assert.equal(cycle.zones.length, 1);

  const zone = cycle.zones[0];
  assert.equal(zone.zone_type, 'HazardZone');
  assert.equal(zone.towers.length, 3, 'Must have exactly 3 towers');

  const resonant = zone.towers.find(t => t.tower_order === 1);
  const hazard = zone.towers.find(t => t.tower_order === 2);
  const echoing = zone.towers.find(t => t.tower_order === 3);

  assert.ok(resonant && hazard && echoing, 'Must contain Resonant, Hazard, and Echoing towers');
  assert.equal(resonant.stages.length, 4);
  assert.equal(hazard.stages.length, 4);
  assert.equal(echoing.stages.length, 4);

  // Vigor costs: Resonant [1,2,3,4], Hazard [5,5,5,5], Echoing [1,2,3,4] -> Total = 40
  assert.deepEqual(resonant.stages.map(s => s.vigor_cost), [1, 2, 3, 4]);
  assert.deepEqual(hazard.stages.map(s => s.vigor_cost), [5, 5, 5, 5]);
  assert.deepEqual(echoing.stages.map(s => s.vigor_cost), [1, 2, 3, 4]);

  const totalVigor = zone.towers.reduce(
    (sum, t) => sum + t.stages.reduce((sSum, st) => sSum + st.vigor_cost, 0),
    0
  );
  assert.equal(totalVigor, 40, 'Total Vigor across all 12 stages must be exactly 40');

  // Challenge goal thresholds
  assert.deepEqual(resonant.stages[0].challenge_goals.map(g => g.target_time_seconds), [0, 90, 150]);
  assert.deepEqual(resonant.stages[1].challenge_goals.map(g => g.target_time_seconds), [0, 90, 150]);
  assert.deepEqual(resonant.stages[2].challenge_goals.map(g => g.target_time_seconds), [0, 120, 180]);
  assert.deepEqual(resonant.stages[3].challenge_goals.map(g => g.target_time_seconds), [0, 120, 180]);

  assert.deepEqual(hazard.stages[0].challenge_goals.map(g => g.target_time_seconds), [90, 150, 180]);
  assert.deepEqual(hazard.stages[1].challenge_goals.map(g => g.target_time_seconds), [90, 150, 180]);
  assert.deepEqual(hazard.stages[2].challenge_goals.map(g => g.target_time_seconds), [60, 120, 150]);
  assert.deepEqual(hazard.stages[3].challenge_goals.map(g => g.target_time_seconds), [60, 120, 150]);

  assert.deepEqual(echoing.stages[0].challenge_goals.map(g => g.target_time_seconds), [0, 90, 150]);
  assert.deepEqual(echoing.stages[1].challenge_goals.map(g => g.target_time_seconds), [0, 90, 150]);
  assert.deepEqual(echoing.stages[2].challenge_goals.map(g => g.target_time_seconds), [0, 120, 180]);
  assert.deepEqual(echoing.stages[3].challenge_goals.map(g => g.target_time_seconds), [0, 120, 180]);

  // Completion goal semantics: target_time_seconds === 0 (not 1)
  assert.equal(resonant.stages[0].challenge_goals[0].target_time_seconds, 0);
  assert.equal(echoing.stages[0].challenge_goals[0].target_time_seconds, 0);

  // Area effects preservation
  assert.deepEqual(resonant.stages[0].area_effect_source_ids, ['92007113', '92008110']);
  assert.deepEqual(hazard.stages[2].area_effect_source_ids, ['92008205', '92008196', '92008197']);
  assert.deepEqual(echoing.stages[0].area_effect_source_ids, ['92007115', '92008030']);

  // Enemy instances count
  let enemyInstanceCount = 0;
  for (const t of zone.towers) {
    for (const s of t.stages) {
      for (const w of s.waves) {
        enemyInstanceCount += w.enemy_instances.length;
      }
    }
  }
  assert.equal(enemyInstanceCount, 27, 'Total enemy instances across 12 stages must be 27');
});

test('Ingestion - Validation Layer Rejects Negative Target Time Seconds', () => {
  const dataset = loadTestDataset();
  const corrupted = JSON.parse(JSON.stringify(dataset));
  corrupted.toa_cycles[0].zones[0].towers[0].stages[0].challenge_goals[0].target_time_seconds = -1;

  const result = validatePatchDataset(corrupted);
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some(e => e.message.includes('target_time_seconds must be a non-negative integer (>= 0)')));
});

test('Ingestion - Deterministic Ingestion & Idempotency Guarantee', async () => {
  const supabase = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const dataset = loadTestDataset();

  // First ingestion execution
  const firstReport = await ingestPatchDataset(dataset, supabase);
  assert.equal(firstReport.success, true);
  assert.equal(firstReport.counts.resonators, 60);

  // Helper to fetch total row counts across all canonical game tables
  async function fetchCanonicalTableCounts() {
    const [
      patches,
      provenance,
      roles,
      tags,
      resonators,
      patchData,
      resonatorRoles,
      resonatorTags,
      abilities,
      abilityPatchData,
      gameplayEffects,
      abilityEffects,
      weapons,
      weaponPatchData,
      echoes,
      echoPatchData,
      sonatas,
      sonataPatchData,
      enemies,
      enemyResistances,
      enemyModifiers,
      areaEffects,
      toaCycles,
      toaZones,
      toaTowers,
      toaStages,
      stageAreaEffects,
      challengeGoals,
      toaWaves,
      toaEnemyInstances
    ] = await Promise.all([
      supabase.from('patches').select('count', { count: 'exact' }),
      supabase.from('provenance_sources').select('count', { count: 'exact' }),
      supabase.from('functional_roles').select('count', { count: 'exact' }),
      supabase.from('combat_tags').select('count', { count: 'exact' }),
      supabase.from('resonators').select('count', { count: 'exact' }),
      supabase.from('resonator_patch_data').select('count', { count: 'exact' }),
      supabase.from('resonator_roles').select('count', { count: 'exact' }),
      supabase.from('resonator_combat_tags').select('count', { count: 'exact' }),
      supabase.from('abilities').select('count', { count: 'exact' }),
      supabase.from('ability_patch_data').select('count', { count: 'exact' }),
      supabase.from('gameplay_effects').select('count', { count: 'exact' }),
      supabase.from('ability_effects').select('count', { count: 'exact' }),
      supabase.from('weapons').select('count', { count: 'exact' }),
      supabase.from('weapon_patch_data').select('count', { count: 'exact' }),
      supabase.from('echoes').select('count', { count: 'exact' }),
      supabase.from('echo_patch_data').select('count', { count: 'exact' }),
      supabase.from('sonatas').select('count', { count: 'exact' }),
      supabase.from('sonata_patch_data').select('count', { count: 'exact' }),
      supabase.from('enemies').select('count', { count: 'exact' }),
      supabase.from('enemy_resistances').select('count', { count: 'exact' }),
      supabase.from('enemy_modifiers').select('count', { count: 'exact' }),
      supabase.from('area_effects').select('count', { count: 'exact' }),
      supabase.from('toa_cycles').select('count', { count: 'exact' }),
      supabase.from('toa_zones').select('count', { count: 'exact' }),
      supabase.from('toa_towers').select('count', { count: 'exact' }),
      supabase.from('toa_stages').select('count', { count: 'exact' }),
      supabase.from('stage_area_effects').select('count', { count: 'exact' }),
      supabase.from('challenge_goals').select('count', { count: 'exact' }),
      supabase.from('toa_waves').select('count', { count: 'exact' }),
      supabase.from('toa_enemy_instances').select('count', { count: 'exact' })
    ]);

    return {
      patches: patches.count,
      provenance: provenance.count,
      roles: roles.count,
      tags: tags.count,
      resonators: resonators.count,
      patchData: patchData.count,
      resonatorRoles: resonatorRoles.count,
      resonatorTags: resonatorTags.count,
      abilities: abilities.count,
      abilityPatchData: abilityPatchData.count,
      gameplayEffects: gameplayEffects.count,
      abilityEffects: abilityEffects.count,
      weapons: weapons.count,
      weaponPatchData: weaponPatchData.count,
      echoes: echoes.count,
      echoPatchData: echoPatchData.count,
      sonatas: sonatas.count,
      sonataPatchData: sonataPatchData.count,
      enemies: enemies.count,
      enemyResistances: enemyResistances.count,
      enemyModifiers: enemyModifiers.count,
      areaEffects: areaEffects.count,
      toaCycles: toaCycles.count,
      toaZones: toaZones.count,
      toaTowers: toaTowers.count,
      toaStages: toaStages.count,
      stageAreaEffects: stageAreaEffects.count,
      challengeGoals: challengeGoals.count,
      toaWaves: toaWaves.count,
      toaEnemyInstances: toaEnemyInstances.count
    };
  }

  const countsAfterFirst = await fetchCanonicalTableCounts();

  // Assert expected non-zero counts
  assert.equal(countsAfterFirst.patches, 1);
  assert.equal(countsAfterFirst.resonators, 60);
  assert.equal(countsAfterFirst.patchData, 60);
  assert.ok(countsAfterFirst.abilities! >= 500);
  assert.ok(countsAfterFirst.gameplayEffects! >= 70);
  assert.ok(countsAfterFirst.weapons! >= 60);
  assert.ok(countsAfterFirst.weaponPatchData! >= 60);
  assert.ok(countsAfterFirst.echoes! >= 40);
  assert.ok(countsAfterFirst.echoPatchData! >= 40);
  assert.equal(countsAfterFirst.sonatas, 12);
  assert.equal(countsAfterFirst.sonataPatchData, 12);
  assert.equal(countsAfterFirst.enemies, 83);
  assert.equal(countsAfterFirst.enemyResistances, 581);
  assert.equal(countsAfterFirst.enemyModifiers, 30);
  assert.equal(countsAfterFirst.areaEffects, 11);
  assert.equal(countsAfterFirst.toaCycles, 1);
  assert.equal(countsAfterFirst.toaZones, 1);
  assert.equal(countsAfterFirst.toaTowers, 3);
  assert.equal(countsAfterFirst.toaStages, 12);
  assert.equal(countsAfterFirst.stageAreaEffects, 26);
  assert.equal(countsAfterFirst.challengeGoals, 36);
  assert.equal(countsAfterFirst.toaWaves, 12);
  assert.equal(countsAfterFirst.toaEnemyInstances, 27);

  // Second ingestion execution (Idempotency test)
  const secondReport = await ingestPatchDataset(dataset, supabase);
  assert.equal(secondReport.success, true);

  const countsAfterSecond = await fetchCanonicalTableCounts();

  // Assert EXACT count equality: running twice produces ZERO duplicate rows
  assert.deepEqual(
    countsAfterSecond,
    countsAfterFirst,
    'Idempotency violation: running ingestion twice modified row counts'
  );
});
