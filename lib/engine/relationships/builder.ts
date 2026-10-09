/**
 * Wuthering Waves Gameplay Relationship Builder
 * Phase 7 Step 3: Gameplay Relationship & Interaction Contract
 *
 * Deterministically constructs immutable GameplayRelationship models from
 * validated Patch 3.7 GameplayCapability instances.
 *
 * PURE FUNCTION, ZERO NETWORK, ZERO LLM, FAIL-CLOSED, DETERMINISTIC.
 */

import type {
  GameplayCapability,
  GameplayRelationship,
  GameplayRelationshipType,
  GameplayRelationshipCategory,
  GameplayRelationshipTarget,
  GameplayRelationshipEvidence,
  GameplayActionType,
  SemanticTarget,
  Element
} from './types.ts';
import { compareRelationships } from './predicates.ts';

/**
 * Deterministically formats the target descriptor string for canonical relationship ID construction.
 */
export function deriveTargetDescriptor(target: GameplayRelationshipTarget): string {
  switch (target.kind) {
    case 'CAPABILITY':
      return `CAP:${target.capabilityId}`;
    case 'ENTITY':
      return `ENT:${target.entityId}`;
    case 'ELEMENT':
      return `ELEM:${target.element}`;
    case 'ACTION':
      return `ACT:${target.actionType}`;
    case 'TARGET_CLASS':
      return `TGT:${target.target}`;
    case 'NEXT_RESONATOR':
      return 'NEXT_RESONATOR';
    case 'NONE':
      return 'NONE';
  }
}

/**
 * Builds a deterministic canonical identifier for a gameplay relationship.
 */
export function deriveRelationshipId(
  patchVersion: string,
  sourceCapabilityId: string,
  relationshipType: GameplayRelationshipType,
  target: GameplayRelationshipTarget,
  parameter?: string
): string {
  const targetDesc = deriveTargetDescriptor(target);
  const paramSuffix = parameter ? `:${parameter}` : '';
  return `rel:${patchVersion}:${sourceCapabilityId}:${relationshipType}:${targetDesc}${paramSuffix}`;
}

interface RelationshipDraft {
  readonly type: GameplayRelationshipType;
  readonly category: GameplayRelationshipCategory;
  readonly target: GameplayRelationshipTarget;
  readonly parameter?: GameplayCapability['parameter'];
  readonly element?: Element | 'All' | 'NONE';
  readonly actionType?: GameplayActionType;
  readonly reasonCode: string;
}

/**
 * Derives structured gameplay relationship drafts from a single GameplayCapability.
 */
