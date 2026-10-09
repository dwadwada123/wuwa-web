/**
 * Wuthering Waves Deterministic Tower of Adversity Allocation Builder
 * Phase 7 Step 23: Deterministic Tower of Adversity Vigor Allocation & Stage Scheduling Contract
 *
 * Orchestrates input validation, stage catalog resolution, solver execution,
 * and immutable ToAAllocation record assembly.
 */

import {
  TOA_ALLOCATION_RULE_VERSION,
  CANONICAL_PATCH_VERSION,
  CANONICAL_SEASON_ID,
  TOA_ALLOCATION_EXPLANATION_CODES,
  OFFLINE_DETERMINISTIC_AUDIT_STAMP
} from './rules.ts';
import {
  validateToAAllocationInput,
  deriveToAAllocationId,
  assertNoProhibitedToAAllocationKeys,
  deepClone,
  deepFreeze
} from './predicates.ts';
import { solveToAAllocation } from './solver.ts';
import { getCanonicalSeason40Stages } from './repository.ts';
import { getDefaultTeamPortfolio } from '../team-portfolio/repository.ts';
import type {
  ToAAllocationInput,
  ToAAllocationResult,
  ToAAllocation,
  ToAAllocationCompletenessMetrics,
  ToAAllocationProvenance,
  ToAAllocationSearchMetrics,
  ToAStageDefinition,
  TeamBuildEvaluation
} from './types.ts';

/**
 * Executes deterministic Tower of Adversity Stage Allocation.
 */
