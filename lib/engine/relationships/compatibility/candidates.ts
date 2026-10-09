/**
 * Wuthering Waves Deterministic Compatibility Candidate Generator
 * Phase 7 Step 5: Deterministic Compatibility Candidate Contract & Evidence Qualification
 *
 * Deterministically generates CompatibilityCandidate records identifying which
 * capabilities/entities share deterministic structured dimensions making them
 * eligible for future evaluation.
 *
 * PURE FUNCTIONS, ZERO LLM, ZERO NETWORK, FAIL-CLOSED, DETERMINISTIC.
 */

import type {
  GameplayCapability,
  GameplayRelationship,
  InteractionEvidence,
  CompatibilityCandidate,
  CandidateMatchedDimension,
  CandidateQualificationType,
  CandidateQualificationNature,
  CandidateDirectionality,
  CompatibilityCandidateStatus,
  Element,
  GameplayActionType
} from './types.ts';
import {
  deriveCompatibilityCandidateId,
  compareCompatibilityCandidate
} from './predicates.ts';
import { hasExplicitPairwiseTarget } from '../composition/predicates.ts';

const CANONICAL_CONCRETE_ELEMENTS: readonly Element[] = Object.freeze([
  'Fusion',
  'Glacio',
  'Electro',
  'Aero',
  'Spectro',
  'Havoc'
]);

const ATTACK_ACTION_TYPES: readonly GameplayActionType[] = Object.freeze([
  'BASIC',
  'HEAVY',
  'SKILL',
  'LIBERATION',
  'INTRO',
  'COORDINATED'
]);

interface CandidateDraft {
  readonly qualificationType: CandidateQualificationType;
  readonly qualificationNature: CandidateQualificationNature;
  readonly directionality: CandidateDirectionality;
  readonly evidenceIds: readonly string[];
  readonly relationshipIds: readonly string[];
  readonly matchedDimensions: readonly CandidateMatchedDimension[];
  readonly reasonCodes: readonly string[];
}

/**
 * Qualifies compatibility candidate drafts between a source capability and target capability.
 * Strictly requires that source and target belong to distinct entities.
 */
