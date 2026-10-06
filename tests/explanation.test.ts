import test from 'node:test';
import assert from 'node:assert/strict';

import {
  optimizeToA,
  generateTeamCandidates,
  scoreTeamForStage,
  buildOptimizationExplanation,
  parseStageIdentity,
  buildStageScoreBreakdown,
  explainAreaEffects,
  explainEnemyMatchup,
  explainRoleCoverage,
  explainOffensiveSynergies,
  explainSustain,
  explainOptimality,
} from '../lib/engine/index.ts';

import type {
  ToAOptimizationContext,
  ToAOptimizationResult,
  StageAssignment,
} from '../lib/engine/optimization/types.ts';

import type {
  GlobalOptimizationExplanation,
  StageExplanation,
  ExplanationReason,
} from '../lib/engine/explanation/types.ts';

import {
  patchContext37,
  availableResonatorsList,
  createSyntheticRoster,
} from './fixtures/domain-fixtures.ts';

import {
  hazardTowerFloor1,
  hazardTowerFloor2,
  hazardTowerFloor3,
  resonantTowerFloor1,
  resonantTowerFloor4,
  echoingTowerFloor1,
} from './fixtures/season40-fixtures.ts';

/**
 * Helper to build an optimization context with scored candidates.
 */
function createTestContext(stages = [hazardTowerFloor1, hazardTowerFloor2]) {
  const { roster, resonators } = createSyntheticRoster(6);
  const candidates = generateTeamCandidates(roster, {
    patchContext: patchContext37,
    availableResonators: resonators,
  });

  const scoringContext = {
    patchContext: patchContext37,
    roster,
  };

  const scores = new Map<string, any>();
  for (const c of candidates) {
    for (const s of stages) {
      const score = scoreTeamForStage(c, s, scoringContext);
      scores.set(`${score.candidateKey}::${score.stageKey}`, score);
    }
  }

  const context: ToAOptimizationContext = {
    cycleId: 'cycle-s40',
    patchId: patchContext37.patchId,
    stages,
    candidates,
    scores,
    roster,
    defaultVigorCapacity: 10,
  };

  return { context, candidates, stages, roster };
}

test('Stage Explanation - Identity, Scores, Dimensions, Area Effects, and Vigor', () => {
  const { context } = createTestContext([hazardTowerFloor1, resonantTowerFloor1]);
  const result = optimizeToA(context, { mode: 'EXACT' });

  assert.equal(result.status, 'OPTIMAL');

  const explanation = buildOptimizationExplanation(context, result);

  assert.equal(explanation.stages.length, 2);

  // Stage 1 (Hazard Tower Floor 1)
  const hazardStageExpl = explanation.stages[0];
  assert.equal(hazardStageExpl.towerName, 'Hazard Tower');
  assert.equal(hazardStageExpl.floor, 1);
  assert.ok(hazardStageExpl.selectedTeamKey.length > 0);
  assert.ok(hazardStageExpl.score > 0);

  // Score breakdown verification
  const dims = hazardStageExpl.scoreBreakdown.dimensions;
  assert.ok(dims.roleCoverage);
  assert.ok(dims.elementalMatchup);
  assert.ok(dims.enemyMatchup);
  assert.ok(dims.stageBuffCompatibility);
  assert.ok(dims.offensiveSynergy);
  assert.ok(dims.sustain);
  assert.ok(dims.resistanceUtility);
  assert.ok(dims.coordinatedAttackSynergy);
  assert.ok(dims.resourceSynergy);

  // Top contributors sorted deterministically
  const top = hazardStageExpl.scoreBreakdown.topContributors;
  assert.equal(top.length, 9);
  for (let i = 0; i < top.length - 1; i++) {
    assert.ok(
      top[i].weightedScore >= top[i + 1].weightedScore,
      'Top contributors must be sorted by weightedScore descending'
    );
  }

  // Area effects explanation
  const utilizedBuffs = hazardStageExpl.primaryReasons.filter(
    (r) => r.code === 'AREA_EFFECT_UTILIZED'
  );
  assert.ok(utilizedBuffs.length > 0, 'Hazard stage should have utilized area effects');
  for (const b of utilizedBuffs) {
    assert.equal(b.category, 'AREA_EFFECT');
    assert.equal(b.importance, 'PRIMARY');
    assert.ok(b.facts.areaEffectId);
    assert.ok(b.facts.name);
  }

  // Vigor impact
  assert.equal(hazardStageExpl.resourceImpact.stageCost, 5);
  assert.equal(hazardStageExpl.resourceImpact.characterVigorConsumed, 15);
  assert.equal(hazardStageExpl.resourceImpact.members.length, 3);
  for (const m of hazardStageExpl.resourceImpact.members) {
    assert.equal(m.stageCost, 5);
    assert.equal(m.usedAfterStage, m.usedBeforeStage + 5);
    assert.equal(m.remainingAfterStage, m.capacity - m.usedAfterStage);
  }

  // Stage 2 (Resonant Tower Floor 1)
  const resonantStageExpl = explanation.stages[1];
  assert.equal(resonantStageExpl.towerName, 'Resonant Tower');
  assert.equal(resonantStageExpl.floor, 1);
  assert.equal(resonantStageExpl.resourceImpact.stageCost, 1);
  assert.equal(resonantStageExpl.resourceImpact.characterVigorConsumed, 3);
});

