/**
 * Wuthering Waves Character Relationship & Interaction Repository
 * Phase 7 Step 17: Deterministic Character Relationship Composition & Interaction Evidence Contract
 *
 * Implements pure query, lookup, filtering, and caching APIs for character interaction evidence.
 */

import { composeCharacterInteractions } from './composer.ts';
import {
  matchesCharacterInteractionFilter,
  compareCharacterInteractionEvidence,
  deriveConditionKey
} from './predicates.ts';
import type {
  CharacterInteractionEvidence,
  CharacterInteractionCompositionInput,
  CharacterInteractionCompositionResult,
  CharacterInteractionFilter,
  CharacterInteractionType
} from './types.ts';

let _cachedProductionResult: CharacterInteractionCompositionResult | null = null;
let _cachedInteractionMap: Map<string, CharacterInteractionEvidence> | null = null;

/**
 * Clears the repository cache (used for determinism verification).
 */
export function clearCharacterInteractionCache(): void {
  _cachedProductionResult = null;
  _cachedInteractionMap = null;
}

/**
 * Retrieves the full composition result for Patch 3.7.
 */
export function getCharacterInteractionCompositionResult(
  input?: CharacterInteractionCompositionInput
): CharacterInteractionCompositionResult {
  if (input?.sourceRelationships || input?.sourceInteractions || input?.ruleVersion) {
    return composeCharacterInteractions(input);
  }

  if (!_cachedProductionResult) {
    _cachedProductionResult = composeCharacterInteractions();
    _cachedInteractionMap = new Map();
    for (const item of _cachedProductionResult.interactions) {
      const condKey = deriveConditionKey(item.condition);
      const key = `${item.sourceCharacterId}:::${item.targetCharacterId}:::${item.interactionType}:::${condKey}`;
      _cachedInteractionMap.set(key, item);
    }
  }

  return _cachedProductionResult;
}

/**
 * Retrieves all composed CharacterInteractionEvidence records for Patch 3.7.
 */
export function getCharacterInteractions(
  input?: CharacterInteractionCompositionInput
): readonly CharacterInteractionEvidence[] {
  return getCharacterInteractionCompositionResult(input).interactions;
}

/**
 * Looks up a single interaction connecting sourceChar -> targetChar with specified interaction type.
 */
export function getCharacterInteraction(
  sourceChar: string,
  targetChar: string,
  interactionType: CharacterInteractionType,
  conditionKey: string = 'UNIVERSAL'
): CharacterInteractionEvidence | null {
  getCharacterInteractionCompositionResult(); // ensures map is populated
  const key = `${sourceChar}:::${targetChar}:::${interactionType}:::${conditionKey}`;
  return _cachedInteractionMap?.get(key) || null;
}

/**
 * Retrieves all interaction evidence records where the character is either source or target.
 */
export function getInteractionsForCharacter(
  characterId: string
): readonly CharacterInteractionEvidence[] {
  return queryCharacterInteractions({ resonatorId: characterId });
}

/**
 * Retrieves all AUTHORITATIVE interaction evidence records.
 */
export function getAuthoritativeInteractions(): readonly CharacterInteractionEvidence[] {
  return queryCharacterInteractions({ evidenceStatus: 'AUTHORITATIVE' });
}

/**
 * Retrieves all CONFLICTED interaction evidence records.
 */
export function getConflictedInteractions(): readonly CharacterInteractionEvidence[] {
  return queryCharacterInteractions({ evidenceStatus: 'CONFLICTED' });
}

/**
 * Queries interaction evidence with multi-dimensional filtering.
 */
export function queryCharacterInteractions(
  filter?: CharacterInteractionFilter,
  input?: CharacterInteractionCompositionInput
): readonly CharacterInteractionEvidence[] {
  const all = getCharacterInteractions(input);
  const matched = all.filter((item) => matchesCharacterInteractionFilter(item, filter));
  matched.sort(compareCharacterInteractionEvidence);
  return Object.freeze(matched);
}
