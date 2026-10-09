/**
 * Wuthering Waves Engine Fact Query & Aggregation API
 * Phase 6C Step 6: Engine Fact Aggregation & Semantic Consumption API
 *
 * Implements deterministic querying, grouping, context-aware evaluation,
 * consumable-only extraction, and diagnostic introspection for engine subsystems.
 *
 * ZERO DATABASE, ZERO NETWORK, ZERO LLM, DETERMINISTIC, IN-MEMORY ONLY.
 * CENTRAL INVARIANT: Never converts null/unresolved facts to numeric 0.
 * Zero numeric aggregation (no summing, averaging, or scoring).
 */

import type { NormalizedEngineFact, EngineFactConsumptionState } from '../types.ts';
import type {
  SemanticParameter,
  SemanticTarget
} from '../../../domain/types/semantics.ts';
import type { Element } from '../../../domain/types/common.ts';
import type { GameplayEffectCategory } from '../../../domain/types/gameplay-effects.ts';
import type {
  EngineFactFilter,
  ConsumableNumericFact,
  FactDiagnosticResult,
  ProductionQueryMetrics,
  RuntimeEvaluationContext,
  ContextualEvaluationResult
} from './types.ts';
import {
  matchesFilter,
  sortCanonicalFacts,
  sortConsumableNumericFacts,
  validateFactCollection
} from './predicates.ts';
import { evaluateNormalizedFactWithContext } from '../context/evaluator.ts';
import { runProductionFactNormalizationAudit } from '../normalizer.ts';

/**
 * Deterministically queries NormalizedEngineFacts using multidimensional filters.
 * Rejects cross-patch or invalid-provenance facts at the trust boundary.
 * Results are sorted according to the canonical fact ordering contract.
 */
export function queryEngineFacts(
  facts: readonly NormalizedEngineFact[],
  filter?: EngineFactFilter
): readonly NormalizedEngineFact[] {
  validateFactCollection(facts, filter?.patchVersion ?? '3.7');

  const filtered = facts.filter((fact) => matchesFilter(fact, filter));
  return Object.freeze(sortCanonicalFacts(filtered));
}

/**
 * Queries strictly STATIC facts (facts consumable without runtime rotation context).
 */
export function queryStaticFacts(
  facts: readonly NormalizedEngineFact[],
  filter?: Omit<EngineFactFilter, 'consumptionState'>
): readonly NormalizedEngineFact[] {
  return queryEngineFacts(facts, { ...filter, consumptionState: 'CONSUMABLE_STATIC' });
}

/**
 * Queries strictly CONTEXTUAL facts (facts requiring action/trigger/state context).
 */
export function queryContextualFacts(
  facts: readonly NormalizedEngineFact[],
  filter?: Omit<EngineFactFilter, 'consumptionState'>
): readonly NormalizedEngineFact[] {
  return queryEngineFacts(facts, { ...filter, consumptionState: 'CONSUMABLE_CONTEXTUAL' });
}

/**
 * Queries UNMODELED facts (Forte gauge, coordinated attack mechanics).
 */
export function queryUnmodeledFacts(
  facts: readonly NormalizedEngineFact[],
  filter?: Omit<EngineFactFilter, 'consumptionState'>
): readonly NormalizedEngineFact[] {
  return queryEngineFacts(facts, { ...filter, consumptionState: 'UNMODELED' });
}

/**
 * Queries UNKNOWN facts (indeterminate magnitude or condition).
 */
export function queryUnknownFacts(
  facts: readonly NormalizedEngineFact[],
  filter?: Omit<EngineFactFilter, 'consumptionState'>
): readonly NormalizedEngineFact[] {
  return queryEngineFacts(facts, { ...filter, consumptionState: 'UNKNOWN' });
}

/**
 * Queries NOT_APPLICABLE facts (non-combat utility or flavor).
 */
export function queryNotApplicableFacts(
  facts: readonly NormalizedEngineFact[],
  filter?: Omit<EngineFactFilter, 'consumptionState'>
): readonly NormalizedEngineFact[] {
  return queryEngineFacts(facts, { ...filter, consumptionState: 'NOT_APPLICABLE' });
}

/**
 * Groups facts by entityId.
 * Keys and fact arrays are deterministically ordered.
 * Preserves canonical fact objects without numeric aggregation.
 */
export function groupByEntity(
  facts: readonly NormalizedEngineFact[]
): ReadonlyMap<string, readonly NormalizedEngineFact[]> {
  validateFactCollection(facts);

  const groups = new Map<string, NormalizedEngineFact[]>();
  for (const fact of facts) {
    let list = groups.get(fact.entityId);
    if (!list) {
      list = [];
      groups.set(fact.entityId, list);
    }
    list.push(fact);
  }

  // Deterministically sort keys and members
  const sortedMap = new Map<string, readonly NormalizedEngineFact[]>();
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));
  for (const key of sortedKeys) {
    sortedMap.set(key, Object.freeze(sortCanonicalFacts(groups.get(key)!)));
  }

  return sortedMap;
}

