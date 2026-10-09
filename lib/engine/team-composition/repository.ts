/**
 * Wuthering Waves Team Composition Candidate Repository
 * Phase 7 Step 9: Deterministic Team Composition Candidate Contract
 *
 * Provides pure query, lookup, and filtering operations over TeamCompositionCandidates.
 */

import { auditProductionCapabilities } from '../capabilities/builder.ts';
import { getCharacterPairSynergyProfiles } from '../relationships/character-pairs/synergy/repository.ts';
import {
  generateTeamCompositionCandidate,
  generateTeamCompositionCandidates
} from './generator.ts';
import {
  canonicalizeTeamMembers,
  matchesTeamCompositionFilter,
  compareTeamCompositionCandidate
} from './predicates.ts';
import type {
  TeamCompositionCandidate,
  TeamCompositionCandidateFilter,
  TeamCompositionOptions,
  CharacterPairSynergyProfile
} from './types.ts';

let _cachedProductionCandidates: readonly TeamCompositionCandidate[] | null = null;
let _cachedCandidateMap: Map<string, TeamCompositionCandidate> | null = null;

let _cachedAllCandidates: readonly TeamCompositionCandidate[] | null = null;
let _cachedAllCandidateMap: Map<string, TeamCompositionCandidate> | null = null;

let _cachedKnownResonatorIds: readonly string[] | null = null;

/**
 * Retrieves the canonical sorted list of all 60 known Resonators in Patch 3.7.
 */
export function getKnownResonatorIds(): readonly string[] {
  if (!_cachedKnownResonatorIds) {
    const capList = auditProductionCapabilities().capabilities;
    const knownSet = new Set<string>();
    for (const cap of capList) {
      if (
        cap.provenance.sourceType === 'RESONATOR_ABILITY' ||
        cap.provenance.sourceType === 'RESONATOR_SEQUENCE'
      ) {
        knownSet.add(cap.entityId);
      }
    }
    _cachedKnownResonatorIds = Object.freeze(Array.from(knownSet).sort((a, b) => a.localeCompare(b)));
  }
  return _cachedKnownResonatorIds;
}

/**
 * Builds or retrieves the authoritative production TeamCompositionCandidates catalog for Patch 3.7.
 *
 * Defaults to candidates with modeled pairwise synergy evidence (status !== 'NO_PAIRWISE_EVIDENCE').
 * Pass { includeEmptyTriples: true } to enumerate all theoretical 34,220 triples.
 */
export function getTeamCompositionCandidates(
  options?: TeamCompositionOptions
): readonly TeamCompositionCandidate[] {
  if (options?.ruleVersion) {
    const resonators = getKnownResonatorIds();
    const synergyProfiles = getCharacterPairSynergyProfiles();
    return generateTeamCompositionCandidates(resonators, synergyProfiles, options);
  }

  if (options?.includeEmptyTriples) {
    if (!_cachedAllCandidates) {
      const resonators = getKnownResonatorIds();
      const synergyProfiles = getCharacterPairSynergyProfiles();
      const candidates = generateTeamCompositionCandidates(resonators, synergyProfiles, {
        includeEmptyTriples: true
      });

      _cachedAllCandidates = candidates;
      _cachedAllCandidateMap = new Map();
      for (const c of candidates) {
        const key = c.memberResonatorIds.join(':::');
        _cachedAllCandidateMap.set(key, c);
      }
    }
    return _cachedAllCandidates;
  }

  if (!_cachedProductionCandidates) {
    const resonators = getKnownResonatorIds();
    const synergyProfiles = getCharacterPairSynergyProfiles();
    const candidates = generateTeamCompositionCandidates(resonators, synergyProfiles, {
      includeEmptyTriples: false
    });

    _cachedProductionCandidates = candidates;
    _cachedCandidateMap = new Map();
    for (const c of candidates) {
      const key = c.memberResonatorIds.join(':::');
      _cachedCandidateMap.set(key, c);
    }
  }

  return _cachedProductionCandidates;
}

/**
 * Looks up or generates a TeamCompositionCandidate for three Resonators in any order.
 * Order-independent: getTeamCompositionCandidate('C', 'A', 'B') === getTeamCompositionCandidate('A', 'B', 'C').
 */
export function getTeamCompositionCandidate(
  resonatorA: string,
  resonatorB: string,
  resonatorC: string,
  options?: TeamCompositionOptions
): TeamCompositionCandidate {
  const [a, b, c] = canonicalizeTeamMembers([resonatorA, resonatorB, resonatorC]);
  const key = `${a}:::${b}:::${c}`;

  // Check modeled cache
  if (!options?.ruleVersion) {
    if (_cachedCandidateMap && _cachedCandidateMap.has(key)) {
      return _cachedCandidateMap.get(key)!;
    }
    if (_cachedAllCandidateMap && _cachedAllCandidateMap.has(key)) {
      return _cachedAllCandidateMap.get(key)!;
    }

    // Initialize modeled cache if not loaded yet
    getTeamCompositionCandidates();
    if (_cachedCandidateMap && _cachedCandidateMap.has(key)) {
      return _cachedCandidateMap.get(key)!;
    }
  }

  // Generate on the fly (e.g. for empty triple or custom options)
  const synergyProfiles = getCharacterPairSynergyProfiles();
  return generateTeamCompositionCandidate([a, b, c], synergyProfiles, options);
}

/**
 * Queries TeamCompositionCandidates matching arbitrary criteria.
 */
export function queryTeamCompositionCandidates(
  filter: TeamCompositionCandidateFilter,
  options?: TeamCompositionOptions
): readonly TeamCompositionCandidate[] {
  const all = getTeamCompositionCandidates(options);
  const matched = all.filter((c) => matchesTeamCompositionFilter(c, filter));
  matched.sort(compareTeamCompositionCandidate);
  return Object.freeze(matched);
}

/**
 * Retrieves all team composition candidates containing a specific Resonator.
 */
export function getTeamCompositionCandidatesForResonator(
  resonatorId: string,
  options?: TeamCompositionOptions
): readonly TeamCompositionCandidate[] {
  return queryTeamCompositionCandidates({ resonatorId }, options);
}

/**
 * Clears in-memory candidate caches (for testing and determinism verification).
 */
export function clearTeamCompositionCandidateCache(): void {
  _cachedProductionCandidates = null;
  _cachedCandidateMap = null;
  _cachedAllCandidates = null;
  _cachedAllCandidateMap = null;
  _cachedKnownResonatorIds = null;
}
