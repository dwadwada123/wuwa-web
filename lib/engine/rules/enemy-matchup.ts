/**
 * Enemy Matchup Evaluator
 *
 * Deterministically analyzes stage enemy composition (bosses, elites, enemy count,
 * wave count, shield bars) and identifies relevant counter mechanics.
 */

import type {
  TeamCandidate,
  ToAStage,
  EnemyMatchupFacts,
  Element,
  RuleResult,
} from '../../domain/types/index.ts';
import { evaluateElementalMatchup } from './elemental-matchup.ts';
import {
  teamHasHealing,
  teamHasShield,
  teamHasResistanceShred,
  teamHasDefShred,
  teamHasCoordinatedAttack,
} from './gameplay-effects.ts';

export const RULE_ENEMY_MATCHUP_SUMMARY = 'RULE_ENEMY_MATCHUP_SUMMARY';
export const RULE_BOSS_SUSTAIN_CHECK = 'RULE_BOSS_SUSTAIN_CHECK';

/**
 * Extracts deterministic enemy encounter facts for a candidate team on a ToA stage.
 */
export function evaluateEnemyMatchup(
  team: TeamCandidate,
  stage: ToAStage
): EnemyMatchupFacts {
  let enemyCount = 0;
  let bossPresence = false;
  let elitePresence = false;
  let hasShieldBarModifier = false;
  const elementsSet = new Set<Element | 'Physical'>();

  for (const wave of stage.waves) {
    enemyCount += wave.enemyInstances.length;
    for (const inst of wave.enemyInstances) {
      const cls = inst.enemy.enemyClass;
      if (cls === 'Overlord' || cls === 'Calamity') {
        bossPresence = true;
      } else if (cls === 'Elite') {
        elitePresence = true;
      }

      if (inst.enemy.modifiers?.some((m) => m.modifierType === 'SHIELD_BAR' && m.isActive)) {
        hasShieldBarModifier = true;
      }

      if (inst.enemy.resistances) {
        for (const res of inst.enemy.resistances) {
          if (res.resistanceRatio >= 0.30) {
            elementsSet.add(res.element);
          }
        }
      }
    }
  }

  const waveCount = stage.waves.length;
  const enemyElements = Array.from(elementsSet);
  const effectiveResistanceContexts = evaluateElementalMatchup(team, stage);

  // Relevant team counters
  const relevantTeamEffects: string[] = [];
  if (bossPresence) {
    if (teamHasHealing(team)) relevantTeamEffects.push('Sustain: Healing vs Boss');
    if (teamHasShield(team)) relevantTeamEffects.push('Sustain: Shield vs Boss');
  }
  if (hasShieldBarModifier && (teamHasResistanceShred(team) || teamHasDefShred(team))) {
    relevantTeamEffects.push('Shred: Counter Shield Bar / Toughness');
  }
  if (enemyCount > 2 && teamHasCoordinatedAttack(team)) {
    relevantTeamEffects.push('Multi-Target: Coordinated Attacks');
  }

  const results: RuleResult[] = [];

  results.push({
    ruleId: RULE_ENEMY_MATCHUP_SUMMARY,
    passed: true,
    severity: 'INFO',
    reason: `Stage features ${enemyCount} enemy instance(s) across ${waveCount} wave(s) (Boss: ${bossPresence}, Elite: ${elitePresence}).`,
    evidence: [
      `enemyCount = ${enemyCount}`,
      `waveCount = ${waveCount}`,
      `bossPresence = ${bossPresence}`,
      `elitePresence = ${elitePresence}`,
      `hasShieldBar = ${hasShieldBarModifier}`,
    ],
  });

  // Soft rule: If boss presence and neither healing nor shield is present
  if (bossPresence && !teamHasHealing(team) && !teamHasShield(team)) {
    results.push({
      ruleId: RULE_BOSS_SUSTAIN_CHECK,
      passed: false,
      severity: 'SOFT',
      reason: 'Stage contains a boss encounter (Overlord/Calamity), but team contains neither healing nor shield sustain.',
      evidence: ['bossPresence = true', 'hasHealing = false', 'hasShield = false'],
    });
  }

  return {
    enemyCount,
    enemyElements,
    bossPresence,
    elitePresence,
    waveCount,
    effectiveResistanceContexts,
    relevantTeamEffects,
    results,
  };
}
