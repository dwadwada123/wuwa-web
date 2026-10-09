/**
 * Wuthering Waves Semantic-to-Engine Integration Types
 * Phase 6C Step 3: Semantic Integration Contract & Safety Gate
 *
 * Defines deterministic, strictly typed engine-facing semantic facts and safety classifications.
 * Central Invariant: UNKNOWN, UNMODELED, or missing mechanics MUST NEVER silently become 0.
 */

import type {
  SemanticEffect,
  SemanticParameter,
  SemanticTarget,
  SemanticTrigger,
  SemanticCondition,
  SemanticDuration,
  SemanticStacking,
  SemanticValue,
  SingleSemanticValue,
  RangeSemanticValue,
  MultiRankSemanticValue,
  UnresolvedSemanticValue,
  SemanticUnit,
  SourceReference,
  ExtractionProvenance,
  SemanticRefinementRank
} from '../../domain/types/semantics.ts';
import type { GameplayEffectCategory } from '../../domain/types/gameplay-effects.ts';
import type { Element } from '../../domain/types/common.ts';

/**
 * Epistemic safety status for engine consumption.
 * Distinguishes what the engine can safely calculate vs what must be preserved as indeterminate.
 */
export type EngineSemanticSafetyStatus =
  | 'SAFE_EXPLICIT' // Directly known or parsed with explicit numeric value
  | 'SAFE_DERIVED' // Deterministically derived from known facts with documented formula
  | 'UNKNOWN' // Magnitude or meaning is indeterminate; NEVER treat as 0
  | 'UNMODELED' // Complex mechanic not yet represented in numerical engine; NEVER treat as 0
  | 'NOT_APPLICABLE'; // Non-combat utility or flavor; excluded from combat engine

/**
 * Parameter safety classification matrix.
 * Defines whether a parsed parameter can be used as a direct stat fact, requires combat context,
 * or requires an unmodeled combat state machine.
 */
export type ParameterSafetyClassification =
  | 'DIRECT_ENGINE_FACT' // Context-independent stat buff, elemental damage bonus, or RES shred
  | 'REQUIRES_CONTEXT' // Action-specific (Basic, Skill, Liberation) or rotation-dependent
  | 'CURRENTLY_UNMODELED' // Requires state machine (Forte gauge meters, coordinated attack procs)
  | 'NOT_ENGINE_CONSUMABLE'; // Unresolved parameter or non-combat

/**
 * Deterministic engine-facing semantic fact contract.
 * Strictly immutable/read-only from engine and optimizer perspectives.
 */
export type EngineSemanticFact =
  | {
      status: 'SAFE_EXPLICIT';
      effect: SemanticEffect;
      entityId: string;
      sourceCode: string;
      patchVersion: string;
      category: GameplayEffectCategory;
      target: SemanticTarget;
      parameter: SemanticParameter;
      element: Element | 'All' | 'NONE';
      value: SingleSemanticValue | RangeSemanticValue | MultiRankSemanticValue;
      condition?: SemanticCondition;
      duration?: SemanticDuration;
      stacking?: SemanticStacking;
      parameterSafety: ParameterSafetyClassification;
      provenance: SourceReference;
    }
  | {
      status: 'SAFE_DERIVED';
      effect: SemanticEffect;
      entityId: string;
      sourceCode: string;
      patchVersion: string;
      category: GameplayEffectCategory;
      target: SemanticTarget;
      parameter: SemanticParameter;
      element: Element | 'All' | 'NONE';
      value: SingleSemanticValue | RangeSemanticValue | MultiRankSemanticValue;
      derivationFormula: string;
      condition?: SemanticCondition;
      duration?: SemanticDuration;
      stacking?: SemanticStacking;
      parameterSafety: ParameterSafetyClassification;
      provenance: SourceReference;
    }
  | {
      status: 'UNKNOWN';
      effect?: SemanticEffect;
      entityId: string;
      sourceCode: string;
      patchVersion: string;
      parameter?: SemanticParameter;
      parameterSafety?: ParameterSafetyClassification;
      reason: string;
      rawFragment?: string;
      provenance?: SourceReference;
    }
  | {
      status: 'UNMODELED';
      effect?: SemanticEffect;
      entityId: string;
      sourceCode: string;
      patchVersion: string;
      parameter?: SemanticParameter;
      parameterSafety?: ParameterSafetyClassification;
      reason: string;
      rawFragment?: string;
      provenance?: SourceReference;
    }
  | {
      status: 'NOT_APPLICABLE';
      effect?: SemanticEffect;
      entityId: string;
      sourceCode: string;
      patchVersion: string;
      parameter?: SemanticParameter;
      parameterSafety?: ParameterSafetyClassification;
      reason: string;
      rawFragment?: string;
      provenance?: SourceReference;
    };

/**
 * Deterministic context for evaluating contextual and conditional semantic facts.
 * Used strictly for boundary enforcement; does not execute combat simulation.
 */
export interface RuntimeEvaluationContext {
  trigger?: SemanticTrigger;
  actionType?: 'BASIC_ATTACK' | 'HEAVY_ATTACK' | 'RESONANCE_SKILL' | 'RESONANCE_LIBERATION' | 'INTRO' | 'OUTRO';
  refinementRank?: SemanticRefinementRank;
  zoneActive?: boolean;
  buffActive?: boolean;
  stackCount?: number;
  activeCharacterId?: string;
  target?: SemanticTarget;
  element?: Element | 'All';
}

/**
 * Report containing aggregate metrics from running the safety gate across production effects.
 */
export interface ProductionEngineIntegrationMetrics {
  totalExtractedEffects: number;
  safetyCounts: {
    SAFE_EXPLICIT: number;
    SAFE_DERIVED: number;
    UNKNOWN: number;
    UNMODELED: number;
    NOT_APPLICABLE: number;
  };
  parameterSafetyBreakdown: {
    DIRECT_ENGINE_FACT: number;
    REQUIRES_CONTEXT: number;
    CURRENTLY_UNMODELED: number;
    NOT_ENGINE_CONSUMABLE: number;
  };
  staticNumericEligibility: {
    STATIC_NUMERIC_ELIGIBLE: number;
    STATIC_NUMERIC_REJECTED: number;
    rejectionBreakdown: {
      REQUIRES_ACTION_CONTEXT: number;
      REQUIRES_TRIGGER_CONTEXT: number;
      UNMODELED_COMBAT_MECHANIC: number;
    };
  };
  targetBreakdown: Record<string, number>;
  elementBreakdown: Record<string, number>;
  conditionTriggerBreakdown: Record<string, number>;
  effectsRejectedFromDirectEngineUse: Array<{
    effectId: string;
    entityId: string;
    sourceCode: string;
    parameter: SemanticParameter;
    safetyStatus: EngineSemanticSafetyStatus;
    parameterSafety: ParameterSafetyClassification;
    reason: string;
  }>;
}
