/**
 * Wuthering Waves Deterministic Owned Roster Eligibility Module
 * Phase 7 Step 12: Deterministic Owned Roster Eligibility Contract
 *
 * Public entrypoint for Step 12 owned roster snapshot contracts, eligibility rules,
 * eligibility engine, repository, audit facilities, and presentation explanations.
 */

export * from './types.ts';
export * from './rules.ts';
export * from './predicates.ts';
export * from './eligibility.ts';
export * from './repository.ts';
export * from './audit.ts';

import type {
  TeamCompositionRosterEligibility,
  TeamCompositionRosterExplanation
} from './types.ts';

/**
 * Produces a structured, machine-readable presentation explanation for a roster eligibility evaluation.
 * Presentation only: this string output MUST NEVER become an engine input.
 */
export function explainTeamCompositionRosterEligibility(
  record: TeamCompositionRosterEligibility
): TeamCompositionRosterExplanation {
  let summary: string;

  if (record.isEligible) {
    if (record.step11Rank !== null) {
      summary = `Team candidate {${record.memberResonatorIds.join(', ')}} is fully eligible (all 3 members owned). Step 11 rank: #${record.step11Rank} (Score: ${record.step11TotalScore?.toFixed(2)}/100.00).`;
    } else {
      summary = `Team candidate {${record.memberResonatorIds.join(', ')}} is fully eligible (all 3 members owned). Candidate is unrankable in Step 11 (Score: null).`;
    }
  } else if (record.eligibilityStatus === 'PARTIALLY_OWNED') {
    summary = `Team candidate {${record.memberResonatorIds.join(', ')}} is partially owned (${record.ownedMemberResonatorIds.length}/3 members owned: [${record.ownedMemberResonatorIds.join(', ')}]; missing: [${record.missingMemberResonatorIds.join(', ')}]).`;
  } else if (record.eligibilityStatus === 'NOT_OWNED') {
    summary = `Team candidate {${record.memberResonatorIds.join(', ')}} is not owned (0/3 members owned).`;
  } else {
    summary = `Team candidate {${record.memberResonatorIds.join(', ')}} eligibility could not be evaluated (${record.eligibilityStatus}).`;
  }

  return Object.freeze({
    eligibilityId: record.id,
    candidateId: record.candidateId,
    members: record.memberResonatorIds,
    eligibilityStatus: record.eligibilityStatus,
    isEligible: record.isEligible,
    step11Rank: record.step11Rank,
    step11TotalScore: record.step11TotalScore,
    ownedMembers: record.ownedMemberResonatorIds,
    missingMembers: record.missingMemberResonatorIds,
    summary,
    explanationCodes: record.explanationCodes
  });
}
