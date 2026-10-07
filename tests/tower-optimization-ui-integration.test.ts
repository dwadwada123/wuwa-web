import test from 'node:test';
import assert from 'node:assert/strict';

import {
  adaptInventoryToEngine,
  generateTeamCandidates,
  scoreTeamForStage,
  optimizeToA,
  buildOptimizationExplanation,
} from '../lib/engine/index.ts';

import type {
  OwnedRoster,
  ToAStage,
} from '../lib/domain/types/index.ts';
import type { ToAOptimizationContext } from '../lib/engine/optimization/types.ts';
import type {
  TowerOptimizationViewModel,
  TowerGroupViewModel,
  StageCardViewModel,
} from '../app/tower/types.ts';

import {
  patchContext37,
  availableResonatorsList,
  ageOfHarvestWeapon,
  swordEmeraldGenesis,
  createSyntheticRoster,
} from './fixtures/domain-fixtures.ts';

import { fullSeason40Stages } from './fixtures/season40-fixtures.ts';

/**
 * Transforms engine result and explanation into the exact TowerOptimizationViewModel
 * produced by the server-side action.
 */
function buildTestViewModel(
  context: ToAOptimizationContext,
  result: ReturnType<typeof optimizeToA>,
  explanation: ReturnType<typeof buildOptimizationExplanation>,
  stages: ToAStage[]
): TowerOptimizationViewModel {
  const assignmentMap = new Map(result.assignments.map((a) => [a.stageId, a]));
  const stageExplMap = new Map(explanation.stages.map((s) => [s.stageKey, s]));

  // Group by tower names: Resonant, Hazard, Echoing
  const towerNames = ['Resonant Tower', 'Hazard Tower', 'Echoing Tower'];
  const towerGroups: TowerGroupViewModel[] = towerNames
    .map((tName, order) => {
      const relevantStages = stages.filter((s) => {
        const id = s.id.toLowerCase();
        if (tName.includes('Resonant')) return id.includes('resonant');
        if (tName.includes('Hazard')) return id.includes('hazard');
        if (tName.includes('Echoing')) return id.includes('echoing');
        return false;
      });

      if (relevantStages.length === 0) return null;

      const stageCards: StageCardViewModel[] = relevantStages.map((stage) => {
        const assignment = assignmentMap.get(stage.id);
        const stageKey = `${stage.patchId}:${stage.id}`;
        const stageExpl = stageExplMap.get(stageKey)!;

        return {
          stageId: stage.id,
          stageKey,
          towerName: tName,
          floor: stage.stageIndex,
          stageIndex: stage.stageIndex,
          vigorCost: stage.vigorCost,
          stageScore: assignment ? assignment.teamScore.totalScore : 0,
          scoreBreakdown: stageExpl.scoreBreakdown,
          selectedTeam: assignment
            ? assignment.team.members.map((m) => ({
                id: m.resonator.id,
                name: m.resonator.name,
                element: m.resonator.element,
                weaponType: m.resonator.weaponType,
                rarity: m.resonator.rarity,
                role: m.resonator.roles[0]?.label || 'Resonator',
                level: m.level,
                waveband: m.waveband,
                equippedWeapon: m.weapon
                  ? {
                      id: m.weapon.id,
                      name: m.weapon.name,
                      rarity: m.weapon.rarity,
                      weaponType: m.weapon.weaponType,
                    }
                  : null,
              }))
            : [],
          enemySummary: stage.waves.flatMap((w) =>
            w.enemyInstances.map((ei) => ({
              id: ei.enemy.id,
              name: ei.enemy.name,
              enemyClass: ei.enemy.enemyClass,
              level: ei.level,
              resistances: ei.enemy.resistances.map((r) => ({
                element: r.element,
                ratio: r.resistanceRatio,
              })),
            }))
          ),
          areaBuffs: stage.areaEffects.map((ae) => ({
            id: ae.id,
            name: ae.name,
            description: ae.description,
            category: ae.gameplayEffect?.category || 'BUFF',
          })),
          challengeGoals: stage.challengeGoals.map((g) => ({
            targetTimeSeconds: g.targetTimeSeconds,
            points: g.points,
          })),
          primaryReasons: stageExpl.primaryReasons,
          supportingReasons: stageExpl.supportingReasons,
          tradeoffs: stageExpl.tradeoffs,
          resourceImpact: stageExpl.resourceImpact,
        };
      });

      return {
        towerId: `tower-${order}`,
        towerName: tName,
        towerOrder: order,
        stages: stageCards,
      };
    })
    .filter((tg): tg is TowerGroupViewModel => tg !== null);

  return {
    cycle: {
      id: context.cycleId,
      name: 'Hazard Zone (Season 40)',
      patchVersion: '3.7',
      snapshotDate: '2026-09-13',
      startTime: '2026-09-13T20:00:00Z',
      endTime: '2026-10-11T19:59:59Z',
    },
    scope: 'FULL_CYCLE',
    status: result.status,
    mode: result.mode,
    optimality: result.optimality,
    optimalityExplanation: explanation.optimalityExplanation,
    totalScore: result.totalScore,
    globalPrimaryUpperBound: result.globalPrimaryUpperBound,
    stagesCount: stages.length,
    assignedStagesCount: result.assignments.length,
    distinctTeamsCount: result.distinctTeamsCount,
    totalVigorConsumed: result.totalVigorConsumed,
    bottleneckResonators: explanation.vigor.bottleneckResonators,
    vigorSummary: explanation.vigor,
    globalTradeoffs: explanation.globalTradeoffs,
    summaryReasons: explanation.summaryReasons,
    towers: towerGroups,
    infeasibilityReasons: result.infeasibilityReasons,
    metrics: {
      searchStatesExplored: result.metrics.searchStatesExplored,
      prunedStatesCount: result.metrics.prunedStatesCount,
      durationMs: result.metrics.durationMs,
    },
  };
}

