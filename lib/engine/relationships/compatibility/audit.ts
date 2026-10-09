/**
 * Wuthering Waves Production Compatibility Candidate Audit
 * Phase 7 Step 5: Deterministic Compatibility Candidate Contract & Evidence Qualification
 *
 * Runs full multi-dimensional reconciliation and invariant checks across all
 * Patch 3.7 capabilities, relationships, and interaction evidence records.
 *
 * PURE FUNCTIONS, ZERO LLM, ZERO NETWORK, DETERMINISTIC.
 */

import { auditProductionCapabilities } from '../../capabilities/builder.ts';
import { auditProductionRelationships } from '../audit.ts';
import { auditProductionInteractionEvidence } from '../composition/audit.ts';
import { generateCompatibilityCandidates } from './candidates.ts';
import { deriveCompatibilityCandidateId } from './predicates.ts';
import type {
  CompatibilityCandidate,
  CandidateQualificationType,
  CandidateQualificationNature,
  CandidateDirectionality,
  CompatibilityCandidateStatus,
  ProductionCompatibilityAuditMetrics,
  GameplayCapability,
  GameplayRelationship,
  InteractionEvidence
} from './types.ts';

const ALL_QUALIFICATION_TYPES: readonly CandidateQualificationType[] = [
  'EXPLICIT_TARGET_LINK',
  'ACTION_COMPATIBILITY_CANDIDATE',
  'ELEMENT_COMPATIBILITY_CANDIDATE',
  'TRANSITION_COMPATIBILITY_CANDIDATE',
  'TARGET_SCOPE_COMPATIBILITY_CANDIDATE',
  'RESOURCE_COMPATIBILITY_CANDIDATE',
  'DEFENSIVE_COMPATIBILITY_CANDIDATE',
  'OFFENSIVE_COMPATIBILITY_CANDIDATE',
  'MECHANICAL_COMPATIBILITY_CANDIDATE'
];

const ALL_CANDIDATE_STATUSES: readonly CompatibilityCandidateStatus[] = [
  'STRUCTURALLY_ELIGIBLE',
  'CONTEXTUALLY_ELIGIBLE',
  'MISSING_CONTEXT',
  'CONTEXT_MISMATCH',
  'UNMODELED',
  'UNKNOWN',
  'NOT_APPLICABLE'
];

const ALL_NATURES: readonly CandidateQualificationNature[] = ['EXPLICIT', 'DIMENSIONAL'];
const ALL_DIRECTIONALITIES: readonly CandidateDirectionality[] = ['DIRECTED', 'SYMMETRIC'];

const FORBIDDEN_SCORE_KEYS = [
  'score',
  'synergyScore',
  'compatibilityScore',
  'teamScore',
  'priority',
  'weight',
  'rank',
  'tier',
  'meta',
  'DPS',
  'damageScore',
  'rotationScore',
  'utilityScore',
  'penalty',
  'antiSynergyScore'
];

/**
 * Runs complete production audit over compatibility candidates for Patch 3.7.
 */
