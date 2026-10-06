import test from 'node:test';
import assert from 'node:assert/strict';

import {
  optimizeToA,
  VigorTracker,
  computeObjectiveBreakdown,
  compareObjectiveBreakdowns,
  generateTeamCandidates,
  scoreTeamForStage,
} from '../lib/engine/index.ts';

import type {
  ToAOptimizationContext,
  StageAssignment,
} from '../lib/engine/optimization/types.ts';

import type {
  ToAStage,
  TeamCandidate,
  OwnedRoster,
  Resonator,
} from '../lib/domain/types/index.ts';

import {
  patchContext37,
  fullOwnedRoster,
  jinhsi,
  verina,
  jianxin,
  yangyang,
  availableResonatorsList,
  ageOfHarvestWeapon,
  createSyntheticRoster,
} from './fixtures/domain-fixtures.ts';

import {
  resonantTowerFloor1,
  resonantTowerFloor4,
  hazardTowerFloor1,
  hazardTowerFloor2,
  hazardTowerFloor3,
  echoingTowerFloor1,
  echoingTowerFloor4,
  allSeason40Stages,
  fullSeason40Stages,
} from './fixtures/season40-fixtures.ts';

/**
 * Brute-force exhaustive oracle for verifying exact global optimality on small fixtures.
 */
function bruteForceOracle(context: ToAOptimizationContext): {
  status: 'OPTIMAL' | 'INFEASIBLE';
  totalScore: number;
  assignments: StageAssignment[];
} {
  const stages = context.stages;
  const candidates = context.candidates || [];
  const vigorTracker = new VigorTracker(context);
  const scoringContext = {
    patchContext: { patchId: context.patchId, version: '' },
    roster: context.roster,
  };

  let bestAssignments: StageAssignment[] | null = null;
  let bestBreakdown = computeObjectiveBreakdown([]);

  const current: StageAssignment[] = [];

  function enumerate(stageIdx: number): void {
    if (stageIdx === stages.length) {
      const breakdown = computeObjectiveBreakdown(current);
      if (!bestAssignments || compareObjectiveBreakdowns(breakdown, bestBreakdown) < 0) {
        bestBreakdown = breakdown;
        bestAssignments = [...current];
      }
      return;
    }

    const stage = stages[stageIdx];
    for (const c of candidates) {
      const score = scoreTeamForStage(c, stage, scoringContext);
      if (!score.valid || score.totalScore <= 0) continue;

      if (!vigorTracker.canAfford(c, stage)) continue;

      vigorTracker.apply(c, stage);
      current.push({
        stageId: stage.id,
        stageIndex: stage.stageIndex,
        vigorCost: stage.vigorCost,
        teamKey: c.id || 'team',
        team: c,
        teamScore: score,
      });

      enumerate(stageIdx + 1);

      current.pop();
      vigorTracker.rollback(c, stage);
    }
  }

  enumerate(0);

  if (!bestAssignments) {
    return { status: 'INFEASIBLE', totalScore: 0, assignments: [] };
  }

  return {
    status: 'OPTIMAL',
    totalScore: bestBreakdown.primaryScore,
    assignments: bestAssignments,
  };
}

test('Global Optimizer - Correctness vs Exhaustive Oracle on Small Fixtures', () => {
  // Small fixture: 4 characters, 2 stages
  const roster: OwnedRoster = {
    resonatorIds: [jinhsi.id, verina.id, jianxin.id, yangyang.id],
  };

  const genContext = {
    patchContext: patchContext37,
    availableResonators: availableResonatorsList,
  };
  const candidates = generateTeamCandidates(roster, genContext);
  assert.equal(candidates.length, 4);

  const stages = [resonantTowerFloor1, resonantTowerFloor4];

  const optContext: ToAOptimizationContext = {
    cycleId: 'cycle-s40',
    patchId: patchContext37.patchId,
    stages,
    candidates,
    roster,
    defaultVigorCapacity: 10,
  };

  const oracleResult = bruteForceOracle(optContext);
  const productionResult = optimizeToA(optContext);

  assert.equal(productionResult.status, oracleResult.status);
  assert.equal(productionResult.totalScore, oracleResult.totalScore);
  assert.equal(productionResult.assignments.length, oracleResult.assignments.length);

  for (let i = 0; i < stages.length; i++) {
    assert.equal(productionResult.assignments[i].stageId, oracleResult.assignments[i].stageId);
    assert.equal(productionResult.assignments[i].teamKey, oracleResult.assignments[i].teamKey);
  }
});

