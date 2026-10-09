/**
 * Wuthering Waves Deterministic Character Relationship Composition & Interaction Evidence Types
 * Phase 7 Step 17: Deterministic Character Relationship Composition & Interaction Evidence Contract
 *
 * Defines contracts for composing, normalizing, and auditing character-to-character
 * interaction evidence under strict Patch 3.7 isolation.
 *
 * CRITICAL ARCHITECTURAL BOUNDARIES:
 * 1. EVIDENCE ONLY, ZERO GAMEPLAY SCORING:
 *    Represents mechanically proven interaction facts between Resonators.
 *    ZERO synergy score, ZERO relationship score, ZERO character power, ZERO team score, ZERO DPS.
 * 2. DIRECTIONAL INTEGRITY:
 *    A -> B is distinct from B -> A. Symmetry is NEVER assumed or manufactured.
 * 3. NO SELF-INTERACTION:
 *    A -> A self-interactions are rejected unless explicitly proven.
 * 4. PURE & DETERMINISTIC:
 *    Zero network, zero LLMs, zero random IDs, zero timestamps.
 * 5. EPISTEMIC DISTINCTIONS:
 *    Preserves AUTHORITATIVE, UNKNOWN, UNMODELED, NOT_APPLICABLE, and CONFLICTED states.
 */

import type {
  SourceReference,
  Element,
  GameplayActionType,
  SemanticParameter
} from '../capabilities/types.ts';
import type {
  GameplayRelationship,
  GameplayRelationshipType,
  GameplayRelationshipCategory
} from '../relationships/types.ts';
import type {
  InteractionEvidence,
  InteractionEvidenceType,
  InteractionEvidenceCategory
} from '../relationships/composition/types.ts';
import type {
  CharacterPairSynergyProfile,
  CharacterPairSynergyCategory,
  CharacterPairSynergyStatus
} from '../relationships/character-pairs/synergy/types.ts';
import type {
  CharacterPairEvidenceProfile,
  CharacterPairProfileStatus
} from '../relationships/character-pairs/types.ts';

export type {
  SourceReference,
  Element,
  GameplayActionType,
  SemanticParameter,
  GameplayRelationship,
  GameplayRelationshipType,
  GameplayRelationshipCategory,
  InteractionEvidence,
  InteractionEvidenceType,
  InteractionEvidenceCategory,
  CharacterPairSynergyProfile,
  CharacterPairSynergyCategory,
  CharacterPairSynergyStatus,
  CharacterPairEvidenceProfile,
  CharacterPairProfileStatus
};

/**
 * Closed, deterministic taxonomy for character interaction types.
 * Strictly describes mechanical interactions between two distinct Resonators.
 */
export type CharacterInteractionType =
  | 'OUTRO_INTRO_HANDOFF'
  | 'DAMAGE_AMPLIFICATION'
  | 'ATTRIBUTE_AMPLIFICATION'
  | 'ACTION_AMPLIFICATION'
  | 'DEFENSE_REDUCTION'
  | 'RESISTANCE_REDUCTION'
  | 'HEALING_SUPPORT'
  | 'SHIELD_SUPPORT'
  | 'RESOURCE_GENERATION'
  | 'COORDINATED_ATTACK'
  | 'ELEMENTAL_SYNERGY'
  | 'MECHANICAL_TRIGGER'
  | 'SEQUENCE_DEPENDENT_INTERACTION';

/**
 * High-level categorization of character interactions.
 */
export type CharacterInteractionCategory =
  | 'OFFENSIVE'
  | 'DEFENSIVE'
  | 'UTILITY'
  | 'RESOURCE'
  | 'ELEMENTAL'
  | 'TRANSITION'
  | 'TRIGGER'
  | 'MECHANICAL';

/**
 * Closed epistemic status taxonomy for character interaction evidence.
 */
export type CharacterInteractionStatus =
  | 'AUTHORITATIVE'
  | 'UNKNOWN'
  | 'UNMODELED'
  | 'NOT_APPLICABLE'
  | 'CONFLICTED';

/**
 * Structured conditions governing when an interaction evidence applies.
 */
export interface CharacterInteractionCondition {
  readonly elementRequirement?: Element | 'All' | 'NONE';
  readonly actionTypeRequirement?: GameplayActionType;
  readonly parameterRequirement?: SemanticParameter;
  readonly sequenceRequirement?: number;
  readonly stateRequirement?: string;
  readonly conditionDescription?: string;
}

/**
 * Normalized input representation of an approved character relationship.
 */
export interface ApprovedCharacterRelationship {
  readonly id: string;
  readonly patchVersion: '3.7';
  readonly sourceCharacterId: string;
  readonly targetCharacterId: string;
  readonly relationshipType: GameplayRelationshipType | CharacterInteractionType;
  readonly category?: GameplayRelationshipCategory | CharacterInteractionCategory;
  readonly condition?: CharacterInteractionCondition;
  readonly effectValue?: number | null;
  readonly unit?: string | null;
  readonly sourceCapabilityIds?: readonly string[];
  readonly relationshipIds?: readonly string[];
  readonly sourceFactIds?: readonly string[];
  readonly provenance: SourceReference;
}