export function auditCompatibilityCandidates(
  customCandidates?: readonly CompatibilityCandidate[],
  customCapabilities?: readonly GameplayCapability[],
  customRelationships?: readonly GameplayRelationship[],
  customEvidence?: readonly InteractionEvidence[]
): ProductionCompatibilityAuditMetrics {
  const capAudit = customCapabilities ? { capabilities: customCapabilities } : auditProductionCapabilities();
  const relAudit = customRelationships ? { relationships: customRelationships } : auditProductionRelationships();
  const eviAudit = customEvidence ? { evidence: customEvidence } : auditProductionInteractionEvidence();

  const capabilities = capAudit.capabilities;
  const relationships = relAudit.relationships;
  const evidenceList = eviAudit.evidence;

  const validCapabilityIds = new Set(capabilities.map((c) => c.capabilityId));
  const validRelationshipIds = new Set(relationships.map((r) => r.relationshipId));
  const validEvidenceIds = new Set(evidenceList.map((e) => e.id));

  const candidateList =
    customCandidates ?? generateCompatibilityCandidates(capabilities, evidenceList, relationships, '3.7');

  const seenIds = new Set<string>();
  let duplicateCandidateIds = 0;

  for (let i = 0; i < candidateList.length; i++) {
    const candidate = candidateList[i];

    // Invariant F: No duplicate IDs
    if (seenIds.has(candidate.id)) {
      duplicateCandidateIds++;
    } else {
      seenIds.add(candidate.id);
    }

    // Invariant A: Strict Patch 3.7
    if (candidate.patchVersion !== '3.7') {
      throw new Error(`Audit failure: candidate '${candidate.id}' belongs to non-3.7 patch '${candidate.patchVersion}'.`);
    }

    // Invariant B: Valid source capability
    if (!validCapabilityIds.has(candidate.sourceCapabilityId)) {
      throw new Error(`Audit failure: candidate '${candidate.id}' references unknown source capability '${candidate.sourceCapabilityId}'.`);
    }

    // Invariant C: Valid target capability
    if (!validCapabilityIds.has(candidate.targetCapabilityId)) {
      throw new Error(`Audit failure: candidate '${candidate.id}' references unknown target capability '${candidate.targetCapabilityId}'.`);
    }

    // Distinct character entity invariant
    if (candidate.sourceEntityId === candidate.targetEntityId) {
      throw new Error(`Audit failure: candidate '${candidate.id}' pairs within the same entity '${candidate.sourceEntityId}'.`);
    }

    // Invariant D: Valid evidence references
    for (const eviId of candidate.evidenceIds) {
      if (!validEvidenceIds.has(eviId)) {
        throw new Error(`Audit failure: candidate '${candidate.id}' references unknown evidence '${eviId}'.`);
      }
    }

    // Invariant E: Valid relationship references
    for (const relId of candidate.relationshipIds) {
      if (!validRelationshipIds.has(relId)) {
        throw new Error(`Audit failure: candidate '${candidate.id}' references unknown relationship '${relId}'.`);
      }
    }

    // Invariant I: Deterministic ID generation matches
    const expectedId = deriveCompatibilityCandidateId(
      '3.7',
      candidate.sourceCapabilityId,
      candidate.targetCapabilityId,
      candidate.qualificationType,
      candidate.matchedDimensions,
      candidate.evidenceIds
    );
    if (candidate.id !== expectedId) {
      throw new Error(`Audit failure: candidate '${candidate.id}' ID does not match expected deterministic ID '${expectedId}'.`);
    }

    // Invariant J & K: Explicit vs dimensional nature classification
    if (candidate.qualificationType === 'EXPLICIT_TARGET_LINK') {
      if (candidate.qualificationNature !== 'EXPLICIT') {
        throw new Error(`Audit failure: EXPLICIT_TARGET_LINK candidate '${candidate.id}' is not marked EXPLICIT.`);
      }
    } else {
      if (candidate.qualificationNature !== 'DIMENSIONAL') {
        throw new Error(`Audit failure: dimensional candidate '${candidate.id}' is marked EXPLICIT.`);
      }
    }

    // Invariant M: Zero scoring fields
    for (const forbiddenKey of FORBIDDEN_SCORE_KEYS) {
      if (forbiddenKey in candidate) {
        throw new Error(`Audit failure: candidate '${candidate.id}' contains forbidden scoring key '${forbiddenKey}'.`);
      }
    }

    // Invariant R: UNMODELED values remain null
    if (candidate.status === 'UNMODELED' && candidate.effectValue !== null) {
      throw new Error(`Audit failure: UNMODELED candidate '${candidate.id}' has non-null effectValue '${candidate.effectValue}'.`);
    }

    // Invariant S: UNKNOWN fails closed
    if (candidate.status === 'UNKNOWN') {
      throw new Error(`Audit failure: UNKNOWN candidate '${candidate.id}' was generated.`);
    }
  }

  // Multi-dimensional metrics
  const candidatesByQualificationType: Record<CandidateQualificationType, number> = {} as any;
  for (const t of ALL_QUALIFICATION_TYPES) {
    candidatesByQualificationType[t] = 0;
  }

  const candidatesByStatus: Record<CompatibilityCandidateStatus, number> = {} as any;
  for (const s of ALL_CANDIDATE_STATUSES) {
    candidatesByStatus[s] = 0;
  }

  const candidatesByNature: Record<CandidateQualificationNature, number> = {} as any;
  for (const n of ALL_NATURES) {
    candidatesByNature[n] = 0;
  }

  const candidatesByDirectionality: Record<CandidateDirectionality, number> = {} as any;
  for (const d of ALL_DIRECTIONALITIES) {
    candidatesByDirectionality[d] = 0;
  }

  const candidatesByPatch: Record<string, number> = {};
  const candidatesBySourceEntity: Record<string, number> = {};
  const candidatesByTargetEntity: Record<string, number> = {};

  let explicitTargetCandidates = 0;
  let dimensionalCandidates = 0;

  let actionCandidates = 0;
  let elementCandidates = 0;
  let transitionCandidates = 0;
  let resourceCandidates = 0;
  let defensiveCandidates = 0;
  let offensiveCandidates = 0;
  let mechanicalCandidates = 0;
  let targetScopeCandidates = 0;

  let candidatesInvolvingNextResonator = 0;
  let candidatesInvolvingOutro = 0;
  let candidatesInvolvingIntro = 0;
  let candidatesInvolvingCoordinatedAttack = 0;
  let candidatesInvolvingUnmodeled = 0;

  let candidatesWithTargetCapabilityId = 0;
  let candidatesWithoutTargetCapabilityId = 0;

  let candidatesWithNumericValue = 0;
  let candidatesWithoutNumericValue = 0;

  for (let i = 0; i < candidateList.length; i++) {
    const c = candidateList[i];

    candidatesByQualificationType[c.qualificationType]++;
    candidatesByStatus[c.status]++;
    candidatesByNature[c.qualificationNature]++;
    candidatesByDirectionality[c.directionality]++;

    const pCount = candidatesByPatch[c.patchVersion];
    candidatesByPatch[c.patchVersion] = pCount !== undefined ? pCount + 1 : 1;

    const sCount = candidatesBySourceEntity[c.sourceEntityId];
    candidatesBySourceEntity[c.sourceEntityId] = sCount !== undefined ? sCount + 1 : 1;

    const tCount = candidatesByTargetEntity[c.targetEntityId];
    candidatesByTargetEntity[c.targetEntityId] = tCount !== undefined ? tCount + 1 : 1;

    if (c.qualificationNature === 'EXPLICIT') {
      explicitTargetCandidates++;
    } else {
      dimensionalCandidates++;
    }

    switch (c.qualificationType) {
      case 'ACTION_COMPATIBILITY_CANDIDATE':
        actionCandidates++;
        break;
      case 'ELEMENT_COMPATIBILITY_CANDIDATE':
        elementCandidates++;
        break;
      case 'TRANSITION_COMPATIBILITY_CANDIDATE':
        transitionCandidates++;
        break;
      case 'RESOURCE_COMPATIBILITY_CANDIDATE':
        resourceCandidates++;
        break;
      case 'DEFENSIVE_COMPATIBILITY_CANDIDATE':
        defensiveCandidates++;
        break;
      case 'OFFENSIVE_COMPATIBILITY_CANDIDATE':
        offensiveCandidates++;
        break;
      case 'MECHANICAL_COMPATIBILITY_CANDIDATE':
        mechanicalCandidates++;
        break;
      case 'TARGET_SCOPE_COMPATIBILITY_CANDIDATE':
        targetScopeCandidates++;
        break;
      default:
        break;
    }

    if (
      c.sourceCapability.target === 'NEXT_RESONATOR' ||
      c.matchedDimensions.some((d) => d.value === 'NEXT_RESONATOR')
    ) {
      candidatesInvolvingNextResonator++;
    }

    if (
      c.qualificationType === 'TRANSITION_COMPATIBILITY_CANDIDATE' ||
      c.sourceCapability.actionType === 'OUTRO' ||
      c.matchedDimensions.some((d) => d.kind === 'TRANSITION' && d.value.includes('OUTRO'))
    ) {
      candidatesInvolvingOutro++;
    }

    if (
      c.targetCapability.actionType === 'INTRO' ||
      c.matchedDimensions.some((d) => d.kind === 'TRANSITION' && d.value.includes('INTRO'))
    ) {
      candidatesInvolvingIntro++;
    }

    if (
      c.qualificationType === 'MECHANICAL_COMPATIBILITY_CANDIDATE' ||
      c.matchedDimensions.some((d) => d.kind === 'ACTION' && d.value === 'COORDINATED')
    ) {
      candidatesInvolvingCoordinatedAttack++;
    }

    if (c.status === 'UNMODELED') {
      candidatesInvolvingUnmodeled++;
    }

    if (c.targetCapabilityId !== undefined && c.targetCapabilityId !== '') {
      candidatesWithTargetCapabilityId++;
    } else {
      candidatesWithoutTargetCapabilityId++;
    }

    if (c.effectValue !== null) {
      candidatesWithNumericValue++;
    } else {
      candidatesWithoutNumericValue++;
    }
  }

  return Object.freeze({
    totalInputCapabilities: capabilities.length,
    totalInputRelationships: relationships.length,
    totalInputEvidence: evidenceList.length,
    totalCandidates: candidateList.length,
    uniqueCandidateIds: seenIds.size,
    duplicateCandidateIds,
    explicitTargetCandidates,
    dimensionalCandidates,
    actionCandidates,
    elementCandidates,
    transitionCandidates,
    resourceCandidates,
    defensiveCandidates,
    offensiveCandidates,
    mechanicalCandidates,
    targetScopeCandidates,
    candidatesInvolvingNextResonator,
    candidatesInvolvingOutro,
    candidatesInvolvingIntro,
    candidatesInvolvingCoordinatedAttack,
    candidatesInvolvingUnmodeled,
    candidatesWithTargetCapabilityId,
    candidatesWithoutTargetCapabilityId,
    candidatesByQualificationType: Object.freeze(candidatesByQualificationType),
    candidatesByStatus: Object.freeze(candidatesByStatus),
    candidatesByDirectionality: Object.freeze(candidatesByDirectionality),
    candidatesByNature: Object.freeze(candidatesByNature),
    candidatesByPatch: Object.freeze(candidatesByPatch),
    candidatesBySourceEntity: Object.freeze(candidatesBySourceEntity),
    candidatesByTargetEntity: Object.freeze(candidatesByTargetEntity),
    candidatesWithNumericValue,
    candidatesWithoutNumericValue,
    candidates: candidateList
  });
}
