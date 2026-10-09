/**
 * Wuthering Waves Deterministic Team Build Readiness Evaluator
 * Phase 7 Step 14: Deterministic Team Build Readiness & Investment Applicability Contract
 *
 * Implements deterministic synthesis of Step 11 Ranking, Step 12 Roster Eligibility,
 * and Step 13 Resonator Investment into authoritative TeamBuildReadiness records.
 *
 * CRITICAL ARCHITECTURAL CONSTRAINTS:
 * 1. Step 10 evidence score and Step 11 rank are preserved strictly immutable.
 * 2. Step 12 is the sole authority on candidate ownership status.
 * 3. Step 13 is the sole authority on member investment dimensions.
 * 4. Missing investment information is NEVER converted to 0, minimum, or default builds.
 * 5. Zero new scoring dimensions, zero reranking, zero role/meta inferences.
 */

import type { SourceReference } from '../../capabilities/types.ts';
import type { TeamCompositionEvidenceRanking } from '../ranking/types.ts';
import type { TeamCompositionRosterEligibility } from '../../roster/types.ts';
import type {
  ResonatorInvestmentSnapshot,
  InvestmentDimensionKey,
  InvestmentCompletenessSummary
} from '../../investment/types.ts';
import { ALL_INVESTMENT_DIMENSIONS } from '../../investment/rules.ts';
import { computeInvestmentCompleteness } from '../../investment/normalization.ts';
import { createUninvestedSnapshot } from '../../investment/repository.ts';
import {
  TEAM_BUILD_READINESS_RULE_VERSION,
  READINESS_EXPLANATION_CODES,
  EMPTY_TEAM_BUILD_READINESS_PROVENANCE
} from './rules.ts';
import { deriveTeamBuildReadinessId } from './predicates.ts';
import type {
  TeamOwnershipStatus,
  TeamInvestmentStatus,
  TeamBuildReadinessStatus,
  TeamInvestmentCompleteness,
  TeamBuildReadiness
} from './types.ts';

/**
 * Evaluates the team build readiness and investment applicability for a single team candidate.
 */
