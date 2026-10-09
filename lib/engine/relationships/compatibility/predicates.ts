/**
 * Wuthering Waves Deterministic Compatibility Candidate Predicates & Applicability
 * Phase 7 Step 5: Deterministic Compatibility Candidate Contract & Evidence Qualification
 *
 * Provides deterministic predicates, sorting comparators, filter matching,
 * and applicability evaluation delegating to Phase 7 Step 2 resolution.
 *
 * PURE FUNCTIONS, ZERO LLM, ZERO NETWORK, DETERMINISTIC.
 */

import { resolveGameplayCapability } from '../../capabilities/resolution/resolver.ts';
import type { RuntimeEvaluationContext } from '../../capabilities/types.ts';
import type {
  CompatibilityCandidate,
  CompatibilityCandidateFilter,
  CandidateApplicabilityResult,
  CandidateMatchedDimension,
  CandidateQualificationType,
  CompatibilityCandidateStatus
} from './types.ts';

/**
 * Builds a deterministic canonical identifier for a CompatibilityCandidate record.
 * Same inputs -> same identifier.
 */
export function deriveCompatibilityCandidateId(
  patchVersion: string,
  sourceCapabilityId: string,
  targetCapabilityId: string,
  qualificationType: CandidateQualificationType,
  dimensions: readonly CandidateMatchedDimension[],
  evidenceIds: readonly string[]
): string {
  const dimKey = dimensions
    .map((d) => `${d.kind}:${d.value}`)
    .slice()
    .sort()
    .join(';');
  const eviKey = evidenceIds.slice().sort().join('+');
  return `cmp:${patchVersion}:${sourceCapabilityId}:${targetCapabilityId}:${qualificationType}:${dimKey}:${eviKey}`;
}

/**
 * Deterministic canonical comparator for sorting CompatibilityCandidate records.
 * Stable across all runtimes.
 */
export function compareCompatibilityCandidate(a: CompatibilityCandidate, b: CompatibilityCandidate): number {
  const patchDiff = (a.patchVersion as string).localeCompare(b.patchVersion as string);
  if (patchDiff !== 0) return patchDiff;

  if (a.sourceEntityId !== b.sourceEntityId) {
    return a.sourceEntityId.localeCompare(b.sourceEntityId);
  }
  if (a.targetEntityId !== b.targetEntityId) {
    return a.targetEntityId.localeCompare(b.targetEntityId);
  }
  if (a.sourceCapabilityId !== b.sourceCapabilityId) {
    return a.sourceCapabilityId.localeCompare(b.sourceCapabilityId);
  }
  if (a.targetCapabilityId !== b.targetCapabilityId) {
    return a.targetCapabilityId.localeCompare(b.targetCapabilityId);
  }
  if (a.qualificationType !== b.qualificationType) {
    return a.qualificationType.localeCompare(b.qualificationType);
  }
  return a.id.localeCompare(b.id);
}

/**
 * Type guard for Explicit Target Candidate.
 */
export function isExplicitTargetCandidate(c: CompatibilityCandidate): boolean {
  return c.qualificationType === 'EXPLICIT_TARGET_LINK';
}

/**
 * Type guard for Action Compatibility Candidate.
 */
export function isActionCompatibilityCandidate(c: CompatibilityCandidate): boolean {
  return c.qualificationType === 'ACTION_COMPATIBILITY_CANDIDATE';
}

/**
 * Type guard for Element Compatibility Candidate.
 */
export function isElementCompatibilityCandidate(c: CompatibilityCandidate): boolean {
  return c.qualificationType === 'ELEMENT_COMPATIBILITY_CANDIDATE';
}

/**
 * Type guard for Transition Compatibility Candidate.
 */
export function isTransitionCompatibilityCandidate(c: CompatibilityCandidate): boolean {
  return c.qualificationType === 'TRANSITION_COMPATIBILITY_CANDIDATE';
}

/**
 * Type guard for Target Scope Compatibility Candidate.
 */
export function isTargetScopeCompatibilityCandidate(c: CompatibilityCandidate): boolean {
  return c.qualificationType === 'TARGET_SCOPE_COMPATIBILITY_CANDIDATE';
}

/**
 * Type guard for Resource Compatibility Candidate.
 */
