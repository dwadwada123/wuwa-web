/**
 * Wuthering Waves Deterministic Team Composition Evidence Ranking Predicates
 * Phase 7 Step 11: Deterministic Team Composition Evidence Ranking & Ordering Contract
 *
 * Implements deterministic ID derivation, 7-level deterministic tie-breaker sorting,
 * serialization comparators, type guards, and query filter matchers.
 */

import { TEAM_COMPOSITION_RANKING_RULE_VERSION } from './rules.ts';
import type {
  TeamCompositionCandidate
} from '../types.ts';
import type {
  TeamCompositionCandidateEvaluation
} from '../evaluation/types.ts';
import type {
  TeamCompositionEvidenceRanking,
  TeamCompositionRankingFilter
} from './types.ts';

/**
 * Derives the authoritative deterministic ID for a team composition evidence ranking.
 * Format: team-composition-ranking:<patchVersion>:<candidateId>:<ruleVersion>
 *
 * Fully deterministic; does not use UUIDs, timestamps, or process IDs.
 */
export function deriveTeamCompositionRankingId(
  patchVersion: string,
  candidateId: string,
  ruleVersion: string = TEAM_COMPOSITION_RANKING_RULE_VERSION
): string {
  if (!patchVersion || typeof patchVersion !== 'string') {
    throw new Error('deriveTeamCompositionRankingId: patchVersion must be a non-empty string.');
  }
  if (!candidateId || typeof candidateId !== 'string') {
    throw new Error('deriveTeamCompositionRankingId: candidateId must be a non-empty string.');
  }
  return `team-composition-ranking:${patchVersion}:${candidateId}:${ruleVersion}`;
}

/**
 * Authoritative 7-level deterministic comparator for rankable candidates.
 *
 * Ordering priority:
 * 1. Step 10 totalScore DESC (highest evidence strength first)
 * 2. matchedPairCount DESC (more connected pair slots)
 * 3. independentEvidenceLineageCount DESC (more deduplicated lineages)
 * 4. directionalEdgeCount DESC (more explicit directional relationships)
 * 5. distinct supportingSynergyCategories count DESC (broader synergy coverage)
 * 6. canonical memberResonatorIds ASC (lexicographical member ordering)
 * 7. candidateId ASC (unique deterministic tie-break guaranteeing total ordering)
 *
 * Tie-breakers are ORDERING KEYS ONLY; they NEVER mutate or inflate totalScore.
 */
export function compareRankableEvaluations(
  aEval: TeamCompositionCandidateEvaluation,
  aCand: TeamCompositionCandidate,
  bEval: TeamCompositionCandidateEvaluation,
  bCand: TeamCompositionCandidate
): number {
  // 1. Primary Key: Step 10 totalScore DESC
  if (aEval.totalScore !== bEval.totalScore) {
    if (aEval.totalScore === null || bEval.totalScore === null) {
      throw new Error('compareRankableEvaluations: encountered null score in rankable comparator.');
    }
    return bEval.totalScore - aEval.totalScore;
  }

  // 2. Tie-break 1: matchedPairCount DESC
  if (aEval.matchedPairCount !== bEval.matchedPairCount) {
    return bEval.matchedPairCount - aEval.matchedPairCount;
  }

  // 3. Tie-break 2: independentEvidenceLineageCount DESC
  if (aEval.independentEvidenceLineageCount !== bEval.independentEvidenceLineageCount) {
    return bEval.independentEvidenceLineageCount - aEval.independentEvidenceLineageCount;
  }

  // 4. Tie-break 3: directionalEdgeCount DESC
  if (aEval.directionalEdgeCount !== bEval.directionalEdgeCount) {
    return bEval.directionalEdgeCount - aEval.directionalEdgeCount;
  }

  // 5. Tie-break 4: distinct supportingSynergyCategories count DESC
  const aCatCount = aCand.supportingSynergyCategories.length;
  const bCatCount = bCand.supportingSynergyCategories.length;
  if (aCatCount !== bCatCount) {
    return bCatCount - aCatCount;
  }

  // 6. Tie-break 5: canonical memberResonatorIds ASC
  for (let i = 0; i < 3; i++) {
    const cmp = aCand.memberResonatorIds[i].localeCompare(bCand.memberResonatorIds[i]);
    if (cmp !== 0) return cmp;
  }

  // 7. Tie-break 6: candidateId ASC (total ordering guarantee)
  return aCand.id.localeCompare(bCand.id);
}

