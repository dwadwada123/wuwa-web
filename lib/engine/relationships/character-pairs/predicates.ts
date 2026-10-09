/**
 * Wuthering Waves Character-Level Evidence Predicates & Canonical Helpers
 * Phase 7 Step 7: Deterministic Character-Level Evidence Aggregation Contract
 *
 * Provides deterministic ID derivation, canonical sorting comparators, type guards,
 * and multi-criteria filters for CharacterPairEvidenceProfiles.
 */

import { CHARACTER_PAIR_AGGREGATION_RULE_VERSION } from './rules.ts';
import type {
  CharacterPairEvidenceProfile,
  CharacterPairProfileFilter,
  CharacterPairProfileStatus
} from './types.ts';

/**
 * Derives a deterministic canonical identifier for a character pair profile.
 * Format: pair:<patchVersion>:<sourceResonatorId>:<targetResonatorId>:<ruleVersion>
 *
 * Directional preservation:
 * pair:3.7:Jiyan:Mortefi:7.7.1 is strictly distinct from pair:3.7:Mortefi:Jiyan:7.7.1.
 */
export function deriveCharacterPairProfileId(
  patchVersion: string,
  sourceResonatorId: string,
  targetResonatorId: string,
  ruleVersion: string = CHARACTER_PAIR_AGGREGATION_RULE_VERSION
): string {
  return `pair:${patchVersion}:${sourceResonatorId}:${targetResonatorId}:${ruleVersion}`;
}

/**
 * Deterministically sorts string arrays lexicographically.
 */
export function canonicalSortStrings(items: readonly string[]): string[] {
  return [...items].sort((a, b) => a.localeCompare(b));
}

/**
 * Canonical comparator for CharacterPairEvidenceProfile records.
 * Order:
 * 1. sourceResonatorId ascending
 * 2. targetResonatorId ascending
 * 3. pairEvidenceScore descending (non-null before null)
 * 4. profile ID ascending
 */
export function compareCharacterPairProfile(
  a: CharacterPairEvidenceProfile,
  b: CharacterPairEvidenceProfile
): number {
  if (a.sourceResonatorId !== b.sourceResonatorId) {
    return a.sourceResonatorId.localeCompare(b.sourceResonatorId);
  }
  if (a.targetResonatorId !== b.targetResonatorId) {
    return a.targetResonatorId.localeCompare(b.targetResonatorId);
  }

  const scoreA = a.evidenceScoreSummary.pairEvidenceScore;
  const scoreB = b.evidenceScoreSummary.pairEvidenceScore;

  if (scoreA !== null && scoreB !== null) {
    if (scoreA !== scoreB) {
      return scoreB - scoreA; // descending
    }
  } else if (scoreA !== null && scoreB === null) {
    return -1; // non-null first
  } else if (scoreA === null && scoreB !== null) {
    return 1;
  }

  return a.id.localeCompare(b.id);
}

/**
 * Type guard: check if profile is fully evaluated with numerical score.
 */
export function isEvaluatedPairProfile(profile: CharacterPairEvidenceProfile): boolean {
  return profile.status === 'EVALUATED' && profile.evidenceScoreSummary.pairEvidenceScore !== null;
}

/**
 * Type guard: check if profile has partial evaluated evidence.
 */
export function isPartiallyEvaluatedPairProfile(profile: CharacterPairEvidenceProfile): boolean {
  return profile.status === 'PARTIALLY_EVALUATED';
}

/**
 * Type guard: check if profile is blocked by missing context.
 */
export function isMissingContextPairProfile(profile: CharacterPairEvidenceProfile): boolean {
  return profile.status === 'MISSING_CONTEXT';
}

/**
 * Type guard: check if profile has unmodeled evidence.
 */
export function isUnmodeledPairProfile(profile: CharacterPairEvidenceProfile): boolean {
  return profile.status === 'UNMODELED';
}

/**
 * Type guard: check if profile represents an empty pair with no modeled candidates.
 */
export function isEmptyPairProfile(profile: CharacterPairEvidenceProfile): boolean {
  return profile.status === 'EMPTY';
}

/**
 * Type guard: check if profile has an active finite numerical evidence score.
 */
export function hasPairEvidenceScore(profile: CharacterPairEvidenceProfile): boolean {
  return (
    profile.evidenceScoreSummary.pairEvidenceScore !== null &&
    Number.isFinite(profile.evidenceScoreSummary.pairEvidenceScore)
  );
}

/**
 * Evaluates whether a CharacterPairEvidenceProfile matches a filter.
 */
export function matchesPairProfileFilter(
  profile: CharacterPairEvidenceProfile,
  filter: CharacterPairProfileFilter
): boolean {
  if (filter.patchVersion && profile.patchVersion !== filter.patchVersion) {
    return false;
  }
  if (filter.sourceResonatorId && profile.sourceResonatorId !== filter.sourceResonatorId) {
    return false;
  }
  if (filter.targetResonatorId && profile.targetResonatorId !== filter.targetResonatorId) {
    return false;
  }
  if (
    filter.resonatorId &&
    profile.sourceResonatorId !== filter.resonatorId &&
    profile.targetResonatorId !== filter.resonatorId
  ) {
    return false;
  }
  if (filter.status && profile.status !== filter.status) {
    return false;
  }
  if (filter.hasScore !== undefined) {
    const hasScore = hasPairEvidenceScore(profile);
    if (filter.hasScore !== hasScore) {
      return false;
    }
  }
  if (filter.qualificationType && !profile.qualificationTypes.includes(filter.qualificationType)) {
    return false;
  }
  if (filter.qualificationNature && !profile.qualificationNatures.includes(filter.qualificationNature)) {
    return false;
  }
  if (
    filter.matchedDimensionKind &&
    !profile.matchedDimensions.some((d) => d.kind === filter.matchedDimensionKind)
  ) {
    return false;
  }

  const score = profile.evidenceScoreSummary.pairEvidenceScore;
  if (filter.minScore !== undefined) {
    if (score === null || score < filter.minScore) {
      return false;
    }
  }
  if (filter.maxScore !== undefined) {
    if (score === null || score > filter.maxScore) {
      return false;
    }
  }

  return true;
}
