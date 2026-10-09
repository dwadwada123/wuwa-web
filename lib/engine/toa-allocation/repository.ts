/**
 * Wuthering Waves Deterministic Tower of Adversity Allocation Repository
 * Phase 7 Step 23: Deterministic Tower of Adversity Vigor Allocation & Stage Scheduling Contract
 *
 * Provides authoritative access to canonical Season 40 Tower of Adversity stages,
 * area effects, and memoized default allocation results.
 */

import {
  CANONICAL_PATCH_VERSION,
  CANONICAL_SEASON_ID,
  CANONICAL_STAGE_COUNT,
  CANONICAL_TOWER_COUNT
} from './rules.ts';
import type {
  ToAStageDefinition,
  ToAAreaEffect,
  ToAAllocationResult,
  ToAAllocationInput
} from './types.ts';
import { allocateToAStages } from './builder.ts';

let _cachedCanonicalStages: readonly ToAStageDefinition[] | null = null;
let _cachedDefaultAllocationResult: ToAAllocationResult | null = null;

/**
 * Clears in-memory caches for ToA allocation and stage catalog.
 */
export function clearToAAllocationCache(): void {
  _cachedDefaultAllocationResult = null;
  _cachedCanonicalStages = null;
}

/**
 * Static fallback definitions for Season 40 stages, derived verbatim
 * from data/patches/3.7/patch_3_7_dataset.json.
 */
