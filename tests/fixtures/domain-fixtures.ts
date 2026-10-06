/**
 * In-Memory Domain Fixtures for Unit Testing
 *
 * Deterministic test data representing characters, weapons, echoes,
 * enemies, and ToA stages across Patch 3.6 and Patch 3.7.
 */

import type {
  PatchContext,
  Resonator,
  ResonatorBuild,
  Weapon,
  Echo,
  Sonata,
  Enemy,
  ToAStage,
  ToAWave,
  EnemyInstance,
  AreaEffect,
  GameplayEffect,
  OwnedRoster,
  TeamCandidate,
} from '../../lib/domain/types/index.ts';

// 1. Patch Contexts
export const patchContext37: PatchContext = {
  patchId: 'patch-3-7-uuid',
  version: '3.7',
  cycleId: 'cycle-season-40',
  snapshotDate: '2026-09-14',
};

export const patchContext36: PatchContext = {
  patchId: 'patch-3-6-uuid',
  version: '3.6',
  cycleId: 'cycle-season-39',
  snapshotDate: '2026-08-01',
};

// 2. Gameplay Effects Fixtures
export const healEffect: GameplayEffect = {
  id: 'eff-heal-verina',
  patchId: 'patch-3-7-uuid',
  category: 'HEALING',
  target: 'TEAM',
  detailExpression: { heal_ratio: 0.15 },
};

export const shieldEffect: GameplayEffect = {
  id: 'eff-shield-jianxin',
  patchId: 'patch-3-7-uuid',
  category: 'SHIELD',
  target: 'ACTIVE_CHARACTER',
  detailExpression: { shield_amount: 3000 },
};

export const aeroResShredEffect: GameplayEffect = {
  id: 'eff-aero-shred-yangyang',
  patchId: 'patch-3-7-uuid',
  category: 'RES_SHRED',
  target: 'ENEMY',
  detailExpression: { element: 'Aero', shred_ratio: 0.10 },
};

export const defShredEffect: GameplayEffect = {
  id: 'eff-def-shred-general',
  patchId: 'patch-3-7-uuid',
  category: 'DEF_SHRED',
  target: 'ENEMY',
  detailExpression: { ratio: 0.15 },
};

export const dmgAmplifyEffect: GameplayEffect = {
  id: 'eff-dmg-amplify-sanhua',
  patchId: 'patch-3-7-uuid',
  category: 'DMG_AMPLIFY',
  target: 'NEXT_RESONATOR',
  detailExpression: { buff_type: 'BASIC_ATTACK', ratio: 0.38 },
};

export const coordAttackEffect: GameplayEffect = {
  id: 'eff-coord-attack-yinlin',
  patchId: 'patch-3-7-uuid',
  category: 'COORDINATED_ATTACK',
  target: 'ENEMY',
  detailExpression: { interval_seconds: 1.0 },
};

export const resourceGrantEffect: GameplayEffect = {
  id: 'eff-resource-grant-verina',
  patchId: 'patch-3-7-uuid',
  category: 'RESOURCE_GRANT',
  target: 'ACTIVE_CHARACTER',
  detailExpression: { concerto: 10, energy: 20 },
};

export const statBuffEffect: GameplayEffect = {
  id: 'eff-stat-buff-atk',
  patchId: 'patch-3-7-uuid',
  category: 'STAT_BUFF',
  target: 'TEAM',
  detailExpression: { stat: 'ATK', ratio: 0.20 },
};

export const specialMechanicEffect: GameplayEffect = {
  id: 'eff-special-mechanic',
  patchId: 'patch-3-7-uuid',
  category: 'SPECIAL_MECHANIC',
  target: 'SELF',
  detailExpression: { mechanic: 'PARRY' },
};

export const stateChangeEffect: GameplayEffect = {
  id: 'eff-state-change',
  patchId: 'patch-3-7-uuid',
  category: 'STATE_CHANGE',
  target: 'SELF',
  detailExpression: { state: 'FROZEN_ZONE' },
};

// 3. Equipment Fixtures
export const ageOfHarvestWeapon: Weapon = {
  id: 'weapon-age-of-harvest',
  name: 'Ages of Harvest',
  weaponType: 'Broadblade',
  rarity: 5,
  baseAtkLvl90: 587,
  subStatType: 'CritRate',
  subStatValueLvl90: 24.3,
  passiveEffect: statBuffEffect,
};

export const swordEmeraldGenesis: Weapon = {
  id: 'weapon-emerald-genesis',
  name: 'Emerald of Genesis',
  weaponType: 'Sword',
  rarity: 5,
  baseAtkLvl90: 587,
  subStatType: 'CritRate',
  subStatValueLvl90: 24.3,
};

