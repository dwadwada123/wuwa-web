/**
 * Wuthering Waves Deterministic Interaction Evidence Composer
 * Phase 7 Step 4: Deterministic Relationship Composition & Interaction Evidence Layer
 *
 * Deterministically composes Step 3 gameplay relationships into queryable,
 * auditable InteractionEvidence models.
 *
 * PURE FUNCTIONS, ZERO LLM, ZERO NETWORK, FAIL-CLOSED, DETERMINISTIC.
 */

import type {
  GameplayCapability,
  GameplayRelationship,
  InteractionEvidence,
  InteractionEvidenceType,
  InteractionEvidenceCategory,
  InteractionEvidenceStatus,
  InteractionDimension,
  GameplayActionType,
  Element
} from './types.ts';
import { compareInteractionEvidence, hasExplicitPairwiseTarget } from './predicates.ts';

/**
 * Builds a deterministic canonical identifier for an interaction evidence record.
 * Same inputs -> same identifier.
 */
export function deriveInteractionEvidenceId(
  patchVersion: string,
  sourceCapabilityId: string,
  targetCapabilityId: string | undefined,
  evidenceType: InteractionEvidenceType,
  dimensions: readonly InteractionDimension[],
  relationshipIds: readonly string[]
): string {
  const targetDesc = targetCapabilityId ? `target:${targetCapabilityId}` : 'self';
  const dimKey = dimensions
    .map((d) => `${d.kind}:${d.value}`)
    .slice()
    .sort()
    .join(';');
  const relKey = relationshipIds.slice().sort().join('+');
  return `evi:${patchVersion}:${sourceCapabilityId}:${targetDesc}:${evidenceType}:${dimKey}:${relKey}`;
}

interface EvidenceDraft {
  readonly evidenceType: InteractionEvidenceType;
  readonly category: InteractionEvidenceCategory;
  readonly relationshipIds: readonly string[];
  readonly dimensions: readonly InteractionDimension[];
  readonly element?: Element | 'All' | 'NONE';
  readonly actionType?: GameplayActionType;
  readonly reasonCodes: readonly string[];
  readonly targetCapabilityId?: string;
  readonly targetEntityId?: string;
  readonly targetCapability?: GameplayCapability;
}

/**
 * Composes interaction evidence drafts from a single capability's Step 3 relationships.
 */
