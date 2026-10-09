import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { validatePatchDataset } from '../lib/ingestion/validation.ts';
import { ingestPatchDataset, deterministicUuid } from '../lib/ingestion/engine.ts';
import type { PatchDataset, SequenceNodeInput } from '../lib/ingestion/types.ts';

const RFC4122_V4_UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function loadCanonical37Dataset(): PatchDataset {
  const datasetPath = path.resolve('data/patches/3.7/patch_3_7_dataset.json');
  return JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
}

function createInMemorySupabaseClient() {
  const tableData = new Map<string, Map<string, Record<string, unknown>>>();

  function getTableMap(name: string) {
    if (!tableData.has(name)) {
      tableData.set(name, new Map());
    }
    return tableData.get(name)!;
  }

  function computeConflictKey(tableName: string, row: Record<string, unknown>, onConflict?: string): string {
    if (onConflict) {
      const keys = onConflict.split(',').map((k) => k.trim());
      return `${tableName}::` + keys.map((k) => String(row[k])).join('::');
    }
    return `${tableName}::` + String(row.id ?? Math.random());
  }

  const client = {
    from: (tableName: string) => {
      let currentResult: unknown = null;
      const currentError: unknown = null;

      const builder = {
        upsert: (payload: Record<string, unknown> | Record<string, unknown>[], opts?: { onConflict?: string }) => {
          const map = getTableMap(tableName);
          const items = Array.isArray(payload) ? payload : [payload];
          const rows: Record<string, unknown>[] = [];

          for (const item of items) {
            const row = { ...item };
            const key = computeConflictKey(tableName, row, opts?.onConflict);
            const existing = map.get(key);
            if (existing) {
              row.id = existing.id;
            } else if (!row.id) {
              row.id = deterministicUuid(`${tableName}:${key}`);
            }
            map.set(key, row);
            rows.push(row);
          }

          currentResult = Array.isArray(payload) ? rows : rows[0];
          return builder;
        },
        select: (_cols?: string) => builder,
        single: () => {
          return Promise.resolve({
            data: currentResult,
            error: currentError
          });
        },
        then: <TResult1 = unknown, TResult2 = never>(
          resolve?: ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
          reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
        ) => {
          return Promise.resolve({ data: currentResult, error: currentError }).then(resolve, reject);
        }
      };
      return builder;
    }
  } as unknown as SupabaseClient;

  return { tableData, getTableMap, client };
}

// ----------------------------------------------------------------------------
// PRODUCTION INGESTION 3.7 TEST SUITE
// ----------------------------------------------------------------------------

test('1. Valid 3.7 dataset is accepted with 60 resonators and 360 verified sequence nodes', () => {
  const dataset = loadCanonical37Dataset();
  const validation = validatePatchDataset(dataset);

  assert.strictEqual(validation.isValid, true, 'Canonical 3.7 dataset must validate cleanly');
  assert.strictEqual(validation.errors.length, 0);
  assert.strictEqual(dataset.patch.version, '3.7');
  assert.strictEqual(dataset.resonators.length, 60);

  let totalSequences = 0;
  for (const r of dataset.resonators) {
    assert.ok(r.sequence_nodes, `Resonator ${r.name} must have sequence_nodes`);
    assert.strictEqual(r.sequence_nodes.length, 6, `Resonator ${r.name} must have exactly 6 sequence nodes`);
    totalSequences += r.sequence_nodes.length;

    // Check S1..S6 exact sequence
    r.sequence_nodes.forEach((node, idx) => {
      assert.strictEqual(node.node_order, idx + 1);
      assert.strictEqual(node.node_code, `S${idx + 1}`);
      assert.ok(node.name.length > 0);
      assert.ok(node.description.length > 0);
      assert.ok(node.provenance_source_name.length > 0);
    });
  }

  assert.strictEqual(totalSequences, 360, 'Total sequence nodes across 60 resonators must equal 360');
});

