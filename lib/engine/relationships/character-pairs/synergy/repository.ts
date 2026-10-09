/**
 * Wuthering Waves Character Pair Synergy Profile Repository
 * Phase 7 Step 8: Deterministic Character Pair Synergy Evaluation Contract
 *
 * Provides query, lookup, and filtering operations over CharacterPairSynergyProfiles.
 */

import {
  getCharacterPairEvidenceProfiles,
  getCharacterPairEvidenceProfile
} from '../repository.ts';
import {
  evaluateCharacterPairSynergy,
  evaluateCharacterPairSynergies
} from './evaluator.ts';
import { matchesSynergyProfileFilter, compareCharacterPairSynergyProfile } from './predicates.ts';
import type {
  CharacterPairSynergyProfile,
  CharacterPairSynergyProfileFilter,
  CharacterPairSynergyEvaluationOptions
} from './types.ts';

let _cachedProductionSynergyProfiles: readonly CharacterPairSynergyProfile[] | null = null;
let _cachedSynergyProfileMap: Map<string, CharacterPairSynergyProfile> | null = null;

/**
 * Builds or retrieves the authoritative production CharacterPairSynergyProfiles catalog for Patch 3.7.
 */
export function getCharacterPairSynergyProfiles(
  options?: CharacterPairSynergyEvaluationOptions
): readonly CharacterPairSynergyProfile[] {
  // If options specify includeEmptyPairs or custom ruleVersion, evaluate dynamically
  if (options?.includeEmptyPairs || options?.ruleVersion) {
    const evidenceProfiles = getCharacterPairEvidenceProfiles({
      includeEmptyPairs: options?.includeEmptyPairs
    });
    return evaluateCharacterPairSynergies(evidenceProfiles, options);
  }

  if (!_cachedProductionSynergyProfiles) {
    const evidenceProfiles = getCharacterPairEvidenceProfiles();
    const synergyProfiles = evaluateCharacterPairSynergies(evidenceProfiles);

    _cachedProductionSynergyProfiles = synergyProfiles;
    _cachedSynergyProfileMap = new Map();
    for (const p of synergyProfiles) {
      const key = `${p.sourceResonatorId}:::${p.targetResonatorId}`;
      _cachedSynergyProfileMap.set(key, p);
    }
  }

  return _cachedProductionSynergyProfiles;
}

/**
 * Looks up a directional CharacterPairSynergyProfile connecting sourceResonatorId -> targetResonatorId.
 * If no modeled pair evidence exists, returns a NO_EVIDENCE synergy profile.
 */
export function getCharacterPairSynergyProfile(
  sourceResonatorId: string,
  targetResonatorId: string,
  options?: CharacterPairSynergyEvaluationOptions
): CharacterPairSynergyProfile {
  // Ensure default catalog is loaded
  getCharacterPairSynergyProfiles();

  const key = `${sourceResonatorId}:::${targetResonatorId}`;
  if (_cachedSynergyProfileMap && _cachedSynergyProfileMap.has(key)) {
    return _cachedSynergyProfileMap.get(key)!;
  }

  // Fallback to evaluating single pair from Step 7 repository
  const evidenceProfile = getCharacterPairEvidenceProfile(sourceResonatorId, targetResonatorId, {
    includeEmptyPairs: options?.includeEmptyPairs
  });
  return evaluateCharacterPairSynergy(evidenceProfile, options);
}

/**
 * Queries CharacterPairSynergyProfiles matching arbitrary criteria.
 */
export function queryCharacterPairSynergyProfiles(
  filter: CharacterPairSynergyProfileFilter,
  options?: CharacterPairSynergyEvaluationOptions
): readonly CharacterPairSynergyProfile[] {
  const all = getCharacterPairSynergyProfiles(options);
  const matched = all.filter((p) => matchesSynergyProfileFilter(p, filter));
  matched.sort(compareCharacterPairSynergyProfile);
  return Object.freeze(matched);
}

/**
 * Retrieves all outgoing synergy profiles originating from a source Resonator (sourceResonatorId -> *).
 */
export function getOutgoingSynergyProfilesForResonator(
  sourceResonatorId: string,
  options?: CharacterPairSynergyEvaluationOptions
): readonly CharacterPairSynergyProfile[] {
  return queryCharacterPairSynergyProfiles({ sourceResonatorId }, options);
}

/**
 * Retrieves all incoming synergy profiles targeting a beneficiary Resonator (* -> targetResonatorId).
 */
export function getIncomingSynergyProfilesForResonator(
  targetResonatorId: string,
  options?: CharacterPairSynergyEvaluationOptions
): readonly CharacterPairSynergyProfile[] {
  return queryCharacterPairSynergyProfiles({ targetResonatorId }, options);
}

/**
 * Clears the internal repository cache (for testing isolation).
 */
export function clearCharacterPairSynergyProfileCache(): void {
  _cachedProductionSynergyProfiles = null;
  _cachedSynergyProfileMap = null;
}
