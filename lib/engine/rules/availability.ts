/**
 * Resonator and Build Availability Rules
 *
 * Evaluates resonator ownership, patch release availability,
 * and build/equipment compatibility deterministically.
 */

import type {
  Resonator,
  ResonatorBuild,
  RuleEvaluationContext,
  RuleResult,
} from '../../domain/types/index.ts';

export const RULE_RESONATOR_OWNED = 'RULE_RESONATOR_OWNED';
export const RULE_RESONATOR_RELEASED = 'RULE_RESONATOR_RELEASED';
export const RULE_BUILD_WEAPON_OWNED = 'RULE_BUILD_WEAPON_OWNED';
export const RULE_BUILD_WEAPON_TYPE_MATCH = 'RULE_BUILD_WEAPON_TYPE_MATCH';
export const RULE_BUILD_ECHO_OWNED = 'RULE_BUILD_ECHO_OWNED';

/**
 * Evaluates whether a Resonator is owned and available in the current patch context.
 */
export function evaluateResonatorAvailability(
  resonator: Resonator,
  context: RuleEvaluationContext
): RuleResult[] {
  const results: RuleResult[] = [];

  // 1. Ownership check
  const isOwned = context.roster.resonatorIds.includes(resonator.id);
  results.push({
    ruleId: RULE_RESONATOR_OWNED,
    passed: isOwned,
    severity: 'HARD',
    reason: isOwned
      ? `Resonator "${resonator.name}" is owned in the active roster.`
      : `Resonator "${resonator.name}" is not owned in the active roster.`,
    evidence: [
      `resonator.id = ${resonator.id}`,
      `roster.resonatorCount = ${context.roster.resonatorIds.length}`,
      `owned = ${isOwned}`,
    ],
  });

  // 2. Patch release availability check
  const snapshotDate = context.patchContext.snapshotDate;
  if (snapshotDate && resonator.releaseDate) {
    const isReleased = resonator.releaseDate <= snapshotDate;
    results.push({
      ruleId: RULE_RESONATOR_RELEASED,
      passed: isReleased,
      severity: 'HARD',
      reason: isReleased
        ? `Resonator "${resonator.name}" release date (${resonator.releaseDate}) is available on or before snapshot date (${snapshotDate}).`
        : `Resonator "${resonator.name}" release date (${resonator.releaseDate}) is after snapshot date (${snapshotDate}). Unreleased in this snapshot.`,
      evidence: [
        `resonator.releaseDate = ${resonator.releaseDate}`,
        `snapshotDate = ${snapshotDate}`,
        `released = ${isReleased}`,
      ],
    });
  } else {
    results.push({
      ruleId: RULE_RESONATOR_RELEASED,
      passed: true,
      severity: 'HARD',
      reason: `Resonator "${resonator.name}" is available in patch ${context.patchContext.version}.`,
      evidence: [`patch = ${context.patchContext.version}`],
    });
  }

  return results;
}

/**
 * Evaluates a specific Resonator build (loadout) for ownership and equipment compatibility.
 */
export function evaluateBuildAvailability(
  build: ResonatorBuild,
  context: RuleEvaluationContext
): RuleResult[] {
  const results = evaluateResonatorAvailability(build.resonator, context);

  // Weapon compatibility
  if (build.weapon) {
    const weaponTypeMatch = build.weapon.weaponType === build.resonator.weaponType;
    results.push({
      ruleId: RULE_BUILD_WEAPON_TYPE_MATCH,
      passed: weaponTypeMatch,
      severity: 'HARD',
      reason: weaponTypeMatch
        ? `Weapon "${build.weapon.name}" (${build.weapon.weaponType}) matches resonator weapon type.`
        : `Weapon type mismatch: "${build.weapon.name}" is a ${build.weapon.weaponType}, but "${build.resonator.name}" requires a ${build.resonator.weaponType}.`,
      evidence: [
        `weapon.type = ${build.weapon.weaponType}`,
        `resonator.type = ${build.resonator.weaponType}`,
      ],
    });

    if (context.roster.weaponIds && context.roster.weaponIds.length > 0) {
      const isWeaponOwned = context.roster.weaponIds.includes(build.weapon.id);
      results.push({
        ruleId: RULE_BUILD_WEAPON_OWNED,
        passed: isWeaponOwned,
        severity: 'HARD',
        reason: isWeaponOwned
          ? `Weapon "${build.weapon.name}" is owned.`
          : `Weapon "${build.weapon.name}" is not owned in the active roster.`,
        evidence: [`weapon.id = ${build.weapon.id}`, `owned = ${isWeaponOwned}`],
      });
    }
  }

  // Echo compatibility
  if (build.echo && context.roster.echoIds && context.roster.echoIds.length > 0) {
    const isEchoOwned = context.roster.echoIds.includes(build.echo.id);
    results.push({
      ruleId: RULE_BUILD_ECHO_OWNED,
      passed: isEchoOwned,
      severity: 'HARD',
      reason: isEchoOwned
        ? `Echo "${build.echo.name}" is owned.`
        : `Echo "${build.echo.name}" is not owned in the active roster.`,
      evidence: [`echo.id = ${build.echo.id}`, `owned = ${isEchoOwned}`],
    });
  }

  return results;
}
