/**
 * Wuthering Waves Character Build Evaluation Rules & Constants
 * Phase 7 Step 20: Deterministic Character Build Evaluation Contract
 *
 * Defines canonical constants, version constraints, equipment metadata catalogs,
 * machine-readable explanation codes, and prohibited field keys.
 */

import type { SourceReference } from '../capabilities/types.ts';
import type { BuildAspectKey } from './types.ts';

/** Canonical rule version for Step 20 */
export const CHARACTER_BUILD_EVALUATION_RULE_VERSION = '7.20.1';

/** Canonical patch version */
export const CANONICAL_PATCH_VERSION = '3.7';

/** Required upstream Step 19 rule version */
export const REQUIRED_STEP19_RULE_VERSION = '7.19.1';

/** Required upstream Step 13 rule version */
export const REQUIRED_STEP13_RULE_VERSION = '7.13.1';

/** Total canonical Resonators in Patch 3.7 */
export const CANONICAL_RESONATOR_COUNT = 60;

/** Total canonical Weapons in Patch 3.7 */
export const CANONICAL_WEAPON_COUNT = 66;

/** Total canonical Sonata sets in Patch 3.7 */
export const CANONICAL_SONATA_COUNT = 12;

/** Total tracked build aspects */
export const TRACKED_BUILD_ASPECTS_COUNT = 6;

/** Constant audit verification stamp */
export const OFFLINE_DETERMINISTIC_AUDIT_STAMP = 'OFFLINE_DETERMINISTIC_AUDIT';

/**
 * All 6 tracked build aspects.
 */
export const ALL_BUILD_ASPECTS: readonly BuildAspectKey[] = Object.freeze([
  'WEAPON_EQUIPPED',
  'WEAPON_LEVEL_KNOWN',
  'WEAPON_REFINEMENT_KNOWN',
  'ECHO_EQUIPPED_KNOWN',
  'ECHO_TUNING_KNOWN',
  'SONATA_SET_KNOWN'
]);

/**
 * Canonical Resonator equipment metadata in Patch 3.7.
 */
export interface CanonicalResonatorMetadata {
  readonly weaponType: 'Sword' | 'Pistols' | 'Rectifier' | 'Broadblade' | 'Gauntlets';
  readonly element: 'Aero' | 'Electro' | 'Fusion' | 'Glacio' | 'Havoc' | 'Spectro';
  readonly rarity: 4 | 5;
}

