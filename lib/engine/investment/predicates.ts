/**
 * Wuthering Waves Deterministic Resonator Investment Predicates
 * Phase 7 Step 13: Deterministic Resonator Investment Snapshot & Capability Contract
 *
 * Implements deterministic ID derivation, value wrappers, validation predicates,
 * and order-preserving comparators for Resonator investment states.
 */

import { getKnownResonatorIds } from '../team-composition/repository.ts';
import {
  RESONATOR_INVESTMENT_RULE_VERSION,
  INVESTMENT_LIMITS,
  CANONICAL_WEAPON_SET,
  CANONICAL_SONATA_SET
} from './rules.ts';
import type {
  InvestmentValue,
  InvestmentValueStatus,
  ResonatorInvestmentSnapshot
} from './types.ts';

/**
 * Derives the authoritative deterministic ID for a Resonator investment record.
 * Format: resonator-investment:<patchVersion>:<resonatorId>:<ruleVersion>
 *
 * Fully deterministic; does not use UUIDs, timestamps, or random seeds.
 */
export function deriveResonatorInvestmentId(
  patchVersion: string,
  resonatorId: string,
  ruleVersion: string = RESONATOR_INVESTMENT_RULE_VERSION
): string {
  if (!patchVersion || typeof patchVersion !== 'string') {
    throw new Error('deriveResonatorInvestmentId: patchVersion must be a non-empty string.');
  }
  if (!resonatorId || typeof resonatorId !== 'string') {
    throw new Error('deriveResonatorInvestmentId: resonatorId must be a non-empty string.');
  }
  return `resonator-investment:${patchVersion}:${resonatorId}:${ruleVersion}`;
}

/**
 * Creates a KNOWN investment value wrapper.
 */
export function knownValue<T>(value: T): InvestmentValue<T> {
  return Object.freeze({
    status: 'KNOWN',
    value
  });
}

/**
 * Creates an UNKNOWN / unprovided investment value wrapper.
 * Strictly guarantees value is null without numeric defaulting.
 */
export function unknownValue<T = never>(
  status: 'UNKNOWN' | 'NOT_APPLICABLE' | 'INVALID' = 'UNKNOWN'
): InvestmentValue<T> {
  return Object.freeze({
    status,
    value: null
  });
}

/**
 * Type guard verifying if an investment value is explicitly KNOWN.
 */
export function isKnown<T>(
  inv: InvestmentValue<T>
): inv is { readonly status: 'KNOWN'; readonly value: T } {
  return inv.status === 'KNOWN';
}

/**
 * Returns true if an investment value is not known (UNKNOWN, NOT_APPLICABLE, or INVALID).
 */
export function isUnknown<T>(inv: InvestmentValue<T>): boolean {
  return inv.status !== 'KNOWN';
}

/**
 * Validates character level: finite integer in [1, 90].
 */
export function isValidCharacterLevel(level: unknown): level is number {
  return (
    typeof level === 'number' &&
    Number.isFinite(level) &&
    Number.isInteger(level) &&
    level >= INVESTMENT_LIMITS.MIN_CHARACTER_LEVEL &&
    level <= INVESTMENT_LIMITS.MAX_CHARACTER_LEVEL
  );
}

/**
 * Validates weapon level: finite integer in [1, 90].
 */
export function isValidWeaponLevel(level: unknown): level is number {
  return (
    typeof level === 'number' &&
    Number.isFinite(level) &&
    Number.isInteger(level) &&
    level >= INVESTMENT_LIMITS.MIN_WEAPON_LEVEL &&
    level <= INVESTMENT_LIMITS.MAX_WEAPON_LEVEL
  );
}

/**
 * Validates weapon refinement rank: finite integer in [1, 5].
 */
export function isValidRefinementRank(rank: unknown): rank is number {
  return (
    typeof rank === 'number' &&
    Number.isFinite(rank) &&
    Number.isInteger(rank) &&
    rank >= INVESTMENT_LIMITS.MIN_REFINEMENT_RANK &&
    rank <= INVESTMENT_LIMITS.MAX_REFINEMENT_RANK
  );
}

/**
 * Validates resonance sequence level: finite integer in [0, 6].
 */
export function isValidSequenceLevel(seq: unknown): seq is number {
  return (
    typeof seq === 'number' &&
    Number.isFinite(seq) &&
    Number.isInteger(seq) &&
    seq >= INVESTMENT_LIMITS.MIN_SEQUENCE_LEVEL &&
    seq <= INVESTMENT_LIMITS.MAX_SEQUENCE_LEVEL
  );
}

/**
 * Validates echo counts (equipped, tuned, max-level): finite integer in [0, 5].
 */
export function isValidEchoCount(count: unknown): count is number {
  return (
    typeof count === 'number' &&
    Number.isFinite(count) &&
    Number.isInteger(count) &&
    count >= INVESTMENT_LIMITS.MIN_ECHO_COUNT &&
    count <= INVESTMENT_LIMITS.MAX_ECHO_COUNT
  );
}

/**
 * Validates that a Resonator entity ID exists in the canonical Patch 3.7 dataset.
 */
export function isCanonicalResonatorId(id: string): boolean {
  if (typeof id !== 'string' || id.trim() === '') return false;
  const known = getKnownResonatorIds();
  return known.includes(id.trim());
}

/**
 * Validates that a weapon entity ID exists in the canonical Patch 3.7 weapons catalog.
 */
export function isCanonicalWeaponId(id: string): boolean {
  if (typeof id !== 'string' || id.trim() === '') return false;
  return CANONICAL_WEAPON_SET.has(id.trim());
}

/**
 * Validates that a Sonata set ID / code exists in the canonical Patch 3.7 sonatas catalog.
 */
export function isCanonicalSonataId(id: string): boolean {
  if (typeof id !== 'string' || id.trim() === '') return false;
  return CANONICAL_SONATA_SET.has(id.trim());
}

/**
 * Comparator for ResonatorInvestmentSnapshot records.
 * Deterministically orders by resonatorId ASC, then id ASC.
 */
export function compareResonatorInvestmentSnapshots(
  a: ResonatorInvestmentSnapshot,
  b: ResonatorInvestmentSnapshot
): number {
  const cmp = a.resonatorId.localeCompare(b.resonatorId);
  if (cmp !== 0) return cmp;
  return a.id.localeCompare(b.id);
}
