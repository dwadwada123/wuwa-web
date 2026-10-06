/**
 * Enemy Domain Model & Occurrence Instances
 */

import type { Element } from './common.ts';

export type EnemyClass = 'Common' | 'Elite' | 'Overlord' | 'Calamity';

export type ModifierType =
  | 'SHIELD_BAR'
  | 'ENRAGE_RESISTANCE'
  | 'DAMAGE_IMMUNITY'
  | 'STAT_SCALING';

export interface EnemyResistance {
  element: Element | 'Physical';
  resistanceRatio: number; // e.g. 0.20, 0.60
}

export interface EnemyModifier {
  modifierType: ModifierType;
  parameters: Record<string, unknown>;
  isActive: boolean;
}

export interface Enemy {
  id: string;
  name: string;
  code: string;
  enemyClass: EnemyClass;
  resistances: EnemyResistance[];
  modifiers: EnemyModifier[];
}

export interface EnemyInstance {
  id: string;
  enemy: Enemy;
  level: number;
  spawnOrder: number;
}
