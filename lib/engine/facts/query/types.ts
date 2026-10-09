/**
 * Wuthering Waves Engine Fact Aggregation & Query Types
 * Phase 6C Step 6: Engine Fact Aggregation & Semantic Consumption API
 *
 * Defines the public interfaces, filter criteria, grouping contracts,
 * consumable numeric facts, and diagnostic reports for engine subsystems.
 */

import type {
  SemanticParameter,
  SemanticUnit,
  SemanticTarget,
  SemanticRefinementRank,
  SemanticDuration,
  SemanticStacking,
  SourceReference,
  ExtractionProvenance
} from '../../../domain/types/semantics.ts';
import type { Element } from '../../../domain/types/common.ts';
import type { GameplayEffectCategory } from '../../../domain/types/gameplay-effects.ts';
import type {
  EngineSemanticSafetyStatus,
  ParameterSafetyClassification,
  RuntimeEvaluationContext
} from '../../semantics/types.ts';
import type {
  NormalizedEngineFact,
  EngineFactConsumptionState
} from '../types.ts';
import type {
  ContextualEvaluationResult,
  ContextualEvaluationReason,
  RequiredContextSummary
} from '../context/types.ts';

export type {
  NormalizedEngineFact,
  EngineFactConsumptionState,
  ContextualEvaluationResult,
  ContextualEvaluationReason,
  RuntimeEvaluationContext
};

/**
 * Deterministic query filter for NormalizedEngineFacts.
 * Multiple specified fields are combined with strict AND logic.
 * Array fields match if the fact's value is in the array (OR within the dimension).
 */
export interface EngineFactFilter {
  entityId?: string | readonly string[];
  sourceCode?: string | readonly string[];
  category?: GameplayEffectCategory | readonly GameplayEffectCategory[];
  parameter?: SemanticParameter | readonly SemanticParameter[];
  target?: SemanticTarget | readonly SemanticTarget[];
  element?: (Element | 'All' | 'NONE') | readonly (Element | 'All' | 'NONE')[];
  consumptionState?: EngineFactConsumptionState | readonly EngineFactConsumptionState[];
  semanticStatus?: EngineSemanticSafetyStatus | readonly EngineSemanticSafetyStatus[];
  parameterSafety?: ParameterSafetyClassification | readonly ParameterSafetyClassification[];
  patchVersion?: string; // Strictly '3.7' by default
  refinementRank?: SemanticRefinementRank | readonly SemanticRefinementRank[];
}

/**
 * Strongly-typed resolved consumable numeric fact for downstream combat & engine consumers.
 * Guarantees a finite numeric magnitude and valid provenance.
 * NEVER allows null or implicit zero fallback.
 */
export interface ConsumableNumericFact {
  readonly factId: string;
  readonly entityId: string;
  readonly sourceCode: string;
  readonly patchVersion: string; // Strictly '3.7'
  readonly category: GameplayEffectCategory;
  readonly parameter: SemanticParameter;
  /** Exact finite numeric value (guaranteed non-null and finite) */
  readonly numericValue: number;
  readonly unit: SemanticUnit | null;
  readonly element: Element | 'All' | 'NONE';
  readonly target: SemanticTarget;
  readonly state: 'STATIC' | 'CONTEXTUAL';
  readonly duration?: SemanticDuration;
  readonly stacking?: SemanticStacking;
  readonly provenance: SourceReference;
  readonly extraction: ExtractionProvenance;
  readonly evaluationReason: ContextualEvaluationReason;
  readonly resolvedRank?: SemanticRefinementRank;
}

/**
 * Diagnostic record explaining why a fact was or was not consumable under a given context.
 */
export interface FactDiagnosticResult {
  readonly factId: string;
  readonly entityId: string;
  readonly sourceCode: string;
  readonly patchVersion: string;
  readonly consumable: boolean;
  readonly reason: ContextualEvaluationReason;
  readonly state: EngineFactConsumptionState | 'STATIC' | 'CONTEXTUAL';
  readonly numericValue: number | null;
  readonly requiredContext?: RequiredContextSummary;
  readonly fact: NormalizedEngineFact;
  readonly evaluation?: ContextualEvaluationResult;
}

/**
 * Reconciled query coverage metrics across the production Patch 3.7 dataset.
 */
export interface ProductionQueryMetrics {
  totalFacts: number;
  byEntity: Record<string, number>;
  byParameter: Record<string, number>;
  byCategory: Record<string, number>;
  byTarget: Record<string, number>;
  byElement: Record<string, number>;
  byConsumptionState: Record<string, number>;
  byParameterSafety: Record<string, number>;
}
