/**
 * Resistance Utility Dimension Scorer
 *
 * Evaluates defense reduction (DEF Shred) and resistance reduction (RES Shred)
 * mechanics that modify enemy defenses.
 */

import type { TeamCandidate, TeamValidationReport } from '../../../domain/types/index.ts';
import type { ScoreDimension } from '../types.ts';
import { TEAM_SCORING_CONFIG } from '../config.ts';

export function scoreResistanceUtility(
  _candidate: TeamCandidate,
  report: TeamValidationReport
): ScoreDimension {
  const evidence: string[] = [];
  let rawScore = 20; // Baseline

  const hasDef = report.hasDefShred;
  const hasRes = report.hasResistanceShred;

  if (hasDef && hasRes) {
    rawScore = 100;
    evidence.push('Provides both DEF Shred and Elemental RES Shred (100)');
  } else if (hasDef) {
    rawScore = 75;
    evidence.push('Provides DEF Shred (75)');
  } else if (hasRes) {
    rawScore = 75;
    evidence.push('Provides Elemental RES Shred (75)');
  } else {
    rawScore = 20;
    evidence.push('Lacks defense or resistance reduction utility (20)');
  }

  rawScore = Math.min(Math.max(rawScore, 0), TEAM_SCORING_CONFIG.maxRawScore);
  const weight = TEAM_SCORING_CONFIG.weights.resistanceUtility;
  const weightedScore = Math.round((rawScore / TEAM_SCORING_CONFIG.maxRawScore) * weight);

  return {
    score: rawScore,
    maxScore: TEAM_SCORING_CONFIG.maxRawScore,
    weight,
    weightedScore,
    evidence,
  };
}
