/**
 * Wuthering Waves Deterministic Interaction Evidence Predicates & Applicability
 * Phase 7 Step 4: Deterministic Relationship Composition & Interaction Evidence Layer
 *
 * Provides deterministic predicates, sorting comparators, filter matching,
 * and applicability evaluation delegating to Phase 7 Step 2 resolution.
 *
 * PURE FUNCTIONS, ZERO LLM, ZERO NETWORK, DETERMINISTIC.
 */

import { resolveGameplayCapability } from '../../capabilities/resolution/resolver.ts';
import type { RuntimeEvaluationContext, GameplayCapability } from '../../capabilities/types.ts';
import type { GameplayRelationship } from '../types.ts';
import type {
  InteractionEvidence,
  InteractionEvidenceFilter,
  InteractionEvidenceApplicability
} from './types.ts';

/**
 * Authoritative predicate determining whether a GameplayRelationship explicitly targets a specific
 * target GameplayCapability.
 *
 * Pairwise InteractionEvidence may be generated ONLY when the approved Step 3 structured relationships
 * provide an explicit target linkage to the target capability or entity.
 *
 * Strictly forbids pairwise inference from shared actions, elements, or triggers alone.
 */
export function hasExplicitPairwiseTarget(
  sourceRelationship: GameplayRelationship,
  targetCapability: GameplayCapability
): boolean {
  if (sourceRelationship.patchVersion !== '3.7' || targetCapability.patchVersion !== '3.7') {
    return false;
  }

  const target = sourceRelationship.target;
  switch (target.kind) {
    case 'CAPABILITY':
      return target.capabilityId === targetCapability.capabilityId;
    case 'ENTITY':
      return target.entityId === targetCapability.entityId;
    default:
      // ACTION, ELEMENT, TARGET_CLASS (SELF/TEAM/ACTIVE), NEXT_RESONATOR, NONE
      // are dimensional/structural targets, NOT explicit pairwise linkages to a specific entity or capability.
      return false;
  }
}

/**
 * Type guard for Target Evidence.
 */
export function isTargetEvidence(evidence: InteractionEvidence): boolean {
  return evidence.evidenceType === 'TARGET_EVIDENCE';
}

/**
 * Type guard for Action Evidence.
 */
export function isActionEvidence(evidence: InteractionEvidence): boolean {
  return evidence.evidenceType === 'ACTION_EVIDENCE';
}

/**
 * Type guard for Element Evidence.
 */
export function isElementEvidence(evidence: InteractionEvidence): boolean {
  return evidence.evidenceType === 'ELEMENT_EVIDENCE';
}

/**
 * Type guard for Outro Evidence.
 */
export function isOutroEvidence(evidence: InteractionEvidence): boolean {
  return evidence.evidenceType === 'OUTRO_EVIDENCE';
}

/**
 * Type guard for Intro Evidence.
 */
export function isIntroEvidence(evidence: InteractionEvidence): boolean {
  return evidence.evidenceType === 'INTRO_EVIDENCE';
}

/**
 * Type guard for Next Resonator Evidence.
 */
export function isNextResonatorEvidence(evidence: InteractionEvidence): boolean {
  return evidence.evidenceType === 'NEXT_RESONATOR_EVIDENCE';
}

/**
 * Type guard for Coordinated Attack Evidence.
 */
export function isCoordinatedAttackEvidence(evidence: InteractionEvidence): boolean {
  return evidence.evidenceType === 'COORDINATED_ATTACK_EVIDENCE';
}

/**
 * Type guard for Resource Evidence.
 */
export function isResourceEvidence(evidence: InteractionEvidence): boolean {
  return evidence.evidenceType === 'RESOURCE_EVIDENCE';
}

/**
 * Type guard for Defensive Evidence.
 */
export function isDefensiveEvidence(evidence: InteractionEvidence): boolean {
  return evidence.evidenceType === 'DEFENSIVE_EVIDENCE';
}

