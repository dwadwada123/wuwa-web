/**
 * Wuthering Waves Deterministic Resonator Investment Rules
 * Phase 7 Step 13: Deterministic Resonator Investment Snapshot & Capability Contract
 *
 * Centralizes rule versioning, canonical boundaries, catalogs, and machine-readable explanation codes.
 *
 * CRITICAL ARCHITECTURAL CONSTRAINTS:
 * 1. Rule Version: Strictly '7.13.1'.
 * 2. Feasibility/State only: Investment is an input state, NOT a gameplay score.
 * 3. Exact numerical limits derived directly from Patch 3.7 canonical definitions.
 * 4. Zero numeric defaulting: UNKNOWN is never coerced to 0, S0, R1, or level 1.
 */

import type { SourceReference } from '../capabilities/types.ts';
import type { InvestmentDimensionKey } from './types.ts';

/**
 * Authoritative Step 13 rule version.
 */
export const RESONATOR_INVESTMENT_RULE_VERSION = '7.13.1';

/**
 * Canonical numerical limits for Resonator and equipment investment in Patch 3.7.
 */
export const INVESTMENT_LIMITS = Object.freeze({
  MIN_CHARACTER_LEVEL: 1,
  MAX_CHARACTER_LEVEL: 90,
  MIN_WEAPON_LEVEL: 1,
  MAX_WEAPON_LEVEL: 90,
  MIN_REFINEMENT_RANK: 1,
  MAX_REFINEMENT_RANK: 5,
  MIN_SEQUENCE_LEVEL: 0,
  MAX_SEQUENCE_LEVEL: 6,
  MIN_ECHO_COUNT: 0,
  MAX_ECHO_COUNT: 5
});

/**
 * All 66 canonical weapon entity IDs in Patch 3.7.
 */
export const CANONICAL_PATCH_3_7_WEAPON_IDS: readonly string[] = Object.freeze([
  'Abyss Surges',
  'Abyssal Decrescendo',
  'Abyssal Grip',
  'Ages of Harvest',
  'Amity Accord',
  'Augment',
  'Autumntrace',
  'Blazing Brilliance',
  'Blooming Jadehaven',
  'Brawlers Broadblade',
  'Broadblade#41',
  'Cadenza',
  'Comet Flare',
  'Commando of Conviction',
  'Cosmic Ripples',
  'Dauntless Evernight',
  'Discord',
  'Emerald of Genesis',
  'End of the Tunnel',
  'Fusion Accretion',
  'Gauntlets#21D',
  'Guardian Broadblade',
  'Guardian Gauntlets',
  'Guardian Pistols',
  'Guardian Rectifier',
  'Guardian Sword',
  'Helios Cleaver',
  'Hollow Mirage',
  'Iron Gauntlets',
  'Iron Grip of Justice',
  'Jinzhou Keeper',
  'Lumingloss',
  'Lunar Cutter',
  'Lustrous Razor',
  'Marcato',
  'Novaburst',
  'Originite: Type I',
  'Originite: Type II',
  'Originite: Type III',
  'Originite: Type IV',
  'Originite: Type V',
  'Overture',
  'Pistols#26',
  'Rectifier#25',
  'Red Spring',
  'Relentless Surge',
  'Resonating Melody',
  'Rime-Draped Sprouts',
  'Somnoire Anchor',
  'Static Mist',
  'Stellar Symphony',
  'Stonard',
  'Stringmaster',
  'Sword of Night',
  'Sword#18',
  'The Mountains Roar',
  'The Reckoning',
  'Thunderbolt',
  'Undaunted',
  'Undying Flame',
  'Unspoken Rue',
  'Variation',
  'Verdant Summit',
  'Veritys Handle',
  'Waning Redshift',
  'Whispers of the Deep'
]);

export const CANONICAL_WEAPON_SET: ReadonlySet<string> = new Set(CANONICAL_PATCH_3_7_WEAPON_IDS);

/**
 * All 12 canonical Sonata sets in Patch 3.7 (codes and names).
 */
