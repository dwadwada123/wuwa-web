/**
 * Wuthering Waves Gameplay Capability Resolution Types
 * Phase 7 Step 2: Capability Resolution & Applicability Engine
 *
 * Defines deterministic contracts for resolving whether capabilities are
 * applicable, missing context, mismatched, or unmodeled/unknown under a runtime context.
 *
 * CENTRAL INVARIANTS:
 * 1. PURE DOMAIN EVALUATION: Evaluator is pure, deterministic, and fails closed.
 * 2. KNOWN VALUE ≠ CONTEXT-FREE: Known numeric magnitude does not bypass runtime context.
 * 3. NO FABRICATED VALUES: Missing, mismatched, or unmodeled capabilities strictly return numericValue: null (never 0).
 * 4. FULL TRACEABILITY: CapabilityResolution retains source fact IDs, entity, and capabilityId.
 */

import type {
  GameplayCapability,
  CapabilityContextRequirementDimension,
  CapabilityRequiredContext
} from '../types.ts';
import type { RuntimeEvaluationContext } from '../../semantics/types.ts';


/**
 * Deterministic status explaining the resolution outcome.
 */
export type CapabilityResolutionStatus =
  | 'APPLICABLE' // Context fully satisfied (or context-free) with verified numeric value
  | 'MISSING_CONTEXT' // One or more required context dimensions were absent
  | 'CONTEXT_MISMATCH' // One or more supplied context dimensions conflicted with requirements
  | 'UNMODELED' // Unmodeled combat gauge / mechanic requiring external state machine
  | 'UNKNOWN' // Indeterminate semantics or value
  | 'NOT_APPLICABLE'; // Non-combat utility, flavor, or cross-patch effect

/**
 * Closed, strongly-typed reason codes explaining the deterministic resolution decision.
 */
export type CapabilityResolutionReason =
  | 'VALUE_KNOWN'
  | 'VALUE_UNKNOWN'
  | 'CONTEXT_FREE'
  | 'ELEMENT_REQUIRED'
  | 'ELEMENT_MISSING'
  | 'ELEMENT_MISMATCH'
  | 'ACTION_REQUIRED'
  | 'ACTION_MISSING'
  | 'ACTION_MISMATCH'
  | 'TRIGGER_REQUIRED'
  | 'TRIGGER_MISSING'
  | 'TRIGGER_MISMATCH'
  | 'ZONE_STATE_REQUIRED'
  | 'ZONE_STATE_MISSING'
  | 'ZONE_STATE_MISMATCH'
  | 'BUFF_STATE_REQUIRED'
  | 'BUFF_STATE_MISSING'
  | 'BUFF_STATE_MISMATCH'
  | 'STACK_REQUIRED'
  | 'STACK_MISSING'
  | 'STACK_MISMATCH'
  | 'REFINEMENT_REQUIRED'
  | 'REFINEMENT_MISSING'
  | 'REFINEMENT_MISMATCH'
  | 'CHARACTER_REQUIRED'
  | 'CHARACTER_MISMATCH'
  | 'UNMODELED_MECHANIC'
  | 'UNKNOWN_MECHANIC'
  | 'NOT_APPLICABLE'
  | 'CROSS_PATCH_REJECTED';

/**
 * Immutable resolution outcome for a single GameplayCapability under a RuntimeEvaluationContext.
 */
export interface CapabilityResolution {
  /** Identifier of the evaluated capability */
  readonly capabilityId: string;

  /** Resonator or source entity providing the capability */
  readonly entityId: string;

  /** Ability code, sequence node, or passive code */
  readonly sourceCode: string;

  /** Strictly '3.7' */
  readonly patchVersion: '3.7';

  /** Primary resolution status */
  readonly status: CapabilityResolutionStatus;

  /** True if and only if all requirements pass and numeric value can be safely applied */
  readonly applicable: boolean;

  /** Exact resolved numeric magnitude if applicable; strictly null otherwise (never 0) */
  readonly numericValue: number | null;

  /** Required context dimensions and values declared on the capability */
  readonly requiredContext: CapabilityRequiredContext | undefined;

  /** Context dimensions that were required but absent from supplied context */
  readonly missingDimensions: readonly CapabilityContextRequirementDimension[];

  /** Context dimensions that were supplied but conflicted with requirements */
  readonly mismatchedDimensions: readonly CapabilityContextRequirementDimension[];

  /** Deterministic explanation codes for the decision */
  readonly reasons: readonly CapabilityResolutionReason[];

  /** Exact canonical Phase 6C fact IDs backing this capability */
  readonly factIds: readonly string[];
}

/**
 * Multi-dimensional audit metrics for resolving the complete Patch 3.7 production dataset.
 */
export interface ProductionResolutionAuditMetrics {
  readonly totalCapabilities: number;
  readonly applicableWithoutContext: number;
  readonly requiresContext: number;
  readonly unmodeled: number;
  readonly unknown: number;
  readonly notApplicable: number;

  readonly byResolutionStatus: Readonly<Record<CapabilityResolutionStatus, number>>;
  readonly byRequirementDimension: Readonly<Record<CapabilityContextRequirementDimension, number>>;

  readonly elementBreakdown: {
    readonly noneCount: number;
    readonly allCount: number;
    readonly specificCount: number;
    readonly requiringElementCount: number;
  };

  readonly actionBreakdown: {
    readonly requiringActionCount: number;
  };

  readonly triggerBreakdown: {
    readonly requiringTriggerCount: number;
  };

  readonly stackBreakdown: {
    readonly requiringStackCount: number;
  };

  readonly refinementBreakdown: {
    readonly requiringRefinementCount: number;
  };

  readonly zeroContextResolutions: readonly CapabilityResolution[];
}
