/**
 * Elemental Matchup Dimension Scorer
 *
 * Evaluates the alignment between team damage elements and stage enemy resistances.
 * Uses Phase 4A effective resistance formula: base - areaModifier - teamShred.
 */

import type { TeamCandidate, ToAStage } from '../../../domain/types/index.ts';
import { evaluateElementalMatchup } from '../../rules/elemental-matchup.ts';
import type { ScoreDimension } from '../types.ts';
import { TEAM_SCORING_CONFIG } from '../config.ts';

function getBandScore(effectiveRes: number): number {
  if (effectiveRes <= 0.00) return 100;
  if (effectiveRes <= 0.10) return 85;
  if (effectiveRes <= 0.20) return 70;
  if (effectiveRes <= 0.30) return 50;
  return 20;
}

export function scoreElementalMatchup(
  candidate: TeamCandidate,
  stage: ToAStage
): ScoreDimension {
  const contexts = evaluateElementalMatchup(candidate, stage);
  const teamElements = Array.from(new Set(candidate.members.map((m) => m.resonator.element)));
  const evidence: string[] = [];

  const scores: number[] = [];

  for (const el of teamElements) {
    const ctx = contexts.find((c) => c.element === el);
    const effRes = ctx?.effectiveResistance ?? 0.20;
    const bandScore = getBandScore(effRes);
    scores.push(bandScore);

    const status =
      effRes <= 0.00
        ? 'strongly advantaged'
        : effRes <= 0.10
        ? 'advantaged'
        : effRes <= 0.20
        ? 'neutral'
        : effRes <= 0.30
        ? 'moderately resisted'
        : 'heavily resisted';

    evidence.push(
      `Element ${el}: effective resistance ${(effRes * 100).toFixed(0)}% (${status}, score: ${bandScore})`
    );
  }

  // Weight towards primary attacking element while considering team harmony
  const maxScore = Math.max(...scores);
  const avgScore = scores.reduce((sum, s) => sum + s, 0) / (scores.length || 1);
  const rawScore = Math.min(
    Math.round(0.75 * maxScore + 0.25 * avgScore),
    TEAM_SCORING_CONFIG.maxRawScore
  );

  const weight = TEAM_SCORING_CONFIG.weights.elementalMatchup;
  const weightedScore = Math.round((rawScore / TEAM_SCORING_CONFIG.maxRawScore) * weight);

  return {
    score: rawScore,
    maxScore: TEAM_SCORING_CONFIG.maxRawScore,
    weight,
    weightedScore,
    evidence,
  };
}