export function evaluateTeamBuildReadiness(
  ranking: TeamCompositionEvidenceRanking,
  eligibility: TeamCompositionRosterEligibility,
  memberInvestments: readonly [
    ResonatorInvestmentSnapshot,
    ResonatorInvestmentSnapshot,
    ResonatorInvestmentSnapshot
  ],
  options?: { ruleVersion?: '7.14.1' }
): TeamBuildReadiness {
  const patchVersion = '3.7';
  const ruleVersion = options?.ruleVersion ?? TEAM_BUILD_READINESS_RULE_VERSION;
  const readinessId = deriveTeamBuildReadinessId(patchVersion, ranking.candidateId, ruleVersion);

  const [snapA, snapB, snapC] = memberInvestments;
  const compA = computeInvestmentCompleteness(snapA);
  const compB = computeInvestmentCompleteness(snapB);
  const compC = computeInvestmentCompleteness(snapC);

  // 1. Compute aggregate factual completeness
  const totalMemberDimensions = compA.totalDimensions + compB.totalDimensions + compC.totalDimensions;
  const knownMemberDimensions = compA.knownDimensions + compB.knownDimensions + compC.knownDimensions;
  const unknownMemberDimensions = totalMemberDimensions - knownMemberDimensions;

  const ratioA = compA.completenessRatio !== null ? compA.completenessRatio : 0;
  const ratioB = compB.completenessRatio !== null ? compB.completenessRatio : 0;
  const ratioC = compC.completenessRatio !== null ? compC.completenessRatio : 0;

  const teamCompletenessRatio =
    totalMemberDimensions > 0
      ? Math.round((knownMemberDimensions / totalMemberDimensions) * 10000) / 10000
      : null;

  const memberCompletenessRatios: readonly [number, number, number] = Object.freeze([
    ratioA,
    ratioB,
    ratioC
  ]);

  const investmentCompleteness: TeamInvestmentCompleteness = Object.freeze({
    totalMemberDimensions,
    knownMemberDimensions,
    unknownMemberDimensions,
    memberCompletenessRatios,
    teamCompletenessRatio
  });

  // Track dimensions known across all 3 members vs any unknown
  const knownInvestmentDimensions: InvestmentDimensionKey[] = [];
  const unknownInvestmentDimensions: InvestmentDimensionKey[] = [];

  for (const dim of ALL_INVESTMENT_DIMENSIONS) {
    const isKnownA = compA.dimensionDetails[dim] === 'KNOWN';
    const isKnownB = compB.dimensionDetails[dim] === 'KNOWN';
    const isKnownC = compC.dimensionDetails[dim] === 'KNOWN';

    if (isKnownA && isKnownB && isKnownC) {
      knownInvestmentDimensions.push(dim);
    } else {
      unknownInvestmentDimensions.push(dim);
    }
  }

  // 2. Map ownership status from Step 12 authority
  let ownershipStatus: TeamOwnershipStatus;
  switch (eligibility.eligibilityStatus) {
    case 'ELIGIBLE':
      ownershipStatus = 'FULLY_OWNED';
      break;
    case 'PARTIALLY_OWNED':
      ownershipStatus = 'PARTIALLY_OWNED';
      break;
    case 'NOT_OWNED':
      ownershipStatus = 'NOT_OWNED';
      break;
    case 'INVALID_ROSTER':
      ownershipStatus = 'INVALID';
      break;
    case 'PATCH_MISMATCH':
      ownershipStatus = 'PATCH_MISMATCH';
      break;
  }

  // 3. Determine investment status
  let investmentStatus: TeamInvestmentStatus;
  if (ownershipStatus === 'INVALID' || ownershipStatus === 'PATCH_MISMATCH') {
    investmentStatus = 'INVESTMENT_UNAVAILABLE';
  } else if (knownMemberDimensions === totalMemberDimensions) {
    investmentStatus = 'INVESTMENT_COMPLETE';
  } else if (knownMemberDimensions > 0) {
    investmentStatus = 'INVESTMENT_PARTIAL';
  } else {
    investmentStatus = 'INVESTMENT_UNKNOWN';
  }

  // 4. Determine combined build readiness status
  let readinessStatus: TeamBuildReadinessStatus;
  let isFullyOwned = false;
  let isReady = false;

  const explanationCodes: string[] = [];

  if (ownershipStatus === 'PATCH_MISMATCH') {
    readinessStatus = 'PATCH_MISMATCH';
    explanationCodes.push(READINESS_EXPLANATION_CODES.TEAM_READINESS_PATCH_MISMATCH);
  } else if (ownershipStatus === 'INVALID') {
    readinessStatus = 'INVALID';
    explanationCodes.push(READINESS_EXPLANATION_CODES.TEAM_READINESS_INVALID_ROSTER);
  } else if (ownershipStatus === 'NOT_OWNED') {
    readinessStatus = 'NOT_OWNED';
    explanationCodes.push(READINESS_EXPLANATION_CODES.TEAM_READINESS_NOT_OWNED);
  } else if (ownershipStatus === 'PARTIALLY_OWNED') {
    readinessStatus = 'PARTIALLY_OWNED';
    explanationCodes.push(READINESS_EXPLANATION_CODES.TEAM_READINESS_PARTIALLY_OWNED);
  } else {
    // FULLY_OWNED
    isFullyOwned = true;
    isReady = true;

    if (investmentStatus === 'INVESTMENT_COMPLETE') {
      readinessStatus = 'READY';
      explanationCodes.push(
        READINESS_EXPLANATION_CODES.TEAM_READINESS_READY,
        READINESS_EXPLANATION_CODES.INVESTMENT_DIMENSIONS_ALL_KNOWN
      );
    } else if (investmentStatus === 'INVESTMENT_PARTIAL') {
      readinessStatus = 'READY_WITH_PARTIAL_INVESTMENT';
      explanationCodes.push(
        READINESS_EXPLANATION_CODES.TEAM_READINESS_READY_PARTIAL_INVESTMENT,
        READINESS_EXPLANATION_CODES.INVESTMENT_DIMENSIONS_PARTIALLY_KNOWN
      );
    } else {
      readinessStatus = 'READY_WITH_UNKNOWN_INVESTMENT';
      explanationCodes.push(
        READINESS_EXPLANATION_CODES.TEAM_READINESS_READY_UNKNOWN_INVESTMENT,
        READINESS_EXPLANATION_CODES.INVESTMENT_DIMENSIONS_NONE_KNOWN
      );
    }
  }

  explanationCodes.push(READINESS_EXPLANATION_CODES.STEP12_OWNERSHIP_PRESERVED);

  if (ranking.rankingStatus === 'RANKED') {
    explanationCodes.push(
      READINESS_EXPLANATION_CODES.STEP10_SCORE_PRESERVED,
      READINESS_EXPLANATION_CODES.STEP11_RANK_PRESERVED,
      `RANK_${ranking.rank}`,
      `SCORE_${ranking.totalScore}`
    );
  } else {
    explanationCodes.push(READINESS_EXPLANATION_CODES.STEP11_UNRANKABLE_PRESERVED);
  }

  const provenance = ranking.provenance ?? eligibility.provenance ?? EMPTY_TEAM_BUILD_READINESS_PROVENANCE;

  return Object.freeze({
    id: readinessId,
    patchVersion,
    ruleVersion,
    teamCandidateId: ranking.candidateId,
    memberResonatorIds: ranking.memberResonatorIds,
    ownershipStatus,
    investmentStatus,
    readinessStatus,
    isFullyOwned,
    isReady,
    memberInvestmentSnapshots: memberInvestments,
    investmentCompleteness,
    step10EvaluationId: ranking.evaluationId,
    step11RankingId: ranking.id,
    step12EligibilityId: eligibility.id,
    preservedStep10Score: ranking.totalScore,
    preservedStep11Rank: ranking.rank,
    step11RankingStatus: ranking.rankingStatus,
    knownInvestmentDimensions: Object.freeze(knownInvestmentDimensions),
    unknownInvestmentDimensions: Object.freeze(unknownInvestmentDimensions),
    explanationCodes: Object.freeze(explanationCodes),
    provenance
  });
}