test('Global Explanation - Representation, Total Score, Vigor, and Provenance', () => {
  const { context } = createTestContext([hazardTowerFloor1, hazardTowerFloor2]);
  const result = optimizeToA(context, { mode: 'EXACT' });

  const explanation = buildOptimizationExplanation(context, result);

  // Status & Optimality
  assert.equal(explanation.status, 'OPTIMAL');
  assert.equal(explanation.optimality, 'FULL_LEXICOGRAPHIC_PROVEN');
  assert.equal(explanation.totalScore, result.totalScore);
  assert.equal(explanation.globalPrimaryUpperBound, result.globalPrimaryUpperBound);

  // Stages
  assert.equal(explanation.stages.length, 2);

  // Vigor Explanation
  assert.equal(explanation.vigor.totalVigorConsumed, result.totalVigorConsumed);
  assert.equal(explanation.vigor.totalRosterVigorCapacity, 6 * 10); // 6 resonators * 10
  assert.ok(explanation.vigor.utilizationPercentage > 0);
  assert.equal(explanation.vigor.resonators.length, 6);

  // Summary reasons
  assert.ok(explanation.summaryReasons.length >= 3);
  const optimalityReason = explanation.summaryReasons.find((r) =>
    r.code.startsWith('OPTIMALITY_')
  );
  assert.ok(optimalityReason);
  assert.equal(optimalityReason?.category, 'GLOBAL_OPTIMIZATION');
  assert.equal(optimalityReason?.importance, 'PRIMARY');

  const scoreReason = explanation.summaryReasons.find(
    (r) => r.code === 'GLOBAL_SCORE_SUMMARY'
  );
  assert.ok(scoreReason);
  assert.equal(scoreReason?.facts.totalScore, result.totalScore);

  // Evidence provenance
  assert.ok(explanation.evidence.length >= 4);
  const sources = new Set(explanation.evidence.map((e) => e.source));
  assert.ok(sources.has('GAME_DATA'));
  assert.ok(sources.has('OPTIMIZER'));
  assert.ok(sources.has('TEAM_SCORING'));
  assert.ok(sources.has('RULE_ENGINE'));

  for (const ev of explanation.evidence) {
    assert.ok(ev.code.length > 0);
    assert.ok(Object.keys(ev.facts).length > 0);
  }
});

