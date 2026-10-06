/**
 * Team Candidate & Owned Roster Domain Models
 */

import type { ResonatorBuild } from './resonator.ts';
import type { Element } from './common.ts';

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
