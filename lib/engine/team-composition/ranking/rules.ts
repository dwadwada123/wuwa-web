/**
 * Wuthering Waves Deterministic Team Composition Evidence Ranking Rules
 * Phase 7 Step 11: Deterministic Team Composition Evidence Ranking & Ordering Contract
 *
 * Centralizes rule versioning, theoretical candidate population cardinality,
 * tie-break rule definitions, and machine-readable explanation codes.
 *
 * CRITICAL ARCHITECTURAL CONSTRAINTS:
 * 1. Rule Version: Strictly '7.11.1'.
 * 2. Total Candidate Universe: Strictly 34,220 theoretical teams for Patch 3.7 (C(60, 3)).
 * 3. Step 10 score is immutable: Ranking never alters, scales, or recalculates totalScore.
 * 4. Tie-breakers are ORDERING KEYS ONLY: They never contribute points.
 * 5. Rank values: Exactly 1..N for RANKED candidates; null for UNRANKABLE candidates.
 */

import type { SourceReference } from '../../capabilities/types.ts';

/**
 * Authoritative Step 11 rule version.
 */
export const TEAM_COMPOSITION_RANKING_RULE_VERSION = '7.11.1';

/**
 * Authoritative theoretical candidate universe size for 60 Resonators in Patch 3.7:
 * C(60, 3) = (60 * 59 * 58) / 6 = 34,220.
 */
export const TOTAL_THEORETICAL_TEAMS = 34220;

/**
 * Machine-readable explanation codes for ordering and tie-breaking.
 * Explains mechanics of sorting only; ZERO gameplay/meta quality claims.
 */
export const RANKING_EXPLANATION_CODES = Object.freeze({
  RANKED_BY_STEP10_EVIDENCE_SCORE: 'RANKED_BY_STEP10_EVIDENCE_SCORE',

  TIE_BREAK_PRIMARY_SCORE: 'TIE_BREAK_PRIMARY_SCORE',
  TIE_BREAK_MATCHED_PAIR_COUNT: 'TIE_BREAK_MATCHED_PAIR_COUNT',
  TIE_BREAK_INDEPENDENT_LINEAGE_COUNT: 'TIE_BREAK_INDEPENDENT_LINEAGE_COUNT',
  TIE_BREAK_DIRECTIONAL_EDGE_COUNT: 'TIE_BREAK_DIRECTIONAL_EDGE_COUNT',
  TIE_BREAK_CATEGORY_DIVERSITY: 'TIE_BREAK_CATEGORY_DIVERSITY',
  TIE_BREAK_CANONICAL_TEAM_ID: 'TIE_BREAK_CANONICAL_TEAM_ID',
  TIE_BREAK_CANDIDATE_ID: 'TIE_BREAK_CANDIDATE_ID',

  UNRANKABLE_NO_SCORE: 'UNRANKABLE_NO_SCORE',
  UNRANKABLE_MISSING_CONTEXT: 'UNRANKABLE_MISSING_CONTEXT',
  UNRANKABLE_CONTEXT_MISMATCH: 'UNRANKABLE_CONTEXT_MISMATCH',
  UNRANKABLE_UNMODELED: 'UNRANKABLE_UNMODELED',
  UNRANKABLE_UNKNOWN: 'UNRANKABLE_UNKNOWN',
  UNRANKABLE_NOT_APPLICABLE: 'UNRANKABLE_NOT_APPLICABLE',
  UNRANKABLE_NO_EVIDENCE: 'UNRANKABLE_NO_EVIDENCE'
});

/**
 * Fallback empty provenance object for ranking records without positive evidence.
 */
export const EMPTY_RANKING_PROVENANCE: SourceReference = Object.freeze({
  entityId: 'SYSTEM',
  entityName: 'Deterministic Engine Empty Team Composition Ranking',
  sourceType: 'RESONATOR_ABILITY',
  sourceCode: 'NO_EVIDENCE',
  patchVersion: '3.7',
  sourceProvenance: 'Wuthering Waves Deterministic Compatibility Engine (Patch 3.7)',
  originalDescription: ''
});