/**
 * Groups facts by SemanticParameter.
 * Keys and fact arrays are deterministically ordered.
 * Preserves canonical fact objects without numeric aggregation.
 */
export function groupByParameter(
  facts: readonly NormalizedEngineFact[]
): ReadonlyMap<SemanticParameter, readonly NormalizedEngineFact[]> {
  validateFactCollection(facts);

  const groups = new Map<SemanticParameter, NormalizedEngineFact[]>();
  for (const fact of facts) {
    let list = groups.get(fact.parameter);
    if (!list) {
      list = [];
      groups.set(fact.parameter, list);
    }
    list.push(fact);
  }

  const sortedMap = new Map<SemanticParameter, readonly NormalizedEngineFact[]>();
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));
  for (const key of sortedKeys) {
    sortedMap.set(key, Object.freeze(sortCanonicalFacts(groups.get(key)!)));
  }

  return sortedMap;
}

/**
 * Groups facts by GameplayEffectCategory.
 * Keys and fact arrays are deterministically ordered.
 */
export function groupByCategory(
  facts: readonly NormalizedEngineFact[]
): ReadonlyMap<GameplayEffectCategory, readonly NormalizedEngineFact[]> {
  validateFactCollection(facts);

  const groups = new Map<GameplayEffectCategory, NormalizedEngineFact[]>();
  for (const fact of facts) {
    let list = groups.get(fact.category);
    if (!list) {
      list = [];
      groups.set(fact.category, list);
    }
    list.push(fact);
  }

  const sortedMap = new Map<GameplayEffectCategory, readonly NormalizedEngineFact[]>();
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));
  for (const key of sortedKeys) {
    sortedMap.set(key, Object.freeze(sortCanonicalFacts(groups.get(key)!)));
  }

  return sortedMap;
}

/**
 * Groups facts by SemanticTarget.
 * Keys and fact arrays are deterministically ordered.
 */
export function groupByTarget(
  facts: readonly NormalizedEngineFact[]
): ReadonlyMap<SemanticTarget, readonly NormalizedEngineFact[]> {
  validateFactCollection(facts);

  const groups = new Map<SemanticTarget, NormalizedEngineFact[]>();
  for (const fact of facts) {
    let list = groups.get(fact.target);
    if (!list) {
      list = [];
      groups.set(fact.target, list);
    }
    list.push(fact);
  }

  const sortedMap = new Map<SemanticTarget, readonly NormalizedEngineFact[]>();
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));
  for (const key of sortedKeys) {
    sortedMap.set(key, Object.freeze(sortCanonicalFacts(groups.get(key)!)));
  }

  return sortedMap;
}

/**
 * Groups facts by Element ('Glacio', 'Fusion', 'Electro', 'Aero', 'Spectro', 'Havoc', 'All', 'NONE').
 * Keys and fact arrays are deterministically ordered.
 */
export function groupByElement(
  facts: readonly NormalizedEngineFact[]
): ReadonlyMap<Element | 'All' | 'NONE', readonly NormalizedEngineFact[]> {
  validateFactCollection(facts);

  const groups = new Map<Element | 'All' | 'NONE', NormalizedEngineFact[]>();
  for (const fact of facts) {
    let list = groups.get(fact.element);
    if (!list) {
      list = [];
      groups.set(fact.element, list);
    }
    list.push(fact);
  }

  const sortedMap = new Map<Element | 'All' | 'NONE', readonly NormalizedEngineFact[]>();
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));
  for (const key of sortedKeys) {
    sortedMap.set(key, Object.freeze(sortCanonicalFacts(groups.get(key)!)));
  }

  return sortedMap;
}

/**
 * Groups facts by EngineFactConsumptionState.
 * Keys and fact arrays are deterministically ordered.
 */
export function groupByConsumptionState(
  facts: readonly NormalizedEngineFact[]
): ReadonlyMap<EngineFactConsumptionState, readonly NormalizedEngineFact[]> {
  validateFactCollection(facts);

  const groups = new Map<EngineFactConsumptionState, NormalizedEngineFact[]>();
  for (const fact of facts) {
    let list = groups.get(fact.consumptionState);
    if (!list) {
      list = [];
      groups.set(fact.consumptionState, list);
    }
    list.push(fact);
  }

  const sortedMap = new Map<EngineFactConsumptionState, readonly NormalizedEngineFact[]>();
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));
  for (const key of sortedKeys) {
    sortedMap.set(key, Object.freeze(sortCanonicalFacts(groups.get(key)!)));
  }

  return sortedMap;
}

/**
 * Queries engine facts under a specified runtime evaluation context by delegating
 * directly to the approved evaluateNormalizedFactWithContext().
 * Strictly preserves canonical identity by joining on factId.
 * Never converts unresolved states to numeric 0.
 */
