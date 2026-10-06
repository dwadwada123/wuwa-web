/**
 * Elemental Matchup Dimension Scorer
 *
 * Evaluates the alignment between team damage elements and stage enemy resistances.
 * Uses Phase 4A effective resistance formula: base - areaModifier - teamShred.
 *
 * Deterministic gap-free partition over all real numbers:
 *   effectiveResistance <= 0%  -> 100 (strongly advantaged)
 *   0% < res <= 10%            -> 85  (advantaged)
 *   10% < res <= 20%           -> 70  (neutral baseline)
 *   20% < res <= 30%           -> 50  (moderately resisted)
 *   30% < res < 40%            -> 35  (resisted)
 *   res == 40%                 -> 20  (heavily resisted)
 *   res > 40%                  -> 10  (severely resisted)
 */

import type { TeamCandidate, ToAStage } from '../../../domain/types/index.ts';
import { evaluateElementalMatchup } from '../../rules/elemental-matchup.ts';
import type { ScoreDimension } from '../types.ts';
import { TEAM_SCORING_CONFIG } from '../config.ts';

export interface ElementalBandResult {
  score: number;
  status: string;
}

/**
 * Returns a total, deterministic, gap-free score and status for any effective resistance.
 * Ordering guarantee: lower resistance -> higher score.
 */
export function getElementalBandScore(effectiveRes: number): ElementalBandResult {
  if (effectiveRes <= 0.00) {
    return { score: 100, status: 'strongly advantaged' };
  }
  if (effectiveRes <= 0.10) {
    return { score: 85, status: 'advantaged' };
  }
  if (effectiveRes <= 0.20) {
    return { score: 70, status: 'neutral' };
  }
  if (effectiveRes <= 0.30) {
    return { score: 50, status: 'moderately resisted' };
  }
  if (effectiveRes < 0.40) {
    return { score: 35, status: 'resisted' };
  }
  if (effectiveRes <= 0.40) {
    return { score: 20, status: 'heavily resisted' };
  }
  return { score: 10, status: 'severely resisted' };
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
    const band = getElementalBandScore(effRes);
    scores.push(band.score);

    evidence.push(
      `Element ${el}: effective resistance ${(effRes * 100).toFixed(0)}% (${band.status}, score: ${band.score})`
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
