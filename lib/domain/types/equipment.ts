/**
 * Equipment Domain Models: Weapon, Echo, Sonata
 */

import type { WeaponType, Rarity } from './common.ts';
import type { GameplayEffect } from './gameplay-effects.ts';

export interface Weapon {
  id: string;
  name: string;
  weaponType: WeaponType;
  rarity: Rarity;
  baseAtkLvl90: number;
  subStatType: string;
  subStatValueLvl90: number;
  passiveEffect?: GameplayEffect | null;
}

export type EchoClassType = 'Calamity' | 'Overlord' | 'Elite' | 'Common';
export type EchoCost = 1 | 3 | 4;

export interface Echo {
  id: string;
  name: string;
  classType: EchoClassType;
  cost: EchoCost;
  cdSeconds?: number;
  concertosGenerated?: number;
  skillEffect?: GameplayEffect | null;
}

export interface Sonata {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  twoPieceEffect?: GameplayEffect | null;
  fivePieceEffect?: GameplayEffect | null;
}
