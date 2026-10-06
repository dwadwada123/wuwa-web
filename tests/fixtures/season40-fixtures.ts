/**
 * Canonical Patch 3.7 Season 40 ToA Stage Fixtures
 *
 * Grounded in canonical data/patches/3.7/patch_3_7_dataset.json.
 * Represents all 6 required regression stages across Resonant, Hazard, and Echoing towers.
 */

import type { ToAStage, AreaEffect, Enemy, GameplayEffect } from '../../lib/domain/types/index.ts';

const patchId = 'patch-3-7-uuid';

// Canonical Area Effects
export const areaEffectResonantAeroShred: AreaEffect = {
  id: 'area-92007113',
  sourceId: '92007113',
  name: 'Resonant Tower Aero Shred',
  description: 'Enemy Aero RES decreases by 10%',
  gameplayEffect: {
    id: 'ge-92007113',
    patchId,
    category: 'RES_SHRED',
    target: 'ENEMY',
    detailExpression: { element: 'Aero', res_shred: 0.1 },
  },
};

export const areaEffectResonantDefIgnore: AreaEffect = {
  id: 'area-92008110',
  sourceId: '92008110',
  name: 'Resonant Tower DEF Ignore & Negative Status Amp',
  description: "Resonators ignore 25% of the enemy's DEF when dealing damage. When enemies are affected by Negative Statuses, their DMG taken is Amplified by 20%.",
  gameplayEffect: {
    id: 'ge-92008110',
    patchId,
    category: 'DEF_SHRED',
    target: 'ENEMY',
    detailExpression: { def_ignore: 0.25, negative_status_dmg_amplify: 0.2 },
  },
};

export const areaEffectHazardElectroFusionShred: AreaEffect = {
  id: 'area-92007152',
  sourceId: '92007152',
  name: 'Hazard Tower Electro/Fusion RES Shred & Havoc/Glacio RES Up',
  description: "Enemies' Electro RES and Fusion RES are decreased by 10%, and their Havoc RES and Glacio RES are increased by 10%.",
  gameplayEffect: {
    id: 'ge-92007152',
    patchId,
    category: 'RES_SHRED',
    target: 'ENEMY',
    detailExpression: {
      electro_res_shred: 0.1,
      fusion_res_shred: 0.1,
      havoc_res_increase: 0.1,
      glacio_res_increase: 0.1,
    },
  },
};

export const areaEffectHazardAtkIntroBuff: AreaEffect = {
  id: 'area-92008195',
  sourceId: '92008195',
  name: 'Hazard Tower ATK & Intro All DMG Buff',
  description: 'ATK is increased by 30%. Resonators gain 30% All DMG Bonus for 10s upon casting Intro Skill.',
  gameplayEffect: {
    id: 'ge-92008195',
    patchId,
    category: 'STAT_BUFF',
    target: 'TEAM',
    detailExpression: { atk_percent: 0.3, intro_all_dmg_bonus: 0.3, intro_duration_seconds: 10 },
  },
};

export const areaEffectHazardRampTotalDmg: AreaEffect = {
  id: 'area-92008205',
  sourceId: '92008205',
  name: 'Hazard Tower Ramp Total DMG',
  description: "60s after the battle starts, after a Resonator's attacks hit an enemy, that enemy takes 5% more total DMG. This value increases by 5% every 5s, up to a maximum of 60%.",
  gameplayEffect: {
    id: 'ge-92008205',
    patchId,
    category: 'DMG_AMPLIFY',
    target: 'ENEMY',
    detailExpression: { delay_seconds: 60, ramp_per_5s: 0.05, max_total_dmg_amp: 0.6 },
  },
};

export const areaEffectHazardAllResIncrease: AreaEffect = {
  id: 'area-92008196',
  sourceId: '92008196',
  name: 'Hazard Tower All-Attribute RES Increase',
  description: "Enemies' All-Attribute RES is increased by 15%. The Electro or Fusion DMG taken by the enemies are not effected by this effect.",
  gameplayEffect: {
    id: 'ge-92008196',
    patchId,
    category: 'RES_SHRED',
    target: 'ENEMY',
    detailExpression: { all_res_increase_except_electro_fusion: 0.15 },
  },
};

export const areaEffectHazardElectroShieldFusionAmp: AreaEffect = {
  id: 'area-92008197',
  sourceId: '92008197',
  name: 'Hazard Tower Total & Electro DMG / Shield Fusion Amp',
  description: 'Enemies take 20% more total DMG and 50% more total Electro DMG. Resonators gain 12% Fusion DMG Bonus for 3s upon gaining Shield, stacking up to 10 times.',
  gameplayEffect: {
    id: 'ge-92008197',
    patchId,
    category: 'DMG_AMPLIFY',
    target: 'TEAM',
    detailExpression: { total_dmg_amp: 0.2, electro_total_dmg_amp: 0.5, shield_fusion_dmg_bonus: 0.12 },
  },
};

