/**
 * Wuthering Waves Character Interaction Profile Predicates & Ordering
 * Phase 7 Step 18: Deterministic Character Interaction Aggregation & Evidence Profile Contract
 *
 * Implements deterministic ID derivation, filter matching, and total ordering comparators.
 */

import { CHARACTER_INTERACTION_PROFILE_RULE_VERSION } from './rules.ts';
import type {
  CharacterInteractionProfile,
  CharacterInteractionProfileFilter
} from './types.ts';

/**
 * Derives a deterministic canonical identifier for a character interaction profile.
 * Format: char-profile:<patch>:<characterId>:<ruleVersion>
 */
export function deriveCharacterProfileId(
  characterId: string,
  patchId: string = '3.7',
  ruleVersion: string = CHARACTER_INTERACTION_PROFILE_RULE_VERSION
): string {
  return `char-profile:${patchId}:${characterId}:${ruleVersion}`;
}

/**
 * Deterministic total ordering comparator for CharacterInteractionProfile records.
 * Order:
 * 1. patchVersion ASC
 * 2. characterId ASC
 * 3. id ASC
 */
export function compareCharacterInteractionProfiles(
  a: CharacterInteractionProfile,
  b: CharacterInteractionProfile
): number {
  if (String(a.patchVersion) !== String(b.patchVersion)) {
    return String(a.patchVersion).localeCompare(String(b.patchVersion));
  }
  if (a.characterId !== b.characterId) {
    return a.characterId.localeCompare(b.characterId);
  }
  return a.id.localeCompare(b.id);
}

/**
 * Evaluates whether a CharacterInteractionProfile matches a multi-dimensional filter.
 */
export function matchesCharacterInteractionProfileFilter(
  profile: CharacterInteractionProfile,
  filter?: CharacterInteractionProfileFilter
): boolean {
  if (!filter) return true;

  if (filter.patchVersion && profile.patchVersion !== filter.patchVersion) return false;
  if (filter.characterId && profile.characterId !== filter.characterId) return false;

  if (filter.hasOutgoing !== undefined) {
    const hasOut = profile.outgoing.length > 0;
    if (hasOut !== filter.hasOutgoing) return false;
  }

  if (filter.hasIncoming !== undefined) {
    const hasIn = profile.incoming.length > 0;
    if (hasIn !== filter.hasIncoming) return false;
  }

  if (filter.hasAuthoritativeOutgoing !== undefined) {
    const hasAuthOut = profile.summary.outgoingAuthoritative > 0;
    if (hasAuthOut !== filter.hasAuthoritativeOutgoing) return false;
  }

  if (filter.hasAuthoritativeIncoming !== undefined) {
    const hasAuthIn = profile.summary.incomingAuthoritative > 0;
    if (hasAuthIn !== filter.hasAuthoritativeIncoming) return false;
  }

  if (filter.minOutgoing !== undefined) {
    if (profile.outgoing.length < filter.minOutgoing) return false;
  }

  if (filter.minIncoming !== undefined) {
    if (profile.incoming.length < filter.minIncoming) return false;
  }

  return true;
}
