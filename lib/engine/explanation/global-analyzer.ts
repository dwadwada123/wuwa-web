/**
 * Deterministic Global Optimization Explanation Analyzer
 *
 * Grounded in:
 * - Optimality status semantics & strict mathematical language
 * - Global Vigor capacity, consumption & bottleneck tracking
 * - Global vs Local opportunity-cost tradeoffs
 * - Provenance metadata and verifiable fact evidence
 */

import type {
  ToAOptimizationContext,
  ToAOptimizationResult,
  StageAssignment,
} from '../optimization/types.ts';
import type {
  GlobalOptimizationExplanation,
  OptimalityExplanation,
  VigorExplanation,
  ResonatorVigorSummary,
  ExplanationReason,
  ExplanationEvidence,
} from './types.ts';

/**
 * Derives authoritative optimality explanation respecting strict mathematical semantics.
 */
export function explainOptimality(result: ToAOptimizationResult): OptimalityExplanation {
  const status = result.status;
  const optimality = result.optimality;
  const achievedScore = result.totalScore;
  const upperBound = result.globalPrimaryUpperBound;

  if (status === 'INFEASIBLE') {
    return {
      status,
      optimality,
      title: 'Optimization Infeasible',
      description:
        'No feasible joint assignment of valid teams satisfies the roster Vigor capacity across the requested stages.',
      isGloballyOptimalPrimary: false,
      isFullLexicographicOptimal: false,
      achievedScore: 0,
      globalPrimaryUpperBound: upperBound,
    };
  }

  if (optimality === 'FULL_LEXICOGRAPHIC_PROVEN') {
    return {
      status,
      optimality,
      title: 'Full Lexicographic Optimality Proven',
      description:
        'The assignment is fully proven optimal under the configured objective and tie-break rules.',
      isGloballyOptimalPrimary: true,
      isFullLexicographicOptimal: true,
      achievedScore,
      globalPrimaryUpperBound: upperBound,
    };
  }

  if (optimality === 'PRIMARY_PROVEN') {
    return {
      status,
      optimality,
      title: 'Primary Objective Proven Optimal',
      description:
        'The optimizer found a feasible assignment whose total score reaches the mathematically proven global upper bound.',
      isGloballyOptimalPrimary: true,
      isFullLexicographicOptimal: false,
      achievedScore,
      globalPrimaryUpperBound: upperBound,
    };
  }

  // NOT_PROVEN or unspecified
  return {
    status,
    optimality,
    title: 'Best Discovered Solution (Not Proven Optimal)',
    description:
      'The optimizer found the best solution discovered within the available search budget, but full optimality was not proven.',
    isGloballyOptimalPrimary: false,
    isFullLexicographicOptimal: false,
    achievedScore,
    globalPrimaryUpperBound: upperBound,
  };
}

/**
 * Builds global Vigor allocation explanation across all owned resonators.
 */
export function buildGlobalVigorExplanation(
  context: ToAOptimizationContext,
  result: ToAOptimizationResult
): VigorExplanation {
  const defaultCapacity = context.defaultVigorCapacity ?? 10;
  const capacitiesMap = new Map<string, number>();

  if (context.vigorCapacities) {
    if (context.vigorCapacities instanceof Map) {
      for (const [k, v] of context.vigorCapacities.entries()) {
        capacitiesMap.set(k, v);
      }
    } else {
      for (const [k, v] of Object.entries(context.vigorCapacities)) {
        capacitiesMap.set(k, v);
      }
    }
  }

  // Map of usage per resonator
  const usageMap = new Map<
    string,
    {
      used: number;
      name: string;
      stages: Array<{ stageId: string; stageIndex: number; vigorCost: number }>;
    }
  >();

  // Initialize for all resonators in roster
  for (const rId of context.roster.resonatorIds) {
    usageMap.set(rId, { used: 0, name: rId, stages: [] });
  }

  // Populate from assignments
  for (const a of result.assignments) {
    for (const m of a.team.members) {
      const id = m.resonator.id;
      const rec = usageMap.get(id) ?? { used: 0, name: m.resonator.name, stages: [] };
      rec.used += a.vigorCost;
      rec.name = m.resonator.name;
      rec.stages.push({
        stageId: a.stageId,
        stageIndex: a.stageIndex,
        vigorCost: a.vigorCost,
      });
      usageMap.set(id, rec);
    }
  }

  const summaries: ResonatorVigorSummary[] = [];
  const bottleneckResonators: string[] = [];
  const unexhaustedResonators: string[] = [];
  let totalCapacity = 0;
  let totalConsumed = 0;

  for (const [id, rec] of usageMap.entries()) {
    const capacity = capacitiesMap.get(id) ?? defaultCapacity;
    const remaining = Math.max(0, capacity - rec.used);
    totalCapacity += capacity;
    totalConsumed += rec.used;

    summaries.push({
      resonatorId: id,
      name: rec.name,
      used: rec.used,
      capacity,
      remaining,
      stagesAssigned: rec.stages.sort((a, b) => a.stageIndex - b.stageIndex),
    });

    if (rec.used > 0 && remaining === 0) {
      bottleneckResonators.push(id);
    } else if (remaining > 0) {
      unexhaustedResonators.push(id);
    }
  }

  // Deterministic sorting
  summaries.sort((a, b) => a.resonatorId.localeCompare(b.resonatorId));
  bottleneckResonators.sort();
  unexhaustedResonators.sort();

  const utilizationPercentage =
    totalCapacity > 0 ? Math.round((totalConsumed / totalCapacity) * 10000) / 100 : 0;

  const summary =
    `Consumed ${totalConsumed} / ${totalCapacity} total roster Vigor (${utilizationPercentage}% utilization). ` +
    `${bottleneckResonators.length} resonator(s) reached full Vigor capacity exhaustion; ` +
    `${unexhaustedResonators.length} resonator(s) retain remaining stamina.`;

  return {
    totalVigorConsumed: totalConsumed,
    totalRosterVigorCapacity: totalCapacity,
    utilizationPercentage,
    resonators: summaries,
    bottleneckResonators,
    unexhaustedResonators,
    summary,
  };
}

