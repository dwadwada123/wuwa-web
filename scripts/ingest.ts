import fs from 'node:fs';
import path from 'node:path';
import child_process from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { ingestPatchDataset } from '../lib/ingestion/engine.ts';
import { validatePatchDataset } from '../lib/ingestion/validation.ts';
import type { PatchDataset } from '../lib/ingestion/types.ts';

async function run() {
  console.log('=== WUTHERING WAVES 3.7 DETERMINISTIC INGESTION ===\n');

  // Parse command-line target flags
  const args = process.argv.slice(2);
  let target: 'local' | 'remote' = 'local';
  let confirmRemote = false;
  let patchVersion = '3.7';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--target' && i + 1 < args.length) {
      const val = args[++i].toLowerCase();
      if (val === 'local' || val === 'remote') {
        target = val;
      } else {
        console.error(`ERROR: Invalid target "${val}". Supported targets: local, remote`);
        process.exit(1);
      }
    } else if (arg.startsWith('--target=')) {
      const val = arg.split('=')[1].toLowerCase();
      if (val === 'local' || val === 'remote') {
        target = val;
      } else {
        console.error(`ERROR: Invalid target "${val}". Supported targets: local, remote`);
        process.exit(1);
      }
    } else if (arg === '--confirm-remote') {
      confirmRemote = true;
    } else if ((arg === '--patch' || arg === '-p') && i + 1 < args.length) {
      patchVersion = args[++i];
    } else if (arg.startsWith('--patch=')) {
      patchVersion = arg.split('=')[1];
    }
  }

  // Enforce remote confirmation guard
  if (target === 'remote') {
    if (!confirmRemote) {
      console.error('ERROR: Remote ingestion aborted for safety.');
      console.error('Remote execution strictly requires both flags:');
      console.error('  --target remote --confirm-remote');
      process.exit(1);
    }
  }

  // Print explicit target indicator before credential resolution
  if (target === 'remote') {
    console.log('Target: REMOTE\n');
  } else {
    console.log('Target: LOCAL\n');
  }

  // Resolve target-specific credentials
  let supabaseUrl: string;
  let adminKey: string;

  if (target === 'remote') {
    let envUrl = process.env.SUPABASE_URL;
    let envKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!envUrl || !envKey) {
      try {
        const refPath = path.resolve('supabase/.temp/project-ref');
        const projectRef = fs.existsSync(refPath) ? fs.readFileSync(refPath, 'utf8').trim() : 'nzaytawkoyscjovgtstt';
        if (!envUrl) {
          envUrl = `https://${projectRef}.supabase.co`;
        }
        if (!envKey) {
          const out = child_process.execSync(
            `npx supabase projects api-keys --project-ref ${projectRef} --reveal -o json`,
            { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
          );
          const keys = JSON.parse(out);
          const secretKeyObj = keys.find((k: any) => k.name === 'service_role') || keys.find((k: any) => k.type === 'secret');
          if (secretKeyObj && secretKeyObj.api_key) {
            envKey = secretKeyObj.api_key;
          }
        }
      } catch {
        // Fallback handled below
      }
    }

    if (!envUrl) {
      console.error('ERROR: SUPABASE_URL environment variable is required for remote ingestion.');
      process.exit(1);
    }
    if (!envKey) {
      console.error('ERROR: SUPABASE_SECRET_KEY environment variable is required for remote ingestion.');
      process.exit(1);
    }

    supabaseUrl = envUrl;
    adminKey = envKey;
  } else {
    // Local target uses local Supabase URL and credentials
    supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
    adminKey =
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
  }

  const supabase = createClient(supabaseUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const datasetPath = path.resolve(`data/patches/${patchVersion}/patch_${patchVersion.replace(/\./g, '_')}_dataset.json`);
  if (!fs.existsSync(datasetPath)) {
    console.error(`ERROR: Dataset file not found at ${datasetPath}`);
    process.exit(1);
  }

  const rawJson = fs.readFileSync(datasetPath, 'utf8');
  const dataset: PatchDataset = JSON.parse(rawJson);

  console.log(`[Validation] Validating patch ${dataset.patch?.version} dataset...`);
  const validation = validatePatchDataset(dataset);
  if (!validation.isValid) {
    console.error('Validation failed with errors:');
    validation.errors.forEach(e => console.error(`  - [${e.path}] ${e.message}`));
    process.exit(1);
  }
  console.log('  -> Validation PASSED cleanly.\n');

  console.log(`[Ingestion] Ingesting into Supabase canonical game-fact tables...`);
  const report = await ingestPatchDataset(dataset, supabase);

  console.log('\n=== INGESTION REPORT ===');
  console.log(`Success:                   ${report.success}`);
  console.log(`Patch Version:             ${report.patchVersion}`);
  console.log(`Duration:                  ${report.durationMs}ms`);
  console.log('\nCanonical Records Processed:');
  console.log(`  - Patches:               ${report.counts.patches}`);
  console.log(`  - Provenance Sources:    ${report.counts.provenanceSources}`);
  console.log(`  - Functional Roles:      ${report.counts.functionalRoles}`);
  console.log(`  - Combat Tags:           ${report.counts.combatTags}`);
  console.log(`  - Resonators:            ${report.counts.resonators}`);
  console.log(`  - Resonator Patch Data:  ${report.counts.resonatorPatchData}`);
  console.log(`  - Resonator Roles:       ${report.counts.resonatorRoles}`);
  console.log(`  - Resonator Combat Tags: ${report.counts.resonatorCombatTags}`);
  console.log(`  - Abilities:             ${report.counts.abilities}`);
  console.log(`  - Ability Patch Data:    ${report.counts.abilityPatchData}`);
  console.log(`  - Gameplay Effects:      ${report.counts.gameplayEffects}`);
  console.log(`  - Ability Effects:       ${report.counts.abilityEffects}`);
  console.log(`  - Weapons:               ${report.counts.weapons}`);
  console.log(`  - Weapon Patch Data:     ${report.counts.weaponPatchData}`);
  console.log(`  - Echoes:                ${report.counts.echoes}`);
  console.log(`  - Echo Patch Data:       ${report.counts.echoPatchData}`);
  console.log(`  - Sonatas:               ${report.counts.sonatas}`);
  console.log(`  - Sonata Patch Data:     ${report.counts.sonataPatchData}`);
  console.log(`  - Enemies:               ${report.counts.enemies}`);
  console.log(`  - Enemy Resistances:     ${report.counts.enemyResistances}`);
  console.log(`  - Enemy Modifiers:       ${report.counts.enemyModifiers}`);
  console.log(`  - Area Effects:          ${report.counts.areaEffects}`);
  console.log(`  - ToA Cycles:            ${report.counts.toaCycles}`);
  console.log(`  - ToA Zones:             ${report.counts.toaZones}`);
  console.log(`  - ToA Towers:            ${report.counts.toaTowers}`);
  console.log(`  - ToA Stages:            ${report.counts.toaStages}`);
  console.log(`  - Stage Area Effects:    ${report.counts.stageAreaEffects}`);
  console.log(`  - Challenge Goals:       ${report.counts.challengeGoals}`);
  console.log(`  - ToA Waves:             ${report.counts.toaWaves}`);
  console.log(`  - ToA Enemy Instances:   ${report.counts.toaEnemyInstances}`);
  console.log('\nProvenance Sources:');
  report.provenanceSourcesUsed.forEach(s => console.log(`  - ${s}`));
  console.log('\nExternal URLs:');
  report.externalSources.forEach(u => console.log(`  - ${u}`));
  console.log('\nIntentional Omissions:');
  report.omissions.forEach(o => console.log(`  - ${o}`));
  console.log('==================================================\n');
}

run().catch(err => {
  console.error('\nIngestion process aborted with error:', err);
  process.exit(1);
});