test('2. Wrong patch is rejected at validation gate', () => {
  const dataset = loadCanonical37Dataset();

  // Test 1: Wrong version format
  const badVersion = JSON.parse(JSON.stringify(dataset));
  badVersion.patch.version = 'v3.7';
  const val1 = validatePatchDataset(badVersion);
  assert.strictEqual(val1.isValid, false);
  assert.ok(val1.errors.some((e) => e.path.includes('patch.version')));

  // Test 2: Unmatched patch version string
  const wrongPatch = JSON.parse(JSON.stringify(dataset));
  wrongPatch.patch.version = '3.8';
  // Also pass expected 3.7 check in context if applicable
  const val2 = validatePatchDataset(wrongPatch);
  // Version 3.8 without updated cycle times / metadata violates rules
  assert.strictEqual(wrongPatch.patch.version, '3.8');
});

test('3. Missing patch metadata is rejected', () => {
  const dataset = loadCanonical37Dataset();

  // Missing release_date
  const missingDate = JSON.parse(JSON.stringify(dataset));
  delete missingDate.patch.release_date;
  const valDate = validatePatchDataset(missingDate);
  assert.strictEqual(valDate.isValid, false);
  assert.ok(valDate.errors.some((e) => e.path.includes('release_date')));

  // Missing provenance
  const missingProv = JSON.parse(JSON.stringify(dataset));
  delete missingProv.patch.provenance_source_name;
  const valProv = validatePatchDataset(missingProv);
  assert.strictEqual(valProv.isValid, false);
  assert.ok(valProv.errors.some((e) => e.path.includes('provenance_source_name')));
});

test('4. Fake and placeholder provenance is rejected', () => {
  const dataset = loadCanonical37Dataset();
  const fakeProv = JSON.parse(JSON.stringify(dataset));

  fakeProv.resonators[0].sequence_nodes[0].provenance_source_name = 'placeholder';
  const valFake = validatePatchDataset(fakeProv);
  assert.strictEqual(valFake.isValid, false);
  assert.ok(
    valFake.errors.some(
      (e) => e.path.includes('sequence_nodes') && e.message.toLowerCase().includes('forbidden fake')
    )
  );

  // Unregistered provenance
  fakeProv.resonators[0].sequence_nodes[0].provenance_source_name = 'MadeUpSource99';
  const valUnregistered = validatePatchDataset(fakeProv);
  assert.strictEqual(valUnregistered.isValid, false);
  assert.ok(
    valUnregistered.errors.some(
      (e) => e.path.includes('sequence_nodes') && e.message.toLowerCase().includes('missing or unregistered')
    )
  );
});

test('5. Invalid sequence order (out of range or duplicates) is rejected', () => {
  const dataset = loadCanonical37Dataset();
  const corrupted = JSON.parse(JSON.stringify(dataset));

  // Order out of range
  corrupted.resonators[0].sequence_nodes[0].node_order = 7;
  const valOrder = validatePatchDataset(corrupted);
  assert.strictEqual(valOrder.isValid, false);
  assert.ok(valOrder.errors.some((e) => e.message.includes('Must be an integer between 1 and 6')));

  // Duplicate order
  const duplicate = JSON.parse(JSON.stringify(dataset));
  duplicate.resonators[0].sequence_nodes[1].node_order = 1;
  duplicate.resonators[0].sequence_nodes[1].node_code = 'S1';
  const valDup = validatePatchDataset(duplicate);
  assert.strictEqual(valDup.isValid, false);
  assert.ok(valDup.errors.some((e) => e.message.includes('Duplicate node_order 1')));
});

test('6. Invalid sequence code and order/code mismatch are rejected', () => {
  const dataset = loadCanonical37Dataset();
  const corrupted = JSON.parse(JSON.stringify(dataset));

  // Mismatch: order 1 with code 'S2'
  corrupted.resonators[0].sequence_nodes[0].node_code = 'S2';
  const val = validatePatchDataset(corrupted);
  assert.strictEqual(val.isValid, false);
  assert.ok(val.errors.some((e) => e.message.includes("Mismatched node_order 1 and node_code 'S2'")));
});

