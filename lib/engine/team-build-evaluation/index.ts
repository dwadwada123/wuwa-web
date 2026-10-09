/**
 * Wuthering Waves Deterministic Team Build Evaluation Barrel Export
 * Phase 7 Step 21: Deterministic Team Build Evaluation Contract
 *
 * Re-exports public types, rules, predicates, builders, repository APIs,
 * auditors, and presentation utilities for Step 21.
 */

export * from './types.ts';
export {
  TEAM_BUILD_EVALUATION_RULE_VERSION,
  REQUIRED_STEP20_RULE_VERSION,
  REQUIRED_STEP9_RULE_VERSION,
  TEAM_TOTAL_ASPECTS_COUNT,
  TEAM_BUILD_EVALUATION_EXPLANATION_CODES,
  EMPTY_TEAM_BUILD_EVALUATION_PROVENANCE,
  PROHIBITED_TEAM_BUILD_EVALUATION_KEYS,
  type ProhibitedTeamBuildEvaluationKey
} from './rules.ts';
export * from './predicates.ts';
export * from './builder.ts';
export * from './repository.ts';
export {
  assertNoProhibitedTeamBuildEvaluationKeys,
  auditSingleTeamBuildEvaluation,
  auditTeamBuildEvaluations,
  runProductionTeamBuildEvaluationAudit
} from './audit.ts';

import type { TeamBuildEvaluation } from './types.ts';

/**
 * Formats a factual, human-readable presentation explanation for a
 * TeamBuildEvaluation record.
 * Never introduces subjective judgments, power scores, or tier ratings.
 */
export function formatTeamBuildExplanation(evaluation: TeamBuildEvaluation): string {
  const [mA, mB, mC] = evaluation.memberResonatorIds;
  const lines: string[] = [
    `Team Build: [${mA}, ${mB}, ${mC}]`,
    `Status: ${evaluation.status}`,
    `Completeness: ${evaluation.completeness.teamCompletenessRatio !== null ? (evaluation.completeness.teamCompletenessRatio * 100).toFixed(1) + '%' : 'UNKNOWN'} (${evaluation.completeness.knownTeamAspects}/${evaluation.completeness.totalTeamAspects} aspects known)`
  ];

  const w = evaluation.weaponAggregation;
  lines.push(
    `Weapons: ${w.compatibleCount}/3 Compatible, ${w.incompatibleCount}/3 Incompatible, ${w.unequippedCount}/3 Unequipped, ${w.unknownCount}/3 Unknown`
  );

  const e = evaluation.echoAggregation;
  lines.push(
    `Echo Loadouts: ${e.equippedCount}/3 Equipped (Aligned: ${e.elementAlignedSonataCount}, Universal: ${e.universalSonataCount}, Misaligned: ${e.misalignedSonataCount})`
  );

  const s = evaluation.sonataInteraction;
  const duplicateStr = s.hasDuplicateSonataSets
    ? `Duplicate Sets: [${s.duplicateSonataCodes.join(', ')}]`
    : 'No Duplicate Sets';
  lines.push(
    `Sonata Interaction: Status: ${s.interactionStatus}, Sets: [${s.distinctActiveSonataCodes.join(', ')}], ${duplicateStr}, Stacking: ${s.stackingStatus}`
  );

  return lines.join('\n');
}
