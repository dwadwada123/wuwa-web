/**
 * Wuthering Waves Deterministic Investment Effect Predicates
 * Phase 7 Step 15: Deterministic Investment Effect Resolution & Combat Contribution Contract
 *
 * Implements pure, deterministic predicates, filters, sorting functions,
 * and canonical boundary checks for InvestmentEffectResolution records.
 *
 * CENTRAL INVARIANTS:
 * 1. PURE & DETERMINISTIC: All functions are pure, synchronous, and side-effect-free.
 * 2. NO ARBITRARY MATH / NO HEURISTICS: Strict equality, standard string/number comparators.
 * 3. ZERO SCORING: Predicates test data/resolution state only, NEVER gameplay power.
 */

import type {
  InvestmentEffectResolution,
  InvestmentEffectFilter,
  InvestmentEffectResolutionStatus,
  InvestmentEffectCategory
} from './types.ts';
import type { InvestmentDimensionKey } from '../types.ts';
import {
  INVESTMENT_EFFECT_RESOLUTION_RULE_VERSION,
  CANONICAL_RESONATOR_BASE_STATS_LVL90,
  CANONICAL_WEAPON_REFINEMENT_SCALING,
  CANONICAL_SONATA_EFFECT_VALUES,
  STANDARD_INVESTMENT_EFFECT_IDS
} from './rules.ts';
import { CANONICAL_WEAPON_SET, CANONICAL_SONATA_SET } from '../rules.ts';

const CANONICAL_RESONATOR_SET = new Set<string>(Object.keys(CANONICAL_RESONATOR_BASE_STATS_LVL90));
const STANDARD_EFFECT_SET = new Set<string>(STANDARD_INVESTMENT_EFFECT_IDS);

const VALID_DIMENSIONS = new Set<InvestmentDimensionKey>([
  'CHARACTER_LEVEL',
  'WEAPON_IDENTITY',
  'WEAPON_LEVEL',
  'WEAPON_REFINEMENT',
  'SEQUENCE_LEVEL',
  'ECHO_EQUIPPED_COUNT',
  'ECHO_TUNED_COUNT',
  'ECHO_MAX_LEVEL_COUNT',
  'ECHO_SONATA_SET'
]);

/**
 * Derives the canonical deterministic identifier for an investment effect record.
 * Format: investment-effect:3.7:<resonatorId>:<effectId>:7.15.1
 */
export function deriveInvestmentEffectId(
  resonatorId: string,
  effectId: string,
  ruleVersion: string = INVESTMENT_EFFECT_RESOLUTION_RULE_VERSION
): string {
  return `investment-effect:3.7:${resonatorId}:${effectId}:${ruleVersion}`;
}



/**
 * Validates whether an effect ID is in the standard catalog.
 */
export function isCanonicalEffectId(id: unknown): id is string {
  return typeof id === 'string' && (STANDARD_EFFECT_SET.has(id) || id.startsWith('weapon-refinement:'));
}

/**
 * Validates whether an investment dimension key is valid.
 */
export function isCanonicalInvestmentDimension(key: unknown): key is InvestmentDimensionKey {
  return typeof key === 'string' && VALID_DIMENSIONS.has(key as InvestmentDimensionKey);
}

/**
 * Checks whether a weapon has structured refinement scaling tables in Patch 3.7.
 */
export function hasStructuredRefinementScaling(weaponId: string): boolean {
  return weaponId in CANONICAL_WEAPON_REFINEMENT_SCALING;
}

/**
 * Checks whether a sonata code or name exists in Patch 3.7.
 */
export function isCanonicalSonataSet(sonataIdOrName: string): boolean {
  return CANONICAL_SONATA_SET.has(sonataIdOrName);
}

/**
 * Returns true if the resolution outcome is strictly RESOLVED.
 */
export function isInvestmentEffectResolved(record: InvestmentEffectResolution): boolean {
  return record.status === 'RESOLVED';
}

/**
 * Returns true if the resolution outcome is UNKNOWN (due to missing user input).
 */
export function isInvestmentEffectUnknown(record: InvestmentEffectResolution): boolean {
  return record.status === 'UNKNOWN';
}

/**
 * Returns true if the resolution outcome is UNMODELED (due to missing canonical formulas/curves).
 */
export function isInvestmentEffectUnmodeled(record: InvestmentEffectResolution): boolean {
  return record.status === 'UNMODELED';
}

/**
 * Returns true if the resolution outcome is NOT_APPLICABLE (unmet condition / locked).
 */
export function isInvestmentEffectNotApplicable(record: InvestmentEffectResolution): boolean {
  return record.status === 'NOT_APPLICABLE';
}

/**
 * Returns true if the record is INVALID.
 */
export function isInvestmentEffectInvalid(record: InvestmentEffectResolution): boolean {
  return record.status === 'INVALID';
}

/**
 * Returns true if the record encountered a patch mismatch.
 */
export function isInvestmentEffectPatchMismatch(record: InvestmentEffectResolution): boolean {
  return record.status === 'PATCH_MISMATCH';
}

/**
 * Predicate checking whether the effect has factual structured state available
 * for future evaluation layers.
 * NOTE: Answers factual state only; NEVER gameplay quality or readiness to fight.
 */
export function isEffectReadyForFutureEvaluation(record: InvestmentEffectResolution): boolean {
  return record.status === 'RESOLVED' && record.resolvedValue !== null;
}

/**
 * Evaluates whether an InvestmentEffectResolution matches an optional query filter.
 */
export function matchesInvestmentEffectFilter(
  record: InvestmentEffectResolution,
  filter?: InvestmentEffectFilter
): boolean {
  if (!filter) return true;

  if (filter.category && record.category !== filter.category) {
    return false;
  }
  if (filter.status && record.status !== filter.status) {
    return false;
  }
  if (filter.investmentDimension && record.investmentDimension !== filter.investmentDimension) {
    return false;
  }
  if (filter.effectId && record.effectId !== filter.effectId) {
    return false;
  }

  return true;
}

/**
 * Canonical deterministic sorting comparator for InvestmentEffectResolution records.
 * Sorts primarily by resonatorId ascending, then by canonical effect index or effectId.
 */
export function compareInvestmentEffectResolution(
  a: InvestmentEffectResolution,
  b: InvestmentEffectResolution
): number {
  const resCmp = a.resonatorId.localeCompare(b.resonatorId);
  if (resCmp !== 0) return resCmp;

  const aIdx = STANDARD_INVESTMENT_EFFECT_IDS.indexOf(a.effectId);
  const bIdx = STANDARD_INVESTMENT_EFFECT_IDS.indexOf(b.effectId);

  if (aIdx !== -1 && bIdx !== -1) {
    return aIdx - bIdx;
  }
  return a.effectId.localeCompare(b.effectId);
}
