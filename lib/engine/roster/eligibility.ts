/**
 * Wuthering Waves Deterministic Owned Roster Eligibility Engine
 * Phase 7 Step 12: Deterministic Owned Roster Eligibility Contract
 *
 * Implements deterministic roster eligibility evaluation over Step 11
 * TeamCompositionEvidenceRanking objects.
 *
 * CRITICAL ARCHITECTURAL BOUNDARIES:
 * 1. FEASIBILITY ONLY: Evaluates whether candidate members are owned by the user.
 * 2. NO OPTIMIZATION / NO SCORING: Does not calculate best teams, DPS, or meta viability.
 * 3. STEP 11 PRESERVATION: step11Rank and step11TotalScore are copied verbatim.
 * 4. PURE & OFFLINE: Zero network, zero LLMs, zero random IDs, zero timestamps.
 */

import type {
  TeamCompositionEvidenceRanking
} from '../team-composition/ranking/types.ts';
import {
  OWNED_ROSTER_ELIGIBILITY_RULE_VERSION,
  ROSTER_EXPLANATION_CODES
} from './rules.ts';
import {
  deriveTeamCompositionEligibilityId,
  normalizeOwnedRoster
} from './predicates.ts';
import type {
  OwnedRosterSnapshot,
  NormalizedOwnedRoster,
  TeamCompositionEligibilityStatus,
  TeamCompositionRosterEligibility
} from './types.ts';

/**
 * Evaluates the roster feasibility of a single TeamCompositionEvidenceRanking record.
 */
