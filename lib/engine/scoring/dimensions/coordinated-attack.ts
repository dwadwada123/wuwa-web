/**
 * Coordinated Attack Synergy Dimension Scorer
 *
 * Evaluates off-field coordinated attacks and attack-frequency mechanics.
 */

import type { TeamCandidate, ToAStage, TeamValidationReport } from '../../../domain/types/index.ts';
import type { ScoreDimension } from '../types.ts';
import { TEAM_SCORING_CONFIG } from '../config.ts';

export function scoreCoordinatedAttackSynergy(
  candidate: TeamCandidate,
  stage: ToAStage,
  report: TeamValidationReport
): ScoreDimension {
  const evidence: string[] = [];

  const stageHasCoordBuff = stage.areaEffects.some(
    (e) =>
      e.name.toLowerCase().includes('coordinated') ||
      e.description.toLowerCase().includes('coordinated')
  );

  let rawScore = 40; // Neutral baseline

  if (report.hasCoordinatedAttack) {
    if (stageHasCoordBuff || stage.waves.some((w) => w.enemyInstances.length > 2)) {
      rawScore = 100;
      evidence.push('Coordinated attacks activate stage buffs or cover multi-enemy waves (100)');
    } else {
      rawScore = 80;
      evidence.push('Active off-field coordinated attack capability (80)');
    }
  } else {
    if (stageHasCoordBuff) {
      rawScore = 20;
      evidence.push('Stage rewards coordinated attacks, but team lacks coordinated attacks (20)');
    } else {
      rawScore = 40;
      evidence.push('No coordinated attack mechanics (neutral baseline: 40)');
    }
  }

  rawScore = Math.min(Math.max(rawScore, 0), TEAM_SCORING_CONFIG.maxRawScore);
  const weight = TEAM_SCORING_CONFIG.weights.coordinatedAttackSynergy;
  const weightedScore = Math.round((rawScore / TEAM_SCORING_CONFIG.maxRawScore) * weight);

  return {
    score: rawScore,
    maxScore: TEAM_SCORING_CONFIG.maxRawScore,
    weight,
    weightedScore,
    evidence,
  };
}
