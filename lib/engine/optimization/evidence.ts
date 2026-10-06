/**
 * Structured Optimization Evidence Generation
 *
 * Produces machine-readable explanation facts detailing why each team
 * was assigned to each stage, resource consumption, and global opportunity tradeoffs.
 */

import type { StageAssignment, OptimizationEvidence } from './types.ts';

export function generateOptimizationEvidence(
  assignments: StageAssignment[]
): OptimizationEvidence[] {
  const evidence: OptimizationEvidence[] = [];

  for (const a of assignments) {
    const dim = a.teamScore.dimensions;
    const members = a.team.members.map((m) => m.resonator.name).join(', ');
    const memberIds = a.team.members.map((m) => m.resonator.id);

    const globalReason =
      `Assigned ${a.teamKey} (${members}) to Stage ${a.stageIndex} (Vigor: ${a.vigorCost}). ` +
      `Yields stage score ${a.teamScore.totalScore}/1000 with ${dim.stageBuffCompatibility.score}% stage buff alignment and ` +
      `${dim.elementalMatchup.score}% elemental suitability while respecting global roster Vigor capacity.`;

    evidence.push({
      stageId: a.stageId,
      stageIndex: a.stageIndex,
      teamKey: a.teamKey,
      stageScore: a.teamScore.totalScore,
      elementalMatchupScore: dim.elementalMatchup.score,
      stageBuffScore: dim.stageBuffCompatibility.score,
      offensiveSynergyScore: dim.offensiveSynergy.score,
      vigorCost: a.vigorCost,
      resonatorsUsed: memberIds,
      globalReason,
    });
  }

  return evidence;
}
