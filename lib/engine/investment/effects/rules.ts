/**
 * Wuthering Waves Deterministic Investment Effect Resolution Rules & Static Grounding
 * Phase 7 Step 15: Deterministic Investment Effect Resolution & Combat Contribution Contract
 *
 * Grounded strictly in canonical Patch 3.7 data (data/patches/3.7/patch_3_7_dataset.json).
 *
 * CENTRAL INVARIANTS:
 * 1. Rule Version: Strictly '7.15.1'.
 * 2. Feasibility/Fact Resolution only: Zero character scores, zero weapon scores, zero DPS.
 * 3. Exact numerical constants derived directly from Patch 3.7 canonical definitions.
 * 4. Zero numeric defaulting: UNKNOWN is never coerced to 0, S0, R1, or level 1.
 * 5. UNMODELED is never approximated with guessed community formulas.
 */

import type { SourceReference } from '../../capabilities/types.ts';
import type {
  InvestmentDimensionKey,
  InvestmentResolutionFormula
} from './types.ts';

/**
 * Authoritative Step 15 rule version.
 */
export const INVESTMENT_EFFECT_RESOLUTION_RULE_VERSION = '7.15.1';

/**
 * Standard investment-dependent effect IDs evaluated for each Resonator.
 */
export const STANDARD_INVESTMENT_EFFECT_IDS: readonly string[] = Object.freeze([
  'char-base-hp',
  'char-base-atk',
  'char-base-def',
  'char-level-scaling',
  'weapon-base-atk',
  'weapon-sub-stat',
  'weapon-level-scaling',
  'weapon-refinement',
  'sequence-node:S1',
  'sequence-node:S2',
  'sequence-node:S3',
  'sequence-node:S4',
  'sequence-node:S5',
  'sequence-node:S6',
  'sonata-2pc',
  'sonata-5pc',
  'echo-stat-scaling'
]);

/**
 * Canonical Patch 3.7 Resonator Level 90 Base Stats.
 * Derived verbatim from data/patches/3.7/patch_3_7_dataset.json resonators[].patch_data.
 */
export const CANONICAL_RESONATOR_BASE_STATS_LVL90: Readonly<
  Record<string, { readonly hp: number; readonly atk: number; readonly def: number }>
