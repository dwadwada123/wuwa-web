/**
 * Wuthering Waves Deterministic Team Build Readiness Rules
 * Phase 7 Step 14: Deterministic Team Build Readiness & Investment Applicability Contract
 *
 * Centralizes rule versioning, machine-readable explanation codes, and provenance defaults.
 *
 * CRITICAL ARCHITECTURAL CONSTRAINTS:
 * 1. Rule Version: Strictly '7.14.1'.
 * 2. Feasibility/Readiness only: Readiness is data availability and ownership feasibility, NOT a gameplay score.
 * 3. Step 10 score and Step 11 rank remain strictly immutable.
 * 4. Zero new scoring, zero reranking, zero role/meta inferences.
 */

import type { SourceReference } from '../../capabilities/types.ts';

/**
 * Authoritative Step 14 rule version.
 */
export const TEAM_BUILD_READINESS_RULE_VERSION = '7.14.1';

/**
 * Machine-readable explanation codes for team build readiness.
 * Purely describes objective readiness and data completeness; ZERO subjective or gameplay claims.
 */
export const READINESS_EXPLANATION_CODES = Object.freeze({
  TEAM_READINESS_READY: 'TEAM_READINESS_READY',
  TEAM_READINESS_READY_PARTIAL_INVESTMENT: 'TEAM_READINESS_READY_PARTIAL_INVESTMENT',
  TEAM_READINESS_READY_UNKNOWN_INVESTMENT: 'TEAM_READINESS_READY_UNKNOWN_INVESTMENT',
  TEAM_READINESS_PARTIALLY_OWNED: 'TEAM_READINESS_PARTIALLY_OWNED',
  TEAM_READINESS_NOT_OWNED: 'TEAM_READINESS_NOT_OWNED',
  TEAM_READINESS_INVALID_ROSTER: 'TEAM_READINESS_INVALID_ROSTER',
  TEAM_READINESS_PATCH_MISMATCH: 'TEAM_READINESS_PATCH_MISMATCH',

  INVESTMENT_DIMENSIONS_ALL_KNOWN: 'INVESTMENT_DIMENSIONS_ALL_KNOWN',
  INVESTMENT_DIMENSIONS_PARTIALLY_KNOWN: 'INVESTMENT_DIMENSIONS_PARTIALLY_KNOWN',
  INVESTMENT_DIMENSIONS_NONE_KNOWN: 'INVESTMENT_DIMENSIONS_NONE_KNOWN',
  INVESTMENT_UNAVAILABLE: 'INVESTMENT_UNAVAILABLE',

  STEP10_SCORE_PRESERVED: 'STEP10_SCORE_PRESERVED',
  STEP11_RANK_PRESERVED: 'STEP11_RANK_PRESERVED',
  STEP11_UNRANKABLE_PRESERVED: 'STEP11_UNRANKABLE_PRESERVED',
  STEP12_OWNERSHIP_PRESERVED: 'STEP12_OWNERSHIP_PRESERVED'
});

/**
 * Fallback empty provenance object for team build readiness records.
 */
export const EMPTY_TEAM_BUILD_READINESS_PROVENANCE: SourceReference = Object.freeze({
  entityId: 'SYSTEM',
  entityName: 'Deterministic Engine Team Build Readiness Contract',
  sourceType: 'RESONATOR_ABILITY',
  sourceCode: 'BUILD_READINESS',
  patchVersion: '3.7',
  sourceProvenance: 'Wuthering Waves Deterministic Readiness Engine (Patch 3.7)',
  originalDescription: 'Team build readiness and investment applicability'
});
