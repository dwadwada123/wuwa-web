/**
 * Wuthering Waves Deterministic Team Composition Candidate Evaluation Predicates
 * Phase 7 Step 10: Deterministic Team Composition Candidate Evaluation & Scoring Contract
 *
 * Provides deterministic ID derivation, sorting comparators, type guards,
 * numeric helpers, and query filter matchers for TeamCompositionCandidateEvaluation.
 */

import { TEAM_COMPOSITION_EVALUATION_RULE_VERSION } from './rules.ts';
import type {
  TeamCompositionCandidateEvaluation,
  TeamCompositionEvaluationFilter,
  TeamCompositionEvaluationStatus
} from './types.ts';

/**
 * Derives the authoritative deterministic ID for a team composition evaluation.
 * Format: team-composition-evaluation:<patchVersion>:<candidateId>:<ruleVersion>
 *
 * Fully deterministic; does not use UUIDs, timestamps, or process IDs.
 */
export function deriveTeamCompositionEvaluationId(
  patchVersion: string,
  candidateId: string,
  ruleVersion: string = TEAM_COMPOSITION_EVALUATION_RULE_VERSION
): string {
  if (!patchVersion || typeof patchVersion !== 'string') {
    throw new Error('deriveTeamCompositionEvaluationId: patchVersion must be a non-empty string.');
  }
  if (!candidateId || typeof candidateId !== 'string') {
    throw new Error('deriveTeamCompositionEvaluationId: candidateId must be a non-empty string.');
  }
  return `team-composition-evaluation:${patchVersion}:${candidateId}:${ruleVersion}`;
}

/**
 * Deterministically rounds a number to 2 decimal places.
 * Does not use parseFloat, parseInt, or unsafe Number coercion.
 */
export function roundToTwoDecimals(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`roundToTwoDecimals: non-finite number encountered: ${value}`);
  }
  return Math.round(value * 100) / 100;
}

/**
 * Clamps a score strictly within [0.00, 100.00].
 */
export function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`clampScore: non-finite number encountered: ${value}`);
  }
  return Math.min(100.0, Math.max(0.0, value));
}

/**
 * Canonical sorting comparator for TeamCompositionCandidateEvaluation objects.
 * Ordering:
 * 1. totalScore descending (non-null first, higher score first)
 * 2. candidateId ascending (lexicographical)
 * 3. evaluation ID ascending (lexicographical)
 */
export function compareTeamCompositionCandidateEvaluation(
  a: TeamCompositionCandidateEvaluation,
  b: TeamCompositionCandidateEvaluation
): number {
  // 1. Score comparison (non-null first, then descending)
  if (a.totalScore !== null && b.totalScore === null) return -1;
  if (a.totalScore === null && b.totalScore !== null) return 1;
  if (a.totalScore !== null && b.totalScore !== null && a.totalScore !== b.totalScore) {
    return b.totalScore - a.totalScore;
  }

  // 2. Candidate ID comparison
  const candCmp = a.candidateId.localeCompare(b.candidateId);
  if (candCmp !== 0) return candCmp;

  // 3. Evaluation ID comparison
  return a.id.localeCompare(b.id);
}

/**
 * Type guard verifying if an unknown object conforms to TeamCompositionCandidateEvaluation.
 */
export function isTeamCompositionCandidateEvaluation(
  value: unknown
): value is TeamCompositionCandidateEvaluation {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.candidateId === 'string' &&
    v.patchVersion === '3.7' &&
    v.ruleVersion === '7.10.1' &&
    typeof v.evaluationStatus === 'string' &&
    (v.totalScore === null || typeof v.totalScore === 'number') &&
    Array.isArray(v.components) &&
    typeof v.candidateQualificationStatus === 'string' &&
    Array.isArray(v.pairSynergyProfileIds) &&
    Array.isArray(v.pairEvidenceProfileIds) &&
    Array.isArray(v.evidenceIds) &&
    Array.isArray(v.relationshipIds) &&
    Array.isArray(v.sourceFactIds) &&
    typeof v.matchedPairCount === 'number' &&
    typeof v.directionalEdgeCount === 'number' &&
    typeof v.independentEvidenceLineageCount === 'number' &&
    Array.isArray(v.contextRequirements) &&
    typeof v.applicabilitySummary === 'object' &&
    Array.isArray(v.explanationCodes) &&
    typeof v.provenance === 'object'
  );
}

/**
 * Type guard: check if an evaluation has a non-null evaluated score.
 */
export function hasEvaluatedScore(
  evaluation: TeamCompositionCandidateEvaluation
): evaluation is TeamCompositionCandidateEvaluation & { totalScore: number } {
  return evaluation.totalScore !== null && Number.isFinite(evaluation.totalScore);
}

/**
 * Checks if an evaluation is blocked / has no evaluable positive score.
 */
export function isBlockedEvaluation(
  evaluation: TeamCompositionCandidateEvaluation
): boolean {
  return evaluation.totalScore === null;
}

/**
 * Type guard: check if status is EVALUATED.
 */
export function isFullyEvaluated(
  evaluation: TeamCompositionCandidateEvaluation
): boolean {
  return evaluation.evaluationStatus === 'EVALUATED';
}

/**
 * Type guard: check if status is PARTIALLY_EVALUATED.
 */
export function isPartiallyEvaluated(
  evaluation: TeamCompositionCandidateEvaluation
): boolean {
  return evaluation.evaluationStatus === 'PARTIALLY_EVALUATED';
}

/**
 * Matches an evaluation against a query filter.
 */
export function matchesTeamCompositionEvaluationFilter(
  evaluation: TeamCompositionCandidateEvaluation,
  filter: TeamCompositionEvaluationFilter,
  candidateMemberIds?: readonly string[]
): boolean {
  if (filter.patchVersion && evaluation.patchVersion !== filter.patchVersion) {
    return false;
  }
  if (filter.candidateId && evaluation.candidateId !== filter.candidateId) {
    return false;
  }
  if (filter.evaluationStatus && evaluation.evaluationStatus !== filter.evaluationStatus) {
    return false;
  }
  if (filter.hasScore !== undefined) {
    const has = evaluation.totalScore !== null;
    if (has !== filter.hasScore) return false;
  }
  if (filter.minScore !== undefined) {
    if (evaluation.totalScore === null || evaluation.totalScore < filter.minScore) {
      return false;
    }
  }
  if (filter.maxScore !== undefined) {
    if (evaluation.totalScore === null || evaluation.totalScore > filter.maxScore) {
      return false;
    }
  }
  if (filter.minMatchedPairs !== undefined && evaluation.matchedPairCount < filter.minMatchedPairs) {
    return false;
  }
  if (filter.minDirectionalEdges !== undefined && evaluation.directionalEdgeCount < filter.minDirectionalEdges) {
    return false;
  }
  if (filter.resonatorId && candidateMemberIds) {
    if (!candidateMemberIds.includes(filter.resonatorId)) {
      return false;
    }
  }
  return true;
}
