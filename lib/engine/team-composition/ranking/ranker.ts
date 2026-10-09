/**
 * Wuthering Waves Deterministic Team Composition Evidence Ranker
 * Phase 7 Step 11: Deterministic Team Composition Evidence Ranking & Ordering Contract
 *
 * Implements deterministic ranking and ordering over Step 10
 * TeamCompositionCandidateEvaluation objects.
 *
 * CRITICAL ARCHITECTURAL BOUNDARIES:
 * 1. ORDERING ONLY: Never mutates, recalculates, or inflates Step 10 totalScore.
 * 2. RANKED vs UNRANKABLE: Strictly non-null finite scores receive ranks 1..N.
 *    Blocked/no-evidence candidates strictly receive rank = null.
 * 3. 7-LEVEL DETERMINISTIC TIE-BREAKING: Ensures byte-for-byte reproducible total ordering.
 * 4. FULL CANDIDATE SPACE: All 34,220 theoretical teams remain representable.
 */

import type {
  TeamCompositionCandidate
} from '../types.ts';
import type {
  TeamCompositionCandidateEvaluation
} from '../evaluation/types.ts';
import {
  TEAM_COMPOSITION_RANKING_RULE_VERSION,
  RANKING_EXPLANATION_CODES,
  EMPTY_RANKING_PROVENANCE
} from './rules.ts';
import {
  deriveTeamCompositionRankingId,
  compareRankableEvaluations,
  compareUnrankableCandidates
} from './predicates.ts';
import type {
  TeamCompositionEvidenceRanking,
  TeamCompositionRankingOptions
} from './types.ts';

interface RankablePair {
  readonly evaluation: TeamCompositionCandidateEvaluation;
  readonly candidate: TeamCompositionCandidate;
}

interface UnrankablePair {
  readonly evaluation: TeamCompositionCandidateEvaluation;
  readonly candidate: TeamCompositionCandidate;
}

/**
 * Derives machine-readable explanation codes for an unrankable candidate.
 */
function deriveUnrankableExplanationCodes(
  evaluation: TeamCompositionCandidateEvaluation
): readonly string[] {
  const codes: string[] = [
    RANKING_EXPLANATION_CODES.UNRANKABLE_NO_SCORE,
    `STATUS_${evaluation.evaluationStatus}`
  ];

  switch (evaluation.evaluationStatus) {
    case 'MISSING_CONTEXT':
      codes.push(RANKING_EXPLANATION_CODES.UNRANKABLE_MISSING_CONTEXT);
      break;
    case 'CONTEXT_MISMATCH':
      codes.push(RANKING_EXPLANATION_CODES.UNRANKABLE_CONTEXT_MISMATCH);
      break;
    case 'UNMODELED':
      codes.push(RANKING_EXPLANATION_CODES.UNRANKABLE_UNMODELED);
      break;
    case 'UNKNOWN':
      codes.push(RANKING_EXPLANATION_CODES.UNRANKABLE_UNKNOWN);
      break;
    case 'NOT_APPLICABLE':
      codes.push(RANKING_EXPLANATION_CODES.UNRANKABLE_NOT_APPLICABLE);
      break;
    case 'NO_EVIDENCE':
      codes.push(RANKING_EXPLANATION_CODES.UNRANKABLE_NO_EVIDENCE);
      break;
  }

  codes.push(`QUALIFICATION_${evaluation.candidateQualificationStatus}`);
  return Object.freeze(codes);
}

/**
 * Deterministically ranks a collection of TeamCompositionCandidateEvaluation objects.
 */