test('Optimality Semantics - Strict Mathematical Language for All States', () => {
  const baseResult: ToAOptimizationResult = {
    status: 'OPTIMAL',
    mode: 'EXACT',
    optimality: 'FULL_LEXICOGRAPHIC_PROVEN',
    globalPrimaryUpperBound: 7388,
    totalScore: 7388,
    assignments: [],
    vigorUsage: [],
    totalVigorConsumed: 60,
    distinctTeamsCount: 4,
    objectiveBreakdown: {
      primaryScore: 7388,
      minStageScore: 800,
      totalStageBuffScore: 600,
      totalVigorConsumed: 60,
      distinctTeamsCount: 4,
      canonicalAssignmentKey: '',
    },
    evidence: [],
    metrics: {
      stagesCount: 4,
      candidateStageMatrixSize: 100,
      searchStatesExplored: 150,
      prunedStatesCount: 30,
      durationMs: 5,
    },
  };

  // 1. FULL_LEXICOGRAPHIC_PROVEN
  const explFull = explainOptimality(baseResult);
  assert.equal(explFull.title, 'Full Lexicographic Optimality Proven');
  assert.equal(
    explFull.description,
    'The assignment is fully proven optimal under the configured objective and tie-break rules.'
  );
  assert.equal(explFull.isGloballyOptimalPrimary, true);
  assert.equal(explFull.isFullLexicographicOptimal, true);

  // 2. PRIMARY_PROVEN
  const primaryResult: ToAOptimizationResult = {
    ...baseResult,
    status: 'BEST_FOUND',
    mode: 'BEST_EFFORT',
    optimality: 'PRIMARY_PROVEN',
  };
  const explPrimary = explainOptimality(primaryResult);
  assert.equal(explPrimary.title, 'Primary Objective Proven Optimal');
  assert.equal(
    explPrimary.description,
    'The optimizer found a feasible assignment whose total score reaches the mathematically proven global upper bound.'
  );
  assert.equal(explPrimary.isGloballyOptimalPrimary, true);
  assert.equal(explPrimary.isFullLexicographicOptimal, false);

  // 3. NOT_PROVEN
  const notProvenResult: ToAOptimizationResult = {
    ...baseResult,
    status: 'BEST_FOUND',
    mode: 'BEST_EFFORT',
    optimality: 'NOT_PROVEN',
    totalScore: 7200,
  };
  const explNotProven = explainOptimality(notProvenResult);
  assert.equal(explNotProven.title, 'Best Discovered Solution (Not Proven Optimal)');
  assert.equal(
    explNotProven.description,
    'The optimizer found the best solution discovered within the available search budget, but full optimality was not proven.'
  );
  assert.equal(explNotProven.isGloballyOptimalPrimary, false);
  assert.equal(explNotProven.isFullLexicographicOptimal, false);

  // 4. INFEASIBLE
  const infeasibleResult: ToAOptimizationResult = {
    ...baseResult,
    status: 'INFEASIBLE',
    optimality: undefined,
    totalScore: 0,
    infeasibilityReasons: ['Vigor limit exceeded'],
  };
  const explInfeasible = explainOptimality(infeasibleResult);
  assert.equal(explInfeasible.title, 'Optimization Infeasible');
  assert.equal(
    explInfeasible.description,
    'No feasible joint assignment of valid teams satisfies the roster Vigor capacity across the requested stages.'
  );
  assert.equal(explInfeasible.isGloballyOptimalPrimary, false);
  assert.equal(explInfeasible.isFullLexicographicOptimal, false);
});

test('Evidence Integrity - All Explanation Reasons Map to Structured Facts', () => {
  const { context } = createTestContext([hazardTowerFloor1, resonantTowerFloor1]);
  const result = optimizeToA(context, { mode: 'EXACT' });

  const explanation = buildOptimizationExplanation(context, result);

  const checkReason = (r: ExplanationReason) => {
    assert.ok(r.code, 'Reason must have code');
    assert.match(r.code, /^[A-Z0-9_]+$/, `Code ${r.code} must be UPPERCASE_SNAKE_CASE`);
    assert.ok(r.title, 'Reason must have title');
    assert.ok(r.facts, 'Reason must have facts object');
    assert.ok(
      typeof r.facts === 'object' && Object.keys(r.facts).length > 0,
      `Reason ${r.code} must have non-empty facts`
    );
    assert.ok(
      ['PRIMARY', 'SECONDARY', 'INFO'].includes(r.importance),
      `Importance ${r.importance} must be valid`
    );
    assert.ok(
      [
        'STAGE_MATCHUP',
        'ENEMY_MATCHUP',
        'AREA_EFFECT',
        'ROLE_COVERAGE',
        'OFFENSIVE_SYNERGY',
        'SUSTAIN',
        'RESOURCE',
        'VIGOR',
        'GLOBAL_OPTIMIZATION',
        'TRADEOFF',
      ].includes(r.category),
      `Category ${r.category} must be valid`
    );
  };

  for (const r of explanation.summaryReasons) checkReason(r);
  for (const r of explanation.globalTradeoffs) checkReason(r);
  for (const s of explanation.stages) {
    for (const r of s.primaryReasons) checkReason(r);
    for (const r of s.supportingReasons) checkReason(r);
    for (const r of s.tradeoffs) checkReason(r);
  }
});

