/**
 * Wuthering Waves Deterministic Recommendation Application Service
 * Phase 7 Step 25: Application Service & Inventory Adapter
 *
 * Coordinates request validation, authenticated tenant-isolated inventory loading,
 * invocation of the frozen Step 24 recommendation engine, post-execution audit verification,
 * and projection into factual, client-safe ViewModels.
 *
 * Invariants:
 * 1. Rule Version: Strictly '7.25.1' for application service contract.
 * 2. Complete Audit Gate: Audit failure stops execution and fails closed.
 * 3. Pure Determinism: Zero LLMs, zero subjective scores, zero heuristic ranking.
 * 4. Engine Authority: Valid engine outcomes (including INSUFFICIENT_ROSTER, NO_FEASIBLE_ALLOCATION,
 *    NO_FEASIBLE_PORTFOLIO, PARTIAL_RECOMMENDATION) are returned as successful ViewModels,
 *    never conflated with application-level errors.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  RECOMMENDATION_SERVICE_RULE_VERSION,
  CANONICAL_TOWER_IDS,
  type RecommendationServiceRequest,
  type RecommendationServiceResponse,
  type RecommendationViewModel,
  type RecommendationStageViewModel,
  type RecommendationTowerGroupViewModel,
  type RecommendationTeamViewModel,
  type RecommendationVigorLedgerEntryViewModel,
  type StageScopeType,
} from './types.ts';
import { UserInventoryAdapter, type UserInventoryAdapterOptions } from './adapter.ts';
import {
  orchestrateRecommendations,
  auditRecommendationOrchestrationResult,
  formatRecommendationOrchestrationExplanation,
  type RecommendationOrchestrationInput,
  type RecommendationOrchestrationResult,
  type RecommendationOrchestrationAuditReport,
} from '../../engine/recommendation-orchestration/index.ts';
import { getCanonicalSeason40Stages } from '../../engine/toa-allocation/repository.ts';
import type { ToAStageDefinition } from '../../engine/toa-allocation/types.ts';
import {
  MIN_PORTFOLIO_TARGET_K,
  MAX_PORTFOLIO_TARGET_K,
  DEFAULT_PORTFOLIO_TARGET_K,
} from '../../engine/recommendation-orchestration/rules.ts';

export interface RecommendationApplicationServiceOptions {
  supabase: SupabaseClient;
  inventoryAdapter?: UserInventoryAdapter;
  auditGate?: (result: RecommendationOrchestrationResult) => RecommendationOrchestrationAuditReport;
}

export class RecommendationApplicationService {
  private supabase: SupabaseClient;
  private inventoryAdapter: UserInventoryAdapter;
  private auditGate: (result: RecommendationOrchestrationResult) => RecommendationOrchestrationAuditReport;

  constructor(options: RecommendationApplicationServiceOptions) {
    this.supabase = options.supabase;
    this.inventoryAdapter =
      options.inventoryAdapter ??
      new UserInventoryAdapter({
        supabase: options.supabase,
      });
    this.auditGate = options.auditGate ?? auditRecommendationOrchestrationResult;
  }

  /**
   * Resolves application request scope to an authoritative ordered list of Season 40 stage IDs.
   */
  private resolveTargetStageIds(
    request: RecommendationServiceRequest
  ): { stageIds: readonly string[]; error?: string } {
    const allS40Stages = getCanonicalSeason40Stages();
    const stageMap = new Map<string, ToAStageDefinition>();
    for (const s of allS40Stages) {
      stageMap.set(s.stageId, s);
    }

    if (request.scope === 'FULL_CYCLE') {
      return { stageIds: Object.freeze(allS40Stages.map((s) => s.stageId)) };
    }

    if (request.scope === 'TOWER') {
      if (!request.selectedTowerId || !CANONICAL_TOWER_IDS.includes(request.selectedTowerId as any)) {
        return {
          stageIds: [],
          error: `Scope 'TOWER' requires a valid selectedTowerId ('resonant-tower', 'hazard-tower', or 'echoing-tower'). Got: '${request.selectedTowerId}'.`,
        };
      }

      const towerStages = allS40Stages
        .filter((s) => s.towerId === request.selectedTowerId)
        .map((s) => s.stageId);
      return { stageIds: Object.freeze(towerStages) };
    }

    if (request.scope === 'CUSTOM') {
      if (!request.selectedStageIds || !Array.isArray(request.selectedStageIds) || request.selectedStageIds.length === 0) {
        return {
          stageIds: [],
          error: `Scope 'CUSTOM' requires a non-empty array of selectedStageIds.`,
        };
      }

      const seen = new Set<string>();
      const resolved: string[] = [];

      for (let i = 0; i < request.selectedStageIds.length; i++) {
        const id = request.selectedStageIds[i];
        if (typeof id !== 'string' || id.trim() === '') {
          return {
            stageIds: [],
            error: `Invalid stage ID at index ${i} in selectedStageIds.`,
          };
        }
        if (!stageMap.has(id)) {
          return {
            stageIds: [],
            error: `Stage ID '${id}' is not a canonical Season 40 Tower of Adversity stage.`,
          };
        }
        if (seen.has(id)) {
          return {
            stageIds: [],
            error: `Duplicate stage ID '${id}' in selectedStageIds.`,
          };
        }
        seen.add(id);
        resolved.push(id);
      }

      return { stageIds: Object.freeze(resolved) };
    }

    return {
      stageIds: [],
      error: `Unrecognized scope '${(request as any).scope}'. Supported scopes: 'FULL_CYCLE', 'TOWER', 'CUSTOM'.`,
    };
  }

  /**
   * Maps the authoritative Step 24 engine result into the factual Step 25 ViewModel.
   */
  private mapResultToViewModel(
    engineResult: RecommendationOrchestrationResult,
    scope: StageScopeType,
    executionDurationMs: number,
    diagnostics?: readonly any[]
  ): RecommendationViewModel {
    const rec = engineResult.recommendation;
    const allS40Stages = getCanonicalSeason40Stages();
    const stageDefMap = new Map<string, ToAStageDefinition>();
    for (const s of allS40Stages) {
      stageDefMap.set(s.stageId, s);
    }

    // Map stages
    const stages: RecommendationStageViewModel[] = [];
    const assignmentMap = new Map<string, any>();
    if (rec.toaAllocation?.assignments) {
      for (const a of rec.toaAllocation.assignments) {
        assignmentMap.set(a.stage.stageId, a);
      }
    }

    for (const targetId of rec.inputSnapshot.targetStageIds) {
      const stageDef = stageDefMap.get(targetId);
      const assignment = assignmentMap.get(targetId);

      const isAssigned = assignment ? assignment.isAssigned : false;
      const unassignedReason = assignment?.unassignedReason;
      const vigorCost = stageDef?.vigorCost ?? 0;
      const floor = stageDef?.stageIndex ?? 1;
      const towerId = stageDef?.towerId ?? 'unknown-tower';
      const towerName = stageDef?.towerName ?? 'Tower';
      const stageIndex = stageDef?.stageIndex ?? 1;

      let teamVm: RecommendationTeamViewModel | null = null;
      if (assignment?.team && isAssigned) {
        const team = assignment.team;
        teamVm = {
          memberResonatorIds: team.memberResonatorIds,
          status: team.status,
          completenessRatio: team.completeness.teamCompletenessRatio,
          members: team.memberBuildEvaluations.map((ev: any, idx: number) => {
            const memberSnapshot = rec.inputSnapshot.investmentSnapshots.find(
              (s) => s.resonatorId === ev.resonatorId
            );
            return {
              resonatorId: ev.resonatorId,
              buildStatus: ev.status,
              characterLevel: memberSnapshot?.characterLevel?.status === 'KNOWN' ? memberSnapshot.characterLevel.value : null,
              sequenceLevel: memberSnapshot?.sequenceLevel?.status === 'KNOWN' ? memberSnapshot.sequenceLevel.value : null,
              equippedWeaponId: ev.weaponEvaluation?.weaponId ?? null,
              weaponCompatibility: ev.weaponEvaluation?.compatibility ?? 'NOT_EQUIPPED',
              weaponLevel: memberSnapshot?.weapon?.weaponLevel?.status === 'KNOWN' ? memberSnapshot.weapon.weaponLevel.value : null,
              weaponRefinement: memberSnapshot?.weapon?.refinementRank?.status === 'KNOWN' ? memberSnapshot.weapon.refinementRank.value : null,
              activeSonataCode: ev.echoEvaluation?.activeSonataSetName ?? ev.echoEvaluation?.activeSonataSetCode ?? null,
            };
          }),
        };
      }

      stages.push({
        stageId: targetId,
        stageIndex,
        towerId,
        towerName,
        floor,
        vigorCost,
        isAssigned,
        unassignedReason,
        buffMatchedMemberCount: assignment?.buffMatchedMemberCount ?? 0,
        matchedBeneficialElements: assignment?.matchedBeneficialElements ?? [],
        team: teamVm,
      });
    }

    // Group into towers
    const towerGroupsMap = new Map<string, { towerId: string; towerName: string; towerOrder: number; stages: RecommendationStageViewModel[] }>();
    for (const stageVm of stages) {
      const stageDef = stageDefMap.get(stageVm.stageId);
      const tid = stageVm.towerId;
      if (!towerGroupsMap.has(tid)) {
        towerGroupsMap.set(tid, {
          towerId: tid,
          towerName: stageVm.towerName,
          towerOrder: stageDef?.towerOrder ?? 1,
          stages: [],
        });
      }
      towerGroupsMap.get(tid)!.stages.push(stageVm);
    }
    const towers: RecommendationTowerGroupViewModel[] = Array.from(towerGroupsMap.values())
      .sort((a, b) => a.towerOrder - b.towerOrder)
      .map((g) => ({
        towerId: g.towerId,
        towerName: g.towerName,
        towerOrder: g.towerOrder,
        stages: Object.freeze(g.stages),
      }));

    // Vigor ledger
    const vigorLedger: RecommendationVigorLedgerEntryViewModel[] = [];
    if (rec.toaAllocation?.vigorAccounting) {
      for (const v of rec.toaAllocation.vigorAccounting) {
        vigorLedger.push({
          resonatorId: v.resonatorId,
          startingVigor: v.startingVigor,
          vigorConsumed: v.vigorConsumed,
          vigorRemaining: v.vigorRemaining,
          assignedStageCount: v.assignedStageCount,
          assignedStageIds: v.assignedStageIds,
        });
      }
    }

    // Unallocated stages
    const unallocatedStageIds = stages.filter((s) => !s.isAssigned).map((s) => s.stageId);

    return {
      serviceRuleVersion: RECOMMENDATION_SERVICE_RULE_VERSION,
      engineRuleVersion: engineResult.ruleVersion,
      patchId: engineResult.patchId,
      seasonId: engineResult.seasonId,
      scope,
      recommendationStatus: rec.status,
      allocationStatus: rec.toaAllocation ? rec.toaAllocation.status : null,
      portfolioStatus: rec.portfolio ? rec.portfolio.status : null,
      metrics: {
        targetStageCount: engineResult.metrics.targetStageCount,
        assignedStageCount: engineResult.metrics.assignedStageCount,
        stageCoverageRatio: engineResult.metrics.stageCoverageRatio,
        selectedTeamCount: engineResult.metrics.selectedTeamCount,
        totalVigorConsumed: engineResult.metrics.totalVigorConsumed,
        distinctResonatorsUsedCount: engineResult.metrics.distinctResonatorsUsedCount,
        executionDurationMs: Math.round(executionDurationMs * 100) / 100,
      },
      provenance: {
        id: rec.id,
        fingerprint: rec.inputSnapshot.snapshotFingerprint,
        verifiedAt: engineResult.metrics.verifiedAt,
      },
      formattedExplanation: formatRecommendationOrchestrationExplanation(rec),
      explanationCodes: rec.explanationCodes,
      infeasibilityReasons: rec.infeasibilityReasons ?? [],
      unallocatedStageIds: Object.freeze(unallocatedStageIds),
      stages: Object.freeze(stages),
      towers: Object.freeze(towers),
      vigorLedger: Object.freeze(vigorLedger),
      diagnostics: diagnostics ? Object.freeze(diagnostics) : undefined,
    };
  }

  /**
   * Executes deterministic personal recommendation for an authenticated user.
   */
  async executeRecommendation(
    request: RecommendationServiceRequest
  ): Promise<RecommendationServiceResponse> {
    const startTime = performance.now();

    // 1. Authenticate user identity strictly via server-side session
    const { data: authData, error: authError } = await this.supabase.auth.getUser();
    const userId = authData?.user?.id;
    if (authError || !userId || typeof userId !== 'string' || userId.trim() === '') {
      return {
        success: false,
        code: 'UNAUTHENTICATED',
        error: 'Authentication required. Please sign in to run personal recommendations.',
      };
    }

    // 2. Validate request parameters
    const targetK = request.targetK ?? DEFAULT_PORTFOLIO_TARGET_K;
    if (
      typeof targetK !== 'number' ||
      !Number.isInteger(targetK) ||
      targetK < MIN_PORTFOLIO_TARGET_K ||
      targetK > MAX_PORTFOLIO_TARGET_K
    ) {
      return {
        success: false,
        code: 'INVALID_REQUEST_PARAMETERS',
        error: `Invalid targetK '${request.targetK}'. Must be an integer between ${MIN_PORTFOLIO_TARGET_K} and ${MAX_PORTFOLIO_TARGET_K}.`,
      };
    }

    const allowPartial = request.allowPartial ?? false;
    if (typeof allowPartial !== 'boolean') {
      return {
        success: false,
        code: 'INVALID_REQUEST_PARAMETERS',
        error: `Invalid allowPartial '${request.allowPartial}'. Must be a boolean value.`,
      };
    }

    const stageResolution = this.resolveTargetStageIds(request);
    if (stageResolution.error) {
      return {
        success: false,
        code: 'INVALID_REQUEST_PARAMETERS',
        error: stageResolution.error,
      };
    }

    // 3. Load and normalize user inventory
    let adaptedInventory;
    try {
      adaptedInventory = await this.inventoryAdapter.adaptUserInventory(userId);
    } catch (err: any) {
      return {
        success: false,
        code: 'INTERNAL_ERROR',
        error: `Failed to load user inventory: ${err?.message ?? 'Unknown database error'}`,
      };
    }

    // 4. Build Step 24 engine input
    const engineInput: RecommendationOrchestrationInput = {
      patchId: '3.7',
      seasonId: 'season:40',
      ownedRoster: adaptedInventory.ownedResonatorIds,
      investmentSnapshots: adaptedInventory.investmentSnapshots,
      targetK,
      targetStageIds: stageResolution.stageIds,
      allowPartial,
    };

    // 5. Invoke deterministic Step 24 engine
    let engineResult: RecommendationOrchestrationResult;
    try {
      engineResult = orchestrateRecommendations(engineInput);
    } catch (err: any) {
      return {
        success: false,
        code: 'INTERNAL_ERROR',
        error: `Recommendation engine error: ${err?.message ?? 'Unknown error'}`,
      };
    }

    // 6. Mandatory independent audit verification gate
    const auditReport = this.auditGate(engineResult);
    if (!auditReport.isValid) {
      return {
        success: false,
        code: 'AUDIT_VERIFICATION_FAILED',
        error: 'Recommendation result failed post-execution independent audit verification.',
        errors: auditReport.violations.map((v: { code: string; message: string }) => `${v.code}: ${v.message}`),
      };
    }

    // 7. Project to client-safe ViewModel
    const executionDurationMs = performance.now() - startTime;
    const viewModel = this.mapResultToViewModel(
      engineResult,
      request.scope,
      executionDurationMs,
      adaptedInventory.diagnostics
    );

    return {
      success: true,
      data: viewModel,
    };
  }
}
