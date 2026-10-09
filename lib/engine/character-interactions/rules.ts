/**
 * Wuthering Waves Character Relationship Composition Rules & Constants
 * Phase 7 Step 17: Deterministic Character Relationship Composition & Interaction Evidence Contract
 *
 * Implements deterministic constants, taxonomies, reason codes, and provenance factories.
 */

import type {
  CharacterInteractionType,
  CharacterInteractionCategory,
  CharacterInteractionStatus,
  SourceReference
} from './types.ts';

/**
 * Authoritative Step 17 Contract Rule Version.
 */
export const CHARACTER_INTERACTION_RULE_VERSION = '7.17.1' as const;

/**
 * Closed list of valid character interaction types.
 */
export const VALID_CHARACTER_INTERACTION_TYPES: readonly CharacterInteractionType[] = Object.freeze([
  'OUTRO_INTRO_HANDOFF',
  'DAMAGE_AMPLIFICATION',
  'ATTRIBUTE_AMPLIFICATION',
  'ACTION_AMPLIFICATION',
  'DEFENSE_REDUCTION',
  'RESISTANCE_REDUCTION',
  'HEALING_SUPPORT',
  'SHIELD_SUPPORT',
  'RESOURCE_GENERATION',
  'COORDINATED_ATTACK',
  'ELEMENTAL_SYNERGY',
  'MECHANICAL_TRIGGER',
  'SEQUENCE_DEPENDENT_INTERACTION'
]);

/**
 * Closed list of valid character interaction categories.
 */
export const VALID_CHARACTER_INTERACTION_CATEGORIES: readonly CharacterInteractionCategory[] = Object.freeze([
  'OFFENSIVE',
  'DEFENSIVE',
  'UTILITY',
  'RESOURCE',
  'ELEMENTAL',
  'TRANSITION',
  'TRIGGER',
  'MECHANICAL'
]);

/**
 * Closed list of valid character interaction statuses.
 */
export const VALID_CHARACTER_INTERACTION_STATUSES: readonly CharacterInteractionStatus[] = Object.freeze([
  'AUTHORITATIVE',
  'UNKNOWN',
  'UNMODELED',
  'NOT_APPLICABLE',
  'CONFLICTED'
]);

/**
 * Deterministic reason codes explaining interaction composition decisions.
 */
export const INTERACTION_REASON_CODES = Object.freeze({
  APPROVED_EVIDENCE_COMPOSED: 'APPROVED_EVIDENCE_COMPOSED',
  DIRECTIONAL_PAIR_PRESERVED: 'DIRECTIONAL_PAIR_PRESERVED',
  CONDITION_PRESERVED: 'CONDITION_PRESERVED',
  CONFLICT_DETECTED: 'CONFLICT_DETECTED',
  UNKNOWN_PRESERVED: 'UNKNOWN_PRESERVED',
  UNMODELED_PRESERVED: 'UNMODELED_PRESERVED',
  NOT_APPLICABLE_PRESERVED: 'NOT_APPLICABLE_PRESERVED',
  DEDUPLICATED: 'DEDUPLICATED',
  SEQUENCE_DEPENDENCY_RECORDED: 'SEQUENCE_DEPENDENCY_RECORDED'
});

/**
 * Creates canonical source provenance for Step 17 CharacterInteractionEvidence.
 */
export function createDefaultStep17Provenance(
  sourceChar: string,
  targetChar: string,
  interactionType: string
): SourceReference {
  return Object.freeze({
    entityId: sourceChar,
    entityName: sourceChar,
    sourceCode: `char-interaction:3.7:${sourceChar}:${targetChar}:${interactionType}:${CHARACTER_INTERACTION_RULE_VERSION}`,
    patchVersion: '3.7',
    sourceType: 'RESONATOR_ABILITY',
    sourceProvenance: 'lib/engine/character-interactions/composer.ts',
    originalDescription: `Mechanical character interaction (${interactionType}) from ${sourceChar} toward ${targetChar}`
  });
}
