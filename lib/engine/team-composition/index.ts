/**
 * Wuthering Waves Deterministic Team Composition Candidate Module
 * Phase 7 Step 9: Deterministic Team Composition Candidate Contract
 *
 * Public API for generating, querying, explaining, and auditing order-independent
 * 3-character team composition candidates.
 */

export * from './types.ts';
export * from './rules.ts';
export * from './predicates.ts';
export * from './generator.ts';
export * from './repository.ts';
export * from './audit.ts';
export * from './evaluation/index.ts';
export * from './ranking/index.ts';
export * from './readiness/index.ts';

import type {
  TeamCompositionCandidate,
  TeamCompositionExplanation
} from './types.ts';

/**
 * Generates a human-readable deterministic presentation explanation of a TeamCompositionCandidate.
 * Presentation only: this string output MUST NEVER become an engine input.
 */
export function explainTeamCompositionCandidate(
  candidate: TeamCompositionCandidate
): TeamCompositionExplanation {
  const [a, b, c] = candidate.memberResonatorIds;
  const cats = candidate.supportingSynergyCategories.join(', ') || 'None';
  const qTypes = candidate.qualificationTypes.join(', ') || 'None';

  const summary =
    `Team candidate {${a}, ${b}, ${c}} [Status: ${candidate.qualificationStatus}]: ` +
    `Connected by ${candidate.matchedPairCount}/3 unordered pairs, ` +
    `${candidate.directionalEdgeCount} directional edge(s), ` +
    `${candidate.independentEvidenceLineageCount} independent evidence lineage(s). ` +
    `Qualifications: [${qTypes}]. Categories: [${cats}].`;

  return Object.freeze({
    candidateId: candidate.id,
    members: candidate.memberResonatorIds,
    qualificationStatus: candidate.qualificationStatus,
    summary,
    matchedPairCount: candidate.matchedPairCount,
    directionalEdgeCount: candidate.directionalEdgeCount,
    supportingCategories: candidate.supportingSynergyCategories,
    explanationCodes: candidate.explanationCodes
  });
}
