import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import child_process from 'node:child_process';
import { validatePatchDataset } from '../lib/ingestion/validation.ts';
import { deterministicUuid } from '../lib/ingestion/engine.ts';
import type { PatchDataset } from '../lib/ingestion/types.ts';

function loadGoldenDataset(): PatchDataset {
  const filePath = path.resolve('data/patches/3.7/patch_3_7_dataset.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

test('Patch Pipeline: Golden 3.7 dataset passes strict validation', () => {
  const dataset = loadGoldenDataset();
  const result = validatePatchDataset(dataset);
  assert.strictEqual(result.isValid, true, 'Golden 3.7 dataset must be 100% valid');
  assert.strictEqual(result.errors.length, 0);
  assert.strictEqual(dataset.patch.version, '3.7');
  assert.strictEqual(dataset.patch.release_date, '2026-09-30');
});

test('Patch Pipeline: Rejects dataset with missing provenance', () => {
  const dataset = loadGoldenDataset();
  const corrupted = JSON.parse(JSON.stringify(dataset));
  corrupted.resonators[0].patch_data.provenance_source_name = 'Unregistered Provenance Source';

  const result = validatePatchDataset(corrupted);
  assert.strictEqual(result.isValid, false, 'Dataset with broken provenance source_id must fail');
  assert.ok(
    result.errors.some((e) => e.message.toLowerCase().includes('provenance')),
    'Must report missing provenance error'
  );
});

test('Patch Pipeline: Rejects duplicate natural keys in entities', () => {
  const dataset = loadGoldenDataset();
  const corrupted = JSON.parse(JSON.stringify(dataset));
  const clone = JSON.parse(JSON.stringify(corrupted.resonators[0]));
  corrupted.resonators.push(clone);

  const result = validatePatchDataset(corrupted);
  assert.strictEqual(result.isValid, false, 'Duplicate resonator must fail');
  assert.ok(
    result.errors.some((e) => e.message.toLowerCase().includes('duplicate')),
    'Must report duplicate error'
  );
});

test('Patch Pipeline: Rejects bad patch references', () => {
  const dataset = loadGoldenDataset();
  const corrupted = JSON.parse(JSON.stringify(dataset));
  corrupted.patch.release_date = 'invalid-not-iso-date';

  const result = validatePatchDataset(corrupted);
  assert.strictEqual(result.isValid, false, 'Inconsistent patch release date must fail');
  assert.ok(result.errors.some((e) => e.message.includes('Invalid patch release_date')));
});

test('Patch Pipeline: Rejects invalid enum values', () => {
  const dataset = loadGoldenDataset();
  const corrupted = JSON.parse(JSON.stringify(dataset));
  corrupted.weapons[0].weapon_type = 'LaserGun';

  const result = validatePatchDataset(corrupted);
  assert.strictEqual(result.isValid, false);
  assert.ok(
    result.errors.some((e) => e.message.toLowerCase().includes('weapon type')),
    'Must reject invalid enum'
  );
});

test('Patch Pipeline: Rejects malformed stage references and invalid challenge goals', () => {
  const dataset = loadGoldenDataset();
  const corrupted = JSON.parse(JSON.stringify(dataset));
  corrupted.toa_cycles[0].zones[0].towers[0].stages[0].challenge_goals[0].target_time_seconds = -1;

  const result = validatePatchDataset(corrupted);
  assert.strictEqual(result.isValid, false, 'Negative challenge goal time must fail');
  assert.ok(
    result.errors.some((e) => e.message.includes('target_time_seconds must be a non-negative integer')),
    'Must report target time error'
  );
});

test('Patch Pipeline: Deterministic ID generator produces identical UUIDs for identical natural keys', () => {
  const id1 = deterministicUuid('resonator:Jinhsi');
  const id2 = deterministicUuid('resonator:Jinhsi');
  const idDiff = deterministicUuid('resonator:Changli');

  assert.strictEqual(id1, id2, 'Same natural key must produce identical UUIDs');
  assert.notStrictEqual(id1, idDiff, 'Different natural keys must produce distinct UUIDs');

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  assert.match(id1, uuidRegex, 'Generated ID must be a valid RFC 4122 v4 UUID format');
});

test('Patch Pipeline: ToA Snapshot Cross-Patch Semantics (Same logical cycle under 3.7 and 3.8)', () => {
  const logicalCycleKey = 'toa_cycles:season_40';
  const cycleId = deterministicUuid(logicalCycleKey);

  const snapshot37Id = deterministicUuid(`toa_snapshots:${cycleId}::3.7`);
  const snapshot38Id = deterministicUuid(`toa_snapshots:${cycleId}::3.8`);

  assert.strictEqual(
    cycleId,
    deterministicUuid('toa_cycles:season_40'),
    'Logical cycle ID remains invariant across patches'
  );
  assert.notStrictEqual(
    snapshot37Id,
    snapshot38Id,
    'Patch snapshots must be uniquely distinguished by (cycle_id, patch_id)'
  );
});

test('Patch Pipeline: Patch Isolation — synthetic 3.8 fixture leaves 3.7 identities intact', () => {
  const dataset37 = loadGoldenDataset();
  const jinhsiId37 = deterministicUuid('resonator:Jinhsi');

  // Clone 3.7 to construct a synthetic 3.8 patch dataset
  const synthetic38: PatchDataset = JSON.parse(JSON.stringify(dataset37));
  synthetic38.patch.version = '3.8';
  synthetic38.patch.release_date = '2026-11-12';

  // Add a new resonator in 3.8
  synthetic38.resonators.push({
    name: 'NewResonator38',
    element: 'Aero',
    weapon_type: 'Broadblade',
    rarity: 5,
    release_date: '2026-11-12',
    patch_data: {
      base_hp_lvl90: 10500,
      base_atk_lvl90: 440,
      base_def_lvl90: 1100,
      provenance_source_name: synthetic38.provenance_sources[0].source_name,
      roles: [{ code: 'MAIN_DPS', is_primary: true }],
      combat_tags: ['AERO_DMG_AMP'],
    },
    abilities: [],
  });

  const validation38 = validatePatchDataset(synthetic38);
  assert.strictEqual(validation38.isValid, true, 'Synthetic 3.8 dataset must validate cleanly');

  // Verify that Jinhsi ID for 3.7 remains unchanged
  const jinhsiIdPost = deterministicUuid('resonator:Jinhsi');
  assert.strictEqual(jinhsiId37, jinhsiIdPost, 'Patch 3.7 entity IDs must remain 100% stable');

  const newResonatorId = deterministicUuid('resonator:NewResonator38');
  assert.notStrictEqual(jinhsiId37, newResonatorId);
});

test('Patch Pipeline: Remote Ingestion Guard requires explicit --confirm-remote', () => {
  const proc = child_process.spawnSync(
    process.execPath,
    ['--experimental-strip-types', 'scripts/ingest.ts', '--target', 'remote'],
    { encoding: 'utf8' }
  );
  assert.strictEqual(proc.status, 1);
  assert.ok(proc.stderr.includes('--confirm-remote'));
});
