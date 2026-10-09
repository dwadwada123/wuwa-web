/**
 * Wuthering Waves Deterministic Team Build Readiness Module
 * Phase 7 Step 14: Deterministic Team Build Readiness & Investment Applicability Contract
 *
 * Public entrypoint for Step 14 team build readiness contracts, evaluator,
 * query repository, audit facilities, and presentation explanations.
 */

export * from './types.ts';
export * from './rules.ts';
export * from './predicates.ts';
export * from './evaluator.ts';
export * from './repository.ts';
export * from './audit.ts';

import type {
  TeamBuildReadiness,
  TeamBuildReadinessExplanation
} from './types.ts';

/**
 * Formats an objective presentation explanation of a team's build readiness state.
 * Presentation only: this string output MUST NEVER become an engine input or score.
 */
export function explainTeamBuildReadiness(
  record: TeamBuildReadiness
): TeamBuildReadinessExplanation {
  const [a, b, c] = record.memberResonatorIds;
  const comp = record.investmentCompleteness;

  let summary: string;

  if (record.isFullyOwned) {
    const pct =
      comp.teamCompletenessRatio !== null
        ? `${(comp.teamCompletenessRatio * 100).toFixed(1)}%`
        : 'N/A';
    if (record.readinessStatus === 'READY') {
      summary = `Team candidate {${a}, ${b}, ${c}} is fully constructible and investment data is complete (100% known). Step 11 rank: ${record.preservedStep11Rank !== null ? `#${record.preservedStep11Rank}` : 'UNRANKABLE'}.`;
    } else if (record.readinessStatus === 'READY_WITH_PARTIAL_INVESTMENT') {
      summary = `Team candidate {${a}, ${b}, ${c}} is fully constructible with partial investment data (${comp.knownMemberDimensions}/${comp.totalMemberDimensions} dimensions known [${pct}]). Step 11 rank: ${record.preservedStep11Rank !== null ? `#${record.preservedStep11Rank}` : 'UNRANKABLE'}.`;
    } else {
      summary = `Team candidate {${a}, ${b}, ${c}} is fully constructible, but investment data is completely unknown (0/${comp.totalMemberDimensions} dimensions known). Step 11 rank: ${record.preservedStep11Rank !== null ? `#${record.preservedStep11Rank}` : 'UNRANKABLE'}.`;
    }
  } else if (record.ownershipStatus === 'PARTIALLY_OWNED') {
    summary = `Team candidate {${a}, ${b}, ${c}} cannot be constructed because not all members are owned (PARTIALLY_OWNED).`;
  } else if (record.ownershipStatus === 'NOT_OWNED') {
    summary = `Team candidate {${a}, ${b}, ${c}} cannot be constructed because none of the members are owned (NOT_OWNED).`;
  } else {
    summary = `Team candidate {${a}, ${b}, ${c}} build readiness could not be determined (${record.readinessStatus}).`;
  }

  return Object.freeze({
    readinessId: record.id,
    teamCandidateId: record.teamCandidateId,
    members: record.memberResonatorIds,
    ownershipStatus: record.ownershipStatus,
    investmentStatus: record.investmentStatus,
    readinessStatus: record.readinessStatus,
    isFullyOwned: record.isFullyOwned,
    preservedStep11Rank: record.preservedStep11Rank,
    preservedStep10Score: record.preservedStep10Score,
    completenessRatio: comp.teamCompletenessRatio,
    summary
  });
}
