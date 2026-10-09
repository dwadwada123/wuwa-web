/**
 * Wuthering Waves Character Relationship Predicates & Ordering
 * Phase 7 Step 17: Deterministic Character Relationship Composition & Interaction Evidence Contract
 *
 * Implements deterministic ID derivation, status type guards, sorting comparators,
 * and filter predicates.
 */

import { CHARACTER_INTERACTION_RULE_VERSION } from './rules.ts';
import type {
  CharacterInteractionEvidence,
  CharacterInteractionCondition,
  CharacterInteractionFilter,
  CharacterInteractionType
} from './types.ts';

/**
 * Deterministically canonicalizes an array of strings in ascending lexicographical order.
 */
export function canonicalSortStrings(items: readonly string[]): readonly string[] {
  return Object.freeze(items.slice().sort((a, b) => a.localeCompare(b)));
}

/**
 * Builds a deterministic canonical key representing an interaction's condition.
 * Returns 'UNIVERSAL' when no condition is attached.
 */
export function deriveConditionKey(condition?: CharacterInteractionCondition): string {
  if (!condition) {
    return 'UNIVERSAL';
  }

  const parts: string[] = [];
  if (condition.elementRequirement) parts.push(`elem:${condition.elementRequirement}`);
  if (condition.actionTypeRequirement) parts.push(`act:${condition.actionTypeRequirement}`);
  if (condition.parameterRequirement) parts.push(`param:${condition.parameterRequirement}`);
  if (condition.sequenceRequirement !== undefined) parts.push(`seq:${condition.sequenceRequirement}`);
  if (condition.stateRequirement) parts.push(`state:${condition.stateRequirement}`);

  if (parts.length === 0 && condition.conditionDescription) {
    parts.push(`desc:${condition.conditionDescription}`);
  }

  return parts.length > 0 ? parts.sort().join('|') : 'UNIVERSAL';
}

/**
 * Derives a deterministic canonical identifier for a character interaction evidence record.
 */
export function deriveCharacterInteractionId(
  sourceChar: string,
  targetChar: string,
  interactionType: CharacterInteractionType,
  conditionKey: string,
  ruleVersion: string = CHARACTER_INTERACTION_RULE_VERSION
): string {
  return `char-interaction:3.7:${sourceChar}:${targetChar}:${interactionType}:${conditionKey}:${ruleVersion}`;
}

/**
 * Type guard for AUTHORITATIVE status.
 */
export function isInteractionAuthoritative(rec: CharacterInteractionEvidence): boolean {
  return rec.evidenceStatus === 'AUTHORITATIVE';
}

/**
 * Type guard for UNKNOWN status.
 */
export function isInteractionUnknown(rec: CharacterInteractionEvidence): boolean {
  return rec.evidenceStatus === 'UNKNOWN';
}

/**
 * Type guard for UNMODELED status.
 */
export function isInteractionUnmodeled(rec: CharacterInteractionEvidence): boolean {
  return rec.evidenceStatus === 'UNMODELED';
}

/**
 * Type guard for NOT_APPLICABLE status.
 */
export function isInteractionNotApplicable(rec: CharacterInteractionEvidence): boolean {
  return rec.evidenceStatus === 'NOT_APPLICABLE';
}

/**
 * Type guard for CONFLICTED status.
 */
export function isInteractionConflicted(rec: CharacterInteractionEvidence): boolean {
  return rec.evidenceStatus === 'CONFLICTED';
}

/**
 * Deterministic total ordering comparator for CharacterInteractionEvidence records.
 * Order:
 * 1. patchVersion
 * 2. sourceCharacterId
 * 3. targetCharacterId
 * 4. interactionType
 * 5. conditionKey
 * 6. evidenceStatus
 * 7. id
 */
export function compareCharacterInteractionEvidence(
  a: CharacterInteractionEvidence,
  b: CharacterInteractionEvidence
): number {
  if (String(a.patchVersion) !== String(b.patchVersion)) {
    return String(a.patchVersion).localeCompare(String(b.patchVersion));
  }
  if (a.sourceCharacterId !== b.sourceCharacterId) {
    return a.sourceCharacterId.localeCompare(b.sourceCharacterId);
  }
  if (a.targetCharacterId !== b.targetCharacterId) {
    return a.targetCharacterId.localeCompare(b.targetCharacterId);
  }
  if (a.interactionType !== b.interactionType) {
    return a.interactionType.localeCompare(b.interactionType);
  }

  const condA = deriveConditionKey(a.condition);
  const condB = deriveConditionKey(b.condition);
  if (condA !== condB) {
    return condA.localeCompare(condB);
  }

  if (a.evidenceStatus !== b.evidenceStatus) {
    return a.evidenceStatus.localeCompare(b.evidenceStatus);
  }

  return a.id.localeCompare(b.id);
}

/**
 * Evaluates whether an interaction record matches a multi-dimensional filter.
 */
export function matchesCharacterInteractionFilter(
  rec: CharacterInteractionEvidence,
  filter?: CharacterInteractionFilter
): boolean {
  if (!filter) return true;

  if (filter.patchVersion && rec.patchVersion !== filter.patchVersion) return false;
  if (filter.sourceCharacterId && rec.sourceCharacterId !== filter.sourceCharacterId) return false;
  if (filter.targetCharacterId && rec.targetCharacterId !== filter.targetCharacterId) return false;

  if (filter.resonatorId) {
    if (rec.sourceCharacterId !== filter.resonatorId && rec.targetCharacterId !== filter.resonatorId) {
      return false;
    }
  }

  if (filter.interactionType && rec.interactionType !== filter.interactionType) return false;
  if (filter.category && rec.category !== filter.category) return false;
  if (filter.evidenceStatus && rec.evidenceStatus !== filter.evidenceStatus) return false;

  if (filter.hasCondition !== undefined) {
    const hasCond = deriveConditionKey(rec.condition) !== 'UNIVERSAL';
    if (hasCond !== filter.hasCondition) return false;
  }

  return true;
}
