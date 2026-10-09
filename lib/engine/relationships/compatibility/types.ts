/**
 * Wuthering Waves Deterministic Compatibility Candidate & Qualification Types
 * Phase 7 Step 5: Deterministic Compatibility Candidate Contract & Evidence Qualification
 *
 * Defines deterministic contracts for identifying compatibility candidates between
 * capabilities and entities for future evaluation by deterministic scoring and team layers.
 *
 * CENTRAL INVARIANTS:
 * 1. CANDIDATE ≠ SYNERGY.
 *    A candidate means "eligible for future evaluation because deterministic structured dimensions matched".
 *    It does NOT mean "these capabilities synergize", "this pair is good", or "has positive synergy".
 * 2. ZERO SCORING, ZERO WEIGHTS, ZERO TIERS, ZERO PRIORITIES, ZERO TEAM GENERATION.
 * 3. Pure, deterministic, offline domain representation with strict patch isolation ('3.7').
 * 4. Full traceability back to exact source capabilities, Step 3 relationships, and Step 4 interaction evidence.
 * 5. Applicability evaluation strictly delegates to Phase 7 Step 2 capability resolution.
 * 6. Explicitly distinguishes DIRECTED vs SYMMETRIC directionality.
 * 7. UNMODELED mechanics preserve null numeric values (never fabricated, never 0).
 * 8. UNKNOWN mechanics fail closed.
 */

import type {
  GameplayCapability,
  GameplayActionType,
  CapabilityRequiredContext,
  CapabilityContextRequirementDimension,
  SemanticParameter,
  SemanticTarget,
  SemanticUnit,
  SourceReference,
  Element,
  RuntimeEvaluationContext
} from '../../capabilities/types.ts';
import type {
  CapabilityResolutionStatus,
  CapabilityResolutionReason,
  CapabilityResolution
} from '../../capabilities/resolution/types.ts';
import type {
  GameplayRelationship,
  GameplayRelationshipType,
  GameplayRelationshipCategory,
  GameplayRelationshipTarget
} from '../types.ts';
import type {
  InteractionEvidence,
  InteractionEvidenceType,
  InteractionEvidenceCategory,
  InteractionEvidenceStatus
} from '../composition/types.ts';

export type {
  GameplayCapability,
  GameplayActionType,
  CapabilityRequiredContext,
  CapabilityContextRequirementDimension,
  SemanticParameter,
  SemanticTarget,
  SemanticUnit,
  SourceReference,
  Element,
  RuntimeEvaluationContext,
  CapabilityResolutionStatus,
  CapabilityResolutionReason,
  CapabilityResolution,
  GameplayRelationship,
  GameplayRelationshipType,
  GameplayRelationshipCategory,
  GameplayRelationshipTarget,
  InteractionEvidence,
  InteractionEvidenceType,
  InteractionEvidenceCategory,
  InteractionEvidenceStatus
};

/**
 * Closed, deterministic taxonomy for candidate qualification.
 * Strictly describes mechanical candidate eligibility; NO score, rank, tier, or quality values.
 */
export type CandidateQualificationType =
  | 'EXPLICIT_TARGET_LINK'
  | 'ACTION_COMPATIBILITY_CANDIDATE'
  | 'ELEMENT_COMPATIBILITY_CANDIDATE'
  | 'TRANSITION_COMPATIBILITY_CANDIDATE'
  | 'TARGET_SCOPE_COMPATIBILITY_CANDIDATE'
  | 'RESOURCE_COMPATIBILITY_CANDIDATE'
  | 'DEFENSIVE_COMPATIBILITY_CANDIDATE'
  | 'OFFENSIVE_COMPATIBILITY_CANDIDATE'
  | 'MECHANICAL_COMPATIBILITY_CANDIDATE';

/**
 * Qualification nature: whether candidate is based on explicit target linkage
 * or dimensional candidate matching.
 */
export type CandidateQualificationNature = 'EXPLICIT' | 'DIMENSIONAL';