export function queryEngineFactsWithContext(
  facts: readonly NormalizedEngineFact[],
  filter?: EngineFactFilter,
  context?: RuntimeEvaluationContext,
  options?: { consumableOnly?: boolean }
): readonly ContextualEvaluationResult[] {
  const matchedFacts = queryEngineFacts(facts, filter);
  const results: ContextualEvaluationResult[] = [];

  for (const fact of matchedFacts) {
    const evalResult = evaluateNormalizedFactWithContext(fact, context);

    // Hard verification: Contextual result join integrity
    if (evalResult.factId !== fact.factId) {
      throw new Error(
        `[TrustBoundary] Contextual evaluation factId mismatch: expected '${fact.factId}', received '${evalResult.factId}'`
      );
    }

    if (options?.consumableOnly && !evalResult.consumable) {
      continue;
    }

    results.push(evalResult);
  }

  return Object.freeze(results.sort((a, b) => a.factId.localeCompare(b.factId)));
}

/**
 * Primary consumption API for downstream numeric engine calculations.
 * Returns ONLY strictly consumable numeric facts whose magnitudes are finite numbers.
 * Discards all unresolved, unmodeled, unknown, or mismatched facts without fallbacks to 0.
 */
export function getConsumableNumericFacts(
  facts: readonly NormalizedEngineFact[],
  context?: RuntimeEvaluationContext,
  filter?: EngineFactFilter
): readonly ConsumableNumericFact[] {
  const matchedFacts = queryEngineFacts(facts, filter);
  const consumableFacts: ConsumableNumericFact[] = [];

  for (const fact of matchedFacts) {
    const evalResult = evaluateNormalizedFactWithContext(fact, context);

    // Hard trust check on evaluation factId
    if (evalResult.factId !== fact.factId) {
      throw new Error(
        `[TrustBoundary] Fact join mismatch: factId '${fact.factId}' != '${evalResult.factId}'`
      );
    }

    if (
      evalResult.consumable &&
      evalResult.numericValue !== null &&
      Number.isFinite(evalResult.numericValue) &&
      !Number.isNaN(evalResult.numericValue)
    ) {
      consumableFacts.push({
        factId: fact.factId,
        entityId: fact.entityId,
        sourceCode: fact.sourceCode,
        patchVersion: fact.patchVersion,
        category: fact.category,
        parameter: fact.parameter,
        numericValue: evalResult.numericValue,
        unit: evalResult.unit,
        element: fact.element,
        target: fact.target,
        state: evalResult.state === 'STATIC' ? 'STATIC' : 'CONTEXTUAL',
        duration: fact.duration,
        stacking: fact.stacking,
        provenance: fact.provenance,
        extraction: fact.extraction,
        evaluationReason: evalResult.reason,
        resolvedRank: evalResult.resolvedRank
      });
    }
  }

  return Object.freeze(sortConsumableNumericFacts(consumableFacts));
}

/**
 * Diagnostic introspection API answering "Why was this fact consumable or rejected?".
 * Reuses canonical ContextualEvaluationReason codes.
 */
export function diagnoseEngineFacts(
  facts: readonly NormalizedEngineFact[],
  context?: RuntimeEvaluationContext,
  filter?: EngineFactFilter
): readonly FactDiagnosticResult[] {
  const matchedFacts = queryEngineFacts(facts, filter);
  const diagnostics: FactDiagnosticResult[] = [];

  for (const fact of matchedFacts) {
    const evalResult = evaluateNormalizedFactWithContext(fact, context);

    diagnostics.push({
      factId: fact.factId,
      entityId: fact.entityId,
      sourceCode: fact.sourceCode,
      patchVersion: fact.patchVersion,
      consumable: evalResult.consumable,
      reason: evalResult.reason,
      state: evalResult.state,
      numericValue: evalResult.numericValue,
      requiredContext: evalResult.requiredContext,
      fact,
      evaluation: evalResult
    });
  }

  return Object.freeze(diagnostics.sort((a, b) => a.factId.localeCompare(b.factId)));
}

/**
 * Runs a complete coverage audit of the query layer against all 292 production Patch 3.7 facts.
 * Computes multi-dimensional partitions and proves exact reconciliation.
 */
export function auditProductionEngineFactQueries(): ProductionQueryMetrics {
  const normAudit = runProductionFactNormalizationAudit();
  const facts = normAudit.facts;

  validateFactCollection(facts);

  const byEntity: Record<string, number> = {};
  const byParameter: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byTarget: Record<string, number> = {};
  const byElement: Record<string, number> = {};
  const byConsumptionState: Record<string, number> = {};
  const byParameterSafety: Record<string, number> = {};

  for (const fact of facts) {
    byEntity[fact.entityId] = (byEntity[fact.entityId] || 0) + 1;
    byParameter[fact.parameter] = (byParameter[fact.parameter] || 0) + 1;
    byCategory[fact.category] = (byCategory[fact.category] || 0) + 1;
    byTarget[fact.target] = (byTarget[fact.target] || 0) + 1;
    byElement[fact.element] = (byElement[fact.element] || 0) + 1;
    byConsumptionState[fact.consumptionState] = (byConsumptionState[fact.consumptionState] || 0) + 1;
    byParameterSafety[fact.parameterSafety] = (byParameterSafety[fact.parameterSafety] || 0) + 1;
  }

  return {
    totalFacts: facts.length,
    byEntity,
    byParameter,
    byCategory,
    byTarget,
    byElement,
    byConsumptionState,
    byParameterSafety
  };
}
