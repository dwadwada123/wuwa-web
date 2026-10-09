/**
 * Wuthering Waves Contextual Engine Consumption Types
 * Phase 6C Step 5: Contextual Engine Consumption Contract
 *
 * Defines deterministic, strictly typed runtime evaluation contracts for NormalizedEngineFacts.
 * Central Invariant: Evaluator fails closed; missing/mismatched context NEVER produces numeric 0.
 */

import type {
  SemanticUnit,
  SemanticDuration,
  SemanticStacking,
  SourceReference,
  ExtractionProvenance,
  SemanticRefinementRank,
  SemanticTarget
} from '../../../domain/types/semantics.ts';
import type { Element } from '../../../domain/types/common.ts';
import type {
  RuntimeEvaluationContext,
  ParameterSafetyClassification,
  EngineSemanticSafetyStatus
} from '../../semantics/types.ts';
import type { NormalizedEngineFact } from '../types.ts';

export type { RuntimeEvaluationContext };

/**
 * Contextual evaluation state distinguishing static vs contextual vs unmodeled facts.
 */
export type ContextualEvaluationState =
  | 'STATIC' // Evaluated statically without requiring runtime action/trigger context
  | 'CONTEXTUAL' // Requires runtime context; either satisfied or awaiting context
  | 'UNMODELED' // Complex mechanic requiring unmodeled combat system (Forte, coordinated attack)
  | 'UNKNOWN' // Indeterminate semantics or value
  | 'NOT_APPLICABLE'; // Non-combat utility or cross-patch effect

/**
 * Deterministic machine-readable reason codes explaining evaluation outcome.
 */
export type ContextualEvaluationReason =
  | 'STATIC_ELIGIBLE' // Fact is statically eligible; consumed context-free
  | 'CONTEXT_SATISFIED' // Contextually consumable: all action/trigger/state/rank conditions met
  | 'MISSING_ACTION' // Contextual damage parameter missing required actionType
  | 'MISMATCHED_ACTION' // Action type in context does not match required action
  | 'MISSING_TRIGGER' // Trigger condition missing from context
  | 'MISMATCHED_TRIGGER' // Trigger in context does not match required trigger
  | 'MISSING_ZONE_STATE' // Zone condition missing from context
  | 'MISMATCHED_ZONE_STATE' // Zone condition required active zone, context was false
  | 'MISSING_BUFF_STATE' // Buff condition missing from context
  | 'MISMATCHED_BUFF_STATE' // Buff condition required active buff, context was false
  | 'MISSING_STACK_COUNT' // Stack condition or stacking requirement missing from context
  | 'INSUFFICIENT_STACKS' // Stack count in context below required threshold
  | 'MISMATCHED_STACK_COUNT' // Exact stack condition does not match supplied stack count
  | 'UNRESOLVED_STACK_SEMANTICS' // Stack condition lacks explicit operator or semantics
  | 'UNRESOLVED_STACK_SCALING' // Stack scaling behavior cannot be deterministically evaluated
  | 'MISSING_REFINEMENT_RANK' // MULTI_RANK value missing refinementRank in context
  | 'INVALID_REFINEMENT_RANK' // Requested rank not found in MULTI_RANK definition
  | 'UNRESOLVED_RAW_CONDITION' // Raw condition prose cannot be deterministically evaluated
  | 'UNKNOWN_CONDITION_FIELD' // Unknown/unmodeled field on condition object
  | 'MISMATCHED_CHARACTER' // Active character does not match entityId for SELF target
  | 'MISMATCHED_TARGET' // Target context does not match effect target
  | 'MISSING_ELEMENT' // Required element context missing for element-specific fact
  | 'MISMATCHED_ELEMENT' // Element context does not match effect element
  | 'UNMODELED_PARAMETER' // Parameter is CURRENTLY_UNMODELED (Forte gauge, coordinated attacks)
  | 'UNKNOWN_SEMANTICS' // Fact semantic status is UNKNOWN
  | 'NON_COMBAT_UTILITY' // Fact semantic status is NOT_APPLICABLE
  | 'CROSS_PATCH_REJECTED' // Fact patchVersion is not '3.7'
  | 'INVALID_PROVENANCE' // Provenance reference missing or invalid
  | 'NON_FINITE_NUMERIC'; // Numeric value is NaN or Infinity

/**
 * Structured summary of context required by a contextual fact.
 */
export interface RequiredContextSummary {
  actionType?: string;
  trigger?: string;
  zoneActive?: boolean;
  buffActive?: boolean;
  stackCount?: number;
  refinementRank?: boolean;
  activeCharacterId?: string;
  target?: SemanticTarget;
  element?: Element | 'All';
}

/**
 * Pure, deterministic evaluation result for an engine fact under a specific runtime context.
 */
export interface ContextualEvaluationResult {
  /** Stable canonical fact identifier matching source NormalizedEngineFact */
  factId: string;
  entityId: string;
  sourceCode: string;
  patchVersion: string;
  state: ContextualEvaluationState;
  /** True if and only if numericValue is a finite number and all safety boundaries pass */
  consumable: boolean;
  /** Exact numeric magnitude if consumable; strictly null otherwise (never 0) */
  numericValue: number | null;
  unit: SemanticUnit | null;
  reason: ContextualEvaluationReason;
  /** Summary of contextual dimensions required if state is CONTEXTUAL */
  requiredContext?: RequiredContextSummary;
  /** Resolved refinement rank if this evaluation resolved a MULTI_RANK value */
  resolvedRank?: SemanticRefinementRank;
  duration?: SemanticDuration;
  stacking?: SemanticStacking;
  provenance: SourceReference;
  extraction: ExtractionProvenance;
}

/**
 * Production audit metrics for evaluating all 292 Patch 3.7 facts.
 */
export interface ProductionContextualAuditMetrics {
  totalFacts: number;
  zeroContextAudit: {
    staticConsumable: number;
    contextualPending: number;
    unmodeled: number;
    unknown: number;
    notApplicable: number;
    numericOutputs: number;
    nullOutputs: number;
  };
  representativeContextAudit: {
    totalEvaluated: number;
    successfullyResolved: number;
    stillUnresolved: number;
    unmodeled: number;
    numericOutputs: number;
    nullOutputs: number;
  };
  byReasonZeroContext: Record<string, number>;
  crossPatchRejected: number;
  invalidProvenanceRejected: number;
}
