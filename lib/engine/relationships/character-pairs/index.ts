/**
 * Wuthering Waves Character-Level Evidence Aggregation Module
 * Phase 7 Step 7: Deterministic Character-Level Evidence Aggregation Contract
 *
 * Public API for querying, aggregating, explaining, and auditing directional
 * CharacterPairEvidenceProfiles.
 */

export * from './types.ts';
export * from './rules.ts';
export * from './predicates.ts';
export * from './aggregator.ts';
export * from './repository.ts';
export * from './audit.ts';
export * from './synergy/index.ts';

import type {
  CharacterPairEvidenceProfile,
  CharacterPairProfileExplanation
} from './types.ts';

/**
 * Generates a human-readable deterministic presentation explanation of a CharacterPairEvidenceProfile.
 * Presentation only: this string output MUST NEVER become an engine input.
 */
export function explainCharacterPairEvidenceProfile(
  profile: CharacterPairEvidenceProfile
): CharacterPairProfileExplanation {
  const supportedDims = profile.matchedDimensions.map((d) => `${d.kind}:${d.value}`);
  const scoreStr =
    profile.evidenceScoreSummary.pairEvidenceScore !== null
      ? `${profile.evidenceScoreSummary.pairEvidenceScore}/100`
      : 'null';

  const summary =
    `Character pair ${profile.sourceResonatorId} -> ${profile.targetResonatorId} [Status: ${profile.status}]: ` +
    `Supported by ${profile.candidateIds.length} candidate(s), ` +
    `${profile.evidenceScoreSummary.uniqueEvidenceCount} unique evidence record(s), ` +
    `${profile.evidenceScoreSummary.independentEvaluatedEvidenceCount} independent evaluated evidence lineage(s). ` +
    `Aggregated evidence score: ${scoreStr}.`;

  return Object.freeze({
    profileId: profile.id,
    sourceResonatorId: profile.sourceResonatorId,
    targetResonatorId: profile.targetResonatorId,
    status: profile.status,
    pairEvidenceScore: profile.evidenceScoreSummary.pairEvidenceScore,
    summary,
    supportedDimensions: Object.freeze(supportedDims),
    explanationCodes: profile.explanationCodes
  });
}
