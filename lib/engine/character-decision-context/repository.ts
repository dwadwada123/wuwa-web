/**
 * Wuthering Waves Character Decision Context Repository
 * Phase 7 Step 19: Deterministic Character Decision Context Contract
 *
 * Implements deterministic query, lookup, filtering, and summary APIs
 * for CharacterDecisionContext models across Patch 3.7 Resonators.
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. PURE CONTEXT RETRIEVAL: Zero ranking, zero scoring, zero team generation.
 * 2. DETERMINISTIC ORDERING: Total canonical ordering preserved.
 * 3. IMMUTABILITY: All returned objects and arrays are frozen.
 * 4. STRICT ISOLATION: Rejects cross-patch inputs.
 */

import {
  CHARACTER_DECISION_CONTEXT_RULE_VERSION,
  CANONICAL_PATCH_VERSION
} from './rules.ts';
import {
  matchesCharacterDecisionContextFilter
} from './predicates.ts';
import {
  buildCharacterDecisionContext,
  buildCharacterDecisionContexts
} from './builder.ts';
import { getCharacterEvaluation } from '../character-evaluation/repository.ts';
import { getCharacterInteractionProfile } from '../character-interaction-profiles/repository.ts';
import type {
  CharacterDecisionContext,
  CharacterDecisionContextSummary,
  CharacterDecisionContextInput,
  CharacterDecisionContextResult,
  CharacterDecisionContextFilter,
  CharacterEvaluation,
  CharacterInteractionProfile
} from './types.ts';

let _cachedDefaultResult: CharacterDecisionContextResult | null = null;
let _cachedDefaultMap: Map<string, CharacterDecisionContext> | null = null;

/**
 * Clears the in-memory decision context cache.
 */
export function clearCharacterDecisionContextCache(): void {
  _cachedDefaultResult = null;
  _cachedDefaultMap = null;
}

/**
 * Retrieves the full CharacterDecisionContextResult container.
 * Computes deterministically or returns cached result if default input.
 */
export function getCharacterDecisionContextResult(
  input?: CharacterDecisionContextInput
): CharacterDecisionContextResult {
  const isDefault =
    !input ||
    (!input.patchId &&
      !input.evaluations &&
      !input.interactionProfiles &&
      !input.characterIds);

  if (isDefault && _cachedDefaultResult) {
    return _cachedDefaultResult;
  }

  const result = buildCharacterDecisionContexts(input);

  if (isDefault) {
    _cachedDefaultResult = result;
    const map = new Map<string, CharacterDecisionContext>();
    for (const ctx of result.contexts) {
      map.set(ctx.characterId, ctx);
    }
    _cachedDefaultMap = map;
  }

  return result;
}

/**
 * Retrieves all CharacterDecisionContext records in canonical order.
 */
export function getAllCharacterDecisionContexts(
  patchVersion: string = CANONICAL_PATCH_VERSION,
  input?: CharacterDecisionContextInput
): readonly CharacterDecisionContext[] {
  if (patchVersion !== CANONICAL_PATCH_VERSION) {
    throw new Error(
      `Invalid patchVersion '${patchVersion}'. Step 19 requires strictly '${CANONICAL_PATCH_VERSION}'.`
    );
  }

  const effectiveInput: CharacterDecisionContextInput = input
    ? { ...input, patchId: patchVersion }
    : { patchId: patchVersion };

  return getCharacterDecisionContextResult(effectiveInput).contexts;
}

/**
 * Retrieves the CharacterDecisionContext for a single Resonator.
 */
export function getCharacterDecisionContext(
  characterId: string,
  patchVersion: string = CANONICAL_PATCH_VERSION,
  customSources?: {
    evaluation?: CharacterEvaluation;
    profile?: CharacterInteractionProfile;
  }
): CharacterDecisionContext {
  if (patchVersion !== CANONICAL_PATCH_VERSION) {
    throw new Error(
      `Invalid patchVersion '${patchVersion}'. Step 19 requires strictly '${CANONICAL_PATCH_VERSION}'.`
    );
  }

  if (customSources?.evaluation || customSources?.profile) {
    const evaluation = customSources.evaluation ?? getCharacterEvaluation(characterId);
    const profile =
      customSources.profile ?? getCharacterInteractionProfile(characterId, patchVersion);
    if (!profile) {
      throw new Error(`Interaction profile not found for character '${characterId}'.`);
    }
    return buildCharacterDecisionContext(evaluation, profile, patchVersion);
  }

  // Use cached default if available
  if (_cachedDefaultMap?.has(characterId)) {
    return _cachedDefaultMap.get(characterId)!;
  }

  const all = getAllCharacterDecisionContexts(patchVersion);
  const found = all.find((c) => c.characterId === characterId);
  if (!found) {
    throw new Error(`Decision context not found for character '${characterId}'.`);
  }
  return found;
}

/**
 * Retrieves the concise factual summary for a single character's decision context.
 */
export function getCharacterDecisionContextSummary(
  characterId: string,
  patchVersion: string = CANONICAL_PATCH_VERSION
): CharacterDecisionContextSummary {
  return getCharacterDecisionContext(characterId, patchVersion).summary;
}

/**
 * Queries CharacterDecisionContext records matching a multi-dimensional filter.
 */
export function queryCharacterDecisionContexts(
  filter: CharacterDecisionContextFilter,
  input?: CharacterDecisionContextInput
): readonly CharacterDecisionContext[] {
  const patchVersion = filter.patchVersion ?? CANONICAL_PATCH_VERSION;
  const all = getAllCharacterDecisionContexts(patchVersion, input);
  const matched = all.filter((ctx) => matchesCharacterDecisionContextFilter(ctx, filter));
  return Object.freeze(matched);
}