> = Object.freeze({
  "Yangyang": {
    "hp": 10200,
    "atk": 250,
    "def": 1100
  },
  "Chixia": {
    "hp": 9087.5,
    "atk": 300,
    "def": 953.33
  },
  "Verina": {
    "hp": 14237.5,
    "atk": 337.5,
    "def": 1100
  },
  "Rover: Spectro": {
    "hp": 11400,
    "atk": 375,
    "def": 1368.89
  },
  "Sanhua": {
    "hp": 10062.5,
    "atk": 275,
    "def": 941.11
  },
  "Taoqi": {
    "hp": 8950,
    "atk": 225,
    "def": 1564.44
  },
  "Baizhi": {
    "hp": 12812.5,
    "atk": 212.5,
    "def": 1002.22
  },
  "Encore": {
    "hp": 10512.5,
    "atk": 425,
    "def": 1246.66
  },
  "Danjin": {
    "hp": 9437.5,
    "atk": 262.5,
    "def": 1148.89
  },
  "Aalto": {
    "hp": 9850,
    "atk": 262.5,
    "def": 1075.55
  },
  "Jiyan": {
    "hp": 10487.5,
    "atk": 437.5,
    "def": 1185.55
  },
  "Mortefi": {
    "hp": 10025,
    "atk": 250,
    "def": 1136.66
  },
  "Camellya": {
    "hp": 10325,
    "atk": 450,
    "def": 1161.11
  },
  "Calcharo": {
    "hp": 10500,
    "atk": 437.5,
    "def": 1185.55
  },
  "Yinlin": {
    "hp": 11000,
    "atk": 400,
    "def": 1283.33
  },
  "Lingyang": {
    "hp": 10387.5,
    "atk": 437.5,
    "def": 1210
  },
  "Yuanwu": {
    "hp": 8525,
    "atk": 225,
    "def": 1637.77
  },
  "Rover: Havoc": {
    "hp": 10825,
    "atk": 412.5,
    "def": 1258.89
  },
  "Jianxin": {
    "hp": 14112.5,
    "atk": 337.5,
    "def": 1124.44
  },
  "Jinhsi": {
    "hp": 10825,
    "atk": 412.5,
    "def": 1258.89
  },
  "Xiangli Yao": {
    "hp": 10625,
    "atk": 425,
    "def": 1222.22
  },
  "Changli": {
    "hp": 10387.5,
    "atk": 462.5,
    "def": 1100
  },
  "Zhezhi": {
    "hp": 12250,
    "atk": 375,
    "def": 1197.78
  },
  "Lumi": {
    "hp": 8500,
    "atk": 337.5,
    "def": 880
  },
  "Youhu": {
    "hp": 9975,
    "atk": 262.5,
    "def": 1051.11
  },
  "Shorekeeper": {
    "hp": 16712.5,
    "atk": 287.5,
    "def": 1100
  },
  "Roccia": {
    "hp": 12250,
    "atk": 375,
    "def": 1197.78
  },
  "Carlotta": {
    "hp": 12450,
    "atk": 462.5,
    "def": 1197.78
  },
  "Brant": {
    "hp": 11675,
    "atk": 375,
    "def": 1307.78
  },
  "Phoebe": {
    "hp": 10825,
    "atk": 412.5,
    "def": 1258.89
  },
  "Rover: Aero": {
    "hp": 10775,
    "atk": 437.5,
    "def": 1136.66
  },
  "Cantarella": {
    "hp": 11600,
    "atk": 400,
    "def": 1100
  },
  "Ciaccona": {
    "hp": 12237.5,
    "atk": 375,
    "def": 1197.78
  },
  "Zani": {
    "hp": 10775,
    "atk": 437.5,
    "def": 1136.66
  },
  "Lupa": {
    "hp": 11912.5,
    "atk": 387.5,
    "def": 1185.55
  },
  "Phrolova": {
    "hp": 10775,
    "atk": 437.5,
    "def": 1136.66
  },
  "Cartethyia": {
    "hp": 14800,
    "atk": 312.5,
    "def": 611.11
  },
  "Augusta": {
    "hp": 10300,
    "atk": 462.5,
    "def": 1112.22
  },
  "Iuno": {
    "hp": 10525,
    "atk": 450,
    "def": 1124.44
  },
  "Buling": {
    "hp": 10625,
    "atk": 225,
    "def": 1258.89
  },
  "Galbrena": {
    "hp": 10300,
    "atk": 462.5,
    "def": 1112.22
  },
  "Chisa": {
    "hp": 10775,
    "atk": 437.5,
    "def": 1136.66
  },
  "Qiuyuan": {
    "hp": 12237.5,
    "atk": 375,
    "def": 1197.78
  },
  "Lynae": {
    "hp": 12237.5,
    "atk": 375,
    "def": 1197.78
  },
  "Mornye": {
    "hp": 15375,
    "atk": 287.5,
    "def": 1356.66
  },
  "Luuk Herssen": {
    "hp": 10300,
    "atk": 462.5,
    "def": 1112.22
  },
  "Aemeath": {
    "hp": 11025,
    "atk": 425,
    "def": 1148.89
  },
  "Sigrika": {
    "hp": 10775,
    "atk": 437.5,
    "def": 1136.66
  },
  "Denia": {
    "hp": 11025,
    "atk": 425,
    "def": 1148.89
  },
  "Rebecca": {
    "hp": 11600,
    "atk": 400,
    "def": 1173.33
  },
  "Lucilla": {
    "hp": 12237.5,
    "atk": 375,
    "def": 1197.78
  },
  "Lucy": {
    "hp": 11025,
    "atk": 425,
    "def": 1148.89
  },
  "Hiyuki": {
    "hp": 10300,
    "atk": 462.5,
    "def": 1112.22
  },
  "Rover: Electro": {
    "hp": 10775,
    "atk": 437.5,
    "def": 1136.66
  },
  "Yangyang: Xuanling": {
    "hp": 11025,
    "atk": 425,
    "def": 1148.89
  },
  "Suisui": {
    "hp": 16712.5,
    "atk": 287.5,
    "def": 1100
  },
  "Qingxiao": {
    "hp": 10300,
    "atk": 462.5,
    "def": 1112.22
  },
  "Hsin": {
    "hp": 10300,
    "atk": 462.5,
    "def": 1112.22
  },
  "Jingran": {
    "hp": 10825,
    "atk": 412,
    "def": 1258
  },
  "Suoming": {
    "hp": 10300,
    "atk": 462.5,
    "def": 1112.22
  }
});

/**
 * Canonical Patch 3.7 Weapon Level 90 Base Stats.
 * Derived verbatim from data/patches/3.7/patch_3_7_dataset.json weapons[].patch_data.
 */
export const CANONICAL_WEAPON_BASE_STATS_LVL90: Readonly<
  Record<string, { readonly baseAtk: number; readonly subStatType: string; readonly subStatValue: number }>
