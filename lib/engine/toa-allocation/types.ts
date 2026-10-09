/**
 * Wuthering Waves Deterministic Tower of Adversity Vigor Allocation & Stage Scheduling Types
 * Phase 7 Step 23: Deterministic Tower of Adversity Vigor Allocation & Stage Scheduling Contract
 *
 * Defines contracts representing the deterministic allocation of eligible teams
 * to Tower of Adversity stages respecting Vigor budgets, verified stage buffs,
 * ownership constraints, and strict lexicographic optimization.
 *
 * CRITICAL ARCHITECTURAL BOUNDARIES:
 * 1. PURE ENGINE SCHEDULING, ZERO COMBAT POWER / ZERO DAMAGE:
 *    Allocates teams to stages based on verified floor requirements, Vigor budgets,
 *    and factual element/build compatibility.
 *    ZERO damage calculations, ZERO clear-time estimates, ZERO combat power, ZERO tier ratings.
 * 2. EXACT VIGOR STAMINA CONSERVATION:
 *    Each Resonator has exactly 10 Vigor per season. Every assigned stage consumes
 *    its verified vigor cost for all 3 team members. Overdraft is strictly prohibited.
 * 3. STRICT PATCH & SEASON ISOLATION:
 *    Bound strictly to Patch 3.7 Season 40. Cross-patch or cross-season mixing is rejected.
 * 4. PURE DETERMINISM:
 *    Offline, zero network, zero LLMs, zero random seeds, zero timestamps.
 * 5. UNMODELED MECHANICS REMAIN UNMODELED:
 *    Multi-stage equipment swapping and non-elemental buff interactions are strictly 'UNMODELED'.
 */

import type { SourceReference } from '../capabilities/types.ts';
import type { OwnedRosterSnapshot } from '../roster/types.ts';
import type { TeamBuildEvaluation } from '../team-build-evaluation/types.ts';
import type { TeamPortfolio, TeamPortfolioResult } from '../team-portfolio/types.ts';

export type {
  SourceReference,
  OwnedRosterSnapshot,
  TeamBuildEvaluation,
  TeamPortfolio,
  TeamPortfolioResult
};

/**
 * Closed status taxonomy for overall Tower of Adversity stage allocation outcome.
 */
export type ToAAllocationStatus =
  | 'OPTIMAL_ALLOCATION'    // All requested target stages assigned with proven global lexicographic optimality and all participating teams FULLY_EQUIPPED
  | 'FEASIBLE_ALLOCATION'   // All requested target stages assigned under fallback/uninvested qualification
  | 'PARTIAL_ALLOCATION'    // Subset of target stages assigned when allowPartial: true
  | 'INFEASIBLE_ALLOCATION' // Impossible to assign all target stages under hard constraints (when allowPartial: false)
  | 'INVALID_INPUT'         // Malformed input, invalid IDs, duplicate stages, or contradictory constraints
  | 'PATCH_MISMATCH'        // Input patch version rejected
  | 'SEASON_MISMATCH';      // Input season identifier rejected

/**
 * Factual representation of an active Tower of Adversity Area Effect / Stage Buff.
 */
export interface ToAAreaEffect {
  readonly id: string;
  readonly sourceId: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly target: string;
  readonly beneficialElements: readonly string[];
}

/**
 * Factual representation of a Tower of Adversity Stage.
 */
export interface ToAStageDefinition {
  /** Stable stage identifier, e.g. 'toa-resonant-floor-1' or 'toa-stage:3.7:season:40:tower:1:stage:1' */
  readonly stageId: string;
  /** Canonical patch version: strictly '3.7' */
  readonly patchVersion: '3.7';
  /** Season identifier, e.g. 'season:40' */
  readonly seasonId: string;
  /** Tower identifier, e.g. 'tower:1' or 'resonant-tower' */
  readonly towerId: string;
  /** Tower display name, e.g. 'Resonant Tower', 'Hazard Tower', 'Echoing Tower' */
  readonly towerName: string;
  /** Tower order (1: Resonant, 2: Hazard, 3: Echoing) */
  readonly towerOrder: number;
  /** Stage order within tower (1..4) */
  readonly stageIndex: number;
  /** Global canonical order across season (1..12) */
  readonly globalStageOrder: number;
  /** Verified Vigor cost for this stage (1..5) */
  readonly vigorCost: number;
  /** Difficulty rating */
  readonly difficulty: number;
  /** Area effects / buffs active on this stage */
  readonly areaEffects: readonly ToAAreaEffect[];
  /** Beneficial elements identified from verified area effects */
  readonly beneficialElements: readonly string[];
  /** Enemy codes present in stage waves (factual metadata) */
  readonly enemyCodes: readonly string[];
}