export const CANONICAL_RESONATOR_METADATA: Readonly<Record<string, CanonicalResonatorMetadata>> = Object.freeze({
  "Yangyang": {
    "weaponType": "Sword",
    "element": "Aero",
    "rarity": 4
  },
  "Chixia": {
    "weaponType": "Pistols",
    "element": "Fusion",
    "rarity": 4
  },
  "Verina": {
    "weaponType": "Rectifier",
    "element": "Spectro",
    "rarity": 5
  },
  "Rover: Spectro": {
    "weaponType": "Sword",
    "element": "Spectro",
    "rarity": 5
  },
  "Sanhua": {
    "weaponType": "Sword",
    "element": "Glacio",
    "rarity": 4
  },
  "Taoqi": {
    "weaponType": "Broadblade",
    "element": "Havoc",
    "rarity": 4
  },
  "Baizhi": {
    "weaponType": "Rectifier",
    "element": "Glacio",
    "rarity": 4
  },
  "Encore": {
    "weaponType": "Rectifier",
    "element": "Fusion",
    "rarity": 5
  },
  "Danjin": {
    "weaponType": "Sword",
    "element": "Havoc",
    "rarity": 4
  },
  "Aalto": {
    "weaponType": "Pistols",
    "element": "Aero",
    "rarity": 4
  },
  "Jiyan": {
    "weaponType": "Broadblade",
    "element": "Aero",
    "rarity": 5
  },
  "Mortefi": {
    "weaponType": "Pistols",
    "element": "Fusion",
    "rarity": 4
  },
  "Camellya": {
    "weaponType": "Sword",
    "element": "Havoc",
    "rarity": 5
  },
  "Calcharo": {
    "weaponType": "Broadblade",
    "element": "Electro",
    "rarity": 5
  },
  "Yinlin": {
    "weaponType": "Rectifier",
    "element": "Electro",
    "rarity": 5
  },
  "Lingyang": {
    "weaponType": "Gauntlets",
    "element": "Glacio",
    "rarity": 5
  },
  "Yuanwu": {
    "weaponType": "Gauntlets",
    "element": "Electro",
    "rarity": 4
  },
  "Rover: Havoc": {
    "weaponType": "Sword",
    "element": "Havoc",
    "rarity": 5
  },
  "Jianxin": {
    "weaponType": "Gauntlets",
    "element": "Aero",
    "rarity": 5
  },
  "Jinhsi": {
    "weaponType": "Broadblade",
    "element": "Spectro",
    "rarity": 5
  },
  "Xiangli Yao": {
    "weaponType": "Gauntlets",
    "element": "Electro",
    "rarity": 5
  },
  "Changli": {
    "weaponType": "Sword",
    "element": "Fusion",
    "rarity": 5
  },
  "Zhezhi": {
    "weaponType": "Rectifier",
    "element": "Glacio",
    "rarity": 5
  },
  "Lumi": {
    "weaponType": "Broadblade",
    "element": "Electro",
    "rarity": 4
  },
  "Youhu": {
    "weaponType": "Gauntlets",
    "element": "Glacio",
    "rarity": 4
  },
  "Shorekeeper": {
    "weaponType": "Rectifier",
    "element": "Spectro",
    "rarity": 5
  },
  "Roccia": {
    "weaponType": "Gauntlets",
    "element": "Havoc",
    "rarity": 5
  },
  "Carlotta": {
    "weaponType": "Pistols",
    "element": "Glacio",
    "rarity": 5
  },
  "Brant": {
    "weaponType": "Sword",
    "element": "Fusion",
    "rarity": 5
  },
  "Phoebe": {
    "weaponType": "Rectifier",
    "element": "Spectro",
    "rarity": 5
  },
  "Rover: Aero": {
    "weaponType": "Sword",
    "element": "Aero",
    "rarity": 5
  },
  "Cantarella": {
    "weaponType": "Rectifier",
    "element": "Havoc",
    "rarity": 5
  },
  "Ciaccona": {
    "weaponType": "Pistols",
    "element": "Aero",
    "rarity": 5
  },
  "Zani": {
    "weaponType": "Gauntlets",
    "element": "Spectro",
    "rarity": 5
  },
  "Lupa": {
    "weaponType": "Broadblade",
    "element": "Fusion",
    "rarity": 5
  },
  "Phrolova": {
    "weaponType": "Rectifier",
    "element": "Havoc",
    "rarity": 5
  },
  "Cartethyia": {
    "weaponType": "Sword",
    "element": "Aero",
    "rarity": 5
  },
  "Augusta": {
    "weaponType": "Broadblade",
    "element": "Electro",
    "rarity": 5
  },
  "Iuno": {
    "weaponType": "Gauntlets",
    "element": "Aero",
    "rarity": 5
  },
  "Buling": {
    "weaponType": "Rectifier",
    "element": "Electro",
    "rarity": 4
  },
  "Galbrena": {
    "weaponType": "Pistols",
    "element": "Fusion",
    "rarity": 5
  },
  "Chisa": {
    "weaponType": "Broadblade",
    "element": "Havoc",
    "rarity": 5
  },
  "Qiuyuan": {
    "weaponType": "Sword",
    "element": "Aero",
    "rarity": 5
  },
  "Lynae": {
    "weaponType": "Pistols",
    "element": "Spectro",
    "rarity": 5
  },
  "Mornye": {
    "weaponType": "Broadblade",
    "element": "Fusion",
    "rarity": 5
  },
  "Luuk Herssen": {
    "weaponType": "Gauntlets",
    "element": "Spectro",
    "rarity": 5
  },
  "Aemeath": {
    "weaponType": "Sword",
    "element": "Fusion",
    "rarity": 5
  },
  "Sigrika": {
    "weaponType": "Gauntlets",
    "element": "Aero",
    "rarity": 5
  },
  "Denia": {
    "weaponType": "Rectifier",
    "element": "Fusion",
    "rarity": 5
  },
  "Rebecca": {
    "weaponType": "Pistols",
    "element": "Electro",
    "rarity": 5
  },
  "Lucilla": {
    "weaponType": "Rectifier",
    "element": "Glacio",
    "rarity": 5
  },
  "Lucy": {
    "weaponType": "Pistols",
    "element": "Spectro",
    "rarity": 5
  },
  "Hiyuki": {
    "weaponType": "Sword",
    "element": "Glacio",
    "rarity": 5
  },
  "Rover: Electro": {
    "weaponType": "Sword",
    "element": "Electro",
    "rarity": 5
  },
  "Yangyang: Xuanling": {
    "weaponType": "Sword",
    "element": "Havoc",
    "rarity": 5
  },
  "Suisui": {
    "weaponType": "Rectifier",
    "element": "Glacio",
    "rarity": 5
  },
  "Qingxiao": {
    "weaponType": "Sword",
    "element": "Aero",
    "rarity": 5
  },
  "Hsin": {
    "weaponType": "Rectifier",
    "element": "Electro",
    "rarity": 5
  },
  "Jingran": {
    "weaponType": "Broadblade",
    "element": "Fusion",
    "rarity": 5
  },
  "Suoming": {
    "weaponType": "Sword",
    "element": "Electro",
    "rarity": 5
  }
});