> = Object.freeze({
  "Blooming Jadehaven": {
    "baseAtk": 587.5,
    "subStatType": "CritRate",
    "subStatValue": 0.243
  },
  "Unspoken Rue": {
    "baseAtk": 587.5,
    "subStatType": "CritRate",
    "subStatValue": 0.243
  },
  "Emerald of Genesis": {
    "baseAtk": 587.5,
    "subStatType": "CritRate",
    "subStatValue": 0.243
  },
  "Blazing Brilliance": {
    "baseAtk": 587.5,
    "subStatType": "CritDMG",
    "subStatValue": 0.486
  },
  "Red Spring": {
    "baseAtk": 587.5,
    "subStatType": "CritRate",
    "subStatValue": 0.243
  },
  "Somnoire Anchor": {
    "baseAtk": 587.5,
    "subStatType": "CritDMG",
    "subStatValue": 0.486
  },
  "Verdant Summit": {
    "baseAtk": 587.5,
    "subStatType": "CritDMG",
    "subStatValue": 0.486
  },
  "Ages of Harvest": {
    "baseAtk": 587.5,
    "subStatType": "CritRate",
    "subStatValue": 0.243
  },
  "Lustrous Razor": {
    "baseAtk": 587.5,
    "subStatType": "ATK%",
    "subStatValue": 0.3645
  },
  "The Mountains Roar": {
    "baseAtk": 587.5,
    "subStatType": "CritRate",
    "subStatValue": 0.243
  },
  "Static Mist": {
    "baseAtk": 587.5,
    "subStatType": "CritRate",
    "subStatValue": 0.243
  },
  "The Reckoning": {
    "baseAtk": 587.5,
    "subStatType": "CritDMG",
    "subStatValue": 0.486
  },
  "Abyssal Decrescendo": {
    "baseAtk": 587.5,
    "subStatType": "CritRate",
    "subStatValue": 0.243
  },
  "Abyss Surges": {
    "baseAtk": 587.5,
    "subStatType": "EnergyRegen",
    "subStatValue": 0.3645
  },
  "Veritys Handle": {
    "baseAtk": 587.5,
    "subStatType": "CritRate",
    "subStatValue": 0.243
  },
  "Iron Grip of Justice": {
    "baseAtk": 587.5,
    "subStatType": "CritDMG",
    "subStatValue": 0.486
  },
  "Cosmic Ripples": {
    "baseAtk": 587.5,
    "subStatType": "EnergyRegen",
    "subStatValue": 0.3645
  },
  "Stringmaster": {
    "baseAtk": 500,
    "subStatType": "CritRate",
    "subStatValue": 0.36
  },
  "Rime-Draped Sprouts": {
    "baseAtk": 500,
    "subStatType": "CritRate",
    "subStatValue": 0.36
  },
  "Stellar Symphony": {
    "baseAtk": 412.5,
    "subStatType": "EnergyRegen",
    "subStatValue": 0.77
  },
  "Whispers of the Deep": {
    "baseAtk": 500,
    "subStatType": "CritDMG",
    "subStatValue": 0.72
  },
  "Autumntrace": {
    "baseAtk": 412.5,
    "subStatType": "CritRate",
    "subStatValue": 0.2025
  },
  "Broadblade#41": {
    "baseAtk": 412.5,
    "subStatType": "EnergyRegen",
    "subStatValue": 0.3235
  },
  "Dauntless Evernight": {
    "baseAtk": 387.5,
    "subStatType": "DEF%",
    "subStatValue": 0.615
  },
  "Helios Cleaver": {
    "baseAtk": 412.5,
    "subStatType": "ATK%",
    "subStatValue": 0.3038
  },
  "Discord": {
    "baseAtk": 337.5,
    "subStatType": "EnergyRegen",
    "subStatValue": 0.518
  },
  "Waning Redshift": {
    "baseAtk": 412.5,
    "subStatType": "ATK%",
    "subStatValue": 0.3038
  },
  "Commando of Conviction": {
    "baseAtk": 412.5,
    "subStatType": "ATK%",
    "subStatValue": 0.3038
  },
  "Lumingloss": {
    "baseAtk": 387.5,
    "subStatType": "ATK%",
    "subStatValue": 0.3888
  },
  "Lunar Cutter": {
    "baseAtk": 412.5,
    "subStatType": "ATK%",
    "subStatValue": 0.3038
  },
  "Sword#18": {
    "baseAtk": 412.5,
    "subStatType": "DEF%",
    "subStatValue": 0.486
  },
  "Overture": {
    "baseAtk": 337.5,
    "subStatType": "EnergyRegen",
    "subStatValue": 0.518
  },
  "End of the Tunnel": {
    "baseAtk": 412.5,
    "subStatType": "CritRate",
    "subStatValue": 0.2025
  },
  "Novaburst": {
    "baseAtk": 412.5,
    "subStatType": "ATK%",
    "subStatValue": 0.3038
  },
  "Thunderbolt": {
    "baseAtk": 387.5,
    "subStatType": "ATK%",
    "subStatValue": 0.3888
  },
  "Undying Flame": {
    "baseAtk": 412.5,
    "subStatType": "ATK%",
    "subStatValue": 0.3038
  },
  "Pistols#26": {
    "baseAtk": 412.5,
    "subStatType": "ATK%",
    "subStatValue": 0.3038
  },
  "Cadenza": {
    "baseAtk": 337.5,
    "subStatType": "EnergyRegen",
    "subStatValue": 0.518
  },
  "Relentless Surge": {
    "baseAtk": 412.5,
    "subStatType": "CritRate",
    "subStatValue": 0.2025
  },
  "Hollow Mirage": {
    "baseAtk": 412.5,
    "subStatType": "ATK%",
    "subStatValue": 0.3038
  },
  "Marcato": {
    "baseAtk": 337.5,
    "subStatType": "EnergyRegen",
    "subStatValue": 0.518
  },
  "Stonard": {
    "baseAtk": 412.5,
    "subStatType": "CritRate",
    "subStatValue": 0.2025
  },
  "Gauntlets#21D": {
    "baseAtk": 387.5,
    "subStatType": "DEF%",
    "subStatValue": 0.615
  },
  "Amity Accord": {
    "baseAtk": 387.5,
    "subStatType": "DEF%",
    "subStatValue": 0.615
  },
  "Abyssal Grip": {
    "baseAtk": 412.5,
    "subStatType": "ATK%",
    "subStatValue": 0.3038
  },
  "Augment": {
    "baseAtk": 412.5,
    "subStatType": "CritRate",
    "subStatValue": 0.2025
  },
  "Comet Flare": {
    "baseAtk": 337.5,
    "subStatType": "HP%",
    "subStatValue": 0.518
  },
  "Jinzhou Keeper": {
    "baseAtk": 387.5,
    "subStatType": "ATK%",
    "subStatValue": 0.3888
  },
  "Rectifier#25": {
    "baseAtk": 337.5,
    "subStatType": "EnergyRegen",
    "subStatValue": 0.518
  },
  "Variation": {
    "baseAtk": 337.5,
    "subStatType": "EnergyRegen",
    "subStatValue": 0.518
  },
  "Fusion Accretion": {
    "baseAtk": 412.5,
    "subStatType": "ATK%",
    "subStatValue": 0.3038
  },
  "Brawlers Broadblade": {
    "baseAtk": 300,
    "subStatType": "ATK%",
    "subStatValue": 0.2025
  },
  "Guardian Broadblade": {
    "baseAtk": 325,
    "subStatType": "ATK%",
    "subStatValue": 0.243
  },
  "Originite: Type I": {
    "baseAtk": 300,
    "subStatType": "DEF%",
    "subStatValue": 0.3235
  },
  "Guardian Sword": {
    "baseAtk": 325,
    "subStatType": "ATK%",
    "subStatValue": 0.243
  },
  "Originite: Type II": {
    "baseAtk": 300,
    "subStatType": "DEF%",
    "subStatValue": 0.3235
  },
  "Sword of Night": {
    "baseAtk": 300,
    "subStatType": "ATK%",
    "subStatValue": 0.2025
  },
  "Guardian Pistols": {
    "baseAtk": 325,
    "subStatType": "ATK%",
    "subStatValue": 0.243
  },
  "Originite: Type III": {
    "baseAtk": 300,
    "subStatType": "DEF%",
    "subStatValue": 0.3235
  },
  "Undaunted": {
    "baseAtk": 300,
    "subStatType": "ATK%",
    "subStatValue": 0.2025
  },
  "Guardian Gauntlets": {
    "baseAtk": 325,
    "subStatType": "ATK%",
    "subStatValue": 0.243
  },
  "Originite: Type IV": {
    "baseAtk": 300,
    "subStatType": "DEF%",
    "subStatValue": 0.3235
  },
  "Iron Gauntlets": {
    "baseAtk": 300,
    "subStatType": "HP%",
    "subStatValue": 0.3235
  },
  "Guardian Rectifier": {
    "baseAtk": 325,
    "subStatType": "ATK%",
    "subStatValue": 0.243
  },
  "Originite: Type V": {
    "baseAtk": 300,
    "subStatType": "DEF%",
    "subStatValue": 0.3235
  },
  "Resonating Melody": {
    "baseAtk": 300,
    "subStatType": "EnergyRegen",
    "subStatValue": 0.3235
  }
});