function composeDraftsForCapability(
  capability: GameplayCapability,
  relationships: readonly GameplayRelationship[]
): readonly EvidenceDraft[] {
  const drafts: EvidenceDraft[] = [];

  const nextResRel = relationships.find((r) => r.relationshipType === 'NEXT_RESONATOR_INTERACTION');
  const outroRel = relationships.find((r) => r.relationshipType === 'OUTRO_INTERACTION');
  const introRel = relationships.find((r) => r.relationshipType === 'INTRO_INTERACTION');
  const coordRel = relationships.find((r) => r.relationshipType === 'COORDINATED_ATTACK_INTERACTION');

  const targetsRel = relationships.find((r) => r.relationshipType === 'TARGETS');
  const actionMatchRel = relationships.find((r) => r.relationshipType === 'ACTION_MATCH');
  const ampActionRel = relationships.find((r) => r.relationshipType === 'AMPLIFIES_ACTION');
  const elemMatchRel = relationships.find((r) => r.relationshipType === 'ELEMENT_MATCH');
  const ampDmgRel = relationships.find((r) => r.relationshipType === 'AMPLIFIES_DAMAGE');
  const ampAttrRel = relationships.find((r) => r.relationshipType === 'AMPLIFIES_ATTRIBUTE');
  const resRel = relationships.find((r) => r.relationshipType === 'PROVIDES_RESOURCE' || r.relationshipType === 'REDUCES_COOLDOWN');
  const defRel = relationships.find((r) => r.relationshipType === 'PROVIDES_HEALING' || r.relationshipType === 'PROVIDES_SHIELD');
  const shredRel = relationships.find((r) => r.relationshipType === 'REDUCES_DEFENSE' || r.relationshipType === 'REDUCES_RESISTANCE');
  const mechRel = relationships.find((r) => r.relationshipType === 'SPECIAL_MECHANIC_INTERACTION');

  // Track which relationship IDs were composed
  const absorbedRelIds = new Set<string>();

  // 1. Next Resonator Outro transition evidence
  if (nextResRel) {
    const relIds = [nextResRel.relationshipId];
    absorbedRelIds.add(nextResRel.relationshipId);

    if (outroRel) {
      relIds.push(outroRel.relationshipId);
      absorbedRelIds.add(outroRel.relationshipId);
    }
    if (targetsRel && capability.target === 'NEXT_RESONATOR') {
      relIds.push(targetsRel.relationshipId);
      absorbedRelIds.add(targetsRel.relationshipId);
    }

    drafts.push({
      evidenceType: 'NEXT_RESONATOR_EVIDENCE',
      category: 'TRANSITION',
      relationshipIds: relIds.sort(),
      dimensions: Object.freeze([
        { kind: 'TARGET', value: 'NEXT_RESONATOR' },
        { kind: 'TRIGGER', value: 'OUTRO' }
      ]),
      actionType: 'OUTRO',
      reasonCodes: Object.freeze(['OUTRO_NEXT_RESONATOR_TRANSITION'])
    });
  } else if (outroRel) {
    // Standalone Outro trigger evidence (e.g. self or team buff on Outro)
    const relIds = [outroRel.relationshipId];
    absorbedRelIds.add(outroRel.relationshipId);

    if (targetsRel) {
      relIds.push(targetsRel.relationshipId);
      absorbedRelIds.add(targetsRel.relationshipId);
    }

    drafts.push({
      evidenceType: 'OUTRO_EVIDENCE',
      category: 'TRIGGER',
      relationshipIds: relIds.sort(),
      dimensions: Object.freeze([
        { kind: 'TRIGGER', value: 'OUTRO' },
        { kind: 'TARGET', value: capability.target }
      ]),
      actionType: 'OUTRO',
      reasonCodes: Object.freeze(['OUTRO_TRIGGER_INTERACTION'])
    });
  }

  // 2. Intro trigger evidence
  if (introRel) {
    const relIds = [introRel.relationshipId];
    absorbedRelIds.add(introRel.relationshipId);

    if (targetsRel) {
      relIds.push(targetsRel.relationshipId);
      absorbedRelIds.add(targetsRel.relationshipId);
    }

    drafts.push({
      evidenceType: 'INTRO_EVIDENCE',
      category: 'TRIGGER',
      relationshipIds: relIds.sort(),
      dimensions: Object.freeze([
        { kind: 'TRIGGER', value: 'INTRO' },
        { kind: 'TARGET', value: capability.target }
      ]),
      actionType: 'INTRO',
      reasonCodes: Object.freeze(['INTRO_TRIGGER_INTERACTION'])
    });
  }

  // 3. Action interaction evidence
  if (ampActionRel || actionMatchRel) {
    const relIds: string[] = [];
    if (ampActionRel) {
      relIds.push(ampActionRel.relationshipId);
      absorbedRelIds.add(ampActionRel.relationshipId);
    }
    if (actionMatchRel) {
      relIds.push(actionMatchRel.relationshipId);
      absorbedRelIds.add(actionMatchRel.relationshipId);
    }
    if (targetsRel) {
      relIds.push(targetsRel.relationshipId);
      absorbedRelIds.add(targetsRel.relationshipId);
    }

    const action = ampActionRel?.actionType ?? actionMatchRel?.actionType ?? capability.actionType ?? 'SKILL';

    drafts.push({
      evidenceType: 'ACTION_EVIDENCE',
      category: 'ACTION',
      relationshipIds: relIds.sort(),
      dimensions: Object.freeze([
        { kind: 'ACTION', value: action },
        { kind: 'TARGET', value: capability.target }
      ]),
      actionType: action,
      reasonCodes: Object.freeze(['ACTION_AMPLIFICATION_MATCH'])
    });
  }

  // 4. Elemental interaction evidence
  if (ampDmgRel || elemMatchRel) {
    const relIds: string[] = [];
    if (ampDmgRel) {
      relIds.push(ampDmgRel.relationshipId);
      absorbedRelIds.add(ampDmgRel.relationshipId);
    }
    if (elemMatchRel) {
      relIds.push(elemMatchRel.relationshipId);
      absorbedRelIds.add(elemMatchRel.relationshipId);
    }
    if (targetsRel) {
      relIds.push(targetsRel.relationshipId);
      absorbedRelIds.add(targetsRel.relationshipId);
    }

    const elem = ampDmgRel?.element ?? elemMatchRel?.element ?? capability.element;

    drafts.push({
      evidenceType: 'ELEMENT_EVIDENCE',
      category: 'ELEMENTAL',
      relationshipIds: relIds.sort(),
      dimensions: Object.freeze([
        { kind: 'ELEMENT', value: elem },
        { kind: 'TARGET', value: capability.target }
      ]),
      element: elem,
      reasonCodes: Object.freeze(['ELEMENTAL_DAMAGE_AMPLIFICATION'])
    });
  }

  // 5. Coordinated attack evidence
  if (coordRel) {
    const relIds = [coordRel.relationshipId];
    absorbedRelIds.add(coordRel.relationshipId);

    if (ampActionRel && ampActionRel.actionType === 'COORDINATED') {
      relIds.push(ampActionRel.relationshipId);
      absorbedRelIds.add(ampActionRel.relationshipId);
    }
    if (targetsRel) {
      relIds.push(targetsRel.relationshipId);
      absorbedRelIds.add(targetsRel.relationshipId);
    }

    drafts.push({
      evidenceType: 'COORDINATED_ATTACK_EVIDENCE',
      category: 'MECHANICAL',
      relationshipIds: relIds.sort(),
      dimensions: Object.freeze([
        { kind: 'ACTION', value: 'COORDINATED' },
        { kind: 'TARGET', value: capability.target }
      ]),
      actionType: 'COORDINATED',
      reasonCodes: Object.freeze(['COORDINATED_ATTACK_MECHANIC'])
    });
  }

  // 6. Resource management evidence
  if (resRel) {
    const relIds = [resRel.relationshipId];
    absorbedRelIds.add(resRel.relationshipId);

    if (targetsRel) {
      relIds.push(targetsRel.relationshipId);
      absorbedRelIds.add(targetsRel.relationshipId);
    }

    drafts.push({
      evidenceType: 'RESOURCE_EVIDENCE',
      category: 'RESOURCE',
      relationshipIds: relIds.sort(),
      dimensions: Object.freeze([
        { kind: 'PARAMETER', value: capability.parameter },
        { kind: 'TARGET', value: capability.target }
      ]),
      reasonCodes: Object.freeze(['RESOURCE_MANAGEMENT_INTERACTION'])
    });
  }

  // 7. Defensive provision evidence
  if (defRel) {
    const relIds = [defRel.relationshipId];
    absorbedRelIds.add(defRel.relationshipId);

    if (targetsRel) {
      relIds.push(targetsRel.relationshipId);
      absorbedRelIds.add(targetsRel.relationshipId);
    }

    drafts.push({
      evidenceType: 'DEFENSIVE_EVIDENCE',
      category: 'DEFENSIVE',
      relationshipIds: relIds.sort(),
      dimensions: Object.freeze([
        { kind: 'PARAMETER', value: capability.parameter },
        { kind: 'TARGET', value: capability.target }
      ]),
      reasonCodes: Object.freeze(['DEFENSIVE_PROVISION_INTERACTION'])
    });
  }

  // 8. Attribute amplification (offensive / defensive) & shred
  if (ampAttrRel || shredRel) {
    const rel = ampAttrRel ?? shredRel!;
    const relIds = [rel.relationshipId];
    absorbedRelIds.add(rel.relationshipId);

    if (targetsRel) {
      relIds.push(targetsRel.relationshipId);
      absorbedRelIds.add(targetsRel.relationshipId);
    }

    const isDef = rel.category === 'DEFENSIVE';
    drafts.push({
      evidenceType: isDef ? 'DEFENSIVE_EVIDENCE' : 'OFFENSIVE_EVIDENCE',
      category: rel.category,
      relationshipIds: relIds.sort(),
      dimensions: Object.freeze([
        { kind: 'PARAMETER', value: capability.parameter },
        { kind: 'TARGET', value: capability.target }
      ]),
      reasonCodes: Object.freeze([isDef ? 'DEFENSIVE_ATTRIBUTE_INTERACTION' : 'OFFENSIVE_ATTRIBUTE_INTERACTION'])
    });
  }

  // 9. Mechanical / Special mechanic evidence
  if (mechRel) {
    const relIds = [mechRel.relationshipId];
    absorbedRelIds.add(mechRel.relationshipId);

    drafts.push({
      evidenceType: 'MECHANICAL_EVIDENCE',
      category: 'MECHANICAL',
      relationshipIds: relIds.sort(),
      dimensions: Object.freeze([
        { kind: 'TARGET', value: capability.target }
      ]),
      reasonCodes: Object.freeze(['SPECIAL_MECHANIC_INTERACTION'])
    });
  }

  // 10. Fallback standalone Target evidence if targetsRel was never absorbed
  if (targetsRel && !absorbedRelIds.has(targetsRel.relationshipId)) {
    drafts.push({
      evidenceType: 'TARGET_EVIDENCE',
      category: 'TARGETING',
      relationshipIds: Object.freeze([targetsRel.relationshipId]),
      dimensions: Object.freeze([
        { kind: 'TARGET', value: capability.target }
      ]),
      reasonCodes: Object.freeze(['STANDALONE_TARGETING_RULE'])
    });
  }

  return drafts;
}