/**
 * Builds global opportunity-cost and tradeoff reasons.
 */
export function buildGlobalTradeoffs(
  result: ToAOptimizationResult,
  vigorExplanation: VigorExplanation
): ExplanationReason[] {
  const reasons: ExplanationReason[] = [];

  if (result.status === 'INFEASIBLE') {
    reasons.push({
      code: 'GLOBAL_INFEASIBILITY_BARRIER',
      category: 'GLOBAL_OPTIMIZATION',
      importance: 'PRIMARY',
      title: 'Roster Infeasibility Barrier',
      facts: {
        reasons: [...(result.infeasibilityReasons || [])].sort(),
      },
    });
    return reasons;
  }

  const upperBound = result.globalPrimaryUpperBound;
  const score = result.totalScore;

  if (upperBound !== undefined) {
    if (score === upperBound) {
      reasons.push({
        code: 'GLOBAL_ZERO_OPPORTUNITY_COST',
        category: 'GLOBAL_OPTIMIZATION',
        importance: 'PRIMARY',
        title: 'Zero Opportunity-Cost Assignment',
        facts: {
          totalScore: score,
          globalPrimaryUpperBound: upperBound,
          deficit: 0,
          isTheoreticalMaximum: true,
          explanation:
            'Every stage simultaneously achieved its theoretical single-stage upper bound without cross-stage Vigor conflict.',
        },
      });
    } else {
      const deficit = upperBound - score;
      reasons.push({
        code: 'GLOBAL_OPPORTUNITY_COST_TRADEOFF',
        category: 'TRADEOFF',
        importance: 'PRIMARY',
        title: 'Global Vigor Opportunity-Cost Compromise',
        facts: {
          totalScore: score,
          globalPrimaryUpperBound: upperBound,
          deficit,
          isTheoreticalMaximum: false,
          explanation:
            'Vigor constraints prevented all stages from running their respective single-stage best teams simultaneously, requiring an optimal joint trade-off.',
        },
      });
    }
  }

  if (vigorExplanation.bottleneckResonators.length > 0) {
    reasons.push({
      code: 'GLOBAL_VIGOR_BOTTLENECK',
      category: 'VIGOR',
      importance: 'SECONDARY',
      title: 'Roster Vigor Exhaustion Bottleneck',
      facts: {
        exhaustedCount: vigorExplanation.bottleneckResonators.length,
        exhaustedResonators: vigorExplanation.bottleneckResonators,
        explanation:
          'Certain high-performing resonators exhausted their complete 10-Vigor capacity across high-cost hazard floors.',
      },
    });
  }

  // Deterministic sort
  reasons.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    if (a.code !== b.code) return a.code.localeCompare(b.code);
    return a.title.localeCompare(b.title);
  });

  return reasons;
}

/**
 * Builds high-level summary reasons for the overall optimization.
 */