/**
 * Canonical Patch 3.7 Structured Weapon Refinement Scaling (R1..R5).
 * Exactly 16 weapons in Patch 3.7 possess structured numeric tables in canonical dataset.
 */
export const CANONICAL_WEAPON_REFINEMENT_SCALING: Readonly<
  Record<string, Readonly<Record<string, Readonly<Record<string, number>>>>>
> = Object.freeze({
  "Blooming Jadehaven": {
    "R1": {
      "dmgBonus_all": 12,
      "amplify_skill": 36,
      "resShred_electro": 10,
      "amplify_all": 30
    },
    "R2": {
      "dmgBonus_all": 15,
      "amplify_skill": 45,
      "resShred_electro": 13.5,
      "amplify_all": 37.5
    },
    "R3": {
      "dmgBonus_all": 18,
      "amplify_skill": 54,
      "resShred_electro": 17,
      "amplify_all": 45
    },
    "R4": {
      "dmgBonus_all": 21,
      "amplify_skill": 63,
      "resShred_electro": 20.5,
      "amplify_all": 52.5
    },
    "R5": {
      "dmgBonus_all": 24,
      "amplify_skill": 72,
      "resShred_electro": 24,
      "amplify_all": 60
    }
  },
  "Unspoken Rue": {
    "R1": {
      "atkPct": 12,
      "dmgBonus_electro": 40
    },
    "R2": {
      "atkPct": 15,
      "dmgBonus_electro": 50
    },
    "R3": {
      "atkPct": 18,
      "dmgBonus_electro": 60
    },
    "R4": {
      "atkPct": 21,
      "dmgBonus_electro": 70
    },
    "R5": {
      "atkPct": 24,
      "dmgBonus_electro": 80
    }
  },
  "Emerald of Genesis": {
    "R1": {
      "energyRegen": 12.8,
      "atkPct": 6
    },
    "R2": {
      "energyRegen": 16,
      "atkPct": 7.5
    },
    "R3": {
      "energyRegen": 19.2,
      "atkPct": 9
    },
    "R4": {
      "energyRegen": 22.4,
      "atkPct": 10.5
    },
    "R5": {
      "energyRegen": 25.6,
      "atkPct": 12
    }
  },
  "Blazing Brilliance": {
    "R1": {
      "atkPct": 12,
      "dmgBonus_skill": 4
    },
    "R2": {
      "atkPct": 15,
      "dmgBonus_skill": 5
    },
    "R3": {
      "atkPct": 18,
      "dmgBonus_skill": 6
    },
    "R4": {
      "atkPct": 21,
      "dmgBonus_skill": 7
    },
    "R5": {
      "atkPct": 24,
      "dmgBonus_skill": 8
    }
  },
  "Red Spring": {
    "R1": {
      "atkPct": 12,
      "dmgBonus_basic": 40
    },
    "R2": {
      "atkPct": 15,
      "dmgBonus_basic": 50
    },
    "R3": {
      "atkPct": 18,
      "dmgBonus_basic": 60
    },
    "R4": {
      "atkPct": 21,
      "dmgBonus_basic": 70
    },
    "R5": {
      "atkPct": 24,
      "dmgBonus_basic": 80
    }
  },
  "Somnoire Anchor": {
    "R1": {
      "atkPct": 2,
      "critRate": 6
    },
    "R2": {
      "atkPct": 2.5,
      "critRate": 7.5
    },
    "R3": {
      "atkPct": 3,
      "critRate": 9
    },
    "R4": {
      "atkPct": 3.5,
      "critRate": 10.5
    },
    "R5": {
      "atkPct": 4,
      "critRate": 12
    }
  },
  "Verdant Summit": {
    "R1": {
      "dmgBonus_all": 12,
      "dmgBonus_heavy": 24
    },
    "R2": {
      "dmgBonus_all": 15,
      "dmgBonus_heavy": 30
    },
    "R3": {
      "dmgBonus_all": 18,
      "dmgBonus_heavy": 36
    },
    "R4": {
      "dmgBonus_all": 21,
      "dmgBonus_heavy": 42
    },
    "R5": {
      "dmgBonus_all": 24,
      "dmgBonus_heavy": 48
    }
  },
  "Ages of Harvest": {
    "R1": {
      "dmgBonus_all": 12,
      "dmgBonus_skill": 24
    },
    "R2": {
      "dmgBonus_all": 15,
      "dmgBonus_skill": 30
    },
    "R3": {
      "dmgBonus_all": 18,
      "dmgBonus_skill": 36
    },
    "R4": {
      "dmgBonus_all": 21,
      "dmgBonus_skill": 42
    },
    "R5": {
      "dmgBonus_all": 24,
      "dmgBonus_skill": 48
    }
  },
  "Lustrous Razor": {
    "R1": {
      "energyRegen": 12.8,
      "dmgBonus_liberation": 7
    },
    "R2": {
      "energyRegen": 16,
      "dmgBonus_liberation": 8.75
    },
    "R3": {
      "energyRegen": 19.2,
      "dmgBonus_liberation": 10.5
    },
    "R4": {
      "energyRegen": 22.4,
      "dmgBonus_liberation": 12.25
    },
    "R5": {
      "energyRegen": 25.6,
      "dmgBonus_liberation": 14
    }
  },
  "Static Mist": {
    "R1": {
      "energyRegen": 12.8,
      "atkPct": 10
    },
    "R2": {
      "energyRegen": 16,
      "atkPct": 12.5
    },
    "R3": {
      "energyRegen": 19.2,
      "atkPct": 15
    },
    "R4": {
      "energyRegen": 22.4,
      "atkPct": 17.5
    },
    "R5": {
      "energyRegen": 25.6,
      "atkPct": 20
    }
  },
  "Abyss Surges": {
    "R1": {
      "energyRegen": 12.8,
      "dmgBonus_basic": 10,
      "dmgBonus_skill": 10
    },
    "R2": {
      "energyRegen": 16,
      "dmgBonus_basic": 12.5,
      "dmgBonus_skill": 12.5
    },
    "R3": {
      "energyRegen": 19.2,
      "dmgBonus_basic": 15,
      "dmgBonus_skill": 15
    },
    "R4": {
      "energyRegen": 22.4,
      "dmgBonus_basic": 17.5,
      "dmgBonus_skill": 17.5
    },
    "R5": {
      "energyRegen": 25.6,
      "dmgBonus_basic": 20,
      "dmgBonus_skill": 20
    }
  },
  "Veritys Handle": {
    "R1": {
      "dmgBonus_all": 12,
      "dmgBonus_liberation": 48
    },
    "R2": {
      "dmgBonus_all": 15,
      "dmgBonus_liberation": 60
    },
    "R3": {
      "dmgBonus_all": 18,
      "dmgBonus_liberation": 72
    },
    "R4": {
      "dmgBonus_all": 21,
      "dmgBonus_liberation": 84
    },
    "R5": {
      "dmgBonus_all": 24,
      "dmgBonus_liberation": 96
    }
  },
  "Cosmic Ripples": {
    "R1": {
      "energyRegen": 12.8,
      "dmgBonus_basic": 3.2
    },
    "R2": {
      "energyRegen": 16,
      "dmgBonus_basic": 4
    },
    "R3": {
      "energyRegen": 19.2,
      "dmgBonus_basic": 4.8
    },
    "R4": {
      "energyRegen": 22.4,
      "dmgBonus_basic": 5.6
    },
    "R5": {
      "energyRegen": 25.6,
      "dmgBonus_basic": 6.4
    }
  },
  "Stringmaster": {
    "R1": {
      "dmgBonus_all": 12,
      "atkPct": 12
    },
    "R2": {
      "dmgBonus_all": 15,
      "atkPct": 15
    },
    "R3": {
      "dmgBonus_all": 18,
      "atkPct": 18
    },
    "R4": {
      "dmgBonus_all": 21,
      "atkPct": 21
    },
    "R5": {
      "dmgBonus_all": 24,
      "atkPct": 24
    }
  },
  "Rime-Draped Sprouts": {
    "R1": {
      "atkPct": 12,
      "dmgBonus_basic": 52
    },
    "R2": {
      "atkPct": 15,
      "dmgBonus_basic": 65
    },
    "R3": {
      "atkPct": 18,
      "dmgBonus_basic": 78
    },
    "R4": {
      "atkPct": 21,
      "dmgBonus_basic": 91
    },
    "R5": {
      "atkPct": 24,
      "dmgBonus_basic": 104
    }
  },
  "Stellar Symphony": {
    "R1": {
      "hpPct": 12,
      "atkPct": 14
    },
    "R2": {
      "hpPct": 15,
      "atkPct": 17.5
    },
    "R3": {
      "hpPct": 18,
      "atkPct": 21
    },
    "R4": {
      "hpPct": 21,
      "atkPct": 24.5
    },
    "R5": {
      "hpPct": 24,
      "atkPct": 28
    }
  }
});

