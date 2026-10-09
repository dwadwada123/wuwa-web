/**
 * Wuthering Waves Production Gameplay Relationship Audit
 * Phase 7 Step 3: Gameplay Relationship & Interaction Contract
 *
 * Runs full multi-dimensional reconciliation across all 292 Patch 3.7 capabilities
 * to measure and audit mechanically proven relationships.
 */

import { auditProductionCapabilities } from '../capabilities/builder.ts';
import { buildGameplayRelationships, buildGameplayRelationshipsForCapability } from './builder.ts';
import type {
  GameplayRelationshipType,
  GameplayRelationshipCategory,
  GameplayRelationshipTarget,
  ProductionRelationshipAuditMetrics
} from './types.ts';

const ALL_RELATIONSHIP_TYPES: readonly GameplayRelationshipType[] = [
  'AMPLIFIES_DAMAGE',
  'AMPLIFIES_ATTRIBUTE',
  'AMPLIFIES_ACTION',
  'REDUCES_DEFENSE',
  'REDUCES_RESISTANCE',
  'PROVIDES_HEALING',
  'PROVIDES_SHIELD',
  'PROVIDES_RESOURCE',
  'REDUCES_COOLDOWN',
  'TRIGGERS',
  'TARGETS',
  'REQUIRES',
  'ELEMENT_MATCH',
  'ACTION_MATCH',
  'NEXT_RESONATOR_INTERACTION',
  'OUTRO_INTERACTION',
  'INTRO_INTERACTION',
  'COORDINATED_ATTACK_INTERACTION',
  'SPECIAL_MECHANIC_INTERACTION'
];

const ALL_RELATIONSHIP_CATEGORIES: readonly GameplayRelationshipCategory[] = [
  'OFFENSIVE',
  'DEFENSIVE',
  'RESOURCE',
  'TARGETING',
  'ACTION',
  'ELEMENTAL',
  'TRIGGER',
  'MECHANICAL'
];

const ALL_TARGET_KINDS: readonly GameplayRelationshipTarget['kind'][] = [
  'CAPABILITY',
  'ENTITY',
  'ELEMENT',
  'ACTION',
  'TARGET_CLASS',
  'NEXT_RESONATOR',
  'NONE'
];

/**
 * Executes a comprehensive production audit across all Patch 3.7 capabilities.
 * Pure and deterministic.
 */
export function auditProductionRelationships(): ProductionRelationshipAuditMetrics {
  const capAudit = auditProductionCapabilities();
  const capabilities = capAudit.capabilities;

  const relationships = buildGameplayRelationships(capabilities);

  const seenIds = new Set<string>();
  let duplicateRelationshipIds = 0;

  for (const rel of relationships) {
    if (seenIds.has(rel.relationshipId)) {
      duplicateRelationshipIds++;
    } else {
      seenIds.add(rel.relationshipId);
    }
  }

  let capabilitiesWithRelationships = 0;
  let capabilitiesWithoutRelationships = 0;
  let unmodeledCapabilitiesProducingRelationships = 0;

  for (const cap of capabilities) {
    const derived = buildGameplayRelationshipsForCapability(cap);
    if (derived.length > 0) {
      capabilitiesWithRelationships++;
      if (cap.status === 'UNMODELED') {
        unmodeledCapabilitiesProducingRelationships++;
      }
    } else {
      capabilitiesWithoutRelationships++;
    }
  }

  const relationshipsByType: Record<GameplayRelationshipType, number> = {} as any;
  for (const type of ALL_RELATIONSHIP_TYPES) {
    relationshipsByType[type] = 0;
  }

  const relationshipsByCategory: Record<GameplayRelationshipCategory, number> = {} as any;
  for (const cat of ALL_RELATIONSHIP_CATEGORIES) {
    relationshipsByCategory[cat] = 0;
  }

  const relationshipsByTargetKind: Record<GameplayRelationshipTarget['kind'], number> = {} as any;
  for (const kind of ALL_TARGET_KINDS) {
    relationshipsByTargetKind[kind] = 0;
  }

  const relationshipsByElement: Record<string, number> = {};
  const relationshipsByAction: Record<string, number> = {};
  const relationshipsByTrigger: Record<string, number> = {};

  let relationshipsWithoutNumericValue = 0;
  let relationshipsWithKnownNumericValue = 0;

  for (const rel of relationships) {
    relationshipsByType[rel.relationshipType]++;
    relationshipsByCategory[rel.category]++;
    relationshipsByTargetKind[rel.target.kind]++;

    if (rel.effectValue === null) {
      relationshipsWithoutNumericValue++;
    } else {
      relationshipsWithKnownNumericValue++;
    }

    if (rel.element) {
      const current = relationshipsByElement[rel.element];
      relationshipsByElement[rel.element] = current !== undefined ? current + 1 : 1;
    }

    if (rel.actionType) {
      const current = relationshipsByAction[rel.actionType];
      relationshipsByAction[rel.actionType] = current !== undefined ? current + 1 : 1;
    }

    if (rel.relationshipType === 'OUTRO_INTERACTION') {
      const current = relationshipsByTrigger['OUTRO'];
      relationshipsByTrigger['OUTRO'] = current !== undefined ? current + 1 : 1;
    } else if (rel.relationshipType === 'INTRO_INTERACTION') {
      const current = relationshipsByTrigger['INTRO'];
      relationshipsByTrigger['INTRO'] = current !== undefined ? current + 1 : 1;
    }
  }

  return Object.freeze({
    totalCapabilities: capabilities.length,
    totalRelationships: relationships.length,
    uniqueRelationshipIds: seenIds.size,
    duplicateRelationshipIds,
    capabilitiesWithRelationships,
    capabilitiesWithoutRelationships,
    relationshipsByType: Object.freeze(relationshipsByType),
    relationshipsByCategory: Object.freeze(relationshipsByCategory),
    relationshipsByTargetKind: Object.freeze(relationshipsByTargetKind),
    relationshipsByElement: Object.freeze(relationshipsByElement),
    relationshipsByAction: Object.freeze(relationshipsByAction),
    relationshipsByTrigger: Object.freeze(relationshipsByTrigger),
    relationshipsWithoutNumericValue,
    relationshipsWithKnownNumericValue,
    unmodeledCapabilitiesProducingRelationships,
    relationships
  });
}