test('Global Optimizer - Opportunity Cost & Greedy Counterexample', () => {
  // Construct a fixture where greedy selection is strictly suboptimal:
  // Stage 1 (cost: 5), Stage 2 (cost: 5).
  // Character capacity: 5.
  // Team A (uses Char 1): Stage 1 = 900, Stage 2 = 890
  // Team B (uses Char 2): Stage 1 = 880, Stage 2 = 100
  //
  // Greedy on Stage 1 chooses Team A (900).
  // Then Stage 2 must choose Team B (100) because Team A has 0 vigor remaining.
  // Greedy total = 900 + 100 = 1000.
  //
  // Global optimum:
  // Stage 1 -> Team B (880), Stage 2 -> Team A (890).
  // Global total = 880 + 890 = 1770!

  const char1: Resonator = {
    id: 'char-1',
    name: 'Hero 1',
    element: 'Aero',
    weaponType: 'Sword',
    rarity: 5,
    releaseDate: '2024-05-22',
    baseHpLvl90: 10000,
    baseAtkLvl90: 400,
    baseDefLvl90: 1000,
    roles: [{ code: 'MAIN_DPS', label: 'Main DPS', isPrimary: true }],
    combatTags: [],
    abilities: [],
  };

  const char2: Resonator = {
    id: 'char-2',
    name: 'Hero 2',
    element: 'Glacio',
    weaponType: 'Sword',
    rarity: 5,
    releaseDate: '2024-05-22',
    baseHpLvl90: 10000,
    baseAtkLvl90: 400,
    baseDefLvl90: 1000,
    roles: [{ code: 'MAIN_DPS', label: 'Main DPS', isPrimary: true }],
    combatTags: [],
    abilities: [],
  };

  const filler1: Resonator = { ...char1, id: 'filler-1', name: 'Filler 1' };
  const filler2: Resonator = { ...char2, id: 'filler-2', name: 'Filler 2' };

  const teamA: TeamCandidate = {
    id: 'team-A',
    members: [{ resonator: char1 }, { resonator: filler1 }, { resonator: filler2 }],
  };

  const teamB: TeamCandidate = {
    id: 'team-B',
    members: [{ resonator: char2 }, { resonator: filler1 }, { resonator: filler2 }],
  };

  const stage1: ToAStage = {
    id: 'stage-1',
    patchId: patchContext37.patchId,
    stageIndex: 1,
    vigorCost: 5,
    areaEffects: [],
    challengeGoals: [],
    waves: [],
  };

  const stage2: ToAStage = {
    id: 'stage-2',
    patchId: patchContext37.patchId,
    stageIndex: 2,
    vigorCost: 5,
    areaEffects: [],
    challengeGoals: [],
    waves: [],
  };

  // Explicit mock scores representing the tradeoff
  const mockScore = (totalScore: number) => ({
    candidateKey: 'mock',
    stageKey: 'mock',
    valid: true,
    totalScore,
    dimensions: {
      roleCoverage: { score: 100, maxScore: 100, weight: 120, weightedScore: 120, evidence: [] },
      elementalMatchup: { score: 100, maxScore: 100, weight: 160, weightedScore: 160, evidence: [] },
      enemyMatchup: { score: 100, maxScore: 100, weight: 100, weightedScore: 100, evidence: [] },
      stageBuffCompatibility: { score: 100, maxScore: 100, weight: 180, weightedScore: 180, evidence: [] },
      offensiveSynergy: { score: 100, maxScore: 100, weight: 140, weightedScore: 140, evidence: [] },
      sustain: { score: 100, maxScore: 100, weight: 80, weightedScore: 80, evidence: [] },
      resistanceUtility: { score: 100, maxScore: 100, weight: 100, weightedScore: 100, evidence: [] },
      coordinatedAttackSynergy: { score: 100, maxScore: 100, weight: 60, weightedScore: 60, evidence: [] },
      resourceSynergy: { score: 100, maxScore: 100, weight: 60, weightedScore: 60, evidence: [] },
    },
    evidence: [],
    warnings: [],
  });

  const scores = [
    { ...mockScore(900), candidateKey: 'team-A', stageKey: `${patchContext37.patchId}:stage-1` },
    { ...mockScore(890), candidateKey: 'team-A', stageKey: `${patchContext37.patchId}:stage-2` },
    { ...mockScore(880), candidateKey: 'team-B', stageKey: `${patchContext37.patchId}:stage-1` },
    { ...mockScore(100), candidateKey: 'team-B', stageKey: `${patchContext37.patchId}:stage-2` },
  ];

  // Capacity: filler1 and filler2 have 10 capacity (can do both stages),
  // but char1 and char2 have capacity 5 each (can only do one 5-vigor stage)!
  const context: ToAOptimizationContext = {
    cycleId: 'cycle-s40',
    patchId: patchContext37.patchId,
    stages: [stage1, stage2],
    candidates: [teamA, teamB],
    scores,
    roster: { resonatorIds: ['char-1', 'char-2', 'filler-1', 'filler-2'] },
    vigorCapacities: {
      'char-1': 5,
      'char-2': 5,
      'filler-1': 10,
      'filler-2': 10,
    },
  };

  const result = optimizeToA(context);

  assert.equal(result.status, 'OPTIMAL');
  assert.equal(
    result.totalScore,
    1770,
    'Global optimizer must discover optimal 1770 score over greedy 1000'
  );
  assert.equal(result.assignments[0].teamKey, 'team-B', 'Stage 1 must take Team B');
  assert.equal(result.assignments[1].teamKey, 'team-A', 'Stage 2 must take Team A');
});