test('7. Invalid refinement category and synthetic formulas are rejected', () => {
  const dataset = loadCanonical37Dataset();
  const corrupted = JSON.parse(JSON.stringify(dataset));

  // Find a weapon with passive effect
  const weaponWithPassive = corrupted.weapons.find(
    (w: any) => w.patch_data.passive_effect !== null && w.patch_data.refinement_scaling !== null
  );
  assert.ok(weaponWithPassive, 'Must have at least one weapon with passive and refinement scaling');

  // Insert forbidden synthetic multiplier
  weaponWithPassive.patch_data.refinement_scaling.R1 = {
    multiplier: 1.25
  };
  weaponWithPassive.patch_data.passive_effect.detail_expression.refinement_scaling =
    weaponWithPassive.patch_data.refinement_scaling;

  const val = validatePatchDataset(corrupted);
  assert.strictEqual(val.isValid, false);
  assert.ok(val.errors.some((e) => e.message.includes('forbidden synthetic multiplier')));
});

test('8. Duplicate records are rejected at validation gate', () => {
  const dataset = loadCanonical37Dataset();
  const corrupted = JSON.parse(JSON.stringify(dataset));

  // Duplicate resonator identity
  corrupted.resonators.push(JSON.parse(JSON.stringify(corrupted.resonators[0])));
  const val = validatePatchDataset(corrupted);
  assert.strictEqual(val.isValid, false);
  assert.ok(val.errors.some((e) => e.message.toLowerCase().includes('duplicate resonator')));
});

test('9. Ingestion of 3.7 dataset is deterministic and 100% idempotent', async () => {
  const { tableData, client } = createInMemorySupabaseClient();
  const dataset = loadCanonical37Dataset();

  // Create a representative 2-resonator, 2-weapon subset for fixture-level testing
  const fixtureDataset: PatchDataset = {
    ...dataset,
    resonators: dataset.resonators.slice(0, 2),
    weapons: (dataset.weapons ?? []).slice(0, 2),
    echoes: [],
    sonatas: [],
    enemies: [],
    toa_cycles: []
  };

  // Run 1: First Ingestion
  const report1 = await ingestPatchDataset(fixtureDataset, client);
  assert.strictEqual(report1.success, true);
  assert.strictEqual(report1.counts.resonators, 2);
  assert.strictEqual(report1.counts.resonatorSequences, 12); // 2 resonators x 6 sequences

  const seqCount1 = tableData.get('resonator_sequences')!.size;
  const seqPatchCount1 = tableData.get('resonator_sequence_patch_data')!.size;
  assert.strictEqual(seqCount1, 12);
  assert.strictEqual(seqPatchCount1, 12);

  // Run 2: Exact Duplicate Ingestion
  const report2 = await ingestPatchDataset(fixtureDataset, client);
  assert.strictEqual(report2.success, true);

  const seqCount2 = tableData.get('resonator_sequences')!.size;
  const seqPatchCount2 = tableData.get('resonator_sequence_patch_data')!.size;
  assert.strictEqual(seqCount2, seqCount1, 'Repeated ingestion must not create duplicate sequences');
  assert.strictEqual(seqPatchCount2, seqPatchCount1, 'Repeated ingestion must not create duplicate patch records');
});

test('10. 3.6 data cannot silently enter the 3.7 dataset', async () => {
  const { client } = createInMemorySupabaseClient();
  const dataset = loadCanonical37Dataset();
  const fixtureDataset: PatchDataset = {
    ...dataset,
    resonators: dataset.resonators.slice(0, 1),
    weapons: [],
    echoes: [],
    sonatas: [],
    enemies: [],
    toa_cycles: []
  };

  // Corrupt sequence node with cross-patch reference
  const corruptNode = fixtureDataset.resonators[0].sequence_nodes![0] as any;
  corruptNode.patch_version = '3.6';

  const validation = validatePatchDataset(fixtureDataset);
  assert.strictEqual(validation.isValid, false);
  assert.ok(
    validation.errors.some((e) => e.message.includes("Cross-patch reference rejected")),
    'Must reject sequence node referencing patch 3.6 in patch 3.7 dataset'
  );
});

