/**
 * Team Candidate & Owned Roster Domain Models
 */

import type { Resonator, ResonatorBuild } from './resonator.ts';
import type { Element, PatchContext } from './common.ts';
import type {
  TeamValidationReport,
  MatchedStageBuff,
  UnmatchedStageBuff,
} from './rules.ts';
import type { ToAStage } from './toa.ts';

export interface OwnedRoster {
  userId?: string;
  resonatorIds: string[];
  weaponIds?: string[];
  echoIds?: string[];
}

export interface TeamCandidate {
  id?: string;
  members: [ResonatorBuild, ResonatorBuild, ResonatorBuild] | ResonatorBuild[];
}

export interface EffectiveResistanceContext {
  element: Element | 'Physical';
  baseResistance: number;
  areaModifier: number;
  teamShred: number;
  effectiveResistance: number; // baseResistance + areaModifier - teamShred
  isAdvantaged: boolean; // effectiveResistance <= 0
  isDisadvantaged: boolean; // effectiveResistance >= 0.40
}

export interface CandidateStageFacts {
  stageId: string;
  patchId: string;
  benefited: boolean;
  matchedEffects: MatchedStageBuff[];
  unmatchedEffects: UnmatchedStageBuff[];
  effectiveResistanceContexts: EffectiveResistanceContext[];
  enemyCount: number;
  bossPresence: boolean;
  elitePresence: boolean;
  waveCount: number;
  relevantTeamEffects: string[];
}

export interface CandidateMetadata {
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
  stageFacts?: CandidateStageFacts;
}

export interface GeneratedTeamCandidate extends TeamCandidate {
  id: string; // canonical team key e.g. "res-jinhsi:res-verina:res-yangyang"
  canonicalKey: string;
  members: [ResonatorBuild, ResonatorBuild, ResonatorBuild];
  metadata: CandidateMetadata;
  validationReport: TeamValidationReport;
}

export interface TeamGenerationContext {
  patchContext: PatchContext;
  availableResonators: Resonator[] | Map<string, Resonator>;
  builds?: Map<string, ResonatorBuild> | ResonatorBuild[] | Record<string, ResonatorBuild>;
  stage?: ToAStage;
}
