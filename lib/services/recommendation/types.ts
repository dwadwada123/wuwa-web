/**
 * Wuthering Waves Deterministic Recommendation Application Service Types
 * Phase 7 Step 25: Application Service & Inventory Adapter
 *
 * Defines request contracts, error taxonomy, diagnostic logging, and client-safe
 * factual ViewModels for exposing Step 24 deterministic recommendations to the app.
 *
 * Rules:
 * 1. Application Contract Version: Strictly '7.25.1'.
 * 2. Pure factual ViewModel: zero combat power, zero DPS, zero subjective scores, zero tier ratings.
 * 3. Exact alignment with frozen engine contracts (Steps 13, 20, 21, 22, 23, 24).
 */

import type {
  RecommendationOrchestrationStatus,
  RecommendationOrchestrationResult,
  EndToEndRecommendation,
} from '../../engine/recommendation-orchestration/types.ts';
import type {
  ToAAllocationStatus,
  ToAStageDefinition,
} from '../../engine/toa-allocation/types.ts';
import type { TeamPortfolioStatus } from '../../engine/team-portfolio/types.ts';
import type { TeamBuildEvaluationStatus } from '../../engine/team-build-evaluation/types.ts';
import type {
  CharacterBuildEvaluationStatus,
  BuildWeaponCompatibilityStatus,
} from '../../engine/character-build-evaluation/types.ts';
import type { ResonatorInvestmentSnapshot } from '../../engine/investment/types.ts';

export type {
  RecommendationOrchestrationStatus,
  RecommendationOrchestrationStatus as RecommendationStatus,
  ToAAllocationStatus,
  TeamPortfolioStatus,
  TeamBuildEvaluationStatus,
  CharacterBuildEvaluationStatus,
  BuildWeaponCompatibilityStatus,
};

/**
 * Step 25 Application Service Rule Version.
 */
export const RECOMMENDATION_SERVICE_RULE_VERSION = '7.25.1' as const;

/**
 * Application-level target scope for recommendation execution.
 */
export type StageScopeType = 'FULL_CYCLE' | 'TOWER' | 'CUSTOM';

/**
 * Valid canonical tower identifiers in Season 40.
 */
export const CANONICAL_TOWER_IDS = Object.freeze([
  'resonant-tower',
  'hazard-tower',
  'echoing-tower',
] as const);

export type CanonicalTowerId = (typeof CANONICAL_TOWER_IDS)[number];

/**
 * Client request input for executing recommendation.
 * Client NEVER provides trusted userId. Identity is derived strictly server-side.
 */
export interface RecommendationServiceRequest {
  readonly scope: StageScopeType;
  readonly selectedTowerId?: string;
  readonly selectedStageIds?: readonly string[];
  readonly targetK?: number;
  readonly allowPartial?: boolean;
}

/**
 * Application error codes distinct from engine statuses.
 */
export type RecommendationErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_REQUEST_PARAMETERS'
  | 'AUDIT_VERIFICATION_FAILED'
  | 'INTERNAL_ERROR';

/**
 * Diagnostic record emitted during inventory adaptation and validation.
 */
export interface AdapterDiagnostic {
  readonly resonatorId?: string;
  readonly level: 'INFO' | 'WARN' | 'ERROR';
  readonly message: string;
}

/**
 * Adapted inventory container ready for engine consumption.
 */
export interface AdaptedInventoryResult {
  readonly ownedResonatorIds: readonly string[];
  readonly investmentSnapshots: readonly ResonatorInvestmentSnapshot[];
  readonly diagnostics: readonly AdapterDiagnostic[];
}

/**
 * Factual member view model within an assigned team.
 */
export interface RecommendationTeamMemberViewModel {
  readonly resonatorId: string;
  readonly buildStatus: CharacterBuildEvaluationStatus;
  readonly characterLevel: number | null;
  readonly sequenceLevel: number | null;
  readonly equippedWeaponId: string | null;
  readonly weaponCompatibility: BuildWeaponCompatibilityStatus;
  readonly weaponLevel: number | null;
  readonly weaponRefinement: number | null;
  readonly activeSonataCode: string | null;
}

/**
 * Factual team view model assigned to a stage.
 */
export interface RecommendationTeamViewModel {
  readonly memberResonatorIds: readonly [string, string, string];
  readonly status: TeamBuildEvaluationStatus;
  readonly completenessRatio: number | null;
  readonly members: readonly RecommendationTeamMemberViewModel[];
}

/**
 * Factual stage card view model.
 */
export interface RecommendationStageViewModel {
  readonly stageId: string;
  readonly stageIndex: number;
  readonly towerId: string;
  readonly towerName: string;
  readonly floor: number;
  readonly vigorCost: number;
  readonly isAssigned: boolean;
  readonly unassignedReason?: string;
  readonly buffMatchedMemberCount: number;
  readonly matchedBeneficialElements: readonly string[];
  readonly team: RecommendationTeamViewModel | null;
}

/**
 * Grouped tower view model for UI presentation.
 */
export interface RecommendationTowerGroupViewModel {
  readonly towerId: string;
  readonly towerName: string;
  readonly towerOrder: number;
  readonly stages: readonly RecommendationStageViewModel[];
}

/**
 * Per-character Vigor accounting ledger entry.
 */
export interface RecommendationVigorLedgerEntryViewModel {
  readonly resonatorId: string;
  readonly startingVigor: number;
  readonly vigorConsumed: number;
  readonly vigorRemaining: number;
  readonly assignedStageCount: number;
  readonly assignedStageIds: readonly string[];
}

/**
 * Quantitative metrics summarizing the recommendation execution.
 */
export interface RecommendationViewModelMetrics {
  readonly targetStageCount: number;
  readonly assignedStageCount: number;
  readonly stageCoverageRatio: number;
  readonly selectedTeamCount: number;
  readonly totalVigorConsumed: number;
  readonly distinctResonatorsUsedCount: number;
  readonly executionDurationMs: number;
}

/**
 * Authoritative provenance metadata.
 */
export interface RecommendationViewModelProvenance {
  readonly id: string;
  readonly fingerprint: string;
  readonly verifiedAt: string;
}

/**
 * Client-safe, factual, deterministic recommendation view model.
 */
export interface RecommendationViewModel {
  readonly serviceRuleVersion: typeof RECOMMENDATION_SERVICE_RULE_VERSION;
  readonly engineRuleVersion: '7.24.1';
  readonly patchId: '3.7';
  readonly seasonId: 'season:40';
  readonly scope: StageScopeType;
  readonly recommendationStatus: RecommendationOrchestrationStatus;
  readonly allocationStatus: ToAAllocationStatus | null;
  readonly portfolioStatus: TeamPortfolioStatus | null;
  readonly metrics: RecommendationViewModelMetrics;
  readonly provenance: RecommendationViewModelProvenance;
  readonly formattedExplanation: string;
  readonly explanationCodes: readonly string[];
  readonly infeasibilityReasons: readonly string[];
  readonly unallocatedStageIds: readonly string[];
  readonly stages: readonly RecommendationStageViewModel[];
  readonly towers: readonly RecommendationTowerGroupViewModel[];
  readonly vigorLedger: readonly RecommendationVigorLedgerEntryViewModel[];
  readonly diagnostics?: readonly AdapterDiagnostic[];
}

/**
 * Standard discriminated union response from the application service.
 */
export type RecommendationServiceResponse =
  | {
      readonly success: true;
      readonly data: RecommendationViewModel;
    }
  | {
      readonly success: false;
      readonly code: RecommendationErrorCode;
      readonly error: string;
      readonly errors?: readonly string[];
    };
