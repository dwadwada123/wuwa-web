/**
 * Wuthering Waves Gameplay Relationship Predicates & Classifiers
 * Phase 7 Step 3: Gameplay Relationship & Interaction Contract
 *
 * Provides pure, deterministic functions to classify relationships, evaluate filter criteria,
 * sort canonically, and evaluate runtime applicability by delegating to Phase 7 Step 2 resolution.
 *
 * CENTRAL INVARIANT:
 * These predicates classify and filter mechanical evidence.
 * They DO NOT score, rank, weight, or compare meta value.
 */

import type {
  GameplayRelationship,
  GameplayRelationshipCategory,
  GameplayRelationshipType,
  RelationshipFilter,
  RuntimeEvaluationContext,
  GameplayCapability,
  SemanticTarget,
  Element,
  GameplayActionType
} from './types.ts';
import { resolveGameplayCapability } from '../capabilities/resolution/resolver.ts';

/**
 * Checks whether a relationship belongs to a specified category.
 */
export function isRelationshipCategory(
  rel: GameplayRelationship,
  category: GameplayRelationshipCategory
): boolean {
  return rel.category === category;
}

export function isOffensiveRelationship(rel: GameplayRelationship): boolean {
  return rel.category === 'OFFENSIVE';
}

export function isDefensiveRelationship(rel: GameplayRelationship): boolean {
  return rel.category === 'DEFENSIVE';
}

export function isResourceRelationship(rel: GameplayRelationship): boolean {
  return rel.category === 'RESOURCE';
}

export function isTargetingRelationship(rel: GameplayRelationship): boolean {
  return rel.category === 'TARGETING';
}

export function isActionRelationship(rel: GameplayRelationship): boolean {
  return rel.category === 'ACTION';
}

export function isElementalRelationship(rel: GameplayRelationship): boolean {
  return rel.category === 'ELEMENTAL';
}

export function isTriggerRelationship(rel: GameplayRelationship): boolean {
  return rel.category === 'TRIGGER';
}

export function isMechanicalRelationship(rel: GameplayRelationship): boolean {
  return rel.category === 'MECHANICAL';
}

/**
 * Checks whether a relationship targets a specific semantic target class.
 */
export function isTargetClass(rel: GameplayRelationship, target: SemanticTarget): boolean {
  return rel.target.kind === 'TARGET_CLASS' && rel.target.target === target;
}

/**
 * Checks whether a relationship targets a specific element.
 */
export function isElementalTarget(rel: GameplayRelationship, element: Element): boolean {
  return rel.target.kind === 'ELEMENT' && rel.target.element === element;
}

/**
 * Checks whether a relationship targets a specific action.
 */
export function isActionTarget(rel: GameplayRelationship, action: GameplayActionType): boolean {
  return rel.target.kind === 'ACTION' && rel.target.actionType === action;
}

/**
 * Deterministic comparison function for sorting relationships canonically.
 * Ordering rules:
 * 1. sourceEntityId ASC
 * 2. relationshipType ASC
 * 3. relationshipId ASC
 */
export function compareRelationships(a: GameplayRelationship, b: GameplayRelationship): number {
  const entityCmp = a.sourceEntityId.localeCompare(b.sourceEntityId);
  if (entityCmp !== 0) return entityCmp;

  const typeCmp = a.relationshipType.localeCompare(b.relationshipType);
  if (typeCmp !== 0) return typeCmp;

  return a.relationshipId.localeCompare(b.relationshipId);
}

/**
 * Evaluates whether a relationship matches a multi-dimensional filter.
 * Semantics:
 * - AND across distinct filter dimensions.
 * - OR within array values of a single dimension.
 * - Pure and deterministic.
 */
export function matchesRelationshipFilter(
  rel: GameplayRelationship,
  filter?: RelationshipFilter
): boolean {
  if (!filter) return true;

  if (filter.patchVersion !== undefined && rel.patchVersion !== filter.patchVersion) {
    return false;
  }

  if (filter.sourceEntityId !== undefined) {
    const allowed = Array.isArray(filter.sourceEntityId)
      ? filter.sourceEntityId
      : [filter.sourceEntityId];
    if (!allowed.includes(rel.sourceEntityId)) return false;
  }

  if (filter.sourceCapabilityId !== undefined) {
    const allowed = Array.isArray(filter.sourceCapabilityId)
      ? filter.sourceCapabilityId
      : [filter.sourceCapabilityId];
    if (!allowed.includes(rel.sourceCapabilityId)) return false;
  }

  if (filter.relationshipType !== undefined) {
    const allowed = Array.isArray(filter.relationshipType)
      ? filter.relationshipType
      : [filter.relationshipType];
    if (!allowed.includes(rel.relationshipType)) return false;
  }

  if (filter.category !== undefined) {
    const allowed = Array.isArray(filter.category) ? filter.category : [filter.category];
    if (!allowed.includes(rel.category)) return false;
  }

  if (filter.targetKind !== undefined) {
    const allowed = Array.isArray(filter.targetKind) ? filter.targetKind : [filter.targetKind];
    if (!allowed.includes(rel.target.kind)) return false;
  }

  if (filter.targetEntity !== undefined) {
    if (rel.target.kind !== 'ENTITY') return false;
    const allowed = Array.isArray(filter.targetEntity) ? filter.targetEntity : [filter.targetEntity];
    if (!allowed.includes(rel.target.entityId)) return false;
  }

  if (filter.targetElement !== undefined) {
    if (rel.target.kind !== 'ELEMENT') return false;
    const allowed = Array.isArray(filter.targetElement)
      ? filter.targetElement
      : [filter.targetElement];
    if (!allowed.includes(rel.target.element)) return false;
  }

  if (filter.targetAction !== undefined) {
    if (rel.target.kind !== 'ACTION') return false;
    const allowed = Array.isArray(filter.targetAction) ? filter.targetAction : [filter.targetAction];
    if (!allowed.includes(rel.target.actionType)) return false;
  }

  if (filter.targetClass !== undefined) {
    if (rel.target.kind !== 'TARGET_CLASS') return false;
    const allowed = Array.isArray(filter.targetClass) ? filter.targetClass : [filter.targetClass];
    if (!allowed.includes(rel.target.target)) return false;
  }

  if (filter.parameter !== undefined) {
    if (!rel.parameter) return false;
    const allowed = Array.isArray(filter.parameter) ? filter.parameter : [filter.parameter];
    if (!allowed.includes(rel.parameter)) return false;
  }

  if (filter.factId !== undefined) {
    const allowed = Array.isArray(filter.factId) ? filter.factId : [filter.factId];
    const hasMatch = rel.sourceFactIds.some((id) => allowed.includes(id));
    if (!hasMatch) return false;
  }

  return true;
}

