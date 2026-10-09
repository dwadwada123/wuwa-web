/**
 * Wuthering Waves Deterministic Gameplay Capability Types
 * Phase 7 Step 1: Deterministic Gameplay Capability Contract
 *
 * Defines the public interfaces, closed taxonomy, status enumerations,
 * and accounting metrics for gameplay capabilities.
 *
 * CENTRAL INVARIANTS:
 * 1. A CAPABILITY IS NOT A SCORE. No scores, weights, priorities, or rankings.
 * 2. Deterministic, pure, synchronous, offline domain representation.
 * 3. Consumes strictly from Phase 6C engine facts (NormalizedEngineFact).
 * 4. Never fabricates numeric values or converts unmodeled/unknown to 0.
 * 5. Full traceability back to exact canonical factId.
 */

import type {
  SemanticParameter,
  SemanticTarget,
  SemanticUnit,
  SemanticCondition,
  SemanticDuration,
  SemanticStacking,
  SourceReference,
  SemanticRefinementRank
} from '../../domain/types/semantics.ts';
import type { Element } from '../../domain/types/common.ts';

export type SemanticStackOperator = 'EXACT' | 'AT_LEAST' | 'PER_STACK';
import type {
  EngineSemanticSafetyStatus,
  ParameterSafetyClassification,
  RuntimeEvaluationContext
} from '../semantics/types.ts';
import type {
  NormalizedEngineFact,
  EngineFactConsumptionState
} from '../facts/types.ts';

export type {
  SemanticParameter,
  SemanticTarget,
  SemanticUnit,
  SemanticCondition,
  SemanticDuration,
  SemanticStacking,
  SourceReference,
  SemanticRefinementRank,
  Element,
  EngineSemanticSafetyStatus,
  ParameterSafetyClassification,
  NormalizedEngineFact,
  EngineFactConsumptionState,
  RuntimeEvaluationContext
};

/**
 * Primary capability categories derived from actual gameplay mechanics.
 * Strictly closed taxonomy representing high-level combat domain facets.
 */
export type GameplayCapabilityCategory =
  | 'DAMAGE' // Self damage contributions and direct attack enhancements
  | 'OFFENSIVE_SUPPORT' // ATK, CRIT, damage amplifications, shreds provided to self/team
  | 'DEFENSIVE_SURVIVABILITY' // HP, DEF, healing, shields
  | 'RESOURCE_COMBAT' // Energy, cooldown reduction, forte/concerto management
  | 'ELEMENTAL_INTERACTION' // Specific elemental amplifications and resistance interactions
  | 'SPECIAL_MECHANIC'; // Complex/unmodeled mechanics requiring external state

/**
 * Closed, strongly-typed capability kinds derived from Patch 3.7 semantics.
 */
export type GameplayCapabilityKind =
  // A. DAMAGE (Self damage contributions)
  | 'BASIC_ATTACK_DAMAGE'
  | 'HEAVY_ATTACK_DAMAGE'
  | 'RESONANCE_SKILL_DAMAGE'
  | 'RESONANCE_LIBERATION_DAMAGE'
  | 'GENERIC_DAMAGE'
  | 'COORDINATED_ATTACK_DAMAGE'

  // B. OFFENSIVE SUPPORT (Amplifications & shreds)
  | 'ATK_AMPLIFICATION'
  | 'CRIT_RATE_AMPLIFICATION'
  | 'CRIT_DAMAGE_AMPLIFICATION'
  | 'ALL_ATTRIBUTE_DAMAGE_AMPLIFICATION'
  | 'ELEMENTAL_DAMAGE_AMPLIFICATION'
  | 'SKILL_DAMAGE_AMPLIFICATION'
  | 'BASIC_ATTACK_DAMAGE_AMPLIFICATION'
  | 'HEAVY_ATTACK_DAMAGE_AMPLIFICATION'
  | 'LIBERATION_DAMAGE_AMPLIFICATION'
  | 'COORDINATED_ATTACK_AMPLIFICATION'
  | 'DEFENSE_SHRED'
  | 'RESISTANCE_SHRED'
  | 'GENERIC_DAMAGE_AMPLIFICATION'

  // C. DEFENSIVE / SURVIVABILITY
  | 'HP_AMPLIFICATION'
  | 'DEF_AMPLIFICATION'
  | 'HEALING_BONUS'
  | 'HEALING_PROVISION'
  | 'SHIELD_PROVISION'

  // D. RESOURCE / COMBAT SYSTEM
  | 'ENERGY_REGENERATION'
  | 'COOLDOWN_REDUCTION'
  | 'FORTE_RESOURCE_MANAGEMENT'

  // E. SPECIAL / UNMODELED
  | 'SPECIAL_MECHANIC';

/**
 * Explicit gameplay action associated with a capability when made explicit by source or trigger.
 */