/**
 * Composes InteractionEvidence records derived from a single GameplayCapability and its relationships.
 * Fails closed for UNKNOWN or NOT_APPLICABLE.
 * Pure and immutable.
 */
export function composeInteractionEvidenceForCapability(
  capability: GameplayCapability,
  relationships: readonly GameplayRelationship[]
): readonly InteractionEvidence[] {
  if (capability.patchVersion !== '3.7') {
    return Object.freeze([]);
  }

  if (capability.status === 'UNKNOWN' || capability.status === 'NOT_APPLICABLE') {
    return Object.freeze([]);
  }

  // Filter Step 3 relationships belonging to this capability
  const capRelationships = relationships.filter(
    (r) => r.sourceCapabilityId === capability.capabilityId
  );

  if (capRelationships.length === 0) {
    return Object.freeze([]);
  }

  const drafts = composeDraftsForCapability(capability, capRelationships);
  const evidenceMap = new Map<string, InteractionEvidence>();

  let status: InteractionEvidenceStatus;
  switch (capability.status) {
    case 'MODELED':
      status = 'MODELED';
      break;
    case 'CONTEXTUAL':
      status = 'CONTEXTUAL';
      break;
    case 'UNMODELED':
      status = 'UNMODELED';
      break;
    default:
      status = 'UNKNOWN';
      break;
  }

  // Magnitude handling: strictly null if unmodeled or unknown; never 0
  const effectValue =
    capability.status !== 'UNMODELED' && capability.isNumericValueKnown && capability.numericValue !== null
      ? capability.numericValue
      : null;

  for (const draft of drafts) {
    const id = deriveInteractionEvidenceId(
      '3.7',
      capability.capabilityId,
      undefined,
      draft.evidenceType,
      draft.dimensions,
      draft.relationshipIds
    );

    if (evidenceMap.has(id)) {
      continue;
    }

    const evidence: InteractionEvidence = Object.freeze({
      id,
      patchVersion: '3.7',
      sourceCapabilityId: capability.capabilityId,
      sourceEntityId: capability.entityId,
      sourceCode: capability.sourceCode,
      targetCapabilityId: undefined,
      targetEntityId: capRelationships[0].target.kind === 'ENTITY' ? capRelationships[0].target.entityId : undefined,
      evidenceType: draft.evidenceType,
      category: draft.category,
      relationshipIds: Object.freeze([...draft.relationshipIds]),
      dimensions: draft.dimensions,
      target: Object.freeze({ ...capRelationships[0].target }),
      element: draft.element ?? capability.element,
      actionType: draft.actionType ?? capability.actionType,
      parameter: capability.parameter,
      effectValue,
      unit: capability.unit ?? null,
      requiredContext: capability.requiredContext
        ? Object.freeze({ ...capability.requiredContext })
        : undefined,
      contextRequirements: capability.contextRequirements,
      sourceFactIds: capability.factIds,
      provenance: capability.provenance,
      status,
      reasonCodes: draft.reasonCodes,
      sourceCapability: capability
    });

    evidenceMap.set(id, evidence);
  }

  return Object.freeze(Array.from(evidenceMap.values()));
}

