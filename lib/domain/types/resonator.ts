/**
 * Resonator Domain Model & Build Configuration
 */

import type { Element, WeaponType, Rarity } from './common.ts';
import type { GameplayEffect } from './gameplay-effects.ts';
import type { Weapon, Echo, Sonata } from './equipment.ts';

export interface FunctionalRole {
  code: string;
  label: string;
  isPrimary: boolean;
}

export interface CombatTag {
  code: string;
  label: string;
}

export interface ResonatorAbility {
  code: string;
  category: string;
  name: string;
  cooldownSeconds?: number | null;
  energyCost?: number | null;
  concertosGenerated: number;
  effects: GameplayEffect[];
}

export interface Resonator {
  id: string;
  name: string;
  element: Element;
  weaponType: WeaponType;
  rarity: Rarity;
  releaseDate: string; // ISO date 'YYYY-MM-DD'
  baseHpLvl90: number;
  baseAtkLvl90: number;
  baseDefLvl90: number;
  roles: FunctionalRole[];
  combatTags: CombatTag[];
  abilities: ResonatorAbility[];
}

export interface ResonatorBuild {
  resonator: Resonator;
  weapon?: Weapon | null;
  echo?: Echo | null;
  sonatas?: Sonata[];
  level?: number;
  waveband?: number;
}
