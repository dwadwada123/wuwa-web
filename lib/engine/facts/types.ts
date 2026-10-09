/**
 * Wuthering Waves Deterministic Engine Fact Types
 * Phase 6C Step 4: Deterministic Engine Consumption Layer
 *
 * Defines the normalized engine-facing fact contract and consumption states.
 * Central Invariant: NEVER convert UNKNOWN, UNMODELED, NOT_APPLICABLE, or
 * REQUIRES_CONTEXT facts into numeric 0.
 */

import type {
  SemanticEffect,
  SemanticParameter,
  SemanticTarget,
  SemanticTrigger,
  SemanticCondition,
  SemanticDuration,
  SemanticStacking,
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
import type {
  EngineSemanticSafetyStatus,
  ParameterSafetyClassification
} from '../semantics/types.ts';

/**
 * Normalized consumption state for engine consumers.
 * Distinguishes what the engine can safely calculate statically vs contextually vs unmodeled.
 */
export type EngineFactConsumptionState =
  | 'CONSUMABLE_STATIC' // Usable directly in static calculation (stat buffs, unconditional elemental damage bonuses, resistance shreds)
  | 'CONSUMABLE_CONTEXTUAL' // Usable only under matching runtime context (action-specific buffs, triggers, stacks, zones, buffs)
  | 'UNMODELED' // Complex combat mechanic requiring unmodeled combat system (Forte gauge, coordinated attacks); NEVER treated as 0
  | 'UNKNOWN' // Indeterminate magnitude or condition; NEVER treated as 0
  | 'NOT_APPLICABLE'; // Non-combat utility or flavor; excluded from combat engine

/**
 * Normalized, loss-minimizing engine fact contract.
 * Strictly immutable, pure, and deterministic.
 */
export interface NormalizedEngineFact {
  /** Stable deterministic fact identifier derived from canonical semantic signature */
  factId: string;
  entityId: string;
  sourceCode: string;
  patchVersion: string; // strictly '3.7'
  category: GameplayEffectCategory;
  parameter: SemanticParameter;
  value: SingleSemanticValue | RangeSemanticValue | MultiRankSemanticValue | UnresolvedSemanticValue;
  /** Exact numeric magnitude if and only if consumptionState is CONSUMABLE_STATIC; strictly null otherwise (never 0) */
  staticNumericValue: number | null;
  unit: SemanticUnit | null;
  target: SemanticTarget;
  element: Element | 'All' | 'NONE';
  condition?: SemanticCondition;
  duration?: SemanticDuration;
  stacking?: SemanticStacking;
  /** Explicit refinement rank if this fact was resolved for a specific weapon rank */
  refinementRank?: SemanticRefinementRank;
  semanticStatus: EngineSemanticSafetyStatus;
  parameterSafety: ParameterSafetyClassification;
  consumptionState: EngineFactConsumptionState;
  provenance: SourceReference;
  extraction: ExtractionProvenance;
  /** Documented derivation formula if status is SAFE_DERIVED */
  derivationFormula?: string;
  /** Unmodeled or unknown reason description */
  reason?: string;
  /** Raw mechanical prose fragment for unmodeled fragments */
  rawFragment?: string;
}

/**
 * Normalization options for engine fact conversion.
 */
export interface FactNormalizationOptions {
  /** Explicit refinement rank to resolve for MULTI_RANK values */
  refinementRank?: SemanticRefinementRank;
}

/**
 * Aggregate metrics from normalizing all production extracted effects from Patch 3.7.
 */
export interface ProductionFactNormalizationMetrics {
  totalExtractedEffects: number;
  byConsumptionState: {
    CONSUMABLE_STATIC: number;
    CONSUMABLE_CONTEXTUAL: number;
    UNMODELED: number;
    UNKNOWN: number;
    NOT_APPLICABLE: number;
  };
  byParameter: Record<string, number>;
  byTarget: Record<string, number>;
  byElement: Record<string, number>;
  byTrigger: Record<string, number>;
  bySourceType: Record<string, number>;
  byParameterSafety: {
    DIRECT_ENGINE_FACT: number;
    REQUIRES_CONTEXT: number;
    CURRENTLY_UNMODELED: number;
    NOT_ENGINE_CONSUMABLE: number;
  };
  bySemanticStatus: {
    SAFE_EXPLICIT: number;
    SAFE_DERIVED: number;
    UNKNOWN: number;
    UNMODELED: number;
    NOT_APPLICABLE: number;
  };
  facts: NormalizedEngineFact[];
}