function deriveDraftsForCapability(capability: GameplayCapability): readonly RelationshipDraft[] {
  const drafts: RelationshipDraft[] = [];

  // Step 1: Target-based structural relationships
  if (capability.target === 'NEXT_RESONATOR') {
    drafts.push({
      type: 'NEXT_RESONATOR_INTERACTION',
      category: 'TARGETING',
      target: { kind: 'NEXT_RESONATOR' },
      reasonCode: 'TARGET_NEXT_RESONATOR'
    });
  } else if (capability.target === 'TEAM') {
    drafts.push({
      type: 'TARGETS',
      category: 'TARGETING',
      target: { kind: 'TARGET_CLASS', target: 'TEAM' },
      reasonCode: 'TARGET_TEAM'
    });
  } else if (capability.target === 'ACTIVE_CHARACTER') {
    drafts.push({
      type: 'TARGETS',
      category: 'TARGETING',
      target: { kind: 'TARGET_CLASS', target: 'ACTIVE_CHARACTER' },
      reasonCode: 'TARGET_ACTIVE_CHARACTER'
    });
  } else if (capability.target === 'SELF') {
    drafts.push({
      type: 'TARGETS',
      category: 'TARGETING',
      target: { kind: 'TARGET_CLASS', target: 'SELF' },
      reasonCode: 'TARGET_SELF'
    });
  }

  // Step 2: Trigger-based structural relationships
  if (
    capability.conditions?.trigger === 'ON_OUTRO_SKILL' ||
    capability.actionType === 'OUTRO' ||
    capability.sourceCode.toLowerCase().includes('outro')
  ) {
    drafts.push({
      type: 'OUTRO_INTERACTION',
      category: 'TRIGGER',
      target: { kind: 'ACTION', actionType: 'OUTRO' },
      actionType: 'OUTRO',
      reasonCode: 'TRIGGER_OUTRO'
    });
  }

  if (
    capability.conditions?.trigger === 'ON_INTRO_SKILL' ||
    capability.actionType === 'INTRO' ||
    capability.sourceCode.toLowerCase().includes('intro')
  ) {
    drafts.push({
      type: 'INTRO_INTERACTION',
      category: 'TRIGGER',
      target: { kind: 'ACTION', actionType: 'INTRO' },
      actionType: 'INTRO',
      reasonCode: 'TRIGGER_INTRO'
    });
  }

  // Step 3: Mechanical / Action / Attribute interactions
  switch (capability.kind) {
    // Action amplifications & attack-specific damage contributions
    case 'SKILL_DAMAGE_AMPLIFICATION':
    case 'RESONANCE_SKILL_DAMAGE':
      drafts.push({
        type: 'AMPLIFIES_ACTION',
        category: 'ACTION',
        target: { kind: 'ACTION', actionType: 'SKILL' },
        actionType: 'SKILL',
        reasonCode: 'AMPLIFY_SKILL_DAMAGE'
      });
      drafts.push({
        type: 'ACTION_MATCH',
        category: 'ACTION',
        target: { kind: 'ACTION', actionType: 'SKILL' },
        actionType: 'SKILL',
        reasonCode: 'SKILL_ACTION'
      });
      break;

    case 'BASIC_ATTACK_DAMAGE_AMPLIFICATION':
    case 'BASIC_ATTACK_DAMAGE':
      drafts.push({
        type: 'AMPLIFIES_ACTION',
        category: 'ACTION',
        target: { kind: 'ACTION', actionType: 'BASIC' },
        actionType: 'BASIC',
        reasonCode: 'AMPLIFY_BASIC_ATTACK'
      });
      drafts.push({
        type: 'ACTION_MATCH',
        category: 'ACTION',
        target: { kind: 'ACTION', actionType: 'BASIC' },
        actionType: 'BASIC',
        reasonCode: 'BASIC_ATTACK_ACTION'
      });
      break;

    case 'HEAVY_ATTACK_DAMAGE_AMPLIFICATION':
    case 'HEAVY_ATTACK_DAMAGE':
      drafts.push({
        type: 'AMPLIFIES_ACTION',
        category: 'ACTION',
        target: { kind: 'ACTION', actionType: 'HEAVY' },
        actionType: 'HEAVY',
        reasonCode: 'AMPLIFY_HEAVY_ATTACK'
      });
      drafts.push({
        type: 'ACTION_MATCH',
        category: 'ACTION',
        target: { kind: 'ACTION', actionType: 'HEAVY' },
        actionType: 'HEAVY',
        reasonCode: 'HEAVY_ATTACK_ACTION'
      });
      break;

    case 'LIBERATION_DAMAGE_AMPLIFICATION':
    case 'RESONANCE_LIBERATION_DAMAGE':
      drafts.push({
        type: 'AMPLIFIES_ACTION',
        category: 'ACTION',
        target: { kind: 'ACTION', actionType: 'LIBERATION' },
        actionType: 'LIBERATION',
        reasonCode: 'AMPLIFY_LIBERATION'
      });
      drafts.push({
        type: 'ACTION_MATCH',
        category: 'ACTION',
        target: { kind: 'ACTION', actionType: 'LIBERATION' },
        actionType: 'LIBERATION',
        reasonCode: 'LIBERATION_ACTION'
      });
      break;

    case 'COORDINATED_ATTACK_AMPLIFICATION':
      if (capability.status !== 'UNMODELED' && capability.status !== 'UNKNOWN') {
        drafts.push({
          type: 'AMPLIFIES_ACTION',
          category: 'ACTION',
          target: { kind: 'ACTION', actionType: 'COORDINATED' },
          actionType: 'COORDINATED',
          reasonCode: 'AMPLIFY_COORDINATED_ATTACK'
        });
      }
      drafts.push({
        type: 'COORDINATED_ATTACK_INTERACTION',
        category: 'MECHANICAL',
        target: { kind: 'ACTION', actionType: 'COORDINATED' },
        actionType: 'COORDINATED',
        reasonCode: 'COORDINATED_ATTACK_MECHANIC'
      });
      break;

    case 'COORDINATED_ATTACK_DAMAGE':
      drafts.push({
        type: 'COORDINATED_ATTACK_INTERACTION',
        category: 'MECHANICAL',
        target: { kind: 'ACTION', actionType: 'COORDINATED' },
        actionType: 'COORDINATED',
        reasonCode: 'COORDINATED_ATTACK_DAMAGE_SOURCE'
      });
      break;

    // Elemental damage amplifications
    case 'ELEMENTAL_DAMAGE_AMPLIFICATION':
      if (capability.element !== 'NONE' && capability.element !== 'All') {
        drafts.push({
          type: 'AMPLIFIES_DAMAGE',
          category: 'ELEMENTAL',
          target: { kind: 'ELEMENT', element: capability.element },
          element: capability.element,
          reasonCode: 'AMPLIFY_ELEMENTAL_DAMAGE'
        });
        drafts.push({
          type: 'ELEMENT_MATCH',
          category: 'ELEMENTAL',
          target: { kind: 'ELEMENT', element: capability.element },
          element: capability.element,
          reasonCode: 'MATCH_ELEMENT'
        });
      }
      break;

    case 'ALL_ATTRIBUTE_DAMAGE_AMPLIFICATION':
      drafts.push({
        type: 'AMPLIFIES_DAMAGE',
        category: 'OFFENSIVE',
        target: { kind: 'TARGET_CLASS', target: capability.target },
        element: 'All',
        reasonCode: 'AMPLIFY_ALL_ATTRIBUTES'
      });
      break;

    case 'GENERIC_DAMAGE_AMPLIFICATION':
      drafts.push({
        type: 'AMPLIFIES_DAMAGE',
        category: 'OFFENSIVE',
        target: { kind: 'TARGET_CLASS', target: capability.target },
        reasonCode: 'AMPLIFY_GENERIC_DAMAGE'
      });
      break;

    // Attribute amplifications
    case 'ATK_AMPLIFICATION':
      drafts.push({
        type: 'AMPLIFIES_ATTRIBUTE',
        category: 'OFFENSIVE',
        parameter: capability.parameter,
        target: { kind: 'TARGET_CLASS', target: capability.target },
        reasonCode: 'AMPLIFY_ATK'
      });
      break;

    case 'CRIT_RATE_AMPLIFICATION':
      drafts.push({
        type: 'AMPLIFIES_ATTRIBUTE',
        category: 'OFFENSIVE',
        parameter: capability.parameter,
        target: { kind: 'TARGET_CLASS', target: capability.target },
        reasonCode: 'AMPLIFY_CRIT_RATE'
      });
      break;

    case 'CRIT_DAMAGE_AMPLIFICATION':
      drafts.push({
        type: 'AMPLIFIES_ATTRIBUTE',
        category: 'OFFENSIVE',
        parameter: capability.parameter,
        target: { kind: 'TARGET_CLASS', target: capability.target },
        reasonCode: 'AMPLIFY_CRIT_DAMAGE'
      });
      break;

    case 'HP_AMPLIFICATION':
      drafts.push({
        type: 'AMPLIFIES_ATTRIBUTE',
        category: 'DEFENSIVE',
        parameter: capability.parameter,
        target: { kind: 'TARGET_CLASS', target: capability.target },
        reasonCode: 'AMPLIFY_HP'
      });
      break;

    case 'DEF_AMPLIFICATION':
      drafts.push({
        type: 'AMPLIFIES_ATTRIBUTE',
        category: 'DEFENSIVE',
        parameter: capability.parameter,
        target: { kind: 'TARGET_CLASS', target: capability.target },
        reasonCode: 'AMPLIFY_DEF'
      });
      break;

    case 'HEALING_BONUS':
      drafts.push({
        type: 'AMPLIFIES_ATTRIBUTE',
        category: 'DEFENSIVE',
        parameter: capability.parameter,
        target: { kind: 'TARGET_CLASS', target: capability.target },
        reasonCode: 'AMPLIFY_HEALING_BONUS'
      });
      break;

    // Defense & resistance reductions
    case 'DEFENSE_SHRED':
      drafts.push({
        type: 'REDUCES_DEFENSE',
        category: 'OFFENSIVE',
        target: { kind: 'TARGET_CLASS', target: capability.target },
        reasonCode: 'SHRED_DEFENSE'
      });
      break;

    case 'RESISTANCE_SHRED':
      if (capability.element !== 'NONE' && capability.element !== 'All') {
        drafts.push({
          type: 'REDUCES_RESISTANCE',
          category: 'OFFENSIVE',
          target: { kind: 'ELEMENT', element: capability.element },
          element: capability.element,
          reasonCode: 'SHRED_ELEMENTAL_RESISTANCE'
        });
        drafts.push({
          type: 'ELEMENT_MATCH',
          category: 'ELEMENTAL',
          target: { kind: 'ELEMENT', element: capability.element },
          element: capability.element,
          reasonCode: 'MATCH_ELEMENT'
        });
      } else {
        drafts.push({
          type: 'REDUCES_RESISTANCE',
          category: 'OFFENSIVE',
          target: { kind: 'TARGET_CLASS', target: capability.target },
          reasonCode: 'SHRED_RESISTANCE'
        });
      }
      break;

    // Healing & shield provision
    case 'HEALING_PROVISION':
      drafts.push({
        type: 'PROVIDES_HEALING',
        category: 'DEFENSIVE',
        target: { kind: 'TARGET_CLASS', target: capability.target },
        reasonCode: 'PROVIDE_HEALING'
      });
      break;

    case 'SHIELD_PROVISION':
      drafts.push({
        type: 'PROVIDES_SHIELD',
        category: 'DEFENSIVE',
        target: { kind: 'TARGET_CLASS', target: capability.target },
        reasonCode: 'PROVIDE_SHIELD'
      });
      break;

    // Resource management
    case 'ENERGY_REGENERATION':
      drafts.push({
        type: 'PROVIDES_RESOURCE',
        category: 'RESOURCE',
        target: { kind: 'TARGET_CLASS', target: capability.target },
        reasonCode: 'PROVIDE_ENERGY'
      });
      break;

    case 'COOLDOWN_REDUCTION':
      drafts.push({
        type: 'REDUCES_COOLDOWN',
        category: 'RESOURCE',
        target: { kind: 'TARGET_CLASS', target: capability.target },
        reasonCode: 'REDUCE_COOLDOWN'
      });
      break;

    case 'FORTE_RESOURCE_MANAGEMENT':
      drafts.push({
        type: 'PROVIDES_RESOURCE',
        category: 'RESOURCE',
        target: { kind: 'TARGET_CLASS', target: capability.target },
        reasonCode: 'MANAGE_FORTE_RESOURCE'
      });
      break;

    // Unmodeled mechanics
    case 'SPECIAL_MECHANIC':
      drafts.push({
        type: 'SPECIAL_MECHANIC_INTERACTION',
        category: 'MECHANICAL',
        target: { kind: 'NONE' },
        reasonCode: 'UNMODELED_SPECIAL_MECHANIC'
      });
      break;
  }

  // If capability is unmodeled and produced no other mechanical drafts, mark special mechanic
  if (capability.status === 'UNMODELED' && drafts.length === 0) {
    drafts.push({
      type: 'SPECIAL_MECHANIC_INTERACTION',
      category: 'MECHANICAL',
      target: { kind: 'NONE' },
      reasonCode: 'UNMODELED_SPECIAL_MECHANIC'
    });
  }

  return drafts;
}

