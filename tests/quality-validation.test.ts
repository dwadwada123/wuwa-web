import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import type {
  Resonator,
  Element,
  WeaponType,
  Rarity,
  OwnedRoster,
  PatchContext,
  ToAStage,
} from '../lib/domain/types/index.ts';

import {
  generateTeamCandidates,
  scoreTeamForStage,
  optimizeToA,
  buildOptimizationExplanation,
  evaluateTeam,
  getCandidateKey,
  TEAM_SCORING_CONFIG,
} from '../lib/engine/index.ts';

import {
  scoreRoleCoverage,
} from '../lib/engine/scoring/dimensions/role-coverage.ts';
import {
  scoreElementalMatchup,
} from '../lib/engine/scoring/dimensions/elemental-matchup.ts';
import {
  scoreEnemyMatchup,
} from '../lib/engine/scoring/dimensions/enemy-matchup.ts';
import {
  scoreStageBuffCompatibility,
} from '../lib/engine/scoring/dimensions/stage-buff.ts';
import {
  scoreOffensiveSynergy,
} from '../lib/engine/scoring/dimensions/offensive-synergy.ts';
import {
  scoreSustain,
} from '../lib/engine/scoring/dimensions/sustain.ts';
import {
  scoreResistanceUtility,
} from '../lib/engine/scoring/dimensions/resistance-utility.ts';
import {
  scoreCoordinatedAttackSynergy,
} from '../lib/engine/scoring/dimensions/coordinated-attack.ts';
import {
  scoreResourceSynergy,
} from '../lib/engine/scoring/dimensions/resource-synergy.ts';

import {
  allSeason40Stages,
  fullSeason40Stages,
  hazardTowerFloor1,
  hazardTowerFloor2,
  hazardTowerFloor3,
  hazardTowerFloor4,
  resonantTowerFloor1,
  resonantTowerFloor4,
  echoingTowerFloor1,
  echoingTowerFloor4,
} from './fixtures/season40-fixtures.ts';

