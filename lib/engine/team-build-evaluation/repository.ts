/**
 * Wuthering Waves Team Build Evaluation Repository
 * Phase 7 Step 21: Deterministic Team Build Evaluation Contract
 *
 * Provides query, lookup, filtering, and caching operations over TeamBuildEvaluation records.
 */

import { buildTeamBuildEvaluations, evaluateTeamBuild } from './builder.ts';
import { deriveTeamBuildEvaluationId, matchesTeamBuildEvaluationFilter } from './predicates.ts';
import { isCanonicalResonatorId } from '../investment/predicates.ts';
import { getAllCharacterBuildEvaluations } from '../character-build-evaluation/repository.ts';
import type {
  TeamBuildEvaluation,
  TeamBuildEvaluationFilter,
  TeamBuildEvaluationInput,
  TeamBuildEvaluationResult
} from './types.ts';

let _cachedTeamBuildResult: TeamBuildEvaluationResult | null = null;
let _cachedTeamBuildMap: Map<string, TeamBuildEvaluation> | null = null;

/**
 * Builds or retrieves the authoritative production TeamBuildEvaluationResult for Patch 3.7.
 * Uses an in-memory memoized cache for default zero-argument calls.
 */
export function getTeamBuildEvaluationResult(
  input?: TeamBuildEvaluationInput
): TeamBuildEvaluationResult {
  const isDefault =
    !input ||
    (!input.patchId &&
      !input.characterBuildEvaluations &&
      !input.teamCandidates);

  if (isDefault) {
    if (!_cachedTeamBuildResult) {
      _cachedTeamBuildResult = buildTeamBuildEvaluations();
      _cachedTeamBuildMap = new Map();
      for (const ev of _cachedTeamBuildResult.evaluations) {
        _cachedTeamBuildMap.set(ev.id, ev);
      }
    }
    return _cachedTeamBuildResult;
  }

  return buildTeamBuildEvaluations(input);
}

/**
 * Retrieves all canonical TeamBuildEvaluation records for Patch 3.7.
 */
export function getAllTeamBuildEvaluations(): readonly TeamBuildEvaluation[] {
  return getTeamBuildEvaluationResult().evaluations;
}

/**
 * Retrieves a single TeamBuildEvaluation by its deterministic ID.
 * Returns null if not found.
 */
export function getTeamBuildEvaluationById(
  id: string
): TeamBuildEvaluation | null {
  if (!id || typeof id !== 'string') return null;

  if (!_cachedTeamBuildMap) {
    getTeamBuildEvaluationResult();
  }

  return _cachedTeamBuildMap?.get(id.trim()) ?? null;
}

/**
 * Retrieves or evaluates a TeamBuildEvaluation for three Resonators in any order.
 * Order-independent: (A, B, C) === (B, C, A) === (C, A, B).
 * Returns null if any Resonator is invalid/non-canonical or not distinct.
 */
export function getTeamBuildEvaluationByMembers(
  resonatorA: string,
  resonatorB: string,
  resonatorC: string
): TeamBuildEvaluation | null {
  if (
    !resonatorA ||
    !resonatorB ||
    !resonatorC ||
    !isCanonicalResonatorId(resonatorA) ||
    !isCanonicalResonatorId(resonatorB) ||
    !isCanonicalResonatorId(resonatorC)
  ) {
    return null;
  }

  if (
    resonatorA === resonatorB ||
    resonatorB === resonatorC ||
    resonatorA === resonatorC
  ) {
    return null;
  }

  const sorted = [resonatorA, resonatorB, resonatorC].sort((a, b) => a.localeCompare(b));
  const expectedId = deriveTeamBuildEvaluationId(sorted);

  // Check cache first
  const cached = getTeamBuildEvaluationById(expectedId);
  if (cached) return cached;

  // If not in production candidate cache, evaluate on-the-fly
  try {
    const charEvals = getAllCharacterBuildEvaluations();
    const evalMap = new Map(charEvals.map((e) => [e.resonatorId, e]));
    return evaluateTeamBuild(sorted as [string, string, string], evalMap);
  } catch {
    return null;
  }
}

/**
 * Queries TeamBuildEvaluation records matching multi-dimensional filter criteria.
 */
export function queryTeamBuildEvaluations(
  filter?: TeamBuildEvaluationFilter
): readonly TeamBuildEvaluation[] {
  const all = getAllTeamBuildEvaluations();
  if (!filter) return all;

  return Object.freeze(
    all.filter((ev) => matchesTeamBuildEvaluationFilter(ev, filter))
  );
}

/**
 * Resets the in-memory memoized cache for test isolation and cache eviction.
 */
export function clearTeamBuildEvaluationCache(): void {
  _cachedTeamBuildResult = null;
  _cachedTeamBuildMap = null;
}
