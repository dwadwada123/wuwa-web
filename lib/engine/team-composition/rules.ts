/**
 * Wuthering Waves Team Composition Candidate Rules & Constants
 * Phase 7 Step 9: Deterministic Team Composition Candidate Contract
 *
 * Centralizes rule versioning, cardinality constraints, and qualification thresholds
 * for deterministic team composition candidates.
 *
 * CRITICAL ARCHITECTURAL CONSTRAINTS:
 * 1. Cardinality = exactly 3 distinct Resonators.
 * 2. Minimum structural qualification = at least 2 distinct unordered pairs with synergy.
 * 3. ZERO numeric scores, ZERO roles, ZERO character power, ZERO meta rankings.
 * 4. Contextual evidence remains contextual; unmodeled remains unmodeled; unknown fails closed.
 */

import type { SourceReference } from '../capabilities/types.ts';

/**
 * Authoritative team composition candidate rule version.
 * Separate from patchVersion ('3.7') and Step 8 ruleVersion ('7.8.1').
 */
export const TEAM_COMPOSITION_RULE_VERSION = '7.9.1';

/**
 * Strictly required team cardinality.
 */
export const TEAM_MEMBER_COUNT = 3;

/**
 * Minimum number of distinct unordered pairwise synergy connections required
 * for a 3-character candidate to qualify structurally (Rule A).
 */
export const MIN_MATCHED_PAIRS_FOR_QUALIFICATION = 2;

/**
 * Fallback empty provenance object for candidates with no pairwise evidence.
 */
export const EMPTY_TEAM_PROVENANCE: SourceReference = Object.freeze({
  entityId: 'SYSTEM',
  entityName: 'Deterministic Engine Empty Team Composition Candidate',
  sourceType: 'RESONATOR_ABILITY',
  sourceCode: 'NO_PAIRWISE_EVIDENCE',
  patchVersion: '3.7',
  sourceProvenance: 'Wuthering Waves Deterministic Compatibility Engine (Patch 3.7)',
  originalDescription: ''
});