/**
 * Canonical Weapon metadata in Patch 3.7.
 */
export interface CanonicalWeaponMetadata {
  readonly weaponType: 'Sword' | 'Pistols' | 'Rectifier' | 'Broadblade' | 'Gauntlets';
  readonly rarity: number;
  readonly baseAtkLvl90: number;
  readonly subStatType: string;
  readonly subStatValueLvl90: number;
  readonly passiveCategory: string | null;
  readonly hasRefinementScaling: boolean;
}

export const CANONICAL_WEAPON_METADATA: Readonly<Record<string, CanonicalWeaponMetadata>> = Object.freeze({
  "Blooming Jadehaven": {
    "weaponType": "Rectifier",
    "rarity": 5,
    "baseAtkLvl90": 587.5,
    "subStatType": "CritRate",
    "subStatValueLvl90": 0.243,
    "passiveCategory": "DMG_AMPLIFY",
    "hasRefinementScaling": true
  },
  "Unspoken Rue": {
    "weaponType": "Sword",
    "rarity": 5,
    "baseAtkLvl90": 587.5,
    "subStatType": "CritRate",
    "subStatValueLvl90": 0.243,
    "passiveCategory": "STAT_BUFF",
    "hasRefinementScaling": true
  },
  "Emerald of Genesis": {
    "weaponType": "Sword",
    "rarity": 5,
    "baseAtkLvl90": 587.5,
    "subStatType": "CritRate",
    "subStatValueLvl90": 0.243,
    "passiveCategory": "STAT_BUFF",
    "hasRefinementScaling": true
  },
  "Blazing Brilliance": {
    "weaponType": "Sword",
    "rarity": 5,
    "baseAtkLvl90": 587.5,
    "subStatType": "CritDMG",
    "subStatValueLvl90": 0.486,
    "passiveCategory": "DMG_AMPLIFY",
    "hasRefinementScaling": true
  },
  "Red Spring": {
    "weaponType": "Sword",
    "rarity": 5,
    "baseAtkLvl90": 587.5,
    "subStatType": "CritRate",
    "subStatValueLvl90": 0.243,
    "passiveCategory": "STAT_BUFF",
    "hasRefinementScaling": true
  },
  "Somnoire Anchor": {
    "weaponType": "Sword",
    "rarity": 5,
    "baseAtkLvl90": 587.5,
    "subStatType": "CritDMG",
    "subStatValueLvl90": 0.486,
    "passiveCategory": "DMG_AMPLIFY",
    "hasRefinementScaling": true
  },
  "Verdant Summit": {
    "weaponType": "Broadblade",
    "rarity": 5,
    "baseAtkLvl90": 587.5,
    "subStatType": "CritDMG",
    "subStatValueLvl90": 0.486,
    "passiveCategory": "DMG_AMPLIFY",
    "hasRefinementScaling": true
  },
  "Ages of Harvest": {
    "weaponType": "Broadblade",
    "rarity": 5,
    "baseAtkLvl90": 587.5,
    "subStatType": "CritRate",
    "subStatValueLvl90": 0.243,
    "passiveCategory": "DMG_AMPLIFY",
    "hasRefinementScaling": true
  },
  "Lustrous Razor": {
    "weaponType": "Broadblade",
    "rarity": 5,
    "baseAtkLvl90": 587.5,
    "subStatType": "ATK%",
    "subStatValueLvl90": 0.3645,
    "passiveCategory": "STAT_BUFF",
    "hasRefinementScaling": true
  },
  "The Mountains Roar": {
    "weaponType": "Broadblade",
    "rarity": 5,
    "baseAtkLvl90": 587.5,
    "subStatType": "CritRate",
    "subStatValueLvl90": 0.243,
    "passiveCategory": "DMG_AMPLIFY",
    "hasRefinementScaling": false
  },
  "Static Mist": {
    "weaponType": "Pistols",
    "rarity": 5,
    "baseAtkLvl90": 587.5,
    "subStatType": "CritRate",
    "subStatValueLvl90": 0.243,
    "passiveCategory": "STAT_BUFF",
    "hasRefinementScaling": true
  },
  "The Reckoning": {
    "weaponType": "Pistols",
    "rarity": 5,
    "baseAtkLvl90": 587.5,
    "subStatType": "CritDMG",
    "subStatValueLvl90": 0.486,
    "passiveCategory": "DMG_AMPLIFY",
    "hasRefinementScaling": false
  },
  "Abyssal Decrescendo": {
    "weaponType": "Pistols",
    "rarity": 5,
    "baseAtkLvl90": 587.5,
    "subStatType": "CritRate",
    "subStatValueLvl90": 0.243,
    "passiveCategory": "STAT_BUFF",
    "hasRefinementScaling": false
  },
  "Abyss Surges": {
    "weaponType": "Gauntlets",
    "rarity": 5,
    "baseAtkLvl90": 587.5,
    "subStatType": "EnergyRegen",
    "subStatValueLvl90": 0.3645,
    "passiveCategory": "STAT_BUFF",
    "hasRefinementScaling": true
  },
  "Veritys Handle": {
    "weaponType": "Gauntlets",
    "rarity": 5,
    "baseAtkLvl90": 587.5,
    "subStatType": "CritRate",
    "subStatValueLvl90": 0.243,
    "passiveCategory": "DMG_AMPLIFY",
    "hasRefinementScaling": true
  },
  "Iron Grip of Justice": {
    "weaponType": "Gauntlets",
    "rarity": 5,
    "baseAtkLvl90": 587.5,
    "subStatType": "CritDMG",
    "subStatValueLvl90": 0.486,
    "passiveCategory": "STAT_BUFF",
    "hasRefinementScaling": false
  },
  "Cosmic Ripples": {
    "weaponType": "Rectifier",
    "rarity": 5,
    "baseAtkLvl90": 587.5,
    "subStatType": "EnergyRegen",
    "subStatValueLvl90": 0.3645,
    "passiveCategory": "DMG_AMPLIFY",
    "hasRefinementScaling": true
  },
  "Stringmaster": {
    "weaponType": "Rectifier",
    "rarity": 5,
    "baseAtkLvl90": 500,
    "subStatType": "CritRate",
    "subStatValueLvl90": 0.36,
    "passiveCategory": "DMG_AMPLIFY",
    "hasRefinementScaling": true
  },
  "Rime-Draped Sprouts": {
    "weaponType": "Rectifier",
    "rarity": 5,
    "baseAtkLvl90": 500,
    "subStatType": "CritRate",
    "subStatValueLvl90": 0.36,
    "passiveCategory": "STAT_BUFF",
    "hasRefinementScaling": true
  },
  "Stellar Symphony": {
    "weaponType": "Rectifier",
    "rarity": 5,
    "baseAtkLvl90": 412.5,
    "subStatType": "EnergyRegen",
    "subStatValueLvl90": 0.77,
    "passiveCategory": "STAT_BUFF",
    "hasRefinementScaling": true
  },
  "Whispers of the Deep": {
    "weaponType": "Rectifier",
    "rarity": 5,
    "baseAtkLvl90": 500,
    "subStatType": "CritDMG",
    "subStatValueLvl90": 0.72,
    "passiveCategory": "DMG_AMPLIFY",
    "hasRefinementScaling": false
  },
  "Autumntrace": {
    "weaponType": "Broadblade",
    "rarity": 4,
    "baseAtkLvl90": 412.5,
    "subStatType": "CritRate",
    "subStatValueLvl90": 0.2025,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Broadblade#41": {
    "weaponType": "Broadblade",
    "rarity": 4,
    "baseAtkLvl90": 412.5,
    "subStatType": "EnergyRegen",
    "subStatValueLvl90": 0.3235,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Dauntless Evernight": {
    "weaponType": "Broadblade",
    "rarity": 4,
    "baseAtkLvl90": 387.5,
    "subStatType": "DEF%",
    "subStatValueLvl90": 0.615,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Helios Cleaver": {
    "weaponType": "Broadblade",
    "rarity": 4,
    "baseAtkLvl90": 412.5,
    "subStatType": "ATK%",
    "subStatValueLvl90": 0.3038,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Discord": {
    "weaponType": "Broadblade",
    "rarity": 4,
    "baseAtkLvl90": 337.5,
    "subStatType": "EnergyRegen",
    "subStatValueLvl90": 0.518,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Waning Redshift": {
    "weaponType": "Broadblade",
    "rarity": 4,
    "baseAtkLvl90": 412.5,
    "subStatType": "ATK%",
    "subStatValueLvl90": 0.3038,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Commando of Conviction": {
    "weaponType": "Sword",
    "rarity": 4,
    "baseAtkLvl90": 412.5,
    "subStatType": "ATK%",
    "subStatValueLvl90": 0.3038,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Lumingloss": {
    "weaponType": "Sword",
    "rarity": 4,
    "baseAtkLvl90": 387.5,
    "subStatType": "ATK%",
    "subStatValueLvl90": 0.3888,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Lunar Cutter": {
    "weaponType": "Sword",
    "rarity": 4,
    "baseAtkLvl90": 412.5,
    "subStatType": "ATK%",
    "subStatValueLvl90": 0.3038,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Sword#18": {
    "weaponType": "Sword",
    "rarity": 4,
    "baseAtkLvl90": 412.5,
    "subStatType": "DEF%",
    "subStatValueLvl90": 0.486,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Overture": {
    "weaponType": "Sword",
    "rarity": 4,
    "baseAtkLvl90": 337.5,
    "subStatType": "EnergyRegen",
    "subStatValueLvl90": 0.518,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "End of the Tunnel": {
    "weaponType": "Sword",
    "rarity": 4,
    "baseAtkLvl90": 412.5,
    "subStatType": "CritRate",
    "subStatValueLvl90": 0.2025,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Novaburst": {
    "weaponType": "Pistols",
    "rarity": 4,
    "baseAtkLvl90": 412.5,
    "subStatType": "ATK%",
    "subStatValueLvl90": 0.3038,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Thunderbolt": {
    "weaponType": "Pistols",
    "rarity": 4,
    "baseAtkLvl90": 387.5,
    "subStatType": "ATK%",
    "subStatValueLvl90": 0.3888,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Undying Flame": {
    "weaponType": "Pistols",
    "rarity": 4,
    "baseAtkLvl90": 412.5,
    "subStatType": "ATK%",
    "subStatValueLvl90": 0.3038,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Pistols#26": {
    "weaponType": "Pistols",
    "rarity": 4,
    "baseAtkLvl90": 412.5,
    "subStatType": "ATK%",
    "subStatValueLvl90": 0.3038,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Cadenza": {
    "weaponType": "Pistols",
    "rarity": 4,
    "baseAtkLvl90": 337.5,
    "subStatType": "EnergyRegen",
    "subStatValueLvl90": 0.518,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Relentless Surge": {
    "weaponType": "Pistols",
    "rarity": 4,
    "baseAtkLvl90": 412.5,
    "subStatType": "CritRate",
    "subStatValueLvl90": 0.2025,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Hollow Mirage": {
    "weaponType": "Gauntlets",
    "rarity": 4,
    "baseAtkLvl90": 412.5,
    "subStatType": "ATK%",
    "subStatValueLvl90": 0.3038,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Marcato": {
    "weaponType": "Gauntlets",
    "rarity": 4,
    "baseAtkLvl90": 337.5,
    "subStatType": "EnergyRegen",
    "subStatValueLvl90": 0.518,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Stonard": {
    "weaponType": "Gauntlets",
    "rarity": 4,
    "baseAtkLvl90": 412.5,
    "subStatType": "CritRate",
    "subStatValueLvl90": 0.2025,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Gauntlets#21D": {
    "weaponType": "Gauntlets",
    "rarity": 4,
    "baseAtkLvl90": 387.5,
    "subStatType": "DEF%",
    "subStatValueLvl90": 0.615,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Amity Accord": {
    "weaponType": "Gauntlets",
    "rarity": 4,
    "baseAtkLvl90": 387.5,
    "subStatType": "DEF%",
    "subStatValueLvl90": 0.615,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Abyssal Grip": {
    "weaponType": "Gauntlets",
    "rarity": 4,
    "baseAtkLvl90": 412.5,
    "subStatType": "ATK%",
    "subStatValueLvl90": 0.3038,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Augment": {
    "weaponType": "Rectifier",
    "rarity": 4,
    "baseAtkLvl90": 412.5,
    "subStatType": "CritRate",
    "subStatValueLvl90": 0.2025,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Comet Flare": {
    "weaponType": "Rectifier",
    "rarity": 4,
    "baseAtkLvl90": 337.5,
    "subStatType": "HP%",
    "subStatValueLvl90": 0.518,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Jinzhou Keeper": {
    "weaponType": "Rectifier",
    "rarity": 4,
    "baseAtkLvl90": 387.5,
    "subStatType": "ATK%",
    "subStatValueLvl90": 0.3888,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Rectifier#25": {
    "weaponType": "Rectifier",
    "rarity": 4,
    "baseAtkLvl90": 337.5,
    "subStatType": "EnergyRegen",
    "subStatValueLvl90": 0.518,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Variation": {
    "weaponType": "Rectifier",
    "rarity": 4,
    "baseAtkLvl90": 337.5,
    "subStatType": "EnergyRegen",
    "subStatValueLvl90": 0.518,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Fusion Accretion": {
    "weaponType": "Rectifier",
    "rarity": 4,
    "baseAtkLvl90": 412.5,
    "subStatType": "ATK%",
    "subStatValueLvl90": 0.3038,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Brawlers Broadblade": {
    "weaponType": "Broadblade",
    "rarity": 3,
    "baseAtkLvl90": 300,
    "subStatType": "ATK%",
    "subStatValueLvl90": 0.2025,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Guardian Broadblade": {
    "weaponType": "Broadblade",
    "rarity": 3,
    "baseAtkLvl90": 325,
    "subStatType": "ATK%",
    "subStatValueLvl90": 0.243,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Originite: Type I": {
    "weaponType": "Broadblade",
    "rarity": 3,
    "baseAtkLvl90": 300,
    "subStatType": "DEF%",
    "subStatValueLvl90": 0.3235,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Guardian Sword": {
    "weaponType": "Sword",
    "rarity": 3,
    "baseAtkLvl90": 325,
    "subStatType": "ATK%",
    "subStatValueLvl90": 0.243,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Originite: Type II": {
    "weaponType": "Sword",
    "rarity": 3,
    "baseAtkLvl90": 300,
    "subStatType": "DEF%",
    "subStatValueLvl90": 0.3235,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Sword of Night": {
    "weaponType": "Sword",
    "rarity": 3,
    "baseAtkLvl90": 300,
    "subStatType": "ATK%",
    "subStatValueLvl90": 0.2025,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Guardian Pistols": {
    "weaponType": "Pistols",
    "rarity": 3,
    "baseAtkLvl90": 325,
    "subStatType": "ATK%",
    "subStatValueLvl90": 0.243,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Originite: Type III": {
    "weaponType": "Pistols",
    "rarity": 3,
    "baseAtkLvl90": 300,
    "subStatType": "DEF%",
    "subStatValueLvl90": 0.3235,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Undaunted": {
    "weaponType": "Pistols",
    "rarity": 3,
    "baseAtkLvl90": 300,
    "subStatType": "ATK%",
    "subStatValueLvl90": 0.2025,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Guardian Gauntlets": {
    "weaponType": "Gauntlets",
    "rarity": 3,
    "baseAtkLvl90": 325,
    "subStatType": "ATK%",
    "subStatValueLvl90": 0.243,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Originite: Type IV": {
    "weaponType": "Gauntlets",
    "rarity": 3,
    "baseAtkLvl90": 300,
    "subStatType": "DEF%",
    "subStatValueLvl90": 0.3235,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Iron Gauntlets": {
    "weaponType": "Gauntlets",
    "rarity": 3,
    "baseAtkLvl90": 300,
    "subStatType": "HP%",
    "subStatValueLvl90": 0.3235,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Guardian Rectifier": {
    "weaponType": "Rectifier",
    "rarity": 3,
    "baseAtkLvl90": 325,
    "subStatType": "ATK%",
    "subStatValueLvl90": 0.243,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Originite: Type V": {
    "weaponType": "Rectifier",
    "rarity": 3,
    "baseAtkLvl90": 300,
    "subStatType": "DEF%",
    "subStatValueLvl90": 0.3235,
    "passiveCategory": null,
    "hasRefinementScaling": false
  },
  "Resonating Melody": {
    "weaponType": "Rectifier",
    "rarity": 3,
    "baseAtkLvl90": 300,
    "subStatType": "EnergyRegen",
    "subStatValueLvl90": 0.3235,
    "passiveCategory": null,
    "hasRefinementScaling": false
  }
});

/**
 * Canonical Sonata set metadata in Patch 3.7.
 */
export interface CanonicalSonataMetadata {
  readonly code: string;
  readonly name: string;
  readonly element: string | null;
  readonly alignmentType: 'ELEMENTAL' | 'UNIVERSAL';
  readonly description: string;
}

const _rawSonataMeta: Record<string, CanonicalSonataMetadata> = {
  "FREEZING_FROST": {
    "code": "FREEZING_FROST",
    "name": "Freezing Frost",
    "element": "Glacio",
    "alignmentType": "ELEMENTAL",
    "description": "2-Pc: Glacio DMG +10%. 5-Pc: Upon releasing Basic Attack or Heavy Attack, Glacio DMG +10%, stacking up to 3 times for 15s. Upon releasing Resonance Liberation, grants an extra Glacio DMG +20% for 15s."
  },
  "MOLTEN_RIFT": {
    "code": "MOLTEN_RIFT",
    "name": "Molten Rift",
    "element": "Fusion",
    "alignmentType": "ELEMENTAL",
    "description": "2-Pc: Fusion DMG +10%. 5-Pc: Upon releasing Resonance Skill, Fusion DMG +30% for 15s."
  },
  "VOID_THUNDER": {
    "code": "VOID_THUNDER",
    "name": "Void Thunder",
    "element": "Electro",
    "alignmentType": "ELEMENTAL",
    "description": "2-Pc: Electro DMG +10%. 5-Pc: Upon releasing Heavy Attack or Resonance Skill, Electro DMG +15%, stacking up to 2 times for 15s."
  },
  "SIERRA_GALE": {
    "code": "SIERRA_GALE",
    "name": "Sierra Gale",
    "element": "Aero",
    "alignmentType": "ELEMENTAL",
    "description": "2-Pc: Aero DMG +10%. 5-Pc: Upon releasing Intro Skill, Aero DMG +30% for 15s."
  },
  "CELESTIAL_LIGHT": {
    "code": "CELESTIAL_LIGHT",
    "name": "Celestial Light",
    "element": "Spectro",
    "alignmentType": "ELEMENTAL",
    "description": "2-Pc: Spectro DMG +10%. 5-Pc: Upon releasing Intro Skill, Spectro DMG +30% for 15s."
  },
  "SUN_SINKING_ECLIPSE": {
    "code": "SUN_SINKING_ECLIPSE",
    "name": "Sun-sinking Eclipse",
    "element": "Havoc",
    "alignmentType": "ELEMENTAL",
    "description": "2-Pc: Havoc DMG +10%. 5-Pc: Upon releasing Basic Attack or Heavy Attack, Havoc DMG +7.5%, stacking up to 4 times for 15s."
  },
  "REJUVENATING_GLOW": {
    "code": "REJUVENATING_GLOW",
    "name": "Rejuvenating Glow",
    "element": null,
    "alignmentType": "UNIVERSAL",
    "description": "2-Pc: Healing +10%. 5-Pc: Upon healing allies, increases ATK of all team members by 15% for 30s."
  },
  "MOONLIT_CLOUDS": {
    "code": "MOONLIT_CLOUDS",
    "name": "Moonlit Clouds",
    "element": null,
    "alignmentType": "UNIVERSAL",
    "description": "2-Pc: Energy Regen +10%. 5-Pc: Upon using Outro Skill, increases the ATK of the next Resonator by 22.5% for 15s."
  },
  "LINGERING_TUNES": {
    "code": "LINGERING_TUNES",
    "name": "Lingering Tunes",
    "element": null,
    "alignmentType": "UNIVERSAL",
    "description": "2-Pc: ATK +10%. 5-Pc: While on the field, ATK increases by 5% every 1.5s, stacking up to 4 times. Outro Skill DMG +60%."
  },
  "HEART_OF_SWORN_VIGIL": {
    "code": "HEART_OF_SWORN_VIGIL",
    "name": "Heart of Sworn Vigil",
    "element": "Electro",
    "alignmentType": "ELEMENTAL",
    "description": "2-Pc: Electro DMG +10%. 5-Pc: Inflicting Electro Flare, obtaining Unison, or triggering Unison Response increases Crit Rate by 15% and grants 22.5% Electro DMG for 30s."
  },
  "FLASH_OF_ELECTRIC_REFLECTION": {
    "code": "FLASH_OF_ELECTRIC_REFLECTION",
    "name": "Flash of Electric Reflection",
    "element": "Electro",
    "alignmentType": "ELEMENTAL",
    "description": "2-Pc: Electro DMG +10%. 5-Pc: When the Resonator inflicts Electro Flare on enemies, they gain a 10% Electro DMG Bonus for 15s. While active, casting an Outro Skill grants the incoming Resonator an additional 25% Electro DMG Bonus for 15s."
  },
  "FLOWER_OF_TINGED_YEARNING": {
    "code": "FLOWER_OF_TINGED_YEARNING",
    "name": "Flower of Tinged Yearning",
    "element": null,
    "alignmentType": "UNIVERSAL",
    "description": "2-Pc: Healing +10%. 5-Pc: Healing a team member increases the ATK of all Resonators in the team by 10% for 30s. If the healing Resonator gains Unison or triggers Unison Response while active, team ATK is further increased by an additional 15%."
  }
};

export const CANONICAL_SONATA_METADATA: Readonly<Record<string, CanonicalSonataMetadata>> = Object.freeze(_rawSonataMeta);

/**
 * Resolves canonical Sonata metadata by either set code (e.g. 'FREEZING_FROST')
 * or display name (e.g. 'Freezing Frost').
 */
export function getCanonicalSonataMetadata(idOrName: string): CanonicalSonataMetadata | null {
  if (!idOrName || typeof idOrName !== 'string') return null;
  const direct = CANONICAL_SONATA_METADATA[idOrName];
  if (direct) return direct;
  const trimmed = idOrName.trim();
  for (const meta of Object.values(CANONICAL_SONATA_METADATA)) {
    if (meta.name.toLowerCase() === trimmed.toLowerCase() || meta.code.toLowerCase() === trimmed.toLowerCase()) {
      return meta;
    }
  }
  return null;
}

/**
 * Machine-readable explanation codes for Character Build Evaluation.
 */
export const BUILD_EVALUATION_EXPLANATION_CODES = Object.freeze({
  STATUS_FULLY_EQUIPPED: 'STATUS_FULLY_EQUIPPED',
  STATUS_PARTIALLY_EQUIPPED: 'STATUS_PARTIALLY_EQUIPPED',
  STATUS_UNEQUIPPED: 'STATUS_UNEQUIPPED',
  STATUS_INCOMPATIBLE_WEAPON: 'STATUS_INCOMPATIBLE_WEAPON',
  STATUS_BUILD_UNKNOWN: 'STATUS_BUILD_UNKNOWN',
  STATUS_INVALID: 'STATUS_INVALID',
  STATUS_PATCH_MISMATCH: 'STATUS_PATCH_MISMATCH',
  WEAPON_COMPATIBLE: 'WEAPON_COMPATIBLE',
  WEAPON_INCOMPATIBLE: 'WEAPON_INCOMPATIBLE',
  WEAPON_NOT_EQUIPPED: 'WEAPON_NOT_EQUIPPED',
  WEAPON_LEVEL_MAXED: 'WEAPON_LEVEL_MAXED',
  WEAPON_REFINEMENT_MAXED: 'WEAPON_REFINEMENT_MAXED',
  ECHOES_FULLY_EQUIPPED: 'ECHOES_FULLY_EQUIPPED',
  ECHOES_FULLY_TUNED: 'ECHOES_FULLY_TUNED',
  ECHOES_FULLY_MAXED: 'ECHOES_FULLY_MAXED',
  SONATA_ELEMENT_ALIGNED: 'SONATA_ELEMENT_ALIGNED',
  SONATA_UNIVERSAL: 'SONATA_UNIVERSAL',
  SONATA_MISALIGNED: 'SONATA_MISALIGNED',
  SONATA_NOT_EQUIPPED: 'SONATA_NOT_EQUIPPED'
});

/**
 * Default fallback provenance object for character build evaluation records.
 */
export const EMPTY_BUILD_EVALUATION_PROVENANCE: SourceReference = Object.freeze({
  entityId: 'SYSTEM',
  entityName: 'Deterministic Character Build Evaluation Contract',
  sourceType: 'RESONATOR_ABILITY',
  sourceCode: 'BUILD_EVALUATION_STATE',
  patchVersion: '3.7',
  sourceProvenance: 'Wuthering Waves Deterministic Character Build Engine (Patch 3.7)',
  originalDescription: 'Character build evaluation representation'
});

/**
 * Prohibited keys that must NEVER appear on a CharacterBuildEvaluation,
 * its summary, or its root result container.
 * Enforces strict boundary separation against scoring, DPS, tier lists,
 * team generation, role inference, and meta optimization.
 */
export const PROHIBITED_BUILD_EVALUATION_KEYS = [
  'characterPower',
  'combatPower',
  'dps',
  'damage',
  'rotationDps',
  'tier',
  'metaRank',
  'team',
  'recommendedTeam',
  'optimalTeam',
  'priority',
  'ranking',
  'teamScore',
  'teamPower',
  'synergyScore',
  'compatibilityScore',
  'characterDecisionScore',
  'overallScore',
  'combinedScore',
  'finalScore',
  'priorityScore',
  'powerScore',
  'buildScore',
  'gearScore',
  'toaScore',
  'vigorCost',
  'role',
  'mainDPS',
  'subDPS',
  'support',
  'healer',
  'buffer',
  'hypercarry',
  'offField',
  'onField'
] as const;

export type ProhibitedBuildEvaluationKey = (typeof PROHIBITED_BUILD_EVALUATION_KEYS)[number];