/**
 * Type guard for Offensive Evidence.
 */
export function isOffensiveEvidence(evidence: InteractionEvidence): boolean {
  return evidence.evidenceType === 'OFFENSIVE_EVIDENCE';
}

/**
 * Type guard for Mechanical Evidence.
 */
export function isMechanicalEvidence(evidence: InteractionEvidence): boolean {
  return evidence.evidenceType === 'MECHANICAL_EVIDENCE';
}

/**
 * True if evidence represents a pairwise capability-to-capability interaction.
 */
export function isPairwiseEvidence(evidence: InteractionEvidence): boolean {
  return evidence.targetCapabilityId !== undefined;
}

/**
 * Deterministic canonical comparator for sorting InteractionEvidence records.
 * Stable across all environments.
 */
export function compareInteractionEvidence(a: InteractionEvidence, b: InteractionEvidence): number {
  const patchDiff = (a.patchVersion as string).localeCompare(b.patchVersion as string);
  if (patchDiff !== 0) {
    return patchDiff;
  }
  if (a.sourceEntityId !== b.sourceEntityId) {
    return a.sourceEntityId.localeCompare(b.sourceEntityId);
  }
  if (a.sourceCapabilityId !== b.sourceCapabilityId) {
    return a.sourceCapabilityId.localeCompare(b.sourceCapabilityId);
  }
  const targetA = a.targetCapabilityId ?? '';
  const targetB = b.targetCapabilityId ?? '';
  if (targetA !== targetB) {
    return targetA.localeCompare(targetB);
  }
  if (a.evidenceType !== b.evidenceType) {
    return a.evidenceType.localeCompare(b.evidenceType);
  }
  return a.id.localeCompare(b.id);
}

/**
 * Helper to match single value or array of values.
 */
function matchesValueOrArray<T>(fieldValue: T | undefined, filterValue: T | readonly T[] | undefined): boolean {
  if (filterValue === undefined) return true;
  if (fieldValue === undefined) return false;
  if (Array.isArray(filterValue)) {
    return filterValue.includes(fieldValue);
  }
  return fieldValue === filterValue;
}

/**
 * Evaluates whether an InteractionEvidence matches an InteractionEvidenceFilter.
 * AND logic across distinct filter dimensions; OR logic within array values.
 */
