/**
 * Global Tower of Adversity Optimizer (Branch-and-Bound Exact Solver)
 *
 * Finds the globally optimal 3-resonator team assignments across all requested ToA stages
 * while enforcing per-resonator Vigor capacity constraints and opportunity cost tradeoffs.
 */

import type {
  ToAStage,
  TeamCandidate,
} from '../../domain/types/index.ts';
import { scoreTeamForStage } from '../scoring/scorer.ts';
import type { TeamStageScore, TeamScoringContext } from '../scoring/types.ts';
import { getCandidateKey } from '../team-generation/canonicalize.ts';
import { VigorTracker } from './vigor-tracker.ts';
import {
  computeObjectiveBreakdown,
  compareObjectiveBreakdowns,
} from './objective.ts';
import { generateOptimizationEvidence } from './evidence.ts';
import type {
  ToAOptimizationContext,
  ToAOptimizationResult,
  OptimizationOptions,
  OptimizationMode,
  OptimizationStatus,
  StageAssignment,
  OptimizationObjectiveBreakdown,
} from './types.ts';

interface ScoredCandidateEntry {
  candidate: TeamCandidate;
  candidateKey: string;
  score: TeamStageScore;
  resonatorIds: string[];
}

const DEFAULT_BEST_EFFORT_SEARCH_STATES = 200_000;

/**
 * Optimizes team candidate assignments globally across all requested ToA stages.
 *
 * In EXACT mode:
 * - Only provably lossless Exact Triple Dominance is retained.
 * - Heuristic candidate truncation (maxCandidatesPerStage) is disabled.
 * - No arbitrary search-state safety limit is enforced.
 * - Admissible primary upper bound pruning only (remainingUpperBound < bestPrimaryScore).
 * - No unsafe secondary buff pruning.
 * - Status is strictly 'OPTIMAL' or 'INFEASIBLE'.
 *
 * In BEST_EFFORT mode:
 * - Heuristic candidate reduction (maxCandidatesPerStage) and search-state budget are permitted.
 * - Status is strictly 'BEST_FOUND' or 'INFEASIBLE' (never 'OPTIMAL').
 */
