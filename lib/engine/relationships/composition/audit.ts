/**
 * Wuthering Waves Production Interaction Evidence Audit
 * Phase 7 Step 4: Deterministic Relationship Composition & Interaction Evidence Layer
 *
 * Runs full multi-dimensional reconciliation across all 292 Patch 3.7 capabilities
 * and 735 relationships to audit and measure composed interaction evidence.
 *
 * PURE FUNCTIONS, ZERO LLM, ZERO NETWORK, DETERMINISTIC.
 */

import { auditProductionCapabilities } from '../../capabilities/builder.ts';
import { auditProductionRelationships } from '../audit.ts';
import { composeInteractionEvidence } from './composer.ts';
import type {
  InteractionEvidence,
  InteractionEvidenceType,
  InteractionEvidenceCategory,
  InteractionEvidenceStatus,
  ProductionInteractionAuditMetrics
} from './types.ts';

const ALL_EVIDENCE_TYPES: readonly InteractionEvidenceType[] = [
  'TARGET_EVIDENCE',
  'ACTION_EVIDENCE',
  'ELEMENT_EVIDENCE',
  'OUTRO_EVIDENCE',
  'INTRO_EVIDENCE',
  'NEXT_RESONATOR_EVIDENCE',
  'COORDINATED_ATTACK_EVIDENCE',
  'RESOURCE_EVIDENCE',
  'DEFENSIVE_EVIDENCE',
  'OFFENSIVE_EVIDENCE',
  'MECHANICAL_EVIDENCE'
];

const ALL_EVIDENCE_CATEGORIES: readonly InteractionEvidenceCategory[] = [
  'OFFENSIVE',
  'DEFENSIVE',
  'RESOURCE',
  'TARGETING',
  'ACTION',
  'ELEMENTAL',
  'TRIGGER',
  'TRANSITION',
  'MECHANICAL'
];

const ALL_EVIDENCE_STATUSES: readonly InteractionEvidenceStatus[] = [
  'MODELED',
  'CONTEXTUAL',
  'UNMODELED',
  'UNKNOWN',
  'NOT_APPLICABLE'
];

/**
 * Runs complete production audit over composed interaction evidence for Patch 3.7.
 */
