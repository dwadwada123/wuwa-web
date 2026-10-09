/**
 * Wuthering Waves Deterministic Gameplay Relationship & Interaction Types
 * Phase 7 Step 3: Gameplay Relationship & Interaction Contract
 *
 * Defines deterministic contracts for mechanically proven relationships between
 * gameplay capabilities and entities.
 *
 * CENTRAL INVARIANTS:
 * 1. KNOWN FACT ≠ RELATIONSHIP ≠ SYNERGY SCORE.
 *    Relationships represent mechanical evidence, NOT synergy scores, rankings, or weights.
 * 2. Pure, deterministic, offline domain representation with strict patch isolation ('3.7').
 * 3. Never fabricates relationships or numeric magnitudes (unknown/unmodeled = null, never 0).
 * 4. Full traceability back to exact source capability and canonical factIds.
 * 5. Structural targets (e.g. NEXT_RESONATOR) are NEVER inferred into specific character identities.
 */

import type {
  GameplayCapability,
  GameplayActionType,
  CapabilityRequiredContext,
  CapabilityContextRequirementDimension,
  SemanticParameter,
  SemanticTarget,
  SemanticUnit,
  SemanticCondition,
  SourceReference,
  Element,
  RuntimeEvaluationContext
} from '../capabilities/types.ts';

export type {
  GameplayCapability,
  GameplayActionType,
  CapabilityRequiredContext,
  CapabilityContextRequirementDimension,
  SemanticParameter,
  SemanticTarget,
  SemanticUnit,
  SemanticCondition,
  SourceReference,
  Element,
  RuntimeEvaluationContext
};

/**
 * Closed taxonomy of supported relationship types.
 * Strictly describes mechanical interactions; NO synergy, rank, score, or quality values.
 */
export type GameplayRelationshipType =
  | 'AMPLIFIES_DAMAGE'
  | 'AMPLIFIES_ATTRIBUTE'
  | 'AMPLIFIES_ACTION'
  | 'REDUCES_DEFENSE'
  | 'REDUCES_RESISTANCE'
  | 'PROVIDES_HEALING'
  | 'PROVIDES_SHIELD'
  | 'PROVIDES_RESOURCE'
  | 'REDUCES_COOLDOWN'
  | 'TRIGGERS'
  | 'TARGETS'
  | 'REQUIRES'
  | 'ELEMENT_MATCH'
  | 'ACTION_MATCH'
  | 'NEXT_RESONATOR_INTERACTION'
  | 'OUTRO_INTERACTION'
  | 'INTRO_INTERACTION'
  | 'COORDINATED_ATTACK_INTERACTION'
  | 'SPECIAL_MECHANIC_INTERACTION';

/**
 * High-level categorization of gameplay relationships.
 */
export type GameplayRelationshipCategory =
  | 'OFFENSIVE'
  | 'DEFENSIVE'
  | 'RESOURCE'
  | 'TARGETING'
  | 'ACTION'
  | 'ELEMENTAL'
  | 'TRIGGER'
  | 'MECHANICAL';

/**
 * Closed, deterministic target model.
 * Segregates target dimensions without inventing character-to-character links.
 */
export type GameplayRelationshipTarget =
  | {
      readonly kind: 'CAPABILITY';
      readonly capabilityId: string;
    }
  | {
      readonly kind: 'ENTITY';
      readonly entityId: string;
    }
  | {
      readonly kind: 'ELEMENT';
      readonly element: Element;
    }
  | {
      readonly kind: 'ACTION';
      readonly actionType: GameplayActionType;
    }
  | {
      readonly kind: 'TARGET_CLASS';
      readonly target: SemanticTarget;
    }
  | {
      readonly kind: 'NEXT_RESONATOR';
    }
  | {
      readonly kind: 'NONE';
    };

/**
 * Structured evidence explaining why a relationship deterministically exists.
 */
export interface GameplayRelationshipEvidence {
  readonly sourceKind: 'CAPABILITY' | 'ENGINE_FACT' | 'SEMANTIC_DERIVATION';
  readonly factIds: readonly string[];
  readonly capabilityIds: readonly string[];
  readonly parameter?: SemanticParameter;
  readonly target?: SemanticTarget;
  readonly element?: Element | 'All' | 'NONE';
  readonly actionType?: GameplayActionType;
  readonly reasonCode: string;
}

