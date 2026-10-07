'use server';

import { createClient } from '@/lib/supabase/server';
import {
  SupabaseGameDataRepository,
  SupabaseUserInventoryRepository,
} from '@/lib/data-access';
import {
  adaptInventoryToEngine,
  generateTeamCandidates,
  scoreTeamForStage,
  optimizeToA,
  buildOptimizationExplanation,
  parseStageIdentity,
} from '@/lib/engine';
import type { ToAStage, Resonator, Weapon } from '@/lib/domain/types';
import type { TeamStageScore } from '@/lib/engine/scoring/types';
import type { ToAOptimizationContext } from '@/lib/engine/optimization/types';
import type {
  RunOptimizationInput,
  RunOptimizationResponse,
  TowerOptimizationViewModel,
  TowerGroupViewModel,
  StageCardViewModel,
  StageResonatorViewModel,
} from './types';

/**
 * Server action to run full-cycle or scoped Tower of Adversity optimization.
 * Executes purely server-side with zero engine logic exposed to client.
 */
export async function runTowerOptimizationAction(
  input: RunOptimizationInput
): Promise<RunOptimizationResponse> {
  try {
    // 1. Authenticate user from session claims
    const supabase = await createClient();
    const { data: claimsData, error: authError } = await supabase.auth.getClaims();

    if (authError || !claimsData?.claims?.sub) {
      return {
        success: false,
        code: 'UNAUTHENTICATED',
        error: 'Authentication required. Please sign in to run personal ToA optimization.',
      };
    }

    const userId = claimsData.claims.sub as string;

    // 2. Load User Inventory
    const userInventoryRepo = new SupabaseUserInventoryRepository(supabase);
    const userRoster = await userInventoryRepo.getOwnedRoster(userId);

    if (!userRoster.resonators || userRoster.resonators.length < 3) {
      return {
        success: false,
        code: 'EMPTY_INVENTORY',
        error:
          'Add more Resonators to your inventory before optimizing Tower of Adversity. (At least 3 owned Resonators required to field a team)',
      };
    }

    // 3. Resolve active/selected ToA Cycle from game data repository
    const gameDataRepo = new SupabaseGameDataRepository(supabase);
    const cycleData = await gameDataRepo.getActiveOrLatestCycle(input.cycleId);

    if (!cycleData) {
      return {
        success: false,
        code: 'CYCLE_NOT_FOUND',
        error: 'Tower of Adversity cycle data could not be resolved from game data.',
      };
    }

    const { cycle, patch } = cycleData;

    // 4. Load Canonical Entities for Patch Snapshot
    const [availableResonators, availableWeapons, availableEchoes, availableSonatas] =
      await Promise.all([
        gameDataRepo.getResonators(cycle.patchId),
        gameDataRepo.getWeapons(cycle.patchId),
        gameDataRepo.getEchoes(cycle.patchId),
        gameDataRepo.getSonatas(cycle.patchId),
      ]);

    // 5. Resolve Stages Scope
    let stagesToOptimize: ToAStage[] = [];
    if (input.scope === 'TOWER' && input.selectedTowerId) {
      const tower = cycle.towers.find((t) => t.id === input.selectedTowerId);
      stagesToOptimize = tower ? tower.stages : cycle.towers.flatMap((t) => t.stages);
    } else if (
      input.scope === 'CUSTOM' &&
      input.selectedStageIds &&
      input.selectedStageIds.length > 0
    ) {
      const stageIdSet = new Set(input.selectedStageIds);
      stagesToOptimize = cycle.towers
        .flatMap((t) => t.stages)
        .filter((s) => stageIdSet.has(s.id));
    } else {
      // Default: FULL_CYCLE (all stages in cycle)
      stagesToOptimize = cycle.towers.flatMap((t) => t.stages);
    }

    if (stagesToOptimize.length === 0) {
      return {
        success: false,
        code: 'ERROR',
        error: 'No stages selected for optimization scope.',
      };
    }

    // 6. Domain Adaptation
    const adapted = adaptInventoryToEngine(userRoster, {
      patchContext: patch,
      availableResonators,
      availableWeapons,
      availableEchoes,
      availableSonatas,
    });

    // 7. Deterministic Candidate Generation
    const candidates = generateTeamCandidates(adapted.roster, {
      patchContext: patch,
      availableResonators,
      builds: adapted.builds,
    });

    if (candidates.length === 0) {
      return {
        success: false,
        code: 'NO_VALID_CANDIDATES',
        error:
          'No valid 3-person team candidates can be formed from your current inventory.',
      };
    }

    // 8. Deterministic Team Scoring for all scoped stages
    const scoringContext = { patchContext: patch, roster: adapted.roster };
    const scores = new Map<string, TeamStageScore>();

    for (const candidate of candidates) {
      for (const stage of stagesToOptimize) {
        const score = scoreTeamForStage(candidate, stage, scoringContext);
        scores.set(`${score.candidateKey}::${score.stageKey}`, score);
      }
    }

    // 9. Optimization Context Setup
    const optContext: ToAOptimizationContext = {
      cycleId: cycle.id,
      patchId: patch.patchId,
      stages: stagesToOptimize,
      candidates,
      scores,
      roster: adapted.roster,
      defaultVigorCapacity: 10,
    };

    // 10. Solver Execution (Default user-facing: BEST_EFFORT with 200,000 state budget)
    const result = optimizeToA(optContext, {
      mode: 'BEST_EFFORT',
      maxSearchStates: 200000,
    });

    // 11. Deterministic Explanation Building
    const explanation = buildOptimizationExplanation(optContext, result);

    // 12. Build Lean Client View Model (zero candidate matrix leakage)
    const assignmentMap = new Map(result.assignments.map((a) => [a.stageId, a]));
    const stageExplMap = new Map(explanation.stages.map((s) => [s.stageKey, s]));

    // Map stages into tower groups
    const towerGroups: TowerGroupViewModel[] = cycle.towers
      .map((t) => {
        const relevantStages = t.stages.filter((s) =>
          stagesToOptimize.some((st) => st.id === s.id)
        );
        if (relevantStages.length === 0) return null;

        const stageCards: StageCardViewModel[] = relevantStages.map((stage) => {
          const assignment = assignmentMap.get(stage.id);
          const stageKey = `${stage.patchId}:${stage.id}`;
          const stageExpl = stageExplMap.get(stageKey);

          // Build selected team view models
          const selectedTeam: StageResonatorViewModel[] = assignment
            ? assignment.team.members.map((m) => {
                const primaryRole =
                  m.resonator.roles.find((r) => r.isPrimary)?.label ||
                  m.resonator.roles[0]?.label ||
                  'Resonator';

                return {
                  id: m.resonator.id,
                  name: m.resonator.name,
                  element: m.resonator.element,
                  weaponType: m.resonator.weaponType,
                  rarity: m.resonator.rarity,
                  role: primaryRole,
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
                };
              })
            : [];

          // Enemy summary
          const enemySummary = stage.waves.flatMap((w) =>
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
          );

          // Area buffs
          const areaBuffs = stage.areaEffects.map((ae) => ({
            id: ae.id,
            name: ae.name,
            description: ae.description,
            category: ae.gameplayEffect?.category || 'BUFF',
          }));

          const fallbackExpl = stageExpl || {
            stageKey,
            towerName: t.towerName,
            floor: stage.stageIndex,
            selectedTeamKey: '',
            score: 0,
            scoreBreakdown: {
              totalScore: 0,
              maxTotalScore: 1000,
              dimensions: {} as any,
              topContributors: [],
            },
            primaryReasons: [],
            supportingReasons: [],
            tradeoffs: [],
            resourceImpact: {
              stageCost: stage.vigorCost,
              characterVigorConsumed: 0,
              members: [],
              summary: 'No team assigned',
            },
          };

          return {
            stageId: stage.id,
            stageKey,
            towerName: t.towerName,
            floor: stage.stageIndex,
            stageIndex: stage.stageIndex,
            vigorCost: stage.vigorCost,
            stageScore: assignment ? assignment.teamScore.totalScore : 0,
            scoreBreakdown: fallbackExpl.scoreBreakdown,
            selectedTeam,
            enemySummary,
            areaBuffs,
            challengeGoals: stage.challengeGoals.map((g) => ({
              targetTimeSeconds: g.targetTimeSeconds,
              points: g.points,
            })),
            primaryReasons: fallbackExpl.primaryReasons,
            supportingReasons: fallbackExpl.supportingReasons,
            tradeoffs: fallbackExpl.tradeoffs,
            resourceImpact: fallbackExpl.resourceImpact,
          };
        });

        return {
          towerId: t.id,
          towerName: t.towerName,
          towerOrder: t.towerOrder,
          stages: stageCards,
        };
      })
      .filter((tg): tg is TowerGroupViewModel => tg !== null);

    const viewModel: TowerOptimizationViewModel = {
      cycle: {
        id: cycle.id,
        name: cycle.cycleName,
        patchVersion: patch.version,
        snapshotDate: patch.snapshotDate || '',
        startTime: cycle.startTime,
        endTime: cycle.endTime,
      },
      scope: input.scope,
      status: result.status,
      mode: result.mode,
      optimality: result.optimality,
      optimalityExplanation: explanation.optimalityExplanation,
      totalScore: result.totalScore,
      globalPrimaryUpperBound: result.globalPrimaryUpperBound,
      stagesCount: stagesToOptimize.length,
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

    return {
      success: true,
      data: viewModel,
    };
  } catch (err: any) {
    console.error('[runTowerOptimizationAction] Unexpected error:', err);
    return {
      success: false,
      code: 'ERROR',
      error: 'An unexpected error occurred during optimization. Please try again.',
    };
  }
}
