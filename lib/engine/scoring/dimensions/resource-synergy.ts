/**
 * Resource Synergy Dimension Scorer
 *
 * Evaluates concerto generation, energy refund, and rotation acceleration mechanics.
 */

import type { TeamCandidate, TeamValidationReport } from '../../../domain/types/index.ts';
import type { ScoreDimension } from '../types.ts';
import { TEAM_SCORING_CONFIG } from '../config.ts';

export function scoreResourceSynergy(
  candidate: TeamCandidate,
  report: TeamValidationReport
): ScoreDimension {
  const evidence: string[] = [];
  let rawScore = 50; // Standard rotation baseline

  if (report.hasResourceGrant) {
    rawScore = 90;
    evidence.push('Provides direct Energy / Concerto resource grant mechanics (90)');
  } else {
    // Check total concerto generated across member skills
    const totalConcerto = candidate.members.reduce((sum, m) => {
      return (
        sum +
        m.resonator.abilities.reduce((s, a) => s + (a.concertosGenerated || 0), 0)
      );
    }, 0);

    if (totalConcerto >= 50) {
      rawScore = 75;
      evidence.push(`High concerto efficiency across rotation (${totalConcerto} concerto) (75)`);
    } else {
      rawScore = 50;
      evidence.push('Standard concerto rotation generation (50)');
    }
  }

  rawScore = Math.min(Math.max(rawScore, 0), TEAM_SCORING_CONFIG.maxRawScore);
  const weight = TEAM_SCORING_CONFIG.weights.resourceSynergy;
  const weightedScore = Math.round((rawScore / TEAM_SCORING_CONFIG.maxRawScore) * weight);

  return {
    score: rawScore,
    maxScore: TEAM_SCORING_CONFIG.maxRawScore,
    weight,
    weightedScore,
    evidence,
  };
}