/**
 * Immutable gameplay relationship model.
 */
export interface GameplayRelationship {
  /** Deterministic canonical identifier */
  readonly relationshipId: string;

  /** Strictly Patch 3.7 */
  readonly patchVersion: '3.7';

  /** Originating capability identity */
  readonly sourceCapabilityId: string;
  readonly sourceEntityId: string;
  readonly sourceCode: string;

  /** Strongly typed relationship classification */
  readonly relationshipType: GameplayRelationshipType;
  readonly category: GameplayRelationshipCategory;

  /** Target receiving or matching the interaction */
  readonly target: GameplayRelationshipTarget;

  /** Specific gameplay parameter if applicable */
  readonly parameter?: SemanticParameter;

  /** Elemental alignment if applicable */
  readonly element?: Element | 'All' | 'NONE';

  /** Associated action type if applicable */
  readonly actionType?: GameplayActionType;

  /**
   * Exact numeric magnitude if known from source capability;
   * strictly null otherwise (never 0, never fabricated).
   */
  readonly effectValue: number | null;

  /** Unit of measurement if numeric */
  readonly unit?: SemanticUnit | null;

  /** Condition constraints preserved from source */
  readonly condition?: SemanticCondition;

  /** Required runtime context preserved from source */
  readonly requiredContext?: CapabilityRequiredContext;

  /** Contextual requirement dimensions */
  readonly contextRequirements?: readonly CapabilityContextRequirementDimension[];

  /** Source fact IDs backing this relationship */
  readonly sourceFactIds: readonly string[];

  /** Provenance reference */
  readonly provenance: SourceReference;

  /** Deterministic evidence trail */
  readonly evidence: GameplayRelationshipEvidence;

  /** Embedded reference to source capability for zero-overhead resolution delegation */
  readonly sourceCapability?: GameplayCapability;
}

/**
 * Multi-dimensional filter for querying relationships.
 * AND across distinct fields; OR within arrays.
 */
export interface RelationshipFilter {
  readonly patchVersion?: '3.7';
  readonly sourceEntityId?: string | readonly string[];
  readonly sourceCapabilityId?: string | readonly string[];
  readonly relationshipType?: GameplayRelationshipType | readonly GameplayRelationshipType[];
  readonly category?: GameplayRelationshipCategory | readonly GameplayRelationshipCategory[];
  readonly targetKind?: GameplayRelationshipTarget['kind'] | readonly GameplayRelationshipTarget['kind'][];
  readonly targetEntity?: string | readonly string[];
  readonly targetElement?: Element | readonly Element[];
  readonly targetAction?: GameplayActionType | readonly GameplayActionType[];
  readonly targetClass?: SemanticTarget | readonly SemanticTarget[];
  readonly parameter?: SemanticParameter | readonly SemanticParameter[];
  readonly factId?: string | readonly string[];
}

/**
 * Comprehensive production audit metrics for Patch 3.7 relationships.
 */
export interface ProductionRelationshipAuditMetrics {
  readonly totalCapabilities: number;
  readonly totalRelationships: number;
  readonly uniqueRelationshipIds: number;
  readonly duplicateRelationshipIds: number;
  readonly capabilitiesWithRelationships: number;
  readonly capabilitiesWithoutRelationships: number;

  readonly relationshipsByType: Readonly<Record<GameplayRelationshipType, number>>;
  readonly relationshipsByCategory: Readonly<Record<GameplayRelationshipCategory, number>>;
  readonly relationshipsByTargetKind: Readonly<Record<GameplayRelationshipTarget['kind'], number>>;

  readonly relationshipsByElement: Readonly<Record<string, number>>;
  readonly relationshipsByAction: Readonly<Record<string, number>>;
  readonly relationshipsByTrigger: Readonly<Record<string, number>>;

  readonly relationshipsWithoutNumericValue: number;
  readonly relationshipsWithKnownNumericValue: number;
  readonly unmodeledCapabilitiesProducingRelationships: number;

  readonly relationships: readonly GameplayRelationship[];
}
