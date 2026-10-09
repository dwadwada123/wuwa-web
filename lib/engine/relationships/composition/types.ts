/**
 * Wuthering Waves Deterministic Relationship Composition & Interaction Evidence Types
 * Phase 7 Step 4: Deterministic Relationship Composition & Interaction Evidence Layer
 *
 * Defines deterministic contracts for composing Step 3 gameplay relationships into
 * queryable, auditable interaction evidence.
 *
 * CENTRAL INVARIANTS:
 * 1. RELATIONSHIP EXISTENCE ≠ POSITIVE SYNERGY.
 *    Evidence represents mechanically proven facts, NOT synergy scores, weights, rankings, or tiers.
 * 2. Pure, deterministic, offline domain representation with strict patch isolation ('3.7').
 * 3. Never fabricates interactions or numeric magnitudes (unknown/unmodeled = null, never 0).
 * 4. Full traceability back to exact source capabilities and canonical Step 3 relationship IDs.
 * 5. Structural targets (e.g. NEXT_RESONATOR) are NEVER inferred into specific character identities.
 * 6. Applicability evaluation strictly delegates to Phase 7 Step 2 capability resolution.
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
  CapabilityResolutionReason
} from '../../capabilities/resolution/types.ts';
import type {
  GameplayRelationship,
  GameplayRelationshipType,
  GameplayRelationshipCategory,
  GameplayRelationshipTarget
} from '../types.ts';

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
  GameplayRelationship,
  GameplayRelationshipType,
  GameplayRelationshipCategory,
  GameplayRelationshipTarget
};

/**
 * Closed, deterministic taxonomy for interaction evidence.
 * Strictly describes mechanical interactions; NO synergy, rank, score, or quality values.
 */
export type InteractionEvidenceType =
  | 'TARGET_EVIDENCE'
  | 'ACTION_EVIDENCE'
  | 'ELEMENT_EVIDENCE'
  | 'OUTRO_EVIDENCE'
  | 'INTRO_EVIDENCE'
  | 'NEXT_RESONATOR_EVIDENCE'
  | 'COORDINATED_ATTACK_EVIDENCE'
  | 'RESOURCE_EVIDENCE'
  | 'DEFENSIVE_EVIDENCE'
  | 'OFFENSIVE_EVIDENCE'
  | 'MECHANICAL_EVIDENCE';

/**
 * High-level categorization of interaction evidence.
 */
export type InteractionEvidenceCategory =
  | 'OFFENSIVE'
  | 'DEFENSIVE'
  | 'RESOURCE'
  | 'TARGETING'
  | 'ACTION'
  | 'ELEMENTAL'
  | 'TRIGGER'
  | 'TRANSITION'
  | 'MECHANICAL';

/**
 * Modeling status of the interaction evidence.
 */
export type InteractionEvidenceStatus =
  | 'MODELED'
  | 'CONTEXTUAL'
  | 'UNMODELED'
  | 'UNKNOWN'
  | 'NOT_APPLICABLE';

/**
 * Structured mechanical dimension kinds.
 */
export type InteractionDimensionKind =
  | 'TARGET'
  | 'ACTION'
  | 'ELEMENT'
  | 'TRIGGER'
  | 'PARAMETER'
  | 'TRANSITION';

/**
 * Explicit mechanical dimension associated with interaction evidence.
 */
export interface InteractionDimension {
  readonly kind: InteractionDimensionKind;
  readonly value: string;
}

/**
 * Applicability evaluation result for an InteractionEvidence under runtime context.
 */
export interface InteractionEvidenceApplicability {
  readonly isApplicable: boolean;
  readonly status: CapabilityResolutionStatus;
  readonly missingDimensions: readonly CapabilityContextRequirementDimension[];
  readonly mismatchedDimensions: readonly CapabilityContextRequirementDimension[];
  readonly reasons: readonly CapabilityResolutionReason[];
}

/**
 * Immutable interaction evidence record.
 * Represents mechanically proven interaction facts between relationships and capabilities.
 */
export interface InteractionEvidence {
  /** Deterministic canonical identifier */
  readonly id: string;

  /** Strictly Patch 3.7 */
  readonly patchVersion: '3.7';

  /** Primary capability providing the interaction */
  readonly sourceCapabilityId: string;
  readonly sourceEntityId: string;
  readonly sourceCode: string;

  /** Optional target capability when representing capability-to-capability interaction */
  readonly targetCapabilityId?: string;
  readonly targetEntityId?: string;