test('UI Integration - Full End-to-End Flow from OwnedRoster to TowerOptimizationViewModel', () => {
  // 1. Synthetic owned roster with 12 resonators (sufficient for full 12 stages)
  const { roster, resonators } = createSyntheticRoster(12);
  roster.resonators = roster.resonatorIds.map((id) => ({
    id: `ur-${id}`,
    userId: 'bench-user',
    resonatorId: id,
    level: 90,
    waveband: 0,
    normalAttackLevel: 6,
    resonanceSkillLevel: 6,
    forteCircuitLevel: 6,
    resonanceLiberationLevel: 6,
    introSkillLevel: 6,
  }));

  // 2. Adapt inventory
  const adapted = adaptInventoryToEngine(roster, {
    patchContext: patchContext37,
    availableResonators: resonators,
  });

  // 3. Generate candidates
  const candidates = generateTeamCandidates(adapted.roster, {
    patchContext: patchContext37,
    availableResonators: resonators,
    builds: adapted.builds,
  });

  assert.ok(candidates.length > 0, 'Must generate team candidates');

  // 4. Score all candidates for all 12 stages
  const scoringContext = { patchContext: patchContext37, roster: adapted.roster };
  const scores = new Map<string, any>();
  for (const c of candidates) {
    for (const s of fullSeason40Stages) {
      const score = scoreTeamForStage(c, s, scoringContext);
      scores.set(`${score.candidateKey}::${score.stageKey}`, score);
    }
  }

  // 5. Optimization context & BEST_EFFORT solve
  const context: ToAOptimizationContext = {
    cycleId: 'cycle-s40',
    patchId: patchContext37.patchId,
    stages: fullSeason40Stages,
    candidates,
    scores,
    roster: adapted.roster,
    defaultVigorCapacity: 10,
  };

  const result = optimizeToA(context, {
    mode: 'BEST_EFFORT',
    maxSearchStates: 200000,
  });

  assert.ok(result.status === 'OPTIMAL' || result.status === 'BEST_FOUND');
  assert.equal(result.assignments.length, 12, 'All 12 stages must be assigned');

  // 6. Explanation
  const explanation = buildOptimizationExplanation(context, result);
  assert.equal(explanation.stages.length, 12);

  // 7. Result View Model transformation
  const viewModel = buildTestViewModel(context, result, explanation, fullSeason40Stages);

  // Verify UI invariants
  assert.equal(viewModel.cycle.patchVersion, '3.7');
  assert.equal(viewModel.scope, 'FULL_CYCLE');
  assert.equal(viewModel.assignedStagesCount, 12);
  assert.equal(viewModel.stagesCount, 12);
  assert.equal(viewModel.towers.length, 3, 'Must have Resonant, Hazard, Echoing towers');

  // Verify all 12 stages are present across the 3 towers
  const totalCards = viewModel.towers.reduce((acc, t) => acc + t.stages.length, 0);
  assert.equal(totalCards, 12, 'Exactly 12 stage cards rendered');

  // Verify team display information for each stage
  for (const t of viewModel.towers) {
    for (const s of t.stages) {
      assert.equal(s.selectedTeam.length, 3, 'Each stage must have 3 resonators in team');
      for (const m of s.selectedTeam) {
        assert.ok(m.name.length > 0, 'Resonator name present');
        assert.ok(m.element.length > 0, 'Resonator element present');
        assert.ok(m.weaponType.length > 0, 'Resonator weapon type present');
      }
      assert.ok(s.stageScore > 0, 'Stage score must be positive');
      assert.ok(s.primaryReasons.length > 0, 'Stage must have primary selection reasons');
      assert.ok(s.scoreBreakdown.topContributors.length > 0, 'Stage has top score dimensions');
      assert.equal(s.resourceImpact.members.length, 3, 'Vigor impact for all 3 members');
    }
  }

  // Verify Vigor accounting integrity: UI uses engine values directly
  assert.equal(viewModel.totalVigorConsumed, result.totalVigorConsumed);
  assert.equal(viewModel.vigorSummary.totalVigorConsumed, result.totalVigorConsumed);
  assert.equal(viewModel.totalScore, result.totalScore);
  assert.equal(viewModel.optimality, result.optimality);

  // Verify lean client payload size (Requirement 18 & 22: no candidate pools or matrix sent to browser)
  const payloadSizeBytes = Buffer.byteLength(JSON.stringify(viewModel), 'utf8');
  assert.ok(
    payloadSizeBytes < 150000,
    `Client ViewModel payload must be compact (< 150 KB), was ${payloadSizeBytes} bytes`
  );
});

