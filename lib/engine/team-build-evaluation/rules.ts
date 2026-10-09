/**
 * Wuthering Waves Team Build Evaluation Rules & Constants
 * Phase 7 Step 21: Deterministic Team Build Evaluation Contract
 *
 * Defines canonical constants, version constraints, machine-readable explanation codes,
 * and prohibited field keys for Team Build Evaluation.
 */

import type { SourceReference } from '../capabilities/types.ts';

/** Canonical rule version for Step 21 */
export const TEAM_BUILD_EVALUATION_RULE_VERSION = '7.21.1';

/** Canonical patch version */
export const CANONICAL_PATCH_VERSION = '3.7';

/** Required upstream Step 20 rule version */
export const REQUIRED_STEP20_RULE_VERSION = '7.20.1';

/** Required upstream Step 9 rule version */
export const REQUIRED_STEP9_RULE_VERSION = '7.9.1';

/** Strict cardinality of team candidate: exactly 3 distinct Resonators */
export const TEAM_MEMBER_COUNT = 3;

/** Total tracked build aspects across 3 members (6 aspects * 3 members) */
export const TEAM_TOTAL_ASPECTS_COUNT = 18;

/** Constant audit verification stamp */
export const OFFLINE_DETERMINISTIC_AUDIT_STAMP = 'OFFLINE_DETERMINISTIC_AUDIT';

/**
 * Machine-readable explanation codes for Team Build Evaluation.
 */
export const TEAM_BUILD_EVALUATION_EXPLANATION_CODES = Object.freeze({
  STATUS_FULLY_EQUIPPED: 'STATUS_FULLY_EQUIPPED',
  STATUS_PARTIALLY_EQUIPPED: 'STATUS_PARTIALLY_EQUIPPED',
  STATUS_UNEQUIPPED: 'STATUS_UNEQUIPPED',
  STATUS_INCOMPATIBLE_WEAPON: 'STATUS_INCOMPATIBLE_WEAPON',
  STATUS_BUILD_UNKNOWN: 'STATUS_BUILD_UNKNOWN',
  STATUS_PARTIALLY_UNKNOWN: 'STATUS_PARTIALLY_UNKNOWN',
  STATUS_INVALID: 'STATUS_INVALID',
  STATUS_PATCH_MISMATCH: 'STATUS_PATCH_MISMATCH',
  ALL_WEAPONS_COMPATIBLE: 'ALL_WEAPONS_COMPATIBLE',
  HAS_INCOMPATIBLE_WEAPON: 'HAS_INCOMPATIBLE_WEAPON',
  ALL_MEMBERS_EQUIPPED: 'ALL_MEMBERS_EQUIPPED',
  DUPLICATE_SONATA_SETS_PRESENT: 'DUPLICATE_SONATA_SETS_PRESENT',
  SONATA_STACKING_UNMODELED: 'SONATA_STACKING_UNMODELED',
  ALL_MEMBERS_BUILD_COMPLETE: 'ALL_MEMBERS_BUILD_COMPLETE'
});

/**
 * Default fallback provenance object for team build evaluation records.
 */
export const EMPTY_TEAM_BUILD_EVALUATION_PROVENANCE: SourceReference = Object.freeze({
  entityId: 'SYSTEM',
  entityName: 'Deterministic Team Build Evaluation Contract',
  sourceType: 'RESONATOR_ABILITY',
  sourceCode: 'TEAM_BUILD_EVALUATION_STATE',
  patchVersion: '3.7',
  sourceProvenance: 'Wuthering Waves Deterministic Team Build Engine (Patch 3.7)',
  originalDescription: 'Team build evaluation representation'
});

/**
 * Prohibited keys that must NEVER appear on a TeamBuildEvaluation,
 * its summary, or its root result container.
 * Enforces strict boundary separation against scoring, DPS, tier lists,
 * team generation, role inference, and meta optimization.
 */
export const PROHIBITED_TEAM_BUILD_EVALUATION_KEYS = [
  'characterPower',
  'combatPower',
  'teamPower',
  'teamScore',
  'dps',
  'damage',
  'rotationDps',
  'teamDps',
  'tier',
  'metaRank',
  'recommendedTeam',
  'optimalTeam',
  'bestTeam',
  'priority',
  'ranking',
  'rank',
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

export type ProhibitedTeamBuildEvaluationKey = (typeof PROHIBITED_TEAM_BUILD_EVALUATION_KEYS)[number];