test('Global Optimizer - Vigor Boundary & Accounting Rules', () => {
  // Test 1: Exact capacity boundary (5 + 5 = 10 capacity)
  const roster: OwnedRoster = {
    resonatorIds: [jinhsi.id, verina.id, jianxin.id],
  };

  const team: TeamCandidate = {
    id: 'res-jinhsi:res-verina:res-jianxin',
    members: [{ resonator: jinhsi }, { resonator: verina }, { resonator: jianxin }],
  };

  const stage5A: ToAStage = {
    ...hazardTowerFloor1,
    id: 'stage-5a',
    vigorCost: 5,
  };
  const stage5B: ToAStage = {
    ...hazardTowerFloor2,
    id: 'stage-5b',
    vigorCost: 5,
  };
  const stage1Extra: ToAStage = {
    ...resonantTowerFloor1,
    id: 'stage-1-extra',
    vigorCost: 1,
  };

  // Two 5-vigor stages with capacity 10 -> FEASIBLE (5+5 = 10)
  const feasibleContext: ToAOptimizationContext = {
    cycleId: 'cycle-s40',
    patchId: patchContext37.patchId,
    stages: [stage5A, stage5B],
    candidates: [team],
    roster,
    defaultVigorCapacity: 10,
  };
  const feasibleResult = optimizeToA(feasibleContext);
  assert.equal(feasibleResult.status, 'OPTIMAL');
  assert.equal(feasibleResult.totalVigorConsumed, (5 + 5) * 3);

  // Character nearly exhausted / zero remaining vigor
  const jinhsiUsage = feasibleResult.vigorUsage.find((u) => u.resonatorId === jinhsi.id);
  assert.equal(jinhsiUsage?.used, 10);
  assert.equal(jinhsiUsage?.remaining, 0);

  // Adding another 1-vigor stage with capacity 10 -> INFEASIBLE (10 + 1 = 11 > 10)
  const infeasibleContext: ToAOptimizationContext = {
    cycleId: 'cycle-s40',
    patchId: patchContext37.patchId,
    stages: [stage5A, stage5B, stage1Extra],
    candidates: [team],
    roster,
    defaultVigorCapacity: 10,
  };
  const infeasibleResult = optimizeToA(infeasibleContext);
  assert.equal(infeasibleResult.status, 'INFEASIBLE');
  assert.ok(infeasibleResult.infeasibilityReasons && infeasibleResult.infeasibilityReasons.length > 0);
});

test('Global Optimizer - Determinism Across Repeated Runs', () => {
  const roster: OwnedRoster = {
    resonatorIds: [jinhsi.id, verina.id, jianxin.id, yangyang.id],
  };

  const candidates = generateTeamCandidates(roster, {
    patchContext: patchContext37,
    availableResonators: availableResonatorsList,
  });

  const optContext: ToAOptimizationContext = {
    cycleId: 'cycle-s40',
    patchId: patchContext37.patchId,
    stages: [resonantTowerFloor1, resonantTowerFloor4],
    candidates,
    roster,
    defaultVigorCapacity: 10,
  };

  const run1 = optimizeToA(optContext);
  const run2 = optimizeToA(optContext);

  assert.equal(run1.status, run2.status);
  assert.equal(run1.totalScore, run2.totalScore);
  assert.equal(
    JSON.stringify(run1.assignments),
    JSON.stringify(run2.assignments),
    'Assignments must be byte-for-byte identical across runs'
  );
  assert.equal(
    JSON.stringify(run1.objectiveBreakdown),
    JSON.stringify(run2.objectiveBreakdown),
    'Objective breakdowns must match exactly'
  );
});