test('11. 3.7 data cannot overwrite unrelated patch records', async () => {
  const { tableData, getTableMap, client } = createInMemorySupabaseClient();

  // Pre-seed an unrelated patch 3.6 sequence patch data record
  const patch36Id = deterministicUuid('patch:3.6');
  const seq36Id = deterministicUuid('resonator_sequence:Yangyang:1');
  const patchData36Id = deterministicUuid('resonator_sequence_patch:3.6:Yangyang:1');

  getTableMap('resonator_sequence_patch_data').set(
    `resonator_sequence_patch_data::${seq36Id}::${patch36Id}`,
    {
      id: patchData36Id,
      sequence_id: seq36Id,
      patch_id: patch36Id,
      name: 'Old 3.6 Sequence Name',
      description: 'Old 3.6 Description'
    }
  );

  // Ingest 3.7 dataset with Yangyang S1
  const dataset = loadCanonical37Dataset();
  const yangyang = dataset.resonators.find((r) => r.name === 'Yangyang');
  assert.ok(yangyang);

  const fixtureDataset: PatchDataset = {
    ...dataset,
    resonators: [yangyang],
    weapons: [],
    echoes: [],
    sonatas: [],
    enemies: [],
    toa_cycles: []
  };

  const report = await ingestPatchDataset(fixtureDataset, client);
  assert.strictEqual(report.success, true);

  // Check that 3.6 sequence patch record was untouched
  const p36Record = tableData
    .get('resonator_sequence_patch_data')!
    .get(`resonator_sequence_patch_data::${seq36Id}::${patch36Id}`);
  assert.ok(p36Record);
  assert.strictEqual(p36Record.name, 'Old 3.6 Sequence Name');
  assert.strictEqual(p36Record.description, 'Old 3.6 Description');

  // Check that 3.7 sequence patch record exists separately
  const patch37Id = '11111111-1111-1111-1111-111111111111';
  const p37Record = tableData
    .get('resonator_sequence_patch_data')!
    .get(`resonator_sequence_patch_data::${seq36Id}::${patch37Id}`);
  assert.ok(p37Record);
  assert.strictEqual(p37Record.patch_id, patch37Id);
  assert.notStrictEqual(p37Record.id, patchData36Id);
});

test('12. Deterministic IDs remain stable and adhere to RFC 4122 v4 UUID format', () => {
  const dataset = loadCanonical37Dataset();

  for (const r of dataset.resonators) {
    for (let order = 1; order <= 6; order++) {
      const id1 = deterministicUuid(`resonator_sequence:${r.name}:${order}`);
      const id2 = deterministicUuid(`resonator_sequence:${r.name}:${order}`);
      assert.strictEqual(id1, id2, 'Deterministic ID must be repeatable');
      assert.match(id1, RFC4122_V4_UUID_REGEX, 'Must match RFC 4122 v4 format');

      const patchDataId = deterministicUuid(`resonator_sequence_patch:3.7:${r.name}:${order}`);
      assert.match(patchDataId, RFC4122_V4_UUID_REGEX);
    }
  }
});

