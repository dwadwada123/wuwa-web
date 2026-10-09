/**
 * Wuthering Waves Character Pair Synergy Evaluation Rules
 * Phase 7 Step 8: Deterministic Character Pair Synergy Evaluation Contract
 *
 * Centralizes rule versioning, score boundaries, and independent lineage bonus
 * weights for deterministic character pair synergy profiles.
 *
 * CRITICAL SCORING INVARIANTS:
 * 1. Bounded scale: [0.00, 100.00].
 * 2. Independent evidence bonus: rewards independent proven evidence lineages, capped at 20.0.
 * 3. Never produces negative scores or anti-synergy penalties.
 * 4. Context-dependent, unmodeled, unknown, not applicable, and no-evidence profiles strictly yield null score.
 */

import type { SourceReference } from '../../../capabilities/types.ts';

/**
 * Authoritative character-pair synergy evaluation rule version.
 * Separate from patchVersion ('3.7') and Step 7 ruleVersion ('7.7.1').
 */
export const CHARACTER_PAIR_SYNERGY_RULE_VERSION = '7.8.1';

/**
 * Scale limits for aggregated synergy evidence score.
 */
export const SYNERGY_SCORE_SCALE_MIN = 0.0;
export const SYNERGY_SCORE_SCALE_MAX = 100.0;

/**
 * Incremental score bonus awarded per additional distinct independent evaluated evidence lineage.
 * For N independent lineages, bonus = min(20.0, (N - 1) * 5.0).
 */
export const INDEPENDENT_SYNERGY_BONUS_PER_LINEAGE = 5.0;

/**
 * Maximum cumulative independent evidence bonus.
 */
export const INDEPENDENT_SYNERGY_BONUS_MAX = 20.0;

/**
 * Fallback empty provenance object for no-evidence synergy profiles.
 */
export const EMPTY_SYNERGY_PROVENANCE: SourceReference = Object.freeze({
  entityId: 'SYSTEM',
  entityName: 'Deterministic Engine Empty Synergy Profile',
  sourceType: 'RESONATOR_ABILITY',
  sourceCode: 'NO_EVIDENCE',
  patchVersion: '3.7',
  sourceProvenance: 'Wuthering Waves Deterministic Compatibility Engine (Patch 3.7)',
  originalDescription: ''
});