/**
 * Directionality: explicit directional qualification vs symmetric matching.
 */
export type CandidateDirectionality = 'DIRECTED' | 'SYMMETRIC';

/**
 * Status reflecting whether candidate is structurally vs contextually eligible.
 * Never collapses MISSING_CONTEXT into NOT_APPLICABLE.
 */
export type CompatibilityCandidateStatus =
  | 'STRUCTURALLY_ELIGIBLE'
  | 'CONTEXTUALLY_ELIGIBLE'
  | 'MISSING_CONTEXT'
  | 'CONTEXT_MISMATCH'
  | 'UNMODELED'
  | 'UNKNOWN'
  | 'NOT_APPLICABLE';

/**
 * Closed dimension kind for matched dimensions.
 */
export type CandidateMatchedDimensionKind =
  | 'ACTION'
  | 'ELEMENT'
  | 'TRANSITION'
  | 'TRIGGER'
  | 'TARGET_SCOPE'
  | 'RESOURCE'
  | 'DEFENSIVE'
  | 'OFFENSIVE'
  | 'MECHANICAL'
  | 'EXPLICIT_TARGET';

/**
 * Deterministic dimension matched between source and target.
 */
export interface CandidateMatchedDimension {
  readonly kind: CandidateMatchedDimensionKind;
  readonly value: string;
}

/**
 * Immutable CompatibilityCandidate domain model.
 * Represents an auditable qualification that two capabilities/entities share deterministic
 * structured dimensions making them eligible for future evaluation.
 */
export interface CompatibilityCandidate {
  /** Deterministic canonical identifier: cmp:3.7:<src>:<tgt>:<type>:<dims>:<evi> */
  readonly id: string;

  /** Strictly Patch 3.7 */
  readonly patchVersion: '3.7';

  /** Source capability providing or originating the qualifying mechanic */
  readonly sourceCapabilityId: string;
  readonly sourceEntityId: string;
  readonly sourceCode: string;

  /** Target capability receiving, performing, or matching the qualifying mechanic */
  readonly targetCapabilityId: string;
  readonly targetEntityId: string;
  readonly targetCode: string;

  /** Closed qualification taxonomy */
  readonly qualificationType: CandidateQualificationType;

  /** Nature: EXPLICIT vs DIMENSIONAL */
  readonly qualificationNature: CandidateQualificationNature;

  /** Directionality: DIRECTED vs SYMMETRIC */
  readonly directionality: CandidateDirectionality;

  /** Canonical IDs of all Step 4 InteractionEvidence records proving this qualification */
  readonly evidenceIds: readonly string[];

  /** Canonical IDs of all Step 3 GameplayRelationships supporting this qualification */
  readonly relationshipIds: readonly string[];

  /** Matched mechanical dimensions */
  readonly matchedDimensions: readonly CandidateMatchedDimension[];

  /** Reference to originating source capability */
  readonly sourceCapability: GameplayCapability;

  /** Reference to matching target capability */
  readonly targetCapability: GameplayCapability;

  /** Candidate eligibility status */
  readonly status: CompatibilityCandidateStatus;

  /**
   * Exact numeric magnitude if known from source capability;
   * strictly null otherwise (never 0, never fabricated).
   */
  readonly effectValue: number | null;

  /** Unit of measurement if numeric */
  readonly unit: SemanticUnit | null;

  /** Required runtime context preserved from source */
  readonly requiredContext?: CapabilityRequiredContext;

  /** Contextual requirement dimensions */
  readonly contextRequirements?: readonly CapabilityContextRequirementDimension[];

  /** Exact canonical Phase 6C fact IDs backing this candidate */
  readonly sourceFactIds: readonly string[];

  /** Provenance reference from source */
  readonly provenance: SourceReference;

  /** Deterministic explanation codes for why candidate was formed */
  readonly reasonCodes: readonly string[];
}

/**
 * Evaluation result for candidate applicability under runtime evaluation context.
 * Delegates 100% to Phase 7 Step 2 capability resolution. Zero duplicated runtime logic.
 */
