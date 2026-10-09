/**
 * Wuthering Waves Deterministic End-to-End Recommendation Orchestration Rules & Constants
 * Phase 7 Step 24: Deterministic End-to-End Recommendation Orchestration Contract
 *
 * Defines canonical constants, version constraints, explanation codes, and
 * prohibited field keys for end-to-end recommendation orchestration.
 */

import type { SourceReference } from '../capabilities/types.ts';

/** Canonical rule version for Step 24 */
export const RECOMMENDATION_ORCHESTRATION_RULE_VERSION = '7.24.1';

/** Canonical patch version */
export const CANONICAL_PATCH_VERSION = '3.7';

/** Canonical Tower of Adversity Season ID in Patch 3.7 */
export const CANONICAL_SEASON_ID = 'season:40';

/** Required upstream Step 23 rule version */
export const REQUIRED_STEP23_RULE_VERSION = '7.23.1';

/** Required upstream Step 22 rule version */
export const REQUIRED_STEP22_RULE_VERSION = '7.22.1';

/** Required upstream Step 21 rule version */
export const REQUIRED_STEP21_RULE_VERSION = '7.21.1';

/** Required upstream Step 20 rule version */
export const REQUIRED_STEP20_RULE_VERSION = '7.20.1';

/** Required upstream Step 19 rule version */
export const REQUIRED_STEP19_RULE_VERSION = '7.19.1';

/** Required upstream Step 13 rule version (Investment) */
export const REQUIRED_STEP13_RULE_VERSION = '7.13.1';

/** Required upstream Step 12 rule version (Owned Roster) */
export const REQUIRED_STEP12_RULE_VERSION = '7.12.1';

/** Default requested portfolio size (3 teams of 3 = 9 Resonators) */
export const DEFAULT_PORTFOLIO_TARGET_K = 3;

/** Minimum supported portfolio size */
export const MIN_PORTFOLIO_TARGET_K = 1;

/** Maximum supported portfolio size */
export const MAX_PORTFOLIO_TARGET_K = 20;

/** Required team cardinality: exactly 3 Resonators per team */
export const TEAM_MEMBER_COUNT = 3;

/** Starting Vigor capacity per Resonator */
export const RESONATOR_STARTING_VIGOR = 10;

/** Maximum Vigor capacity per Resonator */
export const MAX_RESONATOR_VIGOR = 10;

/** Total canonical stages in Season 40 Hazard Zone */
export const CANONICAL_STAGE_COUNT = 12;

/** Constant audit verification stamp */
export const OFFLINE_DETERMINISTIC_AUDIT_STAMP = 'OFFLINE_DETERMINISTIC_AUDIT';

/**
 * Machine-readable explanation codes for End-to-End Recommendation Orchestration.
 */
export const RECOMMENDATION_ORCHESTRATION_EXPLANATION_CODES = Object.freeze({
  STATUS_OPTIMAL_RECOMMENDATION: 'STATUS_OPTIMAL_RECOMMENDATION',
  STATUS_FEASIBLE_RECOMMENDATION: 'STATUS_FEASIBLE_RECOMMENDATION',
  STATUS_PARTIAL_RECOMMENDATION: 'STATUS_PARTIAL_RECOMMENDATION',
  STATUS_NO_FEASIBLE_ALLOCATION: 'STATUS_NO_FEASIBLE_ALLOCATION',
  STATUS_NO_FEASIBLE_PORTFOLIO: 'STATUS_NO_FEASIBLE_PORTFOLIO',
  STATUS_INSUFFICIENT_ROSTER: 'STATUS_INSUFFICIENT_ROSTER',
  STATUS_UPSTREAM_EVALUATION_FAILED: 'STATUS_UPSTREAM_EVALUATION_FAILED',
  STATUS_INVALID_INPUT: 'STATUS_INVALID_INPUT',
  PORTFOLIO_CONSTRUCTIBILITY_VERIFIED: 'PORTFOLIO_CONSTRUCTIBILITY_VERIFIED',
  ALL_RESONATOR_VIGOR_PRESERVED: 'ALL_RESONATOR_VIGOR_PRESERVED',
  STAGE_ALLOCATION_OPTIMAL: 'STAGE_ALLOCATION_OPTIMAL',
  STAGE_ALLOCATION_FEASIBLE: 'STAGE_ALLOCATION_FEASIBLE',
  STAGE_ALLOCATION_PARTIAL: 'STAGE_ALLOCATION_PARTIAL',
  STAGE_ALLOCATION_INFEASIBLE: 'STAGE_ALLOCATION_INFEASIBLE'
});

/**
 * Default fallback provenance object for Recommendation Orchestration.
 */
export const EMPTY_RECOMMENDATION_ORCHESTRATION_PROVENANCE: SourceReference = Object.freeze({
  entityId: 'SYSTEM',
  entityName: 'Deterministic End-to-End Recommendation Orchestration Contract',
  sourceType: 'RESONATOR_ABILITY',
  sourceCode: 'END_TO_END_RECOMMENDATION_STATE',
  patchVersion: '3.7',
  sourceProvenance: 'Wuthering Waves Deterministic Recommendation Engine (Patch 3.7)',
  originalDescription: 'Deterministic end-to-end recommendation orchestration pipeline'
});

/**
 * Prohibited keys that must NEVER appear on an end-to-end recommendation result,
 * its summary, or its stage assignments.
 * Enforces strict boundary separation against subjective combat scoring,
 * DPS calculations, tier rankings, and meta estimates.
 */
export const PROHIBITED_RECOMMENDATION_ORCHESTRATION_KEYS = [
  'characterPower',
  'combatPower',
  'teamPower',
  'portfolioPower',
  'recommendationPower',
  'stagePower',
  'allocationPower',
  'portfolioScore',
  'teamScore',
  'stageScore',
  'recommendationScore',
  'clearTimeScore',
  'dps',
  'damage',
  'rotationDps',
  'teamDps',
  'portfolioDps',
  'stageDps',
  'recommendationDps',
  'tier',
  'metaRank',
  'tierRating',
  'recommendedTeam',
  'optimalTeam',
  'bestTeam',
  'tierList',
  'metaTier',
  'viabilityScore',
  'characterRank',
  'powerRanking'
] as const;

export const PROHIBITED_RECOMMENDATION_KEYS = PROHIBITED_RECOMMENDATION_ORCHESTRATION_KEYS;

export type ProhibitedRecommendationOrchestrationKey =
  (typeof PROHIBITED_RECOMMENDATION_ORCHESTRATION_KEYS)[number];
export type ProhibitedRecommendationKey = ProhibitedRecommendationOrchestrationKey;