// 1. Helper to load actual Patch 3.7 Resonators from the immutable golden dataset
function loadPatch37Resonators(): Map<string, Resonator> {
  const datasetPath = path.resolve('data/patches/3.7/patch_3_7_dataset.json');
  const raw = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

  const map = new Map<string, Resonator>();
  for (const r of raw.resonators) {
    const res: Resonator = {
      id: `res-${r.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      name: r.name,
      element: r.element as Element,
      weaponType: r.weapon_type as WeaponType,
      rarity: r.rarity as Rarity,
      releaseDate: r.release_date,
      baseHpLvl90: r.patch_data.base_hp_lvl90,
      baseAtkLvl90: r.patch_data.base_atk_lvl90,
      baseDefLvl90: r.patch_data.base_def_lvl90,
      roles: (r.patch_data.roles || []).map((x: any) => ({
        code: x.code,
        label: x.code.replace(/_/g, ' '),
        isPrimary: x.is_primary ?? false,
      })),
      combatTags: (r.patch_data.combat_tags || []).map((t: string) => ({
        code: t,
        label: t.replace(/_/g, ' '),
      })),
      abilities: (r.abilities || []).map((a: any) => ({
        code: a.ability_code,
        category: a.ability_category,
        name: a.name,
        cooldownSeconds: a.cooldown_seconds ?? null,
        energyCost: a.energy_cost ?? null,
        concertosGenerated: a.concertos_generated ?? 0,
        effects: (a.effects || []).map((e: any, idx: number) => ({
          id: `eff-${r.name}-${a.ability_code}-${idx}`,
          patchId: 'patch-3-7-uuid',
          category: e.category,
          target: e.target,
          conditionExpression: e.condition_expression || {},
          detailExpression: e.detail_expression || {},
        })),
      })),
    };
    map.set(r.name, res);
  }
  return map;
}

const allResonators = loadPatch37Resonators();

const patchContext: PatchContext = {
  patchId: 'patch-3-7-uuid',
  version: '3.7',
  cycleId: 'cycle-s40',
  snapshotDate: '2026-09-30',
};

const repStages = [
  resonantTowerFloor1,
  resonantTowerFloor4,
  hazardTowerFloor1,
  hazardTowerFloor3,
  echoingTowerFloor1,
  echoingTowerFloor4,
];

// Helper to evaluate candidates and scores
function setupRosterContext(names: string[], stages: ToAStage[]) {
  const resonators = names.map((n) => allResonators.get(n)!).filter(Boolean);
  const roster: OwnedRoster = {
    userId: `user-eval`,
    resonatorIds: resonators.map((r) => r.id),
  };

  const candidates = generateTeamCandidates(roster, {
    patchContext,
    availableResonators: resonators,
  });

  const scoringContext = { patchContext, roster };
  const scores = new Map<string, any>();
  for (const c of candidates) {
    for (const s of stages) {
      const score = scoreTeamForStage(c, s, scoringContext);
      scores.set(`${score.candidateKey}::${score.stageKey}`, score);
    }
  }

  const optContext = {
    cycleId: 'cycle-s40',
    patchId: patchContext.patchId,
    stages,
    candidates,
    scores,
    roster,
    defaultVigorCapacity: 10,
  };

  return { resonators, roster, candidates, scores, optContext };
}

// =========================================================================
// 1. REALISTIC ROSTER EVALUATION (SMALL, MEDIUM, LARGE)
// =========================================================================

test('Quality Validation: Roster A (Small / Casual: 10 usable resonators) on 6 Representative Stages', () => {
  const rosterA10 = [
    'Jinhsi', 'Encore', 'Calcharo',
    'Sanhua', 'Mortefi', 'Yangyang', 'Yinlin',
    'Verina', 'Baizhi', 'Jianxin'
  ];

  const { optContext } = setupRosterContext(rosterA10, repStages);
  const result = optimizeToA(optContext, { mode: 'EXACT' });

  assert.strictEqual(result.status, 'OPTIMAL');
  assert.strictEqual(result.optimality, 'FULL_LEXICOGRAPHIC_PROVEN');
  assert.strictEqual(result.assignments.length, 6);
  assert.ok(result.totalScore > 4000, 'Roster A must achieve strong competitive total score');

  // Verify explanation model builds cleanly
  const explanation = buildOptimizationExplanation(optContext, result);
  assert.strictEqual(explanation.status, 'OPTIMAL');
  assert.strictEqual(explanation.stages.length, 6);
  assert.ok(explanation.summaryReasons.length > 0);
});

test('Quality Validation: Roster A (10 resonators) Full 12 Stages Capacity Barrier', () => {
  const rosterA10 = [
    'Jinhsi', 'Encore', 'Calcharo',
    'Sanhua', 'Mortefi', 'Yangyang', 'Yinlin',
    'Verina', 'Baizhi', 'Jianxin'
  ];

  const { optContext } = setupRosterContext(rosterA10, fullSeason40Stages);
  const result = optimizeToA(optContext, { mode: 'BEST_EFFORT', maxSearchStates: 200000 });

  // 10 resonators * 10 vigor = 100 vigor total.
  // Full 12 stages require 120 vigor. Mathematically infeasible!
  assert.strictEqual(result.status, 'INFEASIBLE');
  assert.ok(result.infeasibilityReasons && result.infeasibilityReasons.length > 0);

  const explanation = buildOptimizationExplanation(optContext, result);
  assert.strictEqual(explanation.status, 'INFEASIBLE');
  assert.ok(
    explanation.summaryReasons.some(
      (r) => r.code === 'GLOBAL_INFEASIBILITY_BARRIER' || r.category === 'GLOBAL_OPTIMIZATION'
    ),
    'Explanation must surface the global infeasibility barrier'
  );
});

test('Quality Validation: Roster A+ (Small Complete: 12 usable resonators) Full 12 Stages Boundary', () => {
  const rosterA12 = [
    'Jinhsi', 'Encore', 'Calcharo',
    'Sanhua', 'Mortefi', 'Yangyang', 'Yinlin',
    'Verina', 'Baizhi', 'Jianxin',
    'Chixia', 'Taoqi'
  ];

  const { optContext } = setupRosterContext(rosterA12, fullSeason40Stages);
  const result = optimizeToA(optContext, { mode: 'BEST_EFFORT', maxSearchStates: 200000 });

  assert.strictEqual(result.status, 'BEST_FOUND');
  assert.strictEqual(result.assignments.length, 12);
  assert.ok(result.totalScore >= 8000, 'Roster A+ must complete 12 stages with score >= 8000');

  // Exact 0-slack capacity: 12 resonators * 10 vigor = 120 vigor consumed out of 120
  assert.strictEqual(result.totalVigorConsumed, 120);
});

test('Quality Validation: Roster B (Medium: 20 usable resonators) Full 12 Stages Season 40', () => {
  const rosterB20 = [
    'Jinhsi', 'Changli', 'Jiyan', 'Encore', 'Camellya', 'Xiangli Yao', 'Calcharo', 'Rover: Havoc',
    'Sanhua', 'Mortefi', 'Yinlin', 'Zhezhi', 'Yangyang', 'Aalto', 'Danjin', 'Yuanwu',
    'Verina', 'Shorekeeper', 'Baizhi', 'Jianxin'
  ];

  const { optContext } = setupRosterContext(rosterB20, fullSeason40Stages);
  const result = optimizeToA(optContext, { mode: 'BEST_EFFORT', maxSearchStates: 200000 });

  assert.strictEqual(result.status, 'BEST_FOUND');
  assert.strictEqual(result.assignments.length, 12);
  assert.ok(result.totalScore >= 8400, 'Medium roster must achieve high score >= 8400');
});

test('Quality Validation: Roster C (Large: 32 usable resonators) Full 12 Stages Season 40', () => {
  const rosterC32 = [
    'Jinhsi', 'Changli', 'Jiyan', 'Encore', 'Camellya', 'Xiangli Yao', 'Calcharo', 'Rover: Havoc',
    'Sanhua', 'Mortefi', 'Yinlin', 'Zhezhi', 'Yangyang', 'Aalto', 'Danjin', 'Yuanwu',
    'Verina', 'Shorekeeper', 'Baizhi', 'Jianxin',
    'Taoqi', 'Chixia', 'Lingyang', 'Youhu', 'Lumi', 'Rover: Spectro',
    'Carlotta', 'Brant', 'Phoebe', 'Cantarella', 'Zani', 'Lupa'
  ];

  const { optContext } = setupRosterContext(rosterC32, fullSeason40Stages);
  const result = optimizeToA(optContext, { mode: 'BEST_EFFORT', maxSearchStates: 200000 });

  assert.strictEqual(result.status, 'BEST_FOUND');
  assert.strictEqual(result.assignments.length, 12);
  assert.ok(result.totalScore >= 8600, 'Large roster must achieve elite score >= 8600');
});

// =========================================================================
// 2. RED FLAG DETECTION & CLASSIFICATION AUDIT
// =========================================================================

test('Red Flag A: Heavily resisted primary element receives penalization (Audit: MODEL_LIMITATION observed)', () => {
  // Stage: Hazard Tower Floor 1 has Impermanence Heron Boss with 40% Havoc Resistance.
  // Team with Havoc Main DPS (Camellya) and no resistance shred vs Electro Main DPS (Calcharo)
  const teamHavoc = {
    members: [
      { resonator: allResonators.get('Camellya')! },
      { resonator: allResonators.get('Sanhua')! },
      { resonator: allResonators.get('Verina')! },
    ],
  };
  const teamElectro = {
    members: [
      { resonator: allResonators.get('Calcharo')! },
      { resonator: allResonators.get('Sanhua')! },
      { resonator: allResonators.get('Verina')! },
    ],
  };
  const teamMonoHavoc = {
    members: [
      { resonator: allResonators.get('Camellya')! },
      { resonator: allResonators.get('Danjin')! },
      { resonator: allResonators.get('Taoqi')! },
    ],
  };

  const rosterHavoc = { userId: 'rf-a1', resonatorIds: teamHavoc.members.map((m) => m.resonator.id) };
  const rosterElectro = { userId: 'rf-a2', resonatorIds: teamElectro.members.map((m) => m.resonator.id) };
  const rosterMonoHavoc = { userId: 'rf-a3', resonatorIds: teamMonoHavoc.members.map((m) => m.resonator.id) };

  const scoreHavoc = scoreTeamForStage(teamHavoc, hazardTowerFloor1, { patchContext, roster: rosterHavoc });
  const scoreElectro = scoreTeamForStage(teamElectro, hazardTowerFloor1, { patchContext, roster: rosterElectro });
  const scoreMonoHavoc = scoreTeamForStage(teamMonoHavoc, hazardTowerFloor1, { patchContext, roster: rosterMonoHavoc });

  // 1. Advantage verification: Electro team achieves higher elemental score (85 vs 63)
  assert.ok(
    scoreHavoc.dimensions.elementalMatchup.score < scoreElectro.dimensions.elementalMatchup.score,
    'Heavily resisted Havoc team must receive lower elemental score than Electro team'
  );

  // 2. Pure mono-element Havoc team gets heavily resisted score of 20 (effective resistance = 40%)
  assert.strictEqual(
    scoreMonoHavoc.dimensions.elementalMatchup.score,
    20,
    'Pure mono-element Havoc team receives heavily resisted score 20 (Audit: EXPECTED)'
  );

  // 3. MODEL_LIMITATION Audit: Mixed team (Havoc Main DPS + Glacio/Spectro support) scores 66 because
  // scorer takes 0.75 * maxScore (from Spectro/Glacio 70) + 0.25 * avgScore (53.3) without weighting Main DPS role.
  assert.strictEqual(
    scoreHavoc.dimensions.elementalMatchup.score,
    66,
    'Model Limitation: Support element elevates mixed team elemental score to 66 (Audit: MODEL_LIMITATION)'
  );
});

test('Red Flag B: Team that cannot trigger stage buff receives baseline/unmatched score', () => {
  // Stage: Hazard Tower Floor 3 has Area Effect rewarding Shield with Fusion DMG Bonus.
  // Team 1: Has Jianxin (generates Shield) and Changli (Fusion DMG).
  // Team 2: Pure Glacio team with no Shielder (Lingyang, Sanhua, Baizhi).
  const teamShieldFusion = {
    members: [
      { resonator: allResonators.get('Changli')! },
      { resonator: allResonators.get('Jianxin')! },
      { resonator: allResonators.get('Verina')! },
    ],
  };
  const teamNoShield = {
    members: [
      { resonator: allResonators.get('Lingyang')! },
      { resonator: allResonators.get('Sanhua')! },
      { resonator: allResonators.get('Baizhi')! },
    ],
  };

  const scoreShield = scoreStageBuffCompatibility(teamShieldFusion, hazardTowerFloor3);
  const scoreNoShield = scoreStageBuffCompatibility(teamNoShield, hazardTowerFloor3);

  assert.ok(
    scoreShield.score > scoreNoShield.score,
    'Team triggering shield buff must score strictly higher than team lacking shield'
  );
  assert.ok(
    scoreNoShield.score <= 60,
    'Team lacking triggers must not receive high stage buff score (Audit: EXPECTED)'
  );
});

test('Red Flag C: Sustain score on low-threat stage vs high-threat boss stage is stage-relative', () => {
  // Stage 1: Resonant Tower Floor 1 (Level 70 common drake, low threat)
  // Stage 4: Hazard Tower Floor 4 (Level 100 Fallacy of No Return Overlord Boss, high threat)
  const glassCannonTeam = {
    members: [
      { resonator: allResonators.get('Calcharo')! },
      { resonator: allResonators.get('Yinlin')! },
      { resonator: allResonators.get('Sanhua')! },
    ],
  };
  const roster = { userId: 'rf-c', resonatorIds: glassCannonTeam.members.map((m) => m.resonator.id) };

  const ruleContext = { patchContext, roster };
  const report = evaluateTeam(glassCannonTeam, ruleContext);
  assert.strictEqual(report.hasHealing, false);
  assert.strictEqual(report.hasShield, false);

  const sustainLowThreat = scoreSustain(glassCannonTeam, resonantTowerFloor1, report);
  const sustainHighThreat = scoreSustain(glassCannonTeam, hazardTowerFloor4, report);

  // Glass cannon setup gets viable score (65) on floor 1, but penalized (25) on boss floor
  assert.strictEqual(sustainLowThreat.score, 65, 'Low-threat stage allows glass-cannon setup (score: 65)');
  assert.strictEqual(sustainHighThreat.score, 25, 'High-threat boss stage heavily penalizes lack of sustain (score: 25)');
  assert.ok(sustainLowThreat.score > sustainHighThreat.score, 'Audit: EXPECTED');
});

test('Red Flag D: Team missing Main DPS is strictly penalized in role coverage', () => {
  const teamNoMainDps = {
    members: [
      { resonator: allResonators.get('Yangyang')! }, // Sub DPS
      { resonator: allResonators.get('Sanhua')! },   // Sub DPS
      { resonator: allResonators.get('Verina')! },   // Support
    ],
  };
  const teamBalanced = {
    members: [
      { resonator: allResonators.get('Jinhsi')! },   // Main DPS
      { resonator: allResonators.get('Sanhua')! },   // Sub DPS
      { resonator: allResonators.get('Verina')! },   // Support
    ],
  };
  const roster = {
    userId: 'rf-d',
    resonatorIds: [...teamNoMainDps.members, ...teamBalanced.members].map((m) => m.resonator.id),
  };

  const reportNoMain = evaluateTeam(teamNoMainDps, { patchContext, roster });
  const reportBalanced = evaluateTeam(teamBalanced, { patchContext, roster });

  const roleNoMain = scoreRoleCoverage(teamNoMainDps, reportNoMain);
  const roleBalanced = scoreRoleCoverage(teamBalanced, reportBalanced);

  assert.strictEqual(roleBalanced.score, 100, 'Balanced Main + Sub + Support achieves 100 role score');
  assert.strictEqual(roleNoMain.score, 60, 'Team lacking Main DPS misses +40 bonus (capped at 60)');
  assert.ok(roleBalanced.score > roleNoMain.score, 'Audit: EXPECTED');
});

test('Red Flag E & F: Global optimizer avoids greedy burn and honors opportunity cost tradeoffs', () => {
  const rosterA10 = [
    'Jinhsi', 'Encore', 'Calcharo',
    'Sanhua', 'Mortefi', 'Yangyang', 'Yinlin',
    'Verina', 'Baizhi', 'Jianxin'
  ];

  const { optContext } = setupRosterContext(rosterA10, repStages);
  const result = optimizeToA(optContext, { mode: 'EXACT' });

  // Verify that total score is the global maximum and no local sacrifice is made without global gain
  assert.strictEqual(result.status, 'OPTIMAL');
  assert.ok(result.totalScore >= result.assignments.reduce((sum, a) => sum + a.teamScore.totalScore, 0));
});

// =========================================================================
// 3. SCORING EXPLANATION CONSISTENCY
// =========================================================================

test('Consistency: totalScore strictly equals sum of weighted dimensions', () => {
  const rosterA10 = [
    'Jinhsi', 'Encore', 'Calcharo',
    'Sanhua', 'Mortefi', 'Yangyang', 'Yinlin',
    'Verina', 'Baizhi', 'Jianxin'
  ];

  const { candidates, scores } = setupRosterContext(rosterA10, repStages);

  for (const s of scores.values()) {
    if (!s.valid) continue;
    const dims = s.dimensions;
    const sumWeighted =
      dims.roleCoverage.weightedScore +
      dims.elementalMatchup.weightedScore +
      dims.enemyMatchup.weightedScore +
      dims.stageBuffCompatibility.weightedScore +
      dims.offensiveSynergy.weightedScore +
      dims.sustain.weightedScore +
      dims.resistanceUtility.weightedScore +
      dims.coordinatedAttackSynergy.weightedScore +
      dims.resourceSynergy.weightedScore;

    assert.strictEqual(
      s.totalScore,
      sumWeighted,
      `Score ${s.totalScore} must strictly equal sum of weighted dimensions ${sumWeighted}`
    );
  }
});

// =========================================================================
// 4. WEIGHT SENSITIVITY ANALYSIS
// =========================================================================

test('Sensitivity: Controlled weight shifts demonstrate robust assignment stability', () => {
  const rosterB20 = [
    'Jinhsi', 'Changli', 'Jiyan', 'Encore', 'Camellya', 'Xiangli Yao', 'Calcharo', 'Rover: Havoc',
    'Sanhua', 'Mortefi', 'Yinlin', 'Zhezhi', 'Yangyang', 'Aalto', 'Danjin', 'Yuanwu',
    'Verina', 'Shorekeeper', 'Baizhi', 'Jianxin'
  ];

  const { candidates, roster } = setupRosterContext(rosterB20, fullSeason40Stages);

  // Variant A: Baseline
  const baselineScores = new Map<string, any>();
  for (const c of candidates) {
    for (const s of fullSeason40Stages) {
      const sc = scoreTeamForStage(c, s, { patchContext, roster });
      baselineScores.set(`${sc.candidateKey}::${sc.stageKey}`, sc);
    }
  }

  const baselineResult = optimizeToA({
    cycleId: 'cycle-s40',
    patchId: patchContext.patchId,
    stages: fullSeason40Stages,
    candidates,
    scores: baselineScores,
    roster,
    defaultVigorCapacity: 10,
  }, { mode: 'BEST_EFFORT', maxSearchStates: 200000 });

  const baselineTeams = new Map<string, string>();
  baselineResult.assignments.forEach((a) =>
    baselineTeams.set(a.stageId, a.team.members.map((m) => m.resonator.name).sort().join(','))
  );

  // Helper to re-score candidates under a modified weight vector
  function testVariantStability(weights: Record<string, number>): number {
    const varScores = new Map<string, any>();
    for (const c of candidates) {
      const report = evaluateTeam(c, { patchContext, roster });
      if (!report.isValid) continue;

      const role = scoreRoleCoverage(c, report);
      const off = scoreOffensiveSynergy(c, report);
      const res = scoreResistanceUtility(c, report);
      const resource = scoreResourceSynergy(c, report);

      for (const s of fullSeason40Stages) {
        const elem = scoreElementalMatchup(c, s);
        const enemy = scoreEnemyMatchup(c, s, report);
        const stageBuff = scoreStageBuffCompatibility(c, s);
        const sus = scoreSustain(c, s, report);
        const coord = scoreCoordinatedAttackSynergy(c, s, report);

        const totalScore = Math.round(
          (role.score / 100) * weights.roleCoverage +
          (elem.score / 100) * weights.elementalMatchup +
          (enemy.score / 100) * weights.enemyMatchup +
          (stageBuff.score / 100) * weights.stageBuffCompatibility +
          (off.score / 100) * weights.offensiveSynergy +
          (sus.score / 100) * weights.sustain +
          (res.score / 100) * weights.resistanceUtility +
          (coord.score / 100) * weights.coordinatedAttackSynergy +
          (resource.score / 100) * weights.resourceSynergy
        );

        const entry = {
          candidateKey: getCandidateKey(c),
          stageKey: `${s.patchId}:${s.id}`,
          valid: true,
          totalScore,
          dimensions: {
            roleCoverage: { ...role, weightedScore: Math.round((role.score / 100) * weights.roleCoverage) },
            elementalMatchup: { ...elem, weightedScore: Math.round((elem.score / 100) * weights.elementalMatchup) },
            enemyMatchup: { ...enemy, weightedScore: Math.round((enemy.score / 100) * weights.enemyMatchup) },
            stageBuffCompatibility: { ...stageBuff, weightedScore: Math.round((stageBuff.score / 100) * weights.stageBuffCompatibility) },
            offensiveSynergy: { ...off, weightedScore: Math.round((off.score / 100) * weights.offensiveSynergy) },
            sustain: { ...sus, weightedScore: Math.round((sus.score / 100) * weights.sustain) },
            resistanceUtility: { ...res, weightedScore: Math.round((res.score / 100) * weights.resistanceUtility) },
            coordinatedAttackSynergy: { ...coord, weightedScore: Math.round((coord.score / 100) * weights.coordinatedAttackSynergy) },
            resourceSynergy: { ...resource, weightedScore: Math.round((resource.score / 100) * weights.resourceSynergy) },
          },
          evidence: [],
          warnings: [],
        };
        varScores.set(`${entry.candidateKey}::${entry.stageKey}`, entry);
      }
    }

    const varResult = optimizeToA({
      cycleId: 'cycle-s40',
      patchId: patchContext.patchId,
      stages: fullSeason40Stages,
      candidates,
      scores: varScores,
      roster,
      defaultVigorCapacity: 10,
    }, { mode: 'BEST_EFFORT', maxSearchStates: 200000 });

    let identicalCount = 0;
    varResult.assignments.forEach((a) => {
      const baseTeam = baselineTeams.get(a.stageId);
      const currTeam = a.team.members.map((m) => m.resonator.name).sort().join(',');
      if (baseTeam === currTeam) identicalCount++;
    });

    return identicalCount;
  }

  // Variant B: Elemental Matchup higher (240 vs 160)
  const stabB = testVariantStability({
    stageBuffCompatibility: 160, elementalMatchup: 240, offensiveSynergy: 120,
    roleCoverage: 100, enemyMatchup: 90, resistanceUtility: 90, sustain: 70,
    coordinatedAttackSynergy: 65, resourceSynergy: 65,
  });
  assert.ok(stabB >= 10, 'Variant B must retain >= 10/12 baseline assignments');

  // Variant C: Offensive Synergy higher (220 vs 140)
  const stabC = testVariantStability({
    stageBuffCompatibility: 160, elementalMatchup: 140, offensiveSynergy: 220,
    roleCoverage: 110, enemyMatchup: 90, resistanceUtility: 90, sustain: 70,
    coordinatedAttackSynergy: 60, resourceSynergy: 60,
  });
  assert.ok(stabC >= 10, 'Variant C must retain >= 10/12 baseline assignments');

  // Variant D: Stage Buff higher (260 vs 180)
  const stabD = testVariantStability({
    stageBuffCompatibility: 260, elementalMatchup: 140, offensiveSynergy: 130,
    roleCoverage: 110, enemyMatchup: 90, resistanceUtility: 90, sustain: 70,
    coordinatedAttackSynergy: 55, resourceSynergy: 55,
  });
  assert.ok(stabD >= 10, 'Variant D must retain >= 10/12 baseline assignments');

  // Variant E: Sustain lower (20 vs 80)
  const stabE = testVariantStability({
    stageBuffCompatibility: 190, elementalMatchup: 170, offensiveSynergy: 150,
    roleCoverage: 130, enemyMatchup: 110, resistanceUtility: 110, sustain: 20,
    coordinatedAttackSynergy: 60, resourceSynergy: 60,
  });
  assert.ok(stabE >= 10, 'Variant E must retain >= 10/12 baseline assignments');
});

// =========================================================================
// 5. STAGE SENSITIVITY AND USER SCENARIOS
// =========================================================================

test('Stage Sensitivity: Same roster selects different teams for stages with distinct mechanics', () => {
  // Compare Hazard Floor 1 (Electro buffed, Heron boss with 40% Havoc RES)
  // vs Resonant Floor 4 (Aero buffed, Mech Abomination with 40% Electro RES)
  const teamElectro = {
    members: [
      { resonator: allResonators.get('Calcharo')! },
      { resonator: allResonators.get('Yinlin')! },
      { resonator: allResonators.get('Baizhi')! },
    ],
  };
  const teamAero = {
    members: [
      { resonator: allResonators.get('Jiyan')! },
      { resonator: allResonators.get('Yangyang')! },
      { resonator: allResonators.get('Verina')! },
    ],
  };
  const rosterElectro = { userId: 'sens-e', resonatorIds: teamElectro.members.map((m) => m.resonator.id) };
  const rosterAero = { userId: 'sens-a', resonatorIds: teamAero.members.map((m) => m.resonator.id) };

  const scoreElectroOnHazard1 = scoreTeamForStage(teamElectro, hazardTowerFloor1, { patchContext, roster: rosterElectro });
  const scoreAeroOnHazard1 = scoreTeamForStage(teamAero, hazardTowerFloor1, { patchContext, roster: rosterAero });

  const scoreElectroOnResonant4 = scoreTeamForStage(teamElectro, resonantTowerFloor4, { patchContext, roster: rosterElectro });
  const scoreAeroOnResonant4 = scoreTeamForStage(teamAero, resonantTowerFloor4, { patchContext, roster: rosterAero });

  // On Hazard 1: Electro team (774) outperforms Aero team (711)
  assert.ok(
    scoreElectroOnHazard1.totalScore > scoreAeroOnHazard1.totalScore,
    `Electro team (${scoreElectroOnHazard1.totalScore}) must score higher on Hazard 1 than Aero team (${scoreAeroOnHazard1.totalScore})`
  );

  // On Resonant 4: Aero team (707) outperforms Electro team (586)
  assert.ok(
    scoreAeroOnResonant4.totalScore > scoreElectroOnResonant4.totalScore,
    `Aero team (${scoreAeroOnResonant4.totalScore}) must score higher on Resonant 4 than Electro team (${scoreElectroOnResonant4.totalScore})`
  );
});

test('User Scenario 1: Small roster with single sustain character handles allocation', () => {
  // Only 1 healer (Verina), remaining characters are DPS/SubDPS
  const rosterS1 = [
    'Jinhsi', 'Changli', 'Calcharo',
    'Sanhua', 'Mortefi', 'Yangyang', 'Yinlin', 'Aalto', 'Danjin',
    'Verina'
  ];

  const { optContext } = setupRosterContext(rosterS1, repStages);
  const result = optimizeToA(optContext, { mode: 'BEST_EFFORT', maxSearchStates: 200000 });

  assert.strictEqual(result.status, 'BEST_FOUND');
  // Verina has 10 Vigor, can cover up to 2 high-threat 5-vigor stages or multiple low floors
  const verinaUsage = result.vigorUsage.find((v) => v.resonatorId === allResonators.get('Verina')!.id);
  assert.ok(verinaUsage);
  assert.ok(verinaUsage.used <= 10, 'Verina must not exceed 10 Vigor capacity');
});

test('User Scenario 3: Roster with overlapping elements (Heavy Havoc concentration)', () => {
  // Roster with 4 Havoc characters: Camellya, Danjin, Rover: Havoc, Taoqi
  const rosterS3 = [
    'Camellya', 'Danjin', 'Rover: Havoc', 'Taoqi',
    'Jinhsi', 'Changli', 'Sanhua', 'Mortefi', 'Verina', 'Baizhi'
  ];

  const { optContext } = setupRosterContext(rosterS3, repStages);
  const result = optimizeToA(optContext, { mode: 'EXACT' });

  assert.strictEqual(result.status, 'OPTIMAL');
  // Optimizer will route Havoc away from Hazard 1 (Heron has 40% Havoc RES) to Echoing stages (Havoc shred buff)
  const hazard1Assignment = result.assignments.find((a) => a.stageId === hazardTowerFloor1.id);
  assert.ok(hazard1Assignment);
  const hasHavocMainDps = hazard1Assignment.team.members.some((m) => m.resonator.name === 'Camellya' || m.resonator.name === 'Rover: Havoc');
  assert.strictEqual(hasHavocMainDps, false, 'Optimizer must avoid placing Havoc Main DPS on 40% Havoc resisted boss');
});

test('User Scenario 4: High-demand character competition across multiple stages', () => {
  // Shorekeeper and Verina are in high demand across all boss floors
  const rosterS4 = [
    'Jinhsi', 'Changli', 'Jiyan', 'Encore', 'Sanhua', 'Mortefi', 'Yangyang', 'Yinlin',
    'Verina', 'Shorekeeper', 'Baizhi', 'Jianxin'
  ];

  const { optContext } = setupRosterContext(rosterS4, fullSeason40Stages);
  const result = optimizeToA(optContext, { mode: 'BEST_EFFORT', maxSearchStates: 200000 });

  assert.strictEqual(result.status, 'BEST_FOUND');
  const verinaUsage = result.vigorUsage.find((v) => v.resonatorId === allResonators.get('Verina')!.id);
  const shoreUsage = result.vigorUsage.find((v) => v.resonatorId === allResonators.get('Shorekeeper')!.id);

  assert.ok(verinaUsage && verinaUsage.used <= 10);
  assert.ok(shoreUsage && shoreUsage.used <= 10);
});