export function rankTeamCompositionCandidates(
  evaluations: readonly TeamCompositionCandidateEvaluation[],
  candidateResolver: (candidateId: string) => TeamCompositionCandidate | undefined,
  options?: TeamCompositionRankingOptions
): readonly TeamCompositionEvidenceRanking[] {
  const patchVersion = '3.7';
  const ruleVersion = options?.ruleVersion ?? TEAM_COMPOSITION_RANKING_RULE_VERSION;
  const totalCandidateCount = evaluations.length;

  const rankablePairs: RankablePair[] = [];
  const unrankablePairs: UnrankablePair[] = [];

  // 1. Validate candidates and partition into rankable vs unrankable
  for (const evaluation of evaluations) {
    const candidate = candidateResolver(evaluation.candidateId);
    if (!candidate) {
      throw new Error(
        `rankTeamCompositionCandidates: Evaluation '${evaluation.id}' references unknown candidate '${evaluation.candidateId}'.`
      );
    }

    if (evaluation.totalScore !== null && Number.isFinite(evaluation.totalScore)) {
      rankablePairs.push({ evaluation, candidate });
    } else {
      unrankablePairs.push({ evaluation, candidate });
    }
  }

  // 2. Sort rankable candidates using 7-level deterministic tie-breaker
  rankablePairs.sort((a, b) =>
    compareRankableEvaluations(a.evaluation, a.candidate, b.evaluation, b.candidate)
  );

  // 3. Sort unrankable candidates for stable serialization ordering
  unrankablePairs.sort((a, b) =>
    compareUnrankableCandidates(a.candidate, b.candidate)
  );

  const totalRankableCount = rankablePairs.length;
  const results: TeamCompositionEvidenceRanking[] = [];

  // 4. Assign ranks 1..N to rankable candidates
  for (let i = 0; i < rankablePairs.length; i++) {
    const { evaluation, candidate } = rankablePairs[i];
    const rank = i + 1;
    const rankingId = deriveTeamCompositionRankingId(patchVersion, candidate.id, ruleVersion);

    const explanationCodes: string[] = [
      RANKING_EXPLANATION_CODES.RANKED_BY_STEP10_EVIDENCE_SCORE,
      `RANK_${rank}`,
      `SCORE_${evaluation.totalScore}`,
      `STATUS_${evaluation.evaluationStatus}`,
      RANKING_EXPLANATION_CODES.TIE_BREAK_PRIMARY_SCORE
    ];

    const ranking: TeamCompositionEvidenceRanking = Object.freeze({
      id: rankingId,
      patchVersion,
      ruleVersion,
      candidateId: candidate.id,
      evaluationId: evaluation.id,
      memberResonatorIds: candidate.memberResonatorIds,
      rankingStatus: 'RANKED',
      rank,
      totalRankableCount,
      totalCandidateCount,
      totalScore: evaluation.totalScore,
      evaluationStatus: evaluation.evaluationStatus,
      candidateQualificationStatus: evaluation.candidateQualificationStatus,
      matchedPairCount: evaluation.matchedPairCount,
      directionalEdgeCount: evaluation.directionalEdgeCount,
      independentEvidenceLineageCount: evaluation.independentEvidenceLineageCount,
      qualificationTypes: candidate.qualificationTypes,
      supportingSynergyCategories: candidate.supportingSynergyCategories,
      evidenceIds: evaluation.evidenceIds,
      relationshipIds: evaluation.relationshipIds,
      sourceFactIds: evaluation.sourceFactIds,
      explanationCodes: Object.freeze(explanationCodes),
      provenance: evaluation.provenance
    });

    results.push(ranking);
  }

  // 5. Materialize unrankable candidates (rank: null) if requested
  if (options?.includeUnrankable !== false) {
    for (const { evaluation, candidate } of unrankablePairs) {
      const rankingId = deriveTeamCompositionRankingId(patchVersion, candidate.id, ruleVersion);
      const explanationCodes = deriveUnrankableExplanationCodes(evaluation);

      const ranking: TeamCompositionEvidenceRanking = Object.freeze({
        id: rankingId,
        patchVersion,
        ruleVersion,
        candidateId: candidate.id,
        evaluationId: evaluation.id,
        memberResonatorIds: candidate.memberResonatorIds,
        rankingStatus: 'UNRANKABLE',
        rank: null,
        totalRankableCount,
        totalCandidateCount,
        totalScore: null,
        evaluationStatus: evaluation.evaluationStatus,
        candidateQualificationStatus: evaluation.candidateQualificationStatus,
        matchedPairCount: evaluation.matchedPairCount,
        directionalEdgeCount: evaluation.directionalEdgeCount,
        independentEvidenceLineageCount: evaluation.independentEvidenceLineageCount,
        qualificationTypes: candidate.qualificationTypes,
        supportingSynergyCategories: candidate.supportingSynergyCategories,
        evidenceIds: evaluation.evidenceIds,
        relationshipIds: evaluation.relationshipIds,
        sourceFactIds: evaluation.sourceFactIds,
        explanationCodes,
        provenance: evaluation.evidenceIds.length > 0
          ? evaluation.provenance
          : EMPTY_RANKING_PROVENANCE
      });

      results.push(ranking);
    }
  }

  return Object.freeze(results);
}
