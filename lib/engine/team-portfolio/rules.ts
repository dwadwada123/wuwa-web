/**
 * Wuthering Waves Team Portfolio Selection & Optimization Rules & Constants
 * Phase 7 Step 22: Deterministic Team Portfolio Selection & Optimization Contract
 *
 * Defines canonical constants, version constraints, explanation codes, and
 * prohibited field keys for Team Portfolio Selection.
 */

import type { SourceReference } from '../capabilities/types.ts';

/** Canonical rule version for Step 22 */
export const TEAM_PORTFOLIO_RULE_VERSION = '7.22.1';

/** Canonical patch version */
export const CANONICAL_PATCH_VERSION = '3.7';

/** Required upstream Step 21 rule version */
export const REQUIRED_STEP21_RULE_VERSION = '7.21.1';

/** Required upstream Step 10 rule version */
export const REQUIRED_STEP10_RULE_VERSION = '7.10.1';

/** Required upstream Step 12 rule version */
export const REQUIRED_STEP12_RULE_VERSION = '7.12.1';

/** Default requested portfolio size (3 teams of 3 = 9 Resonators) */
export const DEFAULT_PORTFOLIO_TARGET_K = 3;

/** Minimum supported portfolio size */
export const MIN_PORTFOLIO_TARGET_K = 1;

/** Maximum supported portfolio size (60 canonical Resonators / 3 = 20 teams) */
export const MAX_PORTFOLIO_TARGET_K = 20;

/** Required team cardinality: exactly 3 distinct Resonators per team */
export const TEAM_MEMBER_COUNT = 3;

/** Total tracked build aspects per team */
export const ASPECTS_PER_TEAM = 18;

/** Constant audit verification stamp */
export const OFFLINE_DETERMINISTIC_AUDIT_STAMP = 'OFFLINE_DETERMINISTIC_AUDIT';

/**
 * Machine-readable explanation codes for Team Portfolio Selection.
 */
export const TEAM_PORTFOLIO_EXPLANATION_CODES = Object.freeze({
  PORTFOLIO_OPTIMAL: 'PORTFOLIO_OPTIMAL',
  PORTFOLIO_FEASIBLE: 'PORTFOLIO_FEASIBLE',
  PORTFOLIO_PARTIAL: 'PORTFOLIO_PARTIAL',
  PORTFOLIO_INFEASIBLE: 'PORTFOLIO_INFEASIBLE',
  PORTFOLIO_INVALID: 'PORTFOLIO_INVALID',
  PORTFOLIO_PATCH_MISMATCH: 'PORTFOLIO_PATCH_MISMATCH',
  ALL_TEAMS_MUTUALLY_DISJOINT: 'ALL_TEAMS_MUTUALLY_DISJOINT',
  ALL_TEAMS_FULLY_OWNED: 'ALL_TEAMS_FULLY_OWNED',
  ALL_TEAMS_FULLY_EQUIPPED: 'ALL_TEAMS_FULLY_EQUIPPED',
  ALL_TEAMS_COMPATIBLE_WEAPONS: 'ALL_TEAMS_COMPATIBLE_WEAPONS',
  CONTAINS_INCOMPATIBLE_WEAPON: 'CONTAINS_INCOMPATIBLE_WEAPON',
  HAS_CROSS_TEAM_DUPLICATE_SONATAS: 'HAS_CROSS_TEAM_DUPLICATE_SONATAS',
  NO_CROSS_TEAM_DUPLICATE_SONATAS: 'NO_CROSS_TEAM_DUPLICATE_SONATAS',
  EQUIPMENT_CONTENTION_UNMODELED: 'EQUIPMENT_CONTENTION_UNMODELED',
  INSUFFICIENT_OWNED_RESONATORS: 'INSUFFICIENT_OWNED_RESONATORS',
  NO_DISJOINT_COMBINATION_FOUND: 'NO_DISJOINT_COMBINATION_FOUND'
});

/**
 * Default fallback provenance object for team portfolio records.
 */
export const EMPTY_TEAM_PORTFOLIO_PROVENANCE: SourceReference = Object.freeze({
  entityId: 'SYSTEM',
  entityName: 'Deterministic Team Portfolio Selection & Optimization Contract',
  sourceType: 'RESONATOR_ABILITY',
  sourceCode: 'TEAM_PORTFOLIO_STATE',
  patchVersion: '3.7',
  sourceProvenance: 'Wuthering Waves Deterministic Team Portfolio Engine (Patch 3.7)',
  originalDescription: 'Team portfolio representation'
});

/**
 * Prohibited keys that must NEVER appear on a TeamPortfolio,
 * its summary, or its root result container.
 * Enforces strict boundary separation against scoring, DPS, tier lists,
 * ToA floor assignment, and Vigor allocation.
 */
export const PROHIBITED_TEAM_PORTFOLIO_KEYS = [
  'characterPower',
  'combatPower',
  'teamPower',
  'portfolioPower',
  'portfolioScore',
  'teamScore',
  'dps',
  'damage',
  'rotationDps',
  'teamDps',
  'portfolioDps',
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
  'vigorConsumed',
  'vigorRemaining',
  'stageAssignment',
  'floorAssignment',
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

export type ProhibitedTeamPortfolioKey = (typeof PROHIBITED_TEAM_PORTFOLIO_KEYS)[number];
