/**
 * Wuthering Waves Deterministic Tower of Adversity Allocation Audit
 * Phase 7 Step 23: Deterministic Tower of Adversity Vigor Allocation & Stage Scheduling Contract
 *
 * Provides independent, adversarial verification of ToAAllocation records,
 * validating Vigor budgets, assignment cardinality, objective tuple fidelity,
 * and absence of prohibited keys.
 */

import {
  TOA_ALLOCATION_RULE_VERSION,
  CANONICAL_PATCH_VERSION,
  CANONICAL_SEASON_ID,
  REQUIRED_STEP21_RULE_VERSION,
  MAX_RESONATOR_VIGOR,
  MIN_STAGE_VIGOR_COST,
  MAX_STAGE_VIGOR_COST,
  CANONICAL_ELEMENTS,
  TEAM_MEMBER_COUNT
} from './rules.ts';
import {
  assertNoProhibitedToAAllocationKeys,
  calculateBuffMatches,
  buildCanonicalAssignmentKey
} from './predicates.ts';
import { getDefaultToAAllocationResult } from './repository.ts';
import type {
  ToAAllocation,
  ToAAllocationResult,
  ToAStageAssignment,
  ToAAllocationObjectiveTuple
} from './types.ts';

export interface ToAAllocationAuditViolation {
  readonly code: string;
  readonly message: string;
  readonly context?: Record<string, unknown>;
}

export interface ToAAllocationAuditReport {
  readonly isValid: boolean;
  readonly allocationId: string;
  readonly status: string;
  readonly violations: readonly ToAAllocationAuditViolation[];
  readonly verifiedAt: string;
}

/**
 * Independently audits a single ToAAllocation record against all contract invariants.
 */