/**
 * Builds all deterministic GameplayRelationships derived from a single GameplayCapability.
 * Pure, side-effect free, fail-closed, and immutable.
 */
export function buildGameplayRelationshipsForCapability(
  capability: GameplayCapability
): readonly GameplayRelationship[] {
  // Reject non-3.7 patch capabilities
  if (capability.patchVersion !== '3.7') {
    return Object.freeze([]);
  }

  // Unknown capabilities fail closed with zero speculative relationships
  if (capability.status === 'UNKNOWN') {
    return Object.freeze([]);
  }

  // Non-combat utility or flavor capabilities produce zero combat relationships
  if (capability.status === 'NOT_APPLICABLE') {
    return Object.freeze([]);
  }

  const drafts = deriveDraftsForCapability(capability);
  const relationshipMap = new Map<string, GameplayRelationship>();

  // Determine numeric magnitude safely
  const effectValue =
    capability.isNumericValueKnown && capability.numericValue !== null
      ? capability.numericValue
      : null;

  for (const draft of drafts) {
    const relationshipId = deriveRelationshipId(
      '3.7',
      capability.capabilityId,
      draft.type,
      draft.target,
      draft.parameter
    );

    // Strict deduplication by canonical identity
    if (relationshipMap.has(relationshipId)) {
      continue;
    }

    const evidence: GameplayRelationshipEvidence = Object.freeze({
      sourceKind: 'CAPABILITY',
      factIds: capability.factIds,
      capabilityIds: Object.freeze([capability.capabilityId]),
      parameter: draft.parameter ?? capability.parameter,
      target: capability.target,
      element: draft.element ?? capability.element,
      actionType: draft.actionType ?? capability.actionType,
      reasonCode: draft.reasonCode
    });

    const relationship: GameplayRelationship = Object.freeze({
      relationshipId,
      patchVersion: '3.7',
      sourceCapabilityId: capability.capabilityId,
      sourceEntityId: capability.entityId,
      sourceCode: capability.sourceCode,
      relationshipType: draft.type,
      category: draft.category,
      target: Object.freeze({ ...draft.target }) as GameplayRelationshipTarget,
      parameter: draft.parameter ?? capability.parameter,
      element: draft.element ?? capability.element,
      actionType: draft.actionType ?? capability.actionType,
      effectValue,
      unit: capability.unit ?? null,
      condition: capability.conditions ? Object.freeze({ ...capability.conditions }) : undefined,
      requiredContext: capability.requiredContext
        ? Object.freeze({ ...capability.requiredContext })
        : undefined,
      contextRequirements: capability.contextRequirements,
      sourceFactIds: capability.factIds,
      provenance: capability.provenance,
      evidence,
      sourceCapability: capability
    });

    relationshipMap.set(relationshipId, relationship);
  }

  return Object.freeze(Array.from(relationshipMap.values()));
}