export const areaEffectEchoingHavocShred: AreaEffect = {
  id: 'area-92007115',
  sourceId: '92007115',
  name: 'Echoing Tower Havoc RES Shred',
  description: 'Enemy Havoc RES decreases by 10%',
  gameplayEffect: {
    id: 'ge-92007115',
    patchId,
    category: 'RES_SHRED',
    target: 'ENEMY',
    detailExpression: { element: 'Havoc', res_shred: 0.1 },
  },
};

export const areaEffectEchoingIntroSkillBuff: AreaEffect = {
  id: 'area-92008030',
  sourceId: '92008030',
  name: 'Echoing Tower Intro ATK & Skill Liberation Buff',
  description: 'Casting Intro Skill increases ATK by 20% for 15s. Casting Resonance Skill grants 30% Resonance Liberation DMG Bonus for 5s.',
  gameplayEffect: {
    id: 'ge-92008030',
    patchId,
    category: 'STAT_BUFF',
    target: 'TEAM',
    detailExpression: { intro_atk_percent: 0.2, skill_liberation_dmg_bonus: 0.3 },
  },
};

// Canonical Bosses & Enemies
export const mechAbominationBoss: Enemy = {
  id: 'en-mech-abom',
  name: 'Mech Abomination',
  code: 'MECH_ABOMINATION',
  enemyClass: 'Overlord',
  resistances: [
    { element: 'Electro', resistanceRatio: 0.40 },
    { element: 'Aero', resistanceRatio: 0.20 },
    { element: 'Spectro', resistanceRatio: 0.20 },
    { element: 'Glacio', resistanceRatio: 0.20 },
    { element: 'Fusion', resistanceRatio: 0.20 },
    { element: 'Havoc', resistanceRatio: 0.20 },
    { element: 'Physical', resistanceRatio: 0.20 },
  ],
  modifiers: [{ modifierType: 'SHIELD_BAR', parameters: {}, isActive: true }],
};

export const impermanenceHeronBoss: Enemy = {
  id: 'en-heron',
  name: 'Impermanence Heron',
  code: 'IMPERMANENCE_HERON',
  enemyClass: 'Overlord',
  resistances: [
    { element: 'Havoc', resistanceRatio: 0.40 },
    { element: 'Electro', resistanceRatio: 0.20 },
    { element: 'Fusion', resistanceRatio: 0.20 },
    { element: 'Aero', resistanceRatio: 0.20 },
    { element: 'Spectro', resistanceRatio: 0.20 },
    { element: 'Glacio', resistanceRatio: 0.20 },
    { element: 'Physical', resistanceRatio: 0.20 },
  ],
  modifiers: [],
};

export const fallacyOfNoReturnBoss: Enemy = {
  id: 'en-fallacy',
  name: 'Fallacy of No Return',
  code: 'FALLACY_OF_NO_RETURN',
  enemyClass: 'Overlord',
  resistances: [
    { element: 'Spectro', resistanceRatio: 0.40 },
    { element: 'Electro', resistanceRatio: 0.20 },
    { element: 'Fusion', resistanceRatio: 0.20 },
    { element: 'Aero', resistanceRatio: 0.20 },
    { element: 'Havoc', resistanceRatio: 0.20 },
    { element: 'Glacio', resistanceRatio: 0.20 },
    { element: 'Physical', resistanceRatio: 0.20 },
  ],
  modifiers: [{ modifierType: 'SHIELD_BAR', parameters: {}, isActive: true }],
};

export const lampylumenMyriadBoss: Enemy = {
  id: 'en-lampylumen',
  name: 'Lampylumen Myriad',
  code: 'LAMPYLUMEN_MYRIAD',
  enemyClass: 'Overlord',
  resistances: [
    { element: 'Glacio', resistanceRatio: 0.40 },
    { element: 'Electro', resistanceRatio: 0.20 },
    { element: 'Fusion', resistanceRatio: 0.20 },
    { element: 'Aero', resistanceRatio: 0.20 },
    { element: 'Havoc', resistanceRatio: 0.20 },
    { element: 'Spectro', resistanceRatio: 0.20 },
    { element: 'Physical', resistanceRatio: 0.20 },
  ],
  modifiers: [{ modifierType: 'SHIELD_BAR', parameters: {}, isActive: true }],
};