export const bellBorneEcho: Echo = {
  id: 'echo-bell-borne',
  name: 'Bell-Borne Geochelone',
  classType: 'Calamity',
  cost: 4,
  cdSeconds: 20,
  concertosGenerated: 10,
  skillEffect: shieldEffect,
};

export const sierraGaleSonata: Sonata = {
  id: 'sonata-sierra-gale',
  name: 'Sierra Gale',
  code: 'SIERRA_GALE',
  twoPieceEffect: {
    id: 'eff-sierra-2p',
    patchId: 'patch-3-7-uuid',
    category: 'STAT_BUFF',
    target: 'SELF',
    detailExpression: { element: 'Aero', ratio: 0.10 },
  },
};

// 4. Resonators
export const jinhsi: Resonator = {
  id: 'res-jinhsi',
  name: 'Jinhsi',
  element: 'Spectro',
  weaponType: 'Broadblade',
  rarity: 5,
  releaseDate: '2024-06-28',
  baseHpLvl90: 10387,
  baseAtkLvl90: 437,
  baseDefLvl90: 1148,
  roles: [
    { code: 'MAIN_DPS', label: 'Main DPS', isPrimary: true },
  ],
  combatTags: [
    { code: 'SPECTRO_DMG', label: 'Spectro DMG' },
    { code: 'RESONANCE_SKILL_DMG', label: 'Resonance Skill DMG' },
  ],
  abilities: [
    {
      code: 'SKILL_01',
      category: 'ResonanceSkill',
      name: 'Trailing Light of Eons',
      concertosGenerated: 20,
      effects: [dmgAmplifyEffect],
    },
  ],
};

export const verina: Resonator = {
  id: 'res-verina',
  name: 'Verina',
  element: 'Spectro',
  weaponType: 'Rectifier',
  rarity: 5,
  releaseDate: '2024-05-22',
  baseHpLvl90: 10387,
  baseAtkLvl90: 387,
  baseDefLvl90: 1148,
  roles: [
    { code: 'SUPPORT', label: 'Support', isPrimary: true },
    { code: 'HEALER', label: 'Healer', isPrimary: false },
  ],
  combatTags: [
    { code: 'HEALING', label: 'Healing' },
    { code: 'CONCERTO_EFFICIENCY', label: 'Concerto Efficiency' },
  ],
  abilities: [
    {
      code: 'LIB_01',
      category: 'ResonanceLiberation',
      name: 'Arboreal Flourish',
      concertosGenerated: 20,
      effects: [healEffect, statBuffEffect, resourceGrantEffect],
    },
  ],
};

export const jianxin: Resonator = {
  id: 'res-jianxin',
  name: 'Jianxin',
  element: 'Aero',
  weaponType: 'Gauntlets',
  rarity: 5,
  releaseDate: '2024-05-22',
  baseHpLvl90: 11500,
  baseAtkLvl90: 350,
  baseDefLvl90: 1200,
  roles: [
    { code: 'SUPPORT', label: 'Support', isPrimary: true },
    { code: 'SHIELDER', label: 'Shielder', isPrimary: false },
  ],
  combatTags: [
    { code: 'SHIELD', label: 'Shield' },
    { code: 'AERO_DMG', label: 'Aero DMG' },
  ],
  abilities: [
    {
      code: 'FORTE_01',
      category: 'ForteCircuit',
      name: 'Primordial Chi Realm',
      concertosGenerated: 25,
      effects: [shieldEffect, specialMechanicEffect],
    },
  ],
};

export const yangyang: Resonator = {
  id: 'res-yangyang',
  name: 'Yangyang',
  element: 'Aero',
  weaponType: 'Sword',
  rarity: 4,
  releaseDate: '2024-05-22',
  baseHpLvl90: 9800,
  baseAtkLvl90: 320,
  baseDefLvl90: 1050,
  roles: [
    { code: 'SUB_DPS', label: 'Sub DPS', isPrimary: true },
    { code: 'SUPPORT', label: 'Support', isPrimary: false },
  ],
  combatTags: [
    { code: 'AERO_DMG', label: 'Aero DMG' },
    { code: 'ENERGY_REGEN', label: 'Energy Regen' },
  ],
  abilities: [
    {
      code: 'OUTRO_01',
      category: 'OutroSkill',
      name: 'Whispering Winds',
      concertosGenerated: 10,
      effects: [aeroResShredEffect, coordAttackEffect, defShredEffect],
    },
  ],
};

// Resonator unreleased in snapshot (released 2026-11-01, snapshot is 2026-09-14)
export const futureResonator: Resonator = {
  id: 'res-future-hero',
  name: 'Future Hero',
  element: 'Fusion',
  weaponType: 'Sword',
  rarity: 5,
  releaseDate: '2026-11-01',
  baseHpLvl90: 10500,
  baseAtkLvl90: 450,
  baseDefLvl90: 1100,
  roles: [{ code: 'MAIN_DPS', label: 'Main DPS', isPrimary: true }],
  combatTags: [{ code: 'FUSION_DMG', label: 'Fusion DMG' }],
  abilities: [],
};

