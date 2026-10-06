/**
 * Authoritative Deterministic Explanation Builder
 *
 * Transforms optimization results, score dimensions, stage rules, and vigor allocations
 * into a rich, structured, human- and machine-readable explanation model.
 *
 * Strict invariants:
 * - Deterministic output: byte-for-byte identical on repeated runs
 * - No side-effects, no database access, no timestamps, no randomness
 * - No modification of optimizer results
 * - No LLM dependency (LLM is downstream presentation-only)
 */

import type {
  ToAOptimizationContext,
  ToAOptimizationResult,
} from '../optimization/types.ts';
import type { ToAStage } from '../../domain/types/index.ts';
import type {
  GlobalOptimizationExplanation,
  StageExplanation,
} from './types.ts';
import { buildStageExplanation } from './stage-analyzer.ts';
import {
  explainOptimality,
  buildGlobalVigorExplanation,
  buildGlobalTradeoffs,
  buildGlobalSummaryReasons,
  buildGlobalEvidence,
} from './global-analyzer.ts';

/**
 * Builds the complete deterministic explanation model for a ToA optimization run.
 */
export function buildOptimizationExplanation(
  context: ToAOptimizationContext,
  result: ToAOptimizationResult
): GlobalOptimizationExplanation {
  // 1. Map stages by ID for O(1) lookup
  const stageMap = new Map<string, ToAStage>();
  for (const stage of context.stages) {
    stageMap.set(stage.id, stage);
  }

  // 2. Pre-compute maximum candidate score per stage (if candidate scores are supplied)
  const maxLocalScores = new Map<string, number>();
  if (context.scores) {
    const scoresIterable =
      context.scores instanceof Map ? context.scores.values() : context.scores;
    for (const s of scoresIterable) {
      const current = maxLocalScores.get(s.stageKey) ?? 0;
      if (s.totalScore > current) {
        maxLocalScores.set(s.stageKey, s.totalScore);
      }
    }
  }

  // 3. Vigor tracking setup
  const runningUsage = new Map<string, number>();
  const capacities = new Map<string, number>();
  const defaultCapacity = context.defaultVigorCapacity ?? 10;

  if (context.vigorCapacities) {
    if (context.vigorCapacities instanceof Map) {
      for (const [k, v] of context.vigorCapacities.entries()) {
        capacities.set(k, v);
      }
    } else {
      for (const [k, v] of Object.entries(context.vigorCapacities)) {
        capacities.set(k, v);
      }
    }
  }

  // 4. Sort assignments deterministically by stageIndex
  const sortedAssignments = [...result.assignments].sort(
    (a, b) => a.stageIndex - b.stageIndex
  );

  // 5. Build per-stage explanations
  const stageExplanations: StageExplanation[] = [];
  for (const a of sortedAssignments) {
    const stage = stageMap.get(a.stageId);
    if (!stage) continue;

    const stageKey = `${stage.patchId}:${stage.id}`;
    const maxLocal = maxLocalScores.get(stageKey);

    const explanation = buildStageExplanation(
      a,
      stage,
      runningUsage,
      capacities,
      defaultCapacity,
      maxLocal
    );
    stageExplanations.push(explanation);
  }

  // 6. Global components
  const optimalityExplanation = explainOptimality(result);
  const vigorExplanation = buildGlobalVigorExplanation(context, result);
  const globalTradeoffs = buildGlobalTradeoffs(result, vigorExplanation);
  const summaryReasons = buildGlobalSummaryReasons(
    result,
    optimalityExplanation,
    vigorExplanation
  );
  const evidence = buildGlobalEvidence(context, result);

  return {
    status: result.status,
    optimality: result.optimality,
    optimalityExplanation,
    summaryReasons,
    stages: stageExplanations,
    totalScore: result.totalScore,
    globalPrimaryUpperBound: result.globalPrimaryUpperBound,
    vigor: vigorExplanation,
    globalTradeoffs,
    evidence,
  };
}