/**
 * Single assignment of an eligible team to a Tower of Adversity stage.
 */
export interface ToAStageAssignment {
  /** Target stage definition */
  readonly stage: ToAStageDefinition;
  /** Assigned team evaluation from Step 22 portfolio (or null if unassigned) */
  readonly team: TeamBuildEvaluation | null;
  /** Whether stage was successfully assigned */
  readonly isAssigned: boolean;
  /** Stage Vigor cost consumed by each member of this team */
  readonly vigorCost: number;
  /** Resonators participating in this stage assignment */
  readonly memberResonatorIds: readonly string[];
  /** Factual count of team members matching stage beneficial elements */
  readonly buffMatchedMemberCount: number;
  /** Beneficial elements matched */
  readonly matchedBeneficialElements: readonly string[];
  /** Factual reason if stage was left unassigned */
  readonly unassignedReason?: string;
}

/**
 * Per-character Vigor accounting record.
 */
export interface ResonatorVigorAccountingRecord {
  readonly resonatorId: string;
  readonly startingVigor: number; // 10
  readonly vigorConsumed: number;
  readonly vigorRemaining: number;
  readonly assignedStageIds: readonly string[];
  readonly assignedStageCount: number;
}

/**
 * Aggregated completeness metrics for the stage allocation.
 */
export interface ToAAllocationCompletenessMetrics {
  /** Total target stages requested */
  readonly targetStageCount: number;
  /** Successfully assigned stages */
  readonly assignedStageCount: number;
  /** Unassigned stages */
  readonly unassignedStageCount: number;
  /** Stage coverage ratio in [0.0000, 1.0000] */
  readonly stageCoverageRatio: number;
  /** Sum of Vigor costs of all requested target stages */
  readonly totalVigorRequired: number;
  /** Sum of Vigor consumed across all assigned stages (stageCost * 3) */
  readonly totalVigorConsumed: number;
  /** Total available Vigor budget across owned participating Resonators */
  readonly totalAvailableVigor: number;
}

/**
 * Evaluated multi-dimensional objective tuple for lexicographic comparison.
 */
export interface ToAAllocationObjectiveTuple {
  /** 1. Total stages assigned / completed */
  readonly stagesCompleted: number;
  /** 2. Total team members matching stage beneficial elements */
  readonly beneficialBuffMatches: number;
  /** 3. Incompatible weapon assignments (lower is better) */
  readonly incompatibleWeaponAssignments: number;
  /** 4. Fully equipped team assignments */
  readonly fullyEquippedAssignments: number;
  /** 5. Sum of known build aspects across assigned teams */
  readonly totalKnownAspects: number;
  /** 6. Sum of upstream matched synergy pairs (reserved contract dimension: evaluates to 0 under Step 21 TeamBuildEvaluation inputs) */
  readonly totalSynergyPairs: number;
  /** 7. Sum of upstream directional synergy edges (reserved contract dimension: evaluates to 0 under Step 21 TeamBuildEvaluation inputs) */
  readonly totalDirectionalEdges: number;
  /** 8. Canonical assignment key for deterministic tie-breaking */
  readonly canonicalAssignmentKey: string;
}

/**
 * Lineage provenance for a derived ToAAllocation record.
 */