/**
 * Canonical Patch 3.7 Sonata 2-Piece and 5-Piece Structured Numeric Effects.
 * Exactly 12 Sonatas with structured values in canonical dataset.
 */
export const CANONICAL_SONATA_EFFECT_VALUES: Readonly<
  Record<
    string,
    {
      readonly name: string;
      readonly twoPieceValue: number;
      readonly twoPieceUnit: string;
      readonly fivePieceValue: number;
      readonly fivePieceUnit: string;
    }
  >
> = Object.freeze({
  "FREEZING_FROST": {
    "name": "Freezing Frost",
    "twoPieceValue": 0.1,
    "twoPieceUnit": "PERCENT",
    "fivePieceValue": 0.3,
    "fivePieceUnit": "PERCENT"
  },
  "MOLTEN_RIFT": {
    "name": "Molten Rift",
    "twoPieceValue": 0.1,
    "twoPieceUnit": "PERCENT",
    "fivePieceValue": 0.3,
    "fivePieceUnit": "PERCENT"
  },
  "VOID_THUNDER": {
    "name": "Void Thunder",
    "twoPieceValue": 0.1,
    "twoPieceUnit": "PERCENT",
    "fivePieceValue": 0.3,
    "fivePieceUnit": "PERCENT"
  },
  "SIERRA_GALE": {
    "name": "Sierra Gale",
    "twoPieceValue": 0.1,
    "twoPieceUnit": "PERCENT",
    "fivePieceValue": 0.3,
    "fivePieceUnit": "PERCENT"
  },
  "CELESTIAL_LIGHT": {
    "name": "Celestial Light",
    "twoPieceValue": 0.1,
    "twoPieceUnit": "PERCENT",
    "fivePieceValue": 0.3,
    "fivePieceUnit": "PERCENT"
  },
  "SUN_SINKING_ECLIPSE": {
    "name": "Sun-sinking Eclipse",
    "twoPieceValue": 0.1,
    "twoPieceUnit": "PERCENT",
    "fivePieceValue": 0.3,
    "fivePieceUnit": "PERCENT"
  },
  "REJUVENATING_GLOW": {
    "name": "Rejuvenating Glow",
    "twoPieceValue": 0.1,
    "twoPieceUnit": "PERCENT",
    "fivePieceValue": 0.15,
    "fivePieceUnit": "PERCENT"
  },
  "MOONLIT_CLOUDS": {
    "name": "Moonlit Clouds",
    "twoPieceValue": 0.1,
    "twoPieceUnit": "PERCENT",
    "fivePieceValue": 0.225,
    "fivePieceUnit": "PERCENT"
  },
  "LINGERING_TUNES": {
    "name": "Lingering Tunes",
    "twoPieceValue": 0.1,
    "twoPieceUnit": "PERCENT",
    "fivePieceUnit": "PERCENT",
    "fivePieceValue": 0.2
  },
  "HEART_OF_SWORN_VIGIL": {
    "name": "Heart of Sworn Vigil",
    "twoPieceValue": 0.1,
    "twoPieceUnit": "PERCENT",
    "fivePieceValue": 0.15,
    "fivePieceUnit": "PERCENT"
  },
  "FLASH_OF_ELECTRIC_REFLECTION": {
    "name": "Flash of Electric Reflection",
    "twoPieceValue": 0.1,
    "twoPieceUnit": "PERCENT",
    "fivePieceUnit": "PERCENT",
    "fivePieceValue": 0.25
  },
  "FLOWER_OF_TINGED_YEARNING": {
    "name": "Flower of Tinged Yearning",
    "twoPieceValue": 0.1,
    "twoPieceUnit": "PERCENT",
    "fivePieceValue": 0.1,
    "fivePieceUnit": "PERCENT"
  }
});

