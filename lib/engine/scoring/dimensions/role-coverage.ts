/**
 * Role Coverage Dimension Scorer
 *
 * Evaluates the combat role distribution of the candidate team.
 * Measures presence of Main DPS, Sub DPS, and Support/Sustain roles.
 */

import type { TeamCandidate, TeamValidationReport } from '../../../domain/types/index.ts';
import type { ScoreDimension } from '../types.ts';
import { TEAM_SCORING_CONFIG } from '../config.ts';

export function scoreRoleCoverage(
  _candidate: TeamCandidate,
  report: TeamValidationReport
): ScoreDimension {
  const roles = report.rolesPresent.map((r) => r.toUpperCase());
  const evidence: string[] = [];

  let rawScore = 0;

  const hasMainDps = roles.some((r) => r.includes('MAIN_DPS') || r === 'DPS');
  const hasSubDps = roles.some((r) => r.includes('SUB_DPS'));
  const hasSupport = roles.some(
    (r) => r.includes('SUPPORT') || r.includes('HEAL') || r.includes('SHIELD')
  );

  if (hasMainDps) {
    rawScore += 40;
    evidence.push('Contains dedicated Main DPS (+40)');
  } else {
    evidence.push('Lacks dedicated Main DPS (+0)');
  }

  if (hasSubDps) {
    rawScore += 30;
    evidence.push('Contains Sub DPS / Off-field damage dealer (+30)');
  } else if (hasMainDps && roles.filter((r) => r.includes('DPS')).length > 1) {
    rawScore += 20;
    evidence.push('Contains dual DPS setup (+20)');
  } else {
    evidence.push('Lacks secondary damage dealer (+0)');
  }

  if (hasSupport) {
    rawScore += 30;
    evidence.push('Contains Support / Buffer / Sustain (+30)');
  } else {
    evidence.push('Lacks dedicated support or sustain (+0)');
  }

  rawScore = Math.min(rawScore, TEAM_SCORING_CONFIG.maxRawScore);
  const weight = TEAM_SCORING_CONFIG.weights.roleCoverage;
  const weightedScore = Math.round((rawScore / TEAM_SCORING_CONFIG.maxRawScore) * weight);

  return {
    score: rawScore,
    maxScore: TEAM_SCORING_CONFIG.maxRawScore,
    weight,
    weightedScore,
    evidence,
  };
}