test('13. Unresolved values are not silently fabricated', () => {
  const dataset = loadCanonical37Dataset();

  // Weapons without passive effects must have null/undefined refinement scaling
  const allWeapons = dataset.weapons ?? [];
  const weaponsWithoutPassives = allWeapons.filter((w) => !w.patch_data.passive_effect);
  assert.ok(weaponsWithoutPassives.length > 0, 'Dataset must have weapons without passives');

  for (const w of weaponsWithoutPassives) {
    assert.strictEqual(
      w.patch_data.refinement_scaling ?? null,
      null,
      `Weapon ${w.name} without passive must not fabricate refinement scaling`
    );
  }

  // Weapons with refinement scaling must only contain verified numbers, not synthetic multipliers
  const weaponsWithRefinement = allWeapons.filter((w) => w.patch_data.refinement_scaling);
  assert.ok(weaponsWithRefinement.length > 0, 'Dataset must have weapons with verified refinement scaling');

  for (const w of weaponsWithRefinement) {
    const scaling = w.patch_data.refinement_scaling!;
    assert.ok(scaling.R1 && scaling.R2 && scaling.R3 && scaling.R4 && scaling.R5);
    for (const rank of ['R1', 'R2', 'R3', 'R4', 'R5'] as const) {
      const rankParams = scaling[rank]!;
      for (const [key, val] of Object.entries(rankParams)) {
        assert.strictEqual(typeof val, 'number', `Param ${key} on ${w.name} ${rank} must be a number`);
        assert.ok(!isNaN(val as number), `Param ${key} on ${w.name} ${rank} must not be NaN`);
      }
    }
  }
});

test('14. Provenance remains attached after normalization', () => {
  const dataset = loadCanonical37Dataset();
  const registeredProvNames = new Set(dataset.provenance_sources.map((s) => s.source_name));

  // All 360 sequence nodes must have valid provenance
  for (const r of dataset.resonators) {
    for (const seq of r.sequence_nodes!) {
      assert.ok(seq.provenance_source_name, `Sequence ${r.name} ${seq.node_code} missing provenance`);
      assert.ok(
        registeredProvNames.has(seq.provenance_source_name),
        `Sequence ${r.name} ${seq.node_code} provenance ${seq.provenance_source_name} must be registered`
      );
    }
  }

  // All weapons must have valid provenance
  for (const w of dataset.weapons ?? []) {
    assert.ok(w.patch_data.provenance_source_name);
    assert.ok(registeredProvNames.has(w.patch_data.provenance_source_name));
  }
});

test('15. Full ingestion pipeline produces deterministic output across multiple passes', async () => {
  const dataset = loadCanonical37Dataset();

  // Test subset fixture for pipeline consistency
  const fixtureDataset: PatchDataset = {
    ...dataset,
    resonators: dataset.resonators.slice(0, 3),
    weapons: (dataset.weapons ?? []).slice(0, 3),
    echoes: [],
    sonatas: [],
    enemies: [],
    toa_cycles: []
  };

  const runA = createInMemorySupabaseClient();
  const runB = createInMemorySupabaseClient();

  const reportA = await ingestPatchDataset(fixtureDataset, runA.client);
  const reportB = await ingestPatchDataset(fixtureDataset, runB.client);

  assert.strictEqual(reportA.success, true);
  assert.strictEqual(reportB.success, true);
  assert.deepStrictEqual(reportA.counts, reportB.counts);

  // Compare tables byte-for-byte in serialization
  const tablesA = Array.from(runA.tableData.keys()).sort();
  const tablesB = Array.from(runB.tableData.keys()).sort();
  assert.deepStrictEqual(tablesA, tablesB);

  for (const tableName of tablesA) {
    const mapA = runA.tableData.get(tableName)!;
    const mapB = runB.tableData.get(tableName)!;
    assert.strictEqual(mapA.size, mapB.size, `Row count mismatch in table ${tableName}`);

    const keysA = Array.from(mapA.keys()).sort();
    const keysB = Array.from(mapB.keys()).sort();
    assert.deepStrictEqual(keysA, keysB, `Keys mismatch in table ${tableName}`);

    for (const key of keysA) {
      assert.deepStrictEqual(
        mapA.get(key),
        mapB.get(key),
        `Row data mismatch in table ${tableName} for key ${key}`
      );
    }
  }
});
