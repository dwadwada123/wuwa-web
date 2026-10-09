/**
 * Wuthering Waves Character Evaluation Repository
 * Phase 7 Step 16: Deterministic Investment-Aware Character Evaluation Contract
 *
 * Implements deterministic query, lookup, filtering, and summary APIs
 * over CharacterEvaluation models across all Patch 3.7 Resonators.
 *
 * CRITICAL ARCHITECTURAL BOUNDARIES:
 * 1. FACT/EVIDENCE REPOSITORY ONLY: Zero gameplay scores, zero DPS, zero rankings.
 * 2. DETERMINISTIC ORDERING: All collections are returned in canonical deterministic order.
 * 3. IMMUTABILITY: All returned objects and arrays are frozen.
 * 4. COMPLETE PRODUCTION UNIVERSE: Supports evaluation of all 60 Patch 3.7 Resonators.
 */

import { getKnownResonatorIds } from '../team-composition/repository.ts';
import { evaluateCharacter } from './evaluator.ts';
import {
  compareCharacterEvaluation,
  matchesCharacterEvaluationFilter
} from './predicates.ts';
import type {
  CharacterEvaluation,
  CharacterEvaluationSummary,
  CharacterEvaluationComponent,
  CharacterEvaluationFilter,
  CharacterEvaluationOptions
} from './types.ts';
import type { ResonatorInvestmentSnapshot } from '../investment/types.ts';

let _cachedDefaultEvaluations: readonly CharacterEvaluation[] | null = null;
let _cachedDefaultMap: Map<string, CharacterEvaluation> | null = null;

/**
 * Builds an in-memory map of custom investment snapshots keyed by resonatorId.
 */
function buildInvestmentMap(
  investmentCatalog?: readonly ResonatorInvestmentSnapshot[]
): Map<string, ResonatorInvestmentSnapshot> | null {
  if (!investmentCatalog) return null;
  const map = new Map<string, ResonatorInvestmentSnapshot>();
  for (const inv of investmentCatalog) {
    map.set(inv.resonatorId, inv);
  }
  return map;
}

/**
 * Evaluates a single Resonator under optional investment snapshot.
 */
export function getCharacterEvaluation(
  resonatorId: string,
  investment?: ResonatorInvestmentSnapshot,
  options?: CharacterEvaluationOptions
): CharacterEvaluation {
  // If evaluating against default uninvested catalog with default options, use cache if available
  if (!investment && !options?.ruleVersion && !options?.includeEmptyPairs) {
    if (_cachedDefaultMap && _cachedDefaultMap.has(resonatorId)) {
      return _cachedDefaultMap.get(resonatorId)!;
    }
  }

  return evaluateCharacter(resonatorId, investment, options);
}

/**
 * Retrieves character evaluations for all 60 Patch 3.7 Resonators,
 * canonically sorted by Resonator ID.
 */
export function getAllCharacterEvaluations(
  investmentCatalog?: readonly ResonatorInvestmentSnapshot[],
  options?: CharacterEvaluationOptions
): readonly CharacterEvaluation[] {
  if (!investmentCatalog && !options?.ruleVersion && !options?.includeEmptyPairs) {
    if (_cachedDefaultEvaluations) {
      return _cachedDefaultEvaluations;
    }

    const resonatorIds = getKnownResonatorIds();
    const list: CharacterEvaluation[] = [];
    const map = new Map<string, CharacterEvaluation>();

    for (const rId of resonatorIds) {
      const evaluation = evaluateCharacter(rId, undefined, options);
      list.push(evaluation);
      map.set(rId, evaluation);
    }

    list.sort(compareCharacterEvaluation);
    _cachedDefaultEvaluations = Object.freeze(list);
    _cachedDefaultMap = map;
    return _cachedDefaultEvaluations;
  }

  const invMap = buildInvestmentMap(investmentCatalog);
  const resonatorIds = getKnownResonatorIds();
  const list: CharacterEvaluation[] = [];

  for (const rId of resonatorIds) {
    const inv = invMap?.get(rId);
    list.push(evaluateCharacter(rId, inv, options));
  }

  list.sort(compareCharacterEvaluation);
  return Object.freeze(list);
}

/**
 * Retrieves all characters with status === 'EVALUATED'.
 */
