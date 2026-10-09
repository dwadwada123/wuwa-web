import fs from 'node:fs';
import path from 'node:path';
import { validatePatchDataset } from '../lib/ingestion/validation.ts';
import type {
  PatchDataset,
  SequenceNodeInput,
  SequenceOrder,
  SequenceNodeCode,
  RefinementScaling
} from '../lib/ingestion/types.ts';

interface SkillSnapshot {
  slug: string;
  sequences: Array<{
    index: number;
    name: string;
    description: string | { en: string; id?: string };
  }>;
}

interface WeaponSnapshotEffect {
  stat: string;
  scope?: string | null;
  values: number[];
  maxStacks?: number | null;
  triggered?: boolean;
  team?: boolean;
  sentence?: string;
}

interface WeaponSnapshot {
  id: number;
  name: string;
  type: string;
  rarity: number;
  atk90: number;
  secondary: {
    name: string;
    value90: number;
  };
  passive?: {
    name: string;
    r1?: { en: string; id?: string };
    r2?: { en: string; id?: string };
    r3?: { en: string; id?: string };
    r4?: { en: string; id?: string };
    r5?: { en: string; id?: string };
    effects?: WeaponSnapshotEffect[];
  };
}

const RESONATOR_SLUG_MAP: Record<string, string> = {
  'Rover: Spectro': 'rover-spectro',
  'Rover: Havoc': 'rover-havoc',
  'Rover: Aero': 'rover-aero',
  'Rover: Electro': 'rover-electro',
  'Yangyang: Xuanling': 'yangyang-xuanling',
  'Xiangli Yao': 'xiangli-yao',
  'Luuk Herssen': 'luuk-herssen'
};

const WEAPON_NAME_ALIASES: Record<string, string> = {
  'veritys handle': "verity's handle",
  'brawlers broadblade': "brawler's broadblade"
};

