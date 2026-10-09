/**
 * Wuthering Waves Deterministic Interaction Evidence Repository & Queries
 * Phase 7 Step 4: Deterministic Relationship Composition & Interaction Evidence Layer
 *
 * Provides deterministic querying, retrieval, and filtering over composed InteractionEvidence.
 *
 * PURE FUNCTIONS, ZERO ASYNC, ZERO NETWORK, DETERMINISTIC.
 */

import type {
  GameplayCapability,
  GameplayRelationship,
  InteractionEvidence,
  InteractionEvidenceFilter,
  InteractionEvidenceType
} from './types.ts';
import {
  matchesInteractionEvidenceFilter,
  compareInteractionEvidence
} from './predicates.ts';
import {
  composeInteractionEvidence,
  composePairwiseInteractionEvidence
} from './composer.ts';
import { auditProductionCapabilities } from '../../capabilities/builder.ts';
import { auditProductionRelationships } from '../audit.ts';

/**
 * Queries a collection of InteractionEvidence records against a multi-dimensional filter.
 * Preserves deterministic canonical ordering.
 */
export function queryInteractionEvidence(
  evidenceList: readonly InteractionEvidence[],
  filter?: InteractionEvidenceFilter
): readonly InteractionEvidence[] {
  if (!Array.isArray(evidenceList)) {
    throw new Error('queryInteractionEvidence requires a valid array of InteractionEvidence.');
  }

  const results = evidenceList.filter((evidence) =>
    matchesInteractionEvidenceFilter(evidence, filter)
  );

  results.sort(compareInteractionEvidence);
  return Object.freeze(results);
}

/**
 * Retrieves all interaction evidence records where the specified capability is either source or target.
 */
export function findEvidenceForCapability(
  capabilityId: string,
  evidenceList: readonly InteractionEvidence[]
): readonly InteractionEvidence[] {
  return queryInteractionEvidence(evidenceList, {
    sourceCapabilityId: capabilityId
  });
}

/**
 * Retrieves all interaction evidence records for a specific resonator or entity.
 */
export function findEvidenceForEntity(
  entityId: string,
  evidenceList: readonly InteractionEvidence[]
): readonly InteractionEvidence[] {
  return queryInteractionEvidence(evidenceList, {
    sourceEntityId: entityId
  });
}

/**
 * Retrieves interaction evidence records by specific evidence type.
 */
export function findEvidenceByType(
  evidenceType: InteractionEvidenceType,
  evidenceList: readonly InteractionEvidence[]
): readonly InteractionEvidence[] {
  return queryInteractionEvidence(evidenceList, {
    evidenceType
  });
}

/**
 * Determines and retrieves pairwise interaction evidence between two distinct capabilities.
 * If relationships are not provided, looks them up from the capabilities.
 */
export function findEvidenceBetweenCapabilities(
  sourceCapability: GameplayCapability,
  targetCapability: GameplayCapability,
  sourceRelationships?: readonly GameplayRelationship[],
  targetRelationships?: readonly GameplayRelationship[]
): readonly InteractionEvidence[] {
  const sRels = sourceRelationships ?? [];
  const tRels = targetRelationships ?? [];
  return composePairwiseInteractionEvidence(sourceCapability, targetCapability, sRels, tRels);
}

/**
 * Convenience accessor to retrieve all composed interaction evidence from production Patch 3.7.
 */
export function getInteractionEvidence(): readonly InteractionEvidence[] {
  const capAudit = auditProductionCapabilities();
  const relAudit = auditProductionRelationships();
  return composeInteractionEvidence(capAudit.capabilities, relAudit.relationships, '3.7');
}
