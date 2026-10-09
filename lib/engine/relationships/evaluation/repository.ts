/**
 * Wuthering Waves Compatibility Candidate Evaluation Repository
 * Phase 7 Step 6: Deterministic Compatibility Candidate Evaluation & Scoring Contract
 *
 * Provides deterministic, in-memory query, indexing, and lookup capabilities
 * for CompatibilityCandidateEvaluation domain records.
 *
 * PURE & OFFLINE: Zero persistence, zero side effects, zero database dependencies.
 */

import { matchesEvaluationFilter, compareCompatibilityEvaluation } from './predicates.ts';
import { evaluateCompatibilityCandidates } from './evaluator.ts';
import { getCompatibilityCandidates } from '../compatibility/repository.ts';
import type {
  CompatibilityCandidateEvaluation,
  CompatibilityEvaluationFilter,
  CompatibilityEvaluationOptions
} from './types.ts';

/**
 * Pure, deterministic query function filtering a collection of candidate evaluations.
 * Returns results canonically sorted.
 */
export function queryCompatibilityEvaluations(
  evaluations: readonly CompatibilityCandidateEvaluation[],
  filter: CompatibilityEvaluationFilter
): readonly CompatibilityCandidateEvaluation[] {
  const matches = evaluations.filter((evaluation) => matchesEvaluationFilter(evaluation, filter));
  matches.sort(compareCompatibilityEvaluation);
  return Object.freeze(matches);
}

/**
 * Fast lookup for an evaluation by its unique canonical identifier.
 */
export function getCompatibilityEvaluation(
  evaluations: readonly CompatibilityCandidateEvaluation[],
  id: string
): CompatibilityCandidateEvaluation | undefined {
  return evaluations.find((e) => e.id === id);
}

/**
 * Finds all evaluations referencing a specific CompatibilityCandidate.
 */
export function findEvaluationsForCandidate(
  evaluations: readonly CompatibilityCandidateEvaluation[],
  candidateId: string
): readonly CompatibilityCandidateEvaluation[] {
  return queryCompatibilityEvaluations(evaluations, { candidateId });
}

/**
 * Finds all evaluations between a source entity and a target entity.
 */
export function findEvaluationsBetweenEntities(
  evaluations: readonly CompatibilityCandidateEvaluation[],
  sourceEntityId: string,
  targetEntityId: string
): readonly CompatibilityCandidateEvaluation[] {
  return queryCompatibilityEvaluations(evaluations, {
    sourceEntityId,
    targetEntityId
  });
}

/** Cached in-memory evaluations for Patch 3.7 production dataset */
let cachedProductionEvaluations: readonly CompatibilityCandidateEvaluation[] | null = null;

/**
 * Generates and returns the authoritative, canonically sorted CompatibilityCandidateEvaluations
 * for the Patch 3.7 dataset.
 */
export function getCompatibilityEvaluations(
  options?: CompatibilityEvaluationOptions
): readonly CompatibilityCandidateEvaluation[] {
  if (options) {
    const candidates = getCompatibilityCandidates();
    return evaluateCompatibilityCandidates(candidates, options);
  }

  if (cachedProductionEvaluations) {
    return cachedProductionEvaluations;
  }

  const candidates = getCompatibilityCandidates();
  cachedProductionEvaluations = evaluateCompatibilityCandidates(candidates);
  return cachedProductionEvaluations;
}
