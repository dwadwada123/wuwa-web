/**
 * Wuthering Waves Deterministic Tower of Adversity Vigor Allocation & Stage Scheduling Rules
 * Phase 7 Step 23: Deterministic Tower of Adversity Vigor Allocation & Stage Scheduling Contract
 *
 * Defines canonical constants, version constraints, explanation codes, and
 * prohibited field keys for Tower of Adversity stage allocation and Vigor budgeting.
 */

import type { SourceReference } from '../capabilities/types.ts';

/** Canonical rule version for Step 23 */
export const TOA_ALLOCATION_RULE_VERSION = '7.23.1';

/** Canonical patch version */
export const CANONICAL_PATCH_VERSION = '3.7';

/** Canonical Tower of Adversity Season ID in Patch 3.7 */
export const CANONICAL_SEASON_ID = 'season:40';

/** Required upstream Step 22 rule version */
export const REQUIRED_STEP22_RULE_VERSION = '7.22.1';

/** Required upstream Step 21 rule version */
export const REQUIRED_STEP21_RULE_VERSION = '7.21.1';

/** Canonical starting Vigor capacity per Resonator per season */
export const RESONATOR_STARTING_VIGOR = 10;

/** Maximum Vigor capacity per Resonator */
export const MAX_RESONATOR_VIGOR = 10;

/** Minimum valid stage Vigor cost */
export const MIN_STAGE_VIGOR_COST = 1;

/** Maximum valid stage Vigor cost */
export const MAX_STAGE_VIGOR_COST = 5;

/** Total canonical stages in Season 40 Hazard Zone */
export const CANONICAL_STAGE_COUNT = 12;

/** Total canonical towers in Hazard Zone */
export const CANONICAL_TOWER_COUNT = 3;

/** Required team cardinality: exactly 3 Resonators per team */
export const TEAM_MEMBER_COUNT = 3;

/** Canonical element names in Wuthering Waves */
export const CANONICAL_ELEMENTS = Object.freeze([
  'Aero',
  'Electro',
  'Fusion',
  'Glacio',
  'Havoc',
  'Spectro'
] as const);

export type CanonicalElement = (typeof CANONICAL_ELEMENTS)[number];

/** Constant audit verification stamp */
export const OFFLINE_DETERMINISTIC_AUDIT_STAMP = 'OFFLINE_DETERMINISTIC_AUDIT';

/**
 * Machine-readable explanation codes for ToA Vigor Allocation.
 */
export const TOA_ALLOCATION_EXPLANATION_CODES = Object.freeze({
  ALLOCATION_OPTIMAL: 'ALLOCATION_OPTIMAL',
  ALLOCATION_FEASIBLE: 'ALLOCATION_FEASIBLE',
  ALLOCATION_PARTIAL: 'ALLOCATION_PARTIAL',
  ALLOCATION_INFEASIBLE: 'ALLOCATION_INFEASIBLE',
  ALLOCATION_INVALID: 'ALLOCATION_INVALID',
  ALLOCATION_PATCH_MISMATCH: 'ALLOCATION_PATCH_MISMATCH',
  ALLOCATION_SEASON_MISMATCH: 'ALLOCATION_SEASON_MISMATCH',
  ALL_MANDATORY_STAGES_ASSIGNED: 'ALL_MANDATORY_STAGES_ASSIGNED',
  ALL_RESONATOR_VIGOR_PRESERVED: 'ALL_RESONATOR_VIGOR_PRESERVED',
  STAGE_BUFF_MATCHES_MAXIMIZED: 'STAGE_BUFF_MATCHES_MAXIMIZED',
  ALL_TEAMS_FULLY_OWNED: 'ALL_TEAMS_FULLY_OWNED',
  ALL_ASSIGNMENTS_CARDINALITY_VALID: 'ALL_ASSIGNMENTS_CARDINALITY_VALID',
  INSUFFICIENT_PORTFOLIO_VIGOR: 'INSUFFICIENT_PORTFOLIO_VIGOR',
  INSUFFICIENT_ELIGIBLE_TEAMS: 'INSUFFICIENT_ELIGIBLE_TEAMS',
  CHARACTER_VIGOR_OVERDRAFT_PREVENTED: 'CHARACTER_VIGOR_OVERDRAFT_PREVENTED',
  EQUIPMENT_CONTENTION_UNMODELED: 'EQUIPMENT_CONTENTION_UNMODELED'
});

/**
 * Default fallback provenance object for ToA allocation records.
 */
export const EMPTY_TOA_ALLOCATION_PROVENANCE: SourceReference = Object.freeze({
  entityId: 'SYSTEM',
  entityName: 'Deterministic Tower of Adversity Vigor Allocation & Stage Scheduling Contract',
  sourceType: 'RESONATOR_ABILITY',
  sourceCode: 'TOA_STAGE_ALLOCATION_STATE',
  patchVersion: '3.7',
  sourceProvenance: 'Wuthering Waves Deterministic ToA Engine (Patch 3.7)',
  originalDescription: 'Tower of Adversity stage allocation and Vigor scheduling representation'
});

/**
 * Prohibited keys that must NEVER appear on a ToA allocation result,
 * its summary, or its stage assignments.
 * Enforces strict boundary separation against subjective combat scoring,
 * DPS calculations, tier rankings, and meta estimates.
 */
export const PROHIBITED_TOA_ALLOCATION_KEYS = [
  'characterPower',
  'combatPower',
  'teamPower',
  'portfolioPower',
  'stagePower',
  'allocationPower',
  'portfolioScore',
  'teamScore',
  'stageScore',
  'clearTimeScore',
  'dps',
  'damage',
  'rotationDps',
  'teamDps',
  'portfolioDps',
  'stageDps',
  'tier',
  'metaRank',
  'recommendedTeam',
  'optimalTeam',
  'bestTeam',
  'tierList',
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

export type ProhibitedToAAllocationKey = (typeof PROHIBITED_TOA_ALLOCATION_KEYS)[number];
