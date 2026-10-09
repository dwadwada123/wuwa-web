/**
 * Wuthering Waves Deterministic Team Composition Evidence Ranking Module
 * Phase 7 Step 11: Deterministic Team Composition Evidence Ranking & Ordering Contract
 *
 * Public entrypoint for Step 11 ranking contracts, tie-break rules,
 * ranking engine, repository, audit facilities, and presentation explanations.
 */

export * from './types.ts';
export * from './rules.ts';
export * from './predicates.ts';
export * from './ranker.ts';
export * from './repository.ts';
export * from './audit.ts';

import type {
  TeamCompositionEvidenceRanking,
  TeamCompositionRankingExplanation
} from './types.ts';

/**
 * Produces a structured, machine-readable explanation for a team composition candidate ranking.
 * Presentation only: this string output MUST NEVER become an engine input.
 */
export function explainTeamCompositionRanking(
  ranking: TeamCompositionEvidenceRanking
): TeamCompositionRankingExplanation {
  let summary: string;
  if (ranking.rankingStatus === 'RANKED') {
    summary = `Team candidate {${ranking.memberResonatorIds.join(', ')}} ranked #${ranking.rank} of ${ranking.totalRankableCount} evidence-supported candidates with evidence score ${ranking.totalScore?.toFixed(2)}/100.00.`;
  } else {
    summary = `Team candidate {${ranking.memberResonatorIds.join(', ')}} is unrankable with status ${ranking.evaluationStatus}. Total score: null.`;
  }

  return Object.freeze({
    rankingId: ranking.id,
    candidateId: ranking.candidateId,
    members: ranking.memberResonatorIds,
    rankingStatus: ranking.rankingStatus,
    rank: ranking.rank,
    totalRankableCount: ranking.totalRankableCount,
    totalScore: ranking.totalScore,
    summary,
    explanationCodes: ranking.explanationCodes
  });
}
