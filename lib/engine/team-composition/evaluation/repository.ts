/**
 * Wuthering Waves Deterministic Team Composition Candidate Evaluation Repository
 * Phase 7 Step 10: Deterministic Team Composition Candidate Evaluation & Scoring Contract
 *
 * Provides pure query, lookup, filtering, and caching operations over
 * TeamCompositionCandidateEvaluation records.
 */

import { getCharacterPairSynergyProfiles } from '../../relationships/character-pairs/synergy/repository.ts';
import {
  getTeamCompositionCandidates,
  getTeamCompositionCandidate
} from '../repository.ts';
import {
  evaluateTeamCompositionCandidate,
  evaluateTeamCompositionCandidates,
  createSynergyProfileMap
} from './evaluator.ts';
import {
  compareTeamCompositionCandidateEvaluation,
  matchesTeamCompositionEvaluationFilter
} from './predicates.ts';
import type { TeamCompositionCandidate } from '../types.ts';
import type {
  TeamCompositionCandidateEvaluation,
  TeamCompositionEvaluationFilter,
  TeamCompositionEvaluationOptions
} from './types.ts';

let _cachedProductionEvaluations: readonly TeamCompositionCandidateEvaluation[] | null = null;
let _cachedEvaluationMap: Map<string, TeamCompositionCandidateEvaluation> | null = null;
let _cachedCandidateByIdMap: Map<string, TeamCompositionCandidate> | null = null;

/**
 * Resolves a Step 9 TeamCompositionCandidate from its deterministic ID.
 */
export function getCandidateById(candidateId: string): TeamCompositionCandidate | undefined {
  if (!_cachedCandidateByIdMap) {
    const candidates = getTeamCompositionCandidates({ includeEmptyTriples: true });
    const map = new Map<string, TeamCompositionCandidate>();
    for (const c of candidates) {
      map.set(c.id, c);
    }
    _cachedCandidateByIdMap = map;
  }
  return _cachedCandidateByIdMap.get(candidateId);
}

/**
 * Clears the in-memory evaluations cache (primarily for isolated test environments).
 */
export function clearEvaluationCache(): void {
  _cachedProductionEvaluations = null;
  _cachedEvaluationMap = null;
  _cachedCandidateByIdMap = null;
}

/**
 * Builds or retrieves the authoritative production TeamCompositionCandidateEvaluations
 * for Patch 3.7 across all 34,220 theoretical teams.
 */
export function getTeamCompositionEvaluations(
  filter?: TeamCompositionEvaluationFilter,
  options?: TeamCompositionEvaluationOptions
): readonly TeamCompositionCandidateEvaluation[] {
  // If custom options (like context) are passed, evaluate on-the-fly without modifying production cache
  if (options && (options.context || options.ruleVersion)) {
    const candidates = getTeamCompositionCandidates({ includeEmptyTriples: true });
    const profiles = getCharacterPairSynergyProfiles();
    const profileMap = createSynergyProfileMap(profiles);
    const evals = evaluateTeamCompositionCandidates(candidates, profileMap, options);
    let results = [...evals];
    if (filter) {
      results = results.filter((e) => {
        const candidate = filter.resonatorId ? getCandidateById(e.candidateId) : undefined;
        return matchesTeamCompositionEvaluationFilter(e, filter, candidate?.memberResonatorIds);
      });
    }
    return Object.freeze(results.sort(compareTeamCompositionCandidateEvaluation));
  }

  // Populate base cache if not already populated
  if (!_cachedProductionEvaluations) {
    const candidates = getTeamCompositionCandidates({ includeEmptyTriples: true });
    const profiles = getCharacterPairSynergyProfiles();
    const profileMap = createSynergyProfileMap(profiles);
    const evaluations = evaluateTeamCompositionCandidates(candidates, profileMap, {
      includeBlockedEvaluations: true
    });

    const sorted = [...evaluations].sort(compareTeamCompositionCandidateEvaluation);
    _cachedProductionEvaluations = Object.freeze(sorted);

    const map = new Map<string, TeamCompositionCandidateEvaluation>();
    for (const ev of sorted) {
      map.set(ev.id, ev);
      map.set(ev.candidateId, ev);
    }
    _cachedEvaluationMap = map;
  }

  let result = _cachedProductionEvaluations;

  if (options?.includeBlockedEvaluations === false) {
    result = result.filter((e) => e.totalScore !== null);
  }

  if (filter) {
    result = result.filter((e) => {
      const candidate = filter.resonatorId ? getCandidateById(e.candidateId) : undefined;
      return matchesTeamCompositionEvaluationFilter(e, filter, candidate?.memberResonatorIds);
    });
  }

  return result;
}

/**
 * Fast O(1) lookup of an evaluation by candidate ID.
 */
export function getEvaluationByCandidateId(
  candidateId: string
): TeamCompositionCandidateEvaluation | undefined {
  if (!_cachedEvaluationMap) {
    getTeamCompositionEvaluations();
  }
  return _cachedEvaluationMap?.get(candidateId);
}

/**
 * Fast O(1) lookup of an evaluation by evaluation ID.
 */
export function getEvaluationById(
  id: string
): TeamCompositionCandidateEvaluation | undefined {
  if (!_cachedEvaluationMap) {
    getTeamCompositionEvaluations();
  }
  return _cachedEvaluationMap?.get(id);
}
