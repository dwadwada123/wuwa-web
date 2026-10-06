/**
 * Rules Engine Contract & Evaluation Types
 */

import type { PatchContext, Element } from './common.ts';
import type { OwnedRoster, EffectiveResistanceContext } from './team.ts';

export type RuleSeverity = 'HARD' | 'SOFT' | 'INFO';

export interface RuleResult {
  ruleId: string;
  passed: boolean;
  severity: RuleSeverity;
  score?: number;
  reason: string;
  evidence?: string[];
}

export interface RuleViolation {
  ruleId: string;
  severity: 'HARD' | 'SOFT';
  reason: string;
  evidence?: string[];
}

export interface RuleEvaluationContext {
  patchContext: PatchContext;
  roster: OwnedRoster;
}

export interface TeamValidationReport {
  isValid: boolean; // all HARD rules passed
  violations: RuleViolation[];
  results: RuleResult[];
  rolesPresent: string[];
  combatTagsPresent: string[];
  elementsPresent: Element[];
  hasHealing: boolean;
  hasShield: boolean;
  hasDamageAmplify: boolean;
  hasResistanceShred: boolean;
  hasDefShred: boolean;
  hasCoordinatedAttack: boolean;
  hasResourceGrant: boolean;
}

export interface MatchedStageBuff {
  areaEffectId: string;
  name: string;
  description: string;
  triggerCategory: string;
  reason: string;
  matchedByMemberIds: string[];
}

export interface UnmatchedStageBuff {
  areaEffectId: string;
  name: string;
  description: string;
  reason: string;
}

export interface StageBuffCompatibilityResult {
  benefited: boolean;
  matchedEffects: MatchedStageBuff[];
  unmatchedEffects: UnmatchedStageBuff[];
  results: RuleResult[];
}

export interface EnemyMatchupFacts {
  enemyCount: number;
  enemyElements: (Element | 'Physical')[];
  bossPresence: boolean;
  elitePresence: boolean;
  waveCount: number;
  effectiveResistanceContexts: EffectiveResistanceContext[];
  relevantTeamEffects: string[];
  results: RuleResult[];
}
