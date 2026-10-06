/**
 * Enemy Matchup Dimension Scorer
 *
 * Evaluates candidate team suitability against stage enemy composition:
 * single boss encounters vs multi-target mob waves and tough shield bars.
 */

import type { TeamCandidate, ToAStage, TeamValidationReport } from '../../../domain/types/index.ts';
import type { ScoreDimension } from '../types.ts';
import { TEAM_SCORING_CONFIG } from '../config.ts';

export interface StageEnemySummary {
  bossPresence: boolean;
  enemyCount: number;
  waveCount: number;
  hasShieldBar: boolean;
}

const stageEnemySummaryCache = new WeakMap<ToAStage, StageEnemySummary>();

export function getStageEnemySummary(stage: ToAStage): StageEnemySummary {
  let cached = stageEnemySummaryCache.get(stage);
  if (!cached) {
    let enemyCount = 0;
    let bossPresence = false;
    let hasShieldBar = false;

    for (const wave of stage.waves) {
      enemyCount += wave.enemyInstances.length;
      for (const inst of wave.enemyInstances) {
        const cls = inst.enemy.enemyClass;
        if (cls === 'Overlord' || cls === 'Calamity') {
          bossPresence = true;
        }
        if (inst.enemy.modifiers?.some((m) => m.modifierType === 'SHIELD_BAR' && m.isActive)) {
          hasShieldBar = true;
        }
      }
    }

    cached = {
      bossPresence,
      enemyCount,
      waveCount: stage.waves.length,
      hasShieldBar,
    };
    stageEnemySummaryCache.set(stage, cached);
  }
  return cached;
}

export function scoreEnemyMatchup(
  candidate: TeamCandidate,
  stage: ToAStage,
  report: TeamValidationReport
): ScoreDimension {
  const facts = getStageEnemySummary(stage);
  const evidence: string[] = [];

  let rawScore = 50; // Baseline

  if (facts.bossPresence) {
    evidence.push(`Boss encounter present (Overlord/Calamity)`);
    // Reward single-target damage focus and sustain against boss
    const hasSustain = report.hasHealing || report.hasShield;
    if (hasSustain) {
      rawScore += 25;
      evidence.push('Team sustain mitigates boss threat (+25)');
    } else {
      evidence.push('Lacks sustain against high-damage boss (+0)');
    }

    // Shield bar counter mechanics
    const hasShieldBar = stage.waves.some((w) =>
      w.enemyInstances.some((i) =>
        i.enemy.modifiers?.some((m) => m.modifierType === 'SHIELD_BAR' && m.isActive)
      )
    );
    if (hasShieldBar) {
      if (report.hasResistanceShred || report.hasDefShred) {
        rawScore += 25;
        evidence.push('DEF/RES shred provides effective shield break / toughness drain (+25)');
      } else {
        evidence.push('Enemy has Shield Bar but team lacks shred mechanics (+0)');
      }
    } else {
      rawScore += 25;
    }
  } else {
    // Multi-target / mob wave encounter
    evidence.push(`Multi-target wave encounter (${facts.enemyCount} enemies across ${facts.waveCount} wave(s))`);
    if (report.hasCoordinatedAttack) {
      rawScore += 25;
      evidence.push('Coordinated attacks provide multi-target coverage (+25)');
    }
    const hasAoeTags = report.combatTagsPresent.some((t) =>
      t.toLowerCase().includes('aoe') || t.toLowerCase().includes('heavy attack')
    );
    if (hasAoeTags) {
      rawScore += 25;
      evidence.push('AOE combat tags accelerate wave clear (+25)');
    } else {
      rawScore += 15;
    }
  }

  rawScore = Math.min(Math.max(rawScore, 0), TEAM_SCORING_CONFIG.maxRawScore);
  const weight = TEAM_SCORING_CONFIG.weights.enemyMatchup;
  const weightedScore = Math.round((rawScore / TEAM_SCORING_CONFIG.maxRawScore) * weight);

  return {
    score: rawScore,
    maxScore: TEAM_SCORING_CONFIG.maxRawScore,
    weight,
    weightedScore,
    evidence,
  };
}
