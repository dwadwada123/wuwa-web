import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import child_process from 'node:child_process';
import { validatePatchDataset } from '../lib/ingestion/validation.ts';
import { deterministicUuid } from '../lib/ingestion/engine.ts';
import type { PatchDataset, SourceType } from '../lib/ingestion/types.ts';

function loadGoldenDataset(): PatchDataset {
  const filePath = path.resolve('data/patches/3.7/patch_3_7_dataset.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const RFC4122_V4_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  assert.strictEqual(result.isValid, false, 'Dataset with broken provenance source_name must fail');
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

test('Patch Pipeline: Rejects bad patch references and invalid version format', () => {
  const dataset = loadGoldenDataset();

  // Test malformed release date
  const corruptedDate = JSON.parse(JSON.stringify(dataset));
  corruptedDate.patch.release_date = 'invalid-not-iso-date';
  const resultDate = validatePatchDataset(corruptedDate);
  assert.strictEqual(resultDate.isValid, false, 'Inconsistent patch release date must fail');
  assert.ok(resultDate.errors.some((e) => e.message.includes('Invalid patch release_date')));

  // Test malformed version string
  const corruptedVersion = JSON.parse(JSON.stringify(dataset));
  corruptedVersion.patch.version = 'v3.7-beta';
  const resultVersion = validatePatchDataset(corruptedVersion);
  assert.strictEqual(resultVersion.isValid, false, 'Non-semver patch version must fail');
  assert.ok(resultVersion.errors.some((e) => e.message.includes('Invalid patch version')));
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

test('Patch Pipeline: Rejects unknown area effect and unknown enemy references in ToA stages', () => {
  const dataset = loadGoldenDataset();

  // 1. Unknown area effect reference
  const corruptedAe = JSON.parse(JSON.stringify(dataset));
  corruptedAe.toa_cycles[0].zones[0].towers[0].stages[0].area_effect_source_ids = ['non_existent_area_effect'];
  const resAe = validatePatchDataset(corruptedAe);
  assert.strictEqual(resAe.isValid, false);
  assert.ok(resAe.errors.some((e) => e.message.includes('Unknown area_effect source_id')));

  // 2. Unknown enemy code in wave
  const corruptedEnemy = JSON.parse(JSON.stringify(dataset));
  corruptedEnemy.toa_cycles[0].zones[0].towers[0].stages[0].waves[0].enemy_instances[0].enemy_code = 'UNKNOWN_BOSS_CODE';
  const resEnemy = validatePatchDataset(corruptedEnemy);
  assert.strictEqual(resEnemy.isValid, false);
  assert.ok(resEnemy.errors.some((e) => e.message.includes('Unknown enemy_code')));
});

test('Patch Pipeline: Rejects inverted cycle start and end times', () => {
  const dataset = loadGoldenDataset();
  const corrupted = JSON.parse(JSON.stringify(dataset));
  corrupted.toa_cycles[0].start_time = '2026-11-01T00:00:00Z';
  corrupted.toa_cycles[0].end_time = '2026-10-01T00:00:00Z';

  const result = validatePatchDataset(corrupted);
  assert.strictEqual(result.isValid, false);
  assert.ok(result.errors.some((e) => e.message.includes('end_time must be after start_time')));
});

test('Patch Pipeline: Deterministic ID Audit — Repeatability, Sensitivity, Stability, and RFC 4122 v4', () => {
  // 1. Repeatability (100 iterations produce byte-for-byte identical UUID)
  const key = 'resonator:Jinhsi';
  const baseId = deterministicUuid(key);
  for (let i = 0; i < 100; i++) {
    assert.strictEqual(deterministicUuid(key), baseId, 'Deterministic ID must be 100% repeatable');
  }

  // 2. Sensitivity (changing single character produces completely different UUID)
  const variantId = deterministicUuid('resonator:Jinhsj');
  assert.notStrictEqual(baseId, variantId, 'Varying natural key must alter generated UUID');

  // 3. RFC 4122 v4 format compliance
  assert.match(baseId, RFC4122_V4_UUID_REGEX, 'Must conform to RFC 4122 v4 UUID format');
  assert.match(variantId, RFC4122_V4_UUID_REGEX, 'Must conform to RFC 4122 v4 UUID format');

  // 4. Multi-domain stability verification
  const domainKeys = [
    'provenance:Kuro Games Official 3.7 Release Announcement',
    'enemy:THUNDERING_MEACOIS',
    'enemy_resistance:3.7:THUNDERING_MEACOIS:Electro',
    'enemy_modifier:3.7:THUNDERING_MEACOIS:ENRAGE_RESISTANCE',
    'gameplay_effect:3.7:Jinhsi:A2_SKILL:1',
    'gameplay_effect:weapon:3.7:Ages of Harvest',
    'gameplay_effect:echo:3.7:Jue',
    'gameplay_effect:sonata:3.7:CELESTIAL_LIGHT:2pc',
    'area_effect:ae_s40_hazard_4',
    'toa-cycle:SEASON_40',
    'toa-zone:SEASON_40:HazardZone',
    'toa-tower:SEASON_40:HazardZone:1',
    'toa-stage:SEASON_40:1:4'
  ];

  for (const domKey of domainKeys) {
    const uuid = deterministicUuid(domKey);
    assert.match(uuid, RFC4122_V4_UUID_REGEX, `Domain key ${domKey} must generate valid RFC 4122 v4 UUID`);
    assert.strictEqual(uuid, deterministicUuid(domKey), `Repeated UUID generation for ${domKey} must be identical`);
  }
});

test('Patch Pipeline: Provenance Audit — Golden 3.7 dataset adheres to 5-tier taxonomy', () => {
  const dataset = loadGoldenDataset();
  const validSourceTypes: Set<SourceType> = new Set([
    'OFFICIAL_PUBLISHED',
    'OFFICIAL_DATAMINE',
    'COMMUNITY_DATAMINE',
    'LIVE_OBSERVATION',
    'COMMUNITY_VERIFIED'
  ]);

  // Verify all sources in 3.7 are valid
  for (const source of dataset.provenance_sources) {
    assert.ok(
      validSourceTypes.has(source.source_type as SourceType),
      `Source ${source.source_name} has invalid source_type: ${source.source_type}`
    );

    // Verify community datamines are never mislabeled as official
    if (source.source_name.toLowerCase().includes('datamine') && !source.source_name.toLowerCase().includes('kuro')) {
      assert.strictEqual(
        source.source_type,
        'COMMUNITY_DATAMINE',
        `Community datamine ${source.source_name} must NOT be labeled as OFFICIAL_PUBLISHED`
      );
    }
  }

  // Corrupt with invalid source type (e.g. UNVERIFIED_LEAK)
  const corrupted = JSON.parse(JSON.stringify(dataset));
  corrupted.provenance_sources[0].source_type = 'UNVERIFIED_LEAK';
  const result = validatePatchDataset(corrupted);
  assert.strictEqual(result.isValid, false);
  assert.ok(result.errors.some((e) => e.message.includes('Invalid source_type')));
});

test('Patch Pipeline: ToA Cross-Patch Test — Logical Cycle Identity + Patch Snapshot A & B Coexistence', () => {
  // Logical cycle identity
  const logicalCycleKey = 'toa-cycle:SEASON_SYNTHETIC_TEST';
  const logicalCycleId = deterministicUuid(logicalCycleKey);

  // Snapshot A: Patch 3.7
  const patch37Id = '11111111-1111-1111-1111-111111111111';
  const snapshotA_StageId = deterministicUuid(`toa-stage:SEASON_SYNTHETIC_TEST:1:4`);
  const snapshotA_Record = {
    cycle_id: logicalCycleId,
    patch_id: patch37Id,
    stage_id: snapshotA_StageId,
    vigor_cost: 4
  };

  // Snapshot B: Synthetic Patch 3.8
  const patch38Id = deterministicUuid('patch:3.8');
  const snapshotB_StageId = deterministicUuid(`toa-stage:SEASON_SYNTHETIC_TEST:1:4`);
  const snapshotB_Record = {
    cycle_id: logicalCycleId,
    patch_id: patch38Id,
    stage_id: snapshotB_StageId,
    vigor_cost: 3 // modified vigor in patch 3.8
  };

  // 1. Both snapshots reference the exact same logical cycle ID
  assert.strictEqual(snapshotA_Record.cycle_id, snapshotB_Record.cycle_id);

  // 2. Primary / foreign keys composite uniqueness: (id, patch_id) are distinct
  assert.notStrictEqual(snapshotA_Record.patch_id, snapshotB_Record.patch_id);

  // 3. Coexistence in composite map without collision
  const compositeKeyA = `${snapshotA_Record.stage_id}::${snapshotA_Record.patch_id}`;
  const compositeKeyB = `${snapshotB_Record.stage_id}::${snapshotB_Record.patch_id}`;
  assert.notStrictEqual(compositeKeyA, compositeKeyB, 'Composite stage records must not collide across patches');

  const snapshotMap = new Map<string, typeof snapshotA_Record>();
  snapshotMap.set(compositeKeyA, snapshotA_Record);
  snapshotMap.set(compositeKeyB, snapshotB_Record);
  assert.strictEqual(snapshotMap.size, 2, 'Both snapshots must cleanly coexist without ambiguity');
});

test('Patch Pipeline: Patch Isolation — In-Memory Synthetic 3.8 Fixture Leaves 3.7 Records 100% Untouched', () => {
  const dataset37 = loadGoldenDataset();
  const jinhsiId37 = deterministicUuid('resonator:Jinhsi');
  const weaponId37 = deterministicUuid('weapon:Ages of Harvest');
  const effectId37 = deterministicUuid('gameplay_effect:3.7:Jinhsi:A2_SKILL:1');

  // Construct synthetic in-memory 3.8 fixture (NEVER written to disk or database)
  const synthetic38: PatchDataset = JSON.parse(JSON.stringify(dataset37));
  synthetic38.patch.version = '3.8';
  synthetic38.patch.release_date = '2026-11-12';
  synthetic38.patch.notes = 'Synthetic 3.8 In-Memory Regression Test Fixture';

  // Add new 3.8 resonator
  synthetic38.resonators.push({
    name: 'SyntheticHero38',
    element: 'Aero',
    weapon_type: 'Broadblade',
    rarity: 5,
    release_date: '2026-11-12',
    patch_data: {
      base_hp_lvl90: 10800,
      base_atk_lvl90: 450,
      base_def_lvl90: 1150,
      provenance_source_name: synthetic38.provenance_sources[0].source_name,
      roles: [{ code: 'MAIN_DPS', is_primary: true }],
      combat_tags: ['AERO_DMG_AMP'],
    },
    abilities: [],
  });

  // Validate synthetic 3.8 fixture in memory
  const validation38 = validatePatchDataset(synthetic38);
  assert.strictEqual(validation38.isValid, true, 'Synthetic 3.8 in-memory dataset must pass validation');

  // Verify that all 3.7 entities retain exact deterministic keys
  assert.strictEqual(deterministicUuid('resonator:Jinhsi'), jinhsiId37);
  assert.strictEqual(deterministicUuid('weapon:Ages of Harvest'), weaponId37);
  assert.strictEqual(deterministicUuid('gameplay_effect:3.7:Jinhsi:A2_SKILL:1'), effectId37);

  // Verify that 3.8 patch-scoped gameplay effects are isolated from 3.7
  const effectId38 = deterministicUuid('gameplay_effect:3.8:Jinhsi:A2_SKILL:1');
  assert.notStrictEqual(effectId37, effectId38, 'Gameplay effects across patches must have distinct deterministic IDs');

  // Verify no disk file exists for 3.8
  assert.strictEqual(fs.existsSync(path.resolve('data/patches/3.8')), false, 'No permanent 3.8 data directory must exist');
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
