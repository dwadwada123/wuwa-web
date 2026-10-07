import fs from 'node:fs';
import path from 'node:path';
import { validatePatchDataset } from '../lib/ingestion/validation.ts';
import type { PatchDataset } from '../lib/ingestion/types.ts';

function run() {
  console.log('=== WUTHERING WAVES PATCH DATASET VALIDATOR ===\n');

  const args = process.argv.slice(2);
  let patchVersion = '3.7';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg === '--patch' || arg === '-p') && i + 1 < args.length) {
      patchVersion = args[++i];
    } else if (arg.startsWith('--patch=')) {
      patchVersion = arg.split('=')[1];
    } else if (!arg.startsWith('-')) {
      patchVersion = arg;
    }
  }

  // Resolve dataset file path
  let datasetPath = path.resolve(`data/patches/${patchVersion}/patch_${patchVersion.replace(/\./g, '_')}_dataset.json`);
  if (!fs.existsSync(datasetPath)) {
    // Also try direct file path if passed
    if (fs.existsSync(path.resolve(patchVersion))) {
      datasetPath = path.resolve(patchVersion);
    } else {
      console.error(`ERROR: Dataset file not found at: ${datasetPath}`);
      console.error(`Usage: npm run validate:patch -- <patch_version_e.g._3.7>`);
      process.exit(1);
    }
  }

  console.log(`Target Dataset: ${datasetPath}`);
  let rawJson: string;
  try {
    rawJson = fs.readFileSync(datasetPath, 'utf8');
  } catch (err: any) {
    console.error(`ERROR: Failed to read dataset file: ${err.message}`);
    process.exit(1);
  }

  let dataset: PatchDataset;
  try {
    dataset = JSON.parse(rawJson);
  } catch (err: any) {
    console.error(`ERROR: JSON syntax error in dataset file: ${err.message}`);
    process.exit(1);
  }

  console.log(`[Validation] Running strict read-only schema, provenance, and domain consistency checks...`);
  const result = validatePatchDataset(dataset);

  if (!result.isValid) {
    console.error(`\n❌ VALIDATION FAILED with ${result.errors.length} error(s):\n`);
    result.errors.forEach((e) => {
      console.error(`  - [${e.path}] ${e.message}`);
    });
    process.exit(1);
  }

  console.log('\n✅ VALIDATION PASSED CLEANLY (Zero Schema / Consistency Violations)\n');
  console.log('--- DATASET SUMMARY ---');
  console.log(`Patch Version:         ${dataset.patch.version}`);
  console.log(`Release Date:          ${dataset.patch.release_date}`);
  console.log(`Provenance Sources:    ${dataset.provenance_sources?.length || 0}`);
  console.log(`Resonators:            ${dataset.resonators?.length || 0}`);
  console.log(`Weapons:               ${dataset.weapons?.length || 0}`);
  console.log(`Echoes:                ${dataset.echoes?.length || 0}`);
  console.log(`Sonatas:               ${dataset.sonatas?.length || 0}`);
  console.log(`Enemies:               ${dataset.enemies?.length || 0}`);
  const totalTowers = (dataset.toa_cycles || []).reduce(
    (acc, c) => acc + (c.zones || []).reduce((zAcc, z) => zAcc + (z.towers?.length || 0), 0),
    0
  );
  const totalStages = (dataset.toa_cycles || []).reduce(
    (acc, c) =>
      acc +
      (c.zones || []).reduce(
        (zAcc, z) =>
          zAcc + (z.towers || []).reduce((tAcc, t) => tAcc + (t.stages?.length || 0), 0),
        0
      ),
    0
  );

  console.log(`ToA Cycles:            ${dataset.toa_cycles?.length || 0}`);
  console.log(`Towers:                ${totalTowers}`);
  console.log(`Stages:                ${totalStages}`);
  console.log(`Area Effects:          ${dataset.area_effects?.length || 0}`);
  console.log('-----------------------\n');
}

run();
