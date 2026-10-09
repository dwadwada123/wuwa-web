/**
 * Wuthering Waves Character Interaction Profile Rules & Constants
 * Phase 7 Step 18: Deterministic Character Interaction Aggregation & Evidence Profile Contract
 *
 * Implements deterministic constants, rule version, reason codes, and safety invariants.
 */

/**
 * Authoritative Step 18 Contract Rule Version.
 */
export const CHARACTER_INTERACTION_PROFILE_RULE_VERSION = '7.18.1' as const;

/**
 * Deterministic reason codes for profile aggregation decisions.
 */
export const PROFILE_REASON_CODES = Object.freeze({
  PROFILES_AGGREGATED: 'PROFILES_AGGREGATED',
  DIRECTIONALITY_INDEXED: 'DIRECTIONALITY_INDEXED',
  STEP17_EVIDENCE_INDEXED: 'STEP17_EVIDENCE_INDEXED',
  EMPTY_PROFILE_RECORDED: 'EMPTY_PROFILE_RECORDED'
});

/**
 * Prohibited keys that MUST NOT appear on any Step 18 profile or summary record.
 */
export const PROHIBITED_PROFILE_KEYS: readonly string[] = Object.freeze([
  'characterPower',
  'combatPower',
  'dps',
  'DPS',
  'damage',
  'rotationDps',
  'teamScore',
  'teamPower',
  'team',
  'optimalBuild',
  'rank',
  'toaScore',
  'vigorCost',
  'role',
  'metaRank',
  'metaScore',
  'tier',
  'tierList',
  'synergyScore',
  'relationshipScore',
  'characterScore',
  'interactionScore',
  'qualityScore',
  'compatibilityScore',
  'strengthScore'
]);