/**
 * Deterministically evaluates whether a gameplay relationship is applicable under a runtime context.
 *
 * Reuses Phase 7 Step 2 Capability Resolution:
 * If the source capability cannot be resolved as APPLICABLE under the given context,
 * the relationship is strictly non-applicable.
 *
 * Central Invariant: Zero duplication of element matching, action matching, trigger matching,
 * stack conditions, or refinement ranks. Delegates directly to resolveGameplayCapability.
 */
export function isGameplayRelationshipApplicable(
  relationship: GameplayRelationship,
  contextOrCapability?: RuntimeEvaluationContext | GameplayCapability,
  maybeContext?: RuntimeEvaluationContext
): boolean {
  let capability: GameplayCapability | undefined;
  let context: RuntimeEvaluationContext | undefined;

  if (contextOrCapability && 'capabilityId' in contextOrCapability) {
    capability = contextOrCapability as GameplayCapability;
    context = maybeContext;
  } else {
    capability = relationship.sourceCapability;
    context = contextOrCapability as RuntimeEvaluationContext | undefined;
  }

  // If a source capability is available, delegate directly to Step 2 resolver
  if (capability) {
    const resolution = resolveGameplayCapability(capability, context);
    return resolution.applicable;
  }

  // Fallback: Synthesize an immutable capability envelope from relationship data and resolve
  const isUnmodeled =
    relationship.relationshipType === 'SPECIAL_MECHANIC_INTERACTION' ||
    relationship.contextRequirements?.includes('UNMODELED');

  const synthCap: GameplayCapability = Object.freeze({
    capabilityId: relationship.sourceCapabilityId,
    entityId: relationship.sourceEntityId,
    sourceCode: relationship.sourceCode,
    patchVersion: relationship.patchVersion,
    kind: 'GENERIC_DAMAGE',
    category: 'DAMAGE',
    parameter: relationship.parameter ?? 'GENERIC_DAMAGE_PERCENT',
    target:
      relationship.target.kind === 'TARGET_CLASS'
        ? relationship.target.target
        : relationship.target.kind === 'NEXT_RESONATOR'
          ? 'NEXT_RESONATOR'
          : 'SELF',
    element:
      relationship.element ??
      (relationship.target.kind === 'ELEMENT' ? relationship.target.element : 'NONE'),
    actionType:
      relationship.actionType ??
      (relationship.target.kind === 'ACTION' ? relationship.target.actionType : undefined),
    conditions: relationship.condition,
    contextRequirement:
      relationship.contextRequirements && relationship.contextRequirements.length > 0
        ? relationship.contextRequirements.length > 1
          ? 'COMPOSITE'
          : (relationship.contextRequirements[0] as any)
        : 'NONE',
    contextRequirements: relationship.contextRequirements ?? Object.freeze([]),
    requiredContext: relationship.requiredContext,
    requiresRuntimeContext: Boolean(
      relationship.contextRequirements && relationship.contextRequirements.length > 0
    ),
    isContextFree:
      !relationship.contextRequirements || relationship.contextRequirements.length === 0,
    isNumericValueKnown: relationship.effectValue !== null,
    requiresElement: relationship.contextRequirements?.includes('ELEMENT') ?? false,
    requiresAction: relationship.contextRequirements?.includes('ACTION') ?? false,
    requiresTrigger: relationship.contextRequirements?.includes('TRIGGER') ?? false,
    requiresZone: relationship.contextRequirements?.includes('ZONE_STATE') ?? false,
    requiresBuff: relationship.contextRequirements?.includes('BUFF_STATE') ?? false,
    requiresStack: relationship.contextRequirements?.includes('STACK_COUNT') ?? false,
    requiresRefinement: relationship.contextRequirements?.includes('REFINEMENT_RANK') ?? false,
    isStatic: false,
    isContextual: true,
    status: isUnmodeled ? 'UNMODELED' : 'MODELED',
    semanticStatus: isUnmodeled ? 'UNMODELED' : 'SAFE_EXPLICIT',
    consumptionState: isUnmodeled ? 'UNMODELED' : 'CONSUMABLE_CONTEXTUAL',
    parameterSafety: 'DIRECT_ENGINE_FACT',
    numericValue: relationship.effectValue,
    unit: relationship.unit ?? null,
    factIds: relationship.sourceFactIds,
    provenance: relationship.provenance
  });

  const resolution = resolveGameplayCapability(synthCap, context);
  return resolution.applicable;
}