/**
 * Machine-readable explanation reason codes for Step 15.
 */
export const EFFECT_RESOLUTION_REASON_CODES = Object.freeze({
  ALL_INPUTS_AND_FORMULA_RESOLVED: 'ALL_INPUTS_AND_FORMULA_RESOLVED',
  CHARACTER_LEVEL_UNKNOWN: 'CHARACTER_LEVEL_UNKNOWN',
  CHARACTER_LEVEL_SCALING_UNMODELED: 'CHARACTER_LEVEL_SCALING_UNMODELED',
  WEAPON_SNAPSHOT_UNKNOWN: 'WEAPON_SNAPSHOT_UNKNOWN',
  WEAPON_LEVEL_UNKNOWN: 'WEAPON_LEVEL_UNKNOWN',
  WEAPON_LEVEL_SCALING_UNMODELED: 'WEAPON_LEVEL_SCALING_UNMODELED',
  WEAPON_REFINEMENT_UNKNOWN: 'WEAPON_REFINEMENT_UNKNOWN',
  WEAPON_REFINEMENT_PROSE_ONLY: 'WEAPON_REFINEMENT_PROSE_ONLY',
  SEQUENCE_LEVEL_UNKNOWN: 'SEQUENCE_LEVEL_UNKNOWN',
  SEQUENCE_NODE_PROSE_ONLY: 'SEQUENCE_NODE_PROSE_ONLY',
  SEQUENCE_NODE_LOCKED: 'SEQUENCE_NODE_LOCKED',
  SONATA_SET_UNKNOWN: 'SONATA_SET_UNKNOWN',
  ECHO_EQUIPPED_COUNT_UNKNOWN: 'ECHO_EQUIPPED_COUNT_UNKNOWN',
  SONATA_SET_PIECES_THRESHOLD_NOT_MET: 'SONATA_SET_PIECES_THRESHOLD_NOT_MET',
  ECHO_STAT_SCALING_UNMODELED: 'ECHO_STAT_SCALING_UNMODELED',
  ECHO_INVESTMENT_UNKNOWN: 'ECHO_INVESTMENT_UNKNOWN',
  INVALID_RESONATOR: 'INVALID_RESONATOR',
  INVALID_INVESTMENT_VALUE: 'INVALID_INVESTMENT_VALUE',
  PATCH_MISMATCH: 'PATCH_MISMATCH'
});