/**
 * Normalized input representation of an approved interaction evidence record.
 */
export interface ApprovedInteractionEvidence {
  readonly id: string;
  readonly patchVersion: '3.7';
  readonly sourceCharacterId: string;
  readonly targetCharacterId: string;
  readonly interactionType: CharacterInteractionType | InteractionEvidenceType;
  readonly evidenceStatus?: CharacterInteractionStatus;
  readonly category?: CharacterInteractionCategory | InteractionEvidenceCategory;
  readonly condition?: CharacterInteractionCondition;
  readonly effectValue?: number | null;
  readonly unit?: string | null;
  readonly sourceCapabilityIds?: readonly string[];
  readonly relationshipIds?: readonly string[];
  readonly evidenceIds?: readonly string[];
  readonly sourceFactIds?: readonly string[];
  readonly provenance: SourceReference;
}

/**
 * Authoritative normalized character interaction evidence contract.
 * Represents an objective directional mechanical fact connecting sourceCharacterId -> targetCharacterId.
 */
export interface CharacterInteractionEvidence {
  /** Deterministic canonical ID: char-interaction:3.7:<source>:<target>:<type>:<condKey>:7.17.1 */
  readonly id: string;

  /** Strictly Patch 3.7 */
  readonly patchVersion: '3.7';

  /** Rule version: strictly '7.17.1' */
  readonly ruleVersion: '7.17.1';

  /** Canonical source Resonator ID */
  readonly sourceCharacterId: string;

  /** Canonical target Resonator ID (distinct from source) */
  readonly targetCharacterId: string;

  /** Closed interaction type taxonomy */
  readonly interactionType: CharacterInteractionType;

  /** Authoritative epistemic status */
  readonly evidenceStatus: CharacterInteractionStatus;

  /** High-level interaction category */
  readonly category: CharacterInteractionCategory;

  /** Structured conditional requirements if non-universal */
  readonly condition?: CharacterInteractionCondition;

  /** Numeric magnitude if mechanically structured; null otherwise */
  readonly effectValue: number | null;

  /** Unit of measurement if numeric */
  readonly unit: string | null;

  /** Canonical source capability IDs proving this interaction */
  readonly sourceCapabilityIds: readonly string[];

  /** Canonical Step 3 GameplayRelationship IDs supporting this interaction */
  readonly relationshipIds: readonly string[];

  /** Canonical Step 4 InteractionEvidence IDs supporting this interaction */
  readonly evidenceIds: readonly string[];

  /** Canonical underlying source fact IDs supporting this interaction */
  readonly sourceFactIds: readonly string[];

  /** Machine-readable reason codes explaining composition & status */
  readonly reasonCodes: readonly string[];

  /** Provenance lineage */
  readonly provenance: SourceReference;
}

/**
 * Input contract for the Step 17 composition engine.
 */
export interface CharacterInteractionCompositionInput {
  /** Patch context: strictly '3.7' */
  readonly patchId: string;

  /** Optional custom approved character relationships */
  readonly sourceRelationships?: readonly (ApprovedCharacterRelationship | GameplayRelationship)[];

  /** Optional custom approved interaction evidences */
  readonly sourceInteractions?: readonly (
    | ApprovedInteractionEvidence
    | InteractionEvidence
    | CharacterPairSynergyProfile
    | CharacterPairEvidenceProfile
  )[];

  /** Rule version: strictly '7.17.1' */
  readonly ruleVersion: '7.17.1';
}

/**
 * Concise statistical accounting of composed interaction evidence.
 */
export interface CharacterInteractionCompositionSummary {
  readonly total: number;
  readonly authoritative: number;
  readonly unknown: number;
  readonly unmodeled: number;
  readonly notApplicable: number;
  readonly conflicted: number;
  readonly deduplicated: number;
}

/**
 * Deterministic audit results of the composition run.
 */
export interface CharacterInteractionCompositionAudit {
  readonly deterministic: true;
  readonly patchIsolated: true;
  readonly provenanceValidated: true;
  readonly conflictsDetected: number;
}

/**
 * Output contract of the Step 17 composition engine.
 */
export interface CharacterInteractionCompositionResult {
  readonly patchId: '3.7';
  readonly ruleVersion: '7.17.1';
  readonly interactions: readonly CharacterInteractionEvidence[];
  readonly summary: CharacterInteractionCompositionSummary;
  readonly audit: CharacterInteractionCompositionAudit;
}

/**
 * Query filter for character interaction evidence.
 */
export interface CharacterInteractionFilter {
  readonly patchVersion?: '3.7';
  readonly sourceCharacterId?: string;
  readonly targetCharacterId?: string;
  readonly resonatorId?: string; // matches either source or target
  readonly interactionType?: CharacterInteractionType;
  readonly category?: CharacterInteractionCategory;
  readonly evidenceStatus?: CharacterInteractionStatus;
  readonly hasCondition?: boolean;
}