export function auditProductionInteractionEvidence(): ProductionInteractionAuditMetrics {
  const capAudit = auditProductionCapabilities();
  const relAudit = auditProductionRelationships();

  const capabilities = capAudit.capabilities;
  const relationships = relAudit.relationships;

  // Build valid ID lookup sets for verification
  const validCapabilityIds = new Set(capabilities.map((c) => c.capabilityId));
  const validRelationshipIds = new Set(relationships.map((r) => r.relationshipId));

  const evidenceList = composeInteractionEvidence(capabilities, relationships, '3.7');

  const seenIds = new Set<string>();
  let duplicateEvidenceIds = 0;

  for (const evidence of evidenceList) {
    if (seenIds.has(evidence.id)) {
      duplicateEvidenceIds++;
    } else {
      seenIds.add(evidence.id);
    }

    // Invariant A: Valid capability references
    if (!validCapabilityIds.has(evidence.sourceCapabilityId)) {
      throw new Error(`Audit failure: evidence '${evidence.id}' references unknown capability '${evidence.sourceCapabilityId}'.`);
    }

    // Invariant B & C: Valid relationship IDs belonging to 3.7
    for (const relId of evidence.relationshipIds) {
      if (!validRelationshipIds.has(relId)) {
        throw new Error(`Audit failure: evidence '${evidence.id}' references unknown relationship '${relId}'.`);
      }
      if (!relId.startsWith('rel:3.7:')) {
        throw new Error(`Audit failure: evidence '${evidence.id}' references cross-patch relationship '${relId}'.`);
      }
    }

    // Invariant G: Must have provenance
    if (!evidence.provenance || !evidence.provenance.entityId) {
      throw new Error(`Audit failure: evidence '${evidence.id}' is missing provenance.`);
    }

    // Invariant K: UNMODELED must not have fabricated numeric values
    if (evidence.status === 'UNMODELED' && evidence.effectValue !== null) {
      throw new Error(`Audit failure: UNMODELED evidence '${evidence.id}' has non-null effectValue '${evidence.effectValue}'.`);
    }

    // Invariant L: Pairwise evidence strictly requires explicit target linkage
    if (evidence.targetCapabilityId !== undefined) {
      if (!evidence.reasonCodes.includes('EXPLICIT_PAIRWISE_TARGET_LINKAGE')) {
        throw new Error(`Audit failure: pairwise evidence '${evidence.id}' lacks explicit target linkage.`);
      }
    }
  }

  const evidenceByType: Record<InteractionEvidenceType, number> = {} as any;
  for (const t of ALL_EVIDENCE_TYPES) {
    evidenceByType[t] = 0;
  }

  const evidenceByCategory: Record<InteractionEvidenceCategory, number> = {} as any;
  for (const c of ALL_EVIDENCE_CATEGORIES) {
    evidenceByCategory[c] = 0;
  }

  const evidenceByStatus: Record<InteractionEvidenceStatus, number> = {} as any;
  for (const s of ALL_EVIDENCE_STATUSES) {
    evidenceByStatus[s] = 0;
  }

  const evidenceByPatch: Record<string, number> = {};
  const evidenceBySourceEntity: Record<string, number> = {};

  let singleCapabilityEvidence = 0;
  let pairwiseEvidence = 0;
  let explicitTargetPairwiseEvidence = 0;
  let evidenceWithTargetCapabilityId = 0;
  let evidenceWithoutTargetCapabilityId = 0;

  let actionOnlyPairwiseInference = 0;
  let elementOnlyPairwiseInference = 0;
  let outroIntroOnlyPairwiseInference = 0;

  let evidenceInvolvingNextResonator = 0;
  let evidenceInvolvingOutro = 0;
  let evidenceInvolvingIntro = 0;
  let evidenceInvolvingElement = 0;
  let evidenceInvolvingAction = 0;
  let evidenceInvolvingCoordinatedAttack = 0;
  let evidenceInvolvingUnmodeled = 0;

  let evidenceWithNumericValue = 0;
  let evidenceWithoutNumericValue = 0;

  for (const ev of evidenceList) {
    evidenceByType[ev.evidenceType]++;
    evidenceByCategory[ev.category]++;
    evidenceByStatus[ev.status]++;

    if (ev.targetCapabilityId !== undefined) {
      pairwiseEvidence++;
      evidenceWithTargetCapabilityId++;
      if (ev.reasonCodes.includes('EXPLICIT_PAIRWISE_TARGET_LINKAGE')) {
        explicitTargetPairwiseEvidence++;
      } else {
        if (ev.evidenceType === 'ACTION_EVIDENCE') actionOnlyPairwiseInference++;
        if (ev.evidenceType === 'ELEMENT_EVIDENCE') elementOnlyPairwiseInference++;
        if (
          ev.evidenceType === 'NEXT_RESONATOR_EVIDENCE' ||
          ev.evidenceType === 'OUTRO_EVIDENCE' ||
          ev.evidenceType === 'INTRO_EVIDENCE'
        ) {
          outroIntroOnlyPairwiseInference++;
        }
      }
    } else {
      singleCapabilityEvidence++;
      evidenceWithoutTargetCapabilityId++;
    }

    const currentPatch = evidenceByPatch[ev.patchVersion];
    evidenceByPatch[ev.patchVersion] = currentPatch !== undefined ? currentPatch + 1 : 1;

    const currentEntity = evidenceBySourceEntity[ev.sourceEntityId];
    evidenceBySourceEntity[ev.sourceEntityId] = currentEntity !== undefined ? currentEntity + 1 : 1;

    if (ev.effectValue !== null) {
      evidenceWithNumericValue++;
    } else {
      evidenceWithoutNumericValue++;
    }

    if (
      ev.evidenceType === 'NEXT_RESONATOR_EVIDENCE' ||
      ev.dimensions.some((d) => d.kind === 'TARGET' && d.value === 'NEXT_RESONATOR')
    ) {
      evidenceInvolvingNextResonator++;
    }

    if (
      ev.evidenceType === 'OUTRO_EVIDENCE' ||
      ev.dimensions.some((d) => d.kind === 'TRIGGER' && d.value === 'OUTRO')
    ) {
      evidenceInvolvingOutro++;
    }

    if (
      ev.evidenceType === 'INTRO_EVIDENCE' ||
      ev.dimensions.some((d) => d.kind === 'TRIGGER' && d.value === 'INTRO')
    ) {
      evidenceInvolvingIntro++;
    }

    if (
      ev.evidenceType === 'ELEMENT_EVIDENCE' ||
      ev.dimensions.some((d) => d.kind === 'ELEMENT')
    ) {
      evidenceInvolvingElement++;
    }

    if (
      ev.evidenceType === 'ACTION_EVIDENCE' ||
      ev.dimensions.some((d) => d.kind === 'ACTION')
    ) {
      evidenceInvolvingAction++;
    }

    if (
      ev.evidenceType === 'COORDINATED_ATTACK_EVIDENCE' ||
      ev.dimensions.some((d) => d.kind === 'ACTION' && d.value === 'COORDINATED')
    ) {
      evidenceInvolvingCoordinatedAttack++;
    }

    if (ev.status === 'UNMODELED') {
      evidenceInvolvingUnmodeled++;
    }
  }

  return Object.freeze({
    totalCapabilities: capabilities.length,
    totalInputCapabilities: capabilities.length,
    totalInputRelationships: relationships.length,
    totalEvidence: evidenceList.length,
    uniqueEvidenceIds: seenIds.size,
    duplicateEvidenceIds,
    singleCapabilityEvidence,
    pairwiseEvidence,
    explicitTargetPairwiseEvidence,
    evidenceWithTargetCapabilityId,
    evidenceWithoutTargetCapabilityId,
    actionOnlyPairwiseInference,
    elementOnlyPairwiseInference,
    outroIntroOnlyPairwiseInference,
    evidenceByType: Object.freeze(evidenceByType),
    evidenceByCategory: Object.freeze(evidenceByCategory),
    evidenceByStatus: Object.freeze(evidenceByStatus),
    evidenceByPatch: Object.freeze(evidenceByPatch),
    evidenceBySourceEntity: Object.freeze(evidenceBySourceEntity),
    evidenceInvolvingNextResonator,
    evidenceInvolvingOutro,
    evidenceInvolvingIntro,
    evidenceInvolvingElement,
    evidenceInvolvingAction,
    evidenceInvolvingCoordinatedAttack,
    evidenceInvolvingUnmodeled,
    evidenceWithNumericValue,
    evidenceWithoutNumericValue,
    evidence: evidenceList
  });
}
