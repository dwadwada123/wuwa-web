/**
 * Gameplay Effect Interpretation Layer
 *
 * Deterministically inspects abilities, weapons, echoes, and sonatas
 * to identify combat capabilities (Healing, Shield, Shred, Amplify, etc.).
 */

import type {
  GameplayEffect,
  GameplayEffectCategory,
  ResonatorBuild,
  TeamCandidate,
  RuleResult,
  Element,
} from '../../domain/types/index.ts';

export const RULE_EFFECT_HEALING = 'RULE_EFFECT_HEALING';
export const RULE_EFFECT_SHIELD = 'RULE_EFFECT_SHIELD';
export const RULE_EFFECT_RES_SHRED = 'RULE_EFFECT_RES_SHRED';
export const RULE_EFFECT_DEF_SHRED = 'RULE_EFFECT_DEF_SHRED';
export const RULE_EFFECT_DMG_AMPLIFY = 'RULE_EFFECT_DMG_AMPLIFY';
export const RULE_EFFECT_COORDINATED_ATTACK = 'RULE_EFFECT_COORDINATED_ATTACK';
export const RULE_EFFECT_RESOURCE_GRANT = 'RULE_EFFECT_RESOURCE_GRANT';

/**
 * Collects all gameplay effects associated with a single Resonator build.
 */
export function collectBuildEffects(build: ResonatorBuild): GameplayEffect[] {
  const effects: GameplayEffect[] = [];

  // 1. Ability effects
  for (const ability of build.resonator.abilities) {
    if (ability.effects && ability.effects.length > 0) {
      effects.push(...ability.effects);
    }
  }

  // 2. Weapon passive effect
  if (build.weapon?.passiveEffect) {
    effects.push(build.weapon.passiveEffect);
  }

  // 3. Echo skill effect
  if (build.echo?.skillEffect) {
    effects.push(build.echo.skillEffect);
  }

  // 4. Sonata set effects
  if (build.sonatas) {
    for (const sonata of build.sonatas) {
      if (sonata.twoPieceEffect) effects.push(sonata.twoPieceEffect);
      if (sonata.fivePieceEffect) effects.push(sonata.fivePieceEffect);
    }
  }

  return effects;
}

/**
 * Collects all gameplay effects across all members of a candidate team.
 */
export function collectTeamEffects(team: TeamCandidate): GameplayEffect[] {
  const allEffects: GameplayEffect[] = [];
  for (const member of team.members) {
    allEffects.push(...collectBuildEffects(member));
  }
  return allEffects;
}

/**
 * Checks if a collection of effects contains a specific category.
 */
export function hasEffectCategory(
  effects: GameplayEffect[],
  category: GameplayEffectCategory
): boolean {
  return effects.some((e) => e.category === category);
}

/**
 * Retrieves all effects matching a category.
 */
export function findEffectsByCategory(
  effects: GameplayEffect[],
  category: GameplayEffectCategory
): GameplayEffect[] {
  return effects.filter((e) => e.category === category);
}

/**
 * Extracts elemental resistance shred percentage for a given element.
 * Reads detailExpression from RES_SHRED effects.
 */
export function extractResShredValue(
  effects: GameplayEffect[],
  targetElement?: Element | 'Physical'
): number {
  let maxShred = 0;
  const resShredEffects = findEffectsByCategory(effects, 'RES_SHRED');

  for (const eff of resShredEffects) {
    const details = eff.detailExpression;
    if (!details) {
      // Default standard shred if category is present but unquantified
      maxShred = Math.max(maxShred, 0.10);
      continue;
    }

    const effElement = details.element as string | undefined;
    const isUniversal = !effElement || effElement.toUpperCase() === 'ALL';
    const isMatching = isUniversal || (targetElement && effElement.toLowerCase() === targetElement.toLowerCase());

    if (isMatching) {
      const ratio =
        typeof details.shred_ratio === 'number'
          ? details.shred_ratio
          : typeof details.ratio === 'number'
          ? details.ratio
          : typeof details.value === 'number'
          ? details.value
          : 0.10;
      maxShred = Math.max(maxShred, ratio);
    }
  }

  return maxShred;
}

