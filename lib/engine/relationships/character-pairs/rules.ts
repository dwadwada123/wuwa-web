/**
 * Wuthering Waves Character-Level Evidence Aggregation Rules
 * Phase 7 Step 7: Deterministic Character-Level Evidence Aggregation Contract
 *
 * Centralizes rule versioning, score boundaries, and independent evidence aggregation
 * parameters for directional character pair profiles.
 *
 * SCORING INVARIANTS:
 * 1. Bounded scale: [0.00, 100.00].
 * 2. Independent evidence bonus: rewards independent proven evidence records, capped at 15.0.
 * 3. Never multiplies score for duplicate lineage of the same underlying gameplay fact.
 * 4. Missing context, unmodeled, unknown, not applicable, or empty status strictly yield null score.
 */

/**
 * Authoritative character-pair aggregation rule version.
 * Separate from patchVersion ('3.7') and candidate evaluation ruleVersion ('7.6.1').
 */
export const CHARACTER_PAIR_AGGREGATION_RULE_VERSION = '7.7.1';

/**
 * Scale limits for aggregated pair evidence score.
 */
export const PAIR_SCORE_SCALE_MIN = 0.0;
export const PAIR_SCORE_SCALE_MAX = 100.0;

/**
 * Incremental score bonus awarded per additional distinct independent evaluated evidence lineage.
 * For N independent evidence records, bonus = min(15.0, (N - 1) * 5.0).
 */
export const INDEPENDENT_EVIDENCE_BONUS_PER_ITEM = 5.0;

/**
 * Maximum cumulative independent evidence bonus.
 */
export const INDEPENDENT_EVIDENCE_BONUS_MAX = 15.0;

import type { SourceReference } from '../../capabilities/types.ts';

/**
 * Fallback empty provenance object for empty pair profiles.
 */
export const EMPTY_PAIR_PROVENANCE: SourceReference = Object.freeze({
  entityId: 'SYSTEM',
  entityName: 'Deterministic Engine Empty Pair Profile',
  sourceType: 'RESONATOR_ABILITY',
  sourceCode: 'EMPTY_PAIR',
  patchVersion: '3.7',
  sourceProvenance: 'Wuthering Waves Deterministic Compatibility Engine (Patch 3.7)',
  originalDescription: ''
});