export function optimizeToA(
  context: ToAOptimizationContext,
  options: OptimizationOptions = { mode: 'EXACT' }
): ToAOptimizationResult {
  const startTime = performance.now();
  const stages = context.stages;
  const mode: OptimizationMode = options.mode || 'EXACT';
  const isExact = mode === 'EXACT';

  // 1. Edge Case: No stages requested
  if (stages.length === 0) {
    const emptyBreakdown = computeObjectiveBreakdown([]);
    return {
      status: isExact ? 'OPTIMAL' : 'BEST_FOUND',
      mode,
      totalScore: 0,
      assignments: [],
      vigorUsage: [],
      totalVigorConsumed: 0,
      distinctTeamsCount: 0,
      objectiveBreakdown: emptyBreakdown,
      evidence: [],
      metrics: {
        stagesCount: 0,
        candidateStageMatrixSize: 0,
        searchStatesExplored: 0,
        prunedStatesCount: 0,
        durationMs: performance.now() - startTime,
      },
    };
  }

  const vigorTracker = new VigorTracker(context);
  const scoringContext: TeamScoringContext = {
    patchContext: { patchId: context.patchId, version: '' },
    roster: context.roster,
  };

  // Build or index scores map
  const scoreLookup = new Map<string, TeamStageScore>();
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

  // Helper to retrieve or calculate team-stage score
  const getOrComputeScore = (c: TeamCandidate, s: ToAStage): TeamStageScore => {
    const cKey = getCandidateKey(c);
    const stageKey = `${s.patchId}:${s.id}`;
    let cached = scoreLookup.get(`${stageKey}:${cKey}`);
    if (!cached && c.id) {
      cached = scoreLookup.get(`${stageKey}:${c.id}`);
    }
    if (cached) return cached;

    const computed = scoreTeamForStage(c, s, scoringContext);
    scoreLookup.set(`${stageKey}:${cKey}`, computed);
    return computed;
  };

  const candidatePool = context.candidates || [];
  let candidateStageMatrixSize = 0;

  // 2. Pre-filter and score candidates per stage
  const stageCandidatesMap = new Map<string, ScoredCandidateEntry[]>();
  const infeasibilityReasons: string[] = [];

  // In EXACT mode: heuristic candidate truncation is strictly forbidden.
  // In BEST_EFFORT mode: heuristic limit may be enforced.
  const stageLimit = isExact
    ? undefined
    : (options.maxCandidatesPerStage ?? context.maxCandidatesPerStage);

  for (const stage of stages) {
    const bestPerResonatorTriple = new Map<string, ScoredCandidateEntry>();

    for (const c of candidatePool) {
      const cKey = getCandidateKey(c);
      const score = getOrComputeScore(c, stage);
      candidateStageMatrixSize++;

      if (!score.valid || score.totalScore <= 0) {
        continue;
      }

      // Check if all members can afford this single stage's cost
      const memberIds = c.members.map((m) => m.resonator.id);
      const canAffordSingle = memberIds.every(
        (id) => vigorTracker.getCapacity(id) >= stage.vigorCost
      );
      if (!canAffordSingle) {
        continue;
      }

      const tripleKey = [...memberIds].sort().join(':');
      const existing = bestPerResonatorTriple.get(tripleKey);

      // Safe dominance reduction: If same 3 resonators, keep highest score
      // (Provably lossless because identical resonator triples consume identical Vigor)
      if (
        !existing ||
        score.totalScore > existing.score.totalScore ||
        (score.totalScore === existing.score.totalScore &&
          score.dimensions.stageBuffCompatibility.weightedScore >
            existing.score.dimensions.stageBuffCompatibility.weightedScore)
      ) {
        bestPerResonatorTriple.set(tripleKey, {
          candidate: c,
          candidateKey: cKey,
          score,
          resonatorIds: memberIds,
        });
      }
    }

    const stageCandidates = Array.from(bestPerResonatorTriple.values());

    // Sort candidates descending by score for optimal branch-and-bound exploration
    stageCandidates.sort((a, b) => {
      if (b.score.totalScore !== a.score.totalScore) {
        return b.score.totalScore - a.score.totalScore;
      }
      return a.candidateKey.localeCompare(b.candidateKey);
    });

    let finalCandidates = stageCandidates;

    // Apply heuristic diversity reduction ONLY in BEST_EFFORT mode
    if (stageLimit && stageCandidates.length > stageLimit) {
      const selected: ScoredCandidateEntry[] = [];
      const selectedKeys = new Set<string>();
      const resUsageCount = new Map<string, number>();
      const rosterCount = context.roster.resonatorIds.length || 1;
      const maxPerRes = Math.max(2, Math.ceil((stageLimit * 3) / rosterCount));

      // Pass 1: Select top-scoring candidates without over-saturating individual resonators
      for (const entry of stageCandidates) {
        if (selected.length >= stageLimit) break;
        const canTake = entry.resonatorIds.every((id) => (resUsageCount.get(id) || 0) < maxPerRes);
        if (canTake) {
          selected.push(entry);
          selectedKeys.add(entry.candidateKey);
          for (const id of entry.resonatorIds) {
            resUsageCount.set(id, (resUsageCount.get(id) || 0) + 1);
          }
        }
      }

      // Pass 2: Fill remaining capacity with top overall candidates
      for (const entry of stageCandidates) {
        if (selected.length >= stageLimit) break;
        if (!selectedKeys.has(entry.candidateKey)) {
          selected.push(entry);
          selectedKeys.add(entry.candidateKey);
        }
      }

      finalCandidates = selected;
    }

    if (finalCandidates.length === 0) {
      infeasibilityReasons.push(
        `Stage ${stage.id} (index ${stage.stageIndex}, vigor cost ${stage.vigorCost}) has zero valid candidates within roster Vigor capacity.`
      );
    }

    stageCandidatesMap.set(stage.id, finalCandidates);
  }

  // Early infeasibility exit if any stage has zero candidates
  if (infeasibilityReasons.length > 0) {
    return {
      status: 'INFEASIBLE',
      mode,
      totalScore: 0,
      assignments: [],
      vigorUsage: vigorTracker.getVigorUsageSummary(),
      totalVigorConsumed: 0,
      distinctTeamsCount: 0,
      objectiveBreakdown: computeObjectiveBreakdown([]),
      evidence: [],
      infeasibilityReasons,
      metrics: {
        stagesCount: stages.length,
        candidateStageMatrixSize,
        searchStatesExplored: 0,
        prunedStatesCount: 0,
        durationMs: performance.now() - startTime,
      },
    };
  }

  // 3. Stage Ordering for Branch-and-Bound:
  // Branch on highest vigorCost first (e.g. 5, then 4, 3, 2, 1) to constrain Vigor early
  const sortedStages = [...stages].sort((a, b) => {
    if (b.vigorCost !== a.vigorCost) {
      return b.vigorCost - a.vigorCost;
    }
    const aLen = stageCandidatesMap.get(a.id)?.length || 0;
    const bLen = stageCandidatesMap.get(b.id)?.length || 0;
    return aLen - bLen;
  });

  // 4. Precompute Suffix Max Scores for Admissible Upper Bound Pruning
  const numStages = sortedStages.length;
  const suffixMaxScore = new Float64Array(numStages + 1);

  for (let i = numStages - 1; i >= 0; i--) {
    const sId = sortedStages[i].id;
    const candidates = stageCandidatesMap.get(sId)!;
    const maxScore = candidates[0]?.score.totalScore ?? 0;
    suffixMaxScore[i] = suffixMaxScore[i + 1] + maxScore;
  }

  // 5. Greedy Warm-Start Heuristic
  // Establishes an initial lower bound before branch-and-bound starts,
  // enabling immediate admissible upper-bound pruning.
  let bestAssignments: StageAssignment[] | null = null;
  let bestBreakdown: OptimizationObjectiveBreakdown | null = null;

  const greedyAssignments: StageAssignment[] = [];
  const greedyTracker = new VigorTracker(context);
  let greedyFeasible = true;

  for (const stage of sortedStages) {
    const candidates = stageCandidatesMap.get(stage.id)!;
    let assigned = false;
    for (const entry of candidates) {
      if (greedyTracker.canAfford(entry.candidate, stage)) {
        greedyTracker.apply(entry.candidate, stage);
        greedyAssignments.push({
          stageId: stage.id,
          stageIndex: stage.stageIndex,
          vigorCost: stage.vigorCost,
          teamKey: entry.candidate.id || entry.candidateKey,
          team: entry.candidate,
          teamScore: entry.score,
        });
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      greedyFeasible = false;
      break;
    }
  }

  if (greedyFeasible) {
    bestBreakdown = computeObjectiveBreakdown(greedyAssignments);
    bestAssignments = [...greedyAssignments];
  }

  // 6. Branch-and-Bound Search State
  let searchStatesExplored = 0;
  let prunedStatesCount = 0;

  // In EXACT mode: no artificial search-state limit is enforced (unbounded complete search).
  // In BEST_EFFORT mode: search budget is enforced.
  const maxSearchStates = isExact
    ? Infinity
    : (options.maxSearchStates ?? DEFAULT_BEST_EFFORT_SEARCH_STATES);

  const currentAssignments: StageAssignment[] = [];

  function search(stageIdx: number, currentScore: number): void {
    searchStatesExplored++;

    if (!isExact && searchStatesExplored > maxSearchStates) {
      prunedStatesCount++;
      return;
    }

    // Base case: All stages assigned
    if (stageIdx === numStages) {
      const breakdown = computeObjectiveBreakdown(currentAssignments);
      if (!bestBreakdown || compareObjectiveBreakdowns(breakdown, bestBreakdown) < 0) {
        bestBreakdown = breakdown;
        bestAssignments = [...currentAssignments];
      }
      return;
    }

    // Admissible Primary Upper Bound Pruning:
    // upperBound = currentScore + sum(max candidate score for remaining stages).
    // Prune strictly when remainingUpperBound < bestPrimaryScore.
    // Never prune when remainingUpperBound === bestPrimaryScore based on secondary objectives.
    const remainingUpperBound = currentScore + suffixMaxScore[stageIdx];
    if (bestBreakdown && remainingUpperBound < bestBreakdown.primaryScore) {
      prunedStatesCount++;
      return;
    }

    const currentStage = sortedStages[stageIdx];
    const candidateList = stageCandidatesMap.get(currentStage.id)!;

    for (const entry of candidateList) {
      // Vigor Constraint Check
      if (!vigorTracker.canAfford(entry.candidate, currentStage)) {
        prunedStatesCount++;
        continue;
      }

      // Apply Vigor & add to current assignment
      vigorTracker.apply(entry.candidate, currentStage);
      currentAssignments.push({
        stageId: currentStage.id,
        stageIndex: currentStage.stageIndex,
        vigorCost: currentStage.vigorCost,
        teamKey: entry.candidate.id || entry.candidateKey,
        team: entry.candidate,
        teamScore: entry.score,
      });

      // Recurse to next stage
      search(stageIdx + 1, currentScore + entry.score.totalScore);

      // Backtrack
      currentAssignments.pop();
      vigorTracker.rollback(entry.candidate, currentStage);
    }
  }

  // Execute branch-and-bound
  search(0, 0);

  const durationMs = performance.now() - startTime;

  // 7. Return Result
  if (!bestAssignments || !bestBreakdown) {
    return {
      status: 'INFEASIBLE',
      mode,
      totalScore: 0,
      assignments: [],
      vigorUsage: vigorTracker.getVigorUsageSummary(),
      totalVigorConsumed: 0,
      distinctTeamsCount: 0,
      objectiveBreakdown: computeObjectiveBreakdown([]),
      evidence: [],
      infeasibilityReasons: [
        'Global search exhausted: No joint assignment of teams across all stages satisfies resonator Vigor capacities.',
      ],
      metrics: {
        stagesCount: stages.length,
        candidateStageMatrixSize,
        searchStatesExplored,
        prunedStatesCount,
        durationMs,
      },
    };
  }

  // Compute final vigor usage
  const finalTracker = new VigorTracker(context);
  for (const a of bestAssignments) {
    finalTracker.apply(a.team, {
      vigorCost: a.vigorCost,
    } as ToAStage);
  }

  // Sort assignments back into original stage order
  const stageOrderMap = new Map<string, number>();
  stages.forEach((s, idx) => stageOrderMap.set(s.id, idx));
  bestAssignments.sort((a, b) => (stageOrderMap.get(a.stageId) ?? 0) - (stageOrderMap.get(b.stageId) ?? 0));

  const finalEvidence = generateOptimizationEvidence(bestAssignments);

  // Status honesty: ONLY OPTIMAL from EXACT mode; BEST_FOUND from BEST_EFFORT mode
  const finalStatus: OptimizationStatus = isExact ? 'OPTIMAL' : 'BEST_FOUND';

  return {
    status: finalStatus,
    mode,
    totalScore: bestBreakdown.primaryScore,
    assignments: bestAssignments,
    vigorUsage: finalTracker.getVigorUsageSummary(),
    totalVigorConsumed: bestBreakdown.totalVigorConsumed,
    distinctTeamsCount: bestBreakdown.distinctTeamsCount,
    objectiveBreakdown: bestBreakdown,
    evidence: finalEvidence,
    metrics: {
      stagesCount: stages.length,
      candidateStageMatrixSize,
      searchStatesExplored,
      prunedStatesCount,
      durationMs,
    },
  };
}
