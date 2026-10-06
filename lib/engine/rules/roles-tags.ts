/**
 * Functional Role and Combat Tag Evaluation
 *
 * Exposes normalized role/tag domain facts and checks team composition balance.
 */

import type {
  TeamCandidate,
  RuleResult,
  Element,
} from '../../domain/types/index.ts';

export const RULE_ROLE_BALANCE = 'RULE_ROLE_BALANCE';
export const RULE_TAG_SYNERGY = 'RULE_TAG_SYNERGY';

/**
 * Extracts all unique functional role codes present in a candidate team.
 */
export function extractTeamRoles(team: TeamCandidate): string[] {
  const roles = new Set<string>();
  for (const member of team.members) {
    for (const r of member.resonator.roles) {
      roles.add(r.code);
    }
  }
  return Array.from(roles);
}

/**
 * Extracts all unique combat tags present in a candidate team.
 */
export function extractTeamCombatTags(team: TeamCandidate): string[] {
  const tags = new Set<string>();
  for (const member of team.members) {
    for (const t of member.resonator.combatTags) {
      tags.add(t.code);
    }
  }
  return Array.from(tags);
}

/**
 * Extracts unique elements represented by the team members.
 */
export function extractTeamElements(team: TeamCandidate): Element[] {
  const elements = new Set<Element>();
  for (const member of team.members) {
    elements.add(member.resonator.element);
  }
  return Array.from(elements);
}

/**
 * Evaluates role composition balance (soft rule).
 */
export function evaluateRoleBalance(team: TeamCandidate): RuleResult[] {
  const results: RuleResult[] = [];
  const roles = extractTeamRoles(team);

  // Check for presence of DPS (Main DPS or Sub DPS)
  const hasDps = roles.some((r) => r.toUpperCase().includes('DPS'));
  // Check for presence of Support/Sustain
  const hasSupport = roles.some(
    (r) =>
      r.toUpperCase().includes('SUPPORT') ||
      r.toUpperCase().includes('HEAL') ||
      r.toUpperCase().includes('SHIELD')
  );

  const isBalanced = hasDps && hasSupport;

  results.push({
    ruleId: RULE_ROLE_BALANCE,
    passed: isBalanced,
    severity: 'SOFT',
    reason: isBalanced
      ? 'Team has balanced composition containing both damage dealers and support/sustain roles.'
      : !hasDps
      ? 'Team lacks a dedicated damage dealer (Main DPS or Sub DPS).'
      : 'Team lacks support or sustain (Healer, Shielder, or Buffer).',
    evidence: [
      `roles = [${roles.join(', ')}]`,
      `hasDps = ${hasDps}`,
      `hasSupport = ${hasSupport}`,
    ],
  });

  return results;
}