/**
 * Deterministic comparator for unrankable candidates to ensure stable serialization ordering.
 * Order: canonical memberResonatorIds ASC, then candidateId ASC.
 * NOTE: This is serialization order only; NOT a ranking or gameplay score.
 */
export function compareUnrankableCandidates(
  aCand: TeamCompositionCandidate,
  bCand: TeamCompositionCandidate
): number {
  for (let i = 0; i < 3; i++) {
    const cmp = aCand.memberResonatorIds[i].localeCompare(bCand.memberResonatorIds[i]);
    if (cmp !== 0) return cmp;
  }
  return aCand.id.localeCompare(bCand.id);
}

/**
 * Canonical sorting comparator for materialized TeamCompositionEvidenceRanking objects.
 * Order:
 * 1. RANKED comes before UNRANKABLE
 * 2. For RANKED: rank ASC (1 is top rank)
 * 3. For UNRANKABLE: canonical memberResonatorIds ASC, then candidateId ASC
 */
export function compareTeamCompositionEvidenceRanking(
  a: TeamCompositionEvidenceRanking,
  b: TeamCompositionEvidenceRanking
): number {
  if (a.rankingStatus === 'RANKED' && b.rankingStatus === 'UNRANKABLE') return -1;
  if (a.rankingStatus === 'UNRANKABLE' && b.rankingStatus === 'RANKED') return 1;

  if (a.rankingStatus === 'RANKED' && b.rankingStatus === 'RANKED') {
    if (a.rank !== b.rank) {
      if (a.rank === null || b.rank === null) {
        throw new Error('compareTeamCompositionEvidenceRanking: null rank encountered in RANKED status.');
      }
      return a.rank - b.rank;
    }
  }

  for (let i = 0; i < 3; i++) {
    const cmp = a.memberResonatorIds[i].localeCompare(b.memberResonatorIds[i]);
    if (cmp !== 0) return cmp;
  }
  return a.candidateId.localeCompare(b.candidateId);
}

/**
 * Type guard verifying if a ranking record is actively RANKED.
 */
export function isRanked(
  ranking: TeamCompositionEvidenceRanking
): ranking is TeamCompositionEvidenceRanking & { rank: number; totalScore: number } {
  return (
    ranking.rankingStatus === 'RANKED' &&
    ranking.rank !== null &&
    Number.isInteger(ranking.rank) &&
    ranking.rank >= 1 &&
    ranking.totalScore !== null &&
    Number.isFinite(ranking.totalScore)
  );
}

/**
 * Type guard verifying if a ranking record is UNRANKABLE.
 */
export function isUnrankable(
  ranking: TeamCompositionEvidenceRanking
): ranking is TeamCompositionEvidenceRanking & { rank: null; totalScore: null } {
  return (
    ranking.rankingStatus === 'UNRANKABLE' &&
    ranking.rank === null &&
    ranking.totalScore === null
  );
}

/**
 * Matches a ranking record against a multi-criteria query filter.
 */
export function matchesTeamCompositionRankingFilter(
  ranking: TeamCompositionEvidenceRanking,
  filter: TeamCompositionRankingFilter
): boolean {
  if (filter.patchVersion && ranking.patchVersion !== filter.patchVersion) {
    return false;
  }
  if (filter.rankingStatus && ranking.rankingStatus !== filter.rankingStatus) {
    return false;
  }
  if (filter.evaluationStatus && ranking.evaluationStatus !== filter.evaluationStatus) {
    return false;
  }
  if (filter.minimumScore !== undefined) {
    if (ranking.totalScore === null || ranking.totalScore < filter.minimumScore) {
      return false;
    }
  }
  if (filter.maximumScore !== undefined) {
    if (ranking.totalScore === null || ranking.totalScore > filter.maximumScore) {
      return false;
    }
  }
  if (filter.minimumRank !== undefined) {
    if (ranking.rank === null || ranking.rank < filter.minimumRank) {
      return false;
    }
  }
  if (filter.maximumRank !== undefined) {
    if (ranking.rank === null || ranking.rank > filter.maximumRank) {
      return false;
    }
  }
  if (filter.resonatorId) {
    if (!ranking.memberResonatorIds.includes(filter.resonatorId)) {
      return false;
    }
  }
  return true;
}