test('Global Optimizer - Season 40 Regression (6 Stages & Full 12 Stages)', () => {
  // Create a synthetic roster with 20 characters capable of satisfying all 12 stages
  // Full 12 stages require 40 vigor total across 3 character slots (minimum 12 unique resonators)
  const { roster, resonators } = createSyntheticRoster(24);

  const candidates = generateTeamCandidates(roster, {
    patchContext: patchContext37,
    availableResonators: resonators,
  });
  assert.ok(candidates.length > 0);

  // 1. Regression on 6 stages
  const reg6Context: ToAOptimizationContext = {
    cycleId: 'cycle-s40',
    patchId: patchContext37.patchId,
    stages: allSeason40Stages,
    candidates,
    roster,
    defaultVigorCapacity: 10,
  };
  const res6 = optimizeToA(reg6Context);
  assert.equal(res6.status, 'OPTIMAL');
  assert.equal(res6.assignments.length, 6);
  assert.ok(res6.totalScore > 0);

  // Verify Vigor constraint satisfied for every resonator
  for (const v of res6.vigorUsage) {
    assert.ok(v.used <= v.capacity, `Resonator ${v.resonatorId} exceeded capacity (${v.used} > ${v.capacity})`);
  }

  // 2. Full 12 Stages Optimization (Resonant 1..4, Hazard 1..4, Echoing 1..4)
  const reg12Context: ToAOptimizationContext = {
    cycleId: 'cycle-s40',
    patchId: patchContext37.patchId,
    stages: fullSeason40Stages,
    candidates,
    roster,
    defaultVigorCapacity: 10,
  };
  const res12 = optimizeToA(reg12Context);
  assert.equal(res12.status, 'OPTIMAL');
  assert.equal(res12.assignments.length, 12, 'All 12 Season 40 stages must be assigned');
  assert.ok(res12.totalScore > 0);
  assert.ok(res12.evidence.length === 12, 'Evidence provided for each assigned stage');

  // Verify total vigor consumed matches expected floor vigor costs
  const expectedTotalVigorCost = fullSeason40Stages.reduce((s, st) => s + st.vigorCost, 0) * 3;
  assert.equal(res12.totalVigorConsumed, expectedTotalVigorCost);

  // Verify sum of assigned stage scores matches totalScore
  const sumAssignedScores = res12.assignments.reduce((sum, a) => sum + a.teamScore.totalScore, 0);
  assert.equal(res12.totalScore, sumAssignedScores);
});

test('Global Optimizer - 50-Resonator Performance Benchmark (12 Stages)', () => {
  const { roster, resonators } = createSyntheticRoster(50);

  const startTimeGen = performance.now();
  const candidates = generateTeamCandidates(roster, {
    patchContext: patchContext37,
    availableResonators: resonators,
  });
  const genDuration = performance.now() - startTimeGen;
  assert.equal(candidates.length, 19600);

  const optContext: ToAOptimizationContext = {
    cycleId: 'cycle-s40',
    patchId: patchContext37.patchId,
    stages: fullSeason40Stages, // 12 Season 40 stages
    candidates,
    roster,
    defaultVigorCapacity: 10,
    maxCandidatesPerStage: 50, // safe candidate reduction for high-throughput 50-resonator search
  };

  const startTimeOpt = performance.now();
  const result = optimizeToA(optContext);
  const optDuration = performance.now() - startTimeOpt;

  assert.equal(result.status, 'OPTIMAL');
  assert.equal(result.assignments.length, 12);
  assert.ok(result.totalScore > 0);

  console.log(
    `[BENCHMARK] Global Optimizer: 50 Resonators, 19600 Candidates, 12 Stages -> ` +
    `Matrix: ${result.metrics.candidateStageMatrixSize}, Explored: ${result.metrics.searchStatesExplored}, ` +
    `Pruned: ${result.metrics.prunedStatesCount}, Solver Time: ${optDuration.toFixed(2)}ms (Gen Time: ${genDuration.toFixed(2)}ms)`
  );

  assert.ok(
    optDuration < 5000,
    `12-stage global optimization took ${optDuration.toFixed(2)}ms (must be well under 5s)`
  );
});