/**
 * Authoritative Step 15 Resolution Formulas.
 */
export const FORMULA_CHAR_BASE_HP_LVL90: InvestmentResolutionFormula = Object.freeze({
  formulaId: 'formula:char-base-hp-lvl90:3.7',
  formulaVersion: '7.15.1',
  inputDimensions: Object.freeze(['CHARACTER_LEVEL'] as InvestmentDimensionKey[]),
  sourceFactIds: Object.freeze(['fact:patch-3-7:resonator-base-hp-lvl90']),
  provenance: Object.freeze({
    entityId: 'SYSTEM',
    entityName: 'SYSTEM',
    patchVersion: '3.7',
    sourceType: 'RESONATOR_ABILITY',
    sourceProvenance: 'data/patches/3.7/patch_3_7_dataset.json#resonators/patch_data/base_hp_lvl90',
    originalDescription: 'Character Level 90 Base HP'
  })
});

export const FORMULA_CHAR_BASE_ATK_LVL90: InvestmentResolutionFormula = Object.freeze({
  formulaId: 'formula:char-base-atk-lvl90:3.7',
  formulaVersion: '7.15.1',
  inputDimensions: Object.freeze(['CHARACTER_LEVEL'] as InvestmentDimensionKey[]),
  sourceFactIds: Object.freeze(['fact:patch-3-7:resonator-base-atk-lvl90']),
  provenance: Object.freeze({
    entityId: 'SYSTEM',
    entityName: 'SYSTEM',
    patchVersion: '3.7',
    sourceType: 'RESONATOR_ABILITY',
    sourceProvenance: 'data/patches/3.7/patch_3_7_dataset.json#resonators/patch_data/base_atk_lvl90',
    originalDescription: 'Character Level 90 Base ATK'
  })
});

export const FORMULA_CHAR_BASE_DEF_LVL90: InvestmentResolutionFormula = Object.freeze({
  formulaId: 'formula:char-base-def-lvl90:3.7',
  formulaVersion: '7.15.1',
  inputDimensions: Object.freeze(['CHARACTER_LEVEL'] as InvestmentDimensionKey[]),
  sourceFactIds: Object.freeze(['fact:patch-3-7:resonator-base-def-lvl90']),
  provenance: Object.freeze({
    entityId: 'SYSTEM',
    entityName: 'SYSTEM',
    patchVersion: '3.7',
    sourceType: 'RESONATOR_ABILITY',
    sourceProvenance: 'data/patches/3.7/patch_3_7_dataset.json#resonators/patch_data/base_def_lvl90',
    originalDescription: 'Character Level 90 Base DEF'
  })
});

