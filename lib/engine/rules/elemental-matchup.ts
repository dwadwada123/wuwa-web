/**
 * Elemental Matchup Evaluator
 *
 * Deterministically calculates effective resistance contexts:
 * effectiveResistance = base enemy resistance + area modifier - team resistance shred.
 * Exposes matchup facts for all game elements without combat simulation.
 */

import type {
  Element,
  TeamCandidate,
  ToAStage,
  EffectiveResistanceContext,
  RuleResult,
} from '../../domain/types/index.ts';
import { collectTeamEffects, extractResShredValue } from './gameplay-effects.ts';

export const RULE_ELEMENTAL_MATCHUP = 'RULE_ELEMENTAL_MATCHUP';

const ALL_ELEMENTS: (Element | 'Physical')[] = [
  'Glacio',
  'Fusion',
  'Electro',
  'Aero',
  'Spectro',
  'Havoc',
  'Physical',
];

/**
 * Extracts stage area resistance modifier for a specific element.
 * E.g., if an area effect reduces Aero RES by 10%, areaModifier is -0.10.
 */
export function extractStageAreaResModifier(
  stage: ToAStage,
  element: Element | 'Physical'
): number {
  let modifier = 0;

  for (const areaEffect of stage.areaEffects) {
    const details = areaEffect.gameplayEffect?.detailExpression;
    if (details) {
      const targetEl = (details.element as string) || '';
      const isMatching =
        targetEl.toUpperCase() === 'ALL' ||
        targetEl.toLowerCase() === element.toLowerCase();

      if (isMatching) {
        if (typeof details.modifier === 'number') {
          modifier += details.modifier;
        } else if (typeof details.res_reduction === 'number') {
          modifier -= details.res_reduction;
        } else if (typeof details.res_shred === 'number') {
          modifier -= details.res_shred;
        }
      }
    } else if (areaEffect.description) {
      // Deterministic string parsing fallback for canonical descriptions
      // e.g. "Aero RES is reduced by 10%" -> -0.10
      const desc = areaEffect.description.toLowerCase();
      const elLower = element.toLowerCase();
      if (desc.includes(`${elLower} res`) || desc.includes(`${elLower} resistance`)) {
        const match = desc.match(/reduced by (\d+)%/);
        if (match) {
          const percent = parseFloat(match[1]);
          modifier -= percent / 100;
        }
        const increaseMatch = desc.match(/increased by (\d+)%/);
        if (increaseMatch) {
          const percent = parseFloat(increaseMatch[1]);
          modifier += percent / 100;
        }
      }
    }
  }

  return modifier;
}

/**
 * Finds the base resistance for an element among enemies in a stage.
 * If multiple enemies are present, returns the highest base resistance.
 * Default baseline in Wuthering Waves is 0.20 (20%) unless overridden.
 */
export function findStageBaseResistance(
  stage: ToAStage,
  element: Element | 'Physical'
): number {
  let maxRes = 0.20; // Default base in Wuthering Waves
  let found = false;

  for (const wave of stage.waves) {
    for (const inst of wave.enemyInstances) {
      const resRecord = inst.enemy.resistances?.find(
        (r) => r.element.toLowerCase() === element.toLowerCase()
      );
      if (resRecord) {
        maxRes = found ? Math.max(maxRes, resRecord.resistanceRatio) : resRecord.resistanceRatio;
        found = true;
      }
    }
  }

  return maxRes;
}

/**
 * Computes deterministic effective resistance contexts for all elements in a stage.
 */
export function evaluateElementalMatchup(
  team: TeamCandidate,
  stage: ToAStage
): EffectiveResistanceContext[] {
  const teamEffects = collectTeamEffects(team);
  const contexts: EffectiveResistanceContext[] = [];

  for (const element of ALL_ELEMENTS) {
    const baseResistance = findStageBaseResistance(stage, element);
    const areaModifier = extractStageAreaResModifier(stage, element);
    const teamShred = extractResShredValue(teamEffects, element);

    // Formula: effectiveResistance = baseResistance + areaModifier - teamShred
    const rawEffective = baseResistance + areaModifier - teamShred;
    // Round to 4 decimal places for deterministic float stability
    const effectiveResistance = Math.round(rawEffective * 10000) / 10000;

    contexts.push({
      element,
      baseResistance,
      areaModifier,
      teamShred,
      effectiveResistance,
      isAdvantaged: effectiveResistance <= 0.05,
      isDisadvantaged: effectiveResistance >= 0.40,
    });
  }

  return contexts;
}

/**
 * Produces RuleResults evaluating the elemental matchup of the candidate team against the stage.
 */
export function evaluateTeamElementalRules(
  team: TeamCandidate,
  stage: ToAStage
): RuleResult[] {
  const contexts = evaluateElementalMatchup(team, stage);
  const results: RuleResult[] = [];

  // Inspect elements actually used by the team
  const teamElements = new Set(team.members.map((m) => m.resonator.element));

  for (const el of teamElements) {
    const match = contexts.find((c) => c.element === el);
    if (!match) continue;

    if (match.isDisadvantaged) {
      results.push({
        ruleId: RULE_ELEMENTAL_MATCHUP,
        passed: false,
        severity: 'SOFT',
        reason: `Team element "${el}" faces high effective enemy resistance (${(match.effectiveResistance * 100).toFixed(0)}%) in this stage.`,
        evidence: [
          `element = ${el}`,
          `baseResistance = ${match.baseResistance}`,
          `areaModifier = ${match.areaModifier}`,
          `teamShred = ${match.teamShred}`,
          `effectiveResistance = ${match.effectiveResistance}`,
        ],
      });
    } else if (match.isAdvantaged) {
      results.push({
        ruleId: RULE_ELEMENTAL_MATCHUP,
        passed: true,
        severity: 'INFO',
        reason: `Team element "${el}" enjoys a favorable resistance matchup (${(match.effectiveResistance * 100).toFixed(0)}%) due to buffs/shred.`,
        evidence: [
          `element = ${el}`,
          `effectiveResistance = ${match.effectiveResistance}`,
        ],
      });
    }
  }

  return results;
}
