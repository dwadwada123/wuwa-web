/**
 * Wuthering Waves Deterministic Tower of Adversity Vigor Allocation & Stage Scheduling Contract
 * Phase 7 Step 23: Deterministic Tower of Adversity Vigor Allocation & Stage Scheduling Contract
 *
 * Barrel export and factual presentation explanation formatter.
 */

export * from './types.ts';
export {
  TOA_ALLOCATION_RULE_VERSION,
  CANONICAL_SEASON_ID,
  REQUIRED_STEP22_RULE_VERSION,
  RESONATOR_STARTING_VIGOR,
  MAX_RESONATOR_VIGOR,
  MIN_STAGE_VIGOR_COST,
  MAX_STAGE_VIGOR_COST,
  CANONICAL_STAGE_COUNT,
  CANONICAL_TOWER_COUNT,
  CANONICAL_ELEMENTS,
  type CanonicalElement,
  TOA_ALLOCATION_EXPLANATION_CODES,
  EMPTY_TOA_ALLOCATION_PROVENANCE,
  PROHIBITED_TOA_ALLOCATION_KEYS,
  type ProhibitedToAAllocationKey
} from './rules.ts';
export * from './predicates.ts';
export * from './solver.ts';
export * from './builder.ts';
export * from './repository.ts';
export * from './audit.ts';

import type { ToAAllocation } from './types.ts';

/**
 * Formats a factual, human-readable presentation explanation for a ToAAllocation record.
 * Never introduces subjective judgments, combat power, DPS, or tier ratings.
 */
export function formatToAAllocationExplanation(allocation: ToAAllocation): string {
  const lines: string[] = [
    `=== TOWER OF ADVERSITY STAGE ALLOCATION (${allocation.seasonId}) ===`,
    `Allocation ID: ${allocation.id}`,
    `Status: ${allocation.status}`,
    `Coverage: ${allocation.completeness.assignedStageCount}/${allocation.completeness.targetStageCount} stages (${(allocation.completeness.stageCoverageRatio * 100).toFixed(1)}%)`,
    `Vigor Consumed: ${allocation.completeness.totalVigorConsumed} across ${allocation.distinctResonatorsUsedCount} Resonators (${allocation.distinctTeamsUsedCount} distinct teams utilized)`,
    'Stage Assignments:'
  ];

  for (const a of allocation.assignments) {
    if (a.isAssigned && a.team) {
      const matchText =
        a.buffMatchedMemberCount > 0
          ? ` [Buff Matches: ${a.buffMatchedMemberCount} (${a.matchedBeneficialElements.join(', ')})]`
          : '';
      lines.push(
        `  • [${a.stage.towerName} Floor ${a.stage.stageIndex}] Cost: ${a.vigorCost} Vigor -> Team: ${a.team.memberResonatorIds.join(' + ')}${matchText}`
      );
    } else {
      lines.push(
        `  • [${a.stage.towerName} Floor ${a.stage.stageIndex}] Cost: ${a.stage.vigorCost} Vigor -> UNASSIGNED (${a.unassignedReason ?? 'Infeasible'})`
      );
    }
  }

  lines.push('Per-Resonator Vigor Usage:');
  for (const v of allocation.vigorAccounting) {
    if (v.vigorConsumed > 0) {
      lines.push(
        `  • ${v.resonatorId}: Used ${v.vigorConsumed}/${v.startingVigor} Vigor (${v.vigorRemaining} remaining) across ${v.assignedStageCount} stages`
      );
    }
  }

  lines.push('Notice: Multi-stage equipment swapping and non-elemental buff stacking are unmodeled.');
  lines.push('==================================================================');

  return lines.join('\n');
}
