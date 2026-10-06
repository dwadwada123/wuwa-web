/**
 * Stage Buff Compatibility Dimension Scorer
 *
 * Evaluates whether the candidate team can meaningfully activate and benefit from
 * the specific area effects defined on the ToA stage.
 */

import type { TeamCandidate, ToAStage } from '../../../domain/types/index.ts';
import { evaluateStageBuffCompatibility } from '../../rules/stage-compatibility.ts';
import type { ScoreDimension } from '../types.ts';
import { TEAM_SCORING_CONFIG } from '../config.ts';

export function scoreStageBuffCompatibility(
  candidate: TeamCandidate,
  stage: ToAStage
): ScoreDimension {
  const compat = evaluateStageBuffCompatibility(candidate, stage);
  const evidence: string[] = [];

  const totalEffects = stage.areaEffects.length;
  let rawScore = 50;

  if (totalEffects === 0) {
    evidence.push('Stage has no active area effects (neutral baseline: 50)');
  } else {
    const matchedCount = compat.matchedEffects.length;
    const ratio = matchedCount / totalEffects;

    if (ratio >= 1.0) {
      rawScore = 100;
    } else if (ratio >= 0.66) {
      rawScore = 80;
    } else if (ratio > 0) {
      rawScore = 60;
    } else {
      rawScore = 15;
    }

    evidence.push(
      `Utilizes ${matchedCount} of ${totalEffects} stage area effect(s) (${(ratio * 100).toFixed(0)}% utilization)`
    );

    for (const m of compat.matchedEffects) {
      evidence.push(`Matched: "${m.name}" - ${m.reason}`);
    }
    for (const u of compat.unmatchedEffects) {
      evidence.push(`Unmatched: "${u.name}" - ${u.reason}`);
    }
  }

  rawScore = Math.min(Math.max(rawScore, 0), TEAM_SCORING_CONFIG.maxRawScore);
  const weight = TEAM_SCORING_CONFIG.weights.stageBuffCompatibility;
  const weightedScore = Math.round((rawScore / TEAM_SCORING_CONFIG.maxRawScore) * weight);

  return {
    score: rawScore,
    maxScore: TEAM_SCORING_CONFIG.maxRawScore,
    weight,
    weightedScore,
    evidence,
  };
}
