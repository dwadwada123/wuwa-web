/**
 * Wuthering Waves Deterministic Tower of Adversity Allocation Solver
 * Phase 7 Step 23: Deterministic Tower of Adversity Vigor Allocation & Stage Scheduling Contract
 *
 * Implements an exact branch-and-bound solver for assigning eligible teams to
 * Tower of Adversity stages under strict Vigor budgets, factual stage-buff element
 * matching, and lexicographic objective maximization.
 */

import {
  MAX_RESONATOR_VIGOR,
  RESONATOR_STARTING_VIGOR,
  TOA_ALLOCATION_RULE_VERSION,
  CANONICAL_PATCH_VERSION,
  CANONICAL_SEASON_ID
} from './rules.ts';
import {
  canTeamAffordStage,
  calculateBuffMatches,
  buildCanonicalAssignmentKey,
  compareObjectiveTuples
} from './predicates.ts';
import type {
  ToAStageDefinition,
  ToAStageAssignment,
  ToAAllocationStatus,
  ToAAllocationObjectiveTuple,
  TeamBuildEvaluation,
  ResonatorVigorAccountingRecord
} from './types.ts';

export interface SolverRunOptions {
  readonly targetStages: readonly ToAStageDefinition[];
  readonly candidateTeams: readonly TeamBuildEvaluation[];
  readonly allowPartial: boolean;
  readonly ownedResonatorIds?: ReadonlySet<string>;
}

export interface SolverRunResult {
  readonly status: ToAAllocationStatus;
  readonly assignments: readonly ToAStageAssignment[];
  readonly vigorAccounting: readonly ResonatorVigorAccountingRecord[];
  readonly objectiveTuple: ToAAllocationObjectiveTuple;
  readonly searchStatesExplored: number;
  readonly prunedStatesCount: number;
  readonly infeasibilityReasons?: readonly string[];
}

interface RunningAssignmentState {
  team: TeamBuildEvaluation | null;
  stage: ToAStageDefinition;
  buffMatches: number;
  matchedElements: readonly string[];
}

/**
 * Solves the optimal deterministic ToA stage allocation via exact branch-and-bound.
 */
