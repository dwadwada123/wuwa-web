/**
 * Wuthering Waves Deterministic Owned Roster Eligibility Rules
 * Phase 7 Step 12: Deterministic Owned Roster Eligibility Contract
 *
 * Centralizes rule versioning, machine-readable explanation codes,
 * and provenance defaults for owned roster eligibility evaluations.
 *
 * CRITICAL ARCHITECTURAL CONSTRAINTS:
 * 1. Rule Version: Strictly '7.12.1'.
 * 2. Feasibility only: Step 12 evaluates whether candidate members are owned.
 * 3. Step 11 rank and Step 10 score remain immutable.
 * 4. Zero new scoring, zero reranking, zero role/meta inferences.
 */

import type { SourceReference } from '../capabilities/types.ts';

/**
 * Authoritative Step 12 rule version.
 */
export const OWNED_ROSTER_ELIGIBILITY_RULE_VERSION = '7.12.1';

/**
 * Machine-readable explanation codes for owned roster eligibility.
 * Describes objective feasibility mechanics only; ZERO subjective or gameplay claims.
 */
export const ROSTER_EXPLANATION_CODES = Object.freeze({
  ROSTER_ELIGIBLE_ALL_MEMBERS_OWNED: 'ROSTER_ELIGIBLE_ALL_MEMBERS_OWNED',
  ROSTER_PARTIALLY_OWNED: 'ROSTER_PARTIALLY_OWNED',
  ROSTER_NONE_OWNED: 'ROSTER_NONE_OWNED',
  ROSTER_INVALID: 'ROSTER_INVALID',
  ROSTER_PATCH_MISMATCH: 'ROSTER_PATCH_MISMATCH',

  ROSTER_MEMBER_OWNED: 'ROSTER_MEMBER_OWNED',
  ROSTER_MEMBER_MISSING: 'ROSTER_MEMBER_MISSING',

  STEP11_RANK_PRESERVED: 'STEP11_RANK_PRESERVED',
  STEP11_SCORE_PRESERVED: 'STEP11_SCORE_PRESERVED',
  STEP11_UNRANKABLE_PRESERVED: 'STEP11_UNRANKABLE_PRESERVED'
});

/**
 * Fallback empty provenance object for eligibility records without positive upstream evidence.
 */
export const EMPTY_ROSTER_ELIGIBILITY_PROVENANCE: SourceReference = Object.freeze({
  entityId: 'SYSTEM',
  entityName: 'Deterministic Engine Empty Roster Eligibility Evaluation',
  sourceType: 'RESONATOR_ABILITY',
  sourceCode: 'NO_EVIDENCE',
  patchVersion: '3.7',
  sourceProvenance: 'Wuthering Waves Deterministic Compatibility Engine (Patch 3.7)',
  originalDescription: ''
});
