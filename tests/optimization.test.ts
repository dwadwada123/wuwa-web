import test from 'node:test';
import assert from 'node:assert/strict';

import {
  optimizeToA,
  VigorTracker,
  computeObjectiveBreakdown,
  compareObjectiveBreakdowns,
  generateTeamCandidates,
  scoreTeamForStage,
  getCandidateKey,
} from '../lib/engine/index.ts';

import type {
  ToAOptimizationContext,
  StageAssignment,
  OptimizationObjectiveBreakdown,
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
  objectiveBreakdown: OptimizationObjectiveBreakdown;
} {
  const stages = context.stages;
  const candidates = context.candidates || [];
  const vigorTracker = new VigorTracker(context);
  const scoringContext = {
    patchContext: { patchId: context.patchId, version: '' },
    roster: context.roster,
  };

  const scoreLookup = new Map<string, any>();
  if (context.scores) {
    if (context.scores instanceof Map) {
      for (const [key, s] of context.scores.entries()) {
        scoreLookup.set(key, s);
      }
    } else {
      for (const s of context.scores) {
        scoreLookup.set(`${s.stageKey}:${s.candidateKey}`, s);
      }
    }
  }

  const getScore = (c: TeamCandidate, s: ToAStage) => {
    const cKey = getCandidateKey(c);
    const stageKey = `${s.patchId}:${s.id}`;
    let cached = scoreLookup.get(`${stageKey}:${cKey}`);
    if (!cached && c.id) {
      cached = scoreLookup.get(`${stageKey}:${c.id}`);
    }
    if (cached) return cached;
    return scoreTeamForStage(c, s, scoringContext);
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
      const score = getScore(c, stage);
      if (!score.valid || score.totalScore <= 0) continue;

      if (!vigorTracker.canAfford(c, stage)) continue;

      vigorTracker.apply(c, stage);
      current.push({
        stageId: stage.id,
        stageIndex: stage.stageIndex,
        vigorCost: stage.vigorCost,
        teamKey: c.id || getCandidateKey(c),
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
    return {
      status: 'INFEASIBLE',
      totalScore: 0,
      assignments: [],
      objectiveBreakdown: computeObjectiveBreakdown([]),
    };
  }

  return {
    status: 'OPTIMAL',
    totalScore: bestBreakdown.primaryScore,
    assignments: bestAssignments,
    objectiveBreakdown: bestBreakdown,
  };
}

/**
 * 9.1 EXACT mode vs Exhaustive Oracle on Small Fixtures
 */
test('Global Optimizer - EXACT Mode vs Exhaustive Oracle on Small Fixtures', () => {
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
  const exactResult = optimizeToA(optContext, { mode: 'EXACT' });

  assert.equal(exactResult.status, 'OPTIMAL');
  assert.equal(exactResult.status, oracleResult.status);
  assert.equal(exactResult.totalScore, oracleResult.totalScore);
  assert.equal(exactResult.assignments.length, oracleResult.assignments.length);
  assert.equal(
    exactResult.objectiveBreakdown.canonicalAssignmentKey,
    oracleResult.objectiveBreakdown.canonicalAssignmentKey
  );

  for (let i = 0; i < stages.length; i++) {
    assert.equal(exactResult.assignments[i].stageId, oracleResult.assignments[i].stageId);
    assert.equal(exactResult.assignments[i].teamKey, oracleResult.assignments[i].teamKey);
  }
});

/**
 * 9.4 Exhaustive Oracle on Randomized Small Problems
 */
test('Global Optimizer - Exhaustive Oracle on Randomized Small Problems', () => {
  // Linear Congruential Generator for deterministic pseudo-random fixtures
  function createRng(seed: number) {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
  }

  const rng = createRng(20261007);

  // Run 10 randomized problem instances
  for (let trial = 1; trial <= 10; trial++) {
    const numResonators = 5 + Math.floor(rng() * 3); // 5 to 7 resonators
    const numStages = 2 + Math.floor(rng() * 3); // 2 to 4 stages

    const resonators: Resonator[] = [];
    const resonatorIds: string[] = [];

    const elements = ['Glacio', 'Fusion', 'Electro', 'Aero', 'Spectro', 'Havoc'] as const;
    const roles = ['MAIN_DPS', 'SUB_DPS', 'SUPPORT'] as const;

    for (let r = 0; r < numResonators; r++) {
      const id = `res-rand-${trial}-${r}`;
      resonatorIds.push(id);
      resonators.push({
        id,
        name: `Rand Resonator ${trial}-${r}`,
        element: elements[r % elements.length],
        weaponType: 'Sword',
        rarity: 5,
        releaseDate: '2024-05-22',
        baseHpLvl90: 10000,
        baseAtkLvl90: 400 + Math.floor(rng() * 100),
        baseDefLvl90: 1100,
        roles: [{ code: roles[r % roles.length], label: 'Role', isPrimary: true }],
        combatTags: [],
        abilities: [],
      });
    }

    const roster: OwnedRoster = { resonatorIds };
    const candidates = generateTeamCandidates(roster, {
      patchContext: patchContext37,
      availableResonators: resonators,
    });

    const stages: ToAStage[] = [];
    for (let s = 0; s < numStages; s++) {
      const vigorCost = 1 + Math.floor(rng() * 4); // 1 to 4 vigor cost
      stages.push({
        id: `rand-stage-${trial}-${s}`,
        patchId: patchContext37.patchId,
        stageIndex: s + 1,
        vigorCost,
        areaEffects: [],
        challengeGoals: [],
        waves: [],
      });
    }

    // Randomized Vigor Capacities
    const vigorCapacities: Record<string, number> = {};
    for (const rId of resonatorIds) {
      vigorCapacities[rId] = 4 + Math.floor(rng() * 6); // 4 to 9 capacity
    }

    // Randomized scores and buff compatibility
    const scores: any[] = [];
    for (const stage of stages) {
      for (const cand of candidates) {
        const cKey = getCandidateKey(cand);
        const totalScore = 100 + Math.floor(rng() * 800); // 100 to 899
        const buffScore = 10 + Math.floor(rng() * 170); // 10 to 179

        scores.push({
          candidateKey: cKey,
          stageKey: `${stage.patchId}:${stage.id}`,
          valid: true,
          totalScore,
          dimensions: {
            roleCoverage: { score: 100, maxScore: 100, weight: 120, weightedScore: 120, evidence: [] },
            elementalMatchup: { score: 100, maxScore: 100, weight: 160, weightedScore: 160, evidence: [] },
            enemyMatchup: { score: 100, maxScore: 100, weight: 100, weightedScore: 100, evidence: [] },
            stageBuffCompatibility: { score: buffScore, maxScore: 100, weight: 180, weightedScore: buffScore, evidence: [] },
            offensiveSynergy: { score: 100, maxScore: 100, weight: 140, weightedScore: 140, evidence: [] },
            sustain: { score: 100, maxScore: 100, weight: 80, weightedScore: 80, evidence: [] },
            resistanceUtility: { score: 100, maxScore: 100, weight: 100, weightedScore: 100, evidence: [] },
            coordinatedAttackSynergy: { score: 100, maxScore: 100, weight: 60, weightedScore: 60, evidence: [] },
            resourceSynergy: { score: 100, maxScore: 100, weight: 60, weightedScore: 60, evidence: [] },
          },
          evidence: [],
          warnings: [],
        });
      }
    }

    const testContext: ToAOptimizationContext = {
      cycleId: `cycle-trial-${trial}`,
      patchId: patchContext37.patchId,
      stages,
      candidates,
      scores,
      roster,
      vigorCapacities,
      defaultVigorCapacity: 8,
    };

    const oracleResult = bruteForceOracle(testContext);
    const exactResult = optimizeToA(testContext, { mode: 'EXACT' });

    assert.equal(
      exactResult.status,
      oracleResult.status,
      `Trial ${trial}: Status must match oracle`
    );

    if (oracleResult.status === 'OPTIMAL') {
      assert.equal(
        exactResult.totalScore,
        oracleResult.totalScore,
        `Trial ${trial}: Primary score must match oracle exactly`
      );
      assert.equal(
        exactResult.objectiveBreakdown.minStageScore,
        oracleResult.objectiveBreakdown.minStageScore,
        `Trial ${trial}: Min stage score must match oracle`
      );
      assert.equal(
        exactResult.objectiveBreakdown.totalStageBuffScore,
        oracleResult.objectiveBreakdown.totalStageBuffScore,
        `Trial ${trial}: Total stage buff score must match oracle`
      );
      assert.equal(
        exactResult.totalVigorConsumed,
        oracleResult.objectiveBreakdown.totalVigorConsumed,
        `Trial ${trial}: Total vigor consumed must match oracle`
      );
      assert.equal(
        exactResult.distinctTeamsCount,
        oracleResult.objectiveBreakdown.distinctTeamsCount,
        `Trial ${trial}: Distinct team count must match oracle`
      );
      assert.equal(
        exactResult.objectiveBreakdown.canonicalAssignmentKey,
        oracleResult.objectiveBreakdown.canonicalAssignmentKey,
        `Trial ${trial}: Canonical assignment must match oracle exactly`
      );
    }
  }
});

/**
 * 9.2 BEST_EFFORT mode Truncation Semantics
 */
test('Global Optimizer - BEST_EFFORT Mode Truncation Semantics (Tiny Search-State Limit)', () => {
  const { roster, resonators } = createSyntheticRoster(12);

  const candidates = generateTeamCandidates(roster, {
    patchContext: patchContext37,
    availableResonators: resonators,
  });

  const optContext: ToAOptimizationContext = {
    cycleId: 'cycle-s40',
    patchId: patchContext37.patchId,
    stages: allSeason40Stages,
    candidates,
    roster,
    defaultVigorCapacity: 10,
  };

  // With a tiny state budget of 2, search is interrupted early
  const result = optimizeToA(optContext, {
    mode: 'BEST_EFFORT',
    maxSearchStates: 2,
  });

  assert.equal(result.mode, 'BEST_EFFORT');
  assert.equal(
    result.status,
    'BEST_FOUND',
    'Interrupted search in BEST_EFFORT mode must report BEST_FOUND'
  );
  assert.notEqual(
    result.status,
    'OPTIMAL',
    'BEST_EFFORT mode must NEVER report OPTIMAL when cut short'
  );
});

/**
 * 9.3 Reduction Safety in EXACT Mode
 */
test('Global Optimizer - Reduction Safety in EXACT Mode', () => {
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
    maxCandidatesPerStage: 1, // Heuristic limit attached to context
  };

  // In EXACT mode: maxCandidatesPerStage must be IGNORED
  const exactResult = optimizeToA(optContext, {
    mode: 'EXACT',
    maxCandidatesPerStage: 1,
  });
  assert.equal(exactResult.status, 'OPTIMAL');
  assert.equal(exactResult.mode, 'EXACT');
  // All 4 candidates evaluated across 2 stages = 8 evaluations
  assert.equal(exactResult.metrics.candidateStageMatrixSize, 8);

  // In BEST_EFFORT mode: heuristic reduction IS applied
  const bestEffortResult = optimizeToA(optContext, {
    mode: 'BEST_EFFORT',
    maxCandidatesPerStage: 1,
  });
  assert.equal(bestEffortResult.status, 'BEST_FOUND');
  assert.equal(bestEffortResult.mode, 'BEST_EFFORT');
});

/**
 * 9.5 Greedy Counterexample
 */
test('Global Optimizer - Opportunity Cost & Greedy Counterexample', () => {
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

  const result = optimizeToA(context, { mode: 'EXACT' });

  assert.equal(result.status, 'OPTIMAL');
  assert.equal(
    result.totalScore,
    1770,
    'Global optimizer must discover optimal 1770 score over greedy 1000'
  );
  assert.equal(result.assignments[0].teamKey, 'team-B', 'Stage 1 must take Team B');
  assert.equal(result.assignments[1].teamKey, 'team-A', 'Stage 2 must take Team A');
});

/**
 * Vigor Boundary & Accounting Rules
 */
test('Global Optimizer - Vigor Boundary & Accounting Rules', () => {
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
  const feasibleResult = optimizeToA(feasibleContext, { mode: 'EXACT' });
  assert.equal(feasibleResult.status, 'OPTIMAL');
  assert.equal(feasibleResult.totalVigorConsumed, (5 + 5) * 3);

  // Adding another 1-vigor stage with capacity 10 -> INFEASIBLE (10 + 1 = 11 > 10)
  const infeasibleContext: ToAOptimizationContext = {
    cycleId: 'cycle-s40',
    patchId: patchContext37.patchId,
    stages: [stage5A, stage5B, stage1Extra],
    candidates: [team],
    roster,
    defaultVigorCapacity: 10,
  };
  const infeasibleResult = optimizeToA(infeasibleContext, { mode: 'EXACT' });
  assert.equal(infeasibleResult.status, 'INFEASIBLE');
  assert.ok(infeasibleResult.infeasibilityReasons && infeasibleResult.infeasibilityReasons.length > 0);
});

/**
 * Determinism Across Repeated Runs
 */
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

  const run1 = optimizeToA(optContext, { mode: 'EXACT' });
  const run2 = optimizeToA(optContext, { mode: 'EXACT' });

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

/**
 * Season 40 Regression (12 Stages in BEST_EFFORT Mode)
 */
test('Global Optimizer - Season 40 Regression (12 Stages in BEST_EFFORT Mode)', () => {
  const { roster, resonators } = createSyntheticRoster(24);

  const candidates = generateTeamCandidates(roster, {
    patchContext: patchContext37,
    availableResonators: resonators,
  });
  assert.ok(candidates.length > 0);

  const reg12Context: ToAOptimizationContext = {
    cycleId: 'cycle-s40',
    patchId: patchContext37.patchId,
    stages: fullSeason40Stages,
    candidates,
    roster,
    defaultVigorCapacity: 10,
  };

  const res12 = optimizeToA(reg12Context, {
    mode: 'BEST_EFFORT',
    maxCandidatesPerStage: 50,
    maxSearchStates: 200_000,
  });

  assert.equal(res12.mode, 'BEST_EFFORT');
  assert.equal(res12.status, 'BEST_FOUND');
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

/**
 * 50-Resonator Performance Benchmark (12 Stages in BEST_EFFORT Mode)
 */
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
  };

  const startTimeOpt = performance.now();
  const result = optimizeToA(optContext, {
    mode: 'BEST_EFFORT',
    maxCandidatesPerStage: 50,
    maxSearchStates: 200_000,
  });
  const optDuration = performance.now() - startTimeOpt;

  assert.equal(result.mode, 'BEST_EFFORT');
  assert.equal(result.status, 'BEST_FOUND');
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