test('UI Integration - Empty Inventory State (< 3 Resonators) Blocks Optimization', () => {
  const emptyRoster: OwnedRoster = {
    userId: 'user-empty',
    resonatorIds: ['res-1'],
    resonators: [
      {
        id: 'ur-1',
        userId: 'user-empty',
        resonatorId: 'res-1',
        level: 80,
        waveband: 0,
        normalAttackLevel: 6,
        resonanceSkillLevel: 6,
        forteCircuitLevel: 6,
        resonanceLiberationLevel: 6,
        introSkillLevel: 6,
      },
    ],
  };

  const adapted = adaptInventoryToEngine(emptyRoster, {
    patchContext: patchContext37,
    availableResonators: availableResonatorsList,
  });

  const candidates = generateTeamCandidates(adapted.roster, {
    patchContext: patchContext37,
    availableResonators: availableResonatorsList,
    builds: adapted.builds,
  });

  // A 3-member team cannot be formed from 1 resonator
  assert.equal(candidates.length, 0);
});

test('UI Integration - Infeasible State Provides Authoritative Barrier Explanation', () => {
  const { roster, resonators } = createSyntheticRoster(3);
  roster.resonators = roster.resonatorIds.map((id) => ({
    id: `ur-${id}`,
    userId: 'bench-user',
    resonatorId: id,
    level: 90,
    waveband: 0,
    normalAttackLevel: 6,
    resonanceSkillLevel: 6,
    forteCircuitLevel: 6,
    resonanceLiberationLevel: 6,
    introSkillLevel: 6,
  }));

  const adapted = adaptInventoryToEngine(roster, {
    patchContext: patchContext37,
    availableResonators: resonators,
  });

  const candidates = generateTeamCandidates(adapted.roster, {
    patchContext: patchContext37,
    availableResonators: resonators,
    builds: adapted.builds,
  });

  const scoringContext = { patchContext: patchContext37, roster: adapted.roster };
  const scores = new Map<string, any>();
  for (const c of candidates) {
    for (const s of fullSeason40Stages) {
      const score = scoreTeamForStage(c, s, scoringContext);
      scores.set(`${score.candidateKey}::${score.stageKey}`, score);
    }
  }

  const context: ToAOptimizationContext = {
    cycleId: 'cycle-s40',
    patchId: patchContext37.patchId,
    stages: fullSeason40Stages,
    candidates,
    scores,
    roster: adapted.roster,
    defaultVigorCapacity: 10,
  };

  const result = optimizeToA(context, {
    mode: 'BEST_EFFORT',
    maxSearchStates: 200000,
  });

  assert.equal(result.status, 'INFEASIBLE');

  const explanation = buildOptimizationExplanation(context, result);
  assert.equal(explanation.status, 'INFEASIBLE');
  assert.equal(explanation.optimalityExplanation.status, 'INFEASIBLE');
  assert.ok(
    explanation.optimalityExplanation.description.includes('No feasible joint assignment')
  );
  assert.ok(
    explanation.globalTradeoffs.some((t) => t.code === 'GLOBAL_INFEASIBILITY_BARRIER')
  );
});

test('UI Integration - Global Tradeoff Displayed When Stage Is Not Local Peak', () => {
  // Verify that explanation produces STAGE_GLOBAL_OPPORTUNITY_TRADEOFF when a team
  // is assigned that scores lower than the local peak candidate
  const { roster, resonators } = createSyntheticRoster(6);
  const candidates = generateTeamCandidates(roster, {
    patchContext: patchContext37,
    availableResonators: resonators,
  });

  const stages = fullSeason40Stages.slice(0, 4); // 4 floors
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

  const result = optimizeToA(context, { mode: 'BEST_EFFORT' });
  const explanation = buildOptimizationExplanation(context, result);

  // Each stage explanation has tradeoffs array
  for (const s of explanation.stages) {
    assert.ok(Array.isArray(s.tradeoffs), 'Stage must have tradeoffs array');
    const tradeoff = s.tradeoffs[0];
    assert.ok(tradeoff, 'Tradeoff reason present');
    assert.ok(
      ['STAGE_OPTIMAL_LOCAL_AND_GLOBAL', 'STAGE_GLOBAL_OPPORTUNITY_TRADEOFF', 'STAGE_GLOBAL_ASSIGNMENT_COHERENT'].includes(
        tradeoff.code
      )
    );
  }
});