export const FORMULA_WEAPON_BASE_ATK_LVL90: InvestmentResolutionFormula = Object.freeze({
  formulaId: 'formula:weapon-base-atk-lvl90:3.7',
  formulaVersion: '7.15.1',
  inputDimensions: Object.freeze(['WEAPON_IDENTITY', 'WEAPON_LEVEL'] as InvestmentDimensionKey[]),
  sourceFactIds: Object.freeze(['fact:patch-3-7:weapon-base-atk-lvl90']),
  provenance: Object.freeze({
    entityId: 'SYSTEM',
    entityName: 'SYSTEM',
    patchVersion: '3.7',
    sourceType: 'WEAPON_PASSIVE',
    sourceProvenance: 'data/patches/3.7/patch_3_7_dataset.json#weapons/patch_data/base_atk_lvl90',
    originalDescription: 'Weapon Level 90 Base ATK'
  })
});

export const FORMULA_WEAPON_SUB_STAT_LVL90: InvestmentResolutionFormula = Object.freeze({
  formulaId: 'formula:weapon-sub-stat-lvl90:3.7',
  formulaVersion: '7.15.1',
  inputDimensions: Object.freeze(['WEAPON_IDENTITY', 'WEAPON_LEVEL'] as InvestmentDimensionKey[]),
  sourceFactIds: Object.freeze(['fact:patch-3-7:weapon-sub-stat-lvl90']),
  provenance: Object.freeze({
    entityId: 'SYSTEM',
    entityName: 'SYSTEM',
    patchVersion: '3.7',
    sourceType: 'WEAPON_PASSIVE',
    sourceProvenance: 'data/patches/3.7/patch_3_7_dataset.json#weapons/patch_data/sub_stat_value_lvl90',
    originalDescription: 'Weapon Level 90 Sub Stat Value'
  })
});

export const FORMULA_WEAPON_REFINEMENT: InvestmentResolutionFormula = Object.freeze({
  formulaId: 'formula:weapon-refinement:3.7',
  formulaVersion: '7.15.1',
  inputDimensions: Object.freeze(['WEAPON_IDENTITY', 'WEAPON_REFINEMENT'] as InvestmentDimensionKey[]),
  sourceFactIds: Object.freeze(['fact:patch-3-7:weapon-refinement-scaling']),
  provenance: Object.freeze({
    entityId: 'SYSTEM',
    entityName: 'SYSTEM',
    patchVersion: '3.7',
    sourceType: 'WEAPON_REFINEMENT',
    sourceProvenance: 'data/patches/3.7/patch_3_7_dataset.json#weapons/patch_data/refinement_scaling',
    originalDescription: 'Weapon Refinement Scaling'
  })
});

export const FORMULA_SONATA_2PC: InvestmentResolutionFormula = Object.freeze({
  formulaId: 'formula:sonata-2pc:3.7',
  formulaVersion: '7.15.1',
  inputDimensions: Object.freeze(['ECHO_SONATA_SET', 'ECHO_EQUIPPED_COUNT'] as InvestmentDimensionKey[]),
  sourceFactIds: Object.freeze(['fact:patch-3-7:sonata-2pc-effect']),
  provenance: Object.freeze({
    entityId: 'SYSTEM',
    entityName: 'SYSTEM',
    patchVersion: '3.7',
    sourceType: 'SONATA_EFFECT',
    sourceProvenance: 'data/patches/3.7/patch_3_7_dataset.json#sonatas/patch_data/two_piece_effect',
    originalDescription: 'Sonata 2-Piece Set Effect'
  })
});

export const FORMULA_SONATA_5PC: InvestmentResolutionFormula = Object.freeze({
  formulaId: 'formula:sonata-5pc:3.7',
  formulaVersion: '7.15.1',
  inputDimensions: Object.freeze(['ECHO_SONATA_SET', 'ECHO_EQUIPPED_COUNT'] as InvestmentDimensionKey[]),
  sourceFactIds: Object.freeze(['fact:patch-3-7:sonata-5pc-effect']),
  provenance: Object.freeze({
    entityId: 'SYSTEM',
    entityName: 'SYSTEM',
    patchVersion: '3.7',
    sourceType: 'SONATA_EFFECT',
    sourceProvenance: 'data/patches/3.7/patch_3_7_dataset.json#sonatas/patch_data/five_piece_effect',
    originalDescription: 'Sonata 5-Piece Set Effect'
  })
});

/**
 * Creates fallback provenance for an investment effect resolution record.
 */
export function createDefaultStep15Provenance(
  resonatorId: string,
  effectId: string
): SourceReference {
  return Object.freeze({
    entityId: resonatorId,
    entityName: resonatorId,
    sourceCode: effectId,
    patchVersion: '3.7',
    sourceType: 'RESONATOR_ABILITY',
    sourceProvenance: 'lib/engine/investment/effects/resolver.ts',
    originalDescription: `Investment effect ${effectId} for ${resonatorId}`
  });
}