export function solveToAAllocation(options: SolverRunOptions): SolverRunResult {
  const { targetStages, candidateTeams, allowPartial, ownedResonatorIds } = options;

  // Filter candidate teams by owned roster if provided
  const eligibleTeams: TeamBuildEvaluation[] = [];
  for (const team of candidateTeams) {
    if (ownedResonatorIds) {
      let allOwned = true;
      for (const memberId of team.memberResonatorIds) {
        if (!ownedResonatorIds.has(memberId)) {
          allOwned = false;
          break;
        }
      }
      if (!allOwned) continue;
    }
    eligibleTeams.push(team);
  }

  // Check trivial empty stage request
  if (targetStages.length === 0) {
    return {
      status: 'INFEASIBLE_ALLOCATION',
      assignments: Object.freeze([]),
      vigorAccounting: Object.freeze([]),
      objectiveTuple: {
        stagesCompleted: 0,
        beneficialBuffMatches: 0,
        incompatibleWeaponAssignments: 0,
        fullyEquippedAssignments: 0,
        totalKnownAspects: 0,
        totalSynergyPairs: 0,
        totalDirectionalEdges: 0,
        canonicalAssignmentKey: ''
      },
      searchStatesExplored: 0,
      prunedStatesCount: 0,
      infeasibilityReasons: Object.freeze(['No target stages requested for allocation.'])
    };
  }

  // Pre-calculate total required vigor and available vigor
  let totalRequiredVigor = 0;
  for (const stage of targetStages) {
    totalRequiredVigor += stage.vigorCost;
  }

  const allCandidateResonators = new Set<string>();
  for (const t of eligibleTeams) {
    for (const m of t.memberResonatorIds) {
      allCandidateResonators.add(m);
    }
  }
  const maxPossibleTeamVigor = eligibleTeams.length * MAX_RESONATOR_VIGOR;

  if (!allowPartial && eligibleTeams.length === 0) {
    return {
      status: 'INFEASIBLE_ALLOCATION',
      assignments: Object.freeze([]),
      vigorAccounting: Object.freeze([]),
      objectiveTuple: {
        stagesCompleted: 0,
        beneficialBuffMatches: 0,
        incompatibleWeaponAssignments: 0,
        fullyEquippedAssignments: 0,
        totalKnownAspects: 0,
        totalSynergyPairs: 0,
        totalDirectionalEdges: 0,
        canonicalAssignmentKey: ''
      },
      searchStatesExplored: 1,
      prunedStatesCount: 0,
      infeasibilityReasons: Object.freeze(['No eligible candidate teams available to cover requested target stages.'])
    };
  }

  // If allowPartial is false and total required vigor exceeds maximum possible team vigor
  if (!allowPartial && maxPossibleTeamVigor < totalRequiredVigor) {
    return {
      status: 'INFEASIBLE_ALLOCATION',
      assignments: Object.freeze([]),
      vigorAccounting: Object.freeze([]),
      objectiveTuple: {
        stagesCompleted: 0,
        beneficialBuffMatches: 0,
        incompatibleWeaponAssignments: 0,
        fullyEquippedAssignments: 0,
        totalKnownAspects: 0,
        totalSynergyPairs: 0,
        totalDirectionalEdges: 0,
        canonicalAssignmentKey: ''
      },
      searchStatesExplored: 1,
      prunedStatesCount: 0,
      infeasibilityReasons: Object.freeze([
        `Target stages require ${totalRequiredVigor} Vigor, but supplied candidate teams only provide at most ${maxPossibleTeamVigor} Vigor.`
      ])
    };
  }

  // Order stages canonically by globalStageOrder
  const sortedStages = [...targetStages].sort((a, b) => a.globalStageOrder - b.globalStageOrder);

  // Pre-sort eligible teams for each stage to maximize early pruning
  const stageCandidatesMap = new Map<string, TeamBuildEvaluation[]>();
  for (const stage of sortedStages) {
    const sorted = [...eligibleTeams].sort((a, b) => {
      const matchA = calculateBuffMatches(a, stage).count;
      const matchB = calculateBuffMatches(b, stage).count;
      if (matchB !== matchA) return matchB - matchA;

      const incompA = a.weaponAggregation.hasIncompatibleWeapon ? 1 : 0;
      const incompB = b.weaponAggregation.hasIncompatibleWeapon ? 1 : 0;
      if (incompA !== incompB) return incompA - incompB;

      const fullyA = a.status === 'FULLY_EQUIPPED' ? 1 : 0;
      const fullyB = b.status === 'FULLY_EQUIPPED' ? 1 : 0;
      if (fullyB !== fullyA) return fullyB - fullyA;

      const aspectsA = a.completeness.knownTeamAspects;
      const aspectsB = b.completeness.knownTeamAspects;
      if (aspectsB !== aspectsA) return aspectsB - aspectsA;

      return a.id.localeCompare(b.id);
    });
    stageCandidatesMap.set(stage.stageId, sorted);
  }

  // Search state container (avoids TypeScript closure narrowing)
  const ctx = {
    searchStatesExplored: 0,
    prunedStatesCount: 0,
    bestSolution: null as RunningAssignmentState[] | null,
    bestObjective: null as ToAAllocationObjectiveTuple | null
  };

  // Working state
  const currentAssignments: RunningAssignmentState[] = new Array(sortedStages.length);
  const usedVigorMap = new Map<string, number>();

  function evaluateCurrentCompleteObjective(
    assignments: RunningAssignmentState[]
  ): ToAAllocationObjectiveTuple {
    let stagesCompleted = 0;
    let beneficialBuffMatches = 0;
    let incompatibleWeaponAssignments = 0;
    let fullyEquippedAssignments = 0;
    let totalKnownAspects = 0;
    const keyPairs: { stageId: string; teamId: string | null }[] = [];

    for (let i = 0; i < assignments.length; i++) {
      const a = assignments[i];
      const stage = a.stage;
      const team = a.team;

      if (team) {
        stagesCompleted++;
        beneficialBuffMatches += a.buffMatches;
        if (team.weaponAggregation.hasIncompatibleWeapon) {
          incompatibleWeaponAssignments++;
        }
        if (team.status === 'FULLY_EQUIPPED') {
          fullyEquippedAssignments++;
        }
        totalKnownAspects += team.completeness.knownTeamAspects;
        keyPairs.push({ stageId: stage.stageId, teamId: team.id });
      } else {
        keyPairs.push({ stageId: stage.stageId, teamId: null });
      }
    }

    const canonicalAssignmentKey = buildCanonicalAssignmentKey(keyPairs);

    return {
      stagesCompleted,
      beneficialBuffMatches,
      incompatibleWeaponAssignments,
      fullyEquippedAssignments,
      totalKnownAspects,
      totalSynergyPairs: 0,
      totalDirectionalEdges: 0,
      canonicalAssignmentKey
    };
  }

  function dfs(stageIndex: number, currentCompleted: number): void {
    ctx.searchStatesExplored++;

    // Pruning check 1: Can we possibly beat best solution's stagesCompleted?
    if (ctx.bestObjective !== null) {
      const remainingStages = sortedStages.length - stageIndex;
      if (currentCompleted + remainingStages < ctx.bestObjective.stagesCompleted) {
        ctx.prunedStatesCount++;
        return;
      }
    }

    // Base case: all stages processed
    if (stageIndex === sortedStages.length) {
      if (!allowPartial && currentCompleted < sortedStages.length) {
        return;
      }

      const obj = evaluateCurrentCompleteObjective(currentAssignments);
      if (ctx.bestObjective === null || compareObjectiveTuples(obj, ctx.bestObjective) < 0) {
        ctx.bestObjective = obj;
        ctx.bestSolution = currentAssignments.map((a) => ({ ...a }));
      }
      return;
    }

    const currentStage = sortedStages[stageIndex];
    const stageCandidates = stageCandidatesMap.get(currentStage.stageId) ?? [];

    let hasAffordableTeam = false;

    // Try assigning each candidate team that can afford this stage
    for (const team of stageCandidates) {
      if (canTeamAffordStage(team, currentStage, usedVigorMap)) {
        hasAffordableTeam = true;

        // Apply team assignment
        for (const memberId of team.memberResonatorIds) {
          usedVigorMap.set(memberId, (usedVigorMap.get(memberId) ?? 0) + currentStage.vigorCost);
        }

        const buffMatch = calculateBuffMatches(team, currentStage);
        currentAssignments[stageIndex] = {
          team,
          stage: currentStage,
          buffMatches: buffMatch.count,
          matchedElements: buffMatch.matchedElements
        };

        // Recurse
        dfs(stageIndex + 1, currentCompleted + 1);

        // Rollback
        for (const memberId of team.memberResonatorIds) {
          const prev = usedVigorMap.get(memberId) ?? currentStage.vigorCost;
          usedVigorMap.set(memberId, Math.max(0, prev - currentStage.vigorCost));
        }
      }
    }

    // Option to leave stage unassigned: ONLY if allowPartial is true
    if (allowPartial) {
      currentAssignments[stageIndex] = {
        team: null,
        stage: currentStage,
        buffMatches: 0,
        matchedElements: []
      };

      dfs(stageIndex + 1, currentCompleted);
    } else if (!hasAffordableTeam) {
      // If allowPartial is false and NO candidate can afford this stage, this branch is dead
      ctx.prunedStatesCount++;
    }
  }

  // Execute branch-and-bound search
  dfs(0, 0);

  // If no feasible solution was found
  if (!ctx.bestSolution || !ctx.bestObjective || ctx.bestObjective.stagesCompleted === 0) {
    return {
      status: 'INFEASIBLE_ALLOCATION',
      assignments: Object.freeze([]),
      vigorAccounting: Object.freeze([]),
      objectiveTuple: {
        stagesCompleted: 0,
        beneficialBuffMatches: 0,
        incompatibleWeaponAssignments: 0,
        fullyEquippedAssignments: 0,
        totalKnownAspects: 0,
        totalSynergyPairs: 0,
        totalDirectionalEdges: 0,
        canonicalAssignmentKey: ''
      },
      searchStatesExplored: ctx.searchStatesExplored,
      prunedStatesCount: ctx.prunedStatesCount,
      infeasibilityReasons: Object.freeze([
        'No feasible assignment covers all target stages within Resonator Vigor capacities.'
      ])
    };
  }

  // Format final assignments
  const finalAssignments: ToAStageAssignment[] = [];
  const resonatorStageMap = new Map<string, string[]>();

  for (const item of ctx.bestSolution) {
    const stage = item.stage;
    const team = item.team;

    if (team) {
      finalAssignments.push(
        Object.freeze({
          stage,
          team,
          isAssigned: true,
          vigorCost: stage.vigorCost,
          memberResonatorIds: Object.freeze([...team.memberResonatorIds]),
          buffMatchedMemberCount: item.buffMatches,
          matchedBeneficialElements: Object.freeze([...item.matchedElements])
        })
      );

      for (const memberId of team.memberResonatorIds) {
        const arr = resonatorStageMap.get(memberId) ?? [];
        arr.push(stage.stageId);
        resonatorStageMap.set(memberId, arr);
      }
    } else {
      finalAssignments.push(
        Object.freeze({
          stage,
          team: null,
          isAssigned: false,
          vigorCost: 0,
          memberResonatorIds: Object.freeze([]),
          buffMatchedMemberCount: 0,
          matchedBeneficialElements: Object.freeze([]),
          unassignedReason: 'Insufficient available team Vigor or candidate pool exhaustion.'
        })
      );
    }
  }

  // Build canonical Vigor accounting records
  const allKnownResonators = Array.from(allCandidateResonators).sort((a, b) => a.localeCompare(b));
  const vigorAccounting: ResonatorVigorAccountingRecord[] = [];

  for (const resonatorId of allKnownResonators) {
    const assignedStages = resonatorStageMap.get(resonatorId) ?? [];
    let consumed = 0;
    for (const stId of assignedStages) {
      const st = sortedStages.find((s) => s.stageId === stId);
      if (st) consumed += st.vigorCost;
    }

    vigorAccounting.push(
      Object.freeze({
        resonatorId,
        startingVigor: RESONATOR_STARTING_VIGOR,
        vigorConsumed: consumed,
        vigorRemaining: RESONATOR_STARTING_VIGOR - consumed,
        assignedStageIds: Object.freeze([...assignedStages]),
        assignedStageCount: assignedStages.length
      })
    );
  }

  // Determine overall status
  let status: ToAAllocationStatus = 'FEASIBLE_ALLOCATION';
  const assignedCount = ctx.bestObjective.stagesCompleted;

  if (assignedCount === sortedStages.length) {
    const allFullyEquipped = finalAssignments.every(
      (a) => a.team && a.team.status === 'FULLY_EQUIPPED'
    );
    status = allFullyEquipped ? 'OPTIMAL_ALLOCATION' : 'FEASIBLE_ALLOCATION';
  } else if (assignedCount > 0 && allowPartial) {
    status = 'PARTIAL_ALLOCATION';
  } else {
    status = 'INFEASIBLE_ALLOCATION';
  }

  return {
    status,
    assignments: Object.freeze(finalAssignments),
    vigorAccounting: Object.freeze(vigorAccounting),
    objectiveTuple: Object.freeze(ctx.bestObjective),
    searchStatesExplored: ctx.searchStatesExplored,
    prunedStatesCount: ctx.prunedStatesCount,
    infeasibilityReasons:
      status === 'INFEASIBLE_ALLOCATION'
        ? Object.freeze(['Could not allocate all target stages within Vigor constraints.'])
        : undefined
  };
}
