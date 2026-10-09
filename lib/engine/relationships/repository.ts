/**
 * Wuthering Waves Gameplay Relationship Query & Repository Layer
 * Phase 7 Step 3: Gameplay Relationship & Interaction Contract
 *
 * Provides deterministic, multi-dimensional querying across GameplayRelationship collections.
 *
 * RULES:
 * - Pure and deterministic
 * - AND across distinct filter fields, OR within array fields
 * - Zero ranking, zero scoring, zero weights, zero meta inference
 * - Preserves canonical sorting order
 */

import type {
  GameplayRelationship,
  GameplayRelationshipType,
  GameplayRelationshipTarget,
  RelationshipFilter,
  Element,
  GameplayActionType
} from './types.ts';
import { matchesRelationshipFilter, compareRelationships } from './predicates.ts';

/**
 * Queries gameplay relationships against an arbitrary multi-dimensional filter.
 * Results are canonically sorted and immutable.
 */
export function queryGameplayRelationships(
  relationships: readonly GameplayRelationship[],
  filter?: RelationshipFilter
): readonly GameplayRelationship[] {
  if (!Array.isArray(relationships)) {
    throw new Error('queryGameplayRelationships requires an array of GameplayRelationship.');
  }

  const filtered = relationships.filter((rel) => matchesRelationshipFilter(rel, filter));
  filtered.sort(compareRelationships);
  return Object.freeze(filtered);
}

/**
 * Finds all relationships originating from a specific source entity (e.g. Resonator).
 */
export function findRelationshipsByEntity(
  relationships: readonly GameplayRelationship[],
  entityId: string
): readonly GameplayRelationship[] {
  return queryGameplayRelationships(relationships, { sourceEntityId: entityId });
}

/**
 * Finds all relationships of a specific relationship type.
 */
export function findRelationshipsByType(
  relationships: readonly GameplayRelationship[],
  relationshipType: GameplayRelationshipType
): readonly GameplayRelationship[] {
  return queryGameplayRelationships(relationships, { relationshipType });
}

/**
 * Finds all relationships matching a specific target kind.
 */
export function findRelationshipsByTargetKind(
  relationships: readonly GameplayRelationship[],
  targetKind: GameplayRelationshipTarget['kind']
): readonly GameplayRelationship[] {
  return queryGameplayRelationships(relationships, { targetKind });
}

/**
 * Finds all relationships targeting a specific element.
 */
export function findRelationshipsByElement(
  relationships: readonly GameplayRelationship[],
  targetElement: Element
): readonly GameplayRelationship[] {
  return queryGameplayRelationships(relationships, { targetElement });
}

/**
 * Finds all relationships targeting a specific action.
 */
export function findRelationshipsByAction(
  relationships: readonly GameplayRelationship[],
  targetAction: GameplayActionType
): readonly GameplayRelationship[] {
  return queryGameplayRelationships(relationships, { targetAction });
}