  /** Closed evidence taxonomy */
  readonly evidenceType: InteractionEvidenceType;
  readonly category: InteractionEvidenceCategory;

  /** Canonical IDs of all Step 3 relationships proving this evidence (sorted canonically) */
  readonly relationshipIds: readonly string[];

  /** Shared / active dimensions involved in the interaction */
  readonly dimensions: readonly InteractionDimension[];

  /** Target classification inherited from relationship */
  readonly target: GameplayRelationshipTarget;

  /** Elemental alignment if applicable */
  readonly element?: Element | 'All' | 'NONE';

  /** Associated action type if applicable */
  readonly actionType?: GameplayActionType;

  /** Specific gameplay parameter if applicable */
  readonly parameter?: SemanticParameter;

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

  /** Exact canonical Phase 6C fact IDs backing this evidence */
  readonly sourceFactIds: readonly string[];

  /** Provenance reference */
  readonly provenance: SourceReference;

  /** Status reflecting whether mechanic is modeled vs unmodeled vs contextual */
  readonly status: InteractionEvidenceStatus;

  /** Deterministic explanation codes for why evidence was formed */
  readonly reasonCodes: readonly string[];

  /** Embedded reference to source capability for zero-overhead resolution delegation */
  readonly sourceCapability: GameplayCapability;

  /** Embedded reference to target capability if pairwise */
  readonly targetCapability?: GameplayCapability;
}

/**
 * Multi-dimensional filter for querying interaction evidence.
 * AND across distinct fields; OR within arrays.
 */
export interface InteractionEvidenceFilter {
  readonly patchVersion?: '3.7';
  readonly sourceEntityId?: string | readonly string[];
  readonly sourceCapabilityId?: string | readonly string[];
  readonly targetEntityId?: string | readonly string[];
  readonly targetCapabilityId?: string | readonly string[];
  readonly evidenceType?: InteractionEvidenceType | readonly InteractionEvidenceType[];
  readonly category?: InteractionEvidenceCategory | readonly InteractionEvidenceCategory[];
  readonly element?: Element | 'All' | 'NONE' | readonly (Element | 'All' | 'NONE')[];
  readonly actionType?: GameplayActionType | readonly GameplayActionType[];
  readonly status?: InteractionEvidenceStatus | readonly InteractionEvidenceStatus[];
  readonly relationshipId?: string | readonly string[];
  readonly factId?: string | readonly string[];
  readonly hasNumericValue?: boolean;
  readonly involvesNextResonator?: boolean;
  readonly involvesOutro?: boolean;
  readonly involvesIntro?: boolean;
  readonly involvesCoordinatedAttack?: boolean;
  readonly isPairwise?: boolean;
}

/**
 * Comprehensive production audit metrics for Patch 3.7 interaction evidence.
 */
export interface ProductionInteractionAuditMetrics {
  readonly totalCapabilities: number;
  readonly totalInputCapabilities: number;
  readonly totalInputRelationships: number;
  readonly totalEvidence: number;
  readonly uniqueEvidenceIds: number;
  readonly duplicateEvidenceIds: number;

  readonly singleCapabilityEvidence: number;
  readonly pairwiseEvidence: number;
  readonly explicitTargetPairwiseEvidence: number;
  readonly evidenceWithTargetCapabilityId: number;
  readonly evidenceWithoutTargetCapabilityId: number;

  readonly actionOnlyPairwiseInference: number;
  readonly elementOnlyPairwiseInference: number;
  readonly outroIntroOnlyPairwiseInference: number;

  readonly evidenceByType: Readonly<Record<InteractionEvidenceType, number>>;
  readonly evidenceByCategory: Readonly<Record<InteractionEvidenceCategory, number>>;
  readonly evidenceByStatus: Readonly<Record<InteractionEvidenceStatus, number>>;
  readonly evidenceByPatch: Readonly<Record<string, number>>;
  readonly evidenceBySourceEntity: Readonly<Record<string, number>>;

  readonly evidenceInvolvingNextResonator: number;
  readonly evidenceInvolvingOutro: number;
  readonly evidenceInvolvingIntro: number;
  readonly evidenceInvolvingElement: number;
  readonly evidenceInvolvingAction: number;
  readonly evidenceInvolvingCoordinatedAttack: number;
  readonly evidenceInvolvingUnmodeled: number;

  readonly evidenceWithNumericValue: number;
  readonly evidenceWithoutNumericValue: number;

  readonly evidence: readonly InteractionEvidence[];
}
