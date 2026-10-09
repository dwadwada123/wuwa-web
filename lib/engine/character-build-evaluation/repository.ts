/**
 * Wuthering Waves Character Build Evaluation Repository
 * Phase 7 Step 20: Deterministic Character Build Evaluation Contract
 *
 * Provides query, lookup, filtering, and caching operations over CharacterBuildEvaluation records.
 */

import { buildCharacterBuildEvaluations } from './builder.ts';
import { matchesCharacterBuildEvaluationFilter } from './predicates.ts';
import type {
  CharacterBuildEvaluation,
  CharacterBuildEvaluationFilter,
  CharacterBuildEvaluationInput,
  CharacterBuildEvaluationResult
} from './types.ts';

let _cachedBuildEvaluationResult: CharacterBuildEvaluationResult | null = null;
let _cachedBuildEvaluationMap: Map<string, CharacterBuildEvaluation> | null = null;

/**
 * Builds or retrieves the authoritative production CharacterBuildEvaluationResult for Patch 3.7.
 * Uses an in-memory memoized cache for default zero-argument calls.
 */
export function getCharacterBuildEvaluationResult(
  input?: CharacterBuildEvaluationInput
): CharacterBuildEvaluationResult {
  const isDefault =
    !input ||
    (!input.patchId &&
      !input.decisionContexts &&
      !input.investmentSnapshots &&
      !input.characterIds);

  if (isDefault) {
    if (!_cachedBuildEvaluationResult) {
      _cachedBuildEvaluationResult = buildCharacterBuildEvaluations();
      _cachedBuildEvaluationMap = new Map();
      for (const ev of _cachedBuildEvaluationResult.evaluations) {
        _cachedBuildEvaluationMap.set(ev.resonatorId, ev);
      }
    }
    return _cachedBuildEvaluationResult;
  }

  return buildCharacterBuildEvaluations(input);
}

/**
 * Retrieves all canonical CharacterBuildEvaluation records for Patch 3.7.
 */
export function getAllCharacterBuildEvaluations(): readonly CharacterBuildEvaluation[] {
  return getCharacterBuildEvaluationResult().evaluations;
}

/**
 * Retrieves a single CharacterBuildEvaluation by its canonical Resonator entity ID.
 * Returns null if not found or if Resonator is non-canonical.
 */
export function getCharacterBuildEvaluationByCharacterId(
  characterId: string
): CharacterBuildEvaluation | null {
  if (!characterId || typeof characterId !== 'string') return null;

  // Populate cache if needed
  if (!_cachedBuildEvaluationMap) {
    getCharacterBuildEvaluationResult();
  }

  return _cachedBuildEvaluationMap?.get(characterId.trim()) ?? null;
}

/**
 * Queries CharacterBuildEvaluation records matching multi-dimensional filter criteria.
 */
export function queryCharacterBuildEvaluations(
  filter?: CharacterBuildEvaluationFilter
): readonly CharacterBuildEvaluation[] {
  const all = getAllCharacterBuildEvaluations();
  if (!filter) return all;

  return Object.freeze(
    all.filter((ev) => matchesCharacterBuildEvaluationFilter(ev, filter))
  );
}

/**
 * Resets the in-memory memoized cache for test isolation and cache eviction.
 */
export function clearCharacterBuildEvaluationCache(): void {
  _cachedBuildEvaluationResult = null;
  _cachedBuildEvaluationMap = null;
}