const CANONICAL_SEASON_40_FALLBACK_STAGES: readonly ToAStageDefinition[] = Object.freeze([
  // Resonant Tower (Tower 1, Floors 1..4, Vigor 1, 2, 3, 4)
  Object.freeze({
    stageId: 'toa-resonant-floor-1',
    patchVersion: CANONICAL_PATCH_VERSION,
    seasonId: CANONICAL_SEASON_ID,
    towerId: 'resonant-tower',
    towerName: 'Resonant Tower',
    towerOrder: 1,
    stageIndex: 1,
    globalStageOrder: 1,
    vigorCost: 1,
    difficulty: 3,
    areaEffects: Object.freeze([
      {
        id: 'area-92007113',
        sourceId: '92007113',
        name: 'Resonant Tower Aero Shred',
        description: 'Enemy Aero RES decreases by 10%',
        category: 'RES_SHRED',
        target: 'ENEMY',
        beneficialElements: Object.freeze(['Aero'])
      },
      {
        id: 'area-92008110',
        sourceId: '92008110',
        name: 'Resonant Tower DEF Ignore & Negative Status Amp',
        description: "Resonators ignore 25% of the enemy's DEF when dealing damage.",
        category: 'DEF_SHRED',
        target: 'ENEMY',
        beneficialElements: Object.freeze([])
      }
    ]),
    beneficialElements: Object.freeze(['Aero']),
    enemyCodes: Object.freeze(['ELECTRO_DRAKE', 'ELECTRO_PREDATOR'])
  }),
  Object.freeze({
    stageId: 'toa-resonant-floor-2',
    patchVersion: CANONICAL_PATCH_VERSION,
    seasonId: CANONICAL_SEASON_ID,
    towerId: 'resonant-tower',
    towerName: 'Resonant Tower',
    towerOrder: 1,
    stageIndex: 2,
    globalStageOrder: 2,
    vigorCost: 2,
    difficulty: 3,
    areaEffects: Object.freeze([
      {
        id: 'area-92007113',
        sourceId: '92007113',
        name: 'Resonant Tower Aero Shred',
        description: 'Enemy Aero RES decreases by 10%',
        category: 'RES_SHRED',
        target: 'ENEMY',
        beneficialElements: Object.freeze(['Aero'])
      },
      {
        id: 'area-92008110',
        sourceId: '92008110',
        name: 'Resonant Tower DEF Ignore & Negative Status Amp',
        description: "Resonators ignore 25% of the enemy's DEF when dealing damage.",
        category: 'DEF_SHRED',
        target: 'ENEMY',
        beneficialElements: Object.freeze([])
      }
    ]),
    beneficialElements: Object.freeze(['Aero']),
    enemyCodes: Object.freeze(['ELECTRO_DRAKE', 'ELECTRO_PREDATOR'])
  }),
  Object.freeze({
    stageId: 'toa-resonant-floor-3',
    patchVersion: CANONICAL_PATCH_VERSION,
    seasonId: CANONICAL_SEASON_ID,
    towerId: 'resonant-tower',
    towerName: 'Resonant Tower',
    towerOrder: 1,
    stageIndex: 3,
    globalStageOrder: 3,
    vigorCost: 3,
    difficulty: 3,
    areaEffects: Object.freeze([
      {
        id: 'area-92007113',
        sourceId: '92007113',
        name: 'Resonant Tower Aero Shred',
        description: 'Enemy Aero RES decreases by 10%',
        category: 'RES_SHRED',
        target: 'ENEMY',
        beneficialElements: Object.freeze(['Aero'])
      },
      {
        id: 'area-92008110',
        sourceId: '92008110',
        name: 'Resonant Tower DEF Ignore & Negative Status Amp',
        description: "Resonators ignore 25% of the enemy's DEF when dealing damage.",
        category: 'DEF_SHRED',
        target: 'ENEMY',
        beneficialElements: Object.freeze([])
      }
    ]),
    beneficialElements: Object.freeze(['Aero']),
    enemyCodes: Object.freeze(['ELECTRO_DRAKE', 'ELECTRO_PREDATOR'])
  }),
  Object.freeze({
    stageId: 'toa-resonant-floor-4',
    patchVersion: CANONICAL_PATCH_VERSION,
    seasonId: CANONICAL_SEASON_ID,
    towerId: 'resonant-tower',
    towerName: 'Resonant Tower',
    towerOrder: 1,
    stageIndex: 4,
    globalStageOrder: 4,
    vigorCost: 4,
    difficulty: 3,
    areaEffects: Object.freeze([
      {
        id: 'area-92007113',
        sourceId: '92007113',
        name: 'Resonant Tower Aero Shred',
        description: 'Enemy Aero RES decreases by 10%',
        category: 'RES_SHRED',
        target: 'ENEMY',
        beneficialElements: Object.freeze(['Aero'])
      },
      {
        id: 'area-92008110',
        sourceId: '92008110',
        name: 'Resonant Tower DEF Ignore & Negative Status Amp',
        description: "Resonators ignore 25% of the enemy's DEF when dealing damage.",
        category: 'DEF_SHRED',
        target: 'ENEMY',
        beneficialElements: Object.freeze([])
      }
    ]),
    beneficialElements: Object.freeze(['Aero']),
    enemyCodes: Object.freeze(['MECH_ABOMINATION'])
  }),

  // Hazard Tower (Tower 2, Floors 1..4, Vigor 5, 5, 5, 5)
  Object.freeze({
    stageId: 'toa-hazard-floor-1',
    patchVersion: CANONICAL_PATCH_VERSION,
    seasonId: CANONICAL_SEASON_ID,
    towerId: 'hazard-tower',
    towerName: 'Hazard Tower',
    towerOrder: 2,
    stageIndex: 1,
    globalStageOrder: 5,
    vigorCost: 5,
    difficulty: 3,
    areaEffects: Object.freeze([
      {
        id: 'area-92007152',
        sourceId: '92007152',
        name: 'Hazard Tower Electro/Fusion RES Shred & Havoc/Glacio RES Up',
        description: "Enemies' Electro RES and Fusion RES are decreased by 10%.",
        category: 'RES_SHRED',
        target: 'ENEMY',
        beneficialElements: Object.freeze(['Electro', 'Fusion'])
      },
      {
        id: 'area-92008195',
        sourceId: '92008195',
        name: 'Hazard Tower ATK & Intro All DMG Buff',
        description: 'ATK is increased by 30%.',
        category: 'STAT_BUFF',
        target: 'TEAM',
        beneficialElements: Object.freeze([])
      }
    ]),
    beneficialElements: Object.freeze(['Electro', 'Fusion']),
    enemyCodes: Object.freeze(['IMPERMANENCE_HERON'])
  }),
  Object.freeze({
    stageId: 'toa-hazard-floor-2',
    patchVersion: CANONICAL_PATCH_VERSION,
    seasonId: CANONICAL_SEASON_ID,
    towerId: 'hazard-tower',
    towerName: 'Hazard Tower',
    towerOrder: 2,
    stageIndex: 2,
    globalStageOrder: 6,
    vigorCost: 5,
    difficulty: 3,
    areaEffects: Object.freeze([
      {
        id: 'area-92007152',
        sourceId: '92007152',
        name: 'Hazard Tower Electro/Fusion RES Shred & Havoc/Glacio RES Up',
        description: "Enemies' Electro RES and Fusion RES are decreased by 10%.",
        category: 'RES_SHRED',
        target: 'ENEMY',
        beneficialElements: Object.freeze(['Electro', 'Fusion'])
      },
      {
        id: 'area-92008195',
        sourceId: '92008195',
        name: 'Hazard Tower ATK & Intro All DMG Buff',
        description: 'ATK is increased by 30%.',
        category: 'STAT_BUFF',
        target: 'TEAM',
        beneficialElements: Object.freeze([])
      }
    ]),
    beneficialElements: Object.freeze(['Electro', 'Fusion']),
    enemyCodes: Object.freeze(['IMPERMANENCE_HERON'])
  }),
  Object.freeze({
    stageId: 'toa-hazard-floor-3',
    patchVersion: CANONICAL_PATCH_VERSION,
    seasonId: CANONICAL_SEASON_ID,
    towerId: 'hazard-tower',
    towerName: 'Hazard Tower',
    towerOrder: 2,
    stageIndex: 3,
    globalStageOrder: 7,
    vigorCost: 5,
    difficulty: 3,
    areaEffects: Object.freeze([
      {
        id: 'area-92008205',
        sourceId: '92008205',
        name: 'Hazard Tower Ramp Total DMG',
        description: 'Enemies take ramping total DMG.',
        category: 'DMG_AMPLIFY',
        target: 'ENEMY',
        beneficialElements: Object.freeze([])
      },
      {
        id: 'area-92008196',
        sourceId: '92008196',
        name: 'Hazard Tower All-Attribute RES Increase',
        description: "Enemies' All-Attribute RES is increased by 15%, except Electro and Fusion.",
        category: 'RES_SHRED',
        target: 'ENEMY',
        beneficialElements: Object.freeze(['Electro', 'Fusion'])
      },
      {
        id: 'area-92008197',
        sourceId: '92008197',
        name: 'Hazard Tower Total & Electro DMG / Shield Fusion Amp',
        description: 'Enemies take 20% more total DMG and 50% more total Electro DMG.',
        category: 'DMG_AMPLIFY',
        target: 'TEAM',
        beneficialElements: Object.freeze(['Electro', 'Fusion'])
      }
    ]),
    beneficialElements: Object.freeze(['Electro', 'Fusion']),
    enemyCodes: Object.freeze(['FALLACY_OF_NO_RETURN'])
  }),
  Object.freeze({
    stageId: 'toa-hazard-floor-4',
    patchVersion: CANONICAL_PATCH_VERSION,
    seasonId: CANONICAL_SEASON_ID,
    towerId: 'hazard-tower',
    towerName: 'Hazard Tower',
    towerOrder: 2,
    stageIndex: 4,
    globalStageOrder: 8,
    vigorCost: 5,
    difficulty: 3,
    areaEffects: Object.freeze([
      {
        id: 'area-92008205',
        sourceId: '92008205',
        name: 'Hazard Tower Ramp Total DMG',
        description: 'Enemies take ramping total DMG.',
        category: 'DMG_AMPLIFY',
        target: 'ENEMY',
        beneficialElements: Object.freeze([])
      },
      {
        id: 'area-92008196',
        sourceId: '92008196',
        name: 'Hazard Tower All-Attribute RES Increase',
        description: "Enemies' All-Attribute RES is increased by 15%, except Electro and Fusion.",
        category: 'RES_SHRED',
        target: 'ENEMY',
        beneficialElements: Object.freeze(['Electro', 'Fusion'])
      },
      {
        id: 'area-92008197',
        sourceId: '92008197',
        name: 'Hazard Tower Total & Electro DMG / Shield Fusion Amp',
        description: 'Enemies take 20% more total DMG and 50% more total Electro DMG.',
        category: 'DMG_AMPLIFY',
        target: 'TEAM',
        beneficialElements: Object.freeze(['Electro', 'Fusion'])
      }
    ]),
    beneficialElements: Object.freeze(['Electro', 'Fusion']),
    enemyCodes: Object.freeze(['FALLACY_OF_NO_RETURN'])
  }),

  // Echoing Tower (Tower 3, Floors 1..4, Vigor 1, 2, 3, 4)
  Object.freeze({
    stageId: 'toa-echoing-floor-1',
    patchVersion: CANONICAL_PATCH_VERSION,
    seasonId: CANONICAL_SEASON_ID,
    towerId: 'echoing-tower',
    towerName: 'Echoing Tower',
    towerOrder: 3,
    stageIndex: 1,
    globalStageOrder: 9,
    vigorCost: 1,
    difficulty: 3,
    areaEffects: Object.freeze([
      {
        id: 'area-92007115',
        sourceId: '92007115',
        name: 'Echoing Tower Havoc RES Shred',
        description: 'Enemy Havoc RES decreases by 10%',
        category: 'RES_SHRED',
        target: 'ENEMY',
        beneficialElements: Object.freeze(['Havoc'])
      },
      {
        id: 'area-92008030',
        sourceId: '92008030',
        name: 'Echoing Tower Intro ATK & Skill Liberation Buff',
        description: 'Casting Intro Skill increases ATK by 20%.',
        category: 'STAT_BUFF',
        target: 'TEAM',
        beneficialElements: Object.freeze([])
      }
    ]),
    beneficialElements: Object.freeze(['Havoc']),
    enemyCodes: Object.freeze(['ELECTRO_DRAKE', 'ELECTRO_PREDATOR'])
  }),
  Object.freeze({
    stageId: 'toa-echoing-floor-2',
    patchVersion: CANONICAL_PATCH_VERSION,
    seasonId: CANONICAL_SEASON_ID,
    towerId: 'echoing-tower',
    towerName: 'Echoing Tower',
    towerOrder: 3,
    stageIndex: 2,
    globalStageOrder: 10,
    vigorCost: 2,
    difficulty: 3,
    areaEffects: Object.freeze([
      {
        id: 'area-92007115',
        sourceId: '92007115',
        name: 'Echoing Tower Havoc RES Shred',
        description: 'Enemy Havoc RES decreases by 10%',
        category: 'RES_SHRED',
        target: 'ENEMY',
        beneficialElements: Object.freeze(['Havoc'])
      },
      {
        id: 'area-92008030',
        sourceId: '92008030',
        name: 'Echoing Tower Intro ATK & Skill Liberation Buff',
        description: 'Casting Intro Skill increases ATK by 20%.',
        category: 'STAT_BUFF',
        target: 'TEAM',
        beneficialElements: Object.freeze([])
      }
    ]),
    beneficialElements: Object.freeze(['Havoc']),
    enemyCodes: Object.freeze(['ELECTRO_DRAKE', 'ELECTRO_PREDATOR'])
  }),
  Object.freeze({
    stageId: 'toa-echoing-floor-3',
    patchVersion: CANONICAL_PATCH_VERSION,
    seasonId: CANONICAL_SEASON_ID,
    towerId: 'echoing-tower',
    towerName: 'Echoing Tower',
    towerOrder: 3,
    stageIndex: 3,
    globalStageOrder: 11,
    vigorCost: 3,
    difficulty: 3,
    areaEffects: Object.freeze([
      {
        id: 'area-92007115',
        sourceId: '92007115',
        name: 'Echoing Tower Havoc RES Shred',
        description: 'Enemy Havoc RES decreases by 10%',
        category: 'RES_SHRED',
        target: 'ENEMY',
        beneficialElements: Object.freeze(['Havoc'])
      },
      {
        id: 'area-92008030',
        sourceId: '92008030',
        name: 'Echoing Tower Intro ATK & Skill Liberation Buff',
        description: 'Casting Intro Skill increases ATK by 20%.',
        category: 'STAT_BUFF',
        target: 'TEAM',
        beneficialElements: Object.freeze([])
      }
    ]),
    beneficialElements: Object.freeze(['Havoc']),
    enemyCodes: Object.freeze(['ELECTRO_DRAKE', 'ELECTRO_PREDATOR'])
  }),
  Object.freeze({
    stageId: 'toa-echoing-floor-4',
    patchVersion: CANONICAL_PATCH_VERSION,
    seasonId: CANONICAL_SEASON_ID,
    towerId: 'echoing-tower',
    towerName: 'Echoing Tower',
    towerOrder: 3,
    stageIndex: 4,
    globalStageOrder: 12,
    vigorCost: 4,
    difficulty: 3,
    areaEffects: Object.freeze([
      {
        id: 'area-92007115',
        sourceId: '92007115',
        name: 'Echoing Tower Havoc RES Shred',
        description: 'Enemy Havoc RES decreases by 10%',
        category: 'RES_SHRED',
        target: 'ENEMY',
        beneficialElements: Object.freeze(['Havoc'])
      },
      {
        id: 'area-92008030',
        sourceId: '92008030',
        name: 'Echoing Tower Intro ATK & Skill Liberation Buff',
        description: 'Casting Intro Skill increases ATK by 20%.',
        category: 'STAT_BUFF',
        target: 'TEAM',
        beneficialElements: Object.freeze([])
      }
    ]),
    beneficialElements: Object.freeze(['Havoc']),
    enemyCodes: Object.freeze(['LAMPYLUMEN_MYRIAD'])
  })
]);