function qualifyDraftsForPair(
  sourceCap: GameplayCapability,
  targetCap: GameplayCapability,
  sourceEvidenceList: readonly InteractionEvidence[],
  sourceRels: readonly GameplayRelationship[]
): readonly CandidateDraft[] {
  // Reject same capability or same character entity
  if (sourceCap.capabilityId === targetCap.capabilityId || sourceCap.entityId === targetCap.entityId) {
    return Object.freeze([]);
  }

  // Reject invalid / unknown capabilities
  if (
    sourceCap.status === 'UNKNOWN' ||
    sourceCap.status === 'NOT_APPLICABLE' ||
    targetCap.status === 'UNKNOWN' ||
    targetCap.status === 'NOT_APPLICABLE'
  ) {
    return Object.freeze([]);
  }

  const drafts: CandidateDraft[] = [];

  // Check 1: Explicit target linkage (strongest structural qualification)
  const explicitRel = sourceRels.find((r) => hasExplicitPairwiseTarget(r, targetCap));
  const explicitEvi = sourceEvidenceList.find(
    (e) => e.targetCapabilityId === targetCap.capabilityId || (e.targetEntityId !== undefined && e.targetEntityId === targetCap.entityId)
  );

  if (explicitRel || explicitEvi) {
    const relIds = explicitRel ? [explicitRel.relationshipId] : [];
    const eviIds = explicitEvi ? [explicitEvi.id] : [];
    drafts.push({
      qualificationType: 'EXPLICIT_TARGET_LINK',
      qualificationNature: 'EXPLICIT',
      directionality: 'DIRECTED',
      evidenceIds: Object.freeze(eviIds),
      relationshipIds: Object.freeze(relIds),
      matchedDimensions: Object.freeze([
        { kind: 'EXPLICIT_TARGET', value: targetCap.capabilityId }
      ]),
      reasonCodes: Object.freeze(['EXPLICIT_TARGET_LINKAGE_QUALIFIED'])
    });
  }

  // For all dimensional qualifications, the source capability MUST have a team-affecting target scope:
  // TEAM, ACTIVE_CHARACTER, or NEXT_RESONATOR. A SELF-only capability cannot qualify teammates.
  const isTeamAffectingSource =
    sourceCap.target === 'TEAM' ||
    sourceCap.target === 'ACTIVE_CHARACTER' ||
    sourceCap.target === 'NEXT_RESONATOR';

  if (!isTeamAffectingSource) {
    return Object.freeze(drafts);
  }

  // Check 2: Action Compatibility Candidate
  // Source amplifies an action type (e.g. AMPLIFIES_ACTION / ACTION_EVIDENCE) and target performs that action type.
  const actionEv = sourceEvidenceList.find((e) => e.evidenceType === 'ACTION_EVIDENCE' && e.actionType !== undefined);
  const actionRel = sourceRels.find(
    (r) => (r.relationshipType === 'AMPLIFIES_ACTION' || r.relationshipType === 'ACTION_MATCH') && r.actionType !== undefined
  );
  const qualifyingAction = actionEv?.actionType ?? actionRel?.actionType;

  if (qualifyingAction && targetCap.actionType === qualifyingAction) {
    const eviIds = actionEv ? [actionEv.id] : [];
    const relIds = actionRel ? [actionRel.relationshipId] : [];
    drafts.push({
      qualificationType: 'ACTION_COMPATIBILITY_CANDIDATE',
      qualificationNature: 'DIMENSIONAL',
      directionality: 'DIRECTED',
      evidenceIds: Object.freeze(eviIds),
      relationshipIds: Object.freeze(relIds),
      matchedDimensions: Object.freeze([
        { kind: 'ACTION', value: qualifyingAction }
      ]),
      reasonCodes: Object.freeze(['ACTION_AMPLIFICATION_RECIPIENT_MATCH'])
    });
  }

  // Check 3: Element Compatibility Candidate
  // Source amplifies an element (e.g. AMPLIFIES_DAMAGE / ELEMENT_EVIDENCE) and target possesses that element.
  const elemEv = sourceEvidenceList.find(
    (e) => e.evidenceType === 'ELEMENT_EVIDENCE' && e.element !== undefined && e.element !== 'NONE'
  );
  const elemRel = sourceRels.find(
    (r) => (r.relationshipType === 'AMPLIFIES_DAMAGE' || r.relationshipType === 'ELEMENT_MATCH') && r.element !== undefined && r.element !== 'NONE'
  );
  const qualifyingElement = elemEv?.element ?? elemRel?.element;

  if (qualifyingElement && targetCap.element !== 'NONE') {
    let elementMatches = false;
    if (qualifyingElement === 'All') {
      elementMatches = targetCap.element !== 'All' && CANONICAL_CONCRETE_ELEMENTS.includes(targetCap.element as Element);
    } else {
      elementMatches = targetCap.element === qualifyingElement;
    }

    if (elementMatches) {
      const eviIds = elemEv ? [elemEv.id] : [];
      const relIds = elemRel ? [elemRel.relationshipId] : [];
      drafts.push({
        qualificationType: 'ELEMENT_COMPATIBILITY_CANDIDATE',
        qualificationNature: 'DIMENSIONAL',
        directionality: 'DIRECTED',
        evidenceIds: Object.freeze(eviIds),
        relationshipIds: Object.freeze(relIds),
        matchedDimensions: Object.freeze([
          { kind: 'ELEMENT', value: targetCap.element }
        ]),
        reasonCodes: Object.freeze(['ELEMENT_DAMAGE_AMPLIFICATION_MATCH'])
      });
    }
  }

  // Check 4: Transition Compatibility Candidate
  // Source is an Outro transition (NEXT_RESONATOR_EVIDENCE or OUTRO_EVIDENCE with NEXT_RESONATOR target)
  // and target is an Intro trigger capability.
  const isOutroTransitionSource =
    sourceEvidenceList.some((e) => e.evidenceType === 'NEXT_RESONATOR_EVIDENCE') ||
    (sourceCap.target === 'NEXT_RESONATOR' && sourceEvidenceList.some((e) => e.evidenceType === 'OUTRO_EVIDENCE')) ||
    (sourceCap.target === 'NEXT_RESONATOR' && sourceCap.actionType === 'OUTRO');

  const isIntroTarget =
    targetCap.actionType === 'INTRO' ||
    targetCap.sourceCode === 'INTRO_SKILL';

  if (isOutroTransitionSource && isIntroTarget) {
    const transitionEv = sourceEvidenceList.find(
      (e) => e.evidenceType === 'NEXT_RESONATOR_EVIDENCE' || e.evidenceType === 'OUTRO_EVIDENCE'
    );
    const transitionRel = sourceRels.find(
      (r) => r.relationshipType === 'NEXT_RESONATOR_INTERACTION' || r.relationshipType === 'OUTRO_INTERACTION'
    );
    const eviIds = transitionEv ? [transitionEv.id] : [];
    const relIds = transitionRel ? [transitionRel.relationshipId] : [];

    drafts.push({
      qualificationType: 'TRANSITION_COMPATIBILITY_CANDIDATE',
      qualificationNature: 'DIMENSIONAL',
      directionality: 'DIRECTED',
      evidenceIds: Object.freeze(eviIds),
      relationshipIds: Object.freeze(relIds),
      matchedDimensions: Object.freeze([
        { kind: 'TRANSITION', value: 'OUTRO_TO_INTRO' },
        { kind: 'TRIGGER', value: 'OUTRO_INTRO' }
      ]),
      reasonCodes: Object.freeze(['OUTRO_TO_INTRO_TRANSITION_CANDIDATE'])
    });
  }

  // Check 5: Resource Compatibility Candidate
  // Source provides resource or reduces cooldown, and target is resource-dependent (e.g. Liberation or cooldown).
  const resourceEv = sourceEvidenceList.find((e) => e.evidenceType === 'RESOURCE_EVIDENCE');
  const resourceRel = sourceRels.find(
    (r) => r.relationshipType === 'PROVIDES_RESOURCE' || r.relationshipType === 'REDUCES_COOLDOWN'
  );

  if (resourceEv || resourceRel) {
    const targetIsResourceRelevant =
      targetCap.actionType === 'LIBERATION' ||
      targetCap.parameter === 'ENERGY_REGEN_PERCENT' ||
      targetCap.parameter === 'RESONANCE_ENERGY' ||
      targetCap.parameter === 'SKILL_COOLDOWN_REDUCTION_PERCENT';

    if (targetIsResourceRelevant) {
      const eviIds = resourceEv ? [resourceEv.id] : [];
      const relIds = resourceRel ? [resourceRel.relationshipId] : [];
      drafts.push({
        qualificationType: 'RESOURCE_COMPATIBILITY_CANDIDATE',
        qualificationNature: 'DIMENSIONAL',
        directionality: 'DIRECTED',
        evidenceIds: Object.freeze(eviIds),
        relationshipIds: Object.freeze(relIds),
        matchedDimensions: Object.freeze([
          { kind: 'RESOURCE', value: sourceCap.parameter }
        ]),
        reasonCodes: Object.freeze(['RESOURCE_PROVISION_CANDIDATE'])
      });
    }
  }

  // Check 6: Defensive Compatibility Candidate
  // Source provides healing or shield to team, target is a combat capability of teammate.
  const defEv = sourceEvidenceList.find((e) => e.evidenceType === 'DEFENSIVE_EVIDENCE');
  const defRel = sourceRels.find(
    (r) => r.relationshipType === 'PROVIDES_HEALING' || r.relationshipType === 'PROVIDES_SHIELD'
  );

  if (defEv || defRel) {
    const targetIsCombatCapability =
      (targetCap.actionType !== undefined && ATTACK_ACTION_TYPES.includes(targetCap.actionType)) ||
      targetCap.category === 'DAMAGE' ||
      targetCap.category === 'OFFENSIVE_SUPPORT';

    if (targetIsCombatCapability) {
      const eviIds = defEv ? [defEv.id] : [];
      const relIds = defRel ? [defRel.relationshipId] : [];
      drafts.push({
        qualificationType: 'DEFENSIVE_COMPATIBILITY_CANDIDATE',
        qualificationNature: 'DIMENSIONAL',
        directionality: 'DIRECTED',
        evidenceIds: Object.freeze(eviIds),
        relationshipIds: Object.freeze(relIds),
        matchedDimensions: Object.freeze([
          { kind: 'DEFENSIVE', value: sourceCap.parameter }
        ]),
        reasonCodes: Object.freeze(['DEFENSIVE_PROVISION_CANDIDATE'])
      });
    }
  }

  // Check 7: Offensive Compatibility Candidate
  // Source provides offensive attribute buff (ATK/CRIT) or shred (DEF/RES) to team, target is offensive capability.
  const offEv = sourceEvidenceList.find((e) => e.evidenceType === 'OFFENSIVE_EVIDENCE');
  const offRel = sourceRels.find(
    (r) =>
      r.relationshipType === 'AMPLIFIES_ATTRIBUTE' ||
      r.relationshipType === 'REDUCES_DEFENSE' ||
      r.relationshipType === 'REDUCES_RESISTANCE'
  );

  if (offEv || offRel) {
    const targetIsOffensive =
      (targetCap.actionType !== undefined && ATTACK_ACTION_TYPES.includes(targetCap.actionType)) ||
      targetCap.category === 'DAMAGE' ||
      targetCap.category === 'OFFENSIVE_SUPPORT';

    if (targetIsOffensive) {
      const eviIds = offEv ? [offEv.id] : [];
      const relIds = offRel ? [offRel.relationshipId] : [];
      drafts.push({
        qualificationType: 'OFFENSIVE_COMPATIBILITY_CANDIDATE',
        qualificationNature: 'DIMENSIONAL',
        directionality: 'DIRECTED',
        evidenceIds: Object.freeze(eviIds),
        relationshipIds: Object.freeze(relIds),
        matchedDimensions: Object.freeze([
          { kind: 'OFFENSIVE', value: sourceCap.parameter }
        ]),
        reasonCodes: Object.freeze(['OFFENSIVE_AMPLIFICATION_CANDIDATE'])
      });
    }
  }

  // Check 8: Mechanical Compatibility Candidate
  // Source provides coordinated attack mechanic, target performs attacks that cooperate with it.
  const mechEv = sourceEvidenceList.find((e) => e.evidenceType === 'COORDINATED_ATTACK_EVIDENCE');
  const mechRel = sourceRels.find(
    (r) => r.relationshipType === 'COORDINATED_ATTACK_INTERACTION' || r.relationshipType === 'SPECIAL_MECHANIC_INTERACTION'
  );

  if (mechEv || mechRel) {
    const targetPerformsAttacks =
      targetCap.actionType !== undefined && ATTACK_ACTION_TYPES.includes(targetCap.actionType);

    if (targetPerformsAttacks) {
      const eviIds = mechEv ? [mechEv.id] : [];
      const relIds = mechRel ? [mechRel.relationshipId] : [];
      drafts.push({
        qualificationType: 'MECHANICAL_COMPATIBILITY_CANDIDATE',
        qualificationNature: 'DIMENSIONAL',
        directionality: 'DIRECTED',
        evidenceIds: Object.freeze(eviIds),
        relationshipIds: Object.freeze(relIds),
        matchedDimensions: Object.freeze([
          { kind: 'MECHANICAL', value: 'COORDINATED' }
        ]),
        reasonCodes: Object.freeze(['COORDINATED_ATTACK_TRIGGER_CANDIDATE'])
      });
    }
  }

  // Check 9: Target Scope Candidate
  // If source has team scope with TARGET_EVIDENCE and no more specific candidate type was produced
  const targetEv = sourceEvidenceList.find((e) => e.evidenceType === 'TARGET_EVIDENCE');
  if (targetEv && drafts.length === 0) {
    drafts.push({
      qualificationType: 'TARGET_SCOPE_COMPATIBILITY_CANDIDATE',
      qualificationNature: 'DIMENSIONAL',
      directionality: 'DIRECTED',
      evidenceIds: Object.freeze([targetEv.id]),
      relationshipIds: Object.freeze(targetEv.relationshipIds),
      matchedDimensions: Object.freeze([
        { kind: 'TARGET_SCOPE', value: sourceCap.target }
      ]),
      reasonCodes: Object.freeze(['TEAM_TARGET_SCOPE_CANDIDATE'])
    });
  }

  return Object.freeze(drafts);
}

