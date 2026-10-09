/**
 * Wuthering Waves Engine Fact Filter Predicates & Canonical Ordering
 * Phase 6C Step 6: Engine Fact Aggregation & Semantic Consumption API
 *
 * Implements deterministic filter matching, canonical sorting contracts,
 * and trust-boundary input validation for NormalizedEngineFacts.
 */

import type { NormalizedEngineFact } from '../types.ts';
import type { ConsumableNumericFact, EngineFactFilter } from './types.ts';

/**
 * Validates that an input fact collection satisfies trust boundary constraints:
 * - Strictly belongs to the expected patch (defaults to '3.7')
 * - Contains valid entity provenance
 * - Contains zero duplicate canonical fact IDs
 *
 * Throws a deterministic descriptive error if any invariant is violated.
 */
export function validateFactCollection(
  facts: readonly NormalizedEngineFact[],
  expectedPatch: string = '3.7'
): void {
  const seenIds = new Set<string>();

  for (const fact of facts) {
    // 1. Patch Isolation Hard Gate
    if (fact.patchVersion !== expectedPatch) {
      throw new Error(
        `[TrustBoundary] Cross-patch fact rejected: factId '${fact.factId}' has patchVersion '${fact.patchVersion}', expected '${expectedPatch}'`
      );
    }

    // 2. Provenance Validation Gate
    if (!fact.provenance || !fact.provenance.entityId || !fact.provenance.sourceProvenance) {
      throw new Error(
        `[TrustBoundary] Invalid provenance on fact: factId '${fact.factId}' lacks valid sourceReference`
      );
    }

    // 3. Duplicate Identity Gate
    if (seenIds.has(fact.factId)) {
      throw new Error(
        `[TrustBoundary] Duplicate factId detected in collection: '${fact.factId}'. Collections must be strictly unique.`
      );
    }
    seenIds.add(fact.factId);
  }
}

/**
 * Pure predicate checking whether a NormalizedEngineFact satisfies all criteria of an EngineFactFilter.
 * Multiple filter dimensions combine with strict AND logic.
 * Dimension values matching arrays combine with OR logic within that dimension.
 */
export function matchesFilter(
  fact: NormalizedEngineFact,
  filter?: EngineFactFilter
): boolean {
  if (!filter) {
    return true;
  }

  // 1. Patch Version (Strict Patch Isolation)
  const targetPatch = filter.patchVersion ?? '3.7';
  if (fact.patchVersion !== targetPatch) {
    return false;
  }

  // 2. Entity ID
  if (filter.entityId !== undefined) {
    if (Array.isArray(filter.entityId)) {
      if (!filter.entityId.includes(fact.entityId)) return false;
    } else if (fact.entityId !== filter.entityId) {
      return false;
    }
  }

  // 3. Source Code (e.g., 'skill', 'liberation', 's1', 'passive')
  if (filter.sourceCode !== undefined) {
    if (Array.isArray(filter.sourceCode)) {
      if (!filter.sourceCode.includes(fact.sourceCode)) return false;
    } else if (fact.sourceCode !== filter.sourceCode) {
      return false;
    }
  }

  // 4. Gameplay Effect Category
  if (filter.category !== undefined) {
    if (Array.isArray(filter.category)) {
      if (!filter.category.includes(fact.category)) return false;
    } else if (fact.category !== filter.category) {
      return false;
    }
  }

  // 5. Semantic Parameter
  if (filter.parameter !== undefined) {
    if (Array.isArray(filter.parameter)) {
      if (!filter.parameter.includes(fact.parameter)) return false;
    } else if (fact.parameter !== filter.parameter) {
      return false;
    }
  }

  // 6. Target
  if (filter.target !== undefined) {
    if (Array.isArray(filter.target)) {
      if (!filter.target.includes(fact.target)) return false;
    } else if (fact.target !== filter.target) {
      return false;
    }
  }

  // 7. Element
  if (filter.element !== undefined) {
    if (Array.isArray(filter.element)) {
      if (!filter.element.includes(fact.element)) return false;
    } else if (fact.element !== filter.element) {
      return false;
    }
  }

  // 8. Consumption State
  if (filter.consumptionState !== undefined) {
    if (Array.isArray(filter.consumptionState)) {
      if (!filter.consumptionState.includes(fact.consumptionState)) return false;
    } else if (fact.consumptionState !== filter.consumptionState) {
      return false;
    }
  }

  // 9. Semantic Status
  if (filter.semanticStatus !== undefined) {
    if (Array.isArray(filter.semanticStatus)) {
      if (!filter.semanticStatus.includes(fact.semanticStatus)) return false;
    } else if (fact.semanticStatus !== filter.semanticStatus) {
      return false;
    }
  }

  // 10. Parameter Safety
  if (filter.parameterSafety !== undefined) {
    if (Array.isArray(filter.parameterSafety)) {
      if (!filter.parameterSafety.includes(fact.parameterSafety)) return false;
    } else if (fact.parameterSafety !== filter.parameterSafety) {
      return false;
    }
  }

  // 11. Refinement Rank
  if (filter.refinementRank !== undefined) {
    if (fact.refinementRank === undefined) {
      return false;
    }
    if (Array.isArray(filter.refinementRank)) {
      if (!filter.refinementRank.includes(fact.refinementRank)) return false;
    } else if (fact.refinementRank !== filter.refinementRank) {
      return false;
    }
  }

  return true;
}

/**
 * Canonical ordering comparator for NormalizedEngineFacts.
 * Ordering contract:
 * 1. factId (lexicographical localeCompare)
 * 2. entityId
 * 3. sourceCode
 * 4. parameter
 * 5. category
 * 6. target
 * 7. element
 */
export function compareCanonicalFacts(
  a: NormalizedEngineFact,
  b: NormalizedEngineFact
): number {
  const cmpId = a.factId.localeCompare(b.factId);
  if (cmpId !== 0) return cmpId;

  const cmpEntity = a.entityId.localeCompare(b.entityId);
  if (cmpEntity !== 0) return cmpEntity;

  const cmpSource = a.sourceCode.localeCompare(b.sourceCode);
  if (cmpSource !== 0) return cmpSource;

  const cmpParam = a.parameter.localeCompare(b.parameter);
  if (cmpParam !== 0) return cmpParam;

  const cmpCat = a.category.localeCompare(b.category);
  if (cmpCat !== 0) return cmpCat;

  const cmpTarget = a.target.localeCompare(b.target);
  if (cmpTarget !== 0) return cmpTarget;

  return a.element.localeCompare(b.element);
}

/**
 * Returns a new shallow-copied array of NormalizedEngineFacts sorted according to the canonical ordering contract.
 * Does NOT mutate the source array.
 */
export function sortCanonicalFacts(
  facts: readonly NormalizedEngineFact[]
): NormalizedEngineFact[] {
  return [...facts].sort(compareCanonicalFacts);
}

/**
 * Returns a new shallow-copied array of ConsumableNumericFacts sorted deterministically by canonical factId.
 * Does NOT mutate the source array.
 */
export function sortConsumableNumericFacts(
  facts: readonly ConsumableNumericFact[]
): ConsumableNumericFact[] {
  return [...facts].sort((a, b) => a.factId.localeCompare(b.factId));
}
