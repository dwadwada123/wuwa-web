/**
 * ToA Stage Buff Compatibility Evaluator
 *
 * Deterministically checks whether a candidate team benefits from stage area effects
 * (e.g. Elemental RES reductions, Shield triggers, Intro Skill bonuses, etc.).
 */

import type {
  TeamCandidate,
  ToAStage,
  AreaEffect,
  StageBuffCompatibilityResult,
  MatchedStageBuff,
  UnmatchedStageBuff,
  RuleResult,
  Element,
} from '../../domain/types/index.ts';
import {
  collectBuildEffects,
  teamHasShield,
  teamHasHealing,
  teamHasCoordinatedAttack,
  teamHasResistanceShred,
  teamHasDefShred,
} from './gameplay-effects.ts';

export const RULE_STAGE_BUFF_COMPATIBILITY = 'RULE_STAGE_BUFF_COMPATIBILITY';

const ELEMENTS: Element[] = ['Glacio', 'Fusion', 'Electro', 'Aero', 'Spectro', 'Havoc'];

/**
 * Evaluates whether a candidate team can activate or benefit from each area effect in a stage.
 */
export function evaluateStageBuffCompatibility(
  team: TeamCandidate,
  stage: ToAStage
): StageBuffCompatibilityResult {
  const matchedEffects: MatchedStageBuff[] = [];
  const unmatchedEffects: UnmatchedStageBuff[] = [];

  const teamElements = team.members.map((m) => m.resonator.element);

  for (const areaEffect of stage.areaEffects) {
    const text = `${areaEffect.name} ${areaEffect.description}`.toLowerCase();
    const details = areaEffect.gameplayEffect?.detailExpression || {};
    const category = areaEffect.gameplayEffect?.category;

    let isMatched = false;
    let triggerCategory = 'GENERAL_BUFF';
    let reason = '';
    const matchedMemberIds: string[] = [];

    // 1. Elemental buffs / reductions (e.g. "Aero RES reduced by 10%" or "Fusion DMG increased")
    const matchedElement = ELEMENTS.find(
      (el) =>
        text.includes(el.toLowerCase()) ||
        (typeof details.element === 'string' &&
          details.element.toLowerCase() === el.toLowerCase())
    );

    if (matchedElement) {
      triggerCategory = 'ELEMENTAL_AFFINITY';
      const matchingMembers = team.members.filter(
        (m) => m.resonator.element === matchedElement
      );

      if (matchingMembers.length > 0) {
        isMatched = true;
        reason = `Team contains ${matchingMembers.length} ${matchedElement} resonator(s) benefiting from ${matchedElement} buff/reduction.`;
        matchedMemberIds.push(...matchingMembers.map((m) => m.resonator.id));
      } else {
        isMatched = false;
        reason = `Stage provides ${matchedElement} bonus/reduction, but team has no ${matchedElement} resonators.`;
      }
    }
    // 2. Shield-triggered bonuses (e.g. "When obtaining a shield...")
    else if (text.includes('shield') || category === 'SHIELD') {
      triggerCategory = 'SHIELD';
      if (teamHasShield(team)) {
        isMatched = true;
        const shielderMembers = team.members.filter((m) =>
          collectBuildEffects(m).some((e) => e.category === 'SHIELD')
        );
        matchedMemberIds.push(...shielderMembers.map((m) => m.resonator.id));
        reason = 'Team includes a shielder capable of triggering the stage shield condition.';
      } else {
        isMatched = false;
        reason = 'Stage rewards shield mechanics, but team contains no source of shields.';
      }
    }
    // 3. Intro Skill triggered bonuses
    else if (text.includes('intro skill') || text.includes('intro')) {
      triggerCategory = 'INTRO_SKILL';
      // In Wuthering Waves, standard team rotations naturally trigger Intro Skills via Concerto
      isMatched = true;
      matchedMemberIds.push(...team.members.map((m) => m.resonator.id));
      reason = 'Team utilizes Concerto rotations to trigger stage Intro Skill bonuses.';
    }
    // 4. Coordinated attack bonuses
    else if (text.includes('coordinated attack') || category === 'COORDINATED_ATTACK') {
      triggerCategory = 'COORDINATED_ATTACK';
      if (teamHasCoordinatedAttack(team)) {
        isMatched = true;
        const coordMembers = team.members.filter((m) =>
          collectBuildEffects(m).some((e) => e.category === 'COORDINATED_ATTACK')
        );
        matchedMemberIds.push(...coordMembers.map((m) => m.resonator.id));
        reason = 'Team features off-field coordinated attacks that benefit from stage buffs.';
      } else {
        isMatched = false;
        reason = 'Stage rewards coordinated attacks, but team has no coordinated attack mechanics.';
      }
    }
    // 5. Negative status / Debuff amplification
    else if (
      text.includes('negative status') ||
      text.includes('attribute bane') ||
      text.includes('debuff') ||
      category === 'RES_SHRED' ||
      category === 'DEF_SHRED'
    ) {
      triggerCategory = 'NEGATIVE_STATUS';
      const hasDebuff = teamHasResistanceShred(team) || teamHasDefShred(team);
      if (hasDebuff) {
        isMatched = true;
        const debuffMembers = team.members.filter((m) =>
          collectBuildEffects(m).some(
            (e) => e.category === 'RES_SHRED' || e.category === 'DEF_SHRED'
          )
        );
        matchedMemberIds.push(...debuffMembers.map((m) => m.resonator.id));
        reason = 'Team applies defense or resistance reduction, benefiting from debuff amplification.';
      } else {
        isMatched = false;
        reason = 'Stage enhances negative status / debuffs, but team applies neither RES nor DEF shred.';
      }
    }
    // 6. Universal combat buffs (e.g. general ATK, Crit, Resonance Liberation)
    else {
      triggerCategory = 'UNIVERSAL_BUFF';
      isMatched = true;
      matchedMemberIds.push(...team.members.map((m) => m.resonator.id));
      reason = 'Stage provides universal combat enhancements that benefit all active team members.';
    }

    if (isMatched) {
      matchedEffects.push({
        areaEffectId: areaEffect.id,
        name: areaEffect.name,
        description: areaEffect.description,
        triggerCategory,
        reason,
        matchedByMemberIds: matchedMemberIds,
      });
    } else {
      unmatchedEffects.push({
        areaEffectId: areaEffect.id,
        name: areaEffect.name,
        description: areaEffect.description,
        reason,
      });
    }
  }

  const benefited = matchedEffects.length > 0;
  const results: RuleResult[] = [];

  results.push({
    ruleId: RULE_STAGE_BUFF_COMPATIBILITY,
    passed: benefited,
    severity: stage.areaEffects.length > 0 && !benefited ? 'SOFT' : 'INFO',
    reason: benefited
      ? `Team benefits from ${matchedEffects.length} active stage area effect(s).`
      : stage.areaEffects.length === 0
      ? 'Stage has no active area effects.'
      : 'Team cannot trigger or benefit from any active stage buffs.',
    evidence: [
      `totalEffects = ${stage.areaEffects.length}`,
      `matchedCount = ${matchedEffects.length}`,
      `unmatchedCount = ${unmatchedEffects.length}`,
    ],
  });

  return {
    benefited,
    matchedEffects,
    unmatchedEffects,
    results,
  };
}
