/**
 * Team Validation Engine
 *
 * Deterministically validates 3-resonator team candidates against hard constraints
 * (team size, unique resonators, ownership, patch release, build validity)
 * and extracts structured combat capability facts.
 */

import type {
  TeamCandidate,
  RuleEvaluationContext,
  TeamValidationReport,
  RuleResult,
  RuleViolation,
} from '../../domain/types/index.ts';
import { evaluateBuildAvailability } from './availability.ts';
import {
  extractTeamRoles,
  extractTeamCombatTags,
  extractTeamElements,
  evaluateRoleBalance,
} from './roles-tags.ts';
import {
  evaluateTeamCapabilities,
  teamHasHealing,
  teamHasShield,
  teamHasDamageAmplify,
  teamHasResistanceShred,
  teamHasDefShred,
  teamHasCoordinatedAttack,
  teamHasResourceGrant,
} from './gameplay-effects.ts';

export const RULE_TEAM_SIZE = 'RULE_TEAM_SIZE';
export const RULE_NO_DUPLICATE_RESONATOR = 'RULE_NO_DUPLICATE_RESONATOR';

/**
 * Validates a candidate team against all deterministic hard and soft rules.
 */
export function validateTeam(
  team: TeamCandidate,
  context: RuleEvaluationContext
): TeamValidationReport {
  const allResults: RuleResult[] = [];
  const violations: RuleViolation[] = [];

  // 1. HARD RULE: Team size must be exactly 3
  const isSizeValid = team.members.length === 3;
  const sizeResult: RuleResult = {
    ruleId: RULE_TEAM_SIZE,
    passed: isSizeValid,
    severity: 'HARD',
    reason: isSizeValid
      ? 'Team contains exactly 3 resonators.'
      : `Team size invalid: expected 3 resonators, but got ${team.members.length}.`,
    evidence: [`team.size = ${team.members.length}`],
  };
  allResults.push(sizeResult);
  if (!isSizeValid) {
    violations.push({
      ruleId: sizeResult.ruleId,
      severity: sizeResult.severity as 'HARD',
      reason: sizeResult.reason,
      evidence: sizeResult.evidence,
    });
  }

  // 2. HARD RULE: No duplicate resonators
  const seenIds = new Set<string>();
  const duplicates: string[] = [];
  for (const member of team.members) {
    if (seenIds.has(member.resonator.id)) {
      duplicates.push(member.resonator.name);
    }
    seenIds.add(member.resonator.id);
  }
  const noDuplicates = duplicates.length === 0;
  const dupResult: RuleResult = {
    ruleId: RULE_NO_DUPLICATE_RESONATOR,
    passed: noDuplicates,
    severity: 'HARD',
    reason: noDuplicates
      ? 'All team members are distinct resonators.'
      : `Duplicate resonator(s) found in team: ${duplicates.join(', ')}.`,
    evidence: [`duplicates = [${duplicates.join(', ')}]`],
  };
  allResults.push(dupResult);
  if (!noDuplicates) {
    violations.push({
      ruleId: dupResult.ruleId,
      severity: dupResult.severity as 'HARD',
      reason: dupResult.reason,
      evidence: dupResult.evidence,
    });
  }

  // 3. HARD RULES: Individual member availability and build validity
  for (const member of team.members) {
    const memberResults = evaluateBuildAvailability(member, context);
    for (const res of memberResults) {
      allResults.push(res);
      if (!res.passed && (res.severity === 'HARD' || res.severity === 'SOFT')) {
        violations.push({
          ruleId: res.ruleId,
          severity: res.severity,
          reason: res.reason,
          evidence: res.evidence,
        });
      }
    }
  }

  // 4. SOFT RULES: Role composition balance
  const roleResults = evaluateRoleBalance(team);
  for (const res of roleResults) {
    allResults.push(res);
    if (!res.passed && res.severity === 'SOFT') {
      violations.push({
        ruleId: res.ruleId,
        severity: res.severity,
        reason: res.reason,
        evidence: res.evidence,
      });
    }
  }

  // 5. INFO / CAPABILITIES: Evaluate gameplay effect capabilities
  const capResults = evaluateTeamCapabilities(team);
  allResults.push(...capResults);

  // Determine overall validity (all HARD rules must pass)
  const hasHardViolation = violations.some((v) => v.severity === 'HARD');
  const isValid = !hasHardViolation;

  return {
    isValid,
    violations,
    results: allResults,
    rolesPresent: extractTeamRoles(team),
    combatTagsPresent: extractTeamCombatTags(team),
    elementsPresent: extractTeamElements(team),
    hasHealing: teamHasHealing(team),
    hasShield: teamHasShield(team),
    hasDamageAmplify: teamHasDamageAmplify(team),
    hasResistanceShred: teamHasResistanceShred(team),
    hasDefShred: teamHasDefShred(team),
    hasCoordinatedAttack: teamHasCoordinatedAttack(team),
    hasResourceGrant: teamHasResourceGrant(team),
  };
}