/**
 * Deterministically evaluates whether two distinct capabilities share an explicit mechanical interaction
 * and composes pairwise InteractionEvidence ONLY when an approved Step 3 relationship explicitly targets
 * the target capability or entity.
 *
 * Strict boundary rules:
 * - Shared ACTION alone MUST NOT create pairwise evidence.
 * - Shared ELEMENT alone MUST NOT create pairwise evidence.
 * - OUTRO + INTRO alone MUST NOT create pairwise evidence.
 * - Source amplifier + target performing amplified action MUST NOT create pairwise evidence without explicit target linkage.
 * - Source targeting TEAM + target being a team capability MUST NOT create pairwise evidence without explicit target linkage.
 *
 * Fails closed if no explicit mechanical target linkage is proven.
 */
export function composePairwiseInteractionEvidence(
  sourceCapability: GameplayCapability,
  targetCapability: GameplayCapability,
  sourceRelationships: readonly GameplayRelationship[],
  targetRelationships: readonly GameplayRelationship[]
): readonly InteractionEvidence[] {
  if (sourceCapability.patchVersion !== '3.7' || targetCapability.patchVersion !== '3.7') {
    return Object.freeze([]);
  }

  if (sourceCapability.capabilityId === targetCapability.capabilityId) {
    return Object.freeze([]);
  }

  // Authoritative boundary predicate:
  // Pairwise InteractionEvidence may be generated ONLY when the approved Step 3 structured relationships
  // provide an explicit target linkage to the target capability or entity.
  const explicitRels = sourceRelationships.filter(
    (r) =>
      r.sourceCapabilityId === sourceCapability.capabilityId &&
      hasExplicitPairwiseTarget(r, targetCapability)
  );

  if (explicitRels.length === 0) {
    // Strictly fail-closed: NO pairwise evidence without an explicit target linkage
    return Object.freeze([]);
  }

  const results: InteractionEvidence[] = [];

  for (const rel of explicitRels) {
    let evidenceType: InteractionEvidenceType;
    let category: InteractionEvidenceCategory = rel.category;

    switch (rel.relationshipType) {
      case 'NEXT_RESONATOR_INTERACTION':
        evidenceType = 'NEXT_RESONATOR_EVIDENCE';
        category = 'TRANSITION';
        break;
      case 'OUTRO_INTERACTION':
        evidenceType = 'OUTRO_EVIDENCE';
        category = 'TRIGGER';
        break;
      case 'INTRO_INTERACTION':
        evidenceType = 'INTRO_EVIDENCE';
        category = 'TRIGGER';
        break;
      case 'AMPLIFIES_ACTION':
      case 'ACTION_MATCH':
        evidenceType = 'ACTION_EVIDENCE';
        category = 'ACTION';
        break;
      case 'AMPLIFIES_DAMAGE':
      case 'ELEMENT_MATCH':
        evidenceType = 'ELEMENT_EVIDENCE';
        category = 'ELEMENTAL';
        break;
      case 'COORDINATED_ATTACK_INTERACTION':
        evidenceType = 'COORDINATED_ATTACK_EVIDENCE';
        category = 'MECHANICAL';
        break;
      case 'PROVIDES_RESOURCE':
      case 'REDUCES_COOLDOWN':
        evidenceType = 'RESOURCE_EVIDENCE';
        category = 'RESOURCE';
        break;
      case 'PROVIDES_HEALING':
      case 'PROVIDES_SHIELD':
        evidenceType = 'DEFENSIVE_EVIDENCE';
        category = 'DEFENSIVE';
        break;
      case 'AMPLIFIES_ATTRIBUTE':
        evidenceType = rel.category === 'DEFENSIVE' ? 'DEFENSIVE_EVIDENCE' : 'OFFENSIVE_EVIDENCE';
        category = rel.category;
        break;
      case 'REDUCES_DEFENSE':
      case 'REDUCES_RESISTANCE':
        evidenceType = 'OFFENSIVE_EVIDENCE';
        category = 'OFFENSIVE';
        break;
      case 'TARGETS':
        evidenceType = 'TARGET_EVIDENCE';
        category = 'TARGETING';
        break;
      default:
        evidenceType = 'MECHANICAL_EVIDENCE';
        category = 'MECHANICAL';
        break;
    }

    const targetValue =
      rel.target.kind === 'CAPABILITY'
        ? rel.target.capabilityId
        : rel.target.kind === 'ENTITY'
          ? rel.target.entityId
          : targetCapability.capabilityId;

    const dimensions: InteractionDimension[] = [
      {
        kind: 'TARGET',
        value: targetValue
      }
    ];

    if (rel.actionType) {
      dimensions.push({ kind: 'ACTION', value: rel.actionType });
    }
    if (rel.element) {
      dimensions.push({ kind: 'ELEMENT', value: rel.element });
    }
    if (rel.relationshipType === 'NEXT_RESONATOR_INTERACTION') {
      dimensions.push({ kind: 'TRANSITION', value: 'OUTRO_TO_INTRO' });
    }
    if (rel.relationshipType === 'OUTRO_INTERACTION') {
      dimensions.push({ kind: 'TRIGGER', value: 'OUTRO' });
    }
    if (rel.relationshipType === 'INTRO_INTERACTION') {
      dimensions.push({ kind: 'TRIGGER', value: 'INTRO' });
    }

    const relIds = [rel.relationshipId];

    const id = deriveInteractionEvidenceId(
      '3.7',
      sourceCapability.capabilityId,
      targetCapability.capabilityId,
      evidenceType,
      dimensions,
      relIds
    );

    const effectValue =
      sourceCapability.status !== 'UNMODELED' &&
      sourceCapability.isNumericValueKnown &&
      sourceCapability.numericValue !== null
        ? sourceCapability.numericValue
        : null;

    results.push(
      Object.freeze({
        id,
        patchVersion: '3.7',
        sourceCapabilityId: sourceCapability.capabilityId,
        sourceEntityId: sourceCapability.entityId,
        sourceCode: sourceCapability.sourceCode,
        targetCapabilityId: targetCapability.capabilityId,
        targetEntityId: targetCapability.entityId,
        evidenceType,
        category,
        relationshipIds: Object.freeze(relIds),
        dimensions: Object.freeze(dimensions),
        target: rel.target,
        element: rel.element ?? sourceCapability.element,
        actionType: rel.actionType ?? sourceCapability.actionType,
        parameter: sourceCapability.parameter,
        effectValue,
        unit: sourceCapability.unit ?? null,
        requiredContext: sourceCapability.requiredContext
          ? Object.freeze({ ...sourceCapability.requiredContext })
          : undefined,
        contextRequirements: sourceCapability.contextRequirements,
        sourceFactIds: Object.freeze([...sourceCapability.factIds, ...targetCapability.factIds]),
        provenance: sourceCapability.provenance,
        status: sourceCapability.status === 'UNMODELED' ? 'UNMODELED' : 'CONTEXTUAL',
        reasonCodes: Object.freeze(['EXPLICIT_PAIRWISE_TARGET_LINKAGE']),
        sourceCapability,
        targetCapability
      })
    );
  }

  return Object.freeze(results);
}

