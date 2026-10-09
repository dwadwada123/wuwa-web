/**
 * Wuthering Waves Capability Resolution Engine
 * Phase 7 Step 2: Capability Resolution & Applicability Engine
 *
 * Implements deterministic evaluation of GameplayCapability against RuntimeEvaluationContext.
 * PURE FUNCTION, ZERO NETWORK, ZERO LLM, FAIL-CLOSED, DETERMINISTIC.
 *
 * CENTRAL INVARIANTS:
 * 1. KNOWN NUMERIC VALUE ≠ CONTEXT-FREE: Known numeric magnitude does not bypass runtime context.
 * 2. MISSING CONTEXT ≠ MISMATCHED CONTEXT: Explicitly segregates missing from conflicting dimensions.
 * 3. NO FABRICATION: Missing, mismatched, or unmodeled capabilities strictly return numericValue: null (never 0).
 * 4. PURE & IMMUTABLE: Zero mutation of input capabilities or contexts.
 */

import type {
  GameplayCapability,
  CapabilityContextRequirementDimension
} from '../types.ts';
import type { RuntimeEvaluationContext } from '../../semantics/types.ts';
import type {
  CapabilityResolution,
  CapabilityResolutionStatus,
  CapabilityResolutionReason
} from './types.ts';

const VALID_ELEMENTS = new Set(['Glacio', 'Fusion', 'Electro', 'Aero', 'Spectro', 'Havoc', 'All']);
const VALID_REFINEMENT_RANKS = new Set(['R1', 'R2', 'R3', 'R4', 'R5']);

/**
 * Resolves a single GameplayCapability against a runtime evaluation context.
 * Pure, synchronous, side-effect free, and fail-closed.
 */