export type GameplayActionType =
  | 'BASIC'
  | 'HEAVY'
  | 'SKILL'
  | 'LIBERATION'
  | 'INTRO'
  | 'OUTRO'
  | 'COORDINATED';

/**
 * Epistemological modeling status of a gameplay capability.
 */
export type CapabilityStatus =
  | 'MODELED' // Statically consumable, fully verified numeric engine fact
  | 'CONTEXTUAL' // Valid mechanic requiring runtime rotation context (trigger, action, stack, rank)
  | 'UNMODELED' // Unmodeled combat gauge / state machine (Forte gauge, coordinated attacks)
  | 'UNKNOWN' // Indeterminate magnitude or condition in source
  | 'NOT_APPLICABLE'; // Non-combat utility or flavor

/**
 * Primary context requirement classification for a gameplay capability.
 * Strongly typed enumeration distinguishing context-free vs single-dimensional vs composite requirements.
 */
export type CapabilityContextRequirement =
  | 'NONE' // Statically context-free; immediately consumable without runtime context
  | 'ELEMENT' // Requires specific element context (e.g. Fusion, Glacio)
  | 'ACTION' // Requires specific combat action (e.g. Resonance Skill, Basic Attack)
  | 'TRIGGER' // Requires specific gameplay trigger (e.g. Outro, Intro, On Hit)
  | 'ZONE_STATE' // Requires specific zone state (e.g. zoneActive = true)
  | 'BUFF_STATE' // Requires specific buff state (e.g. buffActive = true)
  | 'STACK_COUNT' // Requires specific stack count or stack operator evaluation
  | 'REFINEMENT_RANK' // Requires weapon refinement rank (MULTI_RANK)
  | 'COMPOSITE' // Requires multiple runtime dimensions (e.g. ELEMENT + TRIGGER, ACTION + TRIGGER)
  | 'UNMODELED'; // Unmodeled combat mechanic requiring external state machine

/**
 * Individual contextual dimensions that may be required by a capability.
 */
export type CapabilityContextRequirementDimension =
  | 'ELEMENT'
  | 'ACTION'
  | 'TRIGGER'
  | 'ZONE_STATE'
  | 'BUFF_STATE'
  | 'STACK_COUNT'
  | 'REFINEMENT_RANK'
  | 'UNMODELED';

/**
 * Detailed runtime context requirements for a capability.
 */
export interface CapabilityRequiredContext {
  /** Required element alignment if element-specific */
  readonly element?: Element;
  /** Required gameplay action type if action-dependent */
  readonly actionType?: string;
  /** Required trigger event if trigger-dependent */
  readonly trigger?: string;
  /** Required zone state */
  readonly zoneActive?: boolean;
  /** Required buff state */
  readonly buffActive?: boolean;
  /** Required stack count */
  readonly stackCount?: number;
  /** Required stack operator */
  readonly stackOperator?: SemanticStackOperator;
  /** Whether refinement rank is required (for MULTI_RANK) */
  readonly refinementRank?: boolean;
  /** Active character identity if target is SELF */
  readonly activeCharacterId?: string;
}

/**
 * Immutable deterministic representation of a Resonator or source gameplay capability.
 * Contains zero scoring fields.
 */
export interface GameplayCapability {
  /** Deterministic RFC-like identifier derived from entity, sourceCode, kind, and fact IDs */
  readonly capabilityId: string;

  /** Resonator or weapon entity providing this capability */
  readonly entityId: string;

  /** Ability code, sequence node, or passive code */
  readonly sourceCode: string;

  /** Strictly '3.7' */
  readonly patchVersion: string;

  /** Specific semantic capability kind */
  readonly kind: GameplayCapabilityKind;

  /** High-level capability category */
  readonly category: GameplayCapabilityCategory;

  /** Underlying semantic parameter from Phase 6C */
  readonly parameter: SemanticParameter;

  /** Gameplay target receiving the effect */
  readonly target: SemanticTarget;

  /** Elemental alignment */
  readonly element: Element | 'All' | 'NONE';

  /** Gameplay action type if explicitly associated */
  readonly actionType?: GameplayActionType;

  /** Explicit trigger, zone, buff, and stack constraints */
  readonly conditions?: SemanticCondition;

  /** Duration in seconds and swap expiration flag */
  readonly duration?: SemanticDuration;

  /** Stacking dynamic limits and durations */
  readonly stacking?: SemanticStacking;

  /** Explicit weapon refinement rank if resolved */
  readonly refinementRank?: SemanticRefinementRank;

  // ==========================================================================
  // CONTEXT REQUIREMENT & VALUE STATE CONTRACT (PHASE 7 STEP 1 REMEDIATION)
  // ==========================================================================

  /** Primary context requirement classification */
  readonly contextRequirement: CapabilityContextRequirement;

