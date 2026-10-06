/**
 * Offensive Synergy Dimension Scorer
 *
 * Measures structured offensive interactions: damage amplification,
 * attack/crit stat buffs, and buff chain synergies.
 */

import type { TeamCandidate, TeamValidationReport } from '../../../domain/types/index.ts';
import { collectTeamEffects, hasEffectCategory } from '../../rules/gameplay-effects.ts';
import type { ScoreDimension } from '../types.ts';
import { TEAM_SCORING_CONFIG } from '../config.ts';

export function scoreOffensiveSynergy(
  candidate: TeamCandidate,
  report: TeamValidationReport
): ScoreDimension {
  const effects = collectTeamEffects(candidate);
  const evidence: string[] = [];

  let rawScore = 20; // Baseline combat capability

  if (report.hasDamageAmplify) {
    rawScore += 35;
    evidence.push('Contains active Damage Amplification mechanics (+35)');
  } else {
    evidence.push('Lacks direct Damage Amplification (+0)');
  }

  const hasStatBuff = hasEffectCategory(effects, 'STAT_BUFF');
  if (hasStatBuff) {
    rawScore += 25;
    evidence.push('Provides teamwide or active stat enhancements (ATK/Crit/DMG%) (+25)');
  } else {
    evidence.push('Lacks offensive stat buffs (+0)');
  }

  // Multiplier / outro chain synergy
  const introOutroCount = candidate.members.reduce((count, m) => {
    return (
      count +
      m.resonator.abilities.filter(
        (a) => a.category === 'IntroSkill' || a.category === 'OutroSkill'
      ).length
    );
  }, 0);

  if (introOutroCount >= 3) {
    rawScore += 20;
    evidence.push('Complete Concerto Intro/Outro rotation chain (+20)');
  } else {
    rawScore += 10;
  }

  rawScore = Math.min(Math.max(rawScore, 0), TEAM_SCORING_CONFIG.maxRawScore);
  const weight = TEAM_SCORING_CONFIG.weights.offensiveSynergy;
  const weightedScore = Math.round((rawScore / TEAM_SCORING_CONFIG.maxRawScore) * weight);

  return {
    score: rawScore,
    maxScore: TEAM_SCORING_CONFIG.maxRawScore,
    weight,
    weightedScore,
    evidence,
  };
}
