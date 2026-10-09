/**
 * Wuthering Waves Character Pair Synergy Predicates & Canonical Helpers
 * Phase 7 Step 8: Deterministic Character Pair Synergy Evaluation Contract
 *
 * Provides deterministic ID derivation, canonical sorting comparators, type guards,
 * and multi-criteria filters for CharacterPairSynergyProfiles.
 */

import { CHARACTER_PAIR_SYNERGY_RULE_VERSION } from './rules.ts';
import type {
  CharacterPairSynergyProfile,
  CharacterPairSynergyProfileFilter
} from './types.ts';

/**
 * Derives a deterministic canonical identifier for a character pair synergy profile.
 * Format: pair-synergy:<patchVersion>:<sourceResonatorId>:<targetResonatorId>:<ruleVersion>
 *
 * Directional preservation:
 * pair-synergy:3.7:Jiyan:Mortefi:7.8.1 is strictly distinct from pair-synergy:3.7:Mortefi:Jiyan:7.8.1.
 */
export function deriveCharacterPairSynergyProfileId(
  patchVersion: string,
  sourceResonatorId: string,
  targetResonatorId: string,
  ruleVersion: string = CHARACTER_PAIR_SYNERGY_RULE_VERSION
): string {
  return `pair-synergy:${patchVersion}:${sourceResonatorId}:${targetResonatorId}:${ruleVersion}`;
}

import { canonicalSortStrings } from '../predicates.ts';

/**
 * Canonical comparator for CharacterPairSynergyProfile records.
 * Order:
 * 1. sourceResonatorId ascending
 * 2. targetResonatorId ascending
 * 3. synergyScore descending (non-null before null)
 * 4. profile ID ascending
 */
export function compareCharacterPairSynergyProfile(
  a: CharacterPairSynergyProfile,
  b: CharacterPairSynergyProfile
): number {
  if (a.sourceResonatorId !== b.sourceResonatorId) {
    return a.sourceResonatorId.localeCompare(b.sourceResonatorId);
  }
  if (a.targetResonatorId !== b.targetResonatorId) {
    return a.targetResonatorId.localeCompare(b.targetResonatorId);
  }

  const scoreA = a.synergyScore;
  const scoreB = b.synergyScore;

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
 * Type guard: check if profile has sufficient evaluated evidence supporting synergy.
 */
export function isSynergySupportedProfile(profile: CharacterPairSynergyProfile): boolean {
  return profile.synergyStatus === 'SYNERGY_SUPPORTED' && profile.synergyScore !== null;
}

/**
 * Type guard: check if profile has partial evaluated synergy evidence.
 */
export function isPartialSynergyProfile(profile: CharacterPairSynergyProfile): boolean {
  return profile.synergyStatus === 'PARTIAL_SYNERGY' && profile.synergyScore !== null;
}

/**
 * Type guard: check if profile is blocked by context requirements.
 */
export function isContextDependentSynergyProfile(profile: CharacterPairSynergyProfile): boolean {
  return profile.synergyStatus === 'CONTEXT_DEPENDENT';
}

/**
 * Type guard: check if profile has unmodeled evidence.
 */
export function isUnmodeledSynergyProfile(profile: CharacterPairSynergyProfile): boolean {
  return profile.synergyStatus === 'UNMODELED';
}

/**
 * Type guard: check if profile represents no modeled pair evidence.
 */
export function isNoEvidenceSynergyProfile(profile: CharacterPairSynergyProfile): boolean {
  return profile.synergyStatus === 'NO_EVIDENCE';
}

/**
 * Type guard: check if profile has an active finite numerical synergy score.
 */
export function hasSynergyScore(profile: CharacterPairSynergyProfile): boolean {
  return profile.synergyScore !== null && Number.isFinite(profile.synergyScore);
}

/**
 * Evaluates whether a CharacterPairSynergyProfile matches a filter.
 */
export function matchesSynergyProfileFilter(
  profile: CharacterPairSynergyProfile,
  filter: CharacterPairSynergyProfileFilter
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
  if (filter.synergyStatus && profile.synergyStatus !== filter.synergyStatus) {
    return false;
  }
  if (filter.hasScore !== undefined) {
    const hasScore = hasSynergyScore(profile);
    if (filter.hasScore !== hasScore) {
      return false;
    }
  }
  if (filter.category && !profile.positiveEvidenceTypes.includes(filter.category)) {
    return false;
  }

  const score = profile.synergyScore;
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