export function resolveGameplayCapability(
  capability: GameplayCapability,
  context?: RuntimeEvaluationContext
): CapabilityResolution {
  // Step A: Patch Isolation (strictly Patch 3.7)
  if (capability.patchVersion !== '3.7') {
    return Object.freeze({
      capabilityId: capability.capabilityId,
      entityId: capability.entityId,
      sourceCode: capability.sourceCode,
      patchVersion: '3.7',
      status: 'NOT_APPLICABLE' as CapabilityResolutionStatus,
      applicable: false,
      numericValue: null,
      requiredContext: capability.requiredContext,
      missingDimensions: Object.freeze([]),
      mismatchedDimensions: Object.freeze([]),
      reasons: Object.freeze(['CROSS_PATCH_REJECTED' as CapabilityResolutionReason, 'NOT_APPLICABLE' as CapabilityResolutionReason]),
      factIds: capability.factIds
    });
  }

  // Step B: Epistemological Status Checks
  if (capability.status === 'UNMODELED') {
    return Object.freeze({
      capabilityId: capability.capabilityId,
      entityId: capability.entityId,
      sourceCode: capability.sourceCode,
      patchVersion: '3.7',
      status: 'UNMODELED' as CapabilityResolutionStatus,
      applicable: false,
      numericValue: null,
      requiredContext: capability.requiredContext,
      missingDimensions: Object.freeze([]),
      mismatchedDimensions: Object.freeze([]),
      reasons: Object.freeze(['UNMODELED_MECHANIC' as CapabilityResolutionReason, 'VALUE_UNKNOWN' as CapabilityResolutionReason]),
      factIds: capability.factIds
    });
  }

  if (capability.status === 'UNKNOWN') {
    return Object.freeze({
      capabilityId: capability.capabilityId,
      entityId: capability.entityId,
      sourceCode: capability.sourceCode,
      patchVersion: '3.7',
      status: 'UNKNOWN' as CapabilityResolutionStatus,
      applicable: false,
      numericValue: null,
      requiredContext: capability.requiredContext,
      missingDimensions: Object.freeze([]),
      mismatchedDimensions: Object.freeze([]),
      reasons: Object.freeze(['UNKNOWN_MECHANIC' as CapabilityResolutionReason, 'VALUE_UNKNOWN' as CapabilityResolutionReason]),
      factIds: capability.factIds
    });
  }

  if (capability.status === 'NOT_APPLICABLE') {
    return Object.freeze({
      capabilityId: capability.capabilityId,
      entityId: capability.entityId,
      sourceCode: capability.sourceCode,
      patchVersion: '3.7',
      status: 'NOT_APPLICABLE' as CapabilityResolutionStatus,
      applicable: false,
      numericValue: null,
      requiredContext: capability.requiredContext,
      missingDimensions: Object.freeze([]),
      mismatchedDimensions: Object.freeze([]),
      reasons: Object.freeze(['NOT_APPLICABLE' as CapabilityResolutionReason]),
      factIds: capability.factIds
    });
  }

  // Step C: Numeric Value Known Validation
  if (!capability.isNumericValueKnown || capability.numericValue === null) {
    return Object.freeze({
      capabilityId: capability.capabilityId,
      entityId: capability.entityId,
      sourceCode: capability.sourceCode,
      patchVersion: '3.7',
      status: 'UNKNOWN' as CapabilityResolutionStatus,
      applicable: false,
      numericValue: null,
      requiredContext: capability.requiredContext,
      missingDimensions: Object.freeze([]),
      mismatchedDimensions: Object.freeze([]),
      reasons: Object.freeze(['VALUE_UNKNOWN' as CapabilityResolutionReason]),
      factIds: capability.factIds
    });
  }

  // Step D: Context-Free Resolution
  if (capability.isContextFree) {
    // Check character mismatch if SELF target and activeCharacterId provided
    if (
      capability.target === 'SELF' &&
      context?.activeCharacterId &&
      context.activeCharacterId !== capability.entityId
    ) {
      return Object.freeze({
        capabilityId: capability.capabilityId,
        entityId: capability.entityId,
        sourceCode: capability.sourceCode,
        patchVersion: '3.7',
        status: 'CONTEXT_MISMATCH' as CapabilityResolutionStatus,
        applicable: false,
        numericValue: null,
        requiredContext: capability.requiredContext,
        missingDimensions: Object.freeze([]),
        mismatchedDimensions: Object.freeze([]),
        reasons: Object.freeze([
          'CHARACTER_REQUIRED' as CapabilityResolutionReason,
          'CHARACTER_MISMATCH' as CapabilityResolutionReason
        ]),
        factIds: capability.factIds
      });
    }

    // Check invalid element context if element is All
    if (capability.element === 'All' && context?.element && !VALID_ELEMENTS.has(context.element)) {
      return Object.freeze({
        capabilityId: capability.capabilityId,
        entityId: capability.entityId,
        sourceCode: capability.sourceCode,
        patchVersion: '3.7',
        status: 'CONTEXT_MISMATCH' as CapabilityResolutionStatus,
        applicable: false,
        numericValue: null,
        requiredContext: capability.requiredContext,
        missingDimensions: Object.freeze([]),
        mismatchedDimensions: Object.freeze(['ELEMENT' as CapabilityContextRequirementDimension]),
        reasons: Object.freeze([
          'ELEMENT_MISMATCH' as CapabilityResolutionReason
        ]),
        factIds: capability.factIds
      });
    }

    return Object.freeze({
      capabilityId: capability.capabilityId,
      entityId: capability.entityId,
      sourceCode: capability.sourceCode,
      patchVersion: '3.7',
      status: 'APPLICABLE' as CapabilityResolutionStatus,
      applicable: true,
      numericValue: capability.numericValue,
      requiredContext: capability.requiredContext,
      missingDimensions: Object.freeze([]),
      mismatchedDimensions: Object.freeze([]),
      reasons: Object.freeze([
        'CONTEXT_FREE' as CapabilityResolutionReason,
        'VALUE_KNOWN' as CapabilityResolutionReason
      ]),
      factIds: capability.factIds
    });
  }

  // Step E: Multi-Dimensional Context Evaluation
  const missingDimensions: CapabilityContextRequirementDimension[] = [];
  const mismatchedDimensions: CapabilityContextRequirementDimension[] = [];
  const reasons: CapabilityResolutionReason[] = [];

  // 1. Element Requirement
  if (capability.requiresElement) {
    reasons.push('ELEMENT_REQUIRED');
    if (!context || context.element === undefined) {
      missingDimensions.push('ELEMENT');
      reasons.push('ELEMENT_MISSING');
    } else {
      const requiredElement =
        capability.requiredContext?.element ??
        (capability.element !== 'NONE' && capability.element !== 'All' ? capability.element : undefined);
      if (context.element !== requiredElement) {
        mismatchedDimensions.push('ELEMENT');
        reasons.push('ELEMENT_MISMATCH');
      }
    }
  } else if (capability.element === 'All' && context?.element) {
    if (!VALID_ELEMENTS.has(context.element)) {
      mismatchedDimensions.push('ELEMENT');
      reasons.push('ELEMENT_MISMATCH');
    }
  }

  // 2. Action Requirement
  if (capability.requiresAction) {
    reasons.push('ACTION_REQUIRED');
    if (!context || context.actionType === undefined) {
      missingDimensions.push('ACTION');
      reasons.push('ACTION_MISSING');
    } else {
      const reqAction = capability.requiredContext?.actionType ?? capability.actionType;
      if (reqAction && reqAction !== 'ANY_ACTION' && context.actionType !== reqAction) {
        mismatchedDimensions.push('ACTION');
        reasons.push('ACTION_MISMATCH');
      }
    }
  }

  // 3. Trigger Requirement
  if (capability.requiresTrigger) {
    reasons.push('TRIGGER_REQUIRED');
    if (!context || context.trigger === undefined) {
      missingDimensions.push('TRIGGER');
      reasons.push('TRIGGER_MISSING');
    } else {
      const reqTrigger = capability.requiredContext?.trigger ?? capability.conditions?.trigger;
      if (reqTrigger && context.trigger !== reqTrigger) {
        mismatchedDimensions.push('TRIGGER');
        reasons.push('TRIGGER_MISMATCH');
      }
    }
  }

  // 4. Zone State Requirement
  if (capability.requiresZone) {
    reasons.push('ZONE_STATE_REQUIRED');
    if (!context || context.zoneActive === undefined) {
      missingDimensions.push('ZONE_STATE');
      reasons.push('ZONE_STATE_MISSING');
    } else {
      const reqZone = capability.requiredContext?.zoneActive ?? capability.conditions?.zoneActive ?? true;
      if (reqZone !== undefined && context.zoneActive !== reqZone) {
        mismatchedDimensions.push('ZONE_STATE');
        reasons.push('ZONE_STATE_MISMATCH');
      }
    }
  }

  // 5. Buff State Requirement
  if (capability.requiresBuff) {
    reasons.push('BUFF_STATE_REQUIRED');
    if (!context || context.buffActive === undefined) {
      missingDimensions.push('BUFF_STATE');
      reasons.push('BUFF_STATE_MISSING');
    } else {
      const reqBuff = capability.requiredContext?.buffActive ?? capability.conditions?.buffActive ?? true;
      if (reqBuff !== undefined && context.buffActive !== reqBuff) {
        mismatchedDimensions.push('BUFF_STATE');
        reasons.push('BUFF_STATE_MISMATCH');
      }
    }
  }

  // 6. Stack Count Requirement
  if (capability.requiresStack) {
    reasons.push('STACK_REQUIRED');

    // Ambiguous or unresolved stack conditions fail closed
    if (
      capability.conditions?.rawCondition &&
      capability.conditions.rawCondition.trim().length > 0 &&
      !capability.conditions.stackOperator
    ) {
      return Object.freeze({
        capabilityId: capability.capabilityId,
        entityId: capability.entityId,
        sourceCode: capability.sourceCode,
        patchVersion: '3.7',
        status: 'UNMODELED' as CapabilityResolutionStatus,
        applicable: false,
        numericValue: null,
        requiredContext: capability.requiredContext,
        missingDimensions: Object.freeze([]),
        mismatchedDimensions: Object.freeze([]),
        reasons: Object.freeze(['UNMODELED_MECHANIC' as CapabilityResolutionReason, 'VALUE_UNKNOWN' as CapabilityResolutionReason]),
        factIds: capability.factIds
      });
    }

    if (!context || context.stackCount === undefined) {
      missingDimensions.push('STACK_COUNT');
      reasons.push('STACK_MISSING');
    } else if (typeof context.stackCount !== 'number' || !Number.isFinite(context.stackCount) || context.stackCount < 0) {
      mismatchedDimensions.push('STACK_COUNT');
      reasons.push('STACK_MISMATCH');
    } else {
      const reqStacks = capability.requiredContext?.stackCount ?? capability.conditions?.stackCount;
      const op = capability.requiredContext?.stackOperator ?? capability.conditions?.stackOperator;

      if (op === 'EXACT') {
        if (reqStacks !== undefined && context.stackCount !== reqStacks) {
          mismatchedDimensions.push('STACK_COUNT');
          reasons.push('STACK_MISMATCH');
        }
      } else if (op === 'AT_LEAST') {
        if (reqStacks !== undefined && context.stackCount < reqStacks) {
          mismatchedDimensions.push('STACK_COUNT');
          reasons.push('STACK_MISMATCH');
        }
      } else {
        // Unsupported PER_STACK or missing operator fails closed as UNMODELED
        return Object.freeze({
          capabilityId: capability.capabilityId,
          entityId: capability.entityId,
          sourceCode: capability.sourceCode,
          patchVersion: '3.7',
          status: 'UNMODELED' as CapabilityResolutionStatus,
          applicable: false,
          numericValue: null,
          requiredContext: capability.requiredContext,
          missingDimensions: Object.freeze([]),
          mismatchedDimensions: Object.freeze([]),
          reasons: Object.freeze(['UNMODELED_MECHANIC' as CapabilityResolutionReason, 'VALUE_UNKNOWN' as CapabilityResolutionReason]),
          factIds: capability.factIds
        });
      }
    }
  }

  // 7. Refinement Rank Requirement
  if (capability.requiresRefinement) {
    reasons.push('REFINEMENT_REQUIRED');
    if (!context || context.refinementRank === undefined) {
      missingDimensions.push('REFINEMENT_RANK');
      reasons.push('REFINEMENT_MISSING');
    } else {
      const targetRank = capability.refinementRank;
      if (!VALID_REFINEMENT_RANKS.has(context.refinementRank)) {
        mismatchedDimensions.push('REFINEMENT_RANK');
        reasons.push('REFINEMENT_MISMATCH');
      } else if (targetRank && context.refinementRank !== targetRank) {
        mismatchedDimensions.push('REFINEMENT_RANK');
        reasons.push('REFINEMENT_MISMATCH');
      }
    }
  }

  // 8. Character Identity Check for SELF effects
  let isCharacterMismatch = false;
  if (capability.target === 'SELF' && context?.activeCharacterId) {
    if (context.activeCharacterId !== capability.entityId) {
      isCharacterMismatch = true;
      reasons.push('CHARACTER_REQUIRED', 'CHARACTER_MISMATCH');
    }
  }

  // Final Status Derivation
  let status: CapabilityResolutionStatus;
  let applicable = false;
  let numericValue: number | null = null;

  if (mismatchedDimensions.length > 0 || isCharacterMismatch) {
    status = 'CONTEXT_MISMATCH';
  } else if (missingDimensions.length > 0) {
    status = 'MISSING_CONTEXT';
  } else {
    status = 'APPLICABLE';
    applicable = true;
    numericValue = capability.numericValue;
    reasons.push('VALUE_KNOWN');
  }

  return Object.freeze({
    capabilityId: capability.capabilityId,
    entityId: capability.entityId,
    sourceCode: capability.sourceCode,
    patchVersion: '3.7',
    status,
    applicable,
    numericValue,
    requiredContext: capability.requiredContext,
    missingDimensions: Object.freeze(missingDimensions),
    mismatchedDimensions: Object.freeze(mismatchedDimensions),
    reasons: Object.freeze(reasons),
    factIds: capability.factIds
  });
}

/**
 * Resolves a collection of GameplayCapabilities against a runtime evaluation context.
 * Pure, deterministic, preserves ordering, and rejects cross-patch mixing.
 */
export function resolveGameplayCapabilities(
  capabilities: readonly GameplayCapability[],
  context?: RuntimeEvaluationContext
): readonly CapabilityResolution[] {
  if (!Array.isArray(capabilities)) {
    throw new Error('resolveGameplayCapabilities requires a valid array of GameplayCapability.');
  }

  return Object.freeze(
    capabilities.map((cap) => resolveGameplayCapability(cap, context))
  );
}

/**
 * Convenience helper returning strictly the immediately applicable capabilities.
 * Preserves input ordering; contains zero scoring, weighting, or ranking.
 */
export function resolveConsumableCapabilities(
  capabilities: readonly GameplayCapability[],
  context?: RuntimeEvaluationContext
): readonly CapabilityResolution[] {
  const allResolved = resolveGameplayCapabilities(capabilities, context);
  return Object.freeze(allResolved.filter((r) => r.applicable));
}