export const CANONICAL_PATCH_3_7_SONATA_CODES: readonly string[] = Object.freeze([
  'FREEZING_FROST',
  'MOLTEN_RIFT',
  'VOID_THUNDER',
  'SIERRA_GALE',
  'CELESTIAL_LIGHT',
  'SUN_SINKING_ECLIPSE',
  'REJUVENATING_GLOW',
  'MOONLIT_CLOUDS',
  'LINGERING_TUNES',
  'HEART_OF_SWORN_VIGIL',
  'FLASH_OF_ELECTRIC_REFLECTION',
  'FLOWER_OF_TINGED_YEARNING'
]);

export const CANONICAL_PATCH_3_7_SONATA_NAMES: readonly string[] = Object.freeze([
  'Freezing Frost',
  'Molten Rift',
  'Void Thunder',
  'Sierra Gale',
  'Celestial Light',
  'Sun-sinking Eclipse',
  'Rejuvenating Glow',
  'Moonlit Clouds',
  'Lingering Tunes',
  'Heart of Sworn Vigil',
  'Flash of Electric Reflection',
  'Flower of Tinged Yearning'
]);

export const CANONICAL_SONATA_SET: ReadonlySet<string> = new Set([
  ...CANONICAL_PATCH_3_7_SONATA_CODES,
  ...CANONICAL_PATCH_3_7_SONATA_NAMES
]);

/**
 * The 9 canonical investment dimensions tracked by Step 13.
 */
export const ALL_INVESTMENT_DIMENSIONS: readonly InvestmentDimensionKey[] = Object.freeze([
  'CHARACTER_LEVEL',
  'WEAPON_IDENTITY',
  'WEAPON_LEVEL',
  'WEAPON_REFINEMENT',
  'SEQUENCE_LEVEL',
  'ECHO_EQUIPPED_COUNT',
  'ECHO_TUNED_COUNT',
  'ECHO_MAX_LEVEL_COUNT',
  'ECHO_SONATA_SET'
]);

/**
 * Machine-readable explanation codes for Resonator investment state.
 */
export const INVESTMENT_EXPLANATION_CODES = Object.freeze({
  INVESTMENT_RECORD_CANONICAL: 'INVESTMENT_RECORD_CANONICAL',
  INVESTMENT_UNKNOWN_PRESERVED: 'INVESTMENT_UNKNOWN_PRESERVED',
  INVESTMENT_DIMENSION_KNOWN: 'INVESTMENT_DIMENSION_KNOWN',
  INVESTMENT_DIMENSION_UNKNOWN: 'INVESTMENT_DIMENSION_UNKNOWN',
  INVESTMENT_PATCH_MISMATCH: 'INVESTMENT_PATCH_MISMATCH',
  INVESTMENT_INVALID_RESONATOR: 'INVESTMENT_INVALID_RESONATOR',
  INVESTMENT_INVALID_WEAPON: 'INVESTMENT_INVALID_WEAPON',
  INVESTMENT_INVALID_LEVEL: 'INVESTMENT_INVALID_LEVEL',
  INVESTMENT_INVALID_SEQUENCE: 'INVESTMENT_INVALID_SEQUENCE',
  INVESTMENT_INVALID_REFINEMENT: 'INVESTMENT_INVALID_REFINEMENT',
  INVESTMENT_INVALID_ECHO: 'INVESTMENT_INVALID_ECHO'
});

/**
 * Default fallback provenance object for investment snapshots.
 */
export const EMPTY_INVESTMENT_PROVENANCE: SourceReference = Object.freeze({
  entityId: 'SYSTEM',
  entityName: 'Deterministic Engine Resonator Investment Contract',
  sourceType: 'RESONATOR_ABILITY',
  sourceCode: 'INVESTMENT_STATE',
  patchVersion: '3.7',
  sourceProvenance: 'Wuthering Waves Deterministic Investment Engine (Patch 3.7)',
  originalDescription: 'Investment snapshot representation'
});