export const commonDrakeEnemy: Enemy = {
  id: 'en-drake',
  name: 'Electro Drake',
  code: 'ELECTRO_DRAKE',
  enemyClass: 'Common',
  resistances: [
    { element: 'Electro', resistanceRatio: 0.40 },
    { element: 'Aero', resistanceRatio: 0.20 },
    { element: 'Fusion', resistanceRatio: 0.20 },
  ],
  modifiers: [],
};

// 6 Canonical Season 40 Stages
export const resonantTowerFloor1: ToAStage = {
  id: 'toa-resonant-floor-1',
  patchId,
  stageIndex: 1,
  vigorCost: 1,
  areaEffects: [areaEffectResonantAeroShred, areaEffectResonantDefIgnore],
  challengeGoals: [{ id: 'cg-1', goalOrder: 1, targetTimeSeconds: 150, points: 1 }],
  waves: [
    {
      id: 'w-1',
      waveIndex: 1,
      enemyInstances: [{ id: 'inst-1', level: 70, spawnOrder: 1, enemy: commonDrakeEnemy }],
    },
  ],
};

export const resonantTowerFloor4: ToAStage = {
  id: 'toa-resonant-floor-4',
  patchId,
  stageIndex: 4,
  vigorCost: 4,
  areaEffects: [areaEffectResonantAeroShred, areaEffectResonantDefIgnore],
  challengeGoals: [{ id: 'cg-4', goalOrder: 1, targetTimeSeconds: 180, points: 1 }],
  waves: [
    {
      id: 'w-4',
      waveIndex: 1,
      enemyInstances: [{ id: 'inst-4', level: 90, spawnOrder: 1, enemy: mechAbominationBoss }],
    },
  ],
};

export const hazardTowerFloor1: ToAStage = {
  id: 'toa-hazard-floor-1',
  patchId,
  stageIndex: 1,
  vigorCost: 5,
  areaEffects: [areaEffectHazardElectroFusionShred, areaEffectHazardAtkIntroBuff],
  challengeGoals: [{ id: 'cg-h1', goalOrder: 1, targetTimeSeconds: 180, points: 1 }],
  waves: [
    {
      id: 'w-h1',
      waveIndex: 1,
      enemyInstances: [{ id: 'inst-h1', level: 100, spawnOrder: 1, enemy: impermanenceHeronBoss }],
    },
  ],
};

export const hazardTowerFloor3: ToAStage = {
  id: 'toa-hazard-floor-3',
  patchId,
  stageIndex: 3,
  vigorCost: 5,
  areaEffects: [
    areaEffectHazardRampTotalDmg,
    areaEffectHazardAllResIncrease,
    areaEffectHazardElectroShieldFusionAmp,
  ],
  challengeGoals: [{ id: 'cg-h3', goalOrder: 1, targetTimeSeconds: 150, points: 1 }],
  waves: [
    {
      id: 'w-h3',
      waveIndex: 1,
      enemyInstances: [{ id: 'inst-h3', level: 100, spawnOrder: 1, enemy: fallacyOfNoReturnBoss }],
    },
  ],
};

export const echoingTowerFloor1: ToAStage = {
  id: 'toa-echoing-floor-1',
  patchId,
  stageIndex: 1,
  vigorCost: 1,
  areaEffects: [areaEffectEchoingHavocShred, areaEffectEchoingIntroSkillBuff],
  challengeGoals: [{ id: 'cg-e1', goalOrder: 1, targetTimeSeconds: 150, points: 1 }],
  waves: [
    {
      id: 'w-e1',
      waveIndex: 1,
      enemyInstances: [{ id: 'inst-e1', level: 70, spawnOrder: 1, enemy: commonDrakeEnemy }],
    },
  ],
};

export const echoingTowerFloor4: ToAStage = {
  id: 'toa-echoing-floor-4',
  patchId,
  stageIndex: 4,
  vigorCost: 4,
  areaEffects: [areaEffectEchoingHavocShred, areaEffectEchoingIntroSkillBuff],
  challengeGoals: [{ id: 'cg-e4', goalOrder: 1, targetTimeSeconds: 180, points: 1 }],
  waves: [
    {
      id: 'w-e4',
      waveIndex: 1,
      enemyInstances: [{ id: 'inst-e4', level: 90, spawnOrder: 1, enemy: lampylumenMyriadBoss }],
    },
  ],
};

export const allSeason40Stages = [
  resonantTowerFloor1,
  resonantTowerFloor4,
  hazardTowerFloor1,
  hazardTowerFloor3,
  echoingTowerFloor1,
  echoingTowerFloor4,
];