test('Determinism - Byte-for-Byte Identical Output Across Repeated Runs', () => {
  const { context } = createTestContext([hazardTowerFloor1, resonantTowerFloor1]);
  const result = optimizeToA(context, { mode: 'EXACT' });

  const explanationA = buildOptimizationExplanation(context, result);
  const explanationB = buildOptimizationExplanation(context, result);

  const serializedA = JSON.stringify(explanationA, null, 2);
  const serializedB = JSON.stringify(explanationB, null, 2);

  assert.equal(
    serializedA,
    serializedB,
    'Explanation serialization must be byte-for-byte identical'
  );
});

test('Stage Identity Parsing - Hazard, Resonant, and Echoing Towers', () => {
  const p1 = parseStageIdentity(hazardTowerFloor1);
  assert.equal(p1.towerName, 'Hazard Tower');
  assert.equal(p1.floor, 1);

  const p2 = parseStageIdentity(resonantTowerFloor4);
  assert.equal(p2.towerName, 'Resonant Tower');
  assert.equal(p2.floor, 4);

  const p3 = parseStageIdentity(echoingTowerFloor1);
  assert.equal(p3.towerName, 'Echoing Tower');
  assert.equal(p3.floor, 1);
});

test('Local vs Global Opportunity Cost Tradeoff Explanation', () => {
  const { context } = createTestContext([hazardTowerFloor1, hazardTowerFloor2]);
  const result = optimizeToA(context, { mode: 'EXACT' });

  const explanation = buildOptimizationExplanation(context, result);

  for (const stage of explanation.stages) {
    assert.equal(stage.tradeoffs.length, 1);
    const tr = stage.tradeoffs[0];
    assert.ok(
      tr.code === 'STAGE_OPTIMAL_LOCAL_AND_GLOBAL' ||
        tr.code === 'STAGE_GLOBAL_OPPORTUNITY_TRADEOFF'
    );
    assert.ok(tr.facts.stageScore !== undefined);
  }

  // Global tradeoff explanation
  assert.ok(explanation.globalTradeoffs.length > 0);
  const globalZeroCost = explanation.globalTradeoffs.find(
    (t) => t.code === 'GLOBAL_ZERO_OPPORTUNITY_COST'
  );
  const globalCompromise = explanation.globalTradeoffs.find(
    (t) => t.code === 'GLOBAL_OPPORTUNITY_COST_TRADEOFF'
  );
  assert.ok(
    globalZeroCost !== undefined || globalCompromise !== undefined,
    'Must have a global opportunity cost evaluation'
  );
});