export function matchesInteractionEvidenceFilter(
  evidence: InteractionEvidence,
  filter?: InteractionEvidenceFilter
): boolean {
  if (!filter) return true;

  if (filter.patchVersion !== undefined && evidence.patchVersion !== filter.patchVersion) {
    return false;
  }

  if (!matchesValueOrArray(evidence.sourceEntityId, filter.sourceEntityId)) {
    return false;
  }

  if (!matchesValueOrArray(evidence.sourceCapabilityId, filter.sourceCapabilityId)) {
    return false;
  }

  if (filter.targetEntityId !== undefined) {
    if (!matchesValueOrArray(evidence.targetEntityId, filter.targetEntityId)) {
      return false;
    }
  }

  if (filter.targetCapabilityId !== undefined) {
    if (!matchesValueOrArray(evidence.targetCapabilityId, filter.targetCapabilityId)) {
      return false;
    }
  }

  if (!matchesValueOrArray(evidence.evidenceType, filter.evidenceType)) {
    return false;
  }

  if (!matchesValueOrArray(evidence.category, filter.category)) {
    return false;
  }

  if (filter.element !== undefined) {
    if (!matchesValueOrArray(evidence.element, filter.element)) {
      return false;
    }
  }

  if (filter.actionType !== undefined) {
    if (!matchesValueOrArray(evidence.actionType, filter.actionType)) {
      return false;
    }
  }

  if (!matchesValueOrArray(evidence.status, filter.status)) {
    return false;
  }

  if (filter.relationshipId !== undefined) {
    if (typeof filter.relationshipId === 'string') {
      if (!evidence.relationshipIds.includes(filter.relationshipId)) return false;
    } else {
      const hasMatch = filter.relationshipId.some((id) => evidence.relationshipIds.includes(id));
      if (!hasMatch) return false;
    }
  }

  if (filter.factId !== undefined) {
    if (typeof filter.factId === 'string') {
      if (!evidence.sourceFactIds.includes(filter.factId)) return false;
    } else {
      const hasMatch = filter.factId.some((id) => evidence.sourceFactIds.includes(id));
      if (!hasMatch) return false;
    }
  }

  if (filter.hasNumericValue !== undefined) {
    const hasNum = evidence.effectValue !== null;
    if (hasNum !== filter.hasNumericValue) {
      return false;
    }
  }

  if (filter.involvesNextResonator !== undefined) {
    const hasNext =
      evidence.evidenceType === 'NEXT_RESONATOR_EVIDENCE' ||
      evidence.dimensions.some((d) => d.kind === 'TARGET' && d.value === 'NEXT_RESONATOR');
    if (hasNext !== filter.involvesNextResonator) {
      return false;
    }
  }

  if (filter.involvesOutro !== undefined) {
    const hasOutro =
      evidence.evidenceType === 'OUTRO_EVIDENCE' ||
      evidence.dimensions.some((d) => d.kind === 'TRIGGER' && d.value === 'OUTRO');
    if (hasOutro !== filter.involvesOutro) {
      return false;
    }
  }

  if (filter.involvesIntro !== undefined) {
    const hasIntro =
      evidence.evidenceType === 'INTRO_EVIDENCE' ||
      evidence.dimensions.some((d) => d.kind === 'TRIGGER' && d.value === 'INTRO');
    if (hasIntro !== filter.involvesIntro) {
      return false;
    }
  }

  if (filter.involvesCoordinatedAttack !== undefined) {
    const hasCoord =
      evidence.evidenceType === 'COORDINATED_ATTACK_EVIDENCE' ||
      evidence.dimensions.some((d) => d.kind === 'ACTION' && d.value === 'COORDINATED');
    if (hasCoord !== filter.involvesCoordinatedAttack) {
      return false;
    }
  }

  if (filter.isPairwise !== undefined) {
    const pairwise = isPairwiseEvidence(evidence);
    if (pairwise !== filter.isPairwise) {
      return false;
    }
  }

  return true;
}

/**
 * Deterministically evaluates whether an InteractionEvidence is applicable under a runtime context.
 * Delegates 100% to Phase 7 Step 2 capability resolution. Zero duplicated runtime logic.
 */
export function isInteractionEvidenceApplicable(
  evidence: InteractionEvidence,
  context?: RuntimeEvaluationContext
): InteractionEvidenceApplicability {
  const sourceResolution = resolveGameplayCapability(evidence.sourceCapability, context);

  if (!sourceResolution.applicable) {
    return Object.freeze({
      isApplicable: false,
      status: sourceResolution.status,
      missingDimensions: sourceResolution.missingDimensions,
      mismatchedDimensions: sourceResolution.mismatchedDimensions,
      reasons: sourceResolution.reasons
    });
  }

  // If evidence links two capabilities, both must be applicable under the context
  if (evidence.targetCapability) {
    const targetResolution = resolveGameplayCapability(evidence.targetCapability, context);
    if (!targetResolution.applicable) {
      return Object.freeze({
        isApplicable: false,
        status: targetResolution.status,
        missingDimensions: targetResolution.missingDimensions,
        mismatchedDimensions: targetResolution.mismatchedDimensions,
        reasons: targetResolution.reasons
      });
    }
  }

  return Object.freeze({
    isApplicable: true,
    status: 'APPLICABLE',
    missingDimensions: Object.freeze([]),
    mismatchedDimensions: Object.freeze([]),
    reasons: sourceResolution.reasons
  });
}
