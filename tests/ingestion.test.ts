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

test('Ingestion - Deterministic UUID Generator Consistency', () => {
  const id1 = deterministicUuid('effect:test:1');
  const id2 = deterministicUuid('effect:test:1');
  const id3 = deterministicUuid('effect:test:2');

  assert.equal(id1, id2, 'Identical keys must produce identical UUIDs');
  assert.notEqual(id1, id3, 'Different keys must produce distinct UUIDs');
  assert.match(id1, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
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
      abilityEffects
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
      supabase.from('ability_effects').select('count', { count: 'exact' })
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
      abilityEffects: abilityEffects.count
    };
  }

  const countsAfterFirst = await fetchCanonicalTableCounts();

  // Assert expected non-zero counts
  assert.equal(countsAfterFirst.patches, 1);
  assert.equal(countsAfterFirst.resonators, 60);
  assert.equal(countsAfterFirst.patchData, 60);
  assert.ok(countsAfterFirst.abilities! >= 500);
  assert.ok(countsAfterFirst.gameplayEffects! >= 70);

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