  /** All contextual dimensions required by this capability */
  readonly contextRequirements: readonly CapabilityContextRequirementDimension[];

  /** Detailed runtime context parameters required to evaluate or apply this capability */
  readonly requiredContext?: CapabilityRequiredContext;

  /** True if capability requires any runtime context before application (contextRequirement !== 'NONE') */
  readonly requiresRuntimeContext: boolean;

  /** True if capability has known numeric value and requires zero runtime context */
  readonly isContextFree: boolean;

  /** True if numeric value is known (finite number); false if unmodeled/unknown/unresolved */
  readonly isNumericValueKnown: boolean;

  /** Specific dimension convenience flags */
  readonly requiresElement: boolean;
  readonly requiresAction: boolean;
  readonly requiresTrigger: boolean;
  readonly requiresZone: boolean;
  readonly requiresBuff: boolean;
  readonly requiresStack: boolean;
  readonly requiresRefinement: boolean;

  /** True if fact origin is CONSUMABLE_STATIC (NOTE: static facts may still require ELEMENT context) */
  readonly isStatic: boolean;

  /** True if fact origin is CONSUMABLE_CONTEXTUAL */
  readonly isContextual: boolean;

  /** Modeling certainty status */
  readonly status: CapabilityStatus;

  /** Phase 6C safety status */
  readonly semanticStatus: EngineSemanticSafetyStatus;

  /** Phase 6C consumption classification */
  readonly consumptionState: EngineFactConsumptionState;

  /** Parameter safety classification */
  readonly parameterSafety: ParameterSafetyClassification;

  /** Exact numeric magnitude if known; strictly null otherwise (never 0) */
  readonly numericValue: number | null;

  /** Numeric measurement unit */
  readonly unit: SemanticUnit | null;

  /** Exact canonical Phase 6C fact IDs that produced this capability */
  readonly factIds: readonly string[];

  /** Authoritative source provenance */
  readonly provenance: SourceReference;
}

/**
 * Optional multi-dimensional filter for querying capabilities.
 */
export interface CapabilityFilter {
  readonly entityId?: string | readonly string[];
  readonly sourceCode?: string | readonly string[];
  readonly kind?: GameplayCapabilityKind | readonly GameplayCapabilityKind[];
  readonly category?: GameplayCapabilityCategory | readonly GameplayCapabilityCategory[];
  readonly parameter?: SemanticParameter | readonly SemanticParameter[];
  readonly target?: SemanticTarget | readonly SemanticTarget[];
  readonly element?: (Element | 'All' | 'NONE') | readonly (Element | 'All' | 'NONE')[];
  readonly actionType?: GameplayActionType | readonly GameplayActionType[];
  readonly status?: CapabilityStatus | readonly CapabilityStatus[];
  readonly contextRequirement?: CapabilityContextRequirement | readonly CapabilityContextRequirement[];
  readonly isStatic?: boolean;
  readonly isContextual?: boolean;
  readonly requiresRuntimeContext?: boolean;
  readonly isContextFree?: boolean;
  readonly isNumericValueKnown?: boolean;
  readonly requiresElement?: boolean;
  readonly requiresAction?: boolean;
  readonly requiresTrigger?: boolean;
  readonly patchVersion?: string;
}

/**
 * Multi-dimensional audit metrics for production capability reconciliation.
 */
export interface ProductionCapabilityMetrics {
  readonly totalInputFacts: number;
  readonly totalCapabilities: number;

  // Value Known / Unknown Accounting
  readonly valueKnownCount: number;
  readonly valueUnknownCount: number;

  // Context Requirement Primary Accounting
  readonly contextFreeCount: number;
  readonly elementRequirementCount: number;
  readonly actionRequirementCount: number;
  readonly triggerRequirementCount: number;
  readonly compositeRequirementCount: number;
  readonly unmodeledRequirementCount: number;
  readonly byContextRequirement: Record<CapabilityContextRequirement, number>;

  // Dimensional Requirement Breakdown (across all capabilities)
  readonly totalRequiringElement: number;
  readonly totalRequiringAction: number;
  readonly totalRequiringTrigger: number;
  readonly totalRequiringStack: number;
  readonly totalRequiringRefinement: number;
  readonly totalRequiringZone: number;
  readonly totalRequiringBuff: number;

  // Modeling Status Accounting
  readonly modeledCount: number;
  readonly contextualCount: number;
  readonly unmodeledCount: number;
  readonly unknownCount: number;
  readonly notApplicableCount: number;

  // Domain Categorization Breakdowns
  readonly byEntity: Record<string, number>;
  readonly byKind: Record<string, number>;
  readonly byCategory: Record<string, number>;
  readonly byTarget: Record<string, number>;
  readonly byElement: Record<string, number>;
  readonly byParameter: Record<string, number>;
  readonly capabilities: readonly GameplayCapability[];
}