export function evaluateCandidateRosterEligibility(
  ranking: TeamCompositionEvidenceRanking,
  normalizedRoster: NormalizedOwnedRoster,
  options?: { ruleVersion?: '7.12.1' }
): TeamCompositionRosterEligibility {
  const patchVersion = '3.7';
  const ruleVersion = options?.ruleVersion ?? OWNED_ROSTER_ELIGIBILITY_RULE_VERSION;
  const eligibilityId = deriveTeamCompositionEligibilityId(patchVersion, ranking.candidateId, ruleVersion);

  // 1. Strict patch validation
  if (ranking.patchVersion !== '3.7' || normalizedRoster.patchVersion !== '3.7') {
    return Object.freeze({
      id: eligibilityId,
      patchVersion,
      ruleVersion,
      candidateId: ranking.candidateId,
      rankingId: ranking.id,
      evaluationId: ranking.evaluationId,
      memberResonatorIds: ranking.memberResonatorIds,
      eligibilityStatus: 'PATCH_MISMATCH',
      isEligible: false,
      ownedMemberResonatorIds: Object.freeze([]),
      missingMemberResonatorIds: ranking.memberResonatorIds,
      step11Rank: ranking.rank,
      step11TotalScore: ranking.totalScore,
      step11RankingStatus: ranking.rankingStatus,
      evidenceEvaluationStatus: ranking.evaluationStatus,
      candidateQualificationStatus: ranking.candidateQualificationStatus,
      evidenceIds: ranking.evidenceIds,
      relationshipIds: ranking.relationshipIds,
      sourceFactIds: ranking.sourceFactIds,
      explanationCodes: Object.freeze([ROSTER_EXPLANATION_CODES.ROSTER_PATCH_MISMATCH]),
      provenance: ranking.provenance
    });
  }

  // 2. Strict roster validation
  if (!normalizedRoster.isValid) {
    return Object.freeze({
      id: eligibilityId,
      patchVersion,
      ruleVersion,
      candidateId: ranking.candidateId,
      rankingId: ranking.id,
      evaluationId: ranking.evaluationId,
      memberResonatorIds: ranking.memberResonatorIds,
      eligibilityStatus: 'INVALID_ROSTER',
      isEligible: false,
      ownedMemberResonatorIds: Object.freeze([]),
      missingMemberResonatorIds: ranking.memberResonatorIds,
      step11Rank: ranking.rank,
      step11TotalScore: ranking.totalScore,
      step11RankingStatus: ranking.rankingStatus,
      evidenceEvaluationStatus: ranking.evaluationStatus,
      candidateQualificationStatus: ranking.candidateQualificationStatus,
      evidenceIds: ranking.evidenceIds,
      relationshipIds: ranking.relationshipIds,
      sourceFactIds: ranking.sourceFactIds,
      explanationCodes: Object.freeze([
        ROSTER_EXPLANATION_CODES.ROSTER_INVALID,
        ...(normalizedRoster.validationError ? [`ERROR_${normalizedRoster.validationError}`] : [])
      ]),
      provenance: ranking.provenance
    });
  }

  // 3. Determine member ownership
  const ownedMembers: string[] = [];
  const missingMembers: string[] = [];

  for (const memberId of ranking.memberResonatorIds) {
    if (normalizedRoster.ownedIdSet.has(memberId)) {
      ownedMembers.push(memberId);
    } else {
      missingMembers.push(memberId);
    }
  }

  let eligibilityStatus: TeamCompositionEligibilityStatus;
  let isEligible = false;
  const explanationCodes: string[] = [];

  if (ownedMembers.length === 3) {
    eligibilityStatus = 'ELIGIBLE';
    isEligible = true;
    explanationCodes.push(ROSTER_EXPLANATION_CODES.ROSTER_ELIGIBLE_ALL_MEMBERS_OWNED);
  } else if (ownedMembers.length > 0) {
    eligibilityStatus = 'PARTIALLY_OWNED';
    isEligible = false;
    explanationCodes.push(
      ROSTER_EXPLANATION_CODES.ROSTER_PARTIALLY_OWNED,
      `OWNED_COUNT_${ownedMembers.length}`,
      `MISSING_COUNT_${missingMembers.length}`
    );
  } else {
    eligibilityStatus = 'NOT_OWNED';
    isEligible = false;
    explanationCodes.push(ROSTER_EXPLANATION_CODES.ROSTER_NONE_OWNED);
  }

  for (const m of ownedMembers) {
    explanationCodes.push(`${ROSTER_EXPLANATION_CODES.ROSTER_MEMBER_OWNED}:${m}`);
  }
  for (const m of missingMembers) {
    explanationCodes.push(`${ROSTER_EXPLANATION_CODES.ROSTER_MEMBER_MISSING}:${m}`);
  }

  if (ranking.rankingStatus === 'RANKED') {
    explanationCodes.push(
      ROSTER_EXPLANATION_CODES.STEP11_RANK_PRESERVED,
      ROSTER_EXPLANATION_CODES.STEP11_SCORE_PRESERVED,
      `RANK_${ranking.rank}`,
      `SCORE_${ranking.totalScore}`
    );
  } else {
    explanationCodes.push(ROSTER_EXPLANATION_CODES.STEP11_UNRANKABLE_PRESERVED);
  }

  return Object.freeze({
    id: eligibilityId,
    patchVersion,
    ruleVersion,
    candidateId: ranking.candidateId,
    rankingId: ranking.id,
    evaluationId: ranking.evaluationId,
    memberResonatorIds: ranking.memberResonatorIds,
    eligibilityStatus,
    isEligible,
    ownedMemberResonatorIds: Object.freeze(ownedMembers),
    missingMemberResonatorIds: Object.freeze(missingMembers),
    step11Rank: ranking.rank,
    step11TotalScore: ranking.totalScore,
    step11RankingStatus: ranking.rankingStatus,
    evidenceEvaluationStatus: ranking.evaluationStatus,
    candidateQualificationStatus: ranking.candidateQualificationStatus,
    evidenceIds: ranking.evidenceIds,
    relationshipIds: ranking.relationshipIds,
    sourceFactIds: ranking.sourceFactIds,
    explanationCodes: Object.freeze(explanationCodes),
    provenance: ranking.provenance
  });
}

/**
 * Evaluates roster eligibility across an array of TeamCompositionEvidenceRankings.
 * Strictly preserves the input ordering of the rankings!
 */
export function evaluateRosterEligibility(
  rankings: readonly TeamCompositionEvidenceRanking[],
  roster: OwnedRosterSnapshot,
  options?: { ruleVersion?: '7.12.1' }
): readonly TeamCompositionRosterEligibility[] {
  const normalized = normalizeOwnedRoster(roster);
  const results: TeamCompositionRosterEligibility[] = [];

  for (const ranking of rankings) {
    results.push(evaluateCandidateRosterEligibility(ranking, normalized, options));
  }

  return Object.freeze(results);
}