export interface CandidateApplicabilityResult {
  readonly isApplicable: boolean;
  readonly status: CompatibilityCandidateStatus;
  readonly sourceResolution: CapabilityResolution;
  readonly targetResolution: CapabilityResolution;
  readonly missingDimensions: readonly CapabilityContextRequirementDimension[];
  readonly mismatchedDimensions: readonly CapabilityContextRequirementDimension[];
  readonly reasons: readonly CapabilityResolutionReason[];
}

/**
 * Multi-dimensional filter for querying compatibility candidates.
 * AND across distinct fields; OR within arrays.
 */
export interface CompatibilityCandidateFilter {
  readonly patchVersion?: '3.7';
  readonly sourceEntityId?: string | readonly string[];
  readonly targetEntityId?: string | readonly string[];
  readonly sourceCapabilityId?: string | readonly string[];
  readonly targetCapabilityId?: string | readonly string[];
  readonly qualificationType?: CandidateQualificationType | readonly CandidateQualificationType[];
  readonly qualificationNature?: CandidateQualificationNature | readonly CandidateQualificationNature[];
  readonly directionality?: CandidateDirectionality | readonly CandidateDirectionality[];
  readonly status?: CompatibilityCandidateStatus | readonly CompatibilityCandidateStatus[];
  readonly matchedDimensionKind?: CandidateMatchedDimensionKind | readonly CandidateMatchedDimensionKind[];
  readonly element?: Element | 'All' | 'NONE' | readonly (Element | 'All' | 'NONE')[];
  readonly actionType?: GameplayActionType | readonly GameplayActionType[];
  readonly involvesNextResonator?: boolean;
  readonly involvesOutro?: boolean;
  readonly involvesIntro?: boolean;
  readonly involvesCoordinatedAttack?: boolean;
  readonly involvesUnmodeled?: boolean;
  readonly evidenceId?: string | readonly string[];
  readonly relationshipId?: string | readonly string[];
}

/**
 * Comprehensive production audit metrics for Patch 3.7 compatibility candidates.
 */
export interface ProductionCompatibilityAuditMetrics {
  readonly totalInputCapabilities: number;
  readonly totalInputRelationships: number;
  readonly totalInputEvidence: number;

  readonly totalCandidates: number;
  readonly uniqueCandidateIds: number;
  readonly duplicateCandidateIds: number;

  readonly explicitTargetCandidates: number;
  readonly dimensionalCandidates: number;

  readonly actionCandidates: number;
  readonly elementCandidates: number;
  readonly transitionCandidates: number;
  readonly resourceCandidates: number;
  readonly defensiveCandidates: number;
  readonly offensiveCandidates: number;
  readonly mechanicalCandidates: number;
  readonly targetScopeCandidates: number;

  readonly candidatesInvolvingNextResonator: number;
  readonly candidatesInvolvingOutro: number;
  readonly candidatesInvolvingIntro: number;
  readonly candidatesInvolvingCoordinatedAttack: number;
  readonly candidatesInvolvingUnmodeled: number;

  readonly candidatesWithTargetCapabilityId: number;
  readonly candidatesWithoutTargetCapabilityId: number;

  readonly candidatesByQualificationType: Readonly<Record<CandidateQualificationType, number>>;
  readonly candidatesByStatus: Readonly<Record<CompatibilityCandidateStatus, number>>;
  readonly candidatesByDirectionality: Readonly<Record<CandidateDirectionality, number>>;
  readonly candidatesByNature: Readonly<Record<CandidateQualificationNature, number>>;
  readonly candidatesByPatch: Readonly<Record<string, number>>;
  readonly candidatesBySourceEntity: Readonly<Record<string, number>>;
  readonly candidatesByTargetEntity: Readonly<Record<string, number>>;

  readonly candidatesWithNumericValue: number;
  readonly candidatesWithoutNumericValue: number;

  readonly candidates: readonly CompatibilityCandidate[];
}