export function isResourceCompatibilityCandidate(c: CompatibilityCandidate): boolean {
  return c.qualificationType === 'RESOURCE_COMPATIBILITY_CANDIDATE';
}

/**
 * Type guard for Defensive Compatibility Candidate.
 */
export function isDefensiveCompatibilityCandidate(c: CompatibilityCandidate): boolean {
  return c.qualificationType === 'DEFENSIVE_COMPATIBILITY_CANDIDATE';
}

/**
 * Type guard for Offensive Compatibility Candidate.
 */
export function isOffensiveCompatibilityCandidate(c: CompatibilityCandidate): boolean {
  return c.qualificationType === 'OFFENSIVE_COMPATIBILITY_CANDIDATE';
}

/**
 * Type guard for Mechanical Compatibility Candidate.
 */
export function isMechanicalCompatibilityCandidate(c: CompatibilityCandidate): boolean {
  return c.qualificationType === 'MECHANICAL_COMPATIBILITY_CANDIDATE';
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
 * Evaluates whether a CompatibilityCandidate matches a CompatibilityCandidateFilter.
 * AND logic across distinct filter dimensions; OR logic within array values.
 */
export function matchesCompatibilityCandidateFilter(
  candidate: CompatibilityCandidate,
  filter?: CompatibilityCandidateFilter
): boolean {
  if (!filter) return true;

  if (filter.patchVersion !== undefined && candidate.patchVersion !== filter.patchVersion) {
    return false;
  }

  if (!matchesValueOrArray(candidate.sourceEntityId, filter.sourceEntityId)) {
    return false;
  }

  if (!matchesValueOrArray(candidate.targetEntityId, filter.targetEntityId)) {
    return false;
  }

  if (!matchesValueOrArray(candidate.sourceCapabilityId, filter.sourceCapabilityId)) {
    return false;
  }

  if (!matchesValueOrArray(candidate.targetCapabilityId, filter.targetCapabilityId)) {
    return false;
  }

  if (!matchesValueOrArray(candidate.qualificationType, filter.qualificationType)) {
    return false;
  }

  if (!matchesValueOrArray(candidate.qualificationNature, filter.qualificationNature)) {
    return false;
  }

  if (!matchesValueOrArray(candidate.directionality, filter.directionality)) {
    return false;
  }

  if (!matchesValueOrArray(candidate.status, filter.status)) {
    return false;
  }

  if (filter.matchedDimensionKind !== undefined) {
    const kinds = Array.isArray(filter.matchedDimensionKind)
      ? filter.matchedDimensionKind
      : [filter.matchedDimensionKind];
    const hasKind = kinds.some((k) => candidate.matchedDimensions.some((d) => d.kind === k));
    if (!hasKind) return false;
  }

  if (filter.element !== undefined) {
    const filterElems = Array.isArray(filter.element) ? filter.element : [filter.element];
    const hasElem = filterElems.some(
      (e) =>
        candidate.sourceCapability.element === e ||
        candidate.targetCapability.element === e ||
        candidate.matchedDimensions.some((d) => d.kind === 'ELEMENT' && d.value === e)
    );
    if (!hasElem) return false;
  }

  if (filter.actionType !== undefined) {
    const filterActs = Array.isArray(filter.actionType) ? filter.actionType : [filter.actionType];
    const hasAct = filterActs.some(
      (a) =>
        candidate.sourceCapability.actionType === a ||
        candidate.targetCapability.actionType === a ||
        candidate.matchedDimensions.some((d) => d.kind === 'ACTION' && d.value === a)
    );
    if (!hasAct) return false;
  }

  if (filter.involvesNextResonator !== undefined) {
    const hasNext =
      candidate.sourceCapability.target === 'NEXT_RESONATOR' ||
      candidate.matchedDimensions.some((d) => d.value === 'NEXT_RESONATOR');
    if (hasNext !== filter.involvesNextResonator) {
      return false;
    }
  }

  if (filter.involvesOutro !== undefined) {
    const hasOutro =
      candidate.qualificationType === 'TRANSITION_COMPATIBILITY_CANDIDATE' ||
      candidate.sourceCapability.actionType === 'OUTRO' ||
      candidate.matchedDimensions.some((d) => d.kind === 'TRANSITION' && d.value.includes('OUTRO'));
    if (hasOutro !== filter.involvesOutro) {
      return false;
    }
  }

  if (filter.involvesIntro !== undefined) {
    const hasIntro =
      candidate.targetCapability.actionType === 'INTRO' ||
      candidate.matchedDimensions.some((d) => d.kind === 'TRANSITION' && d.value.includes('INTRO'));
    if (hasIntro !== filter.involvesIntro) {
      return false;
    }
  }

  if (filter.involvesCoordinatedAttack !== undefined) {
    const hasCoord =
      candidate.qualificationType === 'MECHANICAL_COMPATIBILITY_CANDIDATE' ||
      candidate.matchedDimensions.some((d) => d.kind === 'ACTION' && d.value === 'COORDINATED');
    if (hasCoord !== filter.involvesCoordinatedAttack) {
      return false;
    }
  }

  if (filter.involvesUnmodeled !== undefined) {
    const hasUnmodeled = candidate.status === 'UNMODELED';
    if (hasUnmodeled !== filter.involvesUnmodeled) {
      return false;
    }
  }

  if (filter.evidenceId !== undefined) {
    if (typeof filter.evidenceId === 'string') {
      if (!candidate.evidenceIds.includes(filter.evidenceId)) return false;
    } else {
      const hasMatch = filter.evidenceId.some((id) => candidate.evidenceIds.includes(id));
      if (!hasMatch) return false;
    }
  }

  if (filter.relationshipId !== undefined) {
    if (typeof filter.relationshipId === 'string') {
      if (!candidate.relationshipIds.includes(filter.relationshipId)) return false;
    } else {
      const hasMatch = filter.relationshipId.some((id) => candidate.relationshipIds.includes(id));
      if (!hasMatch) return false;
    }
  }

  return true;
}

/**
 * Deterministically evaluates candidate applicability under runtime evaluation context.
 * Delegates 100% to Phase 7 Step 2 capability resolution. Zero duplicated runtime logic.
 */
export function evaluateCompatibilityCandidateApplicability(
  candidate: CompatibilityCandidate,
  context?: RuntimeEvaluationContext
): CandidateApplicabilityResult {
  const sourceResolution = resolveGameplayCapability(candidate.sourceCapability, context);
  const targetResolution = resolveGameplayCapability(candidate.targetCapability, context);

  const missingDimensions = Array.from(
    new Set([...sourceResolution.missingDimensions, ...targetResolution.missingDimensions])
  );
  const mismatchedDimensions = Array.from(
    new Set([...sourceResolution.mismatchedDimensions, ...targetResolution.mismatchedDimensions])
  );
  const reasons = Array.from(
    new Set([...sourceResolution.reasons, ...targetResolution.reasons])
  );

  let status: CompatibilityCandidateStatus;

  if (sourceResolution.status === 'UNKNOWN' || targetResolution.status === 'UNKNOWN') {
    status = 'UNKNOWN';
  } else if (sourceResolution.status === 'NOT_APPLICABLE' || targetResolution.status === 'NOT_APPLICABLE') {
    status = 'NOT_APPLICABLE';
  } else if (sourceResolution.status === 'UNMODELED' || targetResolution.status === 'UNMODELED') {
    status = 'UNMODELED';
  } else if (sourceResolution.status === 'MISSING_CONTEXT' || targetResolution.status === 'MISSING_CONTEXT') {
    status = 'MISSING_CONTEXT';
  } else if (sourceResolution.status === 'CONTEXT_MISMATCH' || targetResolution.status === 'CONTEXT_MISMATCH') {
    status = 'CONTEXT_MISMATCH';
  } else if (sourceResolution.applicable && targetResolution.applicable) {
    if (candidate.sourceCapability.isStatic && candidate.targetCapability.isStatic) {
      status = 'STRUCTURALLY_ELIGIBLE';
    } else {
      status = 'CONTEXTUALLY_ELIGIBLE';
    }
  } else {
    status = 'NOT_APPLICABLE';
  }

  const isApplicable = sourceResolution.applicable && targetResolution.applicable;

  return Object.freeze({
    isApplicable,
    status,
    sourceResolution,
    targetResolution,
    missingDimensions: Object.freeze(missingDimensions),
    mismatchedDimensions: Object.freeze(mismatchedDimensions),
    reasons: Object.freeze(reasons)
  });
}
