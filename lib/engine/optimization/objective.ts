/**
 * Optimization Objective Function & Deterministic Tie-Breaking
 *
 * Implements primary maximization objective (sum of stage scores)
 * and 5 secondary lexicographical tie-breaking criteria.
 */

import type { StageAssignment, OptimizationObjectiveBreakdown } from './types.ts';

export interface EvaluatedAssignmentState {
  assignments: StageAssignment[];
  totalScore: number;
  minStageScore: number;
  totalStageBuffScore: number;
  totalVigorConsumed: number;
  distinctTeamsCount: number;
  canonicalAssignmentKey: string;
}

export function computeObjectiveBreakdown(
  assignments: StageAssignment[]
): OptimizationObjectiveBreakdown {
  if (assignments.length === 0) {
    return {
      primaryScore: 0,
      minStageScore: 0,
      totalStageBuffScore: 0,
      totalVigorConsumed: 0,
      distinctTeamsCount: 0,
      canonicalAssignmentKey: '',
    };
  }

  let totalScore = 0;
  let minStageScore = Infinity;
  let totalStageBuffScore = 0;
  let totalVigorConsumed = 0;
  const distinctTeams = new Set<string>();

  // Sort assignments by stageId for deterministic canonical assignment key
  const sorted = [...assignments].sort((a, b) => a.stageId.localeCompare(b.stageId));
  const keyParts: string[] = [];

  for (const a of sorted) {
    const score = a.teamScore.totalScore;
    totalScore += score;
    minStageScore = Math.min(minStageScore, score);
    totalStageBuffScore += a.teamScore.dimensions.stageBuffCompatibility.weightedScore;
    totalVigorConsumed += a.vigorCost * 3; // 3 members each pay vigorCost
    distinctTeams.add(a.teamKey);
    keyParts.push(`${a.stageId}:${a.teamKey}`);
  }

  return {
    primaryScore: totalScore,
    minStageScore: minStageScore === Infinity ? 0 : minStageScore,
    totalStageBuffScore,
    totalVigorConsumed,
    distinctTeamsCount: distinctTeams.size,
    canonicalAssignmentKey: keyParts.join('|'),
  };
}

/**
 * Compares two complete feasible assignment states deterministically.
 * Returns:
 *   < 0 if candidate A is strictly better than candidate B
 *   > 0 if candidate B is strictly better than candidate A
 *   0 if identical across all primary and secondary criteria
 */
export function compareObjectiveBreakdowns(
  a: OptimizationObjectiveBreakdown,
  b: OptimizationObjectiveBreakdown
): number {
  // 1. Primary Objective: Maximize total score
  if (b.primaryScore !== a.primaryScore) {
    return b.primaryScore - a.primaryScore;
  }

  // 2. Secondary Objective 1: Maximize minimum stage score
  if (b.minStageScore !== a.minStageScore) {
    return b.minStageScore - a.minStageScore;
  }

  // 3. Secondary Objective 2: Maximize total stage-buff compatibility
  if (b.totalStageBuffScore !== a.totalStageBuffScore) {
    return b.totalStageBuffScore - a.totalStageBuffScore;
  }

  // 4. Secondary Objective 3: Minimize total Vigor consumed
  if (a.totalVigorConsumed !== b.totalVigorConsumed) {
    return a.totalVigorConsumed - b.totalVigorConsumed;
  }

  // 5. Secondary Objective 4: Minimize distinct teams count
  if (a.distinctTeamsCount !== b.distinctTeamsCount) {
    return a.distinctTeamsCount - b.distinctTeamsCount;
  }

  // 6. Secondary Objective 5: Lexicographically smaller canonical assignment key
  return a.canonicalAssignmentKey.localeCompare(b.canonicalAssignmentKey);
}