export function getEvaluatedCharacters(
  investmentCatalog?: readonly ResonatorInvestmentSnapshot[],
  options?: CharacterEvaluationOptions
): readonly CharacterEvaluation[] {
  const all = getAllCharacterEvaluations(investmentCatalog, options);
  return Object.freeze(all.filter((e) => e.status === 'EVALUATED'));
}

/**
 * Retrieves all characters with status === 'PARTIALLY_EVALUATED'.
 */
export function getPartiallyEvaluatedCharacters(
  investmentCatalog?: readonly ResonatorInvestmentSnapshot[],
  options?: CharacterEvaluationOptions
): readonly CharacterEvaluation[] {
  const all = getAllCharacterEvaluations(investmentCatalog, options);
  return Object.freeze(all.filter((e) => e.status === 'PARTIALLY_EVALUATED'));
}

/**
 * Retrieves all characters with status === 'INVESTMENT_UNKNOWN'.
 */
export function getInvestmentUnknownCharacters(
  investmentCatalog?: readonly ResonatorInvestmentSnapshot[],
  options?: CharacterEvaluationOptions
): readonly CharacterEvaluation[] {
  const all = getAllCharacterEvaluations(investmentCatalog, options);
  return Object.freeze(all.filter((e) => e.status === 'INVESTMENT_UNKNOWN'));
}

/**
 * Retrieves all characters with status === 'UNMODELED'.
 */
export function getUnmodeledCharacters(
  investmentCatalog?: readonly ResonatorInvestmentSnapshot[],
  options?: CharacterEvaluationOptions
): readonly CharacterEvaluation[] {
  const all = getAllCharacterEvaluations(investmentCatalog, options);
  return Object.freeze(all.filter((e) => e.status === 'UNMODELED'));
}

/**
 * Retrieves the components array for a Resonator's evaluation.
 */
export function getCharacterEvaluationComponents(
  resonatorId: string,
  investment?: ResonatorInvestmentSnapshot,
  options?: CharacterEvaluationOptions
): readonly CharacterEvaluationComponent[] {
  const evaluation = getCharacterEvaluation(resonatorId, investment, options);
  return evaluation.components;
}

/**
 * Retrieves a concise deterministic summary of a character evaluation.
 */
export function getCharacterEvaluationSummary(
  resonatorId: string,
  investment?: ResonatorInvestmentSnapshot,
  options?: CharacterEvaluationOptions
): CharacterEvaluationSummary {
  const evaluation = getCharacterEvaluation(resonatorId, investment, options);

  const totalEffects = evaluation.investmentEffectIds.length;
  const resolvedCount = evaluation.resolvedInvestmentEffectIds.length;
  const knownDims = evaluation.investmentDimensionsKnown.length;
  const unknownDims = evaluation.investmentDimensionsUnknown.length;
  const completenessRatio = (knownDims + unknownDims) > 0
    ? Math.round((knownDims / (knownDims + unknownDims)) * 10000) / 10000
    : 0;

  return Object.freeze({
    resonatorId: evaluation.resonatorId,
    status: evaluation.status,
    evaluationScore: evaluation.evaluationScore,
    synergyProfileCount: evaluation.synergyProfileIds.length,
    resolvedInvestmentEffectCount: resolvedCount,
    unknownInvestmentEffectCount: totalEffects - resolvedCount,
    unmodeledInvestmentEffectCount: evaluation.status === 'UNMODELED' ? totalEffects : 0,
    knownInvestmentDimensionCount: knownDims,
    unknownInvestmentDimensionCount: unknownDims,
    investmentCompletenessRatio: completenessRatio,
    componentSummary: evaluation.components,
    explanationCodes: evaluation.explanationCodes,
    provenance: evaluation.provenance
  });
}

/**
 * Queries CharacterEvaluation records matching a filter.
 */
export function queryCharacterEvaluations(
  filter: CharacterEvaluationFilter,
  investmentCatalog?: readonly ResonatorInvestmentSnapshot[],
  options?: CharacterEvaluationOptions
): readonly CharacterEvaluation[] {
  const all = getAllCharacterEvaluations(investmentCatalog, options);
  const matched = all.filter((e) => matchesCharacterEvaluationFilter(e, filter));
  matched.sort(compareCharacterEvaluation);
  return Object.freeze(matched);
}

/**
 * Clears the internal repository cache (for test isolation).
 */
export function clearCharacterEvaluationCache(): void {
  _cachedDefaultEvaluations = null;
  _cachedDefaultMap = null;
}
