/**
 * Wuthering Waves Deterministic Compatibility Candidate Repository & Queries
 * Phase 7 Step 5: Deterministic Compatibility Candidate Contract & Evidence Qualification
 *
 * Provides deterministic querying, retrieval, and filtering over CompatibilityCandidate records.
 *
 * PURE FUNCTIONS, ZERO ASYNC, ZERO NETWORK, DETERMINISTIC.
 */

import type {
  CompatibilityCandidate,
  CompatibilityCandidateFilter,
  CandidateQualificationType
} from './types.ts';
import {
  matchesCompatibilityCandidateFilter,
  compareCompatibilityCandidate
} from './predicates.ts';
import { generateCompatibilityCandidates } from './candidates.ts';
import { auditProductionCapabilities } from '../../capabilities/builder.ts';
import { auditProductionRelationships } from '../audit.ts';
import { auditProductionInteractionEvidence } from '../composition/audit.ts';

/**
 * Queries a collection of CompatibilityCandidate records against a multi-dimensional filter.
 * Preserves deterministic canonical ordering.
 */
export function queryCompatibilityCandidates(
  candidateList: readonly CompatibilityCandidate[],
  filter?: CompatibilityCandidateFilter
): readonly CompatibilityCandidate[] {
  if (!Array.isArray(candidateList)) {
    throw new Error('queryCompatibilityCandidates requires a valid array of CompatibilityCandidate records.');
  }

  const results = candidateList.filter((candidate) =>
    matchesCompatibilityCandidateFilter(candidate, filter)
  );

  results.sort(compareCompatibilityCandidate);
  return Object.freeze(results);
}

/**
 * Retrieves all compatibility candidate records where the specified capability is source or target.
 */
export function findCompatibilityCandidatesForCapability(
  capabilityId: string,
  candidateList: readonly CompatibilityCandidate[]
): readonly CompatibilityCandidate[] {
  return queryCompatibilityCandidates(candidateList, {
    sourceCapabilityId: capabilityId
  });
}

/**
 * Retrieves all compatibility candidate records where the specified entity is source or target.
 */
export function findCompatibilityCandidatesForEntity(
  entityId: string,
  candidateList: readonly CompatibilityCandidate[]
): readonly CompatibilityCandidate[] {
  return queryCompatibilityCandidates(candidateList, {
    sourceEntityId: entityId
  });
}

/**
 * Retrieves all compatibility candidate records originating from sourceEntity targeting targetEntity.
 */
export function findCompatibilityCandidatesBetweenEntities(
  sourceEntityId: string,
  targetEntityId: string,
  candidateList: readonly CompatibilityCandidate[]
): readonly CompatibilityCandidate[] {
  return queryCompatibilityCandidates(candidateList, {
    sourceEntityId,
    targetEntityId
  });
}

/**
 * Retrieves all compatibility candidate records by qualification type.
 */
export function findCompatibilityCandidatesByType(
  qualificationType: CandidateQualificationType,
  candidateList: readonly CompatibilityCandidate[]
): readonly CompatibilityCandidate[] {
  return queryCompatibilityCandidates(candidateList, {
    qualificationType
  });
}

/**
 * Convenience accessor to retrieve all generated compatibility candidates from production Patch 3.7.
 */
export function getCompatibilityCandidates(): readonly CompatibilityCandidate[] {
  const capAudit = auditProductionCapabilities();
  const relAudit = auditProductionRelationships();
  const eviAudit = auditProductionInteractionEvidence();
  return generateCompatibilityCandidates(
    capAudit.capabilities,
    eviAudit.evidence,
    relAudit.relationships,
    '3.7'
  );
}
