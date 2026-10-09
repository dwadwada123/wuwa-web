/**
 * Wuthering Waves Character Interaction Profile Repository
 * Phase 7 Step 18: Deterministic Character Interaction Aggregation & Evidence Profile Contract
 *
 * Implements pure query, lookup, filtering, and caching APIs for character interaction profiles.
 */

import { aggregateCharacterInteractionProfiles } from './aggregator.ts';
import {
  matchesCharacterInteractionProfileFilter,
  compareCharacterInteractionProfiles
} from './predicates.ts';
import { isCanonicalResonatorId } from '../investment/predicates.ts';
import type {
  CharacterInteractionEvidence,
  CharacterInteractionProfile,
  CharacterInteractionProfileSummary,
  CharacterInteractionProfileAggregationInput,
  CharacterInteractionProfileAggregationResult,
  CharacterInteractionProfileFilter
} from './types.ts';

let _cachedProductionResult: CharacterInteractionProfileAggregationResult | null = null;
let _cachedProfileMap: Map<string, CharacterInteractionProfile> | null = null;

/**
 * Clears the profile repository cache (used for determinism verification).
 */
export function clearCharacterInteractionProfileCache(): void {
  _cachedProductionResult = null;
  _cachedProfileMap = null;
}

/**
 * Retrieves the full aggregation result for Patch 3.7.
 */
export function getCharacterInteractionProfileResult(
  input?: CharacterInteractionProfileAggregationInput
): CharacterInteractionProfileAggregationResult {
  if (input?.interactionEvidence || input?.characterIds || input?.ruleVersion) {
    return aggregateCharacterInteractionProfiles(input);
  }

  if (!_cachedProductionResult) {
    _cachedProductionResult = aggregateCharacterInteractionProfiles();
    _cachedProfileMap = new Map();
    for (const p of _cachedProductionResult.profiles) {
      _cachedProfileMap.set(p.characterId, p);
    }
  }

  return _cachedProductionResult;
}

/**
 * Retrieves all aggregated CharacterInteractionProfile records for Patch 3.7.
 */
export function getAllCharacterInteractionProfiles(
  input?: CharacterInteractionProfileAggregationInput
): readonly CharacterInteractionProfile[] {
  return getCharacterInteractionProfileResult(input).profiles;
}

/**
 * Looks up a single character's interaction profile.
 * Throws on non-canonical character ID to maintain epistemic fidelity.
 */
export function getCharacterInteractionProfile(
  characterId: string,
  patchId: string = '3.7'
): CharacterInteractionProfile | null {
  if (patchId !== '3.7') {
    throw new Error(`Invalid patchId '${patchId}'. Step 18 strictly requires Patch '3.7'.`);
  }

  if (!isCanonicalResonatorId(characterId)) {
    throw new Error(`Unknown or non-canonical character '${characterId}'.`);
  }

  getCharacterInteractionProfileResult(); // ensures cache is populated
  return _cachedProfileMap?.get(characterId) || null;
}

/**
 * Retrieves all outgoing interaction evidence records for a character.
 */
export function getOutgoingCharacterInteractions(
  characterId: string,
  patchId: string = '3.7'
): readonly CharacterInteractionEvidence[] {
  const profile = getCharacterInteractionProfile(characterId, patchId);
  return profile ? profile.outgoing : Object.freeze([]);
}

/**
 * Retrieves all incoming interaction evidence records for a character.
 */
export function getIncomingCharacterInteractions(
  characterId: string,
  patchId: string = '3.7'
): readonly CharacterInteractionEvidence[] {
  const profile = getCharacterInteractionProfile(characterId, patchId);
  return profile ? profile.incoming : Object.freeze([]);
}

/**
 * Retrieves the summary counts for a single character's profile.
 */
export function getCharacterInteractionProfileSummary(
  characterId: string,
  patchId: string = '3.7'
): CharacterInteractionProfileSummary | null {
  const profile = getCharacterInteractionProfile(characterId, patchId);
  return profile ? profile.summary : null;
}

/**
 * Retrieves all canonical character IDs that have at least one outgoing interaction.
 */
export function getCharactersWithOutgoingInteractions(
  patchId: string = '3.7'
): readonly string[] {
  if (patchId !== '3.7') {
    throw new Error(`Invalid patchId '${patchId}'. Step 18 strictly requires Patch '3.7'.`);
  }
  const all = getAllCharacterInteractionProfiles();
  return Object.freeze(
    all.filter((p) => p.outgoing.length > 0).map((p) => p.characterId).sort((a, b) => a.localeCompare(b))
  );
}

/**
 * Retrieves all canonical character IDs that have at least one incoming interaction.
 */
export function getCharactersWithIncomingInteractions(
  patchId: string = '3.7'
): readonly string[] {
  if (patchId !== '3.7') {
    throw new Error(`Invalid patchId '${patchId}'. Step 18 strictly requires Patch '3.7'.`);
  }
  const all = getAllCharacterInteractionProfiles();
  return Object.freeze(
    all.filter((p) => p.incoming.length > 0).map((p) => p.characterId).sort((a, b) => a.localeCompare(b))
  );
}

/**
 * Queries interaction profiles with multi-dimensional filtering.
 */
export function queryCharacterInteractionProfiles(
  filter?: CharacterInteractionProfileFilter,
  input?: CharacterInteractionProfileAggregationInput
): readonly CharacterInteractionProfile[] {
  const all = getAllCharacterInteractionProfiles(input);
  const matched = all.filter((p) => matchesCharacterInteractionProfileFilter(p, filter));
  matched.sort(compareCharacterInteractionProfiles);
  return Object.freeze(matched);
}