export interface ToAAllocationProvenance {
  readonly source: 'DERIVED_TOA_STAGE_ALLOCATION';
  readonly patchVersion: '3.7';
  readonly ruleVersion: '7.23.1';
  readonly seasonId: string;
  readonly targetStageCount: number;
  readonly assignedStageCount: number;
  readonly assignedStageIds: readonly string[];
  readonly upstreamPortfolioRuleVersion: '7.22.1';
  readonly upstreamBuildEvaluationRuleVersion: '7.21.1';
  readonly upstreamRosterRuleVersion: '7.12.1';
}

/**
 * Core domain record representing a complete Tower of Adversity Stage Allocation.
 */
export interface ToAAllocation {
  /** Deterministic identifier: toa-alloc:3.7:<seasonId>:<K>:<hash>:7.23.1 */
  readonly id: string;
  /** Strictly Patch 3.7 */
  readonly patchVersion: '3.7';
  /** Rule version: strictly '7.23.1' */
  readonly ruleVersion: '7.23.1';
  /** Season identifier, e.g. 'season:40' */
  readonly seasonId: string;
  /** Overall allocation feasibility / optimality status */
  readonly status: ToAAllocationStatus;
  /** Canonical ordered list of stage assignments */
  readonly assignments: readonly ToAStageAssignment[];
  /** Canonical per-character Vigor accounting */
  readonly vigorAccounting: readonly ResonatorVigorAccountingRecord[];
  /** Aggregated completeness metrics */
  readonly completeness: ToAAllocationCompletenessMetrics;
  /** Count of distinct teams utilized across all assignments */
  readonly distinctTeamsUsedCount: number;
  /** Count of distinct Resonators utilized across all assignments */
  readonly distinctResonatorsUsedCount: number;
  /** Multi-dimensional objective breakdown */
  readonly objectiveTuple: ToAAllocationObjectiveTuple;
  /** Machine-readable explanation codes */
  readonly explanationCodes: readonly string[];
  /** Factual reasons if allocation is infeasible or partial */
  readonly infeasibilityReasons?: readonly string[];
  /** Provenance lineage */
  readonly provenance: ToAAllocationProvenance;
}

/**
 * Diagnostic search metrics from the deterministic solver.
 */
export interface ToAAllocationSearchMetrics {
  readonly patchVersion: '3.7';
  readonly ruleVersion: '7.23.1';
  readonly seasonId: string;
  readonly targetStageCount: number;
  readonly candidateTeamCount: number;
  readonly searchStatesExplored: number;
  readonly prunedStatesCount: number;
  readonly solverStatus: ToAAllocationStatus;
  readonly verifiedAt: string;
}

/**
 * Input configuration for allocating teams to Tower of Adversity stages.
 */
export interface ToAAllocationInput {
  /** Target patch version: strictly '3.7' */
  readonly patchId?: string;
  /** Rule version override (for testing validation): strictly '7.23.1' */
  readonly ruleVersion?: string;
  /** Target season ID: strictly 'season:40' for Patch 3.7 */
  readonly seasonId?: string;
  /** Target stage catalog (defaults to canonical Season 40 stages) */
  readonly stageCatalog?: readonly ToAStageDefinition[];
  /** Explicit subset of stage IDs to allocate (defaults to all stages in catalog) */
  readonly targetStageIds?: readonly string[];
  /** Whether partial stage coverage is permitted (default: false) */
  readonly allowPartial?: boolean;
  /** Owned player roster snapshot or string array of owned Resonator IDs */
  readonly ownedRoster?: OwnedRosterSnapshot | readonly string[];
  /** Step 22 portfolio or portfolio result */
  readonly portfolio?: TeamPortfolio | TeamPortfolioResult;
  /** Candidate pool of TeamBuildEvaluations (defaults to portfolio.teams) */
  readonly candidateTeams?: readonly TeamBuildEvaluation[];
}

/**
 * Root result container for a ToAAllocation operation.
 */
export interface ToAAllocationResult {
  readonly patchId: '3.7';
  readonly ruleVersion: '7.23.1';
  readonly seasonId: string;
  readonly allocation: ToAAllocation;
  readonly metrics: ToAAllocationSearchMetrics;
}