export function teamHasHealing(team: TeamCandidate): boolean {
  return hasEffectCategory(collectTeamEffects(team), 'HEALING');
}

export function teamHasShield(team: TeamCandidate): boolean {
  return hasEffectCategory(collectTeamEffects(team), 'SHIELD');
}

export function teamHasDamageAmplify(team: TeamCandidate): boolean {
  return hasEffectCategory(collectTeamEffects(team), 'DMG_AMPLIFY');
}

export function teamHasResistanceShred(team: TeamCandidate): boolean {
  return hasEffectCategory(collectTeamEffects(team), 'RES_SHRED');
}

export function teamHasDefShred(team: TeamCandidate): boolean {
  return hasEffectCategory(collectTeamEffects(team), 'DEF_SHRED');
}

export function teamHasCoordinatedAttack(team: TeamCandidate): boolean {
  return hasEffectCategory(collectTeamEffects(team), 'COORDINATED_ATTACK');
}

export function teamHasResourceGrant(team: TeamCandidate): boolean {
  return hasEffectCategory(collectTeamEffects(team), 'RESOURCE_GRANT');
}

/**
 * Evaluates gameplay effect capabilities of a candidate team, producing structured facts.
 */
export function evaluateTeamCapabilities(team: TeamCandidate): RuleResult[] {
  const allEffects = collectTeamEffects(team);
  const results: RuleResult[] = [];

  const healing = hasEffectCategory(allEffects, 'HEALING');
  results.push({
    ruleId: RULE_EFFECT_HEALING,
    passed: healing,
    severity: 'INFO',
    reason: healing
      ? 'Team contains at least one source of healing.'
      : 'Team contains no healing sources.',
    evidence: [`hasHealing = ${healing}`],
  });

  const shield = hasEffectCategory(allEffects, 'SHIELD');
  results.push({
    ruleId: RULE_EFFECT_SHIELD,
    passed: shield,
    severity: 'INFO',
    reason: shield
      ? 'Team contains at least one source of shield.'
      : 'Team contains no shield sources.',
    evidence: [`hasShield = ${shield}`],
  });

  const resShred = hasEffectCategory(allEffects, 'RES_SHRED');
  results.push({
    ruleId: RULE_EFFECT_RES_SHRED,
    passed: resShred,
    severity: 'INFO',
    reason: resShred
      ? 'Team contains elemental resistance shredding ability.'
      : 'Team contains no resistance shred.',
    evidence: [`hasResShred = ${resShred}`],
  });

  const defShred = hasEffectCategory(allEffects, 'DEF_SHRED');
  results.push({
    ruleId: RULE_EFFECT_DEF_SHRED,
    passed: defShred,
    severity: 'INFO',
    reason: defShred
      ? 'Team provides DEF reduction.'
      : 'Team contains no DEF shred.',
    evidence: [`hasDefShred = ${defShred}`],
  });

  const dmgAmplify = hasEffectCategory(allEffects, 'DMG_AMPLIFY');
  results.push({
    ruleId: RULE_EFFECT_DMG_AMPLIFY,
    passed: dmgAmplify,
    severity: 'INFO',
    reason: dmgAmplify
      ? 'Team provides damage amplification bonuses.'
      : 'Team contains no damage amplify effects.',
    evidence: [`hasDamageAmplify = ${dmgAmplify}`],
  });

  const coordAttack = hasEffectCategory(allEffects, 'COORDINATED_ATTACK');
  results.push({
    ruleId: RULE_EFFECT_COORDINATED_ATTACK,
    passed: coordAttack,
    severity: 'INFO',
    reason: coordAttack
      ? 'Team provides coordinated attacks (off-field DPS).'
      : 'Team contains no coordinated attack mechanics.',
    evidence: [`hasCoordinatedAttack = ${coordAttack}`],
  });

  const resourceGrant = hasEffectCategory(allEffects, 'RESOURCE_GRANT');
  results.push({
    ruleId: RULE_EFFECT_RESOURCE_GRANT,
    passed: resourceGrant,
    severity: 'INFO',
    reason: resourceGrant
      ? 'Team provides energy/concerto/resource regeneration.'
      : 'Team contains no resource granting effects.',
    evidence: [`hasResourceGrant = ${resourceGrant}`],
  });

  return results;
}