export function buildGlobalSummaryReasons(
  result: ToAOptimizationResult,
  optimalityExpl: OptimalityExplanation,
  vigorExpl: VigorExplanation
): ExplanationReason[] {
  const reasons: ExplanationReason[] = [];

  // 1. Optimality status reason
  reasons.push({
    code: `OPTIMALITY_${result.optimality || result.status}`,
    category: 'GLOBAL_OPTIMIZATION',
    importance: 'PRIMARY',
    title: optimalityExpl.title,
    facts: {
      status: result.status,
      mode: result.mode,
      optimality: result.optimality,
      description: optimalityExpl.description,
      totalScore: result.totalScore,
      globalPrimaryUpperBound: result.globalPrimaryUpperBound,
    },
  });

  if (result.status !== 'INFEASIBLE') {
    // 2. Score & assignment summary
    reasons.push({
      code: 'GLOBAL_SCORE_SUMMARY',
      category: 'GLOBAL_OPTIMIZATION',
      importance: 'PRIMARY',
      title: `Global Assignment Score: ${result.totalScore}`,
      facts: {
        totalScore: result.totalScore,
        stagesCount: result.assignments.length,
        distinctTeamsCount: result.distinctTeamsCount,
        minStageScore: result.objectiveBreakdown.minStageScore,
        totalStageBuffScore: result.objectiveBreakdown.totalStageBuffScore,
      },
    });

    // 3. Vigor budget summary
    reasons.push({
      code: 'GLOBAL_VIGOR_BUDGET',
      category: 'VIGOR',
      importance: 'SECONDARY',
      title: `Vigor Budget: ${vigorExpl.totalVigorConsumed} / ${vigorExpl.totalRosterVigorCapacity} Consumed`,
      facts: {
        totalVigorConsumed: vigorExpl.totalVigorConsumed,
        totalRosterVigorCapacity: vigorExpl.totalRosterVigorCapacity,
        utilizationPercentage: vigorExpl.utilizationPercentage,
        bottleneckCount: vigorExpl.bottleneckResonators.length,
      },
    });
  }

  // Sort deterministically
  reasons.sort((a, b) => {
    if (a.importance !== b.importance) {
      const impRank: Record<string, number> = { PRIMARY: 1, SECONDARY: 2, INFO: 3 };
      return impRank[a.importance] - impRank[b.importance];
    }
    return a.code.localeCompare(b.code);
  });

  return reasons;
}

/**
 * Compiles verifiable evidence items traceable to source domain systems.
 */
export function buildGlobalEvidence(
  context: ToAOptimizationContext,
  result: ToAOptimizationResult
): ExplanationEvidence[] {
  const evidence: ExplanationEvidence[] = [];

  // Game data provenance
  evidence.push({
    source: 'GAME_DATA',
    code: 'PROVENANCE_ROSTER_AND_STAGES',
    facts: {
      patchId: context.patchId,
      cycleId: context.cycleId,
      ownedResonatorCount: context.roster.resonatorIds.length,
      requestedStageCount: context.stages.length,
    },
  });

  // Optimizer metrics provenance
  evidence.push({
    source: 'OPTIMIZER',
    code: 'PROVENANCE_SOLVER_METRICS',
    facts: {
      mode: result.mode,
      status: result.status,
      optimality: result.optimality,
      searchStatesExplored: result.metrics.searchStatesExplored,
      prunedStatesCount: result.metrics.prunedStatesCount,
      matrixSize: result.metrics.candidateStageMatrixSize,
    },
  });

  // Objective breakdown provenance
  if (result.status !== 'INFEASIBLE') {
    evidence.push({
      source: 'OPTIMIZER',
      code: 'PROVENANCE_OBJECTIVE_BREAKDOWN',
      facts: {
        primaryScore: result.objectiveBreakdown.primaryScore,
        minStageScore: result.objectiveBreakdown.minStageScore,
        totalStageBuffScore: result.objectiveBreakdown.totalStageBuffScore,
        totalVigorConsumed: result.objectiveBreakdown.totalVigorConsumed,
        distinctTeamsCount: result.objectiveBreakdown.distinctTeamsCount,
      },
    });

    // Per-stage assignment evidence from scoring and optimizer
    for (const a of result.assignments) {
      evidence.push({
        source: 'TEAM_SCORING',
        code: `STAGE_${a.stageIndex}_SCORE_BREAKDOWN`,
        facts: {
          stageId: a.stageId,
          stageIndex: a.stageIndex,
          teamKey: a.teamKey,
          totalScore: a.teamScore.totalScore,
          elementalScore: a.teamScore.dimensions.elementalMatchup.score,
          stageBuffScore: a.teamScore.dimensions.stageBuffCompatibility.score,
          offensiveSynergyScore: a.teamScore.dimensions.offensiveSynergy.score,
          roleCoverageScore: a.teamScore.dimensions.roleCoverage.score,
          sustainScore: a.teamScore.dimensions.sustain.score,
        },
      });

      evidence.push({
        source: 'RULE_ENGINE',
        code: `STAGE_${a.stageIndex}_VIGOR_RULE`,
        facts: {
          stageId: a.stageId,
          stageIndex: a.stageIndex,
          vigorCost: a.vigorCost,
          resonators: a.team.members.map((m) => m.resonator.id).sort(),
        },
      });
    }
  }

  // Deterministic sort by source, then code
  evidence.sort((a, b) => {
    if (a.source !== b.source) return a.source.localeCompare(b.source);
    return a.code.localeCompare(b.code);
  });

  return evidence;
}