/**
 * Retrieves the 12 canonical Season 40 stages for Patch 3.7.
 */
export function getCanonicalSeason40Stages(): readonly ToAStageDefinition[] {
  if (_cachedCanonicalStages) {
    return _cachedCanonicalStages;
  }
  _cachedCanonicalStages = CANONICAL_SEASON_40_FALLBACK_STAGES;
  return _cachedCanonicalStages;
}

/**
 * Retrieves or builds the memoized default production ToAAllocationResult.
 */
export function getDefaultToAAllocationResult(
  input?: ToAAllocationInput
): ToAAllocationResult {
  const isDefault =
    !input ||
    (!input.patchId &&
      !input.seasonId &&
      !input.stageCatalog &&
      !input.targetStageIds &&
      !input.ownedRoster &&
      !input.portfolio &&
      !input.candidateTeams &&
      input.allowPartial === undefined);

  if (isDefault) {
    if (!_cachedDefaultAllocationResult) {
      _cachedDefaultAllocationResult = allocateToAStages();
    }
    return _cachedDefaultAllocationResult;
  }

  return allocateToAStages(input);
}

/**
 * Validates a loaded Patch 3.7 dataset object against the canonical Season 40
 * Tower of Adversity contract and confirms zero drift against fallback stages.
 */
export function validateSeason40DatasetConsistency(dataset: unknown): {
  isValid: boolean;
  errors: readonly string[];
} {
  const errors: string[] = [];
  if (!dataset || typeof dataset !== 'object') {
    return { isValid: false, errors: Object.freeze(['Dataset must be a non-null object.']) };
  }

  const ds = dataset as Record<string, unknown>;
  const cycles = ds.toa_cycles;
  if (!Array.isArray(cycles) || cycles.length === 0) {
    return { isValid: false, errors: Object.freeze(['Dataset missing or empty toa_cycles array.']) };
  }

  const season40 = cycles.find((c: any) => c && c.cycle_code === CANONICAL_SEASON_ID);
  if (!season40) {
    return {
      isValid: false,
      errors: Object.freeze([`Dataset does not contain canonical Season ID '${CANONICAL_SEASON_ID}'.`])
    };
  }

  const zones = season40.zones;
  if (!Array.isArray(zones) || zones.length !== 1 || zones[0]?.zone_type !== 'HazardZone') {
    errors.push("Season 40 must contain exactly 1 zone with zone_type 'HazardZone'.");
  }

  const towers = zones?.[0]?.towers;
  if (!Array.isArray(towers) || towers.length !== CANONICAL_TOWER_COUNT) {
    errors.push(`Season 40 must contain exactly ${CANONICAL_TOWER_COUNT} towers.`);
  }

  if (Array.isArray(towers)) {
    let totalDatasetStages = 0;
    for (const t of towers) {
      if (!Array.isArray(t.stages) || t.stages.length !== 4) {
        errors.push(`Tower ${t.tower_order} (${t.tower_name}) must have exactly 4 stages.`);
        continue;
      }
      totalDatasetStages += t.stages.length;

      for (const st of t.stages) {
        const expectedVigor = t.tower_order === 2 ? 5 : st.stage_index;
        if (st.vigor_cost !== expectedVigor) {
          errors.push(
            `Tower ${t.tower_order} Stage ${st.stage_index} vigor_cost is ${st.vigor_cost}, expected ${expectedVigor}.`
          );
        }
      }
    }

    if (totalDatasetStages !== CANONICAL_STAGE_COUNT) {
      errors.push(
        `Season 40 total stage count is ${totalDatasetStages}, expected ${CANONICAL_STAGE_COUNT}.`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors: Object.freeze(errors)
  };
}