test('Canonical Roster & Stage Explanation - Jinhsi, Verina, Jianxin on Boss Floor', () => {
  const roster = {
    userId: 'user-canon',
    resonatorIds: ['res-jinhsi', 'res-verina', 'res-jianxin', 'res-yangyang'],
  };
  const candidates = generateTeamCandidates(roster, {
    patchContext: patchContext37,
    availableResonators: availableResonatorsList,
  });

  const stages = [resonantTowerFloor4]; // Mech Abomination boss stage
  const scoringContext = { patchContext: patchContext37, roster };
  const scores = new Map<string, any>();
  for (const c of candidates) {
    const s = scoreTeamForStage(c, resonantTowerFloor4, scoringContext);
    scores.set(`${s.candidateKey}::${s.stageKey}`, s);
  }

  const context: ToAOptimizationContext = {
    cycleId: 'cycle-s40',
    patchId: patchContext37.patchId,
    stages,
    candidates,
    scores,
    roster,
  };

  const result = optimizeToA(context, { mode: 'EXACT' });
  assert.equal(result.status, 'OPTIMAL');

  const explanation = buildOptimizationExplanation(context, result);
  assert.equal(explanation.stages.length, 1);

  const stageExpl = explanation.stages[0];
  assert.equal(stageExpl.towerName, 'Resonant Tower');
  assert.equal(stageExpl.floor, 4);

  // Boss encounter primary reason
  const bossReason = stageExpl.primaryReasons.find(
    (r) => r.code === 'ENEMY_BOSS_ENCOUNTER'
  );
  assert.ok(bossReason, 'Floor 4 must include boss encounter reason');
  assert.equal(bossReason?.facts.bossPresence, true);

  // Sustain for boss reason
  const sustainReason = stageExpl.supportingReasons.find(
    (r) => r.code === 'SUSTAIN_HIGH_THREAT_SATISFIED'
  );
  assert.ok(sustainReason, 'Must satisfy sustain requirements for boss encounter');
  assert.equal(sustainReason?.facts.isHighThreat, true);

  // Role coverage
  const roleReason = stageExpl.supportingReasons.find(
    (r) => r.code === 'ROLE_COVERAGE_COMPOSITION'
  );
  assert.ok(roleReason);
  assert.equal(roleReason?.facts.hasDps, true);
  assert.equal(roleReason?.facts.hasSupport, true);

  // Offensive synergy
  const synergyReason = stageExpl.supportingReasons.find(
    (r) => r.code === 'OFFENSIVE_SYNERGY_CAPABILITIES'
  );
  assert.ok(synergyReason);
  assert.ok(Array.isArray(synergyReason?.facts.capabilitiesPresent));
});

test('Infeasible Run Explanation - Roster Capacity Barrier', () => {
  const roster = {
    userId: 'user-tiny',
    resonatorIds: ['res-jinhsi', 'res-verina', 'res-yangyang'], // exactly 3 resonators (10 vigor each)
  };
  const candidates = generateTeamCandidates(roster, {
    patchContext: patchContext37,
    availableResonators: availableResonatorsList,
  });

  // 3 stages with vigor costs 5, 5, 5 = 15 vigor required per resonator, but capacity is only 10
  const stages = [hazardTowerFloor1, hazardTowerFloor2, hazardTowerFloor3];
  const scoringContext = { patchContext: patchContext37, roster };
  const scores = new Map<string, any>();
  for (const c of candidates) {
    for (const s of stages) {
      const score = scoreTeamForStage(c, s, scoringContext);
      scores.set(`${score.candidateKey}::${score.stageKey}`, score);
    }
  }

  const context: ToAOptimizationContext = {
    cycleId: 'cycle-s40',
    patchId: patchContext37.patchId,
    stages,
    candidates,
    scores,
    roster,
    defaultVigorCapacity: 10,
  };

  const result = optimizeToA(context, { mode: 'EXACT' });
  assert.equal(result.status, 'INFEASIBLE');

  const explanation = buildOptimizationExplanation(context, result);
  assert.equal(explanation.status, 'INFEASIBLE');
  assert.equal(explanation.stages.length, 0);
  assert.equal(explanation.totalScore, 0);

  const infeasibleReason = explanation.summaryReasons.find(
    (r) => r.code === 'OPTIMALITY_INFEASIBLE'
  );
  assert.ok(infeasibleReason);
  assert.equal(
    explanation.optimalityExplanation.description,
    'No feasible joint assignment of valid teams satisfies the roster Vigor capacity across the requested stages.'
  );

  const globalTradeoff = explanation.globalTradeoffs.find(
    (t) => t.code === 'GLOBAL_INFEASIBILITY_BARRIER'
  );
  assert.ok(globalTradeoff);
});

test('Empty Stage List Explanation Handling', () => {
  const roster = {
    userId: 'user-empty',
    resonatorIds: ['res-jinhsi', 'res-verina', 'res-yangyang'],
  };
  const context: ToAOptimizationContext = {
    cycleId: 'cycle-s40',
    patchId: patchContext37.patchId,
    stages: [],
    roster,
  };

  const result = optimizeToA(context, { mode: 'EXACT' });
  assert.equal(result.status, 'OPTIMAL');

  const explanation = buildOptimizationExplanation(context, result);
  assert.equal(explanation.stages.length, 0);
  assert.equal(explanation.totalScore, 0);
  assert.equal(explanation.vigor.totalVigorConsumed, 0);
});
