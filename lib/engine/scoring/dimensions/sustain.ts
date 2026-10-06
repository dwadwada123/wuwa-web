/**
 * Sustain Dimension Scorer
 *
 * Evaluates defensive survivability (Healing & Shielding) in a stage-relative manner.
 * Bosses and high floors heavily reward sustain, whereas low floors allow glass-cannon setups.
 */

import type { TeamCandidate, ToAStage, TeamValidationReport } from '../../../domain/types/index.ts';
import { evaluateEnemyMatchup } from '../../rules/enemy-matchup.ts';
import type { ScoreDimension } from '../types.ts';
import { TEAM_SCORING_CONFIG } from '../config.ts';

export function scoreSustain(
  candidate: TeamCandidate,
  stage: ToAStage,
  report: TeamValidationReport
): ScoreDimension {
  const enemyFacts = evaluateEnemyMatchup(candidate, stage);
  const evidence: string[] = [];

  const isHighThreat = enemyFacts.bossPresence || stage.vigorCost >= 4 || stage.stageIndex >= 4;
  let rawScore = 0;

  if (isHighThreat) {
    evidence.push('High-threat stage encounter (Boss / High Floor)');
    if (report.hasHealing && report.hasShield) {
      rawScore = 100;
      evidence.push('Full dual sustain: Healing and Shield present (100)');
    } else if (report.hasHealing) {
      rawScore = 85;
      evidence.push('Healing sustain present (85)');
    } else if (report.hasShield) {
      rawScore = 80;
      evidence.push('Shield sustain present (80)');
    } else {
      rawScore = 25;
      evidence.push('No sustain mechanics on high-threat stage (25)');
    }
  } else {
    evidence.push('Low/Moderate threat stage encounter (Floor 1-3)');
    if (report.hasHealing || report.hasShield) {
      rawScore = 90;
      evidence.push('Sustain present (90)');
    } else {
      rawScore = 65;
      evidence.push('Glass-cannon offensive setup viable on early floor (65)');
    }
  }

  rawScore = Math.min(Math.max(rawScore, 0), TEAM_SCORING_CONFIG.maxRawScore);
  const weight = TEAM_SCORING_CONFIG.weights.sustain;
  const weightedScore = Math.round((rawScore / TEAM_SCORING_CONFIG.maxRawScore) * weight);

  return {
    score: rawScore,
    maxScore: TEAM_SCORING_CONFIG.maxRawScore,
    weight,
    weightedScore,
    evidence,
  };
}