/**
 * Builds an immutable, canonically sorted collection of InteractionEvidence
 * composed from a collection of GameplayCapabilities and their Step 3 GameplayRelationships.
 *
 * Strict patch isolation ('3.7'), deterministic, and deduplicated.
 */
export function composeInteractionEvidence(
  capabilities: readonly GameplayCapability[],
  relationships: readonly GameplayRelationship[],
  expectedPatch: string = '3.7'
): readonly InteractionEvidence[] {
  if (!Array.isArray(capabilities) || !Array.isArray(relationships)) {
    throw new Error('composeInteractionEvidence requires valid arrays of capabilities and relationships.');
  }

  // Strict patch boundary validation
  for (let i = 0; i < capabilities.length; i++) {
    const cap = capabilities[i];
    if (cap.patchVersion !== expectedPatch) {
      throw new Error(
        `Composition engine rejects cross-patch capability '${cap.capabilityId}' with patchVersion '${cap.patchVersion}'. Expected '${expectedPatch}'.`
      );
    }
  }

  for (let i = 0; i < relationships.length; i++) {
    const rel = relationships[i];
    if (rel.patchVersion !== expectedPatch) {
      throw new Error(
        `Composition engine rejects cross-patch relationship '${rel.relationshipId}' with patchVersion '${rel.patchVersion}'. Expected '${expectedPatch}'.`
      );
    }
  }

  const evidenceMap = new Map<string, InteractionEvidence>();

  for (const capability of capabilities) {
    const derived = composeInteractionEvidenceForCapability(capability, relationships);
    for (const item of derived) {
      if (!evidenceMap.has(item.id)) {
        evidenceMap.set(item.id, item);
      }
    }
  }

  // Explicit pairwise interaction evidence composition
  // Strictly applies only if a relationship has an explicit target linkage to another capability/entity
  const capById = new Map<string, GameplayCapability>();
  for (const c of capabilities) {
    capById.set(c.capabilityId, c);
  }

  for (const capability of capabilities) {
    const capRelationships = relationships.filter(
      (r) => r.sourceCapabilityId === capability.capabilityId
    );
    for (const rel of capRelationships) {
      if (rel.target.kind === 'CAPABILITY') {
        const targetCap = capById.get(rel.target.capabilityId);
        if (targetCap && targetCap.capabilityId !== capability.capabilityId) {
          const pairwise = composePairwiseInteractionEvidence(capability, targetCap, [rel], []);
          for (const item of pairwise) {
            if (!evidenceMap.has(item.id)) {
              evidenceMap.set(item.id, item);
            }
          }
        }
      } else if (rel.target.kind === 'ENTITY') {
        const targetCaps = capabilities.filter(
          (c) => c.entityId === rel.target.entityId && c.capabilityId !== capability.capabilityId
        );
        for (const targetCap of targetCaps) {
          const pairwise = composePairwiseInteractionEvidence(capability, targetCap, [rel], []);
          for (const item of pairwise) {
            if (!evidenceMap.has(item.id)) {
              evidenceMap.set(item.id, item);
            }
          }
        }
      }
    }
  }

  const allEvidence = Array.from(evidenceMap.values());
  allEvidence.sort(compareInteractionEvidence);

  return Object.freeze(allEvidence);
}
