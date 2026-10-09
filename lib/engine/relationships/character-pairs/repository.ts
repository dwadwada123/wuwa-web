/**
 * Wuthering Waves Character-Level Evidence Profile Repository
 * Phase 7 Step 7: Deterministic Character-Level Evidence Aggregation Contract
 *
 * Provides pure query, lookup, and filtering operations over CharacterPairEvidenceProfiles.
 */

import { getCompatibilityCandidates } from '../compatibility/repository.ts';
import { getCompatibilityEvaluations } from '../evaluation/repository.ts';
import {
  aggregateCharacterPairEvidence,
  aggregateCharacterPairEvidences,
  buildEmptyCharacterPairProfile
} from './aggregator.ts';
import { matchesPairProfileFilter, compareCharacterPairProfile } from './predicates.ts';
import type {
  CharacterPairEvidenceProfile,
  CharacterPairProfileFilter,
  CharacterPairAggregationOptions
} from './types.ts';

let _cachedProductionProfiles: readonly CharacterPairEvidenceProfile[] | null = null;
let _cachedProfileMap: Map<string, CharacterPairEvidenceProfile> | null = null;

/**
 * Builds or retrieves the authoritative production CharacterPairEvidenceProfiles catalog for Patch 3.7.
 */
export function getCharacterPairEvidenceProfiles(
  options?: CharacterPairAggregationOptions
): readonly CharacterPairEvidenceProfile[] {
  // If options specify includeEmptyPairs or custom ruleVersion, aggregate dynamically
  if (options?.includeEmptyPairs || options?.ruleVersion) {
    const candidates = getCompatibilityCandidates();
    const evaluations = getCompatibilityEvaluations();
    return aggregateCharacterPairEvidences(evaluations, candidates, undefined, options);
  }

  if (!_cachedProductionProfiles) {
    const candidates = getCompatibilityCandidates();
    const evaluations = getCompatibilityEvaluations();
    const profiles = aggregateCharacterPairEvidences(evaluations, candidates);

    _cachedProductionProfiles = profiles;
    _cachedProfileMap = new Map();
    for (const p of profiles) {
      const key = `${p.sourceResonatorId}:::${p.targetResonatorId}`;
      _cachedProfileMap.set(key, p);
    }
  }

  return _cachedProductionProfiles;
}

/**
 * Looks up a directional CharacterPairEvidenceProfile connecting sourceResonatorId -> targetResonatorId.
 * If no modeled candidates connect this pair, returns an EMPTY profile.
 */
export function getCharacterPairEvidenceProfile(
  sourceResonatorId: string,
  targetResonatorId: string,
  options?: CharacterPairAggregationOptions
): CharacterPairEvidenceProfile {
  // Ensure default catalog is loaded
  getCharacterPairEvidenceProfiles();

  const key = `${sourceResonatorId}:::${targetResonatorId}`;
  if (_cachedProfileMap && _cachedProfileMap.has(key)) {
    return _cachedProfileMap.get(key)!;
  }

  // Not in modeled catalog: returns empty profile (absence of evidence is NOT incompatibility)
  return buildEmptyCharacterPairProfile(sourceResonatorId, targetResonatorId, '3.7', options?.ruleVersion);
}

/**
 * Queries CharacterPairEvidenceProfiles matching arbitrary criteria.
 */
export function queryCharacterPairEvidenceProfiles(
  filter: CharacterPairProfileFilter,
  options?: CharacterPairAggregationOptions
): readonly CharacterPairEvidenceProfile[] {
  const all = getCharacterPairEvidenceProfiles(options);
  const matched = all.filter((p) => matchesPairProfileFilter(p, filter));
  matched.sort(compareCharacterPairProfile);
  return Object.freeze(matched);
}

/**
 * Retrieves all outgoing profiles originating from a source Resonator (sourceResonatorId -> *).
 */
export function getOutgoingProfilesForResonator(
  sourceResonatorId: string,
  options?: CharacterPairAggregationOptions
): readonly CharacterPairEvidenceProfile[] {
  return queryCharacterPairEvidenceProfiles({ sourceResonatorId }, options);
}

/**
 * Retrieves all incoming profiles targeting a beneficiary Resonator (* -> targetResonatorId).
 */
export function getIncomingProfilesForResonator(
  targetResonatorId: string,
  options?: CharacterPairAggregationOptions
): readonly CharacterPairEvidenceProfile[] {
  return queryCharacterPairEvidenceProfiles({ targetResonatorId }, options);
}

/**
 * Clears the internal repository cache (for testing isolation).
 */
export function clearCharacterPairProfileCache(): void {
  _cachedProductionProfiles = null;
  _cachedProfileMap = null;
}