export function auditSingleToAAllocation(allocation: ToAAllocation): ToAAllocationAuditReport {
  const violations: ToAAllocationAuditViolation[] = [];

  // 1. Prohibited keys audit
  try {
    assertNoProhibitedToAAllocationKeys(allocation);
  } catch (err) {
    violations.push({
      code: 'PROHIBITED_KEY_DETECTED',
      message: (err as Error).message
    });
  }

  // 2. Identity and version invariants
  if (allocation.patchVersion !== CANONICAL_PATCH_VERSION) {
    violations.push({
      code: 'PATCH_MISMATCH',
      message: `allocation.patchVersion '${allocation.patchVersion}' !== '${CANONICAL_PATCH_VERSION}'`
    });
  }
  if (allocation.ruleVersion !== TOA_ALLOCATION_RULE_VERSION) {
    violations.push({
      code: 'RULE_VERSION_MISMATCH',
      message: `allocation.ruleVersion '${allocation.ruleVersion}' !== '${TOA_ALLOCATION_RULE_VERSION}'`
    });
  }
  if (allocation.seasonId !== CANONICAL_SEASON_ID) {
    violations.push({
      code: 'SEASON_MISMATCH',
      message: `allocation.seasonId '${allocation.seasonId}' !== '${CANONICAL_SEASON_ID}'`
    });
  }

  // 3. Stage cardinality and uniqueness
  const seenStageIds = new Set<string>();
  const canonicalElementSet = new Set(CANONICAL_ELEMENTS.map((e) => e.toLowerCase()));

  for (const a of allocation.assignments) {
    if (seenStageIds.has(a.stage.stageId)) {
      violations.push({
        code: 'DUPLICATE_STAGE_ASSIGNMENT',
        message: `Stage '${a.stage.stageId}' appears more than once in assignments.`
      });
    }
    seenStageIds.add(a.stage.stageId);

    // Verify stage integrity
    if (a.stage.patchVersion !== CANONICAL_PATCH_VERSION) {
      violations.push({
        code: 'STAGE_PATCH_MISMATCH',
        message: `Stage '${a.stage.stageId}' patchVersion '${a.stage.patchVersion}' !== '${CANONICAL_PATCH_VERSION}'.`
      });
    }
    if (a.stage.seasonId !== CANONICAL_SEASON_ID) {
      violations.push({
        code: 'STAGE_SEASON_MISMATCH',
        message: `Stage '${a.stage.stageId}' seasonId '${a.stage.seasonId}' !== '${CANONICAL_SEASON_ID}'.`
      });
    }
    if (
      typeof a.stage.vigorCost !== 'number' ||
      !Number.isInteger(a.stage.vigorCost) ||
      a.stage.vigorCost < MIN_STAGE_VIGOR_COST ||
      a.stage.vigorCost > MAX_STAGE_VIGOR_COST
    ) {
      violations.push({
        code: 'INVALID_STAGE_VIGOR_COST',
        message: `Stage '${a.stage.stageId}' has invalid vigorCost ${a.stage.vigorCost}.`
      });
    }
    if (a.stage.beneficialElements) {
      for (const elem of a.stage.beneficialElements) {
        if (!canonicalElementSet.has(elem.toLowerCase())) {
          violations.push({
            code: 'NON_CANONICAL_BENEFICIAL_ELEMENT',
            message: `Stage '${a.stage.stageId}' contains non-canonical element '${elem}'.`
          });
        }
      }
    }

    // If assigned, verify team invariants
    if (a.isAssigned) {
      if (!a.team) {
        violations.push({
          code: 'ASSIGNED_STAGE_MISSING_TEAM',
          message: `Stage '${a.stage.stageId}' marked isAssigned=true but team is null.`
        });
      } else {
        if (a.team.memberResonatorIds.length !== TEAM_MEMBER_COUNT) {
          violations.push({
            code: 'INVALID_TEAM_MEMBER_COUNT',
            message: `Assigned team '${a.team.id}' has ${a.team.memberResonatorIds.length} members, expected ${TEAM_MEMBER_COUNT}.`
          });
        }
        if (new Set(a.team.memberResonatorIds).size !== TEAM_MEMBER_COUNT) {
          violations.push({
            code: 'DUPLICATE_TEAM_MEMBER',
            message: `Assigned team '${a.team.id}' contains duplicate member Resonators.`
          });
        }
        if (a.team.patchVersion !== CANONICAL_PATCH_VERSION) {
          violations.push({
            code: 'TEAM_PATCH_MISMATCH',
            message: `Assigned team '${a.team.id}' patchVersion '${a.team.patchVersion}' !== '${CANONICAL_PATCH_VERSION}'.`
          });
        }
        if (a.team.ruleVersion !== REQUIRED_STEP21_RULE_VERSION) {
          violations.push({
            code: 'TEAM_RULE_VERSION_MISMATCH',
            message: `Assigned team '${a.team.id}' ruleVersion '${a.team.ruleVersion}' !== '${REQUIRED_STEP21_RULE_VERSION}'.`
          });
        }
      }
    } else {
      if (a.team !== null) {
        violations.push({
          code: 'UNASSIGNED_STAGE_HAS_TEAM',
          message: `Stage '${a.stage.stageId}' marked isAssigned=false but team is non-null.`
        });
      }
    }
  }

  // 4. Independent Vigor consumption calculation
  const calculatedUsedVigor = new Map<string, number>();
  for (const a of allocation.assignments) {
    if (a.isAssigned && a.team) {
      for (const memberId of a.team.memberResonatorIds) {
        const cur = calculatedUsedVigor.get(memberId) ?? 0;
        calculatedUsedVigor.set(memberId, cur + a.vigorCost);
      }
    }
  }

  // Check character Vigor bounds (no Resonator > 10 Vigor)
  for (const [resId, used] of calculatedUsedVigor.entries()) {
    if (used > MAX_RESONATOR_VIGOR) {
      violations.push({
        code: 'CHARACTER_VIGOR_EXCEEDED',
        message: `Resonator '${resId}' consumed ${used} Vigor, exceeding maximum capacity of ${MAX_RESONATOR_VIGOR}.`
      });
    }
  }

  // Verify against reported vigorAccounting records
  for (const va of allocation.vigorAccounting) {
    const calculated = calculatedUsedVigor.get(va.resonatorId) ?? 0;
    if (va.vigorConsumed !== calculated) {
      violations.push({
        code: 'VIGOR_ACCOUNTING_DISCREPANCY',
        message: `Resonator '${va.resonatorId}' reported vigorConsumed=${va.vigorConsumed}, calculated=${calculated}.`
      });
    }
    if (va.vigorRemaining !== va.startingVigor - va.vigorConsumed) {
      violations.push({
        code: 'VIGOR_REMAINING_ARITHMETIC_ERROR',
        message: `Resonator '${va.resonatorId}' startingVigor (${va.startingVigor}) - consumed (${va.vigorConsumed}) !== remaining (${va.vigorRemaining}).`
      });
    }
  }

  // 5. Independent Objective Tuple Recomputation
  let recomputedStages = 0;
  let recomputedBuffMatches = 0;
  let recomputedIncomp = 0;
  let recomputedFully = 0;
  let recomputedKnownAspects = 0;
  let recomputedSynergyPairs = 0;
  let recomputedDirectionalEdges = 0;
  const keyPairs: { stageId: string; teamId: string | null }[] = [];

  for (const a of allocation.assignments) {
    if (a.isAssigned && a.team) {
      recomputedStages++;
      const buff = calculateBuffMatches(a.team, a.stage);
      recomputedBuffMatches += buff.count;

      if (a.team.weaponAggregation.hasIncompatibleWeapon) {
        recomputedIncomp++;
      }
      if (a.team.status === 'FULLY_EQUIPPED') {
        recomputedFully++;
      }
      recomputedKnownAspects += a.team.completeness.knownTeamAspects;
      keyPairs.push({ stageId: a.stage.stageId, teamId: a.team.id });
    } else {
      keyPairs.push({ stageId: a.stage.stageId, teamId: null });
    }
  }

  const expectedKey = buildCanonicalAssignmentKey(keyPairs);

  const obj = allocation.objectiveTuple;
  if (obj.stagesCompleted !== recomputedStages) {
    violations.push({
      code: 'OBJECTIVE_STAGES_COMPLETED_MISMATCH',
      message: `objectiveTuple.stagesCompleted=${obj.stagesCompleted}, calculated=${recomputedStages}`
    });
  }
  if (obj.beneficialBuffMatches !== recomputedBuffMatches) {
    violations.push({
      code: 'OBJECTIVE_BUFF_MATCHES_MISMATCH',
      message: `objectiveTuple.beneficialBuffMatches=${obj.beneficialBuffMatches}, calculated=${recomputedBuffMatches}`
    });
  }
  if (obj.incompatibleWeaponAssignments !== recomputedIncomp) {
    violations.push({
      code: 'OBJECTIVE_INCOMPATIBLE_WEAPONS_MISMATCH',
      message: `objectiveTuple.incompatibleWeaponAssignments=${obj.incompatibleWeaponAssignments}, calculated=${recomputedIncomp}`
    });
  }
  if (obj.fullyEquippedAssignments !== recomputedFully) {
    violations.push({
      code: 'OBJECTIVE_FULLY_EQUIPPED_MISMATCH',
      message: `objectiveTuple.fullyEquippedAssignments=${obj.fullyEquippedAssignments}, calculated=${recomputedFully}`
    });
  }
  if (obj.totalKnownAspects !== recomputedKnownAspects) {
    violations.push({
      code: 'OBJECTIVE_KNOWN_ASPECTS_MISMATCH',
      message: `objectiveTuple.totalKnownAspects=${obj.totalKnownAspects}, calculated=${recomputedKnownAspects}`
    });
  }
  if (obj.totalSynergyPairs !== recomputedSynergyPairs) {
    violations.push({
      code: 'OBJECTIVE_SYNERGY_PAIRS_MISMATCH',
      message: `objectiveTuple.totalSynergyPairs=${obj.totalSynergyPairs}, calculated=${recomputedSynergyPairs}`
    });
  }
  if (obj.totalDirectionalEdges !== recomputedDirectionalEdges) {
    violations.push({
      code: 'OBJECTIVE_DIRECTIONAL_EDGES_MISMATCH',
      message: `objectiveTuple.totalDirectionalEdges=${obj.totalDirectionalEdges}, calculated=${recomputedDirectionalEdges}`
    });
  }
  if (obj.canonicalAssignmentKey !== expectedKey) {
    violations.push({
      code: 'OBJECTIVE_CANONICAL_KEY_MISMATCH',
      message: `objectiveTuple.canonicalAssignmentKey mismatch.`
    });
  }

  // 6. Status consistency
  if (allocation.status === 'OPTIMAL_ALLOCATION') {
    if (allocation.completeness.assignedStageCount !== allocation.completeness.targetStageCount) {
      violations.push({
        code: 'STATUS_CONSISTENCY_ERROR',
        message: `Status is 'OPTIMAL_ALLOCATION' but not all target stages were assigned (${allocation.completeness.assignedStageCount}/${allocation.completeness.targetStageCount}).`
      });
    }
    const anyNotFullyEquipped = allocation.assignments.some(
      (a) => a.isAssigned && a.team && a.team.status !== 'FULLY_EQUIPPED'
    );
    if (anyNotFullyEquipped) {
      violations.push({
        code: 'OPTIMAL_STATUS_WITH_PARTIAL_EQUIPMENT',
        message: "Status is 'OPTIMAL_ALLOCATION' but one or more assigned teams are not FULLY_EQUIPPED."
      });
    }
  } else if (allocation.status === 'FEASIBLE_ALLOCATION') {
    if (allocation.completeness.assignedStageCount !== allocation.completeness.targetStageCount) {
      violations.push({
        code: 'STATUS_CONSISTENCY_ERROR',
        message: `Status is 'FEASIBLE_ALLOCATION' but not all target stages were assigned (${allocation.completeness.assignedStageCount}/${allocation.completeness.targetStageCount}).`
      });
    }
  } else if (allocation.status === 'PARTIAL_ALLOCATION') {
    if (allocation.completeness.assignedStageCount === allocation.completeness.targetStageCount) {
      violations.push({
        code: 'PARTIAL_STATUS_WITH_FULL_COVERAGE',
        message: `Status is 'PARTIAL_ALLOCATION' but all stages were assigned.`
      });
    }
  }

  const report: ToAAllocationAuditReport = {
    isValid: violations.length === 0,
    allocationId: allocation.id,
    status: allocation.status,
    violations: Object.freeze(violations.map((v) => Object.freeze({ ...v }))),
    verifiedAt: 'OFFLINE_DETERMINISTIC_AUDIT'
  };
  return Object.freeze(report);
}

/**
 * Runs the production ToA allocation audit against default Season 40 catalog.
 */
export function runProductionToAAllocationAudit(): ToAAllocationResult {
  const result = getDefaultToAAllocationResult();
  const auditReport = auditSingleToAAllocation(result.allocation);
  if (!auditReport.isValid) {
    throw new Error(
      `runProductionToAAllocationAudit: Invariant violations detected: ${JSON.stringify(auditReport.violations)}`
    );
  }
  return result;
}
