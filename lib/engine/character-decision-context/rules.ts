/**
 * Wuthering Waves Character Decision Context Rules & Constants
 * Phase 7 Step 19: Deterministic Character Decision Context Contract
 *
 * Defines canonical constants, version constraints, and prohibited field keys.
 */

/** Canonical rule version for Step 19 */
export const CHARACTER_DECISION_CONTEXT_RULE_VERSION = '7.19.1';

/** Canonical patch version */
export const CANONICAL_PATCH_VERSION = '3.7';

/** Required upstream Step 16 rule version */
export const REQUIRED_STEP16_RULE_VERSION = '7.16.1';

/** Required upstream Step 18 rule version */
export const REQUIRED_STEP18_RULE_VERSION = '7.18.1';

/** Total canonical Resonators in Patch 3.7 */
export const CANONICAL_RESONATOR_COUNT = 60;

/** Constant audit verification stamp */
export const OFFLINE_DETERMINISTIC_AUDIT_STAMP = 'OFFLINE_DETERMINISTIC_AUDIT';

/**
 * Prohibited keys that must NEVER appear on a CharacterDecisionContext,
 * its summary, or its root result container.
 * Enforces strict boundary separation against scoring, ranking, team generation,
 * role inference, and meta optimization.
 */
export const PROHIBITED_DECISION_CONTEXT_KEYS = [
  'characterPower',
  'combatPower',
  'dps',
  'damage',
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

export type ProhibitedDecisionContextKey = (typeof PROHIBITED_DECISION_CONTEXT_KEYS)[number];