export function allocateToAStages(input?: ToAAllocationInput): ToAAllocationResult {
  // 1. Strict input validation
  validateToAAllocationInput(input);

  const patchVersion = CANONICAL_PATCH_VERSION;
  const ruleVersion = TOA_ALLOCATION_RULE_VERSION;
  const seasonId = input?.seasonId ?? CANONICAL_SEASON_ID;
  const allowPartial = input?.allowPartial ?? false;

  // 2. Resolve target stage catalog
  const fullCatalog = input?.stageCatalog ?? getCanonicalSeason40Stages();
  let targetStages: readonly ToAStageDefinition[] = fullCatalog;

  if (input?.targetStageIds !== undefined) {
    if (input.targetStageIds.length === 0) {
      targetStages = Object.freeze([]);
    } else {
      const stageMap = new Map<string, ToAStageDefinition>();
      for (const stage of fullCatalog) {
        stageMap.set(stage.stageId, stage);
      }

      const filtered: ToAStageDefinition[] = [];
      const seenIds = new Set<string>();

      for (const id of input.targetStageIds) {
        if (seenIds.has(id)) {
          throw new Error(`allocateToAStages: Duplicate target stage ID '${id}' in targetStageIds.`);
        }
        seenIds.add(id);

        const stage = stageMap.get(id);
        if (!stage) {
          throw new Error(
            `allocateToAStages: Requested target stage ID '${id}' not found in active stage catalog.`
          );
        }
        filtered.push(stage);
      }
      targetStages = Object.freeze(filtered);
    }
  }

  // 3. Resolve candidate teams
  let candidateTeams: readonly TeamBuildEvaluation[] = [];
  if (input?.candidateTeams && input.candidateTeams.length > 0) {
    candidateTeams = input.candidateTeams;
  } else if (input?.portfolio) {
    const port = input.portfolio;
    if ('portfolio' in port && (port as any).portfolio) {
      candidateTeams = (port as any).portfolio.teams;
    } else if ('teams' in port) {
      candidateTeams = port.teams;
    }
  } else {
    // Default: use production Step 22 portfolio
    const defaultPortfolio = getDefaultTeamPortfolio();
    candidateTeams = defaultPortfolio.teams;
  }

  // 4. Resolve owned roster
  let ownedResonatorIdsSet: Set<string> | undefined = undefined;
  if (input?.ownedRoster) {
    ownedResonatorIdsSet = new Set<string>();
    if (Array.isArray(input.ownedRoster)) {
      for (const id of input.ownedRoster) {
        ownedResonatorIdsSet.add(id);
      }
    } else if (
      input.ownedRoster &&
      typeof input.ownedRoster === 'object' &&
      'ownedResonators' in input.ownedRoster
    ) {
      const snap = input.ownedRoster as any;
      for (const r of snap.ownedResonators || []) {
        ownedResonatorIdsSet.add(r.resonatorId);
      }
    }
  }

  // 5. Run exact deterministic solver
  const solverResult = solveToAAllocation({
    targetStages,
    candidateTeams,
    allowPartial,
    ownedResonatorIds: ownedResonatorIdsSet
  });

  // 6. Aggregate completeness metrics
  const targetStageCount = targetStages.length;
  const assignedStageCount = solverResult.assignments.filter((a) => a.isAssigned).length;
  const unassignedStageCount = targetStageCount - assignedStageCount;
  const stageCoverageRatio = targetStageCount > 0 ? assignedStageCount / targetStageCount : 0;

  let totalVigorRequired = 0;
  for (const st of targetStages) {
    totalVigorRequired += st.vigorCost;
  }

  let totalVigorConsumed = 0;
  for (const a of solverResult.assignments) {
    if (a.isAssigned) {
      totalVigorConsumed += a.vigorCost * 3; // 3 members each consume vigorCost
    }
  }

  let totalAvailableVigor = 0;
  for (const v of solverResult.vigorAccounting) {
    totalAvailableVigor += v.startingVigor;
  }

  const completeness: ToAAllocationCompletenessMetrics = Object.freeze({
    targetStageCount,
    assignedStageCount,
    unassignedStageCount,
    stageCoverageRatio,
    totalVigorRequired,
    totalVigorConsumed,
    totalAvailableVigor
  });

  // 7. Calculate distinct teams and Resonators used
  const distinctTeams = new Set<string>();
  const distinctResonators = new Set<string>();

  for (const a of solverResult.assignments) {
    if (a.team) {
      distinctTeams.add(a.team.id);
      for (const memberId of a.memberResonatorIds) {
        distinctResonators.add(memberId);
      }
    }
  }

  // 8. Derive deterministic identifier
  const allocationId = deriveToAAllocationId(
    solverResult.assignments,
    targetStageCount,
    seasonId,
    patchVersion,
    ruleVersion
  );

  // 9. Assemble explanation codes
  const explanationCodes: string[] = [
    TOA_ALLOCATION_EXPLANATION_CODES.ALL_RESONATOR_VIGOR_PRESERVED,
    TOA_ALLOCATION_EXPLANATION_CODES.CHARACTER_VIGOR_OVERDRAFT_PREVENTED,
    TOA_ALLOCATION_EXPLANATION_CODES.EQUIPMENT_CONTENTION_UNMODELED
  ];

  if (solverResult.status === 'OPTIMAL_ALLOCATION') {
    explanationCodes.unshift(TOA_ALLOCATION_EXPLANATION_CODES.ALLOCATION_OPTIMAL);
    explanationCodes.push(TOA_ALLOCATION_EXPLANATION_CODES.ALL_MANDATORY_STAGES_ASSIGNED);
  } else if (solverResult.status === 'FEASIBLE_ALLOCATION') {
    explanationCodes.unshift(TOA_ALLOCATION_EXPLANATION_CODES.ALLOCATION_FEASIBLE);
    explanationCodes.push(TOA_ALLOCATION_EXPLANATION_CODES.ALL_MANDATORY_STAGES_ASSIGNED);
  } else if (solverResult.status === 'PARTIAL_ALLOCATION') {
    explanationCodes.unshift(TOA_ALLOCATION_EXPLANATION_CODES.ALLOCATION_PARTIAL);
  } else {
    explanationCodes.unshift(TOA_ALLOCATION_EXPLANATION_CODES.ALLOCATION_INFEASIBLE);
  }

  if (solverResult.objectiveTuple.beneficialBuffMatches > 0) {
    explanationCodes.push(TOA_ALLOCATION_EXPLANATION_CODES.STAGE_BUFF_MATCHES_MAXIMIZED);
  }

  // 10. Assemble provenance
  const assignedStageIds = solverResult.assignments
    .filter((a) => a.isAssigned)
    .map((a) => a.stage.stageId);

  const provenance: ToAAllocationProvenance = Object.freeze({
    source: 'DERIVED_TOA_STAGE_ALLOCATION',
    patchVersion: CANONICAL_PATCH_VERSION,
    ruleVersion: TOA_ALLOCATION_RULE_VERSION,
    seasonId,
    targetStageCount,
    assignedStageCount,
    assignedStageIds: Object.freeze(assignedStageIds),
    upstreamPortfolioRuleVersion: '7.22.1',
    upstreamBuildEvaluationRuleVersion: '7.21.1',
    upstreamRosterRuleVersion: '7.12.1'
  });

  // 11. Assemble core ToAAllocation record
  const allocation: ToAAllocation = Object.freeze({
    id: allocationId,
    patchVersion: CANONICAL_PATCH_VERSION,
    ruleVersion: TOA_ALLOCATION_RULE_VERSION,
    seasonId,
    status: solverResult.status,
    assignments: solverResult.assignments,
    vigorAccounting: solverResult.vigorAccounting,
    completeness,
    distinctTeamsUsedCount: distinctTeams.size,
    distinctResonatorsUsedCount: distinctResonators.size,
    objectiveTuple: solverResult.objectiveTuple,
    explanationCodes: Object.freeze(explanationCodes),
    infeasibilityReasons: solverResult.infeasibilityReasons
      ? Object.freeze([...solverResult.infeasibilityReasons])
      : undefined,
    provenance
  });

  // 12. Assemble search metrics
  const metrics: ToAAllocationSearchMetrics = Object.freeze({
    patchVersion: CANONICAL_PATCH_VERSION,
    ruleVersion: TOA_ALLOCATION_RULE_VERSION,
    seasonId,
    targetStageCount,
    candidateTeamCount: candidateTeams.length,
    searchStatesExplored: solverResult.searchStatesExplored,
    prunedStatesCount: solverResult.prunedStatesCount,
    solverStatus: solverResult.status,
    verifiedAt: OFFLINE_DETERMINISTIC_AUDIT_STAMP
  });

  // 13. Assemble root result container
  const result: ToAAllocationResult = Object.freeze({
    patchId: CANONICAL_PATCH_VERSION,
    ruleVersion: TOA_ALLOCATION_RULE_VERSION,
    seasonId,
    allocation,
    metrics
  });

  // 14. Deep-freeze contract-owned structure without mutating caller-owned objects
  const deeplyFrozenResult = deepFreeze(deepClone(result));

  // 15. Verify zero prohibited keys
  assertNoProhibitedToAAllocationKeys(deeplyFrozenResult);

  return deeplyFrozenResult;
}