// 5. Enemies Fixtures
export const tempestMephisBoss: Enemy = {
  id: 'enemy-tempest-mephis',
  name: 'Tempest Mephis',
  code: 'BOSS_TEMPEST_MEPHIS',
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
  modifiers: [
    {
      modifierType: 'SHIELD_BAR',
      parameters: { maxShield: 50000 },
      isActive: true,
    },
  ],
};

export const chasmGuardianElite: Enemy = {
  id: 'enemy-chasm-guardian',
  name: 'Chasm Guardian',
  code: 'ELITE_CHASM_GUARDIAN',
  enemyClass: 'Elite',
  resistances: [
    { element: 'Havoc', resistanceRatio: 0.40 },
    { element: 'Aero', resistanceRatio: 0.20 },
    { element: 'Glacio', resistanceRatio: 0.20 },
  ],
  modifiers: [],
};

// 6. ToA Stages Fixtures
export const stageHazardZone37: ToAStage = {
  id: 'toa-stage-hazard-f4-p37',
  patchId: 'patch-3-7-uuid',
  stageIndex: 4,
  vigorCost: 4,
  areaEffects: [
    {
      id: 'area-eff-aero-reduction',
      sourceId: 'src-aero-hazard',
      name: 'Resonant Windcurrents',
      description: 'Aero RES is reduced by 10%.',
      gameplayEffect: {
        id: 'ge-aero-res-buff',
        patchId: 'patch-3-7-uuid',
        category: 'RES_SHRED',
        target: 'ENEMY',
        detailExpression: { element: 'Aero', modifier: -0.10 },
      },
    },
    {
      id: 'area-eff-shield-boost',
      sourceId: 'src-shield-hazard',
      name: 'Bastion of Will',
      description: 'When obtaining a shield, team members gain 25% Resonance Liberation DMG bonus.',
      gameplayEffect: {
        id: 'ge-shield-bonus',
        patchId: 'patch-3-7-uuid',
        category: 'SHIELD',
        target: 'TEAM',
        detailExpression: { bonus_dmg: 0.25 },
      },
    },
    {
      id: 'area-eff-intro-boost',
      sourceId: 'src-intro-hazard',
      name: 'Prelude of Surge',
      description: 'After casting an Intro Skill, team ATK is increased by 20%.',
      gameplayEffect: {
        id: 'ge-intro-bonus',
        patchId: 'patch-3-7-uuid',
        category: 'STAT_BUFF',
        target: 'TEAM',
        detailExpression: { atk_buff: 0.20 },
      },
    },
    {
      id: 'area-eff-debuff-amp',
      sourceId: 'src-debuff-amp',
      name: 'Erosion Vulnerability',
      description: 'Enemies affected by negative status receive 20% increased DMG.',
      gameplayEffect: {
        id: 'ge-debuff-amp',
        patchId: 'patch-3-7-uuid',
        category: 'DMG_AMPLIFY',
        target: 'ENEMY',
        detailExpression: { vuln: 0.20 },
      },
    },
  ],
  challengeGoals: [
    { id: 'cg-1', goalOrder: 1, targetTimeSeconds: 180, points: 1 },
    { id: 'cg-2', goalOrder: 2, targetTimeSeconds: 120, points: 1 },
    { id: 'cg-3', goalOrder: 3, targetTimeSeconds: 60, points: 1 },
  ],
  waves: [
    {
      id: 'wave-1',
      waveIndex: 1,
      enemyInstances: [
        {
          id: 'inst-1',
          level: 100,
          spawnOrder: 1,
          enemy: tempestMephisBoss,
        },
        {
          id: 'inst-2',
          level: 95,
          spawnOrder: 2,
          enemy: chasmGuardianElite,
        },
      ],
    },
  ],
};

export const stageHazardZone36: ToAStage = {
  id: 'toa-stage-hazard-f4-p36',
  patchId: 'patch-3-6-uuid', // Different patch ID
  stageIndex: 4,
  vigorCost: 4,
  areaEffects: [],
  challengeGoals: [],
  waves: [],
};

// 7. Roster Fixtures
export const fullOwnedRoster: OwnedRoster = {
  userId: 'user-001',
  resonatorIds: ['res-jinhsi', 'res-verina', 'res-jianxin', 'res-yangyang'],
  weaponIds: ['weapon-age-of-harvest', 'weapon-emerald-genesis'],
  echoIds: ['echo-bell-borne'],
};

export const partialOwnedRoster: OwnedRoster = {
  userId: 'user-002',
  resonatorIds: ['res-jinhsi', 'res-verina'], // Jianxin and Yangyang missing
  weaponIds: ['weapon-age-of-harvest'],
};