/**
 * Generates an immutable, canonically sorted collection of CompatibilityCandidate records
 * composed from approved Step 1 capabilities, Step 3 relationships, and Step 4 interaction evidence.
 *
 * Strict patch isolation ('3.7'), deterministic, and deduplicated.
 */
export function generateCompatibilityCandidates(
  capabilities: readonly GameplayCapability[],
  evidenceList: readonly InteractionEvidence[],
  relationships: readonly GameplayRelationship[],
  expectedPatch: string = '3.7'
): readonly CompatibilityCandidate[] {
  if (!Array.isArray(capabilities) || !Array.isArray(evidenceList) || !Array.isArray(relationships)) {
    throw new Error('generateCompatibilityCandidates requires valid arrays of capabilities, evidence, and relationships.');
  }

  // Strict patch boundary validation
  for (let i = 0; i < capabilities.length; i++) {
    const cap = capabilities[i];
    if (cap.patchVersion !== expectedPatch) {
      throw new Error(
        `Candidate engine rejects cross-patch capability '${cap.capabilityId}' with patchVersion '${cap.patchVersion}'. Expected '${expectedPatch}'.`
      );
    }
  }

  for (let i = 0; i < evidenceList.length; i++) {
    const ev = evidenceList[i];
    if (ev.patchVersion !== expectedPatch) {
      throw new Error(
        `Candidate engine rejects cross-patch evidence '${ev.id}' with patchVersion '${ev.patchVersion}'. Expected '${expectedPatch}'.`
      );
    }
  }

  for (let i = 0; i < relationships.length; i++) {
    const rel = relationships[i];
    if (rel.patchVersion !== expectedPatch) {
      throw new Error(
        `Candidate engine rejects cross-patch relationship '${rel.relationshipId}' with patchVersion '${rel.patchVersion}'. Expected '${expectedPatch}'.`
      );
    }
  }

  // Fast index structures
  const evidenceByCapId = new Map<string, InteractionEvidence[]>();
  for (const ev of evidenceList) {
    const existing = evidenceByCapId.get(ev.sourceCapabilityId);
    if (existing) {
      existing.push(ev);
    } else {
      evidenceByCapId.set(ev.sourceCapabilityId, [ev]);
    }
  }

  const relsByCapId = new Map<string, GameplayRelationship[]>();
  for (const rel of relationships) {
    const existing = relsByCapId.get(rel.sourceCapabilityId);
    if (existing) {
      existing.push(rel);
    } else {
      relsByCapId.set(rel.sourceCapabilityId, [rel]);
    }
  }

  const candidateMap = new Map<string, CompatibilityCandidate>();

  for (let i = 0; i < capabilities.length; i++) {
    const sourceCap = capabilities[i];
    if (sourceCap.status === 'UNKNOWN' || sourceCap.status === 'NOT_APPLICABLE') {
      continue;
    }

    const sourceEv = evidenceByCapId.get(sourceCap.capabilityId) ?? [];
    const sourceRel = relsByCapId.get(sourceCap.capabilityId) ?? [];

    for (let j = 0; j < capabilities.length; j++) {
      const targetCap = capabilities[j];
      if (sourceCap.capabilityId === targetCap.capabilityId || sourceCap.entityId === targetCap.entityId) {
        continue;
      }
      if (targetCap.status === 'UNKNOWN' || targetCap.status === 'NOT_APPLICABLE') {
        continue;
      }

      const drafts = qualifyDraftsForPair(sourceCap, targetCap, sourceEv, sourceRel);

      for (const draft of drafts) {
        const id = deriveCompatibilityCandidateId(
          '3.7',
          sourceCap.capabilityId,
          targetCap.capabilityId,
          draft.qualificationType,
          draft.matchedDimensions,
          draft.evidenceIds
        );

        if (candidateMap.has(id)) {
          continue;
        }

        let status: CompatibilityCandidateStatus;
        if (sourceCap.status === 'UNMODELED' || targetCap.status === 'UNMODELED') {
          status = 'UNMODELED';
        } else if (sourceCap.isStatic && targetCap.isStatic) {
          status = 'STRUCTURALLY_ELIGIBLE';
        } else {
          status = 'CONTEXTUALLY_ELIGIBLE';
        }

        const effectValue =
          status === 'UNMODELED' || !sourceCap.isNumericValueKnown || sourceCap.numericValue === null
            ? null
            : sourceCap.numericValue;

        const candidate: CompatibilityCandidate = Object.freeze({
          id,
          patchVersion: '3.7',
          sourceCapabilityId: sourceCap.capabilityId,
          sourceEntityId: sourceCap.entityId,
          sourceCode: sourceCap.sourceCode,
          targetCapabilityId: targetCap.capabilityId,
          targetEntityId: targetCap.entityId,
          targetCode: targetCap.sourceCode,
          qualificationType: draft.qualificationType,
          qualificationNature: draft.qualificationNature,
          directionality: draft.directionality,
          evidenceIds: draft.evidenceIds,
          relationshipIds: draft.relationshipIds,
          matchedDimensions: draft.matchedDimensions,
          sourceCapability: sourceCap,
          targetCapability: targetCap,
          status,
          effectValue,
          unit: sourceCap.unit ?? null,
          requiredContext: sourceCap.requiredContext
            ? Object.freeze({ ...sourceCap.requiredContext })
            : undefined,
          contextRequirements: sourceCap.contextRequirements,
          sourceFactIds: Object.freeze([...sourceCap.factIds, ...targetCap.factIds]),
          provenance: sourceCap.provenance,
          reasonCodes: draft.reasonCodes
        });

        candidateMap.set(id, candidate);
      }
    }
  }

  const allCandidates = Array.from(candidateMap.values());
  allCandidates.sort(compareCompatibilityCandidate);

  return Object.freeze(allCandidates);
}