/**
 * Builds an immutable, canonically sorted collection of GameplayRelationships
 * derived from a list of GameplayCapabilities.
 */
export function buildGameplayRelationships(
  capabilities: readonly GameplayCapability[],
  expectedPatch: string = '3.7'
): readonly GameplayRelationship[] {
  if (!Array.isArray(capabilities)) {
    throw new Error('buildGameplayRelationships requires a valid array of GameplayCapability.');
  }

  const relationshipMap = new Map<string, GameplayRelationship>();

  for (let i = 0; i < capabilities.length; i++) {
    const cap = capabilities[i];
    if (!cap || typeof cap !== 'object') {
      throw new Error(`Invalid capability encountered at index ${i}.`);
    }

    if (cap.patchVersion !== expectedPatch) {
      throw new Error(
        `Relationship builder rejects cross-patch capability '${cap.capabilityId}' with patchVersion '${cap.patchVersion}'. Expected '${expectedPatch}'.`
      );
    }

    const derived = buildGameplayRelationshipsForCapability(cap);
    for (const rel of derived) {
      if (!relationshipMap.has(rel.relationshipId)) {
        relationshipMap.set(rel.relationshipId, rel);
      }
    }
  }

  const allRelationships = Array.from(relationshipMap.values());
  allRelationships.sort(compareRelationships);

  return Object.freeze(allRelationships);
}
