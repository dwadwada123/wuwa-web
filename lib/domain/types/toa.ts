/**
 * Tower of Adversity Domain Models: Cycle, Tower, Stage, AreaEffect, ChallengeGoal
 */

import type { GameplayEffect } from './gameplay-effects.ts';
import type { EnemyInstance } from './enemy.ts';

export interface AreaEffect {
  id: string;
  sourceId: string;
  name: string;
  description: string;
  gameplayEffect: GameplayEffect;
}

export interface ChallengeGoal {
  id: string;
  goalOrder: number;
  targetTimeSeconds: number; // >= 0, where 0 is completion-only
  points: number;
}

export interface ToAWave {
  id: string;
  waveIndex: number;
  enemyInstances: EnemyInstance[];
}

export interface ToAStage {
  id: string;
  patchId: string;
  stageIndex: number;
  vigorCost: number;
  areaEffects: AreaEffect[];
  challengeGoals: ChallengeGoal[];
  waves: ToAWave[];
}

export interface ToATower {
  id: string;
  towerName: string;
  towerOrder: number;
  stages: ToAStage[];
}

export interface ToACycle {
  id: string;
  patchId: string;
  cycleName: string;
  startTime: string;
  endTime: string;
  towers: ToATower[];
}