export function normalize37Dataset(): {
  dataset: PatchDataset;
  resonatorsProcessed: number;
  sequencesIngested: number;
  weaponsProcessed: number;
  weaponsWithRefinement: number;
  weaponsWithoutRefinement: number;
} {
  const datasetPath = path.resolve('data/patches/3.7/patch_3_7_dataset.json');
  const rawDataset = fs.readFileSync(datasetPath, 'utf8');
  const dataset: PatchDataset = JSON.parse(rawDataset);

  const skillsDir = path.resolve('data/snapshots/3.7/skills');
  const weaponsPath = path.resolve('data/snapshots/3.7/weapons/weapons.json');
  const rawWeapons = fs.readFileSync(weaponsPath, 'utf8');
  const weaponSnapshots: WeaponSnapshot[] = JSON.parse(rawWeapons);

  const weaponSnapshotMap = new Map<string, WeaponSnapshot>();
  for (const w of weaponSnapshots) {
    weaponSnapshotMap.set(w.name.toLowerCase().trim(), w);
  }

  // 1. Process Resonator Sequences (60 resonators x 6 sequences = 360 sequences)
  let sequencesIngested = 0;
  for (const res of dataset.resonators) {
    const slug =
      RESONATOR_SLUG_MAP[res.name] ||
      res.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const snapshotFile = path.join(skillsDir, `${slug}.json`);
    if (!fs.existsSync(snapshotFile)) {
      throw new Error(`Snapshot file missing for resonator ${res.name}: ${snapshotFile}`);
    }

    const snap: SkillSnapshot = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
    if (!snap.sequences || snap.sequences.length !== 6) {
      throw new Error(
        `Invalid sequence count for resonator ${res.name}: expected 6, got ${snap.sequences?.length || 0}`
      );
    }

    const sequenceNodes: SequenceNodeInput[] = snap.sequences.map((s) => {
      const order = s.index as SequenceOrder;
      const code = `S${s.index}` as SequenceNodeCode;
      const desc = typeof s.description === 'string' ? s.description : s.description.en;

      if (!s.name || s.name.trim().length === 0) {
        throw new Error(`Empty sequence name for ${res.name} node ${order}`);
      }
      if (!desc || desc.trim().length === 0) {
        throw new Error(`Empty sequence description for ${res.name} node ${order}`);
      }

      return {
        node_order: order,
        node_code: code,
        name: s.name.trim(),
        description: desc.trim(),
        provenance_source_name: 'api-v2.encore.moe Client Datamine (Patch 3.7)'
      };
    });

    res.sequence_nodes = sequenceNodes;
    sequencesIngested += sequenceNodes.length;
  }

  // 2. Process Weapon Refinement Scaling
  let weaponsWithRefinement = 0;
  let weaponsWithoutRefinement = 0;
  const weapons = dataset.weapons ?? [];

  for (const w of weapons) {
    const rawLookup = w.name.toLowerCase().trim();
    const lookupName = WEAPON_NAME_ALIASES[rawLookup] || rawLookup;
    const snap = weaponSnapshotMap.get(lookupName);

    // Only weapons with passive_effect modeled can have refinement_scaling
    if (w.patch_data.passive_effect && snap && snap.passive && snap.passive.effects && snap.passive.effects.length > 0) {
      // Build structured refinement scaling from explicit verified snapshot values
      const scaling: RefinementScaling = {
        R1: {},
        R2: {},
        R3: {},
        R4: {},
        R5: {}
      };

      let validEffectsCount = 0;
      for (const eff of snap.passive.effects) {
        if (Array.isArray(eff.values) && eff.values.length === 5) {
          const key = eff.scope ? `${eff.stat}_${eff.scope}` : eff.stat;
          scaling.R1![key] = eff.values[0];
          scaling.R2![key] = eff.values[1];
          scaling.R3![key] = eff.values[2];
          scaling.R4![key] = eff.values[3];
          scaling.R5![key] = eff.values[4];
          validEffectsCount++;
        }
      }

      if (validEffectsCount > 0) {
        w.patch_data.refinement_scaling = scaling;
        if (!w.patch_data.passive_effect.detail_expression) {
          w.patch_data.passive_effect.detail_expression = {};
        }
        w.patch_data.passive_effect.detail_expression.refinement_scaling = scaling;
        weaponsWithRefinement++;
      } else {
        w.patch_data.refinement_scaling = null;
        if (w.patch_data.passive_effect.detail_expression) {
          delete w.patch_data.passive_effect.detail_expression.refinement_scaling;
        }
        weaponsWithoutRefinement++;
      }
    } else {
      // Weapons without passive effects or without multi-rank values:
      // DO NOT fabricate synthetic values; mark as null / omitted.
      w.patch_data.refinement_scaling = null;
      if (w.patch_data.passive_effect && w.patch_data.passive_effect.detail_expression) {
        delete w.patch_data.passive_effect.detail_expression.refinement_scaling;
      }
      weaponsWithoutRefinement++;
    }
  }

  return {
    dataset,
    resonatorsProcessed: dataset.resonators.length,
    sequencesIngested,
    weaponsProcessed: weapons.length,
    weaponsWithRefinement,
    weaponsWithoutRefinement
  };
}

if (process.argv[1] && process.argv[1].includes('normalize-3-7')) {
  console.log('=== NORMALIZING WUTHERING WAVES 3.7 PRODUCTION DATASET ===\n');
  const result = normalize37Dataset();

  console.log(`Resonators processed:       ${result.resonatorsProcessed}`);
  console.log(`Sequence nodes ingested:    ${result.sequencesIngested} (100% verified, 6 per resonator)`);
  console.log(`Weapons processed:          ${result.weaponsProcessed}`);
  console.log(`Weapons with verified R1-R5: ${result.weaponsWithRefinement}`);
  console.log(`Weapons without refinement: ${result.weaponsWithoutRefinement} (omitted, no fabrication)`);

  console.log('\n[Validation] Validating normalized dataset against contracts...');
  const validation = validatePatchDataset(result.dataset);
  if (!validation.isValid) {
    console.error(`\n❌ VALIDATION FAILED with ${validation.errors.length} error(s):`);
    validation.errors.forEach((e) => console.error(`  - [${e.path}] ${e.message}`));
    process.exit(1);
  }

  console.log('✅ VALIDATION PASSED CLEANLY (Zero errors)\n');

  const outputPath = path.resolve('data/patches/3.7/patch_3_7_dataset.json');
  fs.writeFileSync(outputPath, JSON.stringify(result.dataset, null, 2), 'utf8');
  console.log(`Saved canonical dataset to: ${outputPath}\n`);
}
